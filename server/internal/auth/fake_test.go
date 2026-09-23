package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	testEmail    = "anna@northwind.example"
	testPassword = "correct-horse-1"
	testUserID   = "11111111-1111-1111-1111-111111111111"
	validRefresh = "rt-valid"
	validCode    = "code-valid"
)

// fakeSupabase serves the JWKS document and the Auth endpoints the service calls.
type fakeSupabase struct {
	t   *testing.T
	srv *httptest.Server

	mu         sync.Mutex
	keys       map[string]*ecdsa.PrivateKey
	activeKid  string
	lastSignup map[string]string
	lastQuery  map[string]string
	lastResend string
	logouts    []string // access tokens the service asked it to revoke
}

func newFakeSupabase(t *testing.T) *fakeSupabase {
	t.Helper()
	f := &fakeSupabase{t: t, keys: map[string]*ecdsa.PrivateKey{}}
	f.addKey("k1")
	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/v1/.well-known/jwks.json", f.jwks)
	mux.HandleFunc("POST /auth/v1/token", f.token)
	mux.HandleFunc("POST /auth/v1/signup", f.signup)
	mux.HandleFunc("POST /auth/v1/recover", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("POST /auth/v1/resend", func(w http.ResponseWriter, r *http.Request) {
		f.lastResend = r.URL.Query().Get("redirect_to")
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("POST /auth/v1/logout", f.logout)
	mux.HandleFunc("PUT /auth/v1/user", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeSupabase) url() string    { return f.srv.URL }
func (f *fakeSupabase) issuer() string { return f.srv.URL + "/auth/v1" }

// addKey creates a signing key; new tokens are signed with the latest one.
func (f *fakeSupabase) addKey(kid string) *ecdsa.PrivateKey {
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		f.t.Fatal(err)
	}
	f.mu.Lock()
	f.keys[kid] = k
	f.activeKid = kid
	f.mu.Unlock()
	return k
}

// token signs an access token the way Supabase does (ES256 with a kid).
func (f *fakeSupabase) signed(exp time.Time) string {
	f.mu.Lock()
	kid, key := f.activeKid, f.keys[f.activeKid]
	f.mu.Unlock()
	return signToken(f.t, key, kid, f.issuer(), exp)
}

func signToken(t *testing.T, key *ecdsa.PrivateKey, kid, issuer string, exp time.Time) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, Claims{
		Email: testEmail,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   testUserID,
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	})
	tok.Header["kid"] = kid
	raw, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func (f *fakeSupabase) jwks(w http.ResponseWriter, _ *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var keys []map[string]string
	for kid, k := range f.keys {
		b, err := k.PublicKey.Bytes() // 0x04 || X || Y
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		keys = append(keys, map[string]string{
			"kty": "EC", "crv": "P-256", "kid": kid,
			"x": base64.RawURLEncoding.EncodeToString(b[1:33]),
			"y": base64.RawURLEncoding.EncodeToString(b[33:]),
		})
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"keys": keys})
}

func (f *fakeSupabase) token(w http.ResponseWriter, r *http.Request) {
	var in map[string]string
	_ = json.NewDecoder(r.Body).Decode(&in)
	ok := false
	switch r.URL.Query().Get("grant_type") {
	case "password":
		if in["email"] == "unconfirmed@northwind.example" {
			authError(w, "email_not_confirmed")
			return
		}
		ok = in["email"] == testEmail && in["password"] == testPassword
	case "refresh_token":
		ok = in["refresh_token"] == validRefresh
	case "pkce":
		ok = in["auth_code"] == validCode && in["code_verifier"] != ""
	}
	if !ok {
		authError(w, "invalid_credentials")
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"access_token":  f.signed(time.Now().Add(time.Hour)),
		"refresh_token": validRefresh,
		"expires_in":    3600,
		"user":          map[string]string{"id": testUserID, "email": testEmail},
	})
}

// logout records the token it was asked to revoke. Like Supabase, it refuses an
// expired or unsigned one, so a stale access token doesn't count as a sign-out.
func (f *fakeSupabase) logout(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	_, err := jwt.NewParser(jwt.WithExpirationRequired()).Parse(token, func(t *jwt.Token) (any, error) {
		f.mu.Lock()
		defer f.mu.Unlock()
		kid, _ := t.Header["kid"].(string)
		key, ok := f.keys[kid]
		if !ok {
			return nil, errors.New("unknown kid")
		}
		return &key.PublicKey, nil
	})
	if err != nil {
		authError(w, "bad_jwt")
		return
	}
	f.mu.Lock()
	f.logouts = append(f.logouts, token)
	f.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// revoked is how many sign-outs Supabase accepted.
func (f *fakeSupabase) revoked() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.logouts)
}

func (f *fakeSupabase) signup(w http.ResponseWriter, r *http.Request) {
	var in map[string]string
	_ = json.NewDecoder(r.Body).Decode(&in)
	f.mu.Lock()
	f.lastSignup = in
	f.lastQuery = map[string]string{"redirect_to": r.URL.Query().Get("redirect_to")}
	f.mu.Unlock()
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{}`))
}

func authError(w http.ResponseWriter, code string) {
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]string{"error_code": code, "msg": code})
}
