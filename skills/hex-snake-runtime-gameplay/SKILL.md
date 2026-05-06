---
name: hex-snake-runtime-gameplay
description: Maintain Hex Snake runtime gameplay behavior. Use for src/game.js, src/ai.js, src/replay.js, match lifecycle, input-to-action behavior, movement, attacks, collision, food collection, AI runtime decisions, replay interactions, and tools/sim-core.js parity when runtime rules change.
---

# Hex Snake Runtime Gameplay

Use this skill for behavior that changes how a match plays. Keep visual-only work and character text/data-only edits out of scope unless the Director assigns a handoff.

## Ownership

- Own `src/game.js`: match lifecycle, movement, attacks, collision, food, resources, win/loss flow.
- Own `src/ai.js`: runtime AI decisions and targeting behavior.
- Own `src/replay.js`: replay capture/playback behavior when gameplay state shape changes.
- Touch `tools/sim-core.js` only when runtime rule changes must match simulator behavior.

Do not change canvas effects, UI copy, character descriptions, or balance data without the matching specialist.

## Inspection Workflow

1. Locate runtime behavior:
   ```bash
   rg -n "function .*attack|collectFood|collision|stun|move|replay|computer|gameOver|endGame" src/game.js src/ai.js src/replay.js
   ```
2. Decide whether simulator parity is required. If yes, inspect equivalent logic in `tools/sim-core.js`.
3. Preserve UI contracts in `src/ui.js` and render contracts in `src/render.js`.
4. Add or update tests in `tools/run-tests.js` when behavior changes.

## Examples

- Change stun duration behavior: update runtime logic, mirror simulator behavior, add or update test coverage.
- Adjust AI target selection: edit `src/ai.js`, verify manual play still uses the same action contracts.
- Change replay state shape: update `src/replay.js` and any runtime producer/consumer in `src/game.js`.

## Validation

Run:
```bash
npm.cmd test
```

For balance-sensitive changes, run a targeted simulation or ask `$hex-snake-balance` to compare before/after metrics.

## Output

Report gameplay behavior changed, runtime/simulator parity decisions, tests or simulations run, and UI/render behavior intentionally unchanged.
