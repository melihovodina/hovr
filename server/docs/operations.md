# Operations

## Environment

`config.Load` reads `server/.env` in development and fails at startup if anything required
is missing, so the server never runs half-configured. `.env.example` lists every value.

| Value | Required | What it is |
| --- | --- | --- |
| `PORT` | no (8080) | listening port |
| `APP_URL` | no (`http://localhost:3000`) | the site's own address: Origin checks, email links, Stripe return URLs, widget previews |
| `DATABASE_URL` | yes | Postgres connection string |
| `SUPABASE_URL` | yes | Supabase project URL (Auth and Storage) |
| `SUPABASE_PUBLISHABLE_KEY` | yes | used for sign-in calls to Supabase Auth |
| `SUPABASE_SECRET_KEY` | yes | server-side key for Storage; never send it to a browser |
| `GEMINI_API_KEY` | yes | embeddings and chat |
| `STRIPE_SECRET_KEY` | yes | test or live key |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_...`, verifies webhook calls |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | yes | the monthly prices |
| `TRUSTED_PROXIES` | no | comma-separated proxy addresses or CIDRs allowed to set `X-Forwarded-For`; empty trusts none |
| `CLIENT_IP_HEADER` | no | a header the host fills with the real visitor and always overwrites, used instead of the forwarded chain; `CF-Connecting-IP` on Render |
| `STATIC_DIR` | no | folder with the client export; empty means API only |

The client needs `NEXT_PUBLIC_SITE_URL` at build time, which the Dockerfile takes as a
build argument.

## Running

`docker compose up --build` runs the image the way it deploys: one container serving the
API and the client. The image is built in `Dockerfile`: client export, Go binary, then a
small Alpine runtime that runs as a non-root user.

The ingestion worker runs inside the same process as a goroutine. It claims jobs with
`for update skip locked`, so several instances would be safe, but the widget rate limiter
counts in memory and would only count per instance.

## Deploying

1. Create the Supabase project and apply `supabase/migrations` to it. Later migrations go
   out with `supabase db push` before the code that needs them: added columns are
   invisible to the running build, so schema first is the order that never breaks.
2. Set the environment values above, with `APP_URL` as the public address.
3. Build with `NEXT_PUBLIC_SITE_URL` set to that same address.
4. Point a Stripe webhook at `https://<host>/api/billing/webhook` for
   `customer.subscription.created`, `.updated` and `.deleted`, and use its signing secret.
5. Set up SMTP, or sign-up and password-reset emails only reach project members, two per
   hour. Dashboard → Authentication → Emails → SMTP settings: host, port 587, the full
   address as the user, and an app password. Then raise Authentication → Rate limits →
   emails per hour, which stays at 2 even once SMTP is on.
   - In the dashboard, not `[auth.email.smtp]` in `config.toml`: that section also applies
     locally, where Mailpit should keep catching everything instead of sending real mail.
   - Gmail needs 2-step verification on and an app password (Google Account → Security).
     Its free limits are low and it can refuse mail from a new sender, so a transactional
     sender is the fallback. Nothing in the server changes either way.
6. Authentication → URL configuration: Site URL is the public address, and Redirect URLs
   must include `<address>/**`. The server asks Supabase to send people back to
   `APP_URL/api/auth/callback`, and an address that isn't on that list is silently replaced
   by the Site URL, which breaks every confirmation and reset link.
7. Ping `/healthz` from an uptime monitor; on a free host that also keeps the instance from
   sleeping.
8. Set `TRUSTED_PROXIES`, and `CLIENT_IP_HEADER` if the host fills one, then check what the
   server actually logs as the client IP.

The widget rate limits count per client IP, which Gin reads from `X-Forwarded-For` when the
request comes from a trusted proxy. `TRUSTED_PROXIES` decides who that is, and the two ways
to get it wrong pull in opposite directions:

- Trusting everyone (Gin's own default, which is why the server sets this) means a visitor
  can put any address in the header and get a fresh allowance for every message.
- Trusting no one behind a proxy means every visitor arrives as the proxy's address and
  shares one allowance.

Empty is the default because the second failure is the safe one. Verify it against the real
deployment rather than assuming: send a request and compare the address in the logs with
the one you sent from.

On Render it took three measurements to get right, and the forwarded chain alone never
does. The proxy reaches the container over loopback, so with nothing trusted every visitor
arrives as `::1` and they all share one allowance. Trusting `127.0.0.1,::1` moves it one hop
to Render's own `10.x` proxy, and trusting `10.0.0.0/8` as well moves it to Cloudflare —
which answers from a different address on almost every request, so the limit never reaches
its count. That is the fail-open direction.

So on Render: `TRUSTED_PROXIES=127.0.0.1,::1,10.0.0.0/8` and `CLIENT_IP_HEADER=CF-Connecting-IP`.
The header wins over the chain, and Cloudflare overwrites it, so a visitor cannot set it
themselves. Only name a header the host is known to overwrite: it is trusted as it arrives.
Another host will need different values, which is why this is measured rather than guessed —
send a request and compare the address in the logs with the one you sent from.

## Watching it

- `/healthz` returns `{"status":"ok","db":"up"}`, or 503 when the database is unreachable.
- Logs are structured (`slog`): failed requests, ingestion results, chat model failures,
  refunds, webhook rejections. Readable errors answer with their own message; anything
  unexpected is logged and becomes a 500.
- Gemini's free tier is the usual source of trouble: overloaded models answer 503, and chat
  falls back to the next model in the list in `internal/ai/chat.go`.

## Local tools

Supabase Studio http://127.0.0.1:54323, Mailpit (all local email) http://127.0.0.1:54324,
database `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
`make db-reset` rebuilds the local database from the migrations and deletes local data.

`make db-start` and `make db-reset` also run `db-fix-storage`. storage-api v1.72.1 runs a
migration that drops the unique index on `(bucket_id, name)`, then still uploads with
`on conflict (name, bucket_id)`; the indexes it leaves are partial, which Postgres won't
use as an arbiter, so every upload fails with `42P10` — avatars, uploaded files and inbox
answers alike. A database migrated incrementally kept the old index, so this only shows up
on a fresh one. Putting the index back is local only; the hosted project runs Supabase's
own storage.
