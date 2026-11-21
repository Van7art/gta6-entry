// Cross Motors garage shop: performance, paint, wheels, spoiler.
// Respect ranks gate the good stock; purchases apply immediately and autosave.
import { GARAGE, PAINTS, WHEELS, rankIndexFor, rankFor } from './state.js';
import { fmtMoney, $ } from './util.js';
import { saveGame } from './save.js';
import { playerTopSpeed } from './vehicles.js';

function lockedByRank(g, need) {
  return rankIndexFor(g.rep) < (need || 0);
}

export function openShop(g) {
  g.mode = 'garage';
  renderShop(g);
  $('garage').classList.remove('hidden');
}

export function closeShop(g) {
  $('garage').classList.add('hidden');
  g.mode = 'playing';
}

export function renderShop(g) {
  $('shop-status').textContent = fmtMoney(g.cash) + ' · ' + rankFor(g.rep);
  const box = $('shop-items');
  box.innerHTML = '';
  const addSection = (title) => {
    const h = document.createElement('h3');
    h.textContent = title;
    box.appendChild(h);
  };
  const addItem = (label, sub, priceText, action, locked, fitted) => {
    const row = document.createElement('div');
    row.className = 'shop-item' + (locked ? ' locked' : '');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = label;
    const subEl = document.createElement('span');
    subEl.className = 'sub';
    subEl.textContent = sub;
    name.appendChild(subEl);
    row.appendChild(name);
    const price = document.createElement('div');
    price.className = fitted ? 'fitted' : 'price';
    price.textContent = fitted ? '✓ FITTED' : priceText;
    row.appendChild(price);
    if (!locked && !fitted) row.addEventListener('click', action);
    box.appendChild(row);
  };

  addSection('Performance');
  GARAGE.engine.forEach((e, i) => {
    const stage = i + 1;
    const owned = g.garage.engine >= stage;
    const next = stage === g.garage.engine + 1;
    addItem(
      'Engine · Stage ' + stage + '/3',
      next ? 'Next — ' + e.label : e.label,
      owned ? (stage === g.garage.engine ? '' : 'OWNED') : fmtMoney(e.price),
      () => buyEngine(g, stage),
      !owned && (lockedByRank(g, e.need) || g.cash < e.price || !next),
      owned && stage === g.garage.engine,
    );
  });
  GARAGE.armour.forEach((a, i) => {
    const stage = i + 1;
    const owned = g.garage.armour >= stage;
    const next = stage === g.garage.armour + 1;
    addItem(
      'Armour · Stage ' + stage + '/3',
      next ? 'Next — ' + a.label : a.label,
      owned ? (stage === g.garage.armour ? '' : 'OWNED') : fmtMoney(a.price),
      () => buyArmour(g, stage),
      !owned && (lockedByRank(g, a.need) || g.cash < a.price || !next),
      owned && stage === g.garage.armour,
    );
  });

  addSection('Paint');
  PAINTS.forEach((p, i) => {
    const owned = g.garage.ownedPaints.includes(i);
    addItem(
      p.name,
      owned ? 'Owned — click to fit' : fmtMoney(p.price),
      owned ? '' : fmtMoney(p.price),
      () => buyPaint(g, i),
      !owned && g.cash < p.price,
      g.garage.paint === i,
    );
  });

  addSection('Wheels');
  WHEELS.forEach((w, i) => {
    const owned = g.garage.wheels >= i;
    addItem(
      w.name + ' Wheels',
      lockedByRank(g, w.need) ? 'Needs ' + ['ROOKIE', 'WHEELMAN', 'HUSTLER', 'STREET KING'][w.need] : 'Fitted set',
      owned ? (g.garage.wheels === i ? '' : 'OWNED') : fmtMoney(w.price),
      () => buyWheels(g, i),
      !owned && (lockedByRank(g, w.need) || g.cash < w.price),
      g.garage.wheels === i,
    );
  });

  addSection('Spoiler');
  addItem(
    'Rear Spoiler',
    lockedByRank(g, GARAGE.spoiler.need) ? 'Needs WHEELMAN' : '+downforce, +style',
    g.garage.spoiler ? '' : fmtMoney(GARAGE.spoiler.price),
    () => buySpoiler(g),
    !g.garage.spoiler && (lockedByRank(g, GARAGE.spoiler.need) || g.cash < GARAGE.spoiler.price),
    g.garage.spoiler,
  );
}

function buyEngine(g, stage) {
  const e = GARAGE.engine[stage - 1];
  if (g.garage.engine !== stage - 1 || g.cash < e.price || lockedByRank(g, e.need)) return;
  g.cash -= e.price;
  g.garage.engine = stage;
  if (g.car) g.car.top = playerTopSpeed(g);
  g.toast = 'Engine Stage ' + stage + ' fitted — top speed up!';
  afterPurchase(g);
}

function buyArmour(g, stage) {
  const a = GARAGE.armour[stage - 1];
  if (g.garage.armour !== stage - 1 || g.cash < a.price || lockedByRank(g, a.need)) return;
  g.cash -= a.price;
  g.garage.armour = stage;
  if (g.car) { g.car.maxHp = a.hp; g.car.hp = Math.min(g.car.hp + 50, a.hp); }
  g.toast = 'Armour Stage ' + stage + ' fitted — max HP ' + a.hp + '.';
  afterPurchase(g);
}

function buyPaint(g, i) {
  const p = PAINTS[i];
  if (!g.garage.ownedPaints.includes(i)) {
    if (g.cash < p.price) return;
    g.cash -= p.price;
    g.garage.ownedPaints.push(i);
  }
  g.garage.paint = i;
  if (g.car) g.car.color = p.color;
  g.toast = p.name + ' paint fitted.';
  afterPurchase(g);
}

function buyWheels(g, i) {
  const w = WHEELS[i];
  if (g.garage.wheels !== i) {
    if (g.cash < w.price || lockedByRank(g, w.need)) return;
    g.cash -= w.price;
    g.garage.wheels = i;
  }
  g.toast = w.name + ' wheels fitted.';
  afterPurchase(g);
}

function buySpoiler(g) {
  if (g.garage.spoiler || g.cash < GARAGE.spoiler.price || lockedByRank(g, GARAGE.spoiler.need)) return;
  g.cash -= GARAGE.spoiler.price;
  g.garage.spoiler = true;
  if (g.car) g.car.spoiler = true;
  g.toast = 'Spoiler fitted.';
  afterPurchase(g);
}

function afterPurchase(g) {
  saveGame(g);
  renderShop(g);
  if (g.audio) g.audio.pickup();
}
