import { Fragment } from "react";

// Answers carry [n] markers that point at citations; they are shown as small numbers.
const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

export function AnswerText({ text }: { text: string }) {
  const parts = text.split(MARKER);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <sup key={i} className="ml-0.5 text-[11px] font-extrabold text-subtle">
            {part.replace(/\s/g, "")}
          </sup>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// A blinking bar after text that is still being written.
export function Caret() {
  return <span aria-hidden="true" className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[0.2em] animate-caret rounded-full bg-current" />;
}
