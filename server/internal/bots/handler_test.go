package bots

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/db"
)

// These tests run against a real database (the local Supabase one) and are
// skipped when TEST_DATABASE_URL is not set. `make test` sets it.

func init() { gin.SetMode(gin.TestMode) }

type testEnv struct {
	t    *testing.T
	pool *pgxpool.Pool
	r    *gin.Engine
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	pool, err := db.Connect(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	r := gin.New()
	// Stand-in for auth.RequireUser: the test picks the user with a header.
	g := r.Group("/api/bots", func(c *gin.Context) {
		auth.SetUser(c, c.GetHeader("X-Test-User"), "")
		c.Next()
	})
	NewHandler(NewStore(pool)).Routes(g)
	return &testEnv{t: t, pool: pool, r: r}
}

// newUser creates an auth user; the sign-up trigger creates its free account.
func (e *testEnv) newUser(plan string) string {
	e.t.Helper()
	var id string
	email := fmt.Sprintf("bots-test-%s@hovr.test", rand.Text())
	err := e.pool.QueryRow(context.Background(),
		`insert into auth.users (id, email, aud, role) values (gen_random_uuid(), $1, 'authenticated', 'authenticated') returning id`,
		email).Scan(&id)
	if err != nil {
		e.t.Fatalf("create user: %v", err)
	}
	e.t.Cleanup(func() { _, _ = e.pool.Exec(context.Background(), `delete from auth.users where id = $1`, id) })
	if plan != "free" {
		if _, err := e.pool.Exec(context.Background(), `update accounts set plan = $2 where id = $1`, id, plan); err != nil {
			e.t.Fatalf("set plan: %v", err)
		}
	}
	return id
}

func (e *testEnv) do(user, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-User", user)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func TestBotLifecycle(t *testing.T) {
	e := newTestEnv(t)
	anna := e.newUser("free")

	w, bot := e.do(anna, http.MethodPost, "/api/bots", `{"name":"Northwind Coffee"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body)
	}
	id := bot["id"].(string)
	if !strings.HasPrefix(bot["publicKey"].(string), "pub_") || bot["color"] != "#C8F547" || bot["showBadge"] != true {
		t.Errorf("unexpected defaults: %v", bot)
	}

	if w, out := e.do(anna, http.MethodGet, "/api/bots", ""); w.Code != http.StatusOK || len(out["bots"].([]any)) != 1 {
		t.Errorf("list: %d %s", w.Code, w.Body)
	}

	w, updated := e.do(anna, http.MethodPatch, "/api/bots/"+id,
		`{"color":"#2f6b4f","greeting":"Ask me about orders.","allowedDomains":["https://northwind.example/help"],"suggestedQuestions":["Do you ship to Canada?"]}`)
	if w.Code != http.StatusOK || updated["color"] != "#2F6B4F" || updated["allowedDomains"].([]any)[0] != "northwind.example" {
		t.Errorf("update: %d %s", w.Code, w.Body)
	}

	if w, _ := e.do(anna, http.MethodPatch, "/api/bots/"+id, `{"color":"red"}`); w.Code != http.StatusBadRequest {
		t.Errorf("invalid color: %d, want 400", w.Code)
	}
	if w, _ := e.do(anna, http.MethodDelete, "/api/bots/"+id, ""); w.Code != http.StatusNoContent {
		t.Errorf("delete: %d", w.Code)
	}
	if w, _ := e.do(anna, http.MethodGet, "/api/bots/"+id, ""); w.Code != http.StatusNotFound {
		t.Errorf("get after delete: %d, want 404", w.Code)
	}
}

func TestFreePlanLimits(t *testing.T) {
	e := newTestEnv(t)
	anna := e.newUser("free")

	w, bot := e.do(anna, http.MethodPost, "/api/bots", `{"name":"First"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("first bot: %d %s", w.Code, w.Body)
	}
	w, out := e.do(anna, http.MethodPost, "/api/bots", `{"name":"Second"}`)
	if w.Code != http.StatusPaymentRequired || out["code"] != "upgrade_required" {
		t.Errorf("second bot on free: %d %s", w.Code, w.Body)
	}
	if w, _ := e.do(anna, http.MethodPatch, "/api/bots/"+bot["id"].(string), `{"showBadge":false}`); w.Code != http.StatusPaymentRequired {
		t.Errorf("hide badge on free: %d, want 402", w.Code)
	}

	pro := e.newUser("pro")
	for i := 1; i <= 3; i++ {
		if w, _ := e.do(pro, http.MethodPost, "/api/bots", fmt.Sprintf(`{"name":"Bot %d"}`, i)); w.Code != http.StatusCreated {
			t.Fatalf("pro bot %d: %d", i, w.Code)
		}
	}
	if w, _ := e.do(pro, http.MethodPost, "/api/bots", `{"name":"Bot 4"}`); w.Code != http.StatusPaymentRequired {
		t.Errorf("fourth bot on pro: %d, want 402", w.Code)
	}
}

func TestBotsAreIsolatedPerAccount(t *testing.T) {
	e := newTestEnv(t)
	anna, bob := e.newUser("free"), e.newUser("free")

	_, bot := e.do(anna, http.MethodPost, "/api/bots", `{"name":"Anna's bot"}`)
	id := bot["id"].(string)

	if w, out := e.do(bob, http.MethodGet, "/api/bots", ""); len(out["bots"].([]any)) != 0 {
		t.Errorf("bob sees anna's bots: %s", w.Body)
	}
	for _, m := range []struct{ method, body string }{
		{http.MethodGet, ""},
		{http.MethodPatch, `{"name":"Hacked"}`},
		{http.MethodDelete, ""},
	} {
		if w, _ := e.do(bob, m.method, "/api/bots/"+id, m.body); w.Code != http.StatusNotFound {
			t.Errorf("bob %s anna's bot: %d, want 404", m.method, w.Code)
		}
	}
	if w, out := e.do(anna, http.MethodGet, "/api/bots/"+id, ""); w.Code != http.StatusOK || out["name"] != "Anna's bot" {
		t.Errorf("anna's bot changed: %s", w.Body)
	}
	if w, _ := e.do(anna, http.MethodGet, "/api/bots/not-a-uuid", ""); w.Code != http.StatusNotFound {
		t.Errorf("malformed id: %d, want 404", w.Code)
	}
}
