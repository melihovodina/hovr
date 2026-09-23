"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "cn";
import { MAX_GREETING, MAX_NAME, MAX_QUESTION, MAX_QUESTIONS } from "@/lib/bots";
import { fieldClass, Group } from "./controls";
import type { Draft } from "./widget-screen";

export function MessagesTab({ draft, onChange }: { draft: Draft; onChange: (d: Partial<Draft>) => void }) {
  const [question, setQuestion] = useState("");
  const full = draft.suggestedQuestions.length >= MAX_QUESTIONS;
  const canAdd = question.trim() !== "" && !full;

  function add() {
    if (!canAdd) return;
    onChange({ suggestedQuestions: [...draft.suggestedQuestions, question.trim()] });
    setQuestion("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    add();
  }

  return (
    <>
      <Group label="Name" htmlFor="widget-name">
        <input
          id="widget-name"
          maxLength={MAX_NAME}
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn(fieldClass, "h-11")}
        />
      </Group>

      <Group label="Hello message" htmlFor="widget-greeting">
        <textarea
          id="widget-greeting"
          rows={3}
          maxLength={MAX_GREETING}
          value={draft.greeting}
          onChange={(e) => onChange({ greeting: e.target.value })}
          className={cn(fieldClass, "resize-none py-3 leading-normal")}
        />
      </Group>

      <Group label="Suggested questions" htmlFor="widget-question">
        {draft.suggestedQuestions.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {draft.suggestedQuestions.map((q, i) => (
              <li key={`${q}-${i}`} className="flex min-h-10 items-center gap-1 rounded-[14px] bg-app py-1.5 pr-1.5 pl-3.5 text-sm font-semibold">
                <span className="min-w-0 grow wrap-break-word">{q}</span>
                <button
                  type="button"
                  aria-label={`Remove “${q}”`}
                  onClick={() => onChange({ suggestedQuestions: draft.suggestedQuestions.filter((_, n) => n !== i) })}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-3.5" strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex h-11 items-center gap-1 rounded-full bg-app pr-1 pl-4 focus-within:shadow-[0_0_0_2px_var(--ink)]">
          <input
            id="widget-question"
            value={question}
            maxLength={MAX_QUESTION}
            disabled={full}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={full ? "That’s the most you can add" : "Add a question"}
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
      </Group>
    </>
  );
}
