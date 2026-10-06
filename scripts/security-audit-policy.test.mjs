import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAuditPolicy, validateAuditReport } from "./security-audit-policy.mjs";

const url = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const otherUrl = "https://github.com/advisories/GHSA-m9gg-hp2v-232j";
const now = Date.parse("2026-10-06T00:00:00Z");
function finding(name = "braces", severity = "high", via = [{ url, severity }]) {
  return { name, severity, nodes: [`node_modules/${name}`], via };
}
function report(...findings) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: findings.length };
  findings.forEach((item) => counts[item.severity]++);
  return { auditReportVersion: 2, vulnerabilities: Object.fromEntries(findings.map((item) => [item.name, item])),
    metadata: { vulnerabilities: counts } };
}
function configuration() {
  return { production: report(), full: report(finding()), now,
    lock: { packages: { "node_modules/braces": { version: "3.0.3", dev: true } } },
    exception: { version: 1, entries: [{ name: "braces", node: "node_modules/braces", version: "3.0.3",
      advisories: [url], expiresAt: "2026-11-05T00:00:00Z", reason: "Development-only, upstream fix pending." }] } };
}

test("a complete zero-finding report succeeds without exceptions", () => {
  const input = configuration(); input.full = report(); input.exception.entries = [];
  assert.equal(evaluateAuditPolicy(input).ok, true);
});
for (const severity of ["info", "low", "moderate", "high", "critical"]) {
  test(`any production ${severity} finding blocks the merge`, () => {
    const input = configuration(); input.production = report(finding("braces", severity));
    assert.equal(evaluateAuditPolicy(input).ok, false);
  });
}
test("an exact development exception succeeds and reports its use", () => {
  const result = evaluateAuditPolicy(configuration());
  assert.equal(result.ok, true); assert.equal(result.productionCount, 0); assert.equal(result.totalCount, 1);
  assert.deepEqual(result.acceptedNodes, ["node_modules/braces"]);
});
test("an unapproved development finding blocks", () => {
  const input = configuration(); input.exception.entries = [];
  assert.equal(evaluateAuditPolicy(input).ok, false);
});
test("critical cannot be excepted", () => {
  const input = configuration(); input.full = report(finding("braces", "critical"));
  assert.equal(evaluateAuditPolicy(input).ok, false);
});
test("a new advisory on an excepted package blocks", () => {
  const input = configuration(); input.full.vulnerabilities.braces.via.push({ url: otherUrl, severity: "high" });
  assert.equal(evaluateAuditPolicy(input).ok, false);
});
test("an additional installation path requires a separate exception", () => {
  const input = configuration(); input.full.vulnerabilities.braces.nodes.push("node_modules/other/node_modules/braces");
  assert.equal(evaluateAuditPolicy(input).ok, false);
});
for (const offset of [-1, 0, 1]) {
  test(`exception expiry boundary ${offset} ms is deterministic`, () => {
    const input = configuration(); input.now = Date.parse(input.exception.entries[0].expiresAt) + offset;
    if (offset < 0) assert.equal(evaluateAuditPolicy(input).ok, true);
    else assert.throws(() => evaluateAuditPolicy(input), /expired/);
  });
}
for (const [label, mutate] of [
  ["package version changed", (input) => { input.lock.packages["node_modules/braces"].version = "3.0.4"; }],
  ["development dependency became production", (input) => { input.lock.packages["node_modules/braces"].dev = false; }],
  ["installation path disappeared", (input) => { input.lock.packages = {}; }],
  ["package name changed", (input) => { input.exception.entries[0].name = "other"; }],
  ["expiry is invalid", (input) => { input.exception.entries[0].expiresAt = "invalid"; }],
  ["reason is absent", (input) => { input.exception.entries[0].reason = ""; }],
  ["entry is null", (input) => { input.exception.entries = [null]; }],
  ["entry is duplicated", (input) => { input.exception.entries.push(input.exception.entries[0]); }]
]) {
  test(`${label} invalidates the exception`, () => {
    const input = configuration(); mutate(input);
    assert.throws(() => evaluateAuditPolicy(input), /exception/);
  });
}
test("indirect dependencies resolve the exact underlying advisory", () => {
  const input = configuration(); input.full = report(finding(), finding("micromatch", "high", ["braces"]));
  input.lock.packages["node_modules/micromatch"] = { version: "4.0.8", dev: true };
  input.exception.entries.push({ ...input.exception.entries[0], name: "micromatch", node: "node_modules/micromatch", version: "4.0.8" });
  assert.equal(evaluateAuditPolicy(input).ok, true);
});
for (const [label, mutate] of [
  ["registry error", (input) => { input.full.error = { code: "E503" }; }],
  ["missing metadata", (input) => { delete input.full.metadata; }],
  ["inconsistent counts", (input) => { input.full.metadata.vulnerabilities.total = 0; }],
  ["unknown severity", (input) => { input.full.vulnerabilities.braces.severity = "unknown"; }],
  ["unknown severity metadata", (input) => { input.full.metadata.vulnerabilities.unknown = 1; }],
  ["missing advisory", (input) => { input.full.vulnerabilities.braces.via = []; }],
  ["unresolved indirect dependency", (input) => { input.full.vulnerabilities.braces.via = ["missing"]; }],
  ["cyclic indirect dependency", (input) => { input.full.vulnerabilities.braces.via = ["braces"]; }],
  ["critical advisory hidden by lower severity", (input) => { input.full.vulnerabilities.braces.via[0].severity = "critical"; }],
  ["invalid advisory URL", (input) => { input.full.vulnerabilities.braces.via[0].url = "http://example.com"; }]
]) {
  test(`${label} fails closed instead of treating the scan as clean`, () => {
    const input = configuration(); mutate(input);
    assert.throws(() => evaluateAuditPolicy(input));
  });
}
test("non-JSON and truncated report shapes are rejected", () => {
  for (const input of [null, "", {}, [], { vulnerabilities: {} }]) assert.throws(() => validateAuditReport(input));
});
