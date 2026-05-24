#!/usr/bin/env node

const path = require("path");

const root = path.resolve(__dirname, "..");
const actionTimeoutMs = Number(process.env.HEX_SNAKE_MOBILE_PLATFORM_ACTION_MS || 10000);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error("Playwright is required for mobile platform adapter tests. Run `npm install` first.");
  }
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] });
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", error => pageErrors.push(error.stack || error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.setContent("<!doctype html><html><head></head><body></body></html>", {
      waitUntil: "domcontentloaded",
      timeout: actionTimeoutMs
    });

    await page.evaluate(() => {
      window.__hexSnakePlatformHarness = {
        listeners: {},
        haptics: [],
        preferences: { set: [], remove: [] },
        exitCalls: 0,
        confirms: [],
        historyBackCalls: 0
      };

      window.confirm = message => {
        window.__hexSnakePlatformHarness.confirms.push(message);
        return true;
      };

      window.Capacitor = {
        getPlatform: () => "android",
        isNativePlatform: () => true,
        Plugins: {
          App: {
            addListener(eventName, callback) {
              window.__hexSnakePlatformHarness.listeners[eventName] = callback;
              return Promise.resolve({ remove: async () => {} });
            },
            exitApp() {
              window.__hexSnakePlatformHarness.exitCalls += 1;
              return Promise.resolve();
            }
          },
          Haptics: {
            impact(options) {
              window.__hexSnakePlatformHarness.haptics.push(options);
              return Promise.resolve();
            }
          },
          Preferences: {
            set(options) {
              window.__hexSnakePlatformHarness.preferences.set.push(options);
              return Promise.resolve();
            },
            remove(options) {
              window.__hexSnakePlatformHarness.preferences.remove.push(options);
              return Promise.resolve();
            }
          }
        }
      };
    });
    await page.addScriptTag({ path: path.join(root, "src", "platform", "mobile.js"), type: "module" });
    await page.waitForFunction(() => window.HexSnakePlatform?.kind === "mobile", null, { timeout: actionTimeoutMs });

    const initialState = await page.evaluate(() => ({
      kind: window.HexSnakePlatform.kind,
      platform: window.HexSnakePlatform.appInfo.platform,
      native: window.HexSnakePlatform.appInfo.native,
      buildTarget: window.HexSnakePlatform.appInfo.buildTarget,
      storageKind: window.HexSnakePlatform.appInfo.storageKind,
      shellClass: document.documentElement.classList.contains("is-mobile-app-shell"),
      datasetPlatform: document.documentElement.dataset.hexSnakePlatform,
      listeners: Object.keys(window.__hexSnakePlatformHarness.listeners).sort()
    }));
    assertOk(initialState.kind === "mobile", `Expected mobile platform kind: ${JSON.stringify(initialState)}`);
    assertOk(initialState.platform === "android", `Expected android platform: ${JSON.stringify(initialState)}`);
    assertOk(initialState.native === true, `Expected native platform: ${JSON.stringify(initialState)}`);
    assertOk(initialState.buildTarget === "mobile", `Expected mobile build target: ${JSON.stringify(initialState)}`);
    assertOk(["localStorage+preferences", "memory+preferences"].includes(initialState.storageKind), `Unexpected storage kind: ${JSON.stringify(initialState)}`);
    assertOk(initialState.shellClass, "Document should be marked as a mobile app shell.");
    assertOk(initialState.datasetPlatform === "android", `Expected html platform dataset: ${JSON.stringify(initialState)}`);
    ["appStateChange", "backButton", "pause", "resume"].forEach(listener => {
      assertOk(initialState.listeners.includes(listener), `Missing native ${listener} listener.`);
    });
    console.log("ok - mobile adapter registers native App listeners");

    const lifecycleState = await page.evaluate(() => {
      const events = [];
      window.HexSnakePlatform.lifecycle.onPause(() => events.push("pause"));
      window.HexSnakePlatform.lifecycle.onResume(() => events.push("resume"));
      window.__hexSnakePlatformHarness.listeners.appStateChange({ isActive: false });
      const pausedAfterInactive = window.HexSnakePlatform.lifecycle.isPaused();
      window.__hexSnakePlatformHarness.listeners.appStateChange({ isActive: true });
      const pausedAfterActive = window.HexSnakePlatform.lifecycle.isPaused();
      window.__hexSnakePlatformHarness.listeners.pause();
      const pausedAfterPause = window.HexSnakePlatform.lifecycle.isPaused();
      window.__hexSnakePlatformHarness.listeners.resume();
      const pausedAfterResume = window.HexSnakePlatform.lifecycle.isPaused();
      return { events, pausedAfterInactive, pausedAfterActive, pausedAfterPause, pausedAfterResume };
    });
    assertOk(lifecycleState.pausedAfterInactive === true, `Inactive app state should pause: ${JSON.stringify(lifecycleState)}`);
    assertOk(lifecycleState.pausedAfterActive === false, `Active app state should resume: ${JSON.stringify(lifecycleState)}`);
    assertOk(lifecycleState.pausedAfterPause === true, `Pause event should pause: ${JSON.stringify(lifecycleState)}`);
    assertOk(lifecycleState.pausedAfterResume === false, `Resume event should resume: ${JSON.stringify(lifecycleState)}`);
    assertOk(lifecycleState.events.join(",") === "pause,resume,pause,resume", `Unexpected lifecycle events: ${JSON.stringify(lifecycleState)}`);
    console.log("ok - mobile adapter maps App lifecycle to platform pause/resume");

    const backState = await page.evaluate(async () => {
      const events = [];
      const offFirst = window.HexSnakePlatform.lifecycle.onBackButton(() => {
        events.push("first");
        return false;
      });
      const offSecond = window.HexSnakePlatform.lifecycle.onBackButton(() => {
        events.push("second");
        return true;
      });
      window.__hexSnakePlatformHarness.listeners.backButton({ canGoBack: false });
      await Promise.resolve();
      offFirst();
      offSecond();
      return {
        events,
        exitCalls: window.__hexSnakePlatformHarness.exitCalls,
        confirms: window.__hexSnakePlatformHarness.confirms.length
      };
    });
    assertOk(backState.events.join(",") === "second", `Back button should stop at newest consumer: ${JSON.stringify(backState)}`);
    assertOk(backState.exitCalls === 0, `Consumed back button should not exit app: ${JSON.stringify(backState)}`);
    assertOk(backState.confirms === 0, `Consumed back button should not confirm exit: ${JSON.stringify(backState)}`);
    console.log("ok - mobile adapter lets app code consume Android back button");

    const exitState = await page.evaluate(async () => {
      window.__hexSnakePlatformHarness.listeners.backButton({ canGoBack: false });
      await Promise.resolve();
      return {
        exitCalls: window.__hexSnakePlatformHarness.exitCalls,
        confirms: window.__hexSnakePlatformHarness.confirms.length
      };
    });
    assertOk(exitState.exitCalls === 1, `Unhandled back button should exit after confirm: ${JSON.stringify(exitState)}`);
    assertOk(exitState.confirms === 1, `Unhandled back button should confirm exit: ${JSON.stringify(exitState)}`);
    console.log("ok - mobile adapter handles unconsumed Android back button");

    const hapticState = await page.evaluate(async () => {
      window.HexSnakePlatform.haptics.vibrate(8);
      window.HexSnakePlatform.haptics.vibrate(12);
      window.HexSnakePlatform.haptics.vibrate(18);
      await Promise.resolve();
      return window.__hexSnakePlatformHarness.haptics.map(item => item.style);
    });
    assertOk(hapticState.join(",") === "LIGHT,MEDIUM,HEAVY", `Unexpected haptic styles: ${JSON.stringify(hapticState)}`);
    console.log("ok - mobile adapter maps feedback strength to native haptics");

    const storageState = await page.evaluate(() => {
      const storage = window.HexSnakePlatform.storage;
      window.__hexSnakePlatformHarness.preferences.set = [];
      window.__hexSnakePlatformHarness.preferences.remove = [];
      storage.setJson("hexSnakeHarnessJson", { ok: true });
      const parsed = storage.getJson("hexSnakeHarnessJson", null);
      storage.set("hexSnakeHarnessBroken", "{");
      const fallback = storage.getJson("hexSnakeHarnessBroken", { recovered: true });
      const afterBroken = storage.get("hexSnakeHarnessBroken");
      storage.remove("hexSnakeHarnessJson");
      return {
        parsed,
        fallback,
        afterBroken,
        removed: storage.get("hexSnakeHarnessJson"),
        preferenceSets: window.__hexSnakePlatformHarness.preferences.set,
        preferenceRemoves: window.__hexSnakePlatformHarness.preferences.remove
      };
    });
    assertOk(storageState.parsed?.ok === true, `Storage JSON should round-trip: ${JSON.stringify(storageState)}`);
    assertOk(storageState.fallback?.recovered === true, `Corrupted JSON should return fallback: ${JSON.stringify(storageState)}`);
    assertOk(storageState.afterBroken === null, `Corrupted JSON should be reset: ${JSON.stringify(storageState)}`);
    assertOk(storageState.removed === null, `Storage remove should clear value: ${JSON.stringify(storageState)}`);
    assertOk(storageState.preferenceSets.some(item => item.key === "hexSnakeHarnessJson"), `Storage set should mirror to Preferences: ${JSON.stringify(storageState)}`);
    assertOk(storageState.preferenceRemoves.some(item => item.key === "hexSnakeHarnessBroken"), `Corrupted JSON reset should mirror remove to Preferences: ${JSON.stringify(storageState)}`);
    assertOk(storageState.preferenceRemoves.some(item => item.key === "hexSnakeHarnessJson"), `Storage remove should mirror to Preferences: ${JSON.stringify(storageState)}`);
    console.log("ok - mobile adapter storage keeps sync game settings behavior");

    if (pageErrors.length || consoleErrors.length) {
      throw new Error([
        "Mobile platform adapter test saw browser errors:",
        ...pageErrors.map(error => `pageerror: ${error}`),
        ...consoleErrors.map(error => `console.error: ${error}`)
      ].join("\n"));
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log("\nMobile platform adapter test passed.");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
