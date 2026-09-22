package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/pkg/apperr"
)

func init() { gin.SetMode(gin.TestMode) }

func run(path string, h gin.HandlerFunc) (*httptest.ResponseRecorder, map[string]string) {
	r := gin.New()
	r.GET("/things/:id", h)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w, body
}

func TestResponses(t *testing.T) {
	cases := []struct {
		name   string
		h      gin.HandlerFunc
		status int
		body   map[string]string
	}{
		{"error", func(c *gin.Context) { Error(c, http.StatusBadRequest, "Nope.") },
			http.StatusBadRequest, map[string]string{"error": "Nope."}},
		{"internal hides the cause", func(c *gin.Context) { Internal(c, errors.New("db password is hunter2")) },
			http.StatusInternalServerError, map[string]string{"error": "Something went wrong. Try again."}},
		{"write app error", func(c *gin.Context) { Write(c, apperr.NotFound("Bot not found.")) },
			http.StatusNotFound, map[string]string{"error": "Bot not found."}},
		{"write app error with code", func(c *gin.Context) { Write(c, apperr.UpgradeRequired("Comes with Pro.")) },
			http.StatusPaymentRequired, map[string]string{"error": "Comes with Pro.", "code": apperr.CodeUpgradeRequired}},
		{"write unexpected error", func(c *gin.Context) { Write(c, errors.New("connection reset")) },
			http.StatusInternalServerError, map[string]string{"error": "Something went wrong. Try again."}},
	}
	for _, tc := range cases {
		w, body := run("/things/x", tc.h)
		if w.Code != tc.status || len(body) != len(tc.body) {
			t.Errorf("%s: %d %v, want %d %v", tc.name, w.Code, body, tc.status, tc.body)
			continue
		}
		for k, v := range tc.body {
			if body[k] != v {
				t.Errorf("%s: %s = %q, want %q", tc.name, k, body[k], v)
			}
		}
	}
}

func TestAbortStopsTheChain(t *testing.T) {
	r := gin.New()
	reached := false
	r.GET("/x", func(c *gin.Context) { Abort(c, http.StatusUnauthorized, "Sign in.") }, func(c *gin.Context) { reached = true })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	if w.Code != http.StatusUnauthorized || reached {
		t.Errorf("status %d, next handler reached = %v", w.Code, reached)
	}
}

func TestUUIDParam(t *testing.T) {
	h := func(c *gin.Context) {
		if id, ok := UUIDParam(c, "id", "Thing not found."); ok {
			c.String(http.StatusOK, id)
		}
	}
	if w, _ := run("/things/3f2b8c1e-9a4d-4e21-8b7a-1c2d3e4f5a6b", h); w.Code != http.StatusOK {
		t.Errorf("valid uuid: %d", w.Code)
	}
	for _, bad := range []string{"123", "not-a-uuid", "3f2b8c1e-9a4d-4e21-8b7a-1c2d3e4f5a6"} {
		if w, body := run("/things/"+bad, h); w.Code != http.StatusNotFound || body["error"] != "Thing not found." {
			t.Errorf("%q: %d %v, want 404", bad, w.Code, body)
		}
	}
}
