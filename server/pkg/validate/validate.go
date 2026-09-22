// Package validate has input checks shared by several handlers; failures are 400
// *apperr.Error values. Feature-specific rules stay in their own packages.
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
