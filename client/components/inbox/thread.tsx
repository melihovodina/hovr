import { Mail } from "lucide-react";
import type { ReactNode } from "react";
import { AnswerText } from "@/components/chat-text";
import type { Message } from "@/lib/types";

// A visitor's chat as they saw it, read-only. `messages` null means the chat was deleted.
export function Thread({ title, meta, messages, email }: { title: string; meta: ReactNode; messages: Message[] | null; email: string | null }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1 pb-2">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] break-words">{title}</h2>
        <span className="text-[13px] text-subtle">{meta}</span>
      </div>
      {messages === null ? (
        <p className="rounded-2xl bg-app px-4 py-3 text-sm text-subtle">The chat this came from was deleted.</p>
      ) : (
        messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="max-w-[80%] animate-rise self-end rounded-[22px_22px_6px_22px] bg-app px-4 py-2.75 text-[15px] leading-normal break-words whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="flex max-w-[85%] animate-rise flex-col items-start gap-1.5 self-start">
              <div className="rounded-[22px_22px_22px_6px] px-4 py-2.75 text-[15px] leading-normal break-words whitespace-pre-wrap shadow-[0_0_0_1px_var(--line)]">
                <AnswerText text={m.content} />
              </div>
              {m.answered === false && (
                <span className="flex h-6 items-center rounded-full bg-bad-soft px-2.5 text-xs font-extrabold text-bad">It didn’t know</span>
              )}
            </div>
          ),
        )
      )}
      {email && (
        <div className="flex h-8 max-w-full animate-rise items-center gap-2 self-center rounded-full bg-ok-soft px-3.5 text-[13px] font-extrabold text-ok">
          <Mail className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          <span className="truncate">Left an email: {email}</span>
        </div>
      )}
    </div>
  );
}
