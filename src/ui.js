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
let bigAttackBombCost = 2;
let baseAttackDelayMs = 2000;
let baseAttackCooldownMs = 2400;
let baseStepMs = 460;
let blastDurationMs = 520;
let baseBlastHexRadius = 2;
let proteinRangeBonusPerPoint = 0.05;
let maxAttackSpeedBonus = 1;
let maxMoveBonus = 0.8;
let maxDamageBonus = 1.4;
let attackSpeedBonusPerPoint = 0.05;
let moveBonusPerPoint = 0.04;
let damageBonusPerPoint = 0.07;
let maxFoodStock = 20;
let foodEnergy = 2;
let blackFoodEnergy = 3;
let singleColorStockGain = 2;
let dualColorStockGain = 1;
let preferredFoodWeight = 0.4;
let otherFoodWeight = 0.2;
let balancedDualChance = 0.5;
let blackSpecialChance = 1 / 3;
let collisionStunMs = 2000;
let collisionSlowMs = 1000;
let attackStunMs = 500;
let attackSlowMs = 500;
let baseAttackStunChance = 0.3;
let attackStunChanceBonusPerPoint = 0.01;
let maxAttackStunChanceBonus = 0.2;
let attackUltimateBalance = {};
let maxCollisionParalysisMs = 8000;
let rangeDamageFalloffEnabled = false;
let targetMaxHex = 6;
let maxMatchMs = 240000;
let gameOverRestartDelayMs = 700;
const gameOverContinuousVisualMaxWaitMs = 1000;
const smallAttackDelayScale = 0.31;
const smallAttackCooldownScale = 0.29;
const sandwormRevealBeforeImpactMs = 200;
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
    carb: 0
  },
  playerCharacterId: "dragon",
  computerCharacterId: "moray"
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
  singleColorStockGain = config.resources?.singleColorStockGain ?? singleColorStockGain;
  dualColorStockGain = config.resources?.dualColorStockGain ?? dualColorStockGain;
  baseStepMs = config.movement?.baseStepMs ?? baseStepMs;
  moveBonusPerPoint = config.movement?.moveBonusPerPoint ?? moveBonusPerPoint;
  maxMoveBonus = config.movement?.maxMoveBonus ?? maxMoveBonus;
  targetMaxHex = config.movement?.targetMaxHex ?? targetMaxHex;
  bigAttackBombCost = config.attack?.bigAttackBombCost ?? bigAttackBombCost;
  baseAttackDelayMs = config.attack?.baseAttackDelayMs ?? baseAttackDelayMs;
  baseAttackCooldownMs = config.attack?.baseAttackCooldownMs ?? baseAttackCooldownMs;
  baseBlastHexRadius = config.attack?.baseBlastHexRadius ?? baseBlastHexRadius;
  proteinRangeBonusPerPoint = config.attack?.proteinRangeBonusPerPoint ?? proteinRangeBonusPerPoint;
  blastDurationMs = config.attack?.blastDurationMs ?? blastDurationMs;
  attackSpeedBonusPerPoint = config.attack?.attackSpeedBonusPerPoint ?? attackSpeedBonusPerPoint;
  maxAttackSpeedBonus = config.attack?.maxAttackSpeedBonus ?? maxAttackSpeedBonus;
  damageBonusPerPoint = config.attack?.damageBonusPerPoint ?? damageBonusPerPoint;
  maxDamageBonus = config.attack?.maxDamageBonus ?? maxDamageBonus;
  baseAttackStunChance = config.attack?.baseAttackStunChance ?? baseAttackStunChance;
  attackStunChanceBonusPerPoint = config.attack?.attackStunChanceBonusPerPoint ?? attackStunChanceBonusPerPoint;
  maxAttackStunChanceBonus = config.attack?.maxAttackStunChanceBonus ?? maxAttackStunChanceBonus;
  attackStunMs = config.attack?.attackStunMs ?? attackStunMs;
  attackSlowMs = config.attack?.attackSlowMs ?? attackSlowMs;
  rangeDamageFalloffEnabled = config.attack?.rangeDamageFalloffEnabled ?? rangeDamageFalloffEnabled;
  attackUltimateBalance = config.attack?.ultimates || attackUltimateBalance;
  collisionStunMs = config.collision?.collisionStunMs ?? collisionStunMs;
  collisionSlowMs = config.collision?.collisionSlowMs ?? collisionSlowMs;
  maxCollisionParalysisMs = config.collision?.maxCollisionParalysisMs ?? maxCollisionParalysisMs;
  preferredFoodWeight = config.foodWeights?.preferred ?? preferredFoodWeight;
  otherFoodWeight = config.foodWeights?.other ?? otherFoodWeight;
  balancedDualChance = config.foodWeights?.balancedDualChance ?? balancedDualChance;
  blackSpecialChance = config.foodWeights?.blackSpecialChance ?? blackSpecialChance;
  maxMatchMs = config.simulation?.maxMatchMs ?? maxMatchMs;
  defaultSettings = { ...defaultSettings, ...(config.defaults || {}), initialStock: { ...defaultSettings.initialStock, ...(config.defaults?.initialStock || {}) } };
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
  initialStockInputs.forEach(input => {
    input.max = maxFoodStock;
    input.value = defaultSettings.initialStock[input.dataset.initialStock] || 0;
  });
  computerDifficultyInput.value = defaultSettings.computerDifficulty;
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
  { q: -1, r: 0, angle: -150, key: "a", label: "左方" }
];
const foodTypes = [
  { id: "protein", label: "蛋白", name: "蛋白", colorName: "紅色", foodName: "蛋白", effect: "爆炸半徑由 2 連續成長到 4，小數部分會讓最外圈承受對應比例傷害", color: "#ef4444", line: "#fecaca" },
  { id: "fat", label: "脂肪", name: "脂肪", colorName: "黃色", foodName: "脂肪", effect: "攻擊傷害係數基礎 2，滿庫存約 3.4", color: "#facc15", line: "#fef08a" },
  { id: "fiber", label: "纖維", name: "纖維", colorName: "綠色", foodName: "纖維", effect: "提升移動速度，滿庫存約 1.8x", color: "#22c55e", line: "#bbf7d0" },
  { id: "carb", label: "碳水", name: "碳水", colorName: "藍色", foodName: "碳水", effect: "提升攻擊施展與冷卻速度，並提高命中暈眩機率", color: "#3b82f6", line: "#bfdbfe" }
];
const blackFoodType = { id: "black", label: "迷幻菇", name: "迷幻菇", colorName: "黑色", foodName: "迷幻菇", effect: "特殊食物；吃下後蛋白、脂肪、纖維、碳水隨機一種庫存 +1，並獲得 3 點能量", color: "#050505", line: "#e5e7eb" };
const dualFoodName = "蟠桃(雙色)";
const foodTypeById = new Map([...foodTypes, blackFoodType].map(type => [type.id, type]));
const foodLabels = {
  balanced: "均衡",
  protein: "蛋白",
  fat: "脂肪",
  fiber: "纖維",
  carb: "碳水",
  black: "迷幻菇"
};

function foodNameWithColor(type) {
  return type?.colorName ? `${type.name}（${type.colorName}）` : type?.name || "";
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
  ...foodTypes.flatMap(type => [
    [type.id, foodNameWithColor(type)],
    [type.id, type.name]
  ])
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
  "落敗"
].sort((a, b) => b.length - a.length);

const inlineTermPattern = new RegExp(
  [...inlineFoodTerms.map(([, label]) => label), ...inlineKeywordTerms].map(escapeRegExp).join("|"),
  "g"
);
const inlineFoodTermByLabel = new Map(inlineFoodTerms.map(([id, label]) => [label, id]));
const inlineKeywordSet = new Set(inlineKeywordTerms);

function formatInlineText(text = "") {
  if (!text) return "";
  return compactFoodTerms(text).replace(inlineTermPattern, match => {
    const foodId = inlineFoodTermByLabel.get(match);
    if (foodId) return foodTermMarkup(foodId, match);
    if (inlineKeywordSet.has(match)) return keywordMarkup(match);
    return match;
  });
}

function formatRichText(markup = "") {
  const parts = compactFoodTerms(markup).split(/(<[^>]+>)/g);
  let emphasizedDepth = 0;
  return parts.map(part => {
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
  }).join("");
}
const poseAliases = {
  opening: "opening",
  intro: "opening",
  idle: "intro",
  attack: "small",
  small: "small",
  big: "big",
  victory: "victory",
  defeat: "defeat"
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
  blast: "#fb923c"
};
let keyToDir = new Map(directions.map((dir, index) => [dir.key, index]));
const defaultKeybinds = {
  smallAttack: "q",
  bigAttack: "r",
  pause: " ",
  surrender: "t",
  directions: directions.map(direction => direction.key)
};
let keybinds = loadKeybinds();
let selectedAttackProfile = "small";
const keyboardTargetModes = ["head", "centroid", "food"];
const keyboardTargetModeLabels = {
  head: "目標頭部",
  centroid: "目標身體",
  food: "目標最近食物"
};
let keyboardAttackAim = {
  small: { targetModeIndex: 0, direction: 0 },
  big: { targetModeIndex: 0, direction: 0 }
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
let best = Number(localStorage.getItem("hexSnakeBest") || 0);
let bestTotalMs = Number(localStorage.getItem("hexSnakeBestTotalMs") || 0);
let totalElapsedMs = 0;
let lastFeedElapsedMs = 0;
let running = false;
let paused = false;
let computerBattleMode = false;
let playerAutoMode = false;
let computerBattleManualOverride = false;
let computerBattleSpeed = normalizeAutoBattleSpeed(localStorage.getItem("hexSnakeAutoBattleSpeed"));
let relayModePreference = localStorage.getItem("hexSnakeRelayMode") === "1";
let relayMode = false;
let relayPlayerWins = 0;
let relayComputerWins = 0;
let relayDraws = 0;
let relayRestartTimer = null;
let gameOverRelayStartOptions = null;
let gameOverSettlementPending = false;
let gameOverContinuousVisualDeadlineAt = 0;
let gameOver = false;
let lastPlayerStep = 0;
let lastComputerStep = 0;
let playerStunUntil = 0;
let playerSlowUntil = 0;
let playerCollisionParalysisMs = 0;
let computerStunUntil = 0;
let computerSlowUntil = 0;
let computerCollisionParalysisMs = 0;
let playerUndergroundFrom = 0;
let playerUndergroundUntil = 0;
let computerUndergroundFrom = 0;
let computerUndergroundUntil = 0;
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
let lastPlayerAttackMs = -Infinity;
let lastComputerAttackMs = -Infinity;
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
let selectedPortraitOwner = "player";
let highlightedAttackProfile = null;
let attackHighlightReleaseTimer = null;
let moveStickReboundTimer = null;
let introDetailsOpen = false;
let tutorialStepIndex = 0;
const tutorialSeenKey = "hexSnakeTutorialSeen";
let tutorialSwipeStartX = null;
let tutorialSwipeStartY = null;
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
  chibi: "Q獸版"
};
const storedPortraitVariant = localStorage.getItem("hexSnakePortraitVariant");
let portraitVariantMode = portraitVariantModes.includes(storedPortraitVariant)
  ? storedPortraitVariant
  : storedPortraitVariant === "full"
    ? "human"
    : defaultPortraitVariantMode;
let restartUnlockAt = 0;

function fighterArt(character, pose = "idle", portrait = false, variant = "medium") {
  const imageClass = `fighter-avatar-image${portrait ? " portrait" : ""}`;
  const loadMode = portrait || pose === "attack" ? "eager" : "lazy";
  const initialSize = variant === "small" ? "sm" : "md";
  const src = portrait ? portraitUrl(character, pose, initialSize) : avatarUrl(character, initialSize);
  const srcset = portrait ? portraitSrcset(character, pose) : avatarSrcset(character);
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
  let image = module.querySelector(".fighter-avatar-image[data-duel-avatar='true']");
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

const commonSmallMoveGuide = "小招是所有角色共用的基本爆破：按小招鍵或點「小招」時，會依 X 鍵選擇的小招目標施放；在棋盤短點一下則以手勢位置輔助瞄準。";
const characterMoveGuides = {
  dragon: {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按指定落點。白龍會在目標格降下<strong>靈息爆發</strong>，命中後留下<strong>持續 4 秒</strong>的靈息傷害區。",
    tip: "長按棋盤可把落點放在敵方必經路線；爆發傷害較低，但持續區域能逼迫對手轉向。"
  },
  sandworm: {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按指定突襲格。沙蟲會<strong>潛地延遲突襲</strong>，命中頭部可<strong>直接擊倒</strong>，命中身體會造成<strong>麻痺</strong>。",
    tip: "長按棋盤可預判敵方頭部下一步；施放後接近命中時會短暫潛地，可用來躲開危險。"
  },
  quetzal: {
    big: "按大招鍵、點「大招」，或在棋盤長按都會施放；羽蛇會沿自身蛇身留下<strong>持續 3 秒</strong>的<strong>藤沼區域</strong>，不需要指定落點，蛋白（紅色）庫存越高外擴傷害越完整。",
    tip: "適合在敵方靠近你身體或追逐時施放，用身體路徑封鎖空間。"
  },
  moray: {
    big: "在棋盤拖曳可指定電擊起點與方向，放開施放；按大招鍵或點「大招」則依 Y 鍵選擇的大招方向施放。電鰻會打出貫穿棋盤的<strong>直線電擊</strong>，命中可<strong>堆疊暈眩</strong>。",
    tip: "棋盤拖曳時，拖曳方向比落點更重要；沿敵方身體長軸掃線最容易命中多段。"
  },
  lobster: {
    big: "在棋盤拖曳可指定出拳方向，放開施放；按大招鍵或點「大招」則依 Y 鍵選擇的大招方向施放。智蝦會從頭部打出<strong>兩波追蹤連拳</strong>，拳路遇到第一個敵方蛇身會<strong>停下並爆發</strong>。",
    tip: "拖曳方向從自己頭部出拳；對準敵方頭部或彎折蛇身，兩波連拳更容易打滿。"
  },
  gu_king: {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按指定毒爆中心。蠱王會在同一目標連續落下<strong>三段毒爆</strong>。",
    tip: "長按棋盤可瞄準敵方必經格或被迫轉向的位置，讓三段毒爆覆蓋逃跑路線。"
  }
};

function moveGuideFor(character) {
  return characterMoveGuides[character.id] || {
    big: "按大招鍵或點「大招」會依 Y 鍵選擇的大招目標快速施放；也可在棋盤長按或拖曳觸發<strong>角色大招</strong>。",
    tip: "觀察敵方路線後再決定快速施放或手動指定，命中率會更高。"
  };
}

function characterStoryMarkup(character) {
  const motto = character.motto ? `<p class="portrait-motto">「${character.motto}」</p>` : "";
  const moves = character.smallMove && character.bigMove
    ? `<div class="portrait-moves" aria-label="${character.name}招式與食補效果"><span>小招：${character.smallMove}</span><span>大招：${character.bigMove}</span><span>食補效果：${formatRichText(character.detail)}</span></div>`
    : "";
  const story = (character.story || []).map(paragraph => `<p>${paragraph}</p>`).join("");
  return `${motto}${moves}${story}`;
}

function foodIconMarkup(typeOrId, extraClass = "") {
  const type = typeof typeOrId === "string" ? foodTypeById.get(typeOrId) : typeOrId;
  if (!type) return "";
  return `<span class="food-icon is-${type.id} ${extraClass}" style="--food-color:${type.color};--food-line:${type.line};" aria-hidden="true"></span>`;
}

function foodIconGroupMarkup(typeIds, label) {
  const ids = Array.isArray(typeIds) ? typeIds : [typeIds];
  const icons = ids.map(id => foodIconMarkup(id)).join("");
  return `<span class="food-icon-group" aria-label="${label}">${icons}</span>`;
}

const tutorialSlides = [
  {
    title: "六角移動",
    visual: "move",
    tag: "移動 + 虛擬搖桿區",
    lead: "目標是施展招式把敵方 <strong>HP 歸零</strong>。",
    sections: [
      {
        title: "移動方式",
        text: "用<strong>虛擬搖桿區</strong>或 <strong>W/E/D/X/Z/A</strong> 選六角方向；蒐集食物，逐步累積出招資源。"
      },
      {
        title: "進食策略",
        text: `食物以簡稱搭配棋盤顏色標示；先看資源圖表判斷缺哪種庫存、能量或炸彈。吃到食物會增加 1 段蛇身並增加 2 點 HP；${dualFoodName}會補棋盤上顯示的兩種庫存。食物庫存與炸彈決定能不能放招式；兩邊都要顧。`
      },
      {
        title: "控制效果",
        text: `攻擊命中後有 ${Math.round(baseAttackStunChance * 100)}% 基礎機率暈眩，碳水（藍色）庫存會提高暈眩率；暈眩會讓對手短時間無法順利走位。`
      },
      {
        title: "撞擊懲罰",
        text: `撞到另一方會停止 ${collisionStunMs / 1000} 秒，再減速 ${collisionSlowMs / 1000} 秒；撞到自己懲罰加倍，累積停止時間超過 ${maxCollisionParalysisMs / 1000} 秒會落敗。`
      }
    ]
  },
  {
    title: "資源總覽",
    visual: "resources",
    hideCopy: true,
    tag: "資源圖表 + 食物效果",
    lead: "四種自然食物與特殊食物的效果列在這裡；庫存上限已併在食物效果區塊最後面。",
    points: [
      "蛋白拉大爆炸半徑、脂肪增加傷害、纖維提高速度、碳水加快攻擊並提高暈眩。",
      `能量滿 ${attackNeedTotal} 點轉成炸彈，炸彈最多 ${maxAmmo} 枚，是大招的主要消耗。`
    ]
  },
  {
    title: "招式操作",
    visual: "small",
    tag: "技能按鍵區",
    lead: "小招適合快速出手，大招適合抓準時機收尾。",
    sections: [
      {
        title: "小招操作",
        text: "按<strong>鍵盤Q</strong> 或<strong>小招</strong>按鈕施放；短按棋盤也可施展小招。",
        cost: `成本：蛋白、脂肪、纖維、碳水四種庫存各 1 點。`
      },
      {
        title: "大招操作",
        text: "按<strong>鍵盤R</strong> 或<strong>大招</strong>按鈕施放；長按或拖曳棋盤也可施展大招。",
        cost: `成本：${bigAttackBombCost} 枚炸彈，且蛋白、脂肪、纖維、碳水四種庫存各 2 點。`
      },
      {
        title: "瞄準細節",
        text: "<strong>X</strong> 控制小招目標，<strong>Y</strong> 控制大招目標，可在敵方頭部、敵方中心、離敵方最近的食物之間循環；方向型大招會改為切換施放方向，或朝拖曳方向施展。"
      }
    ]
  }
];
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
      h: Math.min(height, shortSide * 0.68)
    };
  }
  if (type === "food") {
    return {
      x: Math.max(0, width * 0.5 - shortSide * 0.43),
      y: Math.max(0, height * 0.5 - shortSide * 0.36),
      w: Math.min(width, shortSide * 0.86),
      h: Math.min(height, shortSide * 0.62)
    };
  }
  return {
    x: Math.max(0, width * 0.5 - shortSide * 0.38),
    y: Math.max(0, height * 0.5 - shortSide * 0.38),
    w: Math.min(width, shortSide * 0.76),
    h: Math.min(height, shortSide * 0.76)
  };
}

function tutorialCropPoint(cell, type) {
  const crop = tutorialCaptureCrop(type);
  const point = axialToPixel(cell);
  const rect = playArea.getBoundingClientRect();
  const scaleX = rect.width ? canvas.width / rect.width : 1;
  const scaleY = rect.height ? canvas.height / rect.height : 1;
  const canvasPoint = {
    x: point.x * scaleX,
    y: point.y * scaleY
  };
  return {
    x: ((canvasPoint.x - crop.x) / crop.w) * 100,
    y: ((canvasPoint.y - crop.y) / crop.h) * 100
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
    y: from.y + (to.y - from.y) * 0.42
  };
  const end = {
    x: from.x + (to.x - from.x) * 0.88,
    y: from.y + (to.y - from.y) * 0.88
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
  return nextWrappedCell(nextWrappedCell(head, 1), 1);
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
      snake = createStartingSnake({ q: 0, r: 0 }, dir, Math.max(3, defaultSettings.initialLength));
      lastVisiblePlayerSnake = snake.map(segment => ({ ...segment }));
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
      computerSnake = createStartingSnake(hitHead, computerDir, Math.max(4, defaultSettings.initialLength + 1));
      lastVisibleComputerSnake = computerSnake.map(segment => ({ ...segment }));
      snake = createStartingSnake({ q: -2, r: 1 }, 1, Math.max(3, defaultSettings.initialLength));
      lastVisiblePlayerSnake = snake.map(segment => ({ ...segment }));
      foods = [];
      blasts = [
        ...blasts,
        {
          kind: "circle",
          target: { q: computerSnake[0].q, r: computerSnake[0].r },
          owner: "player",
          radius: Math.max(3.1, blastRadius(playerStock || initialStock) + 1.1),
          visualType: attackVisualType("player", "small"),
          startedAt: now - blastDurationMs * 0.02,
          endAt: now + blastDurationMs * 0.98
        }
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
    outCtx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, targetWidth, targetHeight);
    if (type === "small") {
      const hitPoint = axialToPixel({ q: 0, r: 0 });
      const x = hitPoint.x - crop.x;
      const y = hitPoint.y - crop.y;
      const radiusPx = cellSize * 3.35;
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      const gradient = outCtx.createRadialGradient(x, y, cellSize * 0.35, x, y, radiusPx);
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
      [0.54, 0.78, 1].forEach(scale => {
        outCtx.beginPath();
        outCtx.arc(x, y, radiusPx * scale, 0, Math.PI * 2);
        outCtx.stroke();
      });
      outCtx.strokeStyle = "rgba(251,191,36,0.95)";
      outCtx.lineWidth = Math.max(2, cellSize * 0.06);
      for (let i = 0; i < 12; i += 1) {
        const angle = i * Math.PI * 2 / 12;
        outCtx.beginPath();
        outCtx.moveTo(x + Math.cos(angle) * radiusPx * 0.35, y + Math.sin(angle) * radiusPx * 0.35);
        outCtx.lineTo(x + Math.cos(angle) * radiusPx * 1.12, y + Math.sin(angle) * radiusPx * 1.12);
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
  clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  clone.removeAttribute("id");
  clone.querySelectorAll("button, input, select, textarea").forEach(node => {
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
  const naturalFoodItems = foodTypes.map(type => `
            <li>
              ${foodIconGroupMarkup(type.id, `自然產出${foodNameWithColor(type)}`)}
              <span>${foodTermMarkup(type.id, foodNameWithColor(type))}：${formatRichText(type.effect)}。</span>
            </li>
          `).join("");
  return `
          <ul class="tutorial-food-detail-list" aria-label="食物效果細節">
            ${naturalFoodItems}
            <li>
              ${foodIconGroupMarkup(foodTypes.map(type => type.id), dualFoodName)}
              <span>${foodTermMarkup("dual", dualFoodName)}：${formatRichText(`補棋盤上顯示的兩種庫存各 ${dualColorStockGain} 點，並獲得 ${foodEnergy} 點能量。`)}</span>
            </li>
            <li>
              ${foodIconGroupMarkup("black", foodNameWithColor(blackFoodType))}
              <span>${foodTermMarkup("black", foodNameWithColor(blackFoodType))}：${formatRichText(`${blackFoodType.effect}；不會自然產出。`)}</span>
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
            <span>${formatRichText(`吃食物會累積能量；能量滿 ${attackNeedTotal} 點轉成炸彈，炸彈最多 ${maxAmmo} 枚，是大招的主要消耗。`)}</span>
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
  const slide = tutorialSlides[tutorialStepIndex] || tutorialSlides[0];
  winnerPortrait.hidden = false;
  winnerPortrait.innerHTML = `
        <div class="tutorial-card" role="group" tabindex="0" aria-label="新手教學 ${tutorialStepIndex + 1} / ${tutorialSlides.length}">
            <div class="tutorial-progress">${tutorialSlides.map((_, index) => `<span class="${index === tutorialStepIndex ? "is-active" : ""}"></span>`).join("")}</div>
          ${tutorialVisualMarkup(slide)}
          ${slide.hideCopy ? "" : `<div class="tutorial-copy">
            <strong class="tutorial-title">${formatRichText(slide.title)}</strong>
            <p class="tutorial-lead">${formatRichText(slide.lead)}</p>
            ${slide.sections ? `
              ${slide.sections.map(section => `
                <p class="tutorial-line">
                  <b>${formatRichText(section.title)}</b>
                  <span>${formatRichText(section.text)}</span>
                  ${section.cost ? `<small>${formatRichText(section.cost)}</small>` : ""}
                </p>
              `).join("")}
            ` : `
              ${slide.points.map(point => `<p class="tutorial-line"><span>${formatRichText(point)}</span></p>`).join("")}
              ${slide.note ? `<p class="tutorial-line tutorial-note"><span>${formatRichText(slide.note)}</span></p>` : ""}
            `}
          </div>`}
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
  tutorialStepIndex = Math.max(0, Math.min(tutorialSlides.length - 1, startIndex));
  setTutorialChrome();
  overlay.classList.add("show");
  characterStage.hidden = true;
  renderTutorialSlide();
}

function finishTutorial(markSeen = true) {
  if (markSeen) localStorage.setItem(tutorialSeenKey, "1");
  overlay.classList.remove("tutorial-open");
  renderIntroPortraits(false);
  overlay.classList.add("show");
}

function shouldShowTutorial() {
  return localStorage.getItem(tutorialSeenKey) !== "1";
}

function isTutorialOpen() {
  return overlay.classList.contains("show") && overlay.classList.contains("tutorial-open");
}

function moveTutorial(delta) {
  const nextIndex = Math.max(0, Math.min(tutorialSlides.length - 1, tutorialStepIndex + delta));
  if (nextIndex === tutorialStepIndex) return false;
  tutorialStepIndex = nextIndex;
  renderTutorialSlide();
  return true;
}

function weightedFoodIconMarkup(character) {
  if (character?.specialFood === "black") {
    return foodIconGroupMarkup("black", `加權產出${foodNameWithColor(blackFoodType)}`);
  }
  if (character?.food === "balanced") {
    return foodIconGroupMarkup(foodTypes.map(type => type.id), `均衡產出四種食物，並可能補出${dualFoodName}`);
  }
  const type = foodTypeById.get(character?.food);
  return foodIconGroupMarkup(character?.food, `加權產出${type ? foodNameWithColor(type) : character.foodLabel}`);
}

function characterFoodLabelForRules(character) {
  if (character?.specialFood === "black") return foodNameWithColor(blackFoodType);
  if (character?.food === "balanced") return `${foodLabels.balanced}／${dualFoodName}`;
  const type = foodTypeById.get(character?.food);
  return type ? foodNameWithColor(type) : character?.foodLabel || foodLabels.balanced;
}

function buildRulesContent() {
  const characterLegend = characters.map(character => {
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
  }).join("");
  rulesContent.innerHTML = `
        <section class="rules-block rules-tutorial-callout" data-open-tutorial role="button" tabindex="0" aria-label="開啟基礎規則教學">
          <h3>基礎規則教學</h3>
          <p>${formatRichText("想先用圖片快速看懂進食策略、移動、小招操作，可以點擊這裡重新開啟教學頁。")}</p>
        </section>
        <section class="rules-block">
          <h3>進階對戰</h3>
          <ul class="rules-list">
            <li><b>按鍵自訂</b>：${formatRichText("小招、大招、暫停、投降與六方向鍵都可在開局設定中修改；若方向鍵與 X / Y 目標鍵相同，X / Y 目標鍵會優先作用。")}</li>
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
            <h3 id="rulesAboutTitle">About Me</h3>
            <strong class="rules-about-name">Chang Wei Lin</strong>
          </div>
          <p class="rules-about-line">我愛星空至深，無懼黑夜。</p>
          <blockquote class="rules-about-quote">
            <p>We have loved the stars too fondly to fear the dark.</p>
            <cite>— &lt;The Old Astronomer&gt; Sarah Williams</cite>
          </blockquote>
          <div class="rules-about-links" aria-label="About Me links">
            <a class="rules-about-link" href="https://github.com/changweilin" target="_blank" rel="noopener noreferrer" aria-label="Chang Wei Lin GitHub">
              <img class="rules-about-icon" src="https://github.com/favicon.ico" alt="" aria-hidden="true" decoding="async" loading="eager">
              <span>GitHub</span>
            </a>
            <a class="rules-about-link" href="https://www.linkedin.com/in/wei-lin-chang-ba38049a/" target="_blank" rel="noopener noreferrer" aria-label="Chang Wei Lin LinkedIn">
              <img class="rules-about-icon" src="https://www.linkedin.com/favicon.ico" alt="" aria-hidden="true" decoding="async" loading="eager">
              <span>LinkedIn</span>
            </a>
            <a class="rules-about-link" href="https://changweilin.github.io/demo_link/" target="_blank" rel="noopener noreferrer" aria-label="Chang Wei Lin demo link">
              <img class="rules-about-icon" src="https://changweilin.github.io/demo_link/favicon-32.png" alt="" aria-hidden="true" decoding="async" loading="eager">
              <span>Demo</span>
            </a>
          </div>
        </section>
      `;
}

function openRulesModal() {
  setSettingsOpen(false);
  setGmOpen(false);
  rulesModal.hidden = false;
  rulesButton.setAttribute("aria-expanded", "true");
  rulesCloseButton.focus();
}

function closeRulesModal() {
  rulesModal.hidden = true;
  rulesButton.setAttribute("aria-expanded", "false");
  rulesButton.focus();
}

function setOverlayChromeVisible(visible) {
  overlay.classList.remove("intro-details", "tutorial-open");
  overlayTitle.hidden = !visible;
  overlayText.hidden = !visible;
  startButton.hidden = !visible;
  computerBattleButton.hidden = !visible || (running && !gameOver);
  replayArchiveButton.hidden = !visible;
  introCloseButton.hidden = true;
}

function setIntroLobbyChrome() {
  overlay.classList.remove("intro-details", "tutorial-open");
  overlayTitle.hidden = true;
  overlayText.hidden = true;
  startButton.hidden = false;
  computerBattleButton.hidden = false;
  replayArchiveButton.hidden = false;
  introCloseButton.hidden = true;
  startButton.textContent = "開始";
}

function setIntroDetailsChrome() {
  overlay.classList.add("intro-details");
  overlay.classList.remove("tutorial-open");
  overlayTitle.hidden = true;
  overlayText.hidden = true;
  startButton.hidden = true;
  computerBattleButton.hidden = true;
  replayArchiveButton.hidden = true;
  introCloseButton.hidden = false;
}

function buildCharacterStage() {
  characterStage.innerHTML = ["player", "computer"].map(owner => {
    const character = characterFor(owner);
    const holdHint = owner === "player" ? " title=\"長按施放攻擊\"" : "";
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
  }).join("");
}

function renderWinnerPortrait(owner, playerLost = false, computerLost = false) {
  setOverlayChromeVisible(true);
  if (!owner && !playerLost && !computerLost) {
    winnerPortrait.hidden = true;
    winnerPortrait.innerHTML = "";
    characterStage.hidden = false;
    return;
  }
  const playerPose = owner === "player" ? "victory" : "defeat";
  const computerPose = owner === "computer" ? "victory" : "defeat";
  const playerResult = owner ? (owner === "player" ? "勝利" : "失敗") : "平手";
  const computerResult = owner ? (owner === "computer" ? "勝利" : "失敗") : "平手";
  winnerPortrait.hidden = false;
  characterStage.hidden = true;
  characterStage.innerHTML = "";
  winnerPortrait.innerHTML = `
        <div class="portrait-pair">
          <div class="fighter-portrait result-portrait ${owner === "player" ? "is-winner" : ""} ${playerPose === "defeat" ? "is-defeated" : ""}" data-owner="player" data-result-owner="player" data-owner-mark="${ownerMeta("player").mark}" title="選擇 P1 角色" style="${characterStyle(characterFor("player"), "player")}">
            <span class="result-badge">${playerResult}</span>
            ${fighterArt(characterFor("player"), playerPose, true)}
          </div>
          <div class="fighter-portrait result-portrait ${owner === "computer" ? "is-winner" : ""} ${computerPose === "defeat" ? "is-defeated" : ""}" data-owner="computer" data-result-owner="computer" data-owner-mark="${ownerMeta("computer").mark}" title="選擇 P2 角色" style="${characterStyle(characterFor("computer"), "computer")}">
            <span class="result-badge">${computerResult}</span>
            ${fighterArt(characterFor("computer"), computerPose, true)}
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
  characterStage.hidden = true;
  characterStage.innerHTML = "";
  if (!showDetails) {
    winnerPortrait.innerHTML = `
          <div class="intro-avatar-gate">
            ${["player", "computer"].map(owner => {
      const character = selectedCharacterFor(owner);
      const label = owner === "player" ? "P1" : "P2";
      return `
                <div class="intro-avatar-button" role="button" tabindex="0" data-owner="${owner}" data-open-intro="${owner}" style="${characterStyle(character || {
        color: ownerMeta(owner).color,
        line: ownerMeta(owner).line,
        accent: "#fbbf24"
      }, owner)}" aria-label="開啟${label}角色選擇">
                  <div class="portrait-card-controls" data-portrait-swipe-owner="${owner}">
                    ${character ? `<div class="fighter-portrait" data-owner="${owner}" data-owner-mark="${ownerMeta(owner).mark}">${fighterArt(character, "intro", true, "small")}</div>` : randomPortraitMarkup(owner)}
                  </div>
                  <div class="portrait-label-controls intro-avatar-label-controls">
                    <button class="secondary portrait-arrow portrait-label-arrow" type="button" data-portrait-owner="${owner}" data-portrait-shift="-1" aria-label="${ownerMeta(owner).label} 上一位">‹</button>
                    <span class="intro-avatar-label"><span class="owner-name ${owner === "player" ? "is-p1" : "is-p2"}">${ownerMeta(owner).label}</span> · ${character ? character.name : "隨機選擇"}</span>
                    <button class="secondary portrait-arrow portrait-label-arrow" type="button" data-portrait-owner="${owner}" data-portrait-shift="1" aria-label="${ownerMeta(owner).label} 下一位">›</button>
                  </div>
                </div>
              `;
    }).join("")}
          </div>
        `;
    return;
  }
  winnerPortrait.innerHTML = `
        <div class="portrait-select" data-portrait-select>
          <div class="portrait-pair">
          ${["player", "computer"].map(owner => {
    const character = selectedCharacterFor(owner);
    const label = owner === "player" ? "P1" : "P2";
    return `
                <div class="portrait-option ${owner === selectedPortraitOwner ? "is-selected" : ""}" role="button" tabindex="0" data-owner="${owner}" data-portrait-owner="${owner}" style="${characterStyle(character || {
      color: ownerMeta(owner).color,
      line: ownerMeta(owner).line,
      accent: "#fbbf24"
    }, owner)}">
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
  }).join("")}
          </div>
          <div class="portrait-controls">
            <button class="secondary portrait-arrow" type="button" data-portrait-shift="-1" aria-label="上一位" onclick="applySelectedPortraitCharacter(-1)">‹</button>
            <div class="portrait-copy" style="${characterStyle(selectedCharacter || {
    color: ownerMeta(selectedPortraitOwner).color,
    line: ownerMeta(selectedPortraitOwner).line,
    accent: "#fbbf24"
  }, selectedPortraitOwner)}">
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

function setPortraitCharacterForOwner(owner, characterId, showDetails = introDetailsOpen) {
  if (characterId !== randomCharacterChoiceId && !characterById.has(characterId)) return;
  selectedPortraitOwner = owner === "computer" ? "computer" : "player";
  if (selectedPortraitOwner === "player") {
    playerCharacterChoice = characterId;
    if (characterId !== randomCharacterChoiceId) playerCharacterId = characterId;
  } else {
    computerCharacterChoice = characterId;
    if (characterId !== randomCharacterChoiceId) computerCharacterId = characterId;
  }
  syncCharacterInputs();
  saveCharacterChoices();
  if (characterId !== randomCharacterChoiceId) preloadPortraitsFor(selectedPortraitOwner);
  renderIntroPortraits(showDetails);
  resize();
  if (characterId !== randomCharacterChoiceId) {
    HexSnakeAudio.playCharacter(owner, "select", { character: characterById.get(characterId), unlock: true });
  }
}

function setSelectedPortraitCharacter(characterId) {
  setPortraitCharacterForOwner(selectedPortraitOwner, characterId);
}

function applyPortraitCharacter(owner, delta, showDetails = introDetailsOpen) {
  const safeOwner = owner === "computer" ? "computer" : "player";
  const currentId = characterChoiceFor(safeOwner);
  const choices = [randomCharacterChoiceId, ...characters.map(character => character.id)];
  const currentIndex = Math.max(0, choices.indexOf(currentId));
  const nextChoice = choices[(currentIndex + delta + choices.length) % choices.length];
  setPortraitCharacterForOwner(safeOwner, nextChoice, showDetails);
}

function applySelectedPortraitCharacter(delta) {
  applyPortraitCharacter(selectedPortraitOwner, delta);
}

function renderPortraitLightbox() {
  const character = characterFor(portraitLightboxOwner);
  portraitLightboxImage.src = portraitUrl(character, "intro", "full");
  portraitLightboxImage.srcset = portraitSrcset(character, "intro", true);
  portraitLightboxImage.sizes = portraitSizesAttribute("full");
  portraitLightboxImage.alt = character.name;
  portraitLightboxImage.dataset.characterId = character.id;
  portraitLightboxImage.dataset.portraitVariant = portraitVariantMode;
  portraitLightboxCaption.textContent = `${ownerMeta(portraitLightboxOwner).label} / ${character.name} / ${portraitVariantLabels[portraitVariantMode] || portraitVariantMode}`;
  updatePortraitVariantButtons();
}

function updatePortraitVariantButtons() {
  const currentIndex = portraitVariantModes.indexOf(portraitVariantMode);
  portraitLightboxVariantButtons.forEach(button => {
    const delta = button.dataset.portraitLightboxDirection === "up" ? -1 : 1;
    const nextMode = portraitVariantModes[(currentIndex + delta + portraitVariantModes.length) % portraitVariantModes.length];
    button.textContent = `${delta < 0 ? "↑" : "↓"} ${portraitVariantLabels[nextMode] || nextMode}`;
    button.setAttribute("aria-label", `${delta < 0 ? "Previous" : "Next"} portrait version: ${portraitVariantLabels[nextMode] || nextMode}`);
  });
}

function rerenderPortraitSurfaces() {
  if (!characterStage.hidden) buildCharacterStage();
  if (!portraitLightbox.hidden) renderPortraitLightbox();
  if (overlay.classList.contains("show") && !winnerPortrait.hidden) {
    const resultPortraits = winnerPortrait.querySelectorAll("[data-result-owner]");
    if (resultPortraits.length) {
      const playerResult = winnerPortrait.querySelector('[data-result-owner="player"]');
      const computerResult = winnerPortrait.querySelector('[data-result-owner="computer"]');
      const winner = winnerPortrait.querySelector(".result-portrait.is-winner")?.dataset.resultOwner || null;
      renderWinnerPortrait(winner, playerResult?.classList.contains("is-defeated"), computerResult?.classList.contains("is-defeated"));
    } else {
      renderIntroPortraits(introDetailsOpen);
    }
  }
}

function setPortraitVariantMode(mode) {
  const nextMode = mode === "full" ? "human" : portraitVariantModes.includes(mode) ? mode : defaultPortraitVariantMode;
  if (portraitVariantMode === nextMode) return;
  portraitVariantMode = nextMode;
  localStorage.setItem("hexSnakePortraitVariant", portraitVariantMode);
  rerenderPortraitSurfaces();
  preloadPortraitsFor("player");
  preloadPortraitsFor("computer");
}

function togglePortraitVariantMode() {
  shiftPortraitVariantMode(1);
}

function shiftPortraitVariantMode(delta) {
  const currentIndex = Math.max(0, portraitVariantModes.indexOf(portraitVariantMode));
  setPortraitVariantMode(portraitVariantModes[(currentIndex + delta + portraitVariantModes.length) % portraitVariantModes.length]);
}

function openPortraitLightbox(owner) {
  portraitLightboxOwner = owner === "computer" ? "computer" : "player";
  selectedPortraitOwner = portraitLightboxOwner;
  renderPortraitLightbox();
  portraitLightbox.hidden = false;
}

function shiftPortraitLightbox(delta) {
  selectedPortraitOwner = portraitLightboxOwner;
  const choices = characters.map(character => character.id);
  const currentId = characterFor(selectedPortraitOwner).id;
  const currentIndex = Math.max(0, choices.indexOf(currentId));
  const nextChoice = choices[(currentIndex + delta + choices.length) % choices.length];
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

function showAttackCallout(owner, profile) {
  const callout = characterStage.querySelector(`[data-attack-callout="${owner}"]`);
  if (!callout) return;
  const character = characterFor(owner);
  callout.textContent = profile === "small" ? character.smallMove : character.bigMove;
  callout.classList.add("is-visible");
  clearTimeout(attackCalloutTimers[owner]);
  attackCalloutTimers[owner] = setTimeout(() => {
    callout.classList.remove("is-visible");
  }, 1200);
}

function buildResourceHud() {
  resourceBoard.innerHTML = "";
  resourceEls = new Map();
  [
    { owner: "player", title: "P1", color: colors.head },
    { owner: "computer", title: "P2", color: colors.computerHead }
  ].forEach(group => {
    const panel = document.createElement("div");
    panel.className = "resource-panel";
    panel.dataset.owner = group.owner;
    panel.innerHTML = `
          <div class="resource-title">
            <span class="resource-owner"><span class="owner-name ${group.owner === "player" ? "is-p1" : "is-p2"}">${group.title}</span></span>
            <span class="resource-counters" data-total="${group.owner}">
              <span class="resource-chip" data-resource="energy" data-energy-chip="${group.owner}" title="?賡?">
                <span class="resource-icon energy-icon" aria-hidden="true"></span>
                <span class="resource-chip-track" data-energy-track="${group.owner}" role="meter" aria-label="?賡?" aria-valuemin="0">
                  <span class="resource-chip-fill" data-energy-fill="${group.owner}"></span>
                </span>
                <span class="resource-chip-value" data-energy-value="${group.owner}">0/0</span>
              </span>
              <span class="resource-chip" data-resource="bomb" data-bomb-chip="${group.owner}" title="?詨?">
                <span class="resource-icon missile-icon" aria-hidden="true"></span>
                <span class="resource-chip-track" data-bomb-track="${group.owner}" role="meter" aria-label="?詨?" aria-valuemin="0">
                  <span class="resource-chip-fill" data-bomb-fill="${group.owner}"></span>
                </span>
                <span class="resource-chip-value" data-bomb-value="${group.owner}">0/0</span>
              </span>
            </span>
          </div>
        `;
    foodTypes.forEach(type => {
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
  resourceBoard.querySelectorAll("[data-count], [data-fill]").forEach(el => {
    if (el.dataset.count) resourceEls.set(`${el.dataset.count}-count`, el);
    if (el.dataset.fill) resourceEls.set(`${el.dataset.fill}-fill`, el);
  });
  resourceBoard.querySelectorAll("[data-energy-chip], [data-energy-track], [data-energy-fill], [data-energy-value], [data-bomb-chip], [data-bomb-track], [data-bomb-fill], [data-bomb-value]").forEach(el => {
    const entry = Object.entries(el.dataset)[0];
    if (!entry) return;
    const [key, owner] = entry;
    resourceEls.set(`${owner}-${key}`, el);
  });
}

function emptyStock() {
  return Object.fromEntries(foodTypes.map(type => [type.id, 0]));
}

function startingStock() {
  if (!gmMode) return emptyStock();
  return Object.fromEntries(foodTypes.map(type => [type.id, clampInitialStock(initialStock[type.id])]));
}

function startingEnergy() {
  return gmMode ? clampInitialEnergy(initialEnergy) : defaultSettings.initialEnergy;
}

function startingBombs() {
  return gmMode ? clampInitialBombs(initialBombs) : defaultSettings.initialBombs;
}

function foodBonus(stock, typeId, perPoint, maxBonus) {
  return Math.min(maxBonus, stock[typeId] * perPoint);
}

function moveMultiplier(stock) {
  return 1 + foodBonus(stock, "fiber", moveBonusPerPoint, maxMoveBonus);
}

function movementSpeed(stock) {
  const foodSpeedBonus = moveMultiplier(stock) - 1;
  return gmMode ? initialSpeed + foodSpeedBonus : initialSpeed * moveMultiplier(stock);
}

function damageMultiplier(stock) {
  return 2 + foodBonus(stock, "fat", damageBonusPerPoint, maxDamageBonus);
}

function areaMultiplier(stock) {
  return 1 + foodBonus(stock, "protein", proteinRangeBonusPerPoint, 1);
}

function attackSpeedMultiplier(stock) {
  return 1 + foodBonus(stock, "carb", attackSpeedBonusPerPoint, maxAttackSpeedBonus);
}

function attackStunChance(stock) {
  return Math.min(1, baseAttackStunChance + foodBonus(stock, "carb", attackStunChanceBonusPerPoint, maxAttackStunChanceBonus));
}

function moveInterval(stock) {
  return baseStepMs / movementSpeed(stock);
}

function moveIntervalFor(owner, now) {
  const stock = owner === "player" ? playerStock : computerStock;
  const slowUntil = owner === "player" ? playerSlowUntil : computerSlowUntil;
  const speedScale = isPlayerAutoControlActive() ? computerBattleSpeed : 1;
  return moveInterval(stock) * (now < slowUntil ? 2 : 1) / speedScale;
}

function isMovementStunned(owner, now) {
  return now < (owner === "player" ? playerStunUntil : computerStunUntil);
}

function attackDelay(stock) {
  return baseAttackDelayMs / attackSpeedMultiplier(stock);
}

function attackCooldown(stock) {
  return baseAttackCooldownMs / attackSpeedMultiplier(stock);
}

function blastRadius(stock) {
  return baseBlastHexRadius * areaMultiplier(stock);
}

function attackFoodCost(profile = "big") {
  return profile === "small" ? 1 : 2;
}

function attackBombCost(profile = "big") {
  return profile === "small" ? 0 : bigAttackBombCost;
}

function hasAttackFoodCost(stock, profile = "big") {
  const cost = attackFoodCost(profile);
  return foodTypes.every(type => stock[type.id] >= cost);
}

function ammoFor(owner) {
  return owner === "player" ? playerAmmo : computerAmmo;
}

function ammoChargeFor(owner) {
  return owner === "player" ? playerAmmoCharge : computerAmmoCharge;
}

function canAttack(owner, profile = "big") {
  const stock = owner === "player" ? playerStock : computerStock;
  return ammoFor(owner) >= attackBombCost(profile) && hasAttackFoodCost(stock, profile);
}

function convertFullEnergyToAmmo(owner) {
  if (ammoChargeFor(owner) < attackNeedTotal || ammoFor(owner) >= maxAmmo) return false;
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
  foodTypes.forEach(type => {
    stock[type.id] = Math.max(0, stock[type.id] - cost);
  });
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

function collectFood(owner, food) {
  const stock = owner === "player" ? playerStock : computerStock;
  const types = foodTypeIds(food);
  if (types.includes("black")) {
    const randomType = foodTypes[Math.floor(Math.random() * foodTypes.length)];
    addStock(stock, randomType.id, 1);
    addAmmoCharge(owner, blackFoodEnergy);
    return;
  }
  const stockGain = types.length > 1 ? dualColorStockGain : singleColorStockGain;
  types.forEach(typeId => addStock(stock, typeId, stockGain));
  addAmmoCharge(owner, foodEnergy);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
