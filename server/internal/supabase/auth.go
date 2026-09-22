// Package supabase talks to the Supabase Auth (GoTrue) REST API.
package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Session is what Supabase returns after a successful sign-in, refresh or code exchange.
type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	User         struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	} `json:"user"`
}

// APIError is an error response from Supabase Auth.
type APIError struct {
	Status  int
	Code    string `json:"error_code"`
	Message string `json:"msg"`
	// Older endpoints use OAuth-style fields.
	OAuthError       string `json:"error"`
	OAuthDescription string `json:"error_description"`
}

func (e *APIError) Error() string {
	msg := e.Message
	if msg == "" {
		msg = e.OAuthDescription
	}
	return fmt.Sprintf("supabase auth %d: %s %s", e.Status, e.Code, msg)
}

// Auth is a thin client for the endpoints the server uses.
type Auth struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

// NewAuth creates a client. apiKey is the project's publishable (anon) key.
func NewAuth(supabaseURL, apiKey string) *Auth {
	return &Auth{
		baseURL: supabaseURL + "/auth/v1",
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

// PKCE carries the code challenge for flows that finish with a redirect back to us.
type PKCE struct {
	Challenge  string
	RedirectTo string
}

// SignUp creates a user. With email confirmation on, no session is returned yet:
// the user gets an email whose link redirects to pkce.RedirectTo with a ?code=.
func (a *Auth) SignUp(ctx context.Context, email, password string, pkce PKCE) error {
	body := map[string]string{
		"email":                 email,
		"password":              password,
		"code_challenge":        pkce.Challenge,
		"code_challenge_method": "s256",
	}
	return a.do(ctx, http.MethodPost, "/signup?redirect_to="+url.QueryEscape(pkce.RedirectTo), "", body, nil)
}

// SignInWithPassword exchanges email and password for a session.
func (a *Auth) SignInWithPassword(ctx context.Context, email, password string) (*Session, error) {
	var s Session
	err := a.do(ctx, http.MethodPost, "/token?grant_type=password", "",
		map[string]string{"email": email, "password": password}, &s)
	return &s, err
}

// Refresh trades a refresh token for a new session (Supabase rotates the refresh token).
func (a *Auth) Refresh(ctx context.Context, refreshToken string) (*Session, error) {
	var s Session
	err := a.do(ctx, http.MethodPost, "/token?grant_type=refresh_token", "",
		map[string]string{"refresh_token": refreshToken}, &s)
	return &s, err
}

// ExchangeCode finishes a PKCE flow (email confirmation, password reset, OAuth).
func (a *Auth) ExchangeCode(ctx context.Context, code, verifier string) (*Session, error) {
	var s Session
	err := a.do(ctx, http.MethodPost, "/token?grant_type=pkce", "",
		map[string]string{"auth_code": code, "code_verifier": verifier}, &s)
	return &s, err
}

// Recover sends a password reset email whose link redirects to pkce.RedirectTo.
func (a *Auth) Recover(ctx context.Context, email string, pkce PKCE) error {
	body := map[string]string{
		"email":                 email,
		"code_challenge":        pkce.Challenge,
		"code_challenge_method": "s256",
	}
	return a.do(ctx, http.MethodPost, "/recover?redirect_to="+url.QueryEscape(pkce.RedirectTo), "", body, nil)
}

// UpdatePassword sets a new password for the user who owns accessToken.
func (a *Auth) UpdatePassword(ctx context.Context, accessToken, password string) error {
	return a.do(ctx, http.MethodPut, "/user", accessToken, map[string]string{"password": password}, nil)
}

// SignOut revokes the session behind accessToken (this device only).
func (a *Auth) SignOut(ctx context.Context, accessToken string) error {
	return a.do(ctx, http.MethodPost, "/logout?scope=local", accessToken, nil, nil)
}

// AuthorizeURL is where the browser goes to sign in with an OAuth provider.
func (a *Auth) AuthorizeURL(provider string, pkce PKCE) string {
	q := url.Values{
		"provider":              {provider},
		"redirect_to":           {pkce.RedirectTo},
		"code_challenge":        {pkce.Challenge},
		"code_challenge_method": {"s256"},
	}
	return a.baseURL + "/authorize?" + q.Encode()
}

func (a *Auth) do(ctx context.Context, method, path, bearer string, in, out any) error {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, a.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("supabase auth: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		apiErr := &APIError{Status: resp.StatusCode}
		_ = json.NewDecoder(resp.Body).Decode(apiErr)
		return apiErr
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// IsCode reports whether err is a Supabase Auth error with the given error_code.
func IsCode(err error, code string) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.Code == code
}
