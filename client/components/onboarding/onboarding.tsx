"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { cn } from "cn";
import { Notice } from "@/components/auth/fields";
import { ArrowBadge, Logo } from "@/components/brand";
import { draftProblem, draftSize, EMPTY_DRAFT, KnowledgeDraft, saveDraft, type Draft, type Failure } from "@/components/knowledge/knowledge-draft";
import { buttonVariants } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { useAccount, useSignOut } from "@/lib/session";
import type { Bot } from "@/lib/types";

const MAX_NAME = 80;

// After "Your bot" the owner lands in the app.
const STEPS = ["Account", "Your bot"];

function Stepper() {
  return (
    <ol className="hidden items-center gap-2.5 text-sm font-bold sm:flex" aria-label="Setup steps">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2.5">
          {i > 0 && <span className="h-px w-8 bg-line" aria-hidden="true" />}
          <span className={cn("flex items-center gap-2", i !== 1 && "text-subtle")} aria-current={i === 1 ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-extrabold",
                i === 0 && "bg-ink text-page",
                i === 1 && "bg-lime text-on-lime",
              )}
            >
              {i === 0 ? <Check className="size-3.25" strokeWidth={3} aria-label="Done" /> : i + 1}
            </span>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// First bot setup: a name and something to read. Accounts that already have a bot skip it.
export function Onboarding() {
  const router = useRouter();
  const signOut = useSignOut();
  const { account, error: loadError } = useAccount();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [bot, setBot] = useState<Bot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<Failure[]>([]);

  useEffect(() => {
    if (account && account.bots.length > 0 && !bot) router.replace("/app");
  }, [account, bot, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError("");
    try {
      // Kept after the first try, so sending again doesn't make a second bot.
      const created = bot ?? (await api<Bot>("/bots", { method: "POST", body: { name } }));
      setBot(created);
      const failed = await saveDraft(created.id, draft);
      if (failed.length === 0) {
        router.replace("/app");
        return;
      }
      setFailures(failed);
    } catch (err) {
      setError(errorMessage(err));
    }
    setPending(false);
  }

  const ready = account && (account.bots.length === 0 || bot);

  return (
    <div className="flex min-h-dvh flex-col bg-app text-ink">
      <header className="flex h-22 shrink-0 items-center px-4 sm:px-12">
        <div className="flex flex-1">
          <Logo />
        </div>
        <Stepper />
        <div className="flex flex-1 justify-end">
          <button type="button" onClick={signOut} className="text-sm font-bold text-subtle hover:text-ink">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex grow items-center justify-center px-4 pt-4 pb-[calc(5.5rem+4vh)]">
        {loadError && <Notice tone="bad">{loadError}</Notice>}
        {ready && (
          <div className="flex w-full max-w-145 flex-col gap-6 rounded-[32px] bg-surface p-6 shadow-[0_0_0_1px_var(--line)] sm:p-10">
            <div className="flex flex-col gap-2">
              <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.04em] sm:text-[34px]">Let’s set up your first bot</h1>
              <p className="text-base leading-normal text-subtle">Give it a name and something to read. You can add more later.</p>
            </div>

            {failures.length > 0 ? (
              <Failures failures={failures} onContinue={() => router.replace("/app")} />
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="bot-name" className="text-sm font-bold">
                    What should we call it?
                  </label>
                  <input
                    id="bot-name"
                    required
                    maxLength={MAX_NAME}
                    placeholder="e.g. Northwind Coffee"
                    disabled={pending || bot !== null}
                    value={bot?.name ?? name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12.5 rounded-full bg-app px-4.5 text-[15px] text-ink outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--ink)] disabled:opacity-70"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold">What should it know?</span>
                  <KnowledgeDraft
                    value={draft}
                    onChange={(d) => {
                      setDraft(d);
                      setError("");
                    }}
                    disabled={pending}
                  />
                </div>
                {error && <Notice tone="bad">{error}</Notice>}
                <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "w-full pr-2.5 disabled:opacity-60")}>
                  {pending ? "Setting it up…" : draftSize(draft) > 0 ? "Create bot and start reading" : "Create bot"}
                  {!pending && <ArrowBadge size={32} />}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// The bot exists but some knowledge didn't go in (a plan limit, a file the server refused).
function Failures({ failures, onContinue }: { failures: Failure[]; onContinue: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Notice tone="bad">Your bot is ready, but {failures.length === 1 ? "one item" : `${failures.length} items`} didn’t go in:</Notice>
        <ul className="flex flex-col gap-1.5">
          {failures.map((f) => (
            <li key={f.name} className="flex flex-col rounded-[14px] px-3.5 py-2.5 text-sm shadow-[0_0_0_1px_var(--line)]">
              <span className="font-semibold break-all">{f.name}</span>
              <span className="text-subtle">{f.error}</span>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={onContinue} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        Continue to your bot
      </button>
    </>
  );
}
