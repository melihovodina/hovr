"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { isPending, listSources } from "@/lib/sources";
import type { Source } from "@/lib/types";

const POLL_MS = 2500;

// The bot's sources, refreshed every few seconds while any of them is still being read.
export function useSources(botId: string) {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    listSources(botId, ctrl.signal)
      .then((list) => {
        setSources(list);
        setError("");
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err));
      });
    return () => ctrl.abort();
  }, [botId, version]);

  const pending = sources?.some((s) => isPending(s.status)) ?? false;
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setVersion((v) => v + 1), POLL_MS);
    return () => clearTimeout(timer);
  }, [pending, sources]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { sources, error, reload };
}
