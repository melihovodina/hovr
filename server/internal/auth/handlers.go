package auth

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/supabase"
)

const minPasswordLength = 8

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Routes registers the public auth endpoints on g (mounted at /api/auth).
func (s *Service) Routes(g *gin.RouterGroup) {
	g.POST("/signup", s.signup)
	g.POST("/signin", s.signin)
	g.POST("/signout", s.signout)
	g.POST("/recover", s.recover)
	g.GET("/callback", s.callback)
	g.POST("/password", s.RequireUser(), s.updatePassword)
}

func (s *Service) signup(c *gin.Context) {
	var in credentials
	if !bindCredentials(c, &in, true) {
		return
	}
	pkce, ok := s.startPKCE(c, "/onboarding")
	if !ok {
		return
	}
	if err := s.supabase.SignUp(c.Request.Context(), in.Email, in.Password, pkce); err != nil {
		s.fail(c, err)
		return
	}
	// With email confirmation on, the user signs in by clicking the link we just sent.
	c.JSON(http.StatusOK, gin.H{"status": "check_email"})
}

func (s *Service) signin(c *gin.Context) {
	var in credentials
	if !bindCredentials(c, &in, false) {
		return
	}
	session, err := s.supabase.SignInWithPassword(c.Request.Context(), in.Email, in.Password)
	if err != nil {
		s.fail(c, err)
		return
	}
	s.cookies.setSession(c, session)
	c.JSON(http.StatusOK, gin.H{"user": gin.H{"id": session.User.ID, "email": session.User.Email}})
}

func (s *Service) signout(c *gin.Context) {
	if raw, err := c.Cookie(accessCookie); err == nil && raw != "" {
		// Best effort: the cookies are cleared either way.
		if err := s.supabase.SignOut(c.Request.Context(), raw); err != nil {
			slog.Warn("supabase sign-out failed", "err", err)
		}
	}
	s.cookies.clearSession(c)
	c.Status(http.StatusNoContent)
}

func (s *Service) recover(c *gin.Context) {
	var in struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || !validEmail(in.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
		return
	}
	pkce, ok := s.startPKCE(c, "/reset-password")
	if !ok {
		return
	}
	if err := s.supabase.Recover(c.Request.Context(), strings.TrimSpace(in.Email), pkce); err != nil {
		if supabase.IsCode(err, "over_email_send_rate_limit") {
			s.fail(c, err)
			return
		}
		// Don't reveal whether the address has an account.
		slog.Warn("password recovery failed", "err", err)
	}
	c.JSON(http.StatusOK, gin.H{"status": "check_email"})
}

func (s *Service) updatePassword(c *gin.Context) {
	var in struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Password) < minPasswordLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Use at least 8 characters."})
		return
	}
	if err := s.supabase.UpdatePassword(c.Request.Context(), c.GetString(accessTokenKey), in.Password); err != nil {
		s.fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// callback is where Supabase sends the browser after an email link (sign-up
// confirmation, password reset). It trades the one-time code for a session.
func (s *Service) callback(c *gin.Context) {
	next := safeNext(c.Query("next"))
	code := c.Query("code")
	if code == "" {
		s.redirect(c, "/signin?error=link_invalid")
		return
	}
	verifier, err := c.Cookie(pkceCookie)
	s.cookies.clear(c, pkceCookie)
	if err != nil || verifier == "" {
		// The link was opened in another browser. Supabase has already confirmed the
		// email at this point, so the user can simply sign in.
		s.redirect(c, "/signin?confirmed=1")
		return
	}
	session, err := s.supabase.ExchangeCode(c.Request.Context(), code, verifier)
	if err != nil {
		slog.Warn("code exchange failed", "err", err)
		s.redirect(c, "/signin?error=link_expired")
		return
	}
	s.cookies.setSession(c, session)
	s.redirect(c, next)
}

// startPKCE stores a fresh verifier in a cookie and returns the challenge plus the
// callback address Supabase should redirect to.
func (s *Service) startPKCE(c *gin.Context, next string) (supabase.PKCE, bool) {
	verifier, challenge, err := newPKCE()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Something went wrong. Try again."})
		return supabase.PKCE{}, false
	}
	s.cookies.set(c, pkceCookie, verifier, pkceMaxAge)
	return supabase.PKCE{
		Challenge:  challenge,
		RedirectTo: s.appURL + "/api/auth/callback?next=" + url.QueryEscape(next),
	}, true
}

func (s *Service) redirect(c *gin.Context, path string) {
	c.Redirect(http.StatusFound, s.appURL+path)
}

// fail maps Supabase Auth errors to messages people can act on.
func (s *Service) fail(c *gin.Context, err error) {
	switch {
	case supabase.IsCode(err, "invalid_credentials"):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wrong email or password."})
	case supabase.IsCode(err, "email_not_confirmed"):
		c.JSON(http.StatusForbidden, gin.H{"error": "Confirm your email first. We sent you a link."})
	case supabase.IsCode(err, "user_already_exists"), supabase.IsCode(err, "email_exists"):
		c.JSON(http.StatusConflict, gin.H{"error": "There's already an account with this email. Sign in instead."})
	case supabase.IsCode(err, "weak_password"):
		c.JSON(http.StatusBadRequest, gin.H{"error": "That password is too easy to guess. Try a longer one."})
	case supabase.IsCode(err, "same_password"):
		c.JSON(http.StatusBadRequest, gin.H{"error": "That's your current password. Pick a new one."})
	case supabase.IsCode(err, "email_address_invalid"), supabase.IsCode(err, "validation_failed"):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
	case supabase.IsCode(err, "over_email_send_rate_limit"), supabase.IsCode(err, "over_request_rate_limit"):
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts. Wait a minute and try again."})
	default:
		slog.Error("supabase auth request failed", "err", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Sign-in is having trouble right now. Try again in a moment."})
	}
}

func bindCredentials(c *gin.Context, in *credentials, isSignup bool) bool {
	if err := c.ShouldBindJSON(in); err != nil || !validEmail(in.Email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
		return false
	}
	in.Email = strings.TrimSpace(in.Email)
	if isSignup && len(in.Password) < minPasswordLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Use at least 8 characters."})
		return false
	}
	if in.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter your password."})
		return false
	}
	return true
}

// validEmail is a light sanity check; Supabase does the real validation.
func validEmail(email string) bool {
	email = strings.TrimSpace(email)
	at := strings.LastIndex(email, "@")
	return at > 0 && at < len(email)-1 && !strings.ContainsAny(email, " \t\n")
}

// safeNext only allows redirects to a path on our own site.
func safeNext(next string) string {
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") || strings.Contains(next, "\\") {
		return "/app"
	}
	return next
}
