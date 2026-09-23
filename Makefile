.PHONY: db-start db-stop db-reset db-fix-storage db-status server build test vet client-install client client-build client-lint client-test

# Local Supabase (Postgres, Auth, Storage, Studio, Mailpit) in Docker.
db-start:
	supabase start
	$(MAKE) db-fix-storage

db-stop:
	supabase stop

# Recreate the local database from supabase/migrations.
db-reset:
	supabase db reset
	$(MAKE) db-fix-storage

# storage-api v1.72.1 runs a migration that drops the unique index on
# (bucket_id, name), but still uploads with "on conflict (name, bucket_id)".
# The indexes it leaves are partial, so Postgres finds no arbiter and every
# upload fails with 42P10. Putting the index back is local only: the hosted
# project runs Supabase's own storage and is not affected.
db-fix-storage:
	docker exec supabase_db_hovr psql -U supabase_admin -d postgres -c \
	  'create unique index if not exists objects_bucket_id_name_key \
	  on storage.objects (bucket_id, name collate "C");'

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

# ESLint plus a TypeScript check. next typegen writes the route types (LayoutProps and the like)
# that next dev and next build would, so the check also works on a fresh checkout such as CI.
client-lint:
	cd client && pnpm lint && pnpm exec next typegen && pnpm exec tsc --noEmit

# Frontend unit and component tests (Vitest, jsdom).
client-test:
	cd client && pnpm test
