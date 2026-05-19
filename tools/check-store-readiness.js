#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const requiredDocs = [
  "store/listing-draft.md",
  "store/privacy-policy-draft.md",
  "store/release-checklist.md"
];

const screenshots = [
  {
    path: "assets/screenshots/mobile-game.png",
    orientation: "portrait"
  },
  {
    path: "assets/screenshots/desktop-game.png",
    orientation: "landscape"
  }
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`${relativePath} is missing.`);
  return fs.readFileSync(fullPath, "utf8");
}

function assertFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`${relativePath} is missing.`);
  return fullPath;
}

function pngInfo(relativePath) {
  const fullPath = assertFile(relativePath);
  const buffer = fs.readFileSync(fullPath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") fail(`${relativePath} is not a PNG file.`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length
  };
}

function checkDocs() {
  let pendingItems = 0;
  requiredDocs.forEach(relativePath => {
    const text = readText(relativePath);
    if (text.trim().length < 200) fail(`${relativePath} looks too short for a store draft.`);
    pendingItems += (text.match(/- \[ \]/g) || []).length;
  });
  return pendingItems;
}

function checkScreenshots() {
  return screenshots.map(screenshot => {
    const info = pngInfo(screenshot.path);
    if (info.width < 320 || info.height < 320) {
      fail(`${screenshot.path} is too small (${info.width}x${info.height}).`);
    }
    if (screenshot.orientation === "portrait" && info.height <= info.width) {
      fail(`${screenshot.path} should be portrait but is ${info.width}x${info.height}.`);
    }
    if (screenshot.orientation === "landscape" && info.width <= info.height) {
      fail(`${screenshot.path} should be landscape but is ${info.width}x${info.height}.`);
    }
    return `${screenshot.path} ${info.width}x${info.height} ${(info.bytes / 1024).toFixed(1)} KB`;
  });
}

function main() {
  const pendingItems = checkDocs();
  const screenshotLines = checkScreenshots();
  console.log(`Store draft check passed: ${requiredDocs.length} docs, ${screenshotLines.length} screenshots.`);
  screenshotLines.forEach(line => console.log(`- ${line}`));
  if (pendingItems > 0) {
    console.log(`${pendingItems} checklist items remain open before store submission.`);
  }
}

main();
