"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "cn";
import { Notice } from "@/components/auth/fields";
import { draftProblem, draftSize, EMPTY_DRAFT, KnowledgeDraft, saveDraft, type Draft } from "@/components/knowledge/knowledge-draft";
import { buttonVariants } from "@/components/ui/button";
import { isPending } from "@/lib/sources";
import type { Source } from "@/lib/types";

const soft = "flex h-9.5 items-center rounded-full bg-app px-3.5 text-[13px] font-extrabold text-ink transition-colors hover:bg-surface-2";

export function Step({
  n,
  done,
  active,
  title,
  body,
  action,
  children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex gap-4.5 rounded-3xl p-5.5",
        active ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_var(--line)]",
        !children && "sm:items-center",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold",
          done || active ? "bg-lime text-on-lime" : "shadow-[inset_0_0_0_1px_var(--line)]",
        )}
      >
        {done ? <Check className="size-4.5" strokeWidth={3} aria-label="Done" /> : n}
      </span>
      <div className="flex min-w-0 grow flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-extrabold">{title}</h2>
          <p className="text-sm leading-normal text-subtle">{body}</p>
        </div>
        {children}
        {action && <div className="sm:hidden">{action}</div>}
      </div>
      {action && <div className="hidden shrink-0 sm:block">{action}</div>}
    </section>
  );
}

export function StepLink({ href, strong, children }: { href: string; strong?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: strong ? "strong" : "raised" }), "h-10.5 px-4.5 text-sm", !strong && "bg-app shadow-none")}>
      {children}
    </Link>
  );
}

// Step 1: what the bot knows, how far reading has got, and a way to add more right here.
export function KnowledgeStep({ botId, sources, active, onAdded }: { botId: string; sources: Source[]; active: boolean; onAdded: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const ready = sources.filter((s) => s.status === "ready").length;
  const failed = sources.filter((s) => s.status === "failed");
  const reading = sources.filter((s) => isPending(s.status)).length;
  const done = ready > 0 && reading === 0;

  let body = "Upload files or paste text so it has something to answer from.";
  if (reading > 0) body = "Reading your files now. You can keep going while it works.";
  else if (done) body = `It has read ${ready === 1 ? "1 source" : `${ready} sources`}. You can add more any time.`;
  else if (failed.length > 0) body = "Nothing could be read yet. Check the reasons below and try another file.";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError("");
    const failures = await saveDraft(botId, draft);
    setPending(false);
    onAdded();
    if (failures.length === 0) setDraft(null);
    else setError(failures.map((f) => `${f.name}: ${f.error}`).join(" "));
  }

  return (
    <Step n={1} done={done} active={active} title="Add what your bot should know" body={body}>
      {sources.length > 0 && reading > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px] font-bold">
            <span>
              {ready} of {sources.length - failed.length} ready
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${Math.round((ready / Math.max(1, sources.length - failed.length)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {failed.map((s) => (
            <li key={s.id} className="flex flex-col rounded-[14px] bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad">
              <span className="font-extrabold break-all">{s.title}</span>
              <span>{s.error}</span>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <KnowledgeDraft
            value={draft}
            onChange={(d) => {
              setDraft(d);
              setError("");
            }}
            disabled={pending}
          />
          {error && <Notice tone="bad">{error}</Notice>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || draftSize(draft) === 0}
              className={cn(buttonVariants(), "h-10.5 px-4.5 text-sm disabled:opacity-50")}
            >
              {pending ? "Adding…" : "Add to your bot"}
            </button>
            <button type="button" disabled={pending} onClick={() => setDraft(null)} className={soft}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDraft(EMPTY_DRAFT)} className={soft}>
            Add files
          </button>
          <button type="button" onClick={() => setDraft({ files: [], text: { title: "", body: "" } })} className={soft}>
            Paste some text
          </button>
        </div>
      )}
    </Step>
  );
}
