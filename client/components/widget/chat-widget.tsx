"use client";

import { ArrowUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "cn";
import { Caret } from "@/components/chat-text";
import { PANEL, PoweredBy, WidgetFirstScreen, WidgetHeader, WidgetLauncher } from "@/components/widget-panel";
import { ApiError } from "@/lib/api";
import { streamChat } from "@/lib/chat";
import { botBubble, chatColors, chatPalette, visitorBubble } from "@/lib/chat-colors";
import { onColor } from "@/lib/format";
import type { Message, WidgetConfig } from "@/lib/types";
import { chatPath, getConfig, recall, remember, restoreConversation, visitorId, type WidgetEvent } from "@/lib/widget";
import { LeadForm } from "./lead-form";

const CLOSE_MS = 180;

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
  // The answer that just finished streaming replaces the streamed bubble without rising in again.
  const [settled, setSettled] = useState<number | null>(null);
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

  // The panel shrinks away first; only then does widget.js shrink the iframe back to the launcher.
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      show(false);
    }, CLOSE_MS);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

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
      setSettled(saved.id);
      setMessages((list) => [...list, saved]);
    } catch (err) {
      setError(visitorError(err));
    } finally {
      setStreaming(null);
    }
  }

  if (!config) return null;
  const avatar = config.name.charAt(0).toUpperCase();
  const side = config.position === "left" ? "justify-start" : "justify-end";
  const colors = chatColors(config);
  const visitor = visitorBubble(config.color, config.visitorMessageColor);
  const bot = botBubble(colors.botMessageColor);

  if (!open) {
    return (
      // The padding leaves room for the shadow inside the iframe (widget.js sizes it to 92px).
      <div className={`flex h-dvh items-end p-4 ${side}`}>
        <WidgetLauncher name={config.name} color={config.color} onOpen={() => show(true)} />
      </div>
    );
  }

  // The email offer sits under the first answer the bot didn't know, and stays there as the chat goes on.
  const missedId = messages.find((m) => m.role === "assistant" && m.answered === false)?.id;

  return (
    <div className="h-dvh p-2">
      <div
        className={cn(
          PANEL,
          config.position === "left" ? "origin-bottom-left" : "origin-bottom-right",
          closing ? "animate-out fill-mode-forwards duration-180 fade-out-0 zoom-out-95" : "animate-in duration-250 fade-in-0 zoom-in-95 slide-in-from-bottom-3",
        )}
        style={chatPalette(colors.chatBackground)}
        role="dialog"
        aria-label={`Chat with ${config.name}`}
      >
        <WidgetHeader name={config.name} avatar={avatar} avatarUrl={config.avatarUrl} color={config.color} onClose={close} />

        {messages.length === 0 && streaming === null ? (
          <WidgetFirstScreen greeting={config.greeting} suggestions={config.suggestedQuestions} onPick={send} />
        ) : (
          <div className="flex min-h-0 grow flex-col gap-2.5 overflow-y-auto px-3.5 pt-1 pb-3" aria-live="polite">
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="max-w-[78%] animate-rise self-end rounded-[20px_20px_6px_20px] px-3.5 py-2.5 text-sm leading-[1.45] font-medium whitespace-pre-wrap"
                  style={visitor}
                >
                  {m.content}
                </div>
              ) : (
                <Fragment key={m.id}>
                  <div
                    className={cn("max-w-[88%] self-start rounded-[20px_20px_20px_6px] px-3.5 py-2.5 text-sm leading-normal whitespace-pre-wrap", m.id !== settled && "animate-rise")}
                    style={bot}
                  >
                    {m.content}
                  </div>
                  {m.id === missedId && conversation && <LeadForm widgetKey={key} conversationId={conversation} host={pageHost()} color={config.color} />}
                </Fragment>
              ),
            )}
            {streaming !== null && (
              <div className="max-w-[88%] animate-rise self-start rounded-[20px_20px_20px_6px] px-3.5 py-2.5 text-sm leading-normal whitespace-pre-wrap" style={bot}>
                {streaming ? (
                  <>
                    {streaming}
                    <Caret />
                  </>
                ) : (
                  <span className="animate-pulse opacity-70">Thinking…</span>
                )}
              </div>
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
