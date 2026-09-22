// Package accounts reads the account behind a signed-in user (one account per user).
package accounts

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/pkg/httpx"
)

// ErrNotFound means there is no account for the user id.
var ErrNotFound = apperr.NotFound("Account not found.")

// Account is the billing owner of bots.
type Account struct {
	ID   string     `json:"id"`
	Plan plans.Plan `json:"plan"`
}

// Store reads accounts.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// Get returns the account with the given id (the Supabase user id).
func (s *Store) Get(ctx context.Context, id string) (*Account, error) {
	a := Account{ID: id}
	err := apperr.Map(s.db.QueryRow(ctx, `select plan from accounts where id = $1`, id).Scan(&a.Plan))
	if errors.Is(err, apperr.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// Routes registers the account endpoints on g, which must be behind auth.RequireUser.
func Routes(g *gin.RouterGroup, store *Store) {
	g.GET("/me", func(c *gin.Context) {
		account, err := store.Get(c.Request.Context(), auth.UserID(c))
		if err != nil {
			httpx.Write(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": account.ID, "email": auth.UserEmail(c), "plan": account.Plan})
	})
}
