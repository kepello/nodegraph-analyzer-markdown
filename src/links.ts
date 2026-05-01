/**
 * Link / image edge extraction.
 *
 * Walks an mdast subtree (typically the section body) and yields one
 * edge per link and image encountered. Edges are emitted with their
 * inline source location so consumers can locate the reference site
 * within the section. Per design (§1.2), targetName is the verbatim
 * link URL — relative paths, URLs, and `#anchor` references are all
 * retained; consumers (or the host's edge-resolution pass) decide how
 * to resolve them.
 */

import type { AnalyzerEdge, SourceLocation } from "@kepello/nodegraph-analysis/protocol";

export interface InlineEdge extends AnalyzerEdge {
  type: "references";
  subtype: "link" | "image";
}

export function extractInlineEdges(node: unknown): InlineEdge[] {
  const edges: InlineEdge[] = [];
  walk(node, edges);
  return edges;
}

function walk(node: unknown, out: InlineEdge[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as {
    type?: string;
    url?: string;
    children?: unknown[];
    position?: { start: { line: number; column: number }; end: { line: number; column: number } };
  };

  // Code blocks and inline code spans are literal text — their contents
  // never contain "real" links, so the walker stops descending.
  if (n.type === "code" || n.type === "inlineCode") return;

  if ((n.type === "link" || n.type === "image") && typeof n.url === "string") {
    const sourceLocation = positionToSourceLocation(n.position);
    out.push({
      type: "references",
      subtype: n.type === "link" ? "link" : "image",
      targetName: n.url,
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  if (Array.isArray(n.children)) {
    for (const child of n.children) walk(child, out);
  }
}

function positionToSourceLocation(
  position?: { start: { line: number; column: number }; end: { line: number; column: number } },
): SourceLocation | undefined {
  if (!position) return undefined;
  return {
    startLine: position.start.line,
    endLine: position.end.line,
    startColumn: position.start.column,
    endColumn: position.end.column,
  };
}
