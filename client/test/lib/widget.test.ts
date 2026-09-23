import { afterEach, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { getConfig, leaveEmail, recall, remember, restoreConversation, visitorId } from "@/lib/widget";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  // remember() also keeps a copy in memory for the page's lifetime.
  for (const key of ["hovr:visitor", "hovr:conv:pub_k", "hovr:conv:k", "hovr:lead:c1"]) remember(key, null);
});

test("the visitor id is made once and then kept", () => {
  const first = visitorId();
  expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/); // what the server accepts
  expect(visitorId()).toBe(first);
});

test("remember and recall fall back to memory when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  remember("hovr:conv:k", "c1");
  expect(recall("hovr:conv:k")).toBe("c1");
  remember("hovr:conv:k", null);
  expect(recall("hovr:conv:k")).toBeNull();
});

test("requests carry the customer's page as host", async () => {
  const fetch = mockFetch(json(200, {}), json(200, { messages: [] }), new Response(null, { status: 204 }));
  await getConfig("pub_k", "https://shop.example.com/pricing?x=1");
  await restoreConversation("pub_k", "c1", "v-12345678", "https://shop.example.com/");
  await leaveEmail("pub_k", { conversationId: "c1", visitorId: "v-12345678", email: "a@example.com", host: "https://shop.example.com/" });

  expect(fetch.mock.calls[0][0]).toBe("/api/widget/pub_k/config?host=https%3A%2F%2Fshop.example.com%2Fpricing%3Fx%3D1");
  expect(fetch.mock.calls[1][0]).toBe("/api/widget/pub_k/conversations/c1?visitorId=v-12345678&host=https%3A%2F%2Fshop.example.com%2F");
  expect(fetch.mock.calls[2][0]).toBe("/api/widget/pub_k/lead");
  expect(JSON.parse(fetch.mock.calls[2][1]?.body as string)).toEqual({
    conversationId: "c1",
    visitorId: "v-12345678",
    email: "a@example.com",
    host: "https://shop.example.com/",
  });
});
