"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { listInbox, listLeads } from "@/lib/inbox";
import type { InboxItem, Lead } from "@/lib/types";

export interface InboxData {
  open: InboxItem[];
  done: InboxItem[];
  leads: Lead[];
  // How far back the plan shows, 0 = forever.
  historyDays: number;
  canExport: boolean;
}

// All three lists at once, so every tab shows its count.
export function useInbox(botId: string) {
  const [data, setData] = useState<InboxData | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    Promise.all([listInbox(botId, "open", signal), listInbox(botId, "done", signal), listLeads(botId, signal)])
      .then(([open, done, leads]) => {
        setData({ open: open.items, done: done.items, leads: leads.leads, historyDays: open.historyDays, canExport: leads.canExport });
        setError("");
      })
      .catch((err) => {
        if (!signal.aborted) setError(errorMessage(err));
      });
    return () => ctrl.abort();
  }, [botId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
