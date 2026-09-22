package billing

import (
	"context"
	"time"

	"github.com/melihovodina/hovr/server/internal/plans"
)

// Checkout is what a finished Checkout session granted.
type Checkout struct {
	CustomerID     string
	SubscriptionID string
	Plan           plans.Plan
	PeriodEnd      *time.Time
	Paid           bool
}

// Change is a subscription event from a webhook.
type Change struct {
	CustomerID     string
	SubscriptionID string
	Plan           plans.Plan // free when the subscription ended
	PeriodEnd      *time.Time
	Ignore         bool // an event we don't act on
}

// Provider is the payment side, so the handlers don't depend on Stripe directly.
type Provider interface {
	CreateCustomer(ctx context.Context, accountID, email string) (string, error)
	CheckoutURL(ctx context.Context, customerID string, plan plans.Plan, successURL, cancelURL string) (string, error)
	PortalURL(ctx context.Context, customerID, returnURL string) (string, error)
	Checkout(ctx context.Context, sessionID string) (*Checkout, error)
	// ParseEvent verifies the webhook signature and returns what changed.
	ParseEvent(payload []byte, signature string) (*Change, error)
}
