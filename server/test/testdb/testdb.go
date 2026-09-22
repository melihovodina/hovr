// Package testdb gives tests a real database (the local Supabase one) and test users.
// Only test files import it.
package testdb

import (
	"context"
	"crypto/rand"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/melihovodina/hovr/server/internal/db"
	"github.com/melihovodina/hovr/server/internal/plans"
)

// Connect opens a pool on TEST_DATABASE_URL (set by `make test`). Without it tests
// skip locally but fail in CI, where a silently green run would hide them.
func Connect(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("CI") != "" {
			t.Fatal("TEST_DATABASE_URL not set")
		}
		t.Skip("TEST_DATABASE_URL not set")
	}
	pool, err := db.Connect(context.Background(), url)
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// NewUser creates an auth user on the given plan and returns its id. The sign-up
// trigger creates the account; everything the user owns is deleted after the test.
func NewUser(t *testing.T, pool *pgxpool.Pool, plan plans.Plan) string {
	t.Helper()
	ctx := context.Background()
	var id string
	err := pool.QueryRow(ctx,
		`insert into auth.users (id, email, aud, role)
		 values (gen_random_uuid(), $1, 'authenticated', 'authenticated') returning id`,
		"test-"+rand.Text()+"@hovr.test").Scan(&id)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from auth.users where id = $1`, id)
	})
	if plan != plans.Free {
		if _, err := pool.Exec(ctx, `update accounts set plan = $2 where id = $1`, id, plan); err != nil {
			t.Fatalf("set test user plan: %v", err)
		}
	}
	return id
}

// NewBot creates a user on plan with one bot and returns (accountID, botID).
func NewBot(t *testing.T, pool *pgxpool.Pool, plan plans.Plan) (string, string) {
	t.Helper()
	account := NewUser(t, pool, plan)
	var bot string
	err := pool.QueryRow(context.Background(),
		`insert into bots (account_id, name, public_key) values ($1, 'Test bot', $2) returning id`,
		account, "pub_"+rand.Text()).Scan(&bot)
	if err != nil {
		t.Fatalf("create bot: %v", err)
	}
	return account, bot
}
