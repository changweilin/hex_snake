---
name: hex-snake-render-visuals
description: Maintain Hex Snake rendering and visual presentation. Use for src/render.js, canvas drawing, board visuals, character and ultimate effects, effect comparison mode, responsive visual layout, render-only CSS, and asset path checks needed for visual output.
---

# Hex Snake Render Visuals

Use this skill for visual output only. Keep gameplay rules, AI behavior, data schema, and balance tuning out of scope unless the Director assigns a handoff.

## Ownership

- Own `src/render.js`: canvas drawing, board layout, foods, snakes, projectiles, hazards, blasts, previews, status effects, effect comparison mode.
- Touch `src/styles.css` only for visual layout that supports rendering or canvas-adjacent presentation.
- Check asset paths when render code depends on portraits or visual assets.

Do not change hit logic, damage, stun, movement, AI decisions, or JSON schemas.

## Inspection Workflow

1. Locate the draw surface and related helpers:
   ```bash
   rg -n "function draw|drawBlasts|drawProjectiles|drawSnake|effectComparison|visualType|axialToPixel" src/render.js
   ```
2. Identify whether the change is board layout, token rendering, character effect, preview, or status feedback.
3. Preserve normal board rendering and effect comparison mode unless the request targets one of them.
4. If visuals depend on character ids or portrait paths, coordinate with `$hex-snake-data-steward`.

## Examples

- Improve ultimate effect readability: edit `src/render.js`, verify normal board and effect comparison mode.
- Adjust food token visuals: update render helpers only; do not change food collection rules.
- Fix mobile canvas framing: inspect `src/render.js` sizing and narrow `src/styles.css` layout rules.

## Validation

Run:
```bash
npm.cmd test
```

For visual changes, start the app and inspect the affected board state, responsive viewport, and effect comparison mode when relevant.

## Output

Report visual surfaces changed, render helpers touched, viewport or asset assumptions, validation performed, and any gameplay behavior intentionally unchanged.
