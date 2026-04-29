const fs = require("fs");
const path = require("path");

const FOOD_TYPES = ["protein", "fat", "fiber", "carb"];
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
  const maxFoodStock = balance.resources.maxFoodStock;
  if ((stock.protein || 0) >= maxFoodStock * 0.8) return 4;
  if ((stock.protein || 0) >= maxFoodStock * 0.4) return 3;
  return balance.attack.baseBlastHexRadius;
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
  return parts.reduce((total, segment) => {
    const distance = hexDistance(segment, target);
    if (distance > radius) return total;
    const hitChance = Math.max(0, Math.min(1, 1 - distance / radius));
    return total + damageScale * falloff * hitChance;
  }, 0);
}

function damageSnakeFlat(parts, target, radius, damageScale) {
  return parts.reduce((total, segment) => hexDistance(segment, target) <= radius ? total + damageScale : total, 0);
}

function damageSnakeCells(parts, effectCells, width, damageScale, excludedCells = []) {
  const excluded = cellKeySet(excludedCells);
  return parts.reduce((total, segment) => {
    if (excluded.has(keyOf(segment))) return total;
    return effectCells.some(cell => hexDistance(segment, cell) <= width) ? total + damageScale : total;
  }, 0);
}

function buildCharacterMap(characters) {
  return new Map(characters.map(character => [character.id, character]));
}

function makePolicy(overrides = {}) {
  return {
    pathPrecision: clamp(Number(overrides.pathPrecision ?? 0.82), 0, 1),
    aimPrecision: clamp(Number(overrides.aimPrecision ?? 0.78), 0, 1),
    skillStrategy: overrides.skillStrategy || "balanced",
    foodStrategy: overrides.foodStrategy || "balanced"
  };
}

function makeFighter(owner, character, start, direction, settings, balance, policy) {
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
    stats: {
      smallCasts: 0,
      bigCasts: 0,
      damageDealt: 0,
      damageTaken: 0,
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

function foodValueFor(fighter, opponent, food, policy) {
  const ownDistance = hexDistance(fighter.snake[0], food);
  const opponentDistance = hexDistance(opponent.snake[0], food);
  const types = food.types || [];
  const prefers = types.includes(fighter.character.foodPreference);
  if (policy.foodStrategy === "denyOpponent") return opponentDistance - ownDistance * 0.7;
  if (policy.foodStrategy === "selfStockpile") return -ownDistance + types.reduce((sum, type) => sum + (fighter.stock[type] || 0), 0) * 0.03;
  if (policy.foodStrategy === "preferredFood") return (prefers ? 3 : 0) - ownDistance;
  return -ownDistance + (opponentDistance <= ownDistance ? 0.4 : 0);
}

function chooseFoodTarget(state, fighter, opponent) {
  if (!state.foods.length) return opponent.snake[0];
  return [...state.foods].sort((a, b) => foodValueFor(fighter, opponent, b, fighter.policy) - foodValueFor(fighter, opponent, a, fighter.policy))[0];
}

function directionToward(state, fighter, opponent, target) {
  const occupied = new Set(fighter.snake.slice(0, -1).map(keyOf));
  if (fighter.policy.pathPrecision > 0.35) opponent.snake.forEach(segment => occupied.add(keyOf(segment)));
  const options = [];
  DIRECTIONS.forEach((_, direction) => {
    if (!canTurn(fighter.snake, fighter.dir, direction)) return;
    const next = nextWrappedCell(fighter.snake[0], direction, state.radius);
    const key = keyOf(next);
    const blocked = occupied.has(key);
    const wallSpace = state.cells.filter(cell => hexDistance(cell, next) <= 1 && !occupied.has(keyOf(cell))).length;
    options.push({
      direction,
      blocked,
      score: hexDistance(next, target) + (blocked ? 8 : 0) - wallSpace * 0.04
    });
  });
  const viable = options.length ? options : [{ direction: fighter.dir, score: 0, blocked: false }];
  viable.sort((a, b) => a.score - b.score);
  if (state.rng.next() > fighter.policy.pathPrecision) return state.rng.item(viable).direction;
  return viable[0].direction;
}

function cellsWithinDistance(state, origin, minDistance, maxDistance) {
  return state.cells.filter(cell => {
    const distance = hexDistance(cell, origin);
    return distance >= minDistance && distance <= maxDistance;
  });
}

function chooseAttackProfile(fighter, balance, rng) {
  const strategy = fighter.policy.skillStrategy;
  if (strategy === "spamSmall") return canAttack(fighter, "small", balance) ? "small" : null;
  if (strategy === "preferBig") return canAttack(fighter, "big", balance) ? "big" : canAttack(fighter, "small", balance) ? "small" : null;
  if (strategy === "saveBurst") return canAttack(fighter, "big", balance) ? "big" : null;
  if (canAttack(fighter, "big", balance) && rng.next() < 0.55) return "big";
  return canAttack(fighter, "small", balance) ? "small" : null;
}

function chooseAttackTarget(state, attacker, defender, balance, profile) {
  const stats = attackStats(attacker.stock, profile, balance);
  const head = defender.snake[0];
  const candidates = cellsWithinDistance(state, head, 0, Math.max(1, Math.ceil(stats.radius + 1)));
  candidates.sort((a, b) => damageSnake(defender.snake, b, stats.radius, stats.damage, balance) - damageSnake(defender.snake, a, stats.radius, stats.damage, balance));
  if (state.rng.next() <= attacker.policy.aimPrecision) return { ...candidates[0] };
  const missRadius = 1 + Math.floor((1 - attacker.policy.aimPrecision) * 3);
  const loose = cellsWithinDistance(state, head, missRadius, missRadius + 2);
  return { ...(loose.length ? state.rng.item(loose) : head) };
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

function pushCircleAttack(state, attack) {
  state.projectiles.push({ kind: "circle", ...attack });
}

function scheduleBigAttack(state, attacker, defender, target, now, balance, stunChance) {
  const small = attackStats(attacker.stock, "small", balance);
  const source = attacker.snake[0];
  const direction = directionFromSourceToTarget(source, target, attacker.dir);
  const characterId = attacker.character.id;
  if (characterId === "dragon") {
    const path = cellsForwardFrom(state, source, attacker.dir, true);
    path.forEach((cell, index) => pushCircleAttack(state, {
      owner: attacker.owner,
      profile: "big",
      target: cell,
      impactAt: now + small.delay + index * 140,
      radius: small.radius * 2,
      damage: small.damage * 2,
      stunChance
    }));
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
        damage: small.damage * 0.5,
        stunChance,
        stackStun: true
      });
    }
    return;
  }
  if (characterId === "quetzal") {
    const trail = attacker.snake.map(segment => ({ ...segment }));
    state.hazards.push({
      kind: "swamp",
      owner: attacker.owner,
      cells: trail,
      excludedCells: trail,
      width: bandDistanceFromTotalWidth(small.radius),
      damage: small.damage,
      stunChance,
      startedAt: now + small.delay,
      nextTickAt: now + small.delay,
      tickMs: moveInterval(attacker, balance, now),
      endAt: now + small.delay + Math.max(1400, 4200 / attackSpeedMultiplier(attacker.stock, balance))
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
      damage: small.damage * 4,
      stunChance,
      sandwormExecute: true
    });
    return;
  }
  if (characterId === "lobster") {
    pushCircleAttack(state, {
      owner: attacker.owner,
      profile: "big",
      target: source,
      impactAt: now + small.delay,
      radius: small.radius * 2,
      damage: small.damage * 2,
      stunChance,
      flat: true
    });
    return;
  }
  if (characterId === "gu_king") {
    for (let index = 0; index < 3; index += 1) {
      pushCircleAttack(state, {
        owner: attacker.owner,
        profile: "big",
        target,
        impactAt: now + small.delay + index * 360,
        radius: small.radius,
        damage: small.damage,
        stunChance
      });
    }
    return;
  }
  const big = attackStats(attacker.stock, "big", balance);
  pushCircleAttack(state, { owner: attacker.owner, profile: "big", target, impactAt: now + big.delay, radius: big.radius, damage: big.damage, stunChance });
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
    scheduleBigAttack(state, attacker, defender, target, now, balance, stunChance);
    attacker.stats.bigCasts += 1;
  }
  return true;
}

function applyDamage(target, damage) {
  if (damage <= 0) return;
  target.hp = Math.max(0, target.hp - damage);
  target.stats.damageTaken += damage;
}

function applyAttackStun(state, target, chance, now, balance, options = {}) {
  if (state.rng.next() >= chance) return false;
  const stunBase = options.stack ? Math.max(now, target.stunUntil) : now;
  target.stunUntil = Math.max(target.stunUntil, stunBase + balance.attack.attackStunMs);
  target.slowUntil = Math.max(target.slowUntil, target.stunUntil + balance.attack.attackSlowMs);
  return true;
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
    if (projectile.kind === "line") {
      playerDamage = damageSnakeCells(player.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells);
      computerDamage = damageSnakeCells(computer.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells);
    } else {
      const damageFn = projectile.flat ? damageSnakeFlat : damageSnake;
      playerDamage = damageFn(player.snake, projectile.target, projectile.radius, projectile.damage, balance);
      computerDamage = damageFn(computer.snake, projectile.target, projectile.radius, projectile.damage, balance);
      if (projectile.sandwormExecute) {
        if (projectile.owner !== "player" && keyOf(projectile.target) === keyOf(player.snake[0])) playerDamage = Math.max(playerDamage, player.hp);
        if (projectile.owner !== "computer" && keyOf(projectile.target) === keyOf(computer.snake[0])) computerDamage = Math.max(computerDamage, computer.hp);
      }
    }
    applyDamage(player, playerDamage);
    applyDamage(computer, computerDamage);
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
    const playerDamage = damageSnakeCells(state.fighters.player.snake, hazard.cells, hazard.width, hazard.damage, hazard.excludedCells);
    const computerDamage = damageSnakeCells(state.fighters.computer.snake, hazard.cells, hazard.width, hazard.damage, hazard.excludedCells);
    applyDamage(state.fighters.player, playerDamage);
    applyDamage(state.fighters.computer, computerDamage);
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
    if (otherPlan && otherPlan.nextKey === plan.nextKey) opponentHit = true;
    if (otherPlan && otherPlan.nextKey === keyOf(fighter.snake[0]) && plan.nextKey === keyOf(opponent.snake[0])) opponentHit = true;
    plan.collision = collisionSeverity(selfHit, opponentHit);
  });

  movers.forEach(owner => {
    const fighter = state.fighters[owner];
    const plan = plans[owner];
    if (plan.collision) {
      if (applyCollisionPenalty(fighter, plan.collision, now, balance)) fighter.hp = 0;
      return;
    }
    fighter.snake.unshift(plan.next);
    if (plan.eating) {
      fighter.score += 1;
      fighter.stats.foodCollected += 1;
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
    for (const [owner, fighter] of Object.entries(state.fighters)) {
      const opponent = owner === "player" ? state.fighters.computer : state.fighters.player;
      if (state.now >= fighter.stunUntil) {
        const profile = chooseAttackProfile(fighter, balance, state.rng);
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
  return {
    seed: options.seed,
    winner,
    durationMs: state.now,
    player: summarizeFighter(player, computer),
    computer: summarizeFighter(computer, player)
  };
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
    acc.stunApplied += match.player.stunApplied;
    return acc;
  }, { smallCasts: 0, bigCasts: 0, damageDealt: 0, stunApplied: 0 });
  const totalCasts = playerTotals.smallCasts + playerTotals.bigCasts;
  const winRate = wins / total;
  return {
    playerCharacterId,
    computerCharacterId,
    runs: matches.length,
    wins,
    losses,
    draws,
    winRate,
    drawRate: draws / total,
    averageDurationMs: avg(match => match.durationMs),
    averageHpDiff: avg(match => match.player.hpDiff),
    averageScoreDiff: avg(match => match.player.scoreDiff),
    playerSkill: {
      smallCasts: playerTotals.smallCasts,
      bigCasts: playerTotals.bigCasts,
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
  hexDistance,
  createBoard,
  nextWrappedCell,
  createStartingSnake,
  emptyStock,
  collectFood,
  damageSnake,
  attackStats,
  canAttack,
  buildCharacterMap,
  makePolicy,
  simulateMatch,
  runSeries
};
