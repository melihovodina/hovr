package sources

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/melihovodina/hovr/server/internal/bots"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

var (
	errBotNotFound    = bots.ErrNotFound
	errSourceNotFound = apperr.NotFound("Source not found.")
)

// Store reads and writes sources and their chunks. API queries are scoped to the
// owning account; worker queries are not (the worker serves every account).
type Store struct {
	db     *pgxpool.Pool
	access *bots.Access
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db, access: bots.NewAccess(db)}
}

// newSource is what the API inserts; the worker fills in the rest.
type newSource struct {
	ID          string
	BotID       string
	Type        string
	Title       string
	StoragePath string
	ContentType string
	SizeBytes   int64
}

const sourceColumns = `s.id, s.type, s.title, coalesce(s.content_type, ''), coalesce(s.size_bytes, 0), s.pages,
	(select count(*) from chunks c where c.source_id = s.id), s.status, s.error, s.created_at, s.processed_at`

func scanSource(row pgx.Row) (*Source, error) {
	var s Source
	err := row.Scan(&s.ID, &s.Type, &s.Title, &s.ContentType, &s.SizeBytes, &s.Pages,
		&s.Chunks, &s.Status, &s.Error, &s.CreatedAt, &s.ProcessedAt)
	if err != nil {
		return nil, apperr.Map(err)
	}
	return &s, nil
}

// Create inserts a queued source if the bot belongs to the account and the plan
// allows another source. The account row is locked so the limit holds under races.
func (s *Store) Create(ctx context.Context, accountID string, src newSource) (*Source, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var plan plans.Plan
	err = tx.QueryRow(ctx, `
		select a.plan from accounts a join bots b on b.account_id = a.id
		where a.id = $1 and b.id = $2
		for update of a`, accountID, src.BotID).Scan(&plan)
	if err != nil {
		return nil, apperr.MapNotFound(err, errBotNotFound)
	}
	var count int
	err = tx.QueryRow(ctx, `
		select count(*) from sources s join bots b on b.id = s.bot_id where b.account_id = $1`,
		accountID).Scan(&count)
	if err != nil {
		return nil, err
	}
	if max := plans.For(plan).Sources; count >= max {
		return nil, apperr.UpgradeRequired(fmt.Sprintf(
			"Your %s plan includes %d knowledge sources. Delete one or upgrade to add more.", plan.Name(), max))
	}

	source, err := scanSource(tx.QueryRow(ctx, `
		with s as (
			insert into sources (id, bot_id, type, title, storage_path, content_type, size_bytes)
			values ($1, $2, $3, $4, $5, $6, $7)
			returning *
		)
		select `+sourceColumns+` from s`,
		src.ID, src.BotID, src.Type, src.Title, src.StoragePath, src.ContentType, src.SizeBytes))
	if err != nil {
		return nil, err
	}
	return source, tx.Commit(ctx)
}

// List returns the bot's sources, newest first.
func (s *Store) List(ctx context.Context, accountID, botID string) ([]Source, error) {
	rows, err := s.db.Query(ctx, `
		select `+sourceColumns+` from sources s join bots b on b.id = s.bot_id
		where b.id = $1 and b.account_id = $2
		order by s.created_at desc`, botID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Source{}
	for rows.Next() {
		src, err := scanSource(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *src)
	}
	return out, rows.Err()
}

// BotExists reports whether the bot belongs to the account (for empty lists vs 404).
func (s *Store) BotExists(ctx context.Context, accountID, botID string) error {
	_, err := s.access.Bot(ctx, accountID, botID)
	return err
}

// Delete removes a source and its chunks, and returns the file path to clean up.
func (s *Store) Delete(ctx context.Context, accountID, botID, id string) (storagePath string, err error) {
	var path *string
	err = s.db.QueryRow(ctx, `
		delete from sources s using bots b
		where s.id = $1 and s.bot_id = $2 and b.id = s.bot_id and b.account_id = $3
		returning s.storage_path`, id, botID, accountID).Scan(&path)
	if err != nil {
		return "", apperr.MapNotFound(err, errSourceNotFound)
	}
	if path == nil {
		return "", nil
	}
	return *path, nil
}

// --- worker queries ---

// job is a claimed source the worker processes.
type job struct {
	ID          string
	BotID       string
	Title       string
	StoragePath string
	ContentType string
}

// requeueStuck puts back sources left in "processing" by a crash or restart.
func (s *Store) requeueStuck(ctx context.Context) (int64, error) {
	tag, err := s.db.Exec(ctx, `update sources set status = 'queued' where status = 'processing'`)
	return tag.RowsAffected(), err
}

// claim takes the oldest queued source. SKIP LOCKED means two workers never get the
// same one. It returns nil when there is nothing to do.
func (s *Store) claim(ctx context.Context) (*job, error) {
	var j job
	err := s.db.QueryRow(ctx, `
		update sources set status = 'processing', error = null
		where id = (
			select id from sources where status = 'queued'
			order by created_at
			for update skip locked
			limit 1
		)
		returning id, bot_id, title, coalesce(storage_path, ''), coalesce(content_type, '')`).
		Scan(&j.ID, &j.BotID, &j.Title, &j.StoragePath, &j.ContentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &j, err
}

// complete replaces the source's chunks and marks it ready, in one transaction.
func (s *Store) complete(ctx context.Context, j *job, chunks []string, vectors [][]float32, pages int) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `delete from chunks where source_id = $1`, j.ID); err != nil {
		return err
	}
	rows := make([][]any, len(chunks))
	for i, content := range chunks {
		rows[i] = []any{j.ID, j.BotID, i, content, pgvector.NewVector(vectors[i])}
	}
	_, err = tx.CopyFrom(ctx, pgx.Identifier{"chunks"},
		[]string{"source_id", "bot_id", "chunk_index", "content", "embedding"}, pgx.CopyFromRows(rows))
	if err != nil {
		return apperr.Map(err) // a source deleted mid-processing surfaces as not found
	}
	_, err = tx.Exec(ctx, `
		update sources set status = 'ready', error = null, pages = $2, processed_at = now()
		where id = $1`, j.ID, pages)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// markFailed records why a source couldn't be processed.
func (s *Store) markFailed(ctx context.Context, id, reason string) error {
	_, err := s.db.Exec(ctx, `
		update sources set status = 'failed', error = $2, processed_at = now() where id = $1`, id, reason)
	return err
}

// newID returns a random UUID (v4). Sources get their id before the row exists,
// because the id is part of the storage path of the uploaded file.
func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:]) // never fails; it crashes the program instead
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
