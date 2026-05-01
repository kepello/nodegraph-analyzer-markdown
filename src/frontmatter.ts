/**
 * YAML frontmatter extraction.
 *
 * remark-frontmatter recognizes a `---`-fenced YAML block at the start
 * of the document and parses it as a `yaml` mdast node. We hand its
 * `value` (the inner YAML text, with the fences stripped) to js-yaml
 * for structured parsing. Malformed YAML produces a warning Problem
 * and the analyzer continues without `metadata.frontmatter`.
 *
 * Per design (§1.2), the analyzer is a structured pass-through — it
 * does not interpret any specific frontmatter fields.
 */

import yaml from "js-yaml";
import type { Root, Yaml } from "mdast";
import type { Problem } from "@kepello/nodegraph-analysis/protocol";

export interface FrontmatterResult {
  frontmatter?: Record<string, unknown>;
  problems: Problem[];
}

export function extractFrontmatter(tree: Root): FrontmatterResult {
  const yamlNode = tree.children.find(
    (child): child is Yaml => child.type === "yaml",
  );
  if (!yamlNode) return { problems: [] };

  try {
    const parsed = yaml.load(yamlNode.value);
    if (parsed === null || parsed === undefined) {
      return { problems: [] };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        problems: [
          {
            severity: "warning",
            message: `Frontmatter is not a YAML mapping (got ${Array.isArray(parsed) ? "array" : typeof parsed}); ignored.`,
            line: yamlNode.position?.start.line,
          },
        ],
      };
    }
    return { frontmatter: parsed as Record<string, unknown>, problems: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      problems: [
        {
          severity: "warning",
          message: `Malformed YAML frontmatter: ${message}`,
          line: yamlNode.position?.start.line,
        },
      ],
    };
  }
}
