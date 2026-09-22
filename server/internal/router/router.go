// Package router wires HTTP routes to handlers.
package router

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/accounts"
	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/bots"
	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/internal/config"
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
	Sources *sources.Handler
	Chat    *chat.Handler
	Widget  *widget.Handler
}

// New builds the Gin engine: API under /api, the exported client for everything else.
func New(d Deps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())

	r.GET("/healthz", health(d.DB))

	api := r.Group("/api", d.Auth.SameOrigin())
	d.Auth.Routes(api.Group("/auth"))
	d.Widget.Routes(api.Group("/widget/:key"))

	accountStore := accounts.NewStore(d.DB)
	user := api.Group("", d.Auth.RequireUser())
	accounts.Routes(user, accountStore)
	bots.NewHandler(bots.NewStore(d.DB), accountStore, d.Files).Routes(user.Group("/bots"))
	d.Sources.Routes(user.Group("/bots/:id/sources"))
	d.Chat.Routes(user.Group("/bots/:id"))

	if d.Config.StaticDir != "" {
		serveClient(r, d.Config.StaticDir)
	}
	return r
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
		c.Status(http.StatusNotFound)
		c.File(filepath.Join(dir, "404.html"))
	})
}
