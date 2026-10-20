module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Bundles drizzle-kit SQL migrations so the runtime migration runner in
      // packages/local-data can ship them inside the app binary.
      [
        "inline-import",
        {
          extensions: [".sql"],
        },
      ],
    ],
  };
};
