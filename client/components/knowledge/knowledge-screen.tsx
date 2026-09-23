"use client";

import { AlignLeft, MoreHorizontal, Trash2, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { LoadError } from "@/components/app/load-error";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { addText, checkFile, deleteSource, FILE_ACCEPT, formatSize, MAX_TEXT, MAX_TITLE, sourceKind, uploadFile } from "@/lib/sources";
import type { Source } from "@/lib/types";
import { knowledgeField } from "./knowledge-draft";
import { StatusPill } from "./status-pill";
import { useSources } from "./use-sources";

const LEAVE_MS = 200;

const tile = "flex items-center gap-3.5 rounded-[20px] p-4.5 text-left transition-opacity hover:opacity-90";
const tileIcon = "flex size-11 shrink-0 items-center justify-center rounded-[14px]";
const cols = "md:grid md:grid-cols-[2.4fr_1fr_1fr_1fr_1.2fr_44px] md:items-center";

function sizeOf(s: Source): string {
  if (s.pages > 0) return s.pages === 1 ? "1 page" : `${s.pages} pages`;
  return formatSize(s.sizeBytes);
}

// Everything the bot answers from: add files or text, see what's being read and why something failed.
export function KnowledgeScreen() {
  const { bot, billing, reload: reloadApp } = useApp();
  const { sources, error: loadError, reload } = useSources(bot.id);
  const picker = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [pasting, setPasting] = useState(false);
  const [query, setQuery] = useState("");

  function changed() {
    reload();
    reloadApp(); // the plan card and "slots left" count every source
  }

  async function upload(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const failed: string[] = [];
    setProblems([]);
    setUploading(files.length);
    for (const file of files) {
      const problem = checkFile(file);
      if (problem) {
        failed.push(`${file.name}: ${problem}`);
        continue;
      }
      try {
        await uploadFile(bot.id, file);
      } catch (err) {
        failed.push(`${file.name}: ${errorMessage(err)}`);
      }
    }
    setUploading(0);
    setProblems(failed);
    changed();
  }

  const [leaving, setLeaving] = useState<string[]>([]);

  async function remove(s: Source) {
    if (!window.confirm(`Delete “${s.title}”? The bot stops answering from it.`)) return;
    try {
      await deleteSource(bot.id, s.id);
      // The row slides out before the list reloads without it.
      setLeaving((ids) => [...ids, s.id]);
      setTimeout(changed, LEAVE_MS);
    } catch (err) {
      setProblems([errorMessage(err)]);
    }
  }

  const shown = (sources ?? []).filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()));
  const chunks = (sources ?? []).reduce((n, s) => n + s.chunks, 0);
  const slotsLeft = billing ? Math.max(0, billing.limits.sources - billing.usage.sources) : null;

  return (
    <>
      <PageHeader title="Knowledge" sub="Everything the bot is allowed to answer from." />
      <div className="flex min-h-0 grow flex-col gap-4.5 overflow-y-auto px-5 pt-1 pb-5 sm:px-7 sm:pb-7">
        <input
          ref={picker}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={uploading > 0} onClick={() => picker.current?.click()} className={cn(tile, "bg-lime text-on-lime")}>
            <span className={cn(tileIcon, "bg-on-lime/10")}>
              <Upload className="size-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold">{uploading > 0 ? `Uploading ${uploading === 1 ? "1 file" : `${uploading} files`}…` : "Upload files"}</span>
              <span className="text-[13px] leading-snug opacity-75">PDF, Word, Markdown or text, up to 10 MB</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPasting(true);
              setProblems([]);
            }}
            className={cn(tile, "bg-app text-ink")}
          >
            <span className={cn(tileIcon, "bg-surface")}>
              <AlignLeft className="size-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold">Paste text</span>
              <span className="text-[13px] leading-snug opacity-75">Handy for a return policy or opening hours</span>
            </span>
          </button>
        </div>

        {pasting && (
          <PasteText
            botId={bot.id}
            onDone={() => {
              setPasting(false);
              changed();
            }}
            onCancel={() => setPasting(false)}
          />
        )}

        {problems.length > 0 && (
          <Notice tone="bad">
            {problems.map((p) => (
              <span key={p} className="block">
                {p}
              </span>
            ))}
          </Notice>
        )}
        {loadError && <LoadError message={loadError} onRetry={reload} />}
        {!sources && !loadError && (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-14 rounded-[22px]" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}

        {sources && (
          <div className="flex flex-col overflow-hidden rounded-[22px] shadow-[0_0_0_1px_var(--line)]">
            <div className="flex flex-wrap items-center gap-3 px-4.5 py-3.5">
              <span className="grow text-[15px] font-extrabold">
                {sources.length === 1 ? "1 source" : `${sources.length} sources`}{" "}
                <span className="font-semibold text-subtle">
                  · {chunks} chunks
                  {slotsLeft !== null && billing && ` · ${slotsLeft} ${slotsLeft === 1 ? "slot" : "slots"} left on ${billing.planName}`}
                </span>
              </span>
              <label htmlFor="kn-search" className="sr-only">
                Search sources
              </label>
              <input
                id="kn-search"
                type="search"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9.5 w-full rounded-full bg-app px-3.5 text-sm text-ink outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--ink)] sm:w-55"
              />
            </div>
            <div className={cn("hidden bg-app px-4.5 py-2.5 text-xs font-extrabold text-subtle", cols)}>
              <span>Name</span>
              <span>Type</span>
              <span>Size</span>
              <span>Added</span>
              <span>Status</span>
              <span />
            </div>
            {shown.length === 0 && (
              <p className="border-t border-line px-4.5 py-8 text-center text-sm text-subtle">
                {sources.length === 0 ? "Nothing here yet. Upload a file or paste some text." : "No source matches that."}
              </p>
            )}
            <ul>
              {shown.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 border-t border-line px-4.5 py-2.5 text-sm md:min-h-14 md:py-0",
                    leaving.includes(s.id) ? "animate-out fill-mode-forwards duration-200 fade-out-0 slide-out-to-right-6" : "animate-rise",
                    cols,
                  )}
                >
                  <span className="flex min-w-0 grow flex-col gap-0.5 md:pr-3">
                    <span className="truncate font-bold" title={s.title}>
                      {s.title}
                    </span>
                    {s.error && <span className="text-xs text-bad">{s.error}</span>}
                    <span className="text-xs text-subtle md:hidden">
                      {sourceKind(s)} · {sizeOf(s)} · {shortDate(s.createdAt)}
                    </span>
                  </span>
                  <span className="hidden text-subtle md:block">{sourceKind(s)}</span>
                  <span className="hidden text-subtle md:block">{sizeOf(s)}</span>
                  <span className="hidden text-subtle md:block">{shortDate(s.createdAt)}</span>
                  <StatusPill status={s.status} />
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      aria-label={`More for ${s.title}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-subtle outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-3 focus-visible:ring-ink/25"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-[18px]">
                      <DropdownMenuItem onSelect={() => remove(s)} className="text-bad focus:text-bad">
                        <Trash2 className="size-4" strokeWidth={1.9} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function PasteText({ botId, onDone, onCancel }: { botId: string; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await addText(botId, title.trim(), text.trim());
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-[22px] p-4 shadow-[0_0_0_1px_var(--line)]">
      <label htmlFor="paste-title" className="px-1 text-sm font-extrabold">
        Paste text
      </label>
      <input
        id="paste-title"
        required
        placeholder="Title, e.g. Opening hours"
        maxLength={MAX_TITLE}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={cn(knowledgeField, "h-12")}
      />
      <textarea
        aria-label="Text"
        required
        rows={6}
        maxLength={MAX_TEXT}
        placeholder="Paste answers, policies, prices… anything your visitors ask about."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={cn(knowledgeField, "resize-y py-3 leading-normal")}
      />
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={cn(buttonVariants(), "h-10.5 px-4.5 text-sm disabled:opacity-50")}>
          {pending ? "Adding…" : "Add to your bot"}
        </button>
        <button type="button" onClick={onCancel} className="flex h-10.5 items-center rounded-full px-4 text-sm font-bold text-subtle hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
