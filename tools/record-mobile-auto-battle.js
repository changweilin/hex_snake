const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");
const ffmpeg = require("@ffmpeg-installer/ffmpeg");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const outputDir = path.join(reportsDir, "mobile-auto-battle-4x-candidates");
const tempVideoDir = path.join(outputDir, "_playwright-video");
const url = process.env.HEX_SNAKE_URL || "http://127.0.0.1:6287/";
const count = Math.max(1, Number(process.env.HEX_SNAKE_TAKE_COUNT || process.argv[2] || 5));
const durationMs = Math.max(5000, Number(process.env.HEX_SNAKE_TAKE_MS || 22000));

const matchups = [
  ["dragon", "moray"],
  ["lobster", "gu_king"],
  ["quetzal", "sandworm"],
  ["moray", "lobster"],
  ["gu_king", "dragon"],
  ["sandworm", "quetzal"],
  ["dragon", "lobster"],
  ["moray", "gu_king"]
];

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function takeName(index, player, computer) {
  return `mobile-auto-battle-4x-take-${String(index + 1).padStart(2, "0")}-${player}-vs-${computer}`;
}

async function preparePage(page, player, computer) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(({ player, computer }) => {
    localStorage.setItem("hexSnakeAutoBattleSpeed", "4");
    localStorage.setItem("hexSnakeRelayMode", "1");
    localStorage.setItem("hexSnakePortraitVariant", "human");
    localStorage.setItem("hexSnakePlayerCharacterId", player);
    localStorage.setItem("hexSnakeComputerCharacterId", computer);
    localStorage.setItem("hexSnakeSfxMuted", "1");
    localStorage.setItem("hexSnakeTutorialSeen", "1");
  }, { player, computer });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#game").waitFor({ state: "visible", timeout: 15000 });
  const introClose = page.locator("#introCloseButton");
  if (await introClose.isVisible({ timeout: 1000 }).catch(() => false)) {
    await introClose.click();
  }
  await page.locator("#computerBattleButton").waitFor({ state: "visible", timeout: 15000 });
}

async function recordTake(browser, index) {
  const [player, computer] = matchups[index % matchups.length];
  const name = takeName(index, player, computer);
  const posterPath = path.join(outputDir, `${name}-poster.png`);
  const videoPath = path.join(outputDir, `${name}.webm`);
  const rawVideoPath = path.join(outputDir, `${name}-raw.webm`);
  const takeTempDir = path.join(tempVideoDir, name);
  ensureCleanDir(takeTempDir);
  if (fs.existsSync(posterPath)) fs.rmSync(posterPath);
  if (fs.existsSync(videoPath)) fs.rmSync(videoPath);
  if (fs.existsSync(rawVideoPath)) fs.rmSync(rawVideoPath);

  const context = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: takeTempDir,
      size: { width: 540, height: 960 }
    }
  });

  const page = await context.newPage();
  page.on("console", message => {
    if (message.type() === "error") console.error(`[take ${index + 1}] ${message.text()}`);
  });

  await preparePage(page, player, computer);
  await page.locator("#computerBattleButton").click();
  await page.waitForTimeout(2000);
  await page.locator("#autoBattleSpeedSelect").waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: posterPath, fullPage: false });
  await page.waitForTimeout(durationMs);
  await context.close();

  const videos = fs.readdirSync(takeTempDir).filter(file => file.endsWith(".webm"));
  if (!videos.length) throw new Error(`Take ${index + 1} did not produce a .webm recording.`);
  fs.renameSync(path.join(takeTempDir, videos[0]), rawVideoPath);
  const convert = spawnSync(ffmpeg.path, [
    "-y",
    "-i", rawVideoPath,
    "-vf", "scale=1080:1920:flags=lanczos",
    "-c:v", "libvpx",
    "-crf", "8",
    "-b:v", "5M",
    "-an",
    videoPath
  ], { encoding: "utf8" });
  if (convert.status !== 0) {
    throw new Error(`ffmpeg failed for take ${index + 1}:\n${convert.stderr}`);
  }
  fs.rmSync(rawVideoPath, { force: true });
  return { videoPath, posterPath, player, computer };
}

async function main() {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  ensureCleanDir(tempVideoDir);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (let index = 0; index < count; index += 1) {
      results.push(await recordTake(browser, index));
      console.log(`Recorded ${index + 1}/${count}: ${results[results.length - 1].videoPath}`);
    }
  } finally {
    await browser.close();
  }

  fs.rmSync(tempVideoDir, { recursive: true, force: true });
  const manifestPath = path.join(outputDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    url,
    speed: "4x",
    portraitVariant: "human",
    viewport: { width: 540, height: 960 },
    videoSize: { width: 1080, height: 1920 },
    durationMs,
    takes: results
  }, null, 2));
  console.log(`Manifest: ${manifestPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
