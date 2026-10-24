import { afterEach, describe, expect, it, vi } from "vitest";
import { turnstileEnabled, verifyTurnstile } from "@/server/security/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("bot check (Turnstile)", () => {
  it("is off without both keys: forms keep working", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(turnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(null, null)).toBe(true);
  });

  it("with keys: asks Cloudflare and accepts only a valid token", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const sent: URLSearchParams[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      const body = init.body as URLSearchParams;
      sent.push(body);
      return Response.json({ success: body.get("response") === "good" });
    });
    expect(await verifyTurnstile(null, "1.2.3.4")).toBe(false);
    expect(await verifyTurnstile("x".repeat(3000), null)).toBe(false);
    expect(await verifyTurnstile("bad", "1.2.3.4")).toBe(false);
    expect(await verifyTurnstile("good", "1.2.3.4")).toBe(true);
    expect(sent.at(-1)?.get("secret")).toBe("secret");
    expect(sent.at(-1)?.get("remoteip")).toBe("1.2.3.4");
    vi.stubGlobal("fetch", async () => {
      throw new Error("network");
    });
    expect(await verifyTurnstile("good", null)).toBe(false); // fails closed
  });
});
