# Code tour: Akam's files

A quick map of the four files you own, where their data comes from, and where to go for polish. Line numbers are from the `MVP` branch and may drift a little.

**Two things to know first**

- **`src/lib/db.js`** is the only place the screens get data from. It exports `api` (actions like `api.logWorkout`) and hooks that stay live (`useGroup`, `useMembers`, `useWorkouts`, `useBroadcasts`). With no Firebase keys it runs in demo mode, and each browser tab acts as a different person.
- **`src/components/ClubContext.jsx`** calls those hooks once for the current club and shares the result. Any screen calls `useClub()` to get `{ gid, group, members, me, info, workouts, broadcasts, toast }`. `info` holds the level, the progress bar numbers and the character's stage, all worked out from `group.exp`.

Most spacing lives in `src/styles.css`: `.screen` (line 70) sets the page padding and the 16px gap between sections, `.stack` (78) sets a 10px gap, and `.sheet` (136) is the LogSheet panel. The rest is inline `style={{ gap: … }}` in the JSX.

---

## `src/App.jsx`: the app shell

**What it does.** It wraps everything in a phone-shaped frame, waits for sign-in, and then picks a screen. If you haven't joined a club yet, every URL shows Join. Once you have, it sets up the club data and the routes (`/`, `/grow`, `/shop`, `/clubs`, `/join`), the bottom nav, and the LogSheet when it's open.

**Main pieces.** `Phone` (the frame plus the desktop side note) and `App` itself. App holds one bit of state, `logOpen`, and passes `setLogOpen(true)` to Home and NavBar so both can open the sheet.

**Data.** `useReady()` gives the user id or an error. `useSession()` gives `session.current`, the club you're viewing. It wraps the logged-in screens in `<ClubProvider gid={session.current}>`, so everything inside can call `useClub()`.

**Polish spots**
1. **Loading state, line 34.** It shows plain text, "Waking up…". You could swap in a spinner or a sleepy character.
2. **Error state, line 33.** It shows the error message with no way out. Add a "Try again" button that reloads the page.
3. **LogSheet mount, line 56.** The sheet appears and disappears instantly. Add a slide-up animation here and in `.sheet` (styles.css 135–136).

## `src/pages/Home.jsx`: the main screen

**What it does.** Home is where people land. It shows the club's EXP and coins, the 3D character with its level and progress bar, a "Heading out, who's in?" card, today's glow row of friends, the daily group goal, and a to-do list (one workout plus the wellness tasks).

**Main pieces.**
- `Home({ onLog })` is the screen. Its `useEffect` (lines 17–23) watches `info.level` and, when it goes up, bumps `popKey` so the character pops and shows a toast. `wellness(id)` calls `api.doWellness`. Ticking the workout to-do runs `onLog()`, which opens the LogSheet.
- `HeadingOut` (line 112) is the broadcast card. `post()` calls `api.headOut`, and "I'm in" calls `api.joinBroadcast`.

**Data.** `useClub()` gives `group` (EXP, coins, name, equipped items), `members` (for glow and the goal), `me` (today's minutes and wellness), `info` (level and stage), `broadcasts` and `toast`. `useSession()` gives your display name. The goal math (`dailyGoal`, `isActiveToday`) comes from `lib/rules.js`.

**Polish spots**
1. **Loading state, line 25.** "Loading your club…" is plain text. A skeleton of the character and the bars would feel smoother.
2. **Tap targets, lines 153 and 70.** "I'm in" uses `.btn.small` at 36px tall. Aim for 44px or more. The friend avatars are 52px, which is fine, but the 14px gap (line 67) gets tight with many friends.
3. **Empty states, lines 63 and 68.** When nobody has posted, HeadingOut shows only the button, so you could add "No one's out yet. Be first!". In a one-person club, the glow row shows only "You", so you could add an "Invite a friend" link to `/clubs`.

## `src/pages/Grow.jsx`: progress and history

**What it does.** Grow shows the club's long-term progress: a smaller character with the level bar, the evolution path (Baby, Kid, Teen, Adult), the legendary item challenges, your active minutes this week, and a feed of recent workouts.

**Main pieces.** `Grow()` is one long screen with no sub-components. `ago(ms)` turns a timestamp into "5m", "3h" or "2d". `challengeProgress` (from `lib/items.js`) works out each legendary challenge.

**Data.** `useClub()` gives `group`, `members`, `me`, `info` and `workouts`, where `workouts` is the live feed from `useWorkouts`. `STAGES`, `weeklyGoal` and `weekKey` come from `lib/rules.js`, and `ITEMS` comes from `lib/items.js`.

**Polish spots**
1. **Loading state, line 16.** `if (!group) return null` leaves a blank screen while data loads. Show the same loading message Home uses.
2. **Spacing, lines 25–33 and 87.** The top card and the "Recent moments" list use inline gaps (`gap: 14`, `gap: 0`, `marginBottom: 6`) that don't match the 10/16px rhythm elsewhere. Line 44's `.thumb` uses a different font size depending on whether the stage is reached.
3. **Empty state, line 89.** "Nothing yet. Log the first walk!" is plain text. Make it a button that opens the log sheet. That needs `onLog` passed in from App, so post in the team chat first, since App is shared.

## `src/components/LogSheet.jsx`: logging a workout

**What it does.** LogSheet is a bottom sheet for logging a workout in two taps: pick an activity, then hit Save. Minutes, intensity, sets and mood all have defaults. It previews the EXP you'll earn and accounts for the daily cap.

**Main pieces.** `LogSheet({ onClose })` holds form state (`type`, `minutes`, `intensity`, `sets`, `mood`, `busy`, `error`). `pick(a)` picks an activity and resets intensity and sets to its defaults. `save()` sends the workout to the backend. Tapping the dark backdrop closes the sheet.

**Data.** `useClub()` gives `gid`, `toast` and `me`, where `me.todayExp` is used to work out the cap. `api.logWorkout` comes from `db.js`. `ACTIVITIES`, `INTENSITY`, `MOODS`, `activityExp` and `DAILY_EXP_CAP` come from `lib/rules.js`.

**Polish spots**
1. **Tap targets, lines 44, 51, 76 and 86.** "Close" is 36px. The `.choice` chips are 40px and the `.seg` buttons are 38px (styles.css 107 and 111). All of these are under 44px.
2. **Saving state, lines 40 and 95.** While saving, only Save is disabled. Tapping the backdrop or Close still closes the sheet mid-save. Make `onClose` do nothing while `busy` is true, and consider a spinner on the button.
3. **Error and input, lines 62 and 94.** The custom minutes box accepts empty or 0, and the backend error then shows in small red text above Save. Disable Save when `minutes` is less than 1, and give the error more room or a friendlier message.

---

## One workout, from Save to a bigger character

1. **Tap Save** (`LogSheet.jsx:95`). This runs `save()`. It sets `busy` so the button reads "Saving…", then calls `api.logWorkout(gid, { type, minutes, intensity, sets, mood })`.
2. **The backend does the math** (`lib/backend/firebaseBackend.js:90`, or the demo backend). `applyWorkout` in `lib/rules.js` works out the EXP (capped per day) and the coins. In one transaction it updates your member doc, adds that EXP and those coins to the club's `group` doc, and writes a new workout doc. It returns `{ exp, coins, capped }`.
3. **The sheet closes.** `save()` shows a toast like "+20 EXP · +10 coins" and calls `onClose()`, so App sets `logOpen` to false.
4. **The live data updates.** The group doc changed, so the watcher behind `useGroup` (Firestore `onSnapshot`, or a `storage` event in demo mode) fires. `ClubProvider` gets the new `group`, and `info = levelInfo(group.exp, memberCount)` is recalculated. This happens on every phone in the club, not just yours.
5. **Home re-renders.** The EXP chip and the progress bar move right away. If `info.level` went up, the `useEffect` at `Home.jsx:17` bumps `popKey`, so the character does a pop animation and the toast says "Level N! Your little guy grew."
6. **The character actually grows.** `<Character stage={info.stage.id} …>` gets a new stage only when the level crosses a stage line in `STAGES` (Kid at level 5, Teen at 10, Adult at 20). Between those levels it only pops.
