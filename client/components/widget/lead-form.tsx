"use client";

import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import { onColor } from "@/lib/format";
import { leaveEmail, recall, remember, visitorId } from "@/lib/widget";

// Shown after the bot couldn't answer: the visitor can leave an email for the team. Sent once per conversation.
export function LeadForm({ widgetKey, conversationId, host, color }: { widgetKey: string; conversationId: string; host: string; color: string }) {
  const doneKey = `hovr:lead:${conversationId}`;
  const [sent, setSent] = useState(() => recall(doneKey) !== null);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await leaveEmail(widgetKey, { conversationId, visitorId: visitorId(), email: email.trim(), host });
      remember(doneKey, "1");
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
    setPending(false);
  }

  if (sent) {
    return <p className="self-center px-2 text-center text-xs font-semibold text-(--w-muted)">Thanks! The team will get back to you by email.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-[18px] border border-(--w-border) p-3">
      <label htmlFor="hovr-email" className="text-[13px] leading-snug font-semibold">
        Want a person to answer? Leave your email and the team will get back to you.
      </label>
      <div className="flex gap-1.5">
        <input
          id="hovr-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9.5 min-w-0 grow rounded-full bg-(--w-soft) px-3.5 text-sm text-(--w-ink) outline-none placeholder:text-(--w-muted) focus-visible:shadow-[0_0_0_2px_var(--w-ink)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9.5 shrink-0 rounded-full px-3.5 text-[13px] font-extrabold transition-opacity disabled:opacity-50"
          style={{ background: color, color: onColor(color) }}
        >
          {pending ? "Sending…" : "Send email"}
        </button>
      </div>
      {error && <span className="text-xs text-(--w-muted)">{error}</span>}
    </form>
  );
}
