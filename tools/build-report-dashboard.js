#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const outputPath = path.join(reportsDir, "dashboard.html");
const characterOrder = ["dragon", "sandworm", "quetzal", "moray", "lobster", "gu_king"];
const ignoredRootReports = new Set(["dashboard.html", "dashboard-jobs.json"]);

function exists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  if (!exists(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { __error: error.message };
  }
}

function readText(filePath) {
  if (!exists(filePath)) return "";
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function statSummary(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      mtimeMs: stat.mtimeMs,
      modifiedAt: stat.mtime.toISOString(),
      size: stat.size
    };
  } catch {
    return { mtimeMs: 0, modifiedAt: null, size: 0 };
  }
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function percentValue(value) {
  if (value === null || value === undefined) return null;
  if (String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(items => items.some(item => String(item).trim() !== ""));
}

function parseMatrixCsv(filePath, label) {
  const text = readText(filePath);
  if (!text) return null;
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const header = rows[0].slice(1);
  const averageIndex = header.findIndex(item => item.toLowerCase() === "average");
  const characters = header
    .filter((item, index) => index !== averageIndex && item)
    .map(item => item.trim());
  const matrixRows = rows.slice(1).map(row => {
    const characterId = row[0];
    const cells = characters.map((opponent, index) => {
      const value = percentValue(row[index + 1]);
      return { opponent, value };
    });
    const average = averageIndex >= 0 ? percentValue(row[averageIndex + 1]) : averageOf(cells.map(cell => cell.value));
    return { characterId, cells, average: round(average, 6) };
  }).filter(row => row.characterId);
  return {
    label,
    source: path.relative(root, filePath),
    characters,
    rows: sortMatrixRows(matrixRows),
    overall: round(averageOf(matrixRows.map(row => row.average)), 6)
  };
}

function sortMatrixRows(rows) {
  const order = new Map(characterOrder.map((id, index) => [id, index]));
  return rows.slice().sort((left, right) =>
    (order.get(left.characterId) ?? 999) - (order.get(right.characterId) ?? 999)
    || left.characterId.localeCompare(right.characterId)
  );
}

function averageOf(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function summarizeResults(results = []) {
  const byCharacter = new Map();
  results.forEach(result => {
    const id = result.playerCharacterId || result.candidateCharacterId;
    if (!id) return;
    const row = byCharacter.get(id) || { characterId: id, games: 0, wins: 0, losses: 0, draws: 0, winRates: [] };
    row.games += Number(result.runs || 0);
    row.wins += Number(result.wins || 0);
    row.losses += Number(result.losses || 0);
    row.draws += Number(result.draws || 0);
    if (Number.isFinite(Number(result.winRate))) row.winRates.push(Number(result.winRate));
    byCharacter.set(id, row);
  });
  return [...byCharacter.values()].map(row => ({
    ...row,
    averageWinRate: round(row.winRates.length ? averageOf(row.winRates) : row.games ? row.wins / row.games : null, 6)
  }));
}

function matrixFromResults(results = [], label, source) {
  if (!results.length) return null;
  const characters = [...new Set(results.flatMap(result => [
    result.playerCharacterId || result.candidateCharacterId,
    result.computerCharacterId || result.opponentCharacterId
  ]).filter(Boolean))].sort((left, right) =>
    (characterOrder.indexOf(left) < 0 ? 999 : characterOrder.indexOf(left))
    - (characterOrder.indexOf(right) < 0 ? 999 : characterOrder.indexOf(right))
    || left.localeCompare(right)
  );
  const byPair = new Map(results.map(result => [
    `${result.playerCharacterId || result.candidateCharacterId}:${result.computerCharacterId || result.opponentCharacterId}`,
    result
  ]));
  const rows = characters.map(characterId => {
    const cells = characters.map(opponent => ({
      opponent,
      value: characterId === opponent ? null : percentValue(byPair.get(`${characterId}:${opponent}`)?.winRate)
    }));
    return {
      characterId,
      cells,
      average: round(averageOf(cells.map(cell => cell.value)), 6)
    };
  });
  return {
    label,
    source,
    characters,
    rows,
    overall: round(averageOf(rows.map(row => row.average)), 6)
  };
}

function strategyRowsFromFile(filePath, runName) {
  const json = readJson(filePath);
  if (!json || json.__error) return [];
  const rows = Array.isArray(json)
    ? json
    : Array.isArray(json.strategies)
      ? json.strategies
      : Array.isArray(json.bestStrategies)
        ? json.bestStrategies
        : json.strategies && typeof json.strategies === "object"
          ? Object.entries(json.strategies).map(([characterId, row]) => ({ characterId, ...(row || {}) }))
          : [];
  return rows.filter(Boolean).map(row => ({
    runName,
    characterId: row.characterId || "unknown",
    characterName: row.characterName || "",
    strategyId: row.strategyId || row.id || "strategy",
    winRate: percentValue(row.winRate),
    decisiveWinRate: percentValue(row.decisiveWinRate),
    outcomeWinRate: percentValue(row.outcomeWinRate),
    drawRate: percentValue(row.drawRate),
    games: Number(row.games || row.decisisiveGames || row.decisiveGames || 0),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    draws: Number(row.draws || 0),
    averageHpDiff: Number.isFinite(Number(row.averageHpDiff)) ? Number(row.averageHpDiff) : null,
    averageScoreDiff: Number.isFinite(Number(row.averageScoreDiff)) ? Number(row.averageScoreDiff) : null,
    source: path.relative(root, filePath)
  }));
}

function topStrategiesFromObject(filePath, runName) {
  const json = readJson(filePath);
  if (!json || json.__error || Array.isArray(json)) return [];
  return Object.entries(json).flatMap(([characterId, rows]) => (
    Array.isArray(rows)
      ? rows.slice(0, 5).map(row => ({
          runName,
          characterId,
          characterName: row.characterName || "",
          strategyId: row.strategyId || row.id || "strategy",
          winRate: percentValue(row.winRate),
          decisiveWinRate: percentValue(row.decisiveWinRate),
          outcomeWinRate: percentValue(row.outcomeWinRate),
          drawRate: percentValue(row.drawRate),
          games: Number(row.games || row.decisiveGames || 0),
          wins: Number(row.wins || 0),
          losses: Number(row.losses || 0),
          draws: Number(row.draws || 0),
          averageHpDiff: Number.isFinite(Number(row.averageHpDiff)) ? Number(row.averageHpDiff) : null,
          averageScoreDiff: Number.isFinite(Number(row.averageScoreDiff)) ? Number(row.averageScoreDiff) : null,
          source: path.relative(root, filePath)
        }))
      : []
  ));
}

function classifyDirectory(name, files) {
  if (files.has("training-progress.json") || files.has("ga-qualified.json") || files.has("rl-best-strategies.json")) return "strategy-optimization";
  if (files.has("best-strategies.json") || files.has("top-strategies.json")) return "ai-strategy";
  if (files.has("matrix.json") || files.has("summary.json")) return "simulation-summary";
  if (name.includes("browser-auto-battle")) return "browser-smoke";
  if (name.includes("mobile-auto-battle")) return "mobile-auto";
  if (name.includes("tune")) return "balance-tune";
  return "report-folder";
}

function readKnownMatrixFiles(dir, files) {
  const names = [
    ["best-cross-matrix.csv", "Optimized target"],
    ["baseline-cross-matrix.csv", "Baseline target"],
    ["matrix.csv", "Matrix"]
  ];
  files.forEach(file => {
    if (file.endsWith("-matrix.csv") && !names.some(([name]) => name === file)) {
      names.push([file, file.replace(/-matrix\.csv$/i, "")]);
    }
  });
  return names
    .filter(([file]) => files.has(file))
    .map(([file, label]) => parseMatrixCsv(path.join(dir, file), label))
    .filter(Boolean);
}

function readDirectoryRun(dirPath, name) {
  const fileNames = fs.readdirSync(dirPath);
  const files = new Set(fileNames);
  const stat = statSummary(dirPath);
  const manifest = readJson(path.join(dirPath, "manifest.json"));
  const progress = readJson(path.join(dirPath, "training-progress.json"));
  const config = readJson(path.join(dirPath, "config.json")) || manifest?.config || progress?.config || null;
  const checkpoint = readJson(path.join(dirPath, "checkpoint.json"));
  const type = classifyDirectory(name, files);
  const matrices = readKnownMatrixFiles(dirPath, files);
  const baseline = matrices.find(matrix => /baseline/i.test(matrix.label));
  const optimized = matrices.find(matrix => /optimized|best/i.test(matrix.label));
  const delta = baseline && optimized && Number.isFinite(baseline.overall) && Number.isFinite(optimized.overall)
    ? round(optimized.overall - baseline.overall, 6)
    : null;
  const strategyFiles = [
    "rl-best-strategies.json",
    "best-strategies.json",
    "best-strategies-for-apply.json"
  ];
  const strategies = strategyFiles
    .filter(file => files.has(file))
    .flatMap(file => strategyRowsFromFile(path.join(dirPath, file), name));
  const topStrategies = files.has("top-strategies.json")
    ? topStrategiesFromObject(path.join(dirPath, "top-strategies.json"), name)
    : [];
  const comparison = readText(path.join(dirPath, "comparison.md")).slice(0, 4000);
  return {
    id: path.relative(reportsDir, dirPath).replace(/\\/g, "/"),
    name,
    type,
    path: path.relative(root, dirPath),
    modifiedAt: stat.modifiedAt,
    mtimeMs: stat.mtimeMs,
    status: progress?.status || manifest?.status || checkpoint?.status || "unknown",
    generatedAt: manifest?.generatedAt || progress?.updatedAt || progress?.startedAt || null,
    config,
    progress: progress && !progress.__error ? progress : null,
    manifest: manifest && !manifest.__error ? manifest : null,
    matrices,
    delta,
    strategies: [...strategies, ...topStrategies],
    comparison,
    fileCount: fileNames.length
  };
}

function rootReportBase(fileName) {
  return fileName
    .replace(/-matrix\.csv$/i, "")
    .replace(/\.(json|csv|md)$/i, "");
}

function readRootRun(base, filesByBase) {
  const files = filesByBase.get(base) || [];
  const jsonFile = files.find(file => file.endsWith(".json") && !file.endsWith("-matrix.json"));
  const matrixFile = files.find(file => file.endsWith("-matrix.csv"));
  const json = jsonFile ? readJson(path.join(reportsDir, jsonFile)) : null;
  const matrix = matrixFile ? parseMatrixCsv(path.join(reportsDir, matrixFile), "Matrix") : null;
  const resultsMatrix = !matrix && json?.results ? matrixFromResults(json.results, "Matrix", jsonFile) : null;
  const stat = statSummary(path.join(reportsDir, jsonFile || matrixFile || files[0]));
  return {
    id: base,
    name: base,
    type: json?.config?.orderedPairs || json?.results ? "ai-cross-play" : "report-file",
    path: path.relative(root, path.join(reportsDir, jsonFile || files[0])),
    modifiedAt: stat.modifiedAt,
    mtimeMs: stat.mtimeMs,
    status: "completed",
    generatedAt: json?.generatedAt || stat.modifiedAt,
    config: json?.config || null,
    progress: null,
    manifest: null,
    matrices: [matrix || resultsMatrix].filter(Boolean),
    delta: null,
    strategies: [],
    comparison: files.includes(`${base}.md`) ? readText(path.join(reportsDir, `${base}.md`)).slice(0, 4000) : "",
    resultsSummary: summarizeResults(json?.results || []),
    fileCount: files.length
  };
}

function collectReports() {
  ensureDir(reportsDir);
  const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
  const directoryRuns = entries
    .filter(entry => entry.isDirectory())
    .map(entry => readDirectoryRun(path.join(reportsDir, entry.name), entry.name));
  const filesByBase = new Map();
  entries.filter(entry => entry.isFile()).forEach(entry => {
    if (!/\.(json|csv|md)$/i.test(entry.name)) return;
    if (ignoredRootReports.has(entry.name)) return;
    const base = rootReportBase(entry.name);
    const rows = filesByBase.get(base) || [];
    rows.push(entry.name);
    filesByBase.set(base, rows);
  });
  const rootRuns = [...filesByBase.keys()].map(base => readRootRun(base, filesByBase));
  const runs = [...directoryRuns, ...rootRuns]
    .filter(run => run.matrices.length || run.progress || run.strategies.length || run.manifest || run.comparison)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  const strategies = runs.flatMap(run => run.strategies.map(row => ({ ...row, runId: run.id, runType: run.type, runStatus: run.status })));
  const progressRuns = runs.filter(run => run.progress);
  const matrixRuns = runs.filter(run => run.matrices.length);
  const latestRun = runs[0] || null;
  const bestDeltaRun = runs
    .filter(run => Number.isFinite(run.delta))
    .sort((left, right) => right.delta - left.delta)[0] || null;
  return {
    generatedAt: new Date().toISOString(),
    reportsDir: path.relative(root, reportsDir),
    runs,
    strategies,
    progressRuns,
    matrixRuns,
    kpis: {
      totalRuns: runs.length,
      matrixRuns: matrixRuns.length,
      strategyRows: strategies.length,
      runningRuns: runs.filter(run => run.status === "running").length,
      latestRunId: latestRun?.id || null,
      latestRunName: latestRun?.name || null,
      bestDeltaRunId: bestDeltaRun?.id || null,
      bestDelta: bestDeltaRun?.delta ?? null
    }
  };
}

function dashboardHtml(data) {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hex Snake Reports Dashboard</title>
  <style>
    :root {
      --bg: #f7f9fb;
      --panel: #ffffff;
      --panel-2: #f1f5f7;
      --text: #172026;
      --muted: #66737c;
      --faint: #8b98a1;
      --border: #d9e1e5;
      --border-strong: #bac7ce;
      --accent: #0f8b9f;
      --accent-2: #d28b16;
      --good: #16845f;
      --bad: #b94848;
      --warn: #b87912;
      --shadow: 0 10px 30px rgba(24, 39, 49, 0.08);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      letter-spacing: 0;
    }
    button, input, select {
      font: inherit;
    }
    .app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
    }
    .sidebar {
      border-right: 1px solid var(--border);
      background: #fbfcfd;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .brand {
      padding: 18px 18px 14px;
      border-bottom: 1px solid var(--border);
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.25;
      font-weight: 760;
    }
    .brand p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .filters {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-bottom: 1px solid var(--border);
    }
    .field {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: white;
      color: var(--text);
      padding: 9px 10px;
      min-height: 36px;
      outline: none;
    }
    .field:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(15, 139, 159, 0.12);
    }
    .run-list {
      overflow: auto;
      padding: 8px;
      display: grid;
      gap: 6px;
    }
    .run-button {
      border: 1px solid transparent;
      background: transparent;
      color: var(--text);
      border-radius: 6px;
      padding: 10px;
      text-align: left;
      cursor: pointer;
      display: grid;
      gap: 5px;
    }
    .run-button:hover { background: #eef4f6; }
    .run-button.is-active {
      background: white;
      border-color: var(--border-strong);
      box-shadow: var(--shadow);
    }
    .run-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-size: 13px;
      font-weight: 680;
    }
    .run-title span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      width: 9px;
      height: 9px;
      flex: none;
      border-radius: 50%;
      background: var(--faint);
    }
    .dot.running { background: var(--accent-2); }
    .dot.completed { background: var(--good); }
    .dot.insufficient { background: var(--warn); }
    .run-meta {
      color: var(--muted);
      font-size: 11px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .main {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 22px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.86);
      position: sticky;
      top: 0;
      z-index: 5;
      backdrop-filter: blur(10px);
    }
    .topbar-title {
      min-width: 0;
    }
    .topbar-title strong {
      display: block;
      font-size: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .topbar-title span {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .server-status {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 5px;
      padding: 0 8px;
      border: 1px solid var(--border);
      color: var(--muted);
      background: #f7fafb;
      font-size: 11px;
      font-weight: 760;
    }
    .server-status.live {
      color: #16664c;
      background: #e5f5ee;
      border-color: #b9decf;
    }
    .server-status.busy {
      color: #875908;
      background: #fff4de;
      border-color: #ead29a;
    }
    .icon-btn {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: white;
      color: var(--text);
      min-height: 34px;
      padding: 0 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 650;
    }
    .icon-btn:hover { border-color: var(--border-strong); }
    .content {
      padding: 18px 22px 28px;
      display: grid;
      gap: 16px;
    }
    .tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .tab {
      border: 0;
      background: transparent;
      padding: 10px 12px;
      cursor: pointer;
      color: var(--muted);
      border-bottom: 2px solid transparent;
      font-size: 13px;
      font-weight: 680;
    }
    .tab.is-active {
      color: var(--text);
      border-color: var(--accent);
    }
    .grid {
      display: grid;
      gap: 14px;
      min-width: 0;
    }
    .overview-grid {
      grid-template-columns: minmax(0, 1.6fr) 360px;
      align-items: start;
      min-width: 0;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .card, .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 1px 0 rgba(20, 34, 42, 0.03);
      min-width: 0;
    }
    .kpi {
      padding: 14px;
      min-height: 88px;
    }
    .kpi label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
      font-weight: 760;
    }
    .kpi strong {
      display: block;
      margin-top: 9px;
      font-size: 24px;
      line-height: 1;
    }
    .kpi span {
      display: block;
      margin-top: 7px;
      color: var(--muted);
      font-size: 12px;
    }
    .panel-head {
      padding: 13px 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .panel-head h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 760;
    }
    .panel-head p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 12px;
    }
    .panel-body {
      padding: 14px;
    }
    .matrix-tools {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      background: #fbfcfd;
    }
    .matrix-tools .tag {
      min-height: 26px;
    }
    .character-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .matrix-wrap {
      overflow: auto;
      max-width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 9px 10px;
      text-align: left;
      vertical-align: middle;
      font-size: 12px;
      line-height: 1.25;
    }
    th {
      color: var(--muted);
      font-weight: 760;
      background: #f7fafb;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .matrix-table th, .matrix-table td {
      text-align: center;
      min-width: 86px;
    }
    .matrix-table th:first-child, .matrix-table td:first-child {
      text-align: left;
      min-width: 118px;
      font-weight: 720;
      background: #fbfcfd;
      position: sticky;
      left: 0;
      z-index: 2;
    }
    .matrix-table tr.is-selected td:first-child,
    .matrix-table th.is-selected,
    .matrix-table td.is-selected {
      outline: 2px solid rgba(15, 139, 159, 0.28);
      outline-offset: -2px;
      background: #eaf6f8;
    }
    .heat {
      border-radius: 5px;
      padding: 7px 8px;
      font-weight: 760;
      color: #102027;
      display: inline-block;
      min-width: 58px;
    }
    .empty {
      color: var(--faint);
    }
    .side-stack {
      display: grid;
      gap: 14px;
      min-width: 0;
    }
    .progress-line {
      display: grid;
      gap: 7px;
      margin-bottom: 12px;
    }
    .bar {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: #e6edf0;
    }
    .bar > span {
      display: block;
      height: 100%;
      background: var(--accent);
      width: 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .meta-box {
      background: var(--panel-2);
      border-radius: 6px;
      padding: 10px;
    }
    .meta-box label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 5px;
    }
    .meta-box strong {
      font-size: 14px;
    }
    .table-wrap {
      overflow: auto;
      max-height: 560px;
      max-width: 100%;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border-radius: 5px;
      padding: 0 7px;
      background: #eaf3f5;
      color: #196775;
      font-size: 11px;
      font-weight: 720;
    }
    .tag.warn {
      background: #fff4de;
      color: #875908;
    }
    .tag.good {
      background: #e5f5ee;
      color: #16664c;
    }
    .delta-pos { color: var(--good); font-weight: 760; }
    .delta-neg { color: var(--bad); font-weight: 760; }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, .8fr);
      gap: 14px;
      align-items: start;
      min-width: 0;
    }
    .runner-grid {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
      min-width: 0;
    }
    .script-list, .job-list, .summary-list {
      display: grid;
      gap: 10px;
    }
    .script-card, .job-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      background: white;
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .script-card strong, .job-card strong {
      font-size: 13px;
    }
    .runner-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .runner-actions .field {
      flex: 1 1 180px;
    }
    .log-tail {
      max-height: 260px;
      overflow: auto;
      border-radius: 6px;
      padding: 10px;
      background: #111820;
      color: #d7e5ea;
      white-space: pre-wrap;
      line-height: 1.45;
    }
    .job-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: start;
    }
    .metric-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .metric {
      background: var(--panel-2);
      border-radius: 6px;
      padding: 8px;
    }
    .metric label {
      display: block;
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 760;
    }
    .metric strong {
      display: block;
      margin-top: 4px;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .summary-list {
      margin: 0;
      padding-left: 17px;
    }
    .summary-list li {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    .mono {
      font-family: "Cascadia Mono", "SFMono-Regular", Consolas, monospace;
      font-size: 12px;
    }
    .note {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .hidden { display: none !important; }
    @media (max-width: 1100px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { min-height: auto; max-height: 44vh; border-right: 0; border-bottom: 1px solid var(--border); }
      .overview-grid, .split, .runner-grid { grid-template-columns: 1fr; }
      .kpis, .character-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 680px) {
      .topbar { height: auto; align-items: flex-start; flex-direction: column; padding: 12px 14px; gap: 10px; }
      .content { padding: 14px; }
      .kpis, .meta-grid, .metric-list, .character-summary { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <h1>Hex Snake Reports</h1>
        <p>Local snapshot dashboard generated from reports/.</p>
      </div>
      <div class="filters">
        <input id="search" class="field" type="search" placeholder="Search reports">
        <select id="typeFilter" class="field"></select>
        <select id="characterFilter" class="field"></select>
        <select id="matrixScope" class="field"></select>
      </div>
      <div id="runList" class="run-list"></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="topbar-title">
          <strong id="selectedTitle">Reports dashboard</strong>
          <span id="selectedSub">Generated snapshot</span>
        </div>
        <div class="toolbar">
          <span id="liveStatus" class="server-status">Snapshot</span>
          <button id="copyPath" class="icon-btn" type="button">Copy path</button>
          <button id="openLatest" class="icon-btn" type="button">Latest</button>
        </div>
      </header>
      <section class="content">
        <nav class="tabs" id="tabs"></nav>
        <section id="view"></section>
      </section>
    </main>
  </div>
  <script>window.REPORT_DASHBOARD_DATA = ${payload};</script>
  <script>
    let data = window.REPORT_DASHBOARD_DATA;
    let runner = data.runner || { profiles: [], jobs: [], observedRuns: [] };
    const serverToken = data.server && data.server.token;
    const canControlScripts = location.protocol.indexOf("http") === 0 && Boolean(serverToken);
    let pollTimer = null;
    const state = {
      tab: "overview",
      runId: data.runs[0] ? data.runs[0].id : null,
      search: "",
      type: "all",
      character: "all",
      matrixScope: "player",
      profileId: runner.profiles && runner.profiles[0] ? runner.profiles[0].id : "",
      extraArgs: "",
      runnerMessage: ""
    };
    const tabs = [
      ["overview", "Overview"],
      ["matrix", "Matrix"],
      ["training", "Training"],
      ["strategy", "Strategy"],
      ["compare", "Compare"],
      ["runner", "Runner"]
    ];
    const fmt = new Intl.NumberFormat("en-US");
    const characterSort = ${JSON.stringify(characterOrder)};
    const pct = value => Number.isFinite(Number(value)) ? (Number(value) * 100).toFixed(1) + "%" : "-";
    const shortDate = value => value ? new Date(value).toLocaleString() : "-";
    const activeRun = () => data.runs.find(run => run.id === state.runId) || data.runs[0] || null;
    const html = (strings, ...values) => strings.map((part, index) => part + (values[index] ?? "")).join("");
    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

    function statusClass(status) {
      if (status === "running") return "running";
      if (String(status).includes("insufficient")) return "insufficient";
      if (String(status).includes("completed")) return "completed";
      return "";
    }
    function heatColor(value) {
      if (!Number.isFinite(Number(value))) return "transparent";
      const v = Math.max(0, Math.min(1, Number(value)));
      const hue = 4 + v * 154;
      const sat = 58;
      const light = 91 - Math.abs(v - 0.5) * 28;
      return "hsl(" + hue.toFixed(0) + " " + sat + "% " + light.toFixed(0) + "%)";
    }
    function deltaClass(value) {
      return Number(value) >= 0 ? "delta-pos" : "delta-neg";
    }
    function average(values) {
      const finite = values.map(Number).filter(Number.isFinite);
      return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
    }
    function sortCharacters(ids) {
      return ids.slice().sort((left, right) =>
        (characterSort.indexOf(left) < 0 ? 999 : characterSort.indexOf(left)) -
        (characterSort.indexOf(right) < 0 ? 999 : characterSort.indexOf(right)) ||
        left.localeCompare(right)
      );
    }
    function allCharacters() {
      const ids = new Set();
      data.runs.forEach(run => {
        (run.matrices || []).forEach(matrix => {
          (matrix.characters || []).forEach(id => ids.add(id));
          (matrix.rows || []).forEach(row => ids.add(row.characterId));
        });
        (run.strategies || []).forEach(row => ids.add(row.characterId));
      });
      return sortCharacters([...ids].filter(Boolean));
    }
    function matrixHasCharacter(matrix, characterId) {
      if (!matrix || characterId === "all") return true;
      return (matrix.characters || []).includes(characterId) || (matrix.rows || []).some(row => row.characterId === characterId);
    }
    function runHasCharacter(run, characterId) {
      if (characterId === "all") return true;
      return (run.matrices || []).some(matrix => matrixHasCharacter(matrix, characterId)) ||
        (run.strategies || []).some(row => row.characterId === characterId);
    }
    function matrixRow(matrix, characterId) {
      return matrix && matrix.rows ? matrix.rows.find(row => row.characterId === characterId) : null;
    }
    function cellValue(row, opponent) {
      const cell = row && row.cells ? row.cells.find(item => item.opponent === opponent) : null;
      return cell ? cell.value : null;
    }
    function matrixCharacterAverage(matrix, characterId, scope = state.matrixScope) {
      if (!matrix || characterId === "all") return matrix ? matrix.overall : null;
      if (scope === "opponent") {
        return average((matrix.rows || []).map(row => row.characterId === characterId ? null : cellValue(row, characterId)));
      }
      const row = matrixRow(matrix, characterId);
      return row ? average((row.cells || []).map(cell => cell.opponent === characterId ? null : cell.value)) : null;
    }
    function currentMatrix(run) {
      if (!run || !run.matrices.length) return null;
      return run.matrices.find(matrix => /optimized|best/i.test(matrix.label)) || run.matrices[0];
    }
    function latestMatrixRun() {
      return data.runs.find(run => run.matrices.length) || null;
    }
    function matrixForDisplay(run) {
      return currentMatrix(run) || currentMatrix(latestMatrixRun());
    }
    function renderTabs() {
      document.getElementById("tabs").innerHTML = tabs.map(([id, label]) =>
        '<button class="tab ' + (state.tab === id ? 'is-active' : '') + '" data-tab="' + id + '" type="button">' + label + '</button>'
      ).join("");
      document.querySelectorAll("[data-tab]").forEach(button => {
        button.addEventListener("click", () => {
          state.tab = button.dataset.tab;
          render();
        });
      });
    }
    function filteredRuns() {
      const q = state.search.toLowerCase();
      return data.runs.filter(run => {
        const matchesSearch = !q || [run.name, run.type, run.status, run.path].some(value => String(value || "").toLowerCase().includes(q));
        const matchesType = state.type === "all" || run.type === state.type;
        const matchesCharacter = runHasCharacter(run, state.character);
        return matchesSearch && matchesType && matchesCharacter;
      });
    }
    function renderFilters() {
      const types = ["all", ...new Set(data.runs.map(run => run.type).sort())];
      const select = document.getElementById("typeFilter");
      select.innerHTML = types.map(type => '<option value="' + esc(type) + '">' + esc(type) + '</option>').join("");
      select.value = state.type;
      const characterSelect = document.getElementById("characterFilter");
      const characters = ["all", ...allCharacters()];
      if (!characters.includes(state.character)) state.character = "all";
      characterSelect.innerHTML = characters.map(character => '<option value="' + esc(character) + '">' + esc(character === "all" ? "all characters" : character) + '</option>').join("");
      characterSelect.value = state.character;
      const scopeSelect = document.getElementById("matrixScope");
      scopeSelect.innerHTML = [
        ["player", "as player"],
        ["opponent", "as opponent"]
      ].map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join("");
      scopeSelect.value = state.matrixScope;
      scopeSelect.disabled = state.character === "all";
    }
    function renderRunList() {
      const runs = filteredRuns();
      const list = document.getElementById("runList");
      list.innerHTML = runs.map(run => (
        '<button class="run-button ' + (run.id === state.runId ? 'is-active' : '') + '" data-run="' + esc(run.id) + '" type="button">' +
          '<div class="run-title"><span class="dot ' + statusClass(run.status) + '"></span><span>' + esc(run.name) + '</span></div>' +
          '<div class="run-meta"><span>' + esc(run.type) + '</span><span>' + esc(run.status) + '</span><span>' + shortDate(run.generatedAt || run.modifiedAt) + '</span></div>' +
        '</button>'
      )).join("");
      document.querySelectorAll("[data-run]").forEach(button => {
        button.addEventListener("click", () => {
          state.runId = button.dataset.run;
          render();
        });
      });
    }
    function renderHeader(run) {
      document.getElementById("selectedTitle").textContent = run ? run.name : "Reports dashboard";
      document.getElementById("selectedSub").textContent = run
        ? run.type + " / " + run.status + " / " + shortDate(run.generatedAt || run.modifiedAt)
        : "Generated " + shortDate(data.generatedAt);
      renderLiveStatus();
    }
    function renderLiveStatus() {
      const live = document.getElementById("liveStatus");
      if (!live) return;
      const runningJobs = (runner.jobs || []).filter(job => job.status === "running" || job.status === "stopping").length;
      const observedRuns = (runner.observedRuns || []).filter(run => run.status === "running").length;
      if (!canControlScripts) {
        live.textContent = "Snapshot";
        live.className = "server-status";
        live.title = "Open the localhost server to enable script controls.";
        return;
      }
      live.textContent = runningJobs || observedRuns ? "Live: " + (runningJobs + observedRuns) + " active" : "Live";
      live.className = "server-status " + (runningJobs || observedRuns ? "busy" : "live");
      live.title = "Connected to the local dashboard server.";
    }
    function renderKpis(run) {
      const matrix = matrixForDisplay(run);
      const progress = run && run.progress ? run.progress.progress : null;
      const selectedAverage = state.character === "all"
        ? matrix && matrix.overall
        : matrixCharacterAverage(matrix, state.character);
      const selectedLabel = state.character === "all"
        ? (matrix ? matrix.label : "no matrix")
        : state.character + " " + state.matrixScope;
      return '<div class="kpis">' +
        '<div class="card kpi"><label>Total runs</label><strong>' + fmt.format(data.kpis.totalRuns) + '</strong><span>' + fmt.format(data.kpis.matrixRuns) + ' with matrices</span></div>' +
        '<div class="card kpi"><label>Running</label><strong>' + fmt.format(data.kpis.runningRuns) + '</strong><span>checkpoint-aware runs</span></div>' +
        '<div class="card kpi"><label>Selected avg</label><strong>' + pct(selectedAverage) + '</strong><span>' + esc(selectedLabel) + '</span></div>' +
        '<div class="card kpi"><label>Best delta</label><strong class="' + deltaClass(data.kpis.bestDelta) + '">' + pct(data.kpis.bestDelta) + '</strong><span>' + esc(data.kpis.bestDeltaRunId || "no comparison") + '</span></div>' +
        '</div>' +
        (progress ? '<div class="card kpi"><label>Selected progress</label><strong>' + pct(progress.percent) + '</strong><span>' + fmt.format(progress.completedGames || 0) + " / " + fmt.format(progress.plannedGames || 0) + " games</span></div>" : "");
    }
    function renderMatrix(matrix) {
      if (!matrix) return '<div class="panel"><div class="panel-body note">No matrix data found for this report.</div></div>';
      const selected = state.character === "all" ? null : state.character;
      if (selected && !matrixHasCharacter(matrix, selected)) {
        return '<div class="panel"><div class="panel-body note">No matrix cells found for ' + esc(selected) + ' in this report.</div></div>';
      }
      const chars = selected && state.matrixScope === "opponent" ? [selected] : matrix.characters;
      const rows = selected && state.matrixScope === "player"
        ? matrix.rows.filter(row => row.characterId === selected)
        : selected && state.matrixScope === "opponent"
          ? matrix.rows.filter(row => row.characterId !== selected)
        : matrix.rows;
      const rowAverages = rows.map(row => average(chars.map(id => id === row.characterId ? null : cellValue(row, id))));
      const shownAverage = selected ? average(rowAverages) : matrix.overall;
      const body = rows.map((row, rowIndex) => '<tr class="' + (row.characterId === selected ? 'is-selected' : '') + '"><td>' + esc(row.characterId) + '</td>' +
        chars.map(id => {
          const cell = row.cells.find(item => item.opponent === id);
          const value = cell ? cell.value : null;
          return '<td class="' + (id === selected ? 'is-selected' : '') + '">' + (Number.isFinite(Number(value)) ? '<span class="heat" style="background:' + heatColor(value) + '">' + pct(value) + '</span>' : '<span class="empty">-</span>') + '</td>';
        }).join("") +
        '<td><strong>' + pct(rowAverages[rowIndex]) + '</strong></td></tr>').join("");
      const filterText = selected
        ? ' / filter ' + selected + ' ' + (state.matrixScope === "opponent" ? "as opponent" : "as player")
        : "";
      return '<div class="panel">' +
        '<div class="panel-head"><div><h2>' + esc(matrix.label) + ' win-rate matrix</h2><p>' + esc(matrix.source) + ' / shown avg ' + pct(shownAverage) + filterText + '</p></div></div>' +
        '<div class="matrix-tools"><span class="tag">' + esc(selected || "all characters") + '</span><span class="note">' + (selected ? esc(state.matrixScope === "opponent" ? "Rows show opponents' win rate against the selected character." : "Row shows selected character win rate against each opponent.") : "Use the character filter in the sidebar to narrow this matrix.") + '</span></div>' +
        '<div class="matrix-wrap"><table class="matrix-table">' +
        '<thead><tr><th>character</th>' + chars.map(id => '<th class="' + (id === selected ? 'is-selected' : '') + '">' + esc(id) + '</th>').join("") + '<th>avg</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div></div>';
    }
    function renderCharacterBreakdown(matrix) {
      const selected = state.character === "all" ? null : state.character;
      if (!selected || !matrix || !matrixHasCharacter(matrix, selected)) return "";
      const playerRow = matrixRow(matrix, selected);
      const pairRows = (matrix.characters || [])
        .filter(opponent => opponent !== selected)
        .map(opponent => {
          const selectedAsPlayer = cellValue(playerRow, opponent);
          const opponentRow = matrixRow(matrix, opponent);
          const opponentAsPlayer = cellValue(opponentRow, selected);
          const seatDelta = Number.isFinite(Number(selectedAsPlayer)) && Number.isFinite(Number(opponentAsPlayer))
            ? Number(selectedAsPlayer) - Number(opponentAsPlayer)
            : null;
          return { opponent, selectedAsPlayer, opponentAsPlayer, seatDelta };
        })
        .filter(row => Number.isFinite(Number(row.selectedAsPlayer)) || Number.isFinite(Number(row.opponentAsPlayer)))
        .sort((left, right) => Number(right.selectedAsPlayer ?? -1) - Number(left.selectedAsPlayer ?? -1));
      const asPlayerValues = pairRows.map(row => row.selectedAsPlayer);
      const opponentWinValues = pairRows.map(row => row.opponentAsPlayer);
      const best = pairRows.filter(row => Number.isFinite(Number(row.selectedAsPlayer)))[0];
      const hardest = pairRows.filter(row => Number.isFinite(Number(row.selectedAsPlayer))).slice().sort((left, right) => Number(left.selectedAsPlayer) - Number(right.selectedAsPlayer))[0];
      return '<div class="panel">' +
        '<div class="panel-head"><div><h2>' + esc(selected) + ' win-rate detail</h2><p>' + esc(matrix.label) + ' / ' + esc(matrix.source) + '</p></div></div>' +
        '<div class="panel-body grid">' +
        '<div class="character-summary">' +
        renderMetric("as player avg", pct(average(asPlayerValues))) +
        renderMetric("best opponent", best ? best.opponent + " " + pct(best.selectedAsPlayer) : "-") +
        renderMetric("hardest opponent", hardest ? hardest.opponent + " " + pct(hardest.selectedAsPlayer) : "-") +
        renderMetric("opponents avg vs selected", pct(average(opponentWinValues))) +
        '</div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>opponent</th><th>' + esc(selected) + ' as player</th><th>opponent as player</th><th>seat delta</th></tr></thead>' +
        '<tbody>' + pairRows.map(row => '<tr><td><strong>' + esc(row.opponent) + '</strong></td><td>' + pct(row.selectedAsPlayer) + '</td><td>' + pct(row.opponentAsPlayer) + '</td><td class="' + deltaClass(row.seatDelta) + '">' + pct(row.seatDelta) + '</td></tr>').join("") + '</tbody>' +
        '</table></div></div></div>';
    }
    function renderProgress(run) {
      if (!run || !run.progress) return '<div class="panel"><div class="panel-body note">No live training-progress.json is available for this report.</div></div>';
      const p = run.progress.progress || {};
      const current = run.progress.current || {};
      const analysis = run.progress.analysis || {};
      const phases = analysis.phases || [];
      return '<div class="panel">' +
        '<div class="panel-head"><div><h2>Training progress</h2><p>' + esc(current.label || run.progress.phase || run.status) + '</p></div><span class="tag ' + (statusClass(run.status) === "running" ? "warn" : "good") + '">' + esc(run.status) + '</span></div>' +
        '<div class="panel-body">' +
        '<div class="progress-line"><div class="bar"><span style="width:' + Math.max(0, Math.min(100, Number(p.percent || 0) * 100)) + '%"></span></div>' +
        '<div class="note">' + fmt.format(p.completedGames || 0) + ' / ' + fmt.format(p.plannedGames || 0) + ' games / ' + pct(p.percent) + ' / ETA ' + esc(p.eta || "-") + ' / ' + esc(p.gamesPerSecond || 0) + ' games/s</div></div>' +
        '<div class="meta-grid">' +
        '<div class="meta-box"><label>Phase</label><strong>' + esc(run.progress.phase || "-") + '</strong></div>' +
        '<div class="meta-box"><label>Elapsed</label><strong>' + esc(p.elapsed || "-") + '</strong></div>' +
        '<div class="meta-box"><label>Live win</label><strong>' + pct(current.estimate && current.estimate.winRate) + '</strong></div>' +
        '<div class="meta-box"><label>95% range</label><strong>' + (current.estimate && current.estimate.ci95 ? pct(current.estimate.ci95.low) + " - " + pct(current.estimate.ci95.high) : "-") + '</strong></div>' +
        '</div><div style="height:12px"></div><table>' +
        '<thead><tr><th>phase</th><th>goal</th><th>planned games</th></tr></thead>' +
        '<tbody>' + phases.map(phase => '<tr><td><strong>' + esc(phase.id) + '</strong></td><td>' + esc(phase.goal) + '</td><td>' + fmt.format(phase.plannedGames || 0) + '</td></tr>').join("") + '</tbody>' +
        '</table></div></div>';
    }
    function renderStrategies(runScoped) {
      const scopedRows = activeRun()?.strategies || [];
      const usingScoped = runScoped && scopedRows.length > 0;
      const rows = (usingScoped ? scopedRows : data.strategies)
        .slice()
        .filter(row => state.character === "all" || row.characterId === state.character)
        .sort((a, b) => Number(b.winRate ?? b.decisiveWinRate ?? -1) - Number(a.winRate ?? a.decisiveWinRate ?? -1))
        .slice(0, 300);
      if (!rows.length) return '<div class="panel"><div class="panel-body note">No strategy summary rows found.</div></div>';
      return '<div class="panel">' +
        '<div class="panel-head"><div><h2>AI strategy performance</h2><p>' + (usingScoped ? "Selected run" : "Top rows across scanned reports") + '</p></div></div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>run</th><th>character</th><th>strategy</th><th>win</th><th>decisive</th><th>outcome</th><th>draw</th><th>games</th><th>hp diff</th><th>score diff</th></tr></thead>' +
        '<tbody>' + rows.map(row => '<tr><td>' + esc(row.runName || row.runId || "") + '</td><td><strong>' + esc(row.characterId) + '</strong></td><td class="mono">' + esc(row.strategyId) + '</td><td>' + pct(row.winRate) + '</td><td>' + pct(row.decisiveWinRate) + '</td><td>' + pct(row.outcomeWinRate) + '</td><td>' + pct(row.drawRate) + '</td><td>' + fmt.format(row.games || 0) + '</td><td>' + (row.averageHpDiff ?? "-") + '</td><td>' + (row.averageScoreDiff ?? "-") + '</td></tr>').join("") + '</tbody>' +
        '</table></div></div>';
    }
    function renderCompare() {
      const rows = data.runs
        .filter(run => (run.matrices.length || Number.isFinite(run.delta)) && runHasCharacter(run, state.character))
        .map(run => {
          const matrix = currentMatrix(run);
          const avg = state.character === "all" ? (matrix ? matrix.overall : null) : matrixCharacterAverage(matrix, state.character);
          return { run, avg, matrixLabel: matrix ? matrix.label : "-", delta: run.delta };
        })
        .sort((a, b) => Number(b.delta ?? b.avg ?? -1) - Number(a.delta ?? a.avg ?? -1));
      return '<div class="panel">' +
        '<div class="panel-head"><div><h2>Version comparison</h2><p>' + (state.character === "all" ? "Matrix averages and target-vs-baseline deltas" : "Filtered averages for " + esc(state.character) + " " + esc(state.matrixScope)) + '</p></div></div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>run</th><th>type</th><th>status</th><th>matrix</th><th>average</th><th>delta</th><th>modified</th></tr></thead>' +
        '<tbody>' + rows.map(item => '<tr><td><strong>' + esc(item.run.name) + '</strong><div class="note mono">' + esc(item.run.path) + '</div></td><td>' + esc(item.run.type) + '</td><td><span class="tag ' + (statusClass(item.run.status) === "running" ? "warn" : "good") + '">' + esc(item.run.status) + '</span></td><td>' + esc(item.matrixLabel) + '</td><td>' + pct(item.avg) + '</td><td class="' + deltaClass(item.delta) + '">' + pct(item.delta) + '</td><td>' + shortDate(item.run.generatedAt || item.run.modifiedAt) + '</td></tr>').join("") + '</tbody>' +
        '</table></div></div>';
    }
    function renderMetric(label, value) {
      return '<div class="metric"><label>' + esc(label) + '</label><strong>' + esc(value ?? "-") + '</strong></div>';
    }
    function renderProgressMini(progress) {
      if (!progress) return '<div class="note">No structured progress detected yet.</div>';
      const width = Math.max(0, Math.min(100, Number(progress.percent || 0) * 100));
      const games = Number.isFinite(Number(progress.completedGames)) && Number.isFinite(Number(progress.plannedGames))
        ? fmt.format(progress.completedGames || 0) + " / " + fmt.format(progress.plannedGames || 0) + " games"
        : "games unknown";
      const estimate = progress.estimate && Number.isFinite(Number(progress.estimate.winRate))
        ? " / est win " + pct(progress.estimate.winRate)
        : "";
      return '<div class="progress-line"><div class="bar"><span style="width:' + width + '%"></span></div>' +
        '<div class="note">' + pct(progress.percent) + ' / ' + games + ' / ETA ' + esc(progress.eta || "-") + estimate + '</div></div>';
    }
    function renderObservedRuns() {
      const observed = runner.observedRuns || [];
      const rows = observed.length
        ? observed.map(run => '<div class="script-card">' +
            '<strong>' + esc(run.name) + '</strong>' +
            '<div class="note mono">' + esc(run.path) + '</div>' +
            renderProgressMini(run.progress) +
            '<div class="run-meta"><span>' + esc(run.phase || run.status) + '</span><span>' + esc(run.current && run.current.label ? run.current.label : "") + '</span><span>' + shortDate(run.updatedAt) + '</span></div>' +
          '</div>').join("")
        : '<div class="note">No active or recently updated training-progress.json files detected.</div>';
      return '<div class="panel"><div class="panel-head"><div><h2>Detected live reports</h2><p>Tracks scripts that write reports/training-progress.json, including runs started outside this page.</p></div></div><div class="panel-body"><div class="script-list">' + rows + '</div></div></div>';
    }
    function renderRunnerSetup() {
      return '<div class="panel"><div class="panel-head"><div><h2>Script runner unavailable from file://</h2><p>Browsers block local HTML from starting local processes directly.</p></div></div>' +
        '<div class="panel-body">' +
        '<p class="note">Start the local dashboard server, then open the localhost URL to enable run/stop controls, live stdout tracking, progress polling, and completion summaries.</p>' +
        '<pre class="mono note">npm.cmd run reports:dashboard:serve\\nhttp://127.0.0.1:8765/</pre>' +
        '</div></div>';
    }
    function renderRunnerControls() {
      const profiles = runner.profiles || [];
      if (!state.profileId && profiles[0]) state.profileId = profiles[0].id;
      const selected = profiles.find(profile => profile.id === state.profileId) || profiles[0] || null;
      const cards = profiles.map(profile => '<div class="script-card">' +
        '<strong>' + esc(profile.label) + '</strong>' +
        '<div class="note">' + esc(profile.description) + '</div>' +
        '<div class="mono note">npm run ' + esc(profile.script) + (profile.args && profile.args.length ? ' -- ' + esc(profile.args.join(" ")) : '') + '</div>' +
      '</div>').join("");
      return '<div class="panel"><div class="panel-head"><div><h2>Run script</h2><p>Allowlisted npm scripts run through the local server, without shell expansion.</p></div></div>' +
        '<div class="panel-body script-list">' +
        '<select id="profileSelect" class="field">' + profiles.map(profile => '<option value="' + esc(profile.id) + '"' + (profile.id === state.profileId ? ' selected' : '') + '>' + esc(profile.label) + '</option>').join("") + '</select>' +
        '<input id="extraArgs" class="field mono" type="text" placeholder="Extra args, e.g. --character sandworm --ga-runs 5" value="' + esc(state.extraArgs) + '">' +
        '<div class="runner-actions"><button id="startJob" class="icon-btn" type="button"' + (!selected ? ' disabled' : '') + '>Run</button><span class="note">' + esc(selected ? selected.script : "No profile") + '</span></div>' +
        (state.runnerMessage ? '<div class="note">' + esc(state.runnerMessage) + '</div>' : '') +
        '<div class="script-list">' + cards + '</div>' +
        '</div></div>';
    }
    function renderJob(job) {
      const status = job.status === "running" || job.status === "stopping" ? "warn" : job.status === "completed" ? "good" : "";
      const logs = (job.logs || []).slice(-120).map(entry => '[' + entry.stream + '] ' + entry.line).join("\\n");
      const summary = job.summary
        ? '<div class="script-card"><strong>' + esc(job.summary.headline) + '</strong>' +
          '<div class="metric-list">' + (job.summary.metrics || []).slice(0, 6).map(item => renderMetric(item.label, item.value)).join("") + '</div>' +
          '<ul class="summary-list">' + (job.summary.findings || []).map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></div>'
        : "";
      return '<div class="job-card">' +
        '<div class="job-head"><div><strong>' + esc(job.label) + '</strong><div class="note mono">' + esc(job.command || job.script) + '</div></div>' +
        '<span class="tag ' + status + '">' + esc(job.status) + '</span></div>' +
        '<div class="metric-list">' +
        renderMetric("pid", job.pid || "-") +
        renderMetric("duration", job.duration || "-") +
        renderMetric("exit", job.exitCode === null || job.exitCode === undefined ? "-" : job.exitCode) +
        '</div>' +
        renderProgressMini(job.progress) +
        (job.outputDir ? '<div class="note mono">' + esc(job.outputDir) + '</div>' : '') +
        (job.status === "running" || job.status === "stopping" ? '<button class="icon-btn" data-stop-job="' + esc(job.id) + '" type="button">Stop</button>' : '') +
        summary +
        '<pre class="log-tail mono">' + esc(logs || "Waiting for output...") + '</pre>' +
      '</div>';
    }
    function renderJobs() {
      const jobs = runner.jobs || [];
      if (!jobs.length) return '<div class="panel"><div class="panel-body note">No dashboard-started jobs yet.</div></div>';
      return '<div class="job-list">' + jobs.map(renderJob).join("") + '</div>';
    }
    function renderRunner() {
      if (!canControlScripts) {
        return '<div class="grid">' + renderRunnerSetup() + renderObservedRuns() + '</div>';
      }
      return '<div class="runner-grid">' +
        '<div class="side-stack">' + renderRunnerControls() + renderObservedRuns() + '</div>' +
        '<div class="grid">' + renderJobs() + '</div>' +
      '</div>';
    }
    function renderOverview(run) {
      return '<div class="grid">' +
        renderKpis(run) +
        '<div class="overview-grid grid"><div class="grid">' +
        renderMatrix(matrixForDisplay(run)) +
        renderCharacterBreakdown(matrixForDisplay(run)) +
        renderStrategies(true) +
        '</div><div class="side-stack">' +
        renderProgress(run) +
        '<div class="panel"><div class="panel-head"><div><h2>Run metadata</h2><p>' + esc(run ? run.path : "") + '</p></div></div><div class="panel-body"><pre class="mono note">' + esc(JSON.stringify(run ? run.config : data.kpis, null, 2)).slice(0, 3000) + '</pre></div></div>' +
        '</div></div></div>';
    }
    function renderView() {
      const run = activeRun();
      if (state.tab === "overview") return renderOverview(run);
      if (state.tab === "matrix") return run && run.matrices.length > 1
        ? run.matrices.map(matrix => renderMatrix(matrix) + renderCharacterBreakdown(matrix)).join("")
        : renderMatrix(matrixForDisplay(run)) + renderCharacterBreakdown(matrixForDisplay(run));
      if (state.tab === "training") return '<div class="split">' + renderProgress(run) + renderCompare() + '</div>';
      if (state.tab === "strategy") return renderStrategies(false);
      if (state.tab === "compare") return renderCompare();
      if (state.tab === "runner") return renderRunner();
      return "";
    }
    function render() {
      renderTabs();
      renderFilters();
      renderRunList();
      renderHeader(activeRun());
      document.getElementById("view").innerHTML = renderView();
      attachRunnerEvents();
    }
    function attachRunnerEvents() {
      const profileSelect = document.getElementById("profileSelect");
      if (profileSelect) {
        profileSelect.addEventListener("change", event => {
          state.profileId = event.target.value;
          render();
        });
      }
      const extraArgs = document.getElementById("extraArgs");
      if (extraArgs) {
        extraArgs.addEventListener("input", event => {
          state.extraArgs = event.target.value;
        });
      }
      const startJob = document.getElementById("startJob");
      if (startJob) startJob.addEventListener("click", startDashboardJob);
      document.querySelectorAll("[data-stop-job]").forEach(button => {
        button.addEventListener("click", () => stopDashboardJob(button.dataset.stopJob));
      });
    }
    async function refreshLiveData(options = {}) {
      if (!canControlScripts) return;
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("state " + response.status);
        const next = await response.json();
        next.server = { ...(next.server || {}), token: serverToken };
        data = next;
        runner = next.runner || { profiles: [], jobs: [], observedRuns: [] };
        const focused = document.activeElement && (document.activeElement.id === "extraArgs" || document.activeElement.id === "profileSelect");
        if (options.force || !focused) render();
        else renderLiveStatus();
      } catch (error) {
        state.runnerMessage = "Live refresh failed: " + error.message;
        renderLiveStatus();
      }
    }
    async function startDashboardJob() {
      if (!canControlScripts || !state.profileId) return;
      state.runnerMessage = "Starting script...";
      render();
      try {
        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dashboard-token": serverToken
          },
          body: JSON.stringify({ profileId: state.profileId, extraArgs: state.extraArgs })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "start failed");
        state.runnerMessage = "Started " + payload.job.id;
        await refreshLiveData({ force: true });
      } catch (error) {
        state.runnerMessage = "Start failed: " + error.message;
        render();
      }
    }
    async function stopDashboardJob(jobId) {
      if (!canControlScripts || !jobId) return;
      try {
        const response = await fetch("/api/jobs/" + encodeURIComponent(jobId) + "/stop", {
          method: "POST",
          headers: { "x-dashboard-token": serverToken }
        });
        if (!response.ok) throw new Error("stop " + response.status);
        await refreshLiveData({ force: true });
      } catch (error) {
        state.runnerMessage = "Stop failed: " + error.message;
        render();
      }
    }
    function startPolling() {
      if (!canControlScripts || pollTimer) return;
      pollTimer = setInterval(() => refreshLiveData(), 1500);
    }
    document.getElementById("search").addEventListener("input", event => {
      state.search = event.target.value;
      renderRunList();
    });
    document.getElementById("typeFilter").addEventListener("change", event => {
      state.type = event.target.value;
      renderRunList();
    });
    document.getElementById("characterFilter").addEventListener("change", event => {
      state.character = event.target.value;
      if (state.character === "all") state.matrixScope = "player";
      const runs = filteredRuns();
      if (!runs.some(run => run.id === state.runId)) {
        state.runId = runs[0] ? runs[0].id : (data.runs[0] ? data.runs[0].id : null);
      }
      render();
    });
    document.getElementById("matrixScope").addEventListener("change", event => {
      state.matrixScope = event.target.value;
      render();
    });
    document.getElementById("openLatest").addEventListener("click", () => {
      state.runId = data.runs[0] ? data.runs[0].id : null;
      render();
    });
    document.getElementById("copyPath").addEventListener("click", async () => {
      const run = activeRun();
      const text = run ? run.path : data.reportsDir;
      try {
        await navigator.clipboard.writeText(text);
        document.getElementById("copyPath").textContent = "Copied";
        setTimeout(() => document.getElementById("copyPath").textContent = "Copy path", 900);
      } catch {
        window.prompt("Copy path", text);
      }
    });
    render();
    startPolling();
  </script>
</body>
</html>`;
}

function main() {
  const data = collectReports();
  ensureDir(reportsDir);
  fs.writeFileSync(outputPath, dashboardHtml(data), "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(`Runs: ${data.kpis.totalRuns}, matrices: ${data.kpis.matrixRuns}, strategy rows: ${data.kpis.strategyRows}`);
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
  collectReports,
  parseCsv,
  parseMatrixCsv,
  dashboardHtml
};
