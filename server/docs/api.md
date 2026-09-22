# API

Base path `/api`. JSON in, JSON out, camelCase fields. Ready-made requests for every
endpoint are in `server/test/.http/`.

**Sessions.** Sign-in sets httpOnly cookies (`hovr_at`, `hovr_rt`, path `/api`), refreshed
silently by the server. The browser never sees a token. Call the API same-origin with
`credentials: "include"`.

**Writes need the Origin header** to equal `APP_URL`, otherwise 403. Browsers send it
automatically; the widget iframe is on our own origin, so it passes too. The Stripe webhook
is the one exception and is verified by its signature.

**Errors** are `{"error": "Readable message", "code": "optional"}`. Show `error` as it is.

| Status | Meaning |
| --- | --- |
| 400 | invalid input |
| 401 | not signed in |
| 402 | plan limit, `code: "upgrade_required"` |
| 403 | wrong Origin, or widget `code: "domain_not_allowed"` |
| 404 | not found, or not yours |
| 429 | widget `code: "rate_limited"` |
| 500 | "Something went wrong. Try again." |

## Auth — `/api/auth`

| Endpoint | Notes |
| --- | --- |
| `POST /signup {email, password}` | `{"status":"check_email"}`; the same answer for an existing address, so accounts can't be probed |
| `POST /signin {email, password}` | sets the cookies, returns `{user:{id,email}}` |
| `POST /signout` | 204 |
| `POST /recover {email}` | `{"status":"check_email"}` |
| `POST /password {password}` | signed in, at least 8 characters, 204 |
| `GET /callback?code&next` | the link in emails; redirects to `next`, or `/signin?confirmed=1`, `?error=link_invalid`, `?error=link_expired` |

`GET /api/me` returns `{id, email, plan}`; 401 means signed out.

## Bots — `/api/bots`

`GET` list, `POST {name}`, `GET /<bot>`, `PATCH /<bot>`, `DELETE /<bot>`.

Patch takes any of `name`, `allowedDomains`, `color`, `position`, `greeting`,
`suggestedQuestions`, `showBadge`. Domains are normalized to hostnames. Hiding the badge
needs Pro, and a second bot on Free returns 402.

`POST /<bot>/avatar` takes a multipart `file` (PNG, JPEG or WebP, up to 1 MB, checked by
its bytes) and returns the bot with a new `avatarUrl`; `DELETE /<bot>/avatar` clears it.

## Knowledge — `/api/bots/<bot>/sources`

`GET` list, `POST /file` (multipart `file`, optional `title`), `POST /text {title, text}`,
`DELETE /<source>`.

A source is `{id, type, title, contentType, sizeBytes, pages, chunks, status, error,
createdAt, processedAt}`. Processing runs in the background, so poll the list while
anything is `queued` or `processing`. A failed source carries a readable `error`.

## Chat — `/api/bots/<bot>`

`POST /chat {message, conversationId?}` answers with server-sent events:

| Event | Data |
| --- | --- |
| `conversation` | `{id}` — send it back for follow-ups |
| `text` | `{text}` — append each piece |
| `done` | `{message}` — the saved message |
| `error` | `{error}` |

Refusals before the stream starts are plain JSON errors. Use `fetch` and read the body:
`EventSource` can't POST. A message is `{id, role, content, citations:[{n, sourceId,
sourceTitle, score}], answered, createdAt}`; `[n]` markers in the text match `citations`,
and `answered: false` means the bot said it doesn't know. The last 10 messages are sent to
the model as memory. Playground chats don't count against the monthly limit.

`GET /conversations`, `GET /conversations/<id>`, `DELETE /conversations/<id>`.

## Inbox and leads — `/api/bots/<bot>`

| Endpoint | Notes |
| --- | --- |
| `GET /inbox?status=open\|done` | `{items, historyDays}`; 7 on Free means older items are hidden, 0 means forever |
| `GET /inbox/<item>` | `{item, messages}`, the conversation it came from (`null` if deleted) |
| `POST /inbox/<item>/answer {answer}` | 201 `{item, source}`: the answer becomes a knowledge source and the item is done; 402 if the source limit is reached, and the item stays open |
| `PATCH /inbox/<item> {status}` | dismiss or reopen |
| `GET /leads` | `{leads, historyDays, canExport}`; a lead is `{conversationId, email, question, missed, createdAt, lastMessageAt}` |
| `GET /leads.csv` | Business only, otherwise 402 |

## Overview — `GET /api/bots/<bot>/stats?days=7&tz=Europe/Berlin`

`days` is 1–90 (default 7) and `tz` any IANA name (unknown falls back to UTC). Returns
`current` and `previous` totals (`questions`, `answered`, `missed`, `answeredRate` or null,
`conversations`, `leads`), `daily` with one entry per day, `topQuestions`, `openQuestions`
and `needsYou`. Widget conversations only.

## Widget — `/api/widget/<publicKey>` (public)

| Endpoint | Notes |
| --- | --- |
| `GET /config?host=` | `{name, color, avatarUrl, position, greeting, suggestedQuestions, showBadge}`; also records "last seen on" |
| `POST /chat {message, conversationId?, visitorId, host}` | same events as the playground |
| `GET /conversations/<id>?visitorId=&host=` | restore after a reload |
| `POST /lead {conversationId, visitorId, email, host}` | 204 |

`host` is the customer's site, taken from `document.referrer` inside the iframe. Empty
`allowedDomains` means anywhere, a domain also covers its subdomains, and the app's own host
is always allowed for previews; anything else is 403. `visitorId` is 8–64 characters of
`A-Za-z0-9_-`, kept in the iframe's storage; visitors only see their own conversations.
Limits are 10 messages a minute per IP and bot, 60 a minute per bot, and 60 other calls a
minute per IP.

## Billing — `/api/billing`

| Endpoint | Notes |
| --- | --- |
| `GET /` | `{plan, planName, limits, usage:{messages,bots,sources}, periodEnd, hasSubscription}` |
| `POST /checkout {plan}` | `{url}` to open; `plan` is `pro` or `business` |
| `POST /confirm {sessionId}` | applies the plan on return, without waiting for the webhook |
| `POST /portal` | `{url}` for card, plan change, cancel and invoices; 400 without a subscription |
| `POST /webhook` | Stripe only, signature verified, outside the Origin check |

Subscription events keep the plan in sync, and a cancelled or inactive subscription drops
the account to Free. Limits apply when creating things, so a downgrade leaves existing bots
and sources in place and only refuses new ones.

## Health

`GET /healthz` returns `{"status":"ok","db":"up"}`, or 503 when the database is
unreachable. It needs no auth and is what the uptime monitor pings.
