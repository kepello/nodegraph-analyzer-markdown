/**
 * GFM table element production.
 *
 * Per design (§1.2), tables emit with metadata
 * `{ columnCount, rowCount }`. Content is omitted; consumers that need
 * the table source re-parse from the artifact source range.
 *
 * `rowCount` includes the header row (mdast's `Table.children` array
 * places header at index 0 and body rows at 1..n).
 */

import {
  computeContentHash,
  type AnalyzerElement,
  type SourceLocation,
} from "@kepello/nodegraph-analysis/protocol";
import type { Table } from "mdast";

export interface TableMetadata {
  columnCount: number;
  rowCount: number;
}

export function buildTableElement(
  node: Table,
  name: string,
  parentName: string | undefined,
  sourceLocation: SourceLocation,
  source: string,
): AnalyzerElement {
  const rows = node.children ?? [];
  const columnCount =
    node.align?.length ?? rows[0]?.children?.length ?? 0;
  const metadata: TableMetadata = {
    columnCount,
    rowCount: rows.length,
  };

  // Hash the source-range slice so tables with the same shape but
  // different cell content get different hashes.
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? start;
  const verbatim = source.slice(start, end);

  return {
    name,
    kind: "table",
    ...(parentName !== undefined ? { parentName } : {}),
    sourceLocation,
    contentHash: computeContentHash(verbatim),
    metadata,
  };
}
