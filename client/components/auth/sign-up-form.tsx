"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { CheckEmail } from "./check-email";
import { Field, Notice, SubmitButton, SwitchLine } from "./fields";
import { AuthHeading } from "./shell";
import { useRedirectIfSignedIn } from "./use-signed-in";

// Same rule as the server.
export const MIN_PASSWORD = 8;

export function SignUpForm() {
  useRedirectIfSignedIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/auth/signup", { method: "POST", body: { email, password } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return <CheckEmail email={email} kind="signup" onBack={() => setSent(false)} />;
  }

  return (
    <>
      <AuthHeading title="Make your account" />
      <form onSubmit={submit} className="flex flex-col gap-5.5">
        <Field
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <SubmitButton pending={pending} pendingLabel="Creating your account…">
          Create account
        </SubmitButton>
      </form>
      <SwitchLine>
        Already have one? <Link href="/signin">Sign in</Link>
      </SwitchLine>
    </>
  );
}
