#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { loadCharacters } = require("./sim-core");

const root = path.resolve(__dirname, "..");
const strategyDataPath = path.join(root, "data", "high-ai-strategies.json");

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveInput(args) {
  const input = args.input || args.bestStrategies || args["best-strategies"];
  if (!input) throw new Error("--input must point to a best-strategies.json file.");
  return path.resolve(root, input);
}

function rowsFromInput(file) {
  if (Array.isArray(file)) return file;
  if (Array.isArray(file.bestStrategies)) return file.bestStrategies;
  if (Array.isArray(file.strategies)) return file.strategies;
  if (file.strategies && typeof file.strategies === "object") {
    return Object.entries(file.strategies).map(([characterId, row]) => ({
      characterId,
      ...(row.strategyWeights ? row : { strategyWeights: row })
    }));
  }
  throw new Error("Input file must contain an array, bestStrategies, or strategies.");
}

function buildStrategyData(rows, characters, source) {
  const characterIds = new Set(characters.map(character => character.id));
  const strategies = {};
  rows.forEach(row => {
    if (!characterIds.has(row.characterId)) return;
    if (!row.strategyWeights) throw new Error(`Missing strategyWeights for ${row.characterId}.`);
    strategies[row.characterId] = {
      strategyId: row.strategyId || row.id || "best",
      winRate: row.winRate,
      outcomeWinRate: row.outcomeWinRate,
      drawRate: row.drawRate,
      decisiveGames: row.decisiveGames,
      decisiveWinRate: row.decisiveWinRate,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      strategyWeights: row.strategyWeights
    };
  });
  const missing = [...characterIds].filter(characterId => !strategies[characterId]);
  if (missing.length) throw new Error(`Input is missing strategies for: ${missing.join(", ")}`);
  return {
    generatedAt: new Date().toISOString(),
    source,
    strategies
  };
}

function updateIndex() {
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolveInput(args);
  const characters = loadCharacters(root);
  const strategyData = buildStrategyData(rowsFromInput(readJson(inputPath)), characters, inputPath);
  writeJson(strategyDataPath, strategyData);
  console.log(`Wrote ${strategyDataPath}`);
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
  buildStrategyData,
  updateIndex,
  writeJson,
  rowsFromInput
};
