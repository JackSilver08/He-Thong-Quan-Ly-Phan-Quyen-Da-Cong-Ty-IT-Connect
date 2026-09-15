package repository

import (
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsConflict(t *testing.T) {
	for _, code := range []string{"23505", "23503"} {
		if !IsConflict(&pgconn.PgError{Code: code}) {
			t.Errorf("IsConflict(%s) = false", code)
		}
	}
	if IsConflict(&pgconn.PgError{Code: "22P02"}) {
		t.Fatal("invalid-input error classified as conflict")
	}
}

func TestIsInvalidInput(t *testing.T) {
	for _, code := range []string{"22P02", "22007", "22008"} {
		if !IsInvalidInput(&pgconn.PgError{Code: code}) {
			t.Errorf("IsInvalidInput(%s) = false", code)
		}
	}
	if IsInvalidInput(&pgconn.PgError{Code: "23505"}) {
		t.Fatal("unique violation classified as invalid input")
	}
}

func TestErrorsCanBeWrapped(t *testing.T) {
	err := &pgconn.PgError{Code: "23505", Message: "duplicate key"}
	wrapped := wrapForTest(err)
	if !IsConflict(wrapped) {
		t.Fatal("IsConflict() did not inspect wrapped postgres error")
	}
}

func wrapForTest(err error) error {
	return wrappedError{err: err}
}

type wrappedError struct{ err error }

func (e wrappedError) Error() string { return "wrapped: " + e.err.Error() }
func (e wrappedError) Unwrap() error { return e.err }
