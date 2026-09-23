"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import type { Bot, Me } from "./types";

export interface Account {
  me: Me;
  bots: Bot[];
}

// The signed-in user with their bots, for pages behind sign-in. Signed out means back to /signin.
export function useAccount(): { account: Account | null; error: string } {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([api<Me>("/me", { signal: ctrl.signal }), api<{ bots: Bot[] }>("/bots", { signal: ctrl.signal })])
      .then(([me, { bots }]) => setAccount({ me, bots }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) router.replace("/signin");
        else setError(errorMessage(err));
      });
    return () => ctrl.abort();
  }, [router]);

  return { account, error };
}

export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  return async () => {
    await api("/auth/signout", { method: "POST" }).catch(() => {});
    router.replace("/signin");
  };
}
