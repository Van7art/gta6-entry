// upgrades.js — Cross Motors performance shop. While stopped in the garage
// bay, U buys an engine stage (+15% top speed) and I buys an armour stage
// (+50 max HP, car patched up). Two stages each; levels persist in the save
// and are applied to every car Jax gets into.
export const UPGRADE_DEFS = {
  engine: { key: 'engine', costs: [800, 1500], label: 'Engine', bonus: '+15% top speed' },
  armor: { key: 'armor', costs: [600, 1200], label: 'Armour', bonus: '+50 max HP' },
};

export class Upgrades {
  constructor() {
    this.levels = { engine: 0, armor: 0 };
  }

  load(saved) {
    if (saved) this.levels = { engine: saved.engine | 0, armor: saved.armor | 0 };
  }

  save() { return { ...this.levels }; }

  nextCost(kind) {
    const def = UPGRADE_DEFS[kind];
    const lvl = this.levels[kind];
    return lvl >= def.costs.length ? null : def.costs[lvl];
  }

  // Apply the saved levels to a car (idempotent per car).
  applyTo(car) {
    if (!car._upgBase) car._upgBase = { maxSpeed: car.stats.maxSpeed, hp: car.stats.hp };
    car.stats.maxSpeed = car._upgBase.maxSpeed * (1 + 0.15 * this.levels.engine);
    car.stats.hp = car._upgBase.hp + 50 * this.levels.armor;
    if (car.hp > car.stats.hp) car.hp = car.stats.hp;
  }

  // Buy the next stage of kind for cash; returns a message for the HUD.
  buy(kind, cash) {
    const def = UPGRADE_DEFS[kind];
    const cost = this.nextCost(kind);
    if (cost === null) return { ok: false, msg: def.label + ' is maxed out.' };
    if (cash < cost) return { ok: false, msg: def.label + ' stage ' + (this.levels[kind] + 1) + ' costs $' + cost + ' — not enough cash.' };
    this.levels[kind]++;
    return { ok: true, cost, msg: def.label + ' stage ' + this.levels[kind] + ' fitted (' + def.bonus + ') — $' + cost };
  }
}
