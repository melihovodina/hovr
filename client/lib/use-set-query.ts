"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

// Changes some values in the address's query in place (null removes one), without scrolling.
export function useSetQuery(): (changes: Record<string, string | null>) => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (changes) => {
      const q = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) q.delete(key);
        else q.set(key, value);
      }
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname, params],
  );
}
