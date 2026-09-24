import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "../index";

test("greet uses the package's public entry point", () => {
  assert.equal(greet("Ada"), "Hello, Ada!");
});
