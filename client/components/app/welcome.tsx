"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSources } from "@/components/knowledge/use-sources";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetPanel } from "@/components/widget-panel";
import { listConversations } from "@/lib/chat";
import { chatColors } from "@/lib/chat-colors";
import type { Bot } from "@/lib/types";
import { useApp } from "./app-context";
import { LoadError } from "./load-error";
import { KnowledgeStep, Step, StepLink } from "./welcome-steps";

// Whether the owner has tried the bot in the Playground yet.
function useHasTried(botId: string): boolean {
  const [tried, setTried] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    listConversations(botId, ctrl.signal)
      .then((list) => setTried(list.some((c) => c.channel === "playground")))
      .catch(() => {});
    return () => ctrl.abort();
  }, [botId]);
  return tried;
}

// The first screen of a new bot: three steps to go live, and the widget as visitors will see it.
export function Welcome({ bot }: { bot: Bot }) {
  const { href } = useApp();
  const { sources, error, reload } = useSources(bot.id);
  const tried = useHasTried(bot.id);
  const live = bot.lastSeenAt !== null;

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!sources) {
    return (
      <div className="flex flex-col gap-5 lg:flex-row" aria-busy="true" aria-label="Loading">
        <div className="flex grow flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-171 rounded-3xl lg:w-105" />
      </div>
    );
  }

  const knows = sources.some((s) => s.status === "ready") && !sources.some((s) => s.status === "queued" || s.status === "processing");
  // The first step that isn't done yet is the one to do now.
  const active = !knows ? 1 : !tried ? 2 : !live ? 3 : 0;

  return (
    <div className="flex animate-rise flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 grow flex-col gap-3">
        <KnowledgeStep botId={bot.id} sources={sources} active={active === 1} onAdded={reload} />
        <Step
          n={2}
          done={tried}
          active={active === 2}
          title="Ask it a few questions"
          body="Try it in the Playground before your visitors do."
          action={
            <StepLink href={href("/app/playground")} strong={active === 2}>
              Open Playground
            </StepLink>
          }
        />
        <Step
          n={3}
          done={live}
          active={active === 3}
          title="Put it on your site"
          body={live ? `It’s live on ${bot.lastSeenHost}.` : "One line of code. We’ll show you exactly where it goes."}
          action={
            <StepLink href={`${href("/app/widget")}&tab=install`} strong={active === 3}>
              Get the code
            </StepLink>
          }
        />
        <div className="flex grow flex-col items-center justify-center gap-2 rounded-3xl bg-app p-5.5 text-center">
          <BarChart3 className="size-7 text-subtle" strokeWidth={1.8} aria-hidden="true" />
          <span className="text-[15px] font-extrabold">Your numbers show up here</span>
          <span className="max-w-95 text-sm leading-normal text-subtle">
            As soon as someone asks your bot something, you’ll see questions, answers and emails on this page.
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3.5 rounded-3xl bg-app bg-[radial-gradient(var(--dot)_1px,transparent_1px)] bg-size-[18px_18px] p-5 lg:w-105">
        <span className="self-start text-sm font-extrabold">What visitors will see</span>
        {/* The live panel's size (380×684), so this is exactly what visitors get. */}
        <div className="h-171 w-full max-w-95">
          <WidgetPanel
            name={bot.name}
            avatar={bot.name.charAt(0).toUpperCase()}
            avatarUrl={bot.avatarUrl}
            color={bot.color}
            greeting={bot.greeting}
            suggestions={bot.suggestedQuestions}
            showBadge={bot.showBadge}
            {...chatColors(bot)}
            visitorMessageColor={bot.visitorMessageColor}
          />
        </div>
      </div>
    </div>
  );
}
