// Package billing is plans and payments: usage, Stripe Checkout, the customer
// portal and webhooks.
package billing

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
)

var errAccountNotFound = apperr.NotFound("Account not found.")

// Account is the billing state of one account.
type Account struct {
	ID             string
	Email          string
	Plan           plans.Plan
	CustomerID     *string
	SubscriptionID *string
	PeriodEnd      *time.Time
}

// Usage is what the account has used this month against its plan.
type Usage struct {
	Messages int `json:"messages"`
	Bots     int `json:"bots"`
	Sources  int `json:"sources"`
}

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) account(ctx context.Context, accountID string) (*Account, error) {
	var a Account
	err := s.db.QueryRow(ctx, `
		select a.id, coalesce(u.email, ''), a.plan, a.stripe_customer_id, a.stripe_subscription_id, a.current_period_end
		from accounts a join auth.users u on u.id = a.id
		where a.id = $1`, accountID).Scan(&a.ID, &a.Email, &a.Plan, &a.CustomerID, &a.SubscriptionID, &a.PeriodEnd)
	if err != nil {
		return nil, apperr.MapNotFound(err, errAccountNotFound)
	}
	return &a, nil
}

// usage counts this month's messages and what the account has created.
func (s *Store) usage(ctx context.Context, accountID string) (Usage, error) {
	var u Usage
	err := s.db.QueryRow(ctx, `
		select coalesce((select messages from usage_counters where account_id = $1 and period = $2), 0),
			(select count(*) from bots where account_id = $1),
			(select count(*) from sources s join bots b on b.id = s.bot_id where b.account_id = $1)`,
		accountID, time.Now().UTC().Format("2006-01")).Scan(&u.Messages, &u.Bots, &u.Sources)
	return u, err
}

func (s *Store) setCustomer(ctx context.Context, accountID, customerID string) error {
	_, err := s.db.Exec(ctx, `update accounts set stripe_customer_id = $2 where id = $1`, accountID, customerID)
	return apperr.Map(err)
}

// applySubscription writes the plan a Stripe subscription grants. It matches the
// account by customer id, so webhooks don't need to know who is signed in.
func (s *Store) applySubscription(ctx context.Context, customerID, subscriptionID string,
	plan plans.Plan, periodEnd *time.Time) error {
	_, err := s.db.Exec(ctx, `
		update accounts set plan = $2, stripe_subscription_id = $3, current_period_end = $4
		where stripe_customer_id = $1`, customerID, plan, subscriptionID, periodEnd)
	return apperr.Map(err)
}

// downgrade puts the account back on free when its subscription ends.
func (s *Store) downgrade(ctx context.Context, customerID string) error {
	_, err := s.db.Exec(ctx, `
		update accounts set plan = 'free', stripe_subscription_id = null, current_period_end = null
		where stripe_customer_id = $1`, customerID)
	return apperr.Map(err)
}
