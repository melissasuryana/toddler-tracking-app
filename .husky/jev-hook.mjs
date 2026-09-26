#!/usr/bin/env node
/**
 * Jev-backed git hook gate (pre-commit / pre-push).
 *
 * Fail-open everywhere: missing key, offline, API error, bad response => allow.
 * Bypass: JEV_HOOK=off, or git --no-verify.
 * Audit log: .git/jev-hook.log (never contains the API key).
 * Testing: set JEV_HOOK_TEST_DIFF to feed a diff without touching git state.
 */
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const mode = process.argv[2]; // "pre-commit" | "pre-push"

const pass = (msg) => {
  if (msg) console.error(msg);
  process.exit(0);
};
const block = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (mode !== "pre-commit" && mode !== "pre-push") pass();
if (process.env.JEV_HOOK === "off") pass();

const apiKey = process.env.JEV_API_KEY || process.env.OPENROUTER_API_KEY;
if (!apiKey) pass(); // not configured on this machine; hooks are opt-in

const baseUrl = (process.env.JEV_API_BASE_URL || "https://openrouter.ai/api/v1")
  .replace(/\/$/, "")
  .replace(/\/v1$/, "");
const model = process.env.JEV_MODEL || "typesafe/jev-1.13";
const MAX_DIFF_CHARS = 12000;

function getDiff() {
  if (process.env.JEV_HOOK_TEST_DIFF) return process.env.JEV_HOOK_TEST_DIFF;
  const opts = { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 };
  try {
    if (mode === "pre-commit") return execSync("git diff --cached", opts);
    try {
      const upstream = execSync("git rev-parse --abbrev-ref '@{u}'", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return execSync(`git diff ${upstream}...HEAD`, opts);
    } catch {
      return execSync("git diff HEAD~5...HEAD", opts);
    }
  } catch {
    return "";
  }
}

const diff = getDiff();
if (!diff || !diff.trim()) pass();

const state =
  diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + "\n...[truncated]"
    : diff;

const questions =
  mode === "pre-commit"
    ? {
        unintended: {
          type: "noul",
          instructions:
            "Does this diff contain debug leftovers (e.g. console.log, debugger), commented-out code, or scratch work that looks accidentally included?",
        },
        possible_secret: {
          type: "noul",
          instructions:
            "Does this diff appear to contain a real credential, API key, token, or private key?",
        },
      }
    : {
        risk: {
          type: "score",
          instructions: "Risk that this diff breaks production if pushed?",
          criteria: [
            "trivial: docs, comments, formatting only",
            "low: small, well-tested change",
            "medium: behavior change with test coverage",
            "high: risky, untested, or wide-reaching change",
          ],
        },
        missing_tests: {
          type: "noul",
          instructions:
            "Does this diff change source logic without any accompanying test changes?",
        },
      };

let answers;
try {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    mode === "pre-commit" ? 10000 : 15000
  );
  const res = await fetch(`${baseUrl}/v1/systemone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, state, questions }),
    signal: controller.signal,
  });
  clearTimeout(timer);
  if (!res.ok)
    pass(`jev-hook: API returned ${res.status}, allowing (fail-open)`);
  const data = await res.json();
  // OpenRouter returns {answers}; Jev-hosted wraps in {data:{result:{answers}}}
  answers = data?.answers ?? data?.data?.result?.answers;
  if (!answers)
    pass("jev-hook: unexpected response shape, allowing (fail-open)");
} catch (e) {
  pass(`jev-hook: request failed (${e.message}), allowing (fail-open)`);
}

try {
  appendFileSync(
    ".git/jev-hook.log",
    JSON.stringify({
      ts: new Date().toISOString(),
      hook: mode,
      model,
      answers,
    }) + "\n"
  );
} catch {}

const override = "Override: JEV_HOOK=off or git --no-verify.";
const fmt = (n) => n.toFixed(2);

if (mode === "pre-commit") {
  if (answers.possible_secret?.noul >= 0.7)
    block(
      `jev-hook: possible credential in staged changes (p=${fmt(answers.possible_secret.noul)}). ${override}`
    );
  if (answers.unintended?.noul >= 0.85)
    block(
      `jev-hook: staged changes look like they contain unintended leftovers (p=${fmt(answers.unintended.noul)}). ${override}`
    );
  pass();
} else {
  const risk = answers.risk?.score ?? 0;
  if (risk >= 2.5)
    block(`jev-hook: push risk rated HIGH (score ${fmt(risk)}/3). ${override}`);
  if (answers.missing_tests?.noul >= 0.8)
    block(
      `jev-hook: logic changes without test changes (p=${fmt(answers.missing_tests.noul)}). ${override}`
    );
  pass();
}
