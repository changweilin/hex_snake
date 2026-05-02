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
  loadBalance,
  loadCharacters,
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
  runSearch
} = require("./tune-ai-strategy");

const root = path.resolve(__dirname, "..");
const balance = loadBalance(root);
const characters = loadCharacters(root);
const characterById = buildCharacterMap(characters);

const tests = [];

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

test("high difficulty character archetypes alter movement targets", () => {
  const dragonState = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("moray"),
    seed: "dragon-rush-target",
    computerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  dragonState.foods = [];
  dragonState.fighters.computer.snake[0] = { q: 1, r: -1 };
  dragonState.fighters.player.snake[0] = { q: 0, r: 0 };
  assert.deepEqual(chooseFoodTarget(dragonState, dragonState.fighters.computer, dragonState.fighters.player), { q: 0, r: 0 });

  const quetzalState = createMatchState({
    balance,
    playerCharacter: characterById.get("dragon"),
    computerCharacter: characterById.get("quetzal"),
    seed: "quetzal-fiber-target",
    computerModel: { aiDifficulty: "high", skillStrategy: "preferBig", aimPrecision: 1, pathPrecision: 1 }
  });
  quetzalState.foods = [
    { q: 1, r: 0, types: ["fat"] },
    { q: 3, r: -1, types: ["fiber"] }
  ];
  assert.deepEqual(chooseFoodTarget(quetzalState, quetzalState.fighters.computer, quetzalState.fighters.player), quetzalState.foods[1]);
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
  assert.deepEqual(chooseFoodTarget(state, state.fighters.computer, state.fighters.player), state.foods[1]);
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
  assert.equal(chooseAttackProfile(state, state.fighters.player, state.fighters.computer, balance), "big");
  assert.equal(chooseAttackProfile(state, state.fighters.computer, state.fighters.player, balance), "big");
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
  assert.ok(path.length <= state.radius * 2 + 1);
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
  assert.equal(weakRows.length, 1);
  assert.equal(clampCandidate(10, 4), 6);
  assert.equal(clampCandidate(1, 4), 2);
});

test("balance tuner adjustment keeps candidate values within plus/minus 50 percent", () => {
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
    ["attack.baseBlastHexRadius", { path: ["attack", "baseBlastHexRadius"], direction: "higher-is-stronger", original: balance.attack.baseBlastHexRadius }],
    ["attack.damageBonusPerPoint", { path: ["attack", "damageBonusPerPoint"], direction: "higher-is-stronger", original: balance.attack.damageBonusPerPoint }],
    ["attack.proteinRangeBonusPerPoint", { path: ["attack", "proteinRangeBonusPerPoint"], direction: "higher-is-stronger", original: balance.attack.proteinRangeBonusPerPoint }],
    ["movement.moveBonusPerPoint", { path: ["movement", "moveBonusPerPoint"], direction: "higher-is-stronger", original: balance.movement.moveBonusPerPoint }],
    ["attack.attackSpeedBonusPerPoint", { path: ["attack", "attackSpeedBonusPerPoint"], direction: "higher-is-stronger", original: balance.attack.attackSpeedBonusPerPoint }],
    ["attack.baseAttackDelayMs", { path: ["attack", "baseAttackDelayMs"], direction: "lower-is-stronger", original: balance.attack.baseAttackDelayMs }],
    ["attack.baseAttackCooldownMs", { path: ["attack", "baseAttackCooldownMs"], direction: "lower-is-stronger", original: balance.attack.baseAttackCooldownMs }]
  ]);
  const result = applyAdjustments(candidate, balance, bounds, summary);
  const proteinChange = result.changes.find(change => change.path === "attack.proteinRangeBonusPerPoint");
  assert.ok(proteinChange);
  assert.ok(result.nextBalance.attack.proteinRangeBonusPerPoint <= balance.attack.proteinRangeBonusPerPoint * 1.5);
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
    populationSize: 3,
    eliteCount: 1,
    outputDir: path.join(root, "reports", "ai-strategy-test")
  });
  assert.equal(result.bestStrategies.length, characters.length + 1);
  characters.forEach(character => {
    const row = result.bestStrategies.find(entry => entry.characterId === character.id);
    assert.ok(row);
    assert.ok(row.strategyWeights.movement.safePath >= 0);
    assert.ok(row.strategyWeights.movement.safePath <= 3);
  });
  const universal = result.bestStrategies.find(entry => entry.characterId === "universal");
  assert.ok(universal);
  assert.ok(universal.strategyWeights.movement.safePath >= 0);
  assert.ok(universal.strategyWeights.movement.safePath <= 3);
});

let failed = 0;
tests.forEach(({ name, fn }) => {
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
  process.exitCode = 1;
} else {
  console.log(`${tests.length} tests passed.`);
}
