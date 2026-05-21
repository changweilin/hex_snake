#!/usr/bin/env node

const { spawnSync } = require("child_process");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmExecPath = process.env.npm_execpath || "";
const checks = [
  { script: "build", reason: "produce a fresh dist package" },
  { script: "text:check", reason: "verify UTF-8 text and generated dist text files" },
  { script: "data:check", reason: "validate strict UTF-8 JSON data" },
  { script: "check:assets", reason: "verify dist manifest and deploy asset formats" },
  { script: "check:size", reason: "enforce dist size budget" },
  { script: "test:quick", reason: "run fast gameplay and data unit checks" },
  { script: "test:network", reason: "verify LAN relay room routing and protocol metadata" },
  { script: "test:module-loader", reason: "verify module loader modes and production fallback" },
  { script: "test:mobile", reason: "verify mobile controls, layout, and screenshot capture" },
  { script: "test:mobile-platform", reason: "verify mobile app platform adapter behavior" },
  { script: "test:smoke", reason: "verify desktop and mobile browser startup" },
  { script: "test:offline", reason: "verify offline shell and service worker basics" },
  { script: "app:check", reason: "verify App shell readiness prerequisites" }
];

function formatDuration(startedAt) {
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

function printChecklist() {
  console.log("Release check sequence:");
  checks.forEach((check, index) => {
    console.log(`${String(index + 1).padStart(2, " ")}. npm run ${check.script} - ${check.reason}`);
  });
}

function npmRunInvocation(script) {
  if (npmExecPath && /\.c?js$/i.test(npmExecPath)) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", script],
      shell: false
    };
  }

  return {
    command: npmCommand,
    args: ["run", script],
    shell: process.platform === "win32"
  };
}

if (process.argv.includes("--list")) {
  printChecklist();
  process.exit(0);
}

const suiteStartedAt = Date.now();
printChecklist();

for (const [index, check] of checks.entries()) {
  const stepStartedAt = Date.now();
  const prefix = `[${index + 1}/${checks.length}]`;
  const invocation = npmRunInvocation(check.script);
  console.log(`\n${prefix} npm run ${check.script}`);

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: invocation.shell
  });

  if (result.error) {
    console.error(`\n${prefix} failed to start npm run ${check.script}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    const code = result.status === null ? "terminated" : result.status;
    console.error(`\n${prefix} npm run ${check.script} failed after ${formatDuration(stepStartedAt)} (exit ${code}).`);
    process.exit(result.status || 1);
  }

  console.log(`${prefix} passed in ${formatDuration(stepStartedAt)}`);
}

console.log(`\nRelease check passed in ${formatDuration(suiteStartedAt)}.`);
