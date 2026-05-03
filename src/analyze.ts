/**
 * Markdown analyzer — `analyzeMarkdown(filePath, content) -> AnalyzerArtifact`.
 *
 * Parses with `unified` + `remark-parse` + `remark-gfm` +
 * `remark-frontmatter`, extracts YAML frontmatter, walks the mdast
 * tree, and assembles the `AnalyzerArtifact` that the wire format
 * defines. Returns a `{ artifact, problems }` shape so the caller
 * (CLI subprocess or in-process consumer) can decide how to surface
 * non-fatal issues.
 *
 * The function is pure with respect to the input string — no I/O — so
 * it can be invoked directly as a library function.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import type { Root } from "mdast";
import {
  computeContentHash,
  type AnalyzerArtifact,
  type Problem,
} from "@kepello/nodegraph-analysis/protocol";
import { extractFrontmatter } from "./frontmatter.js";
import { walkMdast } from "./walk-mdast.js";

/**
 * Result of analyzing one markdown file. `artifact` is always present
 * (markdown parsing is total — even malformed input produces a
 * well-formed artifact carrying just the file element). `problems`
 * lists frontmatter-parse warnings and walk-time anomalies; on
 * success it shares its reference with `artifact.problems`.
 */
export interface AnalyzeResult {
  artifact: AnalyzerArtifact;
  problems: Problem[];
}

/**
 * Per-file metadata attached to the artifact. `frontmatter` is the
 * parsed YAML object when the document opens with `---`-delimited
 * frontmatter; `title` is the text of the first H1 heading found.
 */
export interface ArtifactMetadata {
  frontmatter?: Record<string, unknown>;
  title?: string;
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"]);

/**
 * Analyze one markdown file and produce an `AnalyzerArtifact`.
 * Parses frontmatter (if present), walks the mdast tree to extract
 * `section` / `code-block` / `table` elements with `contains` /
 * `references` edges, and returns `{ artifact, problems }`. Pure with
 * respect to its input string — no I/O — so it can be invoked
 * directly as a library function.
 */
export function analyzeMarkdown(filePath: string, content: string): AnalyzeResult {
  const tree = processor.parse(content) as Root;

  const frontmatterResult = extractFrontmatter(tree);
  const walkResult = walkMdast(tree, content);

  const metadata: ArtifactMetadata = {};
  if (frontmatterResult.frontmatter) metadata.frontmatter = frontmatterResult.frontmatter;
  if (walkResult.firstH1Text) metadata.title = walkResult.firstH1Text;

  const problems: Problem[] = [
    ...frontmatterResult.problems,
    ...walkResult.problems,
  ];

  const artifact: AnalyzerArtifact = {
    id: filePath,
    filePath,
    language: "markdown",
    contentHash: computeContentHash(content),
    metadata,
    elements: walkResult.elements,
    edges: walkResult.artifactEdges,
    ...(problems.length > 0 ? { problems } : {}),
  };

  return { artifact, problems };
}
