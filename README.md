# Broadside

A 3D age-of-sail duel for the browser. Hunt five pirate captains in a brig-of-war.

- Guns fire only from the sides, inside a limited arc; shots along the length of a hull rake for extra damage
- Wind sets your speed, you cannot sail straight into it, and the ship upwind of the other shoots straighter
- Four sail settings trade speed against steadier guns and tighter turns
- Four kinds of shot: round (hull), chain (sails), grape (crew), heated (fire)

Three ways to win, and each pirate favours a different one:

- **Out-gun her.** Batter the hull below 15% and she gives up as a wreck. You collect the bounty.
- **Board her.** Get inside the ring drawn around her, match her speed, press `B`. Guns can only
  reach the crew on deck (40% are always below), so a ship is never taken from range. A boarded
  prize pays up to double, and you can take command of her in port.
- **Out-sail her.** Sit across her bow or stern where her guns cannot answer and rake. Torn sails
  are jury-rigged back to about a third, so a crippled ship is a window, not a kill.

Port Halcyon is home: your ship at the pier, shops along the quay, and every ship you own at anchor.

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
