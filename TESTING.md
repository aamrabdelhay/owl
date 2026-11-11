# OWL — QA checklist

Everything below is manual, device-agnostic and takes about 25 minutes. Run it
on a desktop browser **and** on a phone (or a narrow emulated viewport).

Automated checks first:

```bash
npm run typecheck   # zero TypeScript errors expected
npm run build       # production bundle + service worker
npm run smoke       # boots the real OS in jsdom and opens all 38 apps
```

`npm run smoke` prints `ok <app>` per app and exits non-zero if anything renders
nothing, hits the error boundary or logs a React warning.

---

## 1. First run

| # | Step | Expected |
| --- | --- | --- |
| 1.1 | Open the site with empty storage | Boot animation with the owl logo (~2.5 s), then the setup wizard |
| 1.2 | Pick a name, Arabic, a theme, and skip security | OS boots in Arabic, RTL layout, chosen theme applied |
| 1.3 | Reload the page | No wizard; name, language and theme persist |
| 1.4 | Check the phone body | Earpiece, sensor dot, 480×360 screen with glass reflection, Call/Menu/Back/End keys, 5-row QWERTY, trackpad |
| 1.5 | Resize to < 640 px | Phone fills the viewport, on-screen keyboard usable, nothing overflows |
| 1.6 | Move the mouse across the phone (desktop) | Slight parallax tilt (4–6° base) |

## 2. Keys and focus

| # | Step | Expected |
| --- | --- | --- |
| 2.1 | Type `hello` on the physical keyboard on the home screen | Universal search opens; the on-phone keys light up as you type |
| 2.2 | Press `Esc` | Search closes |
| 2.3 | Hold `m` on the home screen | Messages hotkey app launches |
| 2.4 | Press `F1` (or `Alt`) in an app | App menu opens; `Esc` closes it |
| 2.5 | Press `Enter` on a highlighted item | Item activates |
| 2.6 | Press `PgUp` / `PgDn` | Volume HUD appears and the level changes |
| 2.7 | Press `Ctrl+L`, `Cmd+R`, `F5`, `Ctrl+W` | The browser handles them normally (not intercepted) |
| 2.8 | Open Memo → new note, type with the physical keyboard | Text lands in the phone field, caret moves with ←/→ |
| 2.9 | Focus an input on mobile | No native keyboard pops up (`inputmode="none"`); the phone keyboard is used |
| 2.10 | Hold Menu for 0.6 s | Recents switcher; pick an app to focus it |

## 3. Lock and power

| # | Step | Expected |
| --- | --- | --- |
| 3.1 | Settings → Security → set password `owl12345` | Password stored as a hash only |
| 3.2 | Press `F3` (short) | Phone locks |
| 3.3 | Type a wrong password ×5 | Shake, error buzz, then a 10 s cool-down message |
| 3.4 | Enter the correct password | Unlocks with a chime |
| 3.5 | Hold `F3` | Power menu (lock, restart, power off) |
| 3.6 | Power off, then press power | Boot animation and lock screen |
| 3.7 | Check the lock screen keyboard flow | The lock field is the only password state; the display matches what you typed |

## 4. Home screen

| # | Step | Expected |
| --- | --- | --- |
| 4.1 | Look at the status bar | Battery %, signal, Wi-Fi, Bluetooth (if on), profile, unread counters |
| 4.2 | Verify the dock | 6 icons: Messages, Owl Messenger, Contacts, Owl Web, Media (Music), Calendar |
| 4.3 | Enter the selection box with arrows | Highlight moves; Enter opens the app |
| 4.4 | Open the Menu drawer | Tabs: All / Favorites / Media / Games / Downloads / Frequent — all filter |
| 4.5 | Long-press / right-click an icon | Context menu (open, add to favourites, hide, app info) |
| 4.6 | Add a Game from the drawer | Appears on home and in the Games folder |
| 4.7 | Change the wallpaper | Home and lock update immediately |

## 5. Apps — quick pass

For each app: open it, use its primary action, leave and re-open it (state must
survive) and press `Esc` once (goes back, never straight to a blank screen).

| App | Primary action to verify |
| --- | --- |
| Phone | Type a number, press Call → simulated call screen with timer; End returns; call log and speed dial work |
| Messages | Open the seeded "OWL Team" thread, send a >160-char SMS → segment counter; check Sent and Drafts |
| Owl Messenger | Pick a bot, send a message → scripted replies, typing indicator |
| Contacts | Add a contact, export vCard, re-import it, search by name |
| Email | Compose → `mailto:` hand-off with subject and body pre-filled |
| Owl Web | Search "owl", open Wikipedia result in reader mode; 5 tabs max; bookmark + history; images tab; the "open in new tab" button |
| Music | Pick an audio file → tags, cover art, visualiser, mini-player in the status bar |
| Videos | Pick a video → play, change speed, toggle subtitles, seek, leave and return (resume) |
| Pictures | Pick images → grid, zoom, slideshow, set as wallpaper |
| Voice Notes | Record 5 s → appears in the list, plays back, delete works (IndexedDB) |
| Ringtones | Tap each of the 12 tones → distinct synthesised sound; set as ringtone |
| Owl Radio | Add a stream URL, play/pause, volume, saved stations |
| Camera | Allow camera → preview, timer, grid overlay, capture saves to Pictures |
| Flashlight | Torch on/off (falls back to a white screen if unsupported), SOS blink |
| Compass | Allow motion → needle follows the device; demo mode sweeps without sensors |
| Calendar | Create an event with a reminder; month/week/day/agenda all show it |
| Clock | Add an alarm (test it), world clock, stopwatch with laps, countdown, bedside mode |
| Calculator | `12*8` → 96; scientific functions; history; division by zero shows an error, never `eval` |
| Converter | Length, temperature and currency (cached rates when offline) |
| Memo | Create, search, categorise, export `.txt` and `.json` |
| Tasks | Add a task, cycle status, filter over/overdue, push a task to the calendar |
| Password Keeper | Create a vault, add an entry, copy the password (clears in 30 s), lock/unlock, generator |
| File Manager | Grant a folder (or use the fallback picker), sort, preview, show info, App storage tab |
| Themes | Preview all 6 themes, cancel, then apply one |
| Profiles | Switch to Silent → ringer off and status icon changes; custom sliders persist |
| Settings | Walk the 16 sections; change language live (RTL), font scale, high contrast |
| Setup | Re-run the wizard from Settings → About; all steps work |
| Help | Shortcut legend renders and the links open |

## 6. Games

| # | Step | Expected |
| --- | --- | --- |
| 6.1 | Games hub | 9 tiles, blurbs, per-game best score, Scores tab listing entries |
| 6.2 | Owl Snake — start, steer with arrows, eat a mouse | A baby owlet is appended; score rises; golden mouse gives 5× and a boost bar |
| 6.3 | Owl Snake — hit your own tail | Game over overlay with score, replay works |
| 6.4 | Owl Snake — Maze mode | Level 1 "Meadow"; eating 6 mice advances the maze |
| 6.5 | Owl Snake — Daily | Same seeded maze for the whole day; label shows the date |
| 6.6 | Every game | Keyboard **and** on-screen/touch controls work; pause via Menu works; no stuck loops after exit |
| 6.7 | Sudoku | Reload mid-game → puzzle, notes and timer state restored |
| 6.8 | Solitaire | Reload mid-deal → same cards |
| 6.9 | Word Owl | Switch English ↔ عربي; Arabic letters are accepted |
| 6.10 | High score | Finish any game → entry appears in Games → Scores and survives a reload |

## 7. Persistence and privacy

| # | Step | Expected |
| --- | --- | --- |
| 7.1 | DevTools → Application → Local Storage / IndexedDB | `owl:settings:v1`, `col:*` and media keys; no cookies |
| 7.2 | Settings → Storage | Shows the bytes used and a progress bar |
| 7.3 | Reset OS (double confirm) | Wizard returns, data gone, no crash |
| 7.4 | Disconnect the network and reload | App still boots (service worker) |
| 7.5 | Add the app to a home screen | Installable, icon is the owl; launch is standalone |

## 8. Accessibility

| # | Step | Expected |
| --- | --- | --- |
| 8.1 | Tab through an app | Visible focus rings; every control reachable |
| 8.2 | Screen reader (VoiceOver/NVDA) | Status bar, icons, dialogs and fields announce names and states |
| 8.3 | OS "reduce motion" enabled | Transitions and the boot animation are suppressed or shortened |
| 8.4 | Enable high contrast + large text in Settings | Contrast and type scale both change |
| 8.5 | Zoom to 200 % | Phone scales, nothing is clipped or overlapping |

## 9. Reader API

```bash
curl -i  "http://localhost:5173/api/reader?url=https://example.com"        # 200 + JSON
curl -i  "http://localhost:5173/api/reader?url=http://127.0.0.1:8080"       # blocked (400)
curl -i  "http://localhost:5173/api/reader?url=file:///etc/passwd"         # blocked (400)
```

Responses must carry `X-Content-Type-Options: nosniff`, `CSP: default-src 'none'`
and a sensible `Cache-Control`. A burst of 21 requests in a minute returns 429.
