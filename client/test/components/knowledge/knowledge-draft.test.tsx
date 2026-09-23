import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { draftProblem, draftSize, EMPTY_DRAFT, KnowledgeDraft, saveDraft, type Draft } from "@/components/knowledge/knowledge-draft";

afterEach(() => vi.unstubAllGlobals());

const md = () => new File(["# FAQ"], "faq.md");
const png = () => new File(["x"], "logo.png");

describe("draft rules", () => {
  test("draftSize counts files and the pasted text", () => {
    expect(draftSize(EMPTY_DRAFT)).toBe(0);
    expect(draftSize({ files: [md(), md()], text: { title: "", body: "" } })).toBe(3);
  });

  test("draftProblem blocks files the server would refuse and half-filled text", () => {
    expect(draftProblem({ files: [md()], text: null })).toBeNull();
    expect(draftProblem({ files: [md(), png()], text: null })).toBe("Remove the files that can’t be added.");
    expect(draftProblem({ files: [], text: { title: "Hours", body: "  " } })).toMatch(/title and some content/);
    expect(draftProblem({ files: [], text: { title: "Hours", body: "Mon to Fri" } })).toBeNull();
  });
});

test("saveDraft sends every item and returns only the ones that failed", async () => {
  const fetch = mockFetch(
    json(201, { id: "s1" }),
    json(402, { error: "Your Free plan includes 10 knowledge sources.", code: "upgrade_required" }),
    json(201, { id: "s3" }),
  );
  const draft: Draft = { files: [md(), new File(["b"], "second.md")], text: { title: " Hours ", body: " Mon to Fri " } };

  const failures = await saveDraft("b1", draft);

  expect(fetch).toHaveBeenCalledTimes(3);
  expect(failures).toEqual([{ name: "second.md", error: "Your Free plan includes 10 knowledge sources." }]);
  // The pasted text is sent trimmed.
  expect(JSON.parse(fetch.mock.calls[2][1]?.body as string)).toEqual({ title: "Hours", text: "Mon to Fri" });
});

function Harness({ initial = EMPTY_DRAFT }: { initial?: Draft }) {
  const [draft, setDraft] = useState(initial);
  return <KnowledgeDraft value={draft} onChange={setDraft} />;
}

describe("KnowledgeDraft", () => {
  test("lists picked files with their size, or why they can't be added", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Harness />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    await user.upload(input, [md(), png()]);

    expect(screen.getByText("faq.md")).toBeTruthy();
    expect(screen.getByText("5 B")).toBeTruthy();
    expect(screen.getByText("logo.png")).toBeTruthy();
    expect(screen.getByText("Only PDF, Word (.docx), Markdown or text files.")).toBeTruthy();
  });

  test("the same file picked twice is listed once, and files can be removed", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = md();

    await user.upload(input, file);
    await user.upload(input, file);
    expect(screen.getAllByText("faq.md")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Remove faq.md" }));
    expect(screen.queryByText("faq.md")).toBeNull();
  });

  test("paste text opens a title and text box, and Remove closes it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /Paste some text/ }));
    const title = screen.getByPlaceholderText("Title, e.g. Opening hours");
    await user.type(title, "Opening hours");
    expect((title as HTMLInputElement).value).toBe("Opening hours");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByPlaceholderText("Title, e.g. Opening hours")).toBeNull();
    expect(screen.getByRole("button", { name: /Paste some text/ })).toBeTruthy();
  });
});
