package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const (
	jwksFetchTimeout = 5 * time.Second
	jwksMinRefetch   = time.Minute
)

var errUnknownKey = errors.New("unknown signing key")

// jwks keeps Supabase's public signing keys (ES256 / P-256) in memory, by kid.
type jwks struct {
	url    string
	client *http.Client

	mu   sync.RWMutex
	keys map[string]*ecdsa.PublicKey

	fetchMu   sync.Mutex
	lastFetch time.Time
}

type jwkDoc struct {
	Keys []struct {
		Kty string `json:"kty"`
		Crv string `json:"crv"`
		Kid string `json:"kid"`
		X   string `json:"x"`
		Y   string `json:"y"`
	} `json:"keys"`
}

func newJWKS(url string) *jwks {
	return &jwks{url: url, client: &http.Client{Timeout: jwksFetchTimeout}, keys: map[string]*ecdsa.PublicKey{}}
}

// key returns the public key for kid, refetching the set once if the kid is new.
func (j *jwks) key(kid string) (*ecdsa.PublicKey, error) {
	if k := j.lookup(kid); k != nil {
		return k, nil
	}
	if err := j.refresh(context.Background(), false); err != nil {
		return nil, err
	}
	if k := j.lookup(kid); k != nil {
		return k, nil
	}
	return nil, errUnknownKey
}

func (j *jwks) lookup(kid string) *ecdsa.PublicKey {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return j.keys[kid]
}

// refresh downloads the key set. Unless force is set, it is a no-op when the
// last fetch was less than jwksMinRefetch ago.
func (j *jwks) refresh(ctx context.Context, force bool) error {
	j.fetchMu.Lock()
	defer j.fetchMu.Unlock()
	if !force && time.Since(j.lastFetch) < jwksMinRefetch {
		return nil
	}
	j.lastFetch = time.Now()

	ctx, cancel := context.WithTimeout(ctx, jwksFetchTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, j.url, nil)
	if err != nil {
		return err
	}
	resp, err := j.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch jwks: status %d", resp.StatusCode)
	}

	var doc jwkDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return fmt.Errorf("decode jwks: %w", err)
	}
	keys := make(map[string]*ecdsa.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kty != "EC" || k.Crv != "P-256" || k.Kid == "" {
			continue
		}
		pub, err := parseP256(k.X, k.Y)
		if err != nil {
			return fmt.Errorf("key %s: %w", k.Kid, err)
		}
		keys[k.Kid] = pub
	}

	j.mu.Lock()
	j.keys = keys
	j.mu.Unlock()
	return nil
}

// parseP256 builds a public key from the base64url x/y coordinates of a JWK.
// ParseUncompressedPublicKey also checks that the point lies on the curve.
func parseP256(xb64, yb64 string) (*ecdsa.PublicKey, error) {
	x, err := base64.RawURLEncoding.DecodeString(xb64)
	if err != nil {
		return nil, fmt.Errorf("decode x: %w", err)
	}
	y, err := base64.RawURLEncoding.DecodeString(yb64)
	if err != nil {
		return nil, fmt.Errorf("decode y: %w", err)
	}
	if len(x) != 32 || len(y) != 32 {
		return nil, errors.New("p-256 coordinates must be 32 bytes")
	}
	point := append(append([]byte{0x04}, x...), y...)
	return ecdsa.ParseUncompressedPublicKey(elliptic.P256(), point)
}
