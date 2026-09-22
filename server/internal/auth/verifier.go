// Package auth signs users in through Supabase Auth, keeps the session in httpOnly
// cookies and exposes the signed-in user to handlers.
package auth

import (
	"context"
	"errors"
	"log/slog"

	"github.com/golang-jwt/jwt/v5"
)

// Claims are the parts of a Supabase access token the server relies on.
type Claims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// Verifier checks tokens signed either with Supabase signing keys (ES256, from JWKS)
// or, when a legacy JWT secret is configured, with HS256.
type Verifier struct {
	jwks   *jwks
	secret []byte
	issuer string
}

// NewVerifier loads the Supabase signing keys.
func NewVerifier(ctx context.Context, supabaseURL, jwtSecret string) *Verifier {
	keys := newJWKS(supabaseURL + "/auth/v1/.well-known/jwks.json")
	if err := keys.refresh(ctx, true); err != nil {
		slog.Warn("signing keys not loaded yet", "err", err)
	}
	return &Verifier{jwks: keys, secret: []byte(jwtSecret), issuer: supabaseURL + "/auth/v1"}
}

func (v *Verifier) keyFor(token *jwt.Token) (any, error) {
	switch token.Method.Alg() {
	case jwt.SigningMethodHS256.Alg():
		if len(v.secret) == 0 {
			return nil, errors.New("hs256 token but no jwt secret configured")
		}
		return v.secret, nil
	case jwt.SigningMethodES256.Alg():
		kid, _ := token.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("token has no kid")
		}
		return v.jwks.key(kid)
	default:
		return nil, errors.New("unsupported signing algorithm")
	}
}

// Verify parses and validates a raw access token.
func (v *Verifier) Verify(raw string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, v.keyFor,
		jwt.WithValidMethods([]string{"ES256", "HS256"}),
		jwt.WithAudience("authenticated"),
		jwt.WithIssuer(v.issuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	if claims.Subject == "" {
		return nil, errors.New("token has no subject")
	}
	return claims, nil
}
