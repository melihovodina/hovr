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

export function Hero() {
  return (
    <section id="top" className="px-4 pb-20 sm:px-8 md:pb-[120px] lg:px-16">
      <div className="mx-auto flex max-w-[1312px] flex-col overflow-hidden rounded-[28px] border border-line bg-surface wide:h-[760px]">
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
          <div className="flex h-[72px] items-center gap-7 border-b border-line px-6 sm:pr-12 sm:pl-[72px]" aria-hidden="true">
            <span className="flex grow items-center gap-2.5">
              <Skel className="size-7 rounded-lg" />
              <Skel className="h-3 w-24" />
            </span>
            <Skel className="hidden h-2.5 w-14 sm:block" />
            <Skel className="hidden h-2.5 w-16 sm:block" />
            <Skel className="hidden h-2.5 w-12 sm:block" />
            <span className="h-9 w-[110px] rounded-full border border-line" />
          </div>

          <div className="hidden wide:absolute wide:top-[112px] wide:left-[760px] wide:flex wide:w-[320px] wide:flex-col wide:gap-3.5" aria-hidden="true">
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
          <div className="hidden wide:absolute wide:top-[584px] wide:left-[72px] wide:grid wide:w-[680px] wide:grid-cols-4 wide:gap-3" aria-hidden="true">
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

          <div className="flex flex-col gap-12 px-6 py-10 sm:px-[72px] sm:py-14 wide:contents">
            <div className="flex max-w-[640px] flex-col gap-6 wide:absolute wide:top-[118px] wide:left-[72px] wide:w-[640px]">
              <h1 className="text-[40px] leading-[1.15] font-extrabold tracking-[-0.045em] sm:text-[52px] lg:text-[60px] lg:leading-[1.2]">
                A chat on your site that{" "}
                <span className="inline-block rounded-[14px] bg-lime px-3 pt-0.5 pb-1.5 leading-none whitespace-nowrap text-on-lime">
                  actually knows
                </span>{" "}
                your business.
              </h1>
              <p className="max-w-[560px] text-[17px] leading-relaxed text-subtle sm:text-lg">
                Give hovr a few documents: PDFs, Word files or pasted text. It reads them and answers your visitors’
                questions in a little chat bubble, day and night. If it doesn’t know something, it says so and takes their
                email.
              </p>
              <div className="flex items-center gap-6">
                <Link
                  href="/signup"
                  className="flex h-[60px] items-center gap-4 rounded-full bg-ink pr-2 pl-[26px] text-[17px] font-extrabold text-page transition-opacity hover:opacity-90"
                >
                  Build my bot, it’s free
                  <ArrowBadge size={44} />
                </Link>
              </div>
            </div>
            <div className="flex justify-center wide:absolute wide:top-24 wide:right-[72px]">
              <WidgetPanel name="hovr" avatar="h" color="#C8F547" greeting="" messages={HERO_CHAT} theme="auto" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
