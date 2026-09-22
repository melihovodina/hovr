package overview

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

type env struct {
	t    *testing.T
	pool *pgxpool.Pool
	r    *gin.Engine
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pool := testdb.Connect(t)
	r := gin.New()
	// Stand-in for auth.RequireUser: the test picks the user with a header.
	g := r.Group("/api/bots/:id", func(c *gin.Context) {
		auth.SetUser(c, c.GetHeader("X-Test-User"), "")
		c.Next()
	})
	NewHandler(NewStore(pool)).Routes(g)
	return &env{t: t, pool: pool, r: r}
}

func (e *env) get(user, path string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Test-User", user)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

// chat adds a conversation with questions and their answers, daysAgo in the past.
// answers says for each question whether the bot answered it.
func (e *env) chat(bot, channel, email string, daysAgo int, questions []string, answered []bool) {
	e.t.Helper()
	ctx := context.Background()
	at := time.Now().UTC().AddDate(0, 0, -daysAgo)
	var conversation string
	err := e.pool.QueryRow(ctx, `
		insert into conversations (bot_id, channel, visitor_id, visitor_email, created_at, last_message_at)
		values ($1, $2, 'visitor-1', nullif($3, ''), $4, $4) returning id`,
		bot, channel, email, at).Scan(&conversation)
	if err != nil {
		e.t.Fatal(err)
	}
	for i, q := range questions {
		_, err := e.pool.Exec(ctx, `
			insert into messages (conversation_id, role, content, created_at) values ($1, 'user', $2, $3)`,
			conversation, q, at)
		if err != nil {
			e.t.Fatal(err)
		}
		_, err = e.pool.Exec(ctx, `
			insert into messages (conversation_id, role, content, answered, created_at)
			values ($1, 'assistant', 'Reply.', $2, $3)`, conversation, answered[i], at)
		if err != nil {
			e.t.Fatal(err)
		}
	}
}

func TestStats(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, plans.Free)
	_, other := testdb.NewBot(t, e.pool, plans.Free)

	// This week: 3 questions, one missed, plus a lead.
	e.chat(bot, "widget", "", 1, []string{"Do you ship to Canada?", "do you SHIP to canada"}, []bool{true, true})
	e.chat(bot, "widget", "anna@example.com", 2, []string{"Do you sell tea?"}, []bool{false})
	// Ignored: playground chats and another bot.
	e.chat(bot, "playground", "", 1, []string{"test"}, []bool{true})
	e.chat(other, "widget", "", 1, []string{"Other bot"}, []bool{true})
	// Previous week.
	e.chat(bot, "widget", "", 9, []string{"Old question"}, []bool{true})
	_, err := e.pool.Exec(context.Background(), `
		insert into inbox_items (bot_id, question, normalized, times_asked) values
			($1, 'Do you sell tea?', 'do you sell tea', 4),
			($1, 'Are you hiring?', 'are you hiring', 1),
			($1, 'Answered already', 'answered already', 9)`, bot)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = e.pool.Exec(context.Background(),
		`update inbox_items set status = 'done' where bot_id = $1 and normalized = 'answered already'`, bot)

	w, out := e.get(user, "/api/bots/"+bot+"/stats")
	if w.Code != http.StatusOK || out["days"].(float64) != 7 || out["timezone"] != "UTC" {
		t.Fatalf("stats: %d %s", w.Code, w.Body)
	}
	current := out["current"].(map[string]any)
	if current["questions"] != 3.0 || current["answered"] != 2.0 || current["missed"] != 1.0 ||
		current["conversations"] != 2.0 || current["leads"] != 1.0 {
		t.Errorf("current = %+v", current)
	}
	if rate := current["answeredRate"].(float64); rate < 0.66 || rate > 0.67 {
		t.Errorf("answered rate = %v, want 2/3", rate)
	}
	if previous := out["previous"].(map[string]any); previous["questions"] != 1.0 || previous["answered"] != 1.0 {
		t.Errorf("previous = %+v", previous)
	}

	daily := out["daily"].([]any)
	if len(daily) != 7 {
		t.Fatalf("daily has %d days", len(daily))
	}
	var answered, missed float64
	for _, d := range daily {
		day := d.(map[string]any)
		answered += day["answered"].(float64)
		missed += day["missed"].(float64)
	}
	if answered != 2 || missed != 1 {
		t.Errorf("daily totals: %v answered, %v missed", answered, missed)
	}
	if last := daily[6].(map[string]any); last["date"] != time.Now().UTC().Format(time.DateOnly) {
		t.Errorf("last day = %v, want today", last["date"])
	}

	// The two shipping questions are one entry, keeping the latest wording.
	top := out["topQuestions"].([]any)
	if len(top) != 2 || top[0].(map[string]any)["count"] != 2.0 ||
		top[0].(map[string]any)["question"] != "do you SHIP to canada" {
		t.Errorf("top questions = %+v", top)
	}

	needs := out["needsYou"].([]any)
	if out["openQuestions"] != 2.0 || len(needs) != 2 || needs[0].(map[string]any)["question"] != "Do you sell tea?" {
		t.Errorf("needs you = %v %+v", out["openQuestions"], needs)
	}
}

func TestStatsParams(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, plans.Free)
	bob, _ := testdb.NewBot(t, e.pool, plans.Free)
	base := "/api/bots/" + bot + "/stats"

	for query, want := range map[string]float64{"?days=30": 30, "?days=0": 7, "?days=nope": 7, "?days=400": 90} {
		if _, out := e.get(user, base+query); out["days"] != want {
			t.Errorf("%s: days = %v, want %v", query, out["days"], want)
		}
	}
	if _, out := e.get(user, base+"?tz=Europe/Berlin"); out["timezone"] != "Europe/Berlin" {
		t.Errorf("timezone = %v", out["timezone"])
	}
	// Unknown zones and "Local" (the server's own zone, meaningless to Postgres) fall back.
	for _, tz := range []string{"Mars/Olympus", "Local"} {
		if w, out := e.get(user, base+"?tz="+tz); w.Code != http.StatusOK || out["timezone"] != "UTC" {
			t.Errorf("tz=%s: %d, timezone = %v, want UTC", tz, w.Code, out["timezone"])
		}
	}
	// Nothing to answer yet: the rate is null, not 0.
	if _, out := e.get(user, base); out["current"].(map[string]any)["answeredRate"] != nil {
		t.Error("answered rate without messages is not null")
	}
	if w, _ := e.get(bob, base); w.Code != http.StatusNotFound {
		t.Errorf("someone else's bot: %d, want 404", w.Code)
	}
}
