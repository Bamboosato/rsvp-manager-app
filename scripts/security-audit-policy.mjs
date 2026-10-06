const severities = ["info", "low", "moderate", "high", "critical"];
const advisoryUrl = /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Fail closed: a missing/truncated report must never look like a clean audit.
export function validateAuditReport(report) {
  if (!isRecord(report) || "error" in report || report.auditReportVersion !== 2 ||
      !isRecord(report.vulnerabilities) || !isRecord(report.metadata?.vulnerabilities)) {
    throw new Error("Invalid npm audit report.");
  }
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  if (Object.keys(report.metadata.vulnerabilities).some((key) => ![...severities, "total"].includes(key))) {
    throw new Error("Invalid audit severity metadata.");
  }
  for (const [name, finding] of Object.entries(report.vulnerabilities)) {
    if (!isRecord(finding) || finding.name !== name || !severities.includes(finding.severity) ||
        !Array.isArray(finding.nodes) || finding.nodes.length === 0 ||
        finding.nodes.some((node) => typeof node !== "string" || !node.startsWith("node_modules/")) ||
        !Array.isArray(finding.via) || finding.via.length === 0) {
      throw new Error(`Invalid audit finding: ${name}`);
    }
    counts[finding.severity]++;
    // Validate indirect causes too, even when the finding will be blocked anyway.
    collectAdvisories(name, report.vulnerabilities);
  }
  counts.total = Object.keys(report.vulnerabilities).length;
  for (const [key, count] of Object.entries(counts)) {
    if (!Number.isSafeInteger(report.metadata.vulnerabilities[key]) || report.metadata.vulnerabilities[key] !== count) {
      throw new Error(`Invalid audit count: ${key}`);
    }
  }
  return counts.total;
}

function collectAdvisories(name, findings, parents = new Set()) {
  if (parents.has(name) || !isRecord(findings[name])) {
    throw new Error(`Missing or cyclic advisory dependency: ${name}`);
  }
  const next = new Set([...parents, name]);
  const urls = new Set();
  if (!Array.isArray(findings[name].via) || findings[name].via.length === 0) {
    throw new Error(`Invalid advisory dependency: ${name}`);
  }
  for (const cause of findings[name].via) {
    if (typeof cause === "string") {
      if (severities.indexOf(findings[cause]?.severity) > severities.indexOf(findings[name].severity)) {
        throw new Error(`Inconsistent advisory severity: ${name}`);
      }
      for (const url of collectAdvisories(cause, findings, next)) urls.add(url);
    } else if (isRecord(cause) && typeof cause.url === "string" && advisoryUrl.test(cause.url) &&
               severities.includes(cause.severity)) {
      if (severities.indexOf(cause.severity) > severities.indexOf(findings[name].severity)) {
        throw new Error(`Inconsistent advisory severity: ${name}`);
      }
      urls.add(cause.url);
    } else {
      throw new Error(`Invalid advisory: ${name}`);
    }
  }
  if (urls.size === 0) throw new Error(`Missing advisory: ${name}`);
  return urls;
}

function validateExceptions(exception, lock, now) {
  if (!isRecord(exception) || exception.version !== 1 || !Array.isArray(exception.entries) ||
      !isRecord(lock?.packages) || !Number.isFinite(now)) {
    throw new Error("Invalid exception configuration or lockfile.");
  }
  const entries = new Map();
  for (const entry of exception.entries) {
    if (!isRecord(entry)) throw new Error("Invalid exception entry.");
    const installed = lock.packages[entry.node];
    const packageName = typeof entry.node === "string" ? entry.node.split("node_modules/").at(-1) : null;
    const expires = typeof entry.expiresAt === "string" ? Date.parse(entry.expiresAt) : NaN;
    if (!isRecord(entry) || !entry.name || packageName !== entry.name ||
        !entry.node.startsWith("node_modules/") || entries.has(entry.node) ||
        !isRecord(installed) || installed.dev !== true || installed.version !== entry.version ||
        !Number.isFinite(expires) || expires <= now ||
        !Array.isArray(entry.advisories) || entry.advisories.length === 0 ||
        entry.advisories.some((url) => typeof url !== "string" || !advisoryUrl.test(url)) ||
        new Set(entry.advisories).size !== entry.advisories.length ||
        typeof entry.reason !== "string" || !entry.reason.trim()) {
      throw new Error(`Invalid, expired, or non-development exception: ${entry?.name ?? "unknown"}`);
    }
    entries.set(entry.node, entry);
  }
  return entries;
}

export function evaluateAuditPolicy({ production, full, lock, exception, now = Date.now() }) {
  const productionCount = validateAuditReport(production);
  const totalCount = validateAuditReport(full);
  const entries = validateExceptions(exception, lock, now);
  const acceptedNodes = [];
  const blocked = Object.keys(production.vulnerabilities).map((name) => `production: ${name}`);
  for (const [name, finding] of Object.entries(full.vulnerabilities)) {
    const urls = collectAdvisories(name, full.vulnerabilities);
    for (const node of finding.nodes) {
      const entry = entries.get(node);
      const accepts = finding.severity !== "critical" && entry?.name === name &&
        entry.advisories.length === urls.size && entry.advisories.every((url) => urls.has(url));
      if (accepts) acceptedNodes.push(node);
      else blocked.push(`full: ${name} (${node}, ${finding.severity})`);
    }
  }
  return { ok: blocked.length === 0, productionCount, totalCount, acceptedNodes, blocked };
}
