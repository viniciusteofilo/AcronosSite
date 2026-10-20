import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";
import { safeNextPath } from "@/lib/safe-redirect";
import { parsePeriod } from "@/server/reports/dashboard";

describe("safeNextPath (open-redirect protection)", () => {
  it.each(["/admin", "/account/security", "/shop?x=1"])("keeps same-site path %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", 42, undefined])(
    "rejects %s",
    (p) => {
      expect(safeNextPath(p)).toBe("/account");
    },
  );
});

describe("formatMoney", () => {
  it("formats minor units", () => {
    expect(formatMoney(18900, "USD")).toBe("$189.00");
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("respects zero-decimal currencies", () => {
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
  });
});

describe("parsePeriod", () => {
  it("accepts only the offered periods", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("365")).toBe(30);
    expect(parsePeriod("1; DROP TABLE orders")).toBe(30);
  });
});
