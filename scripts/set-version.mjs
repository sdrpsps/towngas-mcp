#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];

if (!version) {
  throw new Error("Usage: node scripts/set-version.mjs <semver>");
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid semver version: ${version}`);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

packageJson.version = version;

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
