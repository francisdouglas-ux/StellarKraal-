#!/usr/bin/env node
/**
 * Syncs backend/openapi.json info.version with backend/package.json version.
 * Updates only the version field to avoid reformatting the entire spec.
 * Run via: npm run openapi:sync (from backend/)
 */
const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(backendRoot, "package.json"), "utf8"));
const specPath = path.join(backendRoot, "openapi.json");
let specText = fs.readFileSync(specPath, "utf8");
const spec = JSON.parse(specText);

const previous = spec.info.version;
if (previous === pkg.version) {
  console.log(`openapi.json info.version already matches package.json (${pkg.version})`);
  process.exit(0);
}

spec.info.version = pkg.version;
const versionPattern = /("info"\s*:\s*\{[\s\S]*?"version"\s*:\s*")[^"]+(")/;
if (!versionPattern.test(specText)) {
  console.error("ERROR: Could not locate info.version in openapi.json");
  process.exit(1);
}

specText = specText.replace(versionPattern, `$1${pkg.version}$2`);
fs.writeFileSync(specPath, specText);
console.log(`Updated openapi.json info.version: ${previous} → ${pkg.version}`);
