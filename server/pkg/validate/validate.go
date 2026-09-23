// Package validate has input checks shared by several handlers; failures are 400
// *apperr.Error values. Feature-specific rules stay in their own packages.
package validate

import (
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/melihovodina/hovr/server/pkg/apperr"
)

// Text trims value and checks its length in characters (not bytes). On failure it
// returns a 400 error carrying message.
func Text(value string, min, max int, message string) (string, error) {
	value = strings.TrimSpace(value)
	if n := utf8.RuneCountInString(value); n < min || n > max {
		return "", apperr.BadRequest("%s", message)
	}
	return value, nil
}

// MaxEmailLen is the longest address a mailbox may have (RFC 5321).
const MaxEmailLen = 254

// emailExtras turn an address into something else in a mailto: link or a CSV cell.
const emailExtras = "?&#<>\"',;:\\"

// Email accepts only a bare address, so what is stored is what gets written to:
// it later becomes a reply link and a CSV cell. See docs/api.md.
func Email(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > MaxEmailLen || strings.ContainsAny(value, emailExtras) {
		return value, false
	}
	if strings.ContainsFunc(value, unicode.IsControl) || strings.ContainsFunc(value, unicode.IsSpace) {
		return value, false
	}
	// ParseAddress also accepts "Name <addr>", so the address has to come back whole.
	addr, err := mail.ParseAddress(value)
	if err != nil || addr.Name != "" || addr.Address != value {
		return value, false
	}
	return value, true
}
