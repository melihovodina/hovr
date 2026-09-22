import { Lock } from "lucide-react";
import { LandingSection } from "./section";

const card = "flex min-h-80 flex-col justify-between gap-3 rounded-[26px] p-7.5";
const plain = `${card} border border-line bg-surface`;
const title = "text-[22px] font-extrabold tracking-[-0.02em]";
const sent = "self-end rounded-[18px_18px_6px_18px] bg-ink px-3.25 py-2.25 text-sm text-page";
const got = "self-start rounded-[18px_18px_18px_6px] bg-surface-2 px-3.25 py-2.25 text-sm leading-[1.45]";

const TOP = [
  { q: "Shipping to Canada", n: 38, w: "100%" },
  { q: "Pausing a subscription", n: 29, w: "76%" },
  { q: "Best roast for espresso", n: 22, w: "58%" },
];

export function Features() {
  return (
    <LandingSection id="features" title="The little things that make it feel like a real person helped" titleClassName="max-w-190">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className={`${plain} md:col-span-2`}>
          <div className="flex flex-col gap-2.5">
            <div className="max-w-110 rounded-[20px_20px_20px_6px] bg-surface-2 px-4 py-3 text-base leading-normal">
              Yes, you can send it back within 30 days. The return label is in your order email.
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="flex h-7.5 items-center rounded-full border border-line px-3 text-[13px] font-bold">Return policy.docx</span>
              <span className="flex h-7.5 items-center rounded-full border border-line px-3 text-[13px] font-bold">FAQ.pdf</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className={title}>It shows where the answer came from</h3>
            <p className="text-base leading-[1.55] text-subtle">
              Every answer names the document it used. That’s a lot easier to trust than a bot that just sounds confident.
            </p>
          </div>
        </div>

        <div className={`${card} bg-lime text-on-lime`}>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold text-on-lime/60">Sunday, 3:12 AM</span>
            <span className="self-end rounded-[18px_18px_6px_18px] bg-on-lime px-3.25 py-2.25 text-sm text-paper">
              is the espresso blend ok for filter?
            </span>
            <span className="self-start rounded-[18px_18px_18px_6px] bg-on-lime/8 px-3.25 py-2.25 text-sm leading-[1.45]">
              It is. Grind it a bit coarser and it makes a rich, chocolatey filter cup.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className={title}>It’s up when you’re not</h3>
            <p className="text-[15px] leading-[1.55] text-on-lime/72">Nights, weekends, holidays.</p>
          </div>
        </div>

        <div className={plain}>
          <div className="flex flex-col gap-2">
            <span className={sent}>Do you ship to Canada?</span>
            <span className={got}>We do, right across Canada.</span>
            <span className={sent}>ok and how long?</span>
            <span className={got}>5 to 8 business days.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className={title}>It follows along</h3>
            <p className="text-[15px] leading-[1.55] text-subtle">“And how long?” just works.</p>
          </div>
        </div>

        <div className={`${card} bg-night text-paper md:col-span-2`}>
          <div className="flex flex-col gap-3 rounded-[18px] border border-night-line bg-night-raised p-4.5">
            {TOP.map((t) => (
              <div key={t.q} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>{t.q}</span>
                  <span className="font-extrabold">{t.n}</span>
                </div>
                <div className="h-1.5 rounded-full bg-night-line">
                  <div className="h-full rounded-full bg-lime" style={{ width: t.w }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className={title}>You’ll see what people actually ask</h3>
            <p className="text-base leading-[1.55] text-night-subtle">
              Your dashboard shows the most common questions, so you know what your customers care about.
            </p>
          </div>
        </div>

        <div className={plain}>
          <div className="flex flex-col gap-2">
            <span className={sent}>¿Hacen envíos a Canadá?</span>
            <span className={got}>¡Sí! Tarda de 5 a 8 días hábiles.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className={title}>It speaks their language</h3>
            <p className="text-[15px] leading-[1.55] text-subtle">Even if your documents are only in English.</p>
          </div>
        </div>

        <div className={plain}>
          <div className="flex flex-col gap-2">
            <span className="flex h-8.5 items-center gap-2 self-start rounded-[10px] bg-surface-2 px-3 text-sm font-bold">
              <Lock className="size-3.5" strokeWidth={2.2} />
              northwind.example
            </span>
            <span className="flex h-8.5 items-center self-start rounded-[10px] border border-dashed border-line px-3 text-sm text-subtle line-through">
              copycat-site.com
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className={title}>It only runs on your site</h3>
            <p className="text-[15px] leading-[1.55] text-subtle">Nobody else can use up your messages.</p>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
