package apperr

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestMap(t *testing.T) {
	cases := []struct {
		name string
		in   error
		want *Error
	}{
		{"no rows", pgx.ErrNoRows, ErrNotFound},
		{"wrapped no rows", fmt.Errorf("load: %w", pgx.ErrNoRows), ErrNotFound},
		{"unique", &pgconn.PgError{Code: pgUniqueViolation}, ErrConflict},
		{"foreign key", &pgconn.PgError{Code: pgForeignKeyViolation}, ErrNotFound},
		{"check", &pgconn.PgError{Code: pgCheckViolation}, ErrBadInput},
		{"invalid text", &pgconn.PgError{Code: pgInvalidText}, ErrBadInput},
		{"too long", &pgconn.PgError{Code: pgStringTooLong}, ErrBadInput},
	}
	for _, tc := range cases {
		if got := Map(tc.in); got != tc.want {
			t.Errorf("%s: Map = %v, want %v", tc.name, got, tc.want)
		}
	}

	unknown := &pgconn.PgError{Code: "40001"} // serialization failure: unexpected
	if got := Map(unknown); got != unknown || IsExpected(got) {
		t.Errorf("unknown pg error changed or marked expected: %v", got)
	}
	if Map(nil) != nil {
		t.Error("Map(nil) != nil")
	}
}

func TestIsMatchesByKind(t *testing.T) {
	botMissing := NotFound("Bot not found.")
	if !errors.Is(botMissing, ErrNotFound) {
		t.Error("feature NotFound doesn't match ErrNotFound")
	}
	if errors.Is(botMissing, ErrConflict) {
		t.Error("NotFound matches ErrConflict")
	}
	if !errors.Is(fmt.Errorf("wrapped: %w", botMissing), ErrNotFound) {
		t.Error("wrapped NotFound doesn't match")
	}
	upgrade := UpgradeRequired("Comes with Pro.")
	if upgrade.Status != http.StatusPaymentRequired || upgrade.Code != CodeUpgradeRequired {
		t.Errorf("UpgradeRequired = %+v", upgrade)
	}
}

func TestConstraint(t *testing.T) {
	err := fmt.Errorf("insert: %w", &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "bots_public_key_key"})
	if got := Constraint(err); got != "bots_public_key_key" {
		t.Errorf("Constraint = %q", got)
	}
	if Constraint(errors.New("plain")) != "" {
		t.Error("Constraint of a plain error is not empty")
	}
}
