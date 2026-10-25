---
name: Expo monorepo Babel resolution
description: A workspace resolution issue where Expo's nested Babel preset is unavailable to Metro.
---

In this Expo npm-workspace setup, Expo included `babel-preset-expo` nested beneath its own package, but Metro could not resolve it from the app's Babel configuration. Declaring the preset at the workspace root made it resolvable and restored bundling.

**Why:** Expo's nested dependency was present in the install tree, so a normal missing-package check was misleading; Babel resolves presets from the config's visible module paths.

**How to apply:** If Metro says it cannot find `babel-preset-expo` in a workspace app, ensure the preset is a direct dependency reachable from the app config rather than relying on Expo's nested copy.
