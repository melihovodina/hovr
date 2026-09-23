import type { ReactNode } from "react";

// Title row at the top of the main panel; `aside` sits on the right (status, actions).
export function PageHeader({ title, sub, aside }: { title: string; sub: string; aside?: ReactNode }) {
  return (
    <header className="flex min-h-19 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-7">
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">{title}</h1>
        <p className="text-sm text-subtle">{sub}</p>
      </div>
      {aside}
    </header>
  );
}

