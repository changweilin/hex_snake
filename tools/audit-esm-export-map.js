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

function expectSliceExcludes(relativePath, label, startToken, endToken, bannedTokens) {
  const text = read(relativePath);
  const start = text.indexOf(startToken);
  const end = text.indexOf(endToken);
  if (start === -1 || end === -1 || end <= start) {
    fail(`${relativePath} could not locate ${label}.`);
    return;
  }
  const slice = text.slice(start, end);
  bannedTokens.forEach(token => {
    if (slice.includes(token)) fail(`${relativePath} ${label} should use local aliases instead of ${token}`);
  });
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
  ["src/state.js", "const StateRuntime = HexSnakeRuntime;"],
  ["src/state.js", "const StateStorage = StateRuntime.storage;"],
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
  ["src/ui.js", "const UiControls = HexSnakeControls;"],
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
  ["src/audio.js", "const AudioRootState = HexSnakeState;"],
  ["src/audio.js", "const AudioState = AudioRootState.audio;"],
  ["src/audio.js", "const AudioUiState = AudioRootState.ui;"],
  ["src/audio.js", "const AudioUI = HexSnakeUI;"],
  ["src/audio.js", "const AudioDom = HexSnakeDOM;"],
  ["src/audio.js", "Object.defineProperties(AudioUI.audio"],
  ["src/audio.js", "HexSnakeAudio as audio"],
  ["src/replay.js", "const ReplayRuntime = HexSnakeRuntime;"],
  ["src/replay.js", "const ReplayRootState = HexSnakeState;"],
  ["src/replay.js", "const ReplayUI = HexSnakeUI;"],
  ["src/replay.js", "const ReplayGame = ReplayUI.replayGame;"],
  ["src/replay.js", "Object.defineProperties(ReplayUI.replay"],
  ["src/replay.js", "HexSnakeReplay as replay"],
  ["src/stats.js", "const StatsRuntime = HexSnakeRuntime;"],
  ["src/stats.js", "const StatsRootState = HexSnakeState;"],
  ["src/stats.js", "const StatsGameState = StatsRootState.game;"],
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
  ["src/ai.js", "const AiRootState = HexSnakeState;"],
  ["src/ai.js", "const AiConfig = AiRootState.config;"],
  ["src/ai.js", "const AiState = AiRootState.game;"],
  ["src/ai.js", "const AiUI = HexSnakeUI;"],
  ["src/ai.js", "const AiGame = AiUI.aiGame;"],
  ["src/ai.js", "const AiStorage = AiRuntime.storage;"],
  ["src/ai.js", "Object.defineProperties(AiUI.ai"],
  ["src/ai.js", "HexSnakeAI as ai"],
  ["src/render.js", "const RenderRuntime = HexSnakeRuntime;"],
  ["src/render.js", "const RenderRootState = HexSnakeState;"],
  ["src/render.js", "const RenderConfig = RenderRootState.config;"],
  ["src/render.js", "const RenderDom = HexSnakeDOM;"],
  ["src/render.js", "const RenderState = RenderRootState.game;"],
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

if (read("src/ui.js").includes("HexSnakeUI.")) {
  fail("src/ui.js should use the UiRegistry alias for HexSnakeUI property reads.");
}

if (read("src/game.js").includes("HexSnakeState.config.autoBattleSpeeds") || read("src/game.js").includes("HexSnakeState.game.computerBattleSpeed")) {
  fail("src/game.js auto-battle speed reads should use GameConfig / GameRuntimeState aliases.");
}

expectSliceExcludes(
  "src/game.js",
  "control profile alias slice",
  "function renderControlProfiles",
  "function loadSavedCharacterChoices",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "saved character choice alias slice",
  "function loadSavedCharacterChoices",
  "function applyKeybinds",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "keybind alias slice",
  "function applyKeybinds",
  "function triggerTouchFeedback",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "attack button highlight alias slice",
  "function setAttackButtonHighlight",
  "function setLeftHandMode",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "settings perf overlay alias slice",
  "function setLeftHandMode",
  "function clampGridSize",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "settings clamp GM parameters alias slice",
  "function clampGridSize",
  "function refreshGmPreview",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "GM presets settings action alias slice",
  "function refreshGmPreview",
  "function setSettingsLocked",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "board geometry helper alias slice",
  "function setSettingsLocked",
  "function createStartingSnake",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "reset game setup alias slice",
  "function createStartingSnake",
  "function canRestartAfterGameOver",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "result share helper alias slice",
  "function canRestartAfterGameOver",
  "function beginStartLogoCountdown",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "start logo countdown alias slice",
  "function beginStartLogoCountdown",
  "function skipLogoTransition",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "skip logo transition alias slice",
  "function skipLogoTransition",
  "function startGame",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "start game entry alias slice",
  "function startGame",
  "function autoStartGame",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "auto start game alias slice",
  "function autoStartGame",
  "function returnToStartScreen",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "return to start screen alias slice",
  "function returnToStartScreen",
  "function openGameOverCharacterSelect",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "open game over character select alias slice",
  "function openGameOverCharacterSelect",
  "function randomFoodType",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "random food generation helper alias slice",
  "function randomFoodType",
  "function updateStockHud",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "update stock HUD helper alias slice",
  "function updateStockHud",
  "function updateHealthBar",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "cooldown indicator helper alias slice",
  "function cooldownTimerText",
  "function updateHud",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "update HUD helper alias slice",
  "function updateHud",
  "function recordReplaySnapshotThrottled",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "replay snapshot throttle helper alias slice",
  "function recordReplaySnapshotThrottled",
  "function setStatus",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "auto battle speed menu helper alias slice",
  "function autoBattleSpeedLabel",
  "function resetAutoBattleStepTimers",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "auto battle speed index helper alias slice",
  "function applyAutoBattleSpeedIndex",
  "function replayPlaybackSpeedIndex",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "auto battle relay control state alias slice",
  "function resetAutoBattleStepTimers",
  "let lastNetworkSnapshotAt",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "game-over settlement helper alias slice",
  "function showGameOverSettlement",
  "function resolveHazards",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "game-over relay settlement alias slice",
  "function endGame",
  "function loop",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "network helper alias slice",
  "let lastNetworkSnapshotAt",
  "function sandwormUndergroundAlpha",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "sandworm status helper alias slice",
  "function sandwormUndergroundAlpha",
  "function canTurn",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "turn/direction helper alias slice",
  "function canTurn",
  "function attackStats",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "attack stats direction vector helper alias slice",
  "function attackStats",
  "function cellsForwardFrom",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "lobster path nearby cells helper alias slice",
  "function cellsForwardFrom",
  "function attackVisualType",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "attack visual circle projectile helper alias slice",
  "function attackVisualType",
  "function guKingBestDamageStep",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "Gu King lobster volley helper alias slice",
  "function guKingBestDamageStep",
  "function scheduleCharacterBigAttack",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "character big attack scheduler alias slice",
  "function scheduleCharacterBigAttack",
  "function launchAttack",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "launch attack helper alias slice",
  "function launchAttack",
  "function damageSnake",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "damage vulnerability helper alias slice",
  "function damageSnake",
  "function applyAttackStun",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "attack stun slow helper alias slice",
  "function applyAttackStun",
  "function applyVulnerability",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "vulnerability collision paralysis helper alias slice",
  "function applyVulnerability",
  "function resolveProjectiles",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "projectile resolver helper alias slice",
  "function resolveProjectiles",
  "function addProjectileBlastVisual",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "projectile blast visual helper alias slice",
  "function addProjectileBlastVisual",
  "function advanceGameOverVisuals",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "game-over visual advance helper alias slice",
  "function advanceGameOverVisuals",
  "function showGameOverSettlement",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "hazard resolver helper alias slice",
  "function resolveHazards",
  "function advanceOwnerMovement",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "owner movement helper alias slice",
  "function advanceOwnerMovement",
  "function replaceConsumedFoods",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "replace consumed foods helper alias slice",
  "function replaceConsumedFoods",
  "function step",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "step helper alias slice",
  "function step",
  "function stepPlayerOnly",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "step player-only helper alias slice",
  "function stepPlayerOnly",
  "function stepComputerOnly",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "step computer-only helper alias slice",
  "function stepComputerOnly",
  "function endGame",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "loop helper alias slice",
  "function loop",
  "function pointerToDirection",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "pointer direction helper alias slice",
  "function pointerToDirection",
  "function beginControlPadAttackPointer",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "control-pad attack pointer helper alias slice",
  "function beginControlPadAttackPointer",
  "function moveStick",
  ["HexSnakeState.", "HexSnakeUI."]
);

expectSliceExcludes(
  "src/game.js",
  "move stick helper alias slice",
  "function moveStick",
  "function moveTargetStick",
  ["HexSnakeState.", "HexSnakeUI."]
);

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
  "StateStorage",
  "HexSnakeState",
  "HexSnakeDOM",
  "HexSnakeUI",
  "UiRegistry",
  "UiControls",
  "AudioRootState",
  "ReplayRootState",
  "AiRootState",
  "RenderRootState",
  "StatsRootState",
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
