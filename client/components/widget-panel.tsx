import { ArrowUp, ArrowUpRight, ChevronDown, FileText, MoreHorizontal } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { onColor } from "@/lib/format";

export type PreviewMessage = { kind: "user" | "bot" | "source"; text: string };

// The widget's outer box; `.wp` gives it its own palette that follows the page's theme.
export const PANEL =
  "wp flex size-full max-w-full flex-col overflow-hidden rounded-[26px] bg-(--w-bg) text-(--w-ink) shadow-[0_16px_40px_-18px_var(--w-shadow),0_0_0_1px_var(--w-ring)]";

interface WidgetPanelProps {
  name: string;
  // Letter in the avatar, shown when there is no logo.
  avatar: string;
  avatarUrl?: string | null;
  color: string;
  // A chat in progress; without messages the panel shows the first screen (greeting and suggestions).
  messages?: PreviewMessage[];
  greeting?: string;
  suggestions?: string[];
  showBadge?: boolean;
}

// A drawn copy of the embeddable widget, following the site's theme and filling its box.
// It never talks to the API.
export function WidgetPanel({
  name,
  avatar,
  avatarUrl,
  color,
  messages = [],
  greeting = "",
  suggestions = [],
  showBadge = true,
}: WidgetPanelProps) {
  const onAccent = onColor(color);
  return (
    <div className={PANEL}>
      <WidgetHeader name={name} avatar={avatar} avatarUrl={avatarUrl} color={color} />

      {messages.length === 0 ? (
        <WidgetFirstScreen greeting={greeting} suggestions={suggestions} />
      ) : (
        <Conversation messages={messages} color={color} onAccent={onAccent} />
      )}

      <div className="flex flex-col gap-2 px-3 pb-2.5">
        <div className="flex h-13 items-center gap-1.5 rounded-full border border-(--w-border) bg-(--w-bg) pr-1.5 pl-4.5 shadow-[0_4px_14px_rgba(10,12,16,0.06)]">
          <span className="grow text-[15px] text-(--w-muted)">Type your question…</span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: color, color: onAccent }}>
            <ArrowUp className="size-4.5" strokeWidth={2.4} />
          </span>
        </div>
        {showBadge && <PoweredBy />}
      </div>
    </div>
  );
}

// Before the visitor asks anything: the greeting and suggested questions (buttons when onPick is given).
export function WidgetFirstScreen({
  greeting,
  suggestions,
  onPick,
}: {
  greeting: string;
  suggestions: string[];
  onPick?: (question: string) => void;
}) {
  return (
    <div className="flex min-h-0 grow flex-col gap-4.5 overflow-y-auto px-4 pt-5.5 pb-3">
      <div className="flex flex-col gap-2 px-1">
        <div className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.03em]">
          Hey there.
          <br />
          <span className="text-(--w-muted)">What can I help with?</span>
        </div>
        {greeting && <div className="text-sm leading-normal wrap-break-word text-(--w-muted)">{greeting}</div>}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.map((q, i) => {
            const body = (
              <>
                <span className="grow wrap-break-word">{q}</span>
                <ArrowUpRight className="size-4 shrink-0 text-(--w-muted)" strokeWidth={2} />
              </>
            );
            const className = "flex min-h-12 items-center gap-2.5 rounded-2xl bg-(--w-soft) py-2 pr-3.5 pl-4 text-left text-sm font-semibold";
            return onPick ? (
              <button key={`${q}-${i}`} type="button" onClick={() => onPick(q)} className={`${className} transition-opacity hover:opacity-80`}>
                {body}
              </button>
            ) : (
              <div key={`${q}-${i}`} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Starts at the top while the messages fit; once the panel is shorter than them, the newest
// stay in view and the oldest go under the header, as in a real chat.
function Conversation({ messages, color, onAccent }: { messages: PreviewMessage[]; color: string; onAccent: string }) {
  return (
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
  );
}

// Avatar with the online dot, name, and the close button (a drawing in previews).
export function WidgetHeader({
  name,
  avatar,
  avatarUrl,
  color,
  onClose,
}: {
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  color: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 pt-3.5 pr-3 pb-3 pl-4">
      <div className="relative size-9 shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a remote logo in a static export
          <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-9 items-center justify-center rounded-full text-[15px] font-extrabold"
            style={{ background: color, color: onColor(color) }}
            aria-hidden="true"
          >
            {avatar}
          </div>
        )}
        <span className="absolute -right-px -bottom-px size-2.75 rounded-full border-2 border-(--w-bg) bg-online" />
      </div>
      <div className="flex min-w-0 grow flex-col gap-px">
        <div className="truncate text-[15px] font-extrabold tracking-[-0.01em]">{name}</div>
        <div className="text-xs text-(--w-muted)">Online now</div>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex size-9 items-center justify-center rounded-full bg-(--w-soft) transition-opacity hover:opacity-80"
        >
          <ChevronDown className="size-4.5" strokeWidth={2} />
        </button>
      ) : (
        <>
          <span className="flex size-9 items-center justify-center rounded-full text-(--w-muted)" aria-hidden="true">
            <MoreHorizontal className="size-4.5" />
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-(--w-soft)" aria-hidden="true">
            <ChevronDown className="size-4.5" strokeWidth={2} />
          </span>
        </>
      )}
    </div>
  );
}

// A link to hovr in the live widget; plain text in the previews.
export function PoweredBy({ href }: { href?: string }) {
  const body = (
    <>
      Powered by
      <LogoMark size={14} shadow={false} />
      <span className="font-extrabold text-(--w-ink)">hovr</span>
    </>
  );
  const className = "flex items-center justify-center gap-1.25 text-[11px] font-semibold text-(--w-muted)";
  return href ? (
    <a href={href} target="_blank" rel="noopener" className={`${className} hover:text-(--w-ink)`}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}
