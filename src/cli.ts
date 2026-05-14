#!/usr/bin/env node
/**
 * Subprocess entry point for `@kepello/nodegraph-analyzer-markdown`.
 *
 * Spawned by the orchestrator with `--path <repoRoot>` and the entry's
 * config slice piped to stdin (JSON, EOF-terminated). The analyzer reads
 * stdin, parses, and uses the values for file discovery + tuning. No
 * filesystem IO for config.
 */

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  dedupeArtifactEdges,
  discoverFilesByExtension,
  readAnalyzerConfigFromStdin,
  type AnalyzerMessage,
} from "@kepello/nodegraph-analysis/protocol";
import { analyzeMarkdown } from "./analyze.js";

function emit(msg: AnalyzerMessage): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function log(msg: string): void {
  process.stderr.write(msg + "\n");
}

interface Args {
  path: string;
  discover: boolean;
}

function parseArgs(argv: string[]): Args {
  let path = "";
  let discover = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--path" && i + 1 < argv.length) {
      path = argv[++i]!;
    } else if (argv[i] === "--discover") {
      discover = true;
    }
  }
  if (!path) {
    log("Error: --path <repo-root> is required");
    process.exit(1);
  }
  return { path, discover };
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = await readAnalyzerConfigFromStdin();
  const startTime = Date.now();
  const files = discoverFilesByExtension({
    repoRoot: args.path,
    extensions: MARKDOWN_EXTENSIONS,
    include: config.include,
    exclude: config.exclude,
    lowercaseExtensions: true,
  });

  if (args.discover) {
    for (const filePath of files) process.stdout.write(filePath + "\n");
    return;
  }

  log(`nodegraph-analyzer-markdown: found ${files.length} markdown files`);

  let elementsEmitted = 0;
  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      emit({ type: "error", message: `Failed to read: ${err}`, filePath });
      continue;
    }

    try {
      const result = analyzeMarkdown(filePath, content);
      emit({ type: "artifact", artifact: dedupeArtifactEdges(result.artifact) });
      elementsEmitted += result.artifact.elements.length;
    } catch (err) {
      emit({ type: "error", message: `Analyzer error: ${err}`, filePath });
    }
  }

  emit({
    type: "complete",
    elementsEmitted,
    durationMs: Date.now() - startTime,
  });
}

function isInvokedAsScript(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const here = fileURLToPath(import.meta.url);
  if (invoked === here) return true;
  try {
    return realpathSync(invoked) === realpathSync(here);
  } catch {
    return false;
  }
}

if (isInvokedAsScript()) {
  void main();
}
