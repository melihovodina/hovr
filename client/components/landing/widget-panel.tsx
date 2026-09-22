import { ArrowUp, ChevronDown, FileText, MoreHorizontal } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { onColor } from "@/lib/format";

export type PreviewMessage = { kind: "user" | "bot" | "source"; text: string };

interface WidgetPanelProps {
  name: string;
  // Letter in the avatar.
  avatar: string;
  color: string;
  messages: PreviewMessage[];
}

// A drawn copy of the embeddable widget in the middle of a chat, following the site's theme and
// filling its box. It never talks to the API.
export function WidgetPanel({ name, avatar, color, messages }: WidgetPanelProps) {
  const onAccent = onColor(color);
  return (
    <div className="wp flex size-full max-w-full flex-col overflow-hidden rounded-[26px] bg-(--w-bg) text-(--w-ink) shadow-[0_16px_40px_-18px_var(--w-shadow),0_0_0_1px_var(--w-ring)]">
      <div className="flex items-center gap-2.5 pt-3.5 pr-3 pb-3 pl-4">
        <div className="relative size-9 shrink-0">
          <div
            className="flex size-9 items-center justify-center rounded-full text-[15px] font-extrabold"
            style={{ background: color, color: onAccent }}
          >
            {avatar}
          </div>
          <span className="absolute -right-px -bottom-px size-2.75 rounded-full border-2 border-(--w-bg) bg-online" />
        </div>
        <div className="flex min-w-0 grow flex-col gap-px">
          <div className="truncate text-[15px] font-extrabold tracking-[-0.01em]">{name}</div>
          <div className="text-xs text-(--w-muted)">Online now</div>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full text-(--w-muted)" aria-hidden="true">
          <MoreHorizontal className="size-4.5" />
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-(--w-soft)" aria-hidden="true">
          <ChevronDown className="size-4.5" strokeWidth={2} />
        </span>
      </div>

      {/* Starts at the top while the messages fit; once the panel is shorter than them, the newest
          stay in view and the oldest go under the header, as in a real chat. */}
      <div className="flex min-h-0 grow flex-col justify-end overflow-hidden">
        <div className="flex min-h-full shrink-0 flex-col gap-2.5 px-3.5 pt-1 pb-3">
          <div className="self-center text-[11px] font-bold text-(--w-muted)">Today</div>
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
              <div key={i} className="max-w-[88%] self-start rounded-[20px_20px_20px_6px] bg-(--w-soft) px-3.5 py-2.5 text-sm leading-normal">
                {m.text}
              </div>
            ) : (
              <span
                key={i}
                className="flex h-7 items-center gap-1.5 self-start rounded-full border border-(--w-border) pr-2.5 pl-1.5 text-xs font-bold"
              >
                <span className="flex size-4.5 items-center justify-center rounded-full bg-(--w-soft)">
                  <FileText className="size-2.75" strokeWidth={2.4} />
                </span>
                {m.text}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-2.5">
        <div className="flex h-13 items-center gap-1.5 rounded-full border border-(--w-border) bg-(--w-bg) pr-1.5 pl-4.5 shadow-[0_4px_14px_rgba(10,12,16,0.06)]">
          <span className="grow text-[15px] text-(--w-muted)">Type your question…</span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: color, color: onAccent }}>
            <ArrowUp className="size-4.5" strokeWidth={2.4} />
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.25 text-[11px] font-semibold text-(--w-muted)">
          Powered by
          <LogoMark size={14} shadow={false} />
          <span className="font-extrabold text-(--w-ink)">hovr</span>
        </div>
      </div>
    </div>
  );
}
