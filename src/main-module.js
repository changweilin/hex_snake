import { runtime } from "./platform/web.js";
import { controls, render, renderGame, state, uiRegistry } from "./state.js";

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
  imports: Object.freeze(["runtime", "state", "uiRegistry", "render", "renderGame", "controls"]),
  runtimeKind: runtime.platform.kind,
  storageKind: runtime.storage.kind,
  registryKeys: Object.freeze(Object.keys(uiRegistry).sort()),
  sourceOrder: Object.freeze([...moduleShadowSourceOrder])
});

function loadModuleShadow() {
  if (!state || !uiRegistry || !render || !renderGame || !controls) {
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
