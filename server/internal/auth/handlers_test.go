package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/supabase"
)

const appURL = "http://localhost:3000"

func init() { gin.SetMode(gin.TestMode) }

// newTestApp mounts the auth routes plus a protected /api/me on a fresh engine.
func newTestApp(t *testing.T) (*gin.Engine, *fakeSupabase) {
	t.Helper()
	f := newFakeSupabase(t)
	svc := NewService(NewVerifier(context.Background(), f.url()), supabase.NewAuth(f.url(), "pk"), appURL)
	r := gin.New()
	api := r.Group("/api", svc.SameOrigin())
	svc.Routes(api.Group("/auth"))
	api.GET("/me", svc.RequireUser(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"id": UserID(c), "email": UserEmail(c)})
	})
	return r, f
}

func send(r *gin.Engine, method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", appURL)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func cookie(w *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range w.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func TestSignInSetsSessionCookies(t *testing.T) {
	r, _ := newTestApp(t)
	w := send(r, http.MethodPost, "/api/auth/signin", `{"email":"`+testEmail+`","password":"`+testPassword+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body)
	}
	for _, name := range []string{accessCookie, refreshCookie} {
		c := cookie(w, name)
		if c == nil {
			t.Fatalf("%s not set", name)
		}
		if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.Path != "/api" || c.Secure {
			t.Errorf("%s flags: httpOnly=%v sameSite=%v path=%q secure=%v", name, c.HttpOnly, c.SameSite, c.Path, c.Secure)
		}
	}
	if strings.Contains(w.Body.String(), "access_token") {
		t.Error("token leaked into the response body")
	}
}

func TestSignInErrors(t *testing.T) {
	r, _ := newTestApp(t)
	cases := []struct {
		name, body string
		status     int
	}{
		{"wrong password", `{"email":"` + testEmail + `","password":"nope-nope"}`, http.StatusUnauthorized},
		{"unconfirmed", `{"email":"unconfirmed@northwind.example","password":"whatever-1"}`, http.StatusForbidden},
		{"bad email", `{"email":"not-an-email","password":"whatever-1"}`, http.StatusBadRequest},
		{"no password", `{"email":"` + testEmail + `","password":""}`, http.StatusBadRequest},
		{"broken json", `{`, http.StatusBadRequest},
	}
	for _, tc := range cases {
		if w := send(r, http.MethodPost, "/api/auth/signin", tc.body); w.Code != tc.status {
			t.Errorf("%s: status = %d, want %d (%s)", tc.name, w.Code, tc.status, w.Body)
		}
	}
}

func TestRequireUser(t *testing.T) {
	r, f := newTestApp(t)
	valid := &http.Cookie{Name: accessCookie, Value: f.signed(time.Now().Add(time.Hour))}
	expired := &http.Cookie{Name: accessCookie, Value: f.signed(time.Now().Add(-time.Minute))}
	goodRefresh := &http.Cookie{Name: refreshCookie, Value: validRefresh}
	badRefresh := &http.Cookie{Name: refreshCookie, Value: "rt-revoked"}

	if w := send(r, http.MethodGet, "/api/me", "", valid); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), testUserID) {
		t.Errorf("valid session: status %d, body %s", w.Code, w.Body)
	}
	if w := send(r, http.MethodGet, "/api/me", ""); w.Code != http.StatusUnauthorized {
		t.Errorf("no cookies: status %d, want 401", w.Code)
	}

	w := send(r, http.MethodGet, "/api/me", "", expired, goodRefresh)
	if w.Code != http.StatusOK {
		t.Fatalf("expired + refresh: status %d, want 200", w.Code)
	}
	if c := cookie(w, accessCookie); c == nil || c.Value == expired.Value {
		t.Error("expired + refresh: no new access cookie")
	}

	w = send(r, http.MethodGet, "/api/me", "", expired, badRefresh)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("revoked refresh: status %d, want 401", w.Code)
	}
	if c := cookie(w, refreshCookie); c == nil || c.MaxAge >= 0 {
		t.Error("revoked refresh: cookies not cleared")
	}
}

func TestSameOrigin(t *testing.T) {
	r, _ := newTestApp(t)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/signin", strings.NewReader(`{}`))
	req.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("foreign origin: status %d, want 403", w.Code)
	}
}

func TestSignupStartsPKCE(t *testing.T) {
	r, f := newTestApp(t)
	w := send(r, http.MethodPost, "/api/auth/signup", `{"email":"new@northwind.example","password":"long-enough-1"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body)
	}
	verifier := cookie(w, pkceCookie)
	if verifier == nil || !verifier.HttpOnly {
		t.Fatal("pkce verifier cookie missing or not httpOnly")
	}
	sum := sha256.Sum256([]byte(verifier.Value))
	if got, want := f.lastSignup["code_challenge"], base64.RawURLEncoding.EncodeToString(sum[:]); got != want {
		t.Errorf("challenge sent to Supabase does not match the verifier")
	}
	if got, want := f.lastQuery["redirect_to"], appURL+"/api/auth/callback?next="+url.QueryEscape("/onboarding"); got != want {
		t.Errorf("redirect_to = %q, want %q", got, want)
	}

	if w := send(r, http.MethodPost, "/api/auth/signup", `{"email":"new@northwind.example","password":"short"}`); w.Code != http.StatusBadRequest {
		t.Errorf("short password: status %d, want 400", w.Code)
	}
}

func TestResendConfirmation(t *testing.T) {
	r, f := newTestApp(t)

	w := send(r, http.MethodPost, "/api/auth/resend", `{"email":"anna@example.com"}`)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "check_email") {
		t.Fatalf("resend: %d %s", w.Code, w.Body)
	}
	// The same destination as the sign-up link: confirming through "Send it again"
	// must not skip onboarding.
	if got, want := f.lastResend, appURL+"/api/auth/callback?next="+url.QueryEscape("/onboarding"); got != want {
		t.Errorf("redirect_to = %q, want %q", got, want)
	}
	if cookie(w, pkceCookie) == nil {
		t.Error("no PKCE cookie for the new link")
	}
	// The same answer for an address without an account, so nobody can probe.
	if w := send(r, http.MethodPost, "/api/auth/resend", `{"email":"nobody@example.com"}`); w.Code != http.StatusOK {
		t.Errorf("unknown address: %d", w.Code)
	}
	if w := send(r, http.MethodPost, "/api/auth/resend", `{"email":"not-an-email"}`); w.Code != http.StatusBadRequest {
		t.Errorf("invalid address: %d, want 400", w.Code)
	}
}

func TestCallback(t *testing.T) {
	r, _ := newTestApp(t)
	verifier := &http.Cookie{Name: pkceCookie, Value: "some-verifier"}
	cases := []struct {
		name, query string
		cookies     []*http.Cookie
		location    string
		session     bool
	}{
		{"success", "?code=" + validCode + "&next=/onboarding", []*http.Cookie{verifier}, appURL + "/onboarding", true},
		{"other browser", "?code=" + validCode, nil, appURL + "/signin?confirmed=1", false},
		{"bad code", "?code=wrong", []*http.Cookie{verifier}, appURL + "/signin?error=link_expired", false},
		{"no code", "", []*http.Cookie{verifier}, appURL + "/signin?error=link_invalid", false},
		{"open redirect", "?code=" + validCode + "&next=//evil.example", []*http.Cookie{verifier}, appURL + "/app", true},
	}
	for _, tc := range cases {
		w := send(r, http.MethodGet, "/api/auth/callback"+tc.query, "", tc.cookies...)
		if w.Code != http.StatusFound || w.Header().Get("Location") != tc.location {
			t.Errorf("%s: %d -> %q, want 302 -> %q", tc.name, w.Code, w.Header().Get("Location"), tc.location)
		}
		if got := cookie(w, accessCookie) != nil; got != tc.session {
			t.Errorf("%s: session cookie set = %v, want %v", tc.name, got, tc.session)
		}
	}
}

// Signing out must also end the session at Supabase, or the refresh token stays
// usable for its full 30 days. The access cookie only lasts an hour, so the cases
// below are what a browser actually sends after sitting idle.
func TestSignOut(t *testing.T) {
	cases := []struct {
		name    string
		cookies func(f *fakeSupabase) []*http.Cookie
		revoked int
	}{
		{
			name: "fresh session",
			cookies: func(f *fakeSupabase) []*http.Cookie {
				return []*http.Cookie{
					{Name: accessCookie, Value: f.signed(time.Now().Add(time.Hour))},
					{Name: refreshCookie, Value: validRefresh},
				}
			},
			revoked: 1,
		},
		{
			// An hour idle: the browser dropped the access cookie by itself.
			name: "access cookie gone",
			cookies: func(*fakeSupabase) []*http.Cookie {
				return []*http.Cookie{{Name: refreshCookie, Value: validRefresh}}
			},
			revoked: 1,
		},
		{
			name: "access token expired",
			cookies: func(f *fakeSupabase) []*http.Cookie {
				return []*http.Cookie{
					{Name: accessCookie, Value: f.signed(time.Now().Add(-time.Minute))},
					{Name: refreshCookie, Value: validRefresh},
				}
			},
			revoked: 1,
		},
		{
			name: "refresh token no longer valid",
			cookies: func(*fakeSupabase) []*http.Cookie {
				return []*http.Cookie{{Name: refreshCookie, Value: "rt-revoked"}}
			},
			revoked: 0,
		},
		{
			name:    "no session at all",
			cookies: func(*fakeSupabase) []*http.Cookie { return nil },
			revoked: 0,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, f := newTestApp(t)
			w := send(r, http.MethodPost, "/api/auth/signout", "", tc.cookies(f)...)
			if w.Code != http.StatusNoContent {
				t.Fatalf("status = %d", w.Code)
			}
			// The browser is signed out whatever Supabase answered.
			for _, name := range []string{accessCookie, refreshCookie} {
				if c := cookie(w, name); c == nil || c.MaxAge >= 0 {
					t.Errorf("%s not cleared", name)
				}
			}
			if got := f.revoked(); got != tc.revoked {
				t.Errorf("sessions revoked at supabase = %d, want %d", got, tc.revoked)
			}
		})
	}
}

func TestSafeNext(t *testing.T) {
	cases := map[string]string{
		"/onboarding":          "/onboarding",
		"/reset-password":      "/reset-password",
		"":                     "/app",
		"//evil.example":       "/app",
		"https://evil.example": "/app",
		"/\\evil.example":      "/app",
	}
	for in, want := range cases {
		if got := safeNext(in); got != want {
			t.Errorf("safeNext(%q) = %q, want %q", in, got, want)
		}
	}
}
