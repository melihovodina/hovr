.PHONY: db-start db-stop db-reset db-status server build test vet client-install client client-build client-lint

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

# Frontend (client/, pnpm).
client-install:
	cd client && pnpm install

# Next dev server on :3000; proxies /api to the Go server on :8080 (make server).
client:
	cd client && pnpm dev

# Static export into client/out, served by the Go server via STATIC_DIR.
client-build:
	cd client && pnpm build

# ESLint plus a TypeScript check.
client-lint:
	cd client && pnpm lint && pnpm exec tsc --noEmit
