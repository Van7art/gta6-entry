// weapons.js — the weapon wheel. Three on-foot slots: pistol (starting
// weapon), SMG (fast, close-mid range) and shotgun (five pellets, brutal
// up close). All three share one ammo reserve, fed by the ammo pickups
// already scattered around the city; each slot keeps its own magazine.
// Keys: 4/5/6 pick a slot directly, C cycles. The wheel is drawn in the HUD.
export const WEAPONS = {
  pistol: { key: 'pistol', name: 'PISTOL', damage: 34, range: 60, mag: 12, cooldown: 0.28, pellets: 1, spread: 0 },
  smg: { key: 'smg', name: 'SMG', damage: 16, range: 45, mag: 30, cooldown: 0.09, pellets: 1, spread: 0.05 },
  shotgun: { key: 'shotgun', name: 'SHOTGUN', damage: 14, range: 25, mag: 6, cooldown: 0.85, pellets: 5, spread: 0.12 },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun'];

export function weaponDef(key) {
  return WEAPONS[key] || WEAPONS.pistol;
}

export function defaultWeaponState() {
  return {
    current: 'pistol',
    mags: { pistol: WEAPONS.pistol.mag, smg: WEAPONS.smg.mag, shotgun: WEAPONS.shotgun.mag },
    reserve: 60,
  };
}
