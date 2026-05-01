/**
 * HTML comment adjacency detection for headings.
 *
 * Per design (§1.2), the `leadingComment` field on a `section` element
 * captures every block-level HTML comment that is *adjacent* to the
 * heading — that is, every consecutive comment immediately before the
 * heading (with no other content between them) and every consecutive
 * comment immediately after the heading (before any prose body).
 *
 * Mid-body comments are NOT attached: they aren't part of the heading's
 * leading documentation. The walker keeps each comment claimed by at
 * most one heading via its position in the root.children sequence —
 * a comment between section A's body and section B's heading attaches
 * to B (backward scan), not to A (whose forward scan stopped at A's
 * body).
 */

import type { Html, RootContent } from "mdast";

const HTML_COMMENT_RE = /^<!--[\s\S]*?-->\s*$/;

export function isHtmlComment(node: RootContent): node is Html {
  return node.type === "html" && HTML_COMMENT_RE.test(node.value);
}

/**
 * Scan backward from `headingIndex - 1` collecting consecutive HTML
 * comments. Stops at the first non-comment node or at index `floor`.
 * `floor` lets the caller block the scan from crossing a previously
 * processed heading (so comments don't leak across section boundaries).
 *
 * Returns the comment values in source order (oldest first).
 */
export function collectBackwardComments(
  children: RootContent[],
  headingIndex: number,
  floor: number,
): string[] {
  const comments: string[] = [];
  for (let i = headingIndex - 1; i >= floor; i--) {
    const node = children[i];
    if (isHtmlComment(node)) {
      comments.unshift(node.value);
    } else {
      break;
    }
  }
  return comments;
}

/**
 * Scan forward from `headingIndex + 1` collecting consecutive HTML
 * comments. Stops at the first non-comment node. Returns both the
 * comment values and the index of the first non-claimed node — the
 * caller advances its loop counter past the claimed comments to avoid
 * re-processing them.
 */
export function collectForwardComments(
  children: RootContent[],
  headingIndex: number,
): { values: string[]; nextIndex: number } {
  const values: string[] = [];
  let i = headingIndex + 1;
  for (; i < children.length; i++) {
    const node = children[i];
    if (isHtmlComment(node)) {
      values.push(node.value);
    } else {
      break;
    }
  }
  return { values, nextIndex: i };
}
