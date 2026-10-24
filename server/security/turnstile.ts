/**
 * Cloudflare Turnstile (free bot check) on public forms. Off until both keys are set:
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY (shown in the page) and TURNSTILE_SECRET_KEY (server only).
 * Without it, forms still have a honeypot field and per-IP rate limits.
 */
export const turnstileEnabled = () => !!(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

export async function verifyTurnstile(token: FormDataEntryValue | string | null | undefined, ip: string | null): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("[turnstile] verification failed", e);
    return false;
  }
}

export const HUMAN_CHECK_MESSAGE = "Please complete the check that you are not a robot, then try again.";
