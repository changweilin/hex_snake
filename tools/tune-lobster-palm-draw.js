#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  buildCharacterMap,
  createRng,
  loadBalance,
  loadCharacters,
  simulateMatch
} = require("./sim-core");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const LOBSTER_ID = "lobster";
const TARGET_DRAW_RATE = 0.1;

const tunables = [
  { key: "fistStepMs", label: "palm-speed", stronger: "lower", phase50: 1 / 1.5, phase100: 0.5 },
  { key: "contactDamageMultiplier", label: "palm-contact-damage", stronger: "higher", phase50: 1.5, phase100: 2 },
  { key: "burstDamageMultiplier", label: "palm-burst-damage", stronger: "higher", phase50: 1.5, phase100: 2 },
  { key: "burstRadiusMultiplier", label: "palm-burst-radius", stronger: "higher", phase50: 1.5, phase100: 2 },
  { key: "contactRadius", label: "palm-contact-radius", stronger: "higher", phase50: 1.5, phase100: 2 }
];

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

function stringArg(args, key, fallback) {
  return args[key] === undefined ? fallback : String(args[key]);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, filePath), "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function modelFromStrategyWeights(row) {
  const strategyWeights = row.strategyWeights || row;
  const preferBig = strategyWeights.skillAllocation?.preferBig ?? 1;
  const preferSmall = strategyWeights.skillAllocation?.preferSmall ?? 1;
  return {
    aiDifficulty: "high",
    pathPrecision: 1,
    aimPrecision: 1,
    skillStrategy: preferBig > preferSmall * 1.2 ? "preferBig" : preferSmall > preferBig * 1.2 ? "spamSmall" : "balanced",
    foodStrategy: "balanced",
    strategyId: row.strategyId || row.id || "external-strategy",
    strategyWeights
  };
}

function baselineHighStrategy() {
  return {
    aiDifficulty: "high",
    pathPrecision: 1,
    aimPrecision: 1,
    skillStrategy: "balanced",
    foodStrategy: "balanced",
    strategyId: "baseline-high",
    strategyWeights: {
      movement: { safePath: 1.4, leastDamage: 1.1, fastestArrival: 1 },
      food: { fastestArrival: 1, ownDeficit: 0.9, opponentDeficit: 0.5, ownPreferred: 1.1, opponentPreferred: 0.4 },
      skillAllocation: { preferSmall: 1, preferBig: 1 },
      castTiming: { lethal: 3, nearFullEnergy: 0.8, opponentDebuffed: 1.1, opponentAlmostReady: 0.8, nearOpponent: 0.9, farOpponent: 0.4 }
    }
  };
}

function lobsterRowsFromStrategyFile(strategyFile) {
  if (!strategyFile) return [];
  if (Array.isArray(strategyFile.lobster)) return strategyFile.lobster.slice(0, 5);
  const rows = Array.isArray(strategyFile) ? strategyFile : strategyFile.bestStrategies || strategyFile.strategies || [];
  return rows.filter(row => row.characterId === LOBSTER_ID).slice(0, 5);
}

function lobsterPalmSettings(balance) {
  return clone(balance.attack.ultimates.lobster);
}

function withLobsterPalmSettings(balance, settings) {
  const next = clone(balance);
  next.attack.ultimates.lobster = { ...next.attack.ultimates.lobster, ...settings };
  return next;
}

function candidateSettings(original, current, phaseKey, includeAll = false) {
  const candidates = [];
  const keys = includeAll ? tunables : [tunables[0]];
  keys.forEach(tunable => {
    const next = { ...current };
    next[tunable.key] = round(original[tunable.key] * tunable[phaseKey]);
    candidates.push({
      id: `${tunable.label}-${phaseKey}`,
      changed: [tunable.key],
      settings: next
    });
  });
  if (includeAll) {
    const combined = { ...current };
    keys.forEach(tunable => {
      combined[tunable.key] = round(original[tunable.key] * tunable[phaseKey]);
    });
    candidates.push({ id: `all-${phaseKey}`, changed: keys.map(tunable => tunable.key), settings: combined });
  }
  return candidates;
}

function fullCandidateSettings(original) {
  const levels = [
    { name: "original", values: Object.fromEntries(tunables.map(tunable => [tunable.key, original[tunable.key]])) },
    ...tunables.flatMap(tunable => ([
      {
        name: `${tunable.label}-phase50`,
        values: { [tunable.key]: round(original[tunable.key] * tunable.phase50) }
      },
      {
        name: `${tunable.label}-phase100`,
        values: { [tunable.key]: round(original[tunable.key] * tunable.phase100) }
      }
    ]))
  ];
  const perTunableLevels = tunables.map(tunable => ([
    { suffix: "base", value: original[tunable.key] },
    { suffix: "50", value: round(original[tunable.key] * tunable.phase50) },
    { suffix: "100", value: round(original[tunable.key] * tunable.phase100) }
  ]));
  const combined = [];
  function visit(index, settings, suffixes) {
    if (index === tunables.length) {
      const changed = tunables.filter(tunable => settings[tunable.key] !== original[tunable.key]).map(tunable => tunable.key);
      combined.push({
        id: changed.length ? `combo-${suffixes.join("-")}` : "original",
        changed,
        settings: { ...original, ...settings }
      });
      return;
    }
    const tunable = tunables[index];
    perTunableLevels[index].forEach(level => {
      visit(index + 1, { ...settings, [tunable.key]: level.value }, [...suffixes, `${tunable.label}:${level.suffix}`]);
    });
  }
  visit(0, {}, []);

  const priority = levels.map(level => ({ id: level.name, changed: Object.keys(level.values), settings: { ...original, ...level.values } }));
  const byKey = new Map();
  [...priority, ...combined].forEach(candidate => {
    const key = JSON.stringify(candidate.settings);
    if (!byKey.has(key)) byKey.set(key, candidate);
  });
  return [...byKey.values()];
}

function evaluateSettings({ balance, character, strategies, baseline, runs, seed, settings }) {
  const tunedBalance = withLobsterPalmSettings(balance, settings);
  const totals = {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    decisiveGames: 0,
    drawRate: 0,
    decisiveWinRate: 0,
    averageDurationMs: 0,
    totalDurationMs: 0
  };
  const pool = strategies.length ? strategies : [{ id: "baseline-high", strategyWeights: baseline.strategyWeights }];
  for (let index = 0; index < runs; index += 1) {
    const candidateRow = pool[index % pool.length];
    const candidateModel = modelFromStrategyWeights(candidateRow);
    const candidateIsPlayer = index % 2 === 0;
    const match = simulateMatch({
      balance: tunedBalance,
      playerCharacter: character,
      computerCharacter: character,
      playerModel: candidateIsPlayer ? candidateModel : baseline,
      computerModel: candidateIsPlayer ? baseline : candidateModel,
      seed: `${seed}:${JSON.stringify(settings)}:${candidateRow.id || candidateRow.strategyId || "strategy"}:${index}`
    });
    totals.games += 1;
    totals.totalDurationMs += match.durationMs;
    if (!match.winner) totals.draws += 1;
    else {
      const candidateWon = candidateIsPlayer ? match.winner === "player" : match.winner === "computer";
      if (candidateWon) totals.wins += 1;
      else totals.losses += 1;
    }
  }
  totals.decisiveGames = totals.wins + totals.losses;
  totals.drawRate = totals.games ? round(totals.draws / totals.games) : 0;
  totals.decisiveWinRate = totals.decisiveGames ? round(totals.wins / totals.decisiveGames) : 0;
  totals.averageDurationMs = totals.games ? round(totals.totalDurationMs / totals.games, 2) : 0;
  return totals;
}

function compareRows(a, b) {
  return a.drawRate - b.drawRate
    || b.decisiveGames - a.decisiveGames
    || b.decisiveWinRate - a.decisiveWinRate
    || a.averageDurationMs - b.averageDurationMs;
}

function runSearch(options = {}) {
  const balance = options.balance || loadBalance(root);
  const characters = options.characters || loadCharacters(root);
  const character = buildCharacterMap(characters).get(LOBSTER_ID);
  const seed = String(options.seed || `lobster-palm-draw-${stamp()}`);
  const runs = Math.max(1, Math.floor(Number(options.runs ?? 1000)));
  const targetDrawRate = Number(options.targetDrawRate ?? TARGET_DRAW_RATE);
  const durationHours = Number(options.durationHours ?? 8);
  const outputDir = options.outputDir || path.join(reportsDir, `lobster-palm-draw-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
  const strategyFile = options.strategyFile ? readJson(options.strategyFile) : null;
  const strategies = lobsterRowsFromStrategyFile(strategyFile);
  const baseline = baselineHighStrategy();
  const deadlineMs = Date.now() + durationHours * 60 * 60 * 1000;
  const original = lobsterPalmSettings(balance);
  let current = { ...original };
  const history = [];
  let best = null;
  let round = 0;
  let stopReason = "duration";

  ensureDir(outputDir);
  const candidates = fullCandidateSettings(original);
  for (const candidate of candidates) {
    if (Date.now() >= deadlineMs) break;
    round += 1;
    const row = {
      ...candidate,
      ...evaluateSettings({ balance, character, strategies, baseline, runs, seed: `${seed}:candidate-${round}`, settings: candidate.settings })
    };
    if (!best || compareRows(row, best) < 0) {
      best = row;
      current = { ...row.settings };
    }
    history.push({ round, candidate: row, best, completedAt: new Date().toISOString() });
    writeJson(path.join(outputDir, "history.json"), history);
    writeJson(path.join(outputDir, "best.json"), best);
    console.log(`candidate ${round}/${candidates.length}: draw ${(row.drawRate * 100).toFixed(2)}%, best ${(best.drawRate * 100).toFixed(2)}%, ${row.id}`);
    if (best.drawRate <= targetDrawRate) {
      stopReason = "target-draw-rate";
      break;
    }
  }
  if (stopReason === "duration" && Date.now() < deadlineMs) stopReason = "candidate-space-exhausted";

  const manifest = {
    id: path.basename(outputDir),
    status: "completed",
    seed,
    runs,
    targetDrawRate,
    durationHours,
    rounds: round,
    stopReason,
    original,
    current,
    best,
    strategyCount: strategies.length,
    generatedAt: new Date().toISOString(),
    outputs: {
      directory: outputDir,
      history: path.join(outputDir, "history.json"),
      best: path.join(outputDir, "best.json")
    }
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  return { manifest, best, history };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runSearch({
    seed: stringArg(args, "seed", `lobster-palm-draw-${stamp()}`),
    runs: numberArg(args, "runs", 1000),
    targetDrawRate: numberArg(args, "target-draw-rate", TARGET_DRAW_RATE),
    durationHours: numberArg(args, "duration-hours", 8),
    strategyFile: stringArg(args, "strategy-file", "")
  });
  console.log(`Manifest: ${result.manifest.outputs.directory}\\manifest.json`);
  console.log(`Stop reason: ${result.manifest.stopReason}`);
  console.log(`Best draw rate: ${(result.best.drawRate * 100).toFixed(2)}%`);
  console.log(JSON.stringify(result.best.settings));
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
  candidateSettings,
  evaluateSettings,
  runSearch
};
