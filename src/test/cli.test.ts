/**
 * End-to-end smoke test: invoke the built CLI as a subprocess against
 * the fixtures directory, parse its NDJSON output, and verify each
 * line is a valid `AnalyzerMessage`.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnalyzerArtifact,
  AnalyzerMessage,
} from "@kepello/nodegraph-analysis/protocol";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(HERE, "..", "..");
const CLI_DIST = join(PACKAGE_ROOT, "dist", "cli.js");
const FIXTURES = join(HERE, "fixtures");

test("cli — runs as subprocess and emits valid NDJSON", () => {
  if (!existsSync(CLI_DIST)) {
    // The compiled CLI is required for the subprocess invocation. If
    // someone runs the test before `npm run build`, surface that as a
    // skip rather than a confusing process failure.
    assert.fail(
      `dist/cli.js not present — run \`npm run build\` before \`npm test\` for the CLI smoke test`,
    );
  }

  const result = spawnSync(process.execPath, [CLI_DIST, "--path", FIXTURES], {
    encoding: "utf-8",
    // Analyzer reads config from stdin; pipe an empty config so file
    // discovery uses defaults (empty stdin throws "config not provided").
    input: JSON.stringify({}),
  });
  assert.equal(result.status, 0, `CLI exited non-zero: ${result.stderr}`);

  const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0);
  assert.ok(lines.length > 0, "expected at least one NDJSON line");

  const messages: AnalyzerMessage[] = lines.map((line) => {
    try {
      return JSON.parse(line) as AnalyzerMessage;
    } catch (err) {
      throw new Error(`Invalid JSON on stdout line: ${line}`);
    }
  });

  // Last message must be `complete`; everything before should be
  // `artifact` / `error` / `progress`.
  const last = messages[messages.length - 1]!;
  assert.equal(last.type, "complete");

  const artifacts = messages.filter(
    (m): m is { type: "artifact"; artifact: AnalyzerArtifact } => m.type === "artifact",
  );
  assert.ok(artifacts.length >= 4, "expected ≥4 fixture artifacts");

  for (const { artifact } of artifacts) {
    assert.equal(artifact.language, "markdown");
    assert.ok(artifact.id);
    assert.ok(Array.isArray(artifact.elements));
    for (const el of artifact.elements) {
      assert.ok(el.name);
      assert.ok(el.kind);
      assert.ok(el.sourceLocation);
      assert.ok(el.sourceHash);
    }
  }
});
