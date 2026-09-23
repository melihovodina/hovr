"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { useSources } from "@/components/knowledge/use-sources";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { deleteConversation, getConversation, listConversations, streamChat } from "@/lib/chat";
import { shortDate } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";
import { AnswerText, Composer, SourceChips, WhyItSaidThat } from "./parts";

// Test chats with the bot: history on the left, the chat, and why each answer said what it said.
// Keyed by bot, so switching bots starts clean.
export function PlaygroundScreen() {
  const { bot } = useApp();
  return <Playground key={bot.id} />;
}

function Playground() {
  const { bot, href } = useApp();
  const { sources } = useSources(bot.id);
  // null while loading.
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(() => {
    listConversations(bot.id)
      .then((list) => {
        setHistory(list.filter((c) => c.channel === "playground"));
        setHistoryError(false);
      })
      .catch(() => setHistoryError(true));
  }, [bot.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  function startNew() {
    abort.current?.abort();
    setCurrent(null);
    setMessages([]);
    setStreaming(null);
    setSelected(null);
    setError("");
  }

  async function open(id: string) {
    abort.current?.abort();
    setCurrent(id);
    setStreaming(null);
    setError("");
    try {
      const { messages: list } = await getConversation(bot.id, id);
      setMessages(list);
      setSelected(lastAnswer(list));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      await deleteConversation(bot.id, id);
      if (id === current) startNew();
      loadHistory();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming !== null) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setDraft("");
    setError("");
    setMessages((list) => [...list, localMessage(message)]);
    setStreaming("");
    try {
      const saved = await streamChat(
        `/bots/${bot.id}/chat`,
        { message, conversationId: current ?? undefined },
        { onConversation: setCurrent, onText: (t) => setStreaming((s) => (s ?? "") + t) },
        ctrl.signal,
      );
      setMessages((list) => [...list, saved]);
      setSelected(saved.id);
      loadHistory();
    } catch (err) {
      if (!ctrl.signal.aborted) setError(errorMessage(err));
    } finally {
      if (!ctrl.signal.aborted) setStreaming(null);
    }
  }

  const selectedMessage = messages.find((m) => m.id === selected && m.role === "assistant") ?? null;
  const knowsNothing = sources !== null && !sources.some((s) => s.status === "ready");

  return (
    <>
      <PageHeader
        title="Playground"
        sub="Ask what your customers would ask. Test chats are free."
        aside={
          <button
            type="button"
            onClick={startNew}
            className="flex h-10.5 items-center gap-2 rounded-full bg-ink px-4 text-sm font-extrabold text-page md:hidden"
          >
            <Plus className="size-4" strokeWidth={2.4} />
            New chat
          </button>
        }
      />
      <div className="flex min-h-0 grow border-t border-line">
        <aside className="hidden w-57.5 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line px-3 py-4 md:flex">
          <button
            type="button"
            onClick={startNew}
            className="mb-2 flex h-10.5 shrink-0 items-center justify-center gap-2 rounded-full bg-ink text-sm font-extrabold text-page hover:opacity-90"
          >
            <Plus className="size-4" strokeWidth={2.4} />
            New test chat
          </button>
          {historyError && (
            <p className="px-3 py-2 text-xs leading-normal text-subtle">
              Past chats didn’t load.{" "}
              <button type="button" onClick={loadHistory} className="font-bold text-ink underline">
                Try again
              </button>
            </p>
          )}
          {history === null && !historyError && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 shrink-0 rounded-[14px]" />)}
          {history?.length === 0 && <p className="px-3 py-2 text-xs leading-normal text-subtle">Your test chats show up here.</p>}
          {history?.map((c) => (
            <div key={c.id} className={cn("group flex items-center rounded-[14px]", c.id === current ? "bg-app" : "hover:bg-app/60")}>
              <button type="button" onClick={() => open(c.id)} className="flex min-w-0 grow flex-col gap-0.5 px-3 py-2.5 text-left">
                <span className="truncate text-sm font-bold">{c.title || "Untitled chat"}</span>
                <span className="text-xs text-subtle">{shortDate(c.lastMessageAt)}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={`Delete “${c.title}”`}
                className="mr-1 hidden size-8 shrink-0 items-center justify-center rounded-full text-subtle group-hover:flex hover:text-bad focus-visible:flex"
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </aside>

        <section className="flex min-w-0 grow flex-col">
          <div className="flex min-h-0 grow flex-col gap-4.5 overflow-y-auto px-5 py-6 sm:px-10">
            {knowsNothing && (
              <Notice tone="info">
                Your bot has nothing to read yet, so it can only chat.{" "}
                <Link href={href("/app/knowledge")} className="font-extrabold text-ink underline">
                  Add knowledge
                </Link>
              </Notice>
            )}
            {messages.length === 0 && streaming === null && (
              <div className="m-auto flex max-w-100 flex-col items-center gap-3 text-center">
                <span className="text-lg font-extrabold">Ask what a customer would ask</span>
                <span className="text-sm leading-normal text-subtle">Then pick an answer to see which parts of your content it came from.</span>
                {bot.suggestedQuestions.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {bot.suggestedQuestions.map((q) => (
                      <button key={q} type="button" onClick={() => send(q)} className="rounded-full bg-app px-3.5 py-2 text-sm font-bold hover:bg-surface-2">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="max-w-[80%] self-end rounded-[22px_22px_6px_22px] bg-ink px-4 py-2.75 text-[15px] leading-normal whitespace-pre-wrap text-page">
                  {m.content}
                </div>
              ) : (
                <div key={m.id} className="flex max-w-[85%] flex-col gap-2 self-start">
                  <button
                    type="button"
                    onClick={() => setSelected(m.id)}
                    aria-pressed={m.id === selected}
                    className={cn(
                      "rounded-[22px_22px_22px_6px] bg-app px-4 py-3 text-left text-[15px] leading-relaxed whitespace-pre-wrap transition-shadow",
                      m.id === selected ? "shadow-[0_0_0_2px_var(--color-lime)]" : "hover:shadow-[0_0_0_1px_var(--line)]",
                    )}
                  >
                    <AnswerText text={m.content} />
                  </button>
                  <SourceChips citations={m.citations} />
                  {m.id === selected && (
                    <div className="flex flex-col gap-3 rounded-[18px] bg-app p-3.5 xl:hidden">
                      <WhyItSaidThat message={m} />
                    </div>
                  )}
                </div>
              ),
            )}
            {streaming !== null && (
              <div className="max-w-[85%] self-start rounded-[22px_22px_22px_6px] bg-app px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
                {streaming ? <AnswerText text={streaming} /> : <span className="animate-pulse text-subtle">Thinking…</span>}
              </div>
            )}
            {error && <Notice tone="bad">{error}</Notice>}
            <div ref={bottom} />
          </div>
          <div className="shrink-0 px-5 pt-2 pb-5 sm:px-10 sm:pb-6">
            <Composer value={draft} onChange={setDraft} onSubmit={() => send(draft)} disabled={streaming !== null} />
          </div>
        </section>

        <aside className="hidden w-80 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-line bg-app p-5 xl:flex">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-extrabold">Why it said that</h2>
            <p className="text-[13px] leading-normal text-subtle">For the highlighted answer, these are the bits of your content it used.</p>
          </div>
          <WhyItSaidThat message={selectedMessage} />
          <p className="mt-auto pt-2 text-xs leading-normal text-subtle">Test chats are free and don’t count toward your messages.</p>
        </aside>
      </div>
    </>
  );
}

// The question as it's shown before the server has saved it.
function localMessage(content: string): Message {
  return { id: -Date.now(), role: "user", content, citations: [], answered: null, createdAt: new Date().toISOString() };
}

function lastAnswer(list: Message[]): number | null {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].role === "assistant") return list[i].id;
  return null;
}
