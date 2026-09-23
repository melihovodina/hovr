// Package router wires HTTP routes to handlers.
package router

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/accounts"
	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/billing"
	"github.com/melihovodina/hovr/server/internal/bots"
	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/internal/config"
	"github.com/melihovodina/hovr/server/internal/inbox"
	"github.com/melihovodina/hovr/server/internal/overview"
	"github.com/melihovodina/hovr/server/internal/sources"
	"github.com/melihovodina/hovr/server/internal/widget"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

// Deps are the shared services handlers need.
type Deps struct {
	Config  config.Config
	DB      *pgxpool.Pool
	Auth    *auth.Service
	Files   bots.FileRemover
	Avatars bots.AvatarStore
	Sources *sources.Handler
	Chat    *chat.Handler
	Widget  *widget.Handler
	Inbox   *inbox.Handler
	Stats   *overview.Handler
	Billing *billing.Handler
}

// New builds the Gin engine: API under /api, the exported client for everything else.
func New(d Deps) (*gin.Engine, error) {
	r, err := newEngine(d.Config)
	if err != nil {
		return nil, err
	}

	r.GET("/healthz", health(d.DB))

	// Stripe posts from its own servers, so the webhook sits outside the Origin check.
	r.POST("/api/billing/webhook", d.Billing.Webhook)

	api := r.Group("/api", d.Auth.SameOrigin())
	d.Auth.Routes(api.Group("/auth"))
	d.Widget.Routes(api.Group("/widget/:key"))

	accountStore := accounts.NewStore(d.DB)
	user := api.Group("", d.Auth.RequireUser())
	accounts.Routes(user, accountStore)
	bots.NewHandler(bots.NewStore(d.DB), accountStore, d.Files, d.Avatars).Routes(user.Group("/bots"))
	d.Sources.Routes(user.Group("/bots/:id/sources"))
	d.Chat.Routes(user.Group("/bots/:id"))
	d.Inbox.Routes(user.Group("/bots/:id"))
	d.Stats.Routes(user.Group("/bots/:id"))
	d.Billing.Routes(user.Group("/billing"))

	if d.Config.StaticDir != "" {
		serveClient(r, d.Config.StaticDir)
	}
	return r, nil
}

// newEngine builds the engine and decides where the client IP comes from, which is
// what the widget rate limits count per.
func newEngine(cfg config.Config) (*gin.Engine, error) {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())

	// Gin reads the client IP from X-Forwarded-For, which anyone can send. Only the
	// proxies named here may set it; with none configured the address the connection
	// came from is used instead.
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		return nil, fmt.Errorf("TRUSTED_PROXIES: %w", err)
	}
	// A host that always overwrites a header with the real visitor (Cloudflare's
	// CF-Connecting-IP) is more reliable than walking the forwarded chain, whose
	// last hop can be a different edge address on every request. Only set this when
	// the host is known to overwrite it, since the header is then trusted as is.
	if cfg.ClientIPHeader != "" {
		r.TrustedPlatform = cfg.ClientIPHeader
	}
	return r, nil
}

func health(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "db": "down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "db": "up"})
	}
}

// serveClient serves the Next.js static export. Unknown paths fall back to their
// ".html" page (Next exports /pricing as pricing.html) and finally to 404.html.
func serveClient(r *gin.Engine, dir string) {
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			httpx.Error(c, http.StatusNotFound, "Not found.")
			return
		}
		clean := filepath.Clean("/" + c.Request.URL.Path)
		for _, candidate := range []string{clean, clean + ".html", filepath.Join(clean, "index.html")} {
			p := filepath.Join(dir, candidate)
			if info, err := os.Stat(p); err == nil && !info.IsDir() {
				c.File(p)
				return
			}
		}
		// c.File would answer 200, so the page is sent with an explicit 404.
		page, err := os.ReadFile(filepath.Join(dir, "404.html"))
		if err != nil {
			c.String(http.StatusNotFound, "Not found")
			return
		}
		c.Data(http.StatusNotFound, "text/html; charset=utf-8", page)
	})
}
