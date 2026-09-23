import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { AuthShell } from "@/components/auth/shell";

export const metadata: Metadata = {
  title: "Pick a new password",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
