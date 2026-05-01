#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  buildCharacterMap,
  loadBalance,
  loadCharacters,
  simulateMatch
} = require("./sim-core");
const {
  createSchedule,
  difficulties,
  difficultyPresets,
  summarizeMatches
} = require("./sim-scheduler");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const TARGET_MIN_WIN_RATE = 0.4;

const tunables = [
  { path: ["attack", "baseBlastHexRadius"], direction: "higher-is-stronger" },
  { path: ["attack", "damageBonusPerPoint"], direction: "higher-is-stronger" },
  { path: ["attack", "proteinRangeBonusPerPoint"], direction: "higher-is-stronger" },
  { path: ["movement", "moveBonusPerPoint"], direction: "higher-is-stronger" },
  { path: ["attack", "attackSpeedBonusPerPoint"], direction: "higher-is-stronger" },
  { path: ["attack", "baseAttackDelayMs"], direction: "lower-is-stronger" },
  { path: ["attack", "baseAttackCooldownMs"], direction: "lower-is-stronger" }
];

const characterPrimaryTunables = {
  dragon: [
    ["attack", "baseBlastHexRadius"],
    ["attack", "baseAttackCooldownMs"],
    ["attack", "damageBonusPerPoint"]
  ],
  sandworm: [["attack", "damageBonusPerPoint"], ["attack", "baseAttackDelayMs"]],
  quetzal: [["movement", "moveBonusPerPoint"]],
  moray: [["attack", "attackSpeedBonusPerPoint"], ["attack", "baseAttackCooldownMs"]],
  lobster: [["attack", "proteinRangeBonusPerPoint"], ["attack", "baseBlastHexRadius"]],
  gu_king: [
    ["attack", "baseAttackCooldownMs"],
    ["attack", "baseBlastHexRadius"],
    ["attack", "damageBonusPerPoint"]
  ]
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
  if (!Number.isFinite(value)) throw new Error(`--${key} must be numeric.`);
  return value;
}

function stringArg(args, key, fallback) {
  return args[key] === undefined ? fallback : String(args[key]);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readValue(object, pathParts) {
  return pathParts.reduce((value, key) => value?.[key], object);
}

function writeValue(object, pathParts, value) {
  let cursor = object;
  pathParts.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[pathParts[pathParts.length - 1]] = value;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundValue(value, original) {
  const precision = Math.abs(original) >= 100 ? 0 : Math.abs(original) >= 1 ? 6 : 8;
  return Number(value.toFixed(precision));
}

function clampCandidate(value, original) {
  const low = original * 0.5;
  const high = original * 1.5;
  return Math.min(Math.max(value, Math.min(low, high)), Math.max(low, high));
}

function pathKey(pathParts) {
  return pathParts.join(".");
}

function makeBounds(originalBalance) {
  return new Map(tunables.map(tunable => {
    const original = readValue(originalBalance, tunable.path);
    if (!Number.isFinite(original)) throw new Error(`Missing numeric tunable: ${pathKey(tunable.path)}`);
    return [pathKey(tunable.path), { ...tunable, original }];
  }));
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function parseDeadline(value, now = new Date()) {
  const text = String(value || "08:00");
  const timeOnly = text.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const deadline = new Date(now);
    deadline.setHours(Number(timeOnly[1]), Number(timeOnly[2] || 0), 0, 0);
    return deadline;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error("--deadline must be HH:mm or an ISO date.");
  return parsed;
}

function normalizeMatchRecord(entry, match) {
  const winnerCharacterId = match.winner ? match[match.winner].characterId : null;
  const loserCharacterId = match.loser ? match[match.loser].characterId : null;
  return {
    cycle: entry.cycle,
    difficulty: entry.difficulty,
    pair: entry.pair,
    playerCharacterId: entry.playerCharacterId,
    computerCharacterId: entry.computerCharacterId,
    winnerCharacterId,
    loserCharacterId,
    fatalCause: match.fatalCause,
    topDamageCause: match.topDamageCause,
    durationMs: match.durationMs,
    player: match.player,
    computer: match.computer,
    seed: match.seed
  };
}

function runBatch({ balance, characters, cycles, seed, batch }) {
  const characterById = buildCharacterMap(characters);
  const schedule = createSchedule(characters, cycles);
  const matches = [];
  schedule.forEach((entry, index) => {
    const policy = difficultyPresets[entry.difficulty];
    const match = simulateMatch({
      balance,
      playerCharacter: characterById.get(entry.playerCharacterId),
      computerCharacter: characterById.get(entry.computerCharacterId),
      playerModel: policy,
      computerModel: policy,
      seed: `${seed}:batch-${batch}:${entry.cycle}:${entry.difficulty}:${entry.pair.join("-")}:${index}`
    });
    matches.push(normalizeMatchRecord(entry, match));
  });
  const summary = summarizeMatches(matches, characters);
  return { matches, summary, scheduleLength: schedule.length };
}

function findWeakRows(characterDifficulty) {
  return characterDifficulty
    .filter(row => row.runs > 0 && row.winRate < TARGET_MIN_WIN_RATE)
    .sort((a, b) => a.winRate - b.winRate);
}

function findStrongRows(characterDifficulty) {
  return characterDifficulty
    .filter(row => row.runs > 0 && row.winRate > 0.6)
    .sort((a, b) => b.winRate - a.winRate);
}

function metricAverage(rows, characterId) {
  const characterRows = rows.filter(row => row.characterId === characterId);
  if (!characterRows.length) return 0;
  return characterRows.reduce((sum, row) => sum + row.winRate, 0) / characterRows.length;
}

function chooseAdjustmentPaths(summary) {
  const weakRows = findWeakRows(summary.characterDifficulty);
  const strongRows = findStrongRows(summary.characterDifficulty);
  const weakCharacterIds = new Set(weakRows.map(row => row.characterId));
  const paths = [];

  weakRows.forEach(row => {
    const preferred = characterPrimaryTunables[row.characterId] || [];
    preferred.forEach(pathParts => paths.push({ path: pathParts, reason: `${row.characterId}/${row.difficulty} weak ${row.winRate.toFixed(3)}`, intent: "buff" }));
  });

  const strongestWithoutWeakDifficulty = strongRows.find(row => !weakCharacterIds.has(row.characterId));
  if (weakRows.length >= 2 && strongestWithoutWeakDifficulty) {
    const strongest = strongestWithoutWeakDifficulty;
    const preferred = characterPrimaryTunables[strongest.characterId] || [];
    preferred.slice(0, 2).forEach(pathParts => {
      paths.push({ path: pathParts, reason: `${strongest.characterId}/${strongest.difficulty} strong ${strongest.winRate.toFixed(3)}`, intent: "nerf" });
    });
  }

  return paths;
}

function adjustValue(current, bound, intent, pressure) {
  const step = Math.min(0.04, Math.max(0.01, pressure * 0.08));
  const strongerFactor = bound.direction === "lower-is-stronger" ? 1 - step : 1 + step;
  const weakerFactor = bound.direction === "lower-is-stronger" ? 1 + step : 1 - step;
  const factor = intent === "buff" ? strongerFactor : weakerFactor;
  return roundValue(clampCandidate(current * factor, bound.original), bound.original);
}

function applyAdjustments(balance, originalBalance, bounds, summary) {
  const nextBalance = deepClone(balance);
  const candidates = chooseAdjustmentPaths(summary);
  const changes = [];
  const seenThisRound = new Set();
  const worstWinRate = Math.min(...summary.characterDifficulty.filter(row => row.runs > 0).map(row => row.winRate));
  const pressure = Math.max(0.01, TARGET_MIN_WIN_RATE - worstWinRate);

  candidates.forEach(candidate => {
    const key = pathKey(candidate.path);
    if (seenThisRound.has(`${candidate.intent}:${key}`)) return;
    seenThisRound.add(`${candidate.intent}:${key}`);
    const bound = bounds.get(key);
    if (!bound) return;
    const before = readValue(nextBalance, candidate.path);
    const after = adjustValue(before, bound, candidate.intent, pressure);
    if (after === before) return;
    writeValue(nextBalance, candidate.path, after);
    changes.push({
      path: key,
      intent: candidate.intent,
      before,
      after,
      original: readValue(originalBalance, candidate.path),
      min: bound.original * 0.5,
      max: bound.original * 1.5,
      reason: candidate.reason
    });
  });

  return { nextBalance, changes };
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const header = Object.keys(rows[0]);
  const escape = value => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows.map(row => header.map(key => row[key]))]
    .map(row => row.map(escape).join(","))
    .join("\n");
}

function writeCsv(filePath, rows) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${rowsToCsv(rows)}\n`, "utf8");
}

function createRunId(seed) {
  const safeSeed = String(seed).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  return `tune-${stamp()}${safeSeed ? `-${safeSeed}` : ""}`;
}

function buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, candidatePath, outputDir, finalSummary, history }) {
  return {
    id: runId,
    status,
    generatedAt: new Date().toISOString(),
    config: {
      cyclesPerBatch,
      matchesPerBatch: cyclesPerBatch * createSchedule(characters, 1).length,
      targetMinWinRate: TARGET_MIN_WIN_RATE,
      deadline: deadline.toISOString(),
      seed
    },
    outputs: {
      candidate: candidatePath,
      directory: outputDir
    },
    finalWeakRows: finalSummary ? findWeakRows(finalSummary.characterDifficulty) : [],
    history
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const originalBalance = loadBalance(root);
  const characters = loadCharacters(root);
  const bounds = makeBounds(originalBalance);
  const cyclesPerBatch = Math.max(1, Math.floor(numberArg(args, "cycles", 100)));
  const maxBatches = Math.max(1, Math.floor(numberArg(args, "max-batches", Number.MAX_SAFE_INTEGER)));
  const seed = stringArg(args, "seed", `tune-${stamp()}`);
  const deadline = parseDeadline(stringArg(args, "deadline", "08:00"));
  const runId = stringArg(args, "run-id", createRunId(seed));
  const outputDir = path.join(reportsDir, runId);
  const candidatePath = path.join(outputDir, "balance-candidate.json");
  const manifestPath = path.join(outputDir, "manifest.json");
  const historyPath = path.join(outputDir, "history.json");
  const quiet = Boolean(args.quiet);

  ensureDir(outputDir);

  let balance = deepClone(originalBalance);
  const history = [];
  let status = "running";
  let batch = 0;
  let finalSummary = null;

  while (batch < maxBatches && Date.now() < deadline.getTime()) {
    batch += 1;
    const startedAt = new Date();
    const result = runBatch({ balance, characters, cycles: cyclesPerBatch, seed, batch });
    finalSummary = result.summary;
    const weakRows = findWeakRows(result.summary.characterDifficulty);
    const strongRows = findStrongRows(result.summary.characterDifficulty);
    const averages = characters.map(character => ({
      characterId: character.id,
      averageWinRate: Number(metricAverage(result.summary.characterDifficulty, character.id).toFixed(6))
    }));

    writeJson(path.join(outputDir, `batch-${batch}-character-difficulty.json`), result.summary.characterDifficulty);
    writeCsv(path.join(outputDir, `batch-${batch}-character-difficulty.csv`), result.summary.characterDifficulty);
    writeJson(path.join(outputDir, `batch-${batch}-matches.json`), result.matches);

    const completedAt = new Date();
    const historyEntry = {
      batch,
      cycles: cyclesPerBatch,
      matches: result.matches.length,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      deadline: deadline.toISOString(),
      pass: weakRows.length === 0,
      weakRows,
      strongRows,
      averages,
      changes: []
    };

    if (weakRows.length === 0) {
      status = "passed";
      history.push(historyEntry);
      writeJson(candidatePath, balance);
      writeJson(historyPath, history);
      writeJson(manifestPath, buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, candidatePath, outputDir, finalSummary, history }));
      if (!quiet) console.log(`Batch ${batch}: passed (${result.matches.length} matches).`);
      break;
    }

    const adjustment = applyAdjustments(balance, originalBalance, bounds, result.summary);
    balance = adjustment.nextBalance;
    historyEntry.changes = adjustment.changes;
    history.push(historyEntry);
    writeJson(candidatePath, balance);
    writeJson(historyPath, history);
    writeJson(manifestPath, buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, candidatePath, outputDir, finalSummary, history }));
    if (!quiet) {
      const worst = weakRows[0];
      console.log(`Batch ${batch}: worst ${worst.characterId}/${worst.difficulty} ${(worst.winRate * 100).toFixed(1)}%, changes ${adjustment.changes.length}.`);
    }
    if (!adjustment.changes.length) {
      status = "stalled";
      break;
    }
  }

  if (status === "running") {
    status = Date.now() >= deadline.getTime() ? "deadline" : "max-batches";
  }

  const manifest = buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, candidatePath, outputDir, finalSummary, history });

  writeJson(candidatePath, balance);
  writeJson(manifestPath, manifest);
  writeJson(historyPath, history);

  if (!quiet) {
    console.log(`Status: ${status}`);
    console.log(`Candidate: ${candidatePath}`);
    console.log(`Manifest: ${manifestPath}`);
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
  TARGET_MIN_WIN_RATE,
  adjustValue,
  applyAdjustments,
  clampCandidate,
  findWeakRows,
  parseDeadline,
  runBatch
};
