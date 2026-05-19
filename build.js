const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const root = __dirname;
const outDir = path.join(root, "dist");
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const characterDataPath = path.join(root, "data", "characters.json");
const audioManifestPath = path.join(root, "assets", "audio", "characters", "manifest.json");
const buildArgs = new Set(process.argv.slice(2));
const buildTarget = buildArgs.has("--mobile") ? "mobile" : "web";
const platformSource = buildTarget === "mobile" ? "src/platform/mobile.js" : "src/platform/web.js";
const legacySources = [
  platformSource,
  "src/state.js",
  "src/dom.js",
  "src/ui.js",
  "src/characters.js",
  "src/audio.js",
  "src/replay.js",
  "src/stats.js",
  "src/about.js",
  "src/ai.js",
  "src/render.js",
  "src/game.js"
];
const bundlePath = "assets/app.bundle.js";
const bundleMapPath = `${bundlePath}.map`;
const buildVersion = (process.env.HEX_SNAKE_BUILD_VERSION || new Date().toISOString())
  .replace(/[^a-zA-Z0-9_.-]/g, "-");
const appVersion = packageInfo.version || "0.0.0";
const deployImageFormat = process.env.HEX_SNAKE_IMAGE_FORMAT === "png" ? "png" : "webp";
const optimizePortraitImages = deployImageFormat === "webp";
const deployAudioFormat = process.env.HEX_SNAKE_AUDIO_FORMAT === "wav" ? "wav" : "m4a";
const optimizeAudioAssets = deployAudioFormat === "m4a";
const optimizeRuntimeAssets = optimizePortraitImages || optimizeAudioAssets;
const webpQuality = Number(process.env.HEX_SNAKE_WEBP_QUALITY || 82);
const assetOptimizationConcurrencySource = Number(
  process.env.HEX_SNAKE_ASSET_CONCURRENCY || process.env.HEX_SNAKE_IMAGE_CONCURRENCY || os.cpus().length || 1
);
const assetOptimizationConcurrency = Math.max(1, Math.min(4, assetOptimizationConcurrencySource));
const portraitVariants = ["human", "beast", "chibi"];
const deployedPortraitSizes = ["sm", "md"];
const staticUiAssets = [
  "assets/logos/favicon.ico",
  "assets/logos/white-dragon-logo.png",
  "assets/logos/white-dragon-favicon-16.png",
  "assets/logos/white-dragon-favicon-32.png",
  "assets/logos/white-dragon-favicon-48.png",
  "assets/logos/white-dragon-favicon-64.png",
  "assets/logos/white-dragon-favicon-128.png",
  "assets/logos/white-dragon-icon-192.png",
  "assets/logos/white-dragon-icon-512.png",
  "assets/logos/white-dragon-apple-touch.png"
];
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

if (!Number.isFinite(webpQuality) || webpQuality < 1 || webpQuality > 100) {
  throw new Error("HEX_SNAKE_WEBP_QUALITY must be a number between 1 and 100.");
}

if (!Number.isFinite(assetOptimizationConcurrencySource) || assetOptimizationConcurrencySource <= 0) {
  throw new Error("HEX_SNAKE_ASSET_CONCURRENCY must be a positive number.");
}

const distBudgetBytes = Math.round(distBudgetMb * 1024 * 1024);
const ffmpegPath = optimizeRuntimeAssets ? require("@ffmpeg-installer/ffmpeg").path : "";

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function relativeFromRoot(filePath) {
  return toPosixPath(path.relative(root, filePath));
}

function addManifestEntry(relativePath, bytes, manifest) {
  manifest.files.push({ path: relativePath, bytes });
  manifest.totalBytes += bytes;
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
  addManifestEntry(relativePath, bytes, manifest);
  return true;
}

function writeTextFile(relativePath, text, manifest) {
  const target = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, "utf8");
  addManifestEntry(relativePath, Buffer.byteLength(text, "utf8"), manifest);
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

function isPortraitPngAsset(relativePath) {
  return /^assets\/portraits\/.+\.png$/i.test(relativePath);
}

function isCharacterAudioWavAsset(relativePath) {
  return /^assets\/audio\/characters\/.+\.wav$/i.test(relativePath);
}

function isCharacterAudioManifest(relativePath) {
  return relativePath === "assets/audio/characters/manifest.json";
}

function optimizedAssetPath(relativePath) {
  if (!optimizePortraitImages || !isPortraitPngAsset(relativePath)) return relativePath;
  return relativePath.replace(/\.png$/i, ".webp");
}

function optimizedAudioAssetPath(relativePath) {
  if (!optimizeAudioAssets || !isCharacterAudioWavAsset(relativePath)) return relativePath;
  return relativePath.replace(/\.wav$/i, ".m4a");
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function convertPortraitAsset(relativePath, manifest) {
  const source = path.join(root, relativePath);
  const targetRelativePath = optimizedAssetPath(relativePath);
  const target = path.join(outDir, targetRelativePath);

  if (!fs.existsSync(source)) {
    manifest.missing.push(relativePath);
    return false;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-c:v",
      "libwebp",
      "-quality",
      String(webpQuality),
      "-compression_level",
      "4",
      "-threads",
      "1",
      target
    ]);
  } catch (error) {
    const detail = error?.message || "unknown ffmpeg error";
    throw new Error(`Failed to optimize ${relativePath}: ${detail}`);
  }

  const originalBytes = fs.statSync(source).size;
  const optimizedBytes = fs.statSync(target).size;
  addManifestEntry(targetRelativePath, optimizedBytes, manifest);
  manifest.optimization.images.converted += 1;
  manifest.optimization.images.originalBytes += originalBytes;
  manifest.optimization.images.optimizedBytes += optimizedBytes;
  manifest.optimization.images.savedBytes += originalBytes - optimizedBytes;
  return true;
}

async function convertAudioAsset(relativePath, manifest) {
  const source = path.join(root, relativePath);
  const targetRelativePath = optimizedAudioAssetPath(relativePath);
  const target = path.join(outDir, targetRelativePath);

  if (!fs.existsSync(source)) {
    manifest.missing.push(relativePath);
    return false;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      target
    ]);
  } catch (error) {
    const detail = error?.message || "unknown ffmpeg error";
    throw new Error(`Failed to optimize ${relativePath}: ${detail}`);
  }

  const originalBytes = fs.statSync(source).size;
  const optimizedBytes = fs.statSync(target).size;
  addManifestEntry(targetRelativePath, optimizedBytes, manifest);
  manifest.optimization.audio.converted += 1;
  manifest.optimization.audio.originalBytes += originalBytes;
  manifest.optimization.audio.optimizedBytes += optimizedBytes;
  manifest.optimization.audio.savedBytes += originalBytes - optimizedBytes;
  return true;
}

function copyCharacterAudioManifest(manifest) {
  const audioManifest = loadJson(audioManifestPath, null);
  if (!audioManifest) {
    manifest.missing.push("assets/audio/characters/manifest.json");
    return false;
  }
  const files = (audioManifest.files || []).map(file => {
    const path = optimizedAudioAssetPath(file.path);
    if (path !== file.path) manifest.optimization.audio.rewrittenManifestPaths += 1;
    return { ...file, path };
  });
  writeTextFile("assets/audio/characters/manifest.json", `${JSON.stringify({
    ...audioManifest,
    format: deployAudioFormat,
    sourceFormat: optimizeAudioAssets ? "wav" : deployAudioFormat,
    files
  }, null, 2)}\n`, manifest);
  return true;
}

function copyRuntimeAsset(relativePath, manifest) {
  if (optimizePortraitImages && isPortraitPngAsset(relativePath)) {
    return convertPortraitAsset(relativePath, manifest);
  }
  if (optimizeAudioAssets && isCharacterAudioManifest(relativePath)) {
    return copyCharacterAudioManifest(manifest);
  }
  if (optimizeAudioAssets && isCharacterAudioWavAsset(relativePath)) {
    return convertAudioAsset(relativePath, manifest);
  }
  return copyFile(relativePath, manifest);
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function copyRuntimeAssets(relativePaths, manifest) {
  await runWithConcurrency(relativePaths, assetOptimizationConcurrency, relativePath => copyRuntimeAsset(relativePath, manifest));
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

function rewriteDeployAssetPaths(value, manifest) {
  if (typeof value === "string") {
    const rewritten = optimizedAssetPath(value);
    if (rewritten !== value) manifest.optimization.images.rewrittenJsonPaths += 1;
    return rewritten;
  }
  if (Array.isArray(value)) {
    return value.map(item => rewriteDeployAssetPaths(item, manifest));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteDeployAssetPaths(item, manifest)])
    );
  }
  return value;
}

function copyDataDirectory(manifest) {
  const source = path.join(root, "data");
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
      const relativePath = relativeFromRoot(fullPath);
      if (relativePath === "data/characters.json" && optimizePortraitImages) {
        const characters = rewriteDeployAssetPaths(loadJson(fullPath, []), manifest);
        writeTextFile(relativePath, `${JSON.stringify(characters, null, 2)}\n`, manifest);
        return;
      }
      copyFile(relativePath, manifest);
    });
  }
}

function productionServiceWorkerRegistration() {
  return `  <script>
    (() => {
      if (!("serviceWorker" in navigator)) return;
      let refreshing = false;
      const prompt = () => document.getElementById("pwaUpdatePrompt");
      const showUpdatePrompt = worker => {
        const root = prompt();
        if (!root || !worker) return;
        root.hidden = false;
        root.querySelector("[data-pwa-update-reload]")?.addEventListener("click", () => {
          worker.postMessage({ type: "SKIP_WAITING" });
        }, { once: true });
        root.querySelector("[data-pwa-update-dismiss]")?.addEventListener("click", () => {
          root.hidden = true;
        }, { once: true });
      };
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").then(registration => {
          if (registration.waiting) showUpdatePrompt(registration.waiting);
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdatePrompt(worker);
            });
          });
        }).catch(error => console.warn("Service worker registration failed:", error));
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    })();
  </script>`;
}

function buildIndexHtml() {
  const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scriptTag = '  <script type="module" src="src/main.js"></script>';
  const replacement = `${productionServiceWorkerRegistration()}\n  <script type="module" src="${bundlePath}"></script>`;
  if (!source.includes(scriptTag)) {
    throw new Error("Could not find src/main.js script tag in index.html.");
  }
  return source.replace(scriptTag, replacement);
}

function createLegacyBundle() {
  const bundleSources = ["src/main.js", ...legacySources];
  const chunks = [
    "window.__HEX_SNAKE_BUNDLED_LEGACY__ = true;",
    `window.__HEX_SNAKE_APP_VERSION__ = ${JSON.stringify(appVersion)};`,
    `window.__HEX_SNAKE_BUILD_VERSION__ = ${JSON.stringify(buildVersion)};`,
    `window.__HEX_SNAKE_BUILD_TARGET__ = ${JSON.stringify(buildTarget)};`,
    `window.__HEX_SNAKE_IMAGE_FORMAT__ = ${JSON.stringify(deployImageFormat)};`,
    `window.__HEX_SNAKE_AUDIO_FORMAT__ = ${JSON.stringify(deployAudioFormat)};`
  ];

  bundleSources.forEach(source => {
    const code = fs.readFileSync(path.join(root, source), "utf8");
    chunks.push(`\n/* ${source} */\n${code}`);
  });

  chunks.push(`\n//# sourceMappingURL=${path.basename(bundleMapPath)}`);

  const map = {
    version: 3,
    file: path.basename(bundlePath),
    sources: bundleSources,
    sourcesContent: bundleSources.map(source => fs.readFileSync(path.join(root, source), "utf8")),
    names: [],
    mappings: ""
  };

  return {
    code: `${chunks.join("\n")}\n`,
    map: `${JSON.stringify(map, null, 2)}\n`
  };
}

function buildServiceWorker(precacheUrls) {
  const template = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  return template
    .replace("__HEX_SNAKE_CACHE_VERSION__", `hex-snake-${buildVersion}`)
    .replace("__HEX_SNAKE_PRECACHE_URLS__", JSON.stringify(precacheUrls, null, 2));
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
  appVersion,
  buildVersion,
  buildTarget,
  strategy: "single production bundle plus referenced runtime assets",
  entrypoints: {
    html: "index.html",
    script: bundlePath,
    styles: "src/styles.css"
  },
  sourceMap: {
    path: bundleMapPath,
    mode: "sourcesContent without generated-line mappings"
  },
  optimization: {
    images: {
      enabled: optimizePortraitImages,
      format: deployImageFormat,
      quality: optimizePortraitImages ? webpQuality : null,
      sourcePattern: "assets/portraits/**/*.png",
      converted: 0,
      rewrittenJsonPaths: 0,
      originalBytes: 0,
      optimizedBytes: 0,
      savedBytes: 0
    },
    audio: {
      enabled: optimizeAudioAssets,
      format: deployAudioFormat,
      bitrate: optimizeAudioAssets ? "96k" : null,
      sourcePattern: "assets/audio/characters/**/*.wav",
      converted: 0,
      rewrittenManifestPaths: 0,
      originalBytes: 0,
      optimizedBytes: 0,
      savedBytes: 0
    }
  },
  files: [],
  missing: [],
  totalBytes: 0,
  summaries: {}
};

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  writeTextFile("index.html", buildIndexHtml(), manifest);
  copyDataDirectory(manifest);
  copyFile("src/styles.css", manifest);
  staticUiAssets.forEach(relativePath => copyFile(relativePath, manifest));
  await copyRuntimeAssets(collectRuntimeAssets(), manifest);
  copyFile("manifest.webmanifest", manifest);
  copyFile("offline.html", manifest);

  const legacyBundle = createLegacyBundle();
  writeTextFile(bundlePath, legacyBundle.code, manifest);
  writeTextFile(bundleMapPath, legacyBundle.map, manifest);

  const precacheUrls = [
    "index.html",
    "offline.html",
    "manifest.webmanifest",
    "build-asset-manifest.json",
    ...manifest.files.map(file => file.path)
  ].filter((value, index, all) => all.indexOf(value) === index);
  writeTextFile("service-worker.js", buildServiceWorker(precacheUrls), manifest);

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
  console.log(`portrait images: ${manifest.optimization.images.converted} WebP files`);
  console.log(`portrait savings: ${formatMb(manifest.optimization.images.savedBytes)}`);
  console.log(`character audio: ${manifest.optimization.audio.converted} M4A files`);
  console.log(`audio savings: ${formatMb(manifest.optimization.audio.savedBytes)}`);
  console.log(`dist size: ${formatMb(manifest.summaries.dist.bytes)}`);
  console.log(`asset size: ${formatMb(manifest.summaries.assets.bytes)}`);
  console.log(`dist budget: ${formatMb(manifest.budget.distMaxBytes)}`);
  console.log(`forbidden deployment assets: ${manifest.forbidden.length}`);
  console.log(`Manifest: ${relativeFromRoot(manifestPath)}`);
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
