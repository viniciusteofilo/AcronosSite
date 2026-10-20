import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single place where the database connection is created.
 * Swapping the driver for the edge runtime (Neon serverless / Cloudflare Hyperdrive)
 * later only changes this file.
 */
export function createDb(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return { db: drizzle(client, { schema, casing: "snake_case" }), client };
}

export type Database = ReturnType<typeof createDb>["db"];

const globalForDb = globalThis as unknown as { acronosDb?: ReturnType<typeof createDb> };

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return url;
}

/** Lazily created so that importing modules never opens a connection by itself. */
export function getDb(): Database {
  if (!globalForDb.acronosDb) globalForDb.acronosDb = createDb(databaseUrl());
  return globalForDb.acronosDb.db;
}
