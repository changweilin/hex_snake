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
      { id: "protein", label: "蛋白", name: "蛋白質", foodName: "紅色食物", effect: "爆炸半徑由 2 連續成長到 4，小數部分會讓最外圈承受對應比例傷害", color: "#ef4444", line: "#fecaca" },
      { id: "fat", label: "油脂", name: "油脂", foodName: "黃色食物", effect: "攻擊傷害係數基礎 2，滿庫存約 3.4", color: "#facc15", line: "#fef08a" },
      { id: "fiber", label: "纖維", name: "纖維素", foodName: "綠色食物", effect: "提升移動速度，滿庫存約 1.8x", color: "#22c55e", line: "#bbf7d0" },
      { id: "carb", label: "碳水", name: "碳水", foodName: "藍色食物", effect: "提升攻擊施展與冷卻速度，並提高命中暈眩機率", color: "#3b82f6", line: "#bfdbfe" }
    ];
    const blackFoodType = { id: "black", label: "蠱食", name: "蠱食", foodName: "黑色食物", effect: "特殊食物；吃下後紅黃綠藍隨機一種庫存 +1，並獲得 3 點能量", color: "#050505", line: "#e5e7eb" };
    const foodTypeById = new Map([...foodTypes, blackFoodType].map(type => [type.id, type]));
    const foodLabels = {
      balanced: "均衡",
      protein: "紅色食物",
      fat: "黃色食物",
      fiber: "綠色食物",
      carb: "藍色食物",
      black: "黑色食物"
    };
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
    let lastPlayerAttackMs = -Infinity;
    let lastComputerAttackMs = -Infinity;
    let rafId = 0;
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
    let moduleHoldTimer = null;
    let attackPointerLongPressTimer = null;
    let portraitPoseTimers = {};
    let attackCalloutTimers = {};
    let selectedPortraitOwner = "player";
    let highlightedAttackProfile = null;
    let attackHighlightReleaseTimer = null;
    let moveStickReboundTimer = null;
    let introDetailsOpen = false;
    let portraitLightboxOwner = "player";
    let portraitSwipeStartX = null;
    let portraitSwipeStartY = null;
    let portraitSwipeOwner = null;
    let portraitInfoSwipeStartX = null;
    let portraitInfoSwipeStartY = null;
    let portraitIntroDidSwipe = false;
    let portraitLightboxDidSwipe = false;
    const portraitVariantModes = ["human", "beast", "chibi"];
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
        : "chibi";
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

    function characterStyle(character, owner = null) {
      const ownerVars = owner
        ? `--owner-color:${ownerMeta(owner).color};--owner-line:${ownerMeta(owner).line};`
        : "";
      return `--fighter-color:${character.color};--fighter-line:${character.line};--fighter-accent:${character.accent};${ownerVars}`;
    }

    const characterMoveGuides = {
      dragon: {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "按大招鍵或點「大招」會快速朝敵方頭部施放；也可在棋盤長按指定落點。白龍會放出繞場靈息彈，沿路命中敵方蛇身時爆發，最後在路徑終點再爆發一次。",
        tip: "長按棋盤可把終點放在敵方蛇身密集處；快速施放則適合追擊頭部。"
      },
      sandworm: {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "按大招鍵或點「大招」會快速朝敵方頭部施放；也可在棋盤長按指定突襲格。沙蟲會潛地延遲突襲，命中頭部可直接擊倒，命中身體會造成麻痺。",
        tip: "長按棋盤可預判敵方頭部下一步；施放後有短暫潛地時間，可用來躲開危險。"
      },
      quetzal: {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "按大招鍵、點「大招」，或在棋盤長按都會施放；羽蛇會沿自身蛇身留下持續傷害的藤沼區域，不需要指定落點。",
        tip: "適合在敵方靠近你身體或追逐時施放，用身體路徑封鎖空間。"
      },
      moray: {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "在棋盤拖曳可指定電擊起點與方向，放開施放；按大招鍵或點「大招」則快速朝敵方頭部方向施放。大招模式下也可按方向盤方向鍵施放直線電擊。",
        tip: "棋盤拖曳時，拖曳方向比落點更重要；沿敵方身體長軸掃線最容易命中多段。"
      },
      lobster: {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "在棋盤拖曳可指定出拳方向，放開施放；按大招鍵或點「大招」則快速朝敵方頭部方向施放。大招模式下也可按方向盤方向鍵打出連拳路徑。",
        tip: "拖曳方向從自己頭部出拳；對準敵方頭部或彎折蛇身，連續兩波更容易打滿。"
      },
      gu_king: {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "按大招鍵或點「大招」會快速朝敵方頭部施放；也可在棋盤長按指定毒爆中心。蠱王會在同一目標連續落下三段毒爆。",
        tip: "長按棋盤可瞄準敵方必經格或被迫轉向的位置，讓連續三段覆蓋逃跑路線。"
      }
    };

    function moveGuideFor(character) {
      return characterMoveGuides[character.id] || {
        small: "按小招鍵、點「小招」，或在棋盤短點一下；會自動鎖定敵方頭部並在短延遲後爆破。",
        big: "按大招鍵或點「大招」會快速朝敵方頭部施放；也可在棋盤長按或拖曳觸發角色大招。",
        tip: "觀察敵方路線後再決定快速施放或手動指定，命中率會更高。"
      };
    }

    function characterStoryMarkup(character) {
      const motto = character.motto ? `<p class="portrait-motto">「${character.motto}」</p>` : "";
      const moves = character.smallMove && character.bigMove
        ? `<div class="portrait-moves" aria-label="${character.name}招式與食補效果"><span>小招：${character.smallMove}</span><span>大招：${character.bigMove}</span><span>食補效果：${character.detail}</span></div>`
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

    function weightedFoodIconMarkup(character) {
      if (character?.specialFood === "black") {
        return foodIconGroupMarkup("black", "加權產出黑色食物");
      }
      if (character?.food === "balanced") {
        return foodIconGroupMarkup(foodTypes.map(type => type.id), "均衡產出紅黃綠藍食物");
      }
      return foodIconGroupMarkup(character?.food, `加權產出${character.foodLabel}`);
    }

    function buildRulesContent() {
      const foodLegend = foodTypes.map(type => `
        <li class="rule-food-line">
          ${foodIconGroupMarkup(type.id, `自然產出${type.foodName}`)}
          <span><b>${type.foodName}</b>: ${type.name}，${type.effect}</span>
        </li>
      `).join("");
      const specialFoodLegend = `
        <li class="rule-food-line">
          ${foodIconGroupMarkup("black", blackFoodType.foodName)}
          <span><b>${blackFoodType.foodName}</b>: ${blackFoodType.name}，${blackFoodType.effect}；不會自然產出。</span>
        </li>
      `;
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
                <span class="rules-character-role">${character.foodLabel}專精</span>
              </span>
              <span class="rule-move-line"><b>小招操作：</b>${guide.small}</span>
              <span class="rule-move-line"><b>大招操作：</b>${guide.big}</span>
              <span class="rule-move-line"><b>實戰重點：</b>${guide.tip}</span>
              <span class="rule-food-effect">食補效果：${weightedFoodIconMarkup(character)}<span>${character.detail}</span></span>
            </span>
          </li>
        `;
      }).join("");
      rulesContent.innerHTML = `
        <section class="rules-block">
          <h3>遊戲流程</h3>
          <ul class="rules-list">
            <li>P1 與 P2 會在六角棋盤上持續前進，吃食物累積分數、食物庫存與能量。</li>
            <li>被炸彈爆炸命中會扣除 HP，並有 ${Math.round(baseAttackStunChance * 100)}% 基礎機率暈眩；HP 歸零才會結束本局。撞擊不會直接死亡，而是造成麻痺與減速。</li>
          </ul>
        </section>
        <section class="rules-block">
          <h3>操作</h3>
          <ul class="rules-list">
            <li><b>鍵盤</b>：預設 W/E/D/X/Z/A 對應六方向；Q 小招、R 大招、空白鍵暫停、T 投降，可在設定中改鍵。</li>
            <li><b>觸控</b>：點六邊方向鍵可直接轉向；長按中心後拖曳可用搖桿控制方向。</li>
            <li><b>棋盤手勢</b>：短點棋盤會施放小招並鎖定敵方頭部；長按棋盤會施放大招，拖曳棋盤也會切成大招。可指定落點的角色會使用手勢位置，方向型大招會使用拖曳方向。</li>
            <li><b>快速施放</b>：按小招鍵 / 大招鍵，或點「小招」/「大招」按鈕，會直接以敵方頭部為快速目標。電鰻與智蝦的大招也可在大招模式下按方向盤方向鍵，沿該方向施放。</li>
          </ul>
        </section>
        <section class="rules-block">
          <h3>食物與資源</h3>
          <ul class="rules-list">
            ${foodLegend}
            ${specialFoodLegend}
            <li><b>食物收益</b>：單色食物給同色庫存 2 點；雙色食物給兩色各 1 點；每次吃食仍只增加 1 分與 1 段蛇身。</li>
            <li><b>能量</b>：每吃 1 個食物獲得 2 點能量，集滿 ${attackNeedTotal} 點獲得 1 枚炸彈；炸彈最多 ${maxAmmo} 枚，也是大招施放資源。若炸彈已滿，滿格能量會保留，直到施放消耗炸彈的招式後立即轉為 1 枚炸彈。</li>
            <li><b>施放成本</b>：小招需紅黃綠藍四種庫存各至少 1 點，施放後各消耗 1；大招需 ${bigAttackBombCost} 枚炸彈，且四種庫存各至少 2 點，施放後消耗 ${bigAttackBombCost} 枚炸彈並使四種庫存各消耗 2。</li>
            <li><b>庫存上限</b>：每種食物最多累積 ${maxFoodStock} 點；一般專精角色只影響補貨偏好，特殊角色可能產出專屬食物。</li>
            <li><b>撞擊懲罰</b>：撞到另一方會停止 ${collisionStunMs / 1000} 秒，再減速 ${collisionSlowMs / 1000} 秒；撞到自己懲罰加倍，累積停止時間超過 ${maxCollisionParalysisMs / 1000} 秒會落敗。</li>
          </ul>
        </section>
        <section class="rules-block">
          <h3>角色</h3>
          <ul class="rules-character-list">
            ${characterLegend}
          </ul>
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
      overlay.classList.remove("intro-details");
      overlayTitle.hidden = !visible;
      overlayText.hidden = !visible;
      startButton.hidden = !visible;
      computerBattleButton.hidden = !visible || (running && !gameOver);
      replayArchiveButton.hidden = !visible;
      introCloseButton.hidden = true;
    }

    function setIntroLobbyChrome() {
      overlay.classList.remove("intro-details");
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
      const nextMode = mode === "full" ? "human" : portraitVariantModes.includes(mode) ? mode : "chibi";
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
      module.innerHTML = fighterPortraitImage(character, pose);
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
              <span class="resource-chip" data-energy-chip="${group.owner}" title="?賡?">
                <span class="resource-icon energy-icon" aria-hidden="true"></span>
                <span class="resource-chip-track" data-energy-track="${group.owner}" role="meter" aria-label="?賡?" aria-valuemin="0">
                  <span class="resource-chip-fill" data-energy-fill="${group.owner}"></span>
                </span>
                <span class="resource-chip-value" data-energy-value="${group.owner}">0/0</span>
              </span>
              <span class="resource-chip" data-bomb-chip="${group.owner}" title="?詨?">
                <span class="resource-icon missile-icon" aria-hidden="true"></span>
                <span class="resource-chip-track" data-bomb-track="${group.owner}" role="meter" aria-label="?詨?" aria-valuemin="0">
                  <span class="resource-chip-fill" data-bomb-fill="${group.owner}" style="--resource-chip-color: #facc15"></span>
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
        resourceEls.set(el.dataset.count || el.dataset.fill || el.dataset.total, el);
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
