import { runtime } from "./platform/web.js";
import { controls, render, renderGame, state, uiRegistry } from "./state.js";
import { dom } from "./dom.js";
import { uiCore } from "./ui.js";
import { network } from "./network.js";
import { characterCatalog as characters } from "./characters.js";
import { audio } from "./audio.js";
import { replay } from "./replay.js";
import { stats } from "./stats.js";
import { about } from "./about.js";
import { ai } from "./ai.js";
import { renderHooks } from "./render.js";
import { gameShell } from "./game.js";

const moduleShadowSourceOrder = [
  "src/platform/web.js",
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

const moduleShadowContract = Object.freeze({
  mode: "module-shadow",
  entry: "src/main-module.js",
  bootstrapsGameplay: false,
  imports: Object.freeze(["runtime", "state", "uiRegistry", "render", "renderGame", "controls", "dom", "uiCore", "network", "characters", "audio", "replay", "stats", "about", "ai", "renderHooks", "gameShell"]),
  domReady: Boolean(dom.canvas && dom.ctx && dom.overlay),
  uiReady: Boolean(uiCore.loadBalanceConfig && uiCore.buildCharacterStage && uiCore.formatTime),
  serviceReady: Boolean(network.lifecycle && about.refresh),
  catalogReady: Boolean(characters.loadCharacterDatabase && characters.characterFor),
  mediaReady: Boolean(audio.playCharacter && audio.preloadCharacter),
  replayReady: Boolean(replay.startRecording && replay.startPlayback),
  statsReady: Boolean(stats.recordMatch && stats.refresh),
  aiReady: Boolean(ai.chooseComputerDirection && ai.maybeComputerAttack),
  renderReady: Boolean(renderHooks.draw && renderHooks.triggerBoardShake),
  gameReady: Boolean(gameShell.loadGameShell && gameShell.bootstrapGame && gameShell.resize),
  runtimeKind: runtime.platform.kind,
  storageKind: runtime.storage.kind,
  registryKeys: Object.freeze(Object.keys(uiRegistry).sort()),
  sourceOrder: Object.freeze([...moduleShadowSourceOrder])
});

function loadModuleShadow() {
  if (!state || !uiRegistry || !render || !renderGame || !controls || !dom || !uiCore || !network || !characters || !audio || !replay || !stats || !about || !ai || !renderHooks || !gameShell) {
    throw new Error("Module shadow registry import failed.");
  }
  window.__HEX_SNAKE_MODULE_SHADOW__ = moduleShadowContract;
  return moduleShadowContract;
}

export {
  loadModuleShadow,
  moduleShadowContract,
  moduleShadowSourceOrder
};
