import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const auditArgs = [
  "audit",
  "--json",
  "--package-lock-only",
  "--audit-level=low",
  "--include=dev",
  "--include=optional",
  "--include=peer",
];

const expires = "2026-12-01T00:00:00.000Z";
// Pinned to the exact locked versions; npm lock entries for these packages
// carry no integrity, so version and identity are the pin.
export const exceptions = Object.freeze(
  [
    {
      package: "glob",
      url: "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4",
      range: ">=9.0.0 <=14.0.1",
      versions: ["7.2.3", "13.0.6"],
    },
    {
      package: "minimatch",
      url: "https://github.com/advisories/GHSA-g3hv-75wg-m249",
      range: "<11.0.1",
      versions: ["3.1.5", "9.0.9", "10.2.6"],
    },
    {
      package: "deepmerge",
      url: "https://github.com/advisories/GHSA-gcqx-w48m-w2h4",
      range: ">=4.2.0 <=4.3.1",
      versions: ["4.3.1"],
    },
  ].map((entry) => Object.freeze({ ...entry, expires }))
);

const severities = ["info", "low", "moderate", "high", "critical"];
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.length > 0;
function requireValid(condition, message) {
  if (!condition) throw new Error(`Invalid npm audit response: ${message}`);
}

export function evaluateAudit(report, { status, lockfile, now = new Date() }) {
  requireValid(
    object(report) &&
      !Object.hasOwn(report, "error") &&
      report.auditReportVersion === 2 &&
      object(report.vulnerabilities) &&
      object(report.metadata?.vulnerabilities) &&
      object(report.metadata?.dependencies) &&
      ["prod", "dev", "optional", "peer", "peerOptional", "total"].every(
        (key) =>
          Number.isSafeInteger(report.metadata.dependencies[key]) &&
          report.metadata.dependencies[key] >= 0
      ) &&
      report.metadata.dependencies.total > 0,
    "missing version-2 vulnerability report or service error"
  );
  requireValid(
    object(lockfile?.packages) && Number.isFinite(now.getTime()),
    "missing lockfile packages or invalid clock"
  );
  const entries = Object.entries(report.vulnerabilities);
  const counts = report.metadata.vulnerabilities;
  requireValid(
    counts.total === entries.length &&
      severities.every(
        (severity) =>
          counts[severity] ===
          entries.filter(([, entry]) => entry?.severity === severity).length
      ),
    "inconsistent vulnerability counts"
  );
  requireValid(
    status === (entries.length === 0 ? 0 : 1),
    "unexpected npm exit status"
  );

  const graph = new Map(entries);
  for (const [name, entry] of entries) {
    requireValid(
      object(entry) &&
        entry.name === name &&
        severities.includes(entry.severity) &&
        typeof entry.isDirect === "boolean" &&
        text(entry.range) &&
        Array.isArray(entry.nodes) &&
        entry.nodes.length > 0 &&
        entry.nodes.every(
          (node) => text(node) && text(lockfile.packages[node]?.version)
        ) &&
        Array.isArray(entry.effects) &&
        entry.effects.every((effect) => text(effect) && graph.has(effect)) &&
        Array.isArray(entry.via) &&
        entry.via.length > 0,
      `malformed vulnerability ${name}`
    );
    for (const via of entry.via) {
      requireValid(
        typeof via === "string"
          ? graph.has(via)
          : object(via) &&
              Number.isSafeInteger(via.source) &&
              via.source > 0 &&
              text(via.name) &&
              text(via.dependency) &&
              text(via.title) &&
              text(via.url) &&
              text(via.range) &&
              severities.includes(via.severity),
        `malformed advisory or unknown dependency in ${name}`
      );
    }
  }

  const accepted = new Set();
  const visiting = new Set();
  const blocked = new Map();
  function visit(name) {
    requireValid(!visiting.has(name), `dependency cycle at ${name}`);
    if (blocked.has(name)) return blocked.get(name);
    visiting.add(name);
    const entry = graph.get(name);
    // Traverse every edge, even when a different advisory already blocks.
    const reasons = entry.via.map((via) => {
      if (typeof via === "string") return visit(via);
      const match = exceptions.find(
        (item) =>
          name === item.package &&
          via.name === item.package &&
          via.dependency === item.package &&
          via.url === item.url &&
          via.range === item.range &&
          entry.nodes.every((node) => {
            const pkg = lockfile.packages[node];
            return (
              (node.endsWith(`/node_modules/${item.package}`) ||
                node === `node_modules/${item.package}`) &&
              item.versions.includes(pkg.version) &&
              (!pkg.name || pkg.name === item.package) &&
              !pkg.link
            );
          })
      );
      if (match && now.getTime() >= Date.parse(match.expires)) {
        throw new Error(`${match.package} exception expired ${match.expires}`);
      }
      if (match) accepted.add(match);
      return !match;
    });
    visiting.delete(name);
    const result = reasons.some(Boolean);
    blocked.set(name, result);
    return result;
  }
  for (const [name] of entries) visit(name);
  return {
    blocked: [...blocked]
      .filter(([, value]) => value)
      .map(([name]) => name)
      .sort(),
    warnings: accepted.size
      ? [...accepted].map(
          (item) =>
            `WARNING: temporarily accepting ONLY ${item.url} in ${item.package}@${item.versions.join(", ")}; expires ${item.expires}.`
        )
      : [
          "WARNING: audit exceptions are unused; remove them and their README policy.",
        ],
  };
}

export function auditDependencies({ run = spawnSync, now = new Date() } = {}) {
  const result = run("npm", auditArgs, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(
      `npm audit failed: ${result.error?.message ?? result.stderr ?? result.signal ?? result.status}`
    );
  }
  const report = JSON.parse(result.stdout);
  const lockfile = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")
  );
  return evaluateAudit(report, { status: result.status, lockfile, now });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = auditDependencies();
    for (const warning of result.warnings) console.warn(warning);
    if (result.blocked.length) {
      console.error(`Dependency audit blocked: ${result.blocked.join(", ")}`);
      process.exitCode = 1;
    } else {
      console.log("Dependency audit passed (all non-exempt advisories block).");
    }
  } catch (error) {
    console.error(`Dependency audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
