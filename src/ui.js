let minGridSize = 6;
let maxGridSize = 12;
let minFoodCount = 1;
let maxFoodCount = 4;
let minInitialSpeed = 0.5;
let maxInitialSpeed = 3;
let minInitialLength = 1;
let maxInitialLength = 12;
let attackNeedTotal = 6;
let maxAmmo = 3;
const autoBattleSpeeds = [4, 2, 1.5, 1, 0.75, 0.5, 0.25];
const brandLogoPath = "assets/logos/white-dragon-logo.png";
const logoTransitionDurationMs = 3000;
const logoTransitionMessageDurationMs = 2000;
const logoTransitionPieceMs = 520;
let smallAttackFoodCost = 2;
let smallAttackBombCost = 1;
let bigAttackBombCost = 2;
let smallAttackDamageMultiplier = 1;
let bigAttackDamageMultiplier = 1;
let baseAttackDelayMs = 2000;
let baseAttackCooldownMs = 2400;
let baseStepMs = 460;
let blastDurationMs = 520;
let baseBlastHexRadius = 2;
let proteinRangeBonusPerPoint = 0.05;
let maxAttackSpeedBonus = 1;
let maxMoveBonus = 0.8;
let maxDamageBonus = 2;
let attackSpeedBonusPerPoint = 0.05;
let moveBonusPerPoint = 0.04;
let damageBonusPerPoint = 0.1;
let maxFoodStock = 20;
let foodEnergy = 2;
let blackFoodEnergy = 3;
let singleColorStockGain = 2;
let dualColorStockGain = 1;
let preferredFoodWeight = 0.4;
let otherFoodWeight = 0.2;
let balancedDualChance = 0.5;
let blackSpecialChance = 1 / 3;
let favoriteFoodBonusChance = 0.5;
let balancedFoodBonusChance = 0.2;
let blackFoodBonusChance = 1 / 3;
let blackFoodDoubleBonusChance = 1 / 15;
let collisionStunMs = 2000;
let collisionSlowMs = 1000;
let attackStunMs = 500;
let attackSlowMs = 500;
let baseAttackStunChance = 0.3;
let attackStunChanceBonusPerPoint = 0.01;
let maxAttackStunChanceBonus = 0.2;
let bodyHitStunChance = 0.15;
let bodyHitStunChanceBonusPerPoint = 0.01;
let bodyHitMaxStunChanceBonus = 0.2;
let headHitStunChance = 0.3;
let headHitStunChanceBonusPerPoint = 0.02;
let headHitMaxStunChanceBonus = 0.4;
let attackUltimateBalance = {};
let maxCollisionParalysisMs = 8000;
let rangeDamageFalloffEnabled = false;
let targetMaxHex = 6;
let maxMatchMs = 240000;
let hpPerSnakeUnit = 10;
let gameOverRestartDelayMs = 700;
const gameOverContinuousVisualMaxWaitMs = 1000;
let smallAttackDelayScale = 0.31;
let smallAttackCooldownScale = 0.29;
let sandwormRevealBeforeImpactMs = 200;
const sandwormUndergroundWindowMs = 500;
let defaultSettings = {
  gridSize: 10,
  foodCount: 4,
  computerDifficulty: "medium",
  initialSpeed: 1,
  gmMode: false,
  initialLength: 3,
  initialEnergy: 0,
  initialBombs: 0,
  initialStock: {
    protein: 0,
    fat: 0,
    fiber: 0,
    carb: 0,
  },
  playerCharacterId: "dragon",
  computerCharacterId: "moray",
};
const randomCharacterChoiceId = "__random__";
let gridSize = 10;
let radius = gridSize - 1;
let foodCount = 4;
let computerDifficulty = "medium";
let initialSpeed = 1;
let gmMode = false;
let initialLength = 3;
let initialEnergy = 0;
let initialBombs = 0;
let initialStock = { protein: 0, fat: 0, fiber: 0, carb: 0 };
let gmPresetMode = "real";
let playerCharacterId = "dragon";
let computerCharacterId = "moray";
let playerCharacterChoice = "dragon";
let computerCharacterChoice = "moray";
let pendingDirectionKeybind = null;
function applyBalanceConfig(config) {
  if (!config || typeof config !== "object") return;
  minGridSize = config.limits?.gridSize?.min ?? minGridSize;
  maxGridSize = config.limits?.gridSize?.max ?? maxGridSize;
  minFoodCount = config.limits?.foodCount?.min ?? minFoodCount;
  maxFoodCount = config.limits?.foodCount?.max ?? maxFoodCount;
  minInitialSpeed = config.limits?.initialSpeed?.min ?? minInitialSpeed;
  maxInitialSpeed = config.limits?.initialSpeed?.max ?? maxInitialSpeed;
  minInitialLength = config.limits?.initialLength?.min ?? minInitialLength;
  maxInitialLength = config.limits?.initialLength?.max ?? maxInitialLength;
  attackNeedTotal = config.resources?.attackNeedTotal ?? attackNeedTotal;
  maxAmmo = config.resources?.maxAmmo ?? maxAmmo;
  maxFoodStock = config.resources?.maxFoodStock ?? maxFoodStock;
  maxInitialLength = Math.max(maxInitialLength, maxFoodStock);
  foodEnergy = config.resources?.foodEnergy ?? foodEnergy;
  blackFoodEnergy = config.resources?.blackFoodEnergy ?? blackFoodEnergy;
  singleColorStockGain =
    config.resources?.singleColorStockGain ?? singleColorStockGain;
  dualColorStockGain =
    config.resources?.dualColorStockGain ?? dualColorStockGain;
  favoriteFoodBonusChance =
    config.resources?.favoriteFoodBonusChance ?? favoriteFoodBonusChance;
  balancedFoodBonusChance =
    config.resources?.balancedFoodBonusChance ?? balancedFoodBonusChance;
  blackFoodBonusChance =
    config.resources?.blackFoodBonusChance ?? blackFoodBonusChance;
  blackFoodDoubleBonusChance =
    config.resources?.blackFoodDoubleBonusChance ?? blackFoodDoubleBonusChance;
  baseStepMs = config.movement?.baseStepMs ?? baseStepMs;
  moveBonusPerPoint = config.movement?.moveBonusPerPoint ?? moveBonusPerPoint;
  maxMoveBonus = config.movement?.maxMoveBonus ?? maxMoveBonus;
  targetMaxHex = config.movement?.targetMaxHex ?? targetMaxHex;
  smallAttackFoodCost =
    config.attack?.smallAttackFoodCost ?? smallAttackFoodCost;
  smallAttackBombCost =
    config.attack?.smallAttackBombCost ?? smallAttackBombCost;
  smallAttackDelayScale =
    config.attack?.smallAttackDelayScale ?? smallAttackDelayScale;
  smallAttackCooldownScale =
    config.attack?.smallAttackCooldownScale ?? smallAttackCooldownScale;
  sandwormRevealBeforeImpactMs =
    config.attack?.sandwormRevealBeforeImpactMs ?? sandwormRevealBeforeImpactMs;
  bigAttackBombCost = config.attack?.bigAttackBombCost ?? bigAttackBombCost;
  smallAttackDamageMultiplier =
    config.attack?.smallAttackDamageMultiplier ?? smallAttackDamageMultiplier;
  bigAttackDamageMultiplier =
    config.attack?.bigAttackDamageMultiplier ?? bigAttackDamageMultiplier;
  baseAttackDelayMs = config.attack?.baseAttackDelayMs ?? baseAttackDelayMs;
  baseAttackCooldownMs =
    config.attack?.baseAttackCooldownMs ?? baseAttackCooldownMs;
  baseBlastHexRadius = config.attack?.baseBlastHexRadius ?? baseBlastHexRadius;
  proteinRangeBonusPerPoint =
    config.attack?.proteinRangeBonusPerPoint ?? proteinRangeBonusPerPoint;
  blastDurationMs = config.attack?.blastDurationMs ?? blastDurationMs;
  attackSpeedBonusPerPoint =
    config.attack?.attackSpeedBonusPerPoint ?? attackSpeedBonusPerPoint;
  maxAttackSpeedBonus =
    config.attack?.maxAttackSpeedBonus ?? maxAttackSpeedBonus;
  damageBonusPerPoint =
    config.attack?.damageBonusPerPoint ?? damageBonusPerPoint;
  maxDamageBonus = config.attack?.maxDamageBonus ?? maxDamageBonus;
  baseAttackStunChance =
    config.attack?.baseAttackStunChance ?? baseAttackStunChance;
  attackStunChanceBonusPerPoint =
    config.attack?.attackStunChanceBonusPerPoint ??
    attackStunChanceBonusPerPoint;
  maxAttackStunChanceBonus =
    config.attack?.maxAttackStunChanceBonus ?? maxAttackStunChanceBonus;
  bodyHitStunChance = config.attack?.bodyHitStunChance ?? bodyHitStunChance;
  bodyHitStunChanceBonusPerPoint =
    config.attack?.bodyHitStunChanceBonusPerPoint ??
    bodyHitStunChanceBonusPerPoint;
  bodyHitMaxStunChanceBonus =
    config.attack?.bodyHitMaxStunChanceBonus ?? bodyHitMaxStunChanceBonus;
  headHitStunChance = config.attack?.headHitStunChance ?? headHitStunChance;
  headHitStunChanceBonusPerPoint =
    config.attack?.headHitStunChanceBonusPerPoint ??
    headHitStunChanceBonusPerPoint;
  headHitMaxStunChanceBonus =
    config.attack?.headHitMaxStunChanceBonus ?? headHitMaxStunChanceBonus;
  attackStunMs = config.attack?.attackStunMs ?? attackStunMs;
  attackSlowMs = config.attack?.attackSlowMs ?? attackSlowMs;
  rangeDamageFalloffEnabled =
    config.attack?.rangeDamageFalloffEnabled ?? rangeDamageFalloffEnabled;
  attackUltimateBalance = config.attack?.ultimates || attackUltimateBalance;
  collisionStunMs = config.collision?.collisionStunMs ?? collisionStunMs;
  collisionSlowMs = config.collision?.collisionSlowMs ?? collisionSlowMs;
  maxCollisionParalysisMs =
    config.collision?.maxCollisionParalysisMs ?? maxCollisionParalysisMs;
  hpPerSnakeUnit = config.health?.hpPerSnakeUnit ?? hpPerSnakeUnit;
  preferredFoodWeight = config.foodWeights?.preferred ?? preferredFoodWeight;
  otherFoodWeight = config.foodWeights?.other ?? otherFoodWeight;
  balancedDualChance =
    config.foodWeights?.balancedDualChance ?? balancedDualChance;
  blackSpecialChance =
    config.foodWeights?.blackSpecialChance ?? blackSpecialChance;
  maxMatchMs = config.simulation?.maxMatchMs ?? maxMatchMs;
  defaultSettings = {
    ...defaultSettings,
    ...(config.defaults || {}),
    initialStock: {
      ...defaultSettings.initialStock,
      ...(config.defaults?.initialStock || {}),
    },
  };
  gridSize = defaultSettings.gridSize;
  radius = gridSize - 1;
  foodCount = defaultSettings.foodCount;
  computerDifficulty = defaultSettings.computerDifficulty;
  initialSpeed = defaultSettings.initialSpeed;
  gmMode = defaultSettings.gmMode;
  initialLength = defaultSettings.initialLength;
  initialEnergy = defaultSettings.initialEnergy;
  initialBombs = defaultSettings.initialBombs;
  initialStock = { ...defaultSettings.initialStock };
  playerCharacterId = defaultSettings.playerCharacterId;
  computerCharacterId = defaultSettings.computerCharacterId;
  playerCharacterChoice = playerCharacterId;
  computerCharacterChoice = computerCharacterId;
  gridSizeInput.min = minGridSize;
  gridSizeInput.max = maxGridSize;
  gridSizeInput.value = defaultSettings.gridSize;
  foodCountInput.min = minFoodCount;
  foodCountInput.max = maxFoodCount;
  foodCountInput.value = defaultSettings.foodCount;
  initialSpeedInput.min = minInitialSpeed;
  initialSpeedInput.max = maxInitialSpeed;
  initialSpeedInput.value = defaultSettings.initialSpeed;
  initialLengthInput.min = minInitialLength;
  initialLengthInput.max = maxInitialLength;
  initialLengthInput.value = defaultSettings.initialLength;
  initialEnergyInput.max = attackNeedTotal;
  initialEnergyInput.value = defaultSettings.initialEnergy;
  initialBombsInput.max = maxAmmo;
  initialBombsInput.value = defaultSettings.initialBombs;
  initialStockInputs.forEach((input) => {
    input.max = maxFoodStock;
    input.value = defaultSettings.initialStock[input.dataset.initialStock] || 0;
  });
  computerDifficultyInput.value = defaultSettings.computerDifficulty;
  refreshTutorialSlides();
}

async function loadBalanceConfig() {
  try {
    const response = await fetch("data/balance.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    applyBalanceConfig(await response.json());
  } catch (error) {
    console.warn(`Using built-in balance defaults: ${error.message}`);
  }
}

const directions = [
  { q: 0, r: -1, angle: -90, key: "w", label: "左上" },
  { q: 1, r: -1, angle: -30, key: "e", label: "右上" },
  { q: 1, r: 0, angle: 30, key: "d", label: "右方" },
  { q: 0, r: 1, angle: 90, key: "x", label: "右下" },
  { q: -1, r: 1, angle: 150, key: "z", label: "左下" },
  { q: -1, r: 0, angle: -150, key: "a", label: "左方" },
];
const foodTypes = [
  {
    id: "protein",
    label: "蛋白",
    name: "蛋白",
    colorName: "紅色",
    foodName: "蛋白",
    effect: "提升爆炸半徑，外圈按距離遞減傷害",
    color: "#ef4444",
    line: "#fecaca",
  },
  {
    id: "fat",
    label: "脂肪",
    name: "脂肪",
    colorName: "黃色",
    foodName: "脂肪",
    effect: "提升攻擊傷害倍率",
    color: "#facc15",
    line: "#fef08a",
  },
  {
    id: "fiber",
    label: "纖維",
    name: "纖維",
    colorName: "綠色",
    foodName: "纖維",
    effect: "提升移動速度並縮短招式冷卻",
    color: "#22c55e",
    line: "#bbf7d0",
  },
  {
    id: "carb",
    label: "碳水",
    name: "碳水",
    colorName: "藍色",
    foodName: "碳水",
    effect: "加快攻擊施展速度，並提高命中暈眩機率",
    color: "#3b82f6",
    line: "#bfdbfe",
  },
];
const blackFoodType = {
  id: "black",
  label: "迷幻菇",
  name: "迷幻菇",
  colorName: "黑色",
  foodName: "迷幻菇",
  effect: "特殊食物；吃下後隨機補一種自然食物庫存，並獲得額外能量",
  color: "#050505",
  line: "#e5e7eb",
};
const dualFoodName = "蟠桃(雙色)";
const foodTypeById = new Map(
  [...foodTypes, blackFoodType].map((type) => [type.id, type]),
);
const stockFoodTypeIds = foodTypes.map((type) => type.id);
const foodLabels = {
  balanced: "均衡",
  protein: "蛋白",
  fat: "脂肪",
  fiber: "纖維",
  carb: "碳水",
  black: "迷幻菇",
};

function foodNameWithColor(type) {
  return type?.colorName
    ? `${type.name}（${type.colorName}）`
    : type?.name || "";
}

function compactFoodTerms(text = "") {
  return text
    .replace(/蟠桃(?!\()/g, dualFoodName)
    .replace(/蛋白質/g, "蛋白")
    .replace(/纖維素/g, "纖維");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foodTermMarkup(typeId, label) {
  return `<strong class="inline-food-term is-${typeId}">${label}</strong>`;
}

function keywordMarkup(label) {
  return `<strong class="inline-keyword">${label}</strong>`;
}

const inlineFoodTerms = [
  ["dual", dualFoodName],
  ["black", foodNameWithColor(blackFoodType)],
  ["black", blackFoodType.name],
  ...foodTypes.flatMap((type) => [
    [type.id, foodNameWithColor(type)],
    [type.id, type.name],
  ]),
].sort((a, b) => b[1].length - a[1].length);

const inlineKeywordTerms = [
  "HP 歸零",
  "虛擬搖桿區",
  "資源圖表",
  "食物庫存",
  "能量與炸彈",
  "角色大招",
  "實戰重點",
  "食補效果",
  "按鍵自訂",
  "開局設定",
  "六方向鍵",
  "鍵盤Q",
  "鍵盤R",
  "短按",
  "長按",
  "拖曳",
  "庫存",
  "能量",
  "炸彈",
  "暈眩",
  "小招",
  "大招",
  "落敗",
].sort((a, b) => b.length - a.length);

const inlineTermPattern = new RegExp(
  [...inlineFoodTerms.map(([, label]) => label), ...inlineKeywordTerms]
    .map(escapeRegExp)
    .join("|"),
  "g",
);
const inlineFoodTermByLabel = new Map(
  inlineFoodTerms.map(([id, label]) => [label, id]),
);
const inlineKeywordSet = new Set(inlineKeywordTerms);

function formatInlineText(text = "") {
  if (!text) return "";
  return compactFoodTerms(text).replace(inlineTermPattern, (match) => {
    const foodId = inlineFoodTermByLabel.get(match);
    if (foodId) return foodTermMarkup(foodId, match);
    if (inlineKeywordSet.has(match)) return keywordMarkup(match);
    return match;
  });
}

function formatRichText(markup = "") {
  const parts = compactFoodTerms(markup).split(/(<[^>]+>)/g);
  let emphasizedDepth = 0;
  return parts
    .map((part) => {
      if (!part) return "";
      if (part.startsWith("<")) {
        const tag = part.match(/^<\/?\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
        const isClosing = /^<\//.test(part);
        if (tag === "strong" || tag === "b") {
          emphasizedDepth += isClosing ? -1 : 1;
          emphasizedDepth = Math.max(0, emphasizedDepth);
        }
        return part;
      }
      return emphasizedDepth > 0 ? part : formatInlineText(part);
    })
    .join("");
}

function formatRuleNumber(value, fractionDigits = 1) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(fractionDigits));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatRulePercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatRuleSeconds(ms) {
  return `${formatRuleNumber(ms / 1000)} 秒`;
}

function stockWith(typeId, amount = maxFoodStock) {
  return Object.fromEntries(
    foodTypes.map((type) => [type.id, type.id === typeId ? amount : 0]),
  );
}

function foodEffectDescription(type) {
  if (!type) return "";
  if (type.id === "protein") {
    const maxRadius =
      baseBlastHexRadius *
      (1 + Math.min(1, maxFoodStock * proteinRangeBonusPerPoint));
    return `爆炸半徑由 ${formatRuleNumber(baseBlastHexRadius)} 成長到最多 ${formatRuleNumber(maxRadius)}，外圈按距離遞減傷害。`;
  }
  if (type.id === "fat") {
    const baseDamage = damageMultiplier(stockWith("fat", 0));
    const maxDamage = damageMultiplier(stockWith("fat"));
    return `基礎傷害倍率由 ${formatRuleNumber(baseDamage)} 提升到最多 ${formatRuleNumber(maxDamage)}；小招與大招再套用各自招式倍率。`;
  }
  if (type.id === "fiber") {
    const maxMove = moveMultiplier(stockWith("fiber"));
    const maxCooldown = attackCooldownMultiplier(stockWith("fiber"));
    return `移動速度最多 ${formatRuleNumber(maxMove)}x，招式冷卻最多縮短到約 ${formatRulePercent(1 / maxCooldown)}。`;
  }
  if (type.id === "carb") {
    const maxCast = attackSpeedMultiplier(stockWith("carb"));
    const maxBodyStun = Math.min(
      1,
      bodyHitStunChance +
        Math.min(
          bodyHitMaxStunChanceBonus,
          maxFoodStock * bodyHitStunChanceBonusPerPoint,
        ),
    );
    const maxHeadStun = Math.min(
      1,
      headHitStunChance +
        Math.min(
          headHitMaxStunChanceBonus,
          maxFoodStock * headHitStunChanceBonusPerPoint,
        ),
    );
    return `施展速度最多 ${formatRuleNumber(maxCast)}x；身體命中暈眩率最高 ${formatRulePercent(maxBodyStun)}，頭部命中最高 ${formatRulePercent(maxHeadStun)}。`;
  }
  if (type.id === "black") {
    return `特殊食物；吃下後隨機一種自然食物庫存 +1，並獲得 ${blackFoodEnergy} 點能量。`;
  }
  return type.effect || "";
}

const poseAliases = {
  opening: "opening",
  intro: "opening",
  idle: "intro",
  attack: "small",
  small: "small",
  big: "big",
  victory: "victory",
  defeat: "defeat",
};
const portraitPoses = new Set(Object.keys(poseAliases));
let characters = [];
let characterById = new Map();
const colors = {
  cell: "#2a3445",
  cellAlt: "#303c4d",
  cellLine: "#3a4658",
  head: "#f59e0b",
  body: "#d97706",
  headLine: "#ffedd5",
  bodyLine: "#7c2d12",
  computerHead: "#a78bfa",
  computerBody: "#7c3aed",
  computerHeadLine: "#ede9fe",
  computerBodyLine: "#4c1d95",
  eye: "#10160f",
  target: "#fde68a",
  blast: "#fb923c",
};
let keyToDir = new Map(directions.map((dir, index) => [dir.key, index]));
const defaultKeybinds = {
  smallAttack: "q",
  bigAttack: "r",
  pause: " ",
  surrender: "t",
  directions: directions.map((direction) => direction.key),
};
let keybinds = loadKeybinds();
let selectedAttackProfile = "small";
const keyboardTargetModes = ["head", "centroid", "food"];
const keyboardTargetModeLabels = {
  head: "目標頭部",
  centroid: "目標身體",
  food: "目標最近食物",
};
let keyboardAttackAim = {
  small: { targetModeIndex: 0, direction: 0 },
  big: { targetModeIndex: 0, direction: 0 },
};
let keyboardAttackPreview = null;
let keyboardAttackPreviewTimer = null;
let keyboardAimHeldKeys = new Set();
let cells = [];
let resourceEls = new Map();

let cellSize = 28;
let center = { x: 0, y: 0 };
let snake;
let computerSnake;
let foods = [];
let projectiles = [];
let blasts = [];
let hazards = [];
const elementalSpriteCache = new Map();
let boardShakeUntil = 0;
let boardShakeStartedAt = 0;
let boardShakeStrength = 0;
let boardShakeFrequency = 1;
let boardShakeStyle = "impact";
let dir;
let nextDir;
let computerDir;
let computerScore;
let score;
let playerHp;
let computerHp;
let playerStock;
let computerStock;
let playerAmmo;
let computerAmmo;
let playerAmmoCharge;
let computerAmmoCharge;
let playerEnergyFlashUntil = 0;
let computerEnergyFlashUntil = 0;
let playerBombFlashUntil = 0;
let computerBombFlashUntil = 0;
let best = Number(HexSnakeStorage.get("hexSnakeBest") || 0);
let bestTotalMs = Number(HexSnakeStorage.get("hexSnakeBestTotalMs") || 0);
let totalElapsedMs = 0;
let lastFeedElapsedMs = 0;
let running = false;
let paused = false;
let computerBattleMode = false;
let playerAutoMode = false;
let computerBattleManualOverride = false;
let computerBattleSpeed = normalizeAutoBattleSpeed(
  HexSnakeStorage.get("hexSnakeAutoBattleSpeed"),
);
let relayModePreference = HexSnakeStorage.get("hexSnakeRelayMode") === "1";
let relayMode = false;
let relayPlayerWins = 0;
let relayComputerWins = 0;
let relayDraws = 0;
let relayRestartTimer = null;
let gameOverRelayStartOptions = null;
let gameOverSettlementPending = false;
let gameOverContinuousVisualDeadlineAt = 0;
let gameOverLogoTransitionEndsAt = 0;
let gameOverResultOwner = null;
let gameOverPlayerLost = false;
let gameOverComputerLost = false;
let gameOver = false;

Object.defineProperties(HexSnakeState.game, {
  running: {
    get: () => running,
    set: (value) => {
      running = Boolean(value);
    },
  },
  paused: {
    get: () => paused,
    set: (value) => {
      paused = Boolean(value);
    },
  },
  gameOver: {
    get: () => gameOver,
    set: (value) => {
      gameOver = Boolean(value);
    },
  },
  computerBattleMode: {
    get: () => computerBattleMode,
    set: (value) => {
      computerBattleMode = Boolean(value);
    },
  },
  playerAutoMode: {
    get: () => playerAutoMode,
    set: (value) => {
      playerAutoMode = Boolean(value);
    },
  },
  computerBattleManualOverride: {
    get: () => computerBattleManualOverride,
    set: (value) => {
      computerBattleManualOverride = Boolean(value);
    },
  },
  computerBattleSpeed: {
    get: () => computerBattleSpeed,
    set: (value) => {
      computerBattleSpeed = value;
    },
  },
  relayRestartTimer: {
    get: () => relayRestartTimer,
    set: (value) => {
      relayRestartTimer = value;
    },
  },
  gameOverRelayStartOptions: {
    get: () => gameOverRelayStartOptions,
    set: (value) => {
      gameOverRelayStartOptions = value;
    },
  },
  gameOverSettlementPending: {
    get: () => gameOverSettlementPending,
    set: (value) => {
      gameOverSettlementPending = Boolean(value);
    },
  },
  gameOverContinuousVisualDeadlineAt: {
    get: () => gameOverContinuousVisualDeadlineAt,
    set: (value) => {
      gameOverContinuousVisualDeadlineAt = value;
    },
  },
  gameOverLogoTransitionEndsAt: {
    get: () => gameOverLogoTransitionEndsAt,
    set: (value) => {
      gameOverLogoTransitionEndsAt = value;
    },
  },
  gameOverResultOwner: {
    get: () => gameOverResultOwner,
    set: (value) => {
      gameOverResultOwner = value;
    },
  },
  gameOverPlayerLost: {
    get: () => gameOverPlayerLost,
    set: (value) => {
      gameOverPlayerLost = Boolean(value);
    },
  },
  gameOverComputerLost: {
    get: () => gameOverComputerLost,
    set: (value) => {
      gameOverComputerLost = Boolean(value);
    },
  },
  snake: {
    get: () => snake,
    set: (value) => {
      snake = value;
    },
  },
  computerSnake: {
    get: () => computerSnake,
    set: (value) => {
      computerSnake = value;
    },
  },
  foods: {
    get: () => foods,
    set: (value) => {
      foods = Array.isArray(value) ? value : [];
    },
  },
  projectiles: {
    get: () => projectiles,
    set: (value) => {
      projectiles = Array.isArray(value) ? value : [];
    },
  },
  blasts: {
    get: () => blasts,
    set: (value) => {
      blasts = Array.isArray(value) ? value : [];
    },
  },
  hazards: {
    get: () => hazards,
    set: (value) => {
      hazards = Array.isArray(value) ? value : [];
    },
  },
  playerHp: {
    get: () => playerHp,
    set: (value) => {
      playerHp = value;
    },
  },
  computerHp: {
    get: () => computerHp,
    set: (value) => {
      computerHp = value;
    },
  },
  playerStock: {
    get: () => playerStock,
    set: (value) => {
      playerStock = value;
    },
  },
  computerStock: {
    get: () => computerStock,
    set: (value) => {
      computerStock = value;
    },
  },
  playerAmmo: {
    get: () => playerAmmo,
    set: (value) => {
      playerAmmo = value;
    },
  },
  computerAmmo: {
    get: () => computerAmmo,
    set: (value) => {
      computerAmmo = value;
    },
  },
  playerAmmoCharge: {
    get: () => playerAmmoCharge,
    set: (value) => {
      playerAmmoCharge = value;
    },
  },
  computerAmmoCharge: {
    get: () => computerAmmoCharge,
    set: (value) => {
      computerAmmoCharge = value;
    },
  },
});

let lastResultShareData = null;
let resultShareInProgress = false;
let lastPlayerStep = 0;
let lastComputerStep = 0;
let playerStunUntil = 0;
let playerSlowUntil = 0;
let playerCollisionParalysisMs = 0;
let playerVulnerable = false;
let computerStunUntil = 0;
let computerSlowUntil = 0;
let computerCollisionParalysisMs = 0;
let computerVulnerable = false;
let playerUndergroundFrom = 0;
let playerUndergroundUntil = 0;
let computerUndergroundFrom = 0;
let computerUndergroundUntil = 0;
let playerSandwormArmorFrom = 0;
let playerSandwormArmorUntil = 0;
let computerSandwormArmorFrom = 0;
let computerSandwormArmorUntil = 0;

Object.defineProperties(HexSnakeState.game, {
  playerStunUntil: {
    get: () => playerStunUntil,
    set: (value) => {
      playerStunUntil = value;
    },
  },
  playerSlowUntil: {
    get: () => playerSlowUntil,
    set: (value) => {
      playerSlowUntil = value;
    },
  },
  playerCollisionParalysisMs: {
    get: () => playerCollisionParalysisMs,
    set: (value) => {
      playerCollisionParalysisMs = value;
    },
  },
  playerVulnerable: {
    get: () => playerVulnerable,
    set: (value) => {
      playerVulnerable = Boolean(value);
    },
  },
  computerStunUntil: {
    get: () => computerStunUntil,
    set: (value) => {
      computerStunUntil = value;
    },
  },
  computerSlowUntil: {
    get: () => computerSlowUntil,
    set: (value) => {
      computerSlowUntil = value;
    },
  },
  computerCollisionParalysisMs: {
    get: () => computerCollisionParalysisMs,
    set: (value) => {
      computerCollisionParalysisMs = value;
    },
  },
  computerVulnerable: {
    get: () => computerVulnerable,
    set: (value) => {
      computerVulnerable = Boolean(value);
    },
  },
  playerUndergroundFrom: {
    get: () => playerUndergroundFrom,
    set: (value) => {
      playerUndergroundFrom = value;
    },
  },
  playerUndergroundUntil: {
    get: () => playerUndergroundUntil,
    set: (value) => {
      playerUndergroundUntil = value;
    },
  },
  computerUndergroundFrom: {
    get: () => computerUndergroundFrom,
    set: (value) => {
      computerUndergroundFrom = value;
    },
  },
  computerUndergroundUntil: {
    get: () => computerUndergroundUntil,
    set: (value) => {
      computerUndergroundUntil = value;
    },
  },
  playerSandwormArmorFrom: {
    get: () => playerSandwormArmorFrom,
    set: (value) => {
      playerSandwormArmorFrom = value;
    },
  },
  playerSandwormArmorUntil: {
    get: () => playerSandwormArmorUntil,
    set: (value) => {
      playerSandwormArmorUntil = value;
    },
  },
  computerSandwormArmorFrom: {
    get: () => computerSandwormArmorFrom,
    set: (value) => {
      computerSandwormArmorFrom = value;
    },
  },
  computerSandwormArmorUntil: {
    get: () => computerSandwormArmorUntil,
    set: (value) => {
      computerSandwormArmorUntil = value;
    },
  },
});

let lastVisiblePlayerSnake = [];
let lastVisibleComputerSnake = [];
let lastVisiblePlayerDir = 0;
let lastVisibleComputerDir = 3;
let playerFoodTargetKey = null;
let computerFoodTargetKey = null;
let playerFoodTargetAt = 0;
let computerFoodTargetAt = 0;
let lastPlayerFoodAt = 0;
let lastComputerFoodAt = 0;
const deadEndMinSpace = 5;
let lastTimerFrame = 0;
const hudFrameIntervalMs = 100;
const replayRecordCheckIntervalMs = 100;
let lastHudFrameAt = -Infinity;
let lastReplayRecordCheckAt = -Infinity;

Object.defineProperties(HexSnakeState.game, {
  score: {
    get: () => score,
    set: (value) => {
      score = value;
    },
  },
  computerScore: {
    get: () => computerScore,
    set: (value) => {
      computerScore = value;
    },
  },
  totalElapsedMs: {
    get: () => totalElapsedMs,
    set: (value) => {
      totalElapsedMs = value;
    },
  },
  lastFeedElapsedMs: {
    get: () => lastFeedElapsedMs,
    set: (value) => {
      lastFeedElapsedMs = value;
    },
  },
  lastTimerFrame: {
    get: () => lastTimerFrame,
    set: (value) => {
      lastTimerFrame = value;
    },
  },
  lastHudFrameAt: {
    get: () => lastHudFrameAt,
    set: (value) => {
      lastHudFrameAt = value;
    },
  },
  lastPlayerStep: {
    get: () => lastPlayerStep,
    set: (value) => {
      lastPlayerStep = value;
    },
  },
  lastComputerStep: {
    get: () => lastComputerStep,
    set: (value) => {
      lastComputerStep = value;
    },
  },
  lastVisiblePlayerSnake: {
    get: () => lastVisiblePlayerSnake,
    set: (value) => {
      lastVisiblePlayerSnake = Array.isArray(value) ? value : [];
    },
  },
  lastVisibleComputerSnake: {
    get: () => lastVisibleComputerSnake,
    set: (value) => {
      lastVisibleComputerSnake = Array.isArray(value) ? value : [];
    },
  },
  lastVisiblePlayerDir: {
    get: () => lastVisiblePlayerDir,
    set: (value) => {
      lastVisiblePlayerDir = value;
    },
  },
  lastVisibleComputerDir: {
    get: () => lastVisibleComputerDir,
    set: (value) => {
      lastVisibleComputerDir = value;
    },
  },
  playerFoodTargetKey: {
    get: () => playerFoodTargetKey,
    set: (value) => {
      playerFoodTargetKey = value;
    },
  },
  computerFoodTargetKey: {
    get: () => computerFoodTargetKey,
    set: (value) => {
      computerFoodTargetKey = value;
    },
  },
  playerFoodTargetAt: {
    get: () => playerFoodTargetAt,
    set: (value) => {
      playerFoodTargetAt = value;
    },
  },
  computerFoodTargetAt: {
    get: () => computerFoodTargetAt,
    set: (value) => {
      computerFoodTargetAt = value;
    },
  },
  lastPlayerFoodAt: {
    get: () => lastPlayerFoodAt,
    set: (value) => {
      lastPlayerFoodAt = value;
    },
  },
  lastComputerFoodAt: {
    get: () => lastComputerFoodAt,
    set: (value) => {
      lastComputerFoodAt = value;
    },
  },
});

let lastPlayerAttackMs = resetAttackCooldownTracker();
let lastComputerAttackMs = resetAttackCooldownTracker();

Object.defineProperties(HexSnakeState.game, {
  lastPlayerAttackMs: {
    get: () => lastPlayerAttackMs,
    set: (value) => {
      lastPlayerAttackMs = value;
    },
  },
  lastComputerAttackMs: {
    get: () => lastComputerAttackMs,
    set: (value) => {
      lastComputerAttackMs = value;
    },
  },
});

let rafId = 0;
let previewDrawRafId = 0;
let movePointerId = null;
let targetPointerId = null;
let moveStickLocked = false;
let moveStickEngaged = false;
let moveStickHoldTimer = null;
let movePointerStartedAt = 0;
let movePointerStartX = 0;
let movePointerStartY = 0;
let movePointerMoved = false;
let attackPointer = null;
let attackButtonPointerId = null;
let controlAttackPointer = null;
let targetCell = null;
let targetActive = false;
let directionalPreviewCacheKey = null;
let directionalPreviewCache = null;
let moduleHoldTimer = null;
let attackPointerLongPressTimer = null;
let portraitPoseTimers = {};
let attackCalloutTimers = {};
let lockedFighterCallouts = new Set();
let selectedPortraitOwner = "player";
let highlightedAttackProfile = null;
let attackHighlightReleaseTimer = null;
let moveStickReboundTimer = null;
let introDetailsOpen = false;
let tutorialStepIndex = 0;
const tutorialSeenKey = "hexSnakeTutorialSeen";
const perfStatsKey = "hexSnakePerfStats";
let perfStatsVisible = HexSnakeStorage.get(perfStatsKey) === "1";
let tutorialSwipeStartX = null;
let tutorialSwipeStartY = null;
let tutorialSwipePointerId = null;
let tutorialSwipeDidMove = false;
let portraitLightboxOwner = "player";
let portraitSwipeStartX = null;
let portraitSwipeStartY = null;
let portraitSwipeOwner = null;
let portraitInfoSwipeStartX = null;
let portraitInfoSwipeStartY = null;
let portraitIntroDidSwipe = false;
let portraitLightboxDidSwipe = false;
const portraitVariantModes = ["human", "beast", "chibi"];
const defaultPortraitVariantMode = "human";
const portraitVariantLabels = {
  human: "擬人版",
  beast: "幻獸版",
  chibi: "Q獸版",
};
const storedPortraitVariant = HexSnakeStorage.get("hexSnakePortraitVariant");
let portraitVariantMode = portraitVariantModes.includes(storedPortraitVariant)
  ? storedPortraitVariant
  : storedPortraitVariant === "full"
    ? "human"
    : defaultPortraitVariantMode;
let restartUnlockAt = 0;
let logoTransitionTimer = null;
let logoCountdownTimer = null;
let logoTransitionSerial = 0;
let startLogoCountdownPending = false;

function fighterArt(
  character,
  pose = "idle",
  portrait = false,
  variant = "medium",
) {
  const imageClass = `fighter-avatar-image${portrait ? " portrait" : ""}`;
  const loadMode = portrait || pose === "attack" ? "eager" : "lazy";
  const initialSize = variant === "small" ? "sm" : "md";
  const src = portrait
    ? portraitUrl(character, pose, initialSize)
    : avatarUrl(character, initialSize);
  const srcset = portrait
    ? portraitSrcset(character, pose)
    : avatarSrcset(character);
  return `
        <img
          class="${imageClass}"
          src="${src}"
          srcset="${srcset}"
          sizes="${portraitSizesAttribute(variant)}"
          alt="${character.name}"
          decoding="async"
          loading="${loadMode}"
          data-pose="${pose}"
          data-character-id="${character.id}"
          data-portrait-variant="${portraitVariantMode}"
        >
      `;
}

function fighterPortraitImage(character, pose = "idle") {
  return `
        <img
          class="fighter-avatar-image portrait"
          src="${avatarUrl(character, "sm")}"
          srcset="${avatarSrcset(character)}"
          sizes="72px"
          alt="${character.name}"
          decoding="async"
          loading="eager"
          data-pose="${pose}"
          data-character-id="${character.id}"
          data-portrait-variant="${portraitVariantMode}"
          data-avatar-kind="avatar"
          data-duel-avatar="true"
        >
      `;
}

function setImageAttributeIfChanged(image, name, value) {
  if (image.getAttribute(name) !== value) image.setAttribute(name, value);
}

function updateFighterPortraitImage(module, character, pose = "idle") {
  let image = module.querySelector(
    ".fighter-avatar-image[data-duel-avatar='true']",
  );
  if (!image) {
    module.innerHTML = fighterPortraitImage(character, pose);
    return;
  }
  const src = avatarUrl(character, "sm");
  const srcset = avatarSrcset(character);
  setImageAttributeIfChanged(image, "src", src);
  setImageAttributeIfChanged(image, "srcset", srcset);
  setImageAttributeIfChanged(image, "sizes", "72px");
  setImageAttributeIfChanged(image, "alt", character.name);
  image.dataset.pose = pose;
  image.dataset.characterId = character.id;
  image.dataset.portraitVariant = portraitVariantMode;
  image.classList.toggle("is-attacking", pose === "attack");
}

function characterStyle(character, owner = null) {
  const ownerVars = owner
    ? `--owner-color:${ownerMeta(owner).color};--owner-line:${ownerMeta(owner).line};`
    : "";
  return `--fighter-color:${character.color};--fighter-line:${character.line};--fighter-accent:${character.accent};${ownerVars}`;
}

const commonSmallMoveGuide =
  "小招是所有角色共用的基本爆破：按小招鍵或點「小招」時，會依 X 鍵選擇的小招目標施放；在棋盤短點一下則以手勢位置輔助瞄準。";
const characterMoveGuides = {
  dragon: {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按指定落點。白龍會在目標格降下<strong>靈息爆發</strong>，命中後留下<strong>持續 5 秒</strong>的靈息傷害區。",
    tip: "長按棋盤可把落點放在敵方必經路線；第一波爆發傷害更高，持續區域能逼迫對手轉向。",
  },
  sandworm: {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按指定突襲格。沙蟲會<strong>潛地延遲突襲</strong>，正中頭部會直接擊倒，正中身體會麻痺並中斷招式；擦邊仍依一般頭部/身體暈眩率判定。",
    tip: "長按棋盤可預判敵方頭部下一步；施放後接近命中時會短暫潛地，可用來躲開危險。",
  },
  quetzal: {
    big: "按大招鍵、點「大招」，或在棋盤長按都會施放；羽蛇會沿自身蛇身留下<strong>持續 3 秒</strong>的<strong>藤沼區域</strong>，不需要指定落點，蛋白（紅色）庫存越高外擴傷害越完整，藤沼傷害不會造成暈眩。",
    tip: "適合在敵方靠近你身體或追逐時施放，用身體路徑封鎖空間。",
  },
  moray: {
    big: "在棋盤拖曳可指定電擊起點與方向，放開施放；按大招鍵或點「大招」則依 Y 鍵選擇的大招方向施放。電鰻會打出貫穿棋盤的<strong>8 段直線電擊</strong>，頭部與身體受到相同傷害，頭部命中的暈眩率較高且多段可堆疊。",
    tip: "棋盤拖曳時，拖曳方向比落點更重要；沿敵方身體長軸掃線最容易命中多段。",
  },
  lobster: {
    big: "在棋盤拖曳可指定出拳方向，放開施放；按大招鍵或點「大招」則依 Y 鍵選擇的大招方向施放。智蝦會從頭部打出<strong>兩波追蹤連拳</strong>，第二波會從當下頭部重新出拳並重新追蹤轉折；拳路遇到第一個敵方蛇身會<strong>停下並爆發</strong>，小拳命中可能附加易傷，使下一次受到的傷害加倍。",
    tip: "拖曳方向從自己頭部出拳；對準敵方頭部或彎折蛇身，兩波連拳更容易打滿。",
  },
  gu_king: {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按指定毒爆中心。蠱王會連續落下<strong>三段毒爆</strong>，後續每波會往傷害最大的相鄰格推進一格。",
    tip: "長按棋盤可瞄準敵方必經格或被迫轉向的位置，讓三段毒爆覆蓋逃跑路線。",
  },
};

function moveGuideFor(character) {
  return (
    characterMoveGuides[character.id] || {
      big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按或拖曳觸發<strong>角色大招</strong>。",
      tip: "觀察敵方路線後再決定快速施放或手動指定，命中率會更高。",
    }
  );
}

function characterStoryMarkup(character) {
  const motto = character.motto
    ? `<p class="portrait-motto">「${character.motto}」</p>`
    : "";
  const moves =
    character.smallMove && character.bigMove
      ? `<div class="portrait-moves" aria-label="${character.name}招式與食補效果"><span>小招：${character.smallMove}</span><span>大招：${character.bigMove}</span><span>食補效果：${formatRichText(character.detail)}</span></div>`
      : "";
  const story = (character.story || [])
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
  return `${motto}${moves}${story}`;
}

function formatIntroMotto(motto) {
  const text = String(motto || "")
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n+\s*/g, "\n");
  const punctuation = /[，。！？；：、,.!?;:]/u;
  const segments = [];
  let segment = "";
  for (const char of text) {
    if (char === "\n") {
      if (segment.trim()) segments.push(segment.trim());
      segment = "";
      continue;
    }
    segment += char;
    if (punctuation.test(char)) {
      segments.push(segment.trim());
      segment = "";
    }
  }
  if (segment.trim()) segments.push(segment.trim());
  const units = segments.length ? segments : [text];
  const measure = (value) => [...String(value || "").replace(/\s+/g, "")]
    .length;
  const splitUnit = (unit) => {
    const chars = [...String(unit || "").trim()];
    if (chars.length <= 1) return [chars.join(""), ""];
    const center = Math.ceil(chars.length / 2);
    let splitAt = center;
    while (splitAt < chars.length && punctuation.test(chars[splitAt])) {
      splitAt += 1;
    }
    if (splitAt >= chars.length) splitAt = center;
    return [
      chars.slice(0, splitAt).join("").trim(),
      chars.slice(splitAt).join("").trim(),
    ];
  };
  const lines =
    units.length <= 1
      ? splitUnit(units[0] || "")
      : (() => {
          let bestIndex = 1;
          let bestScore = Infinity;
          for (let index = 1; index < units.length; index += 1) {
            const first = units.slice(0, index).join("");
            const second = units.slice(index).join("");
            const score = Math.abs(measure(first) - measure(second));
            if (score < bestScore) {
              bestScore = score;
              bestIndex = index;
            }
          }
          return [
            units.slice(0, bestIndex).join(""),
            units.slice(bestIndex).join(""),
          ];
        })();
  return lines
    .map((line, index) => {
      const prefix = index === 0 ? "「" : "　";
      const suffix = index === lines.length - 1 ? "」" : "　";
      return `<span class="intro-avatar-motto-line">${prefix}${line}${suffix}</span>`;
    })
    .join("");
}

function logoTransitionClassNames() {
  return ["logo-transition", "logo-transition-in", "logo-transition-out"];
}

function clearLogoTransitionTimers() {
  if (logoTransitionTimer) {
    clearTimeout(logoTransitionTimer);
    logoTransitionTimer = null;
  }
  if (logoCountdownTimer) {
    clearInterval(logoCountdownTimer);
    logoCountdownTimer = null;
  }
}

function clearLogoTransition() {
  clearLogoTransitionTimers();
  overlay.classList.remove(...logoTransitionClassNames());
  if (winnerPortrait.querySelector("[data-logo-transition]")) {
    winnerPortrait.hidden = true;
    winnerPortrait.innerHTML = "";
  }
}

function isLogoTransitionActive() {
  return (
    overlay.classList.contains("logo-transition") ||
    Boolean(logoTransitionTimer)
  );
}

function logoTransitionDirection() {
  const node = winnerPortrait.querySelector("[data-logo-transition]");
  return node ? node.getAttribute("data-logo-transition") : null;
}

function logoPoint(radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function logoSectorPath(innerRadius, outerRadius, startDegrees, endDegrees) {
  const outerStart = logoPoint(outerRadius, startDegrees);
  const outerEnd = logoPoint(outerRadius, endDegrees);
  const innerEnd = logoPoint(innerRadius, endDegrees);
  const innerStart = logoPoint(innerRadius, startDegrees);
  const largeArc = endDegrees - startDegrees > 180 ? 1 : 0;
  if (innerRadius <= 0) {
    return [
      `M 50 50`,
      `L ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

function logoSpiralMarkup(direction = "out") {
  const rings = 4;
  const segments = 14;
  const total = rings * segments;
  const maxDelay = Math.max(
    0,
    logoTransitionDurationMs - logoTransitionPieceMs,
  );
  const serial = (logoTransitionSerial += 1);
  const defs = [];
  const pieces = [];
  for (let ring = 0; ring < rings; ring += 1) {
    const innerRadius = ring === 0 ? 0 : 7 + ring * 11;
    const outerRadius = ring === rings - 1 ? 49 : 7 + (ring + 1) * 11;
    for (let segment = 0; segment < segments; segment += 1) {
      const start = (segment * 360) / segments - 1.2;
      const end = ((segment + 1) * 360) / segments + 1.2;
      const id = `logoSpiral${serial}-${ring}-${segment}`;
      const outerFirstOrder =
        (rings - 1 - ring) * segments +
        ((segment + (rings - ring) * 2) % segments);
      const order =
        direction === "in" ? total - 1 - outerFirstOrder : outerFirstOrder;
      const delay =
        total <= 1 ? 0 : Math.round((order * maxDelay) / (total - 1));
      defs.push(
        `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${logoSectorPath(innerRadius, outerRadius, start, end)}"></path></clipPath>`,
      );
      pieces.push(
        `<image class="logo-spiral-piece" href="${brandLogoPath}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})" style="--logo-delay:${delay}ms;"></image>`,
      );
    }
  }
  return `
        <svg class="logo-spiral-logo" viewBox="0 0 100 100" role="img" aria-label="Hex Snake LOGO">
          <defs>${defs.join("")}</defs>
          ${pieces.join("")}
        </svg>
      `;
}

function escapeLogoTransitionMessage(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function logoTransitionMessageMarkup(message = "") {
  const text = String(message || "").trim();
  if (!text) return "";
  const chars = [...text];
  if (!chars.length) return "";
  const delayStep =
    chars.length <= 1
      ? 0
      : Math.max(
          1,
          Math.floor(
            (logoTransitionMessageDurationMs - 1) / (chars.length - 1),
          ),
        );
  return `<div class="logo-transition-message" data-logo-message>${chars
    .map((char, index) => {
      const displayChar =
        char === " " ? "\u00A0" : escapeLogoTransitionMessage(char);
      const delay = Math.round(index * delayStep);
      return `<span class="logo-transition-message-char" style="--logo-message-delay:${delay}ms">${displayChar}</span>`;
    })
    .join("")}</div>`;
}

function showLogoTransition(direction = "out", options = {}) {
  clearLogoTransitionTimers();
  const safeDirection = direction === "in" ? "in" : "out";
  overlay.classList.remove(
    "intro-details",
    "tutorial-open",
    ...logoTransitionClassNames(),
  );
  overlay.classList.add(
    "show",
    "is-session-modal",
    "logo-transition",
    `logo-transition-${safeDirection}`,
  );
  overlayTitle.hidden = true;
  overlayText.hidden = true;
  startButton.hidden = true;
  computerBattleButton.hidden = true;
  replayArchiveButton.hidden = true;
  introCloseButton.hidden = true;
  winnerPortrait.hidden = false;
  winnerPortrait.innerHTML = `
        <div class="logo-transition-card" data-logo-transition="${safeDirection}" aria-live="polite">
          <div class="logo-spiral-shell" aria-hidden="true">
            ${logoSpiralMarkup(safeDirection)}
          </div>
          <div class="logo-transition-aux">
            ${options.countdown ? `<div class="logo-countdown" data-logo-countdown>3</div>` : ""}
            ${logoTransitionMessageMarkup(options.message || "")}
            ${safeDirection === "in" ? `<button class="secondary logo-transition-skip" type="button" data-logo-skip>\u8df3\u904e</button>` : ""}
          </div>
        </div>
      `;
}

function playStartLogoCountdown() {
  if (isLogoTransitionActive()) return Promise.resolve(false);
  showLogoTransition("out", { countdown: true });
  const countdownEl = winnerPortrait.querySelector("[data-logo-countdown]");
  const startedAt = performance.now();
  logoCountdownTimer = setInterval(() => {
    const remaining = Math.max(
      1,
      Math.ceil(
        (logoTransitionDurationMs - (performance.now() - startedAt)) / 1000,
      ),
    );
    if (countdownEl) countdownEl.textContent = String(remaining);
  }, 120);
  return new Promise((resolve) => {
    logoTransitionTimer = setTimeout(() => {
      clearLogoTransition();
      resolve(true);
    }, logoTransitionDurationMs);
  });
}

function foodIconMarkup(typeOrId, extraClass = "") {
  const type =
    typeof typeOrId === "string" ? foodTypeById.get(typeOrId) : typeOrId;
  if (!type) return "";
  return `<span class="food-icon is-${type.id} ${extraClass}" style="--food-color:${type.color};--food-line:${type.line};" aria-hidden="true"></span>`;
}

function foodIconGroupMarkup(typeIds, label) {
  const ids = Array.isArray(typeIds) ? typeIds : [typeIds];
  const icons = ids.map((id) => foodIconMarkup(id)).join("");
  return `<span class="food-icon-group" aria-label="${label}">${icons}</span>`;
}

let tutorialSlides = [];

function buildTutorialSlides() {
  const directionKeyText = keybinds.directions.map(keyLabel).join("/");
  const smallKey = keyLabel(keybinds.smallAttack);
  const bigKey = keyLabel(keybinds.bigAttack);
  const bigFoodCost = attackFoodCost("big");
  return [
    {
      title: "六角移動",
      visual: "move",
      tag: "移動 + 虛擬搖桿區",
      lead: `目標是在 ${formatTime(maxMatchMs)} 內施展招式，把敵方 <strong>HP 歸零</strong>。`,
      sections: [
        {
          title: "移動方式",
          text: `用<strong>虛擬搖桿區</strong>或 <strong>${directionKeyText}</strong> 選六角方向；蒐集食物，逐步累積出招資源。`,
        },
        {
          title: "進食策略",
          text: `食物以簡稱搭配棋盤顏色標示；先看資源圖表判斷缺哪種庫存、能量或炸彈。HP 上限為（蛇長 + 1）× ${hpPerSnakeUnit}；吃到食物會增加 1 段蛇身並回復 ${foodHealAmount()} 點 HP；${dualFoodName}會補棋盤上顯示的兩種庫存。食物庫存與炸彈決定能不能放招式；兩邊都要顧。`,
        },
        {
          title: "控制效果",
          text: `攻擊命中身體時有 ${formatRulePercent(bodyHitStunChance)} 基礎機率暈眩，命中頭部時有 ${formatRulePercent(headHitStunChance)} 基礎機率暈眩，碳水（藍色）庫存會提高暈眩率；暈眩與麻痺會讓對手短時間無法順利走位，並中斷尚未命中的招式。`,
        },
        {
          title: "撞擊懲罰",
          text: `撞到另一方會停止 ${formatRuleSeconds(collisionStunMs)}，再減速 ${formatRuleSeconds(collisionSlowMs)}；撞到自己懲罰加倍，累積停止時間超過 ${formatRuleSeconds(maxCollisionParalysisMs)} 會落敗。`,
        },
      ],
    },
    {
      title: "資源總覽",
      visual: "resources",
      hideCopy: true,
      tag: "資源圖表 + 食物效果",
      lead: "四種自然食物與特殊食物的效果列在這裡；庫存上限已併在食物效果區塊最後面。",
      points: [
        "蛋白拉大爆炸半徑、脂肪增加傷害、纖維提高移動並縮短冷卻、碳水加快施展並提高暈眩。",
        `能量滿 ${attackNeedTotal} 點轉成炸彈，炸彈最多 ${maxAmmo} 枚，是招式的主要消耗。`,
      ],
    },
    {
      title: "招式操作",
      visual: "small",
      tag: "技能按鍵區",
      lead: "小招適合快速出手，大招適合抓準時機收尾。",
      sections: [
        {
          title: "小招操作",
          text: `按<strong>${smallKey}</strong> 或<strong>小招</strong>按鈕施放；短按棋盤也可施展小招。`,
          cost: `成本：目前最高的食物庫存 ${smallAttackFoodCost} 點，並消耗 ${smallAttackBombCost} 枚炸彈。`,
        },
        {
          title: "大招操作",
          text: `按<strong>${bigKey}</strong> 或<strong>大招</strong>按鈕施放；長按或拖曳棋盤也可施展大招。`,
          cost: `成本：${bigAttackBombCost} 枚炸彈，且蛋白、脂肪、纖維、碳水四種庫存各 ${bigFoodCost} 點。`,
        },
        {
          title: "瞄準細節",
          text: "<strong>X</strong> 控制小招目標，<strong>Y</strong> 控制大招目標，可在敵方頭部、敵方中心、離敵方最近的食物之間循環；方向型大招會改為切換施放方向，或朝拖曳方向施展。",
        },
      ],
    },
  ];
}

function refreshTutorialSlides() {
  tutorialSlides = buildTutorialSlides();
  tutorialStepIndex = Math.max(
    0,
    Math.min(tutorialSlides.length - 1, tutorialStepIndex),
  );
}

refreshTutorialSlides();
let tutorialMoveCue = null;

function tutorialCaptureCrop(type) {
  const width = canvas.width || 1;
  const height = canvas.height || 1;
  const shortSide = Math.min(width, height);
  if (type === "move") {
    return {
      x: Math.max(0, width * 0.5 - shortSide * 0.34),
      y: Math.max(0, height * 0.5 - shortSide * 0.34),
      w: Math.min(width, shortSide * 0.68),
      h: Math.min(height, shortSide * 0.68),
    };
  }
  if (type === "food") {
    return {
      x: Math.max(0, width * 0.5 - shortSide * 0.43),
      y: Math.max(0, height * 0.5 - shortSide * 0.36),
      w: Math.min(width, shortSide * 0.86),
      h: Math.min(height, shortSide * 0.62),
    };
  }
  return {
    x: Math.max(0, width * 0.5 - shortSide * 0.38),
    y: Math.max(0, height * 0.5 - shortSide * 0.38),
    w: Math.min(width, shortSide * 0.76),
    h: Math.min(height, shortSide * 0.76),
  };
}

function tutorialCropPoint(cell, type) {
  const crop = tutorialCaptureCrop(type);
  const point = HexSnakeGame.axialToPixel(cell);
  const rect = playArea.getBoundingClientRect();
  const scaleX = rect.width ? canvas.width / rect.width : 1;
  const scaleY = rect.height ? canvas.height / rect.height : 1;
  const canvasPoint = {
    x: point.x * scaleX,
    y: point.y * scaleY,
  };
  return {
    x: ((canvasPoint.x - crop.x) / crop.w) * 100,
    y: ((canvasPoint.y - crop.y) / crop.h) * 100,
  };
}

function tutorialPathPoints(type, fromCell, toCell) {
  const from = tutorialCropPoint(fromCell, type);
  const to = tutorialCropPoint(toCell, type);
  return { from, to };
}

function tutorialMoveArrowMarkup(cue) {
  const { from, to } = tutorialPathPoints("move", cue.head, cue.food);
  const start = {
    x: from.x + (to.x - from.x) * 0.42,
    y: from.y + (to.y - from.y) * 0.42,
  };
  const end = {
    x: from.x + (to.x - from.x) * 0.88,
    y: from.y + (to.y - from.y) * 0.88,
  };
  return `
        <svg class="tutorial-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="tutorialMoveArrowHead" markerWidth="7" markerHeight="7" refX="6.2" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 Z"></path>
            </marker>
          </defs>
          <line x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}"></line>
        </svg>
      `;
}

function tutorialMoveFoodCell() {
  const head = snake?.[0] || { q: 0, r: 0 };
  return HexSnakeGame.nextWrappedCell(HexSnakeGame.nextWrappedCell(head, 1), 1);
}

function tutorialCaptureUrl(type) {
  if (!canvas.width || !canvas.height) return "";
  const now = performance.now();
  const originalBlasts = blasts;
  const originalFoods = foods;
  const originalComputerSnake = computerSnake;
  const originalLastVisibleComputerSnake = lastVisibleComputerSnake;
  const originalComputerDir = computerDir;
  const originalPlayerSnake = snake;
  const originalLastVisiblePlayerSnake = lastVisiblePlayerSnake;
  const originalDir = dir;
  try {
    if (type === "move" && snake?.[0]) {
      dir = 1;
      snake = HexSnakeGame.createStartingSnake(
        { q: 0, r: 0 },
        dir,
        Math.max(3, defaultSettings.initialLength),
      );
      lastVisiblePlayerSnake = snake.map((segment) => ({ ...segment }));
      computerSnake = [];
      lastVisibleComputerSnake = [];
      blasts = [];
      const targetFood = tutorialMoveFoodCell();
      tutorialMoveCue = { head: { ...snake[0] }, food: { ...targetFood } };
      foods = [{ q: targetFood.q, r: targetFood.r, types: ["fiber"] }];
    } else {
      tutorialMoveCue = null;
    }
    if (type === "small" && computerSnake?.[0]) {
      const hitHead = { q: 0, r: 0 };
      computerDir = 2;
      computerSnake = HexSnakeGame.createStartingSnake(
        hitHead,
        computerDir,
        Math.max(4, defaultSettings.initialLength + 1),
      );
      lastVisibleComputerSnake = computerSnake.map((segment) => ({
        ...segment,
      }));
      snake = HexSnakeGame.createStartingSnake(
        { q: -2, r: 1 },
        1,
        Math.max(3, defaultSettings.initialLength),
      );
      lastVisiblePlayerSnake = snake.map((segment) => ({ ...segment }));
      foods = [];
      blasts = [
        ...blasts,
        {
          kind: "circle",
          target: { q: computerSnake[0].q, r: computerSnake[0].r },
          owner: "player",
          radius: Math.max(3.1, blastRadius(playerStock || initialStock) + 1.1),
          visualType: HexSnakeGame.attackVisualType("player", "small"),
          startedAt: now - blastDurationMs * 0.02,
          endAt: now + blastDurationMs * 0.98,
        },
      ];
    }
    draw();
    const crop = tutorialCaptureCrop(type);
    const out = document.createElement("canvas");
    const targetWidth = Math.max(1, Math.round(crop.w));
    const targetHeight = Math.max(1, Math.round(crop.h));
    out.width = targetWidth;
    out.height = targetHeight;
    const outCtx = out.getContext("2d");
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.fillStyle = "#111720";
    outCtx.fillRect(0, 0, targetWidth, targetHeight);
    outCtx.drawImage(
      canvas,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    if (type === "small") {
      const hitPoint = HexSnakeGame.axialToPixel({ q: 0, r: 0 });
      const x = hitPoint.x - crop.x;
      const y = hitPoint.y - crop.y;
      const radiusPx = cellSize * 3.35;
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      const gradient = outCtx.createRadialGradient(
        x,
        y,
        cellSize * 0.35,
        x,
        y,
        radiusPx,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.24, "rgba(251,191,36,0.82)");
      gradient.addColorStop(0.58, "rgba(249,115,22,0.44)");
      gradient.addColorStop(1, "rgba(249,115,22,0)");
      outCtx.fillStyle = gradient;
      outCtx.beginPath();
      outCtx.arc(x, y, radiusPx, 0, Math.PI * 2);
      outCtx.fill();
      outCtx.globalCompositeOperation = "source-over";
      outCtx.strokeStyle = "rgba(255,255,255,0.9)";
      outCtx.lineWidth = Math.max(3, cellSize * 0.08);
      [0.54, 0.78, 1].forEach((scale) => {
        outCtx.beginPath();
        outCtx.arc(x, y, radiusPx * scale, 0, Math.PI * 2);
        outCtx.stroke();
      });
      outCtx.strokeStyle = "rgba(251,191,36,0.95)";
      outCtx.lineWidth = Math.max(2, cellSize * 0.06);
      for (let i = 0; i < 12; i += 1) {
        const angle = (i * Math.PI * 2) / 12;
        outCtx.beginPath();
        outCtx.moveTo(
          x + Math.cos(angle) * radiusPx * 0.35,
          y + Math.sin(angle) * radiusPx * 0.35,
        );
        outCtx.lineTo(
          x + Math.cos(angle) * radiusPx * 1.12,
          y + Math.sin(angle) * radiusPx * 1.12,
        );
        outCtx.stroke();
      }
      outCtx.restore();
    }
    return out.toDataURL("image/png");
  } catch (error) {
    console.warn(`Tutorial capture failed: ${error.message}`);
    return "";
  } finally {
    blasts = originalBlasts;
    foods = originalFoods;
    computerSnake = originalComputerSnake;
    lastVisibleComputerSnake = originalLastVisibleComputerSnake;
    computerDir = originalComputerDir;
    snake = originalPlayerSnake;
    lastVisiblePlayerSnake = originalLastVisiblePlayerSnake;
    dir = originalDir;
  }
}

function tutorialAnnotations(type) {
  return "";
}

function tutorialBoardDiagramMarkup(type) {
  if (type === "move") {
    return `
          <div class="tutorial-board-diagram is-move-demo" aria-label="蛇頭往食物移動示意">
            <span class="tutorial-demo-hex is-body" style="--col:2;--row:2;"></span>
            <span class="tutorial-demo-hex is-body" style="--col:2;--row:3;"></span>
            <span class="tutorial-demo-hex is-head" style="--col:3;--row:2;">蛇頭</span>
            <span class="tutorial-demo-hex is-food" style="--col:5;--row:1;">食物</span>
            <span class="tutorial-demo-arrow" aria-hidden="true"></span>
          </div>
        `;
  }
  return `
        <div class="tutorial-board-diagram is-small-demo" aria-label="小招命中目標示意">
          <span class="tutorial-demo-hex is-player" style="--col:2;--row:3;">我方</span>
          <span class="tutorial-demo-hex is-enemy" style="--col:5;--row:2;">目標</span>
          <span class="tutorial-demo-hex is-enemy-body" style="--col:5;--row:3;"></span>
          <span class="tutorial-demo-blast" aria-hidden="true"></span>
        </div>
      `;
}

function sanitizedTutorialClone(selector) {
  const source = document.querySelector(selector);
  if (!source) return "";
  const clone = source.cloneNode(true);
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.removeAttribute("id");
  clone.querySelectorAll("button, input, select, textarea").forEach((node) => {
    node.setAttribute("tabindex", "-1");
    node.setAttribute("aria-hidden", "true");
  });
  return clone.outerHTML;
}

function tutorialSnapshotMarkup(type) {
  if (type === "move") {
    return `
          <div class="tutorial-ui-snapshot is-joystick" aria-label="虛擬搖桿區截圖">
            <div class="tutorial-snapshot-label"><strong>虛擬搖桿區</strong><span>W/E/D/X/Z/A 六方向</span></div>
            <div class="tutorial-snapshot-frame">${sanitizedTutorialClone("#joyZone")}</div>
          </div>
        `;
  }
  if (type === "resources") {
    return `
          <div class="tutorial-ui-snapshot is-resources" aria-label="資源圖表截圖">
            <div class="tutorial-snapshot-label"><strong>資源圖表</strong><span>庫存、能量、炸彈</span></div>
            <div class="tutorial-snapshot-frame">${sanitizedTutorialClone("#resourceBoard")}</div>
          </div>
        `;
  }
  return `
        <div class="tutorial-ui-snapshot is-skills" aria-label="技能按鍵區截圖">
          <div class="tutorial-snapshot-label"><strong>技能按鍵區</strong><span>X / Y 選目標，小招 / 大招施放</span></div>
          <div class="tutorial-snapshot-frame">${sanitizedTutorialClone(".attack-actions")}</div>
        </div>
      `;
}

function tutorialFoodDetailListMarkup() {
  const naturalFoodItems = foodTypes
    .map(
      (type) => `
            <li>
              ${foodIconGroupMarkup(type.id, `自然產出${foodNameWithColor(type)}`)}
              <span>${foodTermMarkup(type.id, foodNameWithColor(type))}：${formatRichText(foodEffectDescription(type))}</span>
            </li>
          `,
    )
    .join("");
  return `
          <ul class="tutorial-food-detail-list" aria-label="食物效果細節">
            ${naturalFoodItems}
            <li>
              ${foodIconGroupMarkup(
                foodTypes.map((type) => type.id),
                dualFoodName,
              )}
              <span>${foodTermMarkup("dual", dualFoodName)}：${formatRichText(`補棋盤上顯示的兩種庫存各 ${dualColorStockGain} 點，並獲得 ${foodEnergy} 點能量。`)}</span>
            </li>
            <li>
              ${foodIconGroupMarkup("black", foodNameWithColor(blackFoodType))}
              <span>${foodTermMarkup("black", foodNameWithColor(blackFoodType))}：${formatRichText(`${foodEffectDescription(blackFoodType)}不會自然產出。`)}</span>
            </li>
          </ul>
        `;
}

function tutorialResourceGuideMarkup() {
  return `
        <div class="tutorial-resource-guide" aria-label="資源說明">
          <div class="tutorial-resource-guide-panel is-food-detail-panel">
            <strong>食物效果</strong>
            ${tutorialFoodDetailListMarkup()}
            <span class="tutorial-food-stock-limit">${formatRichText(`單一食物補同名庫存 ${singleColorStockGain} 點；每種食物庫存最多 ${maxFoodStock} 點。`)}</span>
          </div>
          <div class="tutorial-resource-guide-panel">
            <strong>能量與炸彈</strong>
            <span>${formatRichText(`吃食物會累積能量；能量滿 ${attackNeedTotal} 點轉成炸彈，炸彈最多 ${maxAmmo} 枚。能量與炸彈都滿時，施放消耗炸彈的招式會立刻把滿能量轉為 1 枚炸彈。`)}</span>
          </div>
        </div>
      `;
}

function tutorialVisualMarkup(slide) {
  if (slide.visual === "resources") {
    return `
          <figure class="tutorial-visual is-resource-guide" aria-label="${slide.title}資源說明">
            ${tutorialSnapshotMarkup(slide.visual)}
            ${tutorialResourceGuideMarkup()}
          </figure>
        `;
  }
  const captureUrl = tutorialCaptureUrl(slide.visual);
  const snapshot = tutorialSnapshotMarkup(slide.visual);
  const capture = `
        <div class="tutorial-capture-stage">
          ${captureUrl ? `<img src="${captureUrl}" alt="">` : ""}
          ${tutorialAnnotations(slide.visual)}
        </div>
      `;
  return `
        <figure class="tutorial-visual is-capture is-${slide.visual}" aria-label="${slide.title}高清遊戲畫面裁切">
          ${slide.visual === "move" ? `${snapshot}${capture}` : `${capture}${snapshot}`}
        </figure>
      `;
}

function renderTutorialSlide() {
  refreshTutorialSlides();
  const slide = tutorialSlides[tutorialStepIndex] || tutorialSlides[0];
  winnerPortrait.hidden = false;
  winnerPortrait.innerHTML = `
        <div class="tutorial-card" role="group" tabindex="0" aria-label="新手教學 ${tutorialStepIndex + 1} / ${tutorialSlides.length}">
            <div class="tutorial-progress">${tutorialSlides.map((_, index) => `<span class="${index === tutorialStepIndex ? "is-active" : ""}"></span>`).join("")}</div>
          ${tutorialVisualMarkup(slide)}
          ${
            slide.hideCopy
              ? ""
              : `<div class="tutorial-copy">
            <strong class="tutorial-title">${formatRichText(slide.title)}</strong>
            <p class="tutorial-lead">${formatRichText(slide.lead)}</p>
            ${
              slide.sections
                ? `
              ${slide.sections
                .map(
                  (section) => `
                <p class="tutorial-line">
                  <b>${formatRichText(section.title)}</b>
                  <span>${formatRichText(section.text)}</span>
                  ${section.cost ? `<small>${formatRichText(section.cost)}</small>` : ""}
                </p>
              `,
                )
                .join("")}
            `
                : `
              ${slide.points.map((point) => `<p class="tutorial-line"><span>${formatRichText(point)}</span></p>`).join("")}
              ${slide.note ? `<p class="tutorial-line tutorial-note"><span>${formatRichText(slide.note)}</span></p>` : ""}
            `
            }
          </div>`
          }
          <div class="tutorial-actions">
            <button class="secondary" type="button" data-tutorial-action="skip">Skip</button>
            <button class="secondary" type="button" data-tutorial-action="prev" ${tutorialStepIndex === 0 ? "disabled" : ""}>上一頁</button>
            <button type="button" data-tutorial-action="${tutorialStepIndex === tutorialSlides.length - 1 ? "done" : "next"}">${tutorialStepIndex === tutorialSlides.length - 1 ? "完成" : "下一頁"}</button>
          </div>
        </div>
      `;
  winnerPortrait.querySelector(".tutorial-card")?.focus();
}

function setTutorialChrome() {
  overlay.classList.remove("intro-details");
  overlay.classList.remove("is-session-modal");
  overlay.classList.add("tutorial-open");
  overlayTitle.hidden = true;
  overlayText.hidden = true;
  startButton.hidden = true;
  computerBattleButton.hidden = true;
  replayArchiveButton.hidden = true;
  introCloseButton.hidden = true;
}

function showTutorial(startIndex = 0) {
  if (!rulesModal.hidden) closeRulesModal();
  refreshTutorialSlides();
  tutorialStepIndex = Math.max(
    0,
    Math.min(tutorialSlides.length - 1, startIndex),
  );
  setTutorialChrome();
  overlay.classList.add("show");
  characterStage.hidden = true;
  setCharacterStageOverlayMode(false);
  renderTutorialSlide();
}

function finishTutorial(markSeen = true) {
  if (markSeen) HexSnakeStorage.set(tutorialSeenKey, "1");
  overlay.classList.remove("tutorial-open");
  renderIntroPortraits(false);
  overlay.classList.add("show");
}

function shouldShowTutorial() {
  return HexSnakeStorage.get(tutorialSeenKey) !== "1";
}

function isTutorialOpen() {
  return (
    overlay.classList.contains("show") &&
    overlay.classList.contains("tutorial-open")
  );
}

function moveTutorial(delta) {
  const nextIndex = Math.max(
    0,
    Math.min(tutorialSlides.length - 1, tutorialStepIndex + delta),
  );
  if (nextIndex === tutorialStepIndex) return false;
  tutorialStepIndex = nextIndex;
  renderTutorialSlide();
  return true;
}

function weightedFoodIconMarkup(character) {
  if (character?.specialFood === "black") {
    return foodIconGroupMarkup(
      "black",
      `加權產出${foodNameWithColor(blackFoodType)}`,
    );
  }
  if (character?.food === "balanced") {
    return foodIconGroupMarkup(
      foodTypes.map((type) => type.id),
      `均衡產出四種食物，並可能補出${dualFoodName}`,
    );
  }
  const type = foodTypeById.get(character?.food);
  return foodIconGroupMarkup(
    character?.food,
    `加權產出${type ? foodNameWithColor(type) : character.foodLabel}`,
  );
}

function characterFoodLabelForRules(character) {
  if (character?.specialFood === "black")
    return foodNameWithColor(blackFoodType);
  if (character?.food === "balanced")
    return `${foodLabels.balanced}／${dualFoodName}`;
  const type = foodTypeById.get(character?.food);
  return type
    ? foodNameWithColor(type)
    : character?.foodLabel || foodLabels.balanced;
}

function buildRulesContent() {
  const characterLegend = characters
    .map((character) => {
      const guide = moveGuideFor(character);
      return `
          <li style="${characterStyle(character)}">
            <span class="rules-character-avatar" aria-hidden="true">
              <img
                src="${avatarUrl(character, "sm")}"
                srcset="${avatarSrcset(character)}"
                sizes="58px"
                alt=""
                decoding="async"
                loading="lazy"
                data-character-id="${character.id}"
                data-portrait-variant="${portraitVariantMode}"
              >
            </span>
            <span class="rules-character-body">
              <span class="rules-character-title">
                <b>${character.name}</b>
                <span class="rules-character-role">${formatRichText(characterFoodLabelForRules(character))}專精</span>
              </span>
              <span class="rule-move-line"><b>角色大招：</b>${formatRichText(guide.big)}</span>
              <span class="rule-move-line"><b>實戰重點：</b>${formatRichText(guide.tip)}</span>
              <span class="rule-food-effect"><b>食補效果：</b>${weightedFoodIconMarkup(character)}<span>${formatRichText(character.detail)}</span></span>
            </span>
          </li>
        `;
    })
    .join("");
  rulesContent.innerHTML = `
        <section class="rules-block rules-tutorial-callout" data-open-tutorial role="button" tabindex="0" aria-label="開啟基礎規則教學">
          <h3>基礎規則教學</h3>
          <p>${formatRichText("想先用圖片快速看懂最新的進食策略、移動、資源與招式操作，可以點擊這裡重新開啟教學頁。")}</p>
        </section>
        <section class="rules-block">
          <h3>進階對戰</h3>
          <ul class="rules-list">
            <li><b>按鍵自訂</b>：${formatRichText("小招、大招、暫停、投降與六方向鍵都可在開局設定中修改；若方向鍵與 X / Y 目標鍵相同，X / Y 目標鍵會優先作用。")}</li>
            <li><b>開局設定</b>：${formatRichText(`一般對戰使用預設蛇長 ${defaultSettings.initialLength}、速度 ${defaultSettings.initialSpeed}x；開局前可選擇角色、電腦難度與自動對戰。`)}</li>
          </ul>
        </section>
        <section class="rules-block">
          <h3>角色大招</h3>
          <ul class="rules-character-list">
            ${characterLegend}
          </ul>
        </section>
        <section class="rules-block rules-about-me" aria-labelledby="rulesAboutTitle">
          <div class="rules-about-heading">
            <img class="rules-about-logo" src="${brandLogoPath}" alt="" decoding="async" loading="lazy">
            <div class="rules-about-copy">
              <h3 id="rulesAboutTitle">About Me</h3>
              <strong class="rules-about-name">Chang Wei Lin</strong>
            </div>
          </div>
          <p class="rules-about-line">我愛星空至深，無懼黑夜。</p>
          <blockquote class="rules-about-quote">
            <p>We have loved the stars too fondly to fear the dark.</p>
            <cite>— &lt;The Old Astronomer&gt; Sarah Williams</cite>
          </blockquote>
          <div class="rules-about-links" aria-label="About Me links">
            <a class="rules-about-link" href="https://github.com/changweilin" target="_blank" rel="noopener noreferrer" aria-label="Chang Wei Lin GitHub">
              <span class="rules-about-icon" aria-hidden="true">GH</span>
              <span>GitHub</span>
            </a>
            <a class="rules-about-link" href="https://www.linkedin.com/in/wei-lin-chang-ba38049a/" target="_blank" rel="noopener noreferrer" aria-label="Chang Wei Lin LinkedIn">
              <span class="rules-about-icon" aria-hidden="true">in</span>
              <span>LinkedIn</span>
            </a>
            <a class="rules-about-link" href="https://changweilin.github.io/demo_link/" target="_blank" rel="noopener noreferrer" aria-label="Chang Wei Lin demo link">
              <span class="rules-about-icon" aria-hidden="true">D</span>
              <span>Demo</span>
            </a>
          </div>
        </section>
      `;
}

function openRulesModal() {
  HexSnakeGame.setSettingsOpen(false);
  HexSnakeGame.setGmOpen(false);
  rulesModal.hidden = false;
  rulesButton.setAttribute("aria-expanded", "true");
  rulesCloseButton.focus();
}

function closeRulesModal() {
  rulesModal.hidden = true;
  rulesButton.setAttribute("aria-expanded", "false");
  rulesButton.focus();
}

function setResultShareStatus(text = "", state = "") {
  shareResultStatus.textContent = text;
  shareResultStatus.hidden = !text;
  resultSharePanel.hidden = !text;
  if (state) shareResultStatus.dataset.state = state;
  else delete shareResultStatus.dataset.state;
}

function updateResultSharePanel() {
  const replayMode = typeof HexSnakeReplay !== "undefined" && HexSnakeReplay.isPlaybackMode();
  const visible = Boolean(lastResultShareData) && gameOver && !replayMode && !overlayTitle.hidden;
  overlayText.classList.toggle("is-copyable-result", visible && !resultShareInProgress);
  if (visible) {
    overlayText.setAttribute("role", "button");
    overlayText.setAttribute("tabindex", "0");
    overlayText.setAttribute("title", "點擊複製對戰結果");
    overlayText.setAttribute("aria-label", `${overlayText.textContent.trim()}。點擊複製對戰結果。`);
  } else {
    overlayText.classList.remove("is-copyable-result");
    overlayText.removeAttribute("role");
    overlayText.removeAttribute("tabindex");
    overlayText.removeAttribute("title");
    overlayText.removeAttribute("aria-label");
    setResultShareStatus("");
  }
}

function setLastResultShareData(data) {
  lastResultShareData = data || null;
  if (!lastResultShareData) setResultShareStatus("");
  updateResultSharePanel();
}

function setOverlayChromeVisible(visible) {
  overlay.classList.remove(
    "intro-details",
    "tutorial-open",
    "is-session-modal",
    ...logoTransitionClassNames(),
  );
  overlayTitle.hidden = !visible;
  overlayText.hidden = !visible;
  startButton.hidden = !visible;
  computerBattleButton.hidden = !visible || (running && !gameOver);
  replayArchiveButton.hidden = !visible;
  introCloseButton.hidden = true;
  updateResultSharePanel();
}

function setIntroLobbyChrome() {
  overlay.classList.remove(
    "intro-details",
    "tutorial-open",
    ...logoTransitionClassNames(),
  );
  overlay.classList.add("is-session-modal");
  overlayTitle.hidden = true;
  overlayText.hidden = true;
  startButton.hidden = false;
  computerBattleButton.hidden = false;
  replayArchiveButton.hidden = false;
  introCloseButton.hidden = true;
  startButton.textContent = "開始";
  updateResultSharePanel();
}

function setIntroDetailsChrome() {
  overlay.classList.add("intro-details");
  overlay.classList.remove(
    "tutorial-open",
    "is-session-modal",
    ...logoTransitionClassNames(),
  );
  overlayTitle.hidden = true;
  overlayText.hidden = true;
  startButton.hidden = true;
  computerBattleButton.hidden = true;
  replayArchiveButton.hidden = true;
  introCloseButton.hidden = false;
  updateResultSharePanel();
}

function setCharacterStageOverlayMode(active) {
  characterStage.classList.toggle("is-overlay-visible", Boolean(active));
}

function buildCharacterStage(options = {}) {
  characterStage.innerHTML = ["player", "computer"]
    .map((owner) => {
      const character = options.startLogoCharacters
        ? startLogoCharacterFor(owner)
        : characterFor(owner);
      const holdHint = owner === "player" ? ' title="長按施放攻擊"' : "";
      return `
          <div class="fighter-card" data-owner="${owner}" style="${characterStyle(character, owner)}">
            <div class="fighter-module ${owner === "player" ? "is-actionable" : ""}" data-module="${owner}" data-owner-mark="${ownerMeta(owner).mark}"${holdHint}>
              <div class="fighter-module-clip">
                ${fighterPortraitImage(character, "idle")}
              </div>
            </div>
            <div class="attack-callout" data-attack-callout="${owner}" aria-live="polite"></div>
          </div>
        `;
    })
    .join("");
}

function showCharacterStage(options = {}) {
  if (options.rebuild !== false || !characterStage.innerHTML) {
    buildCharacterStage(options);
  }
  characterStage.hidden = false;
  setCharacterStageOverlayMode(options.overlay);
}

function hideCharacterStage() {
  characterStage.hidden = true;
  setCharacterStageOverlayMode(false);
}

function renderWinnerPortrait(owner, playerLost = false, computerLost = false) {
  setOverlayChromeVisible(true);
  if (!owner && !playerLost && !computerLost) {
    winnerPortrait.hidden = true;
    winnerPortrait.innerHTML = "";
    characterStage.hidden = false;
    setCharacterStageOverlayMode(false);
    return;
  }
  const playerPose = owner === "player" ? "victory" : "defeat";
  const computerPose = owner === "computer" ? "victory" : "defeat";
  const playerCharacter = characterFor("player");
  const computerCharacter = characterFor("computer");
  const playerResult = owner
    ? owner === "player"
      ? "P1 勝利"
      : "P1 敗北"
    : "P1 平手";
  const computerResult = owner
    ? owner === "computer"
      ? "P2 勝利"
      : "P2 敗北"
    : "P2 平手";
  overlay.classList.add("is-session-modal");
  winnerPortrait.hidden = false;
  hideCharacterStage();
  winnerPortrait.innerHTML = `
        <div class="portrait-pair result-pair">
          <div class="result-entry ${owner === "player" ? "is-winner" : ""} ${playerPose === "defeat" ? "is-defeated" : ""}" data-owner="player" data-result-owner="player" title="選擇 P1 角色" style="${characterStyle(playerCharacter, "player")}">
            <div class="fighter-portrait result-portrait ${owner === "player" ? "is-winner" : ""} ${playerPose === "defeat" ? "is-defeated" : ""}" data-owner="player" data-owner-mark="${ownerMeta("player").mark}">
              <span class="result-badge">${playerResult}</span>
              ${fighterArt(playerCharacter, playerPose, true)}
            </div>
            <span class="result-quote">「${resultLineForCharacter(playerCharacter, playerPose)}」</span>
          </div>
          <div class="result-entry ${owner === "computer" ? "is-winner" : ""} ${computerPose === "defeat" ? "is-defeated" : ""}" data-owner="computer" data-result-owner="computer" title="選擇 P2 角色" style="${characterStyle(computerCharacter, "computer")}">
            <div class="fighter-portrait result-portrait ${owner === "computer" ? "is-winner" : ""} ${computerPose === "defeat" ? "is-defeated" : ""}" data-owner="computer" data-owner-mark="${ownerMeta("computer").mark}">
              <span class="result-badge">${computerResult}</span>
              ${fighterArt(computerCharacter, computerPose, true)}
            </div>
            <span class="result-quote">「${resultLineForCharacter(computerCharacter, computerPose)}」</span>
          </div>
        </div>
      `;
}

function renderIntroPortraits(showDetails = introDetailsOpen) {
  introDetailsOpen = showDetails;
  if (showDetails) setIntroDetailsChrome();
  else setIntroLobbyChrome();
  const selectedCharacter = selectedCharacterFor(selectedPortraitOwner);
  winnerPortrait.hidden = false;
  hideCharacterStage();
  characterStage.innerHTML = "";
  if (!showDetails) {
    winnerPortrait.innerHTML = `
          <div class="intro-avatar-gate">
            ${["player", "computer"]
              .map((owner) => {
                const character = selectedCharacterFor(owner);
                const isRandomChoice = isRandomCharacterChoice(owner);
                const logoCharacter = isRandomChoice
                  ? null
                  : startLogoCharacterFor(owner);
                const label = owner === "player" ? "P1" : "P2";
                const motto = character?.motto || "機緣一轉，百人角色待君擇。\n心念既定，千道關卡隨我闖。";
                return `
                <div class="intro-avatar-button" role="button" tabindex="0" data-owner="${owner}" data-open-intro="${owner}" style="${characterStyle(
                  character || {
                    color: ownerMeta(owner).color,
                    line: ownerMeta(owner).line,
                    accent: "#fbbf24",
                  },
                  owner,
                )}" aria-label="開啟${label}角色選擇">
                  <div class="portrait-card-controls" data-portrait-swipe-owner="${owner}">
                    ${character ? `<div class="fighter-portrait" data-owner="${owner}" data-owner-mark="${ownerMeta(owner).mark}">${fighterArt(character, "intro", true, "small")}</div>` : randomPortraitMarkup(owner)}
                  </div>
                  <div class="portrait-label-controls intro-avatar-label-controls">
                    <button class="secondary portrait-arrow portrait-label-arrow" type="button" data-portrait-owner="${owner}" data-portrait-shift="-1" aria-label="${ownerMeta(owner).label} 上一位">‹</button>
                    <span class="intro-avatar-label"><span class="owner-name ${owner === "player" ? "is-p1" : "is-p2"}">${ownerMeta(owner).label}</span> · ${character ? character.name : "隨機選擇"}</span>
                    <button class="secondary portrait-arrow portrait-label-arrow" type="button" data-portrait-owner="${owner}" data-portrait-shift="1" aria-label="${ownerMeta(owner).label} 下一位">›</button>
                  </div>
                  <p class="intro-avatar-motto ${character ? "" : "is-placeholder"}">${formatIntroMotto(motto)}</p>
                  ${
                    isRandomChoice
                      ? `<span class="intro-avatar-logo" aria-hidden="true"><span class="random-portrait-mark intro-avatar-logo-mark">?</span></span>`
                      : `<span class="intro-avatar-logo" aria-hidden="true"><img src="${avatarUrl(logoCharacter, "sm")}" srcset="${avatarSrcset(logoCharacter)}" sizes="52px" alt="${logoCharacter.name} 頭像" decoding="async" loading="lazy"></span>`
                  }
                </div>
              `;
              })
              .join("")}
          </div>
        `;
    return;
  }
  winnerPortrait.innerHTML = `
        <div class="portrait-select" data-portrait-select>
          <div class="portrait-pair">
          ${["player", "computer"]
            .map((owner) => {
              const character = selectedCharacterFor(owner);
              const label = owner === "player" ? "P1" : "P2";
              return `
                <div class="portrait-option ${owner === selectedPortraitOwner ? "is-selected" : ""}" role="button" tabindex="0" data-owner="${owner}" data-portrait-owner="${owner}" style="${characterStyle(
                  character || {
                    color: ownerMeta(owner).color,
                    line: ownerMeta(owner).line,
                    accent: "#fbbf24",
                  },
                  owner,
                )}">
                <div class="portrait-card-controls" data-portrait-swipe-owner="${owner}">
                  ${character ? `<div class="fighter-portrait" data-owner="${owner}" data-owner-mark="${ownerMeta(owner).mark}" data-full-portrait="${owner}">${fighterArt(character, "intro", true, "small")}</div>` : randomPortraitMarkup(owner)}
                </div>
                <div class="portrait-label-controls">
                  <button class="secondary portrait-arrow portrait-label-arrow" type="button" data-portrait-owner="${owner}" data-portrait-shift="-1" aria-label="${ownerMeta(owner).label} 上一位">‹</button>
                  <span class="portrait-option-label"><span class="owner-name ${owner === "player" ? "is-p1" : "is-p2"}">${ownerMeta(owner).label}</span> · ${character ? character.name : "隨機選擇"}</span>
                  <button class="secondary portrait-arrow portrait-label-arrow" type="button" data-portrait-owner="${owner}" data-portrait-shift="1" aria-label="${ownerMeta(owner).label} 下一位">›</button>
                </div>
              </div>
            `;
            })
            .join("")}
          </div>
          <div class="portrait-controls">
            <button class="secondary portrait-arrow" type="button" data-portrait-shift="-1" aria-label="上一位" onclick="applySelectedPortraitCharacter(-1)">‹</button>
            <div class="portrait-copy" style="${characterStyle(
              selectedCharacter || {
                color: ownerMeta(selectedPortraitOwner).color,
                line: ownerMeta(selectedPortraitOwner).line,
                accent: "#fbbf24",
              },
              selectedPortraitOwner,
            )}">
              <small><span class="owner-name ${selectedPortraitOwner === "player" ? "is-p1" : "is-p2"}">${selectedPortraitOwner === "player" ? "P1" : "P2"}</span> 角色</small>
              <strong>${selectedCharacter ? selectedCharacter.name : "隨機選擇"}</strong>
              <span>${selectedCharacter ? `${selectedCharacter.foodLabel}專精` : "開始遊戲時抽選角色"}</span>
              <div class="portrait-story">
                ${selectedCharacter ? characterStoryMarkup(selectedCharacter) : ""}
              </div>
            </div>
            <button class="secondary portrait-arrow" type="button" data-portrait-shift="1" aria-label="下一位" onclick="applySelectedPortraitCharacter(1)">›</button>
          </div>
        </div>
      `;
}

function selectPortraitOwner(owner) {
  selectedPortraitOwner = owner === "computer" ? "computer" : "player";
  renderIntroPortraits(true);
}

function setPortraitCharacterForOwner(
  owner,
  characterId,
  showDetails = introDetailsOpen,
) {
  if (
    characterId !== randomCharacterChoiceId &&
    !characterById.has(characterId)
  )
    return;
  selectedPortraitOwner = owner === "computer" ? "computer" : "player";
  if (selectedPortraitOwner === "player") {
    playerCharacterChoice = characterId;
    if (characterId === randomCharacterChoiceId) {
      ensureStartLogoRandomCharacterId(selectedPortraitOwner);
    } else {
      playerCharacterId = characterId;
      clearStartLogoRandomCharacterId(selectedPortraitOwner);
    }
  } else {
    computerCharacterChoice = characterId;
    if (characterId === randomCharacterChoiceId) {
      ensureStartLogoRandomCharacterId(selectedPortraitOwner);
    } else {
      computerCharacterId = characterId;
      clearStartLogoRandomCharacterId(selectedPortraitOwner);
    }
  }
  HexSnakeGame.syncCharacterInputs();
  HexSnakeGame.saveCharacterChoices();
  if (characterId !== randomCharacterChoiceId)
    preloadPortraitsFor(selectedPortraitOwner);
  renderIntroPortraits(showDetails);
  HexSnakeGame.resize();
  if (characterId !== randomCharacterChoiceId) {
    HexSnakeAudio.playCharacter(owner, "select", {
      character: characterById.get(characterId),
      unlock: true,
    });
  }
}

function setSelectedPortraitCharacter(characterId) {
  setPortraitCharacterForOwner(selectedPortraitOwner, characterId);
}

function applyPortraitCharacter(owner, delta, showDetails = introDetailsOpen) {
  const safeOwner = owner === "computer" ? "computer" : "player";
  const currentId = characterChoiceFor(safeOwner);
  const choices = [
    randomCharacterChoiceId,
    ...characters.map((character) => character.id),
  ];
  const currentIndex = Math.max(0, choices.indexOf(currentId));
  const nextChoice =
    choices[(currentIndex + delta + choices.length) % choices.length];
  setPortraitCharacterForOwner(safeOwner, nextChoice, showDetails);
}

function applySelectedPortraitCharacter(delta) {
  applyPortraitCharacter(selectedPortraitOwner, delta);
}

function renderPortraitLightbox() {
  const character = characterFor(portraitLightboxOwner);
  portraitLightboxImage.src = portraitUrl(character, "intro", "md");
  portraitLightboxImage.srcset = portraitSrcset(character, "intro");
  portraitLightboxImage.sizes = portraitSizesAttribute("full");
  portraitLightboxImage.alt = character.name;
  portraitLightboxImage.dataset.characterId = character.id;
  portraitLightboxImage.dataset.portraitVariant = portraitVariantMode;
  portraitLightboxCaption.textContent = `${ownerMeta(portraitLightboxOwner).label} / ${character.name} / ${portraitVariantLabels[portraitVariantMode] || portraitVariantMode}`;
  updatePortraitVariantButtons();
}

function updatePortraitVariantButtons() {
  const currentIndex = portraitVariantModes.indexOf(portraitVariantMode);
  portraitLightboxVariantButtons.forEach((button) => {
    const delta = button.dataset.portraitLightboxDirection === "up" ? -1 : 1;
    const nextMode =
      portraitVariantModes[
        (currentIndex + delta + portraitVariantModes.length) %
          portraitVariantModes.length
      ];
    button.textContent = `${delta < 0 ? "↑" : "↓"} ${portraitVariantLabels[nextMode] || nextMode}`;
    button.setAttribute(
      "aria-label",
      `${delta < 0 ? "Previous" : "Next"} portrait version: ${portraitVariantLabels[nextMode] || nextMode}`,
    );
  });
}

function rerenderPortraitSurfaces() {
  if (isLogoTransitionActive()) return;
  if (!characterStage.hidden) buildCharacterStage();
  if (!portraitLightbox.hidden) renderPortraitLightbox();
  if (overlay.classList.contains("show") && !winnerPortrait.hidden) {
    const resultPortraits = winnerPortrait.querySelectorAll(
      "[data-result-owner]",
    );
    if (resultPortraits.length) {
      const playerResult = winnerPortrait.querySelector(
        '[data-result-owner="player"]',
      );
      const computerResult = winnerPortrait.querySelector(
        '[data-result-owner="computer"]',
      );
      const winner =
        winnerPortrait.querySelector(".result-entry.is-winner")?.dataset
          .resultOwner || null;
      renderWinnerPortrait(
        winner,
        playerResult?.classList.contains("is-defeated"),
        computerResult?.classList.contains("is-defeated"),
      );
    } else {
      renderIntroPortraits(introDetailsOpen);
    }
  }
}

function setPortraitVariantMode(mode) {
  const nextMode =
    mode === "full"
      ? "human"
      : portraitVariantModes.includes(mode)
        ? mode
        : defaultPortraitVariantMode;
  if (portraitVariantMode === nextMode) return;
  portraitVariantMode = nextMode;
  HexSnakeStorage.set("hexSnakePortraitVariant", portraitVariantMode);
  rerenderPortraitSurfaces();
  preloadPortraitsFor("player");
  preloadPortraitsFor("computer");
}

function togglePortraitVariantMode() {
  shiftPortraitVariantMode(1);
}

function shiftPortraitVariantMode(delta) {
  const currentIndex = Math.max(
    0,
    portraitVariantModes.indexOf(portraitVariantMode),
  );
  setPortraitVariantMode(
    portraitVariantModes[
      (currentIndex + delta + portraitVariantModes.length) %
        portraitVariantModes.length
    ],
  );
}

function openPortraitLightbox(owner) {
  portraitLightboxOwner = owner === "computer" ? "computer" : "player";
  selectedPortraitOwner = portraitLightboxOwner;
  renderPortraitLightbox();
  portraitLightbox.hidden = false;
}

function shiftPortraitLightbox(delta) {
  selectedPortraitOwner = portraitLightboxOwner;
  const choices = characters.map((character) => character.id);
  const currentId = characterFor(selectedPortraitOwner).id;
  const currentIndex = Math.max(0, choices.indexOf(currentId));
  const nextChoice =
    choices[(currentIndex + delta + choices.length) % choices.length];
  setSelectedPortraitCharacter(nextChoice);
  renderPortraitLightbox();
}

function closePortraitLightbox() {
  portraitLightbox.hidden = true;
  portraitLightboxImage.removeAttribute("src");
  portraitLightboxImage.removeAttribute("srcset");
  portraitLightboxImage.removeAttribute("sizes");
  portraitLightboxImage.alt = "";
  delete portraitLightboxImage.dataset.characterId;
  delete portraitLightboxImage.dataset.portraitVariant;
  portraitLightboxCaption.textContent = "";
}

function resultLineForCharacter(character, pose) {
  return (
    character?.resultLines?.[pose] || (pose === "victory" ? "輕鬆~" : "不可能!")
  );
}

function setFighterPose(owner, pose, duration = 0) {
  const module = characterStage.querySelector(`[data-module="${owner}"]`);
  if (!module) return;
  const character = characterFor(owner);
  updateFighterPortraitImage(module, character, pose);
  clearTimeout(portraitPoseTimers[owner]);
  if (duration > 0) {
    portraitPoseTimers[owner] = setTimeout(() => {
      if (!gameOver) setFighterPose(owner, "idle");
    }, duration);
  }
}

function showFighterCallout(owner, text, options = {}) {
  const callout = characterStage.querySelector(
    `[data-attack-callout="${owner}"]`,
  );
  if (!callout || !text) return;
  const kind = options.kind || "attack";
  const duration = options.duration ?? 1200;
  const locked = options.locked || duration === null;
  if (lockedFighterCallouts.has(owner) && !locked && !options.force) return;
  callout.textContent = text;
  callout.classList.remove(
    "is-attack",
    "is-status",
    "is-interrupt",
    "is-victory",
    "is-defeat",
  );
  callout.classList.add(`is-${kind}`);
  callout.classList.add("is-visible");
  clearTimeout(attackCalloutTimers[owner]);
  if (locked) {
    lockedFighterCallouts.add(owner);
    return;
  }
  lockedFighterCallouts.delete(owner);
  attackCalloutTimers[owner] = setTimeout(() => {
    if (lockedFighterCallouts.has(owner)) return;
    callout.classList.remove(
      "is-visible",
      "is-attack",
      "is-status",
      "is-interrupt",
      "is-victory",
      "is-defeat",
    );
  }, duration);
}

function showAttackCallout(owner, profile) {
  const character = characterFor(owner);
  showFighterCallout(
    owner,
    profile === "small" ? character.smallMove : character.bigMove,
  );
}

function statusCalloutText(text) {
  return String(text || "")
    .split(/[！!]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) =>
      item.startsWith("(") && item.endsWith(")") ? item : `(${item})`,
    )
    .join("");
}

function showStatusCallout(owner, text, options = {}) {
  showFighterCallout(owner, statusCalloutText(text), {
    kind: options.interrupted ? "interrupt" : "status",
    duration: options.duration ?? 1350,
  });
}

function showResultCallout(owner, pose) {
  showFighterCallout(owner, resultLineForCharacter(characterFor(owner), pose), {
    kind: pose === "victory" ? "victory" : "defeat",
    duration: null,
    locked: true,
  });
}

function buildResourceHud() {
  resourceBoard.innerHTML = "";
  resourceEls = new Map();
  [
    { owner: "player", title: "P1", color: colors.head },
    { owner: "computer", title: "P2", color: colors.computerHead },
  ].forEach((group) => {
    const panel = document.createElement("div");
    panel.className = "resource-panel";
    panel.dataset.owner = group.owner;
    panel.innerHTML = `
          <div class="resource-title">
            <span class="resource-owner"><span class="owner-name ${group.owner === "player" ? "is-p1" : "is-p2"}">${group.title}</span></span>
            <span class="resource-counters" data-total="${group.owner}">
              <span class="resource-chip" data-resource="energy" data-energy-chip="${group.owner}" title="能量">
                <span class="resource-icon energy-icon" aria-hidden="true"></span>
                <span class="resource-chip-track" data-energy-track="${group.owner}" role="meter" aria-label="能量" aria-valuemin="0">
                  <span class="resource-chip-fill" data-energy-fill="${group.owner}"></span>
                </span>
                <span class="resource-chip-value" data-energy-value="${group.owner}">0/0</span>
              </span>
              <span class="resource-chip" data-resource="bomb" data-bomb-chip="${group.owner}" title="炸彈">
                <span class="resource-icon missile-icon" aria-hidden="true"></span>
                <span class="resource-chip-track" data-bomb-track="${group.owner}" role="meter" aria-label="炸彈" aria-valuemin="0">
                  <span class="resource-chip-fill" data-bomb-fill="${group.owner}"></span>
                </span>
                <span class="resource-chip-value" data-bomb-value="${group.owner}">0/0</span>
              </span>
            </span>
          </div>
        `;
    foodTypes.forEach((type) => {
      const row = document.createElement("div");
      row.className = "resource-row";
      row.style.setProperty("--food-color", type.color);
      row.style.setProperty("--food-line", type.line);
      row.innerHTML = `
            <span class="resource-label">${type.label}</span>
            <span class="resource-track"><span class="resource-fill" data-fill="${group.owner}-${type.id}"></span></span>
            <span class="resource-count" data-count="${group.owner}-${type.id}">0</span>
          `;
      panel.append(row);
    });
    resourceBoard.append(panel);
  });
  resourceBoard.querySelectorAll("[data-count], [data-fill]").forEach((el) => {
    if (el.dataset.count) resourceEls.set(`${el.dataset.count}-count`, el);
    if (el.dataset.fill) resourceEls.set(`${el.dataset.fill}-fill`, el);
  });
  resourceBoard
    .querySelectorAll(
      "[data-energy-chip], [data-energy-track], [data-energy-fill], [data-energy-value], [data-bomb-chip], [data-bomb-track], [data-bomb-fill], [data-bomb-value]",
    )
    .forEach((el) => {
      const entry = Object.entries(el.dataset)[0];
      if (!entry) return;
      const [key, owner] = entry;
      resourceEls.set(`${owner}-${key}`, el);
    });
}

function emptyStock() {
  return Object.fromEntries(foodTypes.map((type) => [type.id, 0]));
}

function startingStock() {
  if (!gmMode) return emptyStock();
  return Object.fromEntries(
    foodTypes.map((type) => [
      type.id,
      HexSnakeGame.clampInitialStock(initialStock[type.id]),
    ]),
  );
}

function startingEnergy() {
  return gmMode
    ? HexSnakeGame.clampInitialEnergy(initialEnergy)
    : defaultSettings.initialEnergy;
}

function startingBombs() {
  return gmMode
    ? HexSnakeGame.clampInitialBombs(initialBombs)
    : defaultSettings.initialBombs;
}

function foodBonus(stock, typeId, perPoint, maxBonus) {
  return Math.min(maxBonus, stock[typeId] * perPoint);
}

function moveMultiplier(stock) {
  return 1 + foodBonus(stock, "fiber", moveBonusPerPoint, maxMoveBonus);
}

function movementSpeed(stock) {
  const foodSpeedBonus = moveMultiplier(stock) - 1;
  return gmMode
    ? initialSpeed + foodSpeedBonus
    : initialSpeed * moveMultiplier(stock);
}

function damageMultiplier(stock) {
  return 2 + foodBonus(stock, "fat", damageBonusPerPoint, maxDamageBonus);
}

function attackDamageMultiplier(profile = "big") {
  return profile === "small"
    ? smallAttackDamageMultiplier
    : bigAttackDamageMultiplier;
}

function attackDamage(stock, profile = "big") {
  return damageMultiplier(stock) * attackDamageMultiplier(profile);
}

function areaMultiplier(stock) {
  return 1 + foodBonus(stock, "protein", proteinRangeBonusPerPoint, 1);
}

function attackSpeedMultiplier(stock) {
  return (
    1 + foodBonus(stock, "carb", attackSpeedBonusPerPoint, maxAttackSpeedBonus)
  );
}

function attackCooldownMultiplier(stock) {
  return (
    1 + foodBonus(stock, "fiber", attackSpeedBonusPerPoint, maxAttackSpeedBonus)
  );
}

function attackStunChance(stock, baseChance = baseAttackStunChance) {
  return Math.min(
    1,
    baseChance +
      foodBonus(
        stock,
        "carb",
        attackStunChanceBonusPerPoint,
        maxAttackStunChanceBonus,
      ),
  );
}

function moveInterval(stock) {
  return baseStepMs / movementSpeed(stock);
}

function moveIntervalFor(owner, now) {
  const stock = owner === "player" ? playerStock : computerStock;
  const slowUntil = owner === "player" ? playerSlowUntil : computerSlowUntil;
  const speedScale = HexSnakeGame.isPlayerAutoControlActive() ? computerBattleSpeed : 1;
  return (moveInterval(stock) * (now < slowUntil ? 2 : 1)) / speedScale;
}

function isMovementStunned(owner, now) {
  return now < (owner === "player" ? playerStunUntil : computerStunUntil);
}

function attackDelay(stock) {
  return baseAttackDelayMs / attackSpeedMultiplier(stock);
}

function attackCooldown(stock, profile = "big", characterId = null) {
  const baseCooldown =
    profile === "big" && characterId
      ? (attackUltimateBalance?.[characterId]?.bigCooldownMs ??
        baseAttackCooldownMs)
      : baseAttackCooldownMs;
  return baseCooldown / attackCooldownMultiplier(stock);
}

function attackProfileCooldown(stock, profile = "big", characterId = null) {
  return (
    attackCooldown(stock, profile, characterId) *
    (profile === "small" ? smallAttackCooldownScale : 1)
  );
}

function resetAttackCooldownTracker() {
  return { small: -Infinity, big: -Infinity };
}

function normalizedAttackProfile(profile = "big") {
  return profile === "small" ? "small" : "big";
}

function attackCooldownTrackerFor(owner) {
  return owner === "player" ? lastPlayerAttackMs : lastComputerAttackMs;
}

function lastAttackMsFor(owner, profile = "big") {
  const tracker = attackCooldownTrackerFor(owner);
  if (typeof tracker === "number") return tracker;
  const key = normalizedAttackProfile(profile);
  return Number.isFinite(tracker?.[key]) ? tracker[key] : -Infinity;
}

function setLastAttackMsFor(owner, profile = "big", value = performance.now()) {
  const key = normalizedAttackProfile(profile);
  if (owner === "player") {
    if (!lastPlayerAttackMs || typeof lastPlayerAttackMs !== "object")
      lastPlayerAttackMs = resetAttackCooldownTracker();
    lastPlayerAttackMs[key] = value;
    return;
  }
  if (!lastComputerAttackMs || typeof lastComputerAttackMs !== "object")
    lastComputerAttackMs = resetAttackCooldownTracker();
  lastComputerAttackMs[key] = value;
}

function attackCooldownRemainingMs(
  owner,
  profile = "big",
  now = performance.now(),
) {
  const stock = owner === "player" ? playerStock : computerStock;
  const character = characterFor(owner);
  const cooldownMs = attackProfileCooldown(stock, profile, character?.id);
  return Math.max(0, cooldownMs - (now - lastAttackMsFor(owner, profile)));
}

function blastRadius(stock) {
  return baseBlastHexRadius * areaMultiplier(stock);
}

function maxHpForSnake(snakeParts = []) {
  return ((snakeParts?.length || 0) + 1) * hpPerSnakeUnit;
}

function foodHealAmount() {
  return hpPerSnakeUnit;
}

function attackFoodCost(profile = "big") {
  return profile === "small" ? smallAttackFoodCost : 2;
}

function attackBombCost(profile = "big") {
  return profile === "small" ? smallAttackBombCost : bigAttackBombCost;
}

function highestStockFoodType(stock) {
  return foodTypes.reduce((best, type) => {
    const currentCount = stock[type.id] || 0;
    const bestCount = best ? stock[best.id] || 0 : -Infinity;
    return currentCount > bestCount ? type : best;
  }, null);
}

function hasAttackFoodCost(stock, profile = "big") {
  const cost = attackFoodCost(profile);
  if (profile === "small") {
    const highestType = highestStockFoodType(stock);
    return Boolean(highestType) && (stock[highestType.id] || 0) >= cost;
  }
  return foodTypes.every((type) => stock[type.id] >= cost);
}

function ammoFor(owner) {
  return owner === "player" ? playerAmmo : computerAmmo;
}

function ammoChargeFor(owner) {
  return owner === "player" ? playerAmmoCharge : computerAmmoCharge;
}

function canAttack(owner, profile = "big") {
  const stock = owner === "player" ? playerStock : computerStock;
  return (
    ammoFor(owner) >= attackBombCost(profile) &&
    hasAttackFoodCost(stock, profile)
  );
}

function convertFullEnergyToAmmo(owner) {
  if (ammoChargeFor(owner) < attackNeedTotal || ammoFor(owner) >= maxAmmo)
    return false;
  const now = performance.now();
  if (owner === "player") {
    playerAmmo += 1;
    playerAmmoCharge = 0;
    playerEnergyFlashUntil = now + 1700;
    playerBombFlashUntil = now + 1700;
  } else {
    computerAmmo += 1;
    computerAmmoCharge = 0;
    computerEnergyFlashUntil = now + 1700;
    computerBombFlashUntil = now + 1700;
  }
  return true;
}

function consumeAttackCost(owner, stock, profile = "big") {
  const cost = attackFoodCost(profile);
  const bombCost = attackBombCost(profile);
  const hadFullEnergy = ammoChargeFor(owner) >= attackNeedTotal;
  const hadFullBombs = ammoFor(owner) >= maxAmmo;
  if (profile === "small") {
    const highestType = highestStockFoodType(stock);
    if (highestType)
      stock[highestType.id] = Math.max(0, (stock[highestType.id] || 0) - cost);
  } else {
    foodTypes.forEach((type) => {
      stock[type.id] = Math.max(0, stock[type.id] - cost);
    });
  }
  if (bombCost > 0) {
    if (owner === "player") playerAmmo = Math.max(0, playerAmmo - bombCost);
    else computerAmmo = Math.max(0, computerAmmo - bombCost);
    if (hadFullEnergy && hadFullBombs) {
      convertFullEnergyToAmmo(owner);
    }
  }
}

function addStock(stock, typeId, amount = 1) {
  stock[typeId] = Math.min(maxFoodStock, stock[typeId] + amount);
}

function addAmmoCharge(owner, amount = 1) {
  if (owner === "player") {
    playerAmmoCharge += amount;
    if (playerAmmoCharge >= attackNeedTotal) {
      if (playerAmmo < maxAmmo) {
        playerAmmo = Math.min(maxAmmo, playerAmmo + 1);
        playerAmmoCharge = 0;
      } else {
        playerAmmoCharge = attackNeedTotal;
      }
      playerEnergyFlashUntil = performance.now() + 1700;
    }
  } else {
    computerAmmoCharge += amount;
    if (computerAmmoCharge >= attackNeedTotal) {
      if (computerAmmo < maxAmmo) {
        computerAmmo = Math.min(maxAmmo, computerAmmo + 1);
        computerAmmoCharge = 0;
      } else {
        computerAmmoCharge = attackNeedTotal;
      }
      computerEnergyFlashUntil = performance.now() + 1700;
    }
  }
}

function foodTypeIds(food) {
  if (Array.isArray(food.types) && food.types.length) return food.types;
  return food.type ? [food.type] : [];
}

function randomStockFoodTypeId(candidates = stockFoodTypeIds) {
  const available = candidates.filter((typeId) =>
    stockFoodTypeIds.includes(typeId),
  );
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function addRandomStock(stock, candidates = stockFoodTypeIds, amount = 1) {
  const typeId = randomStockFoodTypeId(candidates);
  if (typeId) addStock(stock, typeId, amount);
}

function applyCharacterFoodStockBonus(owner, stock, types) {
  const character = characterFor(owner);
  const hasBlackFood = types.includes("black");
  const stockTypes = types.filter((typeId) =>
    stockFoodTypeIds.includes(typeId),
  );
  if (character?.specialFood === "black") {
    if (!hasBlackFood) return;
    const roll = Math.random();
    if (roll < blackFoodDoubleBonusChance) {
      addRandomStock(stock, stockFoodTypeIds, 2);
    } else if (roll < blackFoodDoubleBonusChance + blackFoodBonusChance) {
      addRandomStock(stock, stockFoodTypeIds, 1);
    }
    return;
  }
  if (character?.food === "balanced") {
    const candidates = hasBlackFood ? stockFoodTypeIds : stockTypes;
    if (candidates.length && Math.random() < balancedFoodBonusChance) {
      addRandomStock(stock, candidates, 1);
    }
    return;
  }
  if (
    stockTypes.length === 1 &&
    stockTypes[0] === character?.food &&
    Math.random() < favoriteFoodBonusChance
  ) {
    addStock(stock, stockTypes[0], 1);
  }
}

function collectFood(owner, food) {
  const stock = owner === "player" ? playerStock : computerStock;
  const types = foodTypeIds(food);
  if (types.includes("black")) {
    const randomType = foodTypes[Math.floor(Math.random() * foodTypes.length)];
    addStock(stock, randomType.id, 1);
    addAmmoCharge(owner, blackFoodEnergy);
    applyCharacterFoodStockBonus(owner, stock, types);
    return;
  }
  const stockGain =
    types.length > 1 ? dualColorStockGain : singleColorStockGain;
  types.forEach((typeId) => addStock(stock, typeId, stockGain));
  applyCharacterFoodStockBonus(owner, stock, types);
  addAmmoCharge(owner, foodEnergy);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
