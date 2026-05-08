const fs = require("fs");
const path = require("path");

const FOOD_TYPES = ["protein", "fat", "fiber", "carb"];
const LOBSTER_PALM_STEP_MS = 45;
const SMALL_ATTACK_DELAY_SCALE = 0.31;
const SMALL_ATTACK_COOLDOWN_SCALE = 0.29;
const SANDWORM_REVEAL_BEFORE_IMPACT_MS = 200;
const SANDWORM_UNDERGROUND_WINDOW_MS = 500;
const DEFAULT_HP_PER_SNAKE_UNIT = 4;
const DEFAULT_ATTACK_DAMAGE_MULTIPLIER = 1;
const FOOD_TARGET_SWITCH_MS = 20000;
const DEAD_END_MIN_SPACE = 5;
const AI_LOOKAHEAD_DEPTH = 3;
const AI_LOOKAHEAD_BEAM_WIDTH = 3;
const AI_LOOKAHEAD_FUTURE_DISCOUNT = 0.65;
const SMALL_ATTACK_FOOD_COST = 2;
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

function highAiStrategiesFromData(file) {
  const rows = file?.strategies || file?.bestStrategies || file;
  if (Array.isArray(rows)) {
    return Object.fromEntries(rows
      .filter(row => row?.characterId && row.characterId !== "universal")
      .map(row => [row.characterId, row.strategyWeights || row]));
  }
  if (rows && typeof rows === "object") {
    return Object.fromEntries(Object.entries(rows)
      .filter(([characterId]) => characterId !== "universal")
      .map(([characterId, row]) => [characterId, row?.strategyWeights || row]));
  }
  return {};
}

function loadHighAiStrategies(root = path.resolve(__dirname, "..")) {
  const filePath = path.join(root, "data", "high-ai-strategies.json");
  if (!fs.existsSync(filePath)) return {};
  return highAiStrategiesFromData(loadJson(filePath));
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
  return { radius, cells, ...buildBoardTopology(radius, cells) };
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

function buildBoardTopology(radius, cells) {
  const cellIndexByKey = new Map(cells.map((cell, index) => [keyOf(cell), index]));
  const neighbors = cells.map(cell => DIRECTIONS.map((_, direction) => {
    const next = nextWrappedCell(cell, direction, radius);
    return cellIndexByKey.get(keyOf(next));
  }));
  const nearbyOne = cells.map(cell => cells
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => hexDistance(candidate, cell) <= 1)
    .map(({ index }) => index));
  const wrappedDistances = cells.map((_, sourceIndex) => {
    const row = new Uint16Array(cells.length);
    row.fill(65535);
    row[sourceIndex] = 0;
    const queue = [sourceIndex];
    for (let index = 0; index < queue.length; index += 1) {
      const currentIndex = queue[index];
      const nextDistance = row[currentIndex] + 1;
      neighbors[currentIndex].forEach(nextIndex => {
        if (!Number.isInteger(nextIndex) || row[nextIndex] !== 65535) return;
        row[nextIndex] = nextDistance;
        queue.push(nextIndex);
      });
    }
    return row;
  });
  return { cellIndexByKey, neighbors, nearbyOne, wrappedDistances };
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
  const startIndex = state.cellIndexByKey?.get(keyOf(start));
  const targetIndex = state.cellIndexByKey?.get(keyOf(target));
  if (Number.isInteger(startIndex) && Number.isInteger(targetIndex) && state.wrappedDistances?.[startIndex]) {
    const cachedDistance = state.wrappedDistances[startIndex][targetIndex];
    if (cachedDistance !== 65535) return cachedDistance;
  }
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

function attackDamageMultiplier(profile, balance) {
  const value = profile === "small"
    ? balance.attack?.smallAttackDamageMultiplier
    : balance.attack?.bigAttackDamageMultiplier;
  return Number.isFinite(value) ? value : DEFAULT_ATTACK_DAMAGE_MULTIPLIER;
}

function attackDamage(stock, profile, balance) {
  return damageMultiplier(stock, balance) * attackDamageMultiplier(profile, balance);
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

function arrivalTimeForDistance(fighter, balance, distance, now) {
  if (!Number.isFinite(distance)) return Number.POSITIVE_INFINITY;
  const interval = moveInterval(fighter, balance, now);
  const baseInterval = Number.isFinite(balance.movement.baseStepMs) && balance.movement.baseStepMs > 0
    ? balance.movement.baseStepMs
    : 1;
  return distance * ((Number.isFinite(interval) ? interval : baseInterval) / baseInterval);
}

function foodTypeIdsForValue(food) {
  const types = food?.types || [];
  if (types.includes("black")) return FOOD_TYPES;
  return types.filter(type => FOOD_TYPES.includes(type));
}

function foodExpectedStockGain(food, balance) {
  const types = food?.types || [];
  if (types.includes("black")) return 1;
  return types.length > 1 ? balance.resources.dualColorStockGain : balance.resources.singleColorStockGain;
}

function foodGainPerType(food, balance, normalizedTypes) {
  const types = food?.types || [];
  if (types.includes("black")) return 1 / Math.max(1, normalizedTypes.length);
  return foodExpectedStockGain(food, balance);
}

function projectedAmmoAfterFood(fighter, balance, food) {
  let ammo = fighter.ammo;
  let charge = fighter.ammoCharge + ((food?.types || []).includes("black") ? balance.resources.blackFoodEnergy : balance.resources.foodEnergy);
  if (charge >= balance.resources.attackNeedTotal) {
    if (ammo < balance.resources.maxAmmo) {
      ammo = Math.min(balance.resources.maxAmmo, ammo + 1);
      charge = 0;
    } else {
      charge = balance.resources.attackNeedTotal;
    }
  }
  return { ammo, charge };
}

function projectedStockAfterFood(stock, balance, food) {
  const projected = { ...stock };
  const normalizedTypes = foodTypeIdsForValue(food);
  const gain = foodGainPerType(food, balance, normalizedTypes);
  normalizedTypes.forEach(type => {
    projected[type] = Math.min(balance.resources.maxFoodStock, (projected[type] || 0) + gain);
  });
  return projected;
}

function canAttackWithResources(stock, ammo, profile, balance) {
  if (ammo < attackBombCost(profile, balance)) return false;
  const cost = attackFoodCost(profile, balance);
  if (profile === "small") {
    return FOOD_TYPES.reduce((best, type) => Math.max(best, stock[type] || 0), 0) >= cost;
  }
  return FOOD_TYPES.every(type => (stock[type] || 0) >= cost);
}

function foodResourceValueFor(fighter, food, balance, state = null) {
  const cache = state ? activeCacheFor(state, fighter) : null;
  const cacheKey = food ? `${fighter.owner}:${keyOf(food)}` : null;
  if (cache && cacheKey && cache.foodResourceValues.has(cacheKey)) {
    return cache.foodResourceValues.get(cacheKey);
  }
  const projectedStock = projectedStockAfterFood(fighter.stock, balance, food);
  const projectedAmmo = projectedAmmoAfterFood(fighter, balance, food);
  const normalizedTypes = foodTypeIdsForValue(food);
  const expectedStockGain = foodExpectedStockGain(food, balance);
  const stockCap = fighter.balanceStockCap ?? balance.resources.maxFoodStock;
  const actualStockGain = normalizedTypes.reduce((sum, type) => sum + Math.max(0, (projectedStock[type] || 0) - (fighter.stock[type] || 0)), 0);
  const stockValue = normalizedTypes.reduce((sum, type) => {
    const before = fighter.stock[type] || 0;
    const gained = Math.max(0, (projectedStock[type] || 0) - before);
    const roomRatio = Math.max(0, stockCap - before) / Math.max(1, stockCap);
    const bigGap = Math.max(0, attackFoodCost("big", balance) - before);
    return sum + gained * (1 + roomRatio + (bigGap > 0 ? 0.85 : 0));
  }, 0);
  const bombGain = Math.max(0, projectedAmmo.ammo - fighter.ammo);
  const chargeGain = Math.max(0, projectedAmmo.charge - fighter.ammoCharge) / Math.max(1, balance.resources.attackNeedTotal);
  const energyValue = bombGain * 2.2 + chargeGain * 1.4;
  const smallReady = !canAttack(fighter, "small", balance) && canAttackWithResources(projectedStock, projectedAmmo.ammo, "small", balance) ? 2.1 : 0;
  const bigReady = !canAttack(fighter, "big", balance) && canAttackWithResources(projectedStock, projectedAmmo.ammo, "big", balance) ? 3.2 : 0;
  const overflowPenalty = Math.max(0, expectedStockGain - actualStockGain) * 0.45
    + (fighter.ammo >= balance.resources.maxAmmo && fighter.ammoCharge >= balance.resources.attackNeedTotal ? 0.9 : 0);
  const value = Math.max(0, 0.5 + stockValue + energyValue + smallReady + bigReady - overflowPenalty);
  if (cache && cacheKey) cache.foodResourceValues.set(cacheKey, value);
  return value;
}

function createAiDecisionCache(fighter, opponent, now) {
  return {
    owner: fighter.owner,
    opponent: opponent.owner,
    now,
    damageMaps: new Map(),
    foodResourceValues: new Map(),
    occupiedSignatures: new WeakMap(),
    reachableSpaces: new Map(),
    targetBenefits: new Map()
  };
}

function withAiDecisionCache(state, fighter, opponent, callback) {
  const previous = state.aiDecisionCache;
  state.aiDecisionCache = createAiDecisionCache(fighter, opponent, state.now);
  try {
    return callback();
  } finally {
    state.aiDecisionCache = previous;
  }
}

function activeCacheFor(state, fighter) {
  return state.aiDecisionCache?.owner === fighter.owner && state.aiDecisionCache?.now === state.now
    ? state.aiDecisionCache
    : null;
}

function occupiedSignature(state, occupied) {
  const cache = state.aiDecisionCache;
  if (!cache) return [...occupied].sort().join(";");
  const cached = cache.occupiedSignatures.get(occupied);
  if (cached) return cached;
  const signature = [...occupied].sort().join(";");
  cache.occupiedSignatures.set(occupied, signature);
  return signature;
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

function hpPerSnakeUnit(balance) {
  const value = balance?.health?.hpPerSnakeUnit;
  return Number.isFinite(value) ? value : DEFAULT_HP_PER_SNAKE_UNIT;
}

function maxHpForSnake(snake = [], balance = null) {
  return ((snake?.length || 0) + 1) * hpPerSnakeUnit(balance);
}

function foodHealAmount(balance = null) {
  return hpPerSnakeUnit(balance);
}

function attackFoodCost(profile = "big", balance = null) {
  return profile === "small" ? (balance?.attack?.smallAttackFoodCost ?? SMALL_ATTACK_FOOD_COST) : 2;
}

function attackBombCost(profile, balance) {
  return profile === "small" ? (balance.attack.smallAttackBombCost ?? 1) : balance.attack.bigAttackBombCost;
}

function highestStockFoodType(stock) {
  return FOOD_TYPES.reduce((best, type) => {
    const currentCount = stock[type] || 0;
    const bestCount = best ? (stock[best] || 0) : -Infinity;
    return currentCount > bestCount ? type : best;
  }, null);
}

function hasAttackFoodCost(stock, profile, balance) {
  const cost = attackFoodCost(profile, balance);
  if (profile === "small") {
    const highestType = highestStockFoodType(stock);
    return Boolean(highestType) && (stock[highestType] || 0) >= cost;
  }
  return FOOD_TYPES.every(type => (stock[type] || 0) >= cost);
}

function canAttack(fighter, profile, balance) {
  return fighter.ammo >= attackBombCost(profile, balance) && hasAttackFoodCost(fighter.stock, profile, balance);
}

function attackStats(stock, profile, balance) {
  const isSmall = profile === "small";
  return {
    delay: attackDelay(stock, balance) * (isSmall ? SMALL_ATTACK_DELAY_SCALE : 1),
    radius: Math.max(1, blastRadius(stock, balance) + (isSmall ? -1 : 0)),
    damage: attackDamage(stock, profile, balance)
  };
}

function bandDistanceFromTotalWidth(totalWidth) {
  return Math.max(0, Math.floor((totalWidth - 1) / 2));
}

function bandShapeFromTotalWidth(totalWidth) {
  const fullDamageWidth = bandDistanceFromTotalWidth(totalWidth);
  const fullTotalWidth = fullDamageWidth * 2 + 1;
  const outerDamageMultiplier = Math.max(0, Math.min(1, (totalWidth - fullTotalWidth) / 2));
  return {
    width: fullDamageWidth + (outerDamageMultiplier > 0 ? 1 : 0),
    fullDamageWidth,
    outerDamageMultiplier
  };
}

function lineBandDamageMultiplier(distance, band) {
  if (distance > (band?.width ?? 0)) return 0;
  if (distance <= (band?.fullDamageWidth ?? 0)) return 1;
  return band?.outerDamageMultiplier ?? 1;
}

function convertFullEnergyToAmmo(fighter, balance) {
  if (fighter.ammoCharge < balance.resources.attackNeedTotal || fighter.ammo >= balance.resources.maxAmmo) return false;
  fighter.ammo = Math.min(balance.resources.maxAmmo, fighter.ammo + 1);
  fighter.ammoCharge = 0;
  return true;
}

function consumeAttackCost(fighter, profile, balance) {
  const cost = attackFoodCost(profile, balance);
  const bombCost = attackBombCost(profile, balance);
  const hadFullEnergy = fighter.ammoCharge >= balance.resources.attackNeedTotal;
  const hadFullBombs = fighter.ammo >= balance.resources.maxAmmo;
  if (profile === "small") {
    const highestType = highestStockFoodType(fighter.stock);
    if (highestType) fighter.stock[highestType] = Math.max(0, (fighter.stock[highestType] || 0) - cost);
  } else {
    FOOD_TYPES.forEach(type => {
      fighter.stock[type] = Math.max(0, fighter.stock[type] - cost);
    });
  }
  fighter.ammo = Math.max(0, fighter.ammo - bombCost);
  if (bombCost > 0 && hadFullEnergy && hadFullBombs) convertFullEnergyToAmmo(fighter, balance);
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

function damageSnakeCells(parts, effectCells, width, damageScale, excludedCells = [], minDistance = 0, outerDamageMultiplier = 1, fullDamageWidth = 0) {
  const excluded = cellKeySet(excludedCells);
  return parts.reduce((total, segment) => {
    if (excluded.has(keyOf(segment))) return total;
    const bestMultiplier = effectCells.reduce((best, cell) => {
      const distance = hexDistance(segment, cell);
      if (distance < minDistance || distance > width) return best;
      return Math.max(best, lineBandDamageMultiplier(distance, { width, fullDamageWidth, outerDamageMultiplier }));
    }, 0);
    return bestMultiplier > 0 ? total + damageScale * bestMultiplier : total;
  }, 0);
}

function snakeBodyHitAtCenter(snake, target) {
  return snake.slice(1).some(segment => keyOf(segment) === keyOf(target));
}

function snakeHeadHitAtCenter(snake, target) {
  return Boolean(snake[0] && keyOf(snake[0]) === keyOf(target));
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
  const maxHp = maxHpForSnake(snake, balance);
  return {
    owner,
    character,
    policy,
    snake,
    dir: direction,
    nextDir: direction,
    hp: maxHp,
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
    foodTargetAt: 0,
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
  dragon: { preferredFood: "balanced" },
  sandworm: { preferredFood: "fat" },
  quetzal: { preferredFood: "fiber" },
  moray: { preferredFood: "carb" },
  lobster: { preferredFood: "protein" },
  gu_king: { preferredFood: "black" }
};

function aiProfileFor(fighter) {
  return characterAiProfiles[fighter.character.id] || { preferredFood: fighter.character.foodPreference };
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

function perceivedDirectionFor(state, target) {
  if (!isUnderground(target, state.now)) return target.dir;
  return Number.isInteger(target.lastVisibleDir) ? target.lastVisibleDir : target.dir;
}

function isDebuffed(fighter, now) {
  return now < fighter.stunUntil || now < fighter.slowUntil || fighter.collisionParalysisMs > 0;
}

function hasResourcePressure(fighter, balance) {
  const stockCap = balance.resources.maxFoodStock;
  const nearStockCap = FOOD_TYPES.some(type => (fighter.stock[type] || 0) >= stockCap - 2);
  return nearStockCap || hasFullBombsAndNearFullEnergy(fighter, balance);
}

function hasFullBombsAndNearFullEnergy(fighter, balance) {
  return fighter.ammo >= balance.resources.maxAmmo && fighter.ammoCharge >= balance.resources.attackNeedTotal - 1;
}

function strongestVisibleDamage(state, attacker, defender, balance, profile) {
  const stats = attackStats(attacker.stock, profile, balance);
  const targetSnake = perceivedSnakeFor(state, attacker, defender);
  const head = targetSnake[0];
  const candidates = cellsWithinDistance(state, head, 0, Math.max(1, Math.ceil(stats.radius + 1)));
  return candidates.reduce((best, cell) => Math.max(best, damageSnake(targetSnake, cell, stats.radius, stats.damage, balance)), 0);
}

function isLethalAttack(state, fighter, opponent, balance, profile) {
  return canAttack(fighter, profile, balance) && strongestVisibleDamage(state, fighter, opponent, balance, profile) >= opponent.hp;
}

function attackResourceCost(profile, balance) {
  const foodMultiplier = profile === "small" ? 1 : FOOD_TYPES.length;
  return attackFoodCost(profile, balance) * foodMultiplier + attackBombCost(profile, balance) * FOOD_TYPES.length;
}

function lateGameSkillPhase(state, fighter, opponent, balance) {
  const bigFoodCost = attackFoodCost("big", balance);
  const averageStockRatio = FOOD_TYPES.reduce((sum, type) => sum + (fighter.stock[type] || 0), 0)
    / Math.max(1, FOOD_TYPES.length * balance.resources.maxFoodStock);
  const surplusRatio = FOOD_TYPES.reduce((sum, type) => sum + Math.max(0, (fighter.stock[type] || 0) - bigFoodCost), 0)
    / Math.max(1, FOOD_TYPES.length * (balance.resources.maxFoodStock - bigFoodCost));
  const bombReserveRatio = Math.max(0, fighter.ammo - attackBombCost("big", balance))
    / Math.max(1, balance.resources.maxAmmo - attackBombCost("big", balance));
  const cappedEnergyRatio = fighter.ammo >= balance.resources.maxAmmo
    ? fighter.ammoCharge / Math.max(1, balance.resources.attackNeedTotal)
    : 0;
  const timeRatio = clamp((state.now - 30000) / 90000, 0, 1);
  const opponentSnake = perceivedSnakeFor(state, fighter, opponent);
  const opponentMaxHp = Math.max(1, maxHpForSnake(opponentSnake, balance));
  const opponentMissingHpRatio = clamp(1 - opponent.hp / opponentMaxHp, 0, 1);
  return clamp(
    averageStockRatio * 0.35
      + surplusRatio * 0.45
      + bombReserveRatio * 0.18
      + cappedEnergyRatio * 0.12
      + timeRatio * 0.25
      + opponentMissingHpRatio * 0.25
      + (hasResourcePressure(fighter, balance) ? 0.18 : 0),
    0,
    1
  );
}

function bigAttackReadiness(fighter, balance) {
  const bigFoodCost = attackFoodCost("big", balance);
  const stockReadiness = FOOD_TYPES.reduce((sum, type) => {
    return sum + clamp((fighter.stock[type] || 0) / Math.max(1, bigFoodCost), 0, 1);
  }, 0) / Math.max(1, FOOD_TYPES.length);
  const weakestStockReadiness = FOOD_TYPES.reduce((best, type) => {
    return Math.min(best, clamp((fighter.stock[type] || 0) / Math.max(1, bigFoodCost), 0, 1));
  }, 1);
  const ammoReadiness = clamp((fighter.ammo + fighter.ammoCharge / Math.max(1, balance.resources.attackNeedTotal)) / Math.max(1, attackBombCost("big", balance)), 0, 1);
  return Math.min(ammoReadiness, weakestStockReadiness * 0.7 + stockReadiness * 0.3);
}

function shouldSaveSmallForBig(state, fighter, opponent, balance) {
  if (!canAttack(fighter, "small", balance) || canAttack(fighter, "big", balance)) return false;
  if (isLethalAttack(state, fighter, opponent, balance, "small")) return false;
  const bigFoodCost = attackFoodCost("big", balance);
  const readiness = bigAttackReadiness(fighter, balance);
  const preparationTime = clamp((state.now - 15000) / 45000, 0, 1);
  const stockReadyForBig = FOOD_TYPES.every(type => (fighter.stock[type] || 0) >= bigFoodCost);
  if (stockReadyForBig && fighter.ammo >= attackBombCost("small", balance) && preparationTime >= 0.2) return true;
  return readiness >= 0.72 && (preparationTime >= 0.25 || lateGameSkillPhase(state, fighter, opponent, balance) >= 0.22);
}

function skillPhaseBias(state, attacker, defender, balance, profile) {
  const phase = lateGameSkillPhase(state, attacker, defender, balance);
  if (profile === "small") {
    return (1 - phase) * 1.8 - (canAttack(attacker, "big", balance) ? phase * 2.8 : 0);
  }
  return phase * 5.2 - (1 - phase) * 1.8 + (hasResourcePressure(attacker, balance) ? 1 : 0);
}

function opponentAlmostReady(opponent, balance) {
  if (canAttack(opponent, "small", balance) || canAttack(opponent, "big", balance)) return true;
  const highestType = highestStockFoodType(opponent.stock);
  const stockClose = highestType && (opponent.stock[highestType] || 0) >= Math.max(0, attackFoodCost("small", balance) - 1);
  const ammoClose = opponent.ammo >= attackBombCost("small", balance) || opponent.ammoCharge >= balance.resources.attackNeedTotal - 1;
  return stockClose || ammoClose;
}

function castTimingScore(state, fighter, opponent, balance, profile) {
  const weights = fighter.policy.strategyWeights.castTiming;
  const perceived = perceivedSnakeFor(state, fighter, opponent);
  const distance = hexDistance(fighter.snake[0], perceived[0]);
  let score = 0;
  if (isLethalAttack(state, fighter, opponent, balance, profile)) score += weights.lethal * 3;
  if (hasFullBombsAndNearFullEnergy(fighter, balance)) score += weights.nearFullEnergy;
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
    return !canAttack(fighter, "small", balance) || hasResourcePressure(fighter, balance) || lateGameSkillPhase(state, fighter, opponent, balance) >= 0.86 || distance <= 2 && state.rng.next() < 0.35 || state.rng.next() < 0.18;
  }
  if (difficulty === "medium" || difficulty === "high") {
    const lethal = strongestVisibleDamage(state, fighter, opponent, balance, "big") >= opponent.hp;
    return isDebuffed(opponent, state.now) || lethal || hasResourcePressure(fighter, balance) || lateGameSkillPhase(state, fighter, opponent, balance) >= 0.78;
  }
  return false;
}

function foodValueFor(fighter, opponent, food, policy, state = null) {
  const ownDistance = state ? wrappedDistance(state, fighter.snake[0], food) : hexDistance(fighter.snake[0], food);
  const opponentDistance = state ? wrappedDistance(state, opponent.snake[0], food) : hexDistance(opponent.snake[0], food);
  const highDifficulty = policy.aiDifficulty === "high" && state;
  const ownArrivalTime = highDifficulty ? arrivalTimeForDistance(fighter, state.balance, ownDistance, state.now) : ownDistance;
  const opponentArrivalTime = highDifficulty ? arrivalTimeForDistance(opponent, state.balance, opponentDistance, state.now) : opponentDistance;
  const types = food.types || [];
  const aiProfile = aiProfileFor(fighter);
  const opponentProfile = aiProfileFor(opponent);
  const preferredFood = aiProfile.preferredFood || fighter.character.foodPreference;
  const opponentPreferredFood = opponentProfile.preferredFood || opponent.character.foodPreference;
  const weights = policy.strategyWeights.food;
  const normalizedTypes = foodTypeIdsForValue(food);
  const ownDeficit = normalizedTypes.reduce((sum, type) => sum + (fighter.balanceStockCap ?? 20) - (fighter.stock[type] || 0), 0) / Math.max(1, normalizedTypes.length);
  const opponentDeficit = normalizedTypes.reduce((sum, type) => sum + (fighter.balanceStockCap ?? 20) - (opponent.stock[type] || 0), 0) / Math.max(1, normalizedTypes.length);
  const ownPrefers = preferredFood === "balanced"
    ? normalizedTypes.length > 0
    : preferredFood === "black" ? types.includes("black") : types.includes(preferredFood);
  const opponentPrefers = opponentPreferredFood === "balanced"
    ? normalizedTypes.length > 0
    : opponentPreferredFood === "black" ? types.includes("black") : types.includes(opponentPreferredFood);
  if (!highDifficulty) {
    return (
      weights.fastestArrival * (1 / (1 + ownDistance)) * 10 +
      weights.ownDeficit * ownDeficit / 5 +
      weights.opponentDeficit * opponentDeficit / 6 +
      weights.ownPreferred * (ownPrefers ? 2.5 : 0) +
      weights.opponentPreferred * (opponentPrefers ? 2 : 0) +
      (opponentDistance <= ownDistance ? weights.opponentDeficit * 0.35 : 0)
    );
  }
  const ownResourceValue = foodResourceValueFor(fighter, food, state.balance, state);
  const opponentResourceValue = foodResourceValueFor(opponent, food, state.balance, state);
  const raceLead = opponentArrivalTime - ownArrivalTime;
  return (
    weights.fastestArrival * (8 + ownResourceValue) / (1 + ownArrivalTime) +
    ownResourceValue * (0.7 + weights.ownDeficit * 0.12) +
    weights.ownDeficit * ownDeficit / 6 +
    weights.opponentDeficit * opponentDeficit / 8 +
    weights.ownPreferred * (ownPrefers ? 2.5 : 0) +
    weights.opponentPreferred * (opponentPrefers ? Math.min(2.4, 0.8 + opponentResourceValue * 0.32) : 0) +
    weights.opponentDeficit * opponentResourceValue / (1 + opponentArrivalTime) * 0.25 +
    (opponentArrivalTime <= ownArrivalTime ? weights.opponentDeficit * 0.35 : 0) +
    (raceLead >= 0 ? Math.min(2.5, raceLead * 0.35) : -Math.min(3.5, -raceLead * 0.8))
  );
}

function foodRaceAdvantage(state, fighter, opponent, food) {
  if (fighter.policy.aiDifficulty === "high") {
    const opponentHead = perceivedSnakeFor(state, fighter, opponent)[0] || opponent.snake[0];
    return arrivalTimeForDistance(fighter, state.balance, wrappedDistance(state, fighter.snake[0], food), state.now)
      - arrivalTimeForDistance(opponent, state.balance, wrappedDistance(state, opponentHead, food), state.now);
  }
  return wrappedDistance(state, fighter.snake[0], food) - wrappedDistance(state, opponent.snake[0], food);
}

function shouldAbandonFoodTarget(state, fighter, opponent, food, lockedScore, bestScore, targetAge) {
  if (fighter.policy.aiDifficulty !== "high") return false;
  const occupied = movementOccupiedSet(state, fighter, opponent);
  const reachable = reachableSpace(state, food, occupied, DEAD_END_MIN_SPACE);
  const expectedDamage = expectedDamageAt(state, fighter, food);
  const opponentAdvantage = foodRaceAdvantage(state, fighter, opponent, food);
  return expectedDamage >= fighter.hp
    || reachable < DEAD_END_MIN_SPACE
    || opponentAdvantage > 0.45
    || (targetAge >= 750 && bestScore > lockedScore + 2.25);
}

function chooseFoodTarget(state, fighter, opponent) {
  if (!state.aiDecisionCache) {
    return withAiDecisionCache(state, fighter, opponent, () => chooseFoodTarget(state, fighter, opponent));
  }
  const perceivedOpponent = perceivedSnakeFor(state, fighter, opponent);
  if (!state.foods.length) return perceivedOpponent[0];
  const staleTarget = fighter.foodTargetKey && Number.isFinite(fighter.foodTargetAt) && state.now - fighter.foodTargetAt >= FOOD_TARGET_SWITCH_MS ? fighter.foodTargetKey : null;
  const choices = state.foods.filter(food => keyOf(food) !== staleTarget);
  const filteredChoices = filterUnsafeFoodTargets(state, fighter, opponent, choices.length ? choices : state.foods);
  const targetPool = filteredChoices.length ? filteredChoices : choices.length ? choices : state.foods;
  const lockedTarget = !staleTarget && fighter.foodTargetKey ? targetPool.find(food => keyOf(food) === fighter.foodTargetKey) : null;
  const sortedTargets = [...targetPool]
    .map(food => ({ food, score: foodValueFor(fighter, opponent, food, fighter.policy, state) }))
    .sort((a, b) => b.score - a.score);
  const bestTarget = sortedTargets[0] || null;
  const lockedScore = lockedTarget ? foodValueFor(fighter, opponent, lockedTarget, fighter.policy, state) : -Infinity;
  const targetAge = Number.isFinite(fighter.foodTargetAt) ? state.now - fighter.foodTargetAt : Infinity;
  const target = lockedTarget && !shouldAbandonFoodTarget(state, fighter, opponent, lockedTarget, lockedScore, bestTarget?.score ?? -Infinity, targetAge)
    ? lockedTarget
    : bestTarget?.food;
  const nextTargetKey = target ? keyOf(target) : null;
  if (nextTargetKey !== fighter.foodTargetKey) fighter.foodTargetAt = nextTargetKey ? state.now : 0;
  fighter.foodTargetKey = nextTargetKey;
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
    opponentAdvantage: foodRaceAdvantage(state, fighter, opponent, food),
    expectedDamage: expectedDamageAt(state, fighter, food),
    reachable: reachableSpace(state, food, occupied, DEAD_END_MIN_SPACE)
  }));
  const maxOpponentAdvantage = Math.max(0, ...withRace.map(row => row.opponentAdvantage));
  const filtered = withRace
    .filter(row => fighter.policy.aiDifficulty !== "high" || row.expectedDamage < fighter.hp)
    .filter(row => !(maxOpponentAdvantage > 0 && row.opponentAdvantage === maxOpponentAdvantage))
    .filter(row => row.reachable >= DEAD_END_MIN_SPACE)
    .map(row => row.food);
  return filtered.length ? filtered : foods;
}

function movementOccupiedSetForSnake(state, fighter, opponent, snake) {
  const occupied = new Set(snake.slice(0, -1).map(keyOf));
  const perceivedOpponent = perceivedSnakeFor(state, fighter, opponent);
  if (fighter.policy.pathPrecision > 0.35 && !isUnderground(opponent, state.now)) perceivedOpponent.forEach(segment => occupied.add(keyOf(segment)));
  return occupied;
}

function nearbyOpenSpace(state, cell, occupied) {
  const index = state.cellIndexByKey?.get(keyOf(cell));
  if (Number.isInteger(index) && state.nearbyOne?.[index]) {
    return state.nearbyOne[index].reduce((count, cellIndex) => count + (occupied.has(keyOf(state.cells[cellIndex])) ? 0 : 1), 0);
  }
  return state.cells.reduce((count, candidate) => count + (hexDistance(candidate, cell) <= 1 && !occupied.has(keyOf(candidate)) ? 1 : 0), 0);
}

function movementTargetBenefit(state, fighter, target) {
  if (fighter.policy.aiDifficulty !== "high" || !target) return 0;
  const cache = activeCacheFor(state, fighter);
  const cacheKey = keyOf(target);
  if (cache?.targetBenefits.has(cacheKey)) return cache.targetBenefits.get(cacheKey);
  const targetFood = state.foods.find(food => keyOf(food) === keyOf(target));
  const value = targetFood ? Math.min(20, foodResourceValueFor(fighter, targetFood, state.balance, state)) : 0;
  if (cache) cache.targetBenefits.set(cacheKey, value);
  return value;
}

function opponentEtaThreatForCell(state, fighter, opponent, from, cell, opponentHead) {
  if (fighter.policy.aiDifficulty !== "high" || !cell || !opponentHead) return 0;
  const ownArrival = arrivalTimeForDistance(fighter, state.balance, wrappedDistance(state, from, cell), state.now);
  const opponentArrival = arrivalTimeForDistance(opponent, state.balance, wrappedDistance(state, opponentHead, cell), state.now);
  if (!Number.isFinite(ownArrival) || !Number.isFinite(opponentArrival)) return 0;
  if (opponentArrival <= ownArrival) return 10 + Math.min(10, (ownArrival - opponentArrival) * 4);
  if (opponentArrival <= ownArrival + 0.5) return 4;
  return 0;
}

function movementOptionForState(state, fighter, opponent, snake, currentDir, direction, target, occupied, perceivedOpponent, opponentThreat, distanceToTarget = cell => wrappedDistance(state, cell, target)) {
  const next = nextWrappedCell(snake[0], direction, state.radius);
  const key = keyOf(next);
  const selfBlocked = snake.slice(0, -1).some(segment => keyOf(segment) === key);
  const opponentBlocked = perceivedOpponent.some(segment => keyOf(segment) === key);
  const blocked = selfBlocked || opponentBlocked || occupied.has(key);
  const headThreat = keyOf(opponentThreat) === key;
  const reachable = reachableSpace(state, next, occupied, 10);
  const wallSpace = nearbyOpenSpace(state, next, occupied);
  const expectedDamage = expectedDamageAt(state, fighter, next);
  const weights = fighter.policy.strategyWeights.movement;
  const trapRisk = Math.max(0, 5 - reachable);
  const deadEnd = reachable < DEAD_END_MIN_SPACE;
  const lethalThreat = expectedDamage >= fighter.hp;
  const etaThreat = opponentEtaThreatForCell(state, fighter, opponent, snake[0], next, perceivedOpponent[0]);
  const targetBenefit = movementTargetBenefit(state, fighter, target);
  const risk = (selfBlocked ? 100 : 0) + (opponentBlocked ? 35 : 0) + etaThreat + trapRisk * 4 + expectedDamage;
  return {
    direction,
    next,
    blocked,
    headThreat,
    deadEnd,
    lethalThreat,
    risk,
    score: weights.fastestArrival * distanceToTarget(next)
      + weights.safePath * risk
      + weights.leastDamage * expectedDamage
      + etaThreat * 0.65
      - targetBenefit / (1 + distanceToTarget(next)) * 1.15
      - wallSpace * 0.04
  };
}

function movementHardPenalty(option) {
  return (option.blocked ? 120 : 0)
    + (option.headThreat ? 80 : 0)
    + (option.lethalThreat ? 120 : 0)
    + (option.deadEnd ? 60 : 0);
}

function movementFoodKeySet(state) {
  return new Set(state.foods.map(keyOf));
}

function advanceMovementSnake(snake, option, foodKeys) {
  const nextFoodKeys = new Set(foodKeys);
  const nextSnake = [option.next, ...snake];
  if (nextFoodKeys.has(keyOf(option.next))) {
    nextFoodKeys.delete(keyOf(option.next));
  } else {
    nextSnake.pop();
  }
  return { snake: nextSnake, foodKeys: nextFoodKeys };
}

function terminalMobilityPenalty(state, fighter, opponent, snake, currentDir, target, foodKeys, perceivedOpponent, opponentThreat, distanceToTarget) {
  const occupied = movementOccupiedSetForSnake(state, fighter, opponent, snake);
  const options = DIRECTIONS
    .map((_, direction) => {
      if (!canTurn(snake, currentDir, direction)) return null;
      return movementOptionForState(state, fighter, opponent, snake, currentDir, direction, target, occupied, perceivedOpponent, opponentThreat, distanceToTarget);
    })
    .filter(Boolean);
  if (!options.length) return 1200;
  const hardSafe = options.filter(option => !option.blocked && !option.headThreat && !option.deadEnd && !option.lethalThreat);
  if (!hardSafe.length) return 1000;
  if (hardSafe.length === 1) return 36;
  return 0;
}

function lookaheadMovementScore(state, fighter, opponent, firstOption, target, perceivedOpponent, opponentThreat, distanceToTarget) {
  const firstStep = advanceMovementSnake(fighter.snake, firstOption, movementFoodKeySet(state));
  let beam = [{
    snake: firstStep.snake,
    dir: firstOption.direction,
    foodKeys: firstStep.foodKeys,
    score: firstOption.score + movementHardPenalty(firstOption),
    discount: AI_LOOKAHEAD_FUTURE_DISCOUNT
  }];

  for (let depth = 1; depth < AI_LOOKAHEAD_DEPTH; depth += 1) {
    const expanded = [];
    beam.forEach(row => {
      const occupied = movementOccupiedSetForSnake(state, fighter, opponent, row.snake);
      DIRECTIONS.forEach((_, direction) => {
        if (!canTurn(row.snake, row.dir, direction)) return;
        const option = movementOptionForState(state, fighter, opponent, row.snake, row.dir, direction, target, occupied, perceivedOpponent, opponentThreat, distanceToTarget);
        const nextStep = advanceMovementSnake(row.snake, option, row.foodKeys);
        expanded.push({
          snake: nextStep.snake,
          dir: option.direction,
          foodKeys: nextStep.foodKeys,
          score: row.score + row.discount * (option.score + movementHardPenalty(option)),
          discount: row.discount * AI_LOOKAHEAD_FUTURE_DISCOUNT
        });
      });
    });
    if (!expanded.length) return beam[0].score + beam[0].discount * 1200;
    expanded.sort((a, b) => a.score - b.score);
    beam = expanded.slice(0, AI_LOOKAHEAD_BEAM_WIDTH);
  }

  return Math.min(...beam.map(row => (
    row.score + row.discount * terminalMobilityPenalty(state, fighter, opponent, row.snake, row.dir, target, row.foodKeys, perceivedOpponent, opponentThreat, distanceToTarget)
  )));
}

function directionToward(state, fighter, opponent, target) {
  if (!state.aiDecisionCache) {
    return withAiDecisionCache(state, fighter, opponent, () => directionToward(state, fighter, opponent, target));
  }
  const occupied = movementOccupiedSet(state, fighter, opponent);
  const perceivedOpponent = perceivedSnakeFor(state, fighter, opponent);
  const opponentThreat = nextWrappedCell(perceivedOpponent[0], perceivedDirectionFor(state, opponent), state.radius);
  const targetDistanceCache = new Map();
  const distanceToTarget = cell => {
    const key = keyOf(cell);
    if (!targetDistanceCache.has(key)) {
      const distance = wrappedDistance(state, cell, target);
      targetDistanceCache.set(key, fighter.policy.aiDifficulty === "high"
        ? arrivalTimeForDistance(fighter, state.balance, distance, state.now)
        : distance);
    }
    return targetDistanceCache.get(key);
  };
  const options = [];
  DIRECTIONS.forEach((_, direction) => {
    if (!canTurn(fighter.snake, fighter.dir, direction)) return;
    options.push(movementOptionForState(state, fighter, opponent, fighter.snake, fighter.dir, direction, target, occupied, perceivedOpponent, opponentThreat, distanceToTarget));
  });
  const viable = options.length ? options : [{ direction: fighter.dir, score: 0, blocked: false }];
  const hardSafe = viable.filter(option => !option.blocked && !option.headThreat && !option.deadEnd && !option.lethalThreat);
  const safe = hardSafe.length ? hardSafe : viable.filter(option => !option.blocked && !option.headThreat && !option.lethalThreat && option.risk < 20);
  const candidates = safe.length ? safe : viable;
  if (fighter.policy.aiDifficulty === "high" && candidates.length > 1) {
    candidates.forEach(option => {
      option.lookaheadScore = lookaheadMovementScore(state, fighter, opponent, option, target, perceivedOpponent, opponentThreat, distanceToTarget);
    });
  }
  candidates.sort((a, b) => a.score - b.score || a.risk - b.risk);
  if (fighter.policy.aiDifficulty === "high") {
    candidates.sort((a, b) => (a.lookaheadScore ?? a.score) - (b.lookaheadScore ?? b.score) || a.score - b.score || a.risk - b.risk);
  }
  if (state.rng.next() > fighter.policy.pathPrecision) return state.rng.item(viable).direction;
  return candidates[0].direction;
}

function reachableSpaceUncached(state, start, occupied, maxCells = 10) {
  if (occupied.has(keyOf(start))) return 0;
  const startIndex = state.cellIndexByKey?.get(keyOf(start));
  if (Number.isInteger(startIndex) && state.neighbors?.[startIndex]) {
    const seen = new Set([startIndex]);
    const queue = [startIndex];
    for (let index = 0; index < queue.length && seen.size < maxCells; index += 1) {
      state.neighbors[queue[index]].forEach(nextIndex => {
        if (!Number.isInteger(nextIndex) || seen.has(nextIndex) || occupied.has(keyOf(state.cells[nextIndex]))) return;
        seen.add(nextIndex);
        queue.push(nextIndex);
      });
    }
    return seen.size;
  }
  const seen = new Set([keyOf(start)]);
  const queue = [start];
  for (let index = 0; index < queue.length && seen.size < maxCells; index += 1) {
    const cell = queue[index];
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

function reachableSpace(state, start, occupied, maxCells = 10) {
  const cache = state.aiDecisionCache;
  if (!cache) return reachableSpaceUncached(state, start, occupied, maxCells);
  const cacheKey = `${keyOf(start)}|${maxCells}|${occupiedSignature(state, occupied)}`;
  if (!cache.reachableSpaces.has(cacheKey)) {
    cache.reachableSpaces.set(cacheKey, reachableSpaceUncached(state, start, occupied, maxCells));
  }
  return cache.reachableSpaces.get(cacheKey);
}

function expectedDamageAtUncached(state, fighter, cell) {
  const opponentOwner = fighter.owner === "player" ? "computer" : "player";
  let damage = 0;
  state.projectiles.forEach(projectile => {
    if (projectile.owner !== opponentOwner) return;
    if (!isProjectileVisibleTo(fighter, projectile, state.now)) return;
    if (projectile.kind === "line") {
      const multiplier = projectile.lineCells?.reduce((best, lineCell) => (
        Math.max(best, lineBandDamageMultiplier(hexDistance(lineCell, cell), projectile))
      ), 0) || 0;
      damage += (projectile.damage || 0) * multiplier;
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

function expectedDamageMapFor(state, fighter) {
  const cache = activeCacheFor(state, fighter);
  if (!cache) return null;
  if (cache.damageMaps.has(fighter.owner)) return cache.damageMaps.get(fighter.owner);
  const opponentOwner = fighter.owner === "player" ? "computer" : "player";
  const hasVisibleThreat = state.projectiles.some(projectile => projectile.owner === opponentOwner && isProjectileVisibleTo(fighter, projectile, state.now))
    || state.hazards.some(hazard => hazard.owner === opponentOwner && state.now <= hazard.endAt);
  const damageMap = new Map();
  if (hasVisibleThreat) {
    state.cells.forEach(cell => {
      const damage = expectedDamageAtUncached(state, fighter, cell);
      if (damage > 0) damageMap.set(keyOf(cell), damage);
    });
  }
  cache.damageMaps.set(fighter.owner, damageMap);
  return damageMap;
}

function expectedDamageAt(state, fighter, cell) {
  const damageMap = expectedDamageMapFor(state, fighter);
  if (damageMap) return damageMap.get(keyOf(cell)) || 0;
  return expectedDamageAtUncached(state, fighter, cell);
}

function isProjectileVisibleTo(observer, projectile, now) {
  if (projectile.owner === observer.owner) return true;
  if (!projectile.sandwormHidden) return true;
  return projectile.impactAt - now <= SANDWORM_REVEAL_BEFORE_IMPACT_MS;
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
  const seen = new Set();
  const candidates = targetSnake.flatMap(segment => cellsWithinDistance(state, segment, 0, Math.max(1, Math.ceil(stats.radius))))
    .filter(cell => {
      const key = keyOf(cell);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return (candidates.length ? candidates : state.cells).sort((a, b) => {
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

function morayLineCandidateStats(targetSnake, lineCells, lineShape) {
  return targetSnake.reduce((stats, segment, index) => {
    const distance = lineCells.reduce((best, lineCell) => Math.min(best, hexDistance(segment, lineCell)), Infinity);
    const damageMultiplier = lineBandDamageMultiplier(distance, lineShape);
    if (index === 0) stats.headDistance = distance;
    if (damageMultiplier > 0) {
      stats.hits += 1;
      stats.damageScore += damageMultiplier;
      if (distance === 0) stats.exactHits += 1;
    }
    return stats;
  }, { hits: 0, exactHits: 0, damageScore: 0, headDistance: Infinity });
}

function isBetterMorayLineCandidate(candidate, best) {
  if (!best) return true;
  if (candidate.damageScore !== best.damageScore) return candidate.damageScore > best.damageScore;
  if (candidate.hits !== best.hits) return candidate.hits > best.hits;
  if (candidate.exactHits !== best.exactHits) return candidate.exactHits > best.exactHits;
  if (candidate.directionTurn !== best.directionTurn) return candidate.directionTurn < best.directionTurn;
  if (candidate.headDistance !== best.headDistance) return candidate.headDistance < best.headDistance;
  if (candidate.originIndex !== best.originIndex) return candidate.originIndex < best.originIndex;
  return candidate.ownerTurn < best.ownerTurn;
}

function chooseMorayLineAttackPlan(state, attacker, defender, balance) {
  const targetSnake = perceivedSnakeFor(state, attacker, defender);
  const fallbackTarget = targetSnake[0] || defender.snake[0] || attacker.snake[0];
  const fallbackDirection = attacker.dir;
  if (!targetSnake.length || !fallbackTarget) return { target: fallbackTarget, direction: fallbackDirection };

  const lineShape = bandShapeFromTotalWidth(attackStats(attacker.stock, "small", balance).radius);
  const idealDirection = directionForLongestBodyAxis(targetSnake, fallbackDirection);
  let best = null;
  targetSnake.forEach((origin, originIndex) => {
    DIRECTIONS.forEach((_, direction) => {
      const stats = morayLineCandidateStats(targetSnake, boardLineThrough(state, origin, direction), lineShape);
      const candidate = {
        target: { q: origin.q, r: origin.r },
        direction,
        originIndex,
        directionTurn: turnDistance(direction, idealDirection),
        ownerTurn: turnDistance(direction, fallbackDirection),
        ...stats
      };
      if (isBetterMorayLineCandidate(candidate, best)) best = candidate;
    });
  });
  return {
    target: best?.target || fallbackTarget,
    direction: Number.isInteger(best?.direction) ? best.direction : fallbackDirection
  };
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

function attackExpectedValue(state, attacker, defender, balance, profile, target, targetWeight, damageOverride = null) {
  const stats = attackStats(attacker.stock, profile, balance);
  const targetSnake = perceivedSnakeFor(state, attacker, defender);
  const damage = damageOverride ?? attackTargetDamageScore(state, targetSnake, target, stats, balance);
  const cappedDamage = Math.min(damage, defender.hp);
  const overkill = Math.max(0, damage - defender.hp);
  const allocation = attacker.policy.strategyWeights.skillAllocation;
  const allocationScore = profile === "small" ? allocation.preferSmall : allocation.preferBig;
  const resourcePenalty = attackResourceCost(profile, balance) * (profile === "big" ? 0.34 : 0.24);
  const controlValue = attackStunChance(attacker.stock, balance) * 1.4 + (isDebuffed(defender, state.now) ? 0.75 : 0);
  return cappedDamage * 1.15
    + targetWeight * 0.6
    + castTimingScore(state, attacker, defender, balance, profile)
    + allocationScore
    + skillPhaseBias(state, attacker, defender, balance, profile)
    + controlValue
    + (damage > 0 ? 0.6 : -2.5)
    - resourcePenalty
    - overkill * 0.35;
}

function highAttackTargetRows(state, attacker, defender, balance, profile) {
  const { stats, targetSnake, targetHead, bodyCluster, targetNearestFood } = attackTargetCandidates(state, attacker, defender, balance, profile);
  const weights = attacker.policy.strategyWeights.castTarget;
  const seen = new Set();
  return [
    { target: targetHead, weight: weights.targetHead },
    { target: bodyCluster, weight: weights.bodyCluster },
    { target: targetNearestFood, weight: state.foods.length ? weights.targetNearestFood : 0 }
  ]
    .filter(item => item.target && !seen.has(keyOf(item.target)) && seen.add(keyOf(item.target)))
    .map(item => {
      const damage = attackTargetDamageScore(state, targetSnake, item.target, stats, balance);
      return {
        target: item.target,
        weight: item.weight,
        damage,
        expectedValue: attackExpectedValue(state, attacker, defender, balance, profile, item.target, item.weight, damage)
      };
    })
    .map(row => ({
      ...row,
      targetScore: row.expectedValue + row.damage * 1.1 + row.weight * 1.2 + (row.damage <= 0 ? row.weight * 5 : 0)
    }))
    .sort((a, b) => {
      if (a.targetScore !== b.targetScore) return b.targetScore - a.targetScore;
      if (a.damage !== b.damage) return b.damage - a.damage;
      return wrappedDistance(state, targetHead, a.target) - wrappedDistance(state, targetHead, b.target);
    });
}

function attackProfileThreshold(profile) {
  return profile === "big" ? 4.2 : 4.5;
}

function chooseAiAttackProfile(state, fighter, opponent, balance) {
  if (fighter.policy.aiDifficulty === "novice") return null;
  const lethalProfiles = ["small", "big"].filter(profile => isLethalAttack(state, fighter, opponent, balance, profile));
  const lethal = lethalProfiles.includes("big") && lateGameSkillPhase(state, fighter, opponent, balance) >= 0.55
    ? "big"
    : lethalProfiles.sort((a, b) => attackResourceCost(a, balance) - attackResourceCost(b, balance))[0];
  if (lethal) return lethal;
  if (fighter.policy.aiDifficulty === "low" && shouldUseBigAttack(state, fighter, opponent, balance)) return "big";
  if (fighter.policy.aiDifficulty !== "high") {
    if (shouldUseBigAttack(state, fighter, opponent, balance)) return "big";
    if (shouldSaveSmallForBig(state, fighter, opponent, balance)) return null;
    if (canAttack(fighter, "small", balance)) return "small";
    if (fighter.policy.aiDifficulty === "low" && canAttack(fighter, "big", balance)) return "big";
    return null;
  }

  const available = ["small", "big"]
    .filter(profile => canAttack(fighter, profile, balance))
    .filter(profile => profile !== "small" || !shouldSaveSmallForBig(state, fighter, opponent, balance));
  if (!available.length) return null;
  const scored = available.map(profile => {
    const bestTarget = highAttackTargetRows(state, fighter, opponent, balance, profile)[0];
    const legacyBoost = profile === "big" && shouldUseBigAttack(state, fighter, opponent, balance) ? 1.25 : 0;
    return { profile, score: (bestTarget?.expectedValue ?? -Infinity) + legacyBoost };
  }).sort((a, b) => b.score - a.score);

  if (fighter.policy.skillStrategy === "saveBurst") {
    const big = scored.find(row => row.profile === "big");
    return big && big.score >= attackProfileThreshold("big") ? "big" : null;
  }
  const accepted = scored.find(row => row.score >= attackProfileThreshold(row.profile));
  return accepted ? accepted.profile : null;
}

function chooseAttackTarget(state, attacker, defender, balance, profile) {
  const { stats, targetSnake, targetHead, bodyCluster, targetNearestFood } = attackTargetCandidates(state, attacker, defender, balance, profile);
  if (profile === "big" && attacker.character.id === "moray") return chooseMorayLineAttackPlan(state, attacker, defender, balance).target;
  const maxDamageTarget = bestBodyClusterTarget(state, targetSnake, stats, balance) || targetHead;
  if (attackTargetDamageScore(state, targetSnake, maxDamageTarget, stats, balance) >= defender.hp) return { ...maxDamageTarget };
  if (attacker.policy.aiDifficulty === "high") {
    const best = highAttackTargetRows(state, attacker, defender, balance, profile)[0];
    if (best) return { ...best.target };
  }
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

function lobsterFistDirection(state, cursor, direction, targetSnake) {
  const target = targetSnake[0];
  if (!target) return direction;
  const candidates = [direction, (direction + 1) % DIRECTIONS.length, (direction - 1 + DIRECTIONS.length) % DIRECTIONS.length];
  candidates.sort((a, b) => {
    const nextA = nextWrappedCell(cursor, a, state.radius);
    const nextB = nextWrappedCell(cursor, b, state.radius);
    const distanceA = hexDistance(nextA, target);
    const distanceB = hexDistance(nextB, target);
    if (distanceA !== distanceB) return distanceA - distanceB;
    return turnDistance(a, direction) - turnDistance(b, direction);
  });
  return candidates[0];
}

function lobsterFistPath(state, source, direction, targetSnake) {
  const path = [];
  let cursor = { ...source };
  let currentDirection = direction;
  const maxSteps = Math.max(1, Math.ceil((state.radius * 2 + 1) / 2));
  const turnStep = Math.ceil(maxSteps / 2);
  for (let step = 0; step < maxSteps; step += 1) {
    if (step === turnStep) {
      currentDirection = lobsterFistDirection(state, cursor, currentDirection, targetSnake);
    }
    cursor = nextWrappedCell(cursor, currentDirection, state.radius);
    if (keyOf(cursor) === keyOf(source)) break;
    path.push({ ...cursor });
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
  const bigDamage = attackDamage(attacker.stock, "big", balance);
  const source = attacker.snake[0];
  const direction = Number.isInteger(aimDirection) ? aimDirection : directionFromSourceToTarget(source, target, attacker.dir);
  const characterId = attacker.character.id;
  if (characterId === "lobster") {
    const path = lobsterFistPath(state, source, direction, defender.snake);
    const hits = pathHits(path, defender.snake);
    const firstHit = hits[0];
    const travelPath = firstHit ? path.slice(0, firstHit.index + 1) : path;
    const endCell = firstHit?.cell || path[path.length - 1] || source;
    const fistStepMs = ultimateSetting(balance, characterId, "fistStepMs", LOBSTER_PALM_STEP_MS);
    const contactRadius = Math.max(0.25, ultimateSetting(balance, characterId, "contactRadius", 1));
    const burstRadius = small.radius * ultimateSetting(balance, characterId, "burstRadiusMultiplier", 1.5);
    const burstDamage = bigDamage * ultimateSetting(balance, characterId, "burstDamageMultiplier", 0.9);
    const volleys = Math.max(1, Math.round(ultimateSetting(balance, characterId, "volleyCount", 2)));
    const contactDamage = bigDamage * ultimateSetting(balance, characterId, "contactDamageMultiplier", 0.3);
    const volleyIntervalMs = attackDelay(attacker.stock, balance);
    for (let volley = 0; volley < volleys; volley += 1) {
      const volleyDelay = volley * volleyIntervalMs;
      state.projectiles.push({
        kind: "lobsterPalm",
        owner: attacker.owner,
        profile: "big",
        target: { ...endCell },
        pathCells: travelPath,
        impactAt: now + volleyDelay + small.delay + travelPath.length * fistStepMs,
        radius: contactRadius,
        damage: contactDamage,
        burstRadius,
        burstDamage,
        stunChance
      });
      const burstHits = firstHit ? [firstHit] : [{ cell: endCell, index: Math.max(0, travelPath.length - 1) }];
      for (const hit of burstHits) {
        state.projectiles.push({
          kind: "lobsterPalmBurst",
          owner: attacker.owner,
          profile: "big",
          target: { ...hit.cell },
          impactAt: now + volleyDelay + small.delay + (hit.index + 1) * fistStepMs,
          radius: contactRadius,
          damage: contactDamage,
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
    const lineShape = bandShapeFromTotalWidth(small.radius);
    const excludedCells = attacker.snake.map(segment => ({ ...segment }));
    state.projectiles.push({
      kind: "line",
      owner: attacker.owner,
      profile: "big",
      target,
      lineCells,
      excludedCells,
      width: lineShape.width,
      fullDamageWidth: lineShape.fullDamageWidth,
      outerDamageMultiplier: lineShape.outerDamageMultiplier,
      impactAt: now + small.delay,
      damage: bigDamage * 0.8 * ultimateDamageMultiplier(balance, characterId),
      stunChance,
      stackStun: true
    });
    return;
  }
  if (characterId === "quetzal") {
    const trail = attacker.snake.map(segment => ({ ...segment }));
    const extensionDamageMultiplier = Math.max(0, Math.min(1, (attacker.stock.protein || 0) / balance.resources.maxFoodStock));
    const outwardWidth = extensionDamageMultiplier > 0 ? 1 : 0;
    state.hazards.push({
      kind: "swamp",
      owner: attacker.owner,
      cells: trail,
      damageExcludedCells: trail,
      width: outwardWidth,
      minDistance: 0,
      outerDamageMultiplier: extensionDamageMultiplier,
      damage: bigDamage * ultimateDamageMultiplier(balance, characterId),
      profile: "big",
      stunChance,
      startedAt: now + small.delay,
      nextTickAt: now + small.delay,
      tickMs: moveInterval(attacker, balance, now),
      endAt: now + small.delay + 3000
    });
    return;
  }
  if (characterId === "sandworm") {
    const delay = small.delay * 3;
    attacker.undergroundFrom = now + Math.max(0, delay - SANDWORM_UNDERGROUND_WINDOW_MS);
    attacker.undergroundUntil = now + delay + SANDWORM_UNDERGROUND_WINDOW_MS;
    pushCircleAttack(state, {
      owner: attacker.owner,
      profile: "big",
      target,
      impactAt: now + delay,
      radius: Math.max(0.5, small.radius * 0.5),
      damage: bigDamage * 4 * ultimateDamageMultiplier(balance, characterId),
      stunChance,
      sandwormHidden: true,
      sandwormParalyzeOnBody: true,
      sandwormKillOnHead: true
    });
    return;
  }
  if (characterId === "dragon") {
    const spiritRadius = small.radius * ultimateSetting(balance, characterId, "radiusMultiplier", 2);
    const impactDamage = bigDamage * ultimateSetting(balance, characterId, "impactDamageMultiplier", 0.5);
    const radiationTotalDamage = bigDamage * ultimateSetting(balance, characterId, "radiationDamageMultiplier", 1.5);
    const radiationDurationMs = ultimateSetting(balance, characterId, "radiationDurationMs", 4000);
    const radiationTickMs = ultimateSetting(balance, characterId, "radiationTickMs", 500);
    const firstImpactDelay = small.delay * ultimateSetting(balance, characterId, "firstImpactDelayMultiplier", 2);
    const volleys = 1;
    for (let index = 0; index < volleys; index += 1) {
      const impactDelay = firstImpactDelay + index * 2000;
      state.projectiles.push({
        kind: "headCircle",
        owner: attacker.owner,
        profile: "big",
        target: { ...target },
        impactAt: now + impactDelay,
        radius: spiritRadius,
        damage: impactDamage,
        radiationDurationMs,
        radiationTickMs,
        radiationTotalDamage,
        stunChance,
        flat: true
      });
    }
    return;
  }
  if (characterId === "gu_king") {
    const volleyIntervalMs = small.delay;
    const firstImpactDelay = small.delay;
    for (let index = 0; index < 3; index += 1) {
      const impactDelay = firstImpactDelay + index * volleyIntervalMs;
      pushCircleAttack(state, {
        owner: attacker.owner,
        profile: "big",
        target,
        impactAt: now + impactDelay,
        radius: small.radius,
        damage: bigDamage * ultimateDamageMultiplier(balance, characterId),
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
  const cooldownScale = profile === "small" ? SMALL_ATTACK_COOLDOWN_SCALE : 1;
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
    const morayLinePlan = attacker.character.id === "moray"
      ? chooseMorayLineAttackPlan(state, attacker, defender, balance)
      : null;
    const attackTarget = morayLinePlan?.target || target;
    const aimDirection = morayLinePlan?.direction ?? chooseAttackDirection(state, attacker, defender, attackTarget, attacker.dir);
    scheduleBigAttack(state, attacker, defender, attackTarget, now, balance, stunChance, aimDirection);
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
    if (projectile.kind === "lobsterPalm") {
      continue;
    } else if (projectile.kind === "lobsterPalmBurst") {
      const defenderDamage = damageSnake(defender.snake, projectile.target, projectile.radius, projectile.damage, balance);
      if (defenderOwner === "player") playerDamage += defenderDamage;
      else computerDamage += defenderDamage;
      playerDamage += damageSnake(player.snake, projectile.target, projectile.burstRadius, projectile.burstDamage, balance);
      computerDamage += damageSnake(computer.snake, projectile.target, projectile.burstRadius, projectile.burstDamage, balance);
    } else if (projectile.kind === "line") {
      playerDamage = damageSnakeCells(player.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells, 0, projectile.outerDamageMultiplier ?? 1, projectile.fullDamageWidth ?? 0);
      computerDamage = damageSnakeCells(computer.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells, 0, projectile.outerDamageMultiplier ?? 1, projectile.fullDamageWidth ?? 0);
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
      if (projectile.sandwormParalyzeOnBody || projectile.sandwormKillOnHead) {
        if (projectile.owner !== "player") {
          if (projectile.sandwormKillOnHead && snakeHeadHitAtCenter(player.snake, explosionTarget)) playerDamage = Math.max(playerDamage, player.hp);
          else if (projectile.sandwormParalyzeOnBody && snakeBodyHitAtCenter(player.snake, explosionTarget)) {
            applyCollisionParalysis(player, now, balance);
            attacker.stats.stunApplied += 1;
          }
        }
        if (projectile.owner !== "computer") {
          if (projectile.sandwormKillOnHead && snakeHeadHitAtCenter(computer.snake, explosionTarget)) computerDamage = Math.max(computerDamage, computer.hp);
          else if (projectile.sandwormParalyzeOnBody && snakeBodyHitAtCenter(computer.snake, explosionTarget)) {
            applyCollisionParalysis(computer, now, balance);
            attacker.stats.stunApplied += 1;
          }
        }
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
      : damageSnakeCells(state.fighters.player.snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "player" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1);
    let computerDamage = hazard.kind === "radiation"
      ? damageSnake(state.fighters.computer.snake, hazard.target, hazard.radius, hazard.damage, balance)
      : damageSnakeCells(state.fighters.computer.snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "computer" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1);
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
  const movedOwners = [];
  const collisionOwners = [];
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

  for (let pass = 0; pass < 2; pass += 1) {
    movers.forEach(owner => {
      const fighter = state.fighters[owner];
      const opponent = owner === "player" ? computer : player;
      const plan = plans[owner];
      const otherPlan = plans[opponent.owner];
      if (!plan || plan.collision || !otherPlan?.collision) return;
      if (opponent.snake.some(segment => keyOf(segment) === plan.nextKey)) {
        plan.collision = collisionSeverity(false, true);
      }
    });
  }

  movers.forEach(owner => {
    const fighter = state.fighters[owner];
    const plan = plans[owner];
    if (plan.collision) {
      collisionOwners.push(owner);
      if (applyCollisionPenalty(fighter, plan.collision, now, balance)) defeatByCollisionParalysis(state, fighter, now);
      return;
    }
    movedOwners.push(owner);
    fighter.snake.unshift(plan.next);
    if (plan.eating) {
      fighter.score += 1;
      fighter.stats.foodCollected += 1;
      fighter.lastFoodAt = now;
      fighter.foodTargetKey = null;
      fighter.foodTargetAt = 0;
      collectFood(fighter, plan.eatenFood, balance, state.rng);
      fighter.hp = Math.min(maxHpForSnake(fighter.snake, state.balance), fighter.hp + foodHealAmount(state.balance));
    } else {
      fighter.snake.pop();
    }
  });

  const eatenKeys = new Set(Object.values(plans).filter(plan => plan.eating && !plan.collision).map(plan => plan.nextKey));
  if (eatenKeys.size) {
    state.foods = state.foods.filter(food => !eatenKeys.has(keyOf(food)));
    placeFoods(state, Object.entries(plans).filter(([, plan]) => plan.eating && !plan.collision).map(([owner]) => owner));
  }

  return { movedOwners, collisionOwners, plans };
}

function sampleStock(fighter) {
  fighter.stats.totalStock += FOOD_TYPES.reduce((sum, type) => sum + (fighter.stock[type] || 0), 0);
  fighter.stats.stockSamples += 1;
}

function sampleStockTicks(state, ticks) {
  if (ticks <= 0) return;
  Object.values(state.fighters).forEach(fighter => {
    const total = FOOD_TYPES.reduce((sum, type) => sum + (fighter.stock[type] || 0), 0);
    fighter.stats.totalStock += total * ticks;
    fighter.stats.stockSamples += ticks;
  });
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
    cellIndexByKey: board.cellIndexByKey,
    neighbors: board.neighbors,
    nearbyOne: board.nearbyOne,
    wrappedDistances: board.wrappedDistances,
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

function ceilToTick(value, tickMs) {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.ceil(Math.max(0, value) / tickMs) * tickMs;
}

function nextProjectileTick(state, tickMs) {
  return state.projectiles.reduce((soonest, projectile) => Math.min(soonest, ceilToTick(projectile.impactAt, tickMs)), Number.POSITIVE_INFINITY);
}

function nextHazardTick(state, tickMs) {
  return state.hazards.reduce((soonest, hazard) => {
    if (state.now > hazard.endAt) return soonest;
    return Math.min(soonest, ceilToTick(Math.max(hazard.startedAt, hazard.nextTickAt), tickMs));
  }, Number.POSITIVE_INFINITY);
}

function nextMoveTick(state, fighter, balance, tickMs) {
  const nextSequentialTick = state.now + tickMs;
  const candidates = [
    nextSequentialTick,
    fighter.stunUntil,
    fighter.slowUntil,
    fighter.lastStep + moveInterval(fighter, balance, nextSequentialTick),
    fighter.lastStep + moveInterval(fighter, balance, Math.max(fighter.slowUntil, nextSequentialTick))
  ];
  const ticks = [...new Set(candidates
    .filter(Number.isFinite)
    .map(candidate => Math.max(nextSequentialTick, ceilToTick(Math.max(candidate, fighter.stunUntil), tickMs))))]
    .sort((left, right) => left - right);
  return ticks.find(tick => tick >= fighter.stunUntil && tick - fighter.lastStep >= moveInterval(fighter, balance, tick)) ?? Number.POSITIVE_INFINITY;
}

function nextMeaningfulTick(state, balance, tickMs, maxMatchMs) {
  const nextSequentialTick = Math.min(maxMatchMs, state.now + tickMs);
  const eventTicks = [
    nextProjectileTick(state, tickMs),
    nextHazardTick(state, tickMs)
  ];
  Object.values(state.fighters).forEach(fighter => {
    eventTicks.push(nextMoveTick(state, fighter, balance, tickMs));
  });
  const soonest = Math.min(...eventTicks.filter(value => Number.isFinite(value) && value > state.now));
  if (!Number.isFinite(soonest)) return maxMatchMs;
  return Math.min(maxMatchMs, Math.max(nextSequentialTick, soonest));
}

function simulateMatch(options) {
  const state = createMatchState(options);
  const balance = state.balance;
  const maxMatchMs = options.maxMatchMs ?? balance.simulation.maxMatchMs;
  const tickMs = options.tickMs ?? balance.simulation.tickMs;
  const skipEmptyTicks = options.skipEmptyTicks !== false;
  while (state.now < maxMatchMs && state.fighters.player.hp > 0 && state.fighters.computer.hp > 0) {
    const previousNow = state.now;
    const nextNow = skipEmptyTicks
      ? nextMeaningfulTick(state, balance, tickMs, maxMatchMs)
      : Math.min(maxMatchMs, state.now + tickMs);
    const skippedTicks = Math.max(0, Math.round((nextNow - previousNow) / tickMs) - 1);
    sampleStockTicks(state, skippedTicks);
    state.now = nextNow;
    resolveProjectiles(state, state.now, balance);
    resolveHazards(state, state.now, balance);
    updateVisibleMemory(state);
    const movers = Object.values(state.fighters)
      .filter(fighter => state.now >= fighter.stunUntil && state.now - fighter.lastStep >= moveInterval(fighter, balance, state.now))
      .map(fighter => fighter.owner);
    if (movers.length) {
      const { movedOwners } = moveFighters(state, movers, state.now, balance);
      movers.forEach(owner => {
        state.fighters[owner].lastStep = state.now;
      });
      movedOwners.forEach(owner => {
        const fighter = state.fighters[owner];
        const opponent = owner === "player" ? state.fighters.computer : state.fighters.player;
        if (fighter.hp <= 0 || opponent.hp <= 0 || state.now < fighter.stunUntil) return;
        const profile = chooseAttackProfile(state, fighter, opponent, balance);
        if (profile) launchAttack(state, fighter, opponent, profile, state.now, balance);
      });
    }
    Object.values(state.fighters).forEach(sampleStock);
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
      resourceEfficiency: totalCasts ? playerTotals.damageDealt / (playerTotals.smallCasts * attackResourceCost("small", balance) + playerTotals.bigCasts * attackResourceCost("big", balance)) : 0,
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
  highAiStrategiesFromData,
  loadHighAiStrategies,
  hexDistance,
  wrappedDistance,
  createBoard,
  nextWrappedCell,
  createStartingSnake,
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
  launchAttack,
  chooseFoodTarget,
  directionToward,
  perceivedSnakeFor,
  isUnderground,
  isProjectileVisibleTo,
  updateVisibleMemory,
  resolveProjectiles,
  resolveHazards,
  simulateMatch,
  runSeries
};
