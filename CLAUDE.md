# Wayfinder Maps — agent runbook

Obsidian plugin (id `wayfinder-maps`) that renders `wayfinder:map` GitHub issues as
dependency-layered ticket trees. Listed in the Obsidian community directory.

## Commands

```bash
npm test          # node:test units, offline — must pass before any ship
npm run build     # tsc --noEmit + esbuild production + version-drift guard
GH_TOKEN=$(gh auth token) SMOKE_REPO=owner/name npm run smoke   # live invariant checks
npm run deploy    # build + copy into the vault; VAULT comes from git-ignored deploy.env
```

## Versioning & release

- `manifest.json`, `package.json`, and `versions.json` move together; the prod build fails on
  manifest/package drift. Every release adds a `"<version>": "<minAppVersion>"` entry to
  versions.json.
- Release only after all three gates (test, build, smoke) are green:
  `gh release create <version> main.js manifest.json styles.css --title "<version>" --notes "..."`
  Tag is the bare version — no `v` prefix. The community directory serves installs from these
  three release assets and renders README.md live from the default branch (no release needed for
  docs-only changes).
- Before changes that touch plugin-review surface, self-lint with the directory's ruleset:
  `npm install --no-save eslint eslint-plugin-obsidianmd typescript-eslint`, add a temp flat
  `eslint.config.mjs` using `obsidianmd.configs.recommended` (+ `parserOptions.project`), run
  `npx eslint src/`, then delete the config (it is not committed). Sentence-case warnings on
  "Wayfinder" (product name) and the literal placeholders `owner/name` / `github_pat_…` are
  accepted false positives.

## Hard constraints

- `minAppVersion` is 1.7.2 (floor set by async `revealLeaf`). Do not call APIs newer than
  minAppVersion without a `requireApiVersion("x.y.z")` guard — the directory's linter checks this.
  Users (including the maintainer, on a flatpak that lags stable) may run Obsidian < 1.13.
- The settings tab is dual-path: `getSettingDefinitions()` (declarative, Obsidian 1.13+) plus the
  imperative `display()`/`renderImperative()` fallback for older apps. Keep both in sync when
  changing settings. The tab overrides `getControlValue`/`setControlValue` deliberately: the base
  class persistence would clobber the issue snapshots stored alongside settings in `data.json`.
- Relationship-fetch failures must fail closed: a ticket with unverifiable blockers is
  `unverified` and excluded from the frontier. Never treat a fetch error as "no blockers".
- No inline `style` assignments on DOM elements — use CSS classes in `styles.css`, or
  `setCssStyles()` for genuinely dynamic values (directory lint rule).
- The GitHub token in settings is a user secret: never log it or include it in error messages.
