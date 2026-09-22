package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func TestServeClient(t *testing.T) {
	dir := t.TempDir()
	for name, body := range map[string]string{
		"index.html":        "home",
		"pricing.html":      "pricing",
		"app/index.html":    "app",
		"404.html":          "missing page",
		"_next/static/a.js": "js",
	} {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	serveClient(r, dir)

	cases := []struct {
		path   string
		status int
		body   string
	}{
		{"/", http.StatusOK, "home"},
		{"/pricing", http.StatusOK, "pricing"},
		{"/app", http.StatusOK, "app"},
		{"/_next/static/a.js", http.StatusOK, "js"},
		{"/some/missing/page", http.StatusNotFound, "missing page"},
		{"/../../etc/passwd", http.StatusNotFound, "missing page"},
		{"/api/nope", http.StatusNotFound, `"error"`},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, tc.path, nil))
		if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.body) {
			t.Errorf("%s: %d %q, want %d %q", tc.path, w.Code, w.Body.String(), tc.status, tc.body)
		}
	}

	// Without a 404 page there is still a real 404.
	if err := os.Remove(filepath.Join(dir, "404.html")); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/missing", nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("no 404.html: %d", w.Code)
	}
}
