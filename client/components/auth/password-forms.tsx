"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiError, errorMessage } from "@/lib/api";
import { CheckEmail } from "./check-email";
import { Field, Notice, SubmitButton, SwitchLine } from "./fields";
import { AuthHeading } from "./shell";
import { MIN_PASSWORD } from "./sign-up-form";

// Step one: send a reset link. The answer is the same whether or not the address has an account.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/auth/recover", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return <CheckEmail email={email} kind="recover" onBack={() => setSent(false)} />;
  }

  return (
    <>
      <AuthHeading title="Forgot your password?">We’ll email you a link to pick a new one.</AuthHeading>
      <form onSubmit={submit} className="flex flex-col gap-5.5">
        <Field
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send me a link
        </SubmitButton>
      </form>
      <SwitchLine>
        Remembered it? <Link href="/signin">Sign in</Link>
      </SwitchLine>
    </>
  );
}

// Step two: the email link signs the user in and lands here, so a new password is all it takes.
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/auth/password", { method: "POST", body: { password } });
      router.replace("/app");
    } catch (err) {
      // No session: the link wasn't opened here, or it has run out.
      if (err instanceof ApiError && err.status === 401) setExpired(true);
      else setError(errorMessage(err));
      setPending(false);
    }
  }

  if (expired) {
    return (
      <>
        <AuthHeading title="This link has run out">Ask for a new one and open it in this browser.</AuthHeading>
        <Link href="/forgot-password" className={buttonVariants({ size: "lg" })}>
          Send me a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Pick a new password">You’ll stay signed in on this device.</AuthHeading>
      <form onSubmit={submit} className="flex flex-col gap-5.5">
        <Field
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save and continue
        </SubmitButton>
      </form>
    </>
  );
}
