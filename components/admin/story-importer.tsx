"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import {
  htmlToStory,
  markdownToStory,
  textToStory,
  wordCount,
  type ParsedStory,
} from "@/lib/story-import";
import type { ActionResult } from "@/server/admin/errors";
import { Panel, inputClass, primaryButton, secondaryButton } from "./ui";

type Item = {
  key: string;
  fileName: string;
  title: string;
  html: string;
  words: number;
  status: "ready" | "saving" | "done" | "error";
  message?: string;
  id?: string;
};

const MAX_FILES = 50;
const MAX_BYTES = 5 * 1024 * 1024;

async function parseFile(file: File): Promise<ParsedStory> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    return htmlToStory(value);
  }
  const text = await file.text();
  if (name.endsWith(".md") || name.endsWith(".markdown"))
    return markdownToStory(text);
  if (name.endsWith(".html") || name.endsWith(".htm")) return htmlToStory(text);
  return textToStory(text);
}

const fallbackTitle = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

/**
 * Brings several finished stories in at once (Word .docx, Markdown, plain text or HTML).
 * Each becomes a draft to review in the editor; nothing is published from here.
 */
export function StoryImporter({
  importOne,
}: {
  importOne: (input: unknown) => Promise<ActionResult<{ id?: string }>>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const authorId = useId();
  const [author, setAuthor] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [authorError, setAuthorError] = useState<string | null>(null);

  async function choose(files: FileList | null) {
    if (!files?.length) return;
    const issues: string[] = [];
    const next: Item[] = [];
    for (const f of [...files].slice(0, MAX_FILES)) {
      if (f.size > MAX_BYTES) {
        issues.push(`${f.name}: larger than 5 MB.`);
        continue;
      }
      try {
        const p = await parseFile(f);
        const words = wordCount(p.html);
        if (!words) {
          issues.push(`${f.name}: no text found.`);
          continue;
        }
        next.push({
          key: `${f.name}-${f.lastModified}-${Math.random()}`,
          fileName: f.name,
          title: (p.title ?? fallbackTitle(f.name)).slice(0, 160),
          html: p.html,
          words,
          status: "ready",
        });
      } catch {
        issues.push(
          `${f.name}: this file could not be read. Save it as .docx, .md or .txt and try again.`,
        );
      }
    }
    if (files.length > MAX_FILES)
      issues.push(`Only the first ${MAX_FILES} files were taken.`);
    setProblems(issues);
    setItems((cur) => [...cur.filter((i) => i.status !== "done"), ...next]);
  }

  async function run() {
    if (!author.trim())
      return setAuthorError(
        "Enter the author's name. It is shown on every story.",
      );
    setAuthorError(null);
    setBusy(true);
    for (const it of items.filter(
      (i) => i.status === "ready" || i.status === "error",
    )) {
      setItems((cur) =>
        cur.map((x) => (x.key === it.key ? { ...x, status: "saving" } : x)),
      );
      const r = await importOne({
        authorName: author,
        items: [{ title: it.title, body: it.html, fileName: it.fileName }],
      });
      setItems((cur) =>
        cur.map((x) =>
          x.key === it.key
            ? {
                ...x,
                status: r.ok ? "done" : "error",
                message: r.ok ? undefined : r.message,
                id: r.ok ? r.data?.id : undefined,
              }
            : x,
        ),
      );
    }
    setBusy(false);
  }

  const pending = items.filter(
    (i) => i.status === "ready" || i.status === "error",
  ).length;
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="1. Files"
        note="Word (.docx), Markdown (.md), plain text (.txt) or HTML. Up to 50 at a time. The first heading (or a short first line) becomes the title; you can change it below."
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".docx,.md,.markdown,.txt,.html,.htm"
          className="hidden"
          aria-label="Choose story files"
          onChange={(e) => {
            void choose(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={`${secondaryButton} self-start`}
        >
          Choose files
        </button>
        {problems.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 text-xs text-alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </Panel>

      {items.length > 0 && (
        <Panel
          title="2. Check titles"
          note="Each story is created as a draft. Open it afterwards to add the cover, synopsis and categories, then publish."
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor={authorId}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
            >
              Author (for all stories in this import)
            </label>
            <input
              id={authorId}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={120}
              aria-invalid={authorError ? true : undefined}
              aria-describedby={authorError ? `${authorId}-err` : undefined}
              className={`${inputClass} max-w-sm`}
            />
            {authorError && (
              <p id={`${authorId}-err`} className="text-xs text-alert">
                {authorError}
              </p>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {items.map((it, n) => (
              <li
                key={it.key}
                className="flex flex-wrap items-center gap-3 py-3 text-sm"
              >
                <label className="sr-only" htmlFor={`imp-${n}`}>
                  Title for {it.fileName}
                </label>
                <input
                  id={`imp-${n}`}
                  value={it.title}
                  disabled={it.status !== "ready" && it.status !== "error"}
                  maxLength={160}
                  onChange={(e) =>
                    setItems((cur) =>
                      cur.map((x) =>
                        x.key === it.key ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                  className={`${inputClass} min-w-56 flex-1`}
                />
                <span
                  className="w-40 truncate text-xs text-muted"
                  title={it.fileName}
                >
                  {it.fileName} · {it.words.toLocaleString("en-US")} words
                </span>
                <span className="w-32 text-right font-mono text-[10px] uppercase tracking-[0.14em]">
                  {it.status === "ready" && (
                    <button
                      type="button"
                      onClick={() =>
                        setItems((cur) => cur.filter((x) => x.key !== it.key))
                      }
                      className="text-muted underline"
                    >
                      Remove
                    </button>
                  )}
                  {it.status === "saving" && (
                    <span className="text-muted">Saving…</span>
                  )}
                  {it.status === "done" && it.id && (
                    <Link
                      href={`/admin/sci-fi/${it.id}`}
                      className="text-signal-ink underline"
                    >
                      Draft created
                    </Link>
                  )}
                  {it.status === "error" && (
                    <span className="normal-case tracking-normal text-alert">
                      {it.message}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={busy || pending === 0}
              onClick={() => void run()}
              className={primaryButton}
            >
              {busy
                ? "Importing…"
                : `Import ${pending} as draft${pending === 1 ? "" : "s"}`}
            </button>
            <p role="status" className="text-sm text-muted">
              {done > 0 && `${done} draft${done === 1 ? "" : "s"} created.`}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
