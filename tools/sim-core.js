const fs = require("fs");
const path = require("path");

const FOOD_TYPES = ["protein", "fat", "fiber", "carb"];
const DRAGON_ORB_STEP_MS = 45;
const DRAGON_ORB_RADIUS_MULTIPLIER = 1;
const DRAGON_ORB_CURVE_MULTIPLIER = 1;
const DRAGON_BURST_RADIUS_MULTIPLIER = 2;
const DRAGON_BURST_DAMAGE_MULTIPLIER = 1.5;
const FOOD_TARGET_SWITCH_MS = 20000;
const DEAD_END_MIN_SPACE = 5;
const DIRECTIONS = [
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 }
];

function hashSeed(input) {
  let hash = 2166136261;
  const text = String(input ?? "hex-snake");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  let state = hashSeed(seed);
  return {
    next() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.next() * max);
    },
    item(items) {
      return items[this.int(items.length)];
    }
  };
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadBalance(root = path.resolve(__dirname, "..")) {
  return loadJson(path.join(root, "data", "balance.json"));
}

function loadCharacters(root = path.resolve(__dirname, "..")) {
  return loadJson(path.join(root, "data", "characters.json"));
}

function loadHighAiStrategies(root = path.resolve(__dirname, "..")) {
  const filePath = path.join(root, "data", "high-ai-strategies.json");
  if (!fs.existsSync(filePath)) return {};
  const file = loadJson(filePath);
  const rows = file.strategies || file.bestStrategies || file;
  if (Array.isArray(rows)) {
    return Object.fromEntries(rows
      .filter(row => row.characterId && row.characterId !== "universal")
      .map(row => [row.characterId, row.strategyWeights || row]));
  }
  return Object.fromEntries(Object.entries(rows)
    .map(([characterId, row]) => [characterId, row.strategyWeights || row]));
}

function keyOf(cell) {
  return `${cell.q},${cell.r}`;
}

function cellKeySet(cellList = []) {
  return new Set(cellList.map(cell => keyOf(cell)));
}

function hexDistance(a, b) {
  const as = -a.q - a.r;
  const bs = -b.q - b.r;
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(as - bs)) / 2;
}

function createBoard(gridSize) {
  const radius = gridSize - 1;
  const cells = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) <= radius) cells.push({ q, r });
    }
  }
  return { radius, cells };
}

function isInside(cell, radius) {
  return Math.abs(cell.q) <= radius && Math.abs(cell.r) <= radius && Math.abs(cell.q + cell.r) <= radius;
}

function nextCell(head, direction) {
  const delta = DIRECTIONS[direction];
  return { q: head.q + delta.q, r: head.r + delta.r };
}

function nextWrappedCell(head, direction, radius) {
  const next = nextCell(head, direction);
  if (isInside(next, radius)) return next;
  const oppositeDirection = (direction + 3) % 6;
  let wrapped = head;
  while (isInside(nextCell(wrapped, oppositeDirection), radius)) {
    wrapped = nextCell(wrapped, oppositeDirection);
  }
  return wrapped;
}

function createStartingSnake(head, direction, length, radius) {
  const segments = [{ ...head }];
  let cursor = { ...head };
  const bodyDirection = (direction + 3) % 6;
  const used = new Set([keyOf(cursor)]);
  while (segments.length < length) {
    const next = nextWrappedCell(cursor, bodyDirection, radius);
    if (used.has(keyOf(next))) break;
    segments.push(next);
    used.add(keyOf(next));
    cursor = next;
  }
  return segments;
}

function emptyStock() {
  return Object.fromEntries(FOOD_TYPES.map(type => [type, 0]));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampWeight(value, fallback = 1) {
  const number = Number(value);
  return clamp(Number.isFinite(number) ? number : fallback, 0, 3);
}

function mergeWeights(defaults, overrides = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
    key,
    clampWeight(overrides[key], fallback)
  ]));
}

function wrappedDistance(state, start, target) {
  if (!start || !target) return Number.POSITIVE_INFINITY;
  if (keyOf(start) === keyOf(target)) return 0;
  const seen = new Set([keyOf(start)]);
  const queue = [{ cell: start, distance: 0 }];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (let direction = 0; direction < DIRECTIONS.length; direction += 1) {
      const next = nextWrappedCell(current.cell, direction, state.radius);
      const nextKey = keyOf(next);
      if (seen.has(nextKey)) continue;
      if (nextKey === keyOf(target)) return current.distance + 1;
      seen.add(nextKey);
      queue.push({ cell: next, distance: current.distance + 1 });
    }
  }
  return hexDistance(start, target);
}

function addStock(stock, typeId, amount, balance) {
  stock[typeId] = clamp((stock[typeId] || 0) + amount, 0, balance.resources.maxFoodStock);
}

function foodBonus(stock, typeId, perPoint, maxBonus) {
  return Math.min(maxBonus, (stock[typeId] || 0) * perPoint);
}

function moveMultiplier(stock, balance) {
  return 1 + foodBonus(stock, "fiber", balance.movement.moveBonusPerPoint, balance.movement.maxMoveBonus);
}

function damageMultiplier(stock, balance) {
  return 2 + foodBonus(stock, "fat", balance.attack.damageBonusPerPoint, balance.attack.maxDamageBonus);
}

function areaMultiplier(stock, balance) {
  const perPoint = balance.attack.proteinRangeBonusPerPoint ?? (1 / balance.resources.maxFoodStock);
  return 1 + foodBonus(stock, "protein", perPoint, balance.attack.maxProteinRangeBonus ?? 1);
}

function attackSpeedMultiplier(stock, balance) {
  return 1 + foodBonus(stock, "carb", balance.attack.attackSpeedBonusPerPoint, balance.attack.maxAttackSpeedBonus);
}

function attackStunChance(stock, balance) {
  return Math.min(1, balance.attack.baseAttackStunChance + foodBonus(stock, "carb", balance.attack.attackStunChanceBonusPerPoint, balance.attack.maxAttackStunChanceBonus));
}

function moveInterval(fighter, balance, now) {
  const slowScale = now < fighter.slowUntil ? 2 : 1;
  return balance.movement.baseStepMs * slowScale / (fighter.initialSpeed * moveMultiplier(fighter.stock, balance));
}

function attackDelay(stock, balance) {
  return balance.attack.baseAttackDelayMs / attackSpeedMultiplier(stock, balance);
}

function attackCooldown(stock, balance) {
  return balance.attack.baseAttackCooldownMs / attackSpeedMultiplier(stock, balance);
}

function blastRadius(stock, balance) {
  return balance.attack.baseBlastHexRadius * areaMultiplier(stock, balance);
}

function attackFoodCost(profile = "big") {
  return profile === "small" ? 1 : 2;
}

function attackBombCost(profile, balance) {
  return profile === "small" ? 0 : balance.attack.bigAttackBombCost;
}

function hasAttackFoodCost(stock, profile) {
  const cost = attackFoodCost(profile);
  return FOOD_TYPES.every(type => (stock[type] || 0) >= cost);
}

function canAttack(fighter, profile, balance) {
  return fighter.ammo >= attackBombCost(profile, balance) && hasAttackFoodCost(fighter.stock, profile);
}

function attackStats(stock, profile, balance) {
  const isSmall = profile === "small";
  return {
    delay: attackDelay(stock, balance) * (isSmall ? 0.62 : 1),
    radius: Math.max(1, blastRadius(stock, balance) + (isSmall ? -1 : 0)),
    damage: damageMultiplier(stock, balance) * (isSmall ? 0.55 : 1)
  };
}

function bandDistanceFromTotalWidth(totalWidth) {
  return Math.max(0, Math.floor((totalWidth - 1) / 2));
}

function consumeAttackCost(fighter, profile, balance) {
  const cost = attackFoodCost(profile);
  FOOD_TYPES.forEach(type => {
    fighter.stock[type] = Math.max(0, fighter.stock[type] - cost);
  });
  fighter.ammo = Math.max(0, fighter.ammo - attackBombCost(profile, balance));
}

function addAmmoCharge(fighter, amount, balance) {
  fighter.ammoCharge += amount;
  if (fighter.ammoCharge >= balance.resources.attackNeedTotal) {
    if (fighter.ammo < balance.resources.maxAmmo) {
      fighter.ammo = Math.min(balance.resources.maxAmmo, fighter.ammo + 1);
      fighter.ammoCharge = 0;
    } else {
      fighter.ammoCharge = balance.resources.attackNeedTotal;
    }
  }
}

function randomFoodType(preferredFoodId, balance, rng) {
  if (!preferredFoodId || preferredFoodId === "balanced") return rng.item(FOOD_TYPES);
  let roll = rng.next();
  for (const type of FOOD_TYPES) {
    const weight = type === preferredFoodId ? balance.foodWeights.preferred : balance.foodWeights.other;
    if (roll < weight) return type;
    roll -= weight;
  }
  return FOOD_TYPES[FOOD_TYPES.length - 1];
}

function randomFoodTypeIdsForCharacter(character, balance, rng) {
  if (character?.specialFood === "black" && rng.next() < balance.foodWeights.blackSpecialChance) return ["black"];
  if (character?.specialFood === "black") return [randomFoodType(null, balance, rng)];
  const preferredFoodId = character?.foodPreference || "balanced";
  const first = randomFoodType(preferredFoodId, balance, rng);
  if (preferredFoodId !== "balanced" || rng.next() >= balance.foodWeights.balancedDualChance) return [first];
  const second = rng.item(FOOD_TYPES.filter(type => type !== first));
  return [first, second];
}

function collectFood(fighter, food, balance, rng) {
  if (food.types.includes("black")) {
    addStock(fighter.stock, rng.item(FOOD_TYPES), 1, balance);
    addAmmoCharge(fighter, balance.resources.blackFoodEnergy, balance);
    return;
  }
  const gain = food.types.length > 1 ? balance.resources.dualColorStockGain : balance.resources.singleColorStockGain;
  food.types.forEach(type => addStock(fighter.stock, type, gain, balance));
  addAmmoCharge(fighter, balance.resources.foodEnergy, balance);
}

function damageSnake(parts, target, radius, damageScale, balance) {
  const falloff = balance.attack.rangeDamageFalloffEnabled ? balance.attack.baseBlastHexRadius / Math.max(balance.attack.baseBlastHexRadius, radius) : 1;
  const wholeRadius = Math.floor(radius);
  const outerRingRatio = Math.max(0, Math.min(1, radius - wholeRadius));
  const outerRingDistance = wholeRadius + 1;
  return parts.reduce((total, segment) => {
    const distance = hexDistance(segment, target);
    if (distance > radius) {
      if (outerRingRatio > 0 && distance === outerRingDistance) {
        return total + damageScale * falloff * outerRingRatio;
      }
      return total;
    }
    const hitChance = Math.max(0, Math.min(1, 1 - distance / radius));
    return total + damageScale * falloff * hitChance;
  }, 0);
}

function damageSnakeFlat(parts, target, radius, damageScale) {
  return parts.reduce((total, segment) => hexDistance(segment, target) <= radius ? total + damageScale : total, 0);
}

function damageSnakeCells(parts, effectCells, width, damageScale, excludedCells = [], minDistance = 0) {
  const excluded = cellKeySet(excludedCells);
  return parts.reduce((total, segment) => {
    if (excluded.has(keyOf(segment))) return total;
    return effectCells.some(cell => {
      const distance = hexDistance(segment, cell);
      return distance >= minDistance && distance <= width;
    }) ? total + damageScale : total;
  }, 0);
}

function buildCharacterMap(characters) {
  return new Map(characters.map(character => [character.id, character]));
}

function makePolicy(overrides = {}) {
  const inferredDifficulty = overrides.aiDifficulty
    || (overrides.skillStrategy === "spamSmall" ? "low" : overrides.skillStrategy === "preferBig" ? "high" : "medium");
  const strategyWeights = normalizeStrategyWeights(overrides);
  return {
    pathPrecision: clamp(Number(overrides.pathPrecision ?? 0.82), 0, 1),
    aimPrecision: clamp(Number(overrides.aimPrecision ?? 0.78), 0, 1),
    skillStrategy: overrides.skillStrategy || "balanced",
    foodStrategy: overrides.foodStrategy || "balanced",
    aiDifficulty: ["novice", "low", "medium", "high"].includes(inferredDifficulty) ? inferredDifficulty : "medium",
    strategyId: overrides.strategyId,
    characterStrategyId: overrides.characterStrategyId,
    hasCustomStrategyWeights: Boolean(overrides.strategyWeights),
    strategyWeights
  };
}

function ultimateSetting(balance, characterId, key, fallback) {
  const value = balance.attack?.ultimates?.[characterId]?.[key];
  return Number.isFinite(value) ? value : fallback;
}

function ultimateDamageMultiplier(balance, characterId) {
  return ultimateSetting(balance, characterId, "damageMultiplier", 1);
}

function bigAttackAbilityId(characterId) {
  if (characterId === "dragon") return "lobster";
  if (characterId === "lobster") return "dragon";
  return characterId;
}

function normalizeStrategyWeights(overrides = {}) {
  const provided = overrides.strategyWeights || {};
  const foodStrategy = overrides.foodStrategy || "balanced";
  const skillStrategy = overrides.skillStrategy || "balanced";
  const difficulty = overrides.aiDifficulty
    || (skillStrategy === "spamSmall" ? "low" : skillStrategy === "preferBig" ? "high" : "medium");
  const defaults = {
    movement: {
      safePath: difficulty === "high" ? 1.6 : difficulty === "low" ? 0.9 : 1.2,
      leastDamage: difficulty === "high" ? 1.3 : 1,
      fastestArrival: difficulty === "low" ? 1.3 : 1
    },
    food: {
      fastestArrival: 1,
      ownDeficit: foodStrategy === "selfStockpile" ? 1.6 : 0.8,
      opponentDeficit: foodStrategy === "denyOpponent" ? 1.5 : 0.45,
      ownPreferred: foodStrategy === "preferredFood" ? 1.8 : difficulty === "high" ? 1.1 : 0.75,
      opponentPreferred: foodStrategy === "denyOpponent" ? 1.4 : 0.35
    },
    skillAllocation: {
      preferSmall: skillStrategy === "spamSmall" ? 2.1 : skillStrategy === "preferBig" || skillStrategy === "saveBurst" ? 0.45 : 1,
      preferBig: skillStrategy === "preferBig" || skillStrategy === "saveBurst" ? 2.1 : skillStrategy === "spamSmall" ? 0.45 : 1
    },
    castTiming: {
      lethal: 3,
      nearFullEnergy: skillStrategy === "saveBurst" ? 1.6 : 0.75,
      opponentDebuffed: difficulty === "low" ? 0.4 : 1.25,
      opponentAlmostReady: difficulty === "high" ? 1.2 : 0.65,
      nearOpponent: difficulty === "high" ? 1.15 : 0.85,
      farOpponent: skillStrategy === "preferBig" ? 0.75 : 0.35
    },
    castTarget: {
      targetHead: 1.3,
      bodyCluster: difficulty === "high" ? 1.2 : 0.8,
      targetNearestFood: difficulty === "high" ? 0.8 : 0.5
    },
    castDirection: {
      selfHeadToOpponentHead: 1.4,
      opponentBodyLongestAxis: difficulty === "high" ? 1.1 : 0.7,
      opponentHeadToNearestFood: difficulty === "high" ? 0.8 : 0.4
    }
  };
  return {
    movement: mergeWeights(defaults.movement, provided.movement),
    food: mergeWeights(defaults.food, provided.food),
    skillAllocation: mergeWeights(defaults.skillAllocation, provided.skillAllocation),
    castTiming: mergeWeights(defaults.castTiming, provided.castTiming),
    castTarget: mergeWeights(defaults.castTarget, provided.castTarget),
    castDirection: mergeWeights(defaults.castDirection, provided.castDirection)
  };
}

function makeFighter(owner, character, start, direction, settings, balance, policy) {
  if (policy.aiDifficulty === "high" && !policy.hasCustomStrategyWeights) {
    const highStrategyWeights = balance.highAiStrategies?.[character.id];
    if (highStrategyWeights) {
      policy.strategyId = policy.strategyId || "high-ai-default";
      policy.characterStrategyId = policy.characterStrategyId || `${character.id}:high-ai-default`;
      policy.strategyWeights = normalizeStrategyWeights({ ...policy, strategyWeights: highStrategyWeights });
      policy.hasCustomStrategyWeights = true;
    }
  }
  const stock = { ...emptyStock(), ...(settings.initialStock || {}) };
  const snake = createStartingSnake(start, direction, settings.initialLength, settings.radius);
  return {
    owner,
    character,
    policy,
    snake,
    dir: direction,
    nextDir: direction,
    hp: snake.length,
    score: 0,
    stock,
    balanceStockCap: balance.resources.maxFoodStock,
    ammo: settings.initialBombs,
    ammoCharge: settings.initialEnergy,
    initialSpeed: settings.initialSpeed,
    lastStep: 0,
    lastAttack: -Infinity,
    stunUntil: 0,
    slowUntil: 0,
    collisionParalysisMs: 0,
    undergroundFrom: 0,
    undergroundUntil: 0,
    lastVisibleSnake: snake.map(segment => ({ ...segment })),
    lastVisibleDir: direction,
    foodTargetKey: null,
    lastFoodAt: 0,
    stats: {
      smallCasts: 0,
      bigCasts: 0,
      damageDealt: 0,
      damageTaken: 0,
      damageTakenByCause: { small: 0, big: 0 },
      stunApplied: 0,
      foodCollected: 0,
      totalStock: 0,
      stockSamples: 0
    }
  };
}

function canTurn(snake, currentDir, newDir) {
  return snake.length < 2 || (newDir + 3) % 6 !== currentDir;
}

const characterAiProfiles = {
  dragon: { role: "rush", preferredFood: "balanced" },
  sandworm: { role: "ambush", preferredFood: "fat" },
  quetzal: { role: "control", preferredFood: "fiber" },
  moray: { role: "status", preferredFood: "carb" },
  lobster: { role: "melee", preferredFood: "protein" },
  gu_king: { role: "burst", preferredFood: "black" }
};

function aiProfileFor(fighter) {
  return characterAiProfiles[fighter.character.id] || { role: "balanced", preferredFood: fighter.character.foodPreference };
}

function isUnderground(fighter, now) {
  return fighter.character.id === "sandworm" && fighter.undergroundFrom && now >= fighter.undergroundFrom && now <= fighter.undergroundUntil;
}

function updateVisibleMemory(state) {
  Object.values(state.fighters || {}).forEach(fighter => {
    if (!isUnderground(fighter, state.now)) {
      fighter.lastVisibleSnake = fighter.snake.map(segment => ({ ...segment }));
      fighter.lastVisibleDir = fighter.dir;
    }
  });
}

function perceivedSnakeFor(state, observer, target) {
  if (!isUnderground(target, state.now)) return target.snake;
  return (target.lastVisibleSnake && target.lastVisibleSnake.length ? target.lastVisibleSnake : target.snake).map(segment => ({ ...segment }));
}

function isDebuffed(fighter, now) {
  return now < fighter.stunUntil || now < fighter.slowUntil || fighter.collisionParalysisMs > 0;
}

function hasResourcePressure(fighter, balance) {
  const stockCap = balance.resources.maxFoodStock;
  const nearStockCap = FOOD_TYPES.some(type => (fighter.stock[type] || 0) >= stockCap - 2);
  const ammoFull = fighter.ammo >= balance.resources.maxAmmo && fighter.ammoCharge >= balance.resources.attackNeedTotal - 1;
  return nearStockCap || ammoFull;
}

function strongestVisibleDamage(state, attacker, defender, balance, profile) {
  const stats = attackStats(attacker.stock, profile, balance);
  const targetSnake = perceivedSnakeFor(state, attacker, defender);
  const head = targetSnake[0];
  const candidates = cellsWithinDistance(state, head, 0, Math.max(1, Math.ceil(stats.radius + 1)));
  return candidates.reduce((best, cell) => Math.max(best, damageSnake(targetSnake, cell, stats.radius, stats.damage, balance)), 0);
}

function isOpponentConstrained(state, opponent) {
  const occupied = new Set(opponent.snake.slice(0, -1).map(keyOf));
  const exits = DIRECTIONS.filter((_, direction) => {
    if (!canTurn(opponent.snake, opponent.dir, direction)) return false;
    return !occupied.has(keyOf(nextWrappedCell(opponent.snake[0], direction, state.radius)));
  });
  return exits.length <= 2;
}

function hasRoleBigOpportunity(state, fighter, opponent, balance) {
  const profile = aiProfileFor(fighter);
  const perceived = perceivedSnakeFor(state, fighter, opponent);
  const distance = hexDistance(fighter.snake[0], perceived[0]);
  if (profile.role === "rush") return distance <= 4 || isOpponentConstrained(state, opponent);
  if (profile.role === "ambush") return distance >= 2 && distance <= 5;
  if (profile.role === "control") return distance <= 5 || state.foods.some(food => hexDistance(food, perceived[0]) <= 2);
  if (profile.role === "status") return isDebuffed(opponent, state.now) || strongestVisibleDamage(state, fighter, opponent, balance, "small") > 0;
  if (profile.role === "melee") return distance <= 2;
  if (profile.role === "burst") return hasResourcePressure(fighter, balance) || fighter.ammo >= balance.resources.maxAmmo;
  return distance <= 3;
}

function isLethalAttack(state, fighter, opponent, balance, profile) {
  return canAttack(fighter, profile, balance) && strongestVisibleDamage(state, fighter, opponent, balance, profile) >= opponent.hp;
}

function attackResourceCost(profile, balance) {
  return attackFoodCost(profile) * FOOD_TYPES.length + attackBombCost(profile, balance) * FOOD_TYPES.length;
}

function opponentAlmostReady(opponent, balance) {
  if (canAttack(opponent, "small", balance) || canAttack(opponent, "big", balance)) return true;
  const stockClose = FOOD_TYPES.every(type => (opponent.stock[type] || 0) >= Math.max(0, attackFoodCost("small") - 1));
  const ammoClose = opponent.ammo >= balance.attack.bigAttackBombCost - 1 || opponent.ammoCharge >= balance.resources.attackNeedTotal - 1;
  return stockClose || ammoClose;
}

function castTimingScore(state, fighter, opponent, balance, profile) {
  const weights = fighter.policy.strategyWeights.castTiming;
  const perceived = perceivedSnakeFor(state, fighter, opponent);
  const distance = hexDistance(fighter.snake[0], perceived[0]);
  let score = 0;
  if (isLethalAttack(state, fighter, opponent, balance, profile)) score += weights.lethal * 3;
  if (fighter.ammo >= balance.resources.maxAmmo || fighter.ammoCharge >= balance.resources.attackNeedTotal - 1) score += weights.nearFullEnergy;
  if (isDebuffed(opponent, state.now)) score += weights.opponentDebuffed;
  if (opponentAlmostReady(opponent, balance)) score += weights.opponentAlmostReady;
  if (distance <= 3) score += weights.nearOpponent * (4 - distance) / 3;
  if (distance >= 5) score += weights.farOpponent * Math.min(1, (distance - 4) / 4);
  return score;
}

function shouldUseBigAttack(state, fighter, opponent, balance) {
  if (!canAttack(fighter, "big", balance)) return false;
  if (isLethalAttack(state, fighter, opponent, balance, "big")) return true;
  const difficulty = fighter.policy.aiDifficulty;
  if (difficulty === "low") {
    const distance = hexDistance(fighter.snake[0], perceivedSnakeFor(state, fighter, opponent)[0]);
    return !canAttack(fighter, "small", balance) || hasResourcePressure(fighter, balance) || distance <= 2 && state.rng.next() < 0.35 || state.rng.next() < 0.18;
  }
  if (difficulty === "medium" || difficulty === "high") {
    const lethal = strongestVisibleDamage(state, fighter, opponent, balance, "big") >= opponent.hp;
    return isDebuffed(opponent, state.now) || lethal || hasResourcePressure(fighter, balance) || (difficulty === "high" && hasRoleBigOpportunity(state, fighter, opponent, balance));
  }
  return false;
}

function foodValueFor(fighter, opponent, food, policy, state = null) {
  const ownDistance = state ? wrappedDistance(state, fighter.snake[0], food) : hexDistance(fighter.snake[0], food);
  const opponentDistance = state ? wrappedDistance(state, opponent.snake[0], food) : hexDistance(opponent.snake[0], food);
  const types = food.types || [];
  const aiProfile = aiProfileFor(fighter);
  const opponentProfile = aiProfileFor(opponent);
  const preferredFood = aiProfile.preferredFood || fighter.character.foodPreference;
  const opponentPreferredFood = opponentProfile.preferredFood || opponent.character.foodPreference;
  const weights = policy.strategyWeights.food;
  const normalizedTypes = types.includes("black") ? FOOD_TYPES : types.filter(type => FOOD_TYPES.includes(type));
  const ownDeficit = normalizedTypes.reduce((sum, type) => sum + (fighter.balanceStockCap ?? 20) - (fighter.stock[type] || 0), 0) / Math.max(1, normalizedTypes.length);
  const opponentDeficit = normalizedTypes.reduce((sum, type) => sum + (fighter.balanceStockCap ?? 20) - (opponent.stock[type] || 0), 0) / Math.max(1, normalizedTypes.length);
  const ownPrefers = preferredFood === "balanced"
    ? normalizedTypes.length > 0
    : preferredFood === "black" ? types.includes("black") : types.includes(preferredFood);
  const opponentPrefers = opponentPreferredFood === "balanced"
    ? normalizedTypes.length > 0
    : opponentPreferredFood === "black" ? types.includes("black") : types.includes(opponentPreferredFood);
  return (
    weights.fastestArrival * (1 / (1 + ownDistance)) * 10 +
    weights.ownDeficit * ownDeficit / 5 +
    weights.opponentDeficit * opponentDeficit / 6 +
    weights.ownPreferred * (ownPrefers ? 2.5 : 0) +
    weights.opponentPreferred * (opponentPrefers ? 2 : 0) +
    (opponentDistance <= ownDistance ? weights.opponentDeficit * 0.35 : 0)
  );
}

function chooseFoodTarget(state, fighter, opponent) {
  const perceivedOpponent = perceivedSnakeFor(state, fighter, opponent);
  const distance = wrappedDistance(state, fighter.snake[0], perceivedOpponent[0]);
  if (fighter.policy.aiDifficulty === "high") {
    const role = aiProfileFor(fighter).role;
    if ((role === "rush" && distance <= 5) || (role === "melee" && distance <= 3)) return perceivedOpponent[0];
    if (role === "ambush" && canAttack(fighter, "big", state.balance) && distance <= 5) {
      const flank = cellsWithinDistance(state, perceivedOpponent[0], 1, 2).sort((a, b) => hexDistance(a, fighter.snake[0]) - hexDistance(b, fighter.snake[0]))[0];
      if (flank) return flank;
    }
  }
  if (!state.foods.length) return perceivedOpponent[0];
  const staleTarget = fighter.foodTargetKey && state.now - fighter.lastFoodAt >= FOOD_TARGET_SWITCH_MS ? fighter.foodTargetKey : null;
  const choices = state.foods.filter(food => keyOf(food) !== staleTarget);
  const filteredChoices = filterUnsafeFoodTargets(state, fighter, opponent, choices.length ? choices : state.foods);
  const target = [...(filteredChoices.length ? filteredChoices : choices.length ? choices : state.foods)]
    .sort((a, b) => foodValueFor(fighter, opponent, b, fighter.policy, state) - foodValueFor(fighter, opponent, a, fighter.policy, state))[0];
  fighter.foodTargetKey = target ? keyOf(target) : null;
  return target;
}

function movementOccupiedSet(state, fighter, opponent) {
  const occupied = new Set(fighter.snake.slice(0, -1).map(keyOf));
  const perceivedOpponent = perceivedSnakeFor(state, fighter, opponent);
  if (fighter.policy.pathPrecision > 0.35 && !isUnderground(opponent, state.now)) perceivedOpponent.forEach(segment => occupied.add(keyOf(segment)));
  return occupied;
}

function filterUnsafeFoodTargets(state, fighter, opponent, foods) {
  if (foods.length <= 1) return foods;
  const occupied = movementOccupiedSet(state, fighter, opponent);
  const withRace = foods.map(food => ({
    food,
    raceGap: wrappedDistance(state, opponent.snake[0], food) - wrappedDistance(state, fighter.snake[0], food),
    reachable: reachableSpace(state, food, occupied, DEAD_END_MIN_SPACE)
  }));
  const maxPositiveGap = Math.max(0, ...withRace.map(row => row.raceGap));
  const filtered = withRace
    .filter(row => !(maxPositiveGap > 0 && row.raceGap === maxPositiveGap))
    .filter(row => row.reachable >= DEAD_END_MIN_SPACE)
    .map(row => row.food);
  return filtered.length ? filtered : foods;
}

function directionToward(state, fighter, opponent, target) {
  const occupied = movementOccupiedSet(state, fighter, opponent);
  const perceivedOpponent = perceivedSnakeFor(state, fighter, opponent);
  const options = [];
  DIRECTIONS.forEach((_, direction) => {
    if (!canTurn(fighter.snake, fighter.dir, direction)) return;
    const next = nextWrappedCell(fighter.snake[0], direction, state.radius);
    const key = keyOf(next);
    const selfBlocked = fighter.snake.slice(0, -1).some(segment => keyOf(segment) === key);
    const opponentBlocked = perceivedOpponent.some(segment => keyOf(segment) === key);
    const blocked = selfBlocked || opponentBlocked || occupied.has(key);
    const reachable = reachableSpace(state, next, occupied, 10);
    const wallSpace = state.cells.filter(cell => hexDistance(cell, next) <= 1 && !occupied.has(keyOf(cell))).length;
    const expectedDamage = expectedDamageAt(state, fighter, next);
    const weights = fighter.policy.strategyWeights.movement;
    const trapRisk = Math.max(0, 5 - reachable);
    const deadEnd = reachable < DEAD_END_MIN_SPACE;
    const lethalThreat = expectedDamage >= fighter.hp;
    const risk = (selfBlocked ? 100 : 0) + (opponentBlocked ? 35 : 0) + trapRisk * 4 + expectedDamage;
    options.push({
      direction,
      blocked,
      deadEnd,
      lethalThreat,
      risk,
      score: weights.fastestArrival * wrappedDistance(state, next, target)
        + weights.safePath * risk
        + weights.leastDamage * expectedDamage
        - wallSpace * 0.04
    });
  });
  const viable = options.length ? options : [{ direction: fighter.dir, score: 0, blocked: false }];
  const hardSafe = viable.filter(option => !option.blocked && !option.deadEnd && !option.lethalThreat);
  const safe = hardSafe.length ? hardSafe : viable.filter(option => !option.blocked && !option.lethalThreat && option.risk < 20);
  const candidates = safe.length ? safe : viable;
  candidates.sort((a, b) => a.score - b.score || a.risk - b.risk);
  if (state.rng.next() > fighter.policy.pathPrecision) return state.rng.item(viable).direction;
  return candidates[0].direction;
}

function reachableSpace(state, start, occupied, maxCells = 10) {
  if (occupied.has(keyOf(start))) return 0;
  const seen = new Set([keyOf(start)]);
  const queue = [start];
  while (queue.length && seen.size < maxCells) {
    const cell = queue.shift();
    DIRECTIONS.forEach((_, direction) => {
      const next = nextWrappedCell(cell, direction, state.radius);
      const key = keyOf(next);
      if (seen.has(key) || occupied.has(key)) return;
      seen.add(key);
      queue.push(next);
    });
  }
  return seen.size;
}

function expectedDamageAt(state, fighter, cell) {
  const opponentOwner = fighter.owner === "player" ? "computer" : "player";
  let damage = 0;
  state.projectiles.forEach(projectile => {
    if (projectile.owner !== opponentOwner) return;
    if (projectile.kind === "line") {
      if (projectile.lineCells?.some(lineCell => hexDistance(lineCell, cell) <= projectile.width)) damage += projectile.damage || 0;
      return;
    }
    const target = projectile.explosionTarget || projectile.target;
    if (target && hexDistance(cell, target) <= (projectile.radius || 0)) damage += projectile.damage || 0;
  });
  state.hazards.forEach(hazard => {
    if (hazard.owner !== opponentOwner || state.now > hazard.endAt) return;
    if (hazard.kind === "radiation" && hexDistance(cell, hazard.target) <= hazard.radius) damage += hazard.damage || 0;
    if (hazard.cells?.some(hazardCell => hexDistance(hazardCell, cell) <= hazard.width)) damage += hazard.damage || 0;
  });
  return damage;
}

function cellsWithinDistance(state, origin, minDistance, maxDistance) {
  return state.cells.filter(cell => {
    const distance = hexDistance(cell, origin);
    return distance >= minDistance && distance <= maxDistance;
  });
}

function nearestFoodDistanceForState(state, cell) {
  if (!state.foods.length) return Number.POSITIVE_INFINITY;
  return Math.min(...state.foods.map(food => wrappedDistance(state, cell, food)));
}

function nearestFoodForState(state, cell) {
  if (!state.foods.length) return null;
  return [...state.foods].sort((a, b) => wrappedDistance(state, cell, a) - wrappedDistance(state, cell, b))[0];
}

function bestBodyClusterTarget(state, targetSnake, stats, balance) {
  if (!targetSnake.length) return null;
  return [...state.cells].sort((a, b) => {
    const damageDiff = damageSnake(targetSnake, b, stats.radius, stats.damage, balance) - damageSnake(targetSnake, a, stats.radius, stats.damage, balance);
    if (damageDiff) return damageDiff;
    return wrappedDistance(state, targetSnake[0], a) - wrappedDistance(state, targetSnake[0], b);
  })[0];
}

function attackTargetDamageScore(state, targetSnake, target, stats, balance) {
  return damageSnake(targetSnake, target, stats.radius, stats.damage, balance);
}

function attackTargetCandidates(state, attacker, defender, balance, profile) {
  const stats = attackStats(attacker.stock, profile, balance);
  const targetSnake = perceivedSnakeFor(state, attacker, defender);
  const head = targetSnake[0];
  const nearestFood = nearestFoodForState(state, head);
  return {
    stats,
    targetSnake,
    targetHead: head,
    bodyCluster: bestBodyClusterTarget(state, targetSnake, stats, balance) || head,
    targetNearestFood: nearestFood || head
  };
}

function directionForLongestBodyAxis(targetSnake, fallbackDirection = 0) {
  if (!targetSnake.length) return fallbackDirection;
  const values = targetSnake.map(cell => ({ q: cell.q, r: cell.r, s: -cell.q - cell.r }));
  const rangeFor = axis => Math.max(...values.map(value => value[axis])) - Math.min(...values.map(value => value[axis]));
  const axis = ["q", "r", "s"].sort((a, b) => rangeFor(b) - rangeFor(a))[0];
  const head = values[0];
  const tailAverage = values.slice(1).reduce((sum, value) => sum + value[axis], 0) / Math.max(1, values.length - 1);
  const positive = tailAverage >= head[axis];
  if (axis === "q") return positive ? 2 : 5;
  if (axis === "r") return positive ? 3 : 0;
  return positive ? 4 : 1;
}

function chooseAttackDirection(state, attacker, defender, target, fallbackDirection = attacker.dir) {
  const targetSnake = perceivedSnakeFor(state, attacker, defender);
  const targetHead = targetSnake[0] || target;
  const nearestFood = nearestFoodForState(state, targetHead);
  const weights = attacker.policy.strategyWeights.castDirection;
  const candidates = [
    {
      direction: directionFromSourceToTarget(attacker.snake[0], targetHead, fallbackDirection),
      weight: weights.selfHeadToOpponentHead
    },
    {
      direction: directionForLongestBodyAxis(targetSnake, fallbackDirection),
      weight: weights.opponentBodyLongestAxis
    },
    {
      direction: nearestFood ? directionFromSourceToTarget(targetHead, nearestFood, fallbackDirection) : fallbackDirection,
      weight: nearestFood ? weights.opponentHeadToNearestFood : 0
    }
  ];
  candidates.sort((a, b) => b.weight - a.weight || turnDistance(a.direction, directionFromSourceToTarget(attacker.snake[0], target, fallbackDirection)) - turnDistance(b.direction, directionFromSourceToTarget(attacker.snake[0], target, fallbackDirection)));
  return candidates[0].direction;
}

function chooseAttackProfile(stateOrFighter, fighterOrBalance, opponentOrRng, maybeBalance) {
  if (maybeBalance) return chooseAiAttackProfile(stateOrFighter, fighterOrBalance, opponentOrRng, maybeBalance);
  const fighter = stateOrFighter;
  const balance = fighterOrBalance;
  const rng = opponentOrRng;
  const strategy = fighter.policy.skillStrategy;
  if (strategy === "spamSmall") return canAttack(fighter, "small", balance) ? "small" : canAttack(fighter, "big", balance) ? "big" : null;
  if (strategy === "preferBig") return canAttack(fighter, "big", balance) ? "big" : canAttack(fighter, "small", balance) ? "small" : null;
  if (strategy === "saveBurst") return canAttack(fighter, "big", balance) ? "big" : null;
  if (canAttack(fighter, "big", balance) && (!rng || rng.next() < 0.55)) return "big";
  return canAttack(fighter, "small", balance) ? "small" : null;
}

function chooseAiAttackProfile(state, fighter, opponent, balance) {
  if (fighter.policy.aiDifficulty === "novice") return null;
  const lethal = ["small", "big"]
    .filter(profile => isLethalAttack(state, fighter, opponent, balance, profile))
    .sort((a, b) => attackResourceCost(a, balance) - attackResourceCost(b, balance))[0];
  if (lethal) return lethal;
  if (fighter.policy.aiDifficulty === "low" && shouldUseBigAttack(state, fighter, opponent, balance)) return "big";

  const available = ["small", "big"].filter(profile => canAttack(fighter, profile, balance));
  if (!available.length) return null;
  const allocation = fighter.policy.strategyWeights.skillAllocation;
  const scored = available.map(profile => {
    const allocationScore = profile === "small" ? allocation.preferSmall : allocation.preferBig;
    const timingScore = castTimingScore(state, fighter, opponent, balance, profile);
    const legacyBoost = profile === "big" && shouldUseBigAttack(state, fighter, opponent, balance) ? 1.25 : 0;
    return { profile, score: allocationScore + timingScore + legacyBoost };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.profile === "big") {
    if (fighter.policy.skillStrategy === "saveBurst") return best.score >= 2.1 ? "big" : null;
    return best.score >= 1.8 ? "big" : canAttack(fighter, "small", balance) ? "small" : null;
  }
  if (best.score >= 0.9 || fighter.policy.aiDifficulty === "low") return best.profile;
  if (fighter.policy.aiDifficulty === "low" && canAttack(fighter, "big", balance)) return "big";
  return null;
}

function chooseAttackTarget(state, attacker, defender, balance, profile) {
  const { stats, targetSnake, targetHead, bodyCluster, targetNearestFood } = attackTargetCandidates(state, attacker, defender, balance, profile);
  const maxDamageTarget = bestBodyClusterTarget(state, targetSnake, stats, balance) || targetHead;
  if (attackTargetDamageScore(state, targetSnake, maxDamageTarget, stats, balance) >= defender.hp) return { ...maxDamageTarget };
  const weights = attacker.policy.strategyWeights.castTarget;
  const weighted = [
    { target: targetHead, weight: weights.targetHead },
    { target: bodyCluster, weight: weights.bodyCluster },
    { target: targetNearestFood, weight: state.foods.length ? weights.targetNearestFood : 0 }
  ].filter(item => item.target);
  weighted.sort((a, b) => {
    const aDamage = attackTargetDamageScore(state, targetSnake, a.target, stats, balance);
    const bDamage = attackTargetDamageScore(state, targetSnake, b.target, stats, balance);
    const aScore = a.weight * 2 + aDamage * 0.8 + (aDamage > 0 ? 0.5 : -2);
    const bScore = b.weight * 2 + bDamage * 0.8 + (bDamage > 0 ? 0.5 : -2);
    if (aScore !== bScore) return bScore - aScore;
    return wrappedDistance(state, targetHead, a.target) - wrappedDistance(state, targetHead, b.target);
  });
  if (state.rng.next() <= attacker.policy.aimPrecision) return { ...weighted[0].target };
  const missRadius = 1 + Math.floor((1 - attacker.policy.aimPrecision) * 3);
  const loose = cellsWithinDistance(state, targetHead, missRadius, missRadius + 2);
  return { ...(loose.length ? state.rng.item(loose) : targetHead) };
}

function directionFromSourceToTarget(source, target, fallbackDirection = 0) {
  let bestDirection = fallbackDirection;
  let bestDistance = Infinity;
  DIRECTIONS.forEach((_, direction) => {
    const distance = hexDistance(nextCell(source, direction), target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDirection = direction;
    }
  });
  return bestDirection;
}

function turnDistance(left, right) {
  const clockwise = (right - left + DIRECTIONS.length) % DIRECTIONS.length;
  return Math.min(clockwise, DIRECTIONS.length - clockwise);
}

function dragonTrackingDirection(state, cursor, direction, targetSnake, visited, curveMultiplier = DRAGON_ORB_CURVE_MULTIPLIER) {
  const target = targetSnake[0];
  if (!target) return direction;
  const idealDirection = directionFromSourceToTarget(cursor, target, direction);
  const maxTurn = Math.max(0, Math.min(3, Math.ceil(2 * Math.max(0, curveMultiplier))));
  const candidates = [direction];
  for (let turn = 1; turn <= maxTurn; turn += 1) {
    candidates.push((direction + turn) % DIRECTIONS.length, (direction - turn + DIRECTIONS.length) % DIRECTIONS.length);
  }
  candidates.sort((a, b) => {
    const nextA = nextWrappedCell(cursor, a, state.radius);
    const nextB = nextWrappedCell(cursor, b, state.radius);
    const distanceA = hexDistance(nextA, target) + (visited.has(keyOf(nextA)) ? 0.35 : 0);
    const distanceB = hexDistance(nextB, target) + (visited.has(keyOf(nextB)) ? 0.35 : 0);
    if (distanceA !== distanceB) return distanceA - distanceB;
    return turnDistance(a, idealDirection) - turnDistance(b, idealDirection);
  });
  return candidates[0];
}

function cellsForwardFrom(state, source, direction, includeSource = true) {
  const path = includeSource ? [{ ...source }] : [];
  let cursor = source;
  while (true) {
    const next = nextCell(cursor, direction);
    if (!isInside(next, state.radius)) break;
    path.push(next);
    cursor = next;
  }
  return path;
}

function boardLineThrough(state, origin, direction) {
  let start = origin;
  const opposite = (direction + 3) % 6;
  while (isInside(nextCell(start, opposite), state.radius)) start = nextCell(start, opposite);
  return cellsForwardFrom(state, start, direction, true);
}

function dragonChargePath(state, source, direction, targetSnake) {
  const targetCells = cellKeySet(targetSnake);
  const path = [];
  let cursor = source;
  let carryAfterHit = false;
  while (isInside(cursor, state.radius)) {
    path.push({ ...cursor });
    if (carryAfterHit) break;
    if (targetCells.has(keyOf(cursor))) carryAfterHit = true;
    cursor = nextCell(cursor, direction);
  }
  return path;
}

function dragonOrbPath(state, source, direction) {
  return cellsForwardFrom(state, source, direction, false);
}

function dragonWrappedOrbPath(state, source, direction) {
  const path = [];
  let cursor = { ...source };
  const maxSteps = Math.max(1, state.cells.length);
  for (let step = 0; step < maxSteps; step += 1) {
    cursor = nextWrappedCell(cursor, direction, state.radius);
    if (keyOf(cursor) === keyOf(source)) break;
    path.push({ ...cursor });
  }
  return path;
}

function dragonTrackingOrbPath(state, source, direction, targetSnake, curveMultiplier = DRAGON_ORB_CURVE_MULTIPLIER) {
  const path = [];
  const visited = new Set([keyOf(source)]);
  let cursor = { ...source };
  let currentDirection = direction;
  const maxSteps = Math.max(1, Math.ceil((state.radius * 2 + 1) / 2));
  for (let step = 0; step < maxSteps; step += 1) {
    if (step > 0) {
      currentDirection = dragonTrackingDirection(state, cursor, currentDirection, targetSnake, visited, curveMultiplier);
    }
    cursor = nextWrappedCell(cursor, currentDirection, state.radius);
    if (keyOf(cursor) === keyOf(source)) break;
    path.push({ ...cursor });
    visited.add(keyOf(cursor));
  }
  return path;
}

function pathHits(path, targetSnake) {
  const targetCells = cellKeySet(targetSnake);
  return path
    .map((cell, index) => ({ cell, index }))
    .filter(hit => targetCells.has(keyOf(hit.cell)));
}

function pushCircleAttack(state, attack) {
  state.projectiles.push({ kind: "circle", ...attack });
}

function scheduleBigAttack(state, attacker, defender, target, now, balance, stunChance, aimDirection = null) {
  const small = attackStats(attacker.stock, "small", balance);
  const source = attacker.snake[0];
  const direction = Number.isInteger(aimDirection) ? aimDirection : directionFromSourceToTarget(source, target, attacker.dir);
  const characterId = attacker.character.id;
  const abilityId = bigAttackAbilityId(characterId);
  if (abilityId === "dragon") {
    const curveMultiplier = ultimateSetting(balance, abilityId, "orbCurveMultiplier", DRAGON_ORB_CURVE_MULTIPLIER);
    const path = dragonTrackingOrbPath(state, source, direction, defender.snake, curveMultiplier);
    const hits = pathHits(path, defender.snake);
    const endCell = path[path.length - 1] || source;
    const orbStepMs = ultimateSetting(balance, abilityId, "orbStepMs", DRAGON_ORB_STEP_MS);
    const orbRadius = small.radius * ultimateSetting(balance, abilityId, "orbRadiusMultiplier", DRAGON_ORB_RADIUS_MULTIPLIER);
    const isLobsterPalm = characterId === "lobster";
    const burstRadius = small.radius * (isLobsterPalm ? 1.5 : ultimateSetting(balance, abilityId, "burstRadiusMultiplier", DRAGON_BURST_RADIUS_MULTIPLIER));
    const burstDamage = small.damage * (isLobsterPalm ? 0.9 : ultimateSetting(balance, abilityId, "burstDamageMultiplier", DRAGON_BURST_DAMAGE_MULTIPLIER));
    const volleys = isLobsterPalm ? 2 : 1;
    const orbDamage = small.damage * (isLobsterPalm ? 0.3 : 1);
    for (let volley = 0; volley < volleys; volley += 1) {
      const volleyDelay = volley * 500;
      state.projectiles.push({
        kind: "dragonOrb",
        owner: attacker.owner,
        profile: "big",
        target: { ...endCell },
        pathCells: path,
        impactAt: now + volleyDelay + small.delay + path.length * orbStepMs,
        radius: orbRadius,
        damage: orbDamage,
        burstRadius,
        burstDamage,
        stunChance
      });
      for (const hit of hits) {
        state.projectiles.push({
          kind: "dragonOrbBurst",
          owner: attacker.owner,
          profile: "big",
          target: { ...hit.cell },
          impactAt: now + volleyDelay + small.delay + (hit.index + 1) * orbStepMs,
          radius: orbRadius,
          damage: orbDamage,
          burstRadius,
          burstDamage,
          stunChance
        });
      }
    }
    return;
  }
  if (characterId === "moray") {
    const lineCells = boardLineThrough(state, target, direction);
    const excludedCells = attacker.snake.map(segment => ({ ...segment }));
    for (let index = 0; index < 4; index += 1) {
      state.projectiles.push({
        kind: "line",
        owner: attacker.owner,
        profile: "big",
        target,
        lineCells,
        excludedCells,
        width: bandDistanceFromTotalWidth(small.radius),
        impactAt: now + small.delay + index * 320,
        damage: small.damage * 0.6 * ultimateDamageMultiplier(balance, characterId),
        stunChance,
        stackStun: true
      });
    }
    return;
  }
  if (characterId === "quetzal") {
    const trail = attacker.snake.map(segment => ({ ...segment }));
    const outwardWidth = Math.max(1, bandDistanceFromTotalWidth(small.radius));
    state.hazards.push({
      kind: "swamp",
      owner: attacker.owner,
      cells: trail,
      damageExcludedCells: trail,
      width: outwardWidth,
      minDistance: 1,
      damage: small.damage * ultimateDamageMultiplier(balance, characterId),
      profile: "big",
      stunChance,
      startedAt: now + small.delay,
      nextTickAt: now + small.delay,
      tickMs: moveInterval(attacker, balance, now),
      endAt: now + small.delay + 2500
    });
    return;
  }
  if (characterId === "sandworm") {
    const delay = small.delay * 2;
    attacker.undergroundFrom = now + Math.max(0, delay - 1000);
    attacker.undergroundUntil = now + delay + 1000;
    pushCircleAttack(state, {
      owner: attacker.owner,
      profile: "big",
      target,
      impactAt: now + delay,
      radius: Math.max(0.5, small.radius * 0.5),
      damage: small.damage * 3.5 * ultimateDamageMultiplier(balance, characterId),
      stunChance,
      sandwormParalyzeOnHead: true
    });
    return;
  }
  if (abilityId === "lobster") {
    const big = attackStats(attacker.stock, "big", balance);
    const lobsterUltimateRadius = small.radius * ultimateSetting(balance, abilityId, "radiusMultiplier", 2.5);
    const volleys = characterId === "dragon" ? 1 : 2;
    const damageScale = characterId === "dragon" ? 1.5 : 1;
    const impactDamage = characterId === "dragon" ? small.damage * 1.5 : big.damage * damageScale;
    const radiationTotalDamage = characterId === "dragon" ? small.damage * 1.5 : impactDamage;
    const firstImpactDelay = characterId === "dragon" ? small.delay / 1.5 : small.delay;
    for (let index = 0; index < volleys; index += 1) {
      const impactDelay = firstImpactDelay + index * 2000;
      state.projectiles.push({
        kind: "headCircle",
        owner: attacker.owner,
        profile: "big",
        target: { ...target },
        impactAt: now + impactDelay,
        radius: lobsterUltimateRadius,
        damage: impactDamage,
        radiationDurationMs: 4000,
        radiationTickMs: 500,
        radiationTotalDamage,
        stunChance,
        flat: true
      });
    }
    return;
  }
  if (characterId === "gu_king") {
    const volleyIntervalMs = 180;
    const firstImpactDelay = small.delay / 2;
    for (let index = 0; index < 3; index += 1) {
      const impactDelay = firstImpactDelay + index * volleyIntervalMs;
      pushCircleAttack(state, {
        owner: attacker.owner,
        profile: "big",
        target,
        impactAt: now + impactDelay,
        radius: small.radius,
        damage: small.damage * ultimateDamageMultiplier(balance, characterId),
        stunChance
      });
    }
    return;
  }
  const big = attackStats(attacker.stock, "big", balance);
  pushCircleAttack(state, { owner: attacker.owner, profile: "big", target, impactAt: now + big.delay, radius: big.radius, damage: big.damage * ultimateDamageMultiplier(balance, characterId), stunChance });
}

function launchAttack(state, attacker, defender, profile, now, balance) {
  if (!canAttack(attacker, profile, balance)) return false;
  const cooldownScale = profile === "small" ? 0.58 : 1;
  if (now - attacker.lastAttack < attackCooldown(attacker.stock, balance) * cooldownScale) return false;
  const target = chooseAttackTarget(state, attacker, defender, balance, profile);
  const stats = attackStats(attacker.stock, profile, balance);
  const stunChance = attackStunChance(attacker.stock, balance);
  consumeAttackCost(attacker, profile, balance);
  attacker.lastAttack = now;
  if (profile === "small") {
    pushCircleAttack(state, { owner: attacker.owner, profile, target, impactAt: now + stats.delay, radius: stats.radius, damage: stats.damage, stunChance });
    attacker.stats.smallCasts += 1;
  } else {
    const aimDirection = chooseAttackDirection(state, attacker, defender, target, attacker.dir);
    scheduleBigAttack(state, attacker, defender, target, now, balance, stunChance, aimDirection);
    attacker.stats.bigCasts += 1;
  }
  return true;
}

function controlledFatalCause(target, cause, now) {
  if ((cause === "small" || cause === "big") && (now < target.stunUntil || now < target.slowUntil)) return "stunLocked";
  return cause;
}

function recordFatalEvent(state, target, cause, now) {
  state.fatalEvents.push({
    owner: target.owner,
    characterId: target.character.id,
    cause,
    atMs: now
  });
}

function applyDamage(state, target, damage, cause, now) {
  if (damage <= 0) return;
  const beforeHp = target.hp;
  if (cause === "small" || cause === "big") target.stats.damageTakenByCause[cause] += damage;
  target.hp = Math.max(0, target.hp - damage);
  target.stats.damageTaken += damage;
  if (beforeHp > 0 && target.hp <= 0) recordFatalEvent(state, target, controlledFatalCause(target, cause, now), now);
}

function applyAttackStun(state, target, chance, now, balance, options = {}) {
  if (state.rng.next() >= chance) return false;
  const stunBase = options.stack ? Math.max(now, target.stunUntil) : now;
  target.stunUntil = Math.max(target.stunUntil, stunBase + balance.attack.attackStunMs);
  target.slowUntil = Math.max(target.slowUntil, target.stunUntil + balance.attack.attackSlowMs);
  return true;
}

function applyCollisionParalysis(target, now, balance) {
  target.stunUntil = Math.max(target.stunUntil, now + balance.collision.collisionStunMs);
  target.slowUntil = Math.max(target.slowUntil, target.stunUntil + balance.collision.collisionSlowMs);
}

function resolveProjectiles(state, now, balance) {
  const landed = state.projectiles.filter(projectile => now >= projectile.impactAt);
  if (!landed.length) return;
  state.projectiles = state.projectiles.filter(projectile => now < projectile.impactAt);
  for (const projectile of landed) {
    const attacker = state.fighters[projectile.owner];
    const defenderOwner = projectile.owner === "player" ? "computer" : "player";
    const defender = state.fighters[defenderOwner];
    const player = state.fighters.player;
    const computer = state.fighters.computer;
    let playerDamage = 0;
    let computerDamage = 0;
    if (projectile.kind === "dragonOrb") {
      continue;
    } else if (projectile.kind === "dragonOrbBurst") {
      const defenderDamage = damageSnake(defender.snake, projectile.target, projectile.radius, projectile.damage, balance);
      if (defenderOwner === "player") playerDamage += defenderDamage;
      else computerDamage += defenderDamage;
      playerDamage += damageSnake(player.snake, projectile.target, projectile.burstRadius, projectile.burstDamage, balance);
      computerDamage += damageSnake(computer.snake, projectile.target, projectile.burstRadius, projectile.burstDamage, balance);
    } else if (projectile.kind === "line") {
      playerDamage = damageSnakeCells(player.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells);
      computerDamage = damageSnakeCells(computer.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells);
    } else {
      if (projectile.kind === "headCircle" && projectile.followHead) {
        projectile.explosionTarget = { ...attacker.snake[0] };
        projectile.target = { ...projectile.explosionTarget };
      }
      const explosionTarget = projectile.explosionTarget || projectile.target;
      const damageFn = projectile.flat ? damageSnakeFlat : damageSnake;
      playerDamage = damageFn(player.snake, explosionTarget, projectile.radius, projectile.damage, balance);
      computerDamage = damageFn(computer.snake, explosionTarget, projectile.radius, projectile.damage, balance);
      if (projectile.kind === "headCircle" && projectile.radiationDurationMs) {
        const ticks = Math.max(1, Math.ceil(projectile.radiationDurationMs / projectile.radiationTickMs));
        state.hazards.push({
          kind: "radiation",
          owner: projectile.owner,
          target: { ...explosionTarget },
          radius: projectile.radius,
          damage: projectile.radiationTotalDamage / ticks,
          profile: "big",
          stunChance: projectile.stunChance,
          startedAt: now,
          nextTickAt: now + projectile.radiationTickMs,
          tickMs: projectile.radiationTickMs,
          endAt: now + projectile.radiationDurationMs
        });
      }
      if (projectile.sandwormParalyzeOnHead) {
        if (projectile.owner !== "player" && keyOf(projectile.target) === keyOf(player.snake[0])) applyCollisionParalysis(player, now, balance);
        if (projectile.owner !== "computer" && keyOf(projectile.target) === keyOf(computer.snake[0])) applyCollisionParalysis(computer, now, balance);
      }
    }
    if (projectile.owner === "player") playerDamage = 0;
    if (projectile.owner === "computer") computerDamage = 0;
    applyDamage(state, player, playerDamage, projectile.profile || "big", now);
    applyDamage(state, computer, computerDamage, projectile.profile || "big", now);
    attacker.stats.damageDealt += projectile.owner === "player" ? computerDamage : playerDamage;
    if (projectile.owner !== "player" && playerDamage > 0 && applyAttackStun(state, player, projectile.stunChance, now, balance, { stack: projectile.stackStun })) attacker.stats.stunApplied += 1;
    if (projectile.owner !== "computer" && computerDamage > 0 && applyAttackStun(state, computer, projectile.stunChance, now, balance, { stack: projectile.stackStun })) attacker.stats.stunApplied += 1;
    if (defender.hp <= 0 || attacker.hp <= 0) break;
  }
}

function resolveHazards(state, now, balance) {
  state.hazards = state.hazards.filter(hazard => now <= hazard.endAt);
  for (const hazard of state.hazards) {
    if (now < hazard.startedAt || now < hazard.nextTickAt) continue;
    hazard.nextTickAt = now + hazard.tickMs;
    const attacker = state.fighters[hazard.owner];
    const damageExcludedCells = hazard.damageExcludedCells || hazard.excludedCells || [];
    let playerDamage = hazard.kind === "radiation"
      ? damageSnake(state.fighters.player.snake, hazard.target, hazard.radius, hazard.damage, balance)
      : damageSnakeCells(state.fighters.player.snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "player" ? damageExcludedCells : [], hazard.minDistance || 0);
    let computerDamage = hazard.kind === "radiation"
      ? damageSnake(state.fighters.computer.snake, hazard.target, hazard.radius, hazard.damage, balance)
      : damageSnakeCells(state.fighters.computer.snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "computer" ? damageExcludedCells : [], hazard.minDistance || 0);
    if (hazard.owner === "player") playerDamage = 0;
    if (hazard.owner === "computer") computerDamage = 0;
    applyDamage(state, state.fighters.player, playerDamage, hazard.profile || "big", now);
    applyDamage(state, state.fighters.computer, computerDamage, hazard.profile || "big", now);
    attacker.stats.damageDealt += hazard.owner === "player" ? computerDamage : playerDamage;
    if (hazard.owner !== "player" && playerDamage > 0 && applyAttackStun(state, state.fighters.player, hazard.stunChance, now, balance, { interrupt: false })) attacker.stats.stunApplied += 1;
    if (hazard.owner !== "computer" && computerDamage > 0 && applyAttackStun(state, state.fighters.computer, hazard.stunChance, now, balance, { interrupt: false })) attacker.stats.stunApplied += 1;
  }
}

function placeFoods(state, preferredOwners = []) {
  const occupied = new Set([
    ...state.fighters.player.snake.map(keyOf),
    ...state.fighters.computer.snake.map(keyOf),
    ...state.foods.map(keyOf)
  ]);
  let generated = 0;
  while (state.foods.length < state.settings.foodCount) {
    const openCells = state.cells.filter(cell => !occupied.has(keyOf(cell)));
    if (!openCells.length) return;
    const cell = state.rng.item(openCells);
    const owner = preferredOwners[generated];
    const character = owner ? state.fighters[owner].character : null;
    state.foods.push({ q: cell.q, r: cell.r, types: randomFoodTypeIdsForCharacter(character, state.balance, state.rng) });
    occupied.add(keyOf(cell));
    generated += 1;
  }
}

function collisionSeverity(selfHit, opponentHit) {
  if (selfHit) return 2;
  if (opponentHit) return 1;
  return 0;
}

function applyCollisionPenalty(fighter, severity, now, balance) {
  fighter.stunUntil = Math.max(fighter.stunUntil, now + balance.collision.collisionStunMs * severity);
  fighter.slowUntil = Math.max(fighter.slowUntil, fighter.stunUntil + balance.collision.collisionSlowMs * severity);
  fighter.collisionParalysisMs += balance.collision.collisionStunMs * severity;
  return fighter.collisionParalysisMs > balance.collision.maxCollisionParalysisMs;
}

function defeatByCollisionParalysis(state, fighter, now) {
  if (fighter.hp <= 0) return;
  fighter.hp = 0;
  recordFatalEvent(state, fighter, "collisionParalysis", now);
}

function moveFighters(state, movers, now, balance) {
  const player = state.fighters.player;
  const computer = state.fighters.computer;
  movers.forEach(owner => {
    const fighter = state.fighters[owner];
    const opponent = owner === "player" ? computer : player;
    fighter.nextDir = directionToward(state, fighter, opponent, chooseFoodTarget(state, fighter, opponent));
  });

  const plans = {};
  movers.forEach(owner => {
    const fighter = state.fighters[owner];
    fighter.dir = fighter.nextDir;
    const next = nextWrappedCell(fighter.snake[0], fighter.dir, state.radius);
    const eatenFood = state.foods.find(food => keyOf(food) === keyOf(next));
    plans[owner] = { next, nextKey: keyOf(next), eatenFood, eating: Boolean(eatenFood) };
  });

  let headCollisionOrder = "simultaneous";
  if (plans.player && plans.computer) {
    const playerDueAt = player.lastStep + moveInterval(player, balance, now);
    const computerDueAt = computer.lastStep + moveInterval(computer, balance, now);
    headCollisionOrder = Math.abs(playerDueAt - computerDueAt) < 0.001
      ? "simultaneous"
      : playerDueAt < computerDueAt ? "playerFirst" : "computerFirst";
  }

  movers.forEach(owner => {
    const fighter = state.fighters[owner];
    const opponent = owner === "player" ? computer : player;
    const plan = plans[owner];
    const body = plan.eating ? fighter.snake : fighter.snake.slice(0, -1);
    let opponentBody = opponent.snake;
    if (movers.includes(opponent.owner) && plans[opponent.owner] && !plans[opponent.owner].eating) opponentBody = opponent.snake.slice(0, -1);
    const selfHit = body.some(segment => keyOf(segment) === plan.nextKey);
    let opponentHit = opponentBody.some(segment => keyOf(segment) === plan.nextKey);
    const otherPlan = plans[opponent.owner];
    if (otherPlan && otherPlan.nextKey === plan.nextKey) {
      opponentHit = headCollisionOrder === "simultaneous" || headCollisionOrder !== `${owner}First`;
    }
    if (otherPlan && otherPlan.nextKey === keyOf(fighter.snake[0]) && plan.nextKey === keyOf(opponent.snake[0])) opponentHit = true;
    plan.collision = collisionSeverity(selfHit, opponentHit);
  });

  movers.forEach(owner => {
    const fighter = state.fighters[owner];
    const plan = plans[owner];
    if (plan.collision) {
      if (applyCollisionPenalty(fighter, plan.collision, now, balance)) defeatByCollisionParalysis(state, fighter, now);
      return;
    }
    fighter.snake.unshift(plan.next);
    if (plan.eating) {
      fighter.score += 1;
      fighter.stats.foodCollected += 1;
      fighter.lastFoodAt = now;
      fighter.foodTargetKey = null;
      collectFood(fighter, plan.eatenFood, balance, state.rng);
      fighter.hp = Math.min(fighter.snake.length, fighter.hp + 1);
    } else {
      fighter.snake.pop();
    }
  });

  const eatenKeys = new Set(Object.values(plans).filter(plan => plan.eating && !plan.collision).map(plan => plan.nextKey));
  if (eatenKeys.size) {
    state.foods = state.foods.filter(food => !eatenKeys.has(keyOf(food)));
    placeFoods(state, Object.entries(plans).filter(([, plan]) => plan.eating && !plan.collision).map(([owner]) => owner));
  }
}

function sampleStock(fighter) {
  fighter.stats.totalStock += FOOD_TYPES.reduce((sum, type) => sum + (fighter.stock[type] || 0), 0);
  fighter.stats.stockSamples += 1;
}

function createMatchState(options) {
  const balance = options.balance;
  if (!balance.highAiStrategies) {
    balance.highAiStrategies = loadHighAiStrategies(path.resolve(__dirname, ".."));
  }
  const settings = {
    gridSize: options.gridSize ?? balance.defaults.gridSize,
    foodCount: options.foodCount ?? balance.defaults.foodCount,
    initialSpeed: options.initialSpeed ?? balance.defaults.initialSpeed,
    initialLength: options.initialLength ?? balance.defaults.initialLength,
    initialEnergy: options.initialEnergy ?? balance.defaults.initialEnergy,
    initialBombs: options.initialBombs ?? balance.defaults.initialBombs,
    initialStock: { ...balance.defaults.initialStock, ...(options.initialStock || {}) }
  };
  const board = createBoard(settings.gridSize);
  settings.radius = board.radius;
  const offset = Math.min(2, Math.max(1, board.radius - 3));
  const playerPolicy = makePolicy({ ...balance.playerModel, ...(options.playerModel || {}) });
  const computerPolicy = makePolicy({ ...balance.playerModel, ...(options.computerModel || {}) });
  const state = {
    balance,
    settings,
    radius: board.radius,
    cells: board.cells,
    rng: createRng(options.seed),
    now: 0,
    foods: [],
    projectiles: [],
    hazards: [],
    fatalEvents: [],
    fighters: {}
  };
  state.fighters.player = makeFighter("player", options.playerCharacter, { q: -offset, r: offset }, 0, settings, balance, playerPolicy);
  state.fighters.computer = makeFighter("computer", options.computerCharacter, { q: offset, r: -offset }, 3, settings, balance, computerPolicy);
  placeFoods(state);
  return state;
}

function simulateMatch(options) {
  const state = createMatchState(options);
  const balance = state.balance;
  const maxMatchMs = options.maxMatchMs ?? balance.simulation.maxMatchMs;
  const tickMs = options.tickMs ?? balance.simulation.tickMs;
  while (state.now <= maxMatchMs && state.fighters.player.hp > 0 && state.fighters.computer.hp > 0) {
    state.now += tickMs;
    resolveProjectiles(state, state.now, balance);
    resolveHazards(state, state.now, balance);
    updateVisibleMemory(state);
    for (const [owner, fighter] of Object.entries(state.fighters)) {
      const opponent = owner === "player" ? state.fighters.computer : state.fighters.player;
      if (state.now >= fighter.stunUntil) {
        const profile = chooseAttackProfile(state, fighter, opponent, balance);
        if (profile) launchAttack(state, fighter, opponent, profile, state.now, balance);
      }
      sampleStock(fighter);
    }
    const movers = Object.values(state.fighters)
      .filter(fighter => state.now >= fighter.stunUntil && state.now - fighter.lastStep >= moveInterval(fighter, balance, state.now))
      .map(fighter => fighter.owner);
    if (movers.length) {
      moveFighters(state, movers, state.now, balance);
      movers.forEach(owner => {
        state.fighters[owner].lastStep = state.now;
      });
    }
  }
  const player = state.fighters.player;
  const computer = state.fighters.computer;
  let winner = null;
  if (player.hp > 0 && computer.hp <= 0) winner = "player";
  else if (computer.hp > 0 && player.hp <= 0) winner = "computer";
  else if (player.score !== computer.score) winner = player.score > computer.score ? "player" : "computer";
  const loser = winner ? (winner === "player" ? "computer" : "player") : null;
  const loserFatalEvent = loser ? [...state.fatalEvents].reverse().find(event => event.owner === loser) : null;
  return {
    seed: options.seed,
    winner,
    loser,
    fatalCause: winner ? (loserFatalEvent?.cause || "scoreDecision") : "draw",
    topDamageCause: winner ? topDamageCause(state.fighters[loser]) : "none",
    fatalEvents: state.fatalEvents,
    durationMs: state.now,
    player: summarizeFighter(player, computer),
    computer: summarizeFighter(computer, player)
  };
}

function topDamageCause(fighter) {
  const byCause = fighter.stats.damageTakenByCause;
  if ((byCause.small || 0) <= 0 && (byCause.big || 0) <= 0) return "none";
  return (byCause.big || 0) >= (byCause.small || 0) ? "big" : "small";
}

function summarizeFighter(fighter, opponent) {
  const casts = fighter.stats.smallCasts + fighter.stats.bigCasts;
  return {
    characterId: fighter.character.id,
    hp: Number(fighter.hp.toFixed(3)),
    length: fighter.snake.length,
    score: fighter.score,
    stock: { ...fighter.stock },
    smallCasts: fighter.stats.smallCasts,
    bigCasts: fighter.stats.bigCasts,
    smallCastRate: casts ? fighter.stats.smallCasts / casts : 0,
    damageDealt: Number(fighter.stats.damageDealt.toFixed(3)),
    damageTaken: Number(fighter.stats.damageTaken.toFixed(3)),
    damageTakenByCause: {
      small: Number(fighter.stats.damageTakenByCause.small.toFixed(3)),
      big: Number(fighter.stats.damageTakenByCause.big.toFixed(3))
    },
    stunApplied: fighter.stats.stunApplied,
    foodCollected: fighter.stats.foodCollected,
    averageStock: fighter.stats.stockSamples ? Number((fighter.stats.totalStock / fighter.stats.stockSamples).toFixed(3)) : 0,
    hpDiff: Number((fighter.hp - opponent.hp).toFixed(3)),
    scoreDiff: fighter.score - opponent.score
  };
}

function aggregateMatches(matches, playerCharacterId, computerCharacterId, balance) {
  const total = matches.length || 1;
  const wins = matches.filter(match => match.winner === "player").length;
  const losses = matches.filter(match => match.winner === "computer").length;
  const draws = matches.filter(match => !match.winner).length;
  const avg = selector => matches.reduce((sum, match) => sum + selector(match), 0) / total;
  const playerTotals = matches.reduce((acc, match) => {
    acc.smallCasts += match.player.smallCasts;
    acc.bigCasts += match.player.bigCasts;
    acc.damageDealt += match.player.damageDealt;
    acc.damageTaken += match.player.damageTaken;
    acc.stunApplied += match.player.stunApplied;
    acc.foodCollected += match.player.foodCollected;
    return acc;
  }, { smallCasts: 0, bigCasts: 0, damageDealt: 0, damageTaken: 0, stunApplied: 0, foodCollected: 0 });
  const totalCasts = playerTotals.smallCasts + playerTotals.bigCasts;
  const winRate = wins / total;
  const decisiveGames = wins + losses;
  return {
    playerCharacterId,
    computerCharacterId,
    runs: matches.length,
    wins,
    losses,
    draws,
    winRate,
    drawRate: draws / total,
    decisiveGames,
    decisiveWinRate: decisiveGames ? wins / decisiveGames : 0,
    averageDurationMs: avg(match => match.durationMs),
    averageHpDiff: avg(match => match.player.hpDiff),
    averageScoreDiff: avg(match => match.player.scoreDiff),
    averageDamageDealt: avg(match => match.player.damageDealt),
    averageDamageTaken: avg(match => match.player.damageTaken),
    averageFoodCollected: avg(match => match.player.foodCollected),
    playerSkill: {
      smallCasts: playerTotals.smallCasts,
      bigCasts: playerTotals.bigCasts,
      damageDealt: playerTotals.damageDealt,
      damageTaken: playerTotals.damageTaken,
      foodCollected: playerTotals.foodCollected,
      smallCastRate: totalCasts ? playerTotals.smallCasts / totalCasts : 0,
      damagePerCast: totalCasts ? playerTotals.damageDealt / totalCasts : 0,
      stunPerCast: totalCasts ? playerTotals.stunApplied / totalCasts : 0,
      resourceEfficiency: totalCasts ? playerTotals.damageDealt / (playerTotals.smallCasts * 4 + playerTotals.bigCasts * (8 + balance.attack.bigAttackBombCost * 4)) : 0,
      controlValue: totalCasts ? playerTotals.stunApplied / totalCasts : 0,
      burstRisk: totalCasts ? playerTotals.bigCasts / totalCasts : 0
    },
    warning: winRate < balance.simulation.balanceWinRateMin || winRate > balance.simulation.balanceWinRateMax
  };
}

function runSeries(options) {
  const matches = [];
  for (let index = 0; index < options.runs; index += 1) {
    matches.push(simulateMatch({ ...options, seed: `${options.seed}:${index}` }));
  }
  return aggregateMatches(matches, options.playerCharacter.id, options.computerCharacter.id, options.balance);
}

module.exports = {
  FOOD_TYPES,
  DIRECTIONS,
  createRng,
  loadBalance,
  loadCharacters,
  loadHighAiStrategies,
  hexDistance,
  wrappedDistance,
  createBoard,
  nextWrappedCell,
  createStartingSnake,
  dragonTrackingOrbPath,
  emptyStock,
  collectFood,
  randomFoodTypeIdsForCharacter,
  damageSnake,
  attackStats,
  canAttack,
  buildCharacterMap,
  makePolicy,
  createMatchState,
  chooseAttackProfile,
  chooseAttackTarget,
  chooseAttackDirection,
  chooseFoodTarget,
  directionToward,
  perceivedSnakeFor,
  isUnderground,
  updateVisibleMemory,
  resolveProjectiles,
  resolveHazards,
  simulateMatch,
  runSeries
};
