import type { ReactNode } from "react";
import { cn } from "cn";

// Pill switch between a few options (the tabs, left/right).
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid gap-1 rounded-full bg-app p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* The white thumb under the picked option slides over; columns are equal, 0.25rem apart. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem - ${options.length - 1} * 0.25rem) / ${options.length})`,
          transform: `translateX(calc(${Math.max(0, options.findIndex((o) => o.value === value))} * (100% + 0.25rem)))`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative h-9 rounded-full text-[13px] transition-colors duration-300",
            o.value === value ? "font-extrabold text-ink" : "font-bold text-subtle hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Group({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor={htmlFor} className="text-sm font-extrabold">
        {label}
      </Label>
      {children}
      {hint && <span className="text-xs leading-normal text-subtle">{hint}</span>}
    </div>
  );
}

export const fieldClass =
  "w-full rounded-[16px] bg-app px-4 text-sm text-ink outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--ink)]";
