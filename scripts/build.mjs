#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(root, "dist");

await rm(distDir, { recursive: true, force: true });

const entryPoints = (
  await Promise.all([
    collectTypeScriptFiles(path.join(root, "src")),
    collectTypeScriptFiles(path.join(root, "test"))
  ])
).flat();

await build({
  entryPoints,
  outbase: root,
  outdir: distDir,
  platform: "node",
  format: "esm",
  target: "node20",
  bundle: false,
  sourcemap: true,
  logLevel: "silent"
});

await runTsc(["-p", "tsconfig.json", "--emitDeclarationOnly"]);

async function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function runTsc(args) {
  const command = process.platform === "win32" ? "tsc.cmd" : "tsc";
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tsc exited with code ${code}`));
      }
    });
  });
}
