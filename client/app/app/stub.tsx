"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthHeading } from "@/components/auth/shell";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Me } from "@/lib/types";

export function AppStub() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/signin");
      });
  }, [router]);

  async function signOut() {
    await api("/auth/signout", { method: "POST" }).catch(() => {});
    router.replace("/signin");
  }

  if (!me) return null;
  return (
    <>
      <AuthHeading title="You’re signed in">
        {me.email}, {me.plan} plan. The dashboard comes next.
      </AuthHeading>
      <button type="button" onClick={signOut} className={buttonVariants({ variant: "outline", size: "lg" })}>
        Sign out
      </button>
    </>
  );
}
