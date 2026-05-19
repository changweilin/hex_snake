# Local Multiplayer Progress Plan

Created: 2026-05-20

## Scope

Build local LAN/Wi-Fi multiplayer first. Bluetooth is intentionally out of scope.

The first playable target is a host-authoritative WebSocket match:

- One device opens a room as Host and runs the real game simulation.
- A second device joins as Guest from the same LAN/Wi-Fi.
- Guest sends P2 input events to Host.
- Host broadcasts state snapshots back to Guest.
- Existing AI/offline play remains the fallback when no room is active.

## Architecture

Use a transport/game-protocol split:

- `server.js`: WebSocket room relay for LAN/Wi-Fi.
- `src/network.js`: browser/App transport client and room UI glue.
- `src/game.js`: host-authoritative game hooks and remote P2 input handling.
- `src/replay.js`: snapshot serialization and restore path reused for remote display.

The transport message shape stays generic so WebRTC can reuse the same game messages later.

## Phase 1 - LAN/Wi-Fi WebSocket MVP

Status: first pass implemented.

Tasks:

- Add WebSocket upgrade support to the existing local Node server.
- Add create/join/leave room flow in the UI.
- Move the LAN/Wi-Fi flow into the toolbar connection page so the side layout stays compact.
- Add Host and Guest roles.
- Add Guest input forwarding for direction and attacks.
- Add Host snapshot broadcasts.
- Keep offline, AI battle, replay, and PWA/App shell behavior intact.

Acceptance:

- Done: `npm run dev` still serves the game.
- Done: a Host can create a room and see a short room code.
- Done: a Guest can join with that code from the same server URL.
- Done: Host can start a match and Guest can see live snapshots.
- Done: Guest direction input is relayed to Host as P2 input.
- Done: LAN/Wi-Fi setup opens from the toolbar connection button.

Verification:

- `npm run test:quick`
- `npm run build`
- Playwright two-tab LAN room smoke test.
- Playwright host-start/guest-snapshot smoke test.

## Phase 2 - Protocol Hardening

Status: pending.

Tasks:

- Add sequence numbers and latency telemetry.
- Add reconnect handling.
- Add snapshot throttling controls.
- Add clear room lifecycle states for ready/start/end.
- Add tests for server room routing.

## Phase 3 - WebRTC DataChannel

Status: pending.

Tasks:

- Reuse the Phase 1 game protocol over WebRTC.
- Use WebSocket or QR/manual exchange for signaling.
- Prefer unreliable/low-latency data channels for input.
- Keep WebSocket LAN as fallback.

## Explicitly Excluded

- Bluetooth and BLE gameplay transport.
- Native Android Nearby Connections.
- Native iOS Multipeer Connectivity.

Those can be reconsidered only after LAN/Wi-Fi and WebRTC are stable.
