import { RotateCw } from "lucide-react";

// A screen's data didn't load: the reason, and a way to ask again.
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] bg-bad-soft px-4.5 py-3 text-sm font-semibold text-bad">
      <span className="min-w-0 grow leading-normal">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-extrabold text-ink shadow-[0_0_0_1px_var(--line)]"
      >
        <RotateCw className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
