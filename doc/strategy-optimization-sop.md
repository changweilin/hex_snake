# Strategy Optimization SOP

Use this SOP to run Hex Snake strategy optimization. The process is the same for quick exploration and full training; only the run-count profile changes.

## Simulator/Game Parity Preflight

Run this preflight before starting or resuming any strategy optimization. Do not treat optimizer output as usable evidence if the simulator and the browser game may be using different rules, data, or runtime assumptions.

The simulator and actual game must agree on:

- source data: `data/balance.json`, `data/characters.json`, and `data/high-ai-strategies.json`
- core combat rules: food stock, energy/bombs, movement wrapping, collision, damage, stun/slow, and ultimate behavior
- AI runtime rules: high-AI strategy loading, attack timing, target selection, food selection, and side-mirrored player/computer decisions
- environment assumptions: local server build, browser runtime, Node version, and any speed/localStorage settings used by auto battle

Required checks from the project root:

```powershell
npm.cmd run data:check
npm.cmd run test:quick
npm.cmd run simulate:ai-cross -- --runs 5 --jobs 1 --seed sim-game-parity-smoke
```

If recent changes touched `src/game.js`, `src/ui.js`, browser interaction, replay state, ES module loading, timing, controls, or visual/runtime-only game state, also run a browser auto-battle smoke against the local game:

```powershell
npm.cmd run dev
$env:HEX_SNAKE_TAKE_COUNT = "1"
$env:HEX_SNAKE_TAKE_MS = "12000"
node tools\record-mobile-auto-battle.js
```

During the browser smoke, check that the actual game starts, both sides move and cast, no console errors appear, the selected characters and speed settings are honored, and the observed behavior does not contradict `tools/sim-core.js` expectations. If any check fails, fix the simulator/game mismatch first, then rerun this preflight before launching optimization.

## Training Profiles

### Quick Exploration

Use this profile to find candidate directions quickly. Do not treat it as enough evidence for applying final strategies.

```text
--ga-runs 50 --rl-runs 50 --cross-runs 100
```

Meaning:

- `--ga-runs 50`: evaluate each GA candidate with 50 mirror-gate games.
- `--rl-runs 50`: evaluate each RL candidate with 50 mirror-gate games.
- `--cross-runs 100`: validate each target-vs-baseline cross-play seat with 100 games.

### Full Training

Use this profile before applying strategies to the game data.

```text
--ga-runs 1000 --rl-runs 1000 --cross-runs 1000 --min-qualified-per-character 8
```

Meaning:

- `--ga-runs 1000`: reduce noise when ranking GA candidates.
- `--rl-runs 1000`: reduce noise when selecting each character's final RL strategy.
- `--cross-runs 1000`: validate target-vs-baseline cross-play with enough samples for final review.
- `--min-qualified-per-character 8`: require every included character to produce at least 8 diverse GA-qualified candidates.

Optional robustness check:

```text
--cycles 3
```

Use this when time allows multiple independent seeds. Review each cycle's `comparison.md`; do not apply a strategy just because one cycle looks good.

## Default Optimization Settings

These defaults still apply unless overridden:

- `--ga-population 24`
- `--ga-rounds 8`
- `--ga-elites 6`
- `--rl-rounds 12`
- `--rl-samples 16`
- `--seed strategy-optimization`
- all six characters are included unless `--character` is provided

## Confidence-Interval Pruning

GA and RL mirror-gate evaluation use Wilson confidence pruning by default. This is an early-stop filter for weak candidates only; cross-play validation still runs the full requested sample count.

Default pruning settings:

- `--ga-prune-ci-min-games 250`
- `--rl-prune-ci-min-games 150`
- `--prune-ci-target-win-rate 0.5`
- `--prune-ci-z 1.96`

Meaning:

- GA candidates run at least 250 games before pruning can happen.
- RL candidates run at least 150 games before pruning can happen.
- After the minimum, if the candidate's Wilson upper bound is still `<= 50%`, it is marked `pruned` and stops early.
- Pruned candidates are never counted as qualified strategies.

To disable confidence pruning for a run:

```powershell
npm.cmd run optimize:strategy -- --no-prune-ci
```

## Cross-Play Validation

Cross-play is a zero-sum matchup matrix when every character switches strategy at the same time, so a global average cannot prove that a single character's strategy improved.

The final validation in this optimizer uses target-vs-baseline cross-play:

- `baseline-cross.*`: the target character uses the baseline strategy; all opponents also use baseline.
- `best-cross.*`: the target character uses the selected optimized strategy; all opponents stay on baseline.
- Both player and computer seats are evaluated for each target/opponent pair.

Read the per-character delta in `comparison.md` as the marginal gain from changing only that character's strategy.

## Foreground Run

Run from the project root.

Quick exploration:

```powershell
npm.cmd run optimize:strategy -- --ga-runs 50 --rl-runs 50 --cross-runs 100
```

Full training:

```powershell
npm.cmd run optimize:strategy -- `
  --ga-runs 1000 `
  --rl-runs 1000 `
  --cross-runs 1000 `
  --min-qualified-per-character 8 `
  --output reports\strategy-full
```

Use an explicit output directory when the run should be easy to find:

```powershell
npm.cmd run optimize:strategy -- `
  --ga-runs 50 `
  --rl-runs 50 `
  --cross-runs 100 `
  --output reports\strategy-quick
```

## Background Run

Use this when the foreground shell may timeout before the optimization completes. Choose one profile argument string first.

Quick exploration:

```powershell
$profileArgs = '--ga-runs 50 --rl-runs 50 --cross-runs 100'
```

Full training:

```powershell
$profileArgs = '--ga-runs 1000 --rl-runs 1000 --cross-runs 1000 --min-qualified-per-character 8'
```

Start the detached run:

```powershell
$root = "C:\Users\user\Documents\app\hex_snake"
$outDir = "$root\reports\strategy-optimization-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$command = 'cmd.exe /c cd /d "' + $root + '" && "' +
  'C:\Program Files\nodejs\node.exe" tools\run-strategy-optimization.js ' +
  $profileArgs + ' --output "' + $outDir + '" ' +
  '> "' + $outDir + '\run.out.log" 2> "' + $outDir + '\run.err.log"'

Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = $command
  CurrentDirectory = $root
}
```

If `Invoke-CimMethod` requires elevated approval in the current environment, allow it only for starting the detached optimization process.

## Progress Checks

Set the output directory first:

```powershell
$outDir = "C:\Users\user\Documents\app\hex_snake\reports\strategy-optimization-YYYYMMDD-HHMMSS"
```

Check whether the final manifest exists:

```powershell
Test-Path "$outDir\manifest.json"
```

Inspect latest files:

```powershell
Get-ChildItem $outDir -Recurse -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 40 FullName,Length,LastWriteTime
```

Check logs:

```powershell
Get-Content "$outDir\run.out.log" -Tail 30
Get-Content "$outDir\run.err.log" -Tail 30
```

The optimizer now writes live progress and resume files while it is running:

- `training-progress.json`: current phase, completed/planned games, ETA, throughput, and the latest live win-rate estimate with a 95% interval.
- `training-targets.md` / `training-targets.json`: objective, gates, planned work, and success criteria for the run.
- `checkpoint.json`: GA/RL/cross-play resume state. Re-running the same command with the same `--output` resumes automatically.

Useful progress commands:

```powershell
Get-Content "$outDir\training-progress.json"
Get-Content "$outDir\training-targets.md"
Test-Path "$outDir\checkpoint.json"
```

To intentionally ignore a checkpoint and start the same output directory fresh:

```powershell
npm.cmd run optimize:strategy -- --output "$outDir" --fresh
```

Expected phase order:

1. GA writes files under `ga\`.
2. GA completion writes `ga-history.json`, `ga-qualified.json`, and `ga-qualified.csv`.
3. RL writes files under `rl\`.
4. RL completion writes `rl-history.json`, `rl-best-strategies.json`, `rl-best-strategies.csv`, and `best-strategies-for-apply.json`.
5. Target-vs-baseline cross-play validation writes `baseline-cross.*` and `best-cross.*`.
6. Completion writes `comparison.md` and `manifest.json`.

## Completion Check

The run is complete when:

```powershell
Test-Path "$outDir\manifest.json"
```

Then inspect:

```powershell
Get-Content "$outDir\manifest.json"
Get-Content "$outDir\comparison.md"
```

## Output Files

Important files in the output directory:

- `manifest.json`: final status, config, cross-play protocol, and output paths
- `comparison.md`: human-readable marginal target-vs-baseline comparison
- `ga-qualified.json` / `ga-qualified.csv`: GA-qualified candidates
- `rl-best-strategies.json` / `rl-best-strategies.csv`: best RL mirror-gate strategies
- `best-strategies-for-apply.json`: strategy file suitable for applying after validation
- `baseline-cross.json` / `baseline-cross-matrix.csv`: baseline target-vs-baseline validation
- `best-cross.json` / `best-cross-matrix.csv`: optimized target-vs-baseline validation

## Applying Strategies

Only apply optimized strategies after reviewing `comparison.md`.

Recommended apply gate:

- Use the full training profile.
- The optimized target-vs-field average should improve over baseline.
- No character should have an unacceptable negative per-character delta.
- If using `--cycles`, the improvement should repeat across cycles instead of appearing in only one run.

To apply the generated strategy file:

```powershell
npm.cmd run apply:ai-strategy -- --input "$outDir\best-strategies-for-apply.json"
```

For `--cycles` runs, set `$outDir` to the selected `cycle-N` directory before applying.
