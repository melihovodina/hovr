"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/app/app-context";
import { Notice } from "@/components/auth/fields";
import { ApiError, errorMessage } from "@/lib/api";
import { replyLink, setInboxStatus, teach } from "@/lib/inbox";
import { MAX_TEXT } from "@/lib/sources";
import type { InboxItem } from "@/lib/types";

const quietButton = "h-11 rounded-full text-sm font-bold text-subtle transition-colors hover:text-ink disabled:opacity-50";

function Failure({ error }: { error: unknown }) {
  const { href } = useApp();
  if (error instanceof ApiError && error.upgradeRequired) {
    return (
      <Notice tone="bad">
        {error.message}{" "}
        <Link href={href("/app/billing")} className="underline">
          See plans
        </Link>
      </Notice>
    );
  }
  return <Notice tone="bad">{errorMessage(error)}</Notice>;
}

export function ReplyLink({ email, question }: { email: string; question?: string }) {
  const { bot } = useApp();
  return (
    <a
      href={replyLink(email, bot.name, question)}
      className="flex h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-extrabold shadow-[0_0_0_1px_var(--line)]"
    >
      <Mail className="size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      <span className="truncate">Reply to {email}</span>
    </a>
  );
}

// `onChange` gets the saved item; `taught` says the answer went to the knowledge.
export function ItemActions({ item, onChange }: { item: InboxItem; onChange: (item: InboxItem, taught: boolean) => void }) {
  const { bot, href } = useApp();
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(action: () => Promise<InboxItem>, taught: boolean) {
    setPending(true);
    setError(null);
    try {
      onChange(await action(), taught);
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    run(() => teach(bot.id, item.id, answer.trim()).then((r) => r.item), true);
  }

  if (item.status === "done") {
    return (
      <>
        <p className="rounded-[20px] bg-surface p-4 text-sm leading-normal shadow-[0_0_0_1px_var(--line)]">
          {item.answerSourceId ? (
            <>
              Answered and added to your{" "}
              <Link href={href("/app/knowledge")} className="font-extrabold underline">
                knowledge
              </Link>
              . The bot uses it from now on.
            </>
          ) : (
            "Marked as done without an answer."
          )}
        </p>
        {error !== null && <Failure error={error} />}
        {item.visitorEmail && <ReplyLink email={item.visitorEmail} question={item.question} />}
        <button type="button" disabled={pending} onClick={() => run(() => setInboxStatus(bot.id, item.id, "open"), false)} className={quietButton}>
          Move back to Needs an answer
        </button>
      </>
    );
  }

  return (
    <>
      <form onSubmit={save} className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
        <label htmlFor="teach" className="text-[15px] font-extrabold">
          Teach your bot
        </label>
        <span id="teach-note" className="text-[13px] leading-normal text-subtle">
          Write the answer once. It gets added to your knowledge and the bot uses it from now on.
        </span>
        <textarea
          id="teach"
          rows={5}
          maxLength={MAX_TEXT}
          aria-describedby="teach-note"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="resize-none rounded-[14px] bg-app px-3.5 py-3 text-sm leading-normal text-ink outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--ink)]"
        />
        <button
          type="submit"
          disabled={pending || !answer.trim()}
          className="h-11 rounded-full bg-lime text-sm font-extrabold text-on-lime transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save to knowledge"}
        </button>
      </form>
      {error !== null && <Failure error={error} />}
      {item.visitorEmail && <ReplyLink email={item.visitorEmail} question={item.question} />}
      <button type="button" disabled={pending} onClick={() => run(() => setInboxStatus(bot.id, item.id, "done"), false)} className={quietButton}>
        Mark as done
      </button>
    </>
  );
}
