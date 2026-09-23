import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Make your account",
  alternates: { canonical: "/signup" },
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
