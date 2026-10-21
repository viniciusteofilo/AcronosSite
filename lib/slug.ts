/** "Shell Jacket — Drop 01" → "shell-jacket-drop-01". Used for suggestions; the server validates. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Short uppercase code from a word, for SKU suggestions: "Black" → "BLK", "Off white" → "OFFW". */
export function codeOf(word: string, len = 3): string {
  const clean = word.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.map((p, i) => (i === 0 ? p.slice(0, len) : p[0])).join("").slice(0, len + 2);
  const w = parts[0] ?? "";
  if (w.length <= len) return w;
  const consonants = w[0] + w.slice(1).replace(/[AEIOU]/g, "");
  if (consonants.length < len) return w.slice(0, len);
  // first letters plus the last consonant: BLACK → BLK, WHITE → WHT, GREEN → GRN
  return consonants.slice(0, len - 1) + consonants.slice(-1);
}

/** Parses a price typed by a person ("189", "189.90", "189,90", "1,299.00") into minor units. */
export function parseMoneyInput(raw: string): number | null | "invalid" {
  let s = raw.trim().replace(/[\s$R]/g, "");
  if (s === "") return null;
  if (s.includes(",") && s.includes(".")) {
    // both present: the last one is the decimal mark ("1,299.00" or Brazilian "1.299,00")
    const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    s = s.replace(dec === "," ? /\./g : /,/g, "").replace(",", ".");
  } else if (s.includes(",")) s = s.replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return "invalid";
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return (minor / 100).toFixed(2);
}
