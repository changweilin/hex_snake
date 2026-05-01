#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  buildCharacterMap,
  loadBalance,
  loadCharacters,
  simulateMatch
} = require("./sim-core");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const jobsDir = path.join(reportsDir, "jobs");
const docsDir = path.join(root, "doc");
const difficulties = ["low", "medium", "high"];
const difficultyPresets = {
  low: { pathPrecision: 0.48, aimPrecision: 0.45, skillStrategy: "spamSmall", foodStrategy: "preferredFood" },
  medium: { pathPrecision: 0.7, aimPrecision: 0.7, skillStrategy: "balanced", foodStrategy: "balanced" },
  high: { pathPrecision: 1, aimPrecision: 1, skillStrategy: "preferBig", foodStrategy: "denyOpponent" }
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
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
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${key} must be a non-negative number.`);
  return value;
}

function stringArg(args, key, fallback) {
  return args[key] === undefined ? fallback : String(args[key]);
}

function ensureDirs() {
  fs.mkdirSync(jobsDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });
}

function jobPath(jobId) {
  return path.join(jobsDir, `${jobId}.json`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rows.map(row => row.map(csvEscape).join(",")).join("\n")}\n`, "utf8");
}

function markdownTable(headers, rows) {
  const escapeCell = value => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(row => `| ${row.map(escapeCell).join(" | ")} |`)
  ].join("\n");
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : "0.00%";
}

function flattenObject(object, prefix = []) {
  return Object.entries(object || {}).flatMap(([key, value]) => {
    const pathParts = [...prefix, key];
    if (value && typeof value === "object" && !Array.isArray(value)) return flattenObject(value, pathParts);
    return [{ key: pathParts.join("."), value }];
  });
}

function buildBalanceDoc({ job, balance, characters, summary }) {
  const characterRows = characters.map(character => [
    character.id,
    character.name,
    character.foodPreference || "balanced",
    character.specialFood || "",
    character.smallMove || "",
    character.bigMove || ""
  ]);
  const difficultyRows = Object.entries(difficultyPresets).map(([difficulty, preset]) => [
    difficulty,
    preset.pathPrecision,
    preset.aimPrecision,
    preset.skillStrategy,
    preset.foodStrategy
  ]);
  const settingRows = flattenObject(balance)
    .filter(row => !row.key.startsWith("defaults.initialStock."))
    .map(row => [row.key, formatNumber(row.value)]);
  const stockRows = Object.entries(balance.defaults?.initialStock || {}).map(([type, value]) => [type, formatNumber(value)]);
  const characterSummaryRows = [...(summary?.characterDifficulty || [])]
    .sort((left, right) => left.difficulty.localeCompare(right.difficulty) || left.characterId.localeCompare(right.characterId))
    .map(row => [
      row.difficulty,
      row.characterId,
      row.runs,
      row.wins,
      row.losses,
      row.draws,
      formatPercent(row.winRate),
      formatPercent(row.drawRate),
      Math.round(row.averageDurationMs)
    ]);

  return [
    "# Hex Snake Balance Snapshot",
    "",
    "format_version: 1",
    `job_id: ${job.id}`,
    `generated_at: ${new Date().toISOString()}`,
    `status: ${job.status}`,
    `cycles: ${job.config.cycles}`,
    `seed: ${job.config.seed}`,
    `matches: ${job.progress.completedMatches}/${job.progress.totalMatches}`,
    "source_balance: data/balance.json",
    "",
    "## Core Balance Values",
    "",
    markdownTable(["key", "value"], settingRows),
    "",
    "## Initial Stock Defaults",
    "",
    markdownTable(["foodType", "value"], stockRows),
    "",
    "## AI Difficulty Presets",
    "",
    markdownTable(["difficulty", "pathPrecision", "aimPrecision", "skillStrategy", "foodStrategy"], difficultyRows),
    "",
    "## Character Values",
    "",
    markdownTable(["id", "name", "foodPreference", "specialFood", "smallMove", "bigMove"], characterRows),
    "",
    "## Character Result Summary",
    "",
    markdownTable(["difficulty", "characterId", "runs", "wins", "losses", "draws", "winRate", "drawRate", "averageDurationMs"], characterSummaryRows),
    ""
  ].join("\n");
}

function writeBalanceDoc(job, balance, characters, summary) {
  const content = buildBalanceDoc({ job, balance, characters, summary });
  const currentPath = path.join(docsDir, "current-balance.md");
  fs.writeFileSync(currentPath, content, "utf8");
  return { currentBalanceDoc: currentPath };
}

function createUnorderedPairs(characters) {
  const pairs = [];
  for (let left = 0; left < characters.length; left += 1) {
    for (let right = left + 1; right < characters.length; right += 1) {
      pairs.push([characters[left].id, characters[right].id]);
    }
  }
  return pairs;
}

function createSchedule(characters, cycles) {
  const pairs = createUnorderedPairs(characters);
  const schedule = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    pairs.forEach((pair, pairIndex) => {
      difficulties.forEach((difficulty, difficultyIndex) => {
        const flip = (cycle + pairIndex + difficultyIndex) % 2 === 0;
        schedule.push({
          cycle,
          difficulty,
          pair,
          playerCharacterId: flip ? pair[1] : pair[0],
          computerCharacterId: flip ? pair[0] : pair[1]
        });
      });
    });
  }
  return schedule;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function roundMetric(value) {
  return Number(value.toFixed(6));
}

function statTriplet(values) {
  return {
    average: roundMetric(average(values)),
    standardDeviation: roundMetric(standardDeviation(values)),
    median: roundMetric(median(values))
  };
}

const fighterMetricKeys = [
  "hp",
  "length",
  "score",
  "smallCasts",
  "bigCasts",
  "smallCastRate",
  "damageDealt",
  "damageTaken",
  "damageTakenBySmall",
  "damageTakenByBig",
  "stunApplied",
  "foodCollected",
  "averageStock",
  "hpDiff",
  "scoreDiff"
];

function flattenFighterMetrics(fighter) {
  return {
    hp: fighter.hp,
    length: fighter.length,
    score: fighter.score,
    smallCasts: fighter.smallCasts,
    bigCasts: fighter.bigCasts,
    smallCastRate: fighter.smallCastRate,
    damageDealt: fighter.damageDealt,
    damageTaken: fighter.damageTaken,
    damageTakenBySmall: fighter.damageTakenByCause.small,
    damageTakenByBig: fighter.damageTakenByCause.big,
    stunApplied: fighter.stunApplied,
    foodCollected: fighter.foodCollected,
    averageStock: fighter.averageStock,
    hpDiff: fighter.hpDiff,
    scoreDiff: fighter.scoreDiff
  };
}

function fighterForCharacter(match, characterId) {
  if (match.player?.characterId === characterId) return match.player;
  if (match.computer?.characterId === characterId) return match.computer;
  return null;
}

function makeEmptyCharacterRow(difficulty, characterId) {
  return {
    difficulty,
    characterId,
    runs: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    drawRate: 0,
    averageDurationMs: 0,
    totalDurationMs: 0
  };
}

function makeEmptyMatchupRow(difficulty, characterA, characterB) {
  return {
    difficulty,
    characterA,
    characterB,
    runs: 0,
    characterAWins: 0,
    characterBWins: 0,
    draws: 0,
    characterAWinRate: 0,
    characterBWinRate: 0,
    fatalSmallLosses: 0,
    fatalBigLosses: 0,
    fatalCollisionParalysisLosses: 0,
    fatalStunLockedLosses: 0,
    topDamageSmallLosses: 0,
    topDamageBigLosses: 0,
    averageDurationMs: 0,
    medianDurationMs: 0,
    minDurationMs: 0,
    maxDurationMs: 0,
    durations: []
  };
}

function summarizeMatchupStats(matches, characters) {
  const rows = [];
  const pairs = createUnorderedPairs(characters);
  difficulties.forEach(difficulty => {
    pairs.forEach(([characterA, characterB]) => {
      const group = matches.filter(match => (
        match.difficulty === difficulty &&
        match.pair[0] === characterA &&
        match.pair[1] === characterB
      ));
      const row = {
        difficulty,
        characterA,
        characterB,
        runs: group.length,
        characterAWins: group.filter(match => match.winnerCharacterId === characterA).length,
        characterBWins: group.filter(match => match.winnerCharacterId === characterB).length,
        draws: group.filter(match => !match.winnerCharacterId).length
      };
      row.characterAWinRate = row.runs ? roundMetric(row.characterAWins / row.runs) : 0;
      row.characterBWinRate = row.runs ? roundMetric(row.characterBWins / row.runs) : 0;
      row.drawRate = row.runs ? roundMetric(row.draws / row.runs) : 0;
      const duration = statTriplet(group.map(match => match.durationMs));
      row.durationMsAverage = duration.average;
      row.durationMsStandardDeviation = duration.standardDeviation;
      row.durationMsMedian = duration.median;

      [
        ["characterA", characterA],
        ["characterB", characterB]
      ].forEach(([prefix, characterId]) => {
        fighterMetricKeys.forEach(metric => {
          const values = group
            .map(match => fighterForCharacter(match, characterId))
            .filter(Boolean)
            .map(flattenFighterMetrics)
            .map(metrics => metrics[metric]);
          const stats = statTriplet(values);
          row[`${prefix}${metric[0].toUpperCase()}${metric.slice(1)}Average`] = stats.average;
          row[`${prefix}${metric[0].toUpperCase()}${metric.slice(1)}StandardDeviation`] = stats.standardDeviation;
          row[`${prefix}${metric[0].toUpperCase()}${metric.slice(1)}Median`] = stats.median;
        });
      });
      rows.push(row);
    });
  });
  return rows;
}

function summarizeMatches(matches, characters) {
  const characterRows = new Map();
  const matchupRows = new Map();
  const characterIds = characters.map(character => character.id);
  difficulties.forEach(difficulty => {
    characterIds.forEach(characterId => {
      characterRows.set(`${difficulty}:${characterId}`, makeEmptyCharacterRow(difficulty, characterId));
    });
  });

  matches.forEach(match => {
    const [characterA, characterB] = match.pair;
    [characterA, characterB].forEach(characterId => {
      const row = characterRows.get(`${match.difficulty}:${characterId}`);
      row.runs += 1;
      row.totalDurationMs += match.durationMs;
      if (!match.winnerCharacterId) row.draws += 1;
      else if (match.winnerCharacterId === characterId) row.wins += 1;
      else row.losses += 1;
    });

    const matchupKey = `${match.difficulty}:${characterA}:${characterB}`;
    if (!matchupRows.has(matchupKey)) matchupRows.set(matchupKey, makeEmptyMatchupRow(match.difficulty, characterA, characterB));
    const row = matchupRows.get(matchupKey);
    row.runs += 1;
    row.durations.push(match.durationMs);
    if (!match.winnerCharacterId) row.draws += 1;
    else if (match.winnerCharacterId === characterA) row.characterAWins += 1;
    else if (match.winnerCharacterId === characterB) row.characterBWins += 1;

    if (match.loserCharacterId) {
      if (match.fatalCause === "small") row.fatalSmallLosses += 1;
      if (match.fatalCause === "big") row.fatalBigLosses += 1;
      if (match.fatalCause === "collisionParalysis") row.fatalCollisionParalysisLosses += 1;
      if (match.fatalCause === "stunLocked") row.fatalStunLockedLosses += 1;
      if (match.topDamageCause === "small") row.topDamageSmallLosses += 1;
      if (match.topDamageCause === "big") row.topDamageBigLosses += 1;
    }
  });

  const characterDifficulty = [...characterRows.values()].map(row => ({
    difficulty: row.difficulty,
    characterId: row.characterId,
    runs: row.runs,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: row.runs ? row.wins / row.runs : 0,
    drawRate: row.runs ? row.draws / row.runs : 0,
    averageDurationMs: row.runs ? row.totalDurationMs / row.runs : 0
  }));

  const matchupDifficulty = [...matchupRows.values()].map(row => ({
    difficulty: row.difficulty,
    characterA: row.characterA,
    characterB: row.characterB,
    runs: row.runs,
    characterAWins: row.characterAWins,
    characterBWins: row.characterBWins,
    draws: row.draws,
    characterAWinRate: row.runs ? row.characterAWins / row.runs : 0,
    characterBWinRate: row.runs ? row.characterBWins / row.runs : 0,
    fatalSmallLosses: row.fatalSmallLosses,
    fatalBigLosses: row.fatalBigLosses,
    fatalCollisionParalysisLosses: row.fatalCollisionParalysisLosses,
    fatalStunLockedLosses: row.fatalStunLockedLosses,
    topDamageSmallLosses: row.topDamageSmallLosses,
    topDamageBigLosses: row.topDamageBigLosses,
    averageDurationMs: average(row.durations),
    medianDurationMs: median(row.durations),
    minDurationMs: row.durations.length ? Math.min(...row.durations) : 0,
    maxDurationMs: row.durations.length ? Math.max(...row.durations) : 0
  }));

  return { characterDifficulty, matchupDifficulty };
}

function characterRowsToCsv(rows) {
  const header = ["difficulty", "characterId", "runs", "wins", "losses", "draws", "winRate", "drawRate", "averageDurationMs"];
  return [header, ...rows.map(row => header.map(key => row[key]))];
}

function matchupRowsToCsv(rows) {
  const header = [
    "difficulty",
    "characterA",
    "characterB",
    "runs",
    "characterAWins",
    "characterBWins",
    "draws",
    "characterAWinRate",
    "characterBWinRate",
    "fatalSmallLosses",
    "fatalBigLosses",
    "fatalCollisionParalysisLosses",
    "fatalStunLockedLosses",
    "topDamageSmallLosses",
    "topDamageBigLosses",
    "averageDurationMs",
    "medianDurationMs",
    "minDurationMs",
    "maxDurationMs"
  ];
  return [header, ...rows.map(row => header.map(key => row[key]))];
}

function matchupStatsRowsToCsv(rows) {
  const fixed = [
    "difficulty",
    "characterA",
    "characterB",
    "runs",
    "characterAWins",
    "characterBWins",
    "draws",
    "characterAWinRate",
    "characterBWinRate",
    "drawRate",
    "durationMsAverage",
    "durationMsStandardDeviation",
    "durationMsMedian"
  ];
  const metricColumns = [];
  ["characterA", "characterB"].forEach(prefix => {
    fighterMetricKeys.forEach(metric => {
      const label = `${prefix}${metric[0].toUpperCase()}${metric.slice(1)}`;
      metricColumns.push(`${label}Average`, `${label}StandardDeviation`, `${label}Median`);
    });
  });
  const header = [...fixed, ...metricColumns];
  return [header, ...rows.map(row => header.map(key => row[key]))];
}

function createJobId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return `sim-${stamp}-${process.pid}`;
}

function createJob(args) {
  ensureDirs();
  const cycles = Math.max(1, Math.floor(numberArg(args, "cycles", 1)));
  const seed = stringArg(args, "seed", "scheduled");
  const characters = loadCharacters(root);
  const totalMatches = createSchedule(characters, cycles).length;
  const jobId = stringArg(args, "job", createJobId());
  const job = {
    id: jobId,
    status: "queued",
    pid: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    stopRequested: false,
    config: { cycles, seed, difficulties },
    progress: { completedMatches: 0, totalMatches, currentCycle: 0, percent: 0 },
    outputs: {}
  };
  writeJson(jobPath(jobId), job);
  return job;
}

function startJob(args) {
  const job = createJob(args);
  const stdoutPath = path.join(jobsDir, `${job.id}.out.log`);
  const stderrPath = path.join(jobsDir, `${job.id}.err.log`);
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");
  const child = spawn(process.execPath, [__filename, "run-job", "--job", job.id], {
    cwd: root,
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true
  });
  child.unref();
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  const latest = readJson(jobPath(job.id));
  if (latest.status === "queued" || latest.status === "running") {
    latest.pid = child.pid;
    latest.status = "running";
    latest.startedAt = latest.startedAt || new Date().toISOString();
    latest.logs = { stdout: stdoutPath, stderr: stderrPath };
    writeJson(jobPath(job.id), latest);
  }
  console.log(`Started ${job.id}`);
  console.log(`PID ${child.pid}`);
  console.log(`Matches ${job.progress.totalMatches}`);
  return job;
}

function runInline(args) {
  const job = createJob(args);
  console.log(`Running ${job.id}`);
  const result = runJob(job.id);
  console.log(`Completed ${job.id}`);
  console.log(`Matches ${result.job.progress.completedMatches}`);
  return result;
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
    winner: match.winner,
    loser: match.loser,
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

function runJob(jobId) {
  ensureDirs();
  const filePath = jobPath(jobId);
  const job = readJson(filePath);
  const balance = loadBalance(root);
  const characters = loadCharacters(root);
  const characterById = buildCharacterMap(characters);
  const schedule = createSchedule(characters, job.config.cycles);
  const matches = [];
  const startedAtMs = Date.now();
  job.status = "running";
  job.startedAt = job.startedAt || new Date().toISOString();
  job.pid = process.pid;
  writeJson(filePath, job);

  for (let index = 0; index < schedule.length; index += 1) {
    const latest = readJson(filePath);
    if (latest.stopRequested) {
      job.status = "stopped";
      break;
    }
    const entry = schedule[index];
    const policy = difficultyPresets[entry.difficulty];
    const match = simulateMatch({
      balance,
      playerCharacter: characterById.get(entry.playerCharacterId),
      computerCharacter: characterById.get(entry.computerCharacterId),
      playerModel: policy,
      computerModel: policy,
      seed: `${job.config.seed}:${entry.cycle}:${entry.difficulty}:${entry.pair.join("-")}`
    });
    matches.push(normalizeMatchRecord(entry, match));

    job.progress.completedMatches = matches.length;
    job.progress.currentCycle = entry.cycle;
    job.progress.percent = schedule.length ? matches.length / schedule.length : 1;
    job.progress.elapsedMs = Date.now() - startedAtMs;
    const averageMatchMs = job.progress.elapsedMs / Math.max(1, matches.length);
    job.progress.estimatedRemainingMs = Math.max(0, Math.round((schedule.length - matches.length) * averageMatchMs));
    if (matches.length % 10 === 0 || matches.length === schedule.length) writeJson(filePath, job);
  }

  const summary = summarizeMatches(matches, characters);
  const matchupStats = summarizeMatchupStats(matches, characters);
  const outputBase = path.join(reportsDir, job.id);
  const outputs = {
    matches: `${outputBase}-matches.json`,
    characterDifficultyJson: `${outputBase}-character-difficulty.json`,
    characterDifficultyCsv: `${outputBase}-character-difficulty.csv`,
    matchupDifficultyJson: `${outputBase}-matchup-difficulty.json`,
    matchupDifficultyCsv: `${outputBase}-matchup-difficulty.csv`,
    matchupStatsJson: `${outputBase}-matchup-stats.json`,
    matchupStatsCsv: `${outputBase}-matchup-stats.csv`
  };
  writeJson(outputs.matches, matches);
  writeJson(outputs.characterDifficultyJson, summary.characterDifficulty);
  writeCsv(outputs.characterDifficultyCsv, characterRowsToCsv(summary.characterDifficulty));
  writeJson(outputs.matchupDifficultyJson, summary.matchupDifficulty);
  writeCsv(outputs.matchupDifficultyCsv, matchupRowsToCsv(summary.matchupDifficulty));
  writeJson(outputs.matchupStatsJson, matchupStats);
  writeCsv(outputs.matchupStatsCsv, matchupStatsRowsToCsv(matchupStats));

  job.status = job.status === "stopped" ? "stopped" : "completed";
  job.completedAt = new Date().toISOString();
  job.progress.completedMatches = matches.length;
  job.progress.percent = schedule.length ? matches.length / schedule.length : 1;
  job.outputs = outputs;
  Object.assign(job.outputs, writeBalanceDoc(job, balance, characters, summary));
  writeJson(filePath, job);
  return { job, matches, summary };
}

function statusJob(args) {
  const jobId = stringArg(args, "job", null);
  if (!jobId) throw new Error("--job is required.");
  const job = readJson(jobPath(jobId));
  if ((job.status === "running" || job.status === "stopping") && job.pid && !isProcessAlive(job.pid)) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = "Worker process exited before completing the job.";
    writeJson(jobPath(jobId), job);
  }
  console.log(`${job.id}: ${job.status}`);
  console.log(`${job.progress.completedMatches}/${job.progress.totalMatches} matches (${(job.progress.percent * 100).toFixed(1)}%)`);
  if (job.progress.estimatedRemainingMs !== undefined) console.log(`Estimated remaining: ${Math.round(job.progress.estimatedRemainingMs / 1000)}s`);
  if (job.outputs && Object.keys(job.outputs).length) {
    Object.entries(job.outputs).forEach(([key, value]) => console.log(`${key}: ${value}`));
  }
  return job;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function stopJob(args) {
  const jobId = stringArg(args, "job", null);
  if (!jobId) throw new Error("--job is required.");
  const job = readJson(jobPath(jobId));
  job.stopRequested = true;
  if (job.status === "queued" || job.status === "running") job.status = "stopping";
  writeJson(jobPath(jobId), job);
  console.log(`Stop requested for ${job.id}`);
  return job;
}

function listJobs() {
  ensureDirs();
  const jobs = fs.readdirSync(jobsDir)
    .filter(file => file.endsWith(".json"))
    .map(file => readJson(path.join(jobsDir, file)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  jobs.forEach(job => console.log(`${job.id}\t${job.status}\t${job.progress.completedMatches}/${job.progress.totalMatches}\t${job.createdAt}`));
  return jobs;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "status";
  if (command === "start") return startJob(args);
  if (command === "run") return runInline(args);
  if (command === "run-job") return runJob(stringArg(args, "job", null));
  if (command === "status") return statusJob(args);
  if (command === "stop") return stopJob(args);
  if (command === "list") return listJobs();
  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  difficulties,
  difficultyPresets,
  createUnorderedPairs,
  createSchedule,
  summarizeMatches,
  summarizeMatchupStats,
  buildBalanceDoc,
  runJob,
  runInline,
  startJob
};
