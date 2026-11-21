[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Van7art/gta6-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Van7art/gta6-entry/reward.svg)](https://make.fun/bounty/gta6-01)

# Porto Verde: Full Throttle — Golden Hour

An open-world crime game in the spirit of GTA 6, built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on make.fun. A complete, original, top-down open world that plays offline in a desktop browser from static files — no network request, no build step.

Jax owes Cross Motors $5,000. Mara Voss has eight jobs that pay it off — if the Porto Verde police don't catch him first. Drive a living coastal city at golden hour: steal cars, outrun the law, and earn your way from ROOKIE to STREET KING.

## The world

- **A city on foot and by car** — a road-grid coastal city with a beach, marina docks, palms, traffic and pedestrians, drawn in warm golden-hour light with long dusk shadows.
- **Traffic and pedestrians** — 26 traffic cars cruise the grid (and brake for each other), 44 pedestrians walk the sidewalks and the beach, and they flee gunfire and speeding cars.
- **Cars to steal** — walk up to any traffic car and press E to carjack it. Each steal raises your wanted level.

## The law

- **5-star wanted system** — crimes (carjacking, shooting, hitting pedestrians, assaulting police) raise stars; hiding out of sight sheds one every 12 seconds.
- **Police pursuit** — patrol cars chase and ram you; from 4 stars they lay roadblocks across the road ahead of you.
- **Air One** — at 5 stars the police helicopter hovers ahead of you, paints you with its spotlight, and shoots every 1.4 seconds.
- **Spike strips** — at 5 stars the police drop spike strips ahead of you: hit one and your top speed is cut by 45% for 8 seconds.

## The jobs

Eight chained story missions from Mara Voss, each paying cash and +25 respect:

1. **First Keys** — steal any car, bring it to Cross Motors.
2. **Beach Run** — get the package to the beach in 2:30.
3. **Hot Wheels** — steal the Comet sports car at the docks (the docks are watched).
4. **Payback** — ram Rico's fleeing sedan until it stops.
5. **Night Shift** — drive Mara to three drops across the city.
6. **Golden Getaway** — lose a 4-star chase and reach the hills hideout.
7. **The Vault** — deal with the guards, grab the cash, deliver it.
8. **Street King** — outrun Air One and deliver the ledger to the lighthouse.

## Progression, combat, sound

- **Respect ranks** — ROOKIE → WHEELMAN → HUSTLER → STREET KING, shown in the HUD; higher ranks unlock the good garage stock.
- **Cross Motors garage** — engine (3 stages), armour (3 stages), 9 paints, wheels, spoiler. Open it with G inside the bay.
- **Weapons** — pistol, SMG and shotgun on the wheel (4/5/6 or C), shared reserve ammo, mouse aim, click to shoot, R to reload, F to punch.
- **Radio** — three synthesized WebAudio stations: VERDE FM (Sunset Drive), PLAYA 104 (Beach Beats), DOCK RADIO (Night Shift). Q cycles, 1–3 jump, M mutes.
- **Save** — localStorage autosaves on every completed job, purchase, pause and every 30 seconds; Continue from the title screen picks up where you left off.
- **HUD** — wanted stars, cash, respect, clock, mission objective with timer, round minimap with traffic, cops, heli and mission marker, health, ammo, weapon slots and speed.

## Controls

WASD drive / walk · E enter or steal car · Space drift · Mouse aim, click shoot · R reload / reset car · F punch · H horn · N next job · G garage shop (in the bay) · Q / 1–3 radio · 4/5/6 / C weapons · M mute · Esc pause

## Play it

Serve the `game/` folder with any static server and open `game/index.html`, or run the entry program:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes `out/dossier.json`.

## Structure

| File | Job |
| --- | --- |
| `game/index.html` | Page, canvas and HUD DOM |
| `game/style.css` | Golden-hour UI styling |
| `game/src/main.js` | Bootstrap, input, game loop, render, staged scenes |
| `game/src/state.js` | Constants and the game state |
| `game/src/util.js` | Math and seeded-RNG helpers |
| `game/src/city.js` | City generation, roads, beach, collisions, drawing |
| `game/src/vehicles.js` | Driving physics, traffic AI, carjacking |
| `game/src/peds.js` | Pedestrian AI |
| `game/src/police.js` | Wanted system, pursuit, Air One, roadblocks, spikes |
| `game/src/missions.js` | The eight story jobs |
| `game/src/weapons.js` | Weapons, bullets, punch |
| `game/src/audio.js` | WebAudio radio and sound effects |
| `game/src/hud.js` | HUD, minimap, mission marker |
| `game/src/save.js` | localStorage save / load |
| `game/src/upgrades.js` | Cross Motors shop |
| `tools/probe.mjs` | Headless probe: 40 checks over every system |
| `tools/shoot.mjs` | Headless screenshot shooter |
| `tools/cdp.mjs` | CDP helper for the probe and shooter |

## Screenshots

1. `1-chase.jpg` — 5-star chase: Air One overhead, roadblock and spike strip.
2. `2-drive.jpg` — free roam downtown in the blue sedan.
3. `3-garage.jpg` — Cross Motors garage shop.
4. `4-foot.jpg` — on foot at the beach, shotgun out.

All four are real renders of this game's own code, taken headless from the staged scenes (`game/index.html?scene=chase|drive|garage|foot`).

## License

MIT — see [LICENSE](LICENSE).
