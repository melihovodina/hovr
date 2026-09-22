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

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/config"
)

// Deps are the shared services handlers need.
type Deps struct {
	Config config.Config
	DB     *pgxpool.Pool
	Auth   *auth.Service
}

// New builds the Gin engine: API under /api, the exported client for everything else.
func New(d Deps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())

	r.GET("/healthz", health(d.DB))

	api := r.Group("/api", d.Auth.SameOrigin())
	d.Auth.Routes(api.Group("/auth"))

	user := api.Group("", d.Auth.RequireUser())
	user.GET("/me", me(d.DB))

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

func me(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var plan string
		err := db.QueryRow(c.Request.Context(),
			`select plan from accounts where id = $1`, auth.UserID(c)).Scan(&plan)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Account not found."})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": auth.UserID(c), "email": auth.UserEmail(c), "plan": plan})
	}
}

// serveClient serves the Next.js static export. Unknown paths fall back to their
// ".html" page (Next exports /pricing as pricing.html) and finally to 404.html.
func serveClient(r *gin.Engine, dir string) {
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found."})
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
