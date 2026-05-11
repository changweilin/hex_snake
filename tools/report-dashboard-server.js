#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { collectReports, dashboardHtml } = require("./build-report-dashboard");

const root = path.resolve(__dirname, "..");
const reportsDir = path.join(root, "reports");
const jobsPath = path.join(reportsDir, "dashboard-jobs.json");
const startedAt = new Date().toISOString();
const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const maxLogLines = 400;
const maxSavedJobs = 80;

const scriptProfiles = [
  {
    id: "reports-dashboard",
    label: "Rebuild dashboard snapshot",
    script: "reports:dashboard",
    nodeScript: "tools/build-report-dashboard.js",
    args: [],
    description: "Refresh reports/dashboard.html and rescan reports/."
  },
  {
    id: "test-quick",
    label: "Quick test suite",
    script: "test:quick",
    nodeScript: "tools/run-tests.js",
    args: ["--quick"],
    description: "Run the quick regression tests and summarize pass count."
  },
  {
    id: "strategy-smoke",
    label: "Strategy optimizer smoke",
    script: "optimize:strategy",
    nodeScript: "tools/run-strategy-optimization.js",
    args: [
      "--seed", "dashboard-smoke-{id}",
      "--character", "dragon",
      "--ga-population", "2",
      "--ga-rounds", "1",
      "--ga-runs", "1",
      "--rl-rounds", "1",
      "--rl-samples", "1",
      "--rl-runs", "1",
      "--cross-runs", "1",
      "--min-qualified", "1",
      "--progress-log-ms", "1000"
    ],
    description: "A tiny checkpoint/progress-enabled optimization run for testing the live tracker."
  },
  {
    id: "ai-cross-smoke",
    label: "AI cross-play smoke",
    script: "simulate:ai-cross",
    nodeScript: "tools/run-ai-cross-play.js",
    args: ["--runs", "1", "--jobs", "1", "--seed", "dashboard-cross-{id}"],
    description: "Run one ordered-pair cross-play pass and generate matrix reports."
  },
  {
    id: "balance-matrix-smoke",
    label: "Balance matrix smoke",
    script: "simulate",
    nodeScript: "tools/simulate-balance.js",
    args: [
      "--matrix",
      "--skipMirror",
      "--runs", "1",
      "--seed", "dashboard-balance-{id}",
      "--json", "reports/dashboard-balance-{id}.json",
      "--csv", "reports/dashboard-balance-{id}.csv",
      "--quiet"
    ],
    description: "Generate a small balance matrix JSON/CSV report."
  }
];

let jobSequence = 0;
const jobs = new Map();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function percent(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "-";
}

function normalizePath(filePath) {
  return path.resolve(root, filePath).replace(/\\/g, "/").toLowerCase();
}

function splitArgs(text = "") {
  const args = [];
  let current = "";
  let quote = null;
  let escaping = false;
  const input = String(text || "");
  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaping) current += "\\";
  if (quote) throw new Error("Extra args has an unclosed quote.");
  if (current) args.push(current);
  return args;
}

function expandProfileArgs(args, jobId) {
  return args.map(arg => String(arg).replace(/\{id\}/g, jobId).replace(/\{stamp\}/g, stamp()));
}

function childEnv() {
  const env = {};
  Object.entries(process.env).forEach(([key, value]) => {
    const existing = Object.keys(env).find(item => item.toLowerCase() === key.toLowerCase());
    if (existing) {
      if (key.toLowerCase() === "path") env[existing] = value;
      return;
    }
    env[key] = value;
  });
  env.FORCE_COLOR = "0";
  return env;
}

function loadSavedJobs() {
  const saved = readJson(jobsPath, { jobs: [] });
  (saved.jobs || []).forEach(job => {
    const restored = {
      ...job,
      pid: null,
      status: job.status === "running" ? "lost" : job.status,
      logs: (job.logs || []).slice(-maxLogLines),
      _stdoutBuffer: "",
      _stderrBuffer: ""
    };
    if (job.status === "running") {
      restored.endedAt = new Date().toISOString();
      restored.summary = restored.summary || {
        status: "lost",
        headline: "Server restarted before this job reported an exit code.",
        findings: ["The report files can still be inspected from the dashboard if the script wrote progress or checkpoints."]
      };
    }
    jobs.set(restored.id, restored);
  });
}

function saveJobs() {
  const publicJobs = [...jobs.values()]
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, maxSavedJobs)
    .map(toPublicJob);
  writeJson(jobsPath, {
    generatedAt: new Date().toISOString(),
    jobs: publicJobs
  });
}

function publicProfiles() {
  return scriptProfiles.map(profile => ({
    id: profile.id,
    label: profile.label,
    script: profile.script,
    nodeScript: profile.nodeScript,
    args: profile.args,
    description: profile.description
  }));
}

function toPublicJob(job) {
  return {
    id: job.id,
    profileId: job.profileId,
    label: job.label,
    script: job.script,
    nodeArgs: job.nodeArgs,
    command: job.command,
    pid: job.pid,
    status: job.status,
    exitCode: job.exitCode,
    signal: job.signal,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    durationMs: job.endedAt ? Date.parse(job.endedAt) - Date.parse(job.startedAt) : Date.now() - Date.parse(job.startedAt),
    duration: formatDuration(job.endedAt ? Date.parse(job.endedAt) - Date.parse(job.startedAt) : Date.now() - Date.parse(job.startedAt)),
    outputDir: job.outputDir,
    outputs: job.outputs,
    progress: job.progress,
    summary: job.summary,
    logs: (job.logs || []).slice(-maxLogLines)
  };
}

function appendLog(job, stream, line) {
  if (!line) return;
  const entry = {
    at: new Date().toISOString(),
    stream,
    line
  };
  job.logs.push(entry);
  if (job.logs.length > maxLogLines) job.logs.splice(0, job.logs.length - maxLogLines);
  parseLine(job, line);
}

function appendChunk(job, stream, chunk) {
  const key = stream === "stderr" ? "_stderrBuffer" : "_stdoutBuffer";
  job[key] = (job[key] || "") + chunk.toString();
  const parts = job[key].split(/\r?\n/);
  job[key] = parts.pop() || "";
  parts.forEach(line => appendLog(job, stream, line));
}

function flushBuffers(job) {
  if (job._stdoutBuffer) appendLog(job, "stdout", job._stdoutBuffer);
  if (job._stderrBuffer) appendLog(job, "stderr", job._stderrBuffer);
  job._stdoutBuffer = "";
  job._stderrBuffer = "";
}

function parseLine(job, line) {
  const progressMatch = line.match(/^\[(\d+(?:\.\d+)?)%\]\s+(.+?);\s+([\d,]+)\/([\d,]+)\s+games;\s+ETA\s+(.+)$/);
  if (progressMatch) {
    const estimateMatch = line.match(/estWin\s+([\d.]+)%\s+\((\d+)\/(\d+),\s+draw\s+([\d.]+)%/);
    job.progress = {
      ...(job.progress || {}),
      percent: Number(progressMatch[1]) / 100,
      label: progressMatch[2],
      completedGames: Number(progressMatch[3].replace(/,/g, "")),
      plannedGames: Number(progressMatch[4].replace(/,/g, "")),
      eta: progressMatch[5],
      estimate: estimateMatch
        ? {
            winRate: Number(estimateMatch[1]) / 100,
            wins: Number(estimateMatch[2]),
            games: Number(estimateMatch[3]),
            drawRate: Number(estimateMatch[4]) / 100
          }
        : job.progress?.estimate || null,
      source: "stdout",
      updatedAt: new Date().toISOString()
    };
  }

  const manifestMatch = line.match(/^Manifest:\s+(.+)$/i);
  if (manifestMatch) {
    const manifestPath = path.resolve(root, manifestMatch[1].trim());
    job.outputs.manifest = manifestPath;
    job.outputDir = /manifest\.json$/i.test(manifestPath) ? path.dirname(manifestPath) : manifestPath;
  }

  const outputMatch = line.match(/^(JSON|CSV|Matrix CSV|Markdown):\s+(.+)$/i);
  if (outputMatch) {
    const key = outputMatch[1].toLowerCase().replace(/\s+/g, "");
    const value = path.resolve(root, outputMatch[2].trim());
    job.outputs[key] = value;
    if (!job.outputDir && normalizePath(value).startsWith(normalizePath(reportsDir))) {
      job.outputDir = path.dirname(value);
    }
  }

  const wroteMatch = line.match(/^Wrote\s+(.+)$/i);
  if (wroteMatch) {
    job.outputs.wrote = path.resolve(root, wroteMatch[1].trim());
  }
}

function refreshJobFromProgress(job) {
  if (!job.outputDir) return;
  const progressPath = path.join(job.outputDir, "training-progress.json");
  const progress = readJson(progressPath, null);
  if (!progress || progress.__error) return;
  const p = progress.progress || {};
  job.progress = {
    ...(job.progress || {}),
    percent: Number(p.percent || 0),
    completedGames: Number(p.completedGames || 0),
    plannedGames: Number(p.plannedGames || 0),
    eta: p.eta || "-",
    elapsed: p.elapsed || "-",
    gamesPerSecond: p.gamesPerSecond || 0,
    phase: progress.phase,
    label: progress.current?.label || progress.phase,
    estimate: progress.current?.estimate || job.progress?.estimate || null,
    source: "training-progress.json",
    updatedAt: progress.updatedAt || new Date().toISOString()
  };
  if (job.status === "running" && progress.status && progress.status !== "running") {
    job.status = progress.status;
  }
}

function runPathForJob(job, reports) {
  if (job.outputDir) {
    const normalized = normalizePath(job.outputDir);
    const run = reports.runs.find(item => normalizePath(item.path) === normalized);
    if (run) return run;
    const rel = path.relative(reportsDir, job.outputDir).replace(/\\/g, "/");
    return reports.runs.find(item => item.id === rel) || null;
  }
  const jsonOutput = job.outputs.json || job.outputs.wrote;
  if (jsonOutput) {
    const base = path.basename(jsonOutput).replace(/\.(json|csv|md)$/i, "").replace(/-matrix$/i, "");
    return reports.runs.find(item => item.id === base || item.name === base) || null;
  }
  return null;
}

function currentMatrix(run) {
  if (!run || !run.matrices || !run.matrices.length) return null;
  return run.matrices.find(matrix => /optimized|best/i.test(matrix.label)) || run.matrices[0];
}

function summarizeFromStdout(job) {
  const text = job.logs.map(entry => entry.line).join("\n");
  const tests = text.match(/(\d+)(?:\/(\d+))?\s+tests passed\./);
  if (tests) {
    const passed = Number(tests[1]);
    const total = tests[2] ? Number(tests[2]) : passed;
    return {
      kind: "tests",
      headline: `${passed}/${total} tests passed`,
      metrics: [
        { label: "passed", value: passed },
        { label: "total", value: total }
      ],
      findings: job.exitCode === 0
        ? ["Quick regression suite completed successfully."]
        : ["Test command exited with a non-zero status; inspect stderr/log tail."]
    };
  }
  const dashboard = text.match(/Runs:\s*(\d+),\s*matrices:\s*(\d+),\s*strategy rows:\s*(\d+)/);
  if (dashboard) {
    return {
      kind: "dashboard",
      headline: `Dashboard snapshot refreshed: ${dashboard[1]} runs, ${dashboard[2]} matrices, ${dashboard[3]} strategy rows`,
      metrics: [
        { label: "runs", value: Number(dashboard[1]) },
        { label: "matrices", value: Number(dashboard[2]) },
        { label: "strategy rows", value: Number(dashboard[3]) }
      ],
      findings: ["The static reports/dashboard.html file was regenerated."]
    };
  }
  return {
    kind: "generic",
    headline: job.exitCode === 0 ? "Script completed successfully." : `Script exited with code ${job.exitCode}.`,
    metrics: [],
    findings: job.exitCode === 0
      ? ["No structured report output was detected; use the log tail for details."]
      : ["The script did not finish cleanly. Check stderr and the last stdout lines."]
  };
}

function buildJobSummary(job) {
  const reports = collectReports();
  const run = runPathForJob(job, reports);
  const stdoutSummary = summarizeFromStdout(job);
  const summary = {
    generatedAt: new Date().toISOString(),
    status: job.status,
    headline: stdoutSummary.headline,
    run: run ? {
      id: run.id,
      name: run.name,
      type: run.type,
      status: run.status,
      path: run.path
    } : null,
    metrics: stdoutSummary.metrics.slice(),
    findings: stdoutSummary.findings.slice(),
    outputs: job.outputs
  };

  if (run) {
    const matrix = currentMatrix(run);
    const progress = run.progress?.progress || job.progress;
    const bestStrategy = (run.strategies || [])
      .slice()
      .sort((left, right) => Number(right.winRate ?? right.decisiveWinRate ?? -1) - Number(left.winRate ?? left.decisiveWinRate ?? -1))[0];
    summary.headline = `${run.name}: ${run.status}`;
    summary.metrics = [
      { label: "type", value: run.type },
      { label: "progress", value: progress?.percent !== undefined ? percent(progress.percent) : "-" },
      { label: "games", value: progress?.completedGames && progress?.plannedGames ? `${progress.completedGames}/${progress.plannedGames}` : "-" },
      { label: "matrix average", value: matrix ? percent(matrix.overall) : "-" },
      { label: "delta", value: Number.isFinite(run.delta) ? percent(run.delta) : "-" },
      { label: "strategy rows", value: (run.strategies || []).length }
    ];
    summary.findings = [
      matrix
        ? `${matrix.label} overall win rate is ${percent(matrix.overall)}.`
        : "No win-rate matrix was produced for this run.",
      Number.isFinite(run.delta)
        ? `Optimized-vs-baseline delta is ${percent(run.delta)}.`
        : "No baseline/optimized delta is available.",
      bestStrategy
        ? `Top strategy row: ${bestStrategy.characterId}/${bestStrategy.strategyId} at ${percent(bestStrategy.winRate ?? bestStrategy.decisiveWinRate)}.`
        : "No strategy rows were detected."
    ];
  }

  if (job.exitCode !== 0 && job.status !== "stopped") {
    summary.findings.unshift(`Process exited with code ${job.exitCode}; review the log tail before trusting partial reports.`);
  }
  if (job.status === "stopped") {
    summary.findings.unshift("Process was stopped by the dashboard; checkpoint/progress files remain available if the script wrote them.");
  }
  return summary;
}

function finishJob(job, status, exitCode = null, signal = null) {
  flushBuffers(job);
  refreshJobFromProgress(job);
  job.status = status;
  job.exitCode = exitCode;
  job.signal = signal;
  job.endedAt = new Date().toISOString();
  job.summary = buildJobSummary(job);
  saveJobs();
}

function startJob(profileId, extraArgsText = "") {
  const profile = scriptProfiles.find(item => item.id === profileId);
  if (!profile) throw new Error(`Unknown script profile: ${profileId}`);
  const id = `${stamp()}-${String(++jobSequence).padStart(3, "0")}`;
  const profileArgs = expandProfileArgs(profile.args || [], id);
  const extraArgs = splitArgs(extraArgsText);
  const scriptArgs = [...profileArgs, ...extraArgs];
  const nodeScript = path.resolve(root, profile.nodeScript);
  const nodeArgs = [nodeScript, ...scriptArgs];
  const child = spawn(process.execPath, nodeArgs, {
    cwd: root,
    env: childEnv(),
    shell: false,
    windowsHide: true
  });
  const job = {
    id,
    profileId: profile.id,
    label: profile.label,
    script: profile.script,
    nodeArgs,
    command: `node ${profile.nodeScript}${scriptArgs.length ? ` ${scriptArgs.join(" ")}` : ""}`,
    pid: child.pid,
    status: "running",
    exitCode: null,
    signal: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    outputDir: null,
    outputs: {},
    progress: null,
    summary: null,
    logs: [],
    _stdoutBuffer: "",
    _stderrBuffer: "",
    child
  };
  jobs.set(id, job);
  saveJobs();

  child.stdout.on("data", chunk => appendChunk(job, "stdout", chunk));
  child.stderr.on("data", chunk => appendChunk(job, "stderr", chunk));
  child.on("error", error => {
    appendLog(job, "stderr", error.message);
    finishJob(job, "failed", 1, null);
  });
  child.on("exit", (code, signal) => {
    if (job.status === "stopping") {
      finishJob(job, "stopped", code, signal);
    } else {
      finishJob(job, code === 0 ? "completed" : "failed", code, signal);
    }
  });
  return job;
}

function stopJob(jobId) {
  const job = jobs.get(jobId);
  if (!job || job.status !== "running" || !job.child) return false;
  job.status = "stopping";
  if (process.platform === "win32" && job.pid) {
    spawnSync("taskkill", ["/pid", String(job.pid), "/T", "/F"], { windowsHide: true });
  } else {
    job.child.kill("SIGTERM");
  }
  return true;
}

function observedRuns(data) {
  const now = Date.now();
  return data.progressRuns
    .filter(run => run.status === "running" || (run.progress?.updatedAt && now - Date.parse(run.progress.updatedAt) < 5 * 60 * 1000))
    .slice(0, 20)
    .map(run => ({
      id: run.id,
      name: run.name,
      type: run.type,
      status: run.status,
      path: run.path,
      updatedAt: run.progress?.updatedAt || run.modifiedAt,
      progress: run.progress?.progress || null,
      current: run.progress?.current || null,
      phase: run.progress?.phase || run.status
    }));
}

function liveState(includeToken = false) {
  [...jobs.values()].forEach(job => {
    if (job.status === "running") refreshJobFromProgress(job);
  });
  const data = collectReports();
  data.server = {
    mode: "live",
    startedAt,
    token: includeToken ? token : undefined
  };
  data.runner = {
    profiles: publicProfiles(),
    jobs: [...jobs.values()]
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .slice(0, maxSavedJobs)
      .map(toPublicJob),
    observedRuns: observedRuns(data)
  };
  return data;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
      if (body.length > 64 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function requireToken(req) {
  return req.headers["x-dashboard-token"] === token;
}

function requestHandler(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/dashboard.html" || url.pathname === "/reports/dashboard.html")) {
    const body = dashboardHtml(liveState(true));
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(body);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, liveState(false));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/jobs") {
    if (!requireToken(req)) {
      sendJson(res, 403, { error: "Invalid dashboard token." });
      return;
    }
    readBody(req)
      .then(body => {
        const job = startJob(body.profileId, body.extraArgs || "");
        sendJson(res, 201, { job: toPublicJob(job) });
      })
      .catch(error => sendJson(res, 400, { error: error.message }));
    return;
  }

  const stopMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/stop$/);
  if (req.method === "POST" && stopMatch) {
    if (!requireToken(req)) {
      sendJson(res, 403, { error: "Invalid dashboard token." });
      return;
    }
    const ok = stopJob(stopMatch[1]);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

function listen(port) {
  const server = http.createServer(requestHandler);
  server.on("error", error => {
    if (error.code === "EADDRINUSE" && port < 8799) {
      listen(port + 1);
      return;
    }
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Hex Snake report dashboard server`);
    console.log(`URL: http://127.0.0.1:${port}/`);
    console.log(`Profiles: ${scriptProfiles.map(profile => profile.id).join(", ")}`);
  });
}

function main() {
  ensureDir(reportsDir);
  loadSavedJobs();
  const port = Number(process.env.PORT || process.argv.find(arg => /^\d+$/.test(arg)) || 8765);
  listen(port);
}

if (require.main === module) {
  main();
}

module.exports = {
  splitArgs,
  startJob,
  stopJob,
  liveState
};
