package sources

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/melihovodina/hovr/server/internal/ai"
)

const (
	// Without a wake-up signal the worker checks for new work this often.
	pollInterval = 5 * time.Second
	// One source may take at most this long (download, extract, embed, save).
	jobTimeout = 5 * time.Minute
	// Very large documents are refused rather than embedded chunk by chunk forever.
	maxChunksPerSource = 2000
	genericFailure     = "Something went wrong while reading this. Delete it and try again."
)

// FileStore is where uploaded files live (Supabase Storage in production).
type FileStore interface {
	Upload(ctx context.Context, path, contentType string, data []byte) error
	Download(ctx context.Context, path string) ([]byte, error)
	Delete(ctx context.Context, paths ...string) error
}

// Worker turns queued sources into embedded chunks, one at a time. It runs inside
// the server process; a restart re-queues whatever it was in the middle of.
type Worker struct {
	store    *Store
	files    FileStore
	embedder ai.Embedder
	wake     chan struct{}
}

func NewWorker(store *Store, files FileStore, embedder ai.Embedder) *Worker {
	return &Worker{store: store, files: files, embedder: embedder, wake: make(chan struct{}, 1)}
}

// Notify tells the worker there is new work, so it doesn't wait for the next poll.
func (w *Worker) Notify() {
	select {
	case w.wake <- struct{}{}:
	default: // a wake-up is already pending
	}
}

// Run processes sources until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	if n, err := w.store.requeueStuck(ctx); err != nil {
		slog.Error("requeue stuck sources", "err", err)
	} else if n > 0 {
		slog.Info("requeued sources left processing", "count", n)
	}
	for {
		did, err := w.processNext(ctx)
		if err != nil {
			slog.Error("source worker", "err", err)
		}
		if did {
			continue // there may be more queued work
		}
		select {
		case <-ctx.Done():
			return
		case <-w.wake:
		case <-time.After(pollInterval):
		}
	}
}

// processNext claims and processes one source. It reports whether it found one.
func (w *Worker) processNext(ctx context.Context) (bool, error) {
	j, err := w.store.claim(ctx)
	if err != nil || j == nil {
		return false, err
	}
	jobCtx, cancel := context.WithTimeout(ctx, jobTimeout)
	defer cancel()

	start := time.Now()
	err = w.process(jobCtx, j)
	if err == nil {
		slog.Info("source ready", "source", j.ID, "took", time.Since(start).Round(time.Millisecond))
		return true, nil
	}

	reason := genericFailure
	var f *failure
	if errors.As(err, &f) {
		reason = f.reason
	} else {
		slog.Error("process source", "source", j.ID, "err", err)
	}
	// Record the failure even if the job's context ran out.
	if err := w.store.markFailed(context.WithoutCancel(ctx), j.ID, reason); err != nil {
		return true, err
	}
	return true, nil
}

func (w *Worker) process(ctx context.Context, j *job) error {
	data, err := w.files.Download(ctx, j.StoragePath)
	if err != nil {
		return err
	}
	doc, err := extract(j.ContentType, data)
	if err != nil {
		return err
	}
	chunks := chunkText(doc.Text)
	if len(chunks) > maxChunksPerSource {
		return fail("This document is too long. Split it into smaller files and upload them separately.")
	}
	// The title goes into what we embed (not what we store), so a chunk that never
	// names its topic still matches questions about it.
	inputs := make([]string, len(chunks))
	for i, c := range chunks {
		inputs[i] = j.Title + "\n\n" + c
	}
	vectors, err := w.embedder.EmbedDocuments(ctx, inputs)
	if err != nil {
		return err
	}
	return w.store.complete(ctx, j, chunks, vectors, doc.Pages)
}
