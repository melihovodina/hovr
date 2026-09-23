import { afterEach, describe, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { addText, checkFile, deleteSource, formatSize, isPending, MAX_FILE_SIZE, sourceKind, uploadFile } from "@/lib/sources";
import type { Source } from "@/lib/types";

afterEach(() => vi.unstubAllGlobals());

function fileOf(name: string, size: number): File {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("checkFile, same rules as the server", () => {
  test.each(["FAQ.pdf", "Guide.DOCX", "readme.md", "notes.markdown", "policy.txt"])("accepts %s", (name) => {
    expect(checkFile(fileOf(name, 100))).toBeNull();
  });

  test.each(["photo.png", "old.doc", "setup.exe", "noextension"])("refuses %s by type", (name) => {
    expect(checkFile(fileOf(name, 100))).toBe("Only PDF, Word (.docx), Markdown or text files.");
  });

  test("refuses files over 10 MB, accepts exactly 10 MB", () => {
    expect(checkFile(fileOf("big.pdf", MAX_FILE_SIZE))).toBeNull();
    expect(checkFile(fileOf("big.pdf", MAX_FILE_SIZE + 1))).toBe("Files can be up to 10 MB.");
  });
});

test("formatSize", () => {
  expect(formatSize(148)).toBe("148 B");
  expect(formatSize(26 * 1024)).toBe("26 KB");
  expect(formatSize(2.1 * 1024 * 1024)).toBe("2.1 MB");
});

test("sourceKind names each kind the way people call it", () => {
  const s = (type: Source["type"], contentType: string) => ({ type, contentType }) as Source;
  expect(sourceKind(s("inbox", "text/plain"))).toBe("From inbox");
  expect(sourceKind(s("text", "text/plain"))).toBe("Text");
  expect(sourceKind(s("file", "application/pdf"))).toBe("PDF");
  expect(sourceKind(s("file", "text/markdown"))).toBe("Markdown");
  expect(sourceKind(s("file", "text/plain"))).toBe("Text file");
  expect(sourceKind(s("file", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe("Word");
});

test("isPending is true while a source is being read", () => {
  expect(isPending("queued")).toBe(true);
  expect(isPending("processing")).toBe(true);
  expect(isPending("ready")).toBe(false);
  expect(isPending("failed")).toBe(false);
});

describe("requests", () => {
  test("uploadFile posts the file as multipart to the bot's sources", async () => {
    const fetch = mockFetch(json(201, { id: "s1" }));
    const file = new File(["# FAQ"], "faq.md");
    await uploadFile("b1", file);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/bots/b1/sources/file");
    expect(init?.method).toBe("POST");
    expect((init?.body as FormData).get("file")).toBe(file);
  });

  test("addText posts the title and text", async () => {
    const fetch = mockFetch(json(201, { id: "s2" }));
    await addText("b1", "Opening hours", "Mon to Fri");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/bots/b1/sources/text");
    expect(JSON.parse(init?.body as string)).toEqual({ title: "Opening hours", text: "Mon to Fri" });
  });

  test("deleteSource sends DELETE", async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }));
    await deleteSource("b1", "s1");
    expect(fetch.mock.calls[0][0]).toBe("/api/bots/b1/sources/s1");
    expect(fetch.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
