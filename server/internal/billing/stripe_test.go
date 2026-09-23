package billing

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	stripe "github.com/stripe/stripe-go/v86"
	"github.com/stripe/stripe-go/v86/webhook"

	"github.com/melihovodina/hovr/server/internal/plans"
)

// The Stripe adapter needs no database and no network: a webhook is a signed
// payload, and everything these tests check is how it maps onto a plan.

const (
	hookSecret    = "whsec_test"
	proPrice      = "price_pro"
	businessPrice = "price_business"
)

// signed turns an event into the body and the header Stripe would send.
func signed(t *testing.T, event map[string]any) ([]byte, string) {
	t.Helper()
	payload, err := json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	sig := webhook.ComputeSignature(now, payload, hookSecret)
	return payload, fmt.Sprintf("t=%d,v1=%s", now.Unix(), hex.EncodeToString(sig))
}

// subscriptionEvent is the shape Stripe posts when a subscription changes.
func subscriptionEvent(eventType, price, status string, periodEnd int64) map[string]any {
	return map[string]any{
		"id":          "evt_1",
		"object":      "event",
		"api_version": stripe.APIVersion,
		"type":        eventType,
		"data": map[string]any{"object": map[string]any{
			"id":       "sub_9",
			"customer": "cus_hook",
			"status":   status,
			"items": map[string]any{"data": []any{map[string]any{
				"current_period_end": periodEnd,
				"price":              map[string]any{"id": price},
			}}},
		}},
	}
}

func TestParseEventPlans(t *testing.T) {
	s := newStripe("sk_test", hookSecret, proPrice, businessPrice)
	end := time.Now().Add(30 * 24 * time.Hour).UTC().Truncate(time.Second)

	cases := []struct {
		name   string
		event  map[string]any
		plan   plans.Plan
		ignore bool
	}{
		{"paid for pro", subscriptionEvent("customer.subscription.updated", proPrice, "active", end.Unix()), plans.Pro, false},
		{"paid for business", subscriptionEvent("customer.subscription.created", businessPrice, "active", end.Unix()), plans.Business, false},
		// A trial is a working subscription, so the plan applies.
		{"trialing", subscriptionEvent("customer.subscription.updated", proPrice, "trialing", end.Unix()), plans.Pro, false},
		{"cancelled", subscriptionEvent("customer.subscription.deleted", proPrice, "active", end.Unix()), plans.Free, false},
		// Stripe keeps sending updates for a subscription that stopped paying.
		{"past due", subscriptionEvent("customer.subscription.updated", proPrice, "past_due", end.Unix()), plans.Free, false},
		{"unpaid", subscriptionEvent("customer.subscription.updated", proPrice, "incomplete_expired", end.Unix()), plans.Free, false},
		// A price from another product, or none at all, is not ours to act on.
		{"price we don't sell", subscriptionEvent("customer.subscription.updated", "price_other", "active", end.Unix()), "", true},
		{"unrelated event", map[string]any{"id": "evt_2", "object": "event", "api_version": stripe.APIVersion, "type": "invoice.paid", "data": map[string]any{"object": map[string]any{}}}, "", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			change, err := s.ParseEvent(signed(t, tc.event))
			if err != nil {
				t.Fatalf("ParseEvent: %v", err)
			}
			if change.Plan != tc.plan || change.Ignore != tc.ignore {
				t.Fatalf("plan %q ignore %v, want %q %v", change.Plan, change.Ignore, tc.plan, tc.ignore)
			}
			if tc.ignore {
				return
			}
			if change.CustomerID != "cus_hook" || change.SubscriptionID != "sub_9" {
				t.Errorf("customer %q subscription %q", change.CustomerID, change.SubscriptionID)
			}
			// Only a plan that stays on gets a renewal date to store.
			switch {
			case tc.plan == plans.Free && change.PeriodEnd != nil:
				t.Errorf("ended subscription kept periodEnd %v", change.PeriodEnd)
			case tc.plan != plans.Free && (change.PeriodEnd == nil || !change.PeriodEnd.Equal(end)):
				t.Errorf("periodEnd = %v, want %v", change.PeriodEnd, end)
			}
		})
	}
}

func TestParseEventSignature(t *testing.T) {
	s := newStripe("sk_test", hookSecret, proPrice, businessPrice)
	event := subscriptionEvent("customer.subscription.updated", proPrice, "active", time.Now().Unix())
	payload, header := signed(t, event)

	if _, err := s.ParseEvent(payload, header); err != nil {
		t.Fatalf("a correctly signed event was rejected: %v", err)
	}
	cases := map[string]struct {
		payload []byte
		header  string
	}{
		"no header":        {payload, ""},
		"wrong signature":  {payload, "t=1,v1=00"},
		"body changed":     {append(payload[:len(payload)-1], []byte(`,"x":1}`)...), header},
		"signed elsewhere": {payload, func() string { _, h := signedWith(t, event, "whsec_other"); return h }()},
	}
	for name, tc := range cases {
		if _, err := s.ParseEvent(tc.payload, tc.header); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

// signedWith signs with a secret other than the one the provider holds.
func signedWith(t *testing.T, event map[string]any, secret string) ([]byte, string) {
	t.Helper()
	payload, err := json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	return payload, fmt.Sprintf("t=%d,v1=%s", now.Unix(), hex.EncodeToString(webhook.ComputeSignature(now, payload, secret)))
}
