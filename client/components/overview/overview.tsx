"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { useSources } from "@/components/knowledge/use-sources";
import { Segmented } from "@/components/widget-editor/controls";
import { errorMessage } from "@/lib/api";
import { getStats } from "@/lib/inbox";
import type { Stats } from "@/lib/types";
import { Chart } from "./chart";
import { Metrics } from "./metrics";
import { NeedsYou, todos, TopQuestions } from "./side-cards";

const PERIODS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

function useStats(botId: string, days: number) {
  const [result, setResult] = useState<{ key: string; stats?: Stats; error?: string } | null>(null);
  const key = `${botId}:${days}`;
  useEffect(() => {
    const ctrl = new AbortController();
    getStats(botId, days, ctrl.signal)
      .then((stats) => setResult({ key, stats }))
      .catch((err) => {
        if (!ctrl.signal.aborted) setResult({ key, error: errorMessage(err) });
      });
    return () => ctrl.abort();
  }, [botId, days, key]);
  // A result for another bot or period is stale: show the loading state instead.
  return result?.key === key ? result : null;
}

function Skeleton() {
  return (
    <div className="flex grow flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-38 rounded-[22px] bg-skel" />
      <div className="flex grow flex-col gap-4 lg:flex-row">
        <div className="min-h-80 grow rounded-[22px] bg-skel" />
        <div className="flex flex-col gap-4 lg:w-95">
          <div className="h-40 rounded-[22px] bg-skel" />
          <div className="h-56 rounded-[22px] bg-skel" />
        </div>
      </div>
    </div>
  );
}

// The home screen once the bot is live: this period's numbers against the previous one.
export function Overview() {
  const { bot, billing, href } = useApp();
  const [days, setDays] = useState(7);
  const result = useStats(bot.id, days);
  const { sources } = useSources(bot.id);
  const stats = result?.stats;

  return (
    <>
      <PageHeader
        title="Overview"
        sub={`How ${bot.name} did ${days === 7 ? "this week" : `in the last ${days} days`}.`}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            {bot.lastSeenHost && (
              <span className="flex h-10.5 items-center gap-2 rounded-full bg-surface-2 pr-4 pl-3 text-sm font-bold">
                <span className="size-2 rounded-full bg-online" aria-hidden="true" />
                Live on {bot.lastSeenHost}
              </span>
            )}
            <div className="w-48">
              <Segmented label="Period" options={PERIODS} value={String(days)} onChange={(v) => setDays(Number(v))} />
            </div>
          </div>
        }
      />
      <div className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-5 pt-1 pb-5 sm:px-7 sm:pb-7">
        {result?.error ? (
          <Notice tone="bad">{result.error}</Notice>
        ) : !stats ? (
          <Skeleton />
        ) : (
          <>
            <Metrics stats={stats} />
            <div className="flex grow flex-col gap-4 lg:flex-row">
              <Chart stats={stats} />
              <div className="flex shrink-0 flex-col gap-4 lg:w-95">
                <NeedsYou items={todos(stats, sources ?? [], billing, href)} />
                <TopQuestions questions={stats.topQuestions} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
