"use client";

import { ArrowUp, FileText, MessageSquare } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AnswerText } from "@/components/playground/parts";
import { PANEL, PoweredBy, WidgetFirstScreen, WidgetHeader } from "@/components/widget-panel";
import { ApiError } from "@/lib/api";
import { streamChat } from "@/lib/chat";
import { onColor } from "@/lib/format";
import type { Message, WidgetConfig } from "@/lib/types";
import { chatPath, getConfig, recall, remember, restoreConversation, visitorId, type WidgetEvent } from "@/lib/widget";
import { LeadForm } from "./lead-form";

function tell(event: WidgetEvent) {
  if (window.parent !== window) window.parent.postMessage(event, "*");
}

// The customer's page: the iframe's referrer. Opened directly (an app preview), our own address.
function pageHost(): string {
  return document.referrer || window.location.href;
}

// What a visitor should read when the answer couldn't come; owner-facing reasons stay out.
function visitorError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return err.message;
    if (err.status === 402) return "This chat can’t take new questions right now. Please try again later.";
    if (err.status === 400) return err.message;
  }
  return "The bot couldn’t answer right now. Try again in a moment.";
}

// The chat inside the iframe that widget.js puts on the customer's page.
export function ChatWidget() {
  const key = useSearchParams().get("key") ?? "";
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const convKey = `hovr:conv:${key}`;

  // Config first, so the launcher appears already in the bot's colours; a refusal keeps it hidden.
  useEffect(() => {
    const ctrl = new AbortController();
    getConfig(key, pageHost(), ctrl.signal)
      .then((c) => {
        setConfig(c);
        tell({ type: "hovr:ready", position: c.position });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) tell({ type: "hovr:hide" });
      });
    return () => ctrl.abort();
  }, [key]);

  // Back to the visitor's conversation after a reload or on the next page.
  useEffect(() => {
    if (!config) return;
    const saved = recall(convKey);
    if (!saved) return;
    restoreConversation(key, saved, visitorId(), pageHost())
      .then((list) => {
        setConversation(saved);
        setMessages(list);
      })
      .catch(() => remember(convKey, null));
  }, [config, convKey, key]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming, open]);

  const show = useCallback((next: boolean) => {
    setOpen(next);
    tell({ type: next ? "hovr:open" : "hovr:close" });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && show(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming !== null) return;
    setDraft("");
    setError("");
    setMessages((list) => [...list, { id: -Date.now(), role: "user", content: message, citations: [], answered: null, createdAt: new Date().toISOString() }]);
    setStreaming("");
    try {
      const saved = await streamChat(
        chatPath(key),
        { message, conversationId: conversation ?? undefined, visitorId: visitorId(), host: pageHost() },
        {
          onConversation: (id) => {
            setConversation(id);
            remember(convKey, id);
          },
          onText: (t) => setStreaming((s) => (s ?? "") + t),
        },
      );
      setMessages((list) => [...list, saved]);
    } catch (err) {
      setError(visitorError(err));
    } finally {
      setStreaming(null);
    }
  }

  if (!config) return null;
  const onAccent = onColor(config.color);
  const avatar = config.name.charAt(0).toUpperCase();
  const side = config.position === "left" ? "justify-start" : "justify-end";

  if (!open) {
    return (
      // The padding leaves room for the shadow inside the iframe (widget.js sizes it to 92px).
      <div className={`flex h-dvh items-end p-4 ${side}`}>
        <button
          type="button"
          onClick={() => show(true)}
          aria-label={`Open chat with ${config.name}`}
          className="flex size-15 items-center justify-center rounded-full shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] transition-transform hover:scale-105"
          style={{ background: config.color, color: onAccent }}
        >
          <MessageSquare className="size-6.5" strokeWidth={2} />
        </button>
      </div>
    );
  }

  // Offer to leave an email once the bot has said it doesn't know something.
  const missed = messages.some((m) => m.role === "assistant" && m.answered === false);

  return (
    <div className="h-dvh p-2">
      <div className={PANEL} role="dialog" aria-label={`Chat with ${config.name}`}>
        <WidgetHeader name={config.name} avatar={avatar} avatarUrl={config.avatarUrl} color={config.color} onClose={() => show(false)} />

        {messages.length === 0 && streaming === null ? (
          <WidgetFirstScreen greeting={config.greeting} suggestions={config.suggestedQuestions} onPick={send} />
        ) : (
          <div className="flex min-h-0 grow flex-col gap-2.5 overflow-y-auto px-3.5 pt-1 pb-3" aria-live="polite">
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="max-w-[78%] self-end rounded-[20px_20px_6px_20px] px-3.5 py-2.5 text-sm leading-[1.45] font-medium whitespace-pre-wrap"
                  style={{ background: config.color, color: onAccent }}
                >
                  {m.content}
                </div>
              ) : (
                <div key={m.id} className="flex max-w-[88%] flex-col gap-1.5 self-start">
                  <div className="rounded-[20px_20px_20px_6px] bg-(--w-soft) px-3.5 py-2.5 text-sm leading-normal whitespace-pre-wrap">
                    <AnswerText text={m.content} />
                  </div>
                  <Sources message={m} />
                </div>
              ),
            )}
            {streaming !== null && (
              <div className="max-w-[88%] self-start rounded-[20px_20px_20px_6px] bg-(--w-soft) px-3.5 py-2.5 text-sm leading-normal whitespace-pre-wrap">
                {streaming ? <AnswerText text={streaming} /> : <span className="animate-pulse text-(--w-muted)">Thinking…</span>}
              </div>
            )}
            {missed && streaming === null && conversation && (
              <LeadForm widgetKey={key} conversationId={conversation} host={pageHost()} color={config.color} />
            )}
            {error && <p className="self-center px-2 text-center text-xs font-semibold text-(--w-muted)">{error}</p>}
            <div ref={bottom} />
          </div>
        )}

        <div className="flex shrink-0 flex-col gap-2 px-3 pb-2.5">
          <Composer value={draft} onChange={setDraft} onSend={() => send(draft)} disabled={streaming !== null} color={config.color} />
          {config.showBadge && <PoweredBy href={window.location.origin} />}
        </div>
      </div>
    </div>
  );
}

function Sources({ message }: { message: Message }) {
  const titles = [...new Set(message.citations.map((c) => c.sourceTitle))];
  if (titles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {titles.map((t) => (
        <span key={t} className="flex h-7 max-w-full items-center gap-1.5 rounded-full border border-(--w-border) pr-2.5 pl-1.5 text-xs font-bold">
          <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-(--w-soft)">
            <FileText className="size-2.75" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="truncate">{t}</span>
        </span>
      ))}
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  disabled,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  color: string;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!disabled && value.trim()) onSend();
  }
  return (
    <form
      onSubmit={submit}
      className="flex h-13 items-center gap-1.5 rounded-full border border-(--w-border) bg-(--w-bg) pr-1.5 pl-4.5 shadow-[0_4px_14px_rgba(10,12,16,0.06)] focus-within:border-(--w-ink)"
    >
      <label htmlFor="hovr-q" className="sr-only">
        Your question
      </label>
      <input
        id="hovr-q"
        autoComplete="off"
        maxLength={2000}
        placeholder="Type your question…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 grow bg-transparent text-[15px] text-(--w-ink) outline-none placeholder:text-(--w-muted)"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || !value.trim()}
        className="flex size-10 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
        style={{ background: color, color: onColor(color) }}
      >
        <ArrowUp className="size-4.5" strokeWidth={2.4} />
      </button>
    </form>
  );
}
