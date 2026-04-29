const assert = require("node:assert/strict");
const path = require("path");
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
