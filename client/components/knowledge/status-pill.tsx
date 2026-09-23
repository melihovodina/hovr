import { cn } from "cn";
import type { SourceStatus } from "@/lib/types";

const STATUS: Record<SourceStatus, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-ok-soft text-ok" },
  processing: { label: "Reading", className: "bg-info-soft text-info" },
  queued: { label: "In line", className: "bg-idle-soft text-idle" },
  failed: { label: "Failed", className: "bg-bad-soft text-bad" },
};

export function StatusPill({ status }: { status: SourceStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("flex h-6.5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold", s.className)}>
      <span className={cn("size-1.5 rounded-full bg-current", status === "processing" && "animate-pulse")} aria-hidden="true" />
      {s.label}
    </span>
  );
}
