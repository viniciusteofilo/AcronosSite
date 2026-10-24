import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cloudflare } from "@/lib/cloudflare";
import * as schema from "./schema";

/**
 * Single place where the database connection is created.
 * - Node (development, tests, scripts): one pooled client per process.
 * - Cloudflare Workers: one client per request through Hyperdrive, which keeps the real
 *   connection pool to Neon close to the database (Workers cannot share sockets between requests).
 */
export function createDb(url: string, opts: { hyperdrive?: boolean } = {}) {
  const client = opts.hyperdrive
    ? postgres(url, { max: 5, prepare: true }) // settings recommended by Cloudflare for Hyperdrive
    : postgres(url, { max: 10, prepare: false });
  return { db: drizzle(client, { schema, casing: "snake_case" }), client };
}

export type Database = ReturnType<typeof createDb>["db"];

const globalForDb = globalThis as unknown as { acronosDb?: ReturnType<typeof createDb> };

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return url;
}

const perRequest = new WeakMap<object, Database>();

/** Lazily created so that importing modules never opens a connection by itself. */
export function getDb(): Database {
  const cf = cloudflare();
  if (cf?.env.HYPERDRIVE) {
    let db = perRequest.get(cf.ctx);
    if (!db) {
      db = createDb(cf.env.HYPERDRIVE.connectionString, { hyperdrive: true }).db;
      perRequest.set(cf.ctx, db);
    }
    return db;
  }
  if (!globalForDb.acronosDb) globalForDb.acronosDb = createDb(databaseUrl());
  return globalForDb.acronosDb.db;
}
