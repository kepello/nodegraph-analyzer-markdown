/**
 * Hand-crafted fixture tests for the markdown analyzer. Each test
 * loads a fixture under src/test/fixtures/ and asserts on the shape
 * of the resulting AnalyzerArtifact.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnalyzerArtifact,
  AnalyzerEdge,
  AnalyzerElement,
} from "@kepello/nodegraph-analysis/protocol";
import { analyzeMarkdown } from "../analyze.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

function load(name: string): { artifact: AnalyzerArtifact; content: string } {
  const path = join(FIXTURES, name);
  const content = readFileSync(path, "utf-8");
  const result = analyzeMarkdown(path, content);
  return { artifact: result.artifact, content };
}

function findByName(els: AnalyzerElement[], name: string): AnalyzerElement | undefined {
  return els.find((e) => e.name === name);
}

function edgesOfType(
  edges: AnalyzerEdge[] | undefined,
  type: string,
  subtype?: string,
): AnalyzerEdge[] {
  if (!edges) return [];
  return edges.filter((e) => e.type === type && (subtype === undefined || e.subtype === subtype));
}

test("frontmatter — well-formed YAML parses to structured object", () => {
  const { artifact } = load("with-frontmatter.md");
  const md = artifact.metadata as { frontmatter?: Record<string, unknown>; title?: string };
  assert.ok(md.frontmatter, "expected frontmatter to be populated");
  assert.equal(md.frontmatter.id, "doc-001");
  assert.equal(md.frontmatter.title, "Frontmatter Doc");
  assert.deepEqual(md.frontmatter.tags, ["one", "two"]);
  assert.deepEqual(md.frontmatter.nested, { depth: 3, flag: true });
  assert.equal(md.title, "Frontmatter Doc");
  assert.ok(!artifact.problems || artifact.problems.length === 0);
});

test("frontmatter — malformed YAML emits warning, no frontmatter on artifact", () => {
  const { artifact } = load("malformed-frontmatter.md");
  const md = artifact.metadata as { frontmatter?: Record<string, unknown> };
  assert.equal(md.frontmatter, undefined);
  assert.ok(artifact.problems && artifact.problems.length >= 1);
  assert.equal(artifact.problems![0]!.severity, "warning");
  assert.match(artifact.problems![0]!.message, /Malformed YAML/i);
});

test("hierarchy — h1 > h2 > h3 nesting and parentName chain", () => {
  const { artifact } = load("hierarchy.md");

  const top = findByName(artifact.elements, "top-level");
  assert.ok(top, "top-level element should exist");
  assert.equal(top!.kind, "section");
  assert.equal(top!.parentName, undefined);
  assert.deepEqual((top!.metadata as { headingLevel: number }).headingLevel, 1);

  const a = findByName(artifact.elements, "top-level/section-a");
  assert.ok(a, "Section A element should exist");
  assert.equal(a!.parentName, "top-level");

  const a1 = findByName(artifact.elements, "top-level/section-a/subsection-a-one");
  assert.ok(a1, "Subsection A One element should exist");
  assert.equal(a1!.parentName, "top-level/section-a");
  assert.equal((a1!.metadata as { headingLevel: number }).headingLevel, 3);

  const b = findByName(artifact.elements, "top-level/section-b");
  assert.ok(b, "Section B element should exist");

  // Artifact-level contains points to the only top-level section
  const topContains = edgesOfType(artifact.edges, "contains");
  assert.equal(topContains.length, 1);
  assert.equal(topContains[0]!.targetName, "top-level");

  // Top-level section contains its h2 children
  const topChildren = edgesOfType(top!.edges, "contains").map((e) => e.targetName);
  assert.deepEqual(topChildren.sort(), [
    "top-level/section-a",
    "top-level/section-b",
  ]);
});

test("hierarchy — section-level link/image edges with sourceLocation", () => {
  const { artifact } = load("hierarchy.md");

  const a = findByName(artifact.elements, "top-level/section-a")!;
  const aLinks = edgesOfType(a.edges, "references", "link");
  const aTargets = aLinks.map((e) => e.targetName).sort();
  assert.deepEqual(aTargets, ["#section-b", "other.md"]);
  for (const e of aLinks) {
    assert.ok(e.sourceLocation, "link edge missing sourceLocation");
    assert.ok(e.sourceLocation!.startLine >= 1);
  }

  const a1 = findByName(artifact.elements, "top-level/section-a/subsection-a-one")!;
  const a1Images = edgesOfType(a1.edges, "references", "image");
  assert.equal(a1Images.length, 1);
  assert.equal(a1Images[0]!.targetName, "./img/diagram.png");
  assert.ok(a1Images[0]!.sourceLocation);

  const b = findByName(artifact.elements, "top-level/section-b")!;
  const bLinks = edgesOfType(b.edges, "references", "link");
  // External URLs are kept (consumer decides what to do with them).
  assert.ok(bLinks.some((e) => e.targetName === "https://example.com"));
});

test("hierarchy — code blocks and tables nest under their section with positional names", () => {
  const { artifact } = load("hierarchy.md");

  const cb1 = findByName(artifact.elements, "top-level/section-b/code-block-1");
  assert.ok(cb1, "first code-block under Section B should exist");
  assert.equal(cb1!.kind, "code-block");
  assert.equal(cb1!.parentName, "top-level/section-b");
  assert.equal((cb1!.metadata as { language: string }).language, "typescript");
  assert.match(cb1!.content!, /export function hi/);

  const cb2 = findByName(artifact.elements, "top-level/section-b/code-block-2");
  assert.ok(cb2, "second code-block under Section B should exist");
  assert.equal((cb2!.metadata as { language: string }).language, "python");

  const tbl = findByName(artifact.elements, "top-level/section-b/table-1");
  assert.ok(tbl, "GFM table under Section B should exist");
  assert.equal(tbl!.kind, "table");
  assert.equal((tbl!.metadata as { columnCount: number; rowCount: number }).columnCount, 3);
  assert.equal((tbl!.metadata as { columnCount: number; rowCount: number }).rowCount, 3);

  const b = findByName(artifact.elements, "top-level/section-b")!;
  const containsTargets = edgesOfType(b.edges, "contains").map((e) => e.targetName);
  assert.ok(containsTargets.includes("top-level/section-b/code-block-1"));
  assert.ok(containsTargets.includes("top-level/section-b/code-block-2"));
  assert.ok(containsTargets.includes("top-level/section-b/table-1"));
});

test("comments — adjacency rules attach correctly", () => {
  const { artifact } = load("comments.md");

  const before = findByName(artifact.elements, "comments-doc/before-heading-comment");
  assert.ok(before);
  assert.equal(before!.leadingComment, "<!-- before-only -->");

  const after = findByName(artifact.elements, "comments-doc/after-heading-comment");
  assert.ok(after);
  assert.equal(after!.leadingComment, "<!-- after-only -->");

  const both = findByName(artifact.elements, "comments-doc/both-sides");
  assert.ok(both);
  assert.equal(
    both!.leadingComment,
    "<!-- pre1 -->\n<!-- pre2 -->\n<!-- post1 -->",
  );

  const inBody = findByName(artifact.elements, "comments-doc/in-body-comments");
  assert.ok(inBody);
  // Mid-body comments must NOT attach.
  assert.equal(inBody!.leadingComment, undefined);

  const adjacent = findByName(artifact.elements, "comments-doc/adjacent-across-sections");
  assert.ok(adjacent);
  // The trailing comment claimed by the NEXT heading, not by this one
  // (since this section's body has prose between heading and comment).
  assert.equal(adjacent!.leadingComment, undefined);

  const next = findByName(artifact.elements, "comments-doc/next-section");
  assert.ok(next);
  assert.equal(next!.leadingComment, "<!-- claimed-by-next -->");
});

test("code-and-tables — language, info, columnCount, rowCount", () => {
  const { artifact } = load("code-and-tables.md");

  const ts = findByName(artifact.elements, "code-and-tables/typescript/code-block-1");
  assert.ok(ts);
  const tsMeta = ts!.metadata as { language?: string; info?: string };
  assert.equal(tsMeta.language, "typescript");
  assert.equal(tsMeta.info, "{filename=foo.ts}");

  const noLang = findByName(artifact.elements, "code-and-tables/no-language/code-block-1");
  assert.ok(noLang);
  const noLangMeta = noLang!.metadata as { language?: string; info?: string };
  assert.equal(noLangMeta.language, undefined);
  assert.equal(noLangMeta.info, undefined);

  const tbl = findByName(artifact.elements, "code-and-tables/gfm-table/table-1");
  assert.ok(tbl);
  const tblMeta = tbl!.metadata as { columnCount: number; rowCount: number };
  assert.equal(tblMeta.columnCount, 2);
  assert.equal(tblMeta.rowCount, 4);
});

test("artifact — top-level shape, language, hashes, source locations", () => {
  const { artifact } = load("hierarchy.md");
  assert.equal(artifact.language, "markdown");
  assert.ok(artifact.sourceHash);
  assert.match(artifact.sourceHash!, /^[a-f0-9]{64}$/);
  for (const el of artifact.elements) {
    assert.ok(el.sourceLocation, `${el.name} missing sourceLocation`);
    assert.ok(el.sourceLocation.startLine >= 1);
    assert.ok(el.sourceLocation.endLine >= el.sourceLocation.startLine);
    assert.ok(el.sourceHash, `${el.name} missing sourceHash`);
  }
});

test("artifact — NDJSON-emitted output round-trips through JSON", () => {
  const { artifact } = load("hierarchy.md");
  const message = { type: "artifact", artifact } as const;
  const line = JSON.stringify(message);
  const parsed = JSON.parse(line) as { type: string; artifact: AnalyzerArtifact };
  assert.equal(parsed.type, "artifact");
  assert.equal(parsed.artifact.language, "markdown");
  assert.equal(parsed.artifact.elements.length, artifact.elements.length);
});
