import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";

// All authentication endpoints (sign-in, sign-up, sign-out, two-factor) are served by Better Auth.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
