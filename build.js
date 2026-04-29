const fs = require("fs");
const path = require("path");

const source = path.resolve(__dirname, "index.html");
const outDir = path.resolve(__dirname, "dist");
const target = path.join(outDir, "index.html");

if (!fs.existsSync(source)) {
  throw new Error("index.html was not found.");
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, target);

const assetsSource = path.resolve(__dirname, "assets");
const assetsTarget = path.join(outDir, "assets");

if (fs.existsSync(assetsSource)) {
  fs.cpSync(assetsSource, assetsTarget, { recursive: true });
}

const bytes = fs.statSync(target).size;
console.log(`Built dist/index.html (${bytes} bytes)`);
