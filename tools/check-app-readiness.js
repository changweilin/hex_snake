#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const requiredScripts = [
  "build",
  "build:web",
  "build:pwa",
  "start",
  "test:quick",
  "test:mobile",
  "test:smoke",
  "test:offline",
  "release:check"
];
const requiredDistFiles = [
  "index.html",
  "assets/app.bundle.js",
  "assets/app.bundle.js.map",
  "src/styles.css",
  "manifest.webmanifest",
  "offline.html",
  "service-worker.js",
  "build-asset-manifest.json"
];
const requiredPrecache = [
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "build-asset-manifest.json",
  "assets/app.bundle.js",
  "src/styles.css"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`${relativePath} is missing.`);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

function readText(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`${relativePath} is missing.`);
  return fs.readFileSync(fullPath, "utf8");
}

function assertFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) fail(`${relativePath} is missing.`);
}

function assertDistFile(relativePath) {
  if (!fs.existsSync(path.join(dist, relativePath))) fail(`dist/${relativePath} is missing. Run npm run build first.`);
}

function iconSizes(icon) {
  return String(icon?.sizes || "").split(/\s+/).filter(Boolean);
}

function checkPackageScripts() {
  const packageInfo = readJson("package.json");
  requiredScripts.forEach(script => {
    if (!packageInfo.scripts?.[script]) fail(`package.json is missing npm script "${script}".`);
  });
  return packageInfo;
}

function checkSourcePwa() {
  const index = readText("index.html");
  if (!index.includes('rel="manifest"')) fail("index.html does not link manifest.webmanifest.");
  if (!index.includes("pwaUpdatePrompt")) fail("index.html does not include the PWA update prompt shell.");

  const manifest = readJson("manifest.webmanifest");
  ["name", "short_name", "start_url", "scope", "display", "background_color", "theme_color"].forEach(field => {
    if (!manifest[field]) fail(`manifest.webmanifest is missing "${field}".`);
  });
  if (manifest.display !== "standalone") fail("manifest.webmanifest display must be standalone.");
  if (!Array.isArray(manifest.icons) || !manifest.icons.length) fail("manifest.webmanifest has no icons.");
  if (!manifest.icons.some(icon => iconSizes(icon).includes("192x192"))) fail("manifest.webmanifest needs a 192x192 icon.");
  if (!manifest.icons.some(icon => iconSizes(icon).includes("512x512"))) fail("manifest.webmanifest needs a 512x512 icon.");
  manifest.icons.forEach(icon => assertFile(icon.src));

  const serviceWorker = readText("service-worker.js");
  if (!serviceWorker.includes("__HEX_SNAKE_CACHE_VERSION__")) fail("service-worker.js source must keep the cache version placeholder.");
  if (!serviceWorker.includes("__HEX_SNAKE_PRECACHE_URLS__")) fail("service-worker.js source must keep the precache placeholder.");
  if (!serviceWorker.includes("offline.html")) fail("service-worker.js source must reference offline.html.");
  assertFile("offline.html");
}

function checkDistBuild(packageInfo) {
  requiredDistFiles.forEach(assertDistFile);

  const index = readText("dist/index.html");
  if (index.includes('src="src/main.js"')) fail("dist/index.html still loads src/main.js instead of the production bundle.");
  if (!index.includes('src="assets/app.bundle.js"')) fail("dist/index.html does not load assets/app.bundle.js.");
  if (!index.includes("navigator.serviceWorker.register")) fail("dist/index.html does not register the service worker.");

  const manifest = readJson("dist/build-asset-manifest.json");
  const files = new Set((manifest.files || []).map(file => file.path));
  requiredDistFiles.forEach(relativePath => {
    if (!files.has(relativePath) && relativePath !== "build-asset-manifest.json") {
      fail(`dist/build-asset-manifest.json does not list ${relativePath}.`);
    }
  });
  if (manifest.appVersion !== packageInfo.version) {
    fail(`dist build manifest appVersion ${manifest.appVersion} does not match package.json ${packageInfo.version}.`);
  }
  if (!manifest.buildVersion || manifest.buildVersion === "dev") fail("dist build manifest has no production buildVersion.");
  if (manifest.missing?.length) fail(`dist build manifest reports missing files:\n${manifest.missing.join("\n")}`);
  if (manifest.forbidden?.length) {
    fail(`dist build manifest reports forbidden files:\n${manifest.forbidden.map(item => item.path).join("\n")}`);
  }
  if (!manifest.budget?.passed) fail("dist build manifest budget did not pass.");
  if (!manifest.optimization?.images?.enabled || manifest.optimization.images.format !== "webp") {
    fail("dist build manifest does not report WebP image optimization.");
  }
  if (!manifest.optimization?.audio?.enabled || manifest.optimization.audio.format !== "m4a") {
    fail("dist build manifest does not report M4A audio optimization.");
  }

  const distManifest = readJson("dist/manifest.webmanifest");
  distManifest.icons.forEach(icon => assertDistFile(icon.src));

  const serviceWorker = readText("dist/service-worker.js");
  if (serviceWorker.includes("__HEX_SNAKE_")) fail("dist/service-worker.js still contains template placeholders.");
  if (!serviceWorker.includes(`hex-snake-${manifest.buildVersion}`)) {
    fail("dist/service-worker.js cache name does not include the build version.");
  }
  requiredPrecache.forEach(relativePath => {
    if (!serviceWorker.includes(relativePath)) fail(`dist/service-worker.js does not precache ${relativePath}.`);
  });

  const bundle = readText("dist/assets/app.bundle.js");
  ["__HEX_SNAKE_BUNDLED_LEGACY__", "__HEX_SNAKE_APP_VERSION__", "__HEX_SNAKE_BUILD_VERSION__"].forEach(marker => {
    if (!bundle.includes(marker)) fail(`dist/assets/app.bundle.js is missing ${marker}.`);
  });

  return manifest;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  const packageInfo = checkPackageScripts();
  checkSourcePwa();
  const manifest = checkDistBuild(packageInfo);
  console.log([
    "App readiness check passed:",
    `dist ${formatMb(manifest.budget.distBytes)} / budget ${manifest.budget.distMaxMb} MB`,
    `build ${manifest.buildVersion}`,
    `${manifest.optimization.images.converted} WebP portraits`,
    `${manifest.optimization.audio.converted} M4A sounds`
  ].join(" "));
}

main();
