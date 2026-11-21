# gta6-01 Round 3 — Varian B "Golden Hour" — NOTES

**Basis:** R2 vA "Director's Cut" (commit d307cf4) + semua P0 + garage shop lengkap (P1 B).
**Status:** SELESAI, terverifikasi. TIDAK submit, TIDAK push.
**Direktori:** `/home/hatch/workspace/makefun/gta6-r3/vB/` (satu-satunya yang diubah).

## Fitur yang dibangun

### P0 (semua varian)
1. **Wanted 5★ + Air One + roadblock + spike strip** (`game/src/police.js`)
   - Helikopter "Air One": badan + rotor berputar + lampu sorot (cone + light pool di tanah)
     yang mengikuti pemain, hover di depan pemain agar masuk frame kamera chase;
     di 5★ menembak dari udara tiap 1,4 dtk (tracer + damage 4 ke mobil / 6 ke pemain).
   - Roadblock: 2 blok × 2 mobil polisi melintang di jalan di depan pemain, aktif di 4★+,
     di-layout ulang saat pemain melewatinya.
   - Spike strip: aktif di 5★, diletakkan di depan pemain; terlindas → ban pecah
     (top speed capped 55% selama 8 dtk) + 10 damage; re-arm setelah 20 dtk.
   - `WANTED.maxStars` sudah 5; `policePerStar` [0,2,3,4,5,6] dipertahankan.
2. **Respect ranks di HUD** (`game/src/progression.js`, baru; adaptasi sistem vC R2)
   - ROOKIE 0 → WHEELMAN 25 → HUSTLER 50 → STREET KING 100; naik +25 per misi selesai.
   - HUD: `REP 120 · STREET KING`; rank membuka stok garage (lihat bawah).
3. **Save/load localStorage diperluas** (`game/src/save.js`)
   - Tersimpan: cash, rep, misi selesai, posisi + mobil, jam, garage lengkap
     (engine/armour/paint/ownedPaints/wheels/spoiler), weapon wheel, setting radio/mute.
   - Tombol Continue di menu sudah ada; save-info menampilkan progres.
   - Autosave: tiap misi selesai, tiap pembelian garage, tiap pause, tiap 30 dtk.
4. **Radio 3 stasiun synth WebAudio** (`game/src/audio.js`)
   - Sudah ada di basis (VERDE FM / PLAYA 104 / DOCK RADIO, tanpa file eksternal);
     ditambah `nextStation()` + label HUD yang bisa diklik + tombol Q (1-3 tetap jalan).
5. **Weapon wheel** (`game/src/weapons.js`, baru; `game/src/player.js`)
   - Pistol (34 dmg, mag 12) / SMG (16 dmg, mag 30, fire rate cepat) / Shotgun
     (5 pellet × 14 dmg, mag 6). Satu reserve bersama, diisi ammo pickup yang ada.
   - Roda senjata di HUD (slot + isi mag, slot aktif disorot); tombol 4/5/6 atau C.
6. **Golden-hour lighting vB R2** — sudah identik di basis (sun 0xffd9a8 int 2.4,
   fog 0xf2c98f, sky 0x87b5d6, hemi 0xbfd9ff/0x8a6a4a); dipertahankan, tidak diubah.
7. **4 screenshot di-shoot ulang** dari kode game (lihat bawah).
8. **README** diperbarui (judul "Golden Hour", sistem baru); 3 badge tetap hidup;
   `vendor/` tidak disentuh.

### P1 varian B — garage shop LENGKAP (`game/src/upgrades.js`, `game/src/vehicles.js`)
- Panel toko Cross Motors (tombol G di dalam bay; `game/index.html` + `game/style.css`):
  panel kanan, tombol klik untuk semua item.
- Engine 3 stage ($800/$1500/**$2500**, stage 3 terkunci rank HUSTLER) dan
  Armour 3 stage ($600/$1200/**$2200**, stage 3 terkunci rank STREET KING).
- Cat: 9 warna ($0–$400, yang dimiliki bisa diganti gratis), diterapkan ke bodi mobil.
- Velg: Standard / Sport $400 (WHEELMAN) / Chrome $700 (HUSTLER) — warna velg berubah.
- Spoiler $350 (WHEELMAN), bisa dilepas; sports car memakai spoiler bawaan.
- Semua pembelian: bayar cash → diterapkan ke mobil → tersimpan di save.
- `Car.applyVisual()` + `Car.burstTires()` baru di `vehicles.js`.

### File baru / berubah
- Baru: `game/src/progression.js`, `game/src/weapons.js`, `tools/probe.mjs`,
  `tools/shoot.mjs` (adaptasi dari R2; aslinya disimpan sebagai `probe-r2.mjs` /
  `shoot-r2.mjs`), `out/dossier.json` (hasil build), `NOTES.md` ini.
- Diubah: `police.js`, `upgrades.js`, `save.js`, `player.js`, `vehicles.js`,
  `hud.js`, `audio.js`, `main.js`, `debug.js`, `index.html`, `style.css`,
  `README.md`, `screenshots/*` (4 file baru).
- Tidak diubah: `vendor/`, `main.ts`, `serve.ts`, `LICENSE`.

## Hasil probe fungsional — 12/12 PASS
`tools/probe.mjs` (port 8171; exit 0), dijalankan 2× penuh setelah perubahan
terakhir (heli 12 m) — hasil identik:
1. Pause menu lists 8 missions — 8 tombol.
2. REP 0 shows ROOKIE — `REP 0 · ROOKIE`.
3. Rep 50 HUSTLER, rep 100 STREET KING.
4. 5★: heli spawn + 2 roadblock (4 mobil) + spike strip armed.
5. Spike strip: `slowTimer 8`, HP 100→90 (damage 10), strip disarmed.
6. Radio: `PLAYA 104 · Beach Beats` → `nextStation()` → `DOCK RADIO · Night Shift`.
7. Weapon wheel: SMG mag 30 → Shotgun mag 6 → tembakan → ammo 5.
8. Garage cat: Taxi Gold $300, bodi `0xf1c40f`, cash 5000→4700.
9. Engine tier 3: terkunci di rep 0 ("needs rank HUSTLER"), terbuka di rep 50,
   $2500, top speed 34→49,3 (sedan, ×1,45).
10. Armour tier 3: terkunci di rep 50 ("needs rank STREET KING"), terbuka di rep 100,
    $2200, max HP 100→250.
11. Chrome wheels + spoiler: terpasang, velg `0xd8d8d8`.
12. Save/load round-trip: paint Taxi Gold + Chrome + spoiler + senjata SMG +
    stasiun 2 + cash $4321 tersimpan di localStorage DAN ter-load kembali
    via `startGame(false)` (termasuk diterapkan ke mobil).

## Harness play-test — 4/4 scene ready, 0 page error, 0 exception
`tools/shoot.mjs` (port 8172): chase ready 5★/heli/2 blok/strip, drive ready
traffic 32, garage ready (`garageOpen: true`), foot ready rep 120/radio DOCK.
FPS headless swiftshader ~1–2 (artefak software rendering; game time di-clamp
0,05 dtk/frame — bukan cacat game). Drive probe: mobil bergerak (speed ~16–18).

## Screenshot final (1280×800 JPEG, render asli, ≤256 KiB)
| File | Isi | Ukuran |
|---|---|---|
| `screenshots/1-cover.jpg` | Chase 5★: heli Air One + sorot, roadblock, spike strip, 5★, `AIR ONE OVERHEAD`, `REP 120 · STREET KING`, radio PLAYA 104, misi `5 · Beach Run` 2:29 | 135.428 |
| `screenshots/2-drive.jpg` | Drive Downtown: traffic di depan, `REP 0 · ROOKIE`, VERDE FM | 127.476 |
| `screenshots/3-garage.jpg` | Cross Motors: panel toko kanan (Engine/Armour Stage 2/3 + harga, 9 cat, Taxi Gold FITTED), mobil gold di bay, `$8.500 · STREET KING` | 85.859 |
| `screenshots/4-respect.jpg` | Pantai: `REP 120 · STREET KING`, `DOCK RADIO · Night Shift`, weapon wheel (SHOTGUN 6 aktif), AMMO 6/60, Jax + peds + laut | 60.766 |

Semua 4 dilihat langsung: sistem baru kelihatan di setiap shot. Heli sempat di
luar frame pada 38 m → diturunkan ke 12 m di depan pemain; panel garage sempat
menutup mobil → dipindah ke kanan + toast auto-repair dihilangkan (mobil scene
di-set full HP).

## Dossier
`MAKEFUN_OUTPUT_DIR=out node main.ts` (Node lokal v24.22.1; kode tetap
kompatibel Node 22 — tanpa sintaks baru):
- `out/dossier.json`: **715.030 byte** (batas 1,5 MiB = 1.572.864).
- `out/` total 1.966.365 byte; `out/game/` identik dengan `game/` (`diff -r` bersih).
- 4 screenshot di `out/screenshots/`, semua ≤256 KiB.

## Gerbang lain
- `node --check` semua 24 file (`game/src/*.js`, `main.ts`, `serve.ts`): OK.
- 0 referensi network di `game/` (grep `http(s)://` / `fetch(` / `XMLHttpRequest`).
- Tidak ada file `game/` atau `screenshots/` yang berubah setelah screenshot
  final (14:08 WITA 19 Nov) — dicek via `find -newer`.
- `main.ts` starter kit tidak disalin verbatim (file asli R2 dipertahankan).

## Rubrik lokal C1–C5 (target ≥46/50; vA R2 43/50)
| Kriteria | vA R2 | vB R3 | Bukti |
|---|---|---|---|
| C1 dunia lengkap di screenshot | 8,5 | **9** | Cover: 5★ + heli + beam + roadblock + strip + misi + minimap; garage: toko + mobil gold; foot: pantai + peds + laut. Semua sistem baru terlihat. |
| C2 depth/fun | 9,5 | **9,5** | 8 misi + eskalasi 5★ (heli/roadblock/spike) + rank gating garage + toko lengkap + weapon wheel + save/load. (Tetap 9,5: tanpa carjacking/crew — itu P1 varian lain.) |
| C3 feel/polish | 8 | **9** | Radio HUD klik + Q, roda senjata di HUD, indikator AIR ONE, panel garage, label rank, Continue/save. Tracer tembakan heli + feedback spike strip. |
| C4 look/originality | 7,5 | **9** | Golden-hour vB (8,5 di R2) + beam sorot heli + mobil gold Chrome + UI toko. |
| C5 struktur | 9,5 | **9,5** | File satu-tugas baru (`progression.js`, `weapons.js`); `police.js`/`upgrades.js`/`save.js` diperluas bersih; vendor tak tersentuh. |
| **TOTAL** | **43** | **46,5** | Target ≥46 **tercapai** (+3,5 vs vA). |

## Insiden saat verifikasi (dicatat, sudah diatasi)
1. **Port 8151 direbut varian C.** Probe pertama setelah perubahan heli
   melayani game varian C (rank vC, fungsi R3 hilang) karena server vC
   (`/home/hatch/workspace/makefun/gta6-r3/vC`, PID 81803) sudah menduduki
   8151; server vB gagal bind (EADDRINUSE) tanpa peringatan dan Chrome
   memuat game yang salah. Juga satu OOM kill saat itu (VM dipakai 3 varian
   paralel). Perbaikan: probe/shoot pindah ke port **8171/8172** + preflight
   fetch yang memverifikasi server melayani varian B (marker `weapon-wheel`
   + `CROSS MOTORS`), retry 10 dtk, abort keras bila mismatch. Probe 12/12
   PASS diulang penuh di port baru.
2. **Shoot scene 3–4 gagal navigasi 2×** (target blank, `ready:false`,
   fps ~35 = halaman kosong) saat VM penuh. Perbaikan: `shoot.mjs` dapat
   argumen filter scene + retry navigasi per scene (tutup target, buat baru);
   re-shoot parsial `garage,foot` di Chrome segar berhasil 2/2.
3. **Heli di luar frame** (38 m → 22 m → 12 m) dan **panel garage menutup
   mobil** → heli 12 m di depan pemain, panel dipindah ke kanan, mobil
   scene di-set full HP (toast repair hilang). Semua diperbaiki SEBELUM
   screenshot final; probe 12/12 diulang setelah perubahan terakhir.

## Yang TIDAK dilakukan
- Tidak submit, tidak push, tidak menyentuh `gta6-r3-entry/`, repo
  `gta6-entry-v3`, atau `~/.makefun/`.
- Tidak ada perubahan file apa pun setelah screenshot final (14:08 WITA),
  kecuali README (di luar `game/`/`screenshots/`), tools, `out/`, dan
  NOTES.md ini.
