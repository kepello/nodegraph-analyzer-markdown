# Changelog

All notable changes to `@kepello/nodegraph-analyzer-markdown`. Reconstructed from git history; format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.5.0] — 2026-05-14

**Breaking — analyzer-config-consolidation (Fathom work row 0.1.2).** Reads its config slice from stdin (UTF-8 JSON, EOF-terminated) instead of `<repoRoot>/nodegraph-analyzer-<name>.config.json`. Imported helper `loadAnalyzerConfig` (gone from `@kepello/nodegraph-analysis/protocol`) replaced by `readAnalyzerConfigFromStdin()`. Per-analyzer config files at workspace root are no longer read — operators must move `include` / `exclude` / `includeComments` into the workspace `.fathom/fathom.config.json` under `analyzers.<name>` and delete the standalone file.

Subprocess contract: the orchestrator (`@kepello/nodegraph-analysis@^2.0.0`) writes `JSON.stringify(entry minus command)` to this analyzer's stdin and closes it before reading NDJSON from stdout. Standalone invocation must pipe a JSON object on stdin or the analyzer throws at startup with a clear error message.

Peer-dep bump: `@kepello/nodegraph-analysis@^2.0.0` (was `^0.18.1`). No other behavior changes.

## [0.4.0] — 2026-05-10

`--discover` CLI flag added (Fathom work-md row 1.11.13). Strictly additive — minor bump because it adds new public CLI behavior.

### Added

- **`--discover` flag** — when passed alongside `--path <root>`, the analyzer walks its inputs using its own per-analyzer config (`<root>/nodegraph-analyzer-markdown.config.json`, same as normal analysis) and prints absolute file paths to stdout, one per line, then exits 0. No NDJSON, no analysis. Used by `fathom discover` (in `@kepello/fathom-cli@2.2.0+`) to render the analyzer-aware preview of what would be analyzed.

### Why

`fathom discover` previously walked the filesystem with universal skip-dirs only and reported the result as "files that would be analyzed." Misleading: each analyzer determines its own inputs via per-analyzer config + per-language extension filtering. The fix moves discovery into the analyzers (the only place that knows its own rules) and has fathom-cli aggregate the per-analyzer claim sets.

## [0.3.1] — 2026-05-10

Defensive backstop (Fathom work-md row 2.2.18). Strictly additive; peer-dep relax only.

NDJSON emit boundary now wraps the artifact with `dedupeArtifactEdges` from `@kepello/nodegraph-analysis/protocol@0.18.1` — collapses any per-source edge list to one edge per `(type, targetName)`, matching the substrate's `edges_live_unique_*` UNIQUE invariant. Markdown emits link-target edges that could plausibly hit the trap (a section with multiple links to the same target, varying by relative-vs-absolute form, would emit two edges with same `(targetName, type="links-to")` and could differ by subtype if subtype carries the link kind). Peer-dep on `@kepello/nodegraph-analysis` bumped to `^0.18.1`.

## [0.3.0] — 2026-05-10

Protocol-breaking refactor coordinated with `@kepello/nodegraph-analysis@0.17.0` (Fathom work-md row 2.7.4, decisions 1–10 in [.agents/plans/analysis-refactor.md](../../.agents/plans/analysis-refactor.md)).

### Removed

- **`--mode` / `--include` / `--exclude` CLI flags** — orchestrator no longer passes any. Per-analyzer tuning lives in `<repoRoot>/nodegraph-analyzer-markdown.config.json` (`{ include?, exclude?, includeComments? }`).

### Added

- Reads `<repoRoot>/nodegraph-analyzer-markdown.config.json` via `loadAnalyzerConfig` from `@kepello/nodegraph-analysis/protocol`. Universal skip-dirs baked into the file-walk via `discoverFilesByExtension`.

### Changed

- CLI invocation contract: `nodegraph-analyzer-markdown --path <repoRoot>`.
- Peer-dep on `@kepello/nodegraph-analysis` bumped to `^0.17.0`.

## [0.2.4] — 2026-05-02

- Fix: CLI's `--include` / `--exclude` filters now use real glob semantics via the shared `matchesGlobs` helper from `@kepello/nodegraph-analysis/protocol` (peer-bumped to `^0.10.1`). Removes the in-tree `matchesFilter` that stripped `*` / `**` and did substring matching — `--exclude *.test.ts` no longer also drops `my.test.tsx`. Stale comment about "simple substring filters" in the CLI header was also updated.

## [0.2.3] — 2026-05-02

- Peer-bump to engine `^0.10.0` (engine trimmed its main barrel; engine internals moved to the `/engine` subpath). No analyzer-side behaviour change; sync release alongside HTML / CSS / TS / .NET / Swift coordinated publish.

## [0.2.2] — 2026-05-02

- Refactor: emit `edges` field on elements only when non-empty, matching the convention used by the TS, HTML, and CSS analyzers. Section, code-block, and table elements no longer carry an unconditional `edges: []`. Wire-format change is shrink-only — consumers that read `element.edges` already had to handle `undefined` per the optional protocol type. Internal `attachContains` / `attachInlineEdgesToActiveSection` switched from `edges!.push(...)` to `(edges ??= []).push(...)` to lazy-init.

## [0.2.1] — 2026-05-02

- Peer-bump to engine `^0.9.0`. No analyzer-side behaviour change; sync release alongside HTML / CSS / TS / .NET / Swift coordinated publish.

## [0.2.0] — 2026-05-01

- Declare compatibility with the 0.4.0 wire contract (`AnalyzerObservation` shape).

## [0.1.0] — 2026-05-01

- Initial release (slice 0b — α package skeleton, β analyzer implementation in the same release cycle):
  - Walks markdown via `unified` + `remark-parse` + `remark-gfm` + `remark-frontmatter`.
  - Element kinds: `section` (h1–h6 headings + body), `code-block` (fenced or indented), `table` (GFM tables).
  - Edges: `contains` (parent → child structural), `references/link` (markdown links with `sourceLocation`), `references/image` (image references with `sourceLocation`).
  - Artifact metadata: `frontmatter` (parsed YAML), `title` (first h1).
  - `leadingComment`: HTML comments adjacent to a section's heading preserved verbatim.
  - Markdown is structural-only by design (per architecture §7) — no per-method scalars / class-shape facets.
