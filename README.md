# Broadside

A 3D age-of-sail duel for the browser. Hunt five pirate captains in a brig-of-war.

- Guns fire only from the sides, inside a limited arc; shots along the length of a hull rake for extra damage
- Wind sets your speed, you cannot sail straight into it, and the ship upwind of the other shoots straighter
- Four sail settings trade speed against steadier guns and tighter turns
- Four kinds of shot: round (hull), chain (sails), grape (crew), heated (fire)
- Come alongside at matching speed and board. The odds are shown before you commit; a loaded
  battery facing her fires point-blank as the hulls touch, and grapeshot feeds the swivel gun
- A prize pays more the less you have wrecked her: the bounty for a hulk, double for an intact hull
- Port Halcyon is home: your ship at the pier, shops along the quay, captured ships at anchor in the bay

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
| `B` | Board when alongside at matching speed |
| `F`, `X` | During a boarding: fire the swivel gun, cut the grapples |
| `V` | Camera: facing the enemy / behind your ship |
| `P`, `M` | Pause, mute |

Touch devices get on-screen buttons.

## Layout

| File | Contents |
| --- | --- |
| `src/main.js` | Game loop, gunnery, boarding, first-fight coaching, camera, HUD, port and screens |
| `src/ship.js` | Procedural ship model, crew figures, sailing physics, sail and ammunition tables |
| `src/ai.js` | Pirate captain AI |
| `src/world.js` | Sea, sky, weather presets, islands, wind |
| `src/fx.js` | Particles and synthesized sound |
| `src/harbor.js` | Port Halcyon scenery and shop locations |
| `src/data.js` | Player ship, the five pirates, upgrades and shop stock |
| `src/index.template.html` | Page markup and styles; the bundle is inlined here |
| `build.mjs` | Bundles with esbuild into `dist/index.html` |
