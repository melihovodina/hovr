package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/supabase"
)

const (
	accessCookie  = "hovr_at"
	refreshCookie = "hovr_rt"
	pkceCookie    = "hovr_pkce"

	// Supabase refresh tokens don't expire on their own; the cookie caps how long a
	// browser stays signed in without activity.
	refreshMaxAge = 30 * 24 * time.Hour
	pkceMaxAge    = time.Hour
)

// cookies writes session cookies. They are httpOnly (page JavaScript never sees a
// token), SameSite=Lax, scoped to /api, and Secure when the app runs over HTTPS.
type cookies struct {
	secure bool
}

func (k cookies) set(c *gin.Context, name, value string, maxAge time.Duration) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/api",
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		Secure:   k.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (k cookies) clear(c *gin.Context, name string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/api",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   k.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (k cookies) setSession(c *gin.Context, s *supabase.Session) {
	k.set(c, accessCookie, s.AccessToken, time.Duration(s.ExpiresIn)*time.Second)
	k.set(c, refreshCookie, s.RefreshToken, refreshMaxAge)
}

func (k cookies) clearSession(c *gin.Context) {
	k.clear(c, accessCookie)
	k.clear(c, refreshCookie)
}

// newPKCE creates a verifier (kept in our httpOnly cookie) and its S256 challenge
// (sent to Supabase). Only this browser can finish the flow it started.
func newPKCE() (verifier, challenge string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(verifier))
	return verifier, base64.RawURLEncoding.EncodeToString(sum[:]), nil
}
