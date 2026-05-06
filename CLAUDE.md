# Fishing Battle

A browser-based fishing tycoon game. Start with a single boat, expand into a
fishing empire, fend off pirates and rival fishermen. Deployed via GitHub Pages
at https://megantoday.github.io/Fishing-battle/.

## Tech

- **Engine:** Phaser 3 (loaded from CDN, no build step).
- **Persistence:** `localStorage` (`fishingBattle.save.v1`).
- **Hosting:** GitHub Pages serving `index.html` from `main`.
- **Files:** `index.html` (shell), `style.css`, `game.js` (everything).

## Working agreements

### Git workflow
Commit to Git and push to GitHub regularly with clean, descriptive commit
messages so we never lose progress.

- Commit after each meaningful unit of work (a feature, a fix, a milestone).
- Subject under ~70 chars, explain the *why* in the body when needed.
- Push to `origin main` after each commit so the live site stays in sync.
- Never use `--no-verify`, `--force`, or `reset --hard` without explicit approval.
- Stage specific files by name; avoid `git add -A`.

### Deployment
Pushing to `main` updates https://megantoday.github.io/Fishing-battle/ within
~1 minute. There is no build step.

## Design (locked from prompt)

- **Day/night cycle:** 5 min day, 5 min night (real time). Closing the tab
  pauses; idle catch-up caps at 30 minutes (only earns income if you own a boat).
- **End of day:** modal report (catch breakdown, earnings, battle log) + choice:
  skip night → next day, or fish through night for ×2 fish + ×2 pirate attacks.
- **View:** top-down (slight tilt later for boat detail).
- **Art:** procedural shapes for v1; swap to Kenney sprite packs in v2.
- **Fishing:** manual click-to-cast / click-to-reel for small boats; later
  commercial boats become idle/automatic.
- **Combat:** when an enemy enters radius, prompt auto-resolve (stat-based,
  fast) vs manual (player controls fleet, dodges before pirate fires).
- **Failure:** no permanent game-over. Pirates can destroy harbors / sink ships
  but the player rebuilds. (v1: ship sinks → respawn at center, lose half of
  today's earnings.)
- **Progression:** fully open — anything you can afford, you can buy.
  Side quests guide pacing. End-game = rebirth for permanent point upgrades.
- **Rivals:** AI-only, visibly grow on the map, can be raided once you're
  strong enough.

## What's in v3 (current build)

- All of v2, plus **harbor defences**:
  - Harbor has its own HP bar (top-left), starting at 250.
  - From day 3 onward, pirates sail east toward the dock and damage the harbor on contact (×2 at night, like at sea).
  - A **dock cannon turret** sits at the end of the pier — hold **SPACE** in the harbor scene to auto-fire at the nearest pirate.
  - If harbor HP hits 0: lose half your gold and the harbor instantly rebuilds at full HP (the cost of being unprepared, not a game over).
  - New shop item: **Reinforce Harbor** ($200) — +100 max HP and refill, up to a 600 cap.
- HUD reorganized: money is the headline in the top-left, with day/phase/timer below it and the harbor HP bar under that. Rod / today's catch / hull HP moved to the top-right.
- Shop building moved into the top-right corner of the land area; player now spawns directly in front of its door so the **E** prompt is visible immediately.
- Day-3 alert flashes the controls when raids start.

## What's in v2

- **Start on land** at the harbor with a Hand Line rod; no boat yet.
- **Two scenes** that share state:
  - **Harbor:** walk on land + dock with WASD/arrows; click water from the
    dock edge to cast; press **E** near shop or boat to interact.
  - **Sea:** sail with WASD/arrows, SPACE to fire cannon, E inside the harbor
    zone to dock back.
- **Shop** in the harbor sells rod upgrades (Sturdy → Quality → Pro, with
  better cast range / bite speed / sell multiplier) and the **Skiff** boat
  ($500) that unlocks open-water fishing.
- **5-min days, 5-min nights** with end-of-day modal and skip-night vs
  fish-night choice.
- Pirates only spawn at sea (day 3+), double at night.
- Hull HP and cannons at sea; sinking respawns you with half today's earnings
  lost.
- Idle catch-up (30-min cap) — only earns money if you own a boat (your crew).
- localStorage save every 5s, persists which scene you were in.

## Roadmap (not yet built, ordered)

1. **Multiple boat tiers:** trawler, longliner, factory ship — each unlocks
   bigger fish and more idle income.
2. **Fleet & auto-fish:** commercial boats run idle fishing while you do
   something else; player commands from a captain's view.
3. **Combat squad ships:** dedicated escort ships, auto vs manual prompt on
   enemy approach, dodge-on-warning manual mode.
4. **Multiple zones / open ocean:** safe-coastal → open ocean; bigger payouts,
   constant raids.
5. **Harbor defenses & raids:** harbor HP, shore guns, pirates can attack the
   dock if you sail too far away.
6. **Rival fishermen** simulated on the world map with visible empires.
7. **Pirate hideout raids** (clear a region's base to reduce attacks).
8. **Captains & crew** with traits and leveling.
9. **Tech tree:** sonar, refrigeration, faster hulls, harpoon cannons, deck guns.
10. **Weather & seasons:** storms, fog, fish migrations.
11. **Random events:** kraken, market crash, chef-pays-5x, etc.
12. **Market dynamics:** flood-the-market price crashes, rare fish premiums.
13. **Side quests + rebirth:** quest list, prestige currency, permanent
    multipliers (e.g. +0.01% sell value per point).
14. **Real art:** swap procedural sprites for Kenney top-down boat assets.

## Things explicitly *not* in scope

- Faction reputation system (cut per design).
- Rarity tiers on fish (cut per design — sell-value variance only).
- Multiplayer / PvP (single-player only).
- Mobile/touch controls (desktop mouse + keyboard only).
