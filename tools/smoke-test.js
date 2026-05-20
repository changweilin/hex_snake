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

function createStatsFixture() {
  return {
    version: 1,
    totals: {
      matches: 2,
      playerWins: 1,
      computerWins: 1,
      draws: 0,
      playerScore: 5,
      computerScore: 5,
      totalDurationMs: 108000,
      bestPlayerScore: 4
    },
    recent: [
      {
        id: "stats-smoke-1",
        createdAt: "2026-05-09T00:02:00.000Z",
        winnerOwner: "player",
        playerScore: 4,
        computerScore: 2,
        durationMs: 65000,
        playerCharacterId: "dragon",
        computerCharacterId: "sandworm",
        mode: "player",
        difficulty: "medium",
        surrendered: false
      },
      {
        id: "stats-smoke-2",
        createdAt: "2026-05-09T00:01:00.000Z",
        winnerOwner: "computer",
        playerScore: 1,
        computerScore: 3,
        durationMs: 43000,
        playerCharacterId: "dragon",
        computerCharacterId: "moray",
        mode: "autoBattle",
        difficulty: "high",
        surrendered: true
      }
    ],
    characters: {
      dragon: {
        played: 2,
        wins: 1,
        losses: 1,
        draws: 0,
        score: 5,
        bestScore: 4,
        durationMs: 108000,
        lastPlayedAt: "2026-05-09T00:02:00.000Z"
      }
    }
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

async function clearBlockingOverlay(page) {
  await page.locator("#overlay").evaluate(overlay => {
    overlay.classList.remove("show", "intro-details");
  });
}

async function openGmSettings(page, label) {
  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel opens before GM page");
  await page.locator('#settingsContent [data-settings-page-button="gm"]').click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#gmContent", label);
}

async function setRangeValue(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function setChangedValue(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function expectChecked(page, selector, expected, label) {
  await page.waitForFunction(
    ({ selector, expected }) => Boolean(document.querySelector(selector)?.checked) === expected,
    { selector, expected },
    { timeout: actionTimeoutMs }
  );
  console.log(`ok - ${label}`);
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

async function exerciseStatsModal(page) {
  await page.locator("#statsButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#statsModal", "stats modal opens");
  await expectText(page, "#statsTotalMatches", "2", "stats total matches come from storage");
  await expectText(page, "#statsWinRate", "50%", "stats win rate is calculated");
  await expectText(page, "#statsRecentCount", "2 / 10", "stats recent matches are listed");
  await expectVisible(page, '[data-stats-record-id="stats-smoke-1"]', "stats recent row is visible");
  await expectVisible(page, '[data-stats-character-id="dragon"]', "stats character mastery row is visible");
  await page.keyboard.press("Escape");
  await expectHidden(page, "#statsModal", "stats modal closes with Escape");

  await page.locator("#statsButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#statsModal", "stats modal reopens");
  await clickModalBackdrop(page, "#statsModal");
  await expectHidden(page, "#statsModal", "stats modal closes from backdrop");
}

async function exerciseVersionModal(page) {
  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel opens for version info");
  await page.locator("#versionInfoButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#versionModal", "version modal opens");
  await expectText(page, "#versionAppName", "Hex Snake", "version modal shows app name");
  await expectText(page, "#versionPlatform", "web", "version modal shows platform adapter");
  await expectVisible(page, "#versionBuildVersion", "version modal shows build id");
  await page.keyboard.press("Escape");
  await expectHidden(page, "#versionModal", "version modal closes with Escape");
  await clickModalBackdrop(page, "#settingsContent");
  await expectHidden(page, "#settingsContent", "settings panel closes after version check");
}

async function exerciseControlProfiles(page) {
  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel opens for control profiles");
  await page.locator("#computerDifficulty").selectOption("high", { timeout: actionTimeoutMs });
  await page.locator("#leftHandMode").check({ timeout: actionTimeoutMs });
  await page.locator("#lowPowerMode").check({ timeout: actionTimeoutMs });
  await page.locator("#perfStatsToggle").check({ timeout: actionTimeoutMs });
  await clickModalBackdrop(page, "#settingsContent");
  await expectHidden(page, "#settingsContent", "settings panel closes before GM profile setup");
  await clearBlockingOverlay(page);

  await openGmSettings(page, "GM panel opens for control profile setup");
  await setChangedValue(page, "#gridSize", "8");
  await setChangedValue(page, "#foodCount", "2");
  await setChangedValue(page, "#initialSpeed", "1.5");
  await setChangedValue(page, "#initialLength", "5");
  await setChangedValue(page, "#initialEnergy", "3");
  await setChangedValue(page, "#initialBombs", "2");
  await setChangedValue(page, "#initialProtein", "4");
  await clickModalBackdrop(page, "#gmContent");
  await expectHidden(page, "#gmContent", "GM panel closes before profile save");

  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel reopens for control profile save");
  await page.locator("#controlProfileName").fill("Smoke Controls", { timeout: actionTimeoutMs });
  await page.locator("#controlProfileSaveButton").click({ timeout: actionTimeoutMs });
  await expectText(page, "#controlProfileStatus", "配置檔已儲存。", "control profile saves current settings");
  await page.waitForFunction(
    () => {
      const profiles = JSON.parse(localStorage.getItem("hexSnakeControlProfilesV1") || "[]");
      const selectedId = localStorage.getItem("hexSnakeSelectedControlProfileV1");
      return profiles.some(profile =>
        profile.id === selectedId
        && profile.name === "Smoke Controls"
        && profile.config?.keybinds?.smallAttack === "q"
        && profile.config?.leftHandMode === true
        && profile.config?.gameSettings?.computerDifficulty === "high"
        && profile.config?.gameSettings?.gridSize === 8
        && profile.config?.gameSettings?.initialStock?.protein === 4
        && profile.config?.preferences?.lowPowerMode === true
        && profile.config?.preferences?.perfStatsVisible === true
      );
    },
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - control profile is written to localStorage");

  await page.locator("#smallAttackKey").click({ timeout: actionTimeoutMs });
  await page.keyboard.press("U");
  await expectControlValue(page, "#smallAttackKey", "U", "small attack key can change before profile apply");
  await page.locator("#computerDifficulty").selectOption("low", { timeout: actionTimeoutMs });
  await page.locator("#leftHandMode").uncheck({ timeout: actionTimeoutMs });
  await page.locator("#lowPowerMode").uncheck({ timeout: actionTimeoutMs });
  await page.locator("#perfStatsToggle").uncheck({ timeout: actionTimeoutMs });
  await clickModalBackdrop(page, "#settingsContent");
  await expectHidden(page, "#settingsContent", "settings panel closes before profile divergence");
  await clearBlockingOverlay(page);
  await openGmSettings(page, "GM panel opens for profile divergence");
  await setChangedValue(page, "#gridSize", "10");
  await setChangedValue(page, "#foodCount", "4");
  await setChangedValue(page, "#initialSpeed", "1");
  await setChangedValue(page, "#initialLength", "3");
  await setChangedValue(page, "#initialEnergy", "0");
  await setChangedValue(page, "#initialBombs", "0");
  await setChangedValue(page, "#initialProtein", "0");
  await clickModalBackdrop(page, "#gmContent");
  await expectHidden(page, "#gmContent", "GM panel closes after profile divergence");

  await page.reload({ waitUntil: "networkidle", timeout: startupTimeoutMs });
  await expectVisible(page, "#startButton", "app reloads after control profile save");
  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel opens after control profile reload");
  await page.waitForFunction(
    () => {
      const select = document.querySelector("#controlProfileSelect");
      const selectedId = localStorage.getItem("hexSnakeSelectedControlProfileV1");
      return Boolean(
        select
        && selectedId
        && select.value === selectedId
        && [...select.options].some(option => option.value === selectedId && option.textContent === "Smoke Controls")
      );
    },
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - control profile persists after reload");
  await expectControlValue(page, "#smallAttackKey", "U", "changed keybind persists before profile reload apply");
  await expectControlValue(page, "#computerDifficulty", "low", "changed difficulty persists before profile reload apply");
  await expectChecked(page, "#leftHandMode", false, "changed left hand mode persists before profile reload apply");

  await page.locator("#controlProfileApplyButton").click({ timeout: actionTimeoutMs });
  await expectText(page, "#controlProfileStatus", "配置檔已套用。", "control profile applies saved settings");
  await expectControlValue(page, "#smallAttackKey", "Q", "control profile restores saved keybind after reload");
  await expectControlValue(page, "#computerDifficulty", "high", "control profile restores saved difficulty");
  await expectChecked(page, "#leftHandMode", true, "control profile restores left hand mode");
  await expectChecked(page, "#lowPowerMode", true, "control profile restores low power mode");
  await expectChecked(page, "#perfStatsToggle", true, "control profile restores FPS toggle");
  await page.waitForFunction(
    () => {
      const gmSettings = JSON.parse(localStorage.getItem("hexSnakeGmSettings") || "{}");
      return document.querySelector("#gridSize")?.value === "8"
        && document.querySelector("#foodCount")?.value === "2"
        && document.querySelector("#initialSpeed")?.value === "1.5"
        && document.querySelector("#initialLength")?.value === "5"
        && document.querySelector("#initialEnergy")?.value === "3"
        && document.querySelector("#initialBombs")?.value === "2"
        && document.querySelector("#initialProtein")?.value === "4"
        && gmSettings.gridSize === 8
        && gmSettings.foodCount === 2
        && gmSettings.initialStock?.protein === 4;
    },
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - control profile restores saved GM settings");

  await page.locator("#controlProfileDeleteButton").click({ timeout: actionTimeoutMs });
  await expectText(page, "#controlProfileStatus", "配置檔已刪除。", "control profile deletes saved controls");
  await page.waitForFunction(
    () => {
      const profiles = JSON.parse(localStorage.getItem("hexSnakeControlProfilesV1") || "[]");
      return profiles.length === 0 && !localStorage.getItem("hexSnakeSelectedControlProfileV1");
    },
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - control profile is removed from localStorage");
  await page.waitForFunction(
    () => {
      const select = document.querySelector("#controlProfileSelect");
      return select?.disabled && select.options.length === 1 && select.options[0].textContent === "尚無配置";
    },
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - control profile list returns to empty");
  await page.locator("#resetSettingsButton").click({ timeout: actionTimeoutMs });
  await clickModalBackdrop(page, "#settingsContent");
  await expectHidden(page, "#settingsContent", "settings panel closes after control profile check");
  await page.reload({ waitUntil: "networkidle", timeout: startupTimeoutMs });
  await expectVisible(page, "#startButton", "app reloads after control profile cleanup");
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

async function exerciseResultShare(page) {
  await expectVisible(page, "#surrenderButton", "surrender button remains available before share");
  await page.locator("#surrenderButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#overlayText", "result text appears after match end");
  const shareButtonCount = await page.locator("#shareResultButton").count();
  if (shareButtonCount) throw new Error("result share button should be removed");
  await page.waitForFunction(
    () => document.querySelector("#overlayText")?.classList.contains("is-copyable-result"),
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - result text is copyable");
  await page.locator("#overlayText").click({ timeout: actionTimeoutMs });
  await expectText(page, "#shareResultStatus", "結果已複製。", "result text copies to clipboard");
  await page.waitForFunction(
    () => window.__hexSnakeSmokeShareText?.includes("Hex Snake 對戰結果")
      && window.__hexSnakeSmokeShareText?.includes("比分：P1")
      && window.__hexSnakeSmokeShareText?.includes("模式：自動對弈"),
    null,
    { timeout: actionTimeoutMs }
  );
  console.log("ok - result share text is copied");
}

async function runViewportSmoke(browser, url, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    isMobile: Boolean(profile.isMobile),
    hasTouch: Boolean(profile.hasTouch)
  });

  await context.addInitScript(fixtures => {
    try {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
      const originalExecCommand = document.execCommand?.bind(document);
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: command => String(command).toLowerCase() === "copy" ? false : Boolean(originalExecCommand?.(command))
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async text => {
            window.__hexSnakeSmokeShareText = String(text);
          }
        }
      });
    } catch {
      window.__hexSnakeSmokeShareText = "";
    }
    if (!localStorage.getItem("__hexSnakeSmokeSeeded")) {
      localStorage.setItem("__hexSnakeSmokeSeeded", "1");
      localStorage.setItem("hexSnakeSfxMuted", "1");
      localStorage.setItem("hexSnakeTutorialSeen", "1");
      localStorage.removeItem("hexSnakeReplaySpeed");
      localStorage.removeItem("hexSnakeControlProfilesV1");
      localStorage.removeItem("hexSnakeSelectedControlProfileV1");
      localStorage.setItem("hexSnakeReplayRecent", JSON.stringify(fixtures.replays));
      localStorage.setItem("hexSnakeReplayFavorites", "[]");
      localStorage.setItem("hexSnakeMatchStatsV1", JSON.stringify(fixtures.stats));
    }
  }, {
    stats: createStatsFixture(),
    replays: [
      createReplayFixture(),
      createReplayFixture({
        id: replayFixtureNextId,
        createdAt: "2026-05-09T00:01:00.000Z",
        computerCharacterId: "moray",
        durationMs: 7000,
        title: "Smoke replay fixture next"
      })
    ]
  });

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
  await exerciseControlProfiles(page);
  await exerciseVersionModal(page);
  await exerciseStatsModal(page);

  await exerciseReplayRegression(page);

  await exerciseAutoBattleControls(page);
  await exerciseResultShare(page);

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
