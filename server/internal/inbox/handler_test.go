package inbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/chat"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/internal/sources"
	"github.com/melihovodina/hovr/server/test/fakeai"
	"github.com/melihovodina/hovr/server/test/fakestorage"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests need the local database (TEST_DATABASE_URL, set by `make test`).

func init() { gin.SetMode(gin.TestMode) }

type env struct {
	t     *testing.T
	pool  *pgxpool.Pool
	files *fakestorage.Files
	r     *gin.Engine
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pool := testdb.Connect(t)
	files := fakestorage.New()
	store := sources.NewStore(pool)
	src := sources.NewHandler(store, files, sources.NewWorker(store, files, fakeai.Embedder{}))
	r := gin.New()
	// Stand-in for auth.RequireUser: the test picks the user with a header.
	g := r.Group("/api/bots/:id", func(c *gin.Context) {
		auth.SetUser(c, c.GetHeader("X-Test-User"), "")
		c.Next()
	})
	NewHandler(NewStore(pool), chat.NewStore(pool), src).Routes(g)
	return &env{t: t, pool: pool, files: files, r: r}
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

func (e *env) exec(sql string, args ...any) {
	e.t.Helper()
	if _, err := e.pool.Exec(context.Background(), sql, args...); err != nil {
		e.t.Fatal(err)
	}
}

// conversation adds a widget conversation with a question the bot couldn't answer.
func (e *env) conversation(bot, question, email string) string {
	e.t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(), `
		insert into conversations (bot_id, channel, visitor_id, visitor_email)
		values ($1, 'widget', 'visitor-1', nullif($2, '')) returning id`, bot, email).Scan(&id)
	if err != nil {
		e.t.Fatal(err)
	}
	e.exec(`insert into messages (conversation_id, role, content) values ($1, 'user', $2)`, id, question)
	e.exec(`insert into messages (conversation_id, role, content, answered) values ($1, 'assistant', 'Not sure.', false)`, id)
	return id
}

// item adds an open inbox item and returns its id.
func (e *env) item(bot, question, conversation string, daysAgo int) string {
	e.t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(), `
		insert into inbox_items (bot_id, question, normalized, last_conversation_id, last_asked_at)
		values ($1, $2, lower($2), $3, now() - make_interval(days => $4)) returning id`,
		bot, question, conversation, daysAgo).Scan(&id)
	if err != nil {
		e.t.Fatal(err)
	}
	return id
}

func TestTeachYourBot(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, plans.Free)
	conv := e.conversation(bot, "Do you sell tea?", "")
	id := e.item(bot, "Do you sell tea?", conv, 0)
	base := "/api/bots/" + bot + "/inbox"

	w, out := e.call(user, http.MethodGet, base, "")
	if items := out["items"].([]any); w.Code != http.StatusOK || len(items) != 1 || out["historyDays"].(float64) != 7 {
		t.Fatalf("list: %d %s", w.Code, w.Body)
	}
	w, out = e.call(user, http.MethodGet, base+"/"+id, "")
	if msgs := out["messages"].([]any); w.Code != http.StatusOK || len(msgs) != 2 {
		t.Fatalf("get: %d %s", w.Code, w.Body)
	}

	if w, _ := e.call(user, http.MethodPost, base+"/"+id+"/answer", `{"answer":"  "}`); w.Code != http.StatusBadRequest {
		t.Errorf("empty answer: %d", w.Code)
	}
	w, out = e.call(user, http.MethodPost, base+"/"+id+"/answer", `{"answer":"Yes, green and black tea."}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("answer: %d %s", w.Code, w.Body)
	}
	item, source := out["item"].(map[string]any), out["source"].(map[string]any)
	if item["status"] != "done" || item["answerSourceId"] != source["id"] ||
		source["type"] != "inbox" || source["title"] != "Do you sell tea?" || source["status"] != "queued" {
		t.Errorf("answer = %+v", out)
	}
	stored, _ := e.files.Download(context.Background(), bot+"/"+source["id"].(string)+"/text.txt")
	if string(stored) != "Question: Do you sell tea?\n\nAnswer: Yes, green and black tea." {
		t.Errorf("stored text = %q", stored)
	}

	if _, out := e.call(user, http.MethodGet, base, ""); len(out["items"].([]any)) != 0 {
		t.Error("answered item still open")
	}
	if _, out := e.call(user, http.MethodGet, base+"?status=done", ""); len(out["items"].([]any)) != 1 {
		t.Error("answered item not in done")
	}
	if w, out := e.call(user, http.MethodPatch, base+"/"+id, `{"status":"open"}`); w.Code != http.StatusOK ||
		out["status"] != "open" || out["answerSourceId"] != source["id"] {
		t.Errorf("reopen: %d %s", w.Code, w.Body)
	}
	for _, bad := range []string{base + "?status=nope"} {
		if w, _ := e.call(user, http.MethodGet, bad, ""); w.Code != http.StatusBadRequest {
			t.Errorf("%s: %d", bad, w.Code)
		}
	}
	if w, _ := e.call(user, http.MethodPatch, base+"/"+id, `{"status":"gone"}`); w.Code != http.StatusBadRequest {
		t.Errorf("bad status: %d", w.Code)
	}
	// A deleted conversation leaves the item readable, without messages.
	e.exec(`delete from conversations where id = $1`, conv)
	if w, out := e.call(user, http.MethodGet, base+"/"+id, ""); w.Code != http.StatusOK || out["messages"] != nil {
		t.Errorf("item without conversation: %d %s", w.Code, w.Body)
	}
}

func TestSourceLimitKeepsItemOpen(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, plans.Free)
	for range plans.For(plans.Free).Sources {
		e.exec(`insert into sources (bot_id, type, title, status) values ($1, 'text', 'Note', 'ready')`, bot)
	}
	id := e.item(bot, "Do you sell tea?", e.conversation(bot, "Do you sell tea?", ""), 0)
	w, out := e.call(user, http.MethodPost, "/api/bots/"+bot+"/inbox/"+id+"/answer", `{"answer":"Yes."}`)
	if w.Code != http.StatusPaymentRequired || out["code"] != "upgrade_required" {
		t.Errorf("answer over the source limit: %d %s", w.Code, w.Body)
	}
	if _, out := e.call(user, http.MethodGet, "/api/bots/"+bot+"/inbox", ""); len(out["items"].([]any)) != 1 {
		t.Error("item closed although no source was added")
	}
	if e.files.Count() != 0 {
		t.Errorf("stored files = %d, want 0", e.files.Count())
	}
}

func TestHistoryWindow(t *testing.T) {
	e := newEnv(t)
	free, freeBot := testdb.NewBot(t, e.pool, plans.Free)
	pro, proBot := testdb.NewBot(t, e.pool, plans.Pro)
	old := e.item(freeBot, "Old question", e.conversation(freeBot, "Old question", ""), 10)
	e.item(proBot, "Old question", e.conversation(proBot, "Old question", ""), 10)
	e.exec(`update conversations set created_at = now() - interval '10 days', visitor_email = 'a@example.com'`+
		` where bot_id = any($1)`, []string{freeBot, proBot})

	if _, out := e.call(free, http.MethodGet, "/api/bots/"+freeBot+"/inbox", ""); len(out["items"].([]any)) != 0 {
		t.Error("free plan shows an item older than 7 days")
	}
	if w, _ := e.call(free, http.MethodGet, "/api/bots/"+freeBot+"/inbox/"+old, ""); w.Code != http.StatusNotFound {
		t.Errorf("free plan opens an old item: %d", w.Code)
	}
	if _, out := e.call(free, http.MethodGet, "/api/bots/"+freeBot+"/leads", ""); len(out["leads"].([]any)) != 0 {
		t.Error("free plan shows an old lead")
	}
	if _, out := e.call(pro, http.MethodGet, "/api/bots/"+proBot+"/inbox", ""); len(out["items"].([]any)) != 1 {
		t.Error("pro plan hides an old item")
	}
	if _, out := e.call(pro, http.MethodGet, "/api/bots/"+proBot+"/leads", ""); len(out["leads"].([]any)) != 1 {
		t.Error("pro plan hides an old lead")
	}
}

func TestLeads(t *testing.T) {
	e := newEnv(t)
	free, freeBot := testdb.NewBot(t, e.pool, plans.Free)
	biz, bizBot := testdb.NewBot(t, e.pool, plans.Business)
	e.conversation(freeBot, "Do you sell tea?", "anna@example.com")
	e.conversation(freeBot, "No email here", "")
	e.conversation(bizBot, "=HYPERLINK(\"http://evil\")", "bob@example.com")

	w, out := e.call(free, http.MethodGet, "/api/bots/"+freeBot+"/leads", "")
	leads := out["leads"].([]any)
	if w.Code != http.StatusOK || len(leads) != 1 || out["canExport"] != false {
		t.Fatalf("leads: %d %s", w.Code, w.Body)
	}
	if l := leads[0].(map[string]any); l["email"] != "anna@example.com" || l["question"] != "Do you sell tea?" || l["missed"] != true {
		t.Errorf("lead = %+v", l)
	}
	if w, out := e.call(free, http.MethodGet, "/api/bots/"+freeBot+"/leads.csv", ""); w.Code != http.StatusPaymentRequired ||
		out["code"] != "upgrade_required" {
		t.Errorf("free export: %d %s", w.Code, w.Body)
	}

	w, _ = e.call(biz, http.MethodGet, "/api/bots/"+bizBot+"/leads.csv", "")
	body := w.Body.String()
	if w.Code != http.StatusOK || !strings.HasPrefix(w.Header().Get("Content-Type"), "text/csv") ||
		!strings.HasPrefix(body, "email,first question,bot couldn't answer,date\n") ||
		!strings.Contains(body, `bob@example.com,"'=HYPERLINK(""http://evil"")",yes,`) {
		t.Errorf("export: %d %q", w.Code, body)
	}
}

func TestIsolation(t *testing.T) {
	e := newEnv(t)
	_, bot := testdb.NewBot(t, e.pool, plans.Business)
	bob, _ := testdb.NewBot(t, e.pool, plans.Free)
	id := e.item(bot, "Do you sell tea?", e.conversation(bot, "Do you sell tea?", "a@example.com"), 0)
	base := "/api/bots/" + bot
	for _, tc := range []struct{ method, path, body string }{
		{http.MethodGet, base + "/inbox", ""},
		{http.MethodGet, base + "/inbox/" + id, ""},
		{http.MethodPatch, base + "/inbox/" + id, `{"status":"done"}`},
		{http.MethodPost, base + "/inbox/" + id + "/answer", `{"answer":"Yes."}`},
		{http.MethodGet, base + "/leads", ""},
		{http.MethodGet, base + "/leads.csv", ""},
		{http.MethodGet, base + "/inbox/not-a-uuid", ""},
	} {
		if w, _ := e.call(bob, tc.method, tc.path, tc.body); w.Code != http.StatusNotFound {
			t.Errorf("bob %s %s: %d, want 404", tc.method, tc.path, w.Code)
		}
	}
}

func TestCSVSafe(t *testing.T) {
	for in, want := range map[string]string{"=1+2": "'=1+2", "@SUM": "'@SUM", "-1": "'-1", "hello": "hello", "": ""} {
		if got := csvSafe(in); got != want {
			t.Errorf("csvSafe(%q) = %q, want %q", in, got, want)
		}
	}
}
