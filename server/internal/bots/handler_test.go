package bots

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/accounts"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/pkg/apperr"
	"github.com/melihovodina/hovr/server/test/fakestorage"
	"github.com/melihovodina/hovr/server/test/testapi"
	"github.com/melihovodina/hovr/server/test/testdb"
)

// These tests run against a real database (the local Supabase one) and are
// skipped when TEST_DATABASE_URL is not set. `make test` sets it.

type testEnv struct {
	t       *testing.T
	pool    *pgxpool.Pool
	r       *gin.Engine
	files   *fakestorage.Files
	avatars *fakestorage.Files
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	pool := testdb.Connect(t)
	r, g := testapi.Router("/api/bots")
	files, avatars := fakestorage.New(), fakestorage.New()
	NewHandler(NewStore(pool), accounts.NewStore(pool), files, avatars).Routes(g)
	return &testEnv{t: t, pool: pool, r: r, files: files, avatars: avatars}
}

func (e *testEnv) newUser(plan plans.Plan) string {
	return testdb.NewUser(e.t, e.pool, plan)
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
	anna := e.newUser(plans.Free)

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
	anna := e.newUser(plans.Free)

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

	pro := e.newUser(plans.Pro)
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
	anna, bob := e.newUser(plans.Free), e.newUser(plans.Free)

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

// The store doesn't check before writing; the database rejects bad writes and
// apperr.Map turns the rejection into a proper error.
func TestDatabaseErrorsAreTranslated(t *testing.T) {
	e := newTestEnv(t)
	store, ctx := NewStore(e.pool), context.Background()
	anna := e.newUser(plans.Pro)

	first, err := store.Create(ctx, anna, "First", "pub_duplicate_key_for_test")
	if err != nil {
		t.Fatal(err)
	}
	// Same public key again: unique violation → 409.
	if _, err := store.Create(ctx, anna, "Second", first.PublicKey); !errors.Is(err, apperr.ErrConflict) {
		t.Errorf("duplicate public key: %v, want conflict", err)
	}
	// No such account: no rows → 404.
	if _, err := store.Create(ctx, "00000000-0000-0000-0000-000000000000", "Ghost", "pub_ghost"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("missing account: %v, want not found", err)
	}
	// A value the database check constraint rejects → 400.
	first.Color = "red"
	if _, err := store.Save(ctx, anna, first); !errors.Is(err, apperr.ErrBadInput) {
		t.Errorf("bad color saved directly: %v, want bad input", err)
	}
	// Someone else's bot: no rows → the bot-specific 404.
	bob := e.newUser(plans.Free)
	if _, err := store.Get(ctx, bob, first.ID); err != ErrNotFound {
		t.Errorf("other account's bot: %v, want ErrNotFound", err)
	}
}

func TestDeleteBotRemovesItsFiles(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	anna, bob := e.newUser(plans.Free), e.newUser(plans.Free)

	_, bot := e.do(anna, http.MethodPost, "/api/bots", `{"name":"Northwind"}`)
	id := bot["id"].(string)
	paths := []string{id + "/a/faq.pdf", id + "/b/text.txt"}
	for _, p := range paths {
		if err := e.files.Upload(ctx, p, "text/plain", []byte("x")); err != nil {
			t.Fatal(err)
		}
		if _, err := e.pool.Exec(ctx,
			`insert into sources (bot_id, type, title, storage_path, status) values ($1, 'file', 'f', $2, 'ready')`, id, p); err != nil {
			t.Fatal(err)
		}
	}
	unrelated := "other-bot/c/keep.pdf"
	_ = e.files.Upload(ctx, unrelated, "text/plain", []byte("x"))

	// Someone else can't delete it, and nothing is removed.
	if w, _ := e.do(bob, http.MethodDelete, "/api/bots/"+id, ""); w.Code != http.StatusNotFound || e.files.Count() != 3 {
		t.Fatalf("bob deleting anna's bot: %d, files left %d", w.Code, e.files.Count())
	}
	if w, _ := e.do(anna, http.MethodDelete, "/api/bots/"+id, ""); w.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", w.Code)
	}
	for _, p := range paths {
		if e.files.Has(p) {
			t.Errorf("%s still stored after the bot was deleted", p)
		}
	}
	if !e.files.Has(unrelated) {
		t.Error("another bot's file was deleted")
	}
}

// The widget colours are nullable, and "not sent" has to stay different from
// "sent as null": one keeps the colour, the other returns it to automatic.
func TestWidgetColors(t *testing.T) {
	e := newTestEnv(t)
	// Free, because picking colours is on every plan.
	anna := e.newUser(plans.Free)

	w, bot := e.do(anna, http.MethodPost, "/api/bots", `{"name":"Northwind Coffee"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body)
	}
	id := bot["id"].(string)
	if bot["greeting"] != "Hey there, how can I help?" {
		t.Errorf("greeting = %v", bot["greeting"])
	}
	for _, field := range []string{"chatBackground", "visitorMessageColor", "botMessageColor"} {
		if value, ok := bot[field]; !ok || value != nil {
			t.Errorf("new bot %s = %v, want null", field, value)
		}
	}

	w, set := e.do(anna, http.MethodPatch, "/api/bots/"+id,
		`{"chatBackground":"#101114","visitorMessageColor":"#2f6b4f","botMessageColor":"#FFFFFF"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("set colors: %d %s", w.Code, w.Body)
	}
	if set["chatBackground"] != "#101114" || set["visitorMessageColor"] != "#2F6B4F" || set["botMessageColor"] != "#FFFFFF" {
		t.Errorf("set colors: %v", set)
	}

	// A patch that doesn't mention them leaves all three alone.
	w, kept := e.do(anna, http.MethodPatch, "/api/bots/"+id, `{"name":"Northwind"}`)
	if w.Code != http.StatusOK || kept["chatBackground"] != "#101114" || kept["visitorMessageColor"] != "#2F6B4F" {
		t.Errorf("colors not kept: %d %s", w.Code, w.Body)
	}

	// An explicit null puts one back to automatic without touching the others.
	w, reset := e.do(anna, http.MethodPatch, "/api/bots/"+id, `{"visitorMessageColor":null}`)
	if w.Code != http.StatusOK {
		t.Fatalf("reset: %d %s", w.Code, w.Body)
	}
	if reset["visitorMessageColor"] != nil {
		t.Errorf("visitorMessageColor = %v, want null", reset["visitorMessageColor"])
	}
	if reset["chatBackground"] != "#101114" || reset["botMessageColor"] != "#FFFFFF" {
		t.Errorf("reset touched the other colors: %v", reset)
	}

	for _, body := range []string{
		`{"chatBackground":"red"}`,
		`{"visitorMessageColor":"#FFF"}`,
		`{"botMessageColor":"rgb(0,0,0)"}`,
	} {
		if w, _ := e.do(anna, http.MethodPatch, "/api/bots/"+id, body); w.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", body, w.Code)
		}
	}
}
