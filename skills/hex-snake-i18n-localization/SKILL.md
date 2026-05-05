---
name: hex-snake-i18n-localization
description: Use for Hex Snake localization and multilingual text work: inventory UI copy, extract hard-coded strings, translate Traditional Chinese game text, protect UTF-8 character data, maintain terminology, and check missing or inconsistent language keys in index.html, data/characters.json, and related game copy.
---

# Hex Snake I18n Localization

Use this skill when adding a language, translating UI or character text, extracting copy from `index.html`, reviewing terminology, or fixing garbled text without changing gameplay behavior.

## Sources

- `index.html`: Main UI, event messages, modal copy, HUD labels, and hard-coded strings.
- `data/characters.json`: Character names, appearance text, story, motto, move names, food effects, portrait paths.
- `data/balance.json`: Numeric rule text should reference values from this file when possible.
- `tools/add-character.js`: Character generation helper; inspect before changing generated copy patterns.

## Workflow

1. Inventory text before editing:
   ```bash
   rg -n "textContent|innerHTML|aria-label|title=|>[^<]*[\\p{Han}]" index.html
   rg -n "\"(name|appearance|foodEffect|story|motto|smallMove|bigMove)\"" data/characters.json
   ```
2. Treat terminal-rendered mojibake as unsafe. Read and write JSON as UTF-8, and never copy garbled terminal output back into `data/characters.json`.
3. Separate player-facing copy from identifiers. Do not translate stable ids, slugs, file paths, storage keys, CSS classes, or `data-*` attributes.
4. Use stable dotted keys for new locale maps, for example `overlay.ready.title`, `settings.gridSize.label`, `character.dragon.name`.
5. Preserve interpolation values and runtime numbers. If text mentions attack costs, ammo caps, grid limits, or food energy, verify the source value in `data/balance.json`.
6. After edits, check for missing keys, duplicate terms, and broken JSON. Run:
   ```bash
   npm.cmd test
   ```

## Terminology Rules

- Keep character ids unchanged: `dragon`, `sandworm`, `quetzal`, `moray`, `lobster`, `gu_king`.
- Keep food ids unchanged: `protein`, `fat`, `fiber`, `carb`, `black`, `balanced`.
- Translate display names, labels, story text, instructions, modal text, and move names.
- Maintain a glossary in the task notes when translating repeated terms such as player, computer, bomb, energy, small attack, big attack, rules, and GM settings.

## Output

When reporting localization work, include:

- Languages or text surfaces touched.
- Any strings intentionally left untranslated.
- Encoding risks found.
- Validation commands and results.
