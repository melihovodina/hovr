"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { CheckEmail } from "./check-email";
import { Field, Notice, SubmitButton, SwitchLine } from "./fields";
import { AuthHeading } from "./shell";
import { useRedirectIfSignedIn } from "./use-signed-in";

// What the email-link callback (/api/auth/callback) says through the query string.
function LinkNotice() {
  const params = useSearchParams();
  if (params.get("confirmed") === "1") {
    return <Notice tone="ok">Your email is confirmed. Sign in to get started.</Notice>;
  }
  switch (params.get("error")) {
    case "link_expired":
      return <Notice tone="bad">That link has expired or was already used. Sign in, or ask for a new one.</Notice>;
    case "link_invalid":
      return <Notice tone="bad">That link didn’t work. Sign in, or ask for a new one.</Notice>;
  }
  return null;
}

export function SignInForm() {
  const router = useRouter();
  useRedirectIfSignedIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/auth/signin", { method: "POST", body: { email, password } });
      router.replace("/app");
    } catch (err) {
      // 403 is "confirm your email first".
      if (err instanceof ApiError && err.status === 403) setUnconfirmed(true);
      else setError(errorMessage(err));
      setPending(false);
    }
  }

  if (unconfirmed) {
    return <CheckEmail email={email} kind="unconfirmed" onBack={() => setUnconfirmed(false)} />;
  }

  return (
    <>
      <AuthHeading title="Welcome back" />
      <Suspense fallback={null}>
        <LinkNotice />
      </Suspense>
      <form onSubmit={submit} className="flex flex-col gap-5.5">
        <Field
          id="signin-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="signin-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aside={
            <Link href="/forgot-password" className="text-[13px] font-bold text-subtle hover:text-ink">
              Forgot it?
            </Link>
          }
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <SwitchLine>
        New here? <Link href="/signup">Make an account</Link>
      </SwitchLine>
    </>
  );
}
