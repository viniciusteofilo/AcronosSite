import { config } from "dotenv";
import postgres from "postgres";
import { runMigrations } from "../db/migrate";

config({ path: [".env.local", ".env"] });

/**
 * Integration tests run against a real, separate PostgreSQL database (TEST_DATABASE_URL).
 * The schema is dropped and rebuilt from the migrations on every run, so the migrations
 * themselves are tested too. Refuses to touch a database whose name does not contain "test".
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  if (!new URL(url).pathname.includes("test")) {
    throw new Error("Refusing to reset a database whose name does not contain 'test'.");
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  } finally {
    await sql.end();
  }
  await runMigrations(url);
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
}
