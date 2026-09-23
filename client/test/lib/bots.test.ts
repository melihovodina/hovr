import { afterEach, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { checkAvatar, embedCode, MAX_AVATAR_SIZE, removeAvatar, updateBot, uploadAvatar } from "@/lib/bots";

afterEach(() => vi.unstubAllGlobals());

function image(type: string, size = 1000): File {
  const f = new File(["x"], "logo", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

test("checkAvatar takes PNG, JPG and WebP up to 1 MB, like the server", () => {
  expect(checkAvatar(image("image/png"))).toBeNull();
  expect(checkAvatar(image("image/jpeg"))).toBeNull();
  expect(checkAvatar(image("image/webp", MAX_AVATAR_SIZE))).toBeNull();
  expect(checkAvatar(image("image/svg+xml"))).toBe("Use a PNG, JPG or WebP image up to 1 MB.");
  expect(checkAvatar(image("image/png", MAX_AVATAR_SIZE + 1))).toBe("Use a PNG, JPG or WebP image up to 1 MB.");
});

test("embedCode is the one line owners paste", () => {
  expect(embedCode("https://hovr.app", "pub_abc")).toBe('<script src="https://hovr.app/widget.js" data-bot="pub_abc" defer></script>');
});

test("updateBot sends only the given fields", async () => {
  const fetch = mockFetch(json(200, { id: "b1" }));
  await updateBot("b1", { color: "#2F6B4F", position: "left" });
  expect(fetch.mock.calls[0][0]).toBe("/api/bots/b1");
  expect(fetch.mock.calls[0][1]?.method).toBe("PATCH");
  expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ color: "#2F6B4F", position: "left" });
});

test("the logo is uploaded as multipart and removed with DELETE", async () => {
  const fetch = mockFetch(json(200, { id: "b1" }), json(200, { id: "b1" }));
  const file = image("image/png");
  await uploadAvatar("b1", file);
  await removeAvatar("b1");
  expect(fetch.mock.calls[0][0]).toBe("/api/bots/b1/avatar");
  expect((fetch.mock.calls[0][1]?.body as FormData).get("file")).toBe(file);
  expect(fetch.mock.calls[1][1]?.method).toBe("DELETE");
});
