#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  loadBalance,
  loadCharacters,
  runSeries
} = require("./sim-core");
const {
  modelFromStrategyWeights,
  pairToCsvRows,
  strategyRowForCharacter
} = require("./simulate-balance");

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

function readJsonIfPresent(filePath) {
  if (!filePath) return null;
  return JSON.parse(fs.readFileSync(path.resolve(root, filePath), "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeCsv(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rows}\n`, "utf8");
}

function highModel(strategyFile, characterId) {
  const row = strategyRowForCharacter(strategyFile, characterId);
  if (row) return modelFromStrategyWeights(row);
  return { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1, skillStrategy: "preferBig", foodStrategy: "denyOpponent" };
}

function runCrossPlay(options = {}) {
  const balance = options.balance || loadBalance(root);
  const characters = options.characters || loadCharacters(root);
  const runs = Math.max(1, Math.floor(Number(options.runs ?? 1000)));
  const seed = String(options.seed || `ai-cross-${stamp()}`);
  const strategyFile = options.strategyFile || readJsonIfPresent("data/high-ai-strategies.json");
  const outputBase = options.outputBase || path.join(reportsDir, `ai-cross-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
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
        playerModel: highModel(strategyFile, playerCharacter.id),
        computerModel: highModel(strategyFile, computerCharacter.id)
      }));
    });
  });

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      seed,
      runs,
      orderedPairs: results.length,
      skipMirror: true,
      strategySource: options.strategySource || "data/high-ai-strategies.json"
    },
    results
  };
  const jsonPath = `${outputBase}.json`;
  const csvPath = `${outputBase}.csv`;
  writeJson(jsonPath, report);
  writeCsv(csvPath, pairToCsvRows(results));
  return { report, jsonPath, csvPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategyPath = stringArg(args, "strategy-file", "data/high-ai-strategies.json");
  const outputBase = args.output ? path.resolve(root, args.output) : undefined;
  const result = runCrossPlay({
    runs: numberArg(args, "runs", 1000),
    seed: stringArg(args, "seed", `ai-cross-${stamp()}`),
    strategyFile: readJsonIfPresent(strategyPath),
    strategySource: strategyPath,
    outputBase
  });
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`CSV: ${result.csvPath}`);
  console.log(`Pairs: ${result.report.results.length}`);
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
  runCrossPlay
};
