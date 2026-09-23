import { cn } from "cn";
import { Lock } from "lucide-react";
import { ArrowLink } from "./arrow-link";
import { WidgetPanel, type PreviewMessage } from "@/components/widget-panel";
import { GUTTERS } from "./section";

const HERO_CHAT: PreviewMessage[] = [
  { kind: "user", text: "Can it learn from my help docs?" },
  { kind: "bot", text: "Yes. Upload your PDFs or Word files, or paste some text. It reads them and answers from them." },
  { kind: "user", text: "nice, how long does that take?" },
  { kind: "bot", text: "A minute or two for most files. You can start chatting with your bot as soon as the first ones are in." },
];

function Skel({ className }: { className: string }) {
  return <span className={`block rounded-md bg-skel ${className}`} />;
}

// Below `wide` the copy sits above a smaller site mock (hidden on phones). From `wide` it is laid over the mock,
// which takes the window height (600-760px) so the first screen fits; the filler cards need a `tall` window.
export function Hero() {
  return (
    <section id="top" className={cn("pb-16 md:pb-24 wide:pb-30", GUTTERS)}>
      <div className="relative mx-auto flex max-w-328 flex-col gap-10 md:gap-12">
        <div className="flex max-w-160 flex-col gap-6 pt-2 wide:absolute wide:top-41.75 wide:left-18.25 wide:z-10 wide:w-160 wide:pt-0">
          <h1 className="text-[36px] leading-[1.18] font-extrabold tracking-[-0.045em] text-balance sm:text-[52px] lg:text-[60px] lg:leading-[1.2]">
            A chat on your site that{" "}
            <span className="inline-block rounded-[14px] bg-lime px-3 pt-0.5 pb-1.5 leading-none whitespace-nowrap text-on-lime">
              actually knows
            </span>{" "}
            your business
          </h1>
          <p className="max-w-140 text-[17px] leading-relaxed text-subtle sm:text-lg">
            Give hovr a few documents: PDFs, Word files or pasted text. It reads them and answers questions from your
            visitors in a little chat bubble.
          </p>
          <ArrowLink href="/signup" size="lg" className="self-stretch sm:self-start">
            Build your bot
          </ArrowLink>
        </div>

        <div
          className="hidden h-170 flex-col overflow-hidden rounded-3xl border border-line bg-surface md:flex wide:h-[clamp(37.5rem,calc(100svh-8.5rem),47.5rem)]"
          aria-hidden="true"
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-4.5">
            <span className="size-3 rounded-full bg-dot" />
            <span className="size-3 rounded-full bg-dot" />
            <span className="size-3 rounded-full bg-dot" />
            <span className="ml-4 flex h-7 w-90 max-w-[60%] items-center gap-2 rounded-[9px] bg-surface px-3.5 text-[13px] text-subtle">
              <Lock className="size-3" strokeWidth={2.4} />
              yourstore.com
            </span>
          </div>

          <div className="relative min-h-0 grow">
            <div className="flex h-18 items-center gap-7 border-b border-line pr-12 pl-18">
              <span className="flex grow items-center gap-2.5">
                <Skel className="size-7 rounded-lg" />
                <Skel className="h-3 w-24" />
              </span>
              <Skel className="h-2.5 w-14" />
              <Skel className="h-2.5 w-16" />
              <Skel className="h-2.5 w-12" />
              <span className="h-9 w-27.5 rounded-full border border-line" />
            </div>

            {/* The store's own page, visible around the chat. */}
            <div className="flex w-[calc(100%-420px)] flex-col gap-3.5 p-12 wide:hidden">
              <Skel className="h-3 w-30" />
              <Skel className="h-6.5 w-full max-w-75 rounded-lg" />
              <Skel className="h-2.5 w-full max-w-[320px]" />
              <Skel className="h-2.5 w-4/5 max-w-65" />
              <div className="mt-3 grid max-w-75 grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skel key={i} className="h-22.5 rounded-xl" />
                ))}
              </div>
            </div>
            <div className="absolute top-28 left-190 hidden w-[320px] flex-col gap-3.5 wide:flex">
              <Skel className="h-3 w-30" />
              <Skel className="h-6.5 w-75 rounded-lg" />
              <Skel className="h-2.5 w-[320px]" />
              <Skel className="h-2.5 w-65" />
              <div className="mt-3 grid w-75 grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skel key={i} className="h-22.5 rounded-xl" />
                ))}
              </div>
            </div>
            <div className="absolute bottom-8 left-18 hidden w-170 grid-cols-4 gap-3 wide:tall:grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-19 items-center gap-2.5 rounded-xl bg-skel px-3.5">
                  <span className="size-7 shrink-0 rounded-lg bg-surface" />
                  <span className="flex grow flex-col gap-1.75">
                    <span className="h-2 w-4/5 rounded bg-surface" />
                    <span className="h-2 w-[55%] rounded bg-surface" />
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute top-6 right-6 bottom-6 w-90 wide:top-24 wide:right-18">
              <WidgetPanel name="hovr" avatar="h" color="#C8F547" messages={HERO_CHAT} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
