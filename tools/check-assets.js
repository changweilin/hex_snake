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
const portraitPngFiles = (manifest.files || [])
  .map(file => file.path)
  .filter(relativePath => /^assets\/portraits\/.+\.png$/i.test(relativePath));
const portraitWebpFiles = (manifest.files || [])
  .map(file => file.path)
  .filter(relativePath => /^assets\/portraits\/.+\.webp$/i.test(relativePath));
const characterAudioWavFiles = (manifest.files || [])
  .map(file => file.path)
  .filter(relativePath => /^assets\/audio\/characters\/.+\.wav$/i.test(relativePath));
const characterAudioM4aFiles = (manifest.files || [])
  .map(file => file.path)
  .filter(relativePath => /^assets\/audio\/characters\/.+\.m4a$/i.test(relativePath));

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

const imageOptimization = manifest.optimization?.images;
if (!imageOptimization?.enabled || imageOptimization.format !== "webp") {
  fail("Build manifest does not report WebP portrait optimization.");
}

if (portraitPngFiles.length) {
  fail(`dist contains optimized portrait sources as PNG:\n${portraitPngFiles.join("\n")}`);
}

if (!portraitWebpFiles.length || imageOptimization.converted !== portraitWebpFiles.length) {
  fail("WebP portrait optimization count does not match manifest files.");
}

if (imageOptimization.savedBytes <= 0) {
  fail("WebP portrait optimization did not reduce total portrait bytes.");
}

const characterData = fs.readFileSync(path.join(dist, "data", "characters.json"), "utf8");
if (/assets\/portraits\/[^"]+\.png/i.test(characterData)) {
  fail("dist/data/characters.json still references PNG portrait assets.");
}

const audioOptimization = manifest.optimization?.audio;
if (!audioOptimization?.enabled || audioOptimization.format !== "m4a") {
  fail("Build manifest does not report M4A character audio optimization.");
}

if (characterAudioWavFiles.length) {
  fail(`dist contains deployable character audio as WAV:\n${characterAudioWavFiles.join("\n")}`);
}

if (!characterAudioM4aFiles.length || audioOptimization.converted !== characterAudioM4aFiles.length) {
  fail("M4A character audio optimization count does not match manifest files.");
}

if (audioOptimization.savedBytes <= 0) {
  fail("M4A character audio optimization did not reduce total audio bytes.");
}

const audioManifest = fs.readFileSync(path.join(dist, "assets", "audio", "characters", "manifest.json"), "utf8");
if (/assets\/audio\/characters\/[^"]+\.wav/i.test(audioManifest)) {
  fail("dist/assets/audio/characters/manifest.json still references WAV character audio.");
}

const serviceWorker = fs.readFileSync(path.join(dist, "service-worker.js"), "utf8");
["index.html", "assets/app.bundle.js", "build-asset-manifest.json"].forEach(relativePath => {
  if (!serviceWorker.includes(relativePath)) fail(`service-worker.js does not precache ${relativePath}.`);
});

console.log(`Asset check passed: ${manifest.files.length} files listed, ${portraitWebpFiles.length} WebP portraits, ${characterAudioM4aFiles.length} M4A sounds.`);
