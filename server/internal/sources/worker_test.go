package sources

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/test/fakestorage"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests need the local database (TEST_DATABASE_URL, set by `make test`).

type workerEnv struct {
	t      *testing.T
	pool   *pgxpool.Pool
	store  *Store
	files  *fakestorage.Files
	worker *Worker
}

func newWorkerEnv(t *testing.T) *workerEnv {
	t.Helper()
	pool := testdb.Connect(t)
	store, files := NewStore(pool), fakestorage.New()
	return &workerEnv{t: t, pool: pool, store: store, files: files, worker: NewWorker(store, files, ai.Mock{})}
}

// queue stores a file and inserts a queued source for it, like the upload endpoint.
func (e *workerEnv) queue(account, bot, title, contentType string, data []byte) string {
	e.t.Helper()
	src := newSource{ID: newID(), BotID: bot, Type: typeFile, Title: title, ContentType: contentType, SizeBytes: int64(len(data))}
	src.StoragePath = bot + "/" + src.ID + "/file"
	if err := e.files.Upload(context.Background(), src.StoragePath, contentType, data); err != nil {
		e.t.Fatal(err)
	}
	if _, err := e.store.Create(context.Background(), account, src); err != nil {
		e.t.Fatalf("create source: %v", err)
	}
	return src.ID
}

func (e *workerEnv) source(id string) (status string, reason *string, chunks int, dims int) {
	e.t.Helper()
	err := e.pool.QueryRow(context.Background(), `
		select s.status, s.error,
			(select count(*) from chunks c where c.source_id = s.id),
			coalesce((select max(vector_dims(c.embedding)) from chunks c where c.source_id = s.id), 0)
		from sources s where s.id = $1`, id).Scan(&status, &reason, &chunks, &dims)
	if err != nil {
		e.t.Fatalf("load source: %v", err)
	}
	return
}

// drain processes queued work until none is left.
func (e *workerEnv) drain() {
	e.t.Helper()
	for {
		did, err := e.worker.processNext(context.Background())
		if err != nil {
			e.t.Fatalf("processNext: %v", err)
		}
		if !did {
			return
		}
	}
}

func TestWorkerProcessesSources(t *testing.T) {
	e := newWorkerEnv(t)
	account, bot := testdb.NewBot(t, e.pool, plans.Free)

	pdfID := e.queue(account, bot, "shipping.pdf", typePDF, testPDF("Shipping and delivery.", "We ship to Canada."))
	mdID := e.queue(account, bot, "faq.md", typeMarkdown, []byte("# FAQ\n\nYes, we sell grinders."))
	e.drain()

	for name, id := range map[string]string{"pdf": pdfID, "markdown": mdID} {
		status, reason, chunks, dims := e.source(id)
		if status != statusReady || reason != nil || chunks != 1 || dims != ai.Dims {
			t.Errorf("%s: status=%s reason=%v chunks=%d dims=%d", name, status, reason, chunks, dims)
		}
	}
	var pages int
	_ = e.pool.QueryRow(context.Background(), `select pages from sources where id = $1`, pdfID).Scan(&pages)
	if pages != 1 {
		t.Errorf("pdf pages = %d, want 1", pages)
	}
}

func TestWorkerRecordsFailures(t *testing.T) {
	e := newWorkerEnv(t)
	account, bot := testdb.NewBot(t, e.pool, plans.Free)

	scanned := e.queue(account, bot, "scan.pdf", typePDF, testPDF())
	missing := e.queue(account, bot, "gone.txt", typeText, []byte("hello"))
	e.files.Delete(context.Background(), bot+"/"+missing+"/file") // file vanished from storage
	e.drain()

	if status, reason, chunks, _ := e.source(scanned); status != statusFailed || reason == nil ||
		*reason != "This PDF has no text inside. Is it a scanned image?" || chunks != 0 {
		t.Errorf("scanned pdf: status=%s reason=%v chunks=%d", status, reason, chunks)
	}
	// An internal error shows the generic message, not the technical one.
	if status, reason, _, _ := e.source(missing); status != statusFailed || reason == nil || *reason != genericFailure {
		t.Errorf("missing file: status=%s reason=%v", status, reason)
	}
}

func TestWorkerRequeuesStuckSources(t *testing.T) {
	e := newWorkerEnv(t)
	account, bot := testdb.NewBot(t, e.pool, plans.Free)
	id := e.queue(account, bot, "faq.md", typeMarkdown, []byte("Yes, we sell grinders."))
	// Simulate a crash in the middle of processing.
	if _, err := e.pool.Exec(context.Background(), `update sources set status = 'processing' where id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if n, err := e.store.requeueStuck(context.Background()); err != nil || n < 1 {
		t.Fatalf("requeueStuck = %d, %v", n, err)
	}
	e.drain()
	if status, _, _, _ := e.source(id); status != statusReady {
		t.Errorf("status after requeue = %s, want ready", status)
	}
}
