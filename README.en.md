# Hex Snake

## 1) Title & Description

`Hex Snake` is a web game project built on HTML/CSS/JavaScript, centered on snake battles played on a **hexagonal grid** map.

The game supports:

- Character selection and portrait-based asset loading
- Player vs AI gameplay (P1 vs P2)
- Advanced controls (direction/key remapping, special key bindings, left-hand mode)
- Food/resource systems, attack charge and cooldown logic, health tracking, and match statistics
- Replay archive system and local persistence via `localStorage`
- AI strategy data and simulation/tuning workflows under `tools/`

The entry point is `index.html`. Runtime initialization is in `src/main.js`, which dynamically loads modular scripts from `src/` (`state`, `dom`, `ui`, `characters`, `audio`, `replay`, `ai`, `render`, `game`).

## 2) Features

### Gameplay

- Snake movement and food collection on a hex grid
- P1/P2 HUD (health bars, speed multipliers, score, best time stats)
- Small attack / big attack controls with cooldown indicators
- Character skills, victory/defeat lines, and portrait transition flow

### Character & Balance System

- `data/characters.json` defines playable characters (names, art assets, move names, lore, result lines)
- `data/balance.json` defines limits and default values for grid, food, speed, health, attacks, and resource mechanics
- Default gameplay configuration is loaded during game start

### AI & Simulation

- `tools/` includes scripts for simulation, strategy optimization, tuning, and validation workflows
- Supports quick checks via `npm run test:quick` and `npm run test:smoke`
- Supports full simulation tasks via `npm run simulate`, `npm run optimize:strategy`, `npm run simulate:ai-cross`

### Build & Deployment

- `npm run build` copies runtime files into `dist/`
- Build pipeline:
  - Includes only required runtime assets
  - Generates `dist/build-asset-manifest.json`
  - Supports `HEX_SNAKE_DIST_BUDGET_MB` to control distribution size limits
- `.github/workflows/deploy.yml` provides GitHub Pages CI/CD

## 3) Prerequisites & Installation

### Requirements

- Node.js 18+ (recommended: 20)
- npm
- PowerShell (Windows) or Bash (Linux/macOS)

### Install

```powershell
cd C:\Users\user\Documents\app\hex_snake
npm install
```

```bash
cd /path/to/hex_snake
npm install
```

If you are using lockfile-based CI consistency, you can use `npm ci`.

## 4) Quick Start / Usage

### Start Development Server

```bash
npm run dev
```

- Default URL: `http://localhost:6287`
- Default host: `0.0.0.0`
- Custom port:

```bash
PORT=3000 npm run dev
```

```powershell
$env:PORT=3000
npm run dev
```

### Build and Serve Production Artifact

```bash
npm run build
npm start
```

`npm start` serves from `dist/` using `--dist`.

### Android App Builds and Signing

```bash
npm run android:build:debug
npm run android:bundle:release
```

- debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

Before uploading to Google Play, provide an Android upload keystore. Copy `android/signing.properties.example` to `android/signing.properties`, or set these CI environment variables:

```text
HEX_SNAKE_ANDROID_KEYSTORE_FILE
HEX_SNAKE_ANDROID_KEYSTORE_PASSWORD
HEX_SNAKE_ANDROID_KEY_ALIAS
HEX_SNAKE_ANDROID_KEY_PASSWORD
```

`android/signing.properties` and keystore files are ignored by git. To require signing credentials for a Play-ready build, run:

```bash
npm run android:bundle:signed
```

### Useful Scripts

```bash
npm run test
npm run test:quick
npm run test:smoke
npm run simulate
npm run simulate:run
npm run simulate:jobs
npm run simulate:scheduled
npm run tune:balance
npm run tune:ai-strategy
npm run optimize:strategy
npm run reports:dashboard
npm run reports:dashboard:serve
```

### Basic Playthrough

1. Run `npm run dev`
2. Open `http://localhost:6287`
3. Click `Start`
4. Open settings to customize:
   - Difficulty
   - Characters
   - Key bindings
   - Control settings

## 5) Project Structure

```text
.
├─ index.html              # Game page and DOM structure
├─ server.js               # Static server (supports --dist, PORT, HOST)
├─ build.js                # Build script (outputs dist/, manifest, size checks)
├─ package.json            # Scripts and dependencies
├─ package-lock.json
├─ dist/                   # Build output artifact
├─ src/                    # Game runtime source
│  ├─ main.js              # Boot loader and progress UI
│  ├─ game.js              # Core gameplay and turn/round logic
│  ├─ state.js             # Game state model
│  ├─ render.js            # Rendering and animation
│  ├─ ui.js                # UI controls and HUD
│  ├─ dom.js               # DOM events and selectors
│  ├─ characters.js        # Character loading and selection
│  ├─ audio.js             # Audio loading and playback
│  ├─ ai.js                # AI behavior
│  ├─ replay.js            # Replay record/load flow
├─ data/                   # JSON game configuration
│  ├─ characters.json
│  ├─ balance.json
│  ├─ high-ai-strategies.json
│  └─ extreme-ai-strategies.json
├─ assets/                 # Visual and audio assets
│  ├─ logos/
│  ├─ portraits/
│  ├─ audio/
│  └─ screenshots/
├─ tools/                  # Simulation/tuning scripts
│  ├─ sim-core.js
│  ├─ simulate-balance.js
│  ├─ run-tests.js
│  ├─ run-strategy-optimization.js
│  ├─ tune-*.js
│  └─ ...
├─ doc/                    # Documentation and SOPs
│  ├─ follow-up-execution-list.md
│  ├─ legacy-global-dependencies.md
│  ├─ strategy-optimization-sop.md
│  └─ ...
├─ reports/                # Simulation and tuning outputs
├─ .github/
│  └─ workflows/
│     └─ deploy.yml       # GitHub Pages deployment workflow
└─ README.en.md
```

## 6) License

This project is licensed under the **Apache License 2.0**.

- You may use, modify, and distribute the software, including commercially
- You must keep existing copyright and license notices
- Changes should be documented and source files should remain clearly attributed
- If you modify and distribute derivative works, they must retain Apache 2.0 terms

Please include the full Apache 2.0 text in a `LICENSE` file at the repository root for complete compliance.

Official license text: https://www.apache.org/licenses/LICENSE-2.0
