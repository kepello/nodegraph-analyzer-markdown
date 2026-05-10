# Changelog

All notable changes to `@kepello/nodegraph-analyzer-markdown`. Reconstructed from git history; format follows [Keep a Changelog](https://keepachangelog.com/).

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
