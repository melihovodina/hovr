import { cn } from "cn";
import { Copy, MessageSquare, Upload } from "lucide-react";
import { SETUP_STEPS } from "@/lib/landing";
import { SITE_URL } from "@/lib/site";
import { SetupTabs } from "./setup-tabs";

const FILES = [
  { name: "FAQ.pdf", state: "Done", done: true },
  { name: "Return policy.docx", state: "Done", done: true },
  { name: "Shipping.md", state: "Reading…", done: false },
  { name: "Opening hours", state: "Waiting", done: false },
];

const PLATFORMS = ["Shopify", "WordPress", "Wix", "Webflow", "Plain HTML"];

function StepContent() {
  return (
    <div className="flex max-w-[520px] flex-col gap-4">
      <div className="flex h-14 items-center gap-2 rounded-full border border-line bg-surface pr-1.5 pl-5">
        <span className="grow truncate text-base text-subtle">Drop PDFs, Word or text files here</span>
        <span className="flex h-11 items-center gap-2 rounded-full bg-ink px-[18px] text-[15px] font-extrabold text-page">
          <Upload className="size-4" strokeWidth={2.4} />
          Upload
        </span>
      </div>
      <div className="text-sm font-bold text-subtle">4 sources added, reading them now</div>
      {FILES.map((f) => (
        <div key={f.name} className="flex h-12 items-center gap-3 rounded-[14px] bg-surface px-4 text-[15px]">
          <span className="grow truncate">{f.name}</span>
          <span className={cn("text-[13px] font-bold", f.done ? "text-lime-ink" : "text-subtle")}>{f.state}</span>
        </div>
      ))}
    </div>
  );
}

function StepBrand() {
  const pill = "flex h-8 items-center rounded-full border border-line bg-surface px-3 text-[13px] font-bold";
  return (
    <div className="flex flex-col gap-10 md:flex-row md:items-center md:gap-12">
      <div className="flex w-full flex-col gap-4 md:w-[320px]">
        <div className="text-sm font-bold text-subtle">Color</div>
        <div className="flex gap-2.5">
          <span className="size-11 rounded-full bg-[#2F6B4F] shadow-[0_0_0_3px_var(--page),0_0_0_5px_var(--ink)]" />
          <span className="size-11 rounded-full bg-[#1F4FD1]" />
          <span className="size-11 rounded-full bg-[#B4441F]" />
          <span className="size-11 rounded-full bg-[#16161A]" />
        </div>
        <div className="text-sm font-bold text-subtle">Hello message</div>
        <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5 text-[15px] leading-normal">
          Ask me about orders, shipping or our coffee.
        </div>
        <div className="text-sm font-bold text-subtle">Suggested questions</div>
        <div className="flex flex-wrap gap-1.5">
          <span className={pill}>Do you ship to Canada?</span>
          <span className={pill}>Pause my subscription</span>
        </div>
      </div>
      <div className="flex grow flex-col items-end gap-3">
        <div className="flex w-[270px] max-w-full flex-col gap-2.5 rounded-[22px_22px_6px_22px] bg-white p-4 text-[#17171B] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.3)]">
          <span className="text-sm leading-normal">Hey there. Ask me about orders, shipping or our coffee.</span>
          <span className="flex h-[30px] items-center self-start rounded-full bg-[#F3F3F1] px-3 text-xs font-bold">
            Do you ship to Canada?
          </span>
        </div>
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#2F6B4F] text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)]">
          <MessageSquare className="size-[26px]" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

function StepInstall() {
  return (
    <div className="flex flex-col gap-[18px]">
      <pre className="overflow-x-auto rounded-[18px] bg-[#111215] px-6 py-[22px] font-mono text-[13px] leading-[1.7] whitespace-pre-wrap text-[#E9E8E3] sm:text-[15px]">
        {`<script src="${SITE_URL}/widget.js"\n        data-bot="`}
        <span className="text-lime">pub_7fK2qLx9</span>
        {`" defer></script>`}
      </pre>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex h-10 items-center gap-2 self-start rounded-full bg-ink px-4 text-sm font-extrabold text-page">
          <Copy className="size-[15px]" strokeWidth={2.2} />
          Copy
        </span>
        <span className="text-[15px] text-subtle">Paste it before &lt;/body&gt;, or into the “custom code” box your site builder has.</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <span key={p} className="flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-bold">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Setup() {
  return (
    <section id="setup" className="scroll-mt-28 px-4 sm:px-8 lg:px-16">
      <div className="mx-auto flex max-w-[1312px] flex-col gap-10 rounded-[36px] border border-line bg-surface px-6 py-12 sm:px-12 lg:gap-12 lg:px-[72px] lg:py-[88px]">
        <h2 className="max-w-[820px] text-[36px] leading-[1.06] font-extrabold tracking-[-0.04em] sm:text-[44px] lg:text-[52px]">
          Setting it up takes about as long as making a coffee.
        </h2>
        <SetupTabs steps={SETUP_STEPS} panels={[<StepContent key="content" />, <StepBrand key="brand" />, <StepInstall key="install" />]} />
      </div>
    </section>
  );
}
