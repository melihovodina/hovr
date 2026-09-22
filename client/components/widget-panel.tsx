import type { ReactNode } from "react";
import { cn } from "cn";
import { ArrowUp, ArrowUpRight, ChevronDown, FileText, MoreHorizontal } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { initial, onColor } from "@/lib/format";

export type PreviewMessage = { kind: "user" | "bot" | "source"; text: string };

interface WidgetPanelProps {
  name: string;
  // Letter in the avatar; defaults to the name's first letter.
  avatar?: string;
  color: string;
  greeting: string;
  suggestions?: string[];
  showBadge?: boolean;
  messages?: PreviewMessage[];
  // "auto" follows the site theme; the app previews always show the light widget.
  theme?: "light" | "auto";
  className?: string;
}

// A drawn copy of the embeddable widget, used for previews. It never talks to the API.
export function WidgetPanel({
  name,
  avatar,
  color,
  greeting,
  suggestions = [],
  showBadge = true,
  messages,
  theme = "light",
  className,
}: WidgetPanelProps) {
  const onAccent = onColor(color);
  const title = name.trim() || "Your bot";
  return (
    <div
      className={cn(
        "wp flex h-[600px] w-[360px] max-w-full flex-col overflow-hidden rounded-[26px] bg-[var(--w-bg)] text-[var(--w-ink)] shadow-[0_16px_40px_-18px_var(--w-shadow),0_0_0_1px_var(--w-ring)]",
        theme === "auto" && "wp-auto",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 pt-3.5 pr-3 pb-3 pl-4">
        <div className="relative size-9 shrink-0">
          <div
            className="flex size-9 items-center justify-center rounded-full text-[15px] font-extrabold"
            style={{ background: color, color: onAccent }}
          >
            {avatar ?? initial(title)}
          </div>
          <span className="absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-[var(--w-bg)] bg-online" />
        </div>
        <div className="flex min-w-0 grow flex-col gap-px">
          <div className="truncate text-[15px] font-extrabold tracking-[-0.01em]">{title}</div>
          <div className="text-xs text-[var(--w-muted)]">Online now</div>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full text-[var(--w-muted)]" aria-hidden="true">
          <MoreHorizontal className="size-[18px]" />
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-[var(--w-soft)]" aria-hidden="true">
          <ChevronDown className="size-[18px]" strokeWidth={2} />
        </span>
      </div>

      <div className="flex min-h-0 grow flex-col overflow-hidden">
        {messages ? (
          <div className="flex grow flex-col gap-2.5 px-3.5 pt-1 pb-3">
            <div className="self-center text-[11px] font-bold text-[var(--w-muted)]">Today</div>
            {messages.map((m, i) =>
              m.kind === "user" ? (
                <div
                  key={i}
                  className="max-w-[78%] self-end rounded-[20px_20px_6px_20px] px-3.5 py-2.5 text-sm leading-[1.45] font-medium"
                  style={{ background: color, color: onAccent }}
                >
                  {m.text}
                </div>
              ) : m.kind === "bot" ? (
                <div key={i} className="max-w-[88%] self-start rounded-[20px_20px_20px_6px] bg-[var(--w-soft)] px-3.5 py-2.5 text-sm leading-normal">
                  {m.text}
                </div>
              ) : (
                <span
                  key={i}
                  className="flex h-7 items-center gap-1.5 self-start rounded-full border border-[var(--w-border)] pr-2.5 pl-1.5 text-xs font-bold"
                >
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--w-soft)]">
                    <FileText className="size-[11px]" strokeWidth={2.4} />
                  </span>
                  {m.text}
                </span>
              ),
            )}
          </div>
        ) : (
          <div className="flex grow flex-col gap-[18px] px-4 pt-[22px] pb-3">
            <div className="flex flex-col gap-2 px-1">
              <div className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.03em]">
                Hey there.
                <br />
                <span className="text-[var(--w-muted)]">What can I help with?</span>
              </div>
              <div className="text-sm leading-normal break-words text-[var(--w-muted)]">{greeting}</div>
            </div>
            <div className="flex flex-col gap-2">
              {suggestions.map((q, i) => (
                <div
                  key={i}
                  className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-[var(--w-soft)] py-2 pr-3.5 pl-4 text-sm font-semibold"
                >
                  <span className="grow break-words">{q}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-[var(--w-muted)]" strokeWidth={2} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-3 pb-2.5">
        <div className="flex h-[52px] items-center gap-1.5 rounded-full border border-[var(--w-border)] bg-[var(--w-bg)] pr-1.5 pl-[18px] shadow-[0_4px_14px_rgba(10,12,16,0.06)]">
          <span className="grow text-[15px] text-[var(--w-muted)]">Type your question…</span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: color, color: onAccent }}>
            <ArrowUp className="size-[18px]" strokeWidth={2.4} />
          </span>
        </div>
        {showBadge && (
          <div className="flex items-center justify-center gap-[5px] text-[11px] font-semibold text-[var(--w-muted)]">
            Powered by
            <LogoMark size={14} shadow={false} />
            <span className="font-extrabold text-[var(--w-ink)]">hovr</span>
          </div>
        )}
      </div>
    </div>
  );
}

// A stand-in for the customer's website, with the widget docked in a corner.
export function FakeSite({
  host,
  position = "right",
  children,
  className,
}: {
  host: string;
  position?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[20px] bg-[#FBF7F0] shadow-[0_0_0_1px_var(--line),0_20px_50px_-30px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-1.5 bg-[#EFE8DC] px-3.5">
        <span className="size-[9px] rounded-full bg-[#D6CCBA]" />
        <span className="size-[9px] rounded-full bg-[#D6CCBA]" />
        <span className="size-[9px] rounded-full bg-[#D6CCBA]" />
        <span className="ml-2.5 truncate text-xs text-[#6A6153]">{host}</span>
      </div>
      <div className="flex flex-col gap-3 p-7">
        <span className="h-3.5 w-[180px] max-w-full rounded-md bg-[#E7DFD1]" />
        <span className="h-7 w-[300px] max-w-full rounded-lg bg-[#E7DFD1]" />
        <span className="h-3 w-[240px] max-w-full rounded-md bg-[#E7DFD1]" />
      </div>
      <div className={cn("absolute bottom-5 max-w-[calc(100%-40px)]", position === "left" ? "left-5" : "right-5")}>{children}</div>
    </div>
  );
}
