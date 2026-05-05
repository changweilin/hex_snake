#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
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

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildMatrix(results, characters) {
  const byPair = new Map(results.map(result => [
    `${result.playerCharacterId}:${result.computerCharacterId}`,
    result
  ]));
  const rows = characters.map(playerCharacter => ({
    characterId: playerCharacter.id,
    cells: characters.map(computerCharacter => {
      if (playerCharacter.id === computerCharacter.id) return null;
      return byPair.get(`${playerCharacter.id}:${computerCharacter.id}`) || null;
    })
  }));
  const averages = rows.map(row => {
    const played = row.cells.filter(Boolean);
    const averageWinRate = played.length
      ? played.reduce((sum, result) => sum + result.winRate, 0) / played.length
      : 0;
    return {
      characterId: row.characterId,
      averageWinRate,
      games: played.reduce((sum, result) => sum + result.runs, 0)
    };
  });
  return { rows, averages };
}

function matrixToCsv(matrix, characters) {
  const header = ["player\\opponent", ...characters.map(character => character.id), "average"];
  const rows = matrix.rows.map(row => {
    const average = matrix.averages.find(item => item.characterId === row.characterId);
    return [
      row.characterId,
      ...row.cells.map(result => result ? result.winRate.toFixed(4) : ""),
      average.averageWinRate.toFixed(4)
    ];
  });
  return [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
}

function matrixToMarkdown(matrix, characters, report) {
  const header = ["player \\ opponent", ...characters.map(character => character.id), "avg"];
  const divider = header.map(() => "---");
  const rows = matrix.rows.map(row => {
    const average = matrix.averages.find(item => item.characterId === row.characterId);
    return [
      row.characterId,
      ...row.cells.map(result => result ? percent(result.winRate) : "-"),
      percent(average.averageWinRate)
    ];
  });
  const sorted = [...matrix.averages].sort((a, b) => b.averageWinRate - a.averageWinRate);
  const lines = [
    "# Character Cross Win Rates",
    "",
    `Generated: ${report.generatedAt}`,
    `Runs per ordered pair: ${report.config.runs}`,
    `Seed: ${report.config.seed}`,
    `Strategy source: ${report.config.strategySource}`,
    "",
    [header, divider, ...rows].map(row => `| ${row.join(" | ")} |`).join("\n"),
    "",
    "## Average Ranking",
    "",
    ...sorted.map((item, index) => `${index + 1}. ${item.characterId}: ${percent(item.averageWinRate)}`)
  ];
  return lines.join("\n");
}

function highModel(strategyFile, characterId) {
  const row = strategyRowForCharacter(strategyFile, characterId);
  if (row) return modelFromStrategyWeights(row);
  return { aiDifficulty: "high", pathPrecision: 1, aimPrecision: 1, skillStrategy: "preferBig", foodStrategy: "denyOpponent" };
}

function buildOrderedPairs(characters) {
  const pairs = [];
  characters.forEach(playerCharacter => {
    characters.forEach(computerCharacter => {
      if (playerCharacter.id === computerCharacter.id) return;
      pairs.push({ playerCharacter, computerCharacter });
    });
  });
  return pairs;
}

function runPair({ balance, strategyFile, seed, runs, pair }) {
  const { playerCharacter, computerCharacter } = pair;
  return runSeries({
    balance,
    playerCharacter,
    computerCharacter,
    seed: `${seed}:${playerCharacter.id}:vs:${computerCharacter.id}`,
    runs,
    playerModel: highModel(strategyFile, playerCharacter.id),
    computerModel: highModel(strategyFile, computerCharacter.id)
  });
}

function chunkItems(items, chunkCount) {
  const chunks = Array.from({ length: chunkCount }, () => []);
  items.forEach((item, index) => chunks[index % chunkCount].push(item));
  return chunks.filter(chunk => chunk.length);
}

function runPairsSync({ balance, strategyFile, seed, runs, indexedPairs }) {
  return indexedPairs.map(({ index, pair }) => ({
    index,
    result: runPair({ balance, strategyFile, seed, runs, pair })
  }));
}

function runPairsInWorker(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: payload });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", code => {
      if (code !== 0) reject(new Error(`AI cross worker exited with code ${code}.`));
    });
  });
}

async function runPairs({ balance, strategyFile, seed, runs, pairs, jobs }) {
  const indexedPairs = pairs.map((pair, index) => ({ index, pair }));
  if (jobs <= 1 || indexedPairs.length <= 1) return runPairsSync({ balance, strategyFile, seed, runs, indexedPairs });
  const workerCount = Math.min(jobs, indexedPairs.length);
  const chunks = chunkItems(indexedPairs, workerCount);
  const rows = await Promise.all(chunks.map(chunk => runPairsInWorker({
    balance,
    strategyFile,
    seed,
    runs,
    indexedPairs: chunk
  })));
  return rows.flat().sort((left, right) => left.index - right.index);
}

async function runCrossPlay(options = {}) {
  const balance = options.balance || loadBalance(root);
  const characters = options.characters || loadCharacters(root);
  const runs = Math.max(1, Math.floor(Number(options.runs ?? 1)));
  const cpuCount = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  const jobs = Math.max(1, Math.floor(Number(options.jobs ?? cpuCount)));
  const seed = String(options.seed || `ai-cross-${stamp()}`);
  const strategyFile = options.strategyFile || readJsonIfPresent("data/high-ai-strategies.json");
  const outputBase = options.outputBase || path.join(reportsDir, `ai-cross-${stamp()}-${seed.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 32)}`);
  const pairs = buildOrderedPairs(characters);
  const results = (await runPairs({ balance, strategyFile, seed, runs, pairs, jobs })).map(row => row.result);

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      seed,
      runs,
      jobs,
      orderedPairs: results.length,
      skipMirror: true,
      strategySource: options.strategySource || "data/high-ai-strategies.json"
    },
    results
  };
  const jsonPath = `${outputBase}.json`;
  const csvPath = `${outputBase}.csv`;
  const matrixCsvPath = `${outputBase}-matrix.csv`;
  const markdownPath = `${outputBase}.md`;
  const matrix = buildMatrix(results, characters);
  writeJson(jsonPath, report);
  writeCsv(csvPath, pairToCsvRows(results));
  writeCsv(matrixCsvPath, matrixToCsv(matrix, characters));
  fs.writeFileSync(markdownPath, `${matrixToMarkdown(matrix, characters, report)}\n`, "utf8");
  return { report, jsonPath, csvPath, matrixCsvPath, markdownPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategyPath = stringArg(args, "strategy-file", "data/high-ai-strategies.json");
  const outputBase = args.output ? path.resolve(root, args.output) : undefined;
  const result = await runCrossPlay({
    runs: numberArg(args, "runs", 1),
    jobs: numberArg(args, "jobs", typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length),
    seed: stringArg(args, "seed", `ai-cross-${stamp()}`),
    strategyFile: readJsonIfPresent(strategyPath),
    strategySource: strategyPath,
    outputBase
  });
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`CSV: ${result.csvPath}`);
  console.log(`Matrix CSV: ${result.matrixCsvPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`Pairs: ${result.report.results.length}`);
  console.log(`Jobs: ${result.report.config.jobs}`);
}

function workerMain() {
  try {
    parentPort.postMessage(runPairsSync(workerData));
  } catch (error) {
    throw error;
  }
}

if (!isMainThread) {
  workerMain();
} else if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildOrderedPairs,
  runCrossPlay
};
