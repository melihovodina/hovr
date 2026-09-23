import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Citation, Message } from "@/lib/types";
import { AnswerText, Composer, SourceChips, WhyItSaidThat } from "@/components/playground/parts";

const cite = (n: number, sourceTitle: string, score: number): Citation => ({ n, sourceId: `s${n}`, sourceTitle, score, excerpt: `Passage ${n}` });

const answer = (over: Partial<Message>): Message => ({
  id: 1,
  role: "assistant",
  content: "",
  citations: [],
  answered: true,
  createdAt: "2026-09-23T10:00:00Z",
  ...over,
});

test("AnswerText shows [n] markers as small numbers and keeps the rest", () => {
  const { container } = render(<AnswerText text="We ship to Canada [1]. And the UK [1, 2]." />);
  expect(container.textContent).toBe("We ship to Canada 1. And the UK 1,2.");
  expect([...container.querySelectorAll("sup")].map((s) => s.textContent)).toEqual(["1", "1,2"]);
});

test("SourceChips shows each source once, in the order cited", () => {
  render(<SourceChips citations={[cite(1, "Shipping.md", 0.7), cite(2, "FAQ.pdf", 0.6), cite(3, "Shipping.md", 0.65)]} />);
  expect(screen.getAllByText(/\.(md|pdf)$/).map((e) => e.textContent)).toEqual(["Shipping.md", "FAQ.pdf"]);
});

test("SourceChips renders nothing without citations", () => {
  const { container } = render(<SourceChips citations={[]} />);
  expect(container.innerHTML).toBe("");
});

describe("WhyItSaidThat", () => {
  test("asks to pick an answer when none is selected", () => {
    render(<WhyItSaidThat message={null} />);
    expect(screen.getByText(/pick an answer/)).toBeTruthy();
  });

  test("a strong match lists the passages, best first, with their match", () => {
    render(<WhyItSaidThat message={answer({ citations: [cite(1, "FAQ.pdf", 0.62), cite(2, "Shipping.md", 0.74)] })} />);
    expect(screen.getByText("Strong match, answered")).toBeTruthy();
    const titles = screen.getAllByText(/^\[\d\]/).map((e) => e.textContent);
    expect(titles).toEqual(["[2] Shipping.md", "[1] FAQ.pdf"]);
    expect(screen.getByText("74% match")).toBeTruthy();
    expect(screen.getByText("Passage 2")).toBeTruthy();
  });

  test("a weaker match is just answered", () => {
    render(<WhyItSaidThat message={answer({ citations: [cite(1, "FAQ.pdf", 0.64)] })} />);
    expect(screen.getByText("Answered")).toBeTruthy();
  });

  test("small talk needs no sources", () => {
    render(<WhyItSaidThat message={answer({ content: "Hi! How can I help?" })} />);
    expect(screen.getByText("No sources needed")).toBeTruthy();
  });

  test("an unanswered question explains it would go to the Inbox", () => {
    render(<WhyItSaidThat message={answer({ answered: false })} />);
    expect(screen.getByText("It didn’t know")).toBeTruthy();
    expect(screen.getByText(/land in your Inbox/)).toBeTruthy();
  });
});

describe("Composer", () => {
  function setup(value: string, disabled = false) {
    const onSubmit = vi.fn();
    render(<Composer value={value} onChange={() => {}} onSubmit={onSubmit} disabled={disabled} />);
    return { onSubmit, send: screen.getByRole("button", { name: "Send" }) as HTMLButtonElement };
  }

  test("sends on Enter", async () => {
    const { onSubmit } = setup("Do you ship to Canada?");
    await userEvent.type(screen.getByLabelText("Ask your bot"), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test("can't send an empty question", async () => {
    const { onSubmit, send } = setup("   ");
    expect(send.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Ask your bot"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("can't send while an answer is streaming", () => {
    const { send } = setup("Next question", true);
    expect(send.disabled).toBe(true);
  });
});
