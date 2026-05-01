/**
 * Section identification and naming.
 *
 * Section element names follow a path-based canonical form (design §1.4):
 *   - h1 "Introduction"               -> name "introduction"
 *   - h2 "Getting Started" inside h1  -> name "introduction/getting-started"
 *   - h3 "Install" inside h2          -> name "introduction/getting-started/install"
 *
 * The slug component is computed via github-slugger so anchor links
 * (`[link](#getting-started)`) resolve to the right section without the
 * analyzer needing its own slug algorithm.
 */

import GithubSlugger from "github-slugger";
import { joinCanonicalPath } from "@kepello/nodegraph-analysis/protocol";
import type { Heading } from "mdast";

/** Concatenate text-bearing children of a heading node into a single string. */
export function extractHeadingText(heading: Heading): string {
  return collectText(heading).trim();
}

function collectText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === "text" || n.type === "inlineCode") {
    return n.value ?? "";
  }
  if (Array.isArray(n.children)) {
    return n.children.map(collectText).join("");
  }
  return "";
}

/**
 * Compute a stable element name for a heading given the active ancestor
 * chain. Returns both the slug component (for `metadata.slug`) and the
 * full path-joined name (for `AnalyzerElement.name`).
 *
 * The slugger instance must be created per artifact — github-slugger is
 * stateful and tracks already-seen slugs to disambiguate duplicates with
 * `-1`, `-2`, ... suffixes (matching GitHub's anchor algorithm).
 */
export function computeSectionName(
  headingText: string,
  ancestorNames: string[],
  slugger: GithubSlugger,
): { slug: string; name: string } {
  let slug = slugger.slug(headingText);
  if (!slug) {
    // Empty / pure-symbol heading — slugger returned ''. Fall back to a
    // stable positional name (still uniquified through the slugger).
    slug = slugger.slug("section");
  }
  const name = joinCanonicalPath(...ancestorNames, slug);
  return { slug, name };
}

export { GithubSlugger };
