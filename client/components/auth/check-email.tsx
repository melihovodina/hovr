"use client";

import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { SubmitButton, Notice } from "./fields";
import { AuthHeading } from "./shell";

const COPY = {
  signup: { title: "Check your inbox", action: "confirm your email and you’re in", resend: "/auth/resend" },
  unconfirmed: { title: "Confirm your email first", action: "confirm your email, then sign in", resend: "/auth/resend" },
  recover: { title: "Check your inbox", action: "pick a new password", resend: "/auth/recover" },
};

// After sign-up or "forgot password": which address got the link, with a way to send it again.
export function CheckEmail({ email, kind, onBack }: { email: string; kind: keyof typeof COPY; onBack: () => void }) {
  const copy = COPY[kind];
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setSent(false);
    try {
      await api(copy.resend, { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <span className="flex size-16 items-center self-center justify-center rounded-full bg-lime text-on-lime">
        <Mail className="size-7" strokeWidth={2} aria-hidden="true" />
      </span>
      <AuthHeading title={copy.title}>
        We sent a link to <span className="font-extrabold break-all text-ink">{email}</span>. Click it to {copy.action}.
      </AuthHeading>
      {sent && <Notice tone="ok">Sent. Use the link in the newest email.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      <form onSubmit={resend} className="flex flex-col gap-2.5">
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send it again
        </SubmitButton>
        <button
          type="button"
          onClick={onBack}
          className="h-12.5 rounded-full text-[15px] font-bold text-subtle transition-colors hover:text-ink"
        >
          Use a different email
        </button>
      </form>
      <Notice tone="info">Can’t find it? Check your spam folder. It can take a minute to arrive.</Notice>
    </>
  );
}
