---
name: hex-snake-balance
description: Use for Hex Snake battle balance work: run seeded Monte Carlo simulations, compare character matchup matrices, evaluate skill efficiency, tune data/balance.json or character parameters, and justify food, movement, damage, stun, ammo, resource, or simulator strategy changes with before/after evidence.
---

# Hex Snake Balance

Use this skill whenever changing battle balance, character matchup tuning, food/resource parameters, skill costs, damage, stun, movement speed, attack timing, or simulation strategy.

## Sources

- `data/balance.json`: Rule parameters, UI limits/defaults, simulation thresholds, and player model defaults.
- `data/characters.json`: Character ids, food preferences, colors, and special food flags.
- `tools/sim-core.js`: Simulation rules and metrics.
- `tools/simulate-balance.js`: CLI for seeded matchup runs and report generation.
- `reports/`: JSON/CSV output for baseline and comparison reports.

## Workflow

1. Read the sources of truth before changing values.
2. Capture a baseline with a fixed seed before editing:
   ```bash
   npm.cmd run simulate -- --runs 1000 --seed balance-baseline --matrix --json reports/baseline.json --csv reports/baseline.csv
   ```
3. Make the smallest balance change that addresses the target issue.
4. Re-run the same seed, run count, and matchup scope into a separate report:
   ```bash
   npm.cmd run simulate -- --runs 1000 --seed balance-baseline --matrix --json reports/after.json --csv reports/after.csv
   ```
5. Compare before/after:
   - Win rate by matchup; target range is 45%-55% unless a specific design goal says otherwise.
   - Character average matrix win rate; flag deviations greater than 5 percentage points from 50%.
   - Average HP diff, score diff, duration, small/big cast rate, damage per cast, stun per cast, resource efficiency, control value, and burst risk.
6. Keep or recommend only changes that improve the target metric without creating a larger adjacent regression.

## Commands

Project tests on Windows:
```bash
npm.cmd test
```

Smoke matrix:
```bash
npm.cmd run simulate -- --runs 100 --seed skill-smoke --matrix --quiet
```

Single matchup:
```bash
npm.cmd run simulate -- --runs 1000 --seed tune-1 --player dragon --computer moray
```

Full matrix:
```bash
npm.cmd run simulate -- --runs 10000 --seed final-balance --matrix --json reports/final.json --csv reports/final.csv
```

Player model sensitivity:
```bash
npm.cmd run simulate -- --runs 1000 --seed precision-check --matrix --player-pathPrecision 0.65 --player-aimPrecision 0.7 --player-skillStrategy balanced --player-foodStrategy denyOpponent
```

## Interpretation

- `winRate`: Player-side win rate for the ordered matchup.
- `warning`: True when the matchup is outside the configured balance range.
- `damagePerCast`: Skill damage efficiency.
- `resourceEfficiency`: Damage per approximate resource spent.
- `controlValue`: Stun frequency per cast.
- `burstRisk`: Big-cast ratio; high values indicate resource hoarding or burst-window dependence.

## Output

When reporting results, include the command, seed, runs, changed values, before/after numbers, warnings, and any matchups that still need design judgment.
