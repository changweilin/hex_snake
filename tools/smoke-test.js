#!/usr/bin/env node

const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const defaultPort = Number(process.env.HEX_SNAKE_SMOKE_PORT || process.env.PORT || 6297);
const externalUrl = process.env.HEX_SNAKE_URL || "";
const startupTimeoutMs = Number(process.env.HEX_SNAKE_SMOKE_STARTUP_MS || 15000);
const actionTimeoutMs = Number(process.env.HEX_SNAKE_SMOKE_ACTION_MS || 10000);
const replayFixtureId = "smoke-replay-1";
const replayFixtureNextId = "smoke-replay-2";

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error(
      "Playwright is required for browser smoke tests. Run `npm install` first, then retry `npm.cmd run test:smoke`."
    );
  }
}

function createReplaySnapshot(t, playerOffset = 0) {
  return {
    t,
    final: t >= 5000,
    radius: 6,
    gridSize: 7,
    playerCharacterId: "dragon",
    computerCharacterId: "sandworm",
    dir: 0,
    nextDir: 0,
    computerDir: 3,
    snake: [
      { q: -2 + playerOffset, r: 2 },
      { q: -3 + playerOffset, r: 2 },
      { q: -4 + playerOffset, r: 2 }
    ],
    computerSnake: [
      { q: 2, r: -2 },
      { q: 3, r: -2 },
      { q: 4, r: -2 }
    ],
    foods: [{ q: 0, r: 0, types: ["protein"] }],
    projectiles: [],
    blasts: [],
    hazards: [],
    targetCell: null,
    targetActive: false,
    score: t >= 2500 ? 1 : 0,
    computerScore: 0,
    playerHp: 40,
    computerHp: 40,
    playerStock: {},
    computerStock: {},
    playerAmmo: 0,
    computerAmmo: 0,
    playerAmmoCharge: 0,
    computerAmmoCharge: 0,
    totalElapsedMs: t,
    lastFeedElapsedMs: 0,
    playerStunRemaining: 0,
    playerSlowRemaining: 0,
    computerStunRemaining: 0,
    computerSlowRemaining: 0,
    playerCollisionParalysisMs: 0,
    computerCollisionParalysisMs: 0,
    playerUndergroundRemaining: 0,
    computerUndergroundRemaining: 0
  };
}

function createReplayFixture(options = {}) {
  const durationMs = options.durationMs || 5000;
  return {
    id: options.id || replayFixtureId,
    createdAt: options.createdAt || "2026-05-09T00:00:00.000Z",
    playerCharacterId: "dragon",
    computerCharacterId: options.computerCharacterId || "sandworm",
    computerBattleMode: false,
    relayMode: false,
    durationMs,
    score: 1,
    computerScore: 0,
    winnerOwner: "player",
    playerLost: false,
    computerLost: true,
    surrendered: false,
    title: options.title || "Smoke replay fixture",
    settings: {
      gridSize: 7,
      foodCount: 1,
      computerDifficulty: "medium",
      initialSpeed: 1,
      gmMode: false,
      initialLength: 3,
      initialEnergy: 0,
      initialBombs: 0,
      initialStock: {}
    },
    snapshots: [
      createReplaySnapshot(0, 0),
      createReplaySnapshot(Math.round(durationMs / 2), 1),
      createReplaySnapshot(durationMs, 2)
    ]
  };
}

function requestOk(url) {
  return new Promise(resolve => {
    const request = http.get(url, response => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(findOpenPort(startPort + 1)));
    server.listen(startPort, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < startupTimeoutMs) {
    if (await requestOk(url)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startServer() {
  if (externalUrl) {
    await waitForServer(externalUrl);
    return { url: externalUrl, stop: () => {} };
  }

  const port = await findOpenPort(defaultPort);
  const url = `http://127.0.0.1:${port}/`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  server.stderr.on("data", chunk => {
    stderr += chunk.toString();
  });
  server.on("exit", code => {
    if (code && !stderr) stderr = `server exited with code ${code}`;
  });

  await waitForServer(url).catch(error => {
    server.kill();
    throw new Error(`${error.message}${stderr ? `\n${stderr}` : ""}`);
  });

  return {
    url,
    stop: () => {
      if (!server.killed) server.kill();
    }
  };
}

async function expectVisible(page, selector, label) {
  await page.locator(selector).waitFor({ state: "visible", timeout: actionTimeoutMs });
  console.log(`ok - ${label}`);
}

async function expectHidden(page, selector, label) {
  await page.locator(selector).waitFor({ state: "hidden", timeout: actionTimeoutMs });
  console.log(`ok - ${label}`);
}

async function expectText(page, selector, expected, label) {
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelector(selector)?.textContent?.trim() === expected,
    { selector, expected },
    { timeout: actionTimeoutMs }
  );
  console.log(`ok - ${label}`);
}

async function expectControlValue(page, selector, expected, label) {
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelector(selector)?.value === expected,
    { selector, expected },
    { timeout: actionTimeoutMs }
  );
  console.log(`ok - ${label}`);
}

async function expectControlAttribute(page, selector, attribute, expected, label) {
  await page.waitForFunction(
    ({ selector, attribute, expected }) => document.querySelector(selector)?.getAttribute(attribute) === expected,
    { selector, attribute, expected },
    { timeout: actionTimeoutMs }
  );
  console.log(`ok - ${label}`);
}

async function clickModalBackdrop(page, selector) {
  await page.locator(selector).click({ position: { x: 6, y: 6 }, timeout: actionTimeoutMs });
}

async function setRangeValue(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function playAreaPoint(page, xRatio = 0.5, yRatio = 0.5) {
  const box = await page.locator("#playArea").boundingBox();
  if (!box) throw new Error("playArea bounding box unavailable");
  return {
    x: box.x + box.width * xRatio,
    y: box.y + box.height * yRatio
  };
}

async function dragOnPlayArea(page, { xRatio = 0.5, yRatio = 0.5, dx = 0, dy = 0, holdMs = 0 }) {
  const start = await playAreaPoint(page, xRatio, yRatio);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (holdMs) await page.waitForTimeout(holdMs);
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await page.mouse.up();
}

async function doubleClickPlayArea(page) {
  const point = await playAreaPoint(page);
  await page.mouse.dblclick(point.x, point.y);
}

async function exerciseRulesModal(page) {
  await page.locator("#rulesButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#rulesModal", "rules modal opens");
  await expectControlAttribute(page, "#rulesButton", "aria-expanded", "true", "rules toggle marks expanded");
  await page.keyboard.press("Escape");
  await expectHidden(page, "#rulesModal", "rules modal closes with Escape");
  await expectControlAttribute(page, "#rulesButton", "aria-expanded", "false", "rules toggle clears expanded");

  await page.locator("#rulesButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#rulesModal", "rules modal reopens");
  await clickModalBackdrop(page, "#rulesModal");
  await expectHidden(page, "#rulesModal", "rules modal closes from backdrop");
}

async function exerciseSettingsModal(page) {
  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel opens");
  await expectControlAttribute(page, "#settingsToggle", "aria-expanded", "true", "settings toggle marks expanded");
  await page.keyboard.press("Escape");
  await expectHidden(page, "#settingsContent", "settings panel closes with Escape");
  await expectControlAttribute(page, "#settingsToggle", "aria-expanded", "false", "settings toggle clears expanded");

  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel reopens");
  await clickModalBackdrop(page, "#settingsContent");
  await expectHidden(page, "#settingsContent", "settings panel closes from backdrop");
}

async function openFirstPortraitLightbox(page) {
  const portraitEntrypoints = page.locator("[data-full-portrait]");
  if (!(await portraitEntrypoints.count())) return false;
  await portraitEntrypoints.first().click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#portraitLightbox", "portrait lightbox opens");
  const lightboxSrc = await page.locator("#portraitLightboxImage").evaluate(image => image.currentSrc || image.src);
  if (!/\/(md|sm)\//.test(lightboxSrc.replaceAll("\\", "/"))) {
    throw new Error(`Portrait lightbox should use deployed md/sm assets, saw: ${lightboxSrc}`);
  }
  return true;
}

async function exercisePortraitLightbox(page) {
  if (!(await openFirstPortraitLightbox(page))) return;
  await page.keyboard.press("Escape");
  await expectHidden(page, "#portraitLightbox", "portrait lightbox closes with Escape");

  await openFirstPortraitLightbox(page);
  await clickModalBackdrop(page, "#portraitLightbox");
  await expectHidden(page, "#portraitLightbox", "portrait lightbox closes from backdrop");
}

async function exerciseReplayRegression(page) {
  await page.locator("#settingsReplayButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replayModal", "replay modal opens");
  await expectText(page, "#recentReplayCount", "2 / 5", "replay fixtures are listed");
  await expectText(page, "#favoriteReplayCount", "0 / 5", "replay favorites start empty");
  await expectVisible(page, `[data-replay-play="${replayFixtureId}"]`, "replay play action is available");

  await page.keyboard.press("Escape");
  await expectHidden(page, "#replayModal", "replay modal closes with Escape");

  await page.locator("#settingsReplayButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replayModal", "replay modal reopens");
  await clickModalBackdrop(page, "#replayModal");
  await expectHidden(page, "#replayModal", "replay modal closes from backdrop");

  await page.locator("#settingsReplayButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replayModal", "replay modal reopens for actions");
  await page.locator(`[data-replay-favorite="${replayFixtureId}"]`).first().click({ timeout: actionTimeoutMs });
  await expectText(page, "#favoriteReplayCount", "1 / 5", "replay favorite toggle refreshes list");
  await page.locator(`[data-replay-favorite="${replayFixtureId}"]`).first().click({ timeout: actionTimeoutMs });
  await expectText(page, "#favoriteReplayCount", "0 / 5", "replay favorite can be canceled");

  await page.locator(`[data-replay-play="${replayFixtureId}"]`).first().click({ timeout: actionTimeoutMs });
  await expectHidden(page, "#replayModal", "replay modal closes for playback");
  await expectVisible(page, "#replayControls", "replay controls show");
  await expectText(page, "#replaySpeedSelect", "x1", "replay speed defaults to x1");
  await expectControlAttribute(page, "#replaySpeedSelect", "aria-valuenow", "1", "replay speed slider defaults to x1");
  await expectControlAttribute(page, "#replayTimeline", "max", "5000", "replay timeline duration is loaded");

  const playTextBeforePause = await page.locator("#replayPlayButton").textContent();
  await page.locator("#replayPlayButton").click({ timeout: actionTimeoutMs });
  await page.waitForFunction(
    before => document.querySelector("#replayPlayButton")?.textContent !== before,
    playTextBeforePause,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - replay pause toggles playback button");

  await page.locator("#replayReverseButton").click({ timeout: actionTimeoutMs });
  await page.waitForFunction(
    () => document.querySelector("#replayReverseButton")?.classList.contains("is-selected"),
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - replay reverse toggles direction");

  await page.locator("#replaySpeedSelect").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replaySpeedMenu", "replay speed menu opens");
  await page.locator('#replaySpeedMenu [data-replay-speed="2"]').click({ timeout: actionTimeoutMs });
  await expectText(page, "#replaySpeedSelect", "x2", "replay speed can change");
  await expectControlAttribute(page, "#replaySpeedSelect", "aria-valuenow", "2", "replay speed slider updates");

  await setRangeValue(page, "#replayTimeline", "2500");
  await expectControlValue(page, "#replayTimeline", "2500", "replay seek updates timeline");

  await page.locator("#replayNextButton").click({ timeout: actionTimeoutMs });
  await expectControlAttribute(page, "#replayTimeline", "max", "7000", "replay next switches to the next record");
  await expectText(page, "#replaySpeedSelect", "x2", "replay next keeps remembered speed");
  await expectText(page, "#replayPlayButton", "⏸", "replay next starts playback immediately");

  await page.locator("#replayPrevButton").click({ timeout: actionTimeoutMs });
  await expectControlAttribute(page, "#replayTimeline", "max", "5000", "replay previous switches back");
  await expectText(page, "#replaySpeedSelect", "x2", "replay previous keeps remembered speed");
  await expectText(page, "#replayPlayButton", "⏸", "replay previous starts playback immediately");

  await doubleClickPlayArea(page);
  await expectText(page, "#replayPlayButton", "▶", "replay board double click pauses");
  await doubleClickPlayArea(page);
  await expectText(page, "#replayPlayButton", "⏸", "replay board double click resumes");

  await dragOnPlayArea(page, { dx: -140 });
  await expectControlAttribute(page, "#replayTimeline", "max", "7000", "replay board swipe left switches next");
  await expectText(page, "#replayPlayButton", "⏸", "replay board swipe left starts playback immediately");

  await dragOnPlayArea(page, { dx: 140 });
  await expectControlAttribute(page, "#replayTimeline", "max", "5000", "replay board swipe right switches previous");
  await expectText(page, "#replayPlayButton", "⏸", "replay board swipe right starts playback immediately");

  await dragOnPlayArea(page, { dx: 120, holdMs: 420 });
  await page.waitForFunction(
    () => Number(document.querySelector("#replayTimeline")?.value || 0) > 500,
    null,
    { timeout: actionTimeoutMs }
  );
  await expectText(page, "#replayPlayButton", "▶", "replay board long-press horizontal drag scrubs and pauses");

  await dragOnPlayArea(page, { dy: -60, holdMs: 420 });
  await expectText(page, "#replaySpeedSelect", "x4", "replay board long-press vertical drag changes speed");
  await expectControlAttribute(page, "#replaySpeedSelect", "aria-valuenow", "4", "replay board speed gesture updates slider");

  await page.locator("#replayExitButton").click({ timeout: actionTimeoutMs });
  await expectHidden(page, "#replayControls", "replay controls hide after exit");

  await page.locator("#settingsReplayButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replayModal", "replay modal opens after playback exit");
  await page.locator(`[data-replay-play="${replayFixtureId}"]`).first().click({ timeout: actionTimeoutMs });
  await expectText(page, "#replaySpeedSelect", "x4", "replay speed persists across playback sessions");
  await expectText(page, "#replayPlayButton", "⏸", "replay restarts playback immediately");
  await page.locator("#replayExitButton").click({ timeout: actionTimeoutMs });
  await expectHidden(page, "#replayControls", "replay controls hide after persisted-speed check");

  await page.locator("#settingsReplayButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replayModal", "replay modal opens for deletion");
  await page.locator(`[data-replay-delete="${replayFixtureId}"]`).first().click({ timeout: actionTimeoutMs });
  await page.locator(`[data-replay-delete="${replayFixtureNextId}"]`).first().click({ timeout: actionTimeoutMs });
  await expectText(page, "#recentReplayCount", "0 / 5", "replay record can be deleted");
  await expectVisible(page, "#recentReplayList .replay-empty", "replay recent empty state is visible");
  await expectVisible(page, "#favoriteReplayList .replay-empty", "replay favorite empty state is visible");
  await page.locator("#replayModalClose").click({ timeout: actionTimeoutMs });
  await expectHidden(page, "#replayModal", "replay modal closes after deletion");
}

async function exerciseAutoBattleControls(page) {
  await page.locator("#computerBattleButton").click({ timeout: actionTimeoutMs });
  await page.waitForFunction(() => !document.querySelector("#overlay")?.classList.contains("show"), null, {
    timeout: actionTimeoutMs
  });
  await expectVisible(page, "#autoBattlePanel", "auto battle controls show");
  await expectVisible(page, "#relayPanel", "auto battle relay panel stays available");
  await expectText(page, "#autoBattleSpeedSelect", "x1", "auto battle speed defaults to x1");
  await expectControlAttribute(page, "#autoBattleSpeedSelect", "aria-valuenow", "1", "auto battle speed slider defaults to x1");

  await page.locator("#autoBattleSpeedSelect").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#autoSpeedMenu", "auto battle speed menu opens");
  await page.locator('#autoSpeedMenu [data-auto-speed="2"]').click({ timeout: actionTimeoutMs });
  await expectText(page, "#autoBattleSpeedSelect", "x2", "auto battle speed can change");
  await expectControlAttribute(page, "#autoBattleSpeedSelect", "aria-valuenow", "2", "auto battle speed slider updates");

  const pauseTextBefore = await page.locator("[data-auto-pause]").textContent();
  await page.locator("[data-auto-pause]").click({ timeout: actionTimeoutMs });
  await page.waitForFunction(
    before => document.querySelector("[data-auto-pause]")?.textContent !== before,
    pauseTextBefore,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - auto battle pause toggles");
}

async function runViewportSmoke(browser, url, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    isMobile: Boolean(profile.isMobile),
    hasTouch: Boolean(profile.hasTouch)
  });

  await context.addInitScript(replayFixture => {
    localStorage.setItem("hexSnakeSfxMuted", "1");
    localStorage.setItem("hexSnakeTutorialSeen", "1");
    localStorage.removeItem("hexSnakeReplaySpeed");
    localStorage.setItem("hexSnakeReplayRecent", JSON.stringify(replayFixture));
    localStorage.setItem("hexSnakeReplayFavorites", "[]");
  }, [
    createReplayFixture(),
    createReplayFixture({
      id: replayFixtureNextId,
      createdAt: "2026-05-09T00:01:00.000Z",
      computerCharacterId: "moray",
      durationMs: 7000,
      title: "Smoke replay fixture next"
    })
  ]);

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => pageErrors.push(error.stack || error.message));

  console.log(`\n# ${profile.name} ${profile.viewport.width}x${profile.viewport.height}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: startupTimeoutMs });
  if (!(await page.title()).includes("六角貪食蛇對戰")) {
    throw new Error(`Unexpected page title: ${await page.title()}`);
  }
  await expectVisible(page, "#game", "board canvas rendered");
  await expectVisible(page, "#startButton", "start button visible");

  const introEntrypoints = page.locator("[data-open-intro]");
  if (await introEntrypoints.count()) {
    await introEntrypoints.first().click({ timeout: actionTimeoutMs });
  }
  await exercisePortraitLightbox(page);
  if (await page.locator("#introCloseButton:visible").count()) {
    await page.locator("#introCloseButton").click({ timeout: actionTimeoutMs });
  }

  await exerciseRulesModal(page);
  await exerciseSettingsModal(page);

  await exerciseReplayRegression(page);

  await exerciseAutoBattleControls(page);

  if (consoleErrors.length || pageErrors.length) {
    throw new Error([
      `${profile.name} smoke saw browser errors:`,
      ...pageErrors.map(error => `pageerror: ${error}`),
      ...consoleErrors.map(error => `console.error: ${error}`)
    ].join("\n"));
  }

  await context.close();
}

async function main() {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu"],
    env: {
      ...process.env,
      CHROME_LOG_FILE: path.join(os.tmpdir(), "hex-snake-chrome-debug.log")
    }
  });

  try {
    const profiles = [
      { name: "desktop", viewport: { width: 1280, height: 900 } },
      { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    ];
    for (const profile of profiles) {
      await runViewportSmoke(browser, server.url, profile);
    }
    console.log("\nSmoke test passed.");
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
