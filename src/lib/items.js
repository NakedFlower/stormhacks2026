// Shop catalog. The `id` is also the name of the add-on in the 3D model
// (and of its GLB file in public/models/). Tell the team before renaming one.
// Owner: Diana (looks) + Kelsie (prices).

export const ITEMS = [
  // Common: 15-40 coins per member
  { id: 'sunglasses', name: 'Sunglasses', tier: 'common', pricePerMember: 20, unlockLevel: 1, slot: 'face' },
  { id: 'headband', name: 'Sweatband', tier: 'common', pricePerMember: 15, unlockLevel: 1, slot: 'head' },
  { id: 'cap', name: 'Club cap', tier: 'common', pricePerMember: 30, unlockLevel: 2, slot: 'head' },
  { id: 'jacket', name: 'Varsity jacket', tier: 'common', pricePerMember: 40, unlockLevel: 3, slot: 'body' },
  // Rare: 100-300 coins per member
  { id: 'scarf', name: 'Cozy scarf', tier: 'rare', pricePerMember: 100, unlockLevel: 4, slot: 'body' },
  { id: 'bow', name: 'Big bow', tier: 'rare', pricePerMember: 150, unlockLevel: 6, slot: 'head' },
  // Legendary: never sold, unlocked by a challenge
  { id: 'aura', name: 'Golden aura', tier: 'legendary', challenge: 'allActive', slot: 'aura' },
  { id: 'crown', name: 'Club crown', tier: 'legendary', challenge: 'goals10', slot: 'head' },
];

export const CHALLENGES = {
  allActive: { label: 'Everyone moves on the same day', target: 1 },
  goals10: { label: 'Finish 10 daily group goals', target: 10 },
};

export function priceFor(item, memberCount) {
  return (item.pricePerMember ?? 0) * Math.max(1, memberCount);
}

export function itemById(id) {
  return ITEMS.find((i) => i.id === id);
}

export function challengeProgress(group, challengeId) {
  const c = CHALLENGES[challengeId];
  const value = challengeId === 'goals10' ? group.goalsCompleted ?? 0 : (group.achievements ?? []).includes(challengeId) ? 1 : 0;
  return { ...c, value: Math.min(value, c.target), done: value >= c.target };
}

// Why a member can or cannot buy. Returns null when the purchase is allowed.
export function cannotBuy(item, group, level, memberCount) {
  if (!item || item.tier === 'legendary') return 'Not for sale.';
  if ((group.owned ?? []).includes(item.id)) return 'Already owned.';
  if (level < item.unlockLevel) return `Unlocks at Lv ${item.unlockLevel}`;
  if ((group.coins ?? 0) < priceFor(item, memberCount)) return 'Not enough coins';
  return null;
}

// One item per slot: equipping a new hat takes the old hat off.
export function equipList(current, item) {
  const others = current.filter((id) => itemById(id)?.slot !== item.slot);
  return current.includes(item.id) ? current.filter((id) => id !== item.id) : [...others, item.id];
}
