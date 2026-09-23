import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/signin" },
};

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}
