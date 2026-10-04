// Fitkin game rules. Pure functions only: no Firebase, no React.
// Both backends (Firebase and demo) call these, so the rules live in one place.
// Owner: Kelsie. Change a number here and it changes everywhere.

export const DAILY_EXP_CAP = 60; // per member per day, bonuses included
export const WORKOUT_COINS = 10; // finishing a workout pays the shared pot
export const WELLNESS_COINS = 5;
export const WELLNESS_MAX_PER_DAY = 3;
export const GROUP_GOAL_COINS = 20;
export const GROUP_GOAL_MINUTES = 10; // "everyone moves 10 minutes today"
export const GROUP_GOAL_SHARE = 0.75; // goal completes at 75% of members
export const WEEKLY_MINUTES_PER_MEMBER = 150; // WHO guideline
export const BROADCAST_HOURS = 3;

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

export const WELLNESS_TASKS = [
  { id: 'water', label: 'Drink 2L water' },
  { id: 'stretch', label: 'Stretch 5 minutes' },
  { id: 'outside', label: '10 minutes outside' },
  { id: 'sleep', label: 'Slept 7+ hours' },
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
  }
  if (m.weekStart !== week) {
    m.weekStart = week;
    m.weekMinutes = 0;
  }
  m.todayExp ??= 0;
  m.todayMinutes ??= 0;
  m.wellnessDone ??= [];
  m.weekMinutes ??= 0;
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

// Returns what a logged workout changes. The caller writes it.
export function applyWorkout(member, input, now = new Date()) {
  const error = validateWorkout(input);
  if (error) throw new Error(error);
  const m = freshMember(member, now);
  const raw = activityExp(input);
  const room = Math.max(0, DAILY_EXP_CAP - m.todayExp);
  const exp = Math.min(raw, room);
  const minutes = Math.round(Number(input.minutes));
  return {
    exp,
    coins: WORKOUT_COINS,
    capped: exp < raw,
    member: {
      ...m,
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
  if (!WELLNESS_TASKS.some((t) => t.id === taskId)) throw new Error('Unknown task.');
  const m = freshMember(member, now);
  if (m.wellnessDone.includes(taskId)) throw new Error('Already done today.');
  const coins = m.wellnessDone.length < WELLNESS_MAX_PER_DAY ? WELLNESS_COINS : 0;
  return { coins, member: { ...m, wellnessDone: [...m.wellnessDone, taskId] } };
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
