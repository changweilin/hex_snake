(function initHexSnakeRules(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HexSnakeRules = api;
})(typeof globalThis !== "undefined" ? globalThis : undefined, function createHexSnakeRules() {
  "use strict";

  const FOOD_TYPES = Object.freeze(["protein", "fat", "fiber", "carb"]);
  const DIRECTIONS = Object.freeze([
    Object.freeze({ q: 0, r: -1 }),
    Object.freeze({ q: 1, r: -1 }),
    Object.freeze({ q: 1, r: 0 }),
    Object.freeze({ q: 0, r: 1 }),
    Object.freeze({ q: -1, r: 1 }),
    Object.freeze({ q: -1, r: 0 })
  ]);
  const DEFAULTS = Object.freeze({
    smallAttackDelayScale: 0.31,
    smallAttackCooldownScale: 0.29,
    sandwormRevealBeforeImpactMs: 200,
    hpPerSnakeUnit: 4,
    attackDamageMultiplier: 1,
    smallAttackFoodCost: 2,
    smallAttackBombCost: 1,
    bigAttackBombCost: 2,
    maxProteinRangeBonus: 1,
    blackFoodDoubleBonusChance: 1 / 15,
    blackFoodBonusChance: 1 / 3,
    balancedFoodBonusChance: 0.2,
    favoriteFoodBonusChance: 0.5
  });

  function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function setting(config, section, key, fallback) {
    return config?.[section]?.[key] ?? config?.[key] ?? fallback;
  }

  function numberSetting(config, section, key, fallback) {
    return finiteOr(setting(config, section, key, fallback), fallback);
  }

  function resource(config, key, fallback) {
    return numberSetting(config, "resources", key, fallback);
  }

  function attack(config, key, fallback) {
    return numberSetting(config, "attack", key, fallback);
  }

  function movement(config, key, fallback) {
    return numberSetting(config, "movement", key, fallback);
  }

  function health(config, key, fallback) {
    return numberSetting(config, "health", key, fallback);
  }

  function foodWeight(config, key, fallback) {
    return numberSetting(config, "foodWeights", key, fallback);
  }

  function foodTypeIds(config = null) {
    if (!Array.isArray(config?.foodTypes)) return FOOD_TYPES;
    const ids = config.foodTypes
      .map(type => typeof type === "string" ? type : type?.id)
      .filter(type => FOOD_TYPES.includes(type));
    return ids.length ? ids : FOOD_TYPES;
  }

  function directionList(directions = null) {
    return Array.isArray(directions) && directions.length ? directions : DIRECTIONS;
  }

  function rngAdapter(rng = null) {
    if (rng && typeof rng.next === "function") {
      return {
        next: () => rng.next(),
        int: max => typeof rng.int === "function" ? rng.int(max) : Math.floor(rng.next() * max),
        item: items => typeof rng.item === "function" ? rng.item(items) : items[Math.floor(rng.next() * items.length)]
      };
    }
    return {
      next: () => Math.random(),
      int: max => Math.floor(Math.random() * max),
      item: items => items[Math.floor(Math.random() * items.length)]
    };
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

  function isInside(cell, radius) {
    return Math.abs(cell.q) <= radius && Math.abs(cell.r) <= radius && Math.abs(cell.q + cell.r) <= radius;
  }

  function nextCell(head, direction, directions = null) {
    const delta = directionList(directions)[direction];
    return { q: head.q + delta.q, r: head.r + delta.r };
  }

  function nextWrappedCell(head, direction, radius, directions = null) {
    const next = nextCell(head, direction, directions);
    if (isInside(next, radius)) return next;
    const oppositeDirection = (direction + 3) % directionList(directions).length;
    let wrapped = head;
    while (isInside(nextCell(wrapped, oppositeDirection, directions), radius)) {
      wrapped = nextCell(wrapped, oppositeDirection, directions);
    }
    return wrapped;
  }

  function buildBoardTopology(radius, cells, directions = null) {
    const cellIndexByKey = new Map(cells.map((cell, index) => [keyOf(cell), index]));
    const neighbors = cells.map(cell => directionList(directions).map((_, direction) => {
      const next = nextWrappedCell(cell, direction, radius, directions);
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

  function createBoard(gridSize, directions = null) {
    const radius = gridSize - 1;
    const cells = [];
    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        if (Math.abs(q + r) <= radius) cells.push({ q, r });
      }
    }
    return { radius, cells, ...buildBoardTopology(radius, cells, directions) };
  }

  function wrappedDistance(state, start, target, directions = null) {
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
      for (let direction = 0; direction < directionList(directions).length; direction += 1) {
        const next = nextWrappedCell(current.cell, direction, state.radius, directions);
        const nextKey = keyOf(next);
        if (seen.has(nextKey)) continue;
        if (nextKey === keyOf(target)) return current.distance + 1;
        seen.add(nextKey);
        queue.push({ cell: next, distance: current.distance + 1 });
      }
    }
    return hexDistance(start, target);
  }

  function createStartingSnake(head, direction, length, radius, directions = null) {
    const segments = [{ ...head }];
    let cursor = { ...head };
    const bodyDirection = (direction + 3) % directionList(directions).length;
    const used = new Set([keyOf(cursor)]);
    while (segments.length < length) {
      const next = nextWrappedCell(cursor, bodyDirection, radius, directions);
      if (used.has(keyOf(next))) break;
      segments.push(next);
      used.add(keyOf(next));
      cursor = next;
    }
    return segments;
  }

  function emptyStock(config = null) {
    return Object.fromEntries(foodTypeIds(config).map(type => [type, 0]));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function addStock(stock, typeId, amount, config) {
    stock[typeId] = clamp((stock[typeId] || 0) + amount, 0, resource(config, "maxFoodStock", 20));
  }

  function addRandomStock(stock, candidates, amount, config, rng = null) {
    const available = candidates.filter(type => foodTypeIds(config).includes(type));
    if (!available.length) return;
    addStock(stock, rngAdapter(rng).item(available), amount, config);
  }

  function foodBonus(stock, typeId, perPoint, maxBonus) {
    return Math.min(maxBonus, (stock[typeId] || 0) * perPoint);
  }

  function moveMultiplier(stock, config) {
    return 1 + foodBonus(stock, "fiber", movement(config, "moveBonusPerPoint", 0), movement(config, "maxMoveBonus", 0));
  }

  function damageMultiplier(stock, config) {
    return 2 + foodBonus(stock, "fat", attack(config, "damageBonusPerPoint", 0), attack(config, "maxDamageBonus", 0));
  }

  function attackDamageMultiplier(profile, config) {
    const value = profile === "small"
      ? setting(config, "attack", "smallAttackDamageMultiplier", DEFAULTS.attackDamageMultiplier)
      : setting(config, "attack", "bigAttackDamageMultiplier", DEFAULTS.attackDamageMultiplier);
    return Number.isFinite(value) ? value : DEFAULTS.attackDamageMultiplier;
  }

  function attackDamage(stock, profile, config) {
    return damageMultiplier(stock, config) * attackDamageMultiplier(profile, config);
  }

  function areaMultiplier(stock, config) {
    const perPoint = attack(config, "proteinRangeBonusPerPoint", 1 / Math.max(1, resource(config, "maxFoodStock", 20)));
    return 1 + foodBonus(stock, "protein", perPoint, attack(config, "maxProteinRangeBonus", DEFAULTS.maxProteinRangeBonus));
  }

  function attackSpeedMultiplier(stock, config) {
    return 1 + foodBonus(stock, "carb", attack(config, "attackSpeedBonusPerPoint", 0), attack(config, "maxAttackSpeedBonus", 0));
  }

  function attackCooldownMultiplier(stock, config) {
    return 1 + foodBonus(stock, "fiber", attack(config, "attackSpeedBonusPerPoint", 0), attack(config, "maxAttackSpeedBonus", 0));
  }

  function attackStunChance(stock, config, baseChance = attack(config, "baseAttackStunChance", 0)) {
    return Math.min(1, baseChance + foodBonus(stock, "carb", attack(config, "attackStunChanceBonusPerPoint", 0), attack(config, "maxAttackStunChanceBonus", 0)));
  }

  function attackHitStunChances(stock, config) {
    const bodyBase = attack(config, "bodyHitStunChance", 0.15);
    const bodyPerPoint = attack(config, "bodyHitStunChanceBonusPerPoint", attack(config, "attackStunChanceBonusPerPoint", 0));
    const bodyMaxBonus = attack(config, "bodyHitMaxStunChanceBonus", attack(config, "maxAttackStunChanceBonus", 0));
    const headBase = attack(config, "headHitStunChance", attack(config, "baseAttackStunChance", 0));
    const headPerPoint = attack(config, "headHitStunChanceBonusPerPoint", attack(config, "attackStunChanceBonusPerPoint", 0) * 2);
    const headMaxBonus = attack(config, "headHitMaxStunChanceBonus", 0.4);
    return {
      body: Math.min(1, bodyBase + foodBonus(stock, "carb", bodyPerPoint, bodyMaxBonus)),
      head: Math.min(1, headBase + foodBonus(stock, "carb", headPerPoint, headMaxBonus))
    };
  }

  function attackDelay(stock, config) {
    return attack(config, "baseAttackDelayMs", 0) / attackSpeedMultiplier(stock, config);
  }

  function ultimateSetting(config, characterId, key, fallback) {
    return config?.attack?.ultimates?.[characterId]?.[key]
      ?? config?.attackUltimateBalance?.[characterId]?.[key]
      ?? fallback;
  }

  function attackCooldown(stock, config, profile = "big", characterId = null) {
    const baseCooldown = profile === "big" && characterId
      ? ultimateSetting(config, characterId, "bigCooldownMs", attack(config, "baseAttackCooldownMs", 0))
      : attack(config, "baseAttackCooldownMs", 0);
    return baseCooldown / attackCooldownMultiplier(stock, config);
  }

  function smallAttackDelayScale(config) {
    return attack(config, "smallAttackDelayScale", DEFAULTS.smallAttackDelayScale);
  }

  function smallAttackCooldownScale(config) {
    return attack(config, "smallAttackCooldownScale", DEFAULTS.smallAttackCooldownScale);
  }

  function attackProfileCooldown(stock, config, profile = "big", characterId = null) {
    return attackCooldown(stock, config, profile, characterId) * (profile === "small" ? smallAttackCooldownScale(config) : 1);
  }

  function blastRadius(stock, config) {
    return attack(config, "baseBlastHexRadius", 0) * areaMultiplier(stock, config);
  }

  function hpPerSnakeUnit(config = null) {
    return health(config, "hpPerSnakeUnit", DEFAULTS.hpPerSnakeUnit);
  }

  function maxHpForSnake(snake = [], config = null) {
    return ((snake?.length || 0) + 1) * hpPerSnakeUnit(config);
  }

  function foodHealAmount(config = null) {
    return hpPerSnakeUnit(config);
  }

  function attackFoodCost(profile = "big", config = null) {
    return profile === "small" ? attack(config, "smallAttackFoodCost", DEFAULTS.smallAttackFoodCost) : 2;
  }

  function attackBombCost(profile = "big", config = null) {
    return profile === "small"
      ? attack(config, "smallAttackBombCost", DEFAULTS.smallAttackBombCost)
      : attack(config, "bigAttackBombCost", DEFAULTS.bigAttackBombCost);
  }

  function highestStockFoodType(stock, config = null) {
    return foodTypeIds(config).reduce((best, type) => {
      const currentCount = stock[type] || 0;
      const bestCount = best ? (stock[best] || 0) : -Infinity;
      return currentCount > bestCount ? type : best;
    }, null);
  }

  function hasAttackFoodCost(stock, profile, config) {
    const cost = attackFoodCost(profile, config);
    if (profile === "small") {
      const highestType = highestStockFoodType(stock, config);
      return Boolean(highestType) && (stock[highestType] || 0) >= cost;
    }
    return foodTypeIds(config).every(type => (stock[type] || 0) >= cost);
  }

  function canAttackWithResources(stock, ammo, profile, config) {
    return ammo >= attackBombCost(profile, config) && hasAttackFoodCost(stock, profile, config);
  }

  function canAttack(fighter, profile, config) {
    return canAttackWithResources(fighter.stock, fighter.ammo, profile, config);
  }

  function attackStats(stock, profile, config) {
    const isSmall = profile === "small";
    return {
      delay: attackDelay(stock, config) * (isSmall ? smallAttackDelayScale(config) : 1),
      radius: Math.max(1, blastRadius(stock, config) + (isSmall ? -1 : 0)),
      damage: attackDamage(stock, profile, config)
    };
  }

  function sandwormRevealBeforeImpactMs(config) {
    return attack(config, "sandwormRevealBeforeImpactMs", DEFAULTS.sandwormRevealBeforeImpactMs);
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

  function convertFullEnergyToAmmo(fighter, config) {
    if (fighter.ammoCharge < resource(config, "attackNeedTotal", 0) || fighter.ammo >= resource(config, "maxAmmo", 0)) return false;
    fighter.ammo = Math.min(resource(config, "maxAmmo", 0), fighter.ammo + 1);
    fighter.ammoCharge = 0;
    return true;
  }

  function consumeAttackCost(fighter, profile, config) {
    const cost = attackFoodCost(profile, config);
    const bombCost = attackBombCost(profile, config);
    const hadFullEnergy = fighter.ammoCharge >= resource(config, "attackNeedTotal", 0);
    const hadFullBombs = fighter.ammo >= resource(config, "maxAmmo", 0);
    if (profile === "small") {
      const highestType = highestStockFoodType(fighter.stock, config);
      if (highestType) fighter.stock[highestType] = Math.max(0, (fighter.stock[highestType] || 0) - cost);
    } else {
      foodTypeIds(config).forEach(type => {
        fighter.stock[type] = Math.max(0, (fighter.stock[type] || 0) - cost);
      });
    }
    fighter.ammo = Math.max(0, fighter.ammo - bombCost);
    if (bombCost > 0 && hadFullEnergy && hadFullBombs) convertFullEnergyToAmmo(fighter, config);
  }

  function addAmmoCharge(fighter, amount, config) {
    fighter.ammoCharge += amount;
    if (fighter.ammoCharge >= resource(config, "attackNeedTotal", 0)) {
      if (fighter.ammo < resource(config, "maxAmmo", 0)) {
        fighter.ammo = Math.min(resource(config, "maxAmmo", 0), fighter.ammo + 1);
        fighter.ammoCharge = 0;
      } else {
        fighter.ammoCharge = resource(config, "attackNeedTotal", 0);
      }
    }
  }

  function randomFoodType(preferredFoodId, config, rng = null) {
    const random = rngAdapter(rng);
    const ids = foodTypeIds(config);
    if (!preferredFoodId || preferredFoodId === "balanced") return random.item(ids);
    let roll = random.next();
    for (const type of ids) {
      const weight = type === preferredFoodId
        ? foodWeight(config, "preferred", 0)
        : foodWeight(config, "other", 0);
      if (roll < weight) return type;
      roll -= weight;
    }
    return ids[ids.length - 1];
  }

  function characterFoodPreference(character) {
    return character?.foodPreference || character?.food || "balanced";
  }

  function randomFoodTypeIdsForCharacter(character, config, rng = null) {
    const random = rngAdapter(rng);
    if (character?.specialFood === "black" && random.next() < foodWeight(config, "blackSpecialChance", 0)) return ["black"];
    if (character?.specialFood === "black") return [randomFoodType(null, config, random)];
    const preferredFoodId = characterFoodPreference(character);
    const first = randomFoodType(preferredFoodId, config, random);
    if (preferredFoodId !== "balanced" || random.next() >= foodWeight(config, "balancedDualChance", 0)) return [first];
    const second = random.item(foodTypeIds(config).filter(type => type !== first));
    return [first, second];
  }

  function foodTypeIdsForValue(food, config = null) {
    const types = Array.isArray(food?.types) && food.types.length ? food.types : (food?.type ? [food.type] : []);
    if (types.includes("black")) return foodTypeIds(config);
    return types.filter(type => foodTypeIds(config).includes(type));
  }

  function applyCharacterFoodStockBonus(fighter, food, config, rng = null) {
    const random = rngAdapter(rng);
    const types = Array.isArray(food?.types) ? food.types : [];
    const character = fighter?.character;
    if (!character) return;
    const preferredFood = characterFoodPreference(character);
    const hasBlackFood = types.includes("black");
    const stockTypes = types.filter(type => foodTypeIds(config).includes(type));
    const isBlackSpecialist = character?.specialFood === "black" || preferredFood === "black";
    if (isBlackSpecialist) {
      if (!hasBlackFood) return;
      const roll = random.next();
      const doubleChance = resource(config, "blackFoodDoubleBonusChance", DEFAULTS.blackFoodDoubleBonusChance);
      const singleChance = resource(config, "blackFoodBonusChance", DEFAULTS.blackFoodBonusChance);
      if (roll < doubleChance) {
        addRandomStock(fighter.stock, foodTypeIds(config), 2, config, random);
      } else if (roll < doubleChance + singleChance) {
        addRandomStock(fighter.stock, foodTypeIds(config), 1, config, random);
      }
      return;
    }
    if (preferredFood === "balanced") {
      const candidates = hasBlackFood ? foodTypeIds(config) : stockTypes;
      if (candidates.length && random.next() < resource(config, "balancedFoodBonusChance", DEFAULTS.balancedFoodBonusChance)) {
        addRandomStock(fighter.stock, candidates, 1, config, random);
      }
      return;
    }
    if (
      stockTypes.length === 1
      && stockTypes[0] === preferredFood
      && random.next() < resource(config, "favoriteFoodBonusChance", DEFAULTS.favoriteFoodBonusChance)
    ) {
      addStock(fighter.stock, stockTypes[0], 1, config);
    }
  }

  function collectFood(fighter, food, config, rng = null) {
    const random = rngAdapter(rng);
    const types = Array.isArray(food?.types) && food.types.length ? food.types : (food?.type ? [food.type] : []);
    if (types.includes("black")) {
      addStock(fighter.stock, random.item(foodTypeIds(config)), 1, config);
      addAmmoCharge(fighter, resource(config, "blackFoodEnergy", 0), config);
      applyCharacterFoodStockBonus(fighter, { ...food, types }, config, random);
      return;
    }
    const stockGain = types.length > 1 ? resource(config, "dualColorStockGain", 1) : resource(config, "singleColorStockGain", 1);
    types.forEach(typeId => addStock(fighter.stock, typeId, stockGain, config));
    applyCharacterFoodStockBonus(fighter, { ...food, types }, config, random);
    addAmmoCharge(fighter, resource(config, "foodEnergy", 0), config);
  }

  function circleDamageMultiplier(distance, radius) {
    if (!Number.isFinite(radius) || radius <= 0) return distance === 0 ? 1 : 0;
    return Math.max(0, Math.min(1, 1 - distance / radius));
  }

  function damageSnake(parts, target, radius, damageScale) {
    return parts.reduce((total, segment) => {
      const multiplier = circleDamageMultiplier(hexDistance(segment, target), radius);
      return total + damageScale * multiplier;
    }, 0);
  }

  function damageSnakeCells(parts, effectCells, width, damageScale, excludedCells = [], minDistance = 0, outerDamageMultiplier = 1, fullDamageWidth = 0) {
    const excluded = cellKeySet(excludedCells);
    return parts.reduce((total, segment) => {
      if (excluded.has(keyOf(segment))) return total;
      const bestMultiplier = effectCells.reduce((bestValue, cell) => {
        const distance = hexDistance(segment, cell);
        if (distance < minDistance || distance > width) return bestValue;
        return Math.max(bestValue, lineBandDamageMultiplier(distance, { width, fullDamageWidth, outerDamageMultiplier }));
      }, 0);
      return bestMultiplier > 0 ? total + damageScale * bestMultiplier : total;
    }, 0);
  }

  return Object.freeze({
    DEFAULTS,
    DIRECTIONS,
    FOOD_TYPES,
    addAmmoCharge,
    addRandomStock,
    addStock,
    areaMultiplier,
    attackCooldown,
    attackCooldownMultiplier,
    attackDamage,
    attackDamageMultiplier,
    attackDelay,
    attackFoodCost,
    attackHitStunChances,
    attackBombCost,
    attackProfileCooldown,
    attackSpeedMultiplier,
    attackStats,
    attackStunChance,
    applyCharacterFoodStockBonus,
    bandDistanceFromTotalWidth,
    bandShapeFromTotalWidth,
    blastRadius,
    buildBoardTopology,
    canAttack,
    canAttackWithResources,
    cellKeySet,
    characterFoodPreference,
    circleDamageMultiplier,
    clamp,
    collectFood,
    consumeAttackCost,
    convertFullEnergyToAmmo,
    createBoard,
    createStartingSnake,
    damageMultiplier,
    damageSnake,
    damageSnakeCells,
    emptyStock,
    foodBonus,
    foodHealAmount,
    foodTypeIds,
    foodTypeIdsForValue,
    hasAttackFoodCost,
    hexDistance,
    highestStockFoodType,
    hpPerSnakeUnit,
    isInside,
    keyOf,
    lineBandDamageMultiplier,
    maxHpForSnake,
    moveMultiplier,
    nextCell,
    nextWrappedCell,
    randomFoodType,
    randomFoodTypeIdsForCharacter,
    sandwormRevealBeforeImpactMs,
    smallAttackCooldownScale,
    smallAttackDelayScale,
    wrappedDistance
  });
});
