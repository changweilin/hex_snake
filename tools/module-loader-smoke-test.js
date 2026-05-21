#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const defaultPort = Number(process.env.HEX_SNAKE_MODULE_PORT || process.env.PORT || 6437);
const startupTimeoutMs = Number(process.env.HEX_SNAKE_MODULE_STARTUP_MS || 15000);
const actionTimeoutMs = Number(process.env.HEX_SNAKE_MODULE_ACTION_MS || 15000);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright is required for module loader smoke tests. Run `npm install` first.");
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

async function startServer({ dist = false, portOffset = 0 } = {}) {
  const port = await findOpenPort(defaultPort + portOffset);
  const url = `http://127.0.0.1:${port}/`;
  const args = dist ? ["server.js", "--dist"] : ["server.js"];
  const server = spawn(process.execPath, args, {
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

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function newCheckedPage(context, label, errors) {
  const page = await context.newPage();
  page.on("console", message => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", error => {
    errors.push(`${label}: ${error.stack || error.message}`);
  });
  page.on("requestfailed", request => {
    const errorText = request.failure()?.errorText || "";
    if (errorText.includes("ERR_ABORTED")) return;
    errors.push(`${label}: request failed ${request.url()} ${errorText}`.trim());
  });
  return page;
}

async function closeCheckedPage(page) {
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.removeAllListeners("requestfailed");
  await page.close();
}

async function evaluateAfterNavigationSettles(page, callback) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(callback);
    } catch (error) {
      lastError = error;
      if (!/Execution context was destroyed|Cannot find context/i.test(error.message || "")) throw error;
      await page.waitForLoadState("load", { timeout: actionTimeoutMs }).catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  throw lastError;
}

async function checkSourceModuleShadow(context, url, errors) {
  const page = await newCheckedPage(context, "module-shadow", errors);
  await page.goto(`${url}?hexSnakeLoader=module-shadow`, { waitUntil: "load", timeout: actionTimeoutMs });
  await page.waitForFunction(() => window.__HEX_SNAKE_MODULE_SHADOW__, null, { timeout: actionTimeoutMs });
  const result = await page.evaluate(() => {
    const contract = window.__HEX_SNAKE_MODULE_SHADOW__;
    return {
      hasShadow: Boolean(contract),
      hasModuleGame: Boolean(window.__HEX_SNAKE_MODULE_GAME__),
      bootstrapsGameplay: contract?.bootstrapsGameplay,
      imports: Array.from(contract?.imports || []),
      gameReady: Boolean(contract?.gameReady),
      running: Boolean(window.HexSnakeState?.game?.running),
      overlayShows: Boolean(document.querySelector("#overlay")?.classList.contains("show")),
      characterOptions: document.querySelectorAll("#playerCharacter option").length
    };
  });
  await closeCheckedPage(page);

  assertOk(result.hasShadow, `module-shadow contract missing: ${JSON.stringify(result)}`);
  assertOk(!result.hasModuleGame, `module-shadow created module game contract: ${JSON.stringify(result)}`);
  assertOk(result.bootstrapsGameplay === false, `module-shadow bootstrapped gameplay: ${JSON.stringify(result)}`);
  assertOk(result.imports.includes("gameShell"), `module-shadow did not import gameShell: ${JSON.stringify(result)}`);
  assertOk(result.gameReady, `module-shadow gameReady was false: ${JSON.stringify(result)}`);
  assertOk(!result.running && !result.overlayShows && result.characterOptions === 0, `module-shadow started UI/gameplay: ${JSON.stringify(result)}`);
  console.log("ok - module-shadow imports game shell without gameplay bootstrap");
}

async function checkSourceModuleGame(context, url, errors) {
  const page = await newCheckedPage(context, "module", errors);
  await page.goto(`${url}?hexSnakeLoader=module`, { waitUntil: "load", timeout: actionTimeoutMs });
  await page.waitForFunction(() => window.__HEX_SNAKE_MODULE_GAME__, null, { timeout: actionTimeoutMs });
  await page.waitForFunction(() => document.querySelectorAll("#playerCharacter option").length > 0, null, { timeout: actionTimeoutMs });
  const result = await page.evaluate(() => {
    const contract = window.__HEX_SNAKE_MODULE_GAME__;
    return {
      mode: contract?.mode,
      bootstrapsGameplay: contract?.bootstrapsGameplay,
      gameContractBootstraps: contract?.gameContract?.bootstrapsGameplay,
      hasShadow: Boolean(window.__HEX_SNAKE_MODULE_SHADOW__),
      overlayShows: Boolean(document.querySelector("#overlay")?.classList.contains("show")),
      characterOptions: document.querySelectorAll("#playerCharacter option").length
    };
  });
  await closeCheckedPage(page);

  assertOk(result.mode === "module", `module contract has wrong mode: ${JSON.stringify(result)}`);
  assertOk(result.bootstrapsGameplay === true && result.gameContractBootstraps === true, `module contract did not bootstrap gameplay: ${JSON.stringify(result)}`);
  assertOk(!result.hasShadow, `module mode created shadow contract: ${JSON.stringify(result)}`);
  assertOk(result.overlayShows && result.characterOptions > 0, `module mode did not show initial UI: ${JSON.stringify(result)}`);
  console.log("ok - module loader bootstraps gameplay and shows initial UI");
}

async function checkDistFallback(context, url, mode, errors) {
  const page = await newCheckedPage(context, `dist ${mode}`, errors);
  await page.goto(`${url}?hexSnakeLoader=${mode}`, { waitUntil: "load", timeout: actionTimeoutMs });
  await page.waitForFunction(() => window.__HEX_SNAKE_BUNDLED_LEGACY__ && window.HexSnakeState && window.HexSnakeUI, null, { timeout: actionTimeoutMs });
  await page.waitForFunction(() => document.querySelectorAll("#playerCharacter option").length > 0, null, { timeout: actionTimeoutMs });
  const result = await evaluateAfterNavigationSettles(page, () => ({
    bundled: Boolean(window.__HEX_SNAKE_BUNDLED_LEGACY__),
    hasModuleGame: Boolean(window.__HEX_SNAKE_MODULE_GAME__),
    hasModuleShadow: Boolean(window.__HEX_SNAKE_MODULE_SHADOW__),
    overlayShows: Boolean(document.querySelector("#overlay")?.classList.contains("show")),
    characterOptions: document.querySelectorAll("#playerCharacter option").length
  }));
  await closeCheckedPage(page);

  assertOk(result.bundled, `dist ${mode} did not use bundled legacy loader: ${JSON.stringify(result)}`);
  assertOk(!result.hasModuleGame && !result.hasModuleShadow, `dist ${mode} created module contracts: ${JSON.stringify(result)}`);
  assertOk(result.overlayShows && result.characterOptions > 0, `dist ${mode} did not boot legacy UI: ${JSON.stringify(result)}`);
  console.log(`ok - dist ${mode} falls back to bundled legacy loader`);
}

async function main() {
  if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
    throw new Error("dist/index.html is missing. Run `npm.cmd run build` before `npm.cmd run test:module-loader`.");
  }

  const { chromium } = loadPlaywright();
  const sourceServer = await startServer({ portOffset: 0 });
  const distServer = await startServer({ dist: true, portOffset: 20 });
  const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  await context.addInitScript(() => {
    localStorage.setItem("hexSnakeSfxMuted", "1");
    localStorage.setItem("hexSnakeTutorialSeen", "1");
  });
  const errors = [];

  try {
    await checkSourceModuleShadow(context, sourceServer.url, errors);
    await checkSourceModuleGame(context, sourceServer.url, errors);
    await checkDistFallback(context, distServer.url, "module-shadow", errors);
    await checkDistFallback(context, distServer.url, "module", errors);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Module loader smoke test passed.");
  } finally {
    await browser.close().catch(() => {});
    sourceServer.stop();
    distServer.stop();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
