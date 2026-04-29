---
name: hex-snake-balance
description: Use for Hex Snake battle balance work: run seeded Monte Carlo simulations, compare character matchup matrices, evaluate skill efficiency, and adjust data/balance.json or character parameters using before/after evidence.
---

# Hex Snake Balance

Use this skill whenever changing battle balance, character matchup tuning, food/resource parameters, skill costs, damage, stun, movement speed, or simulation strategy.

## Workflow

1. Read the current sources of truth:
   - `data/balance.json` for rule parameters and simulation defaults.
   - `data/characters.json` for character ids, food preferences, and special food flags.
   - `tools/sim-core.js` for simulation behavior if the metric needs interpretation.
2. Capture a baseline before changing balance:
   ```bash
   npm run simulate -- --runs 1000 --seed balance-baseline --matrix --json reports/baseline.json --csv reports/baseline.csv
   ```
   Use fewer runs for quick iteration and 10000+ runs for final recommendations.
3. Make the smallest balance change that addresses the observed issue.
4. Re-run the same command with the same seed and runs, writing a separate report.
5. Compare:
   - Win rate by matchup; target range is 45%-55% unless a specific design goal says otherwise.
   - Character average matrix win rate; flag deviations greater than 5 percentage points from 50%.
   - Average HP diff, score diff, match duration, small/big cast rate, damage per cast, stun per cast, resource efficiency, and burst risk.
6. Only recommend or keep changes that improve the target metric without creating a larger regression in adjacent matchups.

## Commands

Smoke test:
```bash
npm test
```

Single matchup:
```bash
npm run simulate -- --runs 1000 --seed tune-1 --player dragon --computer moray
```

Full matrix:
```bash
npm run simulate -- --runs 10000 --seed final-balance --matrix --json reports/final.json --csv reports/final.csv
```

Player model sensitivity:
```bash
npm run simulate -- --runs 1000 --seed precision-check --matrix --player-pathPrecision 0.65 --player-aimPrecision 0.7 --player-skillStrategy balanced --player-foodStrategy denyOpponent
```

## Interpretation

- `winRate`: Player-side win rate for the ordered matchup.
- `warning`: True when the matchup is outside the configured balance range.
- `damagePerCast`: Skill damage efficiency.
- `resourceEfficiency`: Damage per approximate resource spent.
- `controlValue`: Stun frequency per cast.
- `burstRisk`: Big-cast ratio; high values indicate dependence on resource hoarding or burst windows.

When reporting results, include the command, seed, runs, and the main before/after numbers.
