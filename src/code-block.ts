/**
 * Code-block element production.
 *
 * Per design (§1.2), code blocks emit with metadata
 * `{ language?, info? }` and the verbatim source on `content`.
 * `language` comes from the fence's lang token; `info` is the rest of
 * the info string (after the lang token), preserved when present.
 */

import {
  computeContentHash,
  type AnalyzerElement,
  type SourceLocation,
} from "@kepello/nodegraph-analysis/protocol";
import type { Code } from "mdast";

export interface CodeBlockMetadata {
  language?: string;
  info?: string;
}

export function buildCodeBlockElement(
  node: Code,
  name: string,
  parentName: string | undefined,
  sourceLocation: SourceLocation,
): AnalyzerElement {
  const metadata: CodeBlockMetadata = {};
  if (node.lang) metadata.language = node.lang;
  if (node.meta) metadata.info = node.meta;

  const content = node.value ?? "";
  return {
    name,
    kind: "code-block",
    ...(parentName !== undefined ? { parentName } : {}),
    sourceLocation,
    contentHash: computeContentHash(content),
    metadata,
    content,
  };
}
