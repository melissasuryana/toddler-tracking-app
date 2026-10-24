import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);

test("Expo Router's query-string consumer uses the patched callable decoder", () => {
  const routerRequire = createRequire(
    require.resolve("expo-router/package.json")
  );
  const queryString = routerRequire("query-string");
  const queryRequire = createRequire(routerRequire.resolve("query-string"));
  assert.match(
    queryRequire.resolve("decode-uri-component"),
    /query-decoder-compat\/index.cjs$/
  );
  assert.equal(typeof queryRequire("decode-uri-component"), "function");
  assert.deepEqual(
    { ...queryString.parse("name=J%C3%B6&space=a+b&tag=x&tag=y&bad=%C2") },
    {
      bad: "\uFFFD",
      name: "Jö",
      space: "a b",
      tag: ["x", "y"],
    }
  );
  assert.equal(
    queryString.stringify({ name: "Jö", tag: ["x", "y"] }),
    "name=J%C3%B6&tag=x&tag=y"
  );
  assert.equal(queryString.parse("bad=%2520%FF").bad, "%20%FF");
});

test(
  "malformed percent encoding remains bounded with the upstream DoS fix",
  { timeout: 2000 },
  () => {
    const decoder = require("../packages/query-decoder-compat/index.cjs");
    const malformed = "%FF".repeat(20_000);
    assert.equal(decoder(malformed), malformed);
    assert.throws(() => decoder(null), TypeError);
  }
);

test("SDK54 Metro reads synthetic PNG dimensions through the patched buffer and file-path APIs", async () => {
  const metroRequire = createRequire(require.resolve("metro/package.json"));
  const pkg = metroRequire("./package.json");
  assert.equal(pkg.version, "0.83.3");
  assert.match(
    metroRequire.resolve("image-size"),
    /metro-image-size-compat\/index.cjs$/
  );
  // A synthetic 1x1 transparent PNG, containing no user data.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=",
    "base64"
  );
  const { getAssetSize, getAssetData } = metroRequire("./src/Assets.js");
  const size = getAssetSize("png", png, "synthetic.png");
  assert.equal(size.width, 1);
  assert.equal(size.height, 1);
  assert.equal(
    getAssetSize("txt", Buffer.from("not an image"), "synthetic.txt"),
    null
  );
  assert.throws(
    () => getAssetSize("png", Buffer.alloc(0), "empty.png"),
    /empty/
  );
  const directory = new URL(
    "../.scratch/security-image-fixture/",
    import.meta.url
  );
  mkdirSync(directory, { recursive: true });
  const image = new URL("synthetic.png", directory);
  try {
    writeFileSync(image, png);
    const asset = await getAssetData(
      fileURLToPath(image),
      fileURLToPath(directory),
      [],
      "web",
      "/assets"
    );
    assert.equal(asset.width, 1);
    assert.equal(asset.height, 1);
    assert.deepEqual(asset.scales, [1]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("xcode's CommonJS uuid.v4 call still generates 24-character project identifiers", () => {
  const xcodeRequire = createRequire(require.resolve("xcode"));
  const uuid = xcodeRequire("uuid");
  assert.match(uuid.v4(), /^[0-9a-f-]{36}$/);
  const project = require("xcode").project("synthetic.pbxproj");
  project.hash = { project: { objects: {} } };
  assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
});

test("Expo Metro's pinned PostCSS parses and transforms CSS without loading external source maps", async () => {
  const lock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")
  );
  const configPath = Object.keys(lock.packages).find((path) =>
    path.endsWith("/@expo/metro-config")
  );
  assert.ok(configPath);
  const expoRequire = createRequire(
    new URL(`../${configPath}/package.json`, import.meta.url)
  );
  const postcss = expoRequire("postcss");
  const root = postcss.parse(".synthetic { color: red }", { from: undefined });
  root.walkDecls("color", (decl) => {
    decl.value = "blue";
  });
  assert.equal(root.toString(), ".synthetic { color: blue }");
  const css = ".synthetic{}/*# sourceMappingURL=does-not-exist.map */";
  const result = await postcss().process(css, { from: undefined });
  assert.ok(result.css.includes(".synthetic{}"));
});
