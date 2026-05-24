#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "dist", "build-asset-manifest.json");

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

if (!fs.existsSync(manifestPath)) {
  console.error("dist/build-asset-manifest.json is missing. Run npm run build first.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const budget = manifest.budget || {};

if (!budget.passed) {
  console.error(`dist size ${formatMb(budget.distBytes || 0)} exceeds budget ${formatMb(budget.distMaxBytes || 0)}.`);
  process.exit(1);
}

console.log(`dist size ${formatMb(budget.distBytes || 0)} within budget ${formatMb(budget.distMaxBytes || 0)}.`);
