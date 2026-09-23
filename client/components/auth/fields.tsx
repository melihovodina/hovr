import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

export function Field({
  id,
  label,
  aside,
  hint,
  ...input
}: ComponentProps<"input"> & { id: string; label: string; aside?: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-12.5 rounded-full bg-surface px-4.5 text-[15px] text-ink shadow-[0_0_0_1px_var(--line)] outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--ink)]"
        {...input}
      />
      {hint && (
        <span id={`${id}-hint`} className="px-1.5 text-[13px] text-subtle">
          {hint}
        </span>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: ReactNode; pendingLabel: string }) {
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "w-full disabled:opacity-60")}>
      {pending ? pendingLabel : children}
    </button>
  );
}

const TONES = {
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
  info: "bg-surface text-subtle shadow-[0_0_0_1px_var(--line)]",
};

export function Notice({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <p role={tone === "bad" ? "alert" : "status"} className={cn("animate-rise rounded-[18px] px-4.5 py-3.5 text-sm leading-normal font-semibold", TONES[tone])}>
      {children}
    </p>
  );
}

// "New here? Make an account" under the form.
export function SwitchLine({ children }: { children: ReactNode }) {
  return <p className="text-sm text-subtle [&_a]:font-extrabold [&_a]:text-ink [&_a]:underline">{children}</p>;
}
