/**
 * @kepello/nodegraph-analyzer-markdown — public API.
 *
 * Re-exports the in-process analyzer entry point and its supporting
 * metadata types. The CLI subprocess (`bin/nodegraph-analyzer-markdown`
 * → `dist/cli.js`) is a sibling export not surfaced here.
 */

export { analyzeMarkdown } from "./analyze.js";
export type { AnalyzeResult, ArtifactMetadata } from "./analyze.js";
export type { CodeBlockMetadata } from "./code-block.js";
export type { TableMetadata } from "./table.js";
