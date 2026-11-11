# Broadside

A 3D age-of-sail duel for the browser. Hunt five pirate captains in a brig-of-war.

- Guns fire only from the sides, inside a limited arc; shots along the length of a hull rake for extra damage
- Wind sets your speed, and you cannot sail straight into it
- Four kinds of shot: round (hull), chain (sails), grape (crew), heated (fire)
- Come alongside and grapple to board; a captured ship pays more than a sunk one
- Spend bounty gold in port on repairs, crew, shot and upgrades

## Build

```bash
npm install
```

```bash
npm run build
```

This writes a single self-contained page to `dist/index.html`. Open it in a browser.

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` | Rudder |
| `W` / `S` | Make / shorten sail |
| `Q` / `E` | Fire port / starboard battery |
| `Space` | Fire whichever side bears |
| `1`–`4` | Round, chain, grape, heated shot |
| `B` (hold) | Grapple when alongside |
| `V` | Chase / enemy-lock camera |
| `P`, `M` | Pause, mute |

Touch devices get on-screen buttons.

## Layout

| File | Contents |
| --- | --- |
| `src/main.js` | Game loop, gunnery, boarding, camera, HUD and screens |
| `src/ship.js` | Procedural ship model, sailing physics, ammunition table |
| `src/ai.js` | Pirate captain AI |
| `src/world.js` | Sea, sky, weather presets, islands, wind |
| `src/fx.js` | Particles and synthesized sound |
| `src/data.js` | Player ship, the five pirates, upgrades |
| `src/index.template.html` | Page markup and styles; the bundle is inlined here |
| `build.mjs` | Bundles with esbuild into `dist/index.html` |
