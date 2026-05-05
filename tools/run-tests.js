const assert = require("node:assert/strict");
const path = require("path");
const {
  createSchedule,
  createUnorderedPairs,
  difficulties,
  difficultyPresets,
  summarizeMatches,
  summarizeMatchupStats
} = require("./sim-scheduler");

const {
  DIRECTIONS,
  FOOD_TYPES,
  attackStats,
  buildCharacterMap,
  canAttack,
  chooseAttackProfile,
  chooseAttackDirection,
  chooseAttackTarget,
  chooseFoodTarget,
  collectFood,
  createBoard,
  createMatchState,
  createRng,
  damageSnake,
  dragonTrackingOrbPath,
  directionToward,
  emptyStock,
  hexDistance,
  isProjectileVisibleTo,
  wrappedDistance,
  loadBalance,
  loadCharacters,
  launchAttack,
  nextWrappedCell,
  perceivedSnakeFor,
  randomFoodTypeIdsForCharacter,
  resolveHazards,
  resolveProjectiles,
  runSeries,
  simulateMatch
} = require("./sim-core");

const {
  applyAdjustments,
  clampCandidate,
  findWeakRows,
  parseDeadline
} = require("./tune-balance");

const {
  evaluateCharacterRound,
  runSearch
} = require("./tune-ai-strategy");

const {
  BASIC_STRATEGY_ID,
  basicStrategyWeights,
  makeBasicPolicy
} = require("./basic-ai-strategy");

const {
  strategyRowForCharacter
} = require("./simulate-balance");

const {
  buildStrategyData
} = require("./apply-ai-strategy");

const root = path.resolve(__dirname, "..");
const balance = loadBalance(root);
const characters = loadCharacters(root);
const characterById = buildCharacterMap(characters);

const tests = [];
const quickMode = process.argv.includes("--quick");
const slowTestPatterns = [
  /100 match smoke test/,
  /each character big attack/,
  /scheduled /,
  /balance tuner/,
  /AI strategy tuner/,
  /AI strategy gate/,
  /high difficulty applies character-specific/,
  /simulate-balance strategy files/,
  /apply-ai-strategy/
];

function test(name, fn) {
  tests.push({ name, fn });
}

test("hex distance and wrapped movement are deterministic", () => {
  const board = createBoard(6);
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 }), 2);
  assert.deepEqual(nextWrappedCell({ q: 0, r: -board.radius }, 0, board.radius), { q: 0, r: board.radius });
});

test("food collection applies stock and energy rules", () => {
  const fighter = { stock: emptyStock(), ammo: 0, ammoCharge: 0 };
  collectFood(fighter, { types: ["protein"] }, balance, createRng("food"));
  assert.equal(fighter.stock.protein, balance.resources.singleColorStockGain);
  assert.equal(fighter.ammoCharge, balance.resources.foodEnergy);
  collectFood(fighter, { types: ["fat", "carb"] }, balance, createRng("dual"));
  assert.equal(fighter.stock.fat, balance.resources.dualColorStockGain);
  assert.equal(fighter.stock.carb, balance.resources.dualColorStockGain);
});

test("gu king food generation only creates black or single-color foods", () => {
  const guKing = characterById.get("gu_king");
  const rng = createRng("gu-king-food-regression");
  const seen = new Set();
  for (let index = 0; index < 500; index += 1) {
    const types = randomFoodTypeIdsForCharacter(guKing, balance, rng);
    assert.equal(types.length, 1);
    assert.ok(types[0] === "black" || FOOD_TYPES.includes(types[0]));
    seen.add(types[0]);
  }
  assert.ok(seen.has("black"));
});

test("attack costs and damage calculations match core rules", () => {
  const fighter = {
    stock: { protein: 2, fat: 2, fiber: 2, carb: 2 },
    ammo: balance.attack.bigAttackBombCost
  };
  assert.equal(canAttack(fighter, "small", balance), true);
  assert.equal(canAttack(fighter, "big", balance), true);
  const stats = attackStats(fighter.stock, "small", balance);
  const damage = damageSnake([{ q: 0, r: 0 }, { q: 1, r: 0 }], { q: 0, r: 0 }, stats.radius, stats.damage, balance);
  assert.ok(damage > 0);
});

test("player-owned attacks and hazards do not damage the player", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("lobster"),
    computerCharacter: characterById.get("dragon"),
    seed: "no-self-damage"
  });
  const player = state.fighters.player;
  const computer = state.fighters.computer;
  player.snake = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
  computer.snake = [{ q: 4, r: -4 }, { q: 4, r: -3 }];
  player.hp = 10;
  computer.hp = 10;

  state.projectiles.push({
    kind: "circle",
    owner: "player",
    profile: "big",
    target: { q: 0, r: 0 },
    impactAt: 0,
    radius: 3,
    damage: 99,
    stunChance: 1
  });
  resolveProjectiles(state, 0, balance);
  assert.equal(player.hp, 10);

  state.hazards.push({
    kind: "radiation",
    owner: "player",
    target: { q: 0, r: 0 },
    radius: 3,
    damage: 99,
    profile: "big",
    stunChance: 1,
    startedAt: 0,
    nextTickAt: 0,
    tickMs: 500,
    endAt: 1000
  });
  resolveHazards(state, 0, balance);
  assert.equal(player.hp, 10);
});

test("low difficulty can cast big attacks but still prefers small attacks", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "low-big-preference",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
    computerModel: { aiDifficulty: "low", skillStrategy: "spamSmall", aimPrecision: 0.45, pathPrecision: 0.48 }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  player.hp = 100;
  const choices = { small: 0, big: 0 };
  for (let index = 0; index < 200; index++) {
    const profile = chooseAttackProfile(state, computer, player, balance);
    if (profile) choices[profile] += 1;
  }
  assert.ok(choices.big > 0);
  assert.ok(choices.small > choices.big);
});

test("medium and high difficulties hold big attacks for tactical windows", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "tactical-hold",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
    computerModel: { aiDifficulty: "medium", skillStrategy: "balanced", aimPrecision: 0.7, pathPrecision: 0.7 }
  });
  state.now = 100;
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  player.hp = 100;
  assert.equal(chooseAttackProfile(state, computer, player, balance), "small");
  player.stunUntil = 1000;
  assert.equal(chooseAttackProfile(state, computer, player, balance), "big");
});

test("sandworm underground perception uses last visible snake instead of true position", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("sandworm"),
    computerCharacter: characterById.get("moray"),
    seed: "sandworm-memory",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
    computerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  const player = state.fighters.player;
  const computer = state.fighters.computer;
  state.now = 500;
  player.lastVisibleSnake = [{ q: 0, r: 0 }, { q: -1, r: 0 }];
  player.snake = [{ q: 4, r: -4 }, { q: 3, r: -3 }];
  player.undergroundFrom = 100;
  player.undergroundUntil = 1000;
  assert.deepEqual(perceivedSnakeFor(state, computer, player)[0], { q: 0, r: 0 });
  const target = chooseAttackTarget(state, computer, player, balance, "big");
  assert.ok(hexDistance(target, { q: 0, r: 0 }) < hexDistance(target, { q: 4, r: -4 }));
});

test("small attack delay is doubled in speed while big attack delay is unchanged", () => {
  const stock = Object.fromEntries(FOOD_TYPES.map(type => [type, 0]));
  assert.equal(attackStats(stock, "small", balance).delay, balance.attack.baseAttackDelayMs * 0.31);
  assert.equal(attackStats(stock, "big", balance).delay, balance.attack.baseAttackDelayMs);
});

test("sandworm big attack stays hidden until 0.2s before impact and burrows for 0.5s around impact", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("sandworm"),
    computerCharacter: characterById.get("moray"),
    seed: "sandworm-ult-visibility",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
    playerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  const player = state.fighters.player;
  const computer = state.fighters.computer;
  state.now = 1000;
  assert.equal(launchAttack(state, player, computer, "big", state.now, balance), true);
  const projectile = state.projectiles.find(item => item.owner === "player" && item.profile === "big");
  assert.ok(projectile.sandwormHidden);
  assert.equal(projectile.impactAt - player.undergroundFrom, 500);
  assert.equal(player.undergroundUntil - projectile.impactAt, 500);
  assert.equal(isProjectileVisibleTo(computer, projectile, projectile.impactAt - 201), false);
  assert.equal(isProjectileVisibleTo(computer, projectile, projectile.impactAt - 200), true);
});

test("sandworm big attack center body hit always paralyzes and center head hit kills", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("moray"),
    computerCharacter: characterById.get("sandworm"),
    seed: "sandworm-center-hit",
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6]))
  });
  const player = state.fighters.player;
  const computer = state.fighters.computer;
  player.snake = [{ q: 0, r: 0 }, { q: -1, r: 0 }, { q: -2, r: 0 }];
  player.hp = 3;
  state.now = 2000;
  state.projectiles.push({
    kind: "circle",
    owner: "computer",
    profile: "big",
    target: { q: -1, r: 0 },
    impactAt: state.now,
    radius: 0.5,
    damage: 0,
    stunChance: 0,
    sandwormParalyzeOnBody: true,
    sandwormKillOnHead: true
  });
  resolveProjectiles(state, state.now, balance);
  assert.equal(player.hp, 3);
  assert.equal(player.stunUntil, state.now + balance.collision.collisionStunMs);

  player.stunUntil = 0;
  player.slowUntil = 0;
  state.projectiles.push({
    kind: "circle",
    owner: "computer",
    profile: "big",
    target: { q: 0, r: 0 },
    impactAt: state.now,
    radius: 0.5,
    damage: 0,
    stunChance: 0,
    sandwormParalyzeOnBody: true,
    sandwormKillOnHead: true
  });
  resolveProjectiles(state, state.now, balance);
  assert.equal(player.hp, 0);
  assert.equal(state.fatalEvents.at(-1).cause, "big");
  assert.equal(computer.stats.damageDealt, 3);
});

test("high difficulty movement ignores character story roles", () => {
  const dragonState = createMatchState({
    balance,
    playerCharacter: characterById.get("moray"),
    computerCharacter: characterById.get("dragon"),
    seed: "dragon-no-rush-target",
    computerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  dragonState.fighters.computer.snake[0] = { q: 1, r: -1 };
  dragonState.fighters.player.snake[0] = { q: 0, r: 0 };
  dragonState.foods = [{ q: 1, r: 0, types: ["fat"] }];
  assert.deepEqual(chooseFoodTarget(dragonState, dragonState.fighters.computer, dragonState.fighters.player), dragonState.foods[0]);

  const sandwormState = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("sandworm"),
    seed: "sandworm-no-ambush-target",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
    computerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  sandwormState.fighters.computer.snake[0] = { q: 1, r: -1 };
  sandwormState.fighters.player.snake[0] = { q: 0, r: 0 };
  sandwormState.foods = [{ q: 1, r: 0, types: ["fat"] }];
  assert.deepEqual(chooseFoodTarget(sandwormState, sandwormState.fighters.computer, sandwormState.fighters.player), sandwormState.foods[0]);
});

test("weighted movement avoids an immediate self-trapping path", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "safe-path-weight",
    computerModel: {
      aiDifficulty: "high",
      pathPrecision: 1,
      strategyWeights: {
        movement: { safePath: 3, leastDamage: 1, fastestArrival: 3 }
      }
    }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  computer.snake = [{ q: 0, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }];
  computer.dir = 0;
  player.snake = [{ q: 5, r: -5 }, { q: 4, r: -4 }];
  assert.notEqual(directionToward(state, computer, player, { q: 0, r: -1 }), 0);
});

test("movement hard rules avoid lethal incoming attack cells", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "avoid-lethal-attack-cell",
    computerModel: {
      aiDifficulty: "high",
      pathPrecision: 1,
      strategyWeights: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 }
      }
    }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  computer.snake = [{ q: 0, r: 0 }];
  computer.hp = 1;
  computer.dir = 2;
  player.snake = [{ q: 4, r: -4 }];
  const lethalCell = nextWrappedCell(computer.snake[0], 2, state.radius);
  state.projectiles.push({
    owner: "player",
    kind: "circle",
    target: lethalCell,
    radius: 0,
    damage: 2
  });
  assert.notEqual(directionToward(state, computer, player, lethalCell), 2);
});

test("movement hard rules avoid predicted head-on collision cells", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "avoid-head-on-collision",
    computerModel: {
      aiDifficulty: "high",
      pathPrecision: 1,
      strategyWeights: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 }
      }
    }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  computer.snake = [{ q: 0, r: 0 }];
  computer.dir = 2;
  player.snake = [{ q: 2, r: 0 }];
  player.dir = 5;
  assert.notEqual(directionToward(state, computer, player, player.snake[0]), 2);
});

test("food hard rules keep nearby food when fighter has race advantage", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("quetzal"),
    seed: "keep-nearby-food",
    computerModel: { aiDifficulty: "medium", pathPrecision: 1 }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  computer.snake[0] = { q: 0, r: 0 };
  player.snake[0] = { q: 5, r: -5 };
  state.foods = [
    { q: 1, r: 0, types: ["fiber"] },
    { q: 2, r: 0, types: ["fiber"] }
  ];
  computer.policy.strategyWeights.food = { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 };
  assert.deepEqual(chooseFoodTarget(state, computer, player), state.foods[0]);
});

test("food hard rules skip food when opponent has the largest race advantage", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("quetzal"),
    seed: "skip-opponent-race-advantage-food",
    computerModel: { aiDifficulty: "medium", pathPrecision: 1 }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  computer.snake[0] = { q: 0, r: 0 };
  player.snake[0] = { q: 3, r: 0 };
  state.foods = [
    { q: 2, r: 0, types: ["fiber"] },
    { q: 0, r: 1, types: ["fiber"] }
  ];
  computer.policy.strategyWeights.food = { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 };
  assert.deepEqual(chooseFoodTarget(state, computer, player), state.foods[1]);
});

test("weighted food strategy can prefer arrival speed or character preference", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("quetzal"),
    seed: "food-weights",
    computerModel: { aiDifficulty: "medium", pathPrecision: 1 }
  });
  state.fighters.computer.snake[0] = { q: 0, r: 0 };
  state.fighters.player.snake[0] = { q: 5, r: -5 };
  state.foods = [
    { q: 1, r: 0, types: ["fat"] },
    { q: 4, r: -1, types: ["fiber"] }
  ];

  state.fighters.computer.policy.strategyWeights.food = {
    fastestArrival: 3,
    ownDeficit: 0,
    opponentDeficit: 0,
    ownPreferred: 0,
    opponentPreferred: 0
  };
  assert.deepEqual(chooseFoodTarget(state, state.fighters.computer, state.fighters.player), state.foods[0]);

  state.fighters.computer.policy.strategyWeights.food = {
    fastestArrival: 0,
    ownDeficit: 0,
    opponentDeficit: 0,
    ownPreferred: 3,
    opponentPreferred: 0
  };
  state.fighters.computer.foodTargetKey = null;
  state.fighters.computer.foodTargetAt = 0;
  assert.deepEqual(chooseFoodTarget(state, state.fighters.computer, state.fighters.player), state.foods[1]);
});

test("high AI strategy normalization fills cast target and direction weights", () => {
  const tunedBalance = JSON.parse(JSON.stringify(balance));
  tunedBalance.highAiStrategies = {
    dragon: {
      movement: { safePath: 0.25, leastDamage: 0.5, fastestArrival: 0.75 },
      food: { fastestArrival: 0.5 },
      skillAllocation: { preferSmall: 2.5, preferBig: 0.25 },
      castTiming: { lethal: 3 }
    }
  };
  const state = createMatchState({
    balance: tunedBalance,
    playerCharacter: characterById.get("moray"),
    computerCharacter: characterById.get("dragon"),
    computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1 }
  });
  const weights = state.fighters.computer.policy.strategyWeights;
  assert.equal(weights.movement.safePath, 0.25);
  assert.ok(weights.castTarget.targetHead >= 0);
  assert.ok(weights.castTarget.bodyCluster <= 3);
  assert.ok(weights.castDirection.selfHeadToOpponentHead >= 0);
  assert.ok(weights.castDirection.opponentHeadToNearestFood <= 3);
});

test("attack target weights can prefer head cluster or target nearest food", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("moray"),
    computerCharacter: characterById.get("moray"),
    seed: "cast-target-weights",
    computerModel: { aiDifficulty: "high", aimPrecision: 1 }
  });
  const attacker = state.fighters.computer;
  const defender = state.fighters.player;
  attacker.stock = { protein: 20, fat: 0, fiber: 0, carb: 0 };
  defender.snake = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }];
  defender.hp = 99;
  state.foods = [{ q: 4, r: -4, types: ["protein"] }];

  attacker.policy.strategyWeights.castTarget = { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 };
  assert.deepEqual(chooseAttackTarget(state, attacker, defender, balance, "small"), defender.snake[0]);

  attacker.policy.strategyWeights.castTarget = { targetHead: 0, bodyCluster: 3, targetNearestFood: 0 };
  const clusterTarget = chooseAttackTarget(state, attacker, defender, balance, "small");
  assert.ok(damageSnake(defender.snake, clusterTarget, attackStats(attacker.stock, "small", balance).radius, 1, balance) >= 2);

  attacker.policy.strategyWeights.castTarget = { targetHead: 0, bodyCluster: 0, targetNearestFood: 4 };
  assert.deepEqual(chooseAttackTarget(state, attacker, defender, balance, "small"), state.foods[0]);
});

test("directional cast weights can prefer each direction strategy", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("moray"),
    computerCharacter: characterById.get("moray"),
    seed: "cast-direction-weights",
    computerModel: { aiDifficulty: "high", aimPrecision: 1 }
  });
  const attacker = state.fighters.computer;
  const defender = state.fighters.player;
  attacker.snake[0] = { q: 0, r: 0 };
  attacker.dir = 0;
  defender.snake = [{ q: 2, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 0 }];
  state.foods = [{ q: 2, r: -2, types: ["carb"] }];
  const target = defender.snake[0];

  attacker.policy.strategyWeights.castDirection = { selfHeadToOpponentHead: 3, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 0 };
  assert.equal(chooseAttackDirection(state, attacker, defender, target, attacker.dir), 2);

  attacker.policy.strategyWeights.castDirection = { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 3, opponentHeadToNearestFood: 0 };
  assert.equal(chooseAttackDirection(state, attacker, defender, target, attacker.dir), 5);

  attacker.policy.strategyWeights.castDirection = { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 3 };
  assert.equal(chooseAttackDirection(state, attacker, defender, target, attacker.dir), 0);
});

test("wrapped distance and stale food target switching affect food choices", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("quetzal"),
    computerCharacter: characterById.get("quetzal"),
    seed: "wrapped-food-target",
    computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1 }
  });
  const fighter = state.fighters.computer;
  const opponent = state.fighters.player;
  fighter.snake[0] = { q: 0, r: -state.radius };
  opponent.snake[0] = { q: 5, r: -5 };
  state.foods = [
    { q: 0, r: state.radius, types: ["fiber"] },
    { q: 2, r: -2, types: ["fiber"] }
  ];
  fighter.policy.strategyWeights.food = { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 };
  assert.equal(wrappedDistance(state, fighter.snake[0], state.foods[0]), 1);
  assert.deepEqual(chooseFoodTarget(state, fighter, opponent), state.foods[0]);
  fighter.foodTargetKey = `${state.foods[0].q},${state.foods[0].r}`;
  fighter.foodTargetAt = 0;
  state.now = 21000;
  assert.deepEqual(chooseFoodTarget(state, fighter, opponent), state.foods[1]);
});

test("stale food target timer resets when switching to a new target", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("quetzal"),
    computerCharacter: characterById.get("quetzal"),
    seed: "food-target-stale-reset",
    computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1 }
  });
  const fighter = state.fighters.computer;
  const opponent = state.fighters.player;
  fighter.snake[0] = { q: 0, r: 0 };
  opponent.snake[0] = { q: 5, r: -5 };
  state.foods = [
    { q: 1, r: 0, types: ["fiber"] },
    { q: 3, r: 0, types: ["fiber"] }
  ];
  fighter.policy.strategyWeights.food = { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 };
  fighter.foodTargetKey = `${state.foods[0].q},${state.foods[0].r}`;
  fighter.foodTargetAt = 0;
  state.now = 21000;
  assert.deepEqual(chooseFoodTarget(state, fighter, opponent), state.foods[1]);
  assert.equal(fighter.foodTargetKey, `${state.foods[1].q},${state.foods[1].r}`);
  assert.equal(fighter.foodTargetAt, 21000);

  state.now = 21100;
  assert.deepEqual(chooseFoodTarget(state, fighter, opponent), state.foods[1]);
});

test("lethal attack opportunity overrides small or big skill preferences", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "lethal-hard-rule",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 8])),
    computerModel: {
      aiDifficulty: "high",
      skillStrategy: "spamSmall",
      aimPrecision: 1,
      strategyWeights: {
        skillAllocation: { preferSmall: 3, preferBig: 0 },
        castTiming: { lethal: 3 }
      }
    }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  player.hp = 1;
  assert.equal(chooseAttackProfile(state, computer, player, balance), "small");
});

test("near-full resource timing requires both bombs and energy to be near full", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "near-full-resource-timing",
    computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1 }
  });
  const computer = state.fighters.computer;
  const player = state.fighters.player;
  computer.stock = { protein: 1, fat: 1, fiber: 1, carb: 1 };
  computer.policy.strategyWeights.skillAllocation = { preferSmall: 0, preferBig: 0 };
  computer.policy.strategyWeights.castTiming = {
    lethal: 0,
    nearFullEnergy: 1,
    opponentDebuffed: 0,
    opponentAlmostReady: 0,
    nearOpponent: 0,
    farOpponent: 0
  };
  player.hp = 99;

  computer.ammo = balance.resources.maxAmmo;
  computer.ammoCharge = 0;
  assert.equal(chooseAttackProfile(state, computer, player, balance), null);

  computer.ammo = 0;
  computer.ammoCharge = balance.resources.attackNeedTotal - 1;
  assert.equal(chooseAttackProfile(state, computer, player, balance), null);

  computer.ammo = balance.resources.maxAmmo;
  computer.ammoCharge = balance.resources.attackNeedTotal - 1;
  assert.equal(chooseAttackProfile(state, computer, player, balance), "small");
});

test("high difficulty randomly breaks tied small and big attack scores", () => {
  const makeTiedState = picker => {
    const state = createMatchState({
      balance,
      playerCharacter: characterById.get("dragon"),
      computerCharacter: characterById.get("gu_king"),
      seed: "tied-attack-score",
      initialBombs: balance.attack.bigAttackBombCost,
      initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
      computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1 }
    });
    const computer = state.fighters.computer;
    const player = state.fighters.player;
    computer.snake = [{ q: 0, r: 0 }];
    player.snake = [{ q: 5, r: -5 }];
    player.hp = 100;
    state.foods = [];
    state.rng.item = picker;
    computer.policy.strategyWeights.skillAllocation = { preferSmall: 1, preferBig: 1 };
    computer.policy.strategyWeights.castTiming = {
      lethal: 0,
      nearFullEnergy: 0,
      opponentDebuffed: 0,
      opponentAlmostReady: 0,
      nearOpponent: 0,
      farOpponent: 0
    };
    return { state, computer, player };
  };

  const smallTie = makeTiedState(items => items[0]);
  assert.equal(chooseAttackProfile(smallTie.state, smallTie.computer, smallTie.player, balance), "small");

  const bigTie = makeTiedState(items => items[items.length - 1]);
  assert.equal(chooseAttackProfile(bigTie.state, bigTie.computer, bigTie.player, balance), "big");
});

test("auto battle attack decisions are owner-mirrored under equal conditions", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("moray"),
    computerCharacter: characterById.get("moray"),
    seed: "mirror-ai",
    initialBombs: balance.attack.bigAttackBombCost,
    initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
    playerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 },
    computerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  state.now = 100;
  state.fighters.player.stunUntil = 1000;
  state.fighters.computer.stunUntil = 1000;
  const playerChoice = chooseAttackProfile(state, state.fighters.player, state.fighters.computer, balance);
  const computerChoice = chooseAttackProfile(state, state.fighters.computer, state.fighters.player, balance);
  assert.equal(playerChoice, computerChoice);
  assert.ok(["small", "big"].includes(playerChoice));
});

test("dragon tracking orb has limited curvature and board-width range", () => {
  const state = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "dragon-tracking-path"
  });
  const source = { q: -3, r: 1 };
  const targetSnake = [{ q: 3, r: -2 }, { q: 2, r: -1 }];
  const path = dragonTrackingOrbPath(state, source, 0, targetSnake);
  assert.ok(path.length <= Math.ceil((state.radius * 2 + 1) / 2));
  assert.deepEqual(path[0], nextWrappedCell(source, 0, state.radius));
  let cursor = source;
  let direction = 0;
  path.forEach(cell => {
    const stepDirection = DIRECTIONS.findIndex(delta => (
      cell.q === cursor.q + delta.q && cell.r === cursor.r + delta.r
    ));
    const wrappedDirection = stepDirection >= 0
      ? stepDirection
      : DIRECTIONS.findIndex((_, index) => {
        const wrapped = nextWrappedCell(cursor, index, state.radius);
        return wrapped.q === cell.q && wrapped.r === cell.r;
      });
    assert.ok(wrappedDirection >= 0);
    const turn = Math.min(
      (wrappedDirection - direction + DIRECTIONS.length) % DIRECTIONS.length,
      (direction - wrappedDirection + DIRECTIONS.length) % DIRECTIONS.length
    );
    assert.ok(turn <= 2);
    direction = wrappedDirection;
    cursor = cell;
  });
});

test("protein fractional radius deals proportional outer-ring damage", () => {
  const stock = { protein: 5, fat: 0, fiber: 0, carb: 0 };
  const stats = attackStats(stock, "big", balance);
  assert.equal(stats.radius, 2.5);
  const damage = damageSnake([{ q: 3, r: 0 }], { q: 0, r: 0 }, stats.radius, stats.damage, balance);
  assert.equal(damage, stats.damage * 0.5);
});

test("protein range growth can be configured without changing default behavior", () => {
  const tuned = JSON.parse(JSON.stringify(balance));
  tuned.attack.proteinRangeBonusPerPoint = 0.025;
  const stats = attackStats({ protein: 10, fat: 0, fiber: 0, carb: 0 }, "big", tuned);
  assert.equal(stats.radius, 2.5);
});

test("same seed produces same series result", () => {
  const options = {
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    runs: 20,
    seed: "repeatable"
  };
  assert.deepEqual(runSeries(options), runSeries(options));
});

test("empty tick skipping preserves fixed tick match results", () => {
  const options = {
    balance,
    playerCharacter: characterById.get("sandworm"),
    computerCharacter: characterById.get("lobster"),
    seed: "skip-empty-ticks-equivalence",
    playerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1, skillStrategy: "preferBig", foodStrategy: "balanced" },
    computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1, skillStrategy: "preferBig", foodStrategy: "balanced" }
  };
  assert.deepEqual(simulateMatch({ ...options, skipEmptyTicks: false }), simulateMatch(options));
});

test("100 match smoke test completes with valid metrics", () => {
  const result = runSeries({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    runs: balance.simulation.smokeRuns,
    seed: "smoke"
  });
  assert.equal(result.runs, balance.simulation.smokeRuns);
  assert.ok(Number.isFinite(result.winRate));
  assert.ok(Number.isFinite(result.averageHpDiff));
  assert.ok(result.wins + result.losses + result.draws === result.runs);
});

test("each character big attack can be simulated in a deterministic setup", () => {
  characters.forEach(character => {
    const match = simulateMatch({
      balance,
      playerCharacter: character,
      computerCharacter: characterById.get("dragon"),
      seed: `big-${character.id}`,
      initialLength: 20,
      initialEnergy: balance.resources.attackNeedTotal,
      initialBombs: balance.resources.maxAmmo,
      initialStock: Object.fromEntries(FOOD_TYPES.map(type => [type, 6])),
      playerModel: { skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1, foodStrategy: "balanced" },
      computerModel: { skillStrategy: "saveBurst", aimPrecision: 0, pathPrecision: 0, foodStrategy: "balanced" },
      maxMatchMs: 5000
    });
    assert.ok(match.player.bigCasts >= 1, `${character.id} should cast a big attack`);
  });
});

test("scheduled simulator builds 15 unordered pairs and 45 matches per cycle", () => {
  const pairs = createUnorderedPairs(characters);
  const schedule = createSchedule(characters, 1);
  assert.equal(pairs.length, 15);
  assert.equal(schedule.length, 45);
  assert.deepEqual(difficulties, ["low", "medium", "high"]);
  assert.equal(Object.hasOwn(difficultyPresets, "novice"), false);
  assert.ok(schedule.every(entry => entry.pair[0] !== entry.pair[1]));
});

test("scheduled match records include duration and loss causes", () => {
  const match = simulateMatch({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    playerModel: difficultyPresets.high,
    computerModel: difficultyPresets.high,
    seed: "scheduled-fields"
  });
  assert.ok(Number.isFinite(match.durationMs));
  assert.ok(["small", "big", "collisionParalysis", "stunLocked", "scoreDecision", "draw"].includes(match.fatalCause));
  assert.ok(["small", "big", "none"].includes(match.topDamageCause));
});

test("scheduled summary aggregates wins, losses, draws, causes, and durations", () => {
  const matches = [
    { difficulty: "low", pair: ["dragon", "moray"], winnerCharacterId: "dragon", loserCharacterId: "moray", fatalCause: "small", topDamageCause: "small", durationMs: 1000 },
    { difficulty: "low", pair: ["dragon", "moray"], winnerCharacterId: "moray", loserCharacterId: "dragon", fatalCause: "big", topDamageCause: "big", durationMs: 3000 },
    { difficulty: "low", pair: ["dragon", "moray"], winnerCharacterId: null, loserCharacterId: null, fatalCause: "draw", topDamageCause: "none", durationMs: 2000 }
  ];
  const summary = summarizeMatches(matches, characters);
  const dragon = summary.characterDifficulty.find(row => row.difficulty === "low" && row.characterId === "dragon");
  const matchup = summary.matchupDifficulty.find(row => row.difficulty === "low" && row.characterA === "dragon" && row.characterB === "moray");
  assert.equal(dragon.runs, 3);
  assert.equal(dragon.wins, 1);
  assert.equal(dragon.losses, 1);
  assert.equal(dragon.draws, 1);
  assert.equal(matchup.runs, 3);
  assert.equal(matchup.characterAWins + matchup.characterBWins + matchup.draws, matchup.runs);
  assert.equal(matchup.fatalSmallLosses, 1);
  assert.equal(matchup.fatalBigLosses, 1);
  assert.equal(matchup.topDamageSmallLosses + matchup.topDamageBigLosses, 2);
  assert.equal(matchup.averageDurationMs, 2000);
  assert.equal(matchup.medianDurationMs, 2000);
  assert.equal(matchup.minDurationMs, 1000);
  assert.equal(matchup.maxDurationMs, 3000);
});

test("scheduled summaries are deterministic for the same raw matches", () => {
  const matches = createSchedule(characters, 1).slice(0, 6).map((entry, index) => ({
    cycle: entry.cycle,
    difficulty: entry.difficulty,
    pair: entry.pair,
    winnerCharacterId: index % 3 === 0 ? entry.pair[0] : index % 3 === 1 ? entry.pair[1] : null,
    loserCharacterId: index % 3 === 0 ? entry.pair[1] : index % 3 === 1 ? entry.pair[0] : null,
    fatalCause: index % 2 === 0 ? "collisionParalysis" : "stunLocked",
    topDamageCause: index % 2 === 0 ? "small" : "big",
    durationMs: 1000 + index
  }));
  assert.deepEqual(summarizeMatches(matches, characters), summarizeMatches(matches, characters));
});

test("scheduled matchup stats include 45 rows with averages, standard deviations, and medians", () => {
  const fighter = (characterId, value) => ({
    characterId,
    hp: value,
    length: value,
    score: value,
    smallCasts: value,
    bigCasts: value,
    smallCastRate: value / 10,
    damageDealt: value,
    damageTaken: value,
    damageTakenByCause: { small: value, big: value },
    stunApplied: value,
    foodCollected: value,
    averageStock: value,
    hpDiff: value,
    scoreDiff: value
  });
  const matches = [
    {
      difficulty: "low",
      pair: ["dragon", "moray"],
      winnerCharacterId: "dragon",
      durationMs: 1000,
      player: fighter("dragon", 2),
      computer: fighter("moray", 4)
    },
    {
      difficulty: "low",
      pair: ["dragon", "moray"],
      winnerCharacterId: "moray",
      durationMs: 3000,
      player: fighter("moray", 8),
      computer: fighter("dragon", 6)
    }
  ];
  const rows = summarizeMatchupStats(matches, characters);
  const row = rows.find(entry => entry.difficulty === "low" && entry.characterA === "dragon" && entry.characterB === "moray");
  assert.equal(rows.length, 45);
  assert.equal(row.runs, 2);
  assert.equal(row.characterAWinRate, 0.5);
  assert.equal(row.durationMsAverage, 2000);
  assert.equal(row.durationMsStandardDeviation, 1000);
  assert.equal(row.durationMsMedian, 2000);
  assert.equal(row.characterAHpAverage, 4);
  assert.equal(row.characterAHpStandardDeviation, 2);
  assert.equal(row.characterAHpMedian, 4);
});

test("balance tuner detects weak rows and clamps values to original bounds", () => {
  const weakRows = findWeakRows([
    { difficulty: "low", characterId: "dragon", runs: 10, winRate: 0.39 },
    { difficulty: "high", characterId: "moray", runs: 10, winRate: 0.4 }
  ]);
  assert.equal(weakRows.length, 2);
  assert.equal(clampCandidate(50, 4), 40);
  assert.equal(clampCandidate(0.1, 4), 0.4);
});

test("balance tuner adjustment keeps candidate values within ultimate bounds", () => {
  const candidate = JSON.parse(JSON.stringify(balance));
  const summary = {
    characterDifficulty: difficulties.flatMap(difficulty => characters.map(character => ({
      difficulty,
      characterId: character.id,
      runs: 10,
      winRate: character.id === "lobster" && difficulty === "high" ? 0.25 : 0.55
    })))
  };
  const bounds = new Map([
    ["attack.ultimates.dragon.orbStepMs", { path: ["attack", "ultimates", "dragon", "orbStepMs"], direction: "lower-is-stronger", original: balance.attack.ultimates.dragon.orbStepMs }],
    ["attack.ultimates.lobster.radiusMultiplier", { path: ["attack", "ultimates", "lobster", "radiusMultiplier"], direction: "higher-is-stronger", original: balance.attack.ultimates.lobster.radiusMultiplier }],
    ["attack.ultimates.sandworm.damageMultiplier", { path: ["attack", "ultimates", "sandworm", "damageMultiplier"], direction: "higher-is-stronger", original: balance.attack.ultimates.sandworm.damageMultiplier }],
    ["attack.ultimates.quetzal.damageMultiplier", { path: ["attack", "ultimates", "quetzal", "damageMultiplier"], direction: "higher-is-stronger", original: balance.attack.ultimates.quetzal.damageMultiplier }],
    ["attack.ultimates.moray.damageMultiplier", { path: ["attack", "ultimates", "moray", "damageMultiplier"], direction: "higher-is-stronger", original: balance.attack.ultimates.moray.damageMultiplier }],
    ["attack.ultimates.gu_king.damageMultiplier", { path: ["attack", "ultimates", "gu_king", "damageMultiplier"], direction: "higher-is-stronger", original: balance.attack.ultimates.gu_king.damageMultiplier }]
  ]);
  const result = applyAdjustments(candidate, balance, bounds, summary);
  const lobsterChange = result.changes.find(change => change.path === "attack.ultimates.lobster.radiusMultiplier");
  assert.ok(lobsterChange);
  assert.ok(result.nextBalance.attack.ultimates.lobster.radiusMultiplier <= balance.attack.ultimates.lobster.radiusMultiplier * 10);
});

test("balance tuner parses local time deadlines", () => {
  const deadline = parseDeadline("08:00", new Date("2026-05-01T01:00:00+08:00"));
  assert.equal(deadline.getHours(), 8);
  assert.equal(deadline.getMinutes(), 0);
});

test("AI strategy tuner produces character and universal best strategies", () => {
  const result = runSearch({
    balance,
    characters,
    seed: "ai-strategy-test",
    durationHours: 0.000001,
    mirrorRuns: 2,
    populationSize: 6,
    eliteCount: 1,
    topCount: 2,
    minRounds: 1,
    maxRounds: 1,
    outputDir: path.join(root, "reports", "ai-strategy-test")
  });
  assert.equal(result.bestStrategies.length, characters.length + 1);
  assert.equal(result.manifest.topCount, 2);
  assert.equal(result.manifest.stopReason, "max-rounds");
  characters.forEach(character => {
    const row = result.bestStrategies.find(entry => entry.characterId === character.id);
    assert.ok(row);
    assert.ok(Number.isFinite(row.decisiveWinRate));
    assert.ok(row.strategyWeights.movement.safePath >= 0);
    assert.ok(row.strategyWeights.movement.safePath <= 3);
    assert.ok(result.topStrategies[character.id].length <= 2);
  });
  const universal = result.bestStrategies.find(entry => entry.characterId === "universal");
  assert.ok(universal);
  assert.ok(universal.strategyWeights.movement.safePath >= 0);
  assert.ok(universal.strategyWeights.movement.safePath <= 3);
});

test("AI strategy tuner defaults to two-hour full-character rounds", () => {
  const result = runSearch({
    balance,
    characters,
    seed: "ai-strategy-full-round-test",
    mirrorRuns: 2,
    populationSize: 6,
    eliteCount: 1,
    topCount: 5,
    minRounds: 1,
    maxRounds: 1,
    outputDir: path.join(root, "reports", "ai-strategy-full-round-test")
  });
  assert.equal(result.manifest.durationHours, 2);
  assert.equal(result.manifest.stopOnConvergence, false);
  assert.equal(result.manifest.stopReason, "max-rounds");
  characters.forEach(character => {
    assert.ok(result.topStrategies[character.id].length <= 5);
    assert.ok(result.topStrategies[character.id].length >= 1);
  });
  const roundsByCharacter = new Map(characters.map(character => [character.id, 0]));
  result.history.forEach(entry => roundsByCharacter.set(entry.characterId, roundsByCharacter.get(entry.characterId) + 1));
  assert.deepEqual([...roundsByCharacter.values()], characters.map(() => 1));
});

test("basic strategy weights are fixed and not role-adjusted", () => {
  const weights = basicStrategyWeights();
  assert.deepEqual(weights.movement, { safePath: 0, leastDamage: 0, fastestArrival: 3 });
  assert.deepEqual(weights.food, {
    fastestArrival: 3,
    ownDeficit: 0,
    opponentDeficit: 0,
    ownPreferred: 0,
    opponentPreferred: 0
  });
  assert.deepEqual(weights.skillAllocation, { preferSmall: 1, preferBig: 1 });
  assert.equal(weights.castTiming.nearFullEnergy, 3);
  assert.equal(weights.castTiming.opponentDebuffed, 3);
  assert.deepEqual(weights.castTarget, { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 });
  assert.deepEqual(weights.castDirection, {
    selfHeadToOpponentHead: 0,
    opponentBodyLongestAxis: 0,
    opponentHeadToNearestFood: 3
  });
  assert.deepEqual(makeBasicPolicy("gu_king").strategyWeights, weights);
  assert.deepEqual(makeBasicPolicy("dragon").strategyWeights, weights);
  assert.deepEqual(makeBasicPolicy("moray").strategyWeights.castDirection, {
    selfHeadToOpponentHead: 0,
    opponentBodyLongestAxis: 3,
    opponentHeadToNearestFood: 0
  });
  assert.deepEqual(makeBasicPolicy("lobster").strategyWeights.castDirection, {
    selfHeadToOpponentHead: 3,
    opponentBodyLongestAxis: 0,
    opponentHeadToNearestFood: 0
  });
});

test("AI strategy gate falls back to the basic baseline when no candidate wins decisively", () => {
  const character = characterById.get("dragon");
  const ranked = evaluateCharacterRound({
    balance,
    character,
    population: [
      {
        id: "same-as-basic-candidate",
        strategyWeights: basicStrategyWeights()
      }
    ],
    mirrorRuns: 2,
    seed: "gate-fallback-test",
    round: 1
  });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, BASIC_STRATEGY_ID);
  assert.equal(ranked[0].gatePassed, true);
  assert.ok(ranked[0].gateOutcomeWinRate >= 0);
  assert.ok(ranked[0].gateOutcomeWinRate <= 1);
  assert.deepEqual(ranked[0].strategyWeights, basicStrategyWeights());
});

test("high difficulty applies character-specific default strategy weights", () => {
  const tunedBalance = JSON.parse(JSON.stringify(balance));
  tunedBalance.highAiStrategies = {
    dragon: {
      movement: { safePath: 0.25, leastDamage: 0.5, fastestArrival: 0.75 },
      food: { fastestArrival: 0.5 },
      skillAllocation: { preferSmall: 2.5, preferBig: 0.25 },
      castTiming: { lethal: 3 }
    }
  };
  const state = createMatchState({
    balance: tunedBalance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("dragon"),
    computerModel: { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1 }
  });
  assert.equal(state.fighters.player.policy.strategyWeights.movement.safePath, 1.2);
  assert.equal(state.fighters.computer.policy.strategyWeights.movement.safePath, 0.25);
});

test("simulate-balance strategy files select rows by character", () => {
  const strategyFile = {
    strategies: {
      dragon: { strategyId: "dragon-best", strategyWeights: { movement: { safePath: 0.2 } } },
      moray: { strategyId: "moray-best", strategyWeights: { movement: { safePath: 2.4 } } }
    }
  };
  assert.equal(strategyRowForCharacter(strategyFile, "moray").strategyId, "moray-best");
  assert.equal(strategyRowForCharacter(strategyFile, "dragon").strategyId, "dragon-best");
});

test("apply-ai-strategy builds complete character strategy data", () => {
  const rows = characters.map((character, index) => ({
    characterId: character.id,
    strategyId: `${character.id}-best`,
    winRate: index / characters.length,
    strategyWeights: {
      movement: { safePath: 1, leastDamage: 1, fastestArrival: 1 },
      food: { fastestArrival: 1, ownDeficit: 1, opponentDeficit: 1, ownPreferred: 1, opponentPreferred: 1 },
      skillAllocation: { preferSmall: 1, preferBig: 1 },
      castTiming: { lethal: 3, nearFullEnergy: 1, opponentDebuffed: 1, opponentAlmostReady: 1, nearOpponent: 1, farOpponent: 1 }
    }
  }));
  const strategyData = buildStrategyData(rows, characters, "unit-test");
  assert.equal(Object.keys(strategyData.strategies).length, characters.length);
  assert.equal(strategyData.strategies.dragon.strategyId, "dragon-best");
});

let failed = 0;
const selectedTests = quickMode
  ? tests.filter(({ name }) => !slowTestPatterns.some(pattern => pattern.test(name)))
  : tests;

selectedTests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error.stack || error.message);
  }
});

if (failed) {
  process.exit(1);
} else {
  console.log(`${selectedTests.length}${quickMode ? `/${tests.length}` : ""} tests passed.`);
  process.exit(0);
}
