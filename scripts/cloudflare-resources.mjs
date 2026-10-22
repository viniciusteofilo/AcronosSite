// Creates (once) the Cloudflare resources the Worker needs and writes their ids into
// wrangler.jsonc for this deploy: two R2 buckets and a Hyperdrive config pointing at Neon.
// Uses CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_DATABASE_URL and SITE_URL.
import { readFileSync, writeFileSync } from "node:fs";

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, NEON_DATABASE_URL: dbUrl, SITE_URL: site } = process.env;
if (!token || !account || !dbUrl || !site) throw new Error("Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, NEON_DATABASE_URL or SITE_URL");
const api = async (path, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await r.json();
  if (!body.success) throw new Error(`${path}: ${JSON.stringify(body.errors)}`);
  return body.result;
};

for (const name of ["acronos-media", "acronos-next-cache"]) {
  const list = await api("/r2/buckets");
  if (!(list.buckets ?? []).some((b) => b.name === name)) {
    await api("/r2/buckets", { method: "POST", body: JSON.stringify({ name }) });
    console.log(`Created R2 bucket ${name}`);
  }
}

const u = new URL(dbUrl);
const origin = { host: u.hostname, port: Number(u.port || 5432), database: u.pathname.slice(1), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), scheme: "postgres" };
const configs = await api("/hyperdrive/configs");
let hd = configs.find((c) => c.name === "acronos-db");
if (!hd) {
  hd = await api("/hyperdrive/configs", { method: "POST", body: JSON.stringify({ name: "acronos-db", origin }) });
  console.log("Created Hyperdrive acronos-db");
} else {
  await api(`/hyperdrive/configs/${hd.id}`, { method: "PATCH", body: JSON.stringify({ origin }) }); // keeps it in sync with the secret
}

let cfg = readFileSync("wrangler.jsonc", "utf8");
cfg = cfg.replace(/"id": "0{32}"/, `"id": "${hd.id}"`);
for (const k of ["NEXT_PUBLIC_SITE_URL", "BETTER_AUTH_URL", "SITE_URL"]) cfg = cfg.replace(new RegExp(`"${k}": "[^"]*"`), `"${k}": "${site.replace(/\/$/, "")}"`);
writeFileSync("wrangler.jsonc", cfg);
console.log(`wrangler.jsonc ready (Hyperdrive ${hd.id}, site ${site})`);
