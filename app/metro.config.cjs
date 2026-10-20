// Metro config for the app workspace. Expo SDK 52+ auto-detects npm/yarn/pnpm
// workspaces, so packages/* resolve through the root node_modules hoist; the
// only addition needed is `.sql` for the inline-import'd Drizzle migrations.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("sql");

module.exports = config;
