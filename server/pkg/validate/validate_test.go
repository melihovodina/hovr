package validate

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/melihovodina/hovr/server/pkg/apperr"
)

func TestText(t *testing.T) {
	got, err := Text("  Northwind  ", 1, 20, "bad name")
	if err != nil || got != "Northwind" {
		t.Fatalf("Text trimmed = %q, %v", got, err)
	}
	// Length counts characters, not bytes.
	if _, err := Text(strings.Repeat("é", 5), 1, 5, "bad"); err != nil {
		t.Errorf("5 two-byte characters rejected with max 5: %v", err)
	}
	for _, in := range []string{"", "   ", strings.Repeat("a", 21)} {
		_, err := Text(in, 1, 20, "bad name")
		var ae *apperr.Error
		if !errors.As(err, &ae) || ae.Status != http.StatusBadRequest || ae.Message != "bad name" {
			t.Errorf("Text(%q) error = %v, want a 400 with the message", in, err)
		}
	}
}

func TestEmail(t *testing.T) {
	valid := map[string]string{
		"anna@northwind.example":    "anna@northwind.example",
		"  anna@northwind.example ": "anna@northwind.example",
	}
	for in, want := range valid {
		if got, ok := Email(in); !ok || got != want {
			t.Errorf("Email(%q) = %q, %v; want %q", in, got, ok, want)
		}
	}
	for _, in := range []string{"", "anna", "@northwind.example", "anna@", "an na@northwind.example"} {
		if _, ok := Email(in); ok {
			t.Errorf("Email(%q) accepted", in)
		}
	}
}
