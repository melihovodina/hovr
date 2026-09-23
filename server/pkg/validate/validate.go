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

// emailExtras are characters that turn an address into something else once it is put
// in a mailto: link or a CSV cell: "?" and "&" start mailto fields, "<" and ">" and
// the quote open a display-name form.
const emailExtras = "?&#<>\"',;:\\"

// Email trims value and accepts only a bare address, the form a mailbox actually has.
// The auth provider does its own check, but a visitor's address also reaches the owner
// as a reply link and a CSV cell, where "maria@example.com?bcc=someone@else.example"
// would quietly add a recipient. Display-name forms like "Maria <m@x.com>" are refused
// for the same reason: what is stored should be what is written to.
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
