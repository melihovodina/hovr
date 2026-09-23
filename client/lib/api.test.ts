import { afterEach, describe, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { api, ApiError, errorMessage } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  test("sends JSON to /api on the same origin and returns the body", async () => {
    const fetch = mockFetch(json(200, { id: "b1" }));
    const out = await api<{ id: string }>("/bots", { method: "POST", body: { name: "Northwind" } });

    expect(out).toEqual({ id: "b1" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/bots");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(init?.body).toBe('{"name":"Northwind"}');
  });

  test("sends FormData as is, so the browser sets the multipart boundary", async () => {
    const fetch = mockFetch(json(201, {}));
    const form = new FormData();
    form.append("file", new File(["x"], "faq.md"));
    await api("/bots/b1/sources/file", { method: "POST", body: form });

    const init = fetch.mock.calls[0][1];
    expect(init?.body).toBe(form);
    expect(init?.headers).toBeUndefined();
  });

  test("a 204 answer resolves to undefined", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(api("/auth/signout", { method: "POST" })).resolves.toBeUndefined();
  });

  test("errors carry the server's message and code", async () => {
    mockFetch(json(402, { error: "Your Free plan includes 1 bot.", code: "upgrade_required" }));
    const err = await api("/bots", { method: "POST", body: {} }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(402);
    expect(err.message).toBe("Your Free plan includes 1 bot.");
    expect(err.upgradeRequired).toBe(true);
  });

  test("an error without a JSON body gets a generic message", async () => {
    mockFetch(new Response("Bad Gateway", { status: 502 }));
    const err = await api("/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Something went wrong. Try again.");
    expect(err.upgradeRequired).toBe(false);
  });

  test("a network failure is an ApiError with status 0", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    const err = await api("/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Can’t reach hovr/);
  });

  test("an aborted request stays an AbortError, so callers can ignore it", async () => {
    mockFetch(new DOMException("aborted", "AbortError"));
    const err = await api("/me").catch((e) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect(err.name).toBe("AbortError");
  });
});

test("errorMessage shows API messages and hides anything else", () => {
  expect(errorMessage(new ApiError(400, "Enter a valid email address."))).toBe("Enter a valid email address.");
  expect(errorMessage(new Error("secret stack detail"))).toBe("Something went wrong. Try again.");
});
