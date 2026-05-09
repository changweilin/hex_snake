const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");
const characterDataPath = path.join(root, "data", "characters.json");
const audioManifestPath = path.join(root, "assets", "audio", "characters", "manifest.json");
const portraitVariants = ["human", "beast", "chibi"];
const deployedPortraitSizes = ["sm", "md"];
const defaultDistBudgetMb = 200;
const forbiddenDistEntries = [
  { label: "_source_chroma source assets", pattern: /(^|\/)_source_chroma(\/|$)/ },
  { label: "q_versions source assets", pattern: /(^|\/)q_versions(\/|$)/ },
  { label: "backup assets", pattern: /(^|\/)backups?(\/|$)/i },
  { label: "debug assets", pattern: /(^|\/)debug(\/|[._-]|$)/i },
  { label: "root full-size portraits", pattern: /^assets\/portraits\/[^/]+\.png$/ },
  { label: "human full-size portraits", pattern: /^assets\/portraits\/human\/[^/]+\.png$/ },
  { label: "duel avatar full-size portraits", pattern: /^assets\/portraits\/avatars\/[^/]+\/full\// }
];
const distBudgetEnv = process.env.HEX_SNAKE_DIST_BUDGET_MB;
const distBudgetMb = distBudgetEnv === undefined || distBudgetEnv === ""
  ? defaultDistBudgetMb
  : Number(distBudgetEnv);

if (!Number.isFinite(distBudgetMb) || distBudgetMb <= 0) {
  throw new Error("HEX_SNAKE_DIST_BUDGET_MB must be a positive number.");
}

const distBudgetBytes = Math.round(distBudgetMb * 1024 * 1024);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function relativeFromRoot(filePath) {
  return toPosixPath(path.relative(root, filePath));
}

function copyFile(relativePath, manifest, { required = true } = {}) {
  const source = path.join(root, relativePath);
  const target = path.join(outDir, relativePath);
  if (!fs.existsSync(source)) {
    if (required) manifest.missing.push(relativePath);
    return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  const bytes = fs.statSync(source).size;
  manifest.files.push({ path: relativePath, bytes });
  manifest.totalBytes += bytes;
  return true;
}

function copyDirectory(relativePath, manifest) {
  const source = path.join(root, relativePath);
  if (!fs.existsSync(source)) return;
  const stack = [source];
  while (stack.length) {
    const current = stack.pop();
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!entry.isFile()) return;
      copyFile(relativeFromRoot(fullPath), manifest);
    });
  }
}

function collectAssetStrings(value, assets = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("assets/")) assets.add(value);
    return assets;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectAssetStrings(item, assets));
    return assets;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(item => collectAssetStrings(item, assets));
  }
  return assets;
}

function isFullSizePortraitAsset(relativePath) {
  return /^assets\/portraits\/[^/]+\.png$/.test(relativePath)
    || /^assets\/portraits\/human\/[^/]+\.png$/.test(relativePath)
    || /^assets\/portraits\/avatars\/[^/]+\/full\/[^/]+\.png$/.test(relativePath);
}

function addRuntimeAsset(assets, relativePath) {
  if (!relativePath || isFullSizePortraitAsset(relativePath)) return;
  assets.add(relativePath);
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectRuntimeAssets() {
  const discoveredAssets = collectAssetStrings(loadJson(characterDataPath, []));
  const assets = new Set([...discoveredAssets].filter(relativePath => !isFullSizePortraitAsset(relativePath)));
  const characters = loadJson(characterDataPath, []);

  characters.forEach(character => {
    const slug = character.slug || character.id;
    portraitVariants.forEach(variant => {
      deployedPortraitSizes.forEach(size => {
        addRuntimeAsset(assets, `assets/portraits/avatars/${variant}/${size}/${slug}_duel.png`);
      });
    });
  });

  const audioManifest = loadJson(audioManifestPath, null);
  if (audioManifest) {
    addRuntimeAsset(assets, "assets/audio/characters/manifest.json");
    (audioManifest.files || []).forEach(file => {
      addRuntimeAsset(assets, file.path);
    });
  }

  return [...assets].sort();
}

function directorySummary(relativePath) {
  const source = path.join(outDir, relativePath);
  let files = 0;
  let bytes = 0;
  if (!fs.existsSync(source)) return { files, bytes };
  const stack = [source];
  while (stack.length) {
    const current = stack.pop();
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!entry.isFile()) return;
      files += 1;
      bytes += fs.statSync(fullPath).size;
    });
  }
  return { files, bytes };
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function refreshSummaries(manifest) {
  manifest.summaries = {
    dist: directorySummary("."),
    assets: directorySummary("assets"),
    data: directorySummary("data"),
    src: directorySummary("src")
  };
}

function findForbiddenDistEntries(manifest) {
  return manifest.files.flatMap(file => (
    forbiddenDistEntries
      .filter(rule => rule.pattern.test(file.path))
      .map(rule => ({ path: file.path, reason: rule.label }))
  ));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  strategy: "copy runtime files plus referenced assets",
  files: [],
  missing: [],
  totalBytes: 0,
  summaries: {}
};

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

copyFile("index.html", manifest);
copyDirectory("data", manifest);
copyDirectory("src", manifest);
collectRuntimeAssets().forEach(relativePath => copyFile(relativePath, manifest));

const manifestPath = path.join(outDir, "build-asset-manifest.json");
refreshSummaries(manifest);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
refreshSummaries(manifest);
manifest.budget = {
  distMaxMb: distBudgetMb,
  distMaxBytes: distBudgetBytes,
  distBytes: manifest.summaries.dist.bytes,
  passed: manifest.summaries.dist.bytes <= distBudgetBytes
};
manifest.forbidden = findForbiddenDistEntries(manifest);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (manifest.missing.length) {
  throw new Error(`Build is missing ${manifest.missing.length} runtime asset(s):\n${manifest.missing.join("\n")}`);
}

if (manifest.forbidden.length) {
  throw new Error(
    `Build copied ${manifest.forbidden.length} forbidden deployment asset(s):\n` +
    manifest.forbidden.map(item => `${item.path} (${item.reason})`).join("\n")
  );
}

if (!manifest.budget.passed) {
  throw new Error(
    `dist size ${formatMb(manifest.budget.distBytes)} exceeds budget ${formatMb(manifest.budget.distMaxBytes)}. ` +
    "Raise HEX_SNAKE_DIST_BUDGET_MB only after confirming the artifact growth is intentional."
  );
}

const indexBytes = fs.statSync(path.join(outDir, "index.html")).size;
console.log(`Built dist/index.html (${indexBytes} bytes)`);
console.log(`Runtime files: ${manifest.files.length}`);
console.log(`Runtime assets: ${manifest.files.filter(file => file.path.startsWith("assets/")).length}`);
console.log(`dist size: ${formatMb(manifest.summaries.dist.bytes)}`);
console.log(`asset size: ${formatMb(manifest.summaries.assets.bytes)}`);
console.log(`dist budget: ${formatMb(manifest.budget.distMaxBytes)}`);
console.log(`forbidden deployment assets: ${manifest.forbidden.length}`);
console.log(`Manifest: ${relativeFromRoot(manifestPath)}`);
