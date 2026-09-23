import type { ReactNode } from "react";
import { cn } from "cn";
import { onColor } from "@/lib/format";

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

export interface ColorOption {
  // null stands for "automatic" (the main color, a shade of the background...).
  value: string | null;
  label: string;
  // What the swatch shows; defaults to the value.
  swatch?: string;
}

// The color picker needs "#rrggbb"; an automatic swatch (a CSS mix) starts it at black.
function pickerStart(color: string | null): string {
  return color && isHex(color) ? color.toLowerCase() : "#000000";
}

function isHex(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}

const PICKED = "shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--ink)]";

// A row of color swatches plus "+" for any other color.
export function ColorChoice({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  label: string;
  options: ColorOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  size?: "sm" | "md";
}) {
  const custom = value !== null && !options.some((o) => o.value === value);
  const dot = size === "sm" ? "size-6" : "size-10";
  return (
    <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value ?? "auto"}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.label}
          title={o.label}
          onClick={() => onChange(o.value)}
          className={cn(
            dot,
            "flex items-center justify-center rounded-full text-[10px] font-extrabold ring-1 ring-black/10 ring-inset transition-shadow dark:ring-white/20",
            o.value === value && PICKED,
          )}
          style={{ background: o.swatch ?? o.value ?? undefined, color: o.swatch && isHex(o.swatch) ? onColor(o.swatch) : undefined }}
        >
          {/* Automatic choices say so, since their swatch can look like a plain color. */}
          {o.value === null && size === "md" && <span aria-hidden="true">Auto</span>}
        </button>
      ))}
      <label
        className={cn(
          dot,
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full font-extrabold ring-1 ring-black/10 ring-inset dark:ring-white/20",
          size === "sm" ? "text-[10px]" : "text-[11px]",
          custom ? PICKED : "bg-app text-subtle",
        )}
        style={custom ? { background: value, color: onColor(value) } : undefined}
        title="Your own color"
      >
        <span aria-hidden="true">+</span>
        <input
          type="color"
          aria-label={`${label}: your own color`}
          value={pickerStart(custom ? value : (options.find((o) => o.value === value)?.swatch ?? value))}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
