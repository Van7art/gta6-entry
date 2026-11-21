// upgrades.js — the full Cross Motors garage shop. While stopped in the
// garage bay, the player can buy performance stages, repaint the car,
// fit new wheels and bolt on a spoiler. Everything costs cash, the good
// stock is locked behind respect ranks, and every purchase persists in the
// save and is re-applied to every car Jax gets into.
// Keys in the bay: U engine / I armour; G opens the full shop panel.
export const UPGRADE_DEFS = {
  engine: { key: 'engine', costs: [800, 1500, 2500], label: 'Engine', bonus: '+15% top speed', lockRep: [0, 0, 50], lockRank: [null, null, 'HUSTLER'] },
  armor: { key: 'armor', costs: [600, 1200, 2200], label: 'Armour', bonus: '+50 max HP', lockRep: [0, 0, 100], lockRank: [null, null, 'STREET KING'] },
};

export const PAINTS = [
  { name: 'Sunset Red', hex: 0xd94f30, cost: 0 },
  { name: 'Ocean Blue', hex: 0x2e86c1, cost: 300 },
  { name: 'Taxi Gold', hex: 0xf1c40f, cost: 300 },
  { name: 'Palm Green', hex: 0x27ae60, cost: 300 },
  { name: 'Vice Purple', hex: 0x8e44ad, cost: 300 },
  { name: 'Neon Orange', hex: 0xe67e22, cost: 300 },
  { name: 'Arctic White', hex: 0xecf0f1, cost: 400 },
  { name: 'Midnight Black', hex: 0x1c1c1e, cost: 400 },
  { name: 'Mint Teal', hex: 0x16a085, cost: 300 },
];

export const WHEELS = [
  { name: 'Standard', cost: 0, lockRep: 0, lockRank: null, color: 0x141414 },
  { name: 'Sport', cost: 400, lockRep: 25, lockRank: 'WHEELMAN', color: 0x888888 },
  { name: 'Chrome', cost: 700, lockRep: 50, lockRank: 'HUSTLER', color: 0xd8d8d8 },
];

export const SPOILER = { name: 'Rear Spoiler', cost: 350, lockRep: 25, lockRank: 'WHEELMAN' };

export function defaultGarage() {
  return {
    engine: 0, armor: 0,
    paint: 'Sunset Red', ownedPaints: ['Sunset Red'],
    wheels: 'Standard', spoiler: false,
  };
}

export class Upgrades {
  constructor() {
    this.levels = { engine: 0, armor: 0 };
    this.paint = 'Sunset Red';
    this.ownedPaints = ['Sunset Red'];
    this.wheels = 'Standard';
    this.spoiler = false;
  }

  load(saved) {
    if (!saved) return;
    this.levels = { engine: saved.engine | 0, armor: saved.armor | 0 };
    if (saved.paint) this.paint = saved.paint;
    if (Array.isArray(saved.ownedPaints) && saved.ownedPaints.length) this.ownedPaints = saved.ownedPaints.slice();
    if (saved.wheels) this.wheels = saved.wheels;
    this.spoiler = !!saved.spoiler;
  }

  // Backwards-compatible: the old save shape was {engine, armor} only.
  save() {
    return {
      engine: this.levels.engine, armor: this.levels.armor,
      paint: this.paint, ownedPaints: this.ownedPaints.slice(),
      wheels: this.wheels, spoiler: this.spoiler,
    };
  }

  nextCost(kind) {
    const def = UPGRADE_DEFS[kind];
    const lvl = this.levels[kind];
    return lvl >= def.costs.length ? null : def.costs[lvl];
  }

  // Rank gate for the next stage of kind; returns the blocking rank or null.
  lockFor(kind, rep) {
    const def = UPGRADE_DEFS[kind];
    const lvl = this.levels[kind];
    if (lvl >= def.costs.length) return null;
    const need = def.lockRep[lvl];
    return rep >= need ? null : def.lockRank[lvl];
  }

  // Apply the saved levels + visuals to a car (idempotent per car).
  applyTo(car) {
    if (!car._upgBase) car._upgBase = { maxSpeed: car.stats.maxSpeed, hp: car.stats.hp };
    car.stats.maxSpeed = car._upgBase.maxSpeed * (1 + 0.15 * this.levels.engine);
    car.stats.hp = car._upgBase.hp + 50 * this.levels.armor;
    if (car.hp > car.stats.hp) car.hp = car.stats.hp;
    const paint = PAINTS.find((p) => p.name === this.paint);
    car.applyVisual(paint ? paint.hex : 0xd94f30, this.wheels, this.spoiler);
  }

  // Buy the next stage of kind for cash; returns a message for the HUD.
  buy(kind, cash, rep) {
    const def = UPGRADE_DEFS[kind];
    const cost = this.nextCost(kind);
    if (cost === null) return { ok: false, msg: def.label + ' is maxed out.' };
    const lock = this.lockFor(kind, rep);
    if (lock) return { ok: false, msg: def.label + ' stage ' + (this.levels[kind] + 1) + ' needs rank ' + lock + ' — earn more respect.' };
    if (cash < cost) return { ok: false, msg: def.label + ' stage ' + (this.levels[kind] + 1) + ' costs $' + cost + ' — not enough cash.' };
    this.levels[kind]++;
    return { ok: true, cost, msg: def.label + ' stage ' + this.levels[kind] + ' fitted (' + def.bonus + ') — $' + cost };
  }

  // Buy a paint job (or switch to one already owned, free).
  buyPaint(name, cash) {
    const paint = PAINTS.find((p) => p.name === name);
    if (!paint) return { ok: false, msg: 'Unknown paint.' };
    if (this.ownedPaints.includes(name)) {
      this.paint = name;
      return { ok: true, cost: 0, msg: 'Paint switched to ' + name + '.' };
    }
    if (cash < paint.cost) return { ok: false, msg: name + ' paint costs $' + paint.cost + ' — not enough cash.' };
    this.ownedPaints.push(name);
    this.paint = name;
    return { ok: true, cost: paint.cost, msg: name + ' paint applied — $' + paint.cost };
  }

  buyWheels(name, cash, rep) {
    const w = WHEELS.find((x) => x.name === name);
    if (!w) return { ok: false, msg: 'Unknown wheels.' };
    if (this.wheels === name) return { ok: false, msg: name + ' wheels already fitted.' };
    if (rep < w.lockRep) return { ok: false, msg: name + ' wheels need rank ' + w.lockRank + ' — earn more respect.' };
    if (cash < w.cost) return { ok: false, msg: name + ' wheels cost $' + w.cost + ' — not enough cash.' };
    this.wheels = name;
    return { ok: true, cost: w.cost, msg: name + ' wheels fitted — $' + w.cost };
  }

  buySpoiler(cash, rep) {
    if (this.spoiler) return { ok: false, msg: 'Spoiler already fitted.' };
    if (rep < SPOILER.lockRep) return { ok: false, msg: 'Spoiler needs rank ' + SPOILER.lockRank + ' — earn more respect.' };
    if (cash < SPOILER.cost) return { ok: false, msg: 'Spoiler costs $' + SPOILER.cost + ' — not enough cash.' };
    this.spoiler = true;
    return { ok: true, cost: SPOILER.cost, msg: 'Rear spoiler fitted — $' + SPOILER.cost };
  }

  removeSpoiler() {
    if (!this.spoiler) return { ok: false, msg: 'No spoiler fitted.' };
    this.spoiler = false;
    return { ok: true, cost: 0, msg: 'Spoiler removed.' };
  }
}
