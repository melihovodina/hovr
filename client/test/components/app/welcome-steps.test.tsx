import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { source } from "@/test/fixtures";
import { KnowledgeStep } from "@/components/app/welcome-steps";

function renderStep(sources = [source()]) {
  return render(<KnowledgeStep botId="b1" sources={sources} active onAdded={() => {}} />);
}

describe("KnowledgeStep", () => {
  test("asks for knowledge when there is none", () => {
    renderStep([]);
    expect(screen.getByText("Upload files or paste text so it has something to answer from.")).toBeTruthy();
    expect(screen.queryByLabelText("Done")).toBeNull();
  });

  test("shows reading progress, not counting failed files", () => {
    renderStep([
      source({ id: "a", status: "ready" }),
      source({ id: "b", status: "processing" }),
      source({ id: "c", status: "queued" }),
      source({ id: "d", status: "failed", title: "scan.pdf", error: "This PDF has no text inside. Is it a scanned image?" }),
    ]);
    expect(screen.getByText("Reading your files now. You can keep going while it works.")).toBeTruthy();
    expect(screen.getByText("1 of 3 ready")).toBeTruthy();
    expect(screen.getByText("scan.pdf")).toBeTruthy();
    expect(screen.getByText("This PDF has no text inside. Is it a scanned image?")).toBeTruthy();
  });

  test("is done once everything has been read", () => {
    renderStep([source({ id: "a" }), source({ id: "b" })]);
    expect(screen.getByText("It has read 2 sources. You can add more any time.")).toBeTruthy();
    expect(screen.getByLabelText("Done")).toBeTruthy();
  });

  test("says so when nothing could be read", () => {
    renderStep([source({ status: "failed", error: "We couldn't find any text in this file." })]);
    expect(screen.getByText("Nothing could be read yet. Check the reasons below and try another file.")).toBeTruthy();
    expect(screen.queryByLabelText("Done")).toBeNull();
  });

  test("“Paste some text” opens the form in place, and Cancel closes it", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("button", { name: "Paste some text" }));
    expect(screen.getByPlaceholderText("Title, e.g. Opening hours")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add to your bot" }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Title, e.g. Opening hours")).toBeNull();
  });
});
