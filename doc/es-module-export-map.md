# ES Module Export Map

最後更新：2026-05-21（Asia/Taipei）

## 目的

這份文件固定正式 ESM split 前的 registry 初始化順序與 export surface。現階段 source mode 已可跑 `module-shadow` / `module`，但 production 仍維持 `bundled-legacy-fallback`；正式 module production 開始前，必須先讓這張表、`doc/es-module-loader-plan.md`、`doc/es-module-core-bootstrap-checklist.md`、`doc/es-module-production-strategy.md` 與 `npm.cmd run audit:esm-map` 同步通過。

## Shadow Entry

`src/main-module.js` 是目前唯一的 native module entry。local dev 可用 `?hexSnakeLoader=module-shadow` 觸發 shadow contract；也可用 `?hexSnakeLoader=module` 觸發 `loadModuleGame()`，由它呼叫 `gameShell.bootstrapGame()` 啟動 gameplay。`module-shadow` 仍只回報 contract，不呼叫 `bootstrapGame()`。

## Loader Order

| Order | Web source | Mobile source | Creates / extends | Downstream needs |
| --- | --- | --- | --- | --- |
| 1 | `src/platform/web.js` | `src/platform/mobile.js` | `HexSnakeStorage`、`HexSnakePlatform`、`HexSnakeRuntime` | 所有需要 storage、display、haptics、share、lifecycle 的模組 |
| 2 | `src/state.js` | `src/state.js` | `HexSnakeState`、`HexSnakeUI` 子 registry、`HexSnakeRender`、`HexSnakeRenderGame`、`HexSnakeControls` | DOM、UI、services、AI、render、game |
| 3 | `src/dom.js` | `src/dom.js` | `HexSnakeDOM` | UI、replay、stats、about、render、game |
| 4 | `src/ui.js` | `src/ui.js` | `HexSnakeUI` config、presentation、resource、character helper base | characters、replay、stats、AI、render、game |
| 5 | `src/network.js` | `src/network.js` | `HexSnakeNet` | game LAN helper lookup |
| 6 | `src/characters.js` | `src/characters.js` | `HexSnakeUI` character catalog / portrait helpers | audio、replay、stats、AI、render、game |
| 7 | `src/audio.js` | `src/audio.js` | `HexSnakeUI.audio` | UI、game |
| 8 | `src/replay.js` | `src/replay.js` | `HexSnakeUI.replay` | UI、game |
| 9 | `src/stats.js` | `src/stats.js` | `HexSnakeUI.stats` | game |
| 10 | `src/about.js` | `src/about.js` | `HexSnakeUI.about`、`HexSnakeAbout` | game settings/version modal |
| 11 | `src/ai.js` | `src/ai.js` | `HexSnakeUI.ai` | render、game |
| 12 | `src/render.js` | `src/render.js` | `HexSnakeRender` | UI、replay、game |
| 13 | `src/game.js` | `src/game.js` | `HexSnakeGame`、`Game*` dependency aliases、`HexSnakeRenderGame`、`HexSnakeUI.aiGame`、`HexSnakeUI.uiGame`、`HexSnakeUI.replayGame`、explicit `bootstrapGame()` | final bootstrap owner |

`src/main.js` always uses the web platform source for local browser loading. `build.js` swaps only the first source to `src/platform/mobile.js` when `--mobile` is used; the remaining order must stay identical.

## Export Surface

| Surface | Current owner | Shape | Formal ESM target |
| --- | --- | --- | --- |
| `HexSnakeRuntime` | `src/platform/web.js` / `src/platform/mobile.js` | frozen `{ platform, storage }` adapter | named `runtime` / `platform` / `storage` exports implemented |
| `HexSnakeState` | `src/state.js` | mutable state namespaces: `audio`、`config`、`game`、`replay`、`ui` | named `state` export implemented |
| `HexSnakeUI` | `src/state.js` creates; `src/ui.js` and services extend | shared registry with `about`、`ai`、`aiGame`、`audio`、`replay`、`replayGame`、`stats`、`uiGame` | named `uiRegistry` export implemented until UI/game split is complete |
| `HexSnakeUICore` | `src/ui.js` | frozen UI config/presentation shell over existing `HexSnakeUI` registrations | named `uiCore` export implemented |
| `HexSnakeGame` | `src/game.js` | frozen game shell with facade helpers plus `loadGameShell()` / `bootstrapGame()` | named `gameShell` export implemented; `module-shadow` imports shell but does not call bootstrap |
| `HexSnakeRender` | `src/state.js` creates; `src/render.js` extends | render public hooks | named `render` export implemented from `state.js`; named `renderHooks` export implemented from `render.js` |
| `HexSnakeRenderGame` | `src/state.js` creates; `src/game.js` extends | game geometry/combat helpers used by render | named `renderGame` export implemented; later move to pure helper module |
| `HexSnakeControls` | `src/state.js` | frozen keyboard/control helpers | named `controls` export implemented |
| `HexSnakeDOM` | `src/dom.js` | frozen DOM reference facade | named `dom` export implemented |
| `HexSnakeNet` | `src/network.js` | frozen LAN client/service facade | named `network` export implemented |
| `HexSnakeCharacters` | `src/characters.js` | frozen character catalog / portrait helper facade, mirrored into `HexSnakeUI` | named `characterCatalog` export implemented |
| `HexSnakeAudio` | `src/audio.js` | frozen character SFX service, mirrored into `HexSnakeUI.audio` | named `audio` export implemented |
| `HexSnakeReplay` | `src/replay.js` | frozen replay record/playback service, mirrored into `HexSnakeUI.replay` | named `replay` export implemented |
| `HexSnakeStats` | `src/stats.js` | frozen match stats service, mirrored into `HexSnakeUI.stats` | named `stats` export implemented |
| `HexSnakeAbout` | `src/about.js` | frozen version/about service, mirrored into `HexSnakeUI.about` | named `about` export implemented |
| `HexSnakeAI` | `src/ai.js` | frozen AI decision/combat helper service, mirrored into `HexSnakeUI.ai` | named `ai` export implemented |

## Initialization Contract

1. Platform must run before `state.js`, because `HexSnakeControls.loadKeybinds` and several module aliases use runtime storage.
2. `state.js` must run before `dom.js` and every service so shared registries exist before extension.
3. `dom.js` must run before `ui.js`; `ui.js` creates local `UiDom` and attaches the largest `HexSnakeUI` base surface.
4. Character catalog helpers must run before audio/replay/stats/AI/render/game rely on `HexSnakeUI.characterFor*` helpers.
5. Service facades must extend `HexSnakeUI.audio/replay/stats/about/ai` before `game.js` snapshots them into local aliases.
6. `render.js` must extend `HexSnakeRender` before `game.js` bootstraps; `src/main-module.js` owns module mode startup and calls `gameShell.bootstrapGame()` only from `loadModuleGame()`.

## Verification

Run this gate whenever loader order, registry names, or facade ownership changes:

```bash
npm.cmd run audit:esm-map
```

The audit checks:
- `src/main.js` browser loader order.
- `build.js` web/mobile first-source switch and shared legacy source order.
- `tools/module-loader-smoke-test.js` and `release:check` include module-shadow, source module, and production fallback gates.
- `build.js` and `check:assets` keep production manifest strategy at `bundled-legacy-fallback` until a formal module bundle / source map gate exists.
- Required `window.HexSnake*` compatibility registrations.
- Required registry extension points and exports such as `HexSnakeUI.audio`, `HexSnakeCharacters`, `HexSnakeAudio`, `HexSnakeReplay`, `HexSnakeStats`, `HexSnakeAI`, `HexSnakeUI.aiGame`, and `HexSnakeRender`.
- This file mentions every source and public surface in the current map.
- `doc/es-module-loader-plan.md` still documents the loader modes, fallback rules, source order, production strategy, and next Phase D step.
- `doc/es-module-core-bootstrap-checklist.md` still documents the `ui.js` / `game.js` blockers, explicit import surface, bootstrap ownership, preflight gates, and production fallback strategy.
- `doc/es-module-production-strategy.md` still documents the release checklist, switch conditions, and module-bundle-source-map-release-gate.
