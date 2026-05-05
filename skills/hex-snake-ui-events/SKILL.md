---
name: hex-snake-ui-events
description: Use for Hex Snake UI logic and event-flow work in index.html: inspect or change input handling, overlay state, modal behavior, keyboard shortcuts, joystick/touch controls, portrait lightbox, computer battle controls, localStorage settings, and game start/pause/surrender transitions without changing balance data.
---

# Hex Snake UI Events

Use this skill when changing the browser game interface, input behavior, UI state transitions, accessibility attributes, or event handlers in `index.html`.

## Boundaries

- Own `index.html` UI state, DOM updates, event listeners, canvas interaction, and local UI persistence.
- Do not tune combat balance, food rules, damage, speed, or simulation values. Use `$hex-snake-balance` for that.
- Do not edit character or balance JSON unless the UI change requires a data contract update. Use `$hex-snake-data-steward` for that handoff.

## Inspection Workflow

1. Locate the relevant DOM nodes near the query block around `document.querySelector`.
2. Trace the state variables that drive the flow, especially `running`, `paused`, `computerBattleMode`, `relayMode`, `gameOver`, `selectedAttackProfile`, `playerCharacterId`, and `computerCharacterId`.
3. Follow all event listeners for the affected surface:
   ```bash
   rg -n "addEventListener|localStorage|overlayTitle|overlayText|rulesModal|portraitLightbox|joyZone|keydown" index.html
   ```
4. Check helper functions before editing: render/build functions, state setters, launch functions, and reset/start/end-game functions.

## UI Surfaces

- Overlay and game lifecycle: `startButton`, `computerBattleButton`, `overlayTitle`, `overlayText`, `endGame`, `loop`.
- Settings and GM panels: `settingsToggle`, `gmToggle`, numeric inputs, preset buttons, reset buttons.
- Input controls: keyboard bindings, joystick direction buttons, pointer drag controls, target selection, attack buttons.
- Character UI: intro portraits, portrait selection, winner portraits, lightbox, swipe/arrow navigation.
- Auto battle: speed select, relay mode, pause button, persisted auto speed.

## Validation

After UI changes, verify the affected flows plus adjacent controls:

- Keyboard movement and attack shortcuts.
- Touch/pointer joystick movement and attack targeting.
- Start, pause, resume, surrender, and restart.
- Rules modal and portrait lightbox open/close behavior.
- Computer battle, speed changes, relay mode, and auto pause.
- Settings and GM panel expand/collapse plus localStorage-backed preferences.

Run:
```bash
npm.cmd test
```

For visual or interaction changes, start the app with `npm.cmd run dev` and inspect in a browser.

## Output

Report the UI surface changed, state variables touched, event handlers touched, validation performed, and any behavior intentionally left unchanged.
