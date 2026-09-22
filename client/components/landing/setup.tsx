import { cn } from "cn";
import { SETUP_STEPS } from "@/lib/landing";
import { SITE_URL } from "@/lib/site";
import { LandingSection } from "./section";
import { SetupBrand } from "./setup-brand";
import { SetupInstall } from "./setup-install";
import { SetupSteps } from "./setup-steps";

type Status = "ready" | "reading" | "queued";

const SOURCES: { name: string; kind: string; status: Status }[] = [
  { name: "FAQ.pdf", kind: "PDF", status: "ready" },
  { name: "Return policy.docx", kind: "Word", status: "ready" },
  { name: "Shipping.md", kind: "Markdown", status: "reading" },
  { name: "Opening hours", kind: "Text", status: "queued" },
];

const STATUS: Record<Status, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-ok-soft text-ok" },
  reading: { label: "Reading", className: "bg-info-soft text-info" },
  queued: { label: "In line", className: "bg-idle-soft text-idle" },
};

// Static example of the sources list: what a bot's knowledge looks like while it reads.
function SourcesPreview() {
  return (
    <div className="flex max-w-130 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-extrabold">4 sources</span>
        <span className="text-[13px] text-subtle">PDF, Word, Markdown or text, up to 10 MB</span>
      </div>
      <ul className="flex flex-col gap-2">
        {SOURCES.map((s) => (
          <li key={s.name} className="flex h-12 items-center gap-3 rounded-[14px] bg-surface px-4 text-[15px]">
            <span className="min-w-0 grow truncate font-semibold">{s.name}</span>
            <span className="hidden text-[13px] text-subtle sm:inline">{s.kind}</span>
            <span className={cn("flex h-6.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold", STATUS[s.status].className)}>
              <span className={cn("size-1.5 rounded-full bg-current", s.status === "reading" && "animate-pulse")} />
              {STATUS[s.status].label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Setup() {
  return (
    <LandingSection id="setup" title="Setting it up takes a few minutes" titleClassName="max-w-205">
      <SetupSteps
        steps={SETUP_STEPS}
        panels={[<SetupBrand key="brand" />, <SourcesPreview key="content" />, <SetupInstall key="install" siteUrl={SITE_URL} />]}
      />
    </LandingSection>
  );
}
