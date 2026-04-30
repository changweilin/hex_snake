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
  FOOD_TYPES,
  attackStats,
  buildCharacterMap,
  canAttack,
  collectFood,
  createBoard,
  createRng,
  damageSnake,
  emptyStock,
  hexDistance,
  loadBalance,
  loadCharacters,
  nextWrappedCell,
  runSeries,
  simulateMatch
} = require("./sim-core");

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
