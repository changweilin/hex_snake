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
  sourceOrder: Object.freeze([...moduleShadowSourceOrder])
});

function loadModuleShadow() {
  window.__HEX_SNAKE_MODULE_SHADOW__ = moduleShadowContract;
  return moduleShadowContract;
}

export {
  loadModuleShadow,
  moduleShadowContract,
  moduleShadowSourceOrder
};
