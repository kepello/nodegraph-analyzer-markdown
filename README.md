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

## Status

**Slice 0b-α (package skeleton).** This release is a publish-ready empty shell — `package.json`, build pipeline, README, LICENSE, but the analyzer implementation is pending. Slice 0b-β will land the working analyzer.

## License

MIT — see [LICENSE](LICENSE).
