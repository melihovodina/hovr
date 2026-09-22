// Package fakestorage is an in-memory stand-in for the Supabase Storage client.
// Only test files import it.
package fakestorage

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// ErrUnavailable is returned by every call while Down is set.
var ErrUnavailable = errors.New("fake storage unavailable")

// Files keeps uploaded files in memory. The zero value is not usable; call New.
type Files struct {
	mu    sync.Mutex
	files map[string][]byte
	// Down makes every call fail, to test how callers handle storage outages.
	Down bool
}

func New() *Files {
	return &Files{files: map[string][]byte{}}
}

func (f *Files) Upload(_ context.Context, path, _ string, data []byte) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Down {
		return ErrUnavailable
	}
	if _, exists := f.files[path]; exists {
		return fmt.Errorf("fake storage: %s already exists", path)
	}
	f.files[path] = append([]byte(nil), data...)
	return nil
}

func (f *Files) Download(_ context.Context, path string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Down {
		return nil, ErrUnavailable
	}
	data, ok := f.files[path]
	if !ok {
		return nil, fmt.Errorf("fake storage: %s not found", path)
	}
	return data, nil
}

func (f *Files) Delete(_ context.Context, paths ...string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Down {
		return ErrUnavailable
	}
	for _, p := range paths {
		delete(f.files, p)
	}
	return nil
}

// PublicURL mimics a public bucket address.
func (f *Files) PublicURL(path string) string {
	return "https://storage.test/public/" + path
}

// Has reports whether a file is stored at path.
func (f *Files) Has(path string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.files[path]
	return ok
}

// Count returns how many files are stored.
func (f *Files) Count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.files)
}
