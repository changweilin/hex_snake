#!/usr/bin/env node

const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const defaultPort = Number(process.env.HEX_SNAKE_SMOKE_PORT || process.env.PORT || 6297);
const externalUrl = process.env.HEX_SNAKE_URL || "";
const startupTimeoutMs = Number(process.env.HEX_SNAKE_SMOKE_STARTUP_MS || 15000);
const actionTimeoutMs = Number(process.env.HEX_SNAKE_SMOKE_ACTION_MS || 10000);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error(
      "Playwright is required for browser smoke tests. Run `npm install` first, then retry `npm.cmd run test:smoke`."
    );
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

async function runViewportSmoke(browser, url, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    isMobile: Boolean(profile.isMobile),
    hasTouch: Boolean(profile.hasTouch)
  });

  await context.addInitScript(() => {
    localStorage.setItem("hexSnakeSfxMuted", "1");
    localStorage.setItem("hexSnakeTutorialSeen", "1");
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

  await page.locator("#settingsToggle").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#settingsContent", "settings panel opens");
  await page.locator("#settingsCloseButton").click({ timeout: actionTimeoutMs });
  await expectHidden(page, "#settingsContent", "settings panel closes");

  await page.locator("#settingsReplayButton").click({ timeout: actionTimeoutMs });
  await expectVisible(page, "#replayModal", "replay modal opens");
  await page.locator("#replayModalClose").click({ timeout: actionTimeoutMs });
  await expectHidden(page, "#replayModal", "replay modal closes");

  await page.locator("#startButton").click({ timeout: actionTimeoutMs });
  await page.waitForFunction(() => !document.querySelector("#overlay")?.classList.contains("show"), null, {
    timeout: actionTimeoutMs
  });
  await expectVisible(page, "#surrenderButton", "game starts and battle controls unlock");

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
  const browser = await chromium.launch({ headless: true });

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
