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

const bytes = fs.statSync(target).size;
console.log(`Built dist/index.html (${bytes} bytes)`);
