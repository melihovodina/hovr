package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/config"
)

func init() { gin.SetMode(gin.TestMode) }

// The widget rate limits count per client IP, so where that comes from decides
// whether one visitor can be told apart from the next.
func TestClientIP(t *testing.T) {
	const visitor = "203.0.113.7"
	cases := []struct {
		name string
		cfg  config.Config
		want string
	}{
		{
			// No proxy trusted: the address the connection came from wins, so a
			// forwarded header can't buy a fresh allowance.
			name: "trust nothing",
			cfg:  config.Config{},
			want: "192.0.2.1",
		},
		{
			// The chain stops at the first untrusted hop, which on Render is a
			// per-request Cloudflare address, not the visitor.
			name: "trusted proxy, chain only",
			cfg:  config.Config{TrustedProxies: []string{"192.0.2.0/24"}},
			want: "172.70.246.177",
		},
		{
			// The host fills its own header, which beats the chain: on Render the
			// last forwarded hop is a different Cloudflare address per request.
			name: "platform header",
			cfg: config.Config{
				TrustedProxies: []string{"192.0.2.0/24"},
				ClientIPHeader: "CF-Connecting-IP",
			},
			want: visitor,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, err := newEngine(tc.cfg)
			if err != nil {
				t.Fatal(err)
			}
			r.GET("/ip", func(c *gin.Context) { c.String(http.StatusOK, c.ClientIP()) })

			req := httptest.NewRequest(http.MethodGet, "/ip", nil)
			req.RemoteAddr = "192.0.2.1:1234"
			// A rotating edge address last in the chain, the visitor first.
			req.Header.Set("X-Forwarded-For", visitor+", 172.70.246.177")
			req.Header.Set("CF-Connecting-IP", visitor)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if got := w.Body.String(); got != tc.want {
				t.Errorf("ClientIP = %q, want %q", got, tc.want)
			}
		})
	}
}

// A bad proxy list must stop the server at startup, not leave the widget rate
// limits reading a header anyone can send.
func TestNewRejectsBadTrustedProxies(t *testing.T) {
	_, err := New(Deps{Config: config.Config{TrustedProxies: []string{"not-an-address"}}})
	if err == nil {
		t.Fatal("invalid TRUSTED_PROXIES accepted")
	}
	if !strings.Contains(err.Error(), "TRUSTED_PROXIES") {
		t.Errorf("error %q does not name the setting", err)
	}
}

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

// The dashboard must not be embeddable anywhere, and the widget must be embeddable
// everywhere: the two policies are opposites, so both are checked here.
func TestSecurityHeaders(t *testing.T) {
	const storage = "https://project.supabase.co"
	r, err := newEngine(config.Config{SupabaseURL: storage})
	if err != nil {
		t.Fatal(err)
	}
	ok := func(c *gin.Context) { c.String(http.StatusOK, "hi") }
	r.GET("/app", ok)
	r.GET("/widget", ok)
	r.GET("/api/me", ok)

	cases := []struct {
		name, path       string
		frameAncestors   string
		wantFrameOptions string
		wantPolicy       bool
	}{
		{"app page", "/app", "frame-ancestors 'none'", "DENY", true},
		{"widget page", "/widget", "frame-ancestors *", "", true},
		{"api", "/api/me", "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, tc.path, nil))

			if got := w.Header().Get("X-Content-Type-Options"); got != "nosniff" {
				t.Errorf("X-Content-Type-Options = %q", got)
			}
			policy := w.Header().Get("Content-Security-Policy")
			if !tc.wantPolicy {
				if policy != "" {
					t.Errorf("API answered with a page policy: %q", policy)
				}
				return
			}
			if !strings.Contains(policy, tc.frameAncestors) {
				t.Errorf("policy %q does not contain %q", policy, tc.frameAncestors)
			}
			if !strings.Contains(policy, "img-src 'self' data: blob: "+storage) {
				t.Errorf("policy %q does not allow logos from storage", policy)
			}
			if got := w.Header().Get("X-Frame-Options"); got != tc.wantFrameOptions {
				t.Errorf("X-Frame-Options = %q, want %q", got, tc.wantFrameOptions)
			}
			if got := w.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
				t.Errorf("Referrer-Policy = %q", got)
			}
		})
	}
}

// Report-only is how a policy is watched before it starts blocking, so it must land
// in the other header and leave the enforcing one unset.
func TestSecurityHeadersReportOnly(t *testing.T) {
	r, err := newEngine(config.Config{CSPReportOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	r.GET("/app", func(c *gin.Context) { c.String(http.StatusOK, "hi") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/app", nil))
	if got := w.Header().Get("Content-Security-Policy-Report-Only"); !strings.Contains(got, "frame-ancestors 'none'") {
		t.Errorf("report-only header = %q", got)
	}
	if got := w.Header().Get("Content-Security-Policy"); got != "" {
		t.Errorf("enforcing header also set: %q", got)
	}
}
