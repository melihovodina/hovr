package bots

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

// ErrNotFound is what every feature answers for a bot that doesn't exist or isn't yours.
var ErrNotFound = apperr.NotFound("Bot not found.")

// Owned is a bot together with its owner's plan.
type Owned struct {
	ID   string
	Name string
	Plan plans.Plan
}

// Access answers "is this bot this account's?" for the features built on bots.
type Access struct {
	db *pgxpool.Pool
}

func NewAccess(db *pgxpool.Pool) *Access {
	return &Access{db: db}
}

func (a *Access) Bot(ctx context.Context, accountID, botID string) (Owned, error) {
	bot := Owned{ID: botID}
	err := a.db.QueryRow(ctx, `
		select b.name, a.plan from bots b join accounts a on a.id = b.account_id
		where b.id = $1 and a.id = $2`, botID, accountID).Scan(&bot.Name, &bot.Plan)
	return bot, apperr.MapNotFound(err, ErrNotFound)
}
