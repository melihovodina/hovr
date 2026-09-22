package auth

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/melihovodina/hovr/server/internal/supabase"
	"github.com/melihovodina/hovr/server/pkg/httpx"
	"github.com/melihovodina/hovr/server/pkg/validate"
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
	g.POST("/resend", s.resend)
	g.GET("/callback", s.callback)
	g.POST("/password", s.RequireUser(), s.updatePassword)
}

func (s *Service) signup(c *gin.Context) {
	var in credentials
	if !bindCredentials(c, &in, true) {
		return
	}
	if err := s.supabase.SignUp(c.Request.Context(), in.Email, in.Password, s.startPKCE(c, "/onboarding")); err != nil {
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
	_ = c.ShouldBindJSON(&in)
	email, ok := validate.Email(in.Email)
	if !ok {
		httpx.Error(c, http.StatusBadRequest, "Enter a valid email address.")
		return
	}
	if err := s.supabase.Recover(c.Request.Context(), email, s.startPKCE(c, "/reset-password")); err != nil {
		if supabase.IsCode(err, "over_email_send_rate_limit") {
			s.fail(c, err)
			return
		}
		// Don't reveal whether the address has an account.
		slog.Warn("password recovery failed", "err", err)
	}
	c.JSON(http.StatusOK, gin.H{"status": "check_email"})
}

// resend sends the confirmation email again, for the "check your email" screen.
func (s *Service) resend(c *gin.Context) {
	var in struct {
		Email string `json:"email"`
	}
	_ = c.ShouldBindJSON(&in)
	email, ok := validate.Email(in.Email)
	if !ok {
		httpx.Error(c, http.StatusBadRequest, "Enter a valid email address.")
		return
	}
	if err := s.supabase.Resend(c.Request.Context(), email, s.startPKCE(c, "/signin")); err != nil {
		if supabase.IsCode(err, "over_email_send_rate_limit") {
			s.fail(c, err)
			return
		}
		// Don't reveal whether the address has an account, or is already confirmed.
		slog.Warn("resend confirmation failed", "err", err)
	}
	c.JSON(http.StatusOK, gin.H{"status": "check_email"})
}

func (s *Service) updatePassword(c *gin.Context) {
	var in struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || len(in.Password) < minPasswordLength {
		httpx.Error(c, http.StatusBadRequest, "Use at least 8 characters.")
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
func (s *Service) startPKCE(c *gin.Context, next string) supabase.PKCE {
	verifier, challenge := newPKCE()
	s.cookies.set(c, pkceCookie, verifier, pkceMaxAge)
	return supabase.PKCE{
		Challenge:  challenge,
		RedirectTo: s.appURL + "/api/auth/callback?next=" + url.QueryEscape(next),
	}
}

func (s *Service) redirect(c *gin.Context, path string) {
	c.Redirect(http.StatusFound, s.appURL+path)
}

// fail maps Supabase Auth errors to messages people can act on.
func (s *Service) fail(c *gin.Context, err error) {
	switch {
	case supabase.IsCode(err, "invalid_credentials"):
		httpx.Error(c, http.StatusUnauthorized, "Wrong email or password.")
	case supabase.IsCode(err, "email_not_confirmed"):
		httpx.Error(c, http.StatusForbidden, "Confirm your email first. We sent you a link.")
	case supabase.IsCode(err, "user_already_exists"), supabase.IsCode(err, "email_exists"):
		httpx.Error(c, http.StatusConflict, "There's already an account with this email. Sign in instead.")
	case supabase.IsCode(err, "weak_password"):
		httpx.Error(c, http.StatusBadRequest, "That password is too easy to guess. Try a longer one.")
	case supabase.IsCode(err, "same_password"):
		httpx.Error(c, http.StatusBadRequest, "That's your current password. Pick a new one.")
	case supabase.IsCode(err, "email_address_invalid"), supabase.IsCode(err, "validation_failed"):
		httpx.Error(c, http.StatusBadRequest, "Enter a valid email address.")
	case supabase.IsCode(err, "over_email_send_rate_limit"), supabase.IsCode(err, "over_request_rate_limit"):
		httpx.Error(c, http.StatusTooManyRequests, "Too many attempts. Wait a minute and try again.")
	default:
		slog.Error("supabase auth request failed", "err", err)
		httpx.Error(c, http.StatusBadGateway, "Sign-in is having trouble right now. Try again in a moment.")
	}
}

func bindCredentials(c *gin.Context, in *credentials, isSignup bool) bool {
	_ = c.ShouldBindJSON(in)
	email, ok := validate.Email(in.Email)
	switch {
	case !ok:
		httpx.Error(c, http.StatusBadRequest, "Enter a valid email address.")
	case isSignup && len(in.Password) < minPasswordLength:
		httpx.Error(c, http.StatusBadRequest, "Use at least 8 characters.")
	case in.Password == "":
		httpx.Error(c, http.StatusBadRequest, "Enter your password.")
	default:
		in.Email = email
		return true
	}
	return false
}

// safeNext only allows redirects to a path on our own site.
func safeNext(next string) string {
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") || strings.Contains(next, "\\") {
		return "/app"
	}
	return next
}
