import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateAuditPolicy } from "./security-audit-policy.mjs";

const output = new URL("../.security-audit/", import.meta.url);
mkdirSync(output, { recursive: true });
const context = { node: process.version, npm: process.env.npm_config_user_agent ?? "unknown",
  sha: process.env.GITHUB_SHA ?? "local", auditedAt: new Date().toISOString() };
writeFileSync(new URL("context.json", output), JSON.stringify(context, null, 2));

function audit(scope, args) {
  if (!process.env.npm_execpath) throw new Error("Run this command with npm run audit:security.");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json", ...args], {
    encoding: "utf8", timeout: 120_000, maxBuffer: 10 * 1024 * 1024
  });
  writeFileSync(new URL(`${scope}.json`, output), result.stdout ?? "");
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`${scope} audit execution failed (${result.status}): ${result.error?.message ?? "see npm registry availability"}`);
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new Error(`${scope} audit returned invalid JSON.`); }
}

try {
  const production = audit("production", ["--omit=dev"]);
  const full = audit("full", ["--include=dev"]);
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const exception = JSON.parse(readFileSync(new URL("../security-audit-exception.json", import.meta.url), "utf8"));
  const result = evaluateAuditPolicy({ production, full, lock, exception });
  writeFileSync(new URL("summary.json", output), JSON.stringify(result, null, 2));
  console.log(`Production findings: ${result.productionCount}; all findings: ${result.totalCount}; accepted development nodes: ${result.acceptedNodes.length}`);
  for (const message of result.blocked) console.error(message);
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(new URL("summary.json", output), JSON.stringify({ ok: false, error: message }, null, 2));
  console.error(message);
  process.exitCode = 1;
}
