# ES Module Production Strategy

最後更新：2026-05-21（Asia/Taipei）

## Decision

Production build 保持 `bundled-legacy-fallback`。正式 web / mobile / PWA artifact 的預設 entrypoint 仍是 `assets/app.bundle.js`，loader default 仍是 `legacy`。`src/main-module.js`、`?hexSnakeLoader=module-shadow` 與 `?hexSnakeLoader=module` 目前只作為 source-mode 驗證入口，不作為 production default。

這個決策已寫入 `dist/build-asset-manifest.json` 的 `moduleLoader` 區塊，並由 `npm.cmd run check:assets` 驗證：

- `strategy`: `bundled-legacy-fallback`
- `defaultMode`: `legacy`
- `productionEntrypoint`: `assets/app.bundle.js`
- `sourceModuleEntry`: `src/main-module.js`
- `activationGate`: `module-bundle-source-map-release-gate`

## Rationale

1. 現有 production build 是單一 legacy bundle，已被 PWA precache、offline smoke、mobile smoke、App readiness 與 release checklist 覆蓋。
2. Source `module` mode 已能啟動 gameplay，但尚未有 production module bundle、chunk graph、module sourcemap、mobile target module build 與 production cache 失敗路徑。
3. Dist `?hexSnakeLoader=module-shadow` / `?hexSnakeLoader=module` 現階段必須 fallback 到 bundled legacy，避免 release artifact 出現未受控的雙入口。
4. 切換 production default 屬於 release 行為，必須先新增可重複驗證的 module bundle gate，而不是只因 source-mode smoke 通過就切換。

## Release Checklist

Production fallback 策略變動前，這些 gate 必須持續通過：

```bash
npm.cmd run build
npm.cmd run check:assets
npm.cmd run audit:esm-map
npm.cmd run test:module-loader
npm.cmd run test:smoke
npm.cmd run test:mobile
npm.cmd run test:offline
npm.cmd run app:check
```

`npm.cmd run release:check` 已包含上述 release 相關 gate。若 `check:assets` 偵測 production manifest 不再宣告 `bundled-legacy-fallback`，或 `test:module-loader` 偵測 dist module flags 不再 fallback，這次切換就必須被視為正式 production module migration，而不是一般 refactor。

## Switch Conditions

只有同時滿足下列條件，才允許把 production default 從 bundled legacy 改成 module：

1. Build 產生明確的 module artifact，例如 `assets/app.module.js` 與對應 sourcemap，且不覆蓋現有 `assets/app.bundle.js` fallback。
2. Module artifact 同時支援 web 與 mobile platform target，並有 source map gate 可定位 module chunk 與原始 source。
3. Service worker precache、offline shell、App shell 與 Android bundle 都能驗證 module artifact。
4. Browser smoke、mobile smoke、offline smoke、module loader smoke、quick gameplay 與 release check 全數覆蓋 module production mode。
5. Boot failure UI 不得靜默 fallback；若 module artifact 啟動失敗，測試必須能明確失敗。
6. `doc/es-module-loader-plan.md`、`doc/es-module-split-map.md`、`doc/es-module-export-map.md`、`doc/es-module-core-bootstrap-checklist.md` 與本文件同步改成 production module migration 狀態。

## Future Build Plan

正式 module bundle 應分三步做，不直接改 default：

1. 新增 opt-in module artifact 與 sourcemap，保持 `assets/app.bundle.js` 為 production default。
2. 新增 production module smoke gate，明確測 `?hexSnakeLoader=module` 在 dist 中載入 module artifact，而 legacy fallback 仍可用。
3. 等 module artifact 通過 release checklist 後，再另起一批變更切換 default entrypoint。

## Next AI Task

下一個 AI 可直接處理項目是延續 Phase D service module migration：`game.js` control-profile、saved character choice、keybind、attack button highlight、settings / perf overlay、settings clamp / GM parameters、GM presets / settings action、board geometry helper、reset game setup、result share helper、start logo countdown、skip logo transition、start game entry、auto start game、return to start screen、open game over character select 與 random food generation helper slices 已改走 `GameRuntimeState` / `GameConfig` / `GamePresentationState` / `GameUI` 並由 `audit:esm-map` 固定；下一輪可接續 update stock HUD helper slice；`state.js` controls storage、`ui.js` controls helper / registry self-reads、`stats.js` / `audio.js` / `replay.js` / `ai.js` / `render.js` root state、`about.js`、`network.js`、`characters.js` 與 `game.js` 已完成 alias slices，LAN service 已註冊到 `HexSnakeUI.network`，production default 繼續維持 `bundled-legacy-fallback`。
