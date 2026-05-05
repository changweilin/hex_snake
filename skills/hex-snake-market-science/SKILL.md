---
name: hex-snake-market-science
description: Use for Hex Snake market and product science work: analyze audience segments, competitor positioning, retention loops, onboarding friction, monetization hypotheses, difficulty curves, feature priority, and measurable experiments before handing implementation work to design, UI, data, or balance specialists.
---

# Hex Snake Market Science

Use this skill for product strategy, market analysis, player segmentation, feature prioritization, and scientific experiment design. This skill produces recommendations and hypotheses; it does not directly change runtime code.

## Inputs

- Current game shape: single-page hex-grid snake battle in `index.html`.
- Data model: characters in `data/characters.json`, rules in `data/balance.json`.
- Evidence sources: user feedback, playtest notes, analytics, competitor observations, simulation reports, or explicit product goals.

If current external market facts are required, browse or cite sources before making claims.

## Analysis Workflow

1. Define the target player and job-to-be-done: quick arcade challenge, character-collection fantasy, tactical duel, streamer spectacle, or competitive tuning sandbox.
2. Identify the funnel stage: first impression, onboarding, first win/loss, replay motivation, mastery, sharing, or monetization.
3. Convert vague goals into measurable hypotheses. Prefer metrics such as first-start rate, first-match completion, rematch rate, average session length, character switch rate, computer-battle usage, and rules-modal opens.
4. Compare against relevant games only where the comparison changes a decision. Name assumptions when evidence is thin.
5. Prioritize by expected impact, confidence, implementation effort, and risk to the current game identity.
6. Hand off implementation work:
   - UI flow or controls: `$hex-snake-ui-events`.
   - Character content or config: `$hex-snake-data-steward`.
   - Matchup or numeric tuning: `$hex-snake-balance`.
   - Copy or multilingual rollout: `$hex-snake-i18n-localization`.

## Recommendation Format

Use this concise structure:

- Player segment or market problem.
- Hypothesis.
- Proposed change.
- Success metric and guardrail metric.
- Suggested owner skill.
- Fastest validation path.

## Guardrails

- Do not invent analytics that do not exist.
- Separate observed evidence from inference.
- Avoid feature ideas that require large rewrites unless the expected payoff is explicit.
- Keep recommendations actionable for this repo's current architecture.
