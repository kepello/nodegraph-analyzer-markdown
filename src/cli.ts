#!/usr/bin/env node
/**
 * Subprocess entry point for `@kepello/nodegraph-analyzer-markdown`.
 *
 * Discovers `.md` and `.markdown` files matching the supplied filter,
 * runs the analyzer per file, and emits NDJSON to stdout per
 * `@kepello/nodegraph-analysis/protocol`.
 *
 * Mirrors the conventions of `@kepello/nodegraph-analyzer-typescript`'s
 * CLI: `--path` is required; `--include` / `--exclude` are simple
 * substring filters (the host orchestrator does the proper glob work
 * before passing patterns through, so simple substring matching here
 * is enough to compose).
 */

import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnalysisMode,
  AnalyzerMessage,
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
  mode: AnalysisMode;
  include: string[];
  exclude: string[];
}

function parseArgs(argv: string[]): Args {
  let path = "";
  let mode: AnalysisMode = "structure";
  const include: string[] = [];
  const exclude: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--path" && i + 1 < argv.length) {
      path = argv[++i]!;
    } else if (arg === "--mode" && i + 1 < argv.length) {
      const m = argv[++i]!;
      if (m === "identity" || m === "structure" || m === "full") mode = m;
    } else if (arg === "--include" && i + 1 < argv.length) {
      include.push(argv[++i]!);
    } else if (arg === "--exclude" && i + 1 < argv.length) {
      exclude.push(argv[++i]!);
    }
  }

  if (!path) {
    log("Error: --path <repo-root> is required");
    process.exit(1);
  }
  return { path, mode, include, exclude };
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".cache"]);

function matchesFilter(filePath: string, include: string[], exclude: string[]): boolean {
  if (exclude.length > 0) {
    for (const pattern of exclude) {
      if (filePath.includes(pattern.replace(/\*\*/g, "").replace(/\*/g, ""))) {
        return false;
      }
    }
  }
  if (include.length > 0) {
    return include.some((pattern) =>
      filePath.includes(pattern.replace(/\*\*/g, "").replace(/\*/g, "")),
    );
  }
  return true;
}

function discoverFiles(dir: string, include: string[], exclude: string[]): string[] {
  const results: string[] = [];
  function walk(currentDir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (MARKDOWN_EXTENSIONS.has(extname(entry).toLowerCase())) {
        const relPath = relative(dir, fullPath);
        if (matchesFilter(relPath, include, exclude)) {
          results.push(fullPath);
        }
      }
    }
  }
  walk(dir);
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startTime = Date.now();
  const files = discoverFiles(args.path, args.include, args.exclude);
  log(
    `nodegraph-analyzer-markdown: mode=${args.mode}, found ${files.length} markdown files`,
  );

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
      emit({ type: "artifact", artifact: result.artifact });
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
