import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";

// All authentication endpoints (sign-in, sign-up, sign-out, two-factor) are served by Better Auth.
async function handle(method: "GET" | "POST", request: Request) {
  try {
    return await toNextJsHandler(getAuth())[method](request);
  } catch (e) {
    console.error("[auth]", e, e instanceof Error ? e.cause : undefined);
    return Response.json({ error: "Authentication is temporarily unavailable." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle("GET", request);
}

export async function POST(request: Request) {
  return handle("POST", request);
}
