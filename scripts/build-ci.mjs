import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Explicit values take precedence over local .env files, keeping test builds isolated.
const env = JSON.parse(readFileSync(new URL("../tests/ci-env.json", import.meta.url), "utf8"));
if (!process.env.npm_execpath) throw new Error("Run with npm run build:ci.");
const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", "build"], {
  stdio: "inherit", env: { ...process.env, ...env }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
