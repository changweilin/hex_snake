---
name: hex-snake-ui-events
description: Maintain Hex Snake UI state and event flow after the src/ module split. Use for src/ui.js, src/dom.js, index.html, input handling, overlays, modals, keyboard and touch controls, portrait lightbox, settings, localStorage, and game start/pause/surrender UI transitions.
---

# Hex Snake UI Events

Use this skill for browser UI behavior, DOM wiring, and user input flow. Keep gameplay rules, simulator logic, and render effects out of scope unless the Director assigns a handoff.

## Ownership

- Own `src/ui.js`: UI state, event handlers, DOM updates, overlays, modals, settings, controls, localStorage.
- Own `src/dom.js`: DOM query surface and element references.
- Own `index.html`: UI structure and attributes.
- Touch `src/styles.css` only for UI control layout or state classes.

Do not tune combat values, alter simulator rules, or implement canvas visual effects. Use `$hex-snake-balance`, `$hex-snake-runtime-gameplay`, or `$hex-snake-render-visuals` for those.

## Inspection Workflow

1. Locate DOM nodes in `src/dom.js` or `index.html`.
2. Trace UI state in `src/ui.js`, especially `running`, `paused`, `computerBattleMode`, `relayMode`, `gameOver`, `selectedAttackProfile`, `playerCharacterId`, and `computerCharacterId`.
3. Follow event listeners and persisted settings:
   ```bash
   rg -n "addEventListener|localStorage|overlayTitle|overlayText|rulesModal|portraitLightbox|joyZone|keydown" src index.html
   ```
4. Check adjacent lifecycle helpers before editing: render/build functions, state setters, start/reset/end-game functions.

## Examples

- Change portrait lightbox controls: inspect `src/dom.js`, update `src/ui.js`, verify modal and keyboard flow.
- Add a settings toggle: add markup in `index.html`, wire it in `src/dom.js`, persist and render state in `src/ui.js`.
- Adjust surrender UI: update `src/ui.js`, then verify start, pause, surrender, and restart transitions.

## Validation

Run:
```bash
npm.cmd test
```

For interaction changes, inspect the app in a browser and verify keyboard, touch, modal, settings, and computer-battle flows related to the change.

## Output

Report UI surfaces changed, state variables touched, event handlers touched, validation performed, and behavior intentionally left unchanged.
