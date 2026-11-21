// progression.js — street respect ranks. Rep is earned by finishing story
// missions (+25 each) and jobs; ranks show in the HUD and unlock garage
// stock (visuals and tier-3 performance). Ranks can never soft-lock the
// game: every locked item only needs rep, never a mission flag.
export const RANKS = [
  [0, 'ROOKIE'],
  [25, 'WHEELMAN'],
  [50, 'HUSTLER'],
  [100, 'STREET KING'],
];

export function rankFor(rep) {
  let rank = RANKS[0][1];
  for (const [min, name] of RANKS) if (rep >= min) rank = name;
  return rank;
}

export function rankMin(name) {
  for (const [min, n] of RANKS) if (n === name) return min;
  return 0;
}

// Short label for the HUD: "REP 60 · HUSTLER".
export function repLabel(rep) {
  return 'REP ' + rep + ' · ' + rankFor(rep);
}
