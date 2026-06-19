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
- Round length: 10 seconds on the 10x10 map, 30 seconds on the 30x30 map (ROUND_DURATION_BY_MAP; skill bonuses add on top).
- Map: selectable on the main menu — 10m x 10m (default) or 30m x 30m.
- Player movement speed: 0.7.
- Attack cadence: one charged strike per second.
- Attack shape: forward fan, 0.5m range, 140 degrees.
- Damage: 3.
- Grass HP: 5.
- Grass density: 16/m^2 — 1600 grass objects on a 40x40 grid for the 10x10 map, scaled by map area for larger maps (e.g. 14400 on 30x30). Uniform grid with ±10cm jitter and a 10cm edge margin, chunked InstancedMesh with per-chunk frustum culling, no mid-round grass spawning.
- Grass model: three rectangular blade meshes per grass object.
- Hit feedback: only actually hit surviving grass shakes.
- Death feedback: destroyed grass disappears, drops a bouncing coin, grants gold.
- Damage text: white text floats upward, grows, then fades.
- Bombs: touching a bomb sets off a 5m circular blast that mows all grass in range and emits explosion particles + shockwave rings; other bombs within the 2.5m chain radius detonate too (staggered, transitive). Logic is in `BombSystem` (pure); `Bomb`/`Explosions` are the visuals. Scattered as test bombs at run start per map (TEST_BOMB_COUNTS: none on 10x10, 30 on 30x30); not yet wired to a skill-tree node.
- Rocks & trees: destructible props with all-or-nothing damage — a swing only breaks one when its damage is strictly greater than the obstacle HP (test HP 5; base damage 3 won't break them, so damage upgrades are needed). A swing that fails to break it stuns the player for 1.5s (`obstacleStunSeconds`, a recoil); a successful break does not stun. Intact obstacles block movement (per-kind collision circle, `resolveCollision`); once broken they're passable. A broken rock leaves rubble (rock_broken model), a cut tree leaves a stump (tree_stump model), with grey/brown chip particles (`Debris`). Logic in `ObstacleSystem` (pure, reuses the attack fan); `Obstacle` is the visual. Scattered randomly per map (OBSTACLE_COUNTS_BY_MAP) on both maps; not yet wired to a skill-tree node.

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
