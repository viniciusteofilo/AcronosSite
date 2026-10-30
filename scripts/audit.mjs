// CI gate: fails on high/critical advisories in production dependencies.
// An advisory can be accepted for a short time in security/audit-exceptions.json (with reason and
// expiry), e.g. while the fixed release is younger than the project's two-week rule for new versions.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const exceptions = JSON.parse(readFileSync(new URL("../security/audit-exceptions.json", import.meta.url), "utf8"));
let raw;
try {
  raw = execSync("npm audit --omit=dev --json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch (e) {
  raw = e.stdout; // npm audit exits 1 when it finds anything
}
const report = JSON.parse(raw);
const today = new Date().toISOString().slice(0, 10);
const failures = [];
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== "object" || !["high", "critical"].includes(via.severity)) continue;
    const ex = exceptions.find((x) => x.url === via.url);
    if (ex && ex.until >= today) {
      console.log(`accepted until ${ex.until}: ${name} ${via.url} (${ex.reason})`);
      continue;
    }
    failures.push(`${via.severity} ${name} ${via.range} ${via.url}${ex ? ` (exception expired ${ex.until})` : ""}`);
  }
}
if (failures.length) {
  console.error("Vulnerabilities in production dependencies:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("No unaccepted high/critical advisories in production dependencies.");
