#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

const root = path.resolve(__dirname, "..");
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".md",
  ".txt",
  ".webmanifest"
]);
const explicitFiles = [
  "README.md",
  "README.en.md",
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "pre-app-optimization-plan.md",
  "app-deployment-plan.md",
  "package.json",
  "service-worker.js"
];
const scanRoots = [
  "src",
  "data",
  "doc",
  "tools",
  "dist"
];
const ignoredDirectories = new Set([
  ".git",
  "assets",
  "node_modules",
  "output",
  "reports"
]);
const mojibakeMarkerPattern = new RegExp(
  [
    "\\u00c3",
    "\\u00c2",
    "\\u00e2\\u20ac",
    "\\u00e2\\u20ac\\u2122",
    "\\u00e2\\u20ac\\u0153",
    "\\u00e2\\u20ac\\u009d"
  ].join("|"),
  "u"
);
const regexpMetaPattern = /[\\^$.*+?()[\]{}|]/g;

function literalPatternFromCodePoints(codePoints) {
  const literal = String.fromCodePoint(...codePoints).replace(regexpMetaPattern, "\\$&");
  return new RegExp(literal, "u");
}

const suspiciousPatterns = [
  { label: "replacement character", pattern: /\uFFFD/u },
  { label: "private-use glyph", pattern: /[\uE000-\uF8FF]/u },
  { label: "common mojibake marker", pattern: mojibakeMarkerPattern },
  { label: "garbled energy label", pattern: literalPatternFromCodePoints([0x3f, 0x8ce1, 0x3f]) },
  { label: "garbled bomb label", pattern: literalPatternFromCodePoints([0x3f, 0x8a68, 0x3f]) }
];
const decoder = new TextDecoder("utf-8", { fatal: true });

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function relativeFromRoot(filePath) {
  return toPosixPath(path.relative(root, filePath));
}

function addFile(files, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  if (!fs.statSync(absolutePath).isFile()) return;
  files.set(relativeFromRoot(absolutePath), absolutePath);
}

function collectTextFiles() {
  const files = new Map();
  explicitFiles.forEach(relativePath => addFile(files, relativePath));

  for (const relativeRoot of scanRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    const stack = [absoluteRoot];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!ignoredDirectories.has(entry.name)) stack.push(path.join(current, entry.name));
          continue;
        }
        if (!entry.isFile()) continue;
        const absolutePath = path.join(current, entry.name);
        if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
          files.set(relativeFromRoot(absolutePath), absolutePath);
        }
      }
    }
  }

  return [...files.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function findSuspiciousText(relativePath, text) {
  const issues = [];
  suspiciousPatterns.forEach(({ label, pattern }) => {
    const match = pattern.exec(text);
    if (!match) return;
    const position = lineColumn(text, match.index);
    issues.push(`${relativePath}:${position.line}:${position.column} ${label}`);
  });
  return issues;
}

const issues = [];
const files = collectTextFiles();

for (const [relativePath, absolutePath] of files) {
  const bytes = fs.readFileSync(absolutePath);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    issues.push(`${relativePath}:1:1 UTF-8 BOM is not allowed`);
    continue;
  }

  let text = "";
  try {
    text = decoder.decode(bytes);
  } catch (error) {
    issues.push(`${relativePath}: invalid UTF-8 (${error.message})`);
    continue;
  }

  issues.push(...findSuspiciousText(relativePath, text));
}

if (issues.length) {
  console.error(`Text encoding check failed with ${issues.length} issue(s):`);
  issues.slice(0, 40).forEach(issue => console.error(`- ${issue}`));
  if (issues.length > 40) console.error(`... ${issues.length - 40} more`);
  process.exit(1);
}

console.log(`Text encoding check passed: ${files.length} files scanned.`);
