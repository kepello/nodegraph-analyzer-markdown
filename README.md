# @kepello/nodegraph-analyzer-markdown

Markdown analyzer subprocess for [`@kepello/nodegraph-analysis`](https://github.com/kepello/nodegraph-analysis). Walks markdown via remark and emits a typed `AnalyzerArtifact` over the analyzer NDJSON protocol.

## What it emits

- **Element kinds:** `section` (h1–h6 headings + body), `code-block` (fenced or indented, with language metadata), `table` (GFM tables with row/column counts).
- **Edges:** `contains` (parent → child structural), `references/link` (markdown links with `sourceLocation`), `references/image` (image references with `sourceLocation`).
- **Artifact metadata:** `frontmatter` (parsed YAML object via js-yaml), `title` (first h1 if any).
- **leadingComment:** HTML comments adjacent to a section's heading are preserved verbatim. Consumers (e.g., BDS-V3) parse governance annotations from this field.

What it deliberately does **not** do:

- No interpretation of frontmatter fields — just structured pass-through.
- No parsing of inline HTML comment content — verbatim in `leadingComment`.
- No element kinds for paragraphs, lists, blockquotes, thematic breaks (too granular).
- No write-back / `--input` mode.

See the design in [`@kepello/nodegraph-analysis/docs/migration-markdown.md`](https://github.com/kepello/nodegraph-analysis/blob/main/docs/migration-markdown.md).

## Install

```sh
npm install @kepello/nodegraph-analyzer-markdown
```

GitHub Packages auth required:

```ini
//npm.pkg.github.com/:_authToken=<your-github-PAT-with-read:packages>
@kepello:registry=https://npm.pkg.github.com/
```

## Use

After install, the binary is at `node_modules/.bin/nodegraph-analyzer-markdown`. Reference from your orchestrator config:

```json
{
  "analyzers": [
    {
      "name": "markdown",
      "command": "node_modules/.bin/nodegraph-analyzer-markdown",
      "filter": { "include": ["**/*.md"] }
    }
  ]
}
```

## Status — 0.2.0

The analyzer walks markdown via `unified` + `remark-parse` + `remark-gfm` + `remark-frontmatter` and produces standard `AnalyzerArtifact` output. Slice 1 cutover (uniform NDJSON contract across the analyzer family) shipped; the package is the production markdown analyzer for the `nodegraph-analysis` ecosystem.

Hand-crafted fixture tests cover frontmatter (well-formed and malformed), multi-level section hierarchy, code blocks with language metadata, GFM tables, link/image edges with source locations, and HTML-comment adjacency rules.

Markdown is structural-only by design (per architecture §7) — no per-method scalars or class-shape facets, since markdown isn't an OO language. Engine derivations that read those fields silently skip markdown elements. Cross-language coupling derivations (e.g., a TS file referencing a markdown doc) work via the standard `references` edges.

## License

MIT — see [LICENSE](LICENSE).
