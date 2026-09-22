package billing

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests need the local database (TEST_DATABASE_URL, set by `make test`).

func init() { gin.SetMode(gin.TestMode) }

// fakeProvider stands in for Stripe and records what it was asked.
type fakeProvider struct {
	customerID string
	created    int
	checkout   *Checkout
	change     *Change
	err        error
	lastPlan   plans.Plan
}

func (f *fakeProvider) CreateCustomer(context.Context, string, string) (string, error) {
	f.created++
	return f.customerID, f.err
}

func (f *fakeProvider) CheckoutURL(_ context.Context, customer string, plan plans.Plan, success, _ string) (string, error) {
	f.lastPlan = plan
	return success + "&customer=" + customer, f.err
}

func (f *fakeProvider) PortalURL(_ context.Context, customer, returnURL string) (string, error) {
	return returnURL + "&portal=" + customer, f.err
}

func (f *fakeProvider) Checkout(context.Context, string) (*Checkout, error) {
	if f.checkout == nil {
		return nil, errors.New("no session")
	}
	return f.checkout, nil
}

func (f *fakeProvider) ParseEvent([]byte, string) (*Change, error) {
	if f.change == nil {
		return nil, errors.New("bad signature")
	}
	return f.change, nil
}

type env struct {
	t        *testing.T
	pool     *pgxpool.Pool
	provider *fakeProvider
	r        *gin.Engine
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pool := testdb.Connect(t)
	provider := &fakeProvider{customerID: "cus_test"}
	h := &Handler{store: NewStore(pool), provider: provider, appURL: "http://localhost:3000"}
	r := gin.New()
	r.POST("/api/billing/webhook", h.Webhook)
	// Stand-in for auth.RequireUser: the test picks the user with a header.
	g := r.Group("/api/billing", func(c *gin.Context) {
		auth.SetUser(c, c.GetHeader("X-Test-User"), "")
		c.Next()
	})
	h.Routes(g)
	return &env{t: t, pool: pool, provider: provider, r: r}
}

func (e *env) call(user, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-User", user)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func (e *env) plan(account string) (string, *string, *time.Time) {
	e.t.Helper()
	var plan string
	var subscription *string
	var periodEnd *time.Time
	err := e.pool.QueryRow(context.Background(),
		`select plan, stripe_subscription_id, current_period_end from accounts where id = $1`,
		account).Scan(&plan, &subscription, &periodEnd)
	if err != nil {
		e.t.Fatal(err)
	}
	return plan, subscription, periodEnd
}

func TestSummary(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, plans.Free)
	ctx := context.Background()
	_, _ = e.pool.Exec(ctx, `insert into sources (bot_id, type, title, status) values ($1, 'text', 'FAQ', 'ready')`, bot)
	_, _ = e.pool.Exec(ctx, `insert into usage_counters (account_id, period, messages) values ($1, $2, 12)`,
		user, time.Now().UTC().Format("2006-01"))

	w, out := e.call(user, http.MethodGet, "/api/billing", "")
	if w.Code != http.StatusOK || out["plan"] != "free" || out["planName"] != "Free" ||
		out["hasSubscription"] != false || out["periodEnd"] != nil {
		t.Fatalf("summary: %d %s", w.Code, w.Body)
	}
	usage := out["usage"].(map[string]any)
	if usage["messages"] != 12.0 || usage["bots"] != 1.0 || usage["sources"] != 1.0 {
		t.Errorf("usage = %+v", usage)
	}
	if limits := out["limits"].(map[string]any); limits["messagesPerMonth"] != 100.0 {
		t.Errorf("limits = %+v", limits)
	}
}

func TestCheckoutAndConfirm(t *testing.T) {
	e := newEnv(t)
	user := testdb.NewUser(t, e.pool, plans.Free)

	if w, _ := e.call(user, http.MethodPost, "/api/billing/checkout", `{"plan":"enterprise"}`); w.Code != http.StatusBadRequest {
		t.Errorf("unknown plan: %d", w.Code)
	}
	w, out := e.call(user, http.MethodPost, "/api/billing/checkout", `{"plan":"pro"}`)
	url, _ := out["url"].(string)
	if w.Code != http.StatusOK || !strings.Contains(url, "customer=cus_test") || e.provider.lastPlan != plans.Pro {
		t.Fatalf("checkout: %d %s", w.Code, w.Body)
	}
	var customer *string
	_ = e.pool.QueryRow(context.Background(),
		`select stripe_customer_id from accounts where id = $1`, user).Scan(&customer)
	if customer == nil || *customer != "cus_test" {
		t.Fatalf("customer not stored: %v", customer)
	}
	// A second checkout reuses the customer.
	_, _ = e.call(user, http.MethodPost, "/api/billing/checkout", `{"plan":"business"}`)
	if e.provider.created != 1 {
		t.Errorf("created %d customers, want 1", e.provider.created)
	}

	end := time.Now().Add(30 * 24 * time.Hour).UTC().Truncate(time.Second)
	e.provider.checkout = &Checkout{CustomerID: "cus_test", SubscriptionID: "sub_1", Plan: plans.Pro, PeriodEnd: &end, Paid: true}
	w, out = e.call(user, http.MethodPost, "/api/billing/confirm", `{"sessionId":"cs_1"}`)
	if w.Code != http.StatusOK || out["plan"] != "pro" {
		t.Fatalf("confirm: %d %s", w.Code, w.Body)
	}
	plan, subscription, periodEnd := e.plan(user)
	if plan != "pro" || subscription == nil || *subscription != "sub_1" || periodEnd == nil || !periodEnd.Equal(end) {
		t.Errorf("after confirm: %s %v %v", plan, subscription, periodEnd)
	}
}

func TestConfirmRefusals(t *testing.T) {
	e := newEnv(t)
	anna := testdb.NewUser(t, e.pool, plans.Free)
	_, _ = e.pool.Exec(context.Background(),
		`update accounts set stripe_customer_id = 'cus_anna' where id = $1`, anna)

	cases := map[string]*Checkout{
		"unpaid":          {CustomerID: "cus_anna", Plan: plans.Pro},
		"someone else's":  {CustomerID: "cus_bob", Plan: plans.Pro, Paid: true},
		"unknown plan":    {CustomerID: "cus_anna", Plan: "enterprise", Paid: true},
		"missing session": nil,
	}
	for name, checkout := range cases {
		e.provider.checkout = checkout
		if w, _ := e.call(anna, http.MethodPost, "/api/billing/confirm", `{"sessionId":"cs_1"}`); w.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", name, w.Code)
		}
	}
	if w, _ := e.call(anna, http.MethodPost, "/api/billing/confirm", `{}`); w.Code != http.StatusBadRequest {
		t.Error("empty session accepted")
	}
	if plan, _, _ := e.plan(anna); plan != "free" {
		t.Errorf("plan changed to %s", plan)
	}
}

func TestPortal(t *testing.T) {
	e := newEnv(t)
	user := testdb.NewUser(t, e.pool, plans.Free)
	if w, _ := e.call(user, http.MethodPost, "/api/billing/portal", ""); w.Code != http.StatusBadRequest {
		t.Errorf("portal without subscription: %d, want 400", w.Code)
	}
	_, _ = e.pool.Exec(context.Background(),
		`update accounts set stripe_customer_id = 'cus_test' where id = $1`, user)
	w, out := e.call(user, http.MethodPost, "/api/billing/portal", "")
	if url, _ := out["url"].(string); w.Code != http.StatusOK || !strings.Contains(url, "portal=cus_test") {
		t.Errorf("portal: %d %s", w.Code, w.Body)
	}
}

func TestWebhook(t *testing.T) {
	e := newEnv(t)
	user := testdb.NewUser(t, e.pool, plans.Free)
	_, _ = e.pool.Exec(context.Background(),
		`update accounts set stripe_customer_id = 'cus_hook' where id = $1`, user)
	end := time.Now().Add(30 * 24 * time.Hour).UTC().Truncate(time.Second)

	if w, _ := e.call("", http.MethodPost, "/api/billing/webhook", `{}`); w.Code != http.StatusBadRequest {
		t.Errorf("bad signature: %d, want 400", w.Code)
	}
	e.provider.change = &Change{CustomerID: "cus_hook", SubscriptionID: "sub_9", Plan: plans.Business, PeriodEnd: &end}
	if w, _ := e.call("", http.MethodPost, "/api/billing/webhook", `{}`); w.Code != http.StatusOK {
		t.Fatalf("subscription event: %d", w.Code)
	}
	if plan, subscription, _ := e.plan(user); plan != "business" || *subscription != "sub_9" {
		t.Errorf("after upgrade: %s %v", plan, subscription)
	}

	e.provider.change = &Change{Ignore: true}
	_, _ = e.call("", http.MethodPost, "/api/billing/webhook", `{}`)
	if plan, _, _ := e.plan(user); plan != "business" {
		t.Errorf("ignored event changed the plan to %s", plan)
	}

	e.provider.change = &Change{CustomerID: "cus_hook", SubscriptionID: "sub_9", Plan: plans.Free}
	if w, _ := e.call("", http.MethodPost, "/api/billing/webhook", `{}`); w.Code != http.StatusOK {
		t.Fatalf("cancel event: %d", w.Code)
	}
	plan, subscription, periodEnd := e.plan(user)
	if plan != "free" || subscription != nil || periodEnd != nil {
		t.Errorf("after cancel: %s %v %v", plan, subscription, periodEnd)
	}
}
