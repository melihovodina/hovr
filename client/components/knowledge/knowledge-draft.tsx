"use client";

import { FileText, Type, Upload, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { cn } from "cn";
import { errorMessage } from "@/lib/api";
import { addText, checkFile, FILE_ACCEPT, formatSize, MAX_TEXT, MAX_TITLE, uploadFile } from "@/lib/sources";

// Knowledge picked but not sent yet: files and, optionally, one pasted text.
export interface Draft {
  files: File[];
  text: { title: string; body: string } | null;
}

export const EMPTY_DRAFT: Draft = { files: [], text: null };

export function draftSize(d: Draft): number {
  return d.files.length + (d.text ? 1 : 0);
}

// A draft is ready to send when every file passes the checks and the text, if open, is filled in.
export function draftProblem(d: Draft): string | null {
  if (d.files.some((f) => checkFile(f))) return "Remove the files that can’t be added.";
  if (d.text && (!d.text.title.trim() || !d.text.body.trim())) return "Give the pasted text a title and some content.";
  return null;
}

export interface Failure {
  name: string;
  error: string;
}

// Sends the draft one item at a time and returns what didn't go through (plan limits, bad files...).
export async function saveDraft(botId: string, d: Draft): Promise<Failure[]> {
  const failures: Failure[] = [];
  for (const file of d.files) {
    try {
      await uploadFile(botId, file);
    } catch (err) {
      failures.push({ name: file.name, error: errorMessage(err) });
    }
  }
  if (d.text) {
    try {
      await addText(botId, d.text.title.trim(), d.text.body.trim());
    } catch (err) {
      failures.push({ name: d.text.title.trim(), error: errorMessage(err) });
    }
  }
  return failures;
}

const tile =
  "flex w-full items-center gap-3 rounded-[20px] bg-app p-4 text-left text-ink transition-colors hover:bg-surface-2";
const tileIcon = "flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface";
// The text inputs for pasted knowledge, here and on the Knowledge screen.
export const knowledgeField =
  "w-full rounded-[18px] bg-app px-4.5 text-[15px] text-ink outline-none placeholder:text-subtle focus-visible:shadow-[0_0_0_2px_var(--ink)]";

export function KnowledgeDraft({ value, onChange, disabled }: { value: Draft; onChange: (d: Draft) => void; disabled?: boolean }) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    // The same file picked twice is added once.
    const known = new Set(value.files.map((f) => `${f.name}:${f.size}`));
    const fresh = Array.from(list).filter((f) => !known.has(`${f.name}:${f.size}`));
    onChange({ ...value, files: [...value.files, ...fresh] });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) addFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={picker}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => picker.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(tile, dragging && "shadow-[0_0_0_2px_var(--ink)]")}
      >
        <span className={tileIcon}>
          <Upload className="size-4.5" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-extrabold">Upload files</span>
          <span className="text-xs text-subtle">PDF, Word, Markdown or text, up to 10 MB. Drop them here or click.</span>
        </span>
      </button>

      {value.files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.files.map((file, i) => {
            const problem = checkFile(file);
            return (
              <li key={`${file.name}:${file.size}`} className="flex min-h-12 items-center gap-3 rounded-[14px] px-3 shadow-[0_0_0_1px_var(--line)]">
                <FileText className="size-4 shrink-0 text-subtle" strokeWidth={2} aria-hidden="true" />
                <span className="flex min-w-0 grow flex-col py-1.5">
                  <span className="truncate text-sm font-semibold">{file.name}</span>
                  <span className={cn("text-xs", problem ? "font-semibold text-bad" : "text-subtle")}>{problem ?? formatSize(file.size)}</span>
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onChange({ ...value, files: value.files.filter((_, n) => n !== i) })}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {value.text ? (
        <div className="flex flex-col gap-2 rounded-[20px] p-3 shadow-[0_0_0_1px_var(--line)]">
          <div className="flex items-center justify-between gap-2 px-1">
            <label htmlFor={`${id}-title`} className="text-sm font-extrabold">
              Pasted text
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, text: null })}
              className="text-[13px] font-bold text-subtle hover:text-ink"
            >
              Remove
            </button>
          </div>
          <input
            id={`${id}-title`}
            placeholder="Title, e.g. Opening hours"
            maxLength={MAX_TITLE}
            disabled={disabled}
            value={value.text.title}
            onChange={(e) => onChange({ ...value, text: { ...value.text!, title: e.target.value } })}
            className={cn(knowledgeField, "h-12")}
          />
          <textarea
            aria-label="Text"
            placeholder="Paste answers, policies, prices… anything your visitors ask about."
            rows={5}
            maxLength={MAX_TEXT}
            disabled={disabled}
            value={value.text.body}
            onChange={(e) => onChange({ ...value, text: { ...value.text!, body: e.target.value } })}
            className={cn(knowledgeField, "resize-y py-3 leading-normal")}
          />
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => onChange({ ...value, text: { title: "", body: "" } })} className={tile}>
          <span className={tileIcon}>
            <Type className="size-4.5" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold">Paste some text</span>
            <span className="text-xs text-subtle">FAQs, policies, prices: anything that isn’t in a file.</span>
          </span>
        </button>
      )}
    </div>
  );
}
