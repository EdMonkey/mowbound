# Mowbound Agent Guide

## Project

- Name: Mowbound
- Repository: https://github.com/EdMonkey/mowbound
- Production: https://mowbound.vercel.app
- Stack: Vite + TypeScript + plain Three.js
- User language: Korean. Keep replies terse and practical.

## Game Snapshot

- Incremental browser game about mowing grass.
- Main scenes: main menu, game, skill tree.
- View: isometric orthographic camera following the player.
- Controls: WASD or arrow keys on desktop, virtual joystick on mobile.
- Round length: 10 seconds.
- Map: 10m x 10m.
- Player movement speed: 0.7.
- Attack cadence: one charged strike per second.
- Attack shape: forward fan, 0.5m range, 140 degrees.
- Damage: 3.
- Grass HP: 5.
- Grass density: 1600 initial grass objects on a 40x40 grid (±10cm jitter, 10cm edge margin), no mid-round grass spawning.
- Grass model: three rectangular blade meshes per grass object.
- Hit feedback: only actually hit surviving grass shakes.
- Death feedback: destroyed grass disappears, drops a bouncing coin, grants gold.
- Damage text: white text floats upward, grows, then fades.

## Commands

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev -- --port 5173
```

Verify:

```bash
npm test
npm run build
npm run smoke
```

Deploy production:

```bash
npx vercel --prod --yes
npx vercel inspect https://mowbound.vercel.app
```

## Workflow Rules

- Prefer existing Vite, TypeScript, and Three.js structure.
- Keep gameplay systems deterministic and covered by Vitest when practical.
- Use focused changes; avoid unrelated refactors.
- Do not remove mobile joystick support.
- Do not change desktop movement away from WASD/arrow keys unless requested.
- Do not call `setHp()` on untouched grass; it triggers shake feedback.
- After gameplay or UI changes, verify with tests, build, smoke, and a browser check.
- For production-facing changes, commit, push, deploy to Vercel, then verify the live site.
- Leave unrelated untracked files alone unless the user asks.
