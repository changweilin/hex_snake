---
name: hex-snake-director
description: Coordinate Hex Snake work across project-local specialist skills and sub-agents. Use for broad requests, task routing, ownership boundaries, sequencing UI, render, gameplay, data, balance, audio, replay, localization, and final validation after the src/ module split.
---

# Hex Snake Director

Use this skill to decompose requests, choose owners, and integrate results. Keep direct edits small; delegate bounded work by file ownership when parallel work helps.

## Specialist Map

- `$hex-snake-ui-events`: UI state, DOM bindings, controls, overlays, settings, localStorage.
- `$hex-snake-render-visuals`: Canvas drawing, board visuals, character effects, responsive visual layout.
- `$hex-snake-runtime-gameplay`: Runtime rules, match lifecycle, AI behavior, replay interactions, simulator parity.
- `$hex-snake-data-steward`: Character records, balance config shape, ids, portrait paths, JSON integrity.
- `$hex-snake-balance`: Numeric tuning, matchup simulations, combat metrics.
- `$hex-snake-i18n-localization`: UI copy, Traditional Chinese text, terminology, UTF-8 safety.
- `$hex-snake-market-science`: Product hypotheses, audience, prioritization, experiments.

## Sub-Agent Assignment

- UI worker: own `src/ui.js`, `src/dom.js`, `index.html`, and visual-only `src/styles.css` changes tied to UI controls.
- Render worker: own `src/render.js`, canvas effects, board drawing, character visuals, and narrow CSS needed for visual layout.
- Gameplay worker: own `src/game.js`, `src/ai.js`, runtime rules, match flow, and `tools/sim-core.js` parity when rules change.
- Data/Balance worker: own `data/*.json`, `tools/sim-*`, `tools/sim-core.js`, reports, and balance evidence.
- Audio/Replay worker: own `src/audio.js` and `src/replay.js` only when the request directly touches those systems.

Tell workers they are not alone in the codebase. Give each worker a disjoint write scope and ask them not to revert unrelated edits.

## Routing Workflow

1. Classify the primary risk: product, UI, render, gameplay, data, balance, localization, audio, or replay.
2. Assign one owner for the main change and sidecar owners only for independent work.
3. Define acceptance criteria before work begins: files, commands, metrics, and non-goals.
4. Integrate by checking runtime/data/simulator drift and adjacent UI flows.

## Examples

- New character with balance impact -> Data Steward -> Balance -> UI smoke -> Director validation.
- New ultimate visual -> Render worker owns `src/render.js`; Gameplay worker joins only if hit logic changes.
- Stun rule change -> Gameplay worker updates runtime and simulator parity; Balance validates matchup impact.

## Validation

Prefer:
```bash
npm.cmd test
```

Use targeted simulation commands when balance or simulator parity changes. Use browser inspection when UI or render behavior changes.

## Output

Report selected owners, file boundaries, validation commands, remaining risks, and any intentional non-goals.
