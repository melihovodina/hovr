package widget

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/test/fakeai"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests need the local database (TEST_DATABASE_URL, set by `make test`).

func init() { gin.SetMode(gin.TestMode) }

type replyModel struct{}

func (replyModel) Stream(_ context.Context, _ string, _ []ai.Turn, onText func(string) error) error {
	return onText("[no-answer] Not sure.")
}

type env struct {
	pool *pgxpool.Pool
	r    *gin.Engine
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pool := testdb.Connect(t)
	service := chat.NewService(chat.NewStore(pool), rag.NewAnswerer(rag.New(pool, fakeai.Embedder{}), replyModel{}))
	r := gin.New()
	NewHandler(NewStore(pool), service, "http://hovr.test").Routes(r.Group("/api/widget/:key"))
	return &env{pool: pool, r: r}
}

// newBot creates a bot allowed on example.com and returns (botID, publicKey).
func (e *env) newBot(t *testing.T) (string, string) {
	t.Helper()
	_, bot := testdb.NewBot(t, e.pool, "free")
	var key string
	err := e.pool.QueryRow(context.Background(),
		`update bots set allowed_domains = '{example.com}' where id = $1 returning public_key`, bot).Scan(&key)
	if err != nil {
		t.Fatal(err)
	}
	return bot, key
}

func (e *env) call(method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func TestConfig(t *testing.T) {
	e := newEnv(t)
	bot, key := e.newBot(t)
	// Hidden badge on a plan that doesn't allow it (e.g. after a downgrade).
	_, _ = e.pool.Exec(context.Background(), `update bots set show_badge = false where id = $1`, bot)

	w, out := e.call(http.MethodGet, "/api/widget/"+key+"/config?host=https://shop.example.com/pricing", "")
	if w.Code != http.StatusOK || out["name"] != "Test bot" || out["showBadge"] != true || out["position"] != "right" {
		t.Fatalf("config: %d %s", w.Code, w.Body)
	}
	var seen string
	_ = e.pool.QueryRow(context.Background(), `select last_seen_host from bots where id = $1`, bot).Scan(&seen)
	if seen != "shop.example.com" {
		t.Errorf("last seen host = %q", seen)
	}

	cases := []struct {
		name, path string
		status     int
		code       string
	}{
		{"other site", "/api/widget/" + key + "/config?host=https://evil.io", http.StatusForbidden, "domain_not_allowed"},
		{"no host", "/api/widget/" + key + "/config", http.StatusForbidden, "domain_not_allowed"},
		{"app preview", "/api/widget/" + key + "/config?host=http://hovr.test/app", http.StatusOK, ""},
		{"unknown key", "/api/widget/pub_doesnotexist123/config?host=example.com", http.StatusNotFound, ""},
		{"malformed key", "/api/widget/nope/config?host=example.com", http.StatusNotFound, ""},
	}
	for _, tc := range cases {
		w, out := e.call(http.MethodGet, tc.path, "")
		if w.Code != tc.status || (tc.code != "" && out["code"] != tc.code) {
			t.Errorf("%s: %d %s", tc.name, w.Code, w.Body)
		}
	}
	// The app preview doesn't count as "seen on a site".
	_ = e.pool.QueryRow(context.Background(), `select last_seen_host from bots where id = $1`, bot).Scan(&seen)
	if seen != "shop.example.com" {
		t.Errorf("last seen host after preview = %q", seen)
	}
}

func TestVisitorChat(t *testing.T) {
	e := newEnv(t)
	bot, key := e.newBot(t)
	base := "/api/widget/" + key

	w, _ := e.call(http.MethodPost, base+"/chat", `{"message":"do you sell tea?","visitorId":"visitor-1","host":"example.com"}`)
	body := w.Body.String()
	if w.Code != http.StatusOK || !strings.Contains(body, "event:done") {
		t.Fatalf("chat: %d %s", w.Code, body)
	}
	_, idLine, _ := strings.Cut(body, "event:conversation\ndata:")
	var start struct{ ID string }
	_ = json.Unmarshal([]byte(strings.SplitN(idLine, "\n", 2)[0]), &start)

	var channel, visitor string
	_ = e.pool.QueryRow(context.Background(), `select channel, visitor_id from conversations where id = $1`,
		start.ID).Scan(&channel, &visitor)
	if channel != "widget" || visitor != "visitor-1" {
		t.Errorf("conversation channel=%q visitor=%q", channel, visitor)
	}

	w, out := e.call(http.MethodGet, base+"/conversations/"+start.ID+"?visitorId=visitor-1&host=example.com", "")
	if msgs, _ := out["messages"].([]any); w.Code != http.StatusOK || len(msgs) != 2 {
		t.Errorf("restore: %d %s", w.Code, w.Body)
	}
	if w, _ := e.call(http.MethodGet, base+"/conversations/"+start.ID+"?visitorId=visitor-2&host=example.com", ""); w.Code != http.StatusNotFound {
		t.Errorf("another visitor restores it: %d", w.Code)
	}

	lead := `{"conversationId":"` + start.ID + `","visitorId":"visitor-1","email":"anna@example.com","host":"example.com"}`
	if w, _ := e.call(http.MethodPost, base+"/lead", lead); w.Code != http.StatusNoContent {
		t.Errorf("lead: %d %s", w.Code, w.Body)
	}

	for name, body := range map[string]string{
		"no visitor":  `{"message":"hi","host":"example.com"}`,
		"other site":  `{"message":"hi","visitorId":"visitor-1","host":"evil.io"}`,
		"empty":       `{"message":" ","visitorId":"visitor-1","host":"example.com"}`,
		"bad conv id": `{"message":"hi","visitorId":"visitor-1","host":"example.com","conversationId":"x"}`,
	} {
		if w, _ := e.call(http.MethodPost, base+"/chat", body); w.Code < 400 {
			t.Errorf("%s: %d, want an error", name, w.Code)
		}
	}

	var usage int
	_ = e.pool.QueryRow(context.Background(), `
		select coalesce(sum(u.messages), 0) from usage_counters u join bots b on b.account_id = u.account_id
		where b.id = $1`, bot).Scan(&usage)
	if usage != 1 {
		t.Errorf("usage = %d, want 1 (only the answered request)", usage)
	}
}

func TestRateLimit(t *testing.T) {
	e := newEnv(t)
	_, key := e.newBot(t)
	var last int
	for range 11 {
		w, _ := e.call(http.MethodPost, "/api/widget/"+key+"/chat", `{"message":"hi","visitorId":"visitor-1","host":"example.com"}`)
		last = w.Code
	}
	if last != http.StatusTooManyRequests {
		t.Errorf("11th message in a minute: %d, want 429", last)
	}
}
