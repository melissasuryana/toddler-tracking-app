const { readFileSync } = require("node:fs");
const { imageSize } = require("upstream-image-size");

// Metro 0.83 calls the legacy synchronous API with either a path or a buffer.
module.exports = (input) =>
  imageSize(typeof input === "string" ? readFileSync(input) : input);
