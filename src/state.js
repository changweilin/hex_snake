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

const HexSnakeUI = {};
HexSnakeUI.aiGame = {};
HexSnakeUI.replayGame = {};
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
      const storage = window.HexSnakeStorage;
      const saved = storage?.getJson?.("hexSnakeKeybinds", null);
      if (!saved || !Array.isArray(saved.directions)) return structuredClone(HexSnakeState.config.defaultKeybinds);
      return {
        smallAttack: normalizeKey(saved.smallAttack, HexSnakeState.config.defaultKeybinds.smallAttack),
        bigAttack: normalizeKey(saved.bigAttack, HexSnakeState.config.defaultKeybinds.bigAttack),
        pause: normalizeKey(saved.pause, HexSnakeState.config.defaultKeybinds.pause),
        surrender: normalizeKey(saved.surrender, HexSnakeState.config.defaultKeybinds.surrender),
        "directions": HexSnakeState.config.defaultKeybinds.directions.map((fallback, index) => normalizeKey(saved.directions[index], fallback))
      };
    } catch {
      return structuredClone(HexSnakeState.config.defaultKeybinds);
    }
  }

  function normalizeAutoBattleSpeed(value) {
    const parsed = Number(value);
    return HexSnakeState.config.autoBattleSpeeds.includes(parsed) ? parsed : 1;
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
window.HexSnakeRenderGame = HexSnakeRenderGame;
window.HexSnakeControls = HexSnakeControls;
