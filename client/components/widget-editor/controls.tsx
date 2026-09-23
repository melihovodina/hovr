import type { ReactNode } from "react";
import { cn } from "cn";
import { onColor } from "@/lib/format";

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
