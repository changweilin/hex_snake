#!/usr/bin/env node

const path = require("path");
const {
  buildStrategyData,
  updateIndex,
  writeJson
} = require("./apply-ai-strategy");
const { loadCharacters } = require("./sim-core");
const {
  BASIC_STRATEGY_ID,
  basicStrategyWeights
} = require("./basic-ai-strategy");

const root = path.resolve(__dirname, "..");
const strategyDataPath = path.join(root, "data", "high-ai-strategies.json");

function main() {
  const characters = loadCharacters(root);
  const rows = characters.map(character => ({
    characterId: character.id,
    strategyId: BASIC_STRATEGY_ID,
    winRate: 0.5,
    outcomeWinRate: 0.5,
    drawRate: 1,
    decisiveGames: 0,
    decisiveWinRate: 0,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    strategyWeights: basicStrategyWeights()
  }));
  const strategyData = buildStrategyData(rows, characters, "tools/reset-high-ai-basic.js");
  writeJson(strategyDataPath, strategyData);
  updateIndex(strategyData, characters);
  console.log(`Wrote ${strategyDataPath}`);
  console.log("Updated index.html");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
