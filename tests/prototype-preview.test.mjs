import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = readFileSync(
  new URL("../prototypes/entry-view-modes.html", import.meta.url),
  "utf8"
);
const source =
  "https://github.com/melissasuryana/toddler-tracking-app/blob/main/prototypes/entry-view-modes.html";

function setup(href) {
  const helper = html.match(
    /<script id="prototype-location">([\s\S]*?)<\/script>/
  );
  assert.ok(helper, "The Entry study must share a preview-aware URL helper.");
  const location = {
    href,
    get search() {
      return new URL(this.href).search;
    },
  };
  const history = {
    replaceState(_state, _title, url) {
      location.href = String(url);
    },
  };
  const navigation = runInNewContext(`${helper[1]}; prototypeLocation;`, {
    location,
    history,
    URL,
    URLSearchParams,
  });
  return { location, navigation };
}

test("direct Entry study URLs retain their parameters when controls change", () => {
  const { location, navigation } = setup(
    "http://localhost:5001/entry-view-modes.html?study=unified&variant=A"
  );
  assert.equal(navigation.read().get("study"), "unified");
  navigation.update({ variant: "C", entry: "sleep_session", theme: "night" });
  const updated = new URL(location.href);
  assert.equal(updated.searchParams.get("variant"), "C");
  assert.equal(updated.searchParams.get("entry"), "sleep_session");
  assert.equal(updated.searchParams.get("theme"), "night");
});

test("HTMLPreview reads study parameters inside the source URL without a dummy parameter", () => {
  const { navigation } = setup(
    `https://htmlpreview.github.io/?${source}?study=unified&variant=B`
  );
  assert.equal(navigation.read().get("study"), "unified");
  assert.equal(navigation.read().get("variant"), "B");
});

test("HTMLPreview control changes preserve a fetchable source URL on reload", () => {
  const { location, navigation } = setup(
    `https://htmlpreview.github.io/?${source}?preview=1&study=unified&variant=A`
  );
  navigation.update({
    variant: "C",
    entry: "reaction",
    theme: "night",
    status: "avoid",
  });
  const sourceAfterReload = new URL(new URL(location.href).search.slice(1));
  assert.equal(sourceAfterReload.origin, "https://github.com");
  assert.equal(sourceAfterReload.pathname, new URL(source).pathname);
  assert.equal(sourceAfterReload.searchParams.get("preview"), "1");
  assert.equal(sourceAfterReload.searchParams.get("study"), "unified");
  assert.equal(sourceAfterReload.searchParams.get("variant"), "C");
  const reloaded = setup(location.href);
  assert.equal(reloaded.navigation.read().get("entry"), "reaction");
  assert.equal(reloaded.navigation.read().get("theme"), "night");
  assert.equal(reloaded.navigation.read().get("status"), "avoid");
});

test("the original Entry view study preserves its HTMLPreview source too", () => {
  const { location, navigation } = setup(
    `https://htmlpreview.github.io/?${source}`
  );
  assert.equal(navigation.read().get("study"), null);
  navigation.update({ variant: "C", entry: "feed" });
  const sourceAfterReload = new URL(new URL(location.href).search.slice(1));
  assert.equal(sourceAfterReload.searchParams.get("variant"), "C");
  assert.equal(sourceAfterReload.searchParams.get("entry"), "feed");
  assert.equal(new URL(location.href).origin, "https://htmlpreview.github.io");
});
