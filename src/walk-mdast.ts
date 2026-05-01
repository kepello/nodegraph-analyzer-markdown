/**
 * mdast walker — produces the element list and the artifact-level edges
 * for a parsed markdown document.
 *
 * Walks `tree.children` in source order, treating headings as section
 * boundaries. Maintains a stack of active sections keyed on heading
 * depth so a section's `parentName` is the nearest ancestor with
 * strictly smaller depth (§1.4 — heading hierarchy is not required to
 * be contiguous).
 *
 * Code blocks and tables nest under the active section if any (§1.4 —
 * positional names like `<section>/code-block-1`); top-level code
 * blocks and tables (no preceding heading) attach to the artifact and
 * use just their positional name.
 */

import GithubSlugger from "github-slugger";
import {
  computeContentHash,
  type AnalyzerEdge,
  type AnalyzerElement,
  type Problem,
  type SourceLocation,
} from "@kepello/nodegraph-analysis/protocol";
import type { Code, Heading, Root, RootContent, Table } from "mdast";
import { buildCodeBlockElement } from "./code-block.js";
import { buildTableElement } from "./table.js";
import {
  collectBackwardComments,
  collectForwardComments,
} from "./leading-comment.js";
import { extractInlineEdges } from "./links.js";
import { computeSectionName, extractHeadingText } from "./section.js";

export interface WalkResult {
  elements: AnalyzerElement[];
  artifactEdges: AnalyzerEdge[];
  problems: Problem[];
  /** First h1 heading text, if any — populated on artifact.metadata.title. */
  firstH1Text?: string;
}

interface SectionFrame {
  depth: number;
  element: AnalyzerElement;
  /** Slug of each ancestor section (this frame's slug appended at push). */
  ancestorNames: string[];
  codeIndex: number;
  tableIndex: number;
}

interface RootCounters {
  codeIndex: number;
  tableIndex: number;
}

export function walkMdast(tree: Root, source: string): WalkResult {
  const elements: AnalyzerElement[] = [];
  const artifactEdges: AnalyzerEdge[] = [];
  const problems: Problem[] = [];
  const slugger = new GithubSlugger();
  const stack: SectionFrame[] = [];
  const root: RootCounters = { codeIndex: 0, tableIndex: 0 };

  const children = tree.children;
  // `consumedThrough` is the upper bound (exclusive) of indices that
  // a previous heading already claimed via its forward HTML-comment
  // scan. The backward scan of a later heading must not cross this
  // boundary, otherwise it would steal comments already attached to
  // the earlier section.
  let consumedThrough = 0;
  let firstH1Text: string | undefined;

  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;

    if (node.type === "heading") {
      const result = processHeading(node, children, i, consumedThrough, slugger, stack);
      if (result.firstH1Text && firstH1Text === undefined) {
        firstH1Text = result.firstH1Text;
      }
      elements.push(result.element);
      attachContains(result.element.name, stack, artifactEdges);
      stack.push({
        depth: node.depth,
        element: result.element,
        ancestorNames: [...result.ancestorNames, result.slug],
        codeIndex: 0,
        tableIndex: 0,
      });
      i = result.advanceTo - 1;
      consumedThrough = result.advanceTo;
      continue;
    }

    if (node.type === "code") {
      const element = handleCode(node, stack, root);
      elements.push(element);
      attachContains(element.name, stack, artifactEdges);
      continue;
    }

    if (node.type === "table") {
      const element = handleTable(node, stack, root, source);
      elements.push(element);
      attachContains(element.name, stack, artifactEdges);
      // Inline links/images inside table cells DO count — attribute to
      // the active section as `references` edges.
      attachInlineEdgesToActiveSection(node, stack);
      continue;
    }

    if (node.type === "html") {
      // Block-level HTML (including comments). Mid-body comments
      // are not attached to any heading; non-comment HTML is structural
      // noise. The heading branch handles backward-adjacent claiming.
      continue;
    }

    if (node.type === "yaml") {
      // Frontmatter is handled separately by extractFrontmatter.
      continue;
    }

    // Other block-level node (paragraph, list, blockquote, etc.) — walk
    // for inline links/images and attribute them to the active section.
    attachInlineEdgesToActiveSection(node, stack);
  }

  return { elements, artifactEdges, problems, firstH1Text };
}

interface ProcessHeadingResult {
  element: AnalyzerElement;
  slug: string;
  ancestorNames: string[];
  advanceTo: number;
  firstH1Text?: string;
}

function processHeading(
  node: Heading,
  children: RootContent[],
  i: number,
  consumedThrough: number,
  slugger: GithubSlugger,
  stack: SectionFrame[],
): ProcessHeadingResult {
  while (stack.length > 0 && stack[stack.length - 1]!.depth >= node.depth) {
    stack.pop();
  }
  const parent = stack[stack.length - 1];
  const ancestorNames = parent ? [...parent.ancestorNames] : [];
  const headingText = extractHeadingText(node);
  const { slug, name } = computeSectionName(headingText, ancestorNames, slugger);

  const backward = collectBackwardComments(children, i, consumedThrough);
  const forward = collectForwardComments(children, i);
  const leading = [...backward, ...forward.values].join("\n");

  const element: AnalyzerElement = {
    name,
    kind: "section",
    ...(parent ? { parentName: parent.element.name } : {}),
    sourceLocation: nodePosition(node),
    contentHash: computeContentHash(`h${node.depth}:${headingText}`),
    metadata: {
      headingLevel: node.depth,
      headingText,
      slug,
    },
    ...(leading ? { leadingComment: leading } : {}),
    edges: [],
  };

  return {
    element,
    slug,
    ancestorNames,
    advanceTo: forward.nextIndex,
    firstH1Text: node.depth === 1 ? headingText : undefined,
  };
}

function handleCode(
  node: Code,
  stack: SectionFrame[],
  root: RootCounters,
): AnalyzerElement {
  const parent = stack[stack.length - 1];
  const counter = parent ? ++parent.codeIndex : ++root.codeIndex;
  const localName = `code-block-${counter}`;
  const name = parent ? `${parent.element.name}/${localName}` : localName;
  return buildCodeBlockElement(
    node,
    name,
    parent?.element.name,
    nodePosition(node),
  );
}

function handleTable(
  node: Table,
  stack: SectionFrame[],
  root: RootCounters,
  source: string,
): AnalyzerElement {
  const parent = stack[stack.length - 1];
  const counter = parent ? ++parent.tableIndex : ++root.tableIndex;
  const localName = `table-${counter}`;
  const name = parent ? `${parent.element.name}/${localName}` : localName;
  return buildTableElement(
    node,
    name,
    parent?.element.name,
    nodePosition(node),
    source,
  );
}

function attachContains(
  childName: string,
  stack: SectionFrame[],
  artifactEdges: AnalyzerEdge[],
): void {
  const parent = stack[stack.length - 1];
  if (parent) {
    parent.element.edges!.push({ type: "contains", targetName: childName });
  } else {
    artifactEdges.push({ type: "contains", targetName: childName });
  }
}

function attachInlineEdgesToActiveSection(
  node: unknown,
  stack: SectionFrame[],
): void {
  const parent = stack[stack.length - 1];
  if (!parent) return;
  const inline = extractInlineEdges(node);
  if (inline.length === 0) return;
  // Dedup edges by (targetName, subtype) within this section. Keep the
  // first occurrence's sourceLocation as the representative site.
  const seen = new Set<string>();
  for (const edge of parent.element.edges ?? []) {
    if (edge.type === "references") {
      seen.add(`${edge.subtype ?? ""}::${edge.targetName}`);
    }
  }
  for (const edge of inline) {
    const key = `${edge.subtype}::${edge.targetName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parent.element.edges!.push(edge);
  }
}

function nodePosition(node: { position?: {
  start: { line: number; column: number };
  end: { line: number; column: number };
} }): SourceLocation {
  const p = node.position;
  if (!p) return { startLine: 1, endLine: 1 };
  return {
    startLine: p.start.line,
    endLine: p.end.line,
    startColumn: p.start.column,
    endColumn: p.end.column,
  };
}
