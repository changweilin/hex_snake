#!/usr/bin/env node

const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const defaultPort = Number(process.env.HEX_SNAKE_MOBILE_PORT || process.env.PORT || 6311);
const externalUrl = process.env.HEX_SNAKE_URL || "";
const startupTimeoutMs = Number(process.env.HEX_SNAKE_MOBILE_STARTUP_MS || 15000);
const actionTimeoutMs = Number(process.env.HEX_SNAKE_MOBILE_ACTION_MS || 10000);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright is required for mobile smoke tests. Run `npm install` first.");
  }
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
  return new Promise(resolve => {
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

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function elementBox(page, selector) {
  const box = await page.locator(selector).boundingBox({ timeout: actionTimeoutMs });
  if (!box) throw new Error(`${selector} bounding box unavailable`);
  return box;
}

function assertWithinViewport(box, viewport, label) {
  const tolerance = 1;
  assertOk(box.x >= -tolerance, `${label} overflows left edge: ${JSON.stringify(box)}`);
  assertOk(box.y >= -tolerance, `${label} overflows top edge: ${JSON.stringify(box)}`);
  assertOk(box.x + box.width <= viewport.width + tolerance, `${label} overflows right edge: ${JSON.stringify(box)}`);
  assertOk(box.y + box.height <= viewport.height + tolerance, `${label} overflows bottom edge: ${JSON.stringify(box)}`);
}

function assertTapTarget(box, label, minSize = 34) {
  assertOk(box.width >= minSize, `${label} touch width is too small: ${box.width}`);
  assertOk(box.height >= minSize, `${label} touch height is too small: ${box.height}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    docScrollWidth: document.documentElement.scrollWidth
  }));
  const overflow = Math.max(metrics.bodyScrollWidth, metrics.docScrollWidth) - metrics.innerWidth;
  assertOk(overflow <= 2, `${label} has horizontal overflow: ${JSON.stringify(metrics)}`);
}

async function assertCriticalControls(page, profile) {
  const containers = [
    ["#playArea", "play area"],
    ["#controlRow", "control row"]
  ];
  const tapTargets = [
    ["#joyZone", "joystick zone", 72],
    ["#smallAttackButton", "small attack button", 44],
    ["#bigAttackButton", "big attack button", 44],
    ["#settingsToggle", "settings button", 34],
    ["#rulesButton", "rules button", 34],
    ["#settingsReplayButton", "replay button", 34],
    ["#gmToggle", "GM button", 34]
  ];

  for (const [selector, label] of containers) {
    const box = await elementBox(page, selector);
    assertWithinViewport(box, profile.viewport, label);
  }

  for (const [selector, label, minSize] of tapTargets) {
    const box = await elementBox(page, selector);
    assertWithinViewport(box, profile.viewport, label);
    assertTapTarget(box, label, minSize);
  }
}

async function exerciseSettingsControls(page) {
  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await page.locator("#settingsContent").waitFor({ state: "visible", timeout: actionTimeoutMs });
  await page.locator("#leftHandMode").check({ timeout: actionTimeoutMs });
  await page.waitForFunction(() => document.querySelector("#controlRow")?.classList.contains("left-handed"), null, {
    timeout: actionTimeoutMs
  });
  await page.locator("#leftHandMode").uncheck({ timeout: actionTimeoutMs });
  await page.waitForFunction(() => !document.querySelector("#controlRow")?.classList.contains("left-handed"), null, {
    timeout: actionTimeoutMs
  });
  await page.locator("#lowPowerMode").check({ timeout: actionTimeoutMs });
  await page.waitForFunction(() => document.body.classList.contains("is-low-power"), null, {
    timeout: actionTimeoutMs
  });
  await page.locator("#perfStatsToggle").check({ timeout: actionTimeoutMs });
  await page.waitForFunction(() => document.querySelector("#perfOverlay")?.hidden === false, null, {
    timeout: actionTimeoutMs
  });
  console.log("ok - settings toggles update mobile control and performance state");
}

async function exercisePointerCancel(page) {
  const box = await elementBox(page, "#joyZone");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(130);
  await page.mouse.move(x + 34, y, { steps: 4 });
  await page.locator("#joyZone").dispatchEvent("pointercancel", {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x + 34,
    clientY: y
  });
  await page.mouse.up().catch(() => {});
  await page.waitForTimeout(240);
  const state = await page.evaluate(() => ({
    locked: document.querySelector("#joyZone .joystick")?.classList.contains("locked"),
    rebounding: document.querySelector("#stick")?.classList.contains("is-rebounding"),
    transform: getComputedStyle(document.querySelector("#stick")).transform
  }));
  assertOk(state.locked === false, `joystick stayed locked after pointercancel: ${JSON.stringify(state)}`);
  assertOk(state.rebounding === false, `joystick stayed rebounding after pointercancel: ${JSON.stringify(state)}`);
  console.log("ok - joystick pointercancel clears locked state");
}

async function runMobileProfile(browser, url, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  await context.addInitScript(() => {
    localStorage.setItem("hexSnakeSfxMuted", "1");
    localStorage.setItem("hexSnakeTutorialSeen", "1");
    localStorage.removeItem("hexSnakeLowPowerMode");
    localStorage.removeItem("hexSnakePerfStats");
    localStorage.removeItem("hexSnakeLeftHandMode");
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
  assertOk((await page.title()).includes("六角貪食蛇對戰"), `Unexpected title: ${await page.title()}`);
  await page.locator("#game").waitFor({ state: "visible", timeout: actionTimeoutMs });
  await page.locator("#startButton").waitFor({ state: "visible", timeout: actionTimeoutMs });
  await assertNoHorizontalOverflow(page, profile.name);
  await assertCriticalControls(page, profile);
  console.log("ok - critical mobile controls fit viewport");
  await exerciseSettingsControls(page);
  await exercisePointerCancel(page);
  const screenshot = await page.screenshot({ fullPage: false });
  assertOk(screenshot.length > 10000, `${profile.name} screenshot looks unexpectedly small`);
  console.log("ok - mobile screenshot captured");

  if (consoleErrors.length || pageErrors.length) {
    throw new Error([
      `${profile.name} mobile smoke saw browser errors:`,
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
      CHROME_LOG_FILE: path.join(os.tmpdir(), "hex-snake-mobile-chrome-debug.log")
    }
  });

  try {
    await runMobileProfile(browser, server.url, {
      name: "mobile portrait",
      viewport: { width: 390, height: 844 }
    });
    await runMobileProfile(browser, server.url, {
      name: "mobile landscape",
      viewport: { width: 844, height: 390 }
    });
  } finally {
    await browser.close();
    server.stop();
  }

  console.log("\nMobile smoke test passed.");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
