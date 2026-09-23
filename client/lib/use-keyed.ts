"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "./api";

// Loads again whenever `key` changes; null while loading, and a result for an older key counts as loading.
export function useKeyed<T>(key: string, load: (signal: AbortSignal) => Promise<T>): { data?: T; error?: string } | null {
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal)
      .then((data) => setResult({ key, data }))
      .catch((err) => {
        if (!ctrl.signal.aborted) setResult({ key, error: errorMessage(err) });
      });
    return () => ctrl.abort();
    // `load` is rebuilt every render; the key says when it points elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result?.key === key ? result : null;
}
