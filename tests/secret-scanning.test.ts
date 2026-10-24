import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const scanner = spawnSync("gitleaks", ["version"]);
const scannerMissing =
  scanner.error &&
  "code" in scanner.error &&
  scanner.error.code === "ENOENT";
const skip = scannerMissing ? "Gitleaks not installed" : false;

test("full Git history has no unreviewed secret findings", { skip }, () => {
  const result = spawnSync("gitleaks", ["git", "--redact", "--no-banner"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("new findings in the same path remain detectable", { skip }, () => {
  const cwd = mkdtempSync(join(tmpdir(), "secret-scanning-"));
  try {
    copyFileSync(join(root, ".gitleaksignore"), join(cwd, ".gitleaksignore"));
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Test",
          GIT_AUTHOR_EMAIL: "test@example.invalid",
          GIT_COMMITTER_NAME: "Test",
          GIT_COMMITTER_EMAIL: "test@example.invalid",
        },
      });
      assert.equal(result.status, 0, result.stderr);
    };
    git("init");
    // Synthetic high-entropy metadata, not a credential.
    writeFileSync(
      join(cwd, "cloudflared.deb"),
      `{"auth_hydro_click_hmac":"${"a1b2c3d4e5f67890".repeat(4)}"}\n`
    );
    git("add", "cloudflared.deb");
    git("-c", "core.hooksPath=/dev/null", "commit", "-m", "Synthetic fixture");

    const result = spawnSync(
      "gitleaks",
      [
        "git",
        "--redact",
        "--no-banner",
        "--report-format",
        "json",
        "--report-path",
        "-",
      ],
      { cwd, encoding: "utf8" }
    );
    assert.equal(result.status, 1, result.stderr);
    const findings = JSON.parse(result.stdout);
    assert.ok(
      findings.some(
        (finding: { RuleID: string; File: string }) =>
          finding.RuleID === "generic-api-key" &&
          finding.File === "cloudflared.deb"
      )
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
