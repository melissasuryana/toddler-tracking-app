import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const hook = fileURLToPath(new URL("../.husky/pre-commit", import.meta.url));

test("audit explicitly includes every dependency type despite npm omit settings", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );
  const command = scripts["check:security:dependencies"];
  for (const flag of [
    "--package-lock-only",
    "--audit-level=low",
    "--include=dev",
    "--include=optional",
    "--include=peer",
  ]) {
    assert.ok(command.split(" ").includes(flag), `missing ${flag}`);
  }
});

function runHook(failure = "", unstaged = false) {
  return spawnSync(
    "sh",
    [
      "-c",
      `
        npm() {
          printf '%s\\n' "$*"
          [ "$*" != "$FAIL_COMMAND" ]
        }
        npx() { printf 'exec %s\\n' "$*"; }
        git() { [ "$UNSTAGED" != "yes" ]; }
        node() { return 0; }
        . "$1"
      `,
      "sh",
      hook,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        FAIL_COMMAND: failure,
        UNSTAGED: unstaged ? "yes" : "no",
      },
    }
  );
}

test("security checks run before existing pre-commit checks", () => {
  const result = runHook();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), [
    "run check:secrets",
    "run check:security:dependencies",
    "run check:dependencies",
    "exec lint-staged",
    "run typecheck",
    "run test",
  ]);
});

test("secret detection or a missing scanner blocks the hook", () => {
  const result = runHook("run check:secrets");
  assert.equal(result.status, 1);
  assert.equal(result.stdout.trim(), "run check:secrets");
});

test("vulnerabilities or audit errors block the hook", () => {
  const result = runHook("run check:security:dependencies");
  assert.equal(result.status, 1);
  assert.deepEqual(result.stdout.trim().split("\n"), [
    "run check:secrets",
    "run check:security:dependencies",
  ]);
});

test("unstaged dependency files block auditing a different lockfile", () => {
  const result = runHook("", true);
  assert.equal(result.status, 1);
  assert.equal(result.stdout.trim(), "run check:secrets");
  assert.match(result.stderr, /Stage or stash/);
});
