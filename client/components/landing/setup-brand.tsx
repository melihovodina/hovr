"use client";

import { MessageSquare, Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "cn";
import { onColor } from "@/lib/format";

const COLORS = [
  { hex: "#2F6B4F", name: "Forest" },
  { hex: "#1F4FD1", name: "Blue" },
  { hex: "#B4441F", name: "Rust" },
  { hex: "#7A3FC4", name: "Violet" },
];
// Short limits keep the demo preview readable; the app itself allows longer text.
const MAX_GREETING = 40;
const MAX_QUESTIONS = 5;
const MAX_QUESTION = 20;

const label = "text-sm font-bold text-subtle";

// A small working copy of the widget editor: every change shows up in the preview.
export function SetupBrand() {
  const [color, setColor] = useState(COLORS[0].hex);
  const [greeting, setGreeting] = useState("Hey there, how can I help?");
  const [questions, setQuestions] = useState(["Do you ship to US?", "Pause my plan"]);
  const [draft, setDraft] = useState("");

  const canAdd = draft.trim() !== "" && questions.length < MAX_QUESTIONS;

  function add() {
    if (!canAdd) return;
    setQuestions([...questions, draft.trim()]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    add();
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-6">
      <div className="flex w-full min-w-0 flex-col gap-3 md:w-[344px] md:shrink-0">
        <span className={label} id="brand-color">
          Color
        </span>
        <div className="flex gap-2.5" role="radiogroup" aria-labelledby="brand-color">
          {COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={color === c.hex}
              aria-label={c.name}
              onClick={() => setColor(c.hex)}
              className={cn(
                "size-11 rounded-full ring-1 ring-black/10 transition-shadow ring-inset dark:ring-white/20",
                color === c.hex && "shadow-[0_0_0_3px_var(--page),0_0_0_5px_var(--ink)]",
              )}
              style={{ background: c.hex }}
            />
          ))}
        </div>

        <label className={label} htmlFor="brand-greeting">
          Hello message
        </label>
        <textarea
          id="brand-greeting"
          rows={2}
          maxLength={MAX_GREETING}
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          className="resize-none rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] leading-normal text-ink outline-none focus-visible:border-ink"
        />

        <label className={label} htmlFor="brand-question">
          Suggested questions
        </label>
        {questions.length > 0 && (
          // Two per row; a lone last one is centred across both columns.
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {questions.map((q, i) => (
              <li
                key={`${q}-${i}`}
                className={cn(
                  "flex min-h-7 min-w-0 items-center gap-0.5 rounded-[14px] border border-line bg-surface py-1 pr-1 pl-2.5 text-xs font-bold",
                  i === questions.length - 1 && questions.length % 2 === 1 && "sm:col-span-2 sm:w-fit sm:justify-self-center",
                )}
              >
                <span className="min-w-0 grow break-words">{q}</span>
                <button
                  type="button"
                  aria-label={`Remove “${q}”`}
                  onClick={() => setQuestions(questions.filter((_, n) => n !== i))}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-subtle hover:text-ink"
                >
                  <X className="size-3" strokeWidth={2.6} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex h-11 items-center gap-1 rounded-full border border-line bg-surface pr-1 pl-4 focus-within:border-ink">
          <input
            id="brand-question"
            value={draft}
            maxLength={MAX_QUESTION}
            disabled={questions.length >= MAX_QUESTIONS}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={questions.length >= MAX_QUESTIONS ? "That’s the most you can add" : "Add a question"}
            className="min-w-0 grow bg-transparent text-sm text-ink outline-none placeholder:text-subtle disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={add}
            aria-label="Add question"
            disabled={!canAdd}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-page transition-opacity disabled:opacity-30"
          >
            <Plus className="size-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 grow flex-col items-end gap-3" aria-label="Preview" role="img">
        <div className="flex w-[270px] max-w-full flex-col gap-2.5 rounded-[22px_22px_6px_22px] bg-white p-4 text-[#17171B] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.3)]">
          <span className="text-sm leading-normal break-words">{greeting}</span>
          {questions.map((q, i) => (
            <span key={`${q}-${i}`} className="flex min-h-[30px] items-center self-start rounded-full bg-[#F3F3F1] px-3 py-1 text-xs font-bold break-words">
              {q}
            </span>
          ))}
        </div>
        <span
          className="flex size-[60px] items-center justify-center rounded-full shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] transition-colors"
          style={{ background: color, color: onColor(color) }}
        >
          <MessageSquare className="size-[26px]" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}
