#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { runInline } = require("./sim-scheduler");

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

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function parseStartTime(value) {
  if (!value) return new Date();
  const match = String(value).match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error("--start must use HH or HH:mm, for example --start 02:00.");
  const start = new Date();
  start.setHours(Number(match[1]), Number(match[2] || 0), 0, 0);
  if (start.getTime() < Date.now()) return new Date();
  return start;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureReportsDir() {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function writeManifest(filePath, manifest) {
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function runCycles(cycles, seed) {
  const startedAt = new Date();
  const startedAtMs = Date.now();
  const job = `sim-${stamp()}-${process.pid}-${manifestSafe(seed)}`;
  const result = runInline({ cycles: String(cycles), seed, job });
  const elapsedMs = Date.now() - startedAtMs;
  const completedAt = new Date();
  return {
    cycles,
    seed,
    jobId: result.job.id,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    elapsedMs
  };
}

function manifestSafe(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(-32);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startAt = parseStartTime(args.start || "02:00");
  const durationHours = numberArg(args, "duration-hours", 6);
  const calibrationCycles = Math.floor(numberArg(args, "calibration-cycles", 5));
  const batchCycles = Math.floor(numberArg(args, "batch-cycles", 1000));
  const maxCycles = Math.floor(numberArg(args, "max-cycles", Number.MAX_SAFE_INTEGER));
  const seed = String(args.seed || `six-hour-${stamp()}`);
  const manifestPath = path.join(reportsDir, `${seed}-manifest.json`);

  ensureReportsDir();

  const manifest = {
    seed,
    startAt: startAt.toISOString(),
    durationHours,
    calibrationCycles,
    batchCycles,
    maxCycles,
    status: "waiting",
    runs: []
  };
  writeManifest(manifestPath, manifest);

  const waitMs = Math.max(0, startAt.getTime() - Date.now());
  if (waitMs) await sleep(waitMs);

  const budgetStartedAtMs = Date.now();
  const deadlineMs = budgetStartedAtMs + durationHours * 60 * 60 * 1000;
  manifest.status = "calibrating";
  manifest.budgetStartedAt = new Date(budgetStartedAtMs).toISOString();
  manifest.deadline = new Date(deadlineMs).toISOString();
  writeManifest(manifestPath, manifest);

  const calibration = runCycles(Math.min(calibrationCycles, maxCycles), `${seed}:calibration`);
  manifest.runs.push(calibration);

  let completedCycles = calibration.cycles;
  let measuredMs = calibration.elapsedMs;
  let msPerCycle = measuredMs / completedCycles;
  const remainingAfterCalibrationMs = Math.max(0, deadlineMs - Date.now());
  let plannedRemainingCycles = Math.max(0, Math.floor(remainingAfterCalibrationMs / msPerCycle));
  plannedRemainingCycles = Math.min(plannedRemainingCycles, Math.max(0, maxCycles - completedCycles));

  manifest.status = "running";
  manifest.calibration = {
    elapsedMs: calibration.elapsedMs,
    msPerCycle,
    remainingAfterCalibrationMs,
    plannedRemainingCycles
  };
  writeManifest(manifestPath, manifest);

  let batchIndex = 1;
  while (plannedRemainingCycles > 0 && Date.now() < deadlineMs) {
    const timeLeftMs = deadlineMs - Date.now();
    const cyclesThatFit = Math.max(1, Math.floor(timeLeftMs / msPerCycle));
    const cycles = Math.min(batchCycles, plannedRemainingCycles, cyclesThatFit);
    const run = runCycles(cycles, `${seed}:batch-${batchIndex}`);
    manifest.runs.push(run);
    completedCycles += run.cycles;
    measuredMs += run.elapsedMs;
    msPerCycle = measuredMs / completedCycles;
    plannedRemainingCycles -= run.cycles;
    manifest.progress = {
      completedCycles,
      measuredMs,
      msPerCycle,
      plannedRemainingCycles,
      timeLeftMs: Math.max(0, deadlineMs - Date.now())
    };
    writeManifest(manifestPath, manifest);
    batchIndex += 1;
  }

  manifest.status = "completed";
  manifest.completedAt = new Date().toISOString();
  manifest.totalCycles = completedCycles;
  manifest.totalElapsedMs = Date.now() - budgetStartedAtMs;
  manifest.finalMsPerCycle = msPerCycle;
  writeManifest(manifestPath, manifest);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Completed cycles: ${completedCycles}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
