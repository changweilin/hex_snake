#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const manifestPath = path.join(dist, "build-asset-manifest.json");
const requiredFiles = [
  "index.html",
  "src/styles.css",
  "assets/app.bundle.js",
  "assets/app.bundle.js.map",
  "manifest.webmanifest",
  "offline.html",
  "service-worker.js",
  "build-asset-manifest.json"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail("dist/build-asset-manifest.json is missing. Run npm run build first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const files = new Set((manifest.files || []).map(file => file.path));

if (manifest.missing?.length) {
  fail(`Build manifest reports missing assets:\n${manifest.missing.join("\n")}`);
}

if (manifest.forbidden?.length) {
  fail(`Build manifest reports forbidden assets:\n${manifest.forbidden.map(item => `${item.path} (${item.reason})`).join("\n")}`);
}

requiredFiles.forEach(relativePath => {
  const absolutePath = path.join(dist, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`${relativePath} is missing from dist.`);
});

(manifest.files || []).forEach(file => {
  if (!fs.existsSync(path.join(dist, file.path))) {
    fail(`Manifest lists ${file.path}, but the file is missing from dist.`);
  }
});

["assets/app.bundle.js", "src/styles.css", "manifest.webmanifest", "offline.html", "service-worker.js"].forEach(relativePath => {
  if (!files.has(relativePath)) fail(`Manifest does not list ${relativePath}.`);
});

const serviceWorker = fs.readFileSync(path.join(dist, "service-worker.js"), "utf8");
["index.html", "assets/app.bundle.js", "build-asset-manifest.json"].forEach(relativePath => {
  if (!serviceWorker.includes(relativePath)) fail(`service-worker.js does not precache ${relativePath}.`);
});

console.log(`Asset check passed: ${manifest.files.length} files listed.`);
