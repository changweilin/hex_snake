#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  FOOD_TYPES,
  buildCharacterMap,
  loadBalance,
  loadCharacters,
  runSeries
} = require("./sim-core");

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
  if (!Number.isFinite(value)) throw new Error(`--${key} must be numeric.`);
  return value;
}

function stringArg(args, key, fallback) {
  return args[key] === undefined ? fallback : String(args[key]);
}

function parseInitialStock(args, defaults) {
  return Object.fromEntries(FOOD_TYPES.map(type => [type, numberArg(args, `stock-${type}`, defaults[type] || 0)]));
}

function policyFromArgs(args, prefix, fallback) {
  return {
    aiDifficulty: stringArg(args, `${prefix}-aiDifficulty`, fallback.aiDifficulty),
    pathPrecision: numberArg(args, `${prefix}-pathPrecision`, fallback.pathPrecision),
    aimPrecision: numberArg(args, `${prefix}-aimPrecision`, fallback.aimPrecision),
    skillStrategy: stringArg(args, `${prefix}-skillStrategy`, fallback.skillStrategy),
    foodStrategy: stringArg(args, `${prefix}-foodStrategy`, fallback.foodStrategy)
  };
}

function readJsonIfPresent(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(root, filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
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

function strategyRowForCharacter(strategyFile, characterId) {
  if (!strategyFile) return null;
  if (!Array.isArray(strategyFile) && strategyFile.strategies && !Array.isArray(strategyFile.strategies)) {
    const row = strategyFile.strategies[characterId] || strategyFile.strategies.universal;
    return row ? { characterId, ...(row.strategyWeights ? row : { strategyWeights: row }) } : null;
  }
  const rows = Array.isArray(strategyFile) ? strategyFile : strategyFile.bestStrategies || strategyFile.strategies || [];
  return rows.find(row => row.characterId === characterId)
    || rows.find(row => row.characterId === "universal")
    || rows[0]
    || null;
}

function modelFromArgs(args, prefix, fallback, characterId, strategyFiles = {}) {
  const strategyPath = args[`${prefix}-model`];
  const strategyFile = strategyPath ? strategyFiles[strategyPath] : null;
  const strategyRow = strategyRowForCharacter(strategyFile, characterId);
  if (strategyRow) return modelFromStrategyWeights(strategyRow);
  return policyFromArgs(args, prefix, fallback);
}

function toPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function pairToCsvRows(results) {
  const header = [
    "playerCharacterId",
    "computerCharacterId",
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
    "averageDamageDealt",
    "averageDamageTaken",
    "averageFoodCollected",
    "smallCasts",
    "bigCasts",
    "damageDealt",
    "damageTaken",
    "foodCollected",
    "smallCastRate",
    "damagePerCast",
    "stunPerCast",
    "resourceEfficiency",
    "controlValue",
    "burstRisk",
    "warning"
  ];
  const rows = results.map(result => [
    result.playerCharacterId,
    result.computerCharacterId,
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
    result.averageDamageDealt,
    result.averageDamageTaken,
    result.averageFoodCollected,
    result.playerSkill.smallCasts,
    result.playerSkill.bigCasts,
    result.playerSkill.damageDealt,
    result.playerSkill.damageTaken,
    result.playerSkill.foodCollected,
    result.playerSkill.smallCastRate,
    result.playerSkill.damagePerCast,
    result.playerSkill.stunPerCast,
    result.playerSkill.resourceEfficiency,
    result.playerSkill.controlValue,
    result.playerSkill.burstRisk,
    result.warning
  ]);
  return [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
}

function buildWarnings(results, balance) {
  const warnings = [];
  results.forEach(result => {
    if (result.warning) {
      warnings.push(`${result.playerCharacterId} vs ${result.computerCharacterId}: win rate ${toPercent(result.winRate)} is outside ${toPercent(balance.simulation.balanceWinRateMin)}-${toPercent(balance.simulation.balanceWinRateMax)}.`);
    }
  });
  const byCharacter = new Map();
  results.forEach(result => {
    if (!byCharacter.has(result.playerCharacterId)) byCharacter.set(result.playerCharacterId, []);
    byCharacter.get(result.playerCharacterId).push(result.winRate);
  });
  for (const [characterId, winRates] of byCharacter) {
    const average = winRates.reduce((sum, value) => sum + value, 0) / winRates.length;
    if (Math.abs(average - 0.5) > balance.simulation.characterAverageTolerance) {
      warnings.push(`${characterId}: average matrix win rate ${toPercent(average)} differs from 50% by more than ${toPercent(balance.simulation.characterAverageTolerance)}.`);
    }
  }
  return warnings;
}

function createRunOptions(args, balance, playerCharacter, computerCharacter, strategyFiles = {}) {
  return {
    balance,
    playerCharacter,
    computerCharacter,
    seed: stringArg(args, "seed", "42"),
    runs: numberArg(args, "runs", balance.simulation.defaultRuns),
    gridSize: numberArg(args, "gridSize", balance.defaults.gridSize),
    foodCount: numberArg(args, "foodCount", balance.defaults.foodCount),
    initialSpeed: numberArg(args, "initialSpeed", balance.defaults.initialSpeed),
    initialLength: numberArg(args, "initialLength", balance.defaults.initialLength),
    initialEnergy: numberArg(args, "initialEnergy", balance.defaults.initialEnergy),
    initialBombs: numberArg(args, "initialBombs", balance.defaults.initialBombs),
    initialStock: parseInitialStock(args, balance.defaults.initialStock),
    playerModel: modelFromArgs(args, "player", balance.playerModel, playerCharacter.id, strategyFiles),
    computerModel: modelFromArgs(args, "computer", balance.playerModel, computerCharacter.id, strategyFiles)
  };
}

function printSummary(report) {
  console.log(`Hex Snake balance simulation`);
  console.log(`Runs per pair: ${report.config.runs}`);
  console.log(`Seed: ${report.config.seed}`);
  console.log(`Pairs: ${report.results.length}`);
  console.log("");
  report.results.forEach(result => {
    const marker = result.warning ? " !" : "  ";
    console.log(`${marker} ${result.playerCharacterId} vs ${result.computerCharacterId}: ${toPercent(result.winRate)} win, ${toPercent(result.drawRate)} draw, hpDiff ${result.averageHpDiff.toFixed(2)}, scoreDiff ${result.averageScoreDiff.toFixed(2)}`);
  });
  if (report.warnings.length) {
    console.log("");
    console.log("Warnings:");
    report.warnings.forEach(warning => console.log(`- ${warning}`));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const balance = loadBalance(root);
  const characters = loadCharacters(root);
  const characterById = buildCharacterMap(characters);
  const playerId = stringArg(args, "player", balance.defaults.playerCharacterId);
  const computerId = stringArg(args, "computer", balance.defaults.computerCharacterId);
  const selectedPlayers = args.matrix ? characters : [characterById.get(playerId)];
  const selectedComputers = args.matrix ? characters : [characterById.get(computerId)];
  const strategyFiles = {};
  ["player-model", "computer-model"].forEach(key => {
    if (args[key]) strategyFiles[args[key]] = readJsonIfPresent(args[key]);
  });
  if (selectedPlayers.some(Boolean) === false || selectedComputers.some(Boolean) === false) {
    throw new Error(`Unknown character. Available ids: ${characters.map(character => character.id).join(", ")}`);
  }
  const results = [];
  selectedPlayers.filter(Boolean).forEach(playerCharacter => {
    selectedComputers.filter(Boolean).forEach(computerCharacter => {
      if (args.skipMirror && playerCharacter.id === computerCharacter.id) return;
      results.push(runSeries(createRunOptions(args, balance, playerCharacter, computerCharacter, strategyFiles)));
    });
  });
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      runs: numberArg(args, "runs", balance.simulation.defaultRuns),
      seed: stringArg(args, "seed", "42"),
      matrix: Boolean(args.matrix),
      playerModel: args["player-model"] ? args["player-model"] : policyFromArgs(args, "player", balance.playerModel),
      computerModel: args["computer-model"] ? args["computer-model"] : policyFromArgs(args, "computer", balance.playerModel)
    },
    warnings: buildWarnings(results, balance),
    results
  };

  if (args.json) {
    const target = path.resolve(root, args.json);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (args.csv) {
    const target = path.resolve(root, args.csv);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${pairToCsvRows(results)}\n`, "utf8");
  }
  if (!args.quiet) printSummary(report);
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
  modelFromStrategyWeights,
  strategyRowForCharacter,
  policyFromArgs,
  pairToCsvRows,
  createRunOptions
};
