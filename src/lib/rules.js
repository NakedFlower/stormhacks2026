// Fitkin game rules. Pure functions only: no Firebase, no React.
// Both backends (Firebase and demo) call these, so the rules live in one place.
// Owner: Kelsie. Change a number here and it changes everywhere.

export const DAILY_EXP_CAP = 60; // per member per day, bonuses included
export const WORKOUT_COINS = 10; // finishing a workout pays the shared pot
export const WELLNESS_COINS = 5;
export const WELLNESS_EXP = 5; // default EXP per to-do; a task can set its own `exp`. Always inside the daily cap.
export const WELLNESS_MAX_PER_DAY = 3;
export const GROUP_GOAL_COINS = 20;
export const GROUP_GOAL_MINUTES = 10; // "everyone moves 10 minutes today"
export const GROUP_GOAL_SHARE = 0.75; // goal completes at 75% of members
export const WEEKLY_MINUTES_PER_MEMBER = 150; // WHO guideline
export const BROADCAST_HOURS = 3;
export const BUDDY_MULTIPLIER = 1.25; // workout EXP when you're in a live "Heading out" with company
export const BUDDY_MIN_GOING = 2;
export const VARIETY_EXP = 10; // first log of an activity type this week
export const VARIETY_MAX_PER_WEEK = 2;

export const INTENSITY = { light: 1, moderate: 1.5, vigorous: 2 };

export const ACTIVITIES = [
  { id: 'walk', label: 'Walk', intensity: 'light' },
  { id: 'yoga', label: 'Yoga', intensity: 'light' },
  { id: 'bike', label: 'Bike', intensity: 'moderate' },
  { id: 'swim', label: 'Swim', intensity: 'moderate' },
  { id: 'run', label: 'Run', intensity: 'vigorous' },
  { id: 'sport', label: 'Sport', intensity: 'vigorous' },
  { id: 'strength', label: 'Strength', intensity: 'moderate', usesSets: true },
];

// Daily to-dos. Every one adds EXP to the club (counted inside each person's daily cap).
// `coins` is paid only for the first WELLNESS_MAX_PER_DAY ticked each day. Values: Diana.
export const WELLNESS_TASKS = [
  { id: 'water', label: 'Drink 2L water', exp: 5, coins: 10 },
  { id: 'stretch', label: 'Stretch 5 minutes', exp: 5, coins: 10 },
  { id: 'outside', label: '10 minutes outside', exp: 5, coins: 15 },
  { id: 'sleep', label: 'Slept 7+ hours', exp: 5, coins: 15 },
  { id: 'stairs', label: 'Took the stairs', exp: 5, coins: 10 },
  { id: 'meditate', label: 'Meditate 10 minutes', exp: 10, coins: 20 },
  { id: 'steps', label: 'Hit 8,000 steps', exp: 12, coins: 25 },
  { id: 'veggies', label: 'Eat veggies every meal', exp: 8, coins: 15 },
  { id: 'no_screens', label: 'No screens 1 hr before bed', exp: 6, coins: 15 },
  { id: 'journal', label: 'Journal for 5 minutes', exp: 6, coins: 15 },
  { id: 'cold_shower', label: 'Cold shower 30 seconds', exp: 8, coins: 20 },
  { id: 'read', label: 'Read for 20 minutes', exp: 8, coins: 15 },
  { id: 'vitamins', label: 'Take your vitamins', exp: 5, coins: 10 },
  { id: 'meal_prep', label: 'Prep a healthy meal', exp: 10, coins: 20 },
  { id: 'gratitude', label: 'List 3 things you\'re grateful for', exp: 6, coins: 15 },
];

export const MOODS = ['great', 'okay', 'tired'];

export const STAGES = [
  { id: 'baby', name: 'Baby', level: 1, blurb: 'Round and wobbly. Basic cheers.' },
  { id: 'kid', name: 'Kid', level: 5, blurb: 'Stands up and jogs in place.' },
  { id: 'teen', name: 'Teen', level: 10, blurb: 'Sporty, with rare items.' },
  { id: 'adult', name: 'Adult', level: 20, blurb: 'Club swagger and confetti.' },
];

// ---------- dates (local time, so "today" matches the user's day) ----------

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekKey(d = new Date()) {
  const monday = new Date(d);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  monday.setDate(d.getDate() - offset);
  return dayKey(monday);
}

// ---------- EXP and levels ----------

export function activityExp({ minutes = 0, intensity = 'light', sets = 0 }) {
  const byMinutes = Math.round(Math.max(0, minutes) * (INTENSITY[intensity] ?? 1));
  const bySets = Math.max(0, sets) * 2;
  return Math.max(byMinutes, bySets); // the higher of the two, never both
}

export function expToNext(level, memberCount) {
  return Math.round(20 * Math.pow(level, 1.3) * Math.max(1, memberCount));
}

export function stageFor(level) {
  let stage = STAGES[0];
  for (const s of STAGES) if (level >= s.level) stage = s;
  return stage;
}

export function levelInfo(totalExp, memberCount) {
  let level = 1;
  let into = Math.max(0, totalExp);
  while (level < 99 && into >= expToNext(level, memberCount)) {
    into -= expToNext(level, memberCount);
    level += 1;
  }
  const need = expToNext(level, memberCount);
  return { level, into, need, progress: into / need, stage: stageFor(level) };
}

// A club's growth = EXP divided by the club's size at the moment it was earned.
// Levels come from growth, so a friend joining raises the cost of the NEXT level
// but never takes a level away. Clubs created before growth existed fall back to
// exp / memberCount until their next EXP write sets it.
export function clubGrowth(group) {
  if (!group) return 0;
  if (typeof group.growth === 'number') return group.growth;
  return (group.exp ?? 0) / Math.max(1, group.memberCount ?? 1);
}

// Growth after adding (or, when negative, removing) EXP at today's club size.
export function addGrowth(group, exp) {
  return Math.max(0, clubGrowth(group) + exp / Math.max(1, group?.memberCount ?? 1));
}

// Level for the screens. EXP numbers are shown at today's club size, so
// "into / need" reads in the same EXP the club earns.
export function clubLevel(group) {
  const size = Math.max(1, group?.memberCount ?? 1);
  const base = levelInfo(clubGrowth(group), 1);
  return {
    level: base.level,
    stage: base.stage,
    progress: base.progress,
    into: Math.round(base.into * size),
    need: Math.round(base.need * size),
  };
}

// ---------- member day/week bookkeeping ----------

export function freshMember(member, now = new Date()) {
  const today = dayKey(now);
  const week = weekKey(now);
  const m = { ...member };
  if (m.todayDate !== today) {
    m.todayDate = today;
    m.todayExp = 0;
    m.todayMinutes = 0;
    m.wellnessDone = [];
    m.wellnessPaid = {};
  }
  if (m.weekStart !== week) {
    m.weekStart = week;
    m.weekMinutes = 0;
    m.weekTypes = [];
  }
  m.todayExp ??= 0;
  m.todayMinutes ??= 0;
  m.wellnessDone ??= [];
  m.wellnessPaid ??= {};
  m.weekMinutes ??= 0;
  m.weekTypes ??= [];
  return m;
}

export function validateWorkout(input) {
  const activity = ACTIVITIES.find((a) => a.id === input.type);
  if (!activity) return 'Pick an activity.';
  const minutes = Number(input.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 300) return 'Minutes must be between 1 and 300.';
  if (!INTENSITY[input.intensity]) return 'Pick an intensity.';
  if (input.sets != null && (input.sets < 0 || input.sets > 50)) return 'Sets must be between 0 and 50.';
  if (input.mood != null && !MOODS.includes(input.mood)) return 'Pick a mood.';
  return null;
}

// True when this member is in a live "Heading out" broadcast with enough people going.
export function hasBuddy(broadcasts, uid, now = new Date()) {
  const t = now.getTime();
  return (broadcasts ?? []).some((b) => (b.expiresAt ?? 0) > t
    && (b.going ?? []).includes(uid) && b.going.length >= BUDDY_MIN_GOING);
}

// Returns what a logged workout changes. The caller writes it.
// Order: base EXP, x buddy multiplier, + variety bonus, then the daily cap last.
export function applyWorkout(member, input, now = new Date(), { buddy = false } = {}) {
  const error = validateWorkout(input);
  if (error) throw new Error(error);
  const m = freshMember(member, now);
  const base = activityExp(input);
  const newType = !m.weekTypes.includes(input.type);
  const variety = newType && m.weekTypes.length < VARIETY_MAX_PER_WEEK; // types beyond the 2nd never earn it
  const raw = (buddy ? Math.round(base * BUDDY_MULTIPLIER) : base) + (variety ? VARIETY_EXP : 0);
  const room = Math.max(0, DAILY_EXP_CAP - m.todayExp);
  const exp = Math.min(raw, room);
  const minutes = Math.round(Number(input.minutes));
  return {
    exp,
    coins: WORKOUT_COINS,
    capped: exp < raw,
    buddy,
    variety,
    member: {
      ...m,
      weekTypes: newType ? [...m.weekTypes, input.type] : m.weekTypes,
      todayExp: m.todayExp + exp,
      todayMinutes: m.todayMinutes + minutes,
      weekMinutes: m.weekMinutes + minutes,
      lastActiveDate: dayKey(now),
    },
    workout: {
      type: input.type,
      minutes,
      intensity: input.intensity,
      sets: input.sets ?? 0,
      mood: input.mood ?? null,
      exp,
      createdAt: now.getTime(),
    },
  };
}

export function applyWellness(member, taskId, now = new Date()) {
  const task = WELLNESS_TASKS.find((t) => t.id === taskId);
  if (!task) throw new Error('Unknown task.');
  const m = freshMember(member, now);
  if (m.wellnessDone.includes(taskId)) throw new Error('Already done today.');
  const coins = m.wellnessDone.length < WELLNESS_MAX_PER_DAY ? (task.coins ?? WELLNESS_COINS) : 0;
  const full = task.exp ?? WELLNESS_EXP;
  const exp = Math.min(full, Math.max(0, DAILY_EXP_CAP - m.todayExp));
  return {
    coins,
    exp,
    capped: exp < full,
    member: {
      ...m,
      wellnessDone: [...m.wellnessDone, taskId],
      wellnessPaid: { ...m.wellnessPaid, [taskId]: { coins, exp } },
      todayExp: m.todayExp + exp,
    },
  };
}

// Untick a to-do done today: gives back exactly what that tick earned.
// Returns negative coins and exp for the backend to apply to the club.
export function undoWellness(member, taskId, now = new Date()) {
  const m = freshMember(member, now);
  if (!m.wellnessDone.includes(taskId)) throw new Error('Not ticked today.');
  const paid = m.wellnessPaid[taskId] ?? { coins: 0, exp: 0 };
  const { [taskId]: _gone, ...restPaid } = m.wellnessPaid;
  return {
    coins: 0 - paid.coins, // 0 - x, so nothing paid gives 0 rather than -0
    exp: 0 - paid.exp,
    member: {
      ...m,
      wellnessDone: m.wellnessDone.filter((id) => id !== taskId),
      wellnessPaid: restPaid,
      todayExp: Math.max(0, m.todayExp - paid.exp),
    },
  };
}

// ---------- group goals ----------

export function dailyGoal(members, now = new Date()) {
  const today = dayKey(now);
  const done = members.filter((m) => m.todayDate === today && (m.todayMinutes ?? 0) >= GROUP_GOAL_MINUTES);
  const need = Math.max(1, Math.ceil(members.length * GROUP_GOAL_SHARE));
  return {
    doneIds: done.map((m) => m.id),
    done: done.length,
    need,
    complete: done.length >= need,
    everyone: members.length > 0 && done.length === members.length,
  };
}

export function weeklyGoal(members, now = new Date()) {
  const week = weekKey(now);
  const total = members.reduce((sum, m) => sum + (m.weekStart === week ? m.weekMinutes ?? 0 : 0), 0);
  const target = WEEKLY_MINUTES_PER_MEMBER * Math.max(1, members.length);
  return { total, target, progress: Math.min(1, total / target) };
}

export function isActiveToday(member, now = new Date()) {
  return member.lastActiveDate === dayKey(now);
}

export function makeInviteCode(random = Math.random) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(random() * chars.length)];
  return code;
}
