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
const TARGET_MIN_WIN_RATE = 0.48;
const TARGET_MAX_WIN_RATE = 0.52;

const tunables = [
  { path: ["attack", "ultimates", "dragon", "orbStepMs"], direction: "lower-is-stronger" },
  { path: ["attack", "ultimates", "lobster", "radiusMultiplier"], direction: "higher-is-stronger" },
  { path: ["attack", "ultimates", "sandworm", "damageMultiplier"], direction: "higher-is-stronger" },
  { path: ["attack", "ultimates", "quetzal", "damageMultiplier"], direction: "higher-is-stronger" },
  { path: ["attack", "ultimates", "moray", "damageMultiplier"], direction: "higher-is-stronger" },
  { path: ["attack", "ultimates", "gu_king", "damageMultiplier"], direction: "higher-is-stronger" }
];

const characterPrimaryTunables = {
  dragon: [["attack", "ultimates", "dragon", "orbStepMs"]],
  lobster: [["attack", "ultimates", "lobster", "radiusMultiplier"]],
  sandworm: [["attack", "ultimates", "sandworm", "damageMultiplier"]],
  quetzal: [["attack", "ultimates", "quetzal", "damageMultiplier"]],
  moray: [["attack", "ultimates", "moray", "damageMultiplier"]],
  gu_king: [["attack", "ultimates", "gu_king", "damageMultiplier"]]
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
  const low = Math.max(0.01, original * 0.1);
  const high = original * 10;
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

function parseDifficulties(value) {
  const selected = String(value || "medium")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
  selected.forEach(difficulty => {
    if (!difficulties.includes(difficulty)) throw new Error(`Unknown difficulty "${difficulty}". Available: ${difficulties.join(", ")}`);
  });
  return selected.length ? selected : ["medium"];
}

function runBatch({ balance, characters, cycles, seed, batch, selectedDifficulties = difficulties }) {
  const characterById = buildCharacterMap(characters);
  const schedule = createSchedule(characters, cycles)
    .filter(entry => selectedDifficulties.includes(entry.difficulty));
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

function rowBalanceRate(row) {
  if (Number.isFinite(row.decisiveWinRate) && row.wins + row.losses > 0) return row.decisiveWinRate;
  if (Number.isFinite(row.winRate)) return row.winRate;
  return 0;
}

function summarizeCharacterBalanceRows(summary) {
  const rows = new Map();
  summary.characterDifficulty.forEach(row => {
    if (!rows.has(row.characterId)) {
      rows.set(row.characterId, { characterId: row.characterId, runs: 0, wins: 0, losses: 0, draws: 0, winRate: 0, drawRate: 0, decisiveWinRate: 0 });
    }
    const target = rows.get(row.characterId);
    target.runs += row.runs || 0;
    target.wins += row.wins || 0;
    target.losses += row.losses || 0;
    target.draws += row.draws || 0;
  });
  return [...rows.values()].map(row => ({
    ...row,
    winRate: row.runs ? row.wins / row.runs : 0,
    drawRate: row.runs ? row.draws / row.runs : 0,
    decisiveWinRate: row.wins + row.losses ? row.wins / (row.wins + row.losses) : 0
  }));
}

function findWeakRows(characterRows) {
  return characterRows
    .filter(row => row.runs > 0 && rowBalanceRate(row) < TARGET_MIN_WIN_RATE)
    .sort((a, b) => rowBalanceRate(a) - rowBalanceRate(b));
}

function findStrongRows(characterRows) {
  return characterRows
    .filter(row => row.runs > 0 && rowBalanceRate(row) > TARGET_MAX_WIN_RATE)
    .sort((a, b) => rowBalanceRate(b) - rowBalanceRate(a));
}

function metricAverage(rows, characterId) {
  const row = rows.find(entry => entry.characterId === characterId);
  return row ? rowBalanceRate(row) : 0;
}

function chooseAdjustmentPaths(summary) {
  const characterRows = summarizeCharacterBalanceRows(summary);
  const weakRows = findWeakRows(characterRows);
  const strongRows = findStrongRows(characterRows);
  const weakCharacterIds = new Set(weakRows.map(row => row.characterId));
  const paths = [];

  weakRows.forEach(row => {
    const preferred = characterPrimaryTunables[row.characterId] || [];
    preferred.forEach(pathParts => paths.push({ path: pathParts, reason: `${row.characterId} weak ${rowBalanceRate(row).toFixed(3)} decisive`, intent: "buff" }));
  });

  strongRows
    .filter(row => !weakCharacterIds.has(row.characterId))
    .forEach(strongest => {
    const preferred = characterPrimaryTunables[strongest.characterId] || [];
      preferred.forEach(pathParts => {
        paths.push({ path: pathParts, reason: `${strongest.characterId} strong ${rowBalanceRate(strongest).toFixed(3)} decisive`, intent: "nerf" });
      });
    });

  return paths;
}

function adjustValue(current, bound, intent, pressure) {
  const step = Math.min(0.12, Math.max(0.015, pressure * 0.35));
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
  const characterRows = summarizeCharacterBalanceRows(summary).filter(row => row.runs > 0);
  const worstDistance = Math.max(...characterRows.map(row => Math.abs(rowBalanceRate(row) - 0.5)));
  const pressure = Math.max(0.01, worstDistance);

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
      min: Math.max(0.01, bound.original * 0.1),
      max: bound.original * 10,
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

function buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, selectedDifficulties, candidatePath, outputDir, finalSummary, history }) {
  const finalCharacterBalance = finalSummary ? summarizeCharacterBalanceRows(finalSummary) : [];
  return {
    id: runId,
    status,
    generatedAt: new Date().toISOString(),
    config: {
      cyclesPerBatch,
      difficulties: selectedDifficulties,
      matchesPerBatch: cyclesPerBatch * createSchedule(characters, 1).filter(entry => selectedDifficulties.includes(entry.difficulty)).length,
      targetMinWinRate: TARGET_MIN_WIN_RATE,
      targetMaxWinRate: TARGET_MAX_WIN_RATE,
      winRateExcludesDraws: true,
      deadline: deadline.toISOString(),
      seed
    },
    outputs: {
      candidate: candidatePath,
      directory: outputDir
    },
    finalCharacterBalance,
    finalWeakRows: finalSummary ? findWeakRows(finalCharacterBalance) : [],
    finalStrongRows: finalSummary ? findStrongRows(finalCharacterBalance) : [],
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
  const selectedDifficulties = parseDifficulties(stringArg(args, "difficulties", "medium"));
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
    const result = runBatch({ balance, characters, cycles: cyclesPerBatch, seed, batch, selectedDifficulties });
    finalSummary = result.summary;
    const characterBalanceRows = summarizeCharacterBalanceRows(result.summary);
    const weakRows = findWeakRows(characterBalanceRows);
    const strongRows = findStrongRows(characterBalanceRows);
    const averages = characters.map(character => ({
      characterId: character.id,
      decisiveWinRate: Number(metricAverage(characterBalanceRows, character.id).toFixed(6))
    }));

    writeJson(path.join(outputDir, `batch-${batch}-character-difficulty.json`), result.summary.characterDifficulty);
    writeCsv(path.join(outputDir, `batch-${batch}-character-difficulty.csv`), result.summary.characterDifficulty);
    writeJson(path.join(outputDir, `batch-${batch}-character-balance.json`), characterBalanceRows);
    writeCsv(path.join(outputDir, `batch-${batch}-character-balance.csv`), characterBalanceRows);
    writeJson(path.join(outputDir, `batch-${batch}-matches.json`), result.matches);

    const completedAt = new Date();
    const historyEntry = {
      batch,
      cycles: cyclesPerBatch,
      matches: result.matches.length,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      deadline: deadline.toISOString(),
      pass: weakRows.length === 0 && strongRows.length === 0,
      weakRows,
      strongRows,
      averages,
      changes: []
    };

    if (weakRows.length === 0 && strongRows.length === 0) {
      status = "passed";
      history.push(historyEntry);
      writeJson(candidatePath, balance);
      writeJson(historyPath, history);
      writeJson(manifestPath, buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, selectedDifficulties, candidatePath, outputDir, finalSummary, history }));
      if (!quiet) console.log(`Batch ${batch}: passed (${result.matches.length} matches).`);
      break;
    }

    const adjustment = applyAdjustments(balance, originalBalance, bounds, result.summary);
    balance = adjustment.nextBalance;
    historyEntry.changes = adjustment.changes;
    history.push(historyEntry);
    writeJson(candidatePath, balance);
    writeJson(historyPath, history);
    writeJson(manifestPath, buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, selectedDifficulties, candidatePath, outputDir, finalSummary, history }));
    if (!quiet) {
      const row = weakRows[0] || strongRows[0];
      const label = weakRows.length ? "worst" : "strongest";
      console.log(`Batch ${batch}: ${label} ${row.characterId} ${(rowBalanceRate(row) * 100).toFixed(1)}% decisive, changes ${adjustment.changes.length}.`);
    }
    if (!adjustment.changes.length) {
      status = "stalled";
      break;
    }
  }

  if (status === "running") {
    status = Date.now() >= deadline.getTime() ? "deadline" : "max-batches";
  }

  const manifest = buildManifest({ runId, status, cyclesPerBatch, characters, deadline, seed, selectedDifficulties, candidatePath, outputDir, finalSummary, history });

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
  TARGET_MAX_WIN_RATE,
  adjustValue,
  applyAdjustments,
  clampCandidate,
  findWeakRows,
  findStrongRows,
  parseDeadline,
  runBatch,
  summarizeCharacterBalanceRows
};
