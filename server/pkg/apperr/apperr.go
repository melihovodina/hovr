// Package apperr is the one error type for everything the user should see: an HTTP
// status, a message people can read and an optional machine-readable code. Map turns
// database errors into it, so stores can just try a write and let the database say
// what went wrong (duplicate, missing parent row...) instead of checking first.
package apperr

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// CodeUpgradeRequired tells the client to show an upgrade prompt.
const CodeUpgradeRequired = "upgrade_required"

// Error is an expected failure with a message that is safe to show.
type Error struct {
	Status  int
	Message string
	Code    string
}

func (e *Error) Error() string { return e.Message }

// Is makes errors.Is match by kind: same status (and same code, if the target has
// one). So a feature's NotFound("Bot not found.") still matches ErrNotFound.
func (e *Error) Is(target error) bool {
	t, ok := target.(*Error)
	return ok && t.Status == e.Status && (t.Code == "" || t.Code == e.Code)
}

func BadRequest(format string, args ...any) *Error {
	return &Error{Status: http.StatusBadRequest, Message: fmt.Sprintf(format, args...)}
}

func NotFound(message string) *Error {
	return &Error{Status: http.StatusNotFound, Message: message}
}

func Conflict(message string) *Error {
	return &Error{Status: http.StatusConflict, Message: message}
}

// UpgradeRequired means the account's plan doesn't allow the action.
func UpgradeRequired(message string) *Error {
	return &Error{Status: http.StatusPaymentRequired, Message: message, Code: CodeUpgradeRequired}
}

// Generic kinds; features usually return their own message with the same status.
var (
	ErrNotFound = NotFound("Not found.")
	ErrConflict = Conflict("This already exists.")
	ErrBadInput = BadRequest("Something in the request doesn't look right.")
)

// Postgres error codes Map understands.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const (
	pgUniqueViolation     = "23505"
	pgForeignKeyViolation = "23503"
	pgCheckViolation      = "23514"
	pgInvalidText         = "22P02"
	pgStringTooLong       = "22001"
)

// Map translates database errors into *Error. Anything it doesn't recognise is
// returned unchanged, which means "unexpected": log it and answer 500.
func Map(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case pgUniqueViolation:
			return ErrConflict
		case pgForeignKeyViolation:
			// The row we pointed at (a bot, an account...) doesn't exist (anymore).
			return ErrNotFound
		case pgCheckViolation, pgInvalidText, pgStringTooLong:
			return ErrBadInput
		}
	}
	return err
}

// MapNotFound is Map with a specific message for "not found".
func MapNotFound(err error, notFound *Error) error {
	if err = Map(err); errors.Is(err, ErrNotFound) {
		return notFound
	}
	return err
}

// Constraint returns the name of the database constraint behind err, if any, so a
// store can tell two unique constraints on the same table apart.
func Constraint(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}

// IsExpected reports whether err is an *Error (safe to show, no need to log).
func IsExpected(err error) bool {
	var e *Error
	return errors.As(err, &e)
}
