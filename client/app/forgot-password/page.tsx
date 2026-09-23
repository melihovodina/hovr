import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { AuthShell } from "@/components/auth/shell";

export const metadata: Metadata = {
  title: "Forgot your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
