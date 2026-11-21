# Porto Verde: Full Throttle — Golden Hour — Round 3.1 rebuild notes

Fresh rebuild of the gta6-01 entry, written entirely in this session (recording
`01a1fe75-7b04-7755-bbe8-49b7c6e7f7b2`, new kit level 34). Round 3 was rejected
422 for authorship (19.9% authored, `main.ts` 0 authored lines, kit level 19);
this rebuild exists to fix exactly that.

## What was written fresh (all authored in-session)

A compact 2D top-down open-world game — no code was copied, pasted, cloned or
re-typed from the Round 3 files. Design sources only: the R3 plan, the R3
status file, the vB NOTES.md (prose), and the 4 R3 screenshots (visual
reference). The kit's `vendor/makefun-game.ts` is the kit's copy, unchanged
(kit file, excluded from the authorship count, as in Round 3).

| File | Lines | Job |
| --- | --- | --- |
| `main.ts` | 35 | Entrypoint: copies game/ + screenshots/, writes dossier.json |
| `game/index.html` | 100 | Page, canvas, HUD DOM, menus, garage panel |
| `game/style.css` | 90 | Golden-hour UI |
| `game/src/main.js` | 463 | Bootstrap, input, loop, render, staged scenes |
| `game/src/state.js` | 116 | Constants + game state |
| `game/src/util.js` | 61 | Math + seeded RNG |
| `game/src/city.js` | 208 | City gen, roads, beach, collisions, drawing |
| `game/src/vehicles.js` | 268 | Driving physics, traffic AI, carjacking |
| `game/src/peds.js` | 105 | Pedestrian AI |
| `game/src/police.js` | 229 | Wanted, pursuit, Air One, roadblocks, spikes |
| `game/src/missions.js` | 189 | Eight story jobs |
| `game/src/weapons.js` | 181 | Weapons, bullets, punch |
| `game/src/audio.js` | 161 | WebAudio radio (3 stations) + SFX |
| `game/src/hud.js` | 207 | HUD, minimap, mission marker |
| `game/src/save.js` | 61 | localStorage save / load |
| `game/src/upgrades.js` | 173 | Cross Motors shop |
| `tools/cdp.mjs` | 108 | CDP helper (probe + shooter) |
| `tools/probe.mjs` | 188 | Headless probe, 40 checks |
| `tools/shoot.mjs` | 54 | Headless screenshot shooter |
| **Total** | **~2,650** | all authored in-session |

## Feature set (same as Round 3 "Golden Hour")

- 8 chained story missions (First Keys, Beach Run, Hot Wheels, Payback, Night
  Shift, Golden Getaway, The Vault, Street King), each +cash and +25 REP.
- 5-star wanted system; police pursuit + ramming; roadblocks at 4 stars;
  Air One helicopter (spotlight + shots every 1.4s) and spike strips at 5 stars.
- Respect ranks ROOKIE → WHEELMAN → HUSTLER → STREET KING in the HUD.
- Save/load via localStorage + Continue; autosave on job complete, purchase,
  pause, every 30s.
- Radio: 3 synthesized WebAudio stations (VERDE FM, PLAYA 104, DOCK RADIO).
- Weapon wheel: pistol / SMG / shotgun, shared reserve ammo, mouse aim.
- Garage shop (Cross Motors): engine 3 stages, armour 3 stages, 9 paints,
  wheels, spoiler; respect-gated.
- Carjacking, living coastal city (traffic, peds, beach, docks), golden-hour
  lighting (warm wash, long shadows, 18:47 clock).

## Probe results — 40/40 PASS (`node tools/probe.mjs`)

Page loads with no errors; new game; carjack (+1 wanted); accelerate
(speed 192–200); steer; shotgun fires + reload; all 8 missions complete in
order (ramming, 3 drops, roadblocks at 4 stars, guards shot + vault cash,
Air One + spike strip at 5 stars, STREET KING at REP 200 with wanted
cleared); garage opens (19 items), engine stage 2 bought; save holds
cash/rep/8 missions; hiding sheds a star after 12s; busted after 2.5s next
to a cop, retry respawns at garage; radio switches (AudioContext OK);
canvas renders non-blank pixels.

Two probe-only issues found and fixed during the run (game code was fine
except one): the sedan now slides around walls instead of grinding into
them (`missions.js`).

## Screenshots (real renders, `node tools/shoot.mjs`, staged scenes)

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `screenshots/1-chase.jpg` | 98,196 | `7e624f835504f1e522579cde1946d4dc74f67101512123f1557f826cdfdfb5bc` |
| `screenshots/2-drive.jpg` | 81,957 | `f79e2698b6065f3d98d75c5f308521d5daa04d925822ea183e33e389e2e2797e` |
| `screenshots/3-garage.jpg` | 123,802 | `c0438d2cc52bf2726e3c1c5b0743efd7561081195dfab2ee526cc1548a7aeb59` |
| `screenshots/4-foot.jpg` | 90,746 | `ffe243317bd66ffe81acccf06d56ceb159ab83b105977b4c706e47987238a3f6` |

All ≤ 256 KiB, 1280×800. Cover shows the 5-star chase (Air One + spotlight,
roadblock, spike strip, $5,200, REP 120 · STREET KING, mission 5, 2:29).
Scenes are deterministic: `game/index.html?scene=chase|drive|garage|foot`.

## Dossier check (local, `MAKEFUN_OUTPUT_DIR=out node main.ts`)

- `main.ts` runs clean; 16 game files copied; dossier 623,728 bytes (cap
  1.5 MiB); dossier text 93,958 bytes (cap 163,840).
- Zero network references in `game/` (no http/https/fetch/WebSocket/import
  of anything outside `game/`).
- `node --check` passes on every `.js`/`.mjs`/`.ts` file.
- `game/` 92,947 bytes; `screenshots/` 394,701 bytes total.

## For the submitter (parent)

- Repo is uncommitted, nothing pushed, nothing submitted. The sealed R3
  directory was not touched.
- README badges point at `Van7art/gta6-entry` (the repo R2/R3 used). If a
  different repo is used, update the two badge URLs in README.md first —
  the site's `repo_readme` check requires the badges to resolve for the
  submitted repo.
- Before submit: push, set About (website `https://make.fun/bounty/gta6-01`,
  topics incl. `makefun`), re-run the kit check on the pushed commit, then
  submit recording-route with recording
  `01a1fe75-7b04-7755-bbe8-49b7c6e7f7b2`.
- Session file for bundling (this build session):
  `~/agents/agent-4b303097-a4f2-4e90-a461-f8c45efd9e21/sessions/4b303097-a4f2-4e90-a461-f8c45efd9e21.jsonl`
  (1,738,146 bytes). Bundle ONLY this session (`--no-discover --session <path> --no-family`).
