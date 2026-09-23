"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

// Someone already signed in has nothing to do on the sign-in and sign-up pages.
export function useRedirectIfSignedIn() {
  const router = useRouter();
  useEffect(() => {
    const ctrl = new AbortController();
    api<Me>("/me", { signal: ctrl.signal })
      .then(() => router.replace("/app"))
      .catch(() => {});
    return () => ctrl.abort();
  }, [router]);
}
