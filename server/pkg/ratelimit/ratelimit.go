// Package ratelimit counts requests per key in fixed time windows, in memory.
// Good for one server instance; several instances would each count separately.
package ratelimit

import (
	"sync"
	"time"
)

// Limiter allows up to limit requests per key in each window.
type Limiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	counts  map[string]*counter
	cleaned time.Time
}

type counter struct {
	n     int
	start time.Time
}

func New(limit int, window time.Duration) *Limiter {
	return &Limiter{limit: limit, window: window, now: time.Now, counts: map[string]*counter{}}
}

// Allow counts a request for key and reports whether it is within the limit.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if now.Sub(l.cleaned) > l.window {
		for k, c := range l.counts {
			if now.Sub(c.start) >= l.window {
				delete(l.counts, k)
			}
		}
		l.cleaned = now
	}
	c, ok := l.counts[key]
	if !ok || now.Sub(c.start) >= l.window {
		c = &counter{start: now}
		l.counts[key] = c
	}
	if c.n >= l.limit {
		return false
	}
	c.n++
	return true
}
