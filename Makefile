.PHONY: db-start db-stop db-reset db-status server build test vet

# Local Supabase (Postgres, Auth, Storage, Studio, Mailpit) in Docker.
db-start:
	supabase start

db-stop:
	supabase stop

# Recreate the local database from supabase/migrations.
db-reset:
	supabase db reset

db-status:
	supabase status

# Go API on :8080, reads server/.env.
server:
	cd server && go run ./cmd

build:
	cd server && go build -o bin/hovr ./cmd

# Unit tests plus database tests against local Supabase (make db-start first).
test:
	cd server && TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres go test ./...

vet:
	cd server && go vet ./...
