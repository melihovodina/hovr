import { afterEach, expect, test, vi } from "vitest";
import { readLocal, writeLocal } from "@/lib/storage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test("writes, reads and removes", () => {
  writeLocal("k", "v");
  expect(readLocal("k")).toBe("v");
  writeLocal("k", null);
  expect(readLocal("k")).toBeNull();
});

test("blocked storage reads as empty and skips the write", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("full", "QuotaExceededError");
  });
  expect(() => writeLocal("k", "v")).not.toThrow();
  expect(readLocal("k")).toBeNull();
});
