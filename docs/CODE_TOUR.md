# Code tour

A map of the app as it is on `main` after the overnight merges: sign-in, the 3D otter, to-dos that earn EXP, cheers and the fix list. It's organised by what a person does, then by file. Names, not line numbers, so it doesn't drift.

## The big picture

```
Auth  ──sign up / sign in──▶  Join  ──start or join a club──▶  Home · Grow · Log · Shop · Clubs
                                                                   │
                                     every screen reads one club through useClub()
                                                                   │
                     src/lib/db.js  (api + live hooks)  ──▶  firebaseBackend.js  (real, shared)
                                                        └─▶  demoBackend.js      (no keys: this browser only)
                                                                   │
                                     both backends call the same pure rules in src/lib/rules.js + items.js
```

Three rules of the road:

1. **Screens never talk to Firestore.** They call `api.*` and the hooks in `src/lib/db.js`.
2. **Game numbers live only in `src/lib/rules.js` and `src/lib/items.js`.** Both backends call the same pure functions, and `npm test` covers them.
3. **Security lives in `firestore.rules`.** It is pasted into the Firebase console by hand, so publish it whenever the file changes, and only from `main`.

## Files and owners

| File | What it does | Owner |
|---|---|---|
| `src/App.jsx` | Phone frame. Shows Auth when signed out, Join when you have no club, otherwise the five tabs and the Log sheet | Akam (shared) |
| `src/pages/Auth.jsx` | Email/password sign-in and sign-up, plus Google | Ko |
| `src/pages/Join.jsx` | Start a club (shows the "Club created!" card with the code) or join with a code | Ko |
| `src/pages/Home.jsx` | Otter, level bar, Heading out, Today's glow and cheers, group goal, to-do list | Akam |
| `src/pages/Grow.jsx` | Level, evolution path, legendary challenge, this week's minutes, recent workouts | Akam |
| `src/pages/Shop.jsx` | Buy and wear add-ons with the shared coin pot | Diana |
| `src/pages/Clubs.jsx` | My clubs and switching, invite code, account and sign-out, weekly goal, showcase | Diana |
| `src/components/LogSheet.jsx` | Log a workout in two taps | Akam |
| `src/components/ClubContext.jsx` | Loads the current club once; gives `useClub()`; toasts; incoming cheers; pays the daily group goal | Akam + Kelsie |
| `src/three/Character.jsx`, `itemModels.js` | The otter (`character.glb`), hats (`hats.glb`), bounce/nap/pop | Diana |
| `src/lib/rules.js` | EXP, daily cap, to-dos, levels and growth, goals, invite codes | Kelsie |
| `src/lib/items.js` | Shop catalog, prices, unlock levels, legendary challenge | Kelsie + Diana |
| `src/lib/db.js` | Picks the backend; session (which club you're viewing); live hooks | Ko |
| `src/lib/backend/*.js` | Firebase and demo versions of the same `api` | Ko + Kelsie |
| `firestore.rules` | Who can read and write what | Ko |
| `e2e/*.spec.js`, `scripts/seed-demo/` | End-to-end tests and the demo-club seeding script | Kelsie |

## What `useClub()` gives a screen

`{ gid, group, members, me, memberCount, info, workouts, broadcasts, inviteCode, toast }`

- `group`: the club doc (name, `exp`, `growth`, `coins`, `owned`, `equipped`, `memberCount`, goal fields).
- `me`: your member doc for today (`todayExp`, `todayMinutes`, `wellnessDone`, `wellnessPaid`, week fields).
- `info`: `clubLevel(group)` = `{ level, stage, into, need, progress }`.
- `toast(msg)`: shows a message. Messages queue (at most 2 waiting), so a level-up never hides the "+EXP" one.

## Flows, start to finish

### Sign up and start a club
1. `Auth.jsx` → `api.signUpWithEmail`. Firebase creates the account. The name is handed to Join through the session, so Join never shows the email.
2. `Join.jsx` → `api.createClub(name, displayName)`. One batch writes the club (`exp: 0, growth: 0, memberCount: 1`), `meta/invite`, `invites/{code}` and your member doc. Your `users/{uid}` doc remembers the club, so signing in on another phone brings it back.
3. The "Club created!" card shows the code; "Start our club" calls `rememberClub` and opens Home.

### Join with a code
`api.joinClub(code)` reads `invites/{code}`, then in one batch adds your member doc (with the code; the rules check it) and adds 1 to `memberCount`. It also pins `growth`, so the new, bigger club never drops a level.

### Log a workout
1. `LogSheet` → `api.logWorkout(gid, input)`.
2. `applyWorkout` (rules.js) works out EXP: minutes × intensity, or sets × 2; buddy ×1.25 when 2+ are going in a live "Heading out"; +10 for a new activity type (max 2 a week); then the 60-a-day cap.
3. One transaction updates your member doc, adds `exp`, `growth` and `coins` (+10) to the club, and writes the workout.
4. Every phone's `onSnapshot` fires: the bar moves, and if the level went up Home pops the otter and toasts "Level N!".
5. `ClubContext` notices when the daily group goal is complete (75% of members moved 10+ minutes) and pays +20 coins once.

### Tick or untick a to-do
- Tick → `api.doWellness`. `applyWellness` adds the task's EXP (5–12, inside the daily cap) and its coins (10–25, only for the first 3 ticks a day). It records exactly what that tick paid in `wellnessPaid`.
- Untick → `api.undoWellness`. `undoWellness` takes back exactly what that tick paid, so ticking and unticking can never farm coins.
- The "Move for 10 minutes" to-do ticks itself once you've logged 10+ minutes; tapping it after that just says to use the + button.

### Levels and growth
- `growth` = EXP divided by the club's size at the moment it was earned. `clubLevel(group)` works the level out from growth, so a friend joining makes the next level cost more but never takes a level away.
- Each level costs `20 × level^1.3` per member. Stages: Kid at Lv 5, Teen at 10, Adult at 20 (the otter gets bigger).
- Older clubs without a `growth` field fall back to `exp / memberCount` until their next EXP write saves it.

### Cheers
Tap a friend in Today's glow → `api.cheer(gid, friendId)` writes `groups/{gid}/cheers/{id}`. The friend's `ClubContext` watches cheers sent to them and toasts "Ana cheered you on!". You can cheer each friend once every 30 seconds.

### Shop
`cannotBuy` (items.js) explains why you can't buy: level, coins, owned, or legendary. `api.buy` re-checks inside a transaction, takes the coins, and puts the item on. One item per slot; tapping a worn item takes it off. Every item needs an entry in `src/three/itemModels.js` (`npm test` checks this).

## Tests

| Command | What runs |
|---|---|
| `npm test` | Unit tests for rules and items, in about a second |
| `npm run test:e2e` | Every `e2e/*.spec.js` against `BASE_URL` (production by default). Two-person cases need Firebase; in demo mode add `-- --grep-invert "@two"` |
| `npm run seed:demo` | Creates the three demo clubs and saves their codes and owner logins to `seed-demo-codes.txt` |

E2E specs: `signup` (S1–S8, A1–A5), `todo-exp` (W1–W4), `fixes` (F1–F5, LV1–LV5, C1, R1, X1), `privacy` (P1–P4, straight against the Firestore rules). Test clubs are named "E2E …" and are hidden from the showcase; delete them before the demo.

## Demo mode

With no `VITE_FIREBASE_*` keys, everything runs in this browser's storage. Each email is one person (signing back in finds your clubs), and a second tab can be a second person. It's for building screens fast, not for showing two real phones.
