# Deep Modules

Copy this shape under the packages root (`packages/` here; repos with `src/` use `src/packages/`):

```text
packages/<name>/
  index.ts        # entry point; add other root entry points as needed
  lib/            # private implementation
  tests/          # private tests and fixtures
```

1. Entry points: Import only through a package's entry points (its root files). Keep entry points small; expose several when useful instead of re-exporting a whole subtree through one barrel.
2. Intra-package imports: Files inside a package may import each other's implementation freely; callers outside the package use only its entry points.
3. Tests: Tests may import package entry points and their own package's `tests/` fixtures, but never implementation in any package's subfolders. Integration tests across packages still use entry points.
4. Cycles: Keep the dependency graph acyclic; `npm run lint:boundaries` checks entry-point usage and cycles.
