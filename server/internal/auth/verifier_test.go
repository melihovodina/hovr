package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"testing"
	"time"
)

func TestVerify(t *testing.T) {
	f := newFakeSupabase(t)
	v := NewVerifier(context.Background(), f.url())
	hour := time.Now().Add(time.Hour)

	claims, err := v.Verify(f.signed(hour))
	if err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}
	if claims.Subject != testUserID || claims.Email != testEmail {
		t.Fatalf("claims = %q %q, want %q %q", claims.Subject, claims.Email, testUserID, testEmail)
	}

	stranger, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	f.mu.Lock()
	good := f.keys["k1"]
	f.mu.Unlock()

	rejected := map[string]string{
		"expired":      signToken(t, good, "k1", f.issuer(), time.Now().Add(-time.Minute)),
		"wrong issuer": signToken(t, good, "k1", "https://evil.example/auth/v1", hour),
		"forged":       signToken(t, stranger, "k1", f.issuer(), hour),
		"unknown kid":  signToken(t, stranger, "nope", f.issuer(), hour),
		"garbage":      "not.a.token",
	}
	for name, raw := range rejected {
		if _, err := v.Verify(raw); err == nil {
			t.Errorf("%s token accepted", name)
		}
	}
}

func TestVerifyPicksUpRotatedKey(t *testing.T) {
	f := newFakeSupabase(t)
	v := NewVerifier(context.Background(), f.url())
	// Pretend the last fetch was long ago so an unknown kid may trigger a refetch.
	v.jwks.lastFetch = time.Time{}

	f.addKey("k2")
	if _, err := v.Verify(f.signed(time.Now().Add(time.Hour))); err != nil {
		t.Fatalf("token signed with rotated key rejected: %v", err)
	}
}

func TestUnknownKidRefetchIsThrottled(t *testing.T) {
	f := newFakeSupabase(t)
	v := NewVerifier(context.Background(), f.url())
	// The keys were fetched just now, so a new kid must not cause another fetch yet.
	f.addKey("k2")
	if _, err := v.Verify(f.signed(time.Now().Add(time.Hour))); err == nil {
		t.Fatal("expected rejection while refetch is throttled")
	}
}
