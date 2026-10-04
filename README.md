# Fitkin

Friends raise one shared 3D character by moving together. Cozy, private, no leaderboards.
StormHacks 2026 · Team: Ko, Kelsie, Akam, Diana.

Mobile-first web app. On a phone it fills the screen; on a laptop it shows inside a phone frame.

## Quick start (2 minutes)

```bash
npm install
npm run dev        # opens on http://localhost:5173 and your LAN IP (open that on your phone)
```

With no Firebase keys the app runs in **demo mode**: data stays in your browser and **each tab is a different friend**. Open two tabs to test live sync with no setup.

To use real shared data, copy `.env.example` to `.env.local` and fill in the four Firebase values, then restart `npm run dev`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server with hot reload |
| `npm test` | Unit tests for the game rules (EXP, cap, levels, goals, shop) |
| `npm run build` | Production build into `dist/` (what Vercel runs) |
| `npm run preview` | Serve the production build locally |

## Where things live

```
src/
  lib/rules.js          Game rules: EXP, daily cap, levels, goals. Pure functions.   Kelsie
  lib/items.js          Shop catalog, prices, legendary challenges.                  Kelsie + Diana
  lib/rules.test.js     Tests for the two files above. Run: npm test
  lib/db.js             The only data door. Picks Firebase or demo mode.             Ko
  lib/backend/          firebaseBackend.js (real) and demoBackend.js (browser-only)  Ko + Kelsie
  three/Character.jsx   The 3D character, movement, add-on anchors.                  Diana
  pages/                Join, Home, Grow, Shop, Clubs                                Akam (Home, Grow) · Diana (Shop, Clubs)
  components/           NavBar, LogSheet, ClubContext, Icons                         Akam
  App.jsx               Phone frame + routes. Shared: announce before editing.
firestore.rules         Security rules. Paste into Firebase console.                 Ko
public/models/          Diana's GLB files go here.
```

**Rules of the road:** pages never call Firestore directly; they use `api` and the hooks in `lib/db.js`. Game numbers change only in `lib/rules.js`, and `npm test` must pass.

## Firebase setup (Ko, once)

1. Firebase console → Add project → Build → **Authentication** → Sign-in method → enable **Anonymous**.
2. Build → **Firestore Database** → Create (production mode, region `northamerica-northeast1` or nearest).
3. Firestore → **Rules** → paste `firestore.rules` → Publish.
4. Project settings → Your apps → Web app → copy `apiKey`, `authDomain`, `projectId`, `appId` into `.env.local` and into Vercel → Settings → Environment Variables (Production and Preview).
5. Authentication → Settings → Authorized domains → add `vercel.app` and your production domain.
6. First time the Showcase loads, Firestore may ask for an index in the browser console. Click the link it prints.

## Data model (Firestore)

```
invites/{CODE}                         { groupId }
groups/{gid}                           { name, exp, coins, owned[], equipped[], memberCount,
                                         goalsCompleted, goalPaidDate, achievements[], lastActiveAt, createdAt }
groups/{gid}/meta/invite               { code }                      members only
groups/{gid}/members/{uid}             { displayName, joinedAt, inviteCode, todayDate, todayExp,
                                         todayMinutes, wellnessDone[], weekStart, weekMinutes, weekTypes[], lastActiveDate }
groups/{gid}/workouts/{id}             { uid, name, type, minutes, intensity, sets, mood, exp, createdAt }
groups/{gid}/broadcasts/{id}           { uid, name, activity, time, going[], createdAt, expiresAt }
```

## 3D contract (Diana ↔ code)

- Character GLB has empties named `anchor_head`, `anchor_face`, `anchor_body`.
- Add-on ids in `lib/items.js` (`sunglasses`, `headband`, `cap`, `jacket`, `scarf`, `bow`, `aura`, `crown`) match the GLB/object names.
- Movement is code (`useFrame`): bounce when someone moved today, nap otherwise, pop on tap and level-up. Never sad or sick.
- Keep each GLB under 5 MB.

## Known gaps (on purpose, for the hackathon)

- Any club member can write the club's EXP/coins from the client. Fixing it properly needs Cloud Functions (paid Blaze plan).
- Spending allowance and purchase votes, and custom tasks with a friend's OK are specced but not built.
- The showcase lists any club's mascot (name, level, outfit) to signed-in users. Members and workouts stay private.
