const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

const root = path.resolve(__dirname, "..");
const files = [
  "data/characters.json",
  "dist/data/characters.json"
];

const decoder = new TextDecoder("utf-8", { fatal: true });

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) continue;

  const bytes = fs.readFileSync(filePath);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error(`${relativePath} must be UTF-8 without BOM for Node JSON.parse compatibility.`);
  }

  const text = decoder.decode(bytes);
  JSON.parse(text);
  console.log(`${relativePath}: UTF-8 JSON ok`);
}
