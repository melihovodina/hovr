package auth

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/supabase"
)

const (
	userIDKey      = "auth.userID"
	userEmailKey   = "auth.userEmail"
	accessTokenKey = "auth.accessToken"
)

// Service holds everything the auth middleware and endpoints need.
type Service struct {
	verifier  *Verifier
	supabase  *supabase.Auth
	cookies   cookies
	appURL    string
	appOrigin string
}

// NewService wires the verifier and the Supabase Auth client. appURL is the public
// address of the web app; it decides cookie security, redirects and the allowed Origin.
func NewService(verifier *Verifier, sb *supabase.Auth, appURL string) *Service {
	origin := appURL
	if u, err := url.Parse(appURL); err == nil {
		origin = u.Scheme + "://" + u.Host
	}
	return &Service{
		verifier:  verifier,
		supabase:  sb,
		cookies:   cookies{secure: strings.HasPrefix(appURL, "https://")},
		appURL:    appURL,
		appOrigin: origin,
	}
}

// RequireUser lets the request through only with a valid session. An expired access
// token is refreshed silently with the refresh cookie.
func (s *Service) RequireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		if raw, err := c.Cookie(accessCookie); err == nil && raw != "" {
			if claims, err := s.verifier.Verify(raw); err == nil {
				s.setUser(c, claims, raw)
				c.Next()
				return
			}
		}

		refresh, err := c.Cookie(refreshCookie)
		if err != nil || refresh == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sign in to continue."})
			return
		}
		session, err := s.supabase.Refresh(c.Request.Context(), refresh)
		if err != nil {
			s.cookies.clearSession(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Your session has expired. Sign in again."})
			return
		}
		claims, err := s.verifier.Verify(session.AccessToken)
		if err != nil {
			s.cookies.clearSession(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Your session has expired. Sign in again."})
			return
		}
		s.cookies.setSession(c, session)
		s.setUser(c, claims, session.AccessToken)
		c.Next()
	}
}

// SameOrigin blocks state-changing requests coming from other sites (CSRF).
// SameSite=Lax cookies already stop most of them; this is the second line.
func (s *Service) SameOrigin() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if c.GetHeader("Origin") != s.appOrigin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "This request came from another site."})
			return
		}
		c.Next()
	}
}

func (s *Service) setUser(c *gin.Context, claims *Claims, accessToken string) {
	SetUser(c, claims.Subject, claims.Email)
	c.Set(accessTokenKey, accessToken)
}

// SetUser marks the request as coming from the given user. RequireUser calls it;
// tests of other packages use it to simulate a signed-in request.
func SetUser(c *gin.Context, userID, email string) {
	c.Set(userIDKey, userID)
	c.Set(userEmailKey, email)
}

// UserID returns the signed-in user's id; only valid behind RequireUser.
func UserID(c *gin.Context) string {
	return c.GetString(userIDKey)
}

// UserEmail returns the signed-in user's email; only valid behind RequireUser.
func UserEmail(c *gin.Context) string {
	return c.GetString(userEmailKey)
}
