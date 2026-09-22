// Command hovr runs the hovr HTTP server.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/internal/config"
	"github.com/melihovodina/hovr/server/internal/db"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/internal/router"
	"github.com/melihovodina/hovr/server/internal/sources"
	"github.com/melihovodina/hovr/server/internal/storage"
	"github.com/melihovodina/hovr/server/internal/supabase"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	authService := auth.NewService(
		auth.NewVerifier(ctx, cfg.SupabaseURL),
		supabase.NewAuth(cfg.SupabaseURL, cfg.SupabasePublishableKey),
		cfg.AppURL,
	)

	embedder, err := ai.NewEmbedder(ctx, cfg.GeminiAPIKey)
	if err != nil {
		return err
	}
	chatModel, err := ai.NewChatModel(ctx, cfg.GeminiAPIKey)
	if err != nil {
		return err
	}
	files := storage.New(cfg.SupabaseURL, cfg.SupabaseSecretKey, "sources")
	sourceStore := sources.NewStore(pool)
	worker := sources.NewWorker(sourceStore, files, embedder)
	go worker.Run(ctx)

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: router.New(router.Deps{
			Config:  cfg,
			DB:      pool,
			Auth:    authService,
			Files:   files,
			Sources: sources.NewHandler(sourceStore, files, worker),
			Chat:    chat.NewHandler(chat.NewStore(pool), rag.NewAnswerer(rag.New(pool, embedder), chatModel)),
		}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
