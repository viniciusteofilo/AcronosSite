/**
 * Turns a plain-text or Markdown manuscript into the small HTML subset stories use
 * (p, h2, h3, em, strong, blockquote, ul, ol, li, hr, a). Runs in the admin's browser;
 * the server sanitizes again on save. Nothing is rewritten: only the formatting is converted.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(md: string): string {
  return esc(md)
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_m, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

export type ParsedStory = { title: string | null; html: string };

/** Markdown: "# Title" becomes the title; "##"/"###" become headings. */
export function markdownToStory(md: string): ParsedStory {
  const lines = md.replace(/\r\n?/g, "\n").replace(/^﻿/, "").split("\n");
  let title: string | null = null;
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
    if (quote.length) out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpExecArray | null;
    if (!line.trim()) {
      flush();
    } else if ((m = /^#\s+(.+)$/.exec(line))) {
      flush();
      if (title === null && out.length === 0) title = m[1].trim();
      else out.push(`<h2>${inline(m[1].trim())}</h2>`);
    } else if ((m = /^##\s+(.+)$/.exec(line))) {
      flush();
      out.push(`<h2>${inline(m[1].trim())}</h2>`);
    } else if ((m = /^#{3,6}\s+(.+)$/.exec(line))) {
      flush();
      out.push(`<h3>${inline(m[1].trim())}</h3>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push("<hr>");
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      if (para.length || list) flush();
      quote.push(m[1]);
    } else if ((m = /^\s*[-*+]\s+(.+)$/.exec(line)) || (m = /^\s*\d+[.)]\s+(.+)$/.exec(line))) {
      const tag = /^\s*\d/.test(line) ? "ol" : "ul";
      if (para.length || quote.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(m[1]);
    } else {
      if (list || quote.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return { title, html: out.join("\n") };
}

/** Plain text: the first short line is the title when followed by a blank line; blank lines split paragraphs. */
export function textToStory(text: string): ParsedStory {
  const clean = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "").trim();
  const blocks = clean.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let title: string | null = null;
  if (blocks.length > 1 && !blocks[0].includes("\n") && blocks[0].length <= 120) title = blocks.shift()!;
  const html = blocks.map((b) => (/^\s*([-*_])(\s*\1){2,}\s*$/.test(b) || b === "* * *" ? "<hr>" : `<p>${esc(b).replace(/\n/g, "<br>")}</p>`)).join("\n");
  return { title, html };
}

/** HTML (from a .html file or converted from .docx): the first h1 (or a first-paragraph title) becomes the title; h1→h2, h4+→h3. */
export function htmlToStory(html: string): ParsedStory {
  let body = html.replace(/^[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
  let title: string | null = null;
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body);
  if (h1) {
    title = h1[1].replace(/<[^>]+>/g, "").trim() || null;
    body = body.replace(h1[0], "");
  }
  body = body
    .replace(/<h1([^>]*)>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>")
    .replace(/<h[4-6]([^>]*)>/gi, "<h3$1>")
    .replace(/<\/h[4-6]>/gi, "</h3>")
    .replace(/<b>/gi, "<strong>")
    .replace(/<\/b>/gi, "</strong>")
    .replace(/<i>/gi, "<em>")
    .replace(/<\/i>/gi, "</em>");
  return { title, html: body.trim() };
}

export const wordCount = (html: string) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
