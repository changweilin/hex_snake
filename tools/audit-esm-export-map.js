#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  errors.push(message);
}

function parseConstArray(source, name) {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const match = source.match(pattern);
  if (!match) {
    fail(`Could not find const ${name} array.`);
    return [];
  }
  return Array.from(match[1].matchAll(/"([^"]+)"|([A-Za-z_$][\w$]*)/g), item => item[1] || item[2]);
}

function expectEqual(label, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    fail(`${label} mismatch.\n  expected: ${expected.join(", ")}\n  actual:   ${actual.join(", ")}`);
  }
}

function expectToken(relativePath, token) {
  const text = read(relativePath);
  if (!text.includes(token)) {
    fail(`${relativePath} is missing ${token}`);
  }
}

const sharedOrder = [
  "src/state.js",
  "src/dom.js",
  "src/ui.js",
  "src/network.js",
  "src/characters.js",
  "src/audio.js",
  "src/replay.js",
  "src/stats.js",
  "src/about.js",
  "src/ai.js",
  "src/render.js",
  "src/game.js"
];

expectEqual(
  "src/main.js legacy loader sources",
  parseConstArray(read("src/main.js"), "sources"),
  ["src/platform/web.js", ...sharedOrder]
);

expectEqual(
  "src/main-module.js shadow source order",
  parseConstArray(read("src/main-module.js"), "moduleShadowSourceOrder"),
  ["src/platform/web.js", ...sharedOrder]
);

expectEqual(
  "build.js legacySources",
  parseConstArray(read("build.js"), "legacySources"),
  ["platformSource", ...sharedOrder]
);

const mainSource = read("src/main.js");
[
  "hexSnakeLoader",
  "module-shadow",
  "module",
  "./main-module.js",
  "loadModuleShadowEntry",
  "loadModuleGameEntry",
  "moduleEntry.loadModuleGame()",
  "Module loader did not bootstrap gameplay."
].forEach(token => {
  if (!mainSource.includes(token)) fail(`src/main.js is missing ${token}`);
});

const mainModuleSource = read("src/main-module.js");
[
  'import { runtime } from "./platform/web.js";',
  'from "./state.js"',
  'import { dom } from "./dom.js";',
  'import { uiCore } from "./ui.js";',
  'import { network } from "./network.js";',
  'import { characterCatalog as characters } from "./characters.js";',
  'import { audio } from "./audio.js";',
  'import { replay } from "./replay.js";',
  'import { stats } from "./stats.js";',
  'import { about } from "./about.js";',
  'import { ai } from "./ai.js";',
  'import { renderHooks } from "./render.js";',
  'import { gameShell } from "./game.js";',
  "module-shadow",
  "bootstrapsGameplay: false",
  "domReady",
  "uiReady",
  "serviceReady",
  "catalogReady",
  "mediaReady",
  "replayReady",
  "statsReady",
  "aiReady",
  "renderReady",
  "gameReady",
  "runtimeKind",
  "registryKeys",
  "loadModuleShadow",
  "loadModuleGame",
  "moduleShadowContract",
  "moduleGameContract",
  "window.__HEX_SNAKE_MODULE_GAME__",
  "window.__HEX_SNAKE_MODULE_SHADOW__"
].forEach(token => {
  if (!mainModuleSource.includes(token)) fail(`src/main-module.js is missing ${token}`);
});

const loadModuleShadowSource = mainModuleSource.slice(
  mainModuleSource.indexOf("function loadModuleShadow"),
  mainModuleSource.indexOf("async function loadModuleGame")
);

if (/bootstrapGame\s*\(/.test(loadModuleShadowSource) || /loadGameShell\s*\(/.test(loadModuleShadowSource)) {
  fail("src/main-module.js must not call game shell or bootstrap functions during module-shadow phase.");
}

if (!/async function loadModuleGame\(\)[\s\S]*gameShell\.bootstrapGame\(\)/.test(mainModuleSource)) {
  fail("src/main-module.js must call gameShell.bootstrapGame() only from loadModuleGame().");
}

expectToken(
  "build.js",
  'const platformSource = buildTarget === "mobile" ? "src/platform/mobile.js" : "src/platform/web.js";'
);
expectToken(
  "build.js",
  'strategy: "bundled-legacy-fallback"'
);
expectToken(
  "build.js",
  'activationGate: "module-bundle-source-map-release-gate"'
);
expectToken(
  "tools/check-assets.js",
  'manifest.moduleLoader?.strategy !== "bundled-legacy-fallback"'
);
expectToken(
  "package.json",
  '"test:module-loader": "node tools/module-loader-smoke-test.js"'
);
expectToken(
  "tools/run-release-check.js",
  'script: "test:module-loader"'
);
expectToken(
  "tools/module-loader-smoke-test.js",
  "hexSnakeLoader=module-shadow"
);
expectToken(
  "tools/module-loader-smoke-test.js",
  "hexSnakeLoader=module"
);
expectToken(
  "tools/module-loader-smoke-test.js",
  "__HEX_SNAKE_MODULE_GAME__"
);
expectToken(
  "tools/module-loader-smoke-test.js",
  "__HEX_SNAKE_BUNDLED_LEGACY__"
);

const requiredRegistrations = [
  ["src/platform/web.js", "window.HexSnakeRuntime = HexSnakeRuntime;"],
  ["src/platform/mobile.js", "window.HexSnakeRuntime = HexSnakeRuntime;"],
  ["src/platform/web.js", "HexSnakeRuntime as runtime"],
  ["src/platform/mobile.js", "HexSnakeRuntime as runtime"],
  ["src/platform/web.js", "platform: HexSnakePlatform"],
  ["src/platform/web.js", "storage: HexSnakeStorage"],
  ["src/platform/mobile.js", "platform: HexSnakePlatform"],
  ["src/platform/mobile.js", "storage: HexSnakeStorage"],
  ["src/state.js", "window.HexSnakeState = HexSnakeState;"],
  ["src/state.js", "window.HexSnakeUI = HexSnakeUI;"],
  ["src/state.js", "window.HexSnakeRender = HexSnakeRender;"],
  ["src/state.js", "window.HexSnakeRenderGame = HexSnakeRenderGame;"],
  ["src/state.js", "window.HexSnakeControls = HexSnakeControls;"],
  ["src/state.js", "HexSnakeState as state"],
  ["src/state.js", "HexSnakeUI as uiRegistry"],
  ["src/state.js", "HexSnakeUI.about = {};"],
  ["src/state.js", "HexSnakeUI.ai = {};"],
  ["src/state.js", "HexSnakeUI.aiGame = {};"],
  ["src/state.js", "HexSnakeUI.audio = {};"],
  ["src/state.js", "HexSnakeUI.network = {};"],
  ["src/state.js", "HexSnakeUI.replay = {};"],
  ["src/state.js", "HexSnakeUI.replayGame = {};"],
  ["src/state.js", "HexSnakeUI.stats = {};"],
  ["src/state.js", "HexSnakeUI.uiGame = {};"],
  ["src/dom.js", "window.HexSnakeDOM = HexSnakeDOM;"],
  ["src/dom.js", "HexSnakeDOM as dom"],
  ["src/ui.js", "const UiRuntime = HexSnakeRuntime;"],
  ["src/ui.js", "const UiRootState = HexSnakeState;"],
  ["src/ui.js", "const UiRegistry = HexSnakeUI;"],
  ["src/ui.js", "const UiAudio = UiRegistry.audio;"],
  ["src/ui.js", "const UiGame = UiRegistry.uiGame;"],
  ["src/ui.js", "const UiReplay = UiRegistry.replay;"],
  ["src/ui.js", "const UiStorage = UiRuntime.storage;"],
  ["src/ui.js", "const UiConfig = UiRootState.config;"],
  ["src/ui.js", "const UiGameState = UiRootState.game;"],
  ["src/ui.js", "const UiPresentationState = UiRootState.ui;"],
  ["src/ui.js", "Object.assign(UiRegistry"],
  ["src/ui.js", "Object.defineProperties(UiConfig"],
  ["src/ui.js", "Object.defineProperties(UiGameState"],
  ["src/ui.js", "Object.defineProperties(UiPresentationState"],
  ["src/ui.js", "HexSnakeUICore as uiCore"],
  ["src/network.js", "const NetRuntime = HexSnakeRuntime;"],
  ["src/network.js", "const NetStorage = NetRuntime.storage;"],
  ["src/network.js", "const NetUI = HexSnakeUI;"],
  ["src/network.js", "Object.defineProperties(NetUI.network"],
  ["src/network.js", "window.HexSnakeNet = HexSnakeNet;"],
  ["src/network.js", "HexSnakeNet as network"],
  ["src/characters.js", "const CharacterState = HexSnakeState;"],
  ["src/characters.js", "const CharacterGameState = CharacterState.game;"],
  ["src/characters.js", "const CharacterUiState = CharacterState.ui;"],
  ["src/characters.js", "const CharacterConfig = CharacterState.config;"],
  ["src/characters.js", "const CharacterUI = HexSnakeUI;"],
  ["src/characters.js", "const CharacterDom = HexSnakeDOM;"],
  ["src/characters.js", "HexSnakeCharacters as characterCatalog"],
  ["src/characters.js", "CharacterConfig.colors"],
  ["src/audio.js", "const AudioRuntime = HexSnakeRuntime;"],
  ["src/audio.js", "const AudioState = HexSnakeState.audio;"],
  ["src/audio.js", "const AudioUiState = HexSnakeState.ui;"],
  ["src/audio.js", "const AudioUI = HexSnakeUI;"],
  ["src/audio.js", "const AudioDom = HexSnakeDOM;"],
  ["src/audio.js", "Object.defineProperties(AudioUI.audio"],
  ["src/audio.js", "HexSnakeAudio as audio"],
  ["src/replay.js", "const ReplayRuntime = HexSnakeRuntime;"],
  ["src/replay.js", "const ReplayUI = HexSnakeUI;"],
  ["src/replay.js", "const ReplayGame = ReplayUI.replayGame;"],
  ["src/replay.js", "Object.defineProperties(ReplayUI.replay"],
  ["src/replay.js", "HexSnakeReplay as replay"],
  ["src/stats.js", "const StatsRuntime = HexSnakeRuntime;"],
  ["src/stats.js", "const StatsGameState = HexSnakeState.game;"],
  ["src/stats.js", "const StatsUI = HexSnakeUI;"],
  ["src/stats.js", "const StatsDom = HexSnakeDOM;"],
  ["src/stats.js", "Object.defineProperties(StatsUI.stats"],
  ["src/stats.js", "HexSnakeStats as stats"],
  ["src/about.js", "const AboutRuntime = HexSnakeRuntime;"],
  ["src/about.js", "const AboutPlatform = AboutRuntime.platform;"],
  ["src/about.js", "const AboutUI = HexSnakeUI;"],
  ["src/about.js", "const AboutDom = HexSnakeDOM;"],
  ["src/about.js", "Object.defineProperties(AboutUI.about"],
  ["src/about.js", "window.HexSnakeAbout = HexSnakeAbout;"],
  ["src/about.js", "HexSnakeAbout as about"],
  ["src/ai.js", "const AiRuntime = HexSnakeRuntime;"],
  ["src/ai.js", "const AiConfig = HexSnakeState.config;"],
  ["src/ai.js", "const AiState = HexSnakeState.game;"],
  ["src/ai.js", "const AiUI = HexSnakeUI;"],
  ["src/ai.js", "const AiGame = AiUI.aiGame;"],
  ["src/ai.js", "const AiStorage = AiRuntime.storage;"],
  ["src/ai.js", "Object.defineProperties(AiUI.ai"],
  ["src/ai.js", "HexSnakeAI as ai"],
  ["src/render.js", "const RenderRuntime = HexSnakeRuntime;"],
  ["src/render.js", "const RenderConfig = HexSnakeState.config;"],
  ["src/render.js", "const RenderDom = HexSnakeDOM;"],
  ["src/render.js", "const RenderState = HexSnakeState.game;"],
  ["src/render.js", "const RenderUI = HexSnakeUI;"],
  ["src/render.js", "const RenderAI = RenderUI.ai;"],
  ["src/render.js", "const RenderHooks = HexSnakeRender;"],
  ["src/render.js", "const RenderPlatform = RenderRuntime.platform;"],
  ["src/render.js", "const RenderReplay = RenderUI.replay;"],
  ["src/render.js", "Object.assign(RenderHooks"],
  ["src/render.js", "RenderState.radius"],
  ["src/render.js", "HexSnakeRenderHooks as renderHooks"],
  ["src/game.js", "const GameControls = HexSnakeControls;"],
  ["src/game.js", "const GameRuntime = HexSnakeRuntime;"],
  ["src/game.js", "const GameRootState = HexSnakeState;"],
  ["src/game.js", "const GameConfig = GameRootState.config;"],
  ["src/game.js", "const GameRuntimeState = GameRootState.game;"],
  ["src/game.js", "const GamePresentationState = GameRootState.ui;"],
  ["src/game.js", "const GameUI = HexSnakeUI;"],
  ["src/game.js", "const GameDom = HexSnakeDOM;"],
  ["src/game.js", "const GameRenderGame = HexSnakeRenderGame;"],
  ["src/game.js", "const GameNetwork = GameUI.network;"],
  ["src/game.js", "HexSnakeGame as gameShell"],
  ["src/game.js", "function loadGameShell()"],
  ["src/game.js", "function bootstrapGame()"],
  ["src/game.js", "bootstrapsGameplay: true"],
  ["src/game.js", "Object.assign(GameRenderGame"],
  ["src/game.js", "Object.assign(GameUI.aiGame"],
  ["src/game.js", "Object.assign(GameUI.uiGame"],
  ["src/game.js", "Object.assign(GameUI.replayGame"],
  ["src/game.js", "Object.assign(GameUI, {"],
  ["src/game.js", "window.__HEX_SNAKE_BUNDLED_LEGACY__"],
  ["src/game.js", "if (shouldAutoBootstrapGame())"],
  ["src/game.js", "bootstrapGame();"]
];

requiredRegistrations.forEach(([relativePath, token]) => expectToken(relativePath, token));

const docText = read("doc/es-module-export-map.md");
[
  "src/platform/web.js",
  "src/platform/mobile.js",
  "src/state.js",
  "src/dom.js",
  "src/ui.js",
  "src/network.js",
  "src/characters.js",
  "src/audio.js",
  "src/replay.js",
  "src/stats.js",
  "src/about.js",
  "src/ai.js",
  "src/render.js",
  "src/game.js",
  "src/main-module.js",
  "HexSnakeRuntime",
  "HexSnakeState",
  "HexSnakeDOM",
  "HexSnakeUI",
  "HexSnakeUI.network",
  "HexSnakeUICore",
  "HexSnakeRender",
  "HexSnakeRenderGame",
  "HexSnakeGame",
  "HexSnakeControls",
  "HexSnakeNet",
  "HexSnakeAbout"
].forEach(token => {
  if (!docText.includes(token)) fail(`doc/es-module-export-map.md is missing ${token}`);
});

const loaderPlanText = read("doc/es-module-loader-plan.md");
[
  "legacy",
  "module-shadow",
  "module",
  "fallback",
  "src/main-module.js",
  "hexSnakeLoader=module-shadow",
  "src/platform/web.js",
  "src/platform/mobile.js",
  "src/state.js",
  "src/dom.js",
  "src/ui.js",
  "src/game.js",
  "audit:esm-map",
  "test:module-loader",
  "bundled-legacy-fallback",
  "doc/es-module-production-strategy.md",
  "Next AI Task"
].forEach(token => {
  if (!loaderPlanText.includes(token)) fail(`doc/es-module-loader-plan.md is missing ${token}`);
});

const coreBootstrapChecklistText = read("doc/es-module-core-bootstrap-checklist.md");
[
  "Core Bootstrap Checklist",
  "Module Blockers",
  "Explicit Import Surface",
  "Bootstrap Ownership",
  "Module Mode Preflight",
  "src/ui.js",
  "src/game.js",
  "uiCore",
  "bootstrapGame()",
  "test:module-loader",
  "bootstrapsGameplay: false",
  "bundled-legacy-fallback",
  "Next AI Task"
].forEach(token => {
  if (!coreBootstrapChecklistText.includes(token)) fail(`doc/es-module-core-bootstrap-checklist.md is missing ${token}`);
});

const productionStrategyText = read("doc/es-module-production-strategy.md");
[
  "bundled-legacy-fallback",
  "assets/app.bundle.js",
  "src/main-module.js",
  "module-bundle-source-map-release-gate",
  "Release Checklist",
  "Switch Conditions",
  "Next AI Task"
].forEach(token => {
  if (!productionStrategyText.includes(token)) fail(`doc/es-module-production-strategy.md is missing ${token}`);
});

if (errors.length) {
  console.error("ESM export map audit failed:");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log("ESM export map audit passed.");
