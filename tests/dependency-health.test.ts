import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  candidates,
  checkHealth,
  stagedCandidates,
} from "../scripts/check-dependencies.ts";

const version = "1.2.3";
const integrity = "sha512-fixture";
const candidate = {
  name: "example",
  version,
  integrity,
  manifest: "package.json",
};
const empty = { packages: {} };
const lock = {
  packages: {
    "": { dependencies: { example: "^1.2.3" } },
    "node_modules/example": { version, integrity },
  },
};
const manifest = { dependencies: { example: "^1.2.3" } };
const now = Date.parse("2026-10-24T00:00:00Z");

function api({
  released = "2026-10-01T00:00:00Z",
  downloads = 200,
  deprecated = "",
  vulns = [] as readonly { id: string; withdrawn?: string }[],
  published = true,
  actualIntegrity = integrity,
} = {}) {
  const calls: string[] = [];
  return {
    calls,
    get: async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.includes("registry.npmjs.org"))
        return {
          name: "example",
          versions: published
            ? {
                [version]: { deprecated, dist: { integrity: actualIntegrity } },
              }
            : {},
          "dist-tags": { latest: version },
          time: { [version]: released },
        };
      if (url.includes("api.npmjs.org"))
        return { package: "example", downloads };
      assert.deepEqual(JSON.parse(init!.body as string), {
        package: { ecosystem: "npm", name: "example" },
        version,
      });
      return { vulns };
    },
  };
}

test("detects added dependencies, ignores unchanged and removed ones", () => {
  assert.deepEqual(candidates("package.json", {}, manifest, empty, lock), [
    candidate,
  ]);
  assert.deepEqual(
    candidates("package.json", manifest, manifest, lock, lock),
    []
  );
  assert.deepEqual(candidates("package.json", manifest, {}, lock, empty), []);
});

test("checks upgrades resolved only in the lockfile", () => {
  const old = structuredClone(lock);
  old.packages["node_modules/example"].version = "1.2.2";
  assert.deepEqual(candidates("package.json", manifest, manifest, old, lock), [
    candidate,
  ]);
});

test("requires staged lockfile consistency and resolution", () => {
  assert.throws(
    () => candidates("package.json", {}, manifest, empty, empty),
    /up-to-date/
  );
  const missing = { packages: { "": lock.packages[""] } };
  assert.throws(
    () => candidates("package.json", {}, manifest, empty, missing),
    /registry version/
  );
});

test("resolves workspace-local dependencies before hoisted packages", () => {
  const nested = {
    packages: {
      ...lock.packages,
      app: lock.packages[""],
      "app/node_modules/example": { version: "1.2.4", integrity },
    },
  };
  assert.equal(
    candidates("app/package.json", {}, manifest, empty, nested)[0]?.version,
    "1.2.4"
  );
});

test("skips internal workspace links and rejects invalid links", () => {
  const internal = {
    packages: {
      "node_modules/example": { link: true, resolved: "packages/example" },
      "packages/example": { name: "example" },
    },
  };
  assert.deepEqual(
    candidates("package.json", {}, manifest, empty, internal),
    []
  );
  internal.packages["packages/example"].name = "different";
  assert.throws(
    () => candidates("package.json", {}, manifest, empty, internal),
    /invalid workspace/
  );
});

test("checks npm alias identity and all dependency sections", () => {
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const after = { [section]: { alias: "npm:@scope/example@^1.2.3" } };
    const aliasLock = {
      packages: {
        "": after,
        "node_modules/alias": { version, integrity },
      },
    };
    assert.equal(
      candidates("package.json", {}, after, empty, aliasLock)[0]?.name,
      "@scope/example"
    );
  }
});

test("rejects non-registry dependencies", () => {
  for (const spec of [
    "file:../external",
    "https://example.com/package.tgz",
    "github:org/repo",
    "org/repo",
    "../external",
  ]) {
    assert.throws(
      () =>
        candidates(
          "package.json",
          {},
          { dependencies: { example: spec } },
          empty,
          lock
        ),
      /published npm/
    );
  }
});

test("accepts healthy published packages and checks selected version advisories", async () => {
  const source = api();
  await checkHealth(candidate, source.get, now);
  assert.equal(source.calls.length, 3);
});

test("blocks unpublished, deprecated, stale, low-usage and vulnerable packages", async () => {
  for (const [options, expected] of [
    [{ published: false }, /not published/],
    [{ actualIntegrity: "wrong" }, /integrity/],
    [{ deprecated: "use another package" }, /deprecated/],
    [{ released: "2024-01-01" }, /365 days/],
    [{ released: "invalid" }, /365 days/],
    [{ released: "2027-01-01" }, /365 days/],
    [{ downloads: 99 }, /100 downloads/],
    [{ downloads: NaN }, /100 downloads/],
    [{ vulns: [{ id: "GHSA-test" }] }, /GHSA-test/],
  ] as const) {
    await assert.rejects(
      checkHealth(candidate, api(options).get, now),
      expected
    );
  }
});

test("ignores withdrawn advisories and allows threshold boundaries", async () => {
  await checkHealth(
    candidate,
    api({
      downloads: 100,
      released: new Date(now - 365 * 86400000).toISOString(),
      vulns: [{ id: "withdrawn", withdrawn: "2026-10-01" }],
    }).get,
    now
  );
});

test("fails closed on network errors or malformed advisory data", async () => {
  await assert.rejects(
    checkHealth(
      candidate,
      async () => {
        throw new Error("offline");
      },
      now
    ),
    /offline/
  );
  const source = api();
  await assert.rejects(
    checkHealth(
      candidate,
      async (url, init) =>
        url.includes("osv.dev") ? { vulns: "invalid" } : source.get(url, init),
      now
    ),
    /invalid vulnerability/
  );
});

test("reads only staged content and supports an initial commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "dependency-health-"));
  const original = process.cwd();
  try {
    process.chdir(directory);
    execFileSync("git", ["init", "--quiet"]);
    writeFileSync("package.json", JSON.stringify(manifest));
    writeFileSync("package-lock.json", JSON.stringify(lock));
    execFileSync("git", ["add", "package.json", "package-lock.json"]);
    writeFileSync("package.json", "{}");
    writeFileSync("package-lock.json", "{}");
    assert.deepEqual(stagedCandidates(), [candidate]);
    writeFileSync("package.json", JSON.stringify(manifest));
    execFileSync("git", ["rm", "--cached", "--quiet", "package.json"]);
    assert.deepEqual(stagedCandidates(), []);
  } finally {
    process.chdir(original);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("skips network and lockfile access when dependencies are untouched", () => {
  const directory = mkdtempSync(join(tmpdir(), "dependency-health-"));
  const original = process.cwd();
  try {
    process.chdir(directory);
    execFileSync("git", ["init", "--quiet"]);
    writeFileSync("unrelated.txt", "change");
    execFileSync("git", ["add", "unrelated.txt"]);
    assert.deepEqual(stagedCandidates(), []);
  } finally {
    process.chdir(original);
    rmSync(directory, { recursive: true, force: true });
  }
});
