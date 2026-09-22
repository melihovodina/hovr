// Package validate has the input checks shared by several handlers. Rules that only
// one feature has (bot colors, widget position...) stay in that feature's package.
// Failures are *apperr.Error with status 400 and a message people can act on.
package validate

import (
	"strings"
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

// Email trims value and does a light sanity check; the auth provider does the real one.
func Email(value string) (string, bool) {
	value = strings.TrimSpace(value)
	at := strings.LastIndex(value, "@")
	ok := at > 0 && at < len(value)-1 && !strings.ContainsAny(value, " \t\r\n")
	return value, ok
}
