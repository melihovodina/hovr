package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	stripe "github.com/stripe/stripe-go/v86"
	"github.com/stripe/stripe-go/v86/webhook"

	"github.com/melihovodina/hovr/server/internal/plans"
)

// ErrCustomerMissing means the stored customer doesn't exist in this Stripe account,
// for example after switching keys; the caller creates a new one.
var ErrCustomerMissing = errors.New("stripe customer missing")

// customerMissing reports whether Stripe rejected the customer we sent.
func customerMissing(err error) bool {
	var stripeErr *stripe.Error
	return errors.As(err, &stripeErr) && stripeErr.Code == stripe.ErrorCodeResourceMissing && stripeErr.Param == "customer"
}

// stripeProvider talks to Stripe in test or live mode, depending on the key.
type stripeProvider struct {
	client        *stripe.Client
	webhookSecret string
	prices        map[plans.Plan]string
}

func newStripe(secretKey, webhookSecret, pricePro, priceBusiness string) *stripeProvider {
	return &stripeProvider{
		client:        stripe.NewClient(secretKey),
		webhookSecret: webhookSecret,
		prices:        map[plans.Plan]string{plans.Pro: pricePro, plans.Business: priceBusiness},
	}
}

func (s *stripeProvider) CreateCustomer(ctx context.Context, accountID, email string) (string, error) {
	customer, err := s.client.V1Customers.Create(ctx, &stripe.CustomerCreateParams{
		Email:    stripe.String(email),
		Metadata: map[string]string{"account_id": accountID},
	})
	if err != nil {
		return "", fmt.Errorf("create stripe customer: %w", err)
	}
	return customer.ID, nil
}

func (s *stripeProvider) CheckoutURL(ctx context.Context, customerID string, plan plans.Plan,
	successURL, cancelURL string) (string, error) {
	price, ok := s.prices[plan]
	if !ok || price == "" {
		return "", fmt.Errorf("no stripe price for plan %s", plan)
	}
	session, err := s.client.V1CheckoutSessions.Create(ctx, &stripe.CheckoutSessionCreateParams{
		Mode:              stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		Customer:          stripe.String(customerID),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		ClientReferenceID: stripe.String(string(plan)),
		LineItems:         []*stripe.CheckoutSessionCreateLineItemParams{{Price: stripe.String(price), Quantity: stripe.Int64(1)}},
	})
	if err != nil {
		if customerMissing(err) {
			return "", ErrCustomerMissing
		}
		return "", fmt.Errorf("create checkout session: %w", err)
	}
	return session.URL, nil
}

func (s *stripeProvider) PortalURL(ctx context.Context, customerID, returnURL string) (string, error) {
	session, err := s.client.V1BillingPortalSessions.Create(ctx, &stripe.BillingPortalSessionCreateParams{
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(returnURL),
	})
	if err != nil {
		if customerMissing(err) {
			return "", ErrCustomerMissing
		}
		return "", fmt.Errorf("create portal session: %w", err)
	}
	return session.URL, nil
}

// Checkout reads a finished session, so the plan applies as soon as the visitor
// comes back, without waiting for the webhook.
func (s *stripeProvider) Checkout(ctx context.Context, sessionID string) (*Checkout, error) {
	session, err := s.client.V1CheckoutSessions.Retrieve(ctx, sessionID, &stripe.CheckoutSessionRetrieveParams{
		Params: stripe.Params{Expand: []*string{stripe.String("subscription"), stripe.String("customer")}},
	})
	if err != nil {
		return nil, fmt.Errorf("retrieve checkout session: %w", err)
	}
	out := &Checkout{Paid: session.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid ||
		session.PaymentStatus == stripe.CheckoutSessionPaymentStatusNoPaymentRequired}
	if session.Customer != nil {
		out.CustomerID = session.Customer.ID
	}
	if session.Subscription != nil {
		out.SubscriptionID = session.Subscription.ID
		out.Plan, out.PeriodEnd = s.subscriptionPlan(session.Subscription)
	}
	if out.Plan == "" {
		out.Plan = plans.Plan(session.ClientReferenceID)
	}
	return out, nil
}

func (s *stripeProvider) ParseEvent(payload []byte, signature string) (*Change, error) {
	event, err := webhook.ConstructEvent(payload, signature, s.webhookSecret)
	if err != nil {
		return nil, fmt.Errorf("verify webhook signature: %w", err)
	}
	switch event.Type {
	case "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			return nil, fmt.Errorf("read subscription event: %w", err)
		}
		change := &Change{SubscriptionID: sub.ID}
		if sub.Customer != nil {
			change.CustomerID = sub.Customer.ID
		}
		if event.Type == "customer.subscription.deleted" || !activeStatus(sub.Status) {
			change.Plan = plans.Free
			return change, nil
		}
		change.Plan, change.PeriodEnd = s.subscriptionPlan(&sub)
		if change.Plan == "" {
			change.Ignore = true // a price we don't sell
		}
		return change, nil
	default:
		return &Change{Ignore: true}, nil
	}
}

// subscriptionPlan maps the subscribed price back to our plan.
func (s *stripeProvider) subscriptionPlan(sub *stripe.Subscription) (plans.Plan, *time.Time) {
	if sub.Items == nil || len(sub.Items.Data) == 0 {
		return "", nil
	}
	item := sub.Items.Data[0]
	var end *time.Time
	if item.CurrentPeriodEnd > 0 {
		t := time.Unix(item.CurrentPeriodEnd, 0).UTC()
		end = &t
	}
	if item.Price == nil {
		return "", end
	}
	for plan, price := range s.prices {
		if price != "" && price == item.Price.ID {
			return plan, end
		}
	}
	return "", end
}

func activeStatus(status stripe.SubscriptionStatus) bool {
	return status == stripe.SubscriptionStatusActive || status == stripe.SubscriptionStatusTrialing
}
