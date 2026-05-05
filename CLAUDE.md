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

- **Day/night cycle:** 10 min day, 10 min night (real time). Closing the tab
  pauses; idle catch-up caps at 30 minutes.
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

## What's in v1 (current build)

- Single fishing boat in coastal waters, top-down.
- WASD/arrows to move, click water to cast, click again to reel, SPACE to fire
  cannon.
- Random fish species with varied sell values (no rarity tier per design).
- Day/night phase timer with end-of-day modal and skip-night vs fish-night
  decision.
- Pirates start spawning on day 3 and intensify; double rate at night.
- Player ship has hull HP; sinking respawns and loses half of today's catch.
- Idle catch-up (30-min cap) when returning to the tab.
- localStorage save every 5s and on day end.

## Roadmap (not yet built, ordered)

1. **Harbor & shop:** dock to spend money on hull upgrades, faster engines,
   stronger cannons, and additional fishing boats.
2. **Fleet & auto-fish:** commercial boats run idle fishing; player commands
   from a captain's view.
3. **Combat squad ships:** dedicated escort ships, auto vs manual prompt on
   enemy approach, dodge-on-warning manual mode.
4. **Multiple zones / open ocean:** safe-coastal → open ocean; bigger payouts,
   constant raids.
5. **Rival fishermen** simulated on the world map with visible empires.
6. **Pirate hideout raids** (clear a region's base to reduce attacks).
7. **Captains & crew** with traits and leveling.
8. **Tech tree:** sonar, refrigeration, faster hulls, harpoon cannons, deck guns.
9. **Weather & seasons:** storms, fog, fish migrations.
10. **Random events:** kraken, market crash, chef-pays-5x, etc.
11. **Market dynamics:** flood-the-market price crashes, rare fish premiums.
12. **Side quests + rebirth:** quest list, prestige currency, permanent
    multipliers (e.g. +0.01% sell value per point).
13. **Real art:** swap procedural sprites for Kenney top-down boat assets.

## Things explicitly *not* in scope

- Faction reputation system (cut per design).
- Rarity tiers on fish (cut per design — sell-value variance only).
- Multiplayer / PvP (single-player only).
- Mobile/touch controls (desktop mouse + keyboard only).
