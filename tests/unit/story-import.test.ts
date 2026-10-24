import { describe, expect, it } from "vitest";
import { htmlToStory, markdownToStory, textToStory, wordCount } from "@/lib/story-import";

describe("story import converters", () => {
  it("markdown: title, headings, emphasis, quotes, lists, rules; HTML is escaped", () => {
    const r = markdownToStory("﻿# The Gate\n\nFirst *line* and **bold**.\nSame paragraph.\n\n## Part II\n\n> said the log\n\n- a\n- b\n\n1. one\n\n---\n\n<script>alert(1)</script> [site](https://acronos.com) [x](javascript:alert(1))");
    expect(r.title).toBe("The Gate");
    expect(r.html).toContain("<p>First <em>line</em> and <strong>bold</strong>. Same paragraph.</p>");
    expect(r.html).toContain("<h2>Part II</h2>");
    expect(r.html).toContain("<blockquote><p>said the log</p></blockquote>");
    expect(r.html).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(r.html).toContain("<ol><li>one</li></ol>");
    expect(r.html).toContain("<hr>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain('<a href="https://acronos.com">site</a>');
    expect(r.html).not.toContain("javascript:alert(1)\"");
  });

  it("plain text: short first line is the title, blank lines split paragraphs", () => {
    const r = textToStory("Night Shift\r\n\r\nLine one\nline two\n\n* * *\n\nLast <b>.");
    expect(r.title).toBe("Night Shift");
    expect(r.html).toBe("<p>Line one<br>line two</p>\n<hr>\n<p>Last &lt;b&gt;.</p>");
    expect(textToStory("Only one paragraph of text.").title).toBeNull();
  });

  it("html / docx: first h1 is the title, other headings fit the story levels", () => {
    const r = htmlToStory("<html><body><h1>Gate <b>Seven</b></h1><p><i>Hi</i> <b>there</b></p><h1>Part</h1><h4>Sub</h4></body></html>");
    expect(r.title).toBe("Gate Seven");
    expect(r.html).toBe("<p><em>Hi</em> <strong>there</strong></p><h2>Part</h2><h3>Sub</h3>");
    expect(wordCount(r.html)).toBe(4);
  });
});
