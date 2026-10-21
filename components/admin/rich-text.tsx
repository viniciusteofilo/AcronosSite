"use client";

import { useEffect, useRef, useState } from "react";

const ALLOWED = new Set(["P", "H2", "H3", "EM", "STRONG", "BLOCKQUOTE", "UL", "OL", "LI", "BR", "HR", "A"]);
const TOOLS: [name: string, glyph: string, command: string, arg?: string][] = [
  ["Paragraph", "¶", "formatBlock", "<p>"],
  ["Heading", "H2", "formatBlock", "<h2>"],
  ["Subheading", "H3", "formatBlock", "<h3>"],
  ["Bold", "B", "bold"],
  ["Italic", "I", "italic"],
  ["Quote", "❝", "formatBlock", "<blockquote>"],
  ["Bulleted list", "•", "insertUnorderedList"],
  ["Numbered list", "1.", "insertOrderedList"],
  ["Scene break", "—", "insertHorizontalRule"],
];
const RENAME: Record<string, string> = { B: "STRONG", I: "EM", H1: "H2", H4: "H3", H5: "H3", H6: "H3", DIV: "P" };

/** Keeps only the formatting a story uses. The server sanitizes again on save. */
export function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node, out: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        out.appendChild(doc.createTextNode(child.textContent ?? ""));
        continue;
      }
      if (!(child instanceof Element)) continue;
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "META", "LINK", "TITLE"].includes(child.tagName)) continue;
      // Google Docs marks bold/italic with inline styles on spans
      const style = child.getAttribute("style") ?? "";
      let tag = RENAME[child.tagName] ?? child.tagName;
      if (tag === "SPAN" && /font-weight:\s*(bold|[6-9]00)/.test(style)) tag = "STRONG";
      else if (tag === "SPAN" && /font-style:\s*italic/.test(style)) tag = "EM";
      if (ALLOWED.has(tag)) {
        const el = doc.createElement(tag);
        if (tag === "A") {
          const href = child.getAttribute("href") ?? "";
          if (/^(https:|mailto:)/i.test(href)) el.setAttribute("href", href);
        }
        walk(child, el);
        out.appendChild(el);
      } else {
        walk(child, out); // unwrap unknown elements, keep their text
      }
    }
  };
  const root = doc.createElement("div");
  walk(doc.body, root);
  return root.innerHTML;
}

function plainToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Small writing area for stories: paragraphs, two heading levels, bold, italic, quote, lists,
 * links and a scene break. Pasting from Word or Google Docs keeps only that formatting.
 */
export function RichText({ value, onChange, resetKey, label }: { value: string; onChange: (html: string) => void; resetKey: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("https://");
  const saved = useRef<Range | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || "<p><br></p>";
      setCount((ref.current.innerText.match(/\S+/g) ?? []).length);
    }
    // only when a different document is loaded (initial, saved version, old revision)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const emit = () => {
    if (!ref.current) return;
    setCount((ref.current.innerText.match(/\S+/g) ?? []).length);
    onChange(ref.current.innerHTML);
  };
  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };



  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span id="rt-label">{label}</span>
        <span>
          {count.toLocaleString("en-US")} words · about {Math.max(1, Math.round(count / 230))} min read
        </span>
      </div>
      <div className="sticky top-16 z-10 flex flex-wrap gap-1 border border-b-0 border-field bg-surface p-1" role="toolbar" aria-label="Formatting">
        {TOOLS.map(([name, glyph, command, arg]) => (
          <button key={name} type="button" title={name} aria-label={name} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(command, arg)} className="h-8 min-w-8 px-2 font-mono text-xs hover:bg-line">
            {glyph}
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const sel = window.getSelection();
            saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
            setLinking(true);
          }}
          className="h-8 px-2 font-mono text-xs underline hover:bg-line"
        >
          Link
        </button>
        {linking && (
          <span className="flex items-center gap-1">
            <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link address" className="h-8 w-56 border border-field bg-paper px-2 text-xs" />
            <button
              type="button"
              className="h-8 px-2 text-xs underline"
              onClick={() => {
                const sel = window.getSelection();
                if (saved.current && sel) {
                  sel.removeAllRanges();
                  sel.addRange(saved.current);
                }
                if (/^https:\/\/\S+$/.test(url)) cmd("createLink", url);
                setLinking(false);
              }}
            >
              Add
            </button>
          </span>
        )}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-labelledby="rt-label"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertHTML", false, html ? cleanHtml(html) : plainToHtml(text));
          emit();
        }}
        className="min-h-[50vh] border border-field bg-paper px-6 py-5 text-[17px] leading-[1.75] text-ink outline-none focus:border-ink [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-line [&_blockquote]:pl-5 [&_blockquote]:italic [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_h3]:mt-6 [&_h3]:font-semibold [&_hr]:my-8 [&_hr]:border-line [&_li]:ml-6 [&_ol]:list-decimal [&_p+p]:mt-5 [&_ul]:list-disc"
      />
    </div>
  );
}
