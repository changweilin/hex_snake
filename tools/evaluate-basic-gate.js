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
  modelFromStrategyWeights,
  strategyRowForCharacter
} = require("./simulate-balance");
const {
  BASIC_STRATEGY_ID,
  makeBasicPolicy,
  makeBasicStrategy
} = require("./basic-ai-strategy");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");

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

function emptyTotals(characterId, strategyId, opponentStrategyId) {
  return {
    characterId,
    strategyId,
    opponentStrategyId,
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

function finalizeTotals(totals) {
  const decisiveGames = totals.wins + totals.losses;
  return {
    ...totals,
    winRate: totals.games ? totals.wins / totals.games : 0,
    drawRate: totals.games ? totals.draws / totals.games : 0,
    decisiveGames,
    decisiveWinRate: decisiveGames ? totals.wins / decisiveGames : 0,
    averageDurationMs: totals.games ? totals.totalDurationMs / totals.games : 0,
    averageHpDiff: totals.games ? totals.totalHpDiff / totals.games : 0,
    averageScoreDiff: totals.games ? totals.totalScoreDiff / totals.games : 0,
    outcomeWinRate: totals.games ? (totals.wins + totals.draws * 0.5) / totals.games : 0,
    passedGate: decisiveGames
      ? totals.wins / decisiveGames > 0.5 && (totals.wins + totals.draws * 0.5) / totals.games > 0.5
      : false
  };
}

function evaluateMirrorGate({ balance, character, candidateModel, baselineModel, strategyId, runs, seed }) {
  const totals = emptyTotals(character.id, strategyId, BASIC_STRATEGY_ID);
  for (let index = 0; index < runs; index += 1) {
    const candidateIsPlayer = index % 2 === 0;
    const match = simulateMatch({
      balance,
      playerCharacter: character,
      computerCharacter: character,
      playerModel: candidateIsPlayer ? candidateModel : baselineModel,
      computerModel: candidateIsPlayer ? baselineModel : candidateModel,
      seed: `${seed}:${character.id}:${strategyId}:gate:${index}`
    });
    recordMatch(totals, match, candidateIsPlayer);
  }
  return finalizeTotals(totals);
}

function rowsToCsv(rows) {
  return [
    [
      "characterId",
      "strategyId",
      "opponentStrategyId",
      "games",
      "wins",
      "losses",
      "draws",
      "winRate",
      "outcomeWinRate",
      "drawRate",
      "decisiveGames",
      "decisiveWinRate",
      "passedGate",
      "averageDurationMs",
      "averageHpDiff",
      "averageScoreDiff"
    ],
    ...rows.map(row => [
      row.characterId,
      row.strategyId,
      row.opponentStrategyId,
      row.games,
      row.wins,
      row.losses,
      row.draws,
      row.winRate,
      row.outcomeWinRate,
      row.drawRate,
      row.decisiveGames,
      row.decisiveWinRate,
      row.passedGate,
      row.averageDurationMs,
      row.averageHpDiff,
      row.averageScoreDiff
    ])
  ];
}

function runBasicGateEvaluation(options = {}) {
  const balance = options.balance || loadBalance(root);
  const allCharacters = options.characters || loadCharacters(root);
  const characters = options.characterId
    ? allCharacters.filter(character => character.id === options.characterId)
    : allCharacters;
  if (options.characterId && !characters.length) throw new Error(`Unknown character id: ${options.characterId}`);
  const runs = Math.max(1, Math.floor(Number(options.runs ?? 1000)));
  const seed = String(options.seed || `basic-gate-${stamp()}`);
  const strategyFilePath = options.strategyFile || "data/high-ai-strategies.json";
  const strategyFile = options.strategyFileData || readJson(strategyFilePath);
  const outputBase = options.outputBase || path.join(reportsDir, `basic-gate-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
  const characterById = buildCharacterMap(characters);
  const basic = makeBasicStrategy();
  const results = [];
  const sanity = [];

  characters.forEach(character => {
    const row = strategyRowForCharacter(strategyFile, character.id);
    if (row) {
      results.push(evaluateMirrorGate({
        balance,
        character,
        candidateModel: modelFromStrategyWeights(row),
        baselineModel: makeBasicPolicy(character.id),
        strategyId: row.strategyId || row.id || "high-ai-current",
        runs,
        seed
      }));
    }
    sanity.push(evaluateMirrorGate({
      balance,
      character: characterById.get(character.id),
      candidateModel: makeBasicPolicy(character.id),
      baselineModel: makeBasicPolicy(character.id),
      strategyId: basic.id,
      runs,
      seed: `${seed}:sanity`
    }));
  });

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      seed,
      runs,
      strategySource: strategyFilePath,
      gate: "decisiveWinRate > 0.5 && outcomeWinRate > 0.5",
      baselineStrategyId: BASIC_STRATEGY_ID
    },
    baselineStrategyWeights: basic.strategyWeights,
    results,
    sanity
  };
  writeJson(`${outputBase}.json`, report);
  writeCsv(`${outputBase}.csv`, rowsToCsv(results));
  writeCsv(`${outputBase}-sanity.csv`, rowsToCsv(sanity));
  return {
    report,
    jsonPath: `${outputBase}.json`,
    csvPath: `${outputBase}.csv`,
    sanityCsvPath: `${outputBase}-sanity.csv`
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runBasicGateEvaluation({
    runs: numberArg(args, "runs", 1000),
    seed: stringArg(args, "seed", `basic-gate-${stamp()}`),
    strategyFile: stringArg(args, "strategy-file", "data/high-ai-strategies.json"),
    characterId: args.character ? String(args.character) : undefined,
    outputBase: args.output ? path.resolve(root, args.output) : undefined
  });
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`CSV: ${result.csvPath}`);
  console.log(`Sanity CSV: ${result.sanityCsvPath}`);
  result.report.results.forEach(row => {
    console.log(`${row.characterId}: ${row.passedGate ? "PASS" : "FAIL"} ${(row.decisiveWinRate * 100).toFixed(2)}% decisive, ${(row.outcomeWinRate * 100).toFixed(2)}% with draws (${row.wins}/${row.wins + row.losses}), draws ${row.draws}/${row.games}`);
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
  evaluateMirrorGate,
  runBasicGateEvaluation
};
