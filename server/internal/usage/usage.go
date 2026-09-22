// Package usage meters the messages an account may send each month.
package usage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

// Period is the counter's month, "YYYY-MM" in UTC.
func Period(t time.Time) string {
	return t.UTC().Format("2006-01")
}

type Counters struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Counters {
	return &Counters{db: db}
}

// Count adds one message, or refuses when the plan's limit is reached. Both happen
// in one statement, so two requests at once can't slip past the limit.
func (c *Counters) Count(ctx context.Context, accountID string, plan plans.Plan) error {
	limit := plans.For(plan).MessagesPerMonth
	var n int
	err := c.db.QueryRow(ctx, `
		insert into usage_counters (account_id, period, messages) values ($1, $2, 1)
		on conflict (account_id, period) do update set messages = usage_counters.messages + 1
		where usage_counters.messages < $3
		returning messages`, accountID, Period(time.Now()), limit).Scan(&n)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.UpgradeRequired(fmt.Sprintf(
			"You've used all %d messages of the %s plan this month. Upgrade to keep chatting.", limit, plan.Name()))
	}
	return err
}

// Refund gives a message back when the visitor never got an answer.
func (c *Counters) Refund(ctx context.Context, accountID string) error {
	_, err := c.db.Exec(ctx, `
		update usage_counters set messages = messages - 1
		where account_id = $1 and period = $2 and messages > 0`, accountID, Period(time.Now()))
	return err
}

// Messages is how many were used this month.
func (c *Counters) Messages(ctx context.Context, accountID string) (int, error) {
	var n int
	err := c.db.QueryRow(ctx, `
		select coalesce((select messages from usage_counters where account_id = $1 and period = $2), 0)`,
		accountID, Period(time.Now())).Scan(&n)
	return n, err
}
