#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  buildCharacterMap,
  createRng,
  loadBalance,
  loadCharacters,
  runSeries,
  simulateMatch
} = require("./sim-core");
const {
  BASIC_STRATEGY_ID,
  makeBasicPolicy,
  makeBasicStrategy
} = require("./basic-ai-strategy");
const {
  modelFromStrategyWeights,
  pairToCsvRows
} = require("./simulate-balance");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 3;
const DEFAULT_SEED = "strategy-optimization";
const DEFAULT_GA_POPULATION = 24;
const DEFAULT_GA_ROUNDS = 8;
const DEFAULT_GA_ELITES = 6;
const DEFAULT_GA_RUNS = 1000;
const DEFAULT_RL_ROUNDS = 12;
const DEFAULT_RL_SAMPLES = 16;
const DEFAULT_RL_RUNS = 1000;
const DEFAULT_CROSS_RUNS = 1000;
const DEFAULT_MIN_QUALIFIED = 8;
const DEFAULT_MIN_QUALIFIED_PER_CHARACTER = 0;
const DEFAULT_DIVERSITY_DISTANCE = 0.18;
const DEFAULT_BASELINE_DISTANCE = 0.08;
const DEFAULT_CYCLES = 1;
const DEFAULT_GA_DURATION_HOURS = 0;
const DEFAULT_RL_DURATION_HOURS = 0;
const DEFAULT_RL_SIGMA = 0.42;
const DEFAULT_RL_TEMPERATURE = 0.08;

const weightShape = {
  movement: ["safePath", "leastDamage", "fastestArrival"],
  food: ["fastestArrival", "ownDeficit", "opponentDeficit", "ownPreferred", "opponentPreferred"],
  skillAllocation: ["preferSmall", "preferBig"],
  castTiming: ["lethal", "nearFullEnergy", "opponentDebuffed", "opponentAlmostReady", "nearOpponent", "farOpponent"],
  castTarget: ["targetHead", "bodyCluster", "targetNearestFood"],
  castDirection: ["selfHeadToOpponentHead", "opponentBodyLongestAxis", "opponentHeadToNearestFood"]
};

const tunedKeys = Object.entries(weightShape).flatMap(([group, keys]) =>
  keys.filter(key => !(group === "castTiming" && key === "lethal")).map(key => ({ group, key }))
);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
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

function integerArg(args, key, fallback) {
  const value = numberArg(args, key, fallback);
  if (!Number.isInteger(value)) throw new Error(`--${key} must be an integer.`);
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

function clamp(value, min = WEIGHT_MIN, max = WEIGHT_MAX) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultStrategyWeights() {
  return {
    movement: { safePath: 1.4, leastDamage: 1.1, fastestArrival: 1 },
    food: { fastestArrival: 1, ownDeficit: 0.9, opponentDeficit: 0.5, ownPreferred: 1.1, opponentPreferred: 0.4 },
    skillAllocation: { preferSmall: 1, preferBig: 1 },
    castTiming: { lethal: 3, nearFullEnergy: 0.8, opponentDebuffed: 1.1, opponentAlmostReady: 0.8, nearOpponent: 0.9, farOpponent: 0.4 },
    castTarget: { targetHead: 1.3, bodyCluster: 1.2, targetNearestFood: 0.8 },
    castDirection: { selfHeadToOpponentHead: 1.4, opponentBodyLongestAxis: 1.1, opponentHeadToNearestFood: 0.8 }
  };
}

function roleAdjustedBaseWeights(character) {
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
  return base;
}

function weightsToVector(weights) {
  return tunedKeys.map(({ group, key }) => Number(weights[group]?.[key] ?? defaultStrategyWeights()[group][key]));
}

function vectorToWeights(vector) {
  const weights = defaultStrategyWeights();
  tunedKeys.forEach(({ group, key }, index) => {
    weights[group][key] = round(clamp(vector[index]), 4);
  });
  weights.castTiming.lethal = 3;
  return weights;
}

function makeStrategy(id, weights) {
  return { id, strategyId: id, strategyWeights: weights };
}

function randomBetween(rng, min, max) {
  return min + rng.next() * (max - min);
}

function fullyRandomStrategy(id, rng) {
  const weights = defaultStrategyWeights();
  Object.entries(weightShape).forEach(([group, keys]) => {
    keys.forEach(key => {
      weights[group][key] = round(randomBetween(rng, WEIGHT_MIN, WEIGHT_MAX), 4);
    });
  });
  weights.castTiming.lethal = 3;
  return makeStrategy(id, weights);
}

function mutateWeights(source, rng, spread) {
  const vector = weightsToVector(source).map(value => round(clamp(value + randomBetween(rng, -spread, spread)), 4));
  return vectorToWeights(vector);
}

function crossoverStrategy(id, left, right, rng, mutation = 0.3) {
  const leftVector = weightsToVector(left.strategyWeights);
  const rightVector = weightsToVector(right.strategyWeights);
  const vector = leftVector.map((value, index) => {
    const source = rng.next() < 0.5 ? value : rightVector[index];
    return round(clamp(source + randomBetween(rng, -mutation, mutation)), 4);
  });
  return makeStrategy(id, vectorToWeights(vector));
}

function archetypeStrategies(character) {
  const base = roleAdjustedBaseWeights(character);
  const make = (id, overrides) => {
    const weights = clone(base);
    Object.entries(overrides).forEach(([group, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        weights[group][key] = round(clamp(value), 4);
      });
    });
    weights.castTiming.lethal = 3;
    return makeStrategy(id, weights);
  };
  const burstBias = character.specialFood === "black" ? 2.2 : 1.7;
  const preferredBias = character.foodPreference && character.foodPreference !== "balanced" ? 2 : 1.2;
  return [
    make("archetype-rush-big", {
      movement: { safePath: 1, leastDamage: 0.7, fastestArrival: 2.2 },
      skillAllocation: { preferSmall: 0.7, preferBig: burstBias },
      castTiming: { nearOpponent: 1.8, farOpponent: 0.2, nearFullEnergy: 1.5, opponentAlmostReady: 1.2 }
    }),
    make("archetype-control-deny", {
      movement: { safePath: 1.8, leastDamage: 1.6, fastestArrival: 0.8 },
      food: { fastestArrival: 0.8, ownDeficit: 0.9, opponentDeficit: 1.8, ownPreferred: preferredBias, opponentPreferred: 1.4 },
      skillAllocation: { preferSmall: 1.4, preferBig: 0.9 },
      castTiming: { opponentAlmostReady: 1.8, opponentDebuffed: 1.7, nearOpponent: 1.1 }
    }),
    make("archetype-resource-greed", {
      movement: { safePath: 1.3, leastDamage: 1, fastestArrival: 1.5 },
      food: { fastestArrival: 1.5, ownDeficit: 1.9, opponentDeficit: 0.3, ownPreferred: Math.max(1.8, preferredBias), opponentPreferred: 0.2 },
      skillAllocation: { preferSmall: 0.5, preferBig: 2 },
      castTiming: { nearFullEnergy: 2.2, farOpponent: 0.8, nearOpponent: 0.8 }
    }),
    make("archetype-survivor", {
      movement: { safePath: 2.5, leastDamage: 2.2, fastestArrival: 0.5 },
      food: { fastestArrival: 0.7, ownDeficit: 1.2, opponentDeficit: 0.8, ownPreferred: preferredBias, opponentPreferred: 0.6 },
      skillAllocation: { preferSmall: 1, preferBig: 1 },
      castTiming: { opponentAlmostReady: 1.4, nearOpponent: 0.5, farOpponent: 1.1 }
    })
  ];
}

function seedPopulation(character, rng, size) {
  const base = makeStrategy(`${character.id}-role-base`, roleAdjustedBaseWeights(character));
  const basic = makeBasicStrategy(`${character.id}-basic-seed`);
  const population = [base, basic, ...archetypeStrategies(character)];
  while (population.length < size) population.push(fullyRandomStrategy(`${character.id}-seed-${population.length}`, rng));
  return population.slice(0, size).map((strategy, index) => makeStrategy(`${character.id}-ga0-${index}`, strategy.strategyWeights));
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

function emptyTotals(characterId, strategyId) {
  return {
    characterId,
    strategyId,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalDurationMs: 0,
    totalHpDiff: 0,
    totalScoreDiff: 0
  };
}

function recordMatch(totals, match, candidateIsPlayer) {
  totals.games += 1;
  totals.totalDurationMs += match.durationMs;
  const candidate = candidateIsPlayer ? match.player : match.computer;
  totals.totalHpDiff += candidate.hpDiff;
  totals.totalScoreDiff += candidate.scoreDiff;
  if (!match.winner) {
    totals.draws += 1;
    return;
  }
  const candidateWon = candidateIsPlayer ? match.winner === "player" : match.winner === "computer";
  if (candidateWon) totals.wins += 1;
  else totals.losses += 1;
}

function finalizeTotals(totals, strategyWeights) {
  const decisiveGames = totals.wins + totals.losses;
  const winRate = totals.games ? totals.wins / totals.games : 0;
  const drawRate = totals.games ? totals.draws / totals.games : 0;
  const decisiveWinRate = decisiveGames ? totals.wins / decisiveGames : 0;
  const outcomeWinRate = totals.games ? (totals.wins + totals.draws * 0.5) / totals.games : 0;
  const averageHpDiff = totals.games ? totals.totalHpDiff / totals.games : 0;
  const averageScoreDiff = totals.games ? totals.totalScoreDiff / totals.games : 0;
  const shaping = clamp(averageHpDiff / 120 + averageScoreDiff / 30, -0.05, 0.05);
  return {
    ...totals,
    winRate: round(winRate),
    drawRate: round(drawRate),
    decisiveGames,
    decisiveWinRate: round(decisiveWinRate),
    outcomeWinRate: round(outcomeWinRate),
    averageDurationMs: totals.games ? round(totals.totalDurationMs / totals.games, 2) : 0,
    averageHpDiff: round(averageHpDiff),
    averageScoreDiff: round(averageScoreDiff),
    reward: round(clamp(winRate + shaping, 0, 1)),
    passedGate: winRate > 0.5,
    strategyWeights
  };
}

function evaluateAgainstBasic({ balance, character, candidate, runs, seed, phase }) {
  const totals = emptyTotals(character.id, candidate.id);
  for (let index = 0; index < runs; index += 1) {
    const candidateIsPlayer = index % 2 === 0;
    const match = simulateMatch({
      balance,
      playerCharacter: character,
      computerCharacter: character,
      playerModel: candidateIsPlayer ? makePolicyFromWeights(candidate, character.id) : makeBasicPolicy(character.id),
      computerModel: candidateIsPlayer ? makeBasicPolicy(character.id) : makePolicyFromWeights(candidate, character.id),
      seed: `${seed}:${character.id}:${phase}:${candidate.id}:match-${index}`
    });
    recordMatch(totals, match, candidateIsPlayer);
  }
  return finalizeTotals(totals, candidate.strategyWeights);
}

function annotateNovelty(row, baselineDistance) {
  const distance = normalizedDistance(row.strategyWeights, makeBasicStrategy().strategyWeights);
  return {
    ...row,
    baselineDistance: round(distance),
    novelFromBaseline: distance >= baselineDistance
  };
}

function compareRows(a, b) {
  return b.winRate - a.winRate
    || b.reward - a.reward
    || b.outcomeWinRate - a.outcomeWinRate
    || b.decisiveWinRate - a.decisiveWinRate
    || b.averageHpDiff - a.averageHpDiff
    || b.averageScoreDiff - a.averageScoreDiff;
}

function normalizedDistance(leftWeights, rightWeights) {
  const left = weightsToVector(leftWeights);
  const right = weightsToVector(rightWeights);
  const squared = left.reduce((sum, value, index) => sum + ((value - right[index]) / (WEIGHT_MAX - WEIGHT_MIN)) ** 2, 0);
  return Math.sqrt(squared / left.length);
}

function selectDiverse(rows, minDistance, limit = Infinity) {
  const selected = [];
  [...rows].sort(compareRows).forEach(row => {
    if (selected.length >= limit) return;
    if (selected.every(existing => normalizedDistance(row.strategyWeights, existing.strategyWeights) >= minDistance)) {
      selected.push(row);
    }
  });
  return selected;
}

function diverseQualifiedByCharacter(rows, characters, minDistance) {
  return Object.fromEntries(characters.map(character => [
    character.id,
    selectDiverse(qualifiedRows(rows).filter(row => row.characterId === character.id), minDistance)
  ]));
}

function perCharacterQualifiedComplete(rows, characters, minDistance, target) {
  if (!target) return false;
  const byCharacter = diverseQualifiedByCharacter(rows, characters, minDistance);
  return characters.every(character => (byCharacter[character.id] || []).length >= target);
}

function nextGaPopulation(character, ranked, rng, size, eliteCount, round) {
  const elites = ranked.slice(0, Math.max(1, Math.min(eliteCount, ranked.length)))
    .map(row => makeStrategy(row.strategyId, row.strategyWeights));
  const next = [
    makeStrategy(`${character.id}-ga${round}-base`, roleAdjustedBaseWeights(character)),
    ...elites.map((strategy, index) => makeStrategy(`${character.id}-ga${round}-elite-${index}`, strategy.strategyWeights))
  ].slice(0, size);
  while (next.length < size) {
    if (elites.length >= 2 && rng.next() < 0.75) {
      next.push(crossoverStrategy(`${character.id}-ga${round}-child-${next.length}-${Math.floor(rng.next() * 1e9)}`, rng.item(elites), rng.item(elites), rng));
    } else {
      const source = elites.length ? rng.item(elites).strategyWeights : roleAdjustedBaseWeights(character);
      next.push(makeStrategy(`${character.id}-ga${round}-mutant-${next.length}-${Math.floor(rng.next() * 1e9)}`, mutateWeights(source, rng, 0.75)));
    }
  }
  return next;
}

function qualifiedRows(rows) {
  return rows.filter(row => row.passedGate && row.novelFromBaseline);
}

function runGaSearch({ balance, characters, seed, runs, rounds, populationSize, eliteCount, diversityDistance, baselineDistance, minQualified, minQualifiedPerCharacter, durationHours, outputDir }) {
  const rng = createRng(`${seed}:ga`);
  const populations = new Map(characters.map(character => [character.id, seedPopulation(character, rng, populationSize)]));
  const allRows = [];
  const history = [];
  const bestByCharacter = new Map();
  const deadlineMs = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null;
  let roundIndex = 0;
  let stopReason = "rounds";

  while (roundIndex < rounds || (deadlineMs && Date.now() < deadlineMs)) {
    if (deadlineMs && Date.now() >= deadlineMs) {
      stopReason = "duration";
      break;
    }
    if (minQualifiedPerCharacter && perCharacterQualifiedComplete(allRows, characters, diversityDistance, minQualifiedPerCharacter)) {
      stopReason = "per-character-qualified";
      break;
    }
    roundIndex += 1;
    characters.forEach(character => {
      const ranked = populations.get(character.id)
        .map(candidate => evaluateAgainstBasic({
          balance,
          character,
          candidate,
          runs,
          seed,
          phase: `ga-round-${roundIndex}`
        }))
        .map(row => annotateNovelty(row, baselineDistance))
        .sort(compareRows);
      ranked.forEach(row => allRows.push({ ...row, phase: "ga", round: roundIndex }));
      writeJson(path.join(outputDir, "ga", `${character.id}-round-${roundIndex}.json`), ranked);
      const previousBest = bestByCharacter.get(character.id);
      if (!previousBest || compareRows(ranked[0], previousBest) < 0) bestByCharacter.set(character.id, ranked[0]);
      history.push({
        round: roundIndex,
        characterId: character.id,
        bestStrategyId: ranked[0]?.strategyId,
        bestWinRate: ranked[0]?.winRate,
        qualified: qualifiedRows(ranked).length
      });
      populations.set(character.id, nextGaPopulation(character, ranked, rng, populationSize, eliteCount, roundIndex));
    });
    const qualified = selectDiverse(qualifiedRows(allRows), diversityDistance);
    const perCharacter = diverseQualifiedByCharacter(allRows, characters, diversityDistance);
    const perCharacterText = characters.map(character => `${character.id}:${perCharacter[character.id].length}`).join(" ");
    console.log(`GA round ${roundIndex}${deadlineMs ? "" : `/${rounds}`}: ${qualified.length} diverse qualified strategies (${perCharacterText})`);
  }

  const diverseQualified = selectDiverse(qualifiedRows(allRows), diversityDistance);
  const perCharacterQualified = diverseQualifiedByCharacter(allRows, characters, diversityDistance);
  writeJson(path.join(outputDir, "ga-history.json"), history);
  writeJson(path.join(outputDir, "ga-qualified.json"), {
    gate: "winRate = wins / (wins + losses + draws) > 0.5",
    diversityDistance,
    baselineDistance,
    durationHours,
    minQualified,
    minQualifiedPerCharacter,
    stopReason,
    rounds: roundIndex,
    qualifiedCount: diverseQualified.length,
    perCharacterQualified: Object.fromEntries(Object.entries(perCharacterQualified).map(([characterId, rows]) => [characterId, rows.length])),
    strategies: diverseQualified
  });
  writeCsv(path.join(outputDir, "ga-qualified.csv"), rowsToCsv(diverseQualified));
  return { allRows, diverseQualified, perCharacterQualified, bestByCharacter, history, stopReason, rounds: roundIndex };
}

function gaussian(rng) {
  const u1 = Math.max(Number.EPSILON, rng.next());
  const u2 = Math.max(Number.EPSILON, rng.next());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function softmaxWeights(rows, temperature) {
  const rewards = rows.map(row => row.reward);
  const maxReward = Math.max(...rewards);
  const exps = rewards.map(value => Math.exp((value - maxReward) / Math.max(temperature, 1e-6)));
  const total = exps.reduce((sum, value) => sum + value, 0) || 1;
  return exps.map(value => value / total);
}

function weightedMean(rows, weights) {
  const vector = Array.from({ length: tunedKeys.length }, () => 0);
  rows.forEach((row, rowIndex) => {
    weightsToVector(row.strategyWeights).forEach((value, vectorIndex) => {
      vector[vectorIndex] += value * weights[rowIndex];
    });
  });
  return vector.map(value => clamp(value));
}

function averageVector(rows) {
  if (!rows.length) return weightsToVector(defaultStrategyWeights());
  return rows.reduce((acc, row) => {
    weightsToVector(row.strategyWeights).forEach((value, index) => {
      acc[index] += value / rows.length;
    });
    return acc;
  }, Array.from({ length: tunedKeys.length }, () => 0)).map(value => clamp(value));
}

function sampleAroundVector(prefix, center, rng, sigma, count) {
  return Array.from({ length: count }, (_, index) => {
    const vector = center.map(value => round(clamp(value + gaussian(rng) * sigma), 4));
    return makeStrategy(`${prefix}-sample-${index}-${Math.floor(rng.next() * 1e9)}`, vectorToWeights(vector));
  });
}

function runBanditRl({ balance, characters, gaRows, bestByCharacter, seed, runs, rounds, samples, sigma, temperature, durationHours, outputDir }) {
  const rng = createRng(`${seed}:rl`);
  const history = [];
  const deadlineMs = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null;
  let stopReason = "rounds";
  const states = new Map(characters.map(character => {
    const characterSeeds = gaRows
      .filter(row => row.characterId === character.id)
      .sort(compareRows)
      .slice(0, Math.max(2, samples));
    const fallback = bestByCharacter.get(character.id);
    const seedRows = characterSeeds.length ? characterSeeds : fallback ? [fallback] : [{
      characterId: character.id,
      strategyId: `${character.id}-role-base`,
      strategyWeights: roleAdjustedBaseWeights(character),
      reward: 0
    }];
    return [character.id, {
      center: averageVector(seedRows),
      sigma,
      best: null,
      rounds: 0
    }];
  }));

  let roundIndex = 0;
  while (roundIndex < rounds || (deadlineMs && Date.now() < deadlineMs)) {
    if (deadlineMs && Date.now() >= deadlineMs && roundIndex >= rounds) {
      stopReason = "duration";
      break;
    }
    roundIndex += 1;
    for (const character of characters) {
      if (deadlineMs && Date.now() >= deadlineMs && roundIndex > rounds) {
        stopReason = "duration";
        break;
      }
      const state = states.get(character.id);
      const candidates = [
        makeStrategy(`${character.id}-rl${roundIndex}-center`, vectorToWeights(state.center)),
        ...sampleAroundVector(`${character.id}-rl${roundIndex}`, state.center, rng, state.sigma, samples)
      ];
      const ranked = candidates.map(candidate => evaluateAgainstBasic({
        balance,
        character,
        candidate,
        runs,
        seed,
        phase: `rl-round-${roundIndex}`
      })).map(row => annotateNovelty(row, 0)).sort(compareRows);
      writeJson(path.join(outputDir, "rl", `${character.id}-round-${roundIndex}.json`), ranked);
      if (!state.best || compareRows(ranked[0], state.best) < 0) state.best = ranked[0];
      const updateRows = ranked.slice(0, Math.max(2, Math.ceil(ranked.length / 2)));
      state.center = weightedMean(updateRows, softmaxWeights(updateRows, temperature));
      const improved = ranked[0].reward >= updateRows[Math.min(updateRows.length - 1, 1)].reward;
      state.sigma = clamp(state.sigma * (improved ? 0.92 : 1.08), 0.035, 0.9);
      state.rounds = roundIndex;
      history.push({
        characterId: character.id,
        round: roundIndex,
        bestStrategyId: ranked[0].strategyId,
        bestWinRate: ranked[0].winRate,
        bestReward: ranked[0].reward,
        sigma: round(state.sigma, 4)
      });
      console.log(`RL ${character.id} round ${roundIndex}${deadlineMs ? "" : `/${rounds}`}: winRate ${(ranked[0].winRate * 100).toFixed(1)}%`);
    }
  }
  if (deadlineMs && Date.now() >= deadlineMs && roundIndex >= rounds) stopReason = "duration";

  const bestStrategies = characters.map(character => {
    const state = states.get(character.id);
    const best = state.best || annotateNovelty(evaluateAgainstBasic({
      balance,
      character,
      candidate: makeStrategy(`${character.id}-rl-fallback`, vectorToWeights(state.center)),
      runs,
      seed,
      phase: "rl-fallback"
    }), 0);
    return {
      ...best,
      characterName: character.name,
      phase: "rl-best"
    };
  });
  writeJson(path.join(outputDir, "rl-history.json"), history);
  writeJson(path.join(outputDir, "rl-best-strategies.json"), {
    durationHours,
    stopReason,
    strategies: bestStrategies
  });
  writeCsv(path.join(outputDir, "rl-best-strategies.csv"), rowsToCsv(bestStrategies));
  return { bestStrategies, history, stopReason };
}

function buildStrategyFile(rows, characters, source) {
  const byCharacter = new Map(rows.map(row => [row.characterId, row]));
  return {
    generatedAt: new Date().toISOString(),
    source,
    strategies: Object.fromEntries(characters.map(character => {
      const row = byCharacter.get(character.id);
      const weights = row?.strategyWeights || makeBasicStrategy().strategyWeights;
      return [character.id, {
        strategyId: row?.strategyId || BASIC_STRATEGY_ID,
        winRate: row?.winRate ?? 0.5,
        outcomeWinRate: row?.outcomeWinRate ?? 0.5,
        drawRate: row?.drawRate ?? 1,
        decisiveGames: row?.decisiveGames ?? 0,
        decisiveWinRate: row?.decisiveWinRate ?? 0,
        games: row?.games ?? 0,
        wins: row?.wins ?? 0,
        losses: row?.losses ?? 0,
        draws: row?.draws ?? 0,
        strategyWeights: weights
      }];
    }))
  };
}

function strategyModel(strategyFile, characterId) {
  const row = strategyFile.strategies[characterId];
  return row ? modelFromStrategyWeights(row) : makeBasicPolicy(characterId);
}

function buildMatrix(results, characters) {
  const byPair = new Map(results.map(result => [`${result.playerCharacterId}:${result.computerCharacterId}`, result]));
  const rows = characters.map(playerCharacter => ({
    characterId: playerCharacter.id,
    cells: characters.map(computerCharacter => {
      if (playerCharacter.id === computerCharacter.id) return null;
      return byPair.get(`${playerCharacter.id}:${computerCharacter.id}`) || null;
    })
  }));
  const averages = rows.map(row => {
    const played = row.cells.filter(Boolean);
    return {
      characterId: row.characterId,
      averageWinRate: played.length ? played.reduce((sum, result) => sum + result.winRate, 0) / played.length : 0,
      games: played.reduce((sum, result) => sum + result.runs, 0)
    };
  });
  return { rows, averages };
}

function matrixToCsv(matrix, characters) {
  const header = ["player\\opponent", ...characters.map(character => character.id), "average"];
  const rows = matrix.rows.map(row => {
    const average = matrix.averages.find(item => item.characterId === row.characterId);
    return [
      row.characterId,
      ...row.cells.map(result => result ? result.winRate.toFixed(4) : ""),
      average.averageWinRate.toFixed(4)
    ];
  });
  return [header, ...rows];
}

function runCrossPlayReport({ balance, characters, strategyFile, runs, seed, outputPrefix }) {
  const results = [];
  characters.forEach(playerCharacter => {
    characters.forEach(computerCharacter => {
      if (playerCharacter.id === computerCharacter.id) return;
      results.push(runSeries({
        balance,
        playerCharacter,
        computerCharacter,
        seed: `${seed}:${playerCharacter.id}:vs:${computerCharacter.id}`,
        runs,
        playerModel: strategyModel(strategyFile, playerCharacter.id),
        computerModel: strategyModel(strategyFile, computerCharacter.id)
      }));
    });
  });
  const report = {
    generatedAt: new Date().toISOString(),
    config: { seed, runs, orderedPairs: results.length, strategySource: strategyFile.source },
    results
  };
  const matrix = buildMatrix(results, characters);
  writeJson(`${outputPrefix}.json`, report);
  fs.writeFileSync(`${outputPrefix}.csv`, `${pairToCsvRows(results)}\n`, "utf8");
  writeCsv(`${outputPrefix}-matrix.csv`, matrixToCsv(matrix, characters));
  return { report, matrix };
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function comparisonMarkdown({ config, gaQualified, rlBest, baselineCross, bestCross, characters }) {
  const baselineAverage = baselineCross.matrix.averages.reduce((sum, row) => sum + row.averageWinRate, 0) / baselineCross.matrix.averages.length;
  const bestAverage = bestCross.matrix.averages.reduce((sum, row) => sum + row.averageWinRate, 0) / bestCross.matrix.averages.length;
  const rows = characters.map(character => {
    const before = baselineCross.matrix.averages.find(row => row.characterId === character.id)?.averageWinRate || 0;
    const after = bestCross.matrix.averages.find(row => row.characterId === character.id)?.averageWinRate || 0;
    return `| ${character.id} | ${percent(before)} | ${percent(after)} | ${percent(after - before)} |`;
  });
  return [
    "# Strategy Optimization Comparison",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Seed: ${config.seed}`,
    `Gate: winRate = wins / (wins + losses + draws) > 50%`,
    `Diversity distance: ${config.diversityDistance}`,
    "",
    "## Summary",
    "",
    `- Diverse GA-qualified strategies: ${gaQualified.length}`,
    `- RL best strategies: ${rlBest.length}`,
    `- Baseline average cross win rate: ${percent(baselineAverage)}`,
    `- Best average cross win rate: ${percent(bestAverage)}`,
    `- Delta: ${percent(bestAverage - baselineAverage)}`,
    "",
    "## Per Character Average",
    "",
    "| Character | Baseline | Best | Delta |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## RL Best Mirror Gate",
    "",
    "| Character | Strategy | Win rate | Draw rate | Decisive win | Outcome win |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rlBest.map(row => `| ${row.characterId} | ${row.strategyId} | ${percent(row.winRate)} | ${percent(row.drawRate)} | ${percent(row.decisiveWinRate)} | ${percent(row.outcomeWinRate)} |`)
  ].join("\n");
}

function rowsToCsv(rows) {
  return [
    [
      "characterId",
      "strategyId",
      "games",
      "wins",
      "losses",
      "draws",
      "winRate",
      "drawRate",
      "decisiveGames",
      "decisiveWinRate",
      "outcomeWinRate",
      "reward",
      "passedGate",
      "baselineDistance",
      "novelFromBaseline",
      "averageDurationMs",
      "averageHpDiff",
      "averageScoreDiff",
      "strategyWeights"
    ],
    ...rows.map(row => [
      row.characterId,
      row.strategyId,
      row.games,
      row.wins,
      row.losses,
      row.draws,
      row.winRate,
      row.drawRate,
      row.decisiveGames,
      row.decisiveWinRate,
      row.outcomeWinRate,
      row.reward,
      row.passedGate,
      row.baselineDistance ?? "",
      row.novelFromBaseline ?? "",
      row.averageDurationMs,
      row.averageHpDiff,
      row.averageScoreDiff,
      JSON.stringify(row.strategyWeights)
    ])
  ];
}

function runOptimization(options = {}) {
  const balance = options.balance || loadBalance(root);
  const allCharacters = options.characters || loadCharacters(root);
  const selected = options.characterId
    ? allCharacters.filter(character => character.id === options.characterId)
    : allCharacters;
  if (options.characterId && !selected.length) throw new Error(`Unknown character id: ${options.characterId}`);
  const characters = selected;
  const characterById = buildCharacterMap(characters);
  const seed = String(options.seed || DEFAULT_SEED);
  const outputDir = options.outputDir || path.join(reportsDir, `strategy-optimization-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
  const config = {
    seed,
    gaPopulation: Math.max(2, Math.floor(options.gaPopulation ?? DEFAULT_GA_POPULATION)),
    gaRounds: Math.max(1, Math.floor(options.gaRounds ?? DEFAULT_GA_ROUNDS)),
    gaElites: Math.max(1, Math.floor(options.gaElites ?? DEFAULT_GA_ELITES)),
    gaRuns: Math.max(1, Math.floor(options.gaRuns ?? DEFAULT_GA_RUNS)),
    rlRounds: Math.max(1, Math.floor(options.rlRounds ?? DEFAULT_RL_ROUNDS)),
    rlSamples: Math.max(1, Math.floor(options.rlSamples ?? DEFAULT_RL_SAMPLES)),
    rlRuns: Math.max(1, Math.floor(options.rlRuns ?? DEFAULT_RL_RUNS)),
    crossRuns: Math.max(1, Math.floor(options.crossRuns ?? DEFAULT_CROSS_RUNS)),
    minQualified: Math.max(1, Math.floor(options.minQualified ?? DEFAULT_MIN_QUALIFIED)),
    minQualifiedPerCharacter: Math.max(0, Math.floor(options.minQualifiedPerCharacter ?? DEFAULT_MIN_QUALIFIED_PER_CHARACTER)),
    diversityDistance: Number(options.diversityDistance ?? DEFAULT_DIVERSITY_DISTANCE),
    baselineDistance: Number(options.baselineDistance ?? DEFAULT_BASELINE_DISTANCE),
    gaDurationHours: Number(options.gaDurationHours ?? DEFAULT_GA_DURATION_HOURS),
    rlDurationHours: Number(options.rlDurationHours ?? DEFAULT_RL_DURATION_HOURS),
    rlSigma: Number(options.rlSigma ?? DEFAULT_RL_SIGMA),
    rlTemperature: Number(options.rlTemperature ?? DEFAULT_RL_TEMPERATURE),
    characterIds: characters.map(character => character.id)
  };
  ensureDir(outputDir);
  writeJson(path.join(outputDir, "config.json"), config);

  const ga = runGaSearch({
    balance,
    characters,
    seed,
    runs: config.gaRuns,
    rounds: config.gaRounds,
    populationSize: config.gaPopulation,
    eliteCount: config.gaElites,
    diversityDistance: config.diversityDistance,
    baselineDistance: config.baselineDistance,
    minQualified: config.minQualified,
    minQualifiedPerCharacter: config.minQualifiedPerCharacter,
    durationHours: config.gaDurationHours,
    outputDir
  });
  const gaRowsForRl = qualifiedRows(ga.allRows);
  const rl = runBanditRl({
    balance,
    characters,
    gaRows: gaRowsForRl,
    bestByCharacter: ga.bestByCharacter,
    seed,
    runs: config.rlRuns,
    rounds: config.rlRounds,
    samples: config.rlSamples,
    sigma: config.rlSigma,
    temperature: config.rlTemperature,
    durationHours: config.rlDurationHours,
    outputDir
  });

  const baselineStrategyFile = buildStrategyFile(characters.map(character => ({
    characterId: characterById.get(character.id).id,
    strategyId: BASIC_STRATEGY_ID,
    strategyWeights: makeBasicStrategy().strategyWeights
  })), characters, "baseline-basic");
  const bestStrategyFile = buildStrategyFile(rl.bestStrategies, characters, path.join(outputDir, "rl-best-strategies.json"));
  writeJson(path.join(outputDir, "baseline-strategies.json"), baselineStrategyFile);
  writeJson(path.join(outputDir, "best-strategies-for-apply.json"), bestStrategyFile);

  const baselineCross = runCrossPlayReport({
    balance,
    characters,
    strategyFile: baselineStrategyFile,
    runs: config.crossRuns,
    seed: `${seed}:baseline-cross`,
    outputPrefix: path.join(outputDir, "baseline-cross")
  });
  const bestCross = runCrossPlayReport({
    balance,
    characters,
    strategyFile: bestStrategyFile,
    runs: config.crossRuns,
    seed: `${seed}:best-cross`,
    outputPrefix: path.join(outputDir, "best-cross")
  });
  const markdown = comparisonMarkdown({
    config,
    gaQualified: ga.diverseQualified,
    rlBest: rl.bestStrategies,
    baselineCross,
    bestCross,
    characters
  });
  fs.writeFileSync(path.join(outputDir, "comparison.md"), `${markdown}\n`, "utf8");
  const perCharacterComplete = config.minQualifiedPerCharacter
    ? Object.values(ga.perCharacterQualified).every(rows => rows.length >= config.minQualifiedPerCharacter)
    : true;
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: ga.diverseQualified.length >= config.minQualified && perCharacterComplete ? "completed" : "completed-insufficient-qualified",
    config,
    gaStopReason: ga.stopReason,
    rlStopReason: rl.stopReason,
    perCharacterQualified: Object.fromEntries(Object.entries(ga.perCharacterQualified).map(([characterId, rows]) => [characterId, rows.length])),
    outputs: {
      directory: outputDir,
      gaQualified: path.join(outputDir, "ga-qualified.json"),
      rlBestStrategies: path.join(outputDir, "rl-best-strategies.json"),
      baselineCrossMatrix: path.join(outputDir, "baseline-cross-matrix.csv"),
      bestCrossMatrix: path.join(outputDir, "best-cross-matrix.csv"),
      comparison: path.join(outputDir, "comparison.md"),
      bestStrategiesForApply: path.join(outputDir, "best-strategies-for-apply.json")
    }
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  return { manifest, ga, rl, baselineCross, bestCross };
}

function averageCrossWinRate(cross) {
  const rows = cross.matrix.averages;
  return rows.length ? rows.reduce((sum, row) => sum + row.averageWinRate, 0) / rows.length : 0;
}

function cycleSummaryRows(cycleResults) {
  return cycleResults.map((result, index) => {
    const baselineAverage = averageCrossWinRate(result.baselineCross);
    const bestAverage = averageCrossWinRate(result.bestCross);
    return {
      cycle: index + 1,
      status: result.manifest.status,
      seed: result.manifest.config.seed,
      directory: result.manifest.outputs.directory,
      qualifiedCount: result.ga.diverseQualified.length,
      rlBestCount: result.rl.bestStrategies.length,
      baselineAverage,
      bestAverage,
      delta: bestAverage - baselineAverage
    };
  });
}

function writeCycleSummary(outputDir, rows) {
  writeJson(path.join(outputDir, "cycles-summary.json"), {
    generatedAt: new Date().toISOString(),
    cycles: rows
  });
  writeCsv(path.join(outputDir, "cycles-summary.csv"), [
    ["cycle", "status", "seed", "qualifiedCount", "rlBestCount", "baselineAverage", "bestAverage", "delta", "directory"],
    ...rows.map(row => [
      row.cycle,
      row.status,
      row.seed,
      row.qualifiedCount,
      row.rlBestCount,
      round(row.baselineAverage),
      round(row.bestAverage),
      round(row.delta),
      row.directory
    ])
  ]);
  const lines = [
    "# Strategy Optimization Cycles",
    "",
    "| Cycle | Status | Qualified | RL Best | Baseline Avg | Best Avg | Delta |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(row => `| ${row.cycle} | ${row.status} | ${row.qualifiedCount} | ${row.rlBestCount} | ${percent(row.baselineAverage)} | ${percent(row.bestAverage)} | ${percent(row.delta)} |`)
  ];
  fs.writeFileSync(path.join(outputDir, "cycles-summary.md"), `${lines.join("\n")}\n`, "utf8");
}

function runMultiCycleOptimization(options = {}) {
  const cycles = Math.max(1, Math.floor(options.cycles ?? DEFAULT_CYCLES));
  if (cycles === 1) return runOptimization(options);
  const seed = String(options.seed || DEFAULT_SEED);
  const outputDir = options.outputDir || path.join(reportsDir, `strategy-cycles-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
  ensureDir(outputDir);
  const cycleResults = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const cycleSeed = `${seed}-cycle-${cycle}`;
    console.log(`Cycle ${cycle}/${cycles}: ${cycleSeed}`);
    cycleResults.push(runOptimization({
      ...options,
      cycles: 1,
      seed: cycleSeed,
      outputDir: path.join(outputDir, `cycle-${cycle}`)
    }));
  }
  const rows = cycleSummaryRows(cycleResults);
  writeCycleSummary(outputDir, rows);
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: rows.every(row => row.status === "completed") ? "completed" : "completed-with-insufficient-cycles",
    cycles,
    outputs: {
      directory: outputDir,
      summaryJson: path.join(outputDir, "cycles-summary.json"),
      summaryCsv: path.join(outputDir, "cycles-summary.csv"),
      summaryMarkdown: path.join(outputDir, "cycles-summary.md")
    }
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  return { manifest, cycles: cycleResults, cycleSummary: rows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    seed: stringArg(args, "seed", DEFAULT_SEED),
    characterId: args.character ? String(args.character) : undefined,
    outputDir: args.output ? path.resolve(root, args.output) : undefined,
    cycles: integerArg(args, "cycles", DEFAULT_CYCLES),
    gaPopulation: integerArg(args, "ga-population", DEFAULT_GA_POPULATION),
    gaRounds: integerArg(args, "ga-rounds", DEFAULT_GA_ROUNDS),
    gaElites: integerArg(args, "ga-elites", DEFAULT_GA_ELITES),
    gaRuns: integerArg(args, "ga-runs", DEFAULT_GA_RUNS),
    rlRounds: integerArg(args, "rl-rounds", DEFAULT_RL_ROUNDS),
    rlSamples: integerArg(args, "rl-samples", DEFAULT_RL_SAMPLES),
    rlRuns: integerArg(args, "rl-runs", DEFAULT_RL_RUNS),
    crossRuns: integerArg(args, "cross-runs", DEFAULT_CROSS_RUNS),
    minQualified: integerArg(args, "min-qualified", DEFAULT_MIN_QUALIFIED),
    minQualifiedPerCharacter: integerArg(args, "min-qualified-per-character", DEFAULT_MIN_QUALIFIED_PER_CHARACTER),
    diversityDistance: numberArg(args, "diversity-distance", DEFAULT_DIVERSITY_DISTANCE),
    baselineDistance: numberArg(args, "baseline-distance", DEFAULT_BASELINE_DISTANCE),
    gaDurationHours: numberArg(args, "ga-duration-hours", DEFAULT_GA_DURATION_HOURS),
    rlDurationHours: numberArg(args, "rl-duration-hours", DEFAULT_RL_DURATION_HOURS),
    rlSigma: numberArg(args, "rl-sigma", DEFAULT_RL_SIGMA),
    rlTemperature: numberArg(args, "rl-temperature", DEFAULT_RL_TEMPERATURE)
  };
  const result = runMultiCycleOptimization(options);
  console.log(`Manifest: ${result.manifest.outputs.directory}\\manifest.json`);
  if (result.cycleSummary) {
    result.cycleSummary.forEach(row => {
      console.log(`cycle ${row.cycle}: qualified ${row.qualifiedCount}, delta ${(row.delta * 100).toFixed(2)}%`);
    });
  } else {
    console.log(`GA qualified: ${result.ga.diverseQualified.length}`);
    result.rl.bestStrategies.forEach(row => {
      console.log(`${row.characterId}: ${(row.winRate * 100).toFixed(2)}% win (${row.wins}/${row.games}), draws ${row.draws}`);
    });
  }
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
  DEFAULT_DIVERSITY_DISTANCE,
  compareRows,
  evaluateAgainstBasic,
  normalizedDistance,
  qualifiedRows,
  runBanditRl,
  runGaSearch,
  runMultiCycleOptimization,
  runOptimization,
  selectDiverse,
  weightsToVector
};
