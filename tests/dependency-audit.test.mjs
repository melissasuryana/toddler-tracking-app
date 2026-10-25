import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auditArgs,
  auditDependencies,
  evaluateAudit,
  exception,
} from "../scripts/audit-dependencies.mjs";

const now = new Date("2026-10-24T00:00:00Z");
const forgePath = "node_modules/node-forge";
const lockfile = {
  packages: {
    [forgePath]: {
      version: exception.version,
      integrity: exception.integrity,
    },
    "node_modules/expo": { version: "54.0.16" },
    "node_modules/@expo/cli": { version: "54.0.13" },
    "node_modules/other": { version: "1.0.0" },
  },
};
const advisory = {
  source: 1240912,
  name: "node-forge",
  dependency: "node-forge",
  title: "RSA signature verification",
  url: exception.url,
  range: exception.range,
  severity: "high",
};
const vulnerability = (name, via) => ({
  name,
  severity: "high",
  isDirect: false,
  range: "*",
  nodes: [`node_modules/${name}`],
  effects: [],
  via,
});
function report(vulnerabilities = {}) {
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      dependencies: {
        prod: 4,
        dev: 0,
        optional: 0,
        peer: 0,
        peerOptional: 0,
        total: 4,
      },
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: Object.keys(vulnerabilities).length,
        critical: 0,
        total: Object.keys(vulnerabilities).length,
      },
    },
  };
}
function forgeReport() {
  return report({
    "node-forge": vulnerability("node-forge", [{ ...advisory }]),
    "@expo/cli": vulnerability("@expo/cli", ["node-forge"]),
    expo: vulnerability("expo", ["@expo/cli", "node-forge"]),
  });
}
function evaluate(value = forgeReport(), options = {}) {
  return evaluateAudit(value, {
    status: Object.keys(value.vulnerabilities ?? {}).length ? 1 : 0,
    lockfile: structuredClone(lockfile),
    now,
    ...options,
  });
}

test("only the exact advisory and its exempt-only ancestors pass", () => {
  const result = evaluate();
  assert.deepEqual(result.blocked, []);
  assert.match(result.warning, /WARNING.*GHSA-86w9-cpqp-85rv.*2026-11-23/);
});

test("mixed advisories block both the leaf and every ancestor", () => {
  const value = forgeReport();
  value.vulnerabilities["node-forge"].via.push({
    ...advisory,
    url: "https://github.com/advisories/GHSA-new1-new2-new3",
  });
  assert.deepEqual(evaluate(value).blocked, [
    "@expo/cli",
    "expo",
    "node-forge",
  ]);
});

test("an unrelated branch blocks its ancestors without blocking exempt-only ancestors", () => {
  const value = forgeReport();
  value.vulnerabilities.other = vulnerability("other", [
    {
      ...advisory,
      name: "other",
      dependency: "other",
      severity: "low",
    },
  ]);
  value.vulnerabilities.expo.via.push("other");
  value.metadata.vulnerabilities.high++;
  value.metadata.vulnerabilities.total++;
  assert.deepEqual(evaluate(value).blocked, ["expo", "other"]);
});

test("matching advisory URL attached to a different package never passes", () => {
  assert.deepEqual(
    evaluate(report({ other: vulnerability("other", [{ ...advisory }]) }))
      .blocked,
    ["other"]
  );
});

test("package identity, exact affected range, version, and artifact digest are pinned", () => {
  for (const edit of [
    (value, lock) => {
      lock.packages[forgePath].version = "1.4.1";
    },
    (value, lock) => {
      lock.packages[forgePath].version = "1.3.0";
    },
    (value, lock) => {
      lock.packages[forgePath].name = "fake-forge";
    },
    (value, lock) => {
      lock.packages[forgePath].integrity = "sha512-wrong";
    },
    (value, lock) => {
      lock.packages[forgePath].link = true;
    },
    (value) => {
      value.vulnerabilities["node-forge"].via[0].range = "*";
    },
    (value) => {
      value.vulnerabilities["node-forge"].via[0].dependency = "other";
    },
    (value) => {
      value.vulnerabilities["node-forge"].via[0].name = "other";
    },
  ]) {
    const value = forgeReport();
    const lock = structuredClone(lockfile);
    edit(value, lock);
    assert.ok(
      evaluate(value, { lockfile: lock }).blocked.includes("node-forge")
    );
  }
});

test("expiration is exclusive, enforced at the exact UTC boundary", () => {
  assert.deepEqual(
    evaluate(undefined, {
      now: new Date(Date.parse(exception.expires) - 1),
    }).blocked,
    []
  );
  for (const date of [exception.expires, "2026-11-24T00:00:00Z"]) {
    assert.throws(
      () => evaluate(undefined, { now: new Date(date) }),
      /expired/
    );
  }
});

test("a clean audit passes and warns to remove the stale exception even after expiry", () => {
  const result = evaluate(report(), { now: new Date("2027-01-01") });
  assert.deepEqual(result.blocked, []);
  assert.match(result.warning, /unused; remove/);
});

test("npm nonzero errors, success with vulnerabilities, and failure without vulnerabilities fail closed", () => {
  for (const status of [0, 2, null, undefined]) {
    assert.throws(() => evaluate(undefined, { status }), /exit status/);
  }
  assert.throws(() => evaluate(report(), { status: 1 }), /exit status/);
});

test("empty, malformed, error, and inconsistent reports fail closed", () => {
  for (const value of [null, {}, [], "", { error: "offline" }]) {
    assert.throws(() => evaluateAudit(value, { status: 0, lockfile, now }));
  }
  for (const edit of [
    (value) => {
      value.error = {};
    },
    (value) => {
      value.auditReportVersion = 1;
    },
    (value) => {
      delete value.metadata.dependencies;
    },
    (value) => {
      value.metadata.dependencies.total = 0;
    },
    (value) => {
      value.metadata.dependencies.dev = -1;
    },
    (value) => {
      value.metadata.vulnerabilities.high = 0;
    },
    (value) => {
      value.metadata.vulnerabilities.total = 0;
    },
    (value) => {
      value.vulnerabilities["node-forge"].nodes = [];
    },
    (value) => {
      value.vulnerabilities["node-forge"].nodes = ["missing"];
    },
    (value) => {
      value.vulnerabilities["node-forge"].name = "other";
    },
    (value) => {
      value.vulnerabilities["node-forge"].via = [];
    },
    (value) => {
      value.vulnerabilities["node-forge"].via = [null];
    },
    (value) => {
      value.vulnerabilities["node-forge"].via[0].source = null;
    },
    (value) => {
      value.vulnerabilities["node-forge"].via[0].severity = "unknown";
    },
    (value) => {
      value.vulnerabilities["node-forge"].effects = ["missing"];
    },
  ]) {
    const value = forgeReport();
    edit(value);
    assert.throws(() => evaluate(value), /Invalid npm audit response/);
  }
  assert.throws(() => evaluate(undefined, { now: new Date("invalid") }));
});

test("unknown edges and cycles fail even alongside a blocking advisory", () => {
  for (const edge of ["unknown", "expo"]) {
    const value = forgeReport();
    value.vulnerabilities["node-forge"].via.push(
      {
        ...advisory,
        url: "https://github.com/advisories/GHSA-new1-new2-new3",
      },
      edge
    );
    assert.throws(() => evaluate(value), /unknown dependency|cycle/);
  }
});

test("the actual subprocess always audits the lockfile and every dependency class", () => {
  let called = false;
  const result = auditDependencies({
    now,
    run(command, args, options) {
      called = true;
      assert.equal(command, "npm");
      assert.deepEqual(args, auditArgs);
      assert.ok(options.timeout > 0);
      assert.equal(options.encoding, "utf8");
      return { status: 0, stdout: JSON.stringify(report()) };
    },
  });
  assert.ok(called);
  assert.deepEqual(result.blocked, []);
});

test("spawn failures, signals, non-audit exit codes, and invalid JSON never pass", () => {
  for (const result of [
    { error: new Error("ENOENT") },
    { signal: "SIGTERM", status: 1, stdout: JSON.stringify(report()) },
    { status: 2, stderr: "registry unavailable" },
    { status: 0, stdout: "" },
    { status: 0, stdout: "not JSON" },
    { status: 1, stdout: JSON.stringify({ error: { code: "EAUDIT" } }) },
  ]) {
    assert.throws(() => auditDependencies({ run: () => result, now }));
  }
});
