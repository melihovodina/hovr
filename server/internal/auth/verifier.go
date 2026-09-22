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

// Verifier checks tokens signed with the Supabase project's ES256 signing keys (JWKS).
type Verifier struct {
	jwks   *jwks
	issuer string
}

// NewVerifier loads the Supabase signing keys.
func NewVerifier(ctx context.Context, supabaseURL string) *Verifier {
	keys := newJWKS(supabaseURL + "/auth/v1/.well-known/jwks.json")
	if err := keys.refresh(ctx, true); err != nil {
		slog.Warn("signing keys not loaded yet", "err", err)
	}
	return &Verifier{jwks: keys, issuer: supabaseURL + "/auth/v1"}
}

func (v *Verifier) keyFor(token *jwt.Token) (any, error) {
	kid, _ := token.Header["kid"].(string)
	if kid == "" {
		return nil, errors.New("token has no kid")
	}
	return v.jwks.key(kid)
}

// Verify parses and validates a raw access token.
func (v *Verifier) Verify(raw string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, v.keyFor,
		jwt.WithValidMethods([]string{jwt.SigningMethodES256.Alg()}),
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
