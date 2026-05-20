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
--ga-runs 50 --cem-rounds 1 --cem-samples 6 --cem-runs 50 --rl-runs 50 --final-candidates-per-character 2 --final-candidate-runs 50 --cross-runs 100
```

Meaning:

- `--ga-runs 50`: evaluate each GA candidate with 50 mirror-gate games.
- `--cem-rounds 1`: run one Cross-Entropy Method refinement pass around GA-qualified regions.
- `--rl-runs 50`: evaluate each RL candidate with 50 mirror-gate games.
- `--final-candidate-runs 50`: run a small target-vs-baseline check for each shortlisted final candidate.
- `--cross-runs 100`: validate each target-vs-baseline cross-play seat with 100 games.

### Full Training

Use this profile before applying strategies to the game data.

```text
--ga-runs 1000 --cem-rounds 2 --cem-samples 12 --cem-runs 1000 --rl-runs 1000 --final-candidates-per-character 3 --final-candidate-runs 500 --cross-runs 1000 --min-qualified-per-character 8
```

Meaning:

- `--ga-runs 1000`: reduce noise when ranking GA candidates.
- `--cem-runs 1000`: refine promising GA regions with the same mirror-gate sample size before RL selection.
- `--rl-runs 1000`: reduce noise when selecting each character's final RL strategy.
- `--final-candidates-per-character 3`: keep a small final candidate pool for target-vs-baseline validation.
- `--final-candidate-runs 500`: use moderate final-shortlist validation before the full cross-play report.
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
- `--cem-rounds 0` (disabled unless explicitly enabled)
- `--cem-samples 12`
- `--cem-elites 4`
- `--cem-sigma 0.36`
- `--cem-min-sigma 0.04`
- `--cem-smoothing 0.65`
- `--rl-rounds 12`
- `--rl-samples 16`
- `--final-candidates-per-character 1`
- `--final-candidate-runs 0`
- `--final-shortlist-distance 0.06`
- `--seed strategy-optimization`
- `--worker-profile custom`
- `--jobs 1`
- `--parallel-chunk-games 50`
- `--early-batch-games 10`
- `--min-games-per-worker 8`
- all six characters are included unless `--character` is provided

## Multi-Core Parallelism

Use `--worker-profile daily` or `--worker-profile overnight` to evaluate GA/CEM/RL candidates with a persistent Node worker pool. The optimizer keeps workers alive and reuses them across batches, splits mirror-gate games across useful workers, then merges totals before ranking or pruning. Cross-play validation remains serial so the final matchup matrix stays easy to resume and inspect.

Recommended profiles:

| Profile | Workers | Candidate jobs | Main batch | Early batch | Min games / worker | Racing stages | Default CI schedule |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `daily` | 8 | 2 | 80 | 16 | 8 | `160,480` | `16-80:0.45,81-160:0.48,161-:0.5` |
| `overnight` | 16 | 4 | 160 | 32 | 10 | `320,720` | `32-160:0.45,161-320:0.48,321-:0.5` |

Profile racing defaults:

- `daily` and `overnight` use `--racing-z 1.64`, while fixed CI pruning remains at `--prune-ci-z 1.96`.
- `daily` and `overnight` use `--ga-racing-keep 7` and `--rl-racing-keep 5`.
- GA freezes a character for later rounds once that character already has the required number of diverse qualified strategies.

Daily work profile:

```powershell
npm.cmd run optimize:strategy -- --worker-profile daily
```

Overnight profile:

```powershell
npm.cmd run optimize:strategy -- --worker-profile overnight
```

Auto-select profile with a short benchmark:

```powershell
npm.cmd run optimize:strategy -- --worker-profile auto --auto-benchmark-candidates 4 --auto-benchmark-runs 240
```

Benchmark the profiles on the current machine:

```powershell
npm.cmd run optimize:strategy -- --benchmark-parallel --benchmark-candidates 8 --benchmark-runs 600 --benchmark-profiles daily,overnight --character dragon
```

Notes:

- `--jobs` is capped at the machine's available CPU parallelism.
- Explicit `--jobs`, `--candidate-jobs`, `--parallel-chunk-games`, `--early-batch-games`, `--min-games-per-worker`, or prune schedules override the selected profile.
- `--candidate-jobs` controls how many candidates from the same character/round are evaluated at once. Each candidate receives a share of the worker pool.
- `--parallel-chunk-games` controls the main batch size for each candidate. Smaller values check pruning more often; larger values reduce worker overhead.
- `--early-batch-games` controls the smaller pre-open-stage batches used while early CI pruning is active.
- `--min-games-per-worker` prevents tiny batches from being split across too many workers.
- `--racing-stages` controls staged sample upgrades. At each stage, candidates whose Wilson upper bound is below the current elite cutoff lower bound are pruned.
- `--racing-z`, `--ga-racing-keep`, and `--rl-racing-keep` tune how strict the elite racing cutoff is.
- `--no-racing` disables staged elite racing while keeping fixed CI pruning.
- `--worker-profile auto` writes `auto-worker-benchmark.json` to the output directory and then runs with the fastest measured profile.
- Checkpoints include the worker profile and batch settings; changing them intentionally starts from a fresh compatible checkpoint for that output directory.

## CEM Refinement

CEM is an optional Cross-Entropy Method stage between GA and RL. It uses GA-qualified rows to estimate a diagonal distribution over strategy weights, samples candidates from that distribution, evaluates them with the same mirror-gate/pruning/racing path, then feeds CEM-qualified rows into RL together with GA rows.

Recommended settings:

- Quick: `--cem-rounds 1 --cem-samples 6 --cem-runs 50`
- Daily/full: `--cem-rounds 2 --cem-samples 12 --cem-runs 1000`
- Overnight: `--cem-rounds 3 --cem-samples 16 --cem-runs 1200`

Useful controls:

- `--cem-elites`: number of top candidates used to update the next distribution.
- `--cem-sigma`: starting exploration width.
- `--cem-min-sigma`: lower bound so CEM does not collapse to one point too early.
- `--cem-smoothing`: how strongly each round moves toward the newest elite distribution.
- `--no-cem`: explicitly disables the stage.

## Final Shortlist

The final shortlist stage sits after RL and before the full cross-play report. It collects the best GA-qualified, CEM-qualified, and RL-best rows per character, keeps a small diverse pool, and can run a moderate target-vs-baseline check before choosing the strategy file written to `best-strategies-for-apply.json`.

Recommended settings:

- Quick: `--final-candidates-per-character 2 --final-candidate-runs 50`
- Daily/full: `--final-candidates-per-character 3 --final-candidate-runs 500`
- Overnight: `--final-candidates-per-character 3 --final-candidate-runs 500`

Useful controls:

- `--final-candidates-per-character`: how many candidates to keep per character.
- `--final-candidate-runs`: runs per seat for each shortlisted candidate against baseline opponents. Use `0` to only write the shortlist and keep the previous RL-best behavior.
- `--final-shortlist-distance`: diversity distance inside each character's final pool. Lower than GA diversity is intentional because this is a focused final pool.

The full `best-cross.*` report still runs after this stage. Treat final-shortlist validation as selection help, and treat `best-cross.*` as the final evidence.

## Confidence-Interval Pruning

GA, CEM, and RL mirror-gate evaluation use Wilson confidence pruning by default. This is an early-stop filter for weak candidates only; cross-play validation still runs the full requested sample count. CEM uses the RL prune schedule because it is a refinement stage.

Custom/default pruning settings:

- `--ga-prune-ci-schedule 10-50:0.45,51-100:0.48,101-:0.5`
- `--rl-prune-ci-schedule 10-50:0.45,51-100:0.48,101-:0.5`
- `--prune-ci-z 1.96`

Meaning:

- From games 10-50, a candidate is pruned when the Wilson upper bound is `< 45%`.
- From games 51-100, a candidate is pruned when the Wilson upper bound is `< 48%`.
- From game 101 onward, a candidate is pruned when the Wilson upper bound is `< 50%`.
- Thresholds use strict `<`, so a candidate exactly at the threshold keeps running.
- Pruned candidates are never counted as qualified strategies.
- `daily` and `overnight` worker profiles use wider worker-aligned schedules listed in the Multi-Core Parallelism table unless explicit schedules are passed.

To use the older single-stage shape, pass a schedule with an open range:

```powershell
npm.cmd run optimize:strategy -- --ga-prune-ci-schedule 250-:0.5 --rl-prune-ci-schedule 150-:0.5
```

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
npm.cmd run optimize:strategy -- --ga-runs 50 --cem-rounds 1 --cem-samples 6 --cem-runs 50 --rl-runs 50 --final-candidates-per-character 2 --final-candidate-runs 50 --cross-runs 100
```

Full training:

```powershell
npm.cmd run optimize:strategy -- `
  --ga-runs 1000 `
  --cem-rounds 2 `
  --cem-samples 12 `
  --cem-runs 1000 `
  --rl-runs 1000 `
  --final-candidates-per-character 3 `
  --final-candidate-runs 500 `
  --cross-runs 1000 `
  --min-qualified-per-character 8 `
  --worker-profile daily `
  --output reports\strategy-full
```

Use an explicit output directory when the run should be easy to find:

```powershell
npm.cmd run optimize:strategy -- `
  --ga-runs 50 `
  --cem-rounds 1 `
  --cem-samples 6 `
  --cem-runs 50 `
  --rl-runs 50 `
  --final-candidates-per-character 2 `
  --final-candidate-runs 50 `
  --cross-runs 100 `
  --output reports\strategy-quick
```

## Background Run

Use this when the foreground shell may timeout before the optimization completes. Choose one profile argument string first.

Quick exploration:

```powershell
$profileArgs = '--ga-runs 50 --cem-rounds 1 --cem-samples 6 --cem-runs 50 --rl-runs 50 --final-candidates-per-character 2 --final-candidate-runs 50 --cross-runs 100'
```

Full training:

```powershell
$profileArgs = '--ga-runs 1000 --cem-rounds 2 --cem-samples 12 --cem-runs 1000 --rl-runs 1000 --final-candidates-per-character 3 --final-candidate-runs 500 --cross-runs 1000 --min-qualified-per-character 8 --worker-profile daily'
```

Overnight full training:

```powershell
$profileArgs = '--ga-runs 1200 --cem-rounds 3 --cem-samples 16 --cem-runs 1200 --rl-runs 1200 --final-candidates-per-character 3 --final-candidate-runs 500 --cross-runs 1500 --min-qualified-per-character 8 --worker-profile overnight'
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
- `training-progress.json`: also includes `pruningAdjustedEta` after enough GA candidates have completed, using observed pruning savings to estimate a more realistic remaining time.
- `training-targets.md` / `training-targets.json`: objective, gates, planned work, and success criteria for the run.
- `checkpoint.json`: GA/CEM/RL/cross-play resume state. Re-running the same command with the same `--output` resumes automatically.

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
3. If enabled, CEM writes files under `cem\`.
4. If enabled, CEM completion writes `cem-history.json`, `cem-qualified.json`, and `cem-qualified.csv`.
5. RL writes files under `rl\`.
6. RL completion writes `rl-history.json`, `rl-best-strategies.json`, and `rl-best-strategies.csv`.
7. Final shortlist writes `final-shortlist.*`; if enabled, final-shortlist validation writes `final-shortlist-validation.*`.
8. The selected final strategies are written to `best-strategies-for-apply.json`.
9. Target-vs-baseline cross-play validation writes `baseline-cross.*` and `best-cross.*`.
10. Completion writes `comparison.md` and `manifest.json`.

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
- `cem-qualified.json` / `cem-qualified.csv`: CEM-qualified refinement candidates, when `--cem-rounds > 0`
- `rl-best-strategies.json` / `rl-best-strategies.csv`: best RL mirror-gate strategies
- `final-shortlist.json` / `final-shortlist.csv`: per-character final candidate pool and selected strategy rows
- `final-shortlist-validation.json` / `final-shortlist-validation.csv`: optional target-vs-baseline validation for the shortlist
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

For a single-character candidate pool, verify the candidate back against the full baseline field before spending time on a longer run or applying it:

```powershell
npm.cmd run evaluate:strategy-gate -- --character dragon --candidates reports\strategy-target-dragon\ga-qualified.json --top 3 --runs 10 --seed dragon-gate-probe
```

Treat this as a probe unless the run count is high enough for the decision. A positive mirror-gate result alone is not enough, because it can still lose target-vs-field.

To apply the generated strategy file:

```powershell
npm.cmd run apply:ai-strategy -- --input "$outDir\best-strategies-for-apply.json"
```

For `--cycles` runs, set `$outDir` to the selected `cycle-N` directory before applying.
