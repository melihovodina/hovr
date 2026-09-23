# Development

## Commands

Run from the repository root; each `make` target runs the matching script in `client/`.

| Command | What it does |
| --- | --- |
| `make client-install` | `pnpm install` |
| `make client` | `next dev` on :3000, `/api` proxied to the Go server on :8080 |
| `make client-build` | static export into `client/out`, which the Go server serves |
| `make client-lint` | ESLint, `next typegen` (route types) and `tsc --noEmit` |
| `make client-test` | Vitest, once |

`make client-lint` runs `next typegen` first because the route types it generates
(`LayoutProps` and others) aren't committed. A fresh checkout, such as CI, has no `.next`
folder until a build or typegen creates it.

The build needs `NEXT_PUBLIC_SITE_URL`, the public address used for canonical links, Open
Graph and the embed code shown on the landing. It falls back to `http://localhost:3000`.

CI runs the `client` job on Node 22 with pnpm from `packageManager` (through `corepack`):
install, lint, then tests.

## Static export rules

The export has no server at request time, so:

- Anything that reads the address (`useSearchParams`) renders in the browser, inside a
  `<Suspense>` boundary. The app layout and the widget page do this.
- There are no API routes or middleware in the client; everything dynamic goes to the Go API.
- Generated files like the Open Graph image use `dynamic = "force-static"` and are written
  at build time.
- Remote images, such as bot logos, use plain `<img>` since the image optimizer isn't
  available.

## Tests

Vitest with jsdom and Testing Library. Tests live in `client/test/` and mirror the source
folders: `test/lib` for the helpers, `test/components/<feature>` for screens, and
`test/public` for the widget loader.

Helpers:

| File | What it gives |
| --- | --- |
| `test/http.ts` | `json(status, body)` and `sse(pieces)` responses, and `mockFetch(...)`, which answers in order and throws anything that isn't a `Response` |
| `test/navigation.ts` | a stand-in for `next/navigation`: set `nav.search` / `nav.pathname`, check `nav.router` calls |
| `test/fixtures.ts` | `bot()`, `source()`, `billing()` and `appState()` with sensible defaults; override only what a test is about |
| `test/setup.ts` | cleans the document after each test and adds `scrollIntoView`, which jsdom lacks |

A screen test renders the component with the navigation mock and a mocked `fetch`, then
works through the page like a person: find by role and label, click with `userEvent`, and
check what's on screen and what was sent.

```tsx
vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

test("a session whose account is gone goes to sign in too", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json(404, { error: "Account not found." })));
  render(
    <AppShell>
      <p>Screen</p>
    </AppShell>,
  );
  await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/signin"));
  expect(screen.queryByRole("alert")).toBeNull();
});
```

What's covered:

- **API layer:** error mapping, request bodies, and SSE reading across chunk borders.
- **Each screen:** its loading, empty and error states, and its main actions.
- **Plan limits:** the 402 "See plans" path.
- **The widget:** config refusal, suggested questions, restoring a chat, the email form's
  place, and messages visitors see when something fails.
- **The loader:** `widget.js` runs in jsdom, and its tests check the iframe's size and
  corner for each message, full screen on phones, and that messages from anywhere but its
  own iframe are ignored.

## Conventions

- Screens load their own data with an `AbortController` and ignore results for a bot or
  period that is no longer shown. Loading shows a skeleton of the final layout, and errors
  show a "Try again" button.
- Text the server sends (`err.message`) is shown as it is. Visitors never see owner-facing
  messages.
- User-facing copy is plain and short, uses curly quotes (`’`, `“ ”`), and doesn't
  mention implementation details.
- One component per screen folder does the layout; smaller parts sit next to it. Logic
  that can be tested without rendering, like `planAction`, `changes`, `todos` or
  `replyLink`, is exported as a plain function and tested directly.
