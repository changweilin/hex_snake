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
const DEFAULT_ALGORITHM = "ga";
const DEFAULT_DURATION_HOURS = 2;
const DEFAULT_TOP_COUNT = 5;
const DEFAULT_CONVERGENCE_THRESHOLD = 0.05;
const DEFAULT_MIN_ROUNDS = 2;
const CMA_INITIAL_SIGMA = 0.45;
const CMA_MIN_SIGMA = 0.025;

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

function optionalPositiveIntegerArg(args, key, fallback) {
  if (args[key] === undefined) return fallback;
  const value = Number(args[key]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${key} must be a positive integer.`);
  return value;
}

function stringArg(args, key, fallback) {
  return args[key] === undefined ? fallback : String(args[key]);
}

function algorithmArg(args) {
  const value = stringArg(args, "algorithm", DEFAULT_ALGORITHM).toLowerCase();
  if (!["ga", "cma-es"].includes(value)) throw new Error("--algorithm must be either ga or cma-es.");
  return value;
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

function tunedWeightKeys() {
  return Object.entries(weightShape).flatMap(([group, keys]) =>
    keys.filter(key => !(group === "castTiming" && key === "lethal")).map(key => ({ group, key }))
  );
}

const tunedKeys = tunedWeightKeys();

function weightsToVector(weights) {
  return tunedKeys.map(({ group, key }) => Number(weights[group]?.[key] ?? defaultStrategyWeights()[group][key]));
}

function vectorToWeights(vector) {
  const weights = defaultStrategyWeights();
  tunedKeys.forEach(({ group, key }, index) => {
    weights[group][key] = round(clampWeight(vector[index]), 4);
  });
  weights.castTiming.lethal = 3;
  return weights;
}

function characterBaseWeights(character) {
  return roleAdjustedBaseWeights(character);
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

function makeVectorStrategy(id, weights) {
  return { id, vector: weightsToVector(weights), strategyWeights: weights };
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

function archetypeStrategies(character) {
  const base = characterBaseWeights(character);
  const make = (id, overrides) => {
    const weights = clone(base);
    Object.entries(overrides).forEach(([group, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        weights[group][key] = round(clampWeight(value), 4);
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
  const base = roleAdjustedBaseWeights(character);
  const population = [makeStrategy("baseline", clone(base)), ...archetypeStrategies(character)];
  while (population.length < size) {
    population.push(randomStrategy(`seed-${population.length}`, rng, base));
  }
  return population.slice(0, size);
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
    outcomeScore: 0,
    outcomeWinRate: 0,
    advantageScore: 0,
    averageScoreDiff: 0,
    averageHpDiff: 0,
    averageDamageDiff: 0,
    averageFoodDiff: 0,
    averageDurationMs: 0,
    totalDurationMs: 0,
    totalScoreDiff: 0,
    totalHpDiff: 0,
    totalDamageDiff: 0,
    totalFoodDiff: 0
  };
}

function boundedAdvantage(metrics = {}) {
  const score = clampMetric(metrics.scoreDiff, 4) * 0.07;
  const hp = clampMetric(metrics.hpDiff, 8) * 0.04;
  const damage = clampMetric(metrics.damageDiff, 20) * 0.03;
  const food = clampMetric(metrics.foodDiff, 6) * 0.01;
  return clampValue(score + hp + damage + food, -0.15, 0.15);
}

function clampMetric(value, scale) {
  const number = Number(value) || 0;
  return clampValue(number / scale, -1, 1);
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function metricsFor(fighter, opponent) {
  return {
    scoreDiff: fighter.scoreDiff,
    hpDiff: fighter.hpDiff,
    damageDiff: fighter.damageDealt - opponent.damageDealt,
    foodDiff: fighter.foodCollected - opponent.foodCollected
  };
}

function recordResult(scores, strategy, result, durationMs, metrics = {}) {
  const row = scores.get(strategy.id);
  row.games += 1;
  row.totalDurationMs += durationMs;
  row.totalScoreDiff += metrics.scoreDiff || 0;
  row.totalHpDiff += metrics.hpDiff || 0;
  row.totalDamageDiff += metrics.damageDiff || 0;
  row.totalFoodDiff += metrics.foodDiff || 0;
  const advantage = boundedAdvantage(metrics);
  row.advantageScore += advantage;
  if (result === "win") {
    row.wins += 1;
    row.score += 1;
    row.outcomeScore += 1;
  } else if (result === "loss") {
    row.losses += 1;
  } else {
    row.draws += 1;
    row.score += 0.5 + advantage;
    row.outcomeScore += 0.5;
  }
}

function finalizeScores(scores) {
  return [...scores.values()]
    .map(row => ({
      ...row,
      winRate: row.games ? round(row.score / row.games) : 0,
      outcomeWinRate: row.games ? round(row.outcomeScore / row.games) : 0,
      drawRate: row.games ? round(row.draws / row.games) : 0,
      decisiveGames: row.wins + row.losses,
      decisiveWinRate: row.wins + row.losses ? round(row.wins / (row.wins + row.losses)) : 0,
      advantageScore: round(row.advantageScore),
      averageScoreDiff: row.games ? round(row.totalScoreDiff / row.games) : 0,
      averageHpDiff: row.games ? round(row.totalHpDiff / row.games) : 0,
      averageDamageDiff: row.games ? round(row.totalDamageDiff / row.games) : 0,
      averageFoodDiff: row.games ? round(row.totalFoodDiff / row.games) : 0,
      averageDurationMs: row.games ? round(row.totalDurationMs / row.games, 2) : 0
    }))
    .sort(compareRankRows);
}

function compareRankRows(a, b) {
  return b.decisiveWinRate - a.decisiveWinRate
    || b.winRate - a.winRate
    || b.outcomeWinRate - a.outcomeWinRate
    || b.wins - a.wins
    || a.losses - b.losses
    || b.averageHpDiff - a.averageHpDiff
    || b.averageDamageDiff - a.averageDamageDiff
    || b.averageScoreDiff - a.averageScoreDiff;
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
      recordResult(scores, playerStrategy, "draw", match.durationMs, metricsFor(match.player, match.computer));
      recordResult(scores, computerStrategy, "draw", match.durationMs, metricsFor(match.computer, match.player));
    } else if (match.winner === "player") {
      recordResult(scores, playerStrategy, "win", match.durationMs, metricsFor(match.player, match.computer));
      recordResult(scores, computerStrategy, "loss", match.durationMs, metricsFor(match.computer, match.player));
    } else {
      recordResult(scores, playerStrategy, "loss", match.durationMs, metricsFor(match.player, match.computer));
      recordResult(scores, computerStrategy, "win", match.durationMs, metricsFor(match.computer, match.player));
    }
  }
  return finalizeScores(scores);
}

function nextPopulation(character, ranked, rng, size = DEFAULT_POPULATION_SIZE, eliteCount = DEFAULT_ELITE_COUNT) {
  const elites = ranked.slice(0, Math.min(eliteCount, ranked.length)).map(row => makeStrategy(row.id, clone(row.strategyWeights)));
  const baseline = makeStrategy("baseline", characterBaseWeights(character));
  const next = [baseline, ...elites].slice(0, size).map((strategy, index) => makeStrategy(index === 0 ? "baseline" : index === 1 ? "champion" : `elite-${index - 1}`, clone(strategy.strategyWeights)));
  while (next.length < size) {
    const left = elites[rng.int(elites.length)];
    const right = elites[rng.int(elites.length)];
    next.push(crossoverStrategy(`${character.id}-gen-${next.length}-${Math.floor(rng.next() * 1e9)}`, left, right, rng));
  }
  return next;
}

function strategySignature(strategyWeights) {
  return JSON.stringify(weightsToVector(strategyWeights).map(value => round(value, 3)));
}

function updateTopRows(pool, ranked, topCount) {
  const bySignature = new Map(pool.map(row => [strategySignature(row.strategyWeights), row]));
  ranked.forEach(row => {
    const signature = strategySignature(row.strategyWeights);
    const existing = bySignature.get(signature);
    if (!existing || compareRankRows(row, existing) < 0) bySignature.set(signature, row);
  });
  return [...bySignature.values()].sort(compareRankRows).slice(0, topCount);
}

function topSpread(rows, topCount) {
  if (rows.length < topCount) return null;
  const decisiveRows = rows.slice(0, topCount).filter(row => row.decisiveGames > 0);
  if (decisiveRows.length < topCount) return null;
  const rates = decisiveRows.map(row => row.decisiveWinRate);
  return round(Math.max(...rates) - Math.min(...rates));
}

function convergenceStatus(characters, topByCharacter, topCount, threshold, maxDrawRate = null) {
  const byCharacter = characters.map(character => {
    const rows = topByCharacter.get(character.id) || [];
    const topRows = rows.slice(0, topCount);
    const spread = topSpread(rows, topCount);
    const drawRateOk = maxDrawRate === null
      ? true
      : topRows.length >= topCount && topRows.every(row => row.drawRate < maxDrawRate);
    return {
      characterId: character.id,
      characterName: character.name,
      topCount: Math.min(rows.length, topCount),
      spread,
      maxDrawRate: topRows.length ? round(Math.max(...topRows.map(row => row.drawRate))) : null,
      drawRateOk,
      converged: spread !== null && spread <= threshold && drawRateOk
    };
  });
  return {
    converged: byCharacter.every(row => row.converged),
    byCharacter
  };
}

function zeros(length) {
  return Array.from({ length }, () => 0);
}

function identity(size) {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => row === col ? 1 : 0));
}

function gaussian(rng) {
  const u1 = Math.max(Number.EPSILON, rng.next());
  const u2 = Math.max(Number.EPSILON, rng.next());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function cholesky(matrix) {
  const size = matrix.length;
  const lower = Array.from({ length: size }, () => zeros(size));
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      let sum = matrix[row][col];
      for (let k = 0; k < col; k += 1) sum -= lower[row][k] * lower[col][k];
      if (row === col) lower[row][col] = Math.sqrt(Math.max(sum, 1e-8));
      else lower[row][col] = sum / Math.max(lower[col][col], 1e-8);
    }
  }
  return lower;
}

function multiplyLower(lower, vector) {
  return lower.map((row, rowIndex) => {
    let sum = 0;
    for (let col = 0; col <= rowIndex; col += 1) sum += row[col] * vector[col];
    return sum;
  });
}

function addVectors(left, right) {
  return left.map((value, index) => value + right[index]);
}

function scaleVector(vector, scale) {
  return vector.map(value => value * scale);
}

function clampVector(vector) {
  return vector.map(clampWeight);
}

function makeCmaState(centerWeights, populationSize, rng) {
  const dimension = tunedKeys.length;
  const lambda = Math.max(4, populationSize);
  const mu = Math.max(2, Math.floor(lambda / 2));
  const weights = Array.from({ length: mu }, (_, index) => Math.log(mu + 0.5) - Math.log(index + 1));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const recombinationWeights = weights.map(value => value / weightTotal);
  return {
    mean: weightsToVector(centerWeights),
    covariance: identity(dimension),
    sigma: CMA_INITIAL_SIGMA,
    lambda,
    mu,
    recombinationWeights,
    generation: 0,
    rng
  };
}

function sampleCmaPopulation(state, prefix) {
  const lower = cholesky(state.covariance);
  return Array.from({ length: state.lambda }, (_, index) => {
    const z = zeros(state.mean.length).map(() => gaussian(state.rng));
    const step = multiplyLower(lower, z);
    const vector = clampVector(addVectors(state.mean, scaleVector(step, state.sigma)));
    return {
      id: `${prefix}-g${state.generation}-c${index}`,
      vector,
      step,
      strategyWeights: vectorToWeights(vector)
    };
  });
}

function updateCmaState(state, ranked) {
  const selected = ranked.slice(0, state.mu);
  const previousMean = state.mean;
  const nextMean = zeros(previousMean.length);
  selected.forEach((candidate, index) => {
    const weight = state.recombinationWeights[index];
    candidate.vector.forEach((value, vectorIndex) => {
      nextMean[vectorIndex] += value * weight;
    });
  });

  const covariance = Array.from({ length: previousMean.length }, () => zeros(previousMean.length));
  selected.forEach((candidate, index) => {
    const weight = state.recombinationWeights[index];
    const diff = candidate.vector.map((value, vectorIndex) => (value - previousMean[vectorIndex]) / Math.max(state.sigma, 1e-8));
    for (let row = 0; row < diff.length; row += 1) {
      for (let col = 0; col < diff.length; col += 1) covariance[row][col] += weight * diff[row] * diff[col];
    }
  });

  const inertia = 0.72;
  const learningRate = 0.28;
  state.covariance = state.covariance.map((row, rowIndex) => row.map((value, colIndex) => {
    const diagonalJitter = rowIndex === colIndex ? 1e-5 : 0;
    return inertia * value + learningRate * covariance[rowIndex][colIndex] + diagonalJitter;
  }));
  state.mean = clampVector(nextMean);
  const best = selected[0];
  const middle = ranked[Math.min(ranked.length - 1, Math.floor(ranked.length / 2))];
  const improving = best && middle && compareRankRows(best, middle) < 0;
  state.sigma = Math.max(CMA_MIN_SIGMA, Math.min(0.9, state.sigma * (improving ? 1.03 : 0.86)));
  state.generation += 1;
}

function baselineHighStrategy(character) {
  return makeStrategy("baseline-high", characterBaseWeights(character));
}

function evaluateCandidateAgainstBaseline({ balance, character, candidate, baseline, runs, seed, round, phase }) {
  const scores = new Map([[candidate.id, emptyScore(candidate)]]);
  for (let index = 0; index < runs; index += 1) {
    const candidateIsPlayer = index % 2 === 0;
    const match = simulateMatch({
      balance,
      playerCharacter: character,
      computerCharacter: character,
      playerModel: makePolicyFromWeights(candidateIsPlayer ? candidate : baseline, character.id),
      computerModel: makePolicyFromWeights(candidateIsPlayer ? baseline : candidate, character.id),
      seed: `${seed}:${character.id}:round-${round}:${phase}:candidate-${candidate.id}:match-${index}`
    });
    const candidateFighter = candidateIsPlayer ? match.player : match.computer;
    const baselineFighter = candidateIsPlayer ? match.computer : match.player;
    if (!match.winner) {
      recordResult(scores, candidate, "draw", match.durationMs, metricsFor(candidateFighter, baselineFighter));
    } else {
      const candidateWon = candidateIsPlayer ? match.winner === "player" : match.winner === "computer";
      recordResult(scores, candidate, candidateWon ? "win" : "loss", match.durationMs, metricsFor(candidateFighter, baselineFighter));
    }
  }
  return finalizeScores(scores)[0];
}

function mergeScoreRows(primary, extra) {
  const strategy = makeStrategy(primary.id, primary.strategyWeights);
  const scores = new Map([[primary.id, emptyScore(strategy)]]);
  const target = scores.get(primary.id);
  [primary, extra].forEach(row => {
    target.games += row.games;
    target.wins += row.wins;
    target.losses += row.losses;
    target.draws += row.draws;
    target.score += row.score;
    target.outcomeScore += row.outcomeScore;
    target.advantageScore += row.advantageScore;
    target.totalDurationMs += row.totalDurationMs;
    target.totalScoreDiff += row.totalScoreDiff;
    target.totalHpDiff += row.totalHpDiff;
    target.totalDamageDiff += row.totalDamageDiff;
    target.totalFoodDiff += row.totalFoodDiff;
  });
  return finalizeScores(scores)[0];
}

function evaluateCmaCharacterRound({ balance, character, candidates, mirrorRuns, seed, round, playoffCount }) {
  const baseline = baselineHighStrategy(character);
  const quickRuns = Math.max(2, Math.floor(mirrorRuns * 0.35));
  const playoffRuns = Math.max(0, mirrorRuns - quickRuns);
  const quickRanked = candidates.map(candidate => ({
    ...evaluateCandidateAgainstBaseline({ balance, character, candidate, baseline, runs: quickRuns, seed, round, phase: "quick" }),
    id: candidate.id,
    vector: candidate.vector,
    strategyWeights: candidate.strategyWeights
  })).sort(compareRankRows);
  const finalists = new Set(quickRanked.slice(0, Math.max(1, playoffCount)).map(row => row.id));
  return quickRanked.map(row => {
    if (!finalists.has(row.id) || playoffRuns <= 0) return { ...row, phase: "quick" };
    const candidate = candidates.find(item => item.id === row.id);
    const extra = evaluateCandidateAgainstBaseline({ balance, character, candidate, baseline, runs: playoffRuns, seed, round, phase: "playoff" });
    return { ...mergeScoreRows(row, extra), id: row.id, vector: row.vector, strategyWeights: row.strategyWeights, phase: "playoff" };
  }).sort(compareRankRows);
}

function averageWeights(rows) {
  const vector = zeros(tunedKeys.length);
  rows.forEach(row => {
    weightsToVector(row.strategyWeights).forEach((value, index) => {
      vector[index] += value / rows.length;
    });
  });
  return vectorToWeights(vector);
}

function evaluateUniversalStrategy({ balance, characters, strategy, mirrorRuns, seed }) {
  const rows = characters.map(character => {
    const candidate = makeStrategy(`universal:${strategy.id}`, strategy.strategyWeights);
    const baseline = baselineHighStrategy(character);
    return {
      ...evaluateCandidateAgainstBaseline({
        balance,
        character,
        candidate,
        baseline,
        runs: mirrorRuns,
        seed,
        round: "final",
        phase: "universal"
      }),
      characterId: character.id,
      characterName: character.name
    };
  });
  const totals = rows.reduce((acc, row) => {
    acc.games += row.games;
    acc.wins += row.wins;
    acc.losses += row.losses;
    acc.draws += row.draws;
    acc.score += row.score;
    acc.outcomeScore += row.outcomeScore;
    acc.advantageScore += row.advantageScore;
    acc.totalDurationMs += row.totalDurationMs;
    acc.totalScoreDiff += row.totalScoreDiff;
    acc.totalHpDiff += row.totalHpDiff;
    acc.totalDamageDiff += row.totalDamageDiff;
    acc.totalFoodDiff += row.totalFoodDiff;
    return acc;
  }, emptyScore(strategy));
  totals.id = strategy.id;
  totals.strategyWeights = strategy.strategyWeights;
  return {
    ...finalizeScores(new Map([[strategy.id, totals]]))[0],
    characterId: "universal",
    characterName: "Universal high AI",
    perCharacter: rows
  };
}

function rankRowsToCsv(rows) {
  const header = [
    "rank",
    "characterId",
    "strategyId",
    "games",
    "wins",
    "losses",
    "draws",
    "drawRate",
    "winRate",
    "outcomeWinRate",
    "decisiveGames",
    "decisiveWinRate",
    "advantageScore",
    "averageScoreDiff",
    "averageHpDiff",
    "averageDamageDiff",
    "averageFoodDiff",
    "averageDurationMs",
    "strategyWeights"
  ];
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
      row.drawRate,
      row.winRate,
      row.outcomeWinRate,
      row.decisiveGames,
      row.decisiveWinRate,
      row.advantageScore,
      row.averageScoreDiff,
      row.averageHpDiff,
      row.averageDamageDiff,
      row.averageFoodDiff,
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
  const algorithm = options.algorithm || DEFAULT_ALGORITHM;
  const durationHours = Number(options.durationHours ?? DEFAULT_DURATION_HOURS);
  const mirrorRuns = Math.max(1, Math.floor(Number(options.mirrorRuns ?? 1000)));
  const populationSize = Math.max(algorithm === "cma-es" ? 4 : 2, Math.floor(Number(options.populationSize ?? DEFAULT_POPULATION_SIZE)));
  const eliteCount = Math.max(1, Math.min(populationSize, Math.floor(Number(options.eliteCount ?? DEFAULT_ELITE_COUNT))));
  const topCount = Math.max(1, Math.floor(Number(options.topCount ?? DEFAULT_TOP_COUNT)));
  const convergenceThreshold = Number(options.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD);
  const maxDrawRate = options.maxDrawRate === undefined ? null : Number(options.maxDrawRate);
  const minRounds = Math.max(1, Math.floor(Number(options.minRounds ?? DEFAULT_MIN_ROUNDS)));
  const maxRounds = options.maxRounds === undefined ? null : Math.max(1, Math.floor(Number(options.maxRounds)));
  const stopOnConvergence = Boolean(options.stopOnConvergence);
  const outputDir = options.outputDir || path.join(reportsDir, buildRunId(seed));
  const rng = createRng(seed);
  const deadlineMs = Date.now() + durationHours * 60 * 60 * 1000;
  const populations = new Map(characters.map(character => [character.id, seedPopulation(character, rng, populationSize)]));
  const cmaStates = new Map(characters.map(character => [character.id, makeCmaState(characterBaseWeights(character), populationSize, createRng(`${seed}:cma:${character.id}`))]));
  const history = [];
  const bestByCharacter = new Map();
  const topByCharacter = new Map(characters.map(character => [character.id, []]));
  const playoffCount = Math.max(1, Math.min(eliteCount, Math.floor(populationSize / 2)));
  let round = 0;
  let convergence = convergenceStatus(characters, topByCharacter, topCount, convergenceThreshold, maxDrawRate);
  let stopReason = "duration";

  ensureDir(outputDir);

  do {
    round += 1;
    for (const character of characters) {
      let ranked;
      if (algorithm === "cma-es") {
        const state = cmaStates.get(character.id);
        const warmStart = [
          makeVectorStrategy(`${character.id}-baseline`, characterBaseWeights(character)),
          ...(round === 1
            ? [makeVectorStrategy(`${character.id}-warm-1`, randomStrategy(`${character.id}-warm-1`, rng, characterBaseWeights(character), 0.25).strategyWeights)]
            : [])
        ];
        const sampled = sampleCmaPopulation(state, character.id);
        const candidates = [...warmStart, ...sampled].slice(0, populationSize);
        ranked = evaluateCmaCharacterRound({
          balance,
          character,
          candidates,
          mirrorRuns,
          seed,
          round,
          playoffCount
        }).map(row => ({ ...row, characterId: character.id, characterName: character.name, round }));
        updateCmaState(state, ranked.filter(row => row.vector));
      } else {
        ranked = evaluateCharacterRound({
          balance,
          character,
          population: populations.get(character.id),
          mirrorRuns,
          seed,
          round
        }).map(row => ({ ...row, characterId: character.id, characterName: character.name, round }));
      }
      writeJson(path.join(outputDir, `${character.id}-round-${round}-ranking.json`), ranked);
      writeCsv(path.join(outputDir, `${character.id}-round-${round}-ranking.csv`), rankRowsToCsv(ranked));
      const currentBest = bestByCharacter.get(character.id);
      if (!currentBest || compareRankRows(ranked[0], currentBest) < 0) {
        bestByCharacter.set(character.id, ranked[0]);
      }
      const topRows = updateTopRows(topByCharacter.get(character.id), ranked, topCount);
      topByCharacter.set(character.id, topRows);
      history.push({
        round,
        characterId: character.id,
        mirrorRuns,
        best: ranked[0],
        topSpread: topSpread(topRows, topCount),
        completedAt: new Date().toISOString()
      });
      if (algorithm === "ga") populations.set(character.id, nextPopulation(character, ranked, rng, populationSize, eliteCount));
    }
    convergence = convergenceStatus(characters, topByCharacter, topCount, convergenceThreshold, maxDrawRate);
    writeJson(path.join(outputDir, "history.json"), history);
    writeJson(path.join(outputDir, "top-strategies.json"), Object.fromEntries([...topByCharacter.entries()]));
    writeCsv(path.join(outputDir, "top-strategies.csv"), rankRowsToCsv(characters.flatMap(character =>
      (topByCharacter.get(character.id) || []).map(row => ({
        ...row,
        characterId: character.id,
        characterName: character.name
      }))
    )));
    if (stopOnConvergence && round >= minRounds && convergence.converged) {
      stopReason = "converged";
      break;
    }
    if (maxRounds && round >= maxRounds) {
      stopReason = "max-rounds";
      break;
    }
  } while (Date.now() < deadlineMs);

  const bestStrategies = characters.map(character => {
    const best = bestByCharacter.get(character.id);
    return {
      characterId: character.id,
      characterName: character.name,
      strategyId: best.id,
      winRate: best.winRate,
      outcomeWinRate: best.outcomeWinRate,
      drawRate: best.drawRate,
      decisiveGames: best.decisiveGames,
      decisiveWinRate: best.decisiveWinRate,
      advantageScore: best.advantageScore,
      averageScoreDiff: best.averageScoreDiff,
      averageHpDiff: best.averageHpDiff,
      averageDamageDiff: best.averageDamageDiff,
      averageFoodDiff: best.averageFoodDiff,
      games: best.games,
      wins: best.wins,
      losses: best.losses,
      draws: best.draws,
      strategyWeights: best.strategyWeights
    };
  });
  const universalBest = evaluateUniversalStrategy({
    balance,
    characters,
    strategy: makeStrategy("universal-average", averageWeights(bestStrategies)),
    mirrorRuns,
    seed
  });
  bestStrategies.push({
    characterId: universalBest.characterId,
    characterName: universalBest.characterName,
    strategyId: universalBest.id,
    winRate: universalBest.winRate,
    outcomeWinRate: universalBest.outcomeWinRate,
    drawRate: universalBest.drawRate,
    decisiveGames: universalBest.decisiveGames,
    decisiveWinRate: universalBest.decisiveWinRate,
    advantageScore: universalBest.advantageScore,
    averageScoreDiff: universalBest.averageScoreDiff,
    averageHpDiff: universalBest.averageHpDiff,
    averageDamageDiff: universalBest.averageDamageDiff,
    averageFoodDiff: universalBest.averageFoodDiff,
    games: universalBest.games,
    wins: universalBest.wins,
    losses: universalBest.losses,
    draws: universalBest.draws,
    strategyWeights: universalBest.strategyWeights,
    perCharacter: universalBest.perCharacter
  });
  const manifest = {
    id: path.basename(outputDir),
    status: "completed",
    seed,
    algorithm,
    durationHours,
    mirrorRuns,
    populationSize,
    eliteCount,
    playoffCount,
    topCount,
    convergenceThreshold,
    maxDrawRate,
    minRounds,
    maxRounds,
    stopOnConvergence,
    rounds: round,
    stopReason,
    convergence,
    generatedAt: new Date().toISOString(),
    outputs: {
      directory: outputDir,
      history: path.join(outputDir, "history.json"),
      bestStrategies: path.join(outputDir, "best-strategies.json"),
      topStrategies: path.join(outputDir, "top-strategies.json")
    }
  };
  writeJson(path.join(outputDir, "best-strategies.json"), bestStrategies);
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  writeCsv(path.join(outputDir, "best-strategies.csv"), rankRowsToCsv(bestStrategies.map(row => ({ ...row, id: row.strategyId, averageDurationMs: "" }))));
  return { manifest, bestStrategies, topStrategies: Object.fromEntries([...topByCharacter.entries()]), history };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runSearch({
    algorithm: algorithmArg(args),
    seed: stringArg(args, "seed", `ai-strategy-${stamp()}`),
    durationHours: numberArg(args, "duration-hours", DEFAULT_DURATION_HOURS),
    mirrorRuns: numberArg(args, "mirror-runs", 1000),
    populationSize: numberArg(args, "population-size", DEFAULT_POPULATION_SIZE),
    eliteCount: numberArg(args, "elite-count", DEFAULT_ELITE_COUNT),
    topCount: optionalPositiveIntegerArg(args, "top-count", DEFAULT_TOP_COUNT),
    convergenceThreshold: numberArg(args, "convergence-threshold", DEFAULT_CONVERGENCE_THRESHOLD),
    maxDrawRate: args["max-draw-rate"] === undefined ? undefined : numberArg(args, "max-draw-rate", undefined),
    minRounds: optionalPositiveIntegerArg(args, "min-rounds", DEFAULT_MIN_ROUNDS),
    maxRounds: optionalPositiveIntegerArg(args, "max-rounds", undefined),
    stopOnConvergence: Boolean(args["stop-on-convergence"])
  });
  console.log(`Manifest: ${result.manifest.outputs.directory}\\manifest.json`);
  console.log(`Stop reason: ${result.manifest.stopReason}`);
  result.bestStrategies.forEach(row => {
    console.log(`${row.characterId}: ${(row.decisiveWinRate * 100).toFixed(2)}% decisive (${row.wins}/${row.wins + row.losses}), ${(row.winRate * 100).toFixed(2)}% scored (${row.wins}/${row.games})`);
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
  evaluateCmaCharacterRound,
  convergenceStatus,
  runSearch,
  seedPopulation
};
