package sources

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/ai"
	"github.com/melihovodina/hovr/server/internal/auth"
	"github.com/melihovodina/hovr/server/internal/plans"
	"github.com/melihovodina/hovr/server/test/fakestorage"
	"github.com/melihovodina/hovr/server/test/testdb"
)

func init() { gin.SetMode(gin.TestMode) }

type apiEnv struct {
	*workerEnv
	r *gin.Engine
}

func newAPIEnv(t *testing.T) *apiEnv {
	t.Helper()
	pool := testdb.Connect(t)
	store, files := NewStore(pool), fakestorage.New()
	w := NewWorker(store, files, ai.Mock{})
	r := gin.New()
	// Stand-in for auth.RequireUser: the test picks the user with a header.
	g := r.Group("/api/bots/:id/sources", func(c *gin.Context) {
		auth.SetUser(c, c.GetHeader("X-Test-User"), "")
		c.Next()
	})
	NewHandler(store, files, w).Routes(g)
	return &apiEnv{workerEnv: &workerEnv{t: t, pool: pool, store: store, files: files, worker: w}, r: r}
}

func (e *apiEnv) upload(user, bot, filename string, data []byte) (*httptest.ResponseRecorder, map[string]any) {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("file", filename)
	_, _ = part.Write(data)
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/bots/"+bot+"/sources/file", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return e.serve(user, req)
}

func (e *apiEnv) call(user, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return e.serve(user, req)
}

func (e *apiEnv) serve(user string, req *http.Request) (*httptest.ResponseRecorder, map[string]any) {
	req.Header.Set("X-Test-User", user)
	w := httptest.NewRecorder()
	e.r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func TestUploadAndProcess(t *testing.T) {
	e := newAPIEnv(t)
	account, bot := newBot(t, e.pool, plans.Free)

	w, src := e.upload(account, bot, "My FAQ.md", []byte("# FAQ\n\nYes, we sell grinders."))
	if w.Code != http.StatusCreated || src["status"] != statusQueued || src["title"] != "My FAQ.md" {
		t.Fatalf("upload: %d %s", w.Code, w.Body)
	}
	id := src["id"].(string)
	if path := bot + "/" + id + "/My-FAQ.md"; !e.files.Has(path) {
		t.Errorf("file not stored at %s", path)
	}

	w, _ = e.call(account, http.MethodPost, "/api/bots/"+bot+"/sources/text",
		`{"title":"Payment methods","text":"We accept Visa and PayPal."}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("text: %d %s", w.Code, w.Body)
	}

	e.drain()
	w, out := e.call(account, http.MethodGet, "/api/bots/"+bot+"/sources", "")
	list := out["sources"].([]any)
	if w.Code != http.StatusOK || len(list) != 2 {
		t.Fatalf("list: %d %s", w.Code, w.Body)
	}
	for _, item := range list {
		s := item.(map[string]any)
		if s["status"] != statusReady || s["chunks"].(float64) < 1 {
			t.Errorf("%v: status %v, chunks %v", s["title"], s["status"], s["chunks"])
		}
	}

	if w, _ := e.call(account, http.MethodDelete, "/api/bots/"+bot+"/sources/"+id, ""); w.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", w.Code)
	}
	if e.files.Has(bot + "/" + id + "/My-FAQ.md") {
		t.Error("file still stored after the source was deleted")
	}
}

func TestUploadValidation(t *testing.T) {
	e := newAPIEnv(t)
	account, bot := newBot(t, e.pool, plans.Free)
	cases := []struct {
		name, file string
		data       []byte
		status     int
	}{
		{"wrong type", "virus.exe", []byte("x"), http.StatusBadRequest},
		{"too big", "big.txt", bytes.Repeat([]byte("a"), maxFileSize+1), http.StatusBadRequest},
		{"bad bot id", "", nil, http.StatusNotFound},
	}
	for _, tc := range cases {
		target := bot
		if tc.name == "bad bot id" {
			target = "not-a-uuid"
			tc.file, tc.data = "faq.md", []byte("x")
		}
		if w, _ := e.upload(account, target, tc.file, tc.data); w.Code != tc.status {
			t.Errorf("%s: %d, want %d (%s)", tc.name, w.Code, tc.status, w.Body)
		}
	}
	for _, body := range []string{`{"title":"","text":"x"}`, `{"title":"T","text":"   "}`, `{`} {
		if w, _ := e.call(account, http.MethodPost, "/api/bots/"+bot+"/sources/text", body); w.Code != http.StatusBadRequest {
			t.Errorf("text %s: %d, want 400", body, w.Code)
		}
	}
	if e.files.Count() != 0 {
		t.Errorf("%d files stored by rejected requests", e.files.Count())
	}
}

func TestSourceLimitPerPlan(t *testing.T) {
	e := newAPIEnv(t)
	account, bot := newBot(t, e.pool, plans.Free)
	limit := plans.For(plans.Free).Sources
	for i := range limit {
		body := fmt.Sprintf(`{"title":"Note %d","text":"Some text."}`, i)
		if w, _ := e.call(account, http.MethodPost, "/api/bots/"+bot+"/sources/text", body); w.Code != http.StatusCreated {
			t.Fatalf("source %d: %d", i, w.Code)
		}
	}
	w, out := e.upload(account, bot, "one-more.md", []byte("x"))
	if w.Code != http.StatusPaymentRequired || out["code"] != "upgrade_required" {
		t.Errorf("source over the limit: %d %s", w.Code, w.Body)
	}
	if e.files.Count() != limit {
		t.Errorf("stored files = %d, want %d (the refused upload must be removed)", e.files.Count(), limit)
	}
}

func TestSourcesAreIsolatedPerAccount(t *testing.T) {
	e := newAPIEnv(t)
	anna, bot := newBot(t, e.pool, plans.Free)
	bob, _ := newBot(t, e.pool, plans.Free)

	_, src := e.upload(anna, bot, "faq.md", []byte("x"))
	id := src["id"].(string)

	if w, _ := e.call(bob, http.MethodGet, "/api/bots/"+bot+"/sources", ""); w.Code != http.StatusNotFound {
		t.Errorf("bob lists anna's sources: %d, want 404", w.Code)
	}
	if w, _ := e.upload(bob, bot, "evil.md", []byte("x")); w.Code != http.StatusNotFound {
		t.Errorf("bob uploads to anna's bot: %d, want 404", w.Code)
	}
	if w, _ := e.call(bob, http.MethodDelete, "/api/bots/"+bot+"/sources/"+id, ""); w.Code != http.StatusNotFound {
		t.Errorf("bob deletes anna's source: %d, want 404", w.Code)
	}
	if e.files.Count() != 1 {
		t.Errorf("stored files = %d, want only anna's", e.files.Count())
	}
}

func TestStorageOutage(t *testing.T) {
	e := newAPIEnv(t)
	account, bot := newBot(t, e.pool, plans.Free)
	e.files.Down = true
	if w, out := e.upload(account, bot, "faq.md", []byte("x")); w.Code != http.StatusInternalServerError ||
		out["error"] != "Something went wrong. Try again." {
		t.Errorf("upload with storage down: %d %s", w.Code, w.Body)
	}
	var count int
	_ = e.pool.QueryRow(t.Context(), `select count(*) from sources where bot_id = $1`, bot).Scan(&count)
	if count != 0 {
		t.Errorf("a source row was created although the file wasn't stored")
	}
}
