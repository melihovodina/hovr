import Link from "next/link";
import { Lock } from "lucide-react";
import { ArrowBadge } from "@/components/brand";
import { WidgetPanel, type PreviewMessage } from "@/components/widget-panel";

const HERO_CHAT: PreviewMessage[] = [
  { kind: "user", text: "Can it learn from my help docs?" },
  { kind: "bot", text: "Yes. Upload your PDFs or Word files, or paste some text. It reads them and answers from them." },
  { kind: "source", text: "Adding knowledge" },
  { kind: "user", text: "nice, how long does that take?" },
  { kind: "bot", text: "A minute or two for most files. You can start chatting with your bot as soon as the first ones are in." },
  { kind: "source", text: "Getting started" },
];

function Skel({ className }: { className: string }) {
  return <span className={`block rounded-md bg-skel ${className}`} />;
}

// Below `wide` the copy sits above a smaller site mock (hidden on phones); from `wide` up it is laid over the mock as in the design.
export function Hero() {
  return (
    <section id="top" className="px-4 pb-16 sm:px-8 md:pb-24 lg:px-16 wide:pb-[120px]">
      <div className="relative mx-auto flex max-w-[1312px] flex-col gap-10 md:gap-12">
        <div className="flex max-w-[640px] flex-col gap-6 pt-2 wide:absolute wide:top-[167px] wide:left-[73px] wide:z-10 wide:w-[640px] wide:pt-0">
          <h1 className="text-[36px] leading-[1.18] font-extrabold tracking-[-0.045em] text-balance sm:text-[52px] lg:text-[60px] lg:leading-[1.2]">
            A chat on your site that{" "}
            <span className="inline-block rounded-[14px] bg-lime px-3 pt-0.5 pb-1.5 leading-none whitespace-nowrap text-on-lime">
              actually knows
            </span>{" "}
            your business
          </h1>
          <p className="max-w-[560px] text-[17px] leading-relaxed text-subtle sm:text-lg">
            Give hovr a few documents: PDFs, Word files or pasted text. It reads them and answers your visitors’ questions
            in a little chat bubble.
          </p>
          <Link
            href="/signup"
            className="flex h-[60px] items-center justify-between gap-4 self-stretch rounded-full bg-ink pr-2 pl-[26px] text-[17px] font-extrabold text-page transition-opacity hover:opacity-90 sm:self-start"
          >
            Build your bot
            <ArrowBadge size={44} />
          </Link>
        </div>

        <div
          className="hidden h-[680px] flex-col overflow-hidden rounded-[28px] border border-line bg-surface md:flex wide:h-[760px]"
          aria-hidden="true"
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-[18px]">
            <span className="size-3 rounded-full bg-dot" />
            <span className="size-3 rounded-full bg-dot" />
            <span className="size-3 rounded-full bg-dot" />
            <span className="ml-4 flex h-7 w-[360px] max-w-[60%] items-center gap-2 rounded-[9px] bg-surface px-3.5 text-[13px] text-subtle">
              <Lock className="size-3" strokeWidth={2.4} />
              yourstore.com
            </span>
          </div>

          <div className="relative min-h-0 grow">
            <div className="flex h-[72px] items-center gap-7 border-b border-line pr-12 pl-[72px]">
              <span className="flex grow items-center gap-2.5">
                <Skel className="size-7 rounded-lg" />
                <Skel className="h-3 w-24" />
              </span>
              <Skel className="h-2.5 w-14" />
              <Skel className="h-2.5 w-16" />
              <Skel className="h-2.5 w-12" />
              <span className="h-9 w-[110px] rounded-full border border-line" />
            </div>

            {/* The store's own page, visible around the chat. */}
            <div className="flex w-[calc(100%-420px)] flex-col gap-3.5 p-12 wide:hidden">
              <Skel className="h-3 w-[120px]" />
              <Skel className="h-[26px] w-full max-w-[300px] rounded-lg" />
              <Skel className="h-2.5 w-full max-w-[320px]" />
              <Skel className="h-2.5 w-4/5 max-w-[260px]" />
              <div className="mt-3 grid max-w-[300px] grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skel key={i} className="h-[90px] rounded-xl" />
                ))}
              </div>
            </div>
            <div className="absolute top-[112px] left-[760px] hidden w-[320px] flex-col gap-3.5 wide:flex">
              <Skel className="h-3 w-[120px]" />
              <Skel className="h-[26px] w-[300px] rounded-lg" />
              <Skel className="h-2.5 w-[320px]" />
              <Skel className="h-2.5 w-[260px]" />
              <div className="mt-3 grid w-[300px] grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skel key={i} className="h-[90px] rounded-xl" />
                ))}
              </div>
            </div>
            <div className="absolute top-[584px] left-[72px] hidden w-[680px] grid-cols-4 gap-3 wide:grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-[76px] items-center gap-2.5 rounded-xl bg-skel px-3.5">
                  <span className="size-7 shrink-0 rounded-lg bg-surface" />
                  <span className="flex grow flex-col gap-[7px]">
                    <span className="h-2 w-4/5 rounded bg-surface" />
                    <span className="h-2 w-[55%] rounded bg-surface" />
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute top-6 right-6 bottom-6 w-[360px] wide:top-24 wide:right-[72px] wide:bottom-auto wide:h-[600px]">
              <WidgetPanel
                name="hovr"
                avatar="h"
                color="#C8F547"
                greeting="" messages={HERO_CHAT}
                theme="auto"
                fill
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
