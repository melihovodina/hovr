package chat

import (
	"bufio"
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

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/rag"
	"github.com/melihovodina/hovr/server/internal/usage"
	"github.com/melihovodina/hovr/server/pkg/httpx"
	"github.com/melihovodina/hovr/server/test/fakeai"
	"github.com/melihovodina/hovr/server/test/testapi"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests need the local database (TEST_DATABASE_URL, set by `make test`).

// fakeModel replies with chunks (or fails) and records the turns it was given.
type fakeModel struct {
	chunks []string
	err    error
	turns  []ai.Turn
}

func (f *fakeModel) Stream(_ context.Context, _ string, turns []ai.Turn, onText func(string) error) error {
	f.turns = turns
	if f.err != nil {
		return f.err
	}
	for _, c := range f.chunks {
		if err := onText(c); err != nil {
			return err
		}
	}
	return nil
}

type env struct {
	t       *testing.T
	pool    *pgxpool.Pool
	model   *fakeModel
	r       *gin.Engine
	service *Service
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pool := testdb.Connect(t)
	model := &fakeModel{chunks: []string{"Hello", " there."}}
	r, g := testapi.Router("/api/bots/:id")
	store := NewStore(pool)
	service := NewService(store, rag.NewAnswerer(rag.New(pool, fakeai.Embedder{}), model))
	NewHandler(store, service).Routes(g)
	// Widget-channel requests, as the widget package sends them.
	r.POST("/widget/:id/chat", func(c *gin.Context) {
		var in struct {
			Message        string `json:"message"`
			ConversationID string `json:"conversationId"`
		}
		_ = c.ShouldBindJSON(&in)
		account := c.GetHeader("X-Test-User")
		bot, err := store.bot(c.Request.Context(), account, c.Param("id"))
		if err != nil {
			httpx.Write(c, err)
			return
		}
		service.Respond(c, Request{BotID: c.Param("id"), BotName: bot.Name, Plan: bot.Plan, AccountID: account,
			Channel: ChannelWidget, VisitorID: c.GetHeader("X-Test-Visitor"), ConversationID: in.ConversationID, Message: in.Message})
	})
	return &env{t: t, pool: pool, model: model, r: r, service: service}
}

func (e *env) call(user, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-User", user)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	return w
}

type event struct {
	name string
	data map[string]any
}

// chat posts a playground message and returns the SSE events.
func (e *env) chat(user, bot, body string) (*httptest.ResponseRecorder, []event) {
	return e.events(e.call(user, http.MethodPost, "/api/bots/"+bot+"/chat", body))
}

// widgetChat posts a message on the widget channel as visitor.
func (e *env) widgetChat(user, visitor, bot, body string) (*httptest.ResponseRecorder, []event) {
	req := httptest.NewRequest(http.MethodPost, "/widget/"+bot+"/chat", strings.NewReader(body))
	req.Header.Set("X-Test-User", user)
	req.Header.Set("X-Test-Visitor", visitor)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	return e.events(w)
}

func (e *env) events(w *httptest.ResponseRecorder) (*httptest.ResponseRecorder, []event) {
	var events []event
	var name string
	sc := bufio.NewScanner(strings.NewReader(w.Body.String()))
	for sc.Scan() {
		line := sc.Text()
		if v, ok := strings.CutPrefix(line, "event:"); ok {
			name = v
		} else if v, ok := strings.CutPrefix(line, "data:"); ok {
			var data map[string]any
			_ = json.Unmarshal([]byte(v), &data)
			events = append(events, event{name, data})
		}
	}
	return w, events
}

func decode(w *httptest.ResponseRecorder) map[string]any {
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return out
}

func TestConversationFlow(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, "free")

	w, events := e.chat(user, bot, `{"message":"hi"}`)
	if w.Code != http.StatusOK || len(events) != 4 {
		t.Fatalf("chat: %d %s", w.Code, w.Body)
	}
	id, _ := events[0].data["id"].(string)
	if events[0].name != "conversation" || id == "" ||
		events[1].data["text"] != "Hello" || events[2].data["text"] != " there." || events[3].name != "done" {
		t.Fatalf("events = %+v", events)
	}
	msg := events[3].data["message"].(map[string]any)
	if msg["role"] != "assistant" || msg["content"] != "Hello there." || msg["answered"] != true {
		t.Errorf("saved answer = %+v", msg)
	}

	// The follow-up continues the conversation and the model sees what was said.
	e.model.chunks = []string{"[no-answer] Not sure."}
	_, events = e.chat(user, bot, `{"message":"do you sell tea?","conversationId":"`+id+`"}`)
	if len(e.model.turns) != 3 || e.model.turns[0].Text != "hi" || e.model.turns[1].Role != ai.RoleModel ||
		e.model.turns[2].Text != "do you sell tea?" {
		t.Errorf("model turns = %+v", e.model.turns)
	}
	if msg := events[len(events)-1].data["message"].(map[string]any); msg["answered"] != false || msg["content"] != "Not sure." {
		t.Errorf("no-answer message = %+v", msg)
	}

	w = e.call(user, http.MethodGet, "/api/bots/"+bot+"/conversations", "")
	list := decode(w)["conversations"].([]any)
	if w.Code != http.StatusOK || len(list) != 1 {
		t.Fatalf("list: %d %s", w.Code, w.Body)
	}
	if c := list[0].(map[string]any); c["title"] != "hi" || c["messages"].(float64) != 4 || c["channel"] != "playground" {
		t.Errorf("conversation = %+v", c)
	}

	path := "/api/bots/" + bot + "/conversations/" + id
	w = e.call(user, http.MethodGet, path, "")
	if messages := decode(w)["messages"].([]any); w.Code != http.StatusOK || len(messages) != 4 {
		t.Fatalf("get: %d %s", w.Code, w.Body)
	}
	if w := e.call(user, http.MethodDelete, path, ""); w.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", w.Code)
	}
	if w := e.call(user, http.MethodGet, path, ""); w.Code != http.StatusNotFound {
		t.Errorf("get after delete: %d", w.Code)
	}
}

func TestChatRefusals(t *testing.T) {
	e := newEnv(t)
	anna, bot := testdb.NewBot(t, e.pool, "free")
	bob, _ := testdb.NewBot(t, e.pool, "free")
	_, events := e.chat(anna, bot, `{"message":"hi"}`)
	annasConversation := events[0].data["id"].(string)

	cases := []struct {
		name, user, body string
		status           int
	}{
		{"empty message", anna, `{"message":"   "}`, http.StatusBadRequest},
		{"too long", anna, `{"message":"` + strings.Repeat("a", maxMessageLength+1) + `"}`, http.StatusBadRequest},
		{"bad conversation id", anna, `{"message":"hi","conversationId":"nope"}`, http.StatusNotFound},
		{"unknown conversation", anna, `{"message":"hi","conversationId":"00000000-0000-0000-0000-000000000000"}`, http.StatusNotFound},
		{"someone else's bot", bob, `{"message":"hi"}`, http.StatusNotFound},
	}
	for _, tc := range cases {
		if w, _ := e.chat(tc.user, bot, tc.body); w.Code != tc.status {
			t.Errorf("%s: %d, want %d (%s)", tc.name, w.Code, tc.status, w.Body)
		}
	}
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		path := "/api/bots/" + bot + "/conversations/" + annasConversation
		if w := e.call(bob, method, path, ""); w.Code != http.StatusNotFound {
			t.Errorf("bob %s anna's conversation: %d, want 404", method, w.Code)
		}
	}
	if w := e.call(bob, http.MethodGet, "/api/bots/"+bot+"/conversations", ""); w.Code != http.StatusNotFound {
		t.Errorf("bob lists anna's conversations: %d, want 404", w.Code)
	}
}

func usedMessages(t *testing.T, pool *pgxpool.Pool, account string) int {
	t.Helper()
	var n int
	_ = pool.QueryRow(context.Background(),
		`select coalesce(sum(messages), 0) from usage_counters where account_id = $1`, account).Scan(&n)
	return n
}

func TestMessageLimit(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, "free")
	_, err := e.pool.Exec(context.Background(),
		`insert into usage_counters (account_id, period, messages) values ($1, $2, 99)`, user, usage.Period(time.Now()))
	if err != nil {
		t.Fatal(err)
	}
	if w, _ := e.widgetChat(user, "v1", bot, `{"message":"hi"}`); w.Code != http.StatusOK {
		t.Fatalf("100th message: %d", w.Code)
	}
	w, _ := e.widgetChat(user, "v1", bot, `{"message":"hi again"}`)
	if w.Code != http.StatusPaymentRequired || decode(w)["code"] != "upgrade_required" {
		t.Errorf("101st message: %d %s", w.Code, w.Body)
	}
	// Playground chats are free.
	if w, _ := e.chat(user, bot, `{"message":"test"}`); w.Code != http.StatusOK {
		t.Errorf("playground over the limit: %d", w.Code)
	}
	if n := usedMessages(t, e.pool, user); n != 100 {
		t.Errorf("usage = %d, want 100", n)
	}
}

func TestModelFailure(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, "free")
	e.model.err = errors.New("503 overloaded")

	_, events := e.widgetChat(user, "v1", bot, `{"message":"hi"}`)
	last := events[len(events)-1]
	if last.name != "error" || last.data["error"] != "The bot couldn't answer right now. Try again in a moment." {
		t.Errorf("events = %+v", events)
	}
	if n := usedMessages(t, e.pool, user); n != 0 {
		t.Errorf("usage = %d, want 0 (failed answers don't count)", n)
	}
	var roles []string
	_ = e.pool.QueryRow(context.Background(), `
		select array_agg(m.role::text) from messages m join conversations c on c.id = m.conversation_id
		where c.bot_id = $1`, bot).Scan(&roles)
	if len(roles) != 1 || roles[0] != "user" {
		t.Errorf("saved roles = %v, want only the question", roles)
	}
}

func TestTitleFrom(t *testing.T) {
	if got := titleFrom("short"); got != "short" {
		t.Errorf("titleFrom(short) = %q", got)
	}
	long := strings.Repeat("é", maxTitle+5)
	if got := titleFrom(long); len([]rune(got)) != maxTitle || !strings.HasSuffix(got, "…") {
		t.Errorf("titleFrom(long) = %q", got)
	}
}

func TestWidgetVisitors(t *testing.T) {
	e := newEnv(t)
	user, bot := testdb.NewBot(t, e.pool, "free")
	ctx := context.Background()
	e.model.chunks = []string{"[no-answer] Not sure."}

	_, events := e.widgetChat(user, "v1", bot, `{"message":"Do you sell tea?"}`)
	id := events[0].data["id"].(string)
	_, _ = e.widgetChat(user, "v2", bot, `{"message":"do you  sell TEA"}`)
	_, _ = e.chat(user, bot, `{"message":"do you sell tea?"}`) // the owner testing: not a real question

	var question string
	var times int
	err := e.pool.QueryRow(ctx, `select question, times_asked from inbox_items where bot_id = $1`, bot).Scan(&question, &times)
	if err != nil || times != 2 || question != "do you  sell TEA" {
		t.Errorf("inbox item = %q x%d (%v), want one item asked twice", question, times, err)
	}

	if w, _ := e.widgetChat(user, "v2", bot, `{"message":"hi","conversationId":"`+id+`"}`); w.Code != http.StatusNotFound {
		t.Errorf("v2 continues v1's conversation: %d, want 404", w.Code)
	}
	if msgs, err := e.service.VisitorMessages(ctx, bot, "v1", id); err != nil || len(msgs) != 2 {
		t.Errorf("v1 restores: %d messages, %v", len(msgs), err)
	}
	if _, err := e.service.VisitorMessages(ctx, bot, "v2", id); err != errConversationNotFound {
		t.Errorf("v2 reads v1's conversation: %v", err)
	}

	if err := e.service.SaveLead(ctx, bot, "v1", id, "nope"); err == nil {
		t.Error("invalid email accepted")
	}
	if err := e.service.SaveLead(ctx, bot, "v2", id, "anna@example.com"); err != errConversationNotFound {
		t.Errorf("v2 leaves email on v1's conversation: %v", err)
	}
	if err := e.service.SaveLead(ctx, bot, "v1", id, " anna@example.com "); err != nil {
		t.Fatal(err)
	}
	var email string
	_ = e.pool.QueryRow(ctx, `select visitor_email from conversations where id = $1`, id).Scan(&email)
	if email != "anna@example.com" {
		t.Errorf("visitor email = %q", email)
	}
}

func TestNormalizeQuestion(t *testing.T) {
	for in, want := range map[string]string{
		"Do you sell tea?":       "do you sell tea",
		"  do you  SELL tea?!  ": "do you sell tea",
		"¿Envían a Toronto?":     "¿envían a toronto",
	} {
		if got := normalizeQuestion(in); got != want {
			t.Errorf("normalizeQuestion(%q) = %q, want %q", in, got, want)
		}
	}
}
