---
name: hex-snake-director
description: Use for Hex Snake cross-functional coordination: decompose broad requests, choose the right specialist skill or sub-agent, sequence market, UI, data, balance, and localization work, define acceptance criteria, and integrate final validation across this project.
---

# Hex Snake Director

Use this skill when a request spans multiple domains or needs task routing before implementation. Act as the coordinator for specialist skills and keep the final plan or execution coherent.

## Specialist Map

- `$hex-snake-market-science`: Market, audience, product hypotheses, prioritization, measurable experiments.
- `$hex-snake-ui-events`: `index.html` UI state, event listeners, keyboard/touch controls, modals, game lifecycle.
- `$hex-snake-data-steward`: `data/characters.json`, `data/balance.json`, portrait paths, ids, schema consistency.
- `$hex-snake-balance`: Combat tuning, seeded simulations, matchup matrices, resource and skill efficiency.
- `$hex-snake-i18n-localization`: Text inventory, translation, terminology, language keys, UTF-8 protection.

## Routing Workflow

1. Classify the request by primary risk:
   - User behavior or market fit: market first.
   - Controls, screens, or state flow: UI first.
   - Character or config records: data first.
   - Win rates, damage, speed, costs, or food values: balance first.
   - Copy, language, or text extraction: localization first.
2. Identify dependencies. Common order:
   - Market hypothesis -> UI event change -> data update -> balance validation -> localization pass.
   - New character -> data steward -> balance simulation -> UI check -> localization pass.
   - Numeric tuning -> balance baseline -> data edit -> balance comparison -> UI copy update if rules changed.
3. Define acceptance criteria before delegating. Include files, commands, metrics, and non-goals.
4. Integrate outputs by checking that each specialist preserved adjacent contracts.

## Project Facts

- Main runtime is `index.html`.
- Rule parameters live in `data/balance.json`.
- Character content lives in `data/characters.json`.
- Simulation core is `tools/sim-core.js`.
- Simulation CLI is `tools/simulate-balance.js`.
- Prefer `npm.cmd test` on Windows to avoid PowerShell `npm.ps1` execution policy issues.

## Output

For coordination tasks, report:

- Selected specialist order.
- Task boundaries for each specialist.
- Files or data surfaces each specialist may touch.
- Acceptance criteria and validation commands.
- Integration risks, especially runtime/data/simulation drift.
