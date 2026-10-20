import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Client IP as reported by Cloudflare (or the local proxy in development). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Stores a one-way hash instead of the raw IP (data minimisation). */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
