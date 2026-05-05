---
name: hex-snake-data-steward
description: Use for Hex Snake project data stewardship: validate and update data/characters.json, data/balance.json, character ids/slugs/portrait paths, food preferences, special food flags, colors, schema consistency, generated character dry-runs, and JSON integrity without directly changing UI event behavior.
---

# Hex Snake Data Steward

Use this skill when changing character records, balance configuration shape, portrait references, generated character data, or JSON integrity.

## Sources

- `data/characters.json`: Character database consumed by `index.html` and `tools/sim-core.js`.
- `data/balance.json`: Limits, defaults, resources, movement, attack, collision, food weights, simulation, and player model.
- `tools/add-character.js`: Character scaffolding helper.
- `assets/portraits/`: Character portrait assets in `full`, `md`, and `sm` variants.

## Character Data Rules

Each character should keep a stable:

- `id`: Internal id used by settings, simulation, and reports.
- `slug`: Asset-name base for portrait lookup.
- `name`, `appearance`, `foodEffect`, `story`, `motto`, `smallMove`, `bigMove`: Player-facing text.
- `representColor` and `colors.body/line/accent`: UI and canvas palette.
- `foodPreference`: One of `balanced`, `protein`, `fat`, `fiber`, `carb`, or a handled special case.
- `specialFood`: Only use when the runtime and simulation both support it, currently `black`.
- `portraits`: Preserve semantic poses `opening`, `intro`, `small`, `big`, `victory`, `defeat` with valid paths when assets exist.

Do not rename existing ids or slugs unless the task explicitly includes migration of saved settings, reports, asset paths, and simulations.

## Balance Data Rules

Keep these sections coherent with runtime and simulator expectations:

- `limits`: UI input min/max bounds.
- `defaults`: Initial settings and selected character ids.
- `resources`: Ammo, stock, and food energy rules.
- `movement`, `attack`, `collision`, `foodWeights`: Gameplay formulas.
- `simulation`: Monte Carlo defaults and warning thresholds.
- `playerModel`: Simulator behavior defaults.

When adding or renaming a balance key, update both `index.html` and `tools/sim-core.js` if they consume the value.

## Workflow

1. Parse the current JSON before changing it:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/characters.json','utf8')); JSON.parse(require('fs').readFileSync('data/balance.json','utf8')); console.log('json ok')"
   ```
2. For a new character, dry-run first:
   ```bash
   node tools/add-character.js --dry-run --name "Name" --concept "Concept" --food balanced --color "#8b5cf6"
   ```
3. Check ids, portrait paths, food preferences, and defaults against existing runtime usage.
4. Preserve UTF-8. Do not use mojibake copied from terminal output as source text.
5. Run validation:
   ```bash
   npm.cmd test
   ```

## Output

Report changed data surfaces, ids/slugs affected, any missing assets or unsupported values, and validation results.
