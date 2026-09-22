package bots

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/plans"
)

// LimitError means the account's plan does not allow another bot.
type LimitError struct {
	Plan plans.Plan
	Max  int
}

func (e *LimitError) Error() string {
	return fmt.Sprintf("plan %s allows %d bots", e.Plan, e.Max)
}

// Store reads and writes bots. Every query is scoped to the owning account.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

const botColumns = `id, name, public_key, allowed_domains, color, avatar_url, position,
	greeting, suggested_questions, show_badge, last_seen_host, last_seen_at, created_at, updated_at`

func scanBot(row pgx.Row) (*Bot, error) {
	var b Bot
	err := row.Scan(&b.ID, &b.Name, &b.PublicKey, &b.AllowedDomains, &b.Color, &b.AvatarURL, &b.Position,
		&b.Greeting, &b.SuggestedQuestions, &b.ShowBadge, &b.LastSeenHost, &b.LastSeenAt, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errNotFound
	}
	return &b, err
}

// Plan returns the account's current plan.
func (s *Store) Plan(ctx context.Context, accountID string) (plans.Plan, error) {
	var p plans.Plan
	err := s.db.QueryRow(ctx, `select plan from accounts where id = $1`, accountID).Scan(&p)
	return p, err
}

// Create adds a bot if the plan allows one more. The account row is locked for the
// count, so two quick requests can't both slip past the limit.
func (s *Store) Create(ctx context.Context, accountID, name, publicKey string) (*Bot, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var plan plans.Plan
	if err := tx.QueryRow(ctx, `select plan from accounts where id = $1 for update`, accountID).Scan(&plan); err != nil {
		return nil, fmt.Errorf("load account: %w", err)
	}
	var count int
	if err := tx.QueryRow(ctx, `select count(*) from bots where account_id = $1`, accountID).Scan(&count); err != nil {
		return nil, err
	}
	if max := plans.For(plan).Bots; count >= max {
		return nil, &LimitError{Plan: plan, Max: max}
	}

	bot, err := scanBot(tx.QueryRow(ctx,
		`insert into bots (account_id, name, public_key) values ($1, $2, $3) returning `+botColumns,
		accountID, name, publicKey))
	if err != nil {
		return nil, err
	}
	return bot, tx.Commit(ctx)
}

// List returns the account's bots, oldest first.
func (s *Store) List(ctx context.Context, accountID string) ([]Bot, error) {
	rows, err := s.db.Query(ctx,
		`select `+botColumns+` from bots where account_id = $1 order by created_at`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Bot{}
	for rows.Next() {
		b, err := scanBot(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}

// Get returns one bot if it belongs to the account.
func (s *Store) Get(ctx context.Context, accountID, id string) (*Bot, error) {
	return scanBot(s.db.QueryRow(ctx,
		`select `+botColumns+` from bots where id = $1 and account_id = $2`, id, accountID))
}

// Save writes the editable settings of b back, if it belongs to the account.
func (s *Store) Save(ctx context.Context, accountID string, b *Bot) (*Bot, error) {
	return scanBot(s.db.QueryRow(ctx, `
		update bots set name = $3, allowed_domains = $4, color = $5, position = $6,
			greeting = $7, suggested_questions = $8, show_badge = $9
		where id = $1 and account_id = $2
		returning `+botColumns,
		b.ID, accountID, b.Name, b.AllowedDomains, b.Color, b.Position,
		b.Greeting, b.SuggestedQuestions, b.ShowBadge))
}

// Delete removes a bot and, through cascades, its sources, chunks and chats.
func (s *Store) Delete(ctx context.Context, accountID, id string) error {
	tag, err := s.db.Exec(ctx, `delete from bots where id = $1 and account_id = $2`, id, accountID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}
