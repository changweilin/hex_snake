#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
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
const DEFAULT_CEM_ROUNDS = 0;
const DEFAULT_CEM_SAMPLES = 12;
const DEFAULT_CEM_ELITES = 4;
const DEFAULT_CEM_RUNS = 1000;
const DEFAULT_CEM_SIGMA = 0.36;
const DEFAULT_CEM_MIN_SIGMA = 0.04;
const DEFAULT_CEM_SMOOTHING = 0.65;
const DEFAULT_CEM_TEMPERATURE = 0.08;
const DEFAULT_CROSS_RUNS = 1000;
const DEFAULT_FINAL_CANDIDATES_PER_CHARACTER = 1;
const DEFAULT_FINAL_CANDIDATE_RUNS = 0;
const DEFAULT_FINAL_SHORTLIST_DISTANCE = 0.06;
const DEFAULT_MIN_QUALIFIED = 8;
const DEFAULT_MIN_QUALIFIED_PER_CHARACTER = 0;
const DEFAULT_DIVERSITY_DISTANCE = 0.18;
const DEFAULT_BASELINE_DISTANCE = 0.08;
const DEFAULT_CYCLES = 1;
const DEFAULT_GA_DURATION_HOURS = 0;
const DEFAULT_RL_DURATION_HOURS = 0;
const DEFAULT_RL_SIGMA = 0.42;
const DEFAULT_RL_TEMPERATURE = 0.08;
const DEFAULT_PRUNE_CI_TARGET_WIN_RATE = 0.5;
const DEFAULT_PRUNE_CI_Z = 1.96;
const DEFAULT_PRUNE_CI_SCHEDULE = "10-50:0.45,51-100:0.48,101-:0.5";
const DEFAULT_JOBS = 1;
const DEFAULT_CANDIDATE_JOBS = 1;
const DEFAULT_PARALLEL_CHUNK_GAMES = 50;
const DEFAULT_EARLY_BATCH_GAMES = 10;
const DEFAULT_MIN_GAMES_PER_WORKER = 8;
const WORKER_PROFILES = {
  custom: {
    jobs: DEFAULT_JOBS,
    candidateJobs: DEFAULT_CANDIDATE_JOBS,
    parallelChunkGames: DEFAULT_PARALLEL_CHUNK_GAMES,
    earlyBatchGames: DEFAULT_EARLY_BATCH_GAMES,
    minGamesPerWorker: DEFAULT_MIN_GAMES_PER_WORKER,
    racingStages: "",
    racingMinGames: 0,
    racingZ: DEFAULT_PRUNE_CI_Z,
    gaRacingKeep: 0,
    rlRacingKeep: 0,
    gaPruneCiSchedule: DEFAULT_PRUNE_CI_SCHEDULE,
    rlPruneCiSchedule: DEFAULT_PRUNE_CI_SCHEDULE
  },
  daily: {
    jobs: 8,
    candidateJobs: 2,
    parallelChunkGames: 80,
    earlyBatchGames: 16,
    minGamesPerWorker: 8,
    racingStages: "160,480",
    racingMinGames: 160,
    racingZ: 1.64,
    gaRacingKeep: 7,
    rlRacingKeep: 5,
    gaPruneCiSchedule: "16-80:0.45,81-160:0.48,161-:0.5",
    rlPruneCiSchedule: "16-80:0.45,81-160:0.48,161-:0.5"
  },
  overnight: {
    jobs: 16,
    candidateJobs: 4,
    parallelChunkGames: 160,
    earlyBatchGames: 32,
    minGamesPerWorker: 10,
    racingStages: "320,720",
    racingMinGames: 320,
    racingZ: 1.64,
    gaRacingKeep: 7,
    rlRacingKeep: 5,
    gaPruneCiSchedule: "32-160:0.45,161-320:0.48,321-:0.5",
    rlPruneCiSchedule: "32-160:0.45,161-320:0.48,321-:0.5"
  }
};

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

function nonNegativeNumberArg(args, key, fallback) {
  if (args[key] === undefined) return fallback;
  const value = Number(args[key]);
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${key} must be a non-negative number.`);
  return value;
}

function integerArg(args, key, fallback) {
  const value = numberArg(args, key, fallback);
  if (!Number.isInteger(value)) throw new Error(`--${key} must be an integer.`);
  return value;
}

function nonNegativeIntegerArg(args, key, fallback) {
  const value = nonNegativeNumberArg(args, key, fallback);
  if (!Number.isInteger(value)) throw new Error(`--${key} must be an integer.`);
  return value;
}

function positiveIntegerValue(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function workerProfile(name = "custom") {
  const key = String(name || "custom").toLowerCase();
  if (key === "auto") return { name: "auto", auto: true };
  if (!WORKER_PROFILES[key]) throw new Error(`Unknown worker profile: ${name}. Use custom, daily, or overnight.`);
  return { name: key, ...WORKER_PROFILES[key] };
}

function parseIntegerList(text) {
  return String(text || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const value = Number(part);
      if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid positive integer in list: ${part}`);
      return value;
    });
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

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (!["EPERM", "EEXIST"].includes(error.code)) throw error;
    fs.copyFileSync(tempPath, filePath);
    fs.unlinkSync(tempPath);
  }
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function availableParallelism() {
  if (typeof os.availableParallelism === "function") return os.availableParallelism();
  return os.cpus().length || 1;
}

function wilsonInterval(wins, games, z = 1.96) {
  if (!games) return { low: 0, high: 1 };
  const p = wins / games;
  const z2 = z * z;
  const denominator = 1 + z2 / games;
  const center = p + z2 / (2 * games);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * games)) / games);
  return {
    low: Math.max(0, (center - margin) / denominator),
    high: Math.min(1, (center + margin) / denominator)
  };
}

function withWinRateEstimate(row) {
  const interval = wilsonInterval(row.wins || 0, row.games || 0);
  return {
    games: row.games || 0,
    wins: row.wins || 0,
    losses: row.losses || 0,
    draws: row.draws || 0,
    winRate: row.winRate || 0,
    drawRate: row.drawRate || 0,
    decisiveWinRate: row.decisiveWinRate || 0,
    outcomeWinRate: row.outcomeWinRate || 0,
    reward: row.reward || 0,
    averageHpDiff: row.averageHpDiff || 0,
    averageScoreDiff: row.averageScoreDiff || 0,
    ci95: {
      low: round(interval.low),
      high: round(interval.high)
    }
  };
}

function effectiveWorkEstimate(analysis, { gaRows = [] } = {}) {
  const work = analysis.plannedWork;
  const details = {};
  let adjustedGaGames = work.gaGames;
  if (gaRows.length >= Math.max(1, work.characterCount * 4)) {
    const observedGaGames = gaRows.reduce((sum, row) => sum + (row.games || 0), 0);
    const averageGaGames = observedGaGames / gaRows.length;
    adjustedGaGames = Math.max(observedGaGames, Math.round(averageGaGames * work.gaCandidateEvaluations));
    details.ga = {
      observedCandidates: gaRows.length,
      observedGames: observedGaGames,
      averageGamesPerCandidate: round(averageGaGames, 2),
      theoreticalGames: work.gaGames,
      adjustedGames: adjustedGaGames,
      saveRate: round(1 - adjustedGaGames / work.gaGames)
    };
  }
  if (!details.ga) return null;
  const plannedGames = Math.max(
    work.crossGames,
    adjustedGaGames + (work.cemGames || 0) + work.rlGames + (work.finalCandidateGames || 0) + work.crossGames
  );
  return {
    plannedGames,
    details
  };
}

function parsePruneCiSchedule(scheduleText) {
  const text = String(scheduleText || "").trim();
  if (!text || text === "0" || text.toLowerCase() === "off" || text.toLowerCase() === "false") return [];
  return text.split(",").map(rawRule => {
    const [rawRange, rawTarget] = rawRule.split(":").map(part => part.trim());
    if (!rawRange || !rawTarget) throw new Error(`Invalid prune CI schedule rule: ${rawRule}`);
    const targetWinRate = Number(rawTarget);
    if (!Number.isFinite(targetWinRate) || targetWinRate <= 0 || targetWinRate >= 1) {
      throw new Error(`Invalid prune CI target win rate in rule: ${rawRule}`);
    }
    const [rawMin, rawMax] = rawRange.split("-").map(part => part.trim());
    const minGames = Math.max(1, Math.floor(Number(rawMin)));
    const maxGames = rawRange.includes("-") && rawMax ? Math.floor(Number(rawMax)) : null;
    if (!Number.isFinite(minGames)) throw new Error(`Invalid prune CI min games in rule: ${rawRule}`);
    if (maxGames !== null && (!Number.isFinite(maxGames) || maxGames < minGames)) {
      throw new Error(`Invalid prune CI max games in rule: ${rawRule}`);
    }
    return { minGames, maxGames, targetWinRate };
  }).sort((left, right) => left.minGames - right.minGames);
}

function confidencePruneRule(scheduleOrMinGames, targetWinRateOrZ, maybeZ) {
  if (typeof scheduleOrMinGames === "string") {
    const rules = parsePruneCiSchedule(scheduleOrMinGames);
    if (!rules.length) return null;
    return {
      z: Number(targetWinRateOrZ),
      rules
    };
  }
  const normalizedMinGames = Math.max(0, Math.floor(Number(scheduleOrMinGames || 0)));
  if (!normalizedMinGames) return null;
  return {
    z: Number(maybeZ),
    rules: [{
      minGames: normalizedMinGames,
      maxGames: null,
      targetWinRate: Number(targetWinRateOrZ)
    }]
  };
}

function confidencePruneDecision(totals, rule) {
  if (!rule) return null;
  const activeRule = (rule.rules || []).find(candidate =>
    totals.games >= candidate.minGames && (candidate.maxGames === null || totals.games <= candidate.maxGames)
  );
  if (!activeRule) return null;
  const interval = wilsonInterval(totals.wins || 0, totals.games || 0, rule.z);
  if (interval.high >= activeRule.targetWinRate) return null;
  const stage = activeRule.maxGames === null
    ? `${formatNumber(activeRule.minGames)}+`
    : `${formatNumber(activeRule.minGames)}-${formatNumber(activeRule.maxGames)}`;
  return {
    pruned: true,
    pruneMethod: "wilson-upper-bound",
    pruneAtGames: totals.games,
    pruneTargetWinRate: round(activeRule.targetWinRate),
    pruneStage: stage,
    pruneCiZ: round(rule.z),
    pruneCiLow: round(interval.low),
    pruneCiHigh: round(interval.high),
    pruneReason: `Wilson upper bound ${percentPrecise(interval.high)} < target ${percent(activeRule.targetWinRate)} in ${stage} games stage`
  };
}

function objectFromMap(map) {
  return Object.fromEntries([...map.entries()]);
}

function mapFromObject(object = {}) {
  return new Map(Object.entries(object || {}));
}

function configFingerprint(config) {
  return JSON.stringify(config);
}

function buildTrainingTargetAnalysis(config, characters) {
  const pruneCiTargetWinRate = Number(config.pruneCiTargetWinRate ?? DEFAULT_PRUNE_CI_TARGET_WIN_RATE);
  const pruneCiZ = Number(config.pruneCiZ ?? DEFAULT_PRUNE_CI_Z);
  const gaPruneCiSchedule = String(config.gaPruneCiSchedule ?? "");
  const rlPruneCiSchedule = String(config.rlPruneCiSchedule ?? "");
  const characterCount = characters.length;
  const orderedPairs = characterCount * Math.max(0, characterCount - 1);
  const gaCandidateEvaluations = config.gaRounds * characterCount * config.gaPopulation;
  const cemCandidateEvaluations = Math.max(0, config.cemRounds || 0) * characterCount * ((config.cemSamples || 0) + 1);
  const rlCandidateEvaluations = config.rlRounds * characterCount * (config.rlSamples + 1);
  const finalCandidatesPerCharacter = Math.max(1, Math.floor(config.finalCandidatesPerCharacter || DEFAULT_FINAL_CANDIDATES_PER_CHARACTER));
  const finalCandidateRuns = Math.max(0, Math.floor(config.finalCandidateRuns || DEFAULT_FINAL_CANDIDATE_RUNS));
  const finalCandidateEvaluations = finalCandidateRuns
    ? finalCandidatesPerCharacter * characterCount * Math.max(0, characterCount - 1) * 2
    : 0;
  const crossSeatSeriesPerReport = orderedPairs * 2;
  const crossReports = 2;
  const gaGames = gaCandidateEvaluations * config.gaRuns;
  const cemGames = cemCandidateEvaluations * (config.cemRuns || 0);
  const rlGames = rlCandidateEvaluations * config.rlRuns;
  const finalCandidateGames = finalCandidateEvaluations * finalCandidateRuns;
  const crossGames = crossReports * crossSeatSeriesPerReport * config.crossRuns;
  const totalGames = gaGames + cemGames + rlGames + finalCandidateGames + crossGames;
  return {
    objective: "Find high-AI strategy weights that beat the basic mirror gate, stay novel from the baseline, then validate each target character against baseline opponents.",
    gate: {
      mirrorWinRate: "> 50%",
      baselineDistance: config.baselineDistance,
      diversityDistance: config.diversityDistance,
      minQualified: config.minQualified,
      minQualifiedPerCharacter: config.minQualifiedPerCharacter,
      confidencePruning: {
        targetWinRate: pruneCiTargetWinRate,
        z: pruneCiZ,
        gaSchedule: gaPruneCiSchedule,
        rlSchedule: rlPruneCiSchedule,
        gaRules: parsePruneCiSchedule(gaPruneCiSchedule),
        rlRules: parsePruneCiSchedule(rlPruneCiSchedule)
      }
    },
    plannedWork: {
      characterCount,
      characterIds: characters.map(character => character.id),
      parallelJobs: config.jobs || DEFAULT_JOBS,
      candidateJobs: config.candidateJobs || DEFAULT_CANDIDATE_JOBS,
      parallelChunkGames: config.parallelChunkGames || DEFAULT_PARALLEL_CHUNK_GAMES,
      earlyBatchGames: config.earlyBatchGames || DEFAULT_EARLY_BATCH_GAMES,
      minGamesPerWorker: config.minGamesPerWorker || DEFAULT_MIN_GAMES_PER_WORKER,
      racingStages: config.racingStages || "",
      racingMinGames: config.racingMinGames || 0,
      racingZ: config.racingZ || config.pruneCiZ || DEFAULT_PRUNE_CI_Z,
      gaRacingKeep: config.gaRacingKeep || 0,
      rlRacingKeep: config.rlRacingKeep || 0,
      gaCandidateEvaluations,
      gaGames,
      cemCandidateEvaluations,
      cemGames,
      rlCandidateEvaluations,
      rlGames,
      finalCandidatesPerCharacter,
      finalCandidateRuns,
      finalCandidateEvaluations,
      finalCandidateGames,
      crossReports,
      crossSeatSeriesPerReport,
      crossGames,
      totalGames
    },
    phases: [
      {
        id: "ga",
        goal: "Explore broad strategy space and collect diverse candidates that clear the mirror basic gate.",
        plannedGames: gaGames
      },
      {
        id: "cem",
        goal: "Refine GA-qualified regions with a diagonal cross-entropy distribution before RL selection.",
        plannedGames: cemGames
      },
      {
        id: "rl",
        goal: "Refine each character around qualified GA seeds and select the best mirror-gate strategy.",
        plannedGames: rlGames
      },
      {
        id: "final-shortlist",
        goal: "Optionally validate the top candidate shortlist per character against baseline opponents before applying.",
        plannedGames: finalCandidateGames
      },
      {
        id: "cross-play",
        goal: "Measure marginal target-vs-baseline gain with side-balanced player/computer seats.",
        plannedGames: crossGames
      }
    ],
    successCriteria: [
      `At least ${config.minQualified} diverse GA-qualified strategies overall.`,
      config.minQualifiedPerCharacter
        ? `At least ${config.minQualifiedPerCharacter} diverse GA-qualified strategies for every selected character.`
        : "No per-character minimum is required for this run.",
      gaPruneCiSchedule || rlPruneCiSchedule
        ? `GA/CEM/RL candidates may be pruned early when their ${percentFromConfig(pruneCiZ)} Wilson upper bound is below the active stage threshold.`
        : "No confidence-interval pruning is enabled.",
      "Optimized target-vs-field average should beat the baseline target-vs-field average.",
      "Review per-character deltas before applying generated strategies."
    ]
  };
}

function percentFromConfig(z) {
  if (Math.abs(Number(z) - 1.96) < 0.001) return "95%";
  return `z=${z}`;
}

function formatPruneRule(rule) {
  const range = rule.maxGames === null ? `${formatNumber(rule.minGames)}+` : `${formatNumber(rule.minGames)}-${formatNumber(rule.maxGames)}`;
  return `${range}: upper < ${percent(rule.targetWinRate)}`;
}

function formatPruneSchedule(rules) {
  return rules && rules.length ? rules.map(formatPruneRule).join("; ") : "disabled";
}

function trainingTargetMarkdown(analysis) {
  const work = analysis.plannedWork;
  return [
    "# Strategy Training Targets",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Objective",
    "",
    analysis.objective,
    "",
    "## Gate",
    "",
    `- Mirror win rate: ${analysis.gate.mirrorWinRate}`,
    `- Baseline novelty distance: ${analysis.gate.baselineDistance}`,
    `- Diversity distance: ${analysis.gate.diversityDistance}`,
    `- Minimum qualified strategies: ${analysis.gate.minQualified}`,
    `- Minimum per character: ${analysis.gate.minQualifiedPerCharacter || "not required"}`,
    `- Confidence pruning: GA ${formatPruneSchedule(analysis.gate.confidencePruning.gaRules)}, CEM/RL ${formatPruneSchedule(analysis.gate.confidencePruning.rlRules)}, ${percentFromConfig(analysis.gate.confidencePruning.z)} Wilson upper bound`,
    "",
    "## Planned Work",
    "",
    `- Characters: ${work.characterIds.join(", ")}`,
    `- Parallel jobs: ${formatNumber(work.parallelJobs)} worker(s), up to ${formatNumber(work.candidateJobs)} candidate(s) at once, ${formatNumber(work.parallelChunkGames)} games per main batch, ${formatNumber(work.earlyBatchGames)} games per early-prune batch, minimum ${formatNumber(work.minGamesPerWorker)} games per worker`,
    `- Racing stages: ${work.racingStages || "disabled"}${work.racingMinGames ? `, starts after ${formatNumber(work.racingMinGames)} games` : ""}, z=${work.racingZ}, GA keep ${work.gaRacingKeep || "auto"}, RL keep ${work.rlRacingKeep || "auto"}`,
    `- GA: ${formatNumber(work.gaCandidateEvaluations)} candidate evaluations / ${formatNumber(work.gaGames)} games`,
    `- CEM: ${formatNumber(work.cemCandidateEvaluations || 0)} candidate evaluations / ${formatNumber(work.cemGames || 0)} games`,
    `- RL: ${formatNumber(work.rlCandidateEvaluations)} candidate evaluations / ${formatNumber(work.rlGames)} games`,
    `- Final shortlist: ${formatNumber(work.finalCandidateEvaluations || 0)} seat series / ${formatNumber(work.finalCandidateGames || 0)} games`,
    `- Cross-play: ${formatNumber(work.crossSeatSeriesPerReport * work.crossReports)} seat series / ${formatNumber(work.crossGames)} games`,
    `- Total planned games: ${formatNumber(work.totalGames)}`,
    "",
    "## Success Criteria",
    "",
    ...analysis.successCriteria.map(item => `- ${item}`)
  ].join("\n");
}

function loadCompatibleCheckpoint(outputDir, config, resume) {
  if (!resume) return null;
  const filePath = path.join(outputDir, "checkpoint.json");
  const checkpoint = readJsonIfPresent(filePath);
  if (!checkpoint) return null;
  if (checkpoint.configFingerprint && checkpoint.configFingerprint !== configFingerprint(config)) {
    console.log(`Checkpoint ignored because config changed: ${filePath}`);
    return null;
  }
  if (checkpoint.config && configFingerprint(checkpoint.config) !== configFingerprint(config)) {
    console.log(`Checkpoint ignored because config changed: ${filePath}`);
    return null;
  }
  console.log(`Resuming from checkpoint: ${filePath}`);
  return checkpoint;
}

function createProgressTracker({ outputDir, config, characters, checkpoint = null, logIntervalMs = 5000 }) {
  const analysis = buildTrainingTargetAnalysis(config, characters);
  const filePath = path.join(outputDir, "training-progress.json");
  const startedAt = checkpoint?.progress?.startedAt || checkpoint?.startedAt || new Date().toISOString();
  const startedAtMs = Date.parse(startedAt) || Date.now();
  let completedGames = Number(checkpoint?.completedGames || checkpoint?.progress?.completedGames || 0);
  let lastWriteAt = 0;
  let lastLogAt = 0;
  const state = {
    startedAt,
    updatedAt: startedAt,
    status: "running",
    phase: "starting",
    config,
    analysis,
    progress: {
      completedGames,
      plannedGames: analysis.plannedWork.totalGames,
      percent: 0,
      elapsedMs: 0,
      elapsed: "0s",
      gamesPerSecond: 0,
      etaMs: null,
      eta: "unknown",
      pruningAdjustedPlannedGames: null,
      pruningAdjustedEtaMs: null,
      pruningAdjustedEta: "unknown"
    },
    current: null,
    outputs: {
      directory: outputDir,
      progress: filePath,
      checkpoint: path.join(outputDir, "checkpoint.json"),
      targetAnalysis: path.join(outputDir, "training-targets.md")
    }
  };

  function refreshMetrics() {
    const elapsedMs = Math.max(0, Date.now() - startedAtMs);
    const plannedGames = analysis.plannedWork.totalGames;
    const gamesPerSecond = elapsedMs > 0 ? completedGames / (elapsedMs / 1000) : 0;
    const remainingGames = Math.max(0, plannedGames - completedGames);
    const etaMs = gamesPerSecond > 0 ? (remainingGames / gamesPerSecond) * 1000 : null;
    const adjustedPlannedGames = state.progress.pruningAdjustedPlannedGames;
    const adjustedRemainingGames = Number.isFinite(adjustedPlannedGames)
      ? Math.max(0, adjustedPlannedGames - completedGames)
      : null;
    const adjustedEtaMs = gamesPerSecond > 0 && adjustedRemainingGames !== null
      ? (adjustedRemainingGames / gamesPerSecond) * 1000
      : null;
    const adjustedDetails = state.progress.pruningAdjustedDetails || null;
    state.updatedAt = new Date().toISOString();
    state.progress = {
      completedGames,
      plannedGames,
      percent: plannedGames ? round(Math.min(1, completedGames / plannedGames), 6) : 0,
      elapsedMs,
      elapsed: formatDuration(elapsedMs),
      gamesPerSecond: round(gamesPerSecond, 3),
      etaMs,
      eta: formatDuration(etaMs),
      pruningAdjustedPlannedGames: adjustedPlannedGames || null,
      pruningAdjustedPercent: adjustedPlannedGames ? round(Math.min(1, completedGames / adjustedPlannedGames), 6) : null,
      pruningAdjustedEtaMs: adjustedEtaMs,
      pruningAdjustedEta: formatDuration(adjustedEtaMs),
      pruningAdjustedDetails: adjustedDetails
    };
  }

  function line() {
    const pct = state.progress.plannedGames
      ? `${(state.progress.percent * 100).toFixed(1)}%`
      : `${formatNumber(state.progress.completedGames)} games`;
    const current = state.current || {};
    const estimate = current.estimate
      ? ` estWin ${(current.estimate.winRate * 100).toFixed(1)}% (${current.estimate.wins}/${current.estimate.games}, draw ${(current.estimate.drawRate * 100).toFixed(1)}%, 95% ${(current.estimate.ci95.low * 100).toFixed(1)}-${(current.estimate.ci95.high * 100).toFixed(1)}%)`
      : "";
    const label = current.label ? ` ${current.label}` : "";
    const adjustedEta = state.progress.pruningAdjustedPlannedGames
      ? `, adjusted ETA ${state.progress.pruningAdjustedEta}`
      : "";
    return `[${pct}] ${state.phase}${label}${estimate}; ${formatNumber(state.progress.completedGames)}/${formatNumber(state.progress.plannedGames)} games; ETA ${state.progress.eta}${adjustedEta}`;
  }

  function flush({ force = false, log = false } = {}) {
    refreshMetrics();
    const now = Date.now();
    if (force || now - lastWriteAt >= 1000) {
      writeJsonAtomic(filePath, state);
      lastWriteAt = now;
    }
    if (log && (force || now - lastLogAt >= logIntervalMs)) {
      console.log(line());
      lastLogAt = now;
    }
  }

  function addCompletedGames(count = 1, current = null) {
    completedGames += Math.max(0, Math.floor(Number(count) || 0));
    if (current) state.current = current;
    flush({ log: true });
  }

  return {
    filePath,
    analysis,
    state,
    completedGames: () => completedGames,
    setStatus(status, current = null, force = true) {
      state.status = status;
      if (current) state.current = current;
      flush({ force, log: force });
    },
    setPhase(phase, current = null, force = true) {
      state.phase = phase;
      if (current) state.current = current;
      flush({ force, log: force });
    },
    recordGame(current = null) {
      addCompletedGames(1, current);
    },
    recordGames(count = 1, current = null) {
      addCompletedGames(count, current);
    },
    updateCurrent(current = null, force = false) {
      if (current) state.current = current;
      flush({ force, log: force });
    },
    updateWorkEstimate(estimate = null, force = false) {
      state.progress.pruningAdjustedPlannedGames = estimate?.plannedGames || null;
      state.progress.pruningAdjustedDetails = estimate?.details || null;
      flush({ force, log: force });
    },
    finish(status = "completed") {
      state.status = status;
      state.phase = status;
      flush({ force: true, log: true });
    }
  };
}

function createCheckpointManager({ outputDir, config, checkpoint = null, progress = null }) {
  const filePath = path.join(outputDir, "checkpoint.json");
  const data = checkpoint || {};
  if (!data.startedAt) data.startedAt = new Date().toISOString();
  let lastWriteAt = 0;

  function save(force = false) {
    const now = Date.now();
    data.version = 1;
    data.updatedAt = new Date().toISOString();
    data.config = config;
    data.configFingerprint = configFingerprint(config);
    data.completedGames = progress ? progress.completedGames() : Number(data.completedGames || 0);
    data.progress = {
      startedAt: progress?.state?.startedAt || data.startedAt,
      completedGames: data.completedGames
    };
    if (force || now - lastWriteAt >= 2000) {
      writeJsonAtomic(filePath, data);
      lastWriteAt = now;
    }
  }

  return {
    filePath,
    data,
    save,
    update(mutator, force = false) {
      mutator(data);
      save(force);
    }
  };
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

function finalizeTotals(totals, strategyWeights, extra = {}) {
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
    strategyWeights,
    ...extra
  };
}

function mergeTotals(target, source) {
  [
    "games",
    "wins",
    "losses",
    "draws",
    "totalDurationMs",
    "totalHpDiff",
    "totalScoreDiff"
  ].forEach(key => {
    target[key] += Number(source[key] || 0);
  });
  return target;
}

function resumeFromRow(row) {
  if (!row) return null;
  return {
    nextIndex: row.games,
    totals: {
      characterId: row.characterId,
      strategyId: row.strategyId,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      totalDurationMs: row.totalDurationMs,
      totalHpDiff: row.totalHpDiff,
      totalScoreDiff: row.totalScoreDiff
    }
  };
}

function evaluateBasicChunk({ balance, character, candidate, seed, phase, startIndex, endIndex }) {
  const totals = emptyTotals(character.id, candidate.id);
  for (let index = startIndex; index < endIndex; index += 1) {
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
  return totals;
}

function eliteRacingPruneDecision(row, cutoffRow, keep, z, minGames) {
  if (!row || !cutoffRow || row.games < minGames || cutoffRow.games < minGames) return null;
  if (row.strategyId === cutoffRow.strategyId) return null;
  const rowInterval = wilsonInterval(row.wins || 0, row.games || 0, z);
  const cutoffInterval = wilsonInterval(cutoffRow.wins || 0, cutoffRow.games || 0, z);
  if (rowInterval.high >= cutoffInterval.low) return null;
  return {
    pruned: true,
    pruneMethod: "elite-racing-wilson",
    pruneAtGames: row.games,
    pruneTargetWinRate: round(cutoffInterval.low),
    pruneStage: `top-${keep}`,
    pruneCiZ: round(z),
    pruneCiLow: round(rowInterval.low),
    pruneCiHigh: round(rowInterval.high),
    pruneReason: `Wilson upper bound ${percentPrecise(rowInterval.high)} < top-${keep} lower bound ${percentPrecise(cutoffInterval.low)} after ${formatNumber(row.games)} games`
  };
}

function applyEliteRacing(states, { keep, z, minGames }) {
  const liveRows = states
    .filter(state => state.active && state.row && !state.row.pruned && state.row.games >= minGames)
    .map(state => state.row);
  if (liveRows.length <= keep) return 0;
  const ranked = [...liveRows].sort(compareRows);
  const cutoffRow = ranked[Math.min(keep, ranked.length) - 1];
  let pruned = 0;
  states.forEach(state => {
    if (!state.active || !state.row || state.row.pruned) return;
    const decision = eliteRacingPruneDecision(state.row, cutoffRow, keep, z, minGames);
    if (!decision) return;
    state.row = {
      ...state.row,
      ...decision,
      passedGate: false
    };
    state.active = false;
    pruned += 1;
  });
  return pruned;
}

function firstPruneMinGames(pruneRule) {
  const mins = (pruneRule?.rules || [])
    .map(rule => rule.minGames)
    .filter(value => Number.isFinite(value));
  return mins.length ? Math.min(...mins) : 0;
}

function openPruneMinGames(pruneRule) {
  const openRules = (pruneRule?.rules || []).filter(rule => rule.maxGames === null);
  return openRules.length ? Math.min(...openRules.map(rule => rule.minGames)) : 0;
}

function parallelBatchEnd(startIndex, runs, pruneRule, chunkGames, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES) {
  const openMinGames = openPruneMinGames(pruneRule);
  const earlyMode = pruneRule && openMinGames && startIndex < openMinGames;
  const requestedSize = earlyMode ? Math.min(earlyBatchGames, chunkGames) : chunkGames;
  let endIndex = Math.min(runs, startIndex + Math.max(1, requestedSize));
  const firstMinGames = firstPruneMinGames(pruneRule);
  if (firstMinGames && startIndex < firstMinGames && firstMinGames < endIndex) endIndex = firstMinGames;
  for (const rule of pruneRule?.rules || []) {
    if (rule.maxGames !== null && startIndex < rule.maxGames && rule.maxGames < endIndex) endIndex = rule.maxGames;
  }
  return Math.max(startIndex + 1, endIndex);
}

function splitRange(startIndex, endIndex, jobs, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER) {
  const games = endIndex - startIndex;
  const maxUsefulWorkers = Math.max(1, Math.floor(games / Math.max(1, minGamesPerWorker)));
  const workerCount = Math.min(Math.max(1, jobs), games, maxUsefulWorkers);
  const base = Math.floor(games / workerCount);
  const remainder = games % workerCount;
  const ranges = [];
  let cursor = startIndex;
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    const size = base + (workerIndex < remainder ? 1 : 0);
    ranges.push({ startIndex: cursor, endIndex: cursor + size });
    cursor += size;
  }
  return ranges;
}

class StrategyWorkerPool {
  constructor(size) {
    this.size = Math.max(1, Math.floor(Number(size) || 1));
    this.queue = [];
    this.workers = [];
    this.closed = false;
    this.nextTaskId = 1;
    for (let index = 0; index < this.size; index += 1) {
      this.workers.push(this.createWorker());
    }
  }

  createWorker() {
    const state = {
      worker: new Worker(__filename),
      busy: false,
      current: null
    };
    state.worker.on("message", message => this.handleMessage(state, message));
    state.worker.on("error", error => this.handleWorkerFailure(state, error));
    state.worker.on("exit", code => {
      if (!this.closed && code !== 0) {
        this.handleWorkerFailure(state, new Error(`Strategy optimization worker exited with code ${code}.`));
      }
    });
    return state;
  }

  run(payload) {
    if (this.closed) return Promise.reject(new Error("Strategy worker pool is closed."));
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: this.nextTaskId,
        payload: { ...payload, id: this.nextTaskId },
        resolve,
        reject
      });
      this.nextTaskId += 1;
      this.pump();
    });
  }

  pump() {
    for (const state of this.workers) {
      if (!this.queue.length) return;
      if (state.busy) continue;
      const task = this.queue.shift();
      state.busy = true;
      state.current = task;
      state.worker.postMessage(task.payload);
    }
  }

  handleMessage(state, message) {
    const task = state.current;
    state.current = null;
    state.busy = false;
    if (task) {
      if (message?.error) task.reject(new Error(message.error));
      else task.resolve(message);
    }
    this.pump();
  }

  handleWorkerFailure(state, error) {
    const task = state.current;
    state.current = null;
    state.busy = false;
    if (task) task.reject(error);
    const index = this.workers.indexOf(state);
    if (index >= 0) {
      this.workers.splice(index, 1);
      if (!this.closed) this.workers.push(this.createWorker());
    }
    this.pump();
  }

  async close() {
    this.closed = true;
    const queued = this.queue.splice(0);
    queued.forEach(task => task.reject(new Error("Strategy worker pool closed before task started.")));
    await Promise.allSettled(this.workers.map(state => state.worker.terminate()));
    this.workers = [];
  }
}

function runWorkerChunk(payload, pool = null) {
  if (pool) return pool.run(payload);
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: payload });
    let settled = false;
    function finish(error, message) {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(message);
    }
    worker.once("message", message => {
      if (message && message.error) finish(new Error(message.error));
      else finish(null, message);
    });
    worker.once("error", error => finish(error));
    worker.once("exit", code => {
      if (code !== 0) finish(new Error(`Strategy optimization worker exited with code ${code}.`));
    });
  });
}

function evaluateAgainstBasic({ balance, character, candidate, runs, seed, phase, resume = null, onProgress = null, pruneRule = null }) {
  const totals = resume?.totals ? { ...emptyTotals(character.id, candidate.id), ...clone(resume.totals) } : emptyTotals(character.id, candidate.id);
  const startIndex = Math.max(0, Math.min(runs, Math.floor(Number(resume?.nextIndex || 0))));
  const resumedPrune = confidencePruneDecision(totals, pruneRule);
  if (resumedPrune) return finalizeTotals(totals, candidate.strategyWeights, { ...resumedPrune, passedGate: false });
  for (let index = startIndex; index < runs; index += 1) {
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
    if (typeof onProgress === "function") {
      onProgress({
        nextIndex: index + 1,
        gamesCompleted: 1,
        runs,
        totals: clone(totals),
        estimate: withWinRateEstimate(finalizeTotals(totals, candidate.strategyWeights))
      });
    }
    const prune = confidencePruneDecision(totals, pruneRule);
    if (prune) return finalizeTotals(totals, candidate.strategyWeights, { ...prune, passedGate: false });
  }
  return finalizeTotals(totals, candidate.strategyWeights);
}

async function evaluateAgainstBasicParallel({ balance, character, candidate, runs, seed, phase, resume = null, onProgress = null, pruneRule = null, jobs = DEFAULT_JOBS, parallelChunkGames = DEFAULT_PARALLEL_CHUNK_GAMES, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER, workerPool = null }) {
  const workerJobs = Math.max(1, Math.floor(Number(jobs) || DEFAULT_JOBS));
  const chunkGames = Math.max(1, Math.floor(Number(parallelChunkGames) || DEFAULT_PARALLEL_CHUNK_GAMES));
  const earlyGames = Math.max(1, Math.floor(Number(earlyBatchGames) || DEFAULT_EARLY_BATCH_GAMES));
  const minWorkerGames = Math.max(1, Math.floor(Number(minGamesPerWorker) || DEFAULT_MIN_GAMES_PER_WORKER));
  if (workerJobs <= 1) {
    return evaluateAgainstBasic({ balance, character, candidate, runs, seed, phase, resume, onProgress, pruneRule });
  }

  const totals = resume?.totals ? { ...emptyTotals(character.id, candidate.id), ...clone(resume.totals) } : emptyTotals(character.id, candidate.id);
  let nextIndex = Math.max(0, Math.min(runs, Math.floor(Number(resume?.nextIndex || 0))));
  const resumedPrune = confidencePruneDecision(totals, pruneRule);
  if (resumedPrune) return finalizeTotals(totals, candidate.strategyWeights, { ...resumedPrune, passedGate: false });

  while (nextIndex < runs) {
    const batchStart = nextIndex;
    const batchEnd = parallelBatchEnd(batchStart, runs, pruneRule, chunkGames, earlyGames);
    const ranges = splitRange(batchStart, batchEnd, workerJobs, minWorkerGames);
    const chunks = await Promise.all(ranges.map(range => runWorkerChunk({
      task: "evaluate-basic-chunk",
      balance,
      character,
      candidate,
      seed,
      phase,
      startIndex: range.startIndex,
      endIndex: range.endIndex
    }, workerPool)));
    chunks.forEach(chunk => mergeTotals(totals, chunk.totals));
    nextIndex = batchEnd;

    if (typeof onProgress === "function") {
      onProgress({
        nextIndex,
        gamesCompleted: batchEnd - batchStart,
        runs,
        totals: clone(totals),
        estimate: withWinRateEstimate(finalizeTotals(totals, candidate.strategyWeights))
      });
    }

    const prune = confidencePruneDecision(totals, pruneRule);
    if (prune) return finalizeTotals(totals, candidate.strategyWeights, { ...prune, passedGate: false });
  }
  return finalizeTotals(totals, candidate.strategyWeights);
}

async function evaluateCandidateSetParallel({ balance, character, candidates, runs, seed, phase, pruneRule = null, jobs = DEFAULT_JOBS, candidateJobs = DEFAULT_CANDIDATE_JOBS, parallelChunkGames = DEFAULT_PARALLEL_CHUNK_GAMES, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER, workerPool = null, resumeForCandidate = null, onCandidateProgress = null }) {
  const activeCandidates = Math.max(1, Math.min(candidates.length, Math.floor(Number(candidateJobs) || DEFAULT_CANDIDATE_JOBS)));
  const jobsPerCandidate = Math.max(1, Math.floor(Math.max(1, Math.floor(Number(jobs) || DEFAULT_JOBS)) / activeCandidates));
  const rows = new Array(candidates.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < candidates.length) {
      const candidateIndex = cursor;
      cursor += 1;
      const candidate = candidates[candidateIndex];
      rows[candidateIndex] = await evaluateAgainstBasicParallel({
        balance,
        character,
        candidate,
        runs,
        seed,
        phase,
        resume: typeof resumeForCandidate === "function" ? resumeForCandidate(candidate, candidateIndex) : null,
        pruneRule,
        jobs: jobsPerCandidate,
        parallelChunkGames,
        earlyBatchGames,
        minGamesPerWorker,
        workerPool,
        onProgress: partial => {
          onCandidateProgress?.({
            candidate,
            candidateIndex,
            candidateCount: candidates.length,
            partial
          });
        }
      });
    }
  }

  await Promise.all(Array.from({ length: activeCandidates }, runNext));
  return rows;
}

async function evaluateCandidateSetStaged({ balance, character, candidates, runs, seed, phase, pruneRule = null, jobs = DEFAULT_JOBS, candidateJobs = DEFAULT_CANDIDATE_JOBS, parallelChunkGames = DEFAULT_PARALLEL_CHUNK_GAMES, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER, workerPool = null, racingStages = [], racingKeep = 1, racingMinGames = 0, racingZ = DEFAULT_PRUNE_CI_Z, onCandidateProgress = null, onStageComplete = null }) {
  const stages = [...new Set([...racingStages, runs]
    .map(stage => Math.max(1, Math.min(runs, Math.floor(Number(stage) || runs))))
    .sort((left, right) => left - right))];
  const states = candidates.map((candidate, candidateIndex) => ({
    candidate,
    candidateIndex,
    active: true,
    row: null
  }));

  for (const stageRuns of stages) {
    const activeStates = states.filter(state => state.active && (!state.row || state.row.games < stageRuns));
    if (activeStates.length) {
      const stageRows = await evaluateCandidateSetParallel({
        balance,
        character,
        candidates: activeStates.map(state => state.candidate),
        runs: stageRuns,
        seed,
        phase,
        pruneRule,
        jobs,
        candidateJobs,
        parallelChunkGames,
        earlyBatchGames,
        minGamesPerWorker,
        workerPool,
        onCandidateProgress: ({ candidateIndex, partial }) => {
          const state = activeStates[candidateIndex];
          onCandidateProgress?.({
            candidate: state.candidate,
            candidateIndex: state.candidateIndex,
            candidateCount: candidates.length,
            stageRuns,
            partial
          });
        },
        resumeForCandidate: (_candidate, candidateIndex) => resumeFromRow(activeStates[candidateIndex].row)
      });
      stageRows.forEach((row, index) => {
        const state = activeStates[index];
        state.row = row;
        if (row.pruned || row.games >= runs) state.active = false;
      });
    }

    if (stageRuns >= racingMinGames && racingKeep > 0) {
      applyEliteRacing(states, {
        keep: Math.max(1, Math.min(racingKeep, states.length)),
        z: racingZ,
        minGames: racingMinGames
      });
    }
    onStageComplete?.({
      stageRuns,
      activeCount: states.filter(state => state.active).length,
      prunedCount: states.filter(state => state.row?.pruned).length
    });
  }

  return states.map(state => state.row || finalizeTotals(emptyTotals(character.id, state.candidate.id), state.candidate.strategyWeights, {
    pruned: true,
    pruneMethod: "not-evaluated",
    pruneAtGames: 0,
    pruneReason: "Candidate was not evaluated."
  }));
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

function characterQualifiedCount(rows, characterId, minDistance) {
  return selectDiverse(qualifiedRows(rows).filter(row => row.characterId === characterId), minDistance).length;
}

function characterQualifiedComplete(rows, character, minDistance, target) {
  return Boolean(target) && characterQualifiedCount(rows, character.id, minDistance) >= target;
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

async function runGaSearch({ balance, characters, seed, runs, rounds, populationSize, eliteCount, diversityDistance, baselineDistance, minQualified, minQualifiedPerCharacter, durationHours, outputDir, progress = null, checkpointManager = null, pruneRule = null, jobs = DEFAULT_JOBS, candidateJobs = DEFAULT_CANDIDATE_JOBS, parallelChunkGames = DEFAULT_PARALLEL_CHUNK_GAMES, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER, workerPool = null, racingStages = [], racingMinGames = 0, racingZ = DEFAULT_PRUNE_CI_Z, racingKeep = 0 }) {
  const rng = createRng(`${seed}:ga`);
  const saved = checkpointManager?.data?.ga;
  const populations = saved?.populations
    ? mapFromObject(saved.populations)
    : new Map(characters.map(character => [character.id, seedPopulation(character, rng, populationSize)]));
  const allRows = saved?.allRows || [];
  const history = saved?.history || [];
  const bestByCharacter = saved?.bestByCharacter ? mapFromObject(saved.bestByCharacter) : new Map();
  const deadlineMs = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null;
  let roundIndex = saved?.completed
    ? saved?.roundIndex || 0
    : saved?.current?.round
      ? saved.current.round - 1
      : saved?.roundIndex || 0;
  let stopReason = saved?.stopReason || "rounds";

  if (saved?.completed) {
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
    progress?.setPhase("ga", { label: "restored completed GA checkpoint" }, true);
    return { allRows, diverseQualified, perCharacterQualified, bestByCharacter, history, stopReason, rounds: roundIndex };
  }

  function saveGaCheckpoint(extra = {}, force = false) {
    checkpointManager?.update(data => {
      data.status = "running";
      data.phase = "ga";
      data.ga = {
        ...(data.ga || {}),
        allRows,
        history,
        bestByCharacter: objectFromMap(bestByCharacter),
        populations: objectFromMap(populations),
        roundIndex,
        stopReason,
        completed: false,
        ...extra
      };
    }, force);
  }

  saveGaCheckpoint({}, true);

  while (roundIndex < rounds || (deadlineMs && Date.now() < deadlineMs)) {
    if (deadlineMs && Date.now() >= deadlineMs) {
      stopReason = "duration";
      break;
    }
    if (minQualifiedPerCharacter && perCharacterQualifiedComplete(allRows, characters, diversityDistance, minQualifiedPerCharacter)) {
      stopReason = "per-character-qualified";
      break;
    }
    const resumedCurrent = saved?.current && saved.current.round === roundIndex + 1 ? saved.current : null;
    roundIndex += 1;
    const characterStart = resumedCurrent ? resumedCurrent.characterIndex || 0 : 0;
    for (let characterIndex = characterStart; characterIndex < characters.length; characterIndex += 1) {
      const character = characters[characterIndex];
      const population = populations.get(character.id);
      const continuingCharacter = resumedCurrent
        && resumedCurrent.round === roundIndex
        && resumedCurrent.characterId === character.id;
      if (!continuingCharacter && characterQualifiedComplete(allRows, character, diversityDistance, minQualifiedPerCharacter)) {
        const qualifiedCount = characterQualifiedCount(allRows, character.id, diversityDistance);
        const previousBest = bestByCharacter.get(character.id);
        history.push({
          round: roundIndex,
          characterId: character.id,
          skipped: true,
          reason: "per-character-qualified",
          bestStrategyId: previousBest?.strategyId,
          bestWinRate: previousBest?.winRate,
          qualified: qualifiedCount
        });
        console.log(`GA ${character.id} round ${roundIndex}${deadlineMs ? "" : `/${rounds}`}: skipped, ${qualifiedCount}/${minQualifiedPerCharacter} qualified strategies already available`);
        progress?.setPhase("ga", {
          label: `${character.id} round ${roundIndex} skipped, qualified ${qualifiedCount}/${minQualifiedPerCharacter}`,
          estimate: previousBest ? withWinRateEstimate(previousBest) : null
        }, true);
        saveGaCheckpoint({
          current: {
            round: roundIndex,
            characterIndex: characterIndex + 1,
            characterId: character.id,
            candidateIndex: population.length,
            rankedDraft: [],
            partial: null,
            skipped: true
          }
        }, true);
        continue;
      }
      const rankedDraft = continuingCharacter ? (resumedCurrent.rankedDraft || []) : [];
      const runCandidatesInParallel = !continuingCharacter && !deadlineMs && Math.floor(Number(candidateJobs) || 1) > 1;
      if (runCandidatesInParallel) {
        progress?.setPhase("ga", {
          label: `${character.id} round ${roundIndex}${deadlineMs ? "" : `/${rounds}`} candidates 1-${population.length}/${population.length}`
        }, characterIndex === characterStart);
        saveGaCheckpoint({
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: 0,
            rankedDraft: [],
            partial: null,
            parallelCandidates: true
          }
        }, true);
        const rows = (racingStages || []).length
          ? await evaluateCandidateSetStaged({
              balance,
              character,
              candidates: population,
              runs,
              seed,
              phase: `ga-round-${roundIndex}`,
              pruneRule,
              jobs,
              candidateJobs,
              parallelChunkGames,
              earlyBatchGames,
              minGamesPerWorker,
              workerPool,
              racingStages,
              racingKeep: racingKeep || Math.max(eliteCount, Math.ceil(population.length / 3)),
              racingMinGames,
              racingZ,
              onCandidateProgress: ({ candidateIndex, partial }) => {
                progress?.recordGames(partial.gamesCompleted || 1, {
                  label: `${character.id} GA r${roundIndex} candidate ${candidateIndex + 1}/${population.length}`,
                  estimate: partial.estimate
                });
              },
              onStageComplete: ({ stageRuns, activeCount, prunedCount }) => {
                progress?.updateCurrent({
                  label: `${character.id} GA r${roundIndex} stage ${stageRuns}, active ${activeCount}, pruned ${prunedCount}`
                });
              }
            })
          : await evaluateCandidateSetParallel({
          balance,
          character,
          candidates: population,
          runs,
          seed,
          phase: `ga-round-${roundIndex}`,
          pruneRule,
          jobs,
          candidateJobs,
          parallelChunkGames,
          earlyBatchGames,
          minGamesPerWorker,
          workerPool,
          onCandidateProgress: ({ candidateIndex, partial }) => {
            progress?.recordGames(partial.gamesCompleted || 1, {
              label: `${character.id} GA r${roundIndex} candidate ${candidateIndex + 1}/${population.length}`,
              estimate: partial.estimate
            });
          }
        });
        rows.forEach(row => rankedDraft.push(annotateNovelty(row, baselineDistance)));
        saveGaCheckpoint({
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: population.length,
            rankedDraft,
            partial: null
          }
        }, true);
      }
      for (let candidateIndex = runCandidatesInParallel ? population.length : rankedDraft.length; candidateIndex < population.length; candidateIndex += 1) {
        const candidate = population[candidateIndex];
        const continuingCandidate = continuingCharacter
          && resumedCurrent.candidateIndex === candidateIndex
          && resumedCurrent.candidateId === candidate.id;
        progress?.setPhase("ga", {
          label: `${character.id} round ${roundIndex}${deadlineMs ? "" : `/${rounds}`} candidate ${candidateIndex + 1}/${population.length}`
        }, candidateIndex === 0);
        saveGaCheckpoint({
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex,
            candidateId: candidate.id,
            rankedDraft,
            partial: continuingCandidate ? resumedCurrent.partial || null : null
          }
        }, true);
        const rankedRow = await evaluateAgainstBasicParallel({
          balance,
          character,
          candidate,
          runs,
          seed,
          phase: `ga-round-${roundIndex}`,
          resume: continuingCandidate ? resumedCurrent.partial : null,
          pruneRule,
          jobs,
          parallelChunkGames,
          earlyBatchGames,
          minGamesPerWorker,
          workerPool,
          onProgress: partial => {
            progress?.recordGames(partial.gamesCompleted || 1, {
              label: `${character.id} GA r${roundIndex} candidate ${candidateIndex + 1}/${population.length}`,
              estimate: partial.estimate
            });
            saveGaCheckpoint({
              current: {
                round: roundIndex,
                characterIndex,
                characterId: character.id,
                candidateIndex,
                candidateId: candidate.id,
                rankedDraft,
                partial: {
                  nextIndex: partial.nextIndex,
                  totals: partial.totals
                }
              }
            });
          }
        });
        rankedDraft.push(annotateNovelty(rankedRow, baselineDistance));
        saveGaCheckpoint({
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: candidateIndex + 1,
            rankedDraft,
            partial: null
          }
        }, true);
      }
      const ranked = rankedDraft.sort(compareRows);
      ranked.forEach(row => allRows.push({ ...row, phase: "ga", round: roundIndex }));
      if (progress?.analysis) {
        const estimate = effectiveWorkEstimate(progress.analysis, { gaRows: allRows });
        if (estimate) progress.updateWorkEstimate(estimate);
      }
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
      saveGaCheckpoint({
        current: {
          round: roundIndex,
          characterIndex: characterIndex + 1,
          characterId: character.id,
          candidateIndex: population.length,
          rankedDraft: [],
          partial: null
        }
      }, true);
    }
    saveGaCheckpoint({ current: null }, true);
    const qualified = selectDiverse(qualifiedRows(allRows), diversityDistance);
    const perCharacter = diverseQualifiedByCharacter(allRows, characters, diversityDistance);
    const perCharacterText = characters.map(character => `${character.id}:${perCharacter[character.id].length}`).join(" ");
    const bestText = characters.map(character => {
      const best = bestByCharacter.get(character.id);
      return `${character.id}:${best ? percent(best.winRate) : "-"}`;
    }).join(" ");
    console.log(`GA round ${roundIndex}${deadlineMs ? "" : `/${rounds}`}: ${qualified.length} diverse qualified strategies (${perCharacterText}); best win ${bestText}`);
    progress?.updateCurrent({
      label: `GA round ${roundIndex} complete, qualified ${qualified.length}`,
      estimate: qualified[0] ? withWinRateEstimate(qualified[0]) : null
    }, true);
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
  checkpointManager?.update(data => {
    data.phase = "ga";
    data.ga = {
      ...(data.ga || {}),
      allRows,
      history,
      bestByCharacter: objectFromMap(bestByCharacter),
      populations: objectFromMap(populations),
      roundIndex,
      stopReason,
      completed: true,
      current: null
    };
  }, true);
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

function normalizeSigmaVector(sigma, fallback = DEFAULT_CEM_SIGMA, minSigma = DEFAULT_CEM_MIN_SIGMA) {
  const fallbackValue = Math.max(minSigma, Number(fallback) || DEFAULT_CEM_SIGMA);
  if (Array.isArray(sigma) && sigma.length === tunedKeys.length) {
    return sigma.map(value => round(clamp(Number(value) || fallbackValue, minSigma, WEIGHT_MAX), 4));
  }
  return Array.from({ length: tunedKeys.length }, () => round(fallbackValue, 4));
}

function weightedStdVector(rows, weights, center, fallbackSigma, minSigma = DEFAULT_CEM_MIN_SIGMA) {
  const fallback = normalizeSigmaVector(fallbackSigma, DEFAULT_CEM_SIGMA, minSigma);
  if (!rows.length) return fallback;
  return center.map((centerValue, vectorIndex) => {
    const variance = rows.reduce((sum, row, rowIndex) => {
      const vector = weightsToVector(row.strategyWeights);
      return sum + (weights[rowIndex] || 0) * ((vector[vectorIndex] - centerValue) ** 2);
    }, 0);
    const raw = Math.sqrt(Math.max(0, variance));
    const fallbackValue = rows.length > 1 ? fallback[vectorIndex] * 0.85 : fallback[vectorIndex];
    return round(clamp(raw || fallbackValue, minSigma, WEIGHT_MAX), 4);
  });
}

function blendVector(current, target, smoothing) {
  const alpha = clamp(Number(smoothing) || DEFAULT_CEM_SMOOTHING, 0, 1);
  return current.map((value, index) => round(clamp(value * (1 - alpha) + target[index] * alpha), 4));
}

function blendSigmaVector(current, target, smoothing, minSigma = DEFAULT_CEM_MIN_SIGMA) {
  const alpha = clamp(Number(smoothing) || DEFAULT_CEM_SMOOTHING, 0, 1);
  const currentSigma = normalizeSigmaVector(current, DEFAULT_CEM_SIGMA, minSigma);
  const targetSigma = normalizeSigmaVector(target, DEFAULT_CEM_SIGMA, minSigma);
  return currentSigma.map((value, index) => round(clamp(value * (1 - alpha) + targetSigma[index] * alpha, minSigma, WEIGHT_MAX), 4));
}

function sampleAroundDiagonal(prefix, center, sigma, rng, count) {
  const sigmaVector = normalizeSigmaVector(sigma);
  return Array.from({ length: count }, (_, index) => {
    const vector = center.map((value, vectorIndex) => round(clamp(value + gaussian(rng) * sigmaVector[vectorIndex]), 4));
    return makeStrategy(`${prefix}-sample-${index}-${Math.floor(rng.next() * 1e9)}`, vectorToWeights(vector));
  });
}

function cemSeedRowsForCharacter(gaRows, bestByCharacter, character, minimumRows) {
  const rows = [...gaRows]
    .filter(row => row.characterId === character.id)
    .sort(compareRows)
    .slice(0, Math.max(1, minimumRows));
  const fallback = bestByCharacter.get(character.id);
  if (rows.length) return rows;
  if (fallback) return [fallback];
  return [{
    characterId: character.id,
    strategyId: `${character.id}-role-base`,
    strategyWeights: roleAdjustedBaseWeights(character),
    reward: 0.5,
    winRate: 0.5
  }];
}

function createCemState(seedRows, sigma, minSigma, temperature) {
  const weights = softmaxWeights(seedRows, temperature);
  const center = weightedMean(seedRows, weights);
  return {
    center,
    sigma: weightedStdVector(seedRows, weights, center, sigma, minSigma),
    best: null,
    rounds: 0
  };
}

function mergeBestByCharacter(primary, secondary) {
  const merged = new Map(primary || []);
  for (const [characterId, row] of secondary || []) {
    const existing = merged.get(characterId);
    if (!existing || compareRows(row, existing) < 0) merged.set(characterId, row);
  }
  return merged;
}

function disabledCemResult() {
  return {
    allRows: [],
    diverseQualified: [],
    perCharacterQualified: {},
    bestByCharacter: new Map(),
    history: [],
    stopReason: "disabled",
    rounds: 0
  };
}

function writeCemOutputs({ outputDir, allRows, history, diversityDistance, baselineDistance, rounds, runs, samples, eliteCount, sigma, minSigma, smoothing, temperature, stopReason, characters }) {
  const diverseQualified = selectDiverse(qualifiedRows(allRows), diversityDistance);
  const perCharacterQualified = diverseQualifiedByCharacter(allRows, characters, diversityDistance);
  writeJson(path.join(outputDir, "cem-history.json"), history);
  writeJson(path.join(outputDir, "cem-qualified.json"), {
    gate: "winRate = wins / (wins + losses + draws) > 0.5",
    method: "diagonal cross-entropy method",
    diversityDistance,
    baselineDistance,
    rounds,
    runs,
    samples,
    eliteCount,
    sigma,
    minSigma,
    smoothing,
    temperature,
    stopReason,
    qualifiedCount: diverseQualified.length,
    perCharacterQualified: Object.fromEntries(Object.entries(perCharacterQualified).map(([characterId, rows]) => [characterId, rows.length])),
    strategies: diverseQualified
  });
  writeCsv(path.join(outputDir, "cem-qualified.csv"), rowsToCsv(diverseQualified));
  return { diverseQualified, perCharacterQualified };
}

async function runCemRefinement({ balance, characters, gaRows, bestByCharacter, seed, runs, rounds, samples, eliteCount, sigma, minSigma, smoothing, temperature, diversityDistance, baselineDistance, outputDir, progress = null, checkpointManager = null, pruneRule = null, jobs = DEFAULT_JOBS, candidateJobs = DEFAULT_CANDIDATE_JOBS, parallelChunkGames = DEFAULT_PARALLEL_CHUNK_GAMES, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER, workerPool = null, racingStages = [], racingMinGames = 0, racingZ = DEFAULT_PRUNE_CI_Z, racingKeep = 0 }) {
  if (!rounds) return disabledCemResult();
  const rng = createRng(`${seed}:cem`);
  const saved = checkpointManager?.data?.cem;
  const normalizedEliteCount = Math.max(1, Math.min(samples + 1, Math.floor(Number(eliteCount) || DEFAULT_CEM_ELITES)));
  const allRows = saved?.allRows || [];
  const history = saved?.history || [];
  const cemBestByCharacter = saved?.bestByCharacter ? mapFromObject(saved.bestByCharacter) : new Map();
  const initialStates = new Map(characters.map(character => {
    const seedRows = cemSeedRowsForCharacter(gaRows, bestByCharacter, character, Math.max(normalizedEliteCount, samples));
    return [character.id, createCemState(seedRows, sigma, minSigma, temperature)];
  }));
  const states = saved?.states ? mapFromObject(saved.states) : initialStates;
  let roundIndex = saved?.completed
    ? saved?.roundIndex || 0
    : saved?.current?.round
      ? saved.current.round - 1
      : saved?.roundIndex || 0;
  let stopReason = saved?.stopReason || "rounds";

  if (saved?.completed) {
    const { diverseQualified, perCharacterQualified } = writeCemOutputs({
      outputDir,
      allRows,
      history,
      diversityDistance,
      baselineDistance,
      rounds: roundIndex,
      runs,
      samples,
      eliteCount: normalizedEliteCount,
      sigma,
      minSigma,
      smoothing,
      temperature,
      stopReason,
      characters
    });
    progress?.setPhase("cem", { label: "restored completed CEM checkpoint" }, true);
    return { allRows, diverseQualified, perCharacterQualified, bestByCharacter: cemBestByCharacter, history, stopReason, rounds: roundIndex };
  }

  function saveCemCheckpoint(extra = {}, force = false) {
    checkpointManager?.update(data => {
      data.status = "running";
      data.phase = "cem";
      data.cem = {
        ...(data.cem || {}),
        allRows,
        history,
        states: objectFromMap(states),
        bestByCharacter: objectFromMap(cemBestByCharacter),
        roundIndex,
        stopReason,
        completed: false,
        ...extra
      };
    }, force);
  }

  saveCemCheckpoint({ roundIndex }, true);
  while (roundIndex < rounds) {
    const resumedCurrent = saved?.current && saved.current.round === roundIndex + 1 ? saved.current : null;
    roundIndex += 1;
    const characterStart = resumedCurrent ? resumedCurrent.characterIndex || 0 : 0;
    for (let characterIndex = characterStart; characterIndex < characters.length; characterIndex += 1) {
      const character = characters[characterIndex];
      const state = states.get(character.id);
      const continuingCharacter = resumedCurrent
        && resumedCurrent.round === roundIndex
        && resumedCurrent.characterId === character.id;
      const candidates = continuingCharacter && resumedCurrent.candidates
        ? resumedCurrent.candidates
        : [
            makeStrategy(`${character.id}-cem${roundIndex}-center`, vectorToWeights(state.center)),
            ...sampleAroundDiagonal(`${character.id}-cem${roundIndex}`, state.center, state.sigma, rng, samples)
          ];
      const rankedDraft = continuingCharacter ? (resumedCurrent.rankedDraft || []) : [];
      const runCandidatesInParallel = !continuingCharacter && Math.floor(Number(candidateJobs) || 1) > 1;
      if (runCandidatesInParallel) {
        progress?.setPhase("cem", {
          label: `${character.id} round ${roundIndex}/${rounds} candidates 1-${candidates.length}/${candidates.length}`
        }, characterIndex === characterStart);
        saveCemCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: 0,
            candidateId: null,
            candidates,
            rankedDraft: [],
            partial: null,
            parallelCandidates: true
          }
        }, true);
        const rows = (racingStages || []).length
          ? await evaluateCandidateSetStaged({
              balance,
              character,
              candidates,
              runs,
              seed,
              phase: `cem-round-${roundIndex}`,
              pruneRule,
              jobs,
              candidateJobs,
              parallelChunkGames,
              earlyBatchGames,
              minGamesPerWorker,
              workerPool,
              racingStages,
              racingKeep: racingKeep || Math.max(normalizedEliteCount, Math.ceil(candidates.length / 3)),
              racingMinGames,
              racingZ,
              onCandidateProgress: ({ candidateIndex, partial }) => {
                progress?.recordGames(partial.gamesCompleted || 1, {
                  label: `${character.id} CEM r${roundIndex} candidate ${candidateIndex + 1}/${candidates.length}`,
                  estimate: partial.estimate
                });
              },
              onStageComplete: ({ stageRuns, activeCount, prunedCount }) => {
                progress?.updateCurrent({
                  label: `${character.id} CEM r${roundIndex} stage ${stageRuns}, active ${activeCount}, pruned ${prunedCount}`
                });
              }
            })
          : await evaluateCandidateSetParallel({
              balance,
              character,
              candidates,
              runs,
              seed,
              phase: `cem-round-${roundIndex}`,
              pruneRule,
              jobs,
              candidateJobs,
              parallelChunkGames,
              earlyBatchGames,
              minGamesPerWorker,
              workerPool,
              onCandidateProgress: ({ candidateIndex, partial }) => {
                progress?.recordGames(partial.gamesCompleted || 1, {
                  label: `${character.id} CEM r${roundIndex} candidate ${candidateIndex + 1}/${candidates.length}`,
                  estimate: partial.estimate
                });
              }
            });
        rows.forEach(row => rankedDraft.push(annotateNovelty(row, baselineDistance)));
        saveCemCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: candidates.length,
            candidateId: null,
            candidates,
            rankedDraft,
            partial: null
          }
        }, true);
      }
      for (let candidateIndex = runCandidatesInParallel ? candidates.length : rankedDraft.length; candidateIndex < candidates.length; candidateIndex += 1) {
        const candidate = candidates[candidateIndex];
        const continuingCandidate = continuingCharacter
          && resumedCurrent.candidateIndex === candidateIndex
          && resumedCurrent.candidateId === candidate.id;
        progress?.setPhase("cem", {
          label: `${character.id} round ${roundIndex}/${rounds} candidate ${candidateIndex + 1}/${candidates.length}`
        }, candidateIndex === 0);
        saveCemCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex,
            candidateId: candidate.id,
            candidates,
            rankedDraft,
            partial: continuingCandidate ? resumedCurrent.partial || null : null
          }
        }, true);
        const row = await evaluateAgainstBasicParallel({
          balance,
          character,
          candidate,
          runs,
          seed,
          phase: `cem-round-${roundIndex}`,
          resume: continuingCandidate ? resumedCurrent.partial : null,
          pruneRule,
          jobs,
          parallelChunkGames,
          earlyBatchGames,
          minGamesPerWorker,
          workerPool,
          onProgress: partial => {
            progress?.recordGames(partial.gamesCompleted || 1, {
              label: `${character.id} CEM r${roundIndex} candidate ${candidateIndex + 1}/${candidates.length}`,
              estimate: partial.estimate
            });
            saveCemCheckpoint({
              roundIndex,
              current: {
                round: roundIndex,
                characterIndex,
                characterId: character.id,
                candidateIndex,
                candidateId: candidate.id,
                candidates,
                rankedDraft,
                partial: {
                  nextIndex: partial.nextIndex,
                  totals: partial.totals
                }
              }
            });
          }
        });
        rankedDraft.push(annotateNovelty(row, baselineDistance));
        saveCemCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: candidateIndex + 1,
            candidateId: candidate.id,
            candidates,
            rankedDraft,
            partial: null
          }
        }, true);
      }
      const ranked = rankedDraft.sort(compareRows);
      ranked.forEach(row => allRows.push({ ...row, phase: "cem", round: roundIndex }));
      writeJson(path.join(outputDir, "cem", `${character.id}-round-${roundIndex}.json`), ranked);
      const previousBest = cemBestByCharacter.get(character.id);
      if (!previousBest || compareRows(ranked[0], previousBest) < 0) cemBestByCharacter.set(character.id, ranked[0]);
      if (!state.best || compareRows(ranked[0], state.best) < 0) state.best = ranked[0];
      const eliteRows = ranked.slice(0, Math.max(1, Math.min(normalizedEliteCount, ranked.length)));
      const eliteWeights = softmaxWeights(eliteRows, temperature);
      const targetCenter = weightedMean(eliteRows, eliteWeights);
      const targetSigma = weightedStdVector(eliteRows, eliteWeights, targetCenter, state.sigma, minSigma);
      state.center = blendVector(state.center, targetCenter, smoothing);
      state.sigma = blendSigmaVector(state.sigma, targetSigma, smoothing, minSigma);
      state.rounds = roundIndex;
      history.push({
        characterId: character.id,
        round: roundIndex,
        bestStrategyId: ranked[0].strategyId,
        bestWinRate: ranked[0].winRate,
        bestReward: ranked[0].reward,
        sigmaMean: round(state.sigma.reduce((sum, value) => sum + value, 0) / state.sigma.length, 4),
        qualified: qualifiedRows(ranked).length
      });
      console.log(`CEM ${character.id} round ${roundIndex}/${rounds}: winRate ${(ranked[0].winRate * 100).toFixed(1)}%, sigma ${history[history.length - 1].sigmaMean}`);
      saveCemCheckpoint({
        roundIndex,
        current: {
          round: roundIndex,
          characterIndex: characterIndex + 1,
          characterId: character.id,
          candidateIndex: candidates.length,
          candidates: [],
          rankedDraft: [],
          partial: null
        }
      }, true);
    }
    saveCemCheckpoint({ roundIndex, current: null }, true);
  }

  const { diverseQualified, perCharacterQualified } = writeCemOutputs({
    outputDir,
    allRows,
    history,
    diversityDistance,
    baselineDistance,
    rounds: roundIndex,
    runs,
    samples,
    eliteCount: normalizedEliteCount,
    sigma,
    minSigma,
    smoothing,
    temperature,
    stopReason,
    characters
  });
  checkpointManager?.update(data => {
    data.phase = "cem";
    data.cem = {
      ...(data.cem || {}),
      allRows,
      history,
      states: objectFromMap(states),
      bestByCharacter: objectFromMap(cemBestByCharacter),
      roundIndex,
      stopReason,
      completed: true,
      current: null
    };
  }, true);
  return { allRows, diverseQualified, perCharacterQualified, bestByCharacter: cemBestByCharacter, history, stopReason, rounds: roundIndex };
}

async function runBanditRl({ balance, characters, gaRows, bestByCharacter, seed, runs, rounds, samples, sigma, temperature, durationHours, outputDir, progress = null, checkpointManager = null, pruneRule = null, jobs = DEFAULT_JOBS, candidateJobs = DEFAULT_CANDIDATE_JOBS, parallelChunkGames = DEFAULT_PARALLEL_CHUNK_GAMES, earlyBatchGames = DEFAULT_EARLY_BATCH_GAMES, minGamesPerWorker = DEFAULT_MIN_GAMES_PER_WORKER, workerPool = null, racingStages = [], racingMinGames = 0, racingZ = DEFAULT_PRUNE_CI_Z, racingKeep = 0 }) {
  const rng = createRng(`${seed}:rl`);
  const saved = checkpointManager?.data?.rl;
  const history = saved?.history || [];
  const deadlineMs = durationHours ? Date.now() + durationHours * 60 * 60 * 1000 : null;
  let stopReason = saved?.stopReason || "rounds";
  const initialStates = new Map(characters.map(character => {
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
  const states = saved?.states ? mapFromObject(saved.states) : initialStates;

  if (saved?.completed) {
    const bestStrategies = saved.bestStrategies || characters.map(character => {
      const state = states.get(character.id);
      return {
        ...(state.best || {}),
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
    progress?.setPhase("rl", { label: "restored completed RL checkpoint" }, true);
    return { bestStrategies, history, stopReason };
  }

  function saveRlCheckpoint(extra = {}, force = false) {
    checkpointManager?.update(data => {
      data.status = "running";
      data.phase = "rl";
      data.rl = {
        ...(data.rl || {}),
        history,
        states: objectFromMap(states),
        stopReason,
        completed: false,
        ...extra
      };
    }, force);
  }

  let roundIndex = saved?.completed
    ? saved?.roundIndex || 0
    : saved?.current?.round
      ? saved.current.round - 1
      : saved?.roundIndex || 0;
  saveRlCheckpoint({ roundIndex }, true);
  while (roundIndex < rounds || (deadlineMs && Date.now() < deadlineMs)) {
    if (deadlineMs && Date.now() >= deadlineMs && roundIndex >= rounds) {
      stopReason = "duration";
      break;
    }
    const resumedCurrent = saved?.current && saved.current.round === roundIndex + 1 ? saved.current : null;
    roundIndex += 1;
    const characterStart = resumedCurrent ? resumedCurrent.characterIndex || 0 : 0;
    for (let characterIndex = characterStart; characterIndex < characters.length; characterIndex += 1) {
      const character = characters[characterIndex];
      if (deadlineMs && Date.now() >= deadlineMs && roundIndex > rounds) {
        stopReason = "duration";
        break;
      }
      const state = states.get(character.id);
      const continuingCharacter = resumedCurrent
        && resumedCurrent.round === roundIndex
        && resumedCurrent.characterId === character.id;
      const candidates = continuingCharacter && resumedCurrent.candidates
        ? resumedCurrent.candidates
        : [
            makeStrategy(`${character.id}-rl${roundIndex}-center`, vectorToWeights(state.center)),
            ...sampleAroundVector(`${character.id}-rl${roundIndex}`, state.center, rng, state.sigma, samples)
          ];
      const rankedDraft = continuingCharacter ? (resumedCurrent.rankedDraft || []) : [];
      const runCandidatesInParallel = !continuingCharacter && !deadlineMs && Math.floor(Number(candidateJobs) || 1) > 1;
      if (runCandidatesInParallel) {
        progress?.setPhase("rl", {
          label: `${character.id} round ${roundIndex}${deadlineMs ? "" : `/${rounds}`} candidates 1-${candidates.length}/${candidates.length}`
        }, characterIndex === characterStart);
        saveRlCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: 0,
            candidateId: null,
            candidates,
            rankedDraft: [],
            partial: null,
            parallelCandidates: true
          }
        }, true);
        const rows = (racingStages || []).length
          ? await evaluateCandidateSetStaged({
              balance,
              character,
              candidates,
              runs,
              seed,
              phase: `rl-round-${roundIndex}`,
              pruneRule,
              jobs,
              candidateJobs,
              parallelChunkGames,
              earlyBatchGames,
              minGamesPerWorker,
              workerPool,
              racingStages,
              racingKeep: racingKeep || Math.max(4, Math.ceil(candidates.length / 3)),
              racingMinGames,
              racingZ,
              onCandidateProgress: ({ candidateIndex, partial }) => {
                progress?.recordGames(partial.gamesCompleted || 1, {
                  label: `${character.id} RL r${roundIndex} candidate ${candidateIndex + 1}/${candidates.length}`,
                  estimate: partial.estimate
                });
              },
              onStageComplete: ({ stageRuns, activeCount, prunedCount }) => {
                progress?.updateCurrent({
                  label: `${character.id} RL r${roundIndex} stage ${stageRuns}, active ${activeCount}, pruned ${prunedCount}`
                });
              }
            })
          : await evaluateCandidateSetParallel({
          balance,
          character,
          candidates,
          runs,
          seed,
          phase: `rl-round-${roundIndex}`,
          pruneRule,
          jobs,
          candidateJobs,
          parallelChunkGames,
          earlyBatchGames,
          minGamesPerWorker,
          workerPool,
          onCandidateProgress: ({ candidateIndex, partial }) => {
            progress?.recordGames(partial.gamesCompleted || 1, {
              label: `${character.id} RL r${roundIndex} candidate ${candidateIndex + 1}/${candidates.length}`,
              estimate: partial.estimate
            });
          }
        });
        rows.forEach(row => rankedDraft.push(annotateNovelty(row, 0)));
        saveRlCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: candidates.length,
            candidateId: null,
            candidates,
            rankedDraft,
            partial: null
          }
        }, true);
      }
      for (let candidateIndex = runCandidatesInParallel ? candidates.length : rankedDraft.length; candidateIndex < candidates.length; candidateIndex += 1) {
        const candidate = candidates[candidateIndex];
        const continuingCandidate = continuingCharacter
          && resumedCurrent.candidateIndex === candidateIndex
          && resumedCurrent.candidateId === candidate.id;
        progress?.setPhase("rl", {
          label: `${character.id} round ${roundIndex}${deadlineMs ? "" : `/${rounds}`} candidate ${candidateIndex + 1}/${candidates.length}`
        }, candidateIndex === 0);
        saveRlCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex,
            candidateId: candidate.id,
            candidates,
            rankedDraft,
            partial: continuingCandidate ? resumedCurrent.partial || null : null
          }
        }, true);
        const row = await evaluateAgainstBasicParallel({
          balance,
          character,
          candidate,
          runs,
          seed,
          phase: `rl-round-${roundIndex}`,
          resume: continuingCandidate ? resumedCurrent.partial : null,
          pruneRule,
          jobs,
          parallelChunkGames,
          earlyBatchGames,
          minGamesPerWorker,
          workerPool,
          onProgress: partial => {
            progress?.recordGames(partial.gamesCompleted || 1, {
              label: `${character.id} RL r${roundIndex} candidate ${candidateIndex + 1}/${candidates.length}`,
              estimate: partial.estimate
            });
            saveRlCheckpoint({
              roundIndex,
              current: {
                round: roundIndex,
                characterIndex,
                characterId: character.id,
                candidateIndex,
                candidateId: candidate.id,
                candidates,
                rankedDraft,
                partial: {
                  nextIndex: partial.nextIndex,
                  totals: partial.totals
                }
              }
            });
          }
        });
        rankedDraft.push(annotateNovelty(row, 0));
        saveRlCheckpoint({
          roundIndex,
          current: {
            round: roundIndex,
            characterIndex,
            characterId: character.id,
            candidateIndex: candidateIndex + 1,
            candidateId: candidate.id,
            candidates,
            rankedDraft,
            partial: null
          }
        }, true);
      }
      const ranked = rankedDraft.sort(compareRows);
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
      saveRlCheckpoint({
        roundIndex,
        current: {
          round: roundIndex,
          characterIndex: characterIndex + 1,
          characterId: character.id,
          candidateIndex: candidates.length,
          candidates: [],
          rankedDraft: [],
          partial: null
        }
      }, true);
    }
    saveRlCheckpoint({ roundIndex, current: null }, true);
  }
  if (deadlineMs && Date.now() >= deadlineMs && roundIndex >= rounds) stopReason = "duration";

  const bestStrategies = [];
  for (const character of characters) {
    const state = states.get(character.id);
    const best = state.best || annotateNovelty(await evaluateAgainstBasicParallel({
      balance,
      character,
      candidate: makeStrategy(`${character.id}-rl-fallback`, vectorToWeights(state.center)),
      runs,
      seed,
      phase: "rl-fallback",
      jobs,
      candidateJobs,
      parallelChunkGames,
      earlyBatchGames,
      minGamesPerWorker,
      workerPool
    }), 0);
    bestStrategies.push({
      ...best,
      characterName: character.name,
      phase: "rl-best"
    });
  }
  writeJson(path.join(outputDir, "rl-history.json"), history);
  writeJson(path.join(outputDir, "rl-best-strategies.json"), {
    durationHours,
    stopReason,
    strategies: bestStrategies
  });
  writeCsv(path.join(outputDir, "rl-best-strategies.csv"), rowsToCsv(bestStrategies));
  checkpointManager?.update(data => {
    data.phase = "rl";
    data.rl = {
      ...(data.rl || {}),
      history,
      states: objectFromMap(states),
      roundIndex,
      stopReason,
      bestStrategies,
      completed: true,
      current: null
    };
  }, true);
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

function matrixToCsv(matrix, characters, cornerLabel = "player\\opponent") {
  const header = [cornerLabel, ...characters.map(character => character.id), "average"];
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

function combineChallengeSeries({ balance, candidateCharacter, opponentCharacter, candidateAsPlayer, candidateAsComputer }) {
  const runs = candidateAsPlayer.runs + candidateAsComputer.runs;
  const wins = candidateAsPlayer.wins + candidateAsComputer.losses;
  const losses = candidateAsPlayer.losses + candidateAsComputer.wins;
  const draws = candidateAsPlayer.draws + candidateAsComputer.draws;
  const decisiveGames = wins + losses;
  const candidateAsComputerWinRate = candidateAsComputer.runs ? candidateAsComputer.losses / candidateAsComputer.runs : 0;
  const averageFromCandidatePerspective = (playerValue, computerValue) => (
    runs ? (candidateAsPlayer.runs * playerValue - candidateAsComputer.runs * computerValue) / runs : 0
  );
  return {
    candidateCharacterId: candidateCharacter.id,
    opponentCharacterId: opponentCharacter.id,
    playerCharacterId: candidateCharacter.id,
    computerCharacterId: opponentCharacter.id,
    runs,
    wins,
    losses,
    draws,
    winRate: runs ? wins / runs : 0,
    drawRate: runs ? draws / runs : 0,
    decisiveGames,
    decisiveWinRate: decisiveGames ? wins / decisiveGames : 0,
    averageDurationMs: runs
      ? (candidateAsPlayer.runs * candidateAsPlayer.averageDurationMs + candidateAsComputer.runs * candidateAsComputer.averageDurationMs) / runs
      : 0,
    averageHpDiff: averageFromCandidatePerspective(candidateAsPlayer.averageHpDiff, candidateAsComputer.averageHpDiff),
    averageScoreDiff: averageFromCandidatePerspective(candidateAsPlayer.averageScoreDiff, candidateAsComputer.averageScoreDiff),
    candidateAsPlayerWinRate: candidateAsPlayer.winRate,
    candidateAsComputerWinRate,
    warning: wins / Math.max(1, runs) < balance.simulation.balanceWinRateMin || wins / Math.max(1, runs) > balance.simulation.balanceWinRateMax
  };
}

function challengeRowsToCsv(results) {
  return [
    [
      "candidateCharacterId",
      "opponentCharacterId",
      "runs",
      "wins",
      "losses",
      "draws",
      "winRate",
      "drawRate",
      "decisiveGames",
      "decisiveWinRate",
      "averageDurationMs",
      "averageHpDiff",
      "averageScoreDiff",
      "candidateAsPlayerWinRate",
      "candidateAsComputerWinRate",
      "warning"
    ],
    ...results.map(result => [
      result.candidateCharacterId,
      result.opponentCharacterId,
      result.runs,
      result.wins,
      result.losses,
      result.draws,
      result.winRate,
      result.drawRate,
      result.decisiveGames,
      result.decisiveWinRate,
      Math.round(result.averageDurationMs),
      result.averageHpDiff,
      result.averageScoreDiff,
      result.candidateAsPlayerWinRate,
      result.candidateAsComputerWinRate,
      result.warning
    ])
  ];
}

function strategyWeightKey(weights) {
  return JSON.stringify(weightsToVector(weights).map(value => round(value, 4)));
}

function rowWithFinalSource(row, source, sourceRank = 0) {
  return {
    ...row,
    finalSource: source,
    finalSourceRank: sourceRank
  };
}

function uniqueCandidateRows(rows) {
  const seen = new Set();
  const unique = [];
  [...rows].sort(compareRows).forEach(row => {
    const key = `${row.characterId}:${row.strategyId}:${strategyWeightKey(row.strategyWeights)}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(row);
  });
  return unique;
}

function appendDiverseCandidates(selected, candidates, minDistance, limit) {
  const output = [...selected];
  uniqueCandidateRows(candidates).forEach(row => {
    if (output.length >= limit) return;
    if (output.some(existing => existing.strategyId === row.strategyId && strategyWeightKey(existing.strategyWeights) === strategyWeightKey(row.strategyWeights))) return;
    if (output.every(existing => normalizedDistance(row.strategyWeights, existing.strategyWeights) >= minDistance)) {
      output.push(row);
    }
  });
  return output;
}

function buildFinalShortlist({ characters, gaRows = [], cemRows = [], rlBest = [], limit = DEFAULT_FINAL_CANDIDATES_PER_CHARACTER, minDistance = DEFAULT_FINAL_SHORTLIST_DISTANCE }) {
  const normalizedLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_FINAL_CANDIDATES_PER_CHARACTER));
  const normalizedDistance = Math.max(0, Number(minDistance) || 0);
  const sourceRows = [
    ...qualifiedRows(gaRows).map((row, index) => rowWithFinalSource(row, "ga", index + 1)),
    ...qualifiedRows(cemRows).map((row, index) => rowWithFinalSource(row, "cem", index + 1)),
    ...rlBest.map((row, index) => rowWithFinalSource(row, "rl-best", index + 1))
  ];
  const fallbackRows = [
    ...gaRows.map((row, index) => rowWithFinalSource(row, row.passedGate ? "ga-extra" : "ga-unqualified", index + 1)),
    ...cemRows.map((row, index) => rowWithFinalSource(row, row.passedGate ? "cem-extra" : "cem-unqualified", index + 1))
  ];
  const byCharacter = {};
  const selected = [];
  characters.forEach(character => {
    const rows = uniqueCandidateRows(sourceRows.filter(row => row.characterId === character.id));
    let picked = selectDiverse(rows, normalizedDistance, normalizedLimit);
    if (picked.length < normalizedLimit) {
      picked = appendDiverseCandidates(
        picked,
        fallbackRows.filter(row => row.characterId === character.id),
        normalizedDistance,
        normalizedLimit
      );
    }
    if (!picked.length) {
      const fallback = rlBest.find(row => row.characterId === character.id) || rows[0];
      if (fallback) picked = [rowWithFinalSource(fallback, fallback.finalSource || "fallback", fallback.finalSourceRank || 1)];
    }
    const ranked = picked.slice(0, normalizedLimit).map((row, index) => ({
      ...row,
      finalRank: index + 1,
      finalCandidateId: `${character.id}:final-${index + 1}:${row.strategyId}`
    }));
    byCharacter[character.id] = ranked;
    selected.push(...ranked);
  });
  return {
    limit: normalizedLimit,
    minDistance: normalizedDistance,
    byCharacter,
    rows: selected
  };
}

function finalShortlistRowsToCsv(rows) {
  return [
    [
      "characterId",
      "finalRank",
      "finalSource",
      "finalSourceRank",
      "strategyId",
      "games",
      "wins",
      "losses",
      "draws",
      "winRate",
      "outcomeWinRate",
      "reward",
      "baselineDistance",
      "strategyWeights"
    ],
    ...rows.map(row => [
      row.characterId,
      row.finalRank,
      row.finalSource || "",
      row.finalSourceRank || "",
      row.strategyId,
      row.games,
      row.wins,
      row.losses,
      row.draws,
      row.winRate,
      row.outcomeWinRate,
      row.reward,
      row.baselineDistance ?? "",
      JSON.stringify(row.strategyWeights)
    ])
  ];
}

function finalShortlistValidationRowsToCsv(results) {
  return [
    [
      "characterId",
      "finalRank",
      "strategyId",
      "opponentCharacterId",
      "runs",
      "wins",
      "losses",
      "draws",
      "winRate",
      "decisiveWinRate",
      "averageHpDiff",
      "averageScoreDiff",
      "candidateAsPlayerWinRate",
      "candidateAsComputerWinRate"
    ],
    ...results.map(result => [
      result.candidateCharacterId,
      result.finalRank,
      result.candidateStrategyId,
      result.opponentCharacterId,
      result.runs,
      result.wins,
      result.losses,
      result.draws,
      result.winRate,
      result.decisiveWinRate,
      result.averageHpDiff,
      result.averageScoreDiff,
      result.candidateAsPlayerWinRate,
      result.candidateAsComputerWinRate
    ])
  ];
}

function summarizeFinalShortlistValidation(shortlistRows, results) {
  const byCandidate = new Map(shortlistRows.map(row => [row.finalCandidateId, {
    characterId: row.characterId,
    finalRank: row.finalRank,
    finalSource: row.finalSource,
    strategyId: row.strategyId,
    mirrorWinRate: row.winRate,
    mirrorReward: row.reward,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    averageWinRate: 0,
    averageHpDiff: 0,
    averageScoreDiff: 0,
    resultCount: 0
  }]));
  results.forEach(result => {
    const summary = byCandidate.get(result.finalCandidateId);
    if (!summary) return;
    summary.games += result.runs || 0;
    summary.wins += result.wins || 0;
    summary.losses += result.losses || 0;
    summary.draws += result.draws || 0;
    summary.averageWinRate += result.winRate || 0;
    summary.averageHpDiff += result.averageHpDiff || 0;
    summary.averageScoreDiff += result.averageScoreDiff || 0;
    summary.resultCount += 1;
  });
  return [...byCandidate.values()].map(summary => ({
    ...summary,
    averageWinRate: summary.resultCount ? round(summary.averageWinRate / summary.resultCount) : 0,
    averageHpDiff: summary.resultCount ? round(summary.averageHpDiff / summary.resultCount) : 0,
    averageScoreDiff: summary.resultCount ? round(summary.averageScoreDiff / summary.resultCount) : 0,
    winRate: summary.games ? summary.wins / summary.games : 0
  })).sort((left, right) =>
    left.characterId.localeCompare(right.characterId)
    || right.averageWinRate - left.averageWinRate
    || right.winRate - left.winRate
    || right.mirrorWinRate - left.mirrorWinRate
  );
}

function selectFinalStrategies(shortlist, validation = null) {
  const summariesByCharacter = new Map();
  (validation?.summaries || []).forEach(summary => {
    if (!summariesByCharacter.has(summary.characterId)) summariesByCharacter.set(summary.characterId, []);
    summariesByCharacter.get(summary.characterId).push(summary);
  });
  return Object.entries(shortlist.byCharacter).map(([characterId, rows]) => {
    const validationBest = (summariesByCharacter.get(characterId) || [])
      .sort((left, right) =>
        right.averageWinRate - left.averageWinRate
        || right.winRate - left.winRate
        || right.mirrorWinRate - left.mirrorWinRate
      )[0];
    if (!validationBest) return rows[0];
    return rows.find(row => row.finalCandidateId === `${characterId}:final-${validationBest.finalRank}:${validationBest.strategyId}`) || rows[0];
  }).filter(Boolean);
}

function writeFinalShortlist({ outputDir, shortlist, validation = null, selectedRows = [] }) {
  writeJson(path.join(outputDir, "final-shortlist.json"), {
    generatedAt: new Date().toISOString(),
    limit: shortlist.limit,
    minDistance: shortlist.minDistance,
    selectedStrategies: selectedRows,
    byCharacter: shortlist.byCharacter,
    strategies: shortlist.rows,
    validation: validation ? {
      runsPerSeat: validation.runsPerSeat,
      summaries: validation.summaries,
      reportPath: path.join(outputDir, "final-shortlist-validation.json")
    } : null
  });
  writeCsv(path.join(outputDir, "final-shortlist.csv"), finalShortlistRowsToCsv(shortlist.rows));
}

function runFinalShortlistValidation({ balance, characters, shortlistRows, opponentStrategyFile, runs, seed, outputPrefix, progress = null, checkpointManager = null }) {
  if (!runs || !shortlistRows.length) return null;
  const checkpointKey = "finalShortlist";
  const saved = checkpointManager?.data?.cross?.[checkpointKey] || null;
  const results = saved?.results || [];
  const seatResults = saved?.seatResults || [];
  const completedPairs = new Set(saved?.completedPairs || results.map(result => `${result.finalCandidateId}:${result.opponentCharacterId}`));

  function saveCheckpoint(extra = {}, force = false) {
    checkpointManager?.update(data => {
      data.status = "running";
      data.phase = "final-shortlist";
      data.cross = {
        ...(data.cross || {}),
        [checkpointKey]: {
          ...(data.cross?.[checkpointKey] || {}),
          results,
          seatResults,
          completedPairs: [...completedPairs],
          completed: false,
          ...extra
        }
      };
    }, force);
  }

  if (saved?.completed) {
    const summaries = saved.summaries || summarizeFinalShortlistValidation(shortlistRows, results);
    const report = {
      generatedAt: saved.generatedAt || new Date().toISOString(),
      config: saved.config,
      results,
      seatResults,
      summaries
    };
    writeJson(`${outputPrefix}.json`, report);
    writeCsv(`${outputPrefix}.csv`, finalShortlistValidationRowsToCsv(results));
    progress?.setPhase("final-shortlist", { label: "restored final shortlist validation" }, true);
    return { report, summaries, runsPerSeat: runs };
  }

  saveCheckpoint({}, true);
  shortlistRows.forEach(candidateRow => {
    const candidateCharacter = characters.find(character => character.id === candidateRow.characterId);
    if (!candidateCharacter) return;
    characters.forEach(opponentCharacter => {
      if (candidateCharacter.id === opponentCharacter.id) return;
      const pairKey = `${candidateRow.finalCandidateId}:${opponentCharacter.id}`;
      if (completedPairs.has(pairKey)) return;
      progress?.setPhase("final-shortlist", {
        label: `${candidateCharacter.id} rank ${candidateRow.finalRank} vs ${opponentCharacter.id}`
      }, true);
      const playerTotals = { games: 0, wins: 0, losses: 0, draws: 0 };
      const candidateAsPlayer = runSeries({
        balance,
        playerCharacter: candidateCharacter,
        computerCharacter: opponentCharacter,
        seed: `${seed}:${candidateRow.finalCandidateId}:as-player:vs:${opponentCharacter.id}`,
        runs,
        playerModel: modelFromStrategyWeights(candidateRow),
        computerModel: strategyModel(opponentStrategyFile, opponentCharacter.id),
        onMatch: ({ match }) => {
          recordCrossSeatEstimate(playerTotals, match, "player");
          progress?.recordGame({
            label: `${candidateCharacter.id} rank ${candidateRow.finalRank} as player vs ${opponentCharacter.id}`,
            estimate: simpleEstimateFromTotals(playerTotals)
          });
        }
      });
      const computerTotals = { games: 0, wins: 0, losses: 0, draws: 0 };
      const candidateAsComputer = runSeries({
        balance,
        playerCharacter: opponentCharacter,
        computerCharacter: candidateCharacter,
        seed: `${seed}:${candidateRow.finalCandidateId}:as-computer:vs:${opponentCharacter.id}`,
        runs,
        playerModel: strategyModel(opponentStrategyFile, opponentCharacter.id),
        computerModel: modelFromStrategyWeights(candidateRow),
        onMatch: ({ match }) => {
          recordCrossSeatEstimate(computerTotals, match, "computer");
          progress?.recordGame({
            label: `${candidateCharacter.id} rank ${candidateRow.finalRank} as computer vs ${opponentCharacter.id}`,
            estimate: simpleEstimateFromTotals(computerTotals)
          });
        }
      });
      seatResults.push({
        finalCandidateId: candidateRow.finalCandidateId,
        candidateCharacterId: candidateCharacter.id,
        candidateStrategyId: candidateRow.strategyId,
        finalRank: candidateRow.finalRank,
        opponentCharacterId: opponentCharacter.id,
        candidateSeat: "player",
        result: candidateAsPlayer
      });
      seatResults.push({
        finalCandidateId: candidateRow.finalCandidateId,
        candidateCharacterId: candidateCharacter.id,
        candidateStrategyId: candidateRow.strategyId,
        finalRank: candidateRow.finalRank,
        opponentCharacterId: opponentCharacter.id,
        candidateSeat: "computer",
        result: candidateAsComputer
      });
      results.push({
        ...combineChallengeSeries({
          balance,
          candidateCharacter,
          opponentCharacter,
          candidateAsPlayer,
          candidateAsComputer
        }),
        finalCandidateId: candidateRow.finalCandidateId,
        finalRank: candidateRow.finalRank,
        candidateStrategyId: candidateRow.strategyId,
        finalSource: candidateRow.finalSource
      });
      completedPairs.add(pairKey);
      saveCheckpoint({ current: null }, true);
    });
  });
  const summaries = summarizeFinalShortlistValidation(shortlistRows, results);
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      seed,
      runsPerSeat: runs,
      candidates: shortlistRows.length,
      protocol: "each final shortlist candidate vs baseline opponents, side-balanced",
      opponentStrategySource: opponentStrategyFile.source
    },
    results,
    seatResults,
    summaries
  };
  writeJson(`${outputPrefix}.json`, report);
  writeCsv(`${outputPrefix}.csv`, finalShortlistValidationRowsToCsv(results));
  saveCheckpoint({
    generatedAt: report.generatedAt,
    config: report.config,
    summaries,
    completed: true,
    current: null
  }, true);
  return { report, summaries, runsPerSeat: runs };
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

function simpleEstimateFromTotals(totals) {
  const games = totals.games || 0;
  const decisiveGames = (totals.wins || 0) + (totals.losses || 0);
  return withWinRateEstimate({
    games,
    wins: totals.wins || 0,
    losses: totals.losses || 0,
    draws: totals.draws || 0,
    winRate: games ? (totals.wins || 0) / games : 0,
    drawRate: games ? (totals.draws || 0) / games : 0,
    decisiveWinRate: decisiveGames ? (totals.wins || 0) / decisiveGames : 0,
    outcomeWinRate: games ? ((totals.wins || 0) + (totals.draws || 0) * 0.5) / games : 0,
    reward: games ? (totals.wins || 0) / games : 0
  });
}

function recordCrossSeatEstimate(totals, match, candidateSeat) {
  totals.games += 1;
  if (!match.winner) {
    totals.draws += 1;
    return;
  }
  const won = candidateSeat === "player" ? match.winner === "player" : match.winner === "computer";
  if (won) totals.wins += 1;
  else totals.losses += 1;
}

function runChallengeCrossPlayReport({ balance, characters, candidateStrategyFile, opponentStrategyFile, runs, seed, outputPrefix, progress = null, checkpointManager = null, checkpointKey = null }) {
  const saved = checkpointKey ? checkpointManager?.data?.cross?.[checkpointKey] : null;
  const results = saved?.results || [];
  const seatResults = saved?.seatResults || [];
  const completedPairs = new Set(saved?.completedPairs || results.map(result => `${result.candidateCharacterId}:${result.opponentCharacterId}`));

  function saveCrossCheckpoint(extra = {}, force = false) {
    if (!checkpointKey) return;
    checkpointManager?.update(data => {
      data.status = "running";
      data.phase = "cross-play";
      data.cross = {
        ...(data.cross || {}),
        [checkpointKey]: {
          ...(data.cross?.[checkpointKey] || {}),
          results,
          seatResults,
          completedPairs: [...completedPairs],
          completed: false,
          ...extra
        }
      };
    }, force);
  }

  if (saved?.completed) {
    const report = {
      generatedAt: saved.generatedAt || new Date().toISOString(),
      config: saved.config,
      results,
      seatResults
    };
    const matrix = buildMatrix(results, characters);
    writeJson(`${outputPrefix}.json`, report);
    writeCsv(`${outputPrefix}.csv`, challengeRowsToCsv(results));
    writeCsv(`${outputPrefix}-matrix.csv`, matrixToCsv(matrix, characters, "candidate\\opponent"));
    progress?.setPhase("cross-play", { label: `restored ${checkpointKey}` }, true);
    return { report, matrix };
  }

  saveCrossCheckpoint({}, true);
  characters.forEach(candidateCharacter => {
    characters.forEach(opponentCharacter => {
      if (candidateCharacter.id === opponentCharacter.id) return;
      const pairKey = `${candidateCharacter.id}:${opponentCharacter.id}`;
      if (completedPairs.has(pairKey)) return;
      progress?.setPhase("cross-play", {
        label: `${checkpointKey || "cross"} ${candidateCharacter.id} vs ${opponentCharacter.id}`
      }, true);
      const playerTotals = { games: 0, wins: 0, losses: 0, draws: 0 };
      const candidateAsPlayer = runSeries({
        balance,
        playerCharacter: candidateCharacter,
        computerCharacter: opponentCharacter,
        seed: `${seed}:${candidateCharacter.id}:as-player:vs:${opponentCharacter.id}`,
        runs,
        playerModel: strategyModel(candidateStrategyFile, candidateCharacter.id),
        computerModel: strategyModel(opponentStrategyFile, opponentCharacter.id),
        onMatch: ({ match }) => {
          recordCrossSeatEstimate(playerTotals, match, "player");
          progress?.recordGame({
            label: `${candidateCharacter.id} as player vs ${opponentCharacter.id}`,
            estimate: simpleEstimateFromTotals(playerTotals)
          });
        }
      });
      const computerTotals = { games: 0, wins: 0, losses: 0, draws: 0 };
      const candidateAsComputer = runSeries({
        balance,
        playerCharacter: opponentCharacter,
        computerCharacter: candidateCharacter,
        seed: `${seed}:${candidateCharacter.id}:as-computer:vs:${opponentCharacter.id}`,
        runs,
        playerModel: strategyModel(opponentStrategyFile, opponentCharacter.id),
        computerModel: strategyModel(candidateStrategyFile, candidateCharacter.id),
        onMatch: ({ match }) => {
          recordCrossSeatEstimate(computerTotals, match, "computer");
          progress?.recordGame({
            label: `${candidateCharacter.id} as computer vs ${opponentCharacter.id}`,
            estimate: simpleEstimateFromTotals(computerTotals)
          });
        }
      });
      seatResults.push({
        candidateCharacterId: candidateCharacter.id,
        opponentCharacterId: opponentCharacter.id,
        candidateSeat: "player",
        result: candidateAsPlayer
      });
      seatResults.push({
        candidateCharacterId: candidateCharacter.id,
        opponentCharacterId: opponentCharacter.id,
        candidateSeat: "computer",
        result: candidateAsComputer
      });
      results.push(combineChallengeSeries({
        balance,
        candidateCharacter,
        opponentCharacter,
        candidateAsPlayer,
        candidateAsComputer
      }));
      completedPairs.add(pairKey);
      saveCrossCheckpoint({
        current: null
      }, true);
    });
  });
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      seed,
      runsPerSeat: runs,
      candidateOpponentPairs: results.length,
      orderedSeatSeries: seatResults.length,
      protocol: "candidate strategy vs baseline opponents, side-balanced",
      candidateStrategySource: candidateStrategyFile.source,
      opponentStrategySource: opponentStrategyFile.source
    },
    results,
    seatResults
  };
  const matrix = buildMatrix(results, characters);
  writeJson(`${outputPrefix}.json`, report);
  writeCsv(`${outputPrefix}.csv`, challengeRowsToCsv(results));
  writeCsv(`${outputPrefix}-matrix.csv`, matrixToCsv(matrix, characters, "candidate\\opponent"));
  saveCrossCheckpoint({
    generatedAt: report.generatedAt,
    config: report.config,
    completed: true,
    current: null
  }, true);
  return { report, matrix };
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function percentPrecise(value) {
  return `${(value * 100).toFixed(3)}%`;
}

function comparisonMarkdown({ config, gaQualified, cemQualified = [], rlBest, finalSelected = [], finalShortlistValidation = null, baselineCross, bestCross, characters }) {
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
    `Cross-play protocol: target character uses the strategy under test; all opponents use baseline; both player and computer seats are evaluated.`,
    "",
    "## Summary",
    "",
    `- Diverse GA-qualified strategies: ${gaQualified.length}`,
    `- Diverse CEM-qualified strategies: ${cemQualified.length}`,
    `- RL best strategies: ${rlBest.length}`,
    `- Final selected strategies: ${finalSelected.length}`,
    `- Final shortlist validation: ${finalShortlistValidation ? `${finalShortlistValidation.summaries.length} candidate summaries at ${finalShortlistValidation.runsPerSeat} runs/seat` : "disabled"}`,
    `- Baseline target-vs-field win rate: ${percent(baselineAverage)}`,
    `- Optimized target-vs-field win rate: ${percent(bestAverage)}`,
    `- Delta: ${percent(bestAverage - baselineAverage)}`,
    "",
    "## Per Character Marginal Cross-Play",
    "",
    "| Character | Baseline target | Optimized target | Delta |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## RL Best Mirror Gate",
    "",
    "| Character | Strategy | Win rate | Draw rate | Decisive win | Outcome win |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rlBest.map(row => `| ${row.characterId} | ${row.strategyId} | ${percent(row.winRate)} | ${percent(row.drawRate)} | ${percent(row.decisiveWinRate)} | ${percent(row.outcomeWinRate)} |`),
    "",
    "## Final Selected Strategies",
    "",
    "| Character | Strategy | Source | Mirror win |",
    "| --- | --- | --- | --- |",
    ...finalSelected.map(row => `| ${row.characterId} | ${row.strategyId} | ${row.finalSource || row.phase || ""} | ${percent(row.winRate || 0)} |`)
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
      "pruned",
      "pruneMethod",
      "pruneAtGames",
      "pruneStage",
      "pruneCiHigh",
      "pruneReason",
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
      row.pruned ?? false,
      row.pruneMethod ?? "",
      row.pruneAtGames ?? "",
      row.pruneStage ?? "",
      row.pruneCiHigh ?? "",
      row.pruneReason ?? "",
      row.averageDurationMs,
      row.averageHpDiff,
      row.averageScoreDiff,
      JSON.stringify(row.strategyWeights)
    ])
  ];
}

async function runOptimization(options = {}) {
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
  const requestedWorkerProfile = String(options.workerProfile || "custom").toLowerCase();
  let autoBenchmark = null;
  const selectedWorkerProfile = requestedWorkerProfile === "auto"
    ? await (async () => {
        const benchmark = await runParallelBenchmark({
          balance,
          characters,
          characterId: characters[0]?.id,
          runs: positiveIntegerValue(options.autoBenchmarkRuns, 240),
          candidateCount: positiveIntegerValue(options.autoBenchmarkCandidates, 4),
          profiles: "daily,overnight",
          seed: `${seed}:auto-profile`
        });
        autoBenchmark = benchmark;
        const fastest = [...benchmark.rows].sort((left, right) => right.gamesPerSecond - left.gamesPerSecond)[0];
        console.log(`Auto worker profile selected: ${fastest.profile} (${fastest.gamesPerSecond} games/s)`);
        return workerProfile(fastest.profile);
      })()
    : workerProfile(requestedWorkerProfile);
  const config = {
    seed,
    workerProfile: selectedWorkerProfile.name,
    requestedWorkerProfile,
    gaPopulation: Math.max(2, Math.floor(options.gaPopulation ?? DEFAULT_GA_POPULATION)),
    gaRounds: Math.max(1, Math.floor(options.gaRounds ?? DEFAULT_GA_ROUNDS)),
    gaElites: Math.max(1, Math.floor(options.gaElites ?? DEFAULT_GA_ELITES)),
    gaRuns: Math.max(1, Math.floor(options.gaRuns ?? DEFAULT_GA_RUNS)),
    cemRounds: Math.max(0, Math.floor(options.cemRounds ?? DEFAULT_CEM_ROUNDS)),
    cemSamples: Math.max(1, Math.floor(options.cemSamples ?? DEFAULT_CEM_SAMPLES)),
    cemElites: Math.max(1, Math.floor(options.cemElites ?? DEFAULT_CEM_ELITES)),
    cemRuns: Math.max(1, Math.floor(options.cemRuns ?? options.rlRuns ?? DEFAULT_CEM_RUNS)),
    cemSigma: Number(options.cemSigma ?? DEFAULT_CEM_SIGMA),
    cemMinSigma: Number(options.cemMinSigma ?? DEFAULT_CEM_MIN_SIGMA),
    cemSmoothing: Number(options.cemSmoothing ?? DEFAULT_CEM_SMOOTHING),
    cemTemperature: Number(options.cemTemperature ?? DEFAULT_CEM_TEMPERATURE),
    rlRounds: Math.max(1, Math.floor(options.rlRounds ?? DEFAULT_RL_ROUNDS)),
    rlSamples: Math.max(1, Math.floor(options.rlSamples ?? DEFAULT_RL_SAMPLES)),
    rlRuns: Math.max(1, Math.floor(options.rlRuns ?? DEFAULT_RL_RUNS)),
    crossRuns: Math.max(1, Math.floor(options.crossRuns ?? DEFAULT_CROSS_RUNS)),
    finalCandidatesPerCharacter: Math.max(1, Math.floor(options.finalCandidatesPerCharacter ?? DEFAULT_FINAL_CANDIDATES_PER_CHARACTER)),
    finalCandidateRuns: Math.max(0, Math.floor(options.finalCandidateRuns ?? DEFAULT_FINAL_CANDIDATE_RUNS)),
    finalShortlistDistance: Number(options.finalShortlistDistance ?? DEFAULT_FINAL_SHORTLIST_DISTANCE),
    minQualified: Math.max(1, Math.floor(options.minQualified ?? DEFAULT_MIN_QUALIFIED)),
    minQualifiedPerCharacter: Math.max(0, Math.floor(options.minQualifiedPerCharacter ?? DEFAULT_MIN_QUALIFIED_PER_CHARACTER)),
    diversityDistance: Number(options.diversityDistance ?? DEFAULT_DIVERSITY_DISTANCE),
    baselineDistance: Number(options.baselineDistance ?? DEFAULT_BASELINE_DISTANCE),
    gaDurationHours: Number(options.gaDurationHours ?? DEFAULT_GA_DURATION_HOURS),
    rlDurationHours: Number(options.rlDurationHours ?? DEFAULT_RL_DURATION_HOURS),
    rlSigma: Number(options.rlSigma ?? DEFAULT_RL_SIGMA),
    rlTemperature: Number(options.rlTemperature ?? DEFAULT_RL_TEMPERATURE),
    jobs: Math.max(1, Math.min(availableParallelism(), positiveIntegerValue(options.jobs ?? selectedWorkerProfile.jobs, DEFAULT_JOBS))),
    candidateJobs: positiveIntegerValue(options.candidateJobs ?? selectedWorkerProfile.candidateJobs, DEFAULT_CANDIDATE_JOBS),
    parallelChunkGames: positiveIntegerValue(options.parallelChunkGames ?? selectedWorkerProfile.parallelChunkGames, DEFAULT_PARALLEL_CHUNK_GAMES),
    earlyBatchGames: positiveIntegerValue(options.earlyBatchGames ?? selectedWorkerProfile.earlyBatchGames, DEFAULT_EARLY_BATCH_GAMES),
    minGamesPerWorker: positiveIntegerValue(options.minGamesPerWorker ?? selectedWorkerProfile.minGamesPerWorker, DEFAULT_MIN_GAMES_PER_WORKER),
    racingStages: options.racingStages !== undefined ? String(options.racingStages) : String(selectedWorkerProfile.racingStages || ""),
    racingMinGames: positiveIntegerValue(options.racingMinGames ?? selectedWorkerProfile.racingMinGames, selectedWorkerProfile.racingMinGames || 0),
    racingZ: Number(options.racingZ ?? selectedWorkerProfile.racingZ ?? options.pruneCiZ ?? DEFAULT_PRUNE_CI_Z),
    gaRacingKeep: Math.max(0, Math.floor(Number(options.gaRacingKeep ?? selectedWorkerProfile.gaRacingKeep ?? 0))),
    rlRacingKeep: Math.max(0, Math.floor(Number(options.rlRacingKeep ?? selectedWorkerProfile.rlRacingKeep ?? 0))),
    gaPruneCiSchedule: options.gaPruneCiSchedule !== undefined
      ? String(options.gaPruneCiSchedule)
      : options.gaPruneCiMinGames !== undefined
        ? Number(options.gaPruneCiMinGames) > 0
          ? `${Math.max(1, Math.floor(options.gaPruneCiMinGames))}-:${Number(options.pruneCiTargetWinRate ?? DEFAULT_PRUNE_CI_TARGET_WIN_RATE)}`
          : ""
        : selectedWorkerProfile.gaPruneCiSchedule,
    rlPruneCiSchedule: options.rlPruneCiSchedule !== undefined
      ? String(options.rlPruneCiSchedule)
      : options.rlPruneCiMinGames !== undefined
        ? Number(options.rlPruneCiMinGames) > 0
          ? `${Math.max(1, Math.floor(options.rlPruneCiMinGames))}-:${Number(options.pruneCiTargetWinRate ?? DEFAULT_PRUNE_CI_TARGET_WIN_RATE)}`
          : ""
        : selectedWorkerProfile.rlPruneCiSchedule,
    pruneCiTargetWinRate: Number(options.pruneCiTargetWinRate ?? DEFAULT_PRUNE_CI_TARGET_WIN_RATE),
    pruneCiZ: Number(options.pruneCiZ ?? DEFAULT_PRUNE_CI_Z),
    characterIds: characters.map(character => character.id)
  };
  if (!Number.isFinite(config.pruneCiTargetWinRate) || config.pruneCiTargetWinRate <= 0 || config.pruneCiTargetWinRate >= 1) {
    throw new Error("--prune-ci-target-win-rate must be between 0 and 1.");
  }
  if (!Number.isFinite(config.pruneCiZ) || config.pruneCiZ <= 0) {
    throw new Error("--prune-ci-z must be a positive number.");
  }
  if (!Number.isFinite(config.racingZ) || config.racingZ <= 0) {
    throw new Error("--racing-z must be a positive number.");
  }
  if (!Number.isFinite(config.cemSigma) || config.cemSigma <= 0) {
    throw new Error("--cem-sigma must be a positive number.");
  }
  if (!Number.isFinite(config.cemMinSigma) || config.cemMinSigma <= 0) {
    throw new Error("--cem-min-sigma must be a positive number.");
  }
  if (!Number.isFinite(config.cemSmoothing) || config.cemSmoothing <= 0 || config.cemSmoothing > 1) {
    throw new Error("--cem-smoothing must be between 0 and 1.");
  }
  if (!Number.isFinite(config.cemTemperature) || config.cemTemperature <= 0) {
    throw new Error("--cem-temperature must be a positive number.");
  }
  if (!Number.isFinite(config.finalShortlistDistance) || config.finalShortlistDistance < 0) {
    throw new Error("--final-shortlist-distance must be a non-negative number.");
  }
  ensureDir(outputDir);
  if (autoBenchmark) writeJson(path.join(outputDir, "auto-worker-benchmark.json"), autoBenchmark);
  writeJson(path.join(outputDir, "config.json"), config);
  const checkpoint = loadCompatibleCheckpoint(outputDir, config, options.resume !== false);
  const progress = options.progress === false
    ? null
    : createProgressTracker({
        outputDir,
        config,
        characters,
        checkpoint,
        logIntervalMs: Number(options.progressLogIntervalMs ?? 5000)
      });
  const checkpointManager = createCheckpointManager({ outputDir, config, checkpoint, progress });
  const targetAnalysis = progress?.analysis || buildTrainingTargetAnalysis(config, characters);
  writeJson(path.join(outputDir, "training-targets.json"), targetAnalysis);
  fs.writeFileSync(path.join(outputDir, "training-targets.md"), `${trainingTargetMarkdown(targetAnalysis)}\n`, "utf8");
  progress?.setPhase("target-analysis", {
    label: `${formatNumber(targetAnalysis.plannedWork.totalGames)} planned games across ${characters.length} character(s)`
  }, true);
  checkpointManager.update(data => {
    data.status = "running";
    data.phase = data.phase || "starting";
    data.targetAnalysis = targetAnalysis;
  }, true);

  const racingStages = parseIntegerList(config.racingStages);
  const workerPool = config.jobs > 1 ? new StrategyWorkerPool(config.jobs) : null;
  let ga;
  let cem = disabledCemResult();
  let rl;
  try {
    ga = await runGaSearch({
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
      outputDir,
      progress,
      checkpointManager,
      pruneRule: confidencePruneRule(config.gaPruneCiSchedule, config.pruneCiZ),
      jobs: config.jobs,
      candidateJobs: config.candidateJobs,
      parallelChunkGames: config.parallelChunkGames,
      earlyBatchGames: config.earlyBatchGames,
      minGamesPerWorker: config.minGamesPerWorker,
      workerPool,
      racingStages,
      racingMinGames: config.racingMinGames,
      racingZ: config.racingZ,
      racingKeep: config.gaRacingKeep
    });
    const gaRowsForCem = qualifiedRows(ga.allRows);
    cem = await runCemRefinement({
      balance,
      characters,
      gaRows: gaRowsForCem,
      bestByCharacter: ga.bestByCharacter,
      seed,
      runs: config.cemRuns,
      rounds: config.cemRounds,
      samples: config.cemSamples,
      eliteCount: config.cemElites,
      sigma: config.cemSigma,
      minSigma: config.cemMinSigma,
      smoothing: config.cemSmoothing,
      temperature: config.cemTemperature,
      diversityDistance: config.diversityDistance,
      baselineDistance: config.baselineDistance,
      outputDir,
      progress,
      checkpointManager,
      pruneRule: confidencePruneRule(config.rlPruneCiSchedule, config.pruneCiZ),
      jobs: config.jobs,
      candidateJobs: config.candidateJobs,
      parallelChunkGames: config.parallelChunkGames,
      earlyBatchGames: config.earlyBatchGames,
      minGamesPerWorker: config.minGamesPerWorker,
      workerPool,
      racingStages,
      racingMinGames: config.racingMinGames,
      racingZ: config.racingZ,
      racingKeep: config.rlRacingKeep
    });
    const gaRowsForRl = qualifiedRows([...ga.allRows, ...cem.allRows]);
    const bestByCharacterForRl = mergeBestByCharacter(ga.bestByCharacter, cem.bestByCharacter);
    rl = await runBanditRl({
      balance,
      characters,
      gaRows: gaRowsForRl,
      bestByCharacter: bestByCharacterForRl,
      seed,
      runs: config.rlRuns,
      rounds: config.rlRounds,
      samples: config.rlSamples,
      sigma: config.rlSigma,
      temperature: config.rlTemperature,
      durationHours: config.rlDurationHours,
      outputDir,
      progress,
      checkpointManager,
      pruneRule: confidencePruneRule(config.rlPruneCiSchedule, config.pruneCiZ),
      jobs: config.jobs,
      candidateJobs: config.candidateJobs,
      parallelChunkGames: config.parallelChunkGames,
      earlyBatchGames: config.earlyBatchGames,
      minGamesPerWorker: config.minGamesPerWorker,
      workerPool,
      racingStages,
      racingMinGames: config.racingMinGames,
      racingZ: config.racingZ,
      racingKeep: config.rlRacingKeep
    });
  } finally {
    await workerPool?.close();
  }

  const baselineStrategyFile = buildStrategyFile(characters.map(character => ({
    characterId: characterById.get(character.id).id,
    strategyId: BASIC_STRATEGY_ID,
    strategyWeights: makeBasicStrategy().strategyWeights
  })), characters, "baseline-basic");
  writeJson(path.join(outputDir, "baseline-strategies.json"), baselineStrategyFile);
  const finalShortlist = buildFinalShortlist({
    characters,
    gaRows: ga.allRows,
    cemRows: cem.allRows,
    rlBest: rl.bestStrategies,
    limit: config.finalCandidatesPerCharacter,
    minDistance: config.finalShortlistDistance
  });
  const finalShortlistValidation = config.finalCandidateRuns && config.finalCandidatesPerCharacter > 1
    ? runFinalShortlistValidation({
        balance,
        characters,
        shortlistRows: finalShortlist.rows,
        opponentStrategyFile: baselineStrategyFile,
        runs: config.finalCandidateRuns,
        seed: `${seed}:final-shortlist`,
        outputPrefix: path.join(outputDir, "final-shortlist-validation"),
        progress,
        checkpointManager
      })
    : null;
  const finalSelectedStrategies = selectFinalStrategies(finalShortlist, finalShortlistValidation);
  writeFinalShortlist({
    outputDir,
    shortlist: finalShortlist,
    validation: finalShortlistValidation,
    selectedRows: finalSelectedStrategies
  });
  const bestStrategyFile = buildStrategyFile(finalSelectedStrategies, characters, path.join(outputDir, "final-shortlist.json"));
  writeJson(path.join(outputDir, "best-strategies-for-apply.json"), bestStrategyFile);
  checkpointManager.update(data => {
    data.phase = "cross-play";
    data.baselineStrategyFile = baselineStrategyFile;
    data.bestStrategyFile = bestStrategyFile;
    data.finalShortlist = {
      rows: finalShortlist.rows,
      selectedStrategies: finalSelectedStrategies,
      validationSummaries: finalShortlistValidation?.summaries || []
    };
  }, true);

  const baselineCross = runChallengeCrossPlayReport({
    balance,
    characters,
    candidateStrategyFile: baselineStrategyFile,
    opponentStrategyFile: baselineStrategyFile,
    runs: config.crossRuns,
    seed: `${seed}:baseline-cross`,
    outputPrefix: path.join(outputDir, "baseline-cross"),
    progress,
    checkpointManager,
    checkpointKey: "baselineCross"
  });
  const bestCross = runChallengeCrossPlayReport({
    balance,
    characters,
    candidateStrategyFile: bestStrategyFile,
    opponentStrategyFile: baselineStrategyFile,
    runs: config.crossRuns,
    seed: `${seed}:best-cross`,
    outputPrefix: path.join(outputDir, "best-cross"),
    progress,
    checkpointManager,
    checkpointKey: "bestCross"
  });
  const markdown = comparisonMarkdown({
    config,
    gaQualified: ga.diverseQualified,
    cemQualified: cem.diverseQualified,
    rlBest: rl.bestStrategies,
    finalSelected: finalSelectedStrategies,
    finalShortlistValidation,
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
    cemStopReason: cem.stopReason,
    rlStopReason: rl.stopReason,
    crossProtocol: "target character uses the strategy under test; all opponents use baseline; both player and computer seats are evaluated",
    perCharacterQualified: Object.fromEntries(Object.entries(ga.perCharacterQualified).map(([characterId, rows]) => [characterId, rows.length])),
    outputs: {
      directory: outputDir,
      gaQualified: path.join(outputDir, "ga-qualified.json"),
      cemQualified: config.cemRounds ? path.join(outputDir, "cem-qualified.json") : null,
      rlBestStrategies: path.join(outputDir, "rl-best-strategies.json"),
      finalShortlist: path.join(outputDir, "final-shortlist.json"),
      finalShortlistValidation: finalShortlistValidation ? path.join(outputDir, "final-shortlist-validation.json") : null,
      baselineCrossMatrix: path.join(outputDir, "baseline-cross-matrix.csv"),
      bestCrossMatrix: path.join(outputDir, "best-cross-matrix.csv"),
      comparison: path.join(outputDir, "comparison.md"),
      bestStrategiesForApply: path.join(outputDir, "best-strategies-for-apply.json"),
      trainingTargets: path.join(outputDir, "training-targets.md"),
      progress: path.join(outputDir, "training-progress.json"),
      checkpoint: path.join(outputDir, "checkpoint.json")
    }
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  progress?.finish(manifest.status);
  checkpointManager.update(data => {
    data.status = manifest.status;
    data.phase = "completed";
    data.manifest = manifest;
  }, true);
  return { manifest, ga, cem, rl, finalShortlist, finalSelectedStrategies, finalShortlistValidation, baselineCross, bestCross };
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
      cemQualifiedCount: result.cem?.diverseQualified?.length || 0,
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
    ["cycle", "status", "seed", "qualifiedCount", "cemQualifiedCount", "rlBestCount", "baselineAverage", "bestAverage", "delta", "directory"],
    ...rows.map(row => [
      row.cycle,
      row.status,
      row.seed,
      row.qualifiedCount,
      row.cemQualifiedCount,
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
    "| Cycle | Status | GA Qualified | CEM Qualified | RL Best | Baseline Avg | Best Avg | Delta |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(row => `| ${row.cycle} | ${row.status} | ${row.qualifiedCount} | ${row.cemQualifiedCount} | ${row.rlBestCount} | ${percent(row.baselineAverage)} | ${percent(row.bestAverage)} | ${percent(row.delta)} |`)
  ];
  fs.writeFileSync(path.join(outputDir, "cycles-summary.md"), `${lines.join("\n")}\n`, "utf8");
}

async function runMultiCycleOptimization(options = {}) {
  const cycles = Math.max(1, Math.floor(options.cycles ?? DEFAULT_CYCLES));
  if (cycles === 1) return runOptimization(options);
  const seed = String(options.seed || DEFAULT_SEED);
  const outputDir = options.outputDir || path.join(reportsDir, `strategy-cycles-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
  ensureDir(outputDir);
  const cycleResults = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const cycleSeed = `${seed}-cycle-${cycle}`;
    console.log(`Cycle ${cycle}/${cycles}: ${cycleSeed}`);
    cycleResults.push(await runOptimization({
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

async function runParallelBenchmark(options = {}) {
  const balance = options.balance || loadBalance(root);
  const characters = options.characters || loadCharacters(root);
  const selectedCharacter = options.characterId
    ? characters.find(character => character.id === options.characterId)
    : characters[0];
  if (!selectedCharacter) throw new Error(`Unknown benchmark character id: ${options.characterId}`);
  const runs = positiveIntegerValue(options.runs, 600);
  const candidateCount = positiveIntegerValue(options.candidateCount, 8);
  const profiles = String(options.profiles || "daily,overnight")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean)
    .map(workerProfile);
  const rows = [];

  for (const profile of profiles) {
    const jobs = Math.max(1, Math.min(availableParallelism(), positiveIntegerValue(options.jobs ?? profile.jobs, profile.jobs)));
    const candidateJobs = positiveIntegerValue(options.candidateJobs ?? profile.candidateJobs, profile.candidateJobs);
    const candidates = Array.from({ length: candidateCount }, (_, index) =>
      makeStrategy(`${selectedCharacter.id}-${profile.name}-benchmark-${index}`, mutateWeights(roleAdjustedBaseWeights(selectedCharacter), createRng(`${profile.name}:benchmark:${index}`), 0.2))
    );
    const workerPool = jobs > 1 ? new StrategyWorkerPool(jobs) : null;
    const startedAt = Date.now();
    try {
      const evaluatedRows = await evaluateCandidateSetParallel({
        balance,
        character: selectedCharacter,
        candidates,
        runs,
        seed: String(options.seed || `strategy-parallel-benchmark-${profile.name}`),
        phase: "benchmark",
        pruneRule: null,
        jobs,
        candidateJobs,
        parallelChunkGames: profile.parallelChunkGames,
        earlyBatchGames: profile.earlyBatchGames,
        minGamesPerWorker: profile.minGamesPerWorker,
        workerPool
      });
      const elapsedMs = Math.max(1, Date.now() - startedAt);
      const totalGames = evaluatedRows.reduce((sum, row) => sum + row.games, 0);
      rows.push({
        profile: profile.name,
        jobs,
        candidateJobs,
        parallelChunkGames: profile.parallelChunkGames,
        earlyBatchGames: profile.earlyBatchGames,
        minGamesPerWorker: profile.minGamesPerWorker,
        candidates: candidateCount,
        games: totalGames,
        elapsedMs,
        gamesPerSecond: round(totalGames / (elapsedMs / 1000), 3),
        averageWinRate: round(evaluatedRows.reduce((sum, row) => sum + row.winRate, 0) / evaluatedRows.length),
        averageDurationMs: round(evaluatedRows.reduce((sum, row) => sum + row.averageDurationMs, 0) / evaluatedRows.length, 2)
      });
    } finally {
      await workerPool?.close();
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    characterId: selectedCharacter.id,
    runs,
    candidateCount,
    availableParallelism: availableParallelism(),
    rows
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["benchmark-parallel"]) {
    const result = await runParallelBenchmark({
      characterId: args.character ? String(args.character) : undefined,
      runs: args["benchmark-runs"] !== undefined ? integerArg(args, "benchmark-runs", 600) : 600,
      candidateCount: args["benchmark-candidates"] !== undefined ? integerArg(args, "benchmark-candidates", 8) : 8,
      profiles: stringArg(args, "benchmark-profiles", "daily,overnight"),
      seed: stringArg(args, "seed", "strategy-parallel-benchmark")
    });
    if (args.output) {
      const outputPath = path.resolve(root, String(args.output));
      writeJson(outputPath, result);
    }
    console.log(`Parallel benchmark: ${result.characterId}, ${formatNumber(result.candidateCount)} candidates, ${formatNumber(result.runs)} games/candidate, available parallelism ${result.availableParallelism}`);
    result.rows.forEach(row => {
      console.log(`${row.profile}: jobs ${row.jobs}, candidateJobs ${row.candidateJobs}, chunk ${row.parallelChunkGames}, early ${row.earlyBatchGames}, min/worker ${row.minGamesPerWorker}, ${row.gamesPerSecond} games/s, elapsed ${formatDuration(row.elapsedMs)}`);
    });
    return;
  }
  const pruneCiDisabled = Boolean(args["no-prune-ci"]);
  const pruneCiTargetWinRate = numberArg(args, "prune-ci-target-win-rate", DEFAULT_PRUNE_CI_TARGET_WIN_RATE);
  const options = {
    seed: stringArg(args, "seed", DEFAULT_SEED),
    characterId: args.character ? String(args.character) : undefined,
    outputDir: args.output ? path.resolve(root, args.output) : undefined,
    workerProfile: stringArg(args, "worker-profile", "custom"),
    autoBenchmarkRuns: args["auto-benchmark-runs"] !== undefined ? integerArg(args, "auto-benchmark-runs", 240) : undefined,
    autoBenchmarkCandidates: args["auto-benchmark-candidates"] !== undefined ? integerArg(args, "auto-benchmark-candidates", 4) : undefined,
    cycles: integerArg(args, "cycles", DEFAULT_CYCLES),
    gaPopulation: integerArg(args, "ga-population", DEFAULT_GA_POPULATION),
    gaRounds: integerArg(args, "ga-rounds", DEFAULT_GA_ROUNDS),
    gaElites: integerArg(args, "ga-elites", DEFAULT_GA_ELITES),
    gaRuns: integerArg(args, "ga-runs", DEFAULT_GA_RUNS),
    cemRounds: args["no-cem"] ? 0 : nonNegativeIntegerArg(args, "cem-rounds", DEFAULT_CEM_ROUNDS),
    cemSamples: integerArg(args, "cem-samples", DEFAULT_CEM_SAMPLES),
    cemElites: integerArg(args, "cem-elites", DEFAULT_CEM_ELITES),
    cemRuns: args["cem-runs"] !== undefined ? integerArg(args, "cem-runs", DEFAULT_CEM_RUNS) : undefined,
    cemSigma: numberArg(args, "cem-sigma", DEFAULT_CEM_SIGMA),
    cemMinSigma: numberArg(args, "cem-min-sigma", DEFAULT_CEM_MIN_SIGMA),
    cemSmoothing: numberArg(args, "cem-smoothing", DEFAULT_CEM_SMOOTHING),
    cemTemperature: numberArg(args, "cem-temperature", DEFAULT_CEM_TEMPERATURE),
    rlRounds: integerArg(args, "rl-rounds", DEFAULT_RL_ROUNDS),
    rlSamples: integerArg(args, "rl-samples", DEFAULT_RL_SAMPLES),
    rlRuns: integerArg(args, "rl-runs", DEFAULT_RL_RUNS),
    crossRuns: integerArg(args, "cross-runs", DEFAULT_CROSS_RUNS),
    finalCandidatesPerCharacter: integerArg(args, "final-candidates-per-character", DEFAULT_FINAL_CANDIDATES_PER_CHARACTER),
    finalCandidateRuns: nonNegativeIntegerArg(args, "final-candidate-runs", DEFAULT_FINAL_CANDIDATE_RUNS),
    finalShortlistDistance: nonNegativeNumberArg(args, "final-shortlist-distance", DEFAULT_FINAL_SHORTLIST_DISTANCE),
    minQualified: integerArg(args, "min-qualified", DEFAULT_MIN_QUALIFIED),
    minQualifiedPerCharacter: integerArg(args, "min-qualified-per-character", DEFAULT_MIN_QUALIFIED_PER_CHARACTER),
    diversityDistance: numberArg(args, "diversity-distance", DEFAULT_DIVERSITY_DISTANCE),
    baselineDistance: numberArg(args, "baseline-distance", DEFAULT_BASELINE_DISTANCE),
    gaDurationHours: numberArg(args, "ga-duration-hours", DEFAULT_GA_DURATION_HOURS),
    rlDurationHours: numberArg(args, "rl-duration-hours", DEFAULT_RL_DURATION_HOURS),
    rlSigma: numberArg(args, "rl-sigma", DEFAULT_RL_SIGMA),
    rlTemperature: numberArg(args, "rl-temperature", DEFAULT_RL_TEMPERATURE),
    jobs: args.jobs !== undefined ? integerArg(args, "jobs", DEFAULT_JOBS) : undefined,
    candidateJobs: args["candidate-jobs"] !== undefined ? integerArg(args, "candidate-jobs", DEFAULT_CANDIDATE_JOBS) : undefined,
    parallelChunkGames: args["parallel-chunk-games"] !== undefined ? integerArg(args, "parallel-chunk-games", DEFAULT_PARALLEL_CHUNK_GAMES) : undefined,
    earlyBatchGames: args["early-batch-games"] !== undefined ? integerArg(args, "early-batch-games", DEFAULT_EARLY_BATCH_GAMES) : undefined,
    minGamesPerWorker: args["min-games-per-worker"] !== undefined ? integerArg(args, "min-games-per-worker", DEFAULT_MIN_GAMES_PER_WORKER) : undefined,
    racingStages: args["no-racing"] ? "" : args["racing-stages"] !== undefined ? stringArg(args, "racing-stages", "") : undefined,
    racingMinGames: args["racing-min-games"] !== undefined ? integerArg(args, "racing-min-games", 0) : undefined,
    racingZ: args["racing-z"] !== undefined ? numberArg(args, "racing-z", DEFAULT_PRUNE_CI_Z) : undefined,
    gaRacingKeep: args["ga-racing-keep"] !== undefined ? nonNegativeIntegerArg(args, "ga-racing-keep", 0) : undefined,
    rlRacingKeep: args["rl-racing-keep"] !== undefined ? nonNegativeIntegerArg(args, "rl-racing-keep", 0) : undefined,
    gaPruneCiSchedule: pruneCiDisabled
      ? ""
      : args["ga-prune-ci-schedule"] !== undefined
        ? stringArg(args, "ga-prune-ci-schedule", DEFAULT_PRUNE_CI_SCHEDULE)
        : args["ga-prune-ci-min-games"] !== undefined
          ? (() => {
              const minGames = nonNegativeIntegerArg(args, "ga-prune-ci-min-games", 0);
              return minGames ? `${minGames}-:${pruneCiTargetWinRate}` : "";
            })()
          : undefined,
    rlPruneCiSchedule: pruneCiDisabled
      ? ""
      : args["rl-prune-ci-schedule"] !== undefined
        ? stringArg(args, "rl-prune-ci-schedule", DEFAULT_PRUNE_CI_SCHEDULE)
        : args["rl-prune-ci-min-games"] !== undefined
          ? (() => {
              const minGames = nonNegativeIntegerArg(args, "rl-prune-ci-min-games", 0);
              return minGames ? `${minGames}-:${pruneCiTargetWinRate}` : "";
            })()
          : undefined,
    pruneCiTargetWinRate,
    pruneCiZ: numberArg(args, "prune-ci-z", DEFAULT_PRUNE_CI_Z),
    resume: !args.fresh,
    progress: !args["no-progress"],
    progressLogIntervalMs: numberArg(args, "progress-log-ms", 5000)
  };
  const result = await runMultiCycleOptimization(options);
  console.log(`Manifest: ${result.manifest.outputs.directory}\\manifest.json`);
  if (result.cycleSummary) {
    result.cycleSummary.forEach(row => {
      console.log(`cycle ${row.cycle}: qualified ${row.qualifiedCount}, delta ${(row.delta * 100).toFixed(2)}%`);
    });
  } else {
    console.log(`GA qualified: ${result.ga.diverseQualified.length}`);
    if (result.cem?.rounds) console.log(`CEM qualified: ${result.cem.diverseQualified.length}`);
    result.rl.bestStrategies.forEach(row => {
      console.log(`${row.characterId}: ${(row.winRate * 100).toFixed(2)}% win (${row.wins}/${row.games}), draws ${row.draws}`);
    });
  }
}

function runWorkerProcess() {
  function handleTask(payload) {
    try {
      if (payload?.task !== "evaluate-basic-chunk") {
        throw new Error(`Unknown strategy optimization worker task: ${payload?.task || "none"}`);
      }
      parentPort.postMessage({
        id: payload.id,
        totals: evaluateBasicChunk(payload)
      });
    } catch (error) {
      parentPort.postMessage({ id: payload?.id, error: error.stack || error.message });
    }
  }
  if (workerData?.task) {
    handleTask(workerData);
    return;
  }
  parentPort.on("message", handleTask);
}

if (!isMainThread) {
  runWorkerProcess();
} else if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_DIVERSITY_DISTANCE,
  buildTrainingTargetAnalysis,
  buildFinalShortlist,
  characterQualifiedComplete,
  characterQualifiedCount,
  compareRows,
  confidencePruneDecision,
  confidencePruneRule,
  eliteRacingPruneDecision,
  evaluateAgainstBasic,
  evaluateCandidateSetStaged,
  evaluateAgainstBasicParallel,
  normalizedDistance,
  qualifiedRows,
  runBanditRl,
  runCemRefinement,
  runChallengeCrossPlayReport,
  runFinalShortlistValidation,
  runGaSearch,
  runMultiCycleOptimization,
  runOptimization,
  runParallelBenchmark,
  selectDiverse,
  workerProfile,
  weightsToVector
};
