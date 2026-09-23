# hovr

An embeddable RAG chatbot builder: a Go API and a Next.js client that ship as one
container. Owners upload documents, the server turns them into embedded chunks, and
visitors get grounded answers through an in-app playground or a widget on their site.

- **Go 1.26 + Gin + pgx**, serving the API and the client's static export from one binary.
- **Supabase** for Postgres with pgvector, Auth (proxied by the server, sessions in
  httpOnly cookies) and Storage for uploaded files.
- **Ingestion** in a background worker: text extraction (PDF, DOCX, Markdown, plain text),
  paragraph-aware chunking, batched Gemini embeddings, statuses and failure reasons.
- **Retrieval** over pgvector with an HNSW index, a similarity threshold calibrated on
  real scores, and a prompt that must answer from the passages or say it doesn't know.
- **Streaming** answers over SSE with citations, and questions the bot missed collected
  for the owner to answer.
- **Stripe** subscriptions kept in sync by webhooks, with plan limits enforced server-side.

## Run it locally

Needs Docker, Go 1.26, Node 22 with pnpm, the Supabase CLI and a Gemini API key.

```bash
make db-start                 # local Supabase (Postgres, Auth, Storage, Mailpit)
cp server/.env.example server/.env   # then fill it in, see below
make server                   # API on :8080
make client-install && make client   # app on :3000, proxies /api to :8080
```

`server/.env` needs the local Supabase keys from `make db-status`, a Gemini key, and the
Stripe test keys. Stripe price ids come from two monthly products (Pro and Business) in
your test account; the webhook secret from
`stripe listen --forward-to localhost:8080/api/billing/webhook`.

Sign-up emails land in Mailpit at http://127.0.0.1:54324, and the database browser is at
http://127.0.0.1:54323.

To run it the way it is deployed, as one container serving the API and the built client:

```bash
docker compose up --build     # http://localhost:8080
```

## Commands

| Command | What it does |
| --- | --- |
| `make db-start` / `make db-stop` / `make db-reset` | local Supabase |
| `make server` | Go API on :8080 |
| `make client` / `make client-build` | Next dev server / static export |
| `make test` | Go tests against the local database |
| `make vet` / `make client-lint` | Go vet / ESLint and TypeScript |

## Tests

`make test` runs everything, including tests against the local Supabase database, with a
fake embedder so nothing calls Gemini and no API key is needed. Two tests talk to the real
Gemini API and only run when asked:

```bash
HOVR_CALIBRATE=1 go test ./internal/rag -run Calibrate -v   # similarity scores per question
HOVR_EVAL=1 make test                                       # real answers for a sample knowledge base
```

CI (GitHub Actions) runs gofmt, vet and the Go tests with `-race` against a Postgres started
by the Supabase CLI, lints, type checks and tests the client, and builds the Docker image.

## Layout

```
server/     Go: API, ingestion, retrieval, chat, widget, billing; serves the client build
client/     Next.js: landing, app, widget loader and iframe page (static export)
supabase/   migrations and local stack config
```

Inside `server/`: `internal/` holds the product code (`auth`, `bots`, `sources`, `rag`,
`chat`, `widget`, `inbox`, `overview`, `billing`), `pkg/` the generic helpers, and `test/`
everything only tests use, including `.http` files for trying the API by hand.

## Docs

- [`server/docs/architecture.md`](server/docs/architecture.md) — packages, request flow, ingestion, answering
- [`server/docs/api.md`](server/docs/api.md) — every endpoint, errors, widget and billing details
- [`server/docs/database.md`](server/docs/database.md) — schema, indexes, limits
- [`server/docs/operations.md`](server/docs/operations.md) — environment values, deploying, monitoring

## Decisions worth knowing

- **One container.** The Go server serves the API and the exported client, so there is one
  deploy, one URL, and no CORS or cookie problems.
- **Sessions in httpOnly cookies.** The browser never holds a token: the Go server talks to
  Supabase Auth and sets cookies, refreshes them silently, and checks the Origin header on
  every write.
- **Answers are grounded.** Retrieval only sees the asking bot's own ready sources. Below a
  similarity threshold calibrated on real scores, the model gets no passages at all, and the
  prompt makes it say "I don't know" when the passages don't cover the question. That flag,
  not the score, is what fills the inbox.
- **Model choice is a config change.** Embeddings and chat sit behind small interfaces, and
  chat falls back to the next model when one is overloaded, which the free tier often is.
- **The database rejects bad writes.** Stores don't check first; they write and translate
  the database error into a readable message.
