#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDir = path.join(root, "dist", "docker");

await mkdir(outputDir, { recursive: true });

await build({
  entryPoints: [path.join(root, "src", "cli", "towngas-mcp.ts")],
  outfile: path.join(outputDir, "towngas-mcp.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module";const require = __createRequire(import.meta.url);'
  },
  legalComments: "none",
  minify: true,
  sourcemap: false,
  logLevel: "silent"
});
