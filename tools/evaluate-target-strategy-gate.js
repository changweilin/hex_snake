#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  buildCharacterMap,
  loadBalance,
  loadCharacters,
  runSeries
} = require("./sim-core");
const { makeBasicPolicy } = require("./basic-ai-strategy");
const { modelFromStrategyWeights } = require("./simulate-balance");

const root = path.resolve(__dirname, "..");

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, filePath), "utf8"));
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function candidateRowsFromFile(file, characterId) {
  const rows = Array.isArray(file)
    ? file
    : Array.isArray(file.strategies)
      ? file.strategies
      : Array.isArray(file.bestStrategies)
        ? file.bestStrategies
        : file.strategies && typeof file.strategies === "object"
          ? Object.entries(file.strategies).map(([id, row]) => ({ characterId: id, ...(row.strategyWeights ? row : { strategyWeights: row }) }))
          : [];
  return rows
    .filter(row => row.characterId === characterId)
    .filter(row => row.strategyWeights)
    .sort((left, right) => (right.winRate || 0) - (left.winRate || 0));
}

function targetWinRate(result, targetSeat) {
  const total = result.runs || 1;
  if (targetSeat === "player") return result.wins / total;
  return result.losses / total;
}

function summarizeSeat({ result, targetSeat, opponentId }) {
  return {
    opponentId,
    targetSeat,
    runs: result.runs,
    targetWins: targetSeat === "player" ? result.wins : result.losses,
    targetLosses: targetSeat === "player" ? result.losses : result.wins,
    draws: result.draws,
    targetWinRate: targetWinRate(result, targetSeat),
    averageHpDiff: targetSeat === "player" ? result.averageHpDiff : -result.averageHpDiff,
    averageScoreDiff: targetSeat === "player" ? result.averageScoreDiff : -result.averageScoreDiff
  };
}

function average(rows, selector) {
  return rows.length ? rows.reduce((sum, row) => sum + selector(row), 0) / rows.length : 0;
}

function evaluateModel({ balance, target, opponents, runs, seed, modelForTarget, label }) {
  const seats = [];
  opponents.forEach(opponent => {
    const targetAsPlayer = runSeries({
      balance,
      playerCharacter: target,
      computerCharacter: opponent,
      playerModel: modelForTarget(target.id),
      computerModel: makeBasicPolicy(opponent.id),
      runs,
      seed: `${seed}:${label}:${target.id}:player-vs:${opponent.id}`
    });
    seats.push(summarizeSeat({ result: targetAsPlayer, targetSeat: "player", opponentId: opponent.id }));

    const targetAsComputer = runSeries({
      balance,
      playerCharacter: opponent,
      computerCharacter: target,
      playerModel: makeBasicPolicy(opponent.id),
      computerModel: modelForTarget(target.id),
      runs,
      seed: `${seed}:${label}:${target.id}:computer-vs:${opponent.id}`
    });
    seats.push(summarizeSeat({ result: targetAsComputer, targetSeat: "computer", opponentId: opponent.id }));
  });
  return {
    label,
    averageTargetWinRate: average(seats, row => row.targetWinRate),
    averageHpDiff: average(seats, row => row.averageHpDiff),
    averageScoreDiff: average(seats, row => row.averageScoreDiff),
    seats
  };
}

function markdownReport(report) {
  const lines = [
    "# Target Strategy Gate Evaluation",
    "",
    `Generated: ${report.generatedAt}`,
    `Character: ${report.config.characterId}`,
    `Runs per seat: ${report.config.runs}`,
    `Seed: ${report.config.seed}`,
    `Candidate source: ${report.config.candidateSource}`,
    "",
    "## Baseline",
    "",
    `- Baseline target-vs-field win rate: ${percent(report.baseline.averageTargetWinRate)}`,
    "",
    "## Candidate Ranking",
    "",
    "| Rank | Strategy | Source mirror win | Target-vs-field | Delta | HP diff | Score diff |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.candidates.map((row, index) => [
      `| ${index + 1}`,
      row.strategyId,
      percent(row.sourceWinRate || 0),
      percent(row.averageTargetWinRate),
      percent(row.delta),
      row.averageHpDiff.toFixed(2),
      row.averageScoreDiff.toFixed(2)
    ].join(" | ") + " |")
  ];
  return `${lines.join("\n")}\n`;
}

function csvReport(report) {
  const header = ["rank", "strategyId", "sourceWinRate", "targetVsField", "delta", "averageHpDiff", "averageScoreDiff"];
  const rows = report.candidates.map((row, index) => [
    index + 1,
    row.strategyId,
    row.sourceWinRate ?? "",
    row.averageTargetWinRate,
    row.delta,
    row.averageHpDiff,
    row.averageScoreDiff
  ]);
  return `${[header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const characterId = stringArg(args, "character", "dragon");
  const candidateSource = stringArg(args, "candidates", "");
  if (!candidateSource) throw new Error("--candidates is required.");
  const runs = numberArg(args, "runs", 10);
  const top = Math.max(1, Math.floor(numberArg(args, "top", 3)));
  const seed = stringArg(args, "seed", `target-gate-${stamp()}`);
  const outputDir = path.resolve(root, stringArg(args, "output", path.join("reports", `strategy-gate-${stamp()}-${characterId}`)));

  const balance = loadBalance(root);
  const characters = loadCharacters(root);
  const characterById = buildCharacterMap(characters);
  const target = characterById.get(characterId);
  if (!target) throw new Error(`Unknown character: ${characterId}`);
  const opponents = characters.filter(character => character.id !== characterId);
  const rows = candidateRowsFromFile(readJson(candidateSource), characterId).slice(0, top);
  if (!rows.length) throw new Error(`No candidate strategies found for ${characterId} in ${candidateSource}.`);

  const baseline = evaluateModel({
    balance,
    target,
    opponents,
    runs,
    seed,
    label: "baseline",
    modelForTarget: id => makeBasicPolicy(id)
  });

  const candidates = rows.map((row, index) => {
    console.log(`Evaluating ${index + 1}/${rows.length}: ${row.strategyId || row.id || "candidate"}`);
    const evaluated = evaluateModel({
      balance,
      target,
      opponents,
      runs,
      seed,
      label: row.strategyId || row.id || `candidate-${index + 1}`,
      modelForTarget: () => modelFromStrategyWeights(row, "high")
    });
    return {
      strategyId: row.strategyId || row.id || `candidate-${index + 1}`,
      sourceWinRate: row.winRate ?? null,
      averageTargetWinRate: evaluated.averageTargetWinRate,
      delta: evaluated.averageTargetWinRate - baseline.averageTargetWinRate,
      averageHpDiff: evaluated.averageHpDiff,
      averageScoreDiff: evaluated.averageScoreDiff,
      seats: evaluated.seats,
      strategyWeights: row.strategyWeights
    };
  }).sort((left, right) => right.delta - left.delta);

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      characterId,
      runs,
      top,
      seed,
      candidateSource,
      outputDir
    },
    baseline,
    candidates
  };

  writeJson(path.join(outputDir, "target-gate.json"), report);
  writeText(path.join(outputDir, "target-gate.csv"), csvReport(report));
  writeText(path.join(outputDir, "target-gate.md"), markdownReport(report));

  const best = candidates[0];
  console.log(`Baseline: ${percent(baseline.averageTargetWinRate)}`);
  console.log(`Best: ${best.strategyId} ${percent(best.averageTargetWinRate)} (${percent(best.delta)})`);
  console.log(`Report: ${path.join(outputDir, "target-gate.md")}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
