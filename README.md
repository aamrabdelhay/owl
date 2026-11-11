# OWL — Retro QWERTY Phone Simulator

A complete, working retro QWERTY phone, rendered in pure CSS/SVG and running a
miniature operating system in your browser. Boot it, unlock it, dial a number,
browse the web, type a memo, play nine games — everything is real, and
everything stays on your device.

**No backend account, no analytics, no paid APIs, no copyrighted assets.**
Every sound is synthesised with the Web Audio API, every visual is CSS or inline
SVG, and all user data lives in `localStorage` + IndexedDB.

---

## Highlights

- **Original OWL brand** — a 3D beveled owl-face logo (big amber eyes, beak,
  ear tufts) that appears on the phone forehead, boot animation, Menu key and
  the PWA icon. Chrome trim, glossy black body, deep navy UI, amber accent.
- **A real keyboard phone** — 5-row PC layout (Esc … arrows), square chrome
  trackpad with swipe support, Call / Menu / Back / End keys, side volume keys
  with a HUD. On desktop the phone sits at a 4–6° tilt and tilts further with
  mouse parallax; on mobile it fills the viewport and the on-screen keyboard
  takes over.
- **Physical keyboard sync** — pressing a key on your desktop keyboard lights
  the matching key on the phone and types into the phone's focused field
  (using `event.code`, so it works on any layout). Browser shortcuts are never
  hijacked.
- **A working OS** — boot sequence, keyguard with password/PIN, home screen with
  clock, dock and notification counters, pull-up Menu drawer with tabs, hotkeys,
  universal type-to-search, context menus, recents switcher, power menu, and a
  back stack.
- **27 apps / 9 games**, all functional and code-split.
- **Bilingual** English / العربية with runtime RTL switching.
- **Accessible** — ARIA roles and labels, focus rings, `prefers-reduced-motion`
  support, high-contrast and large-text options.

---

## Apps

| Group | Apps |
| --- | --- |
| Communication | Phone (dialer, call log, speed dial, simulated call), Messages (inbox/sent/drafts, 160-char segments), Owl Messenger (local bots), Contacts (vCard import/export), Email (mailto composer) |
| Internet | Owl Web — tabs (max 5), bookmarks, history, Owl Search (Wikipedia + DuckDuckGo instant answers + Wikimedia Commons images), reader mode through `/api/reader`, downloads disabled, voice search |
| Media | Music (file picker or File System Access, ID3 via bundled jsmediatags, analyser visualiser, mini-player), Videos (subtitles, speed, resume), Pictures (grid, zoom, slideshow, set-as-wallpaper), Voice Notes (MediaRecorder → IndexedDB), Ringtones (12 synthesised tones), Owl Radio (stream URLs), Camera (getUserMedia, timer, grid, save), Flashlight (torch + SOS), Compass (DeviceOrientation + demo mode) |
| Productivity | Calendar (month/week/day/agenda + reminders), Clock (world clock, alarms, stopwatch, timer, bedside), Calculator (safe parser, scientific), Converter (10 categories + live currency), Memo Pad, Tasks, Password Keeper (PBKDF2 + AES-GCM), File Manager |
| System | Themes (6), Profiles (6), Settings (16 sections), Setup wizard, Quick Help |
| Games | Owl Snake, Owl Breaker, Sky Owl, Pairs, Mancala, Sudoku, Block Stack, Word Owl, Solitaire |

### The games

- **Owl Snake** — the mother owl leads a chain of owlets that grows with every
  mouse eaten. Golden mice are worth 5× and give a short speed boost. Classic
  (wrap-around or walls), a four-maze campaign, and a seeded daily maze. LCD and
  colour palettes, speed 1–9.
- **Owl Breaker** — six levels, four power-ups (wide paddle, multiball, lasers,
  slow-motion), drag or arrow control.
- **Sky Owl** — side-scrolling shooter with bats, drones and a boss every third
  level; rapid-fire, shield and heal pickups.
- **Pairs** — three board sizes, mouse and keyboard play.
- **Mancala** — Bantumi sowing rules with captures and extra turns, easy or hard
  AI.
- **Sudoku** — generated puzzles with a guaranteed unique solution, notes,
  hints, undo and a timer; progress is saved between visits.
- **Block Stack** — falling crates with ghost preview, wall kicks and a level
  curve.
- **Word Owl** — six guesses, English **and** Arabic word lists, on-screen
  alphabet, hint and streak tracking.
- **Solitaire** — Klondike with auto-flip, hints, foundation shortcuts and a
  saved deal.

High scores are stored in IndexedDB and listed in the Games hub.

---

## Keyboard map

| Physical key | On the phone |
| --- | --- |
| Letters, numbers, punctuation | Type into the focused phone field |
| `Enter` | Trackpad click / OK / send |
| `Esc` | Back key |
| Arrow keys | Trackpad movement |
| `F1` or `Alt` | Menu key |
| `F2` | Call / answer |
| `F3` | End / power |
| `PgUp` / `PgDn` | Volume up / down (with HUD) |
| `Delete` in a field | Backspace |
| Letter on the home screen | Universal search |
| Hold a letter on home | Launch that app's hotkey |

Default hotkeys: `m` Messages · `o` Owl Messenger · `a` Contacts · `b` Owl Web ·
`c` Calendar · `p` Phone · `k` Calculator · `n` Memo · `t` Flashlight · `g` Tasks ·
`s` Settings · `f` Files · `x` Games · `w` Music · `i` Pictures · `h` Camera ·
`d` Clock · `l` Passwords · `e` Email · `v` Videos · `r` Voice Notes · `u` Themes ·
`z` Compass. They can be re-mapped in **Settings → Hotkeys**.

Hold **Menu** for 0.6 s to open the recents switcher. Short press opens the app
menu (or the drawer on the home screen).

---

## Privacy

- Nothing is uploaded. There is no account, no telemetry and no server-side
  storage.
- Media apps only ever read the files you pick. Audio/video/images are read with
  `FileReader`/object URLs inside the tab; the ID3 reader is bundled locally.
- The Password Keeper encrypts your vault with **PBKDF2-SHA-256 (210 000
  iterations)** and **AES-GCM 256** before it is written to IndexedDB. Only a
  salted hash of the master password is stored. Five wrong attempts trigger a
  10-second cool-down. Clipboard copies auto-clear after 30 seconds.
- Settings and small key/value data use `localStorage`; photos, voice notes,
  documents and scores use IndexedDB. **Settings → Storage** shows the quota
  used and clears it, and **Reset OS** wipes everything.
- The only outbound network requests are ones you trigger: Wikipedia /
  DuckDuckGo / Wikimedia Commons for Owl Search, `open.er-api.com` for currency
  rates, radio streams you add, and `/api/reader` (a same-origin proxy).
- `/api/reader` accepts `http(s)` only, blocks localhost / `.local` / `.internal`
  and private IPs **after DNS resolution**, enforces a 5 s timeout and a 2 MB
  cap, rate-limits at 20 requests/minute per IP, sends no cookies and returns
  `CSP: default-src 'none'`.

---

## Tech

- **Vite 5 + React 18 + TypeScript 5** (strict).
- **Zustand** for OS state, **idb-keyval** for IndexedDB.
- **vite-plugin-pwa** — installable, works offline after the first load.
- **Web Audio only** — oscillators and noise buffers, no samples.
- **`@mozilla/readability` + `linkedom`** for reader mode in the serverless
  function.
- Code-split per app with `React.lazy`, so the first paint stays small.

```
owl/
├── api/reader.ts          # serverless reader-mode proxy (SSRF-guarded)
├── public/                # owl.svg, generated PWA icons
├── scripts/               # make-icons.mjs, smoke.mjs
├── src/
│   ├── apps/<App>/        # one folder per app, default-exported component
│   ├── assets/            # wallpapers
│   ├── components/        # phone shell, keyboard, icons, fields
│   ├── hooks/             # collections, wallpaper, helpers
│   ├── os/                # kernel, store, focus, audio, i18n, security…
│   └── styles/global.css  # design system + phone chrome
├── index.html
├── vite.config.ts
└── vercel.json
```

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production build
npm run preview    # serve dist/ on :4173
npm run typecheck  # tsc --noEmit
npm run smoke      # headless boot test: opens every app in jsdom
npm run icons      # regenerate public/pwa-*.png from public/owl-icon-*.svg
```

The first visit runs a short **setup wizard** (name, language, theme, security).
You can re-run it any time from **Settings → About** or the Quick Help app.

### Deploy to Vercel

```bash
npm i -g vercel          # once
vercel login
vercel link              # or: vercel --yes
vercel --prod
```

Or drag-and-drop: **vercel.com → Add New → Project → Import Git Repository →
`aamrabdelhay/owl`**. The included `vercel.json` sets the build command, the
`dist` output and the SPA rewrite while leaving `/api/*` alone. `api/reader.ts`
is picked up automatically as a Node serverless function — no environment
variables are required.

---

## Repository

```bash
git clone https://github.com/aamrabdelhay/owl.git
cd owl
npm install
npm run dev
```

Licence: MIT for the code. The OWL name, owl-face logo and icon artwork are
original to this project — no third-party device brand, logo or trademark is
used anywhere. Product names mentioned for interoperability (Wikipedia,
DuckDuckGo, Wikimedia Commons, Vercel) belong to their respective owners.

See **[TESTING.md](TESTING.md)** for the manual QA checklist.
