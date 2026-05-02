# Changelog

All notable changes to `@kepello/nodegraph-analyzer-markdown`. Reconstructed from git history; format follows [Keep a Changelog](https://keepachangelog.com/).

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
