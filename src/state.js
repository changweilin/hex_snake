const StateRuntime = HexSnakeRuntime;
const StateStorage = StateRuntime.storage;

const HexSnakeState = {
  audio: {
    muted: false,
    unlocked: false
  },
  config: {},
  game: {},
  replay: {},
  ui: {}
};

const StateConfig = HexSnakeState.config;
const HexSnakeUI = {};
const StateUIRegistry = HexSnakeUI;
StateUIRegistry.about = {};
StateUIRegistry.ai = {};
StateUIRegistry.aiGame = {};
StateUIRegistry.audio = {};
StateUIRegistry.network = {};
StateUIRegistry.replay = {};
StateUIRegistry.replayGame = {};
StateUIRegistry.stats = {};
StateUIRegistry.uiGame = {};
const HexSnakeRender = {};
const HexSnakeRenderGame = {};

const HexSnakeControls = (() => {
  function normalizeKey(value, fallback) {
    if (value === " " || value === "Space") return " ";
    const trimmed = String(value || "").trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, 1).toLowerCase();
  }

  function keyLabel(key) {
    return key === " " ? "Space" : key.toUpperCase();
  }

  function loadKeybinds() {
    try {
      const storage = StateStorage;
      const saved = storage?.getJson?.("hexSnakeKeybinds", null);
      if (!saved || !Array.isArray(saved.directions)) return structuredClone(StateConfig.defaultKeybinds);
      return {
        smallAttack: normalizeKey(saved.smallAttack, StateConfig.defaultKeybinds.smallAttack),
        bigAttack: normalizeKey(saved.bigAttack, StateConfig.defaultKeybinds.bigAttack),
        pause: normalizeKey(saved.pause, StateConfig.defaultKeybinds.pause),
        surrender: normalizeKey(saved.surrender, StateConfig.defaultKeybinds.surrender),
        "directions": StateConfig.defaultKeybinds.directions.map((fallback, index) => normalizeKey(saved.directions[index], fallback))
      };
    } catch {
      return structuredClone(StateConfig.defaultKeybinds);
    }
  }

  function normalizeAutoBattleSpeed(value) {
    const parsed = Number(value);
    return StateConfig.autoBattleSpeeds.includes(parsed) ? parsed : 1;
  }

  return Object.freeze({
    keyLabel,
    loadKeybinds,
    normalizeAutoBattleSpeed,
    normalizeKey
  });
})();

window.HexSnakeState = HexSnakeState;
window.HexSnakeUI = HexSnakeUI;
window.HexSnakeRender = HexSnakeRender;
window.HexSnakeRenderGame = HexSnakeRenderGame;
window.HexSnakeControls = HexSnakeControls;

export {
  HexSnakeControls,
  HexSnakeRender,
  HexSnakeRenderGame,
  HexSnakeState,
  HexSnakeUI,
  HexSnakeControls as controls,
  HexSnakeRender as render,
  HexSnakeRenderGame as renderGame,
  HexSnakeState as state,
  HexSnakeUI as uiRegistry
};
