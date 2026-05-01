#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  FOOD_TYPES,
  buildCharacterMap,
  createRng,
  loadBalance,
  loadCharacters,
  simulateMatch
} = require("./sim-core");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 3;
const DEFAULT_POPULATION_SIZE = 8;
const DEFAULT_ELITE_COUNT = 3;

const weightShape = {
  movement: ["safePath", "leastDamage", "fastestArrival"],
  food: ["fastestArrival", "ownDeficit", "opponentDeficit", "ownPreferred", "opponentPreferred"],
  skillAllocation: ["preferSmall", "preferBig"],
  castTiming: ["lethal", "nearFullEnergy", "opponentDebuffed", "opponentAlmostReady", "nearOpponent", "farOpponent"]
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function numberArg(args, key, fallback) {
  if (args[key] === undefined) return fallback;
  const value = Number(args[key]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${key} must be a positive number.`);
  return value;
}

function stringArg(args, key, fallback) {
  return args[key] === undefined ? fallback : String(args[key]);
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${rows.map(row => row.map(csvEscape).join(",")).join("\n")}\n`, "utf8");
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function clampWeight(value) {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultStrategyWeights() {
  return {
    movement: { safePath: 1.4, leastDamage: 1.1, fastestArrival: 1 },
    food: { fastestArrival: 1, ownDeficit: 0.9, opponentDeficit: 0.5, ownPreferred: 1.1, opponentPreferred: 0.4 },
    skillAllocation: { preferSmall: 1, preferBig: 1 },
    castTiming: { lethal: 3, nearFullEnergy: 0.8, opponentDebuffed: 1.1, opponentAlmostReady: 0.8, nearOpponent: 0.9, farOpponent: 0.4 }
  };
}

function makePolicyFromWeights(strategy, characterId) {
  const preferBig = strategy.strategyWeights.skillAllocation.preferBig;
  const preferSmall = strategy.strategyWeights.skillAllocation.preferSmall;
  return {
    aiDifficulty: "high",
    pathPrecision: 1,
    aimPrecision: 1,
    skillStrategy: preferBig > preferSmall * 1.2 ? "preferBig" : preferSmall > preferBig * 1.2 ? "spamSmall" : "balanced",
    foodStrategy: "balanced",
    strategyId: strategy.id,
    characterStrategyId: `${characterId}:${strategy.id}`,
    strategyWeights: clone(strategy.strategyWeights)
  };
}

function randomBetween(rng, min, max) {
  return min + rng.next() * (max - min);
}

function makeStrategy(id, weights) {
  return { id, strategyWeights: weights };
}

function randomStrategy(id, rng, base = defaultStrategyWeights(), spread = 0.75) {
  const weights = clone(base);
  Object.entries(weightShape).forEach(([group, keys]) => {
    keys.forEach(key => {
      weights[group][key] = round(clampWeight(weights[group][key] + randomBetween(rng, -spread, spread)), 4);
    });
  });
  weights.castTiming.lethal = 3;
  return makeStrategy(id, weights);
}

function crossoverStrategy(id, left, right, rng, mutation = 0.35) {
  const weights = defaultStrategyWeights();
  Object.entries(weightShape).forEach(([group, keys]) => {
    keys.forEach(key => {
      const source = rng.next() < 0.5 ? left : right;
      const mutated = source.strategyWeights[group][key] + randomBetween(rng, -mutation, mutation);
      weights[group][key] = round(clampWeight(mutated), 4);
    });
  });
  weights.castTiming.lethal = 3;
  return makeStrategy(id, weights);
}

function seedPopulation(character, rng, size = DEFAULT_POPULATION_SIZE) {
  const base = defaultStrategyWeights();
  if (character.foodPreference && character.foodPreference !== "balanced") {
    base.food.ownPreferred = 1.4;
    base.food.ownDeficit = 1.1;
  }
  if (character.specialFood === "black") {
    base.food.ownPreferred = 1.8;
    base.castTiming.nearFullEnergy = 1.2;
    base.skillAllocation.preferBig = 1.3;
  }
  const population = [makeStrategy("baseline", clone(base))];
  while (population.length < size) {
    population.push(randomStrategy(`seed-${population.length}`, rng, base));
  }
  return population;
}

function candidatePairs(population) {
  const pairs = [];
  for (let left = 0; left < population.length; left += 1) {
    for (let right = left + 1; right < population.length; right += 1) {
      pairs.push([population[left], population[right]]);
    }
  }
  return pairs;
}

function emptyScore(strategy) {
  return {
    id: strategy.id,
    strategyWeights: strategy.strategyWeights,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    score: 0,
    winRate: 0,
    averageDurationMs: 0,
    totalDurationMs: 0
  };
}

function recordResult(scores, strategy, result, durationMs) {
  const row = scores.get(strategy.id);
  row.games += 1;
  row.totalDurationMs += durationMs;
  if (result === "win") {
    row.wins += 1;
    row.score += 1;
  } else if (result === "loss") {
    row.losses += 1;
  } else {
    row.draws += 1;
    row.score += 0.5;
  }
}

function finalizeScores(scores) {
  return [...scores.values()]
    .map(row => ({
      ...row,
      winRate: row.games ? round(row.score / row.games) : 0,
      averageDurationMs: row.games ? round(row.totalDurationMs / row.games, 2) : 0
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.losses - b.losses);
}

function evaluateCharacterRound({ balance, character, population, mirrorRuns, seed, round }) {
  const pairs = candidatePairs(population);
  const scores = new Map(population.map(strategy => [strategy.id, emptyScore(strategy)]));
  if (!pairs.length) return finalizeScores(scores);

  for (let index = 0; index < mirrorRuns; index += 1) {
    const [left, right] = pairs[index % pairs.length];
    const flip = index % 2 === 1;
    const playerStrategy = flip ? right : left;
    const computerStrategy = flip ? left : right;
    const match = simulateMatch({
      balance,
      playerCharacter: character,
      computerCharacter: character,
      playerModel: makePolicyFromWeights(playerStrategy, character.id),
      computerModel: makePolicyFromWeights(computerStrategy, character.id),
      seed: `${seed}:${character.id}:round-${round}:match-${index}`
    });
    if (!match.winner) {
      recordResult(scores, playerStrategy, "draw", match.durationMs);
      recordResult(scores, computerStrategy, "draw", match.durationMs);
    } else if (match.winner === "player") {
      recordResult(scores, playerStrategy, "win", match.durationMs);
      recordResult(scores, computerStrategy, "loss", match.durationMs);
    } else {
      recordResult(scores, playerStrategy, "loss", match.durationMs);
      recordResult(scores, computerStrategy, "win", match.durationMs);
    }
  }
  return finalizeScores(scores);
}

function nextPopulation(character, ranked, rng, size = DEFAULT_POPULATION_SIZE, eliteCount = DEFAULT_ELITE_COUNT) {
  const elites = ranked.slice(0, Math.min(eliteCount, ranked.length)).map(row => makeStrategy(row.id, clone(row.strategyWeights)));
  const next = elites.map((strategy, index) => makeStrategy(index === 0 ? "champion" : `elite-${index}`, clone(strategy.strategyWeights)));
  while (next.length < size) {
    const left = elites[rng.int(elites.length)];
    const right = elites[rng.int(elites.length)];
    next.push(crossoverStrategy(`${character.id}-gen-${next.length}-${Math.floor(rng.next() * 1e9)}`, left, right, rng));
  }
  return next;
}

function rankRowsToCsv(rows) {
  const header = ["rank", "characterId", "strategyId", "games", "wins", "losses", "draws", "winRate", "averageDurationMs", "strategyWeights"];
  return [
    header,
    ...rows.map((row, index) => [
      index + 1,
      row.characterId,
      row.id,
      row.games,
      row.wins,
      row.losses,
      row.draws,
      row.winRate,
      row.averageDurationMs,
      JSON.stringify(row.strategyWeights)
    ])
  ];
}

function buildRunId(seed) {
  const safeSeed = String(seed).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  return `ai-strategy-${stamp()}${safeSeed ? `-${safeSeed}` : ""}`;
}

function runSearch(options = {}) {
  const balance = options.balance || loadBalance(root);
  const characters = options.characters || loadCharacters(root);
  const seed = String(options.seed || `ai-strategy-${stamp()}`);
  const durationHours = Number(options.durationHours ?? 6);
  const mirrorRuns = Math.max(1, Math.floor(Number(options.mirrorRuns ?? 1000)));
  const populationSize = Math.max(2, Math.floor(Number(options.populationSize ?? DEFAULT_POPULATION_SIZE)));
  const eliteCount = Math.max(1, Math.min(populationSize, Math.floor(Number(options.eliteCount ?? DEFAULT_ELITE_COUNT))));
  const outputDir = options.outputDir || path.join(reportsDir, buildRunId(seed));
  const rng = createRng(seed);
  const deadlineMs = Date.now() + durationHours * 60 * 60 * 1000;
  const populations = new Map(characters.map(character => [character.id, seedPopulation(character, rng, populationSize)]));
  const history = [];
  const bestByCharacter = new Map();
  let round = 0;

  ensureDir(outputDir);

  do {
    round += 1;
    for (const character of characters) {
      if (Date.now() >= deadlineMs && round > 1) break;
      const ranked = evaluateCharacterRound({
        balance,
        character,
        population: populations.get(character.id),
        mirrorRuns,
        seed,
        round
      }).map(row => ({ ...row, characterId: character.id, round }));
      writeJson(path.join(outputDir, `${character.id}-round-${round}-ranking.json`), ranked);
      writeCsv(path.join(outputDir, `${character.id}-round-${round}-ranking.csv`), rankRowsToCsv(ranked));
      const currentBest = bestByCharacter.get(character.id);
      if (!currentBest || ranked[0].winRate > currentBest.winRate || ranked[0].wins > currentBest.wins) {
        bestByCharacter.set(character.id, ranked[0]);
      }
      history.push({
        round,
        characterId: character.id,
        mirrorRuns,
        best: ranked[0],
        completedAt: new Date().toISOString()
      });
      populations.set(character.id, nextPopulation(character, ranked, rng, populationSize, eliteCount));
    }
    writeJson(path.join(outputDir, "history.json"), history);
  } while (Date.now() < deadlineMs);

  const bestStrategies = characters.map(character => {
    const best = bestByCharacter.get(character.id);
    return {
      characterId: character.id,
      characterName: character.name,
      strategyId: best.id,
      winRate: best.winRate,
      games: best.games,
      wins: best.wins,
      losses: best.losses,
      draws: best.draws,
      strategyWeights: best.strategyWeights
    };
  });
  const manifest = {
    id: path.basename(outputDir),
    status: "completed",
    seed,
    durationHours,
    mirrorRuns,
    populationSize,
    eliteCount,
    rounds: round,
    generatedAt: new Date().toISOString(),
    outputs: {
      directory: outputDir,
      history: path.join(outputDir, "history.json"),
      bestStrategies: path.join(outputDir, "best-strategies.json")
    }
  };
  writeJson(path.join(outputDir, "best-strategies.json"), bestStrategies);
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  writeCsv(path.join(outputDir, "best-strategies.csv"), rankRowsToCsv(bestStrategies.map(row => ({ ...row, id: row.strategyId, averageDurationMs: "" }))));
  return { manifest, bestStrategies, history };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runSearch({
    seed: stringArg(args, "seed", `ai-strategy-${stamp()}`),
    durationHours: numberArg(args, "duration-hours", 6),
    mirrorRuns: numberArg(args, "mirror-runs", 1000),
    populationSize: numberArg(args, "population-size", DEFAULT_POPULATION_SIZE),
    eliteCount: numberArg(args, "elite-count", DEFAULT_ELITE_COUNT)
  });
  console.log(`Manifest: ${result.manifest.outputs.directory}\\manifest.json`);
  result.bestStrategies.forEach(row => {
    console.log(`${row.characterId}: ${(row.winRate * 100).toFixed(2)}% (${row.wins}/${row.games})`);
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  WEIGHT_MAX,
  WEIGHT_MIN,
  crossoverStrategy,
  defaultStrategyWeights,
  evaluateCharacterRound,
  runSearch,
  seedPopulation
};
