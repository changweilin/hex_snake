#!/usr/bin/env node

const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const startupTimeoutMs = Number(process.env.HEX_SNAKE_OFFLINE_STARTUP_MS || 20000);
const actionTimeoutMs = Number(process.env.HEX_SNAKE_OFFLINE_ACTION_MS || 60000);
const defaultPort = Number(process.env.HEX_SNAKE_OFFLINE_PORT || 6397);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright is required for offline smoke tests. Run npm install first.");
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

async function startDistServer() {
  const port = await findOpenPort(defaultPort);
  const url = `http://127.0.0.1:${port}/`;
  const server = spawn(process.execPath, ["server.js", "--dist"], {
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
    stop() {
      if (!server.killed) server.kill();
    }
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const server = await startDistServer();
  const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("hexSnakeSfxMuted", "1");
      localStorage.setItem("hexSnakeTutorialSeen", "1");
    });
    await page.goto(server.url, { waitUntil: "networkidle", timeout: actionTimeoutMs });
    await page.locator("#game").waitFor({ state: "visible", timeout: actionTimeoutMs });
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await context.setOffline(true);
    await page.reload({ waitUntil: "networkidle", timeout: actionTimeoutMs });
    await page.locator("#game").waitFor({ state: "visible", timeout: actionTimeoutMs });
    console.log("Offline smoke test passed.");
  } finally {
    await context.setOffline(false).catch(() => {});
    await browser.close().catch(() => {});
    server.stop();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
