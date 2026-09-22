package ratelimit

import (
	"testing"
	"time"
)

func TestAllow(t *testing.T) {
	now := time.Unix(0, 0)
	l := New(2, time.Minute)
	l.now = func() time.Time { return now }

	if !l.Allow("a") || !l.Allow("a") {
		t.Fatal("first two requests refused")
	}
	if l.Allow("a") {
		t.Error("third request in the window allowed")
	}
	if !l.Allow("b") {
		t.Error("another key is limited too")
	}
	now = now.Add(time.Minute)
	if !l.Allow("a") {
		t.Error("request in the next window refused")
	}
	now = now.Add(2 * time.Minute)
	l.Allow("c")
	if len(l.counts) != 1 {
		t.Errorf("old keys kept: %d", len(l.counts))
	}
}
