// Fishing Battle — game.js
// v2: start on land at the harbor with a fishing rod. Walk to the dock to fish.
// Walk to the shop to buy rod upgrades or a boat. Set sail to fish open water
// and fight pirates. Dock back to spend money.

// === Tunables =============================================================
const GAME_W = 1280;
const GAME_H = 720;
const DAY_SECONDS = 300;
const NIGHT_SECONDS = 300;
const IDLE_CAP_SECONDS = 30 * 60;
const SAVE_KEY = "fishingBattle.save.v2";

const FISH = [
  { id: "sardine",   name: "Sardine",   value: 5,   weight: 50 },
  { id: "mackerel",  name: "Mackerel",  value: 14,  weight: 28 },
  { id: "snapper",   name: "Snapper",   value: 32,  weight: 12 },
  { id: "tuna",      name: "Tuna",      value: 80,  weight: 7  },
  { id: "swordfish", name: "Swordfish", value: 200, weight: 2.5 },
  { id: "marlin",    name: "Marlin",    value: 500, weight: 0.5 },
];

const ROD_TIERS = [
  null,
  { tier: 1, name: "Hand Line",   castDist: 200, biteMs: [1800, 5500], mult: 1.0  },
  { tier: 2, name: "Sturdy Rod",  castDist: 280, biteMs: [1300, 4200], mult: 1.15 },
  { tier: 3, name: "Quality Rod", castDist: 360, biteMs: [900,  3000], mult: 1.4  },
  { tier: 4, name: "Pro Rod",     castDist: 460, biteMs: [700,  2200], mult: 1.8  },
];

const SHOP_ITEMS = [
  { id: "rod2", name: "Sturdy Rod",   cost: 80,
    desc: "Cast farther, fish bite quicker.",
    available: () => G.rodTier === 1, apply: () => { G.rodTier = 2; } },
  { id: "rod3", name: "Quality Rod",  cost: 350,
    desc: "Even better — and better fish.",
    available: () => G.rodTier === 2, apply: () => { G.rodTier = 3; } },
  { id: "rod4", name: "Pro Rod",      cost: 1200,
    desc: "Top-tier rod.",
    available: () => G.rodTier === 3, apply: () => { G.rodTier = 4; } },
  { id: "boat", name: "Skiff (Small Boat)", cost: 500,
    desc: "Sail open water for bigger catches and pirate fights. Walk to it on the dock and press E to set sail.",
    available: () => !G.hasBoat, apply: () => { G.hasBoat = true; } },
];

// === Save state ===========================================================
let G = null;

function newSave() {
  return {
    money: 0,
    day: 1,
    phase: "day",
    phaseTimeLeft: DAY_SECONDS,
    todayLog: { fishCaught: [], moneyEarned: 0, shipsLost: 0, piratesSunk: 0 },
    history: [],
    lastSaveTs: Date.now(),
    mode: "harbor",
    rodTier: 1,
    hasBoat: false,
    shipHp: 100,
  };
}

function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function writeSave(s) {
  s.lastSaveTs = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}

function rollFish() {
  const total = FISH.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of FISH) { r -= f.weight; if (r <= 0) return f; }
  return FISH[0];
}

function applyIdleCatchup() {
  if (!G.lastSaveTs) return;
  const elapsed = Math.min(IDLE_CAP_SECONDS, (Date.now() - G.lastSaveTs) / 1000);
  if (elapsed < 5) return;
  // Only earn passive income with a boat (representing crew working in your absence).
  if (G.hasBoat) {
    const passiveMoney = Math.floor(elapsed / 25) * 8;
    if (passiveMoney > 0) {
      G.money += passiveMoney;
      G.todayLog.moneyEarned += passiveMoney;
      G._idleNote = `Crew earned $${passiveMoney} while you were away.`;
    }
  }
  G.phaseTimeLeft = Math.max(0, G.phaseTimeLeft - elapsed);
}

// === Texture generation (called once at boot) =============================
function makeAllTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Person on land — 16x28
  if (!scene.textures.exists("person")) {
    g.fillStyle(0x3a5a7a, 1); g.fillRoundedRect(2, 10, 12, 14, 3);
    g.fillStyle(0xffd5b4, 1); g.fillCircle(8, 6, 5);
    g.fillStyle(0x4a3528, 1); g.fillEllipse(8, 4, 10, 4);
    g.fillStyle(0x2a3045, 1); g.fillRect(3, 24, 4, 4); g.fillRect(9, 24, 4, 4);
    g.fillStyle(0xffd5b4, 1); g.fillRect(0, 14, 3, 4); g.fillRect(13, 14, 3, 4);
    g.lineStyle(1, 0x000000, 0.6); g.strokeRoundedRect(2, 10, 12, 14, 3);
    g.generateTexture("person", 16, 28);
    g.clear();
  }

  // Shop building — 200x200
  if (!scene.textures.exists("shop")) {
    g.fillStyle(0x6a2a1a, 1); g.fillTriangle(0, 80, 100, 10, 200, 80);
    g.fillStyle(0x8a3a26, 1); g.fillTriangle(10, 78, 100, 18, 190, 78);
    g.fillStyle(0x88542a, 1); g.fillRect(20, 80, 160, 110);
    g.fillStyle(0xb47744, 1); g.fillRect(28, 88, 144, 96);
    g.fillStyle(0x9bd8e7, 1); g.fillRect(40, 110, 24, 20); g.fillRect(136, 110, 24, 20);
    g.lineStyle(1.5, 0x4a2810, 1); g.strokeRect(40, 110, 24, 20); g.strokeRect(136, 110, 24, 20);
    g.fillStyle(0x4a2810, 1); g.fillRoundedRect(80, 130, 40, 60, 4);
    g.fillStyle(0xffd84a, 1); g.fillCircle(112, 162, 2);
    g.fillStyle(0xfff5d4, 1); g.fillRoundedRect(60, 60, 80, 20, 4);
    g.lineStyle(1, 0x4a2810, 1); g.strokeRoundedRect(60, 60, 80, 20, 4);
    g.generateTexture("shop", 200, 200);
    g.clear();
  }

  // Fisher boat — 80x48, bow points right
  if (!scene.textures.exists("fisher_boat")) {
    g.fillStyle(0x6b3f1f, 1);
    g.beginPath();
    g.moveTo(8, 14); g.lineTo(8, 34); g.lineTo(50, 34);
    g.lineTo(72, 24); g.lineTo(50, 14); g.closePath(); g.fillPath();
    g.fillStyle(0xa07042, 1);
    g.beginPath();
    g.moveTo(14, 18); g.lineTo(14, 30); g.lineTo(48, 30);
    g.lineTo(64, 24); g.lineTo(48, 18); g.closePath(); g.fillPath();
    g.fillStyle(0xeeeeee, 1); g.fillRoundedRect(20, 18, 18, 12, 2);
    g.fillStyle(0x223344, 1); g.fillRect(23, 20, 12, 4);
    g.lineStyle(1.5, 0x3a1f0a, 1);
    g.beginPath();
    g.moveTo(8, 14); g.lineTo(8, 34); g.lineTo(50, 34);
    g.lineTo(72, 24); g.lineTo(50, 14); g.closePath(); g.strokePath();
    g.generateTexture("fisher_boat", 80, 48);
    g.clear();
  }

  // Pirate sloop — 80x48
  if (!scene.textures.exists("pirate_boat")) {
    g.fillStyle(0x2b1810, 1);
    g.beginPath();
    g.moveTo(8, 12); g.lineTo(8, 36); g.lineTo(48, 36);
    g.lineTo(74, 24); g.lineTo(48, 12); g.closePath(); g.fillPath();
    g.fillStyle(0x553322, 1);
    g.beginPath();
    g.moveTo(14, 16); g.lineTo(14, 32); g.lineTo(46, 32);
    g.lineTo(66, 24); g.lineTo(46, 16); g.closePath(); g.fillPath();
    g.fillStyle(0x111111, 1); g.fillCircle(32, 24, 3);
    g.fillStyle(0x222222, 1);
    g.fillTriangle(32, 24, 32, 6, 18, 22);
    g.fillTriangle(32, 24, 32, 6, 46, 22);
    g.fillStyle(0xffffff, 0.85); g.fillCircle(54, 24, 2.5);
    g.lineStyle(1.5, 0x000000, 1);
    g.beginPath();
    g.moveTo(8, 12); g.lineTo(8, 36); g.lineTo(48, 36);
    g.lineTo(74, 24); g.lineTo(48, 12); g.closePath(); g.strokePath();
    g.generateTexture("pirate_boat", 80, 48);
  }

  g.destroy();
}

// === BootScene ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  create() {
    try { localStorage.removeItem("fishingBattle.save.v1"); } catch {}
    G = loadSave() ?? newSave();
    applyIdleCatchup();
    makeAllTextures(this);
    this.scene.launch("UI");
    const goSea = G.mode === "sea" && G.hasBoat;
    this.scene.start(goSea ? "Sea" : "Harbor");
  }
}

// === UIScene: HUD, day cycle, end-of-day modal, shop modal ================
class UIScene extends Phaser.Scene {
  constructor() { super("UI"); }

  create() {
    this.modalOpen = false;
    this.buildHud();
    this.time.addEvent({ delay: 5000, loop: true, callback: () => writeSave(G) });
    this.game.events.on("openShop", () => this.openShop());
    if (G._idleNote) {
      this.flashTitle(G._idleNote, 5000);
      G._idleNote = null;
    }
  }

  buildHud() {
    const base = { fontFamily: "monospace", fontSize: "18px", color: "#e8f0fa" };
    this.hud = {};
    this.hud.day = this.add.text(16, 12, "", base).setScrollFactor(0).setDepth(100);
    this.hud.phase = this.add.text(16, 36, "", base).setScrollFactor(0).setDepth(100);
    this.hud.timer = this.add.text(16, 60, "", base).setScrollFactor(0).setDepth(100);
    this.hud.money = this.add.text(GAME_W - 16, 12, "", { ...base, fontSize: "22px", color: "#ffe27a" })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.rod = this.add.text(GAME_W - 16, 42, "", base).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.fishToday = this.add.text(GAME_W - 16, 66, "", base).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.hp = this.add.text(GAME_W - 16, 90, "", { ...base, color: "#ff8a8a" })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.skipBtn = this.add.text(GAME_W / 2, GAME_H - 24, "[ dev: skip phase ]", { ...base, color: "#88a" })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    this.hud.skipBtn.on("pointerdown", (p, lx, ly, e) => {
      e?.stopPropagation?.();
      G.phaseTimeLeft = 1;
    });
    this.titleToast = null;
  }

  refreshHud() {
    this.hud.day.setText(`Day ${G.day}`);
    this.hud.phase.setText(G.phase === "day" ? "Daytime" : "Nightfall");
    const m = Math.floor(G.phaseTimeLeft / 60);
    const s = Math.floor(G.phaseTimeLeft % 60).toString().padStart(2, "0");
    this.hud.timer.setText(`${m}:${s} remaining`);
    this.hud.money.setText(`$${G.money.toLocaleString()}`);
    this.hud.rod.setText(`Rod: ${ROD_TIERS[G.rodTier].name}`);
    this.hud.fishToday.setText(`Today: ${G.todayLog.fishCaught.length} fish`);
    if (G.mode === "sea") {
      this.hud.hp.setText(`Hull: ${Math.max(0, G.shipHp | 0)}/100`).setVisible(true);
    } else {
      this.hud.hp.setVisible(false);
    }
  }

  flashTitle(text, ms = 2500) {
    if (this.titleToast) this.titleToast.destroy();
    this.titleToast = this.add.text(GAME_W / 2, 96, text, {
      fontFamily: "monospace", fontSize: "16px",
      color: "#0a1628", backgroundColor: "#ffe27a", padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.time.delayedCall(ms, () => { if (this.titleToast) { this.titleToast.destroy(); this.titleToast = null; } });
  }

  pauseWorld() {
    ["Harbor", "Sea"].forEach(k => {
      if (this.scene.isActive(k)) this.scene.pause(k);
    });
  }
  resumeWorld() {
    ["Harbor", "Sea"].forEach(k => {
      if (this.scene.isPaused(k)) this.scene.resume(k);
    });
  }

  update(time, dtMs) {
    if (this.modalOpen) { this.refreshHud(); return; }
    G.phaseTimeLeft -= dtMs / 1000;
    if (G.phaseTimeLeft <= 0) {
      G.phaseTimeLeft = 0;
      this.advancePhase();
    }
    this.refreshHud();
  }

  advancePhase() {
    if (G.phase === "day") this.showEndOfDayReport();
    else this.startNewDay();
  }

  showEndOfDayReport() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    this.pauseWorld();

    const log = G.todayLog;
    const counts = {};
    for (const id of log.fishCaught) counts[id] = (counts[id] || 0) + 1;
    const fishLines = Object.keys(counts).length
      ? Object.keys(counts).map(id => {
          const f = FISH.find(x => x.id === id);
          return `  ${f.name.padEnd(11)} ×${String(counts[id]).padStart(3)}   $${(counts[id] * f.value).toLocaleString()}`;
        }).join("\n")
      : "  (no fish caught today)";

    const text = [
      `DAY ${G.day} REPORT`, ``,
      `Catch:`, fishLines, ``,
      `Earnings today: $${log.moneyEarned.toLocaleString()}`,
      `Battles:        ${log.piratesSunk} pirate sunk • ${log.shipsLost} ship lost`,
      ``,
      `Cash on hand:   $${G.money.toLocaleString()}`,
    ].join("\n");

    const refs = [];
    refs.push(this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0x000000, 0.6).setDepth(200));
    refs.push(this.add.rectangle(GAME_W/2, GAME_H/2, 580, 460, 0x101820, 1).setStrokeStyle(2, 0xffe27a).setDepth(201));
    refs.push(this.add.text(GAME_W/2, GAME_H/2 - 200, text, {
      fontFamily: "monospace", fontSize: "16px", color: "#e8f0fa", align: "left",
    }).setOrigin(0.5, 0).setDepth(202));

    const mkBtn = (x, label, color) =>
      this.add.text(x, GAME_H/2 + 180, label, {
        fontFamily: "monospace", fontSize: "16px",
        color: "#0a1628", backgroundColor: color, padding: { x: 14, y: 10 },
      }).setOrigin(0.5).setDepth(202).setInteractive({ useHandCursor: true });

    const skipBtn = mkBtn(GAME_W/2 - 130, `Skip night → Day ${G.day + 1}`, "#ffe27a");
    const fishBtn = mkBtn(GAME_W/2 + 130, `Fish through night (×2/×2)`, "#9be7a3");
    refs.push(skipBtn, fishBtn);

    const close = (cb) => {
      refs.forEach(r => r.destroy());
      this.modalOpen = false;
      this.resumeWorld();
      cb();
    };
    skipBtn.on("pointerdown", () => close(() => this.startNewDay()));
    fishBtn.on("pointerdown", () => close(() => this.startNight()));
  }

  startNewDay() {
    G.history.push({ day: G.day, ...G.todayLog });
    if (G.history.length > 30) G.history.shift();
    G.day += 1;
    G.phase = "day";
    G.phaseTimeLeft = DAY_SECONDS;
    G.todayLog = { fishCaught: [], moneyEarned: 0, shipsLost: 0, piratesSunk: 0 };
    writeSave(G);
    this.game.events.emit("phaseChanged");
    const sea = this.scene.get("Sea");
    if (sea?.pirates) sea.pirates.clear(true, true);
    if (sea?.player) sea.player.hp = Math.min(sea.player.maxHp, sea.player.hp + 40);
    this.flashTitle(`Day ${G.day} begins.`, 2500);
  }

  startNight() {
    G.phase = "night";
    G.phaseTimeLeft = NIGHT_SECONDS;
    writeSave(G);
    this.game.events.emit("phaseChanged");
    this.flashTitle("Night fishing: ×2 fish, ×2 pirates.", 3000);
  }

  // --- Shop modal ---
  openShop() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    this.pauseWorld();

    const refs = [];
    refs.push(this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0x000000, 0.6).setDepth(200));
    refs.push(this.add.rectangle(GAME_W/2, GAME_H/2, 720, 540, 0x101820, 1).setStrokeStyle(2, 0xffe27a).setDepth(201));
    refs.push(this.add.text(GAME_W/2, GAME_H/2 - 240, "HARBOR SHOP", {
      fontFamily: "monospace", fontSize: "22px", color: "#ffe27a",
    }).setOrigin(0.5, 0).setDepth(202));
    const cashText = this.add.text(GAME_W/2, GAME_H/2 - 210, "", {
      fontFamily: "monospace", fontSize: "14px", color: "#bbb",
    }).setOrigin(0.5, 0).setDepth(202);
    refs.push(cashText);

    const itemRefs = [];
    const renderItems = () => {
      itemRefs.forEach(r => r.destroy());
      itemRefs.length = 0;
      const available = SHOP_ITEMS.filter(i => i.available());
      if (available.length === 0) {
        itemRefs.push(this.add.text(GAME_W/2, GAME_H/2 - 120, "(no more items available — more in v3)", {
          fontFamily: "monospace", fontSize: "14px", color: "#888",
        }).setOrigin(0.5, 0).setDepth(202));
        return;
      }
      let cy = GAME_H/2 - 160;
      for (const item of available) {
        const canAfford = G.money >= item.cost;
        const nameC = canAfford ? "#ffe27a" : "#888";
        const buyBg = canAfford ? "#ffe27a" : "#444";
        const buyFg = canAfford ? "#0a1628" : "#888";

        itemRefs.push(this.add.text(GAME_W/2 - 320, cy, item.name, {
          fontFamily: "monospace", fontSize: "18px", color: nameC,
        }).setOrigin(0, 0).setDepth(202));
        itemRefs.push(this.add.text(GAME_W/2 - 320, cy + 24, item.desc, {
          fontFamily: "monospace", fontSize: "13px", color: "#bbb",
          wordWrap: { width: 460 },
        }).setOrigin(0, 0).setDepth(202));
        itemRefs.push(this.add.text(GAME_W/2 + 200, cy + 6, `$${item.cost.toLocaleString()}`, {
          fontFamily: "monospace", fontSize: "16px", color: nameC,
        }).setOrigin(1, 0).setDepth(202));

        const buyBtn = this.add.text(GAME_W/2 + 290, cy + 6, "Buy", {
          fontFamily: "monospace", fontSize: "16px",
          color: buyFg, backgroundColor: buyBg, padding: { x: 14, y: 6 },
        }).setOrigin(1, 0).setDepth(202);
        itemRefs.push(buyBtn);

        if (canAfford) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on("pointerdown", () => {
            G.money -= item.cost;
            item.apply();
            writeSave(G);
            this.game.events.emit("inventoryChanged");
            cashText.setText(`Cash: $${G.money.toLocaleString()}`);
            renderItems();
          });
        }
        cy += 96;
      }
    };
    cashText.setText(`Cash: $${G.money.toLocaleString()}`);
    renderItems();

    const closeBtn = this.add.text(GAME_W/2, GAME_H/2 + 230, "Close", {
      fontFamily: "monospace", fontSize: "16px",
      color: "#0a1628", backgroundColor: "#9be7a3", padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setDepth(202).setInteractive({ useHandCursor: true });
    refs.push(closeBtn);
    closeBtn.on("pointerdown", () => {
      refs.forEach(r => r.destroy());
      itemRefs.forEach(r => r.destroy());
      this.modalOpen = false;
      this.resumeWorld();
    });
  }
}

// === Shared fishing helpers ===============================================
function newCast(scene, x, y, fishMul) {
  const lineGfx = scene.add.graphics().setDepth(2);
  const bobber = scene.add.circle(x, y, 4, 0xff5555).setDepth(3);
  const rod = ROD_TIERS[G.rodTier];
  const [lo, hi] = rod.biteMs;
  const wait = (lo + Math.random() * (hi - lo)) / fishMul;
  return {
    x, y, lineGfx, bobber,
    readyAt: scene.time.now + wait,
    hooked: false, missDeadline: 0, species: null, indicator: null,
  };
}

function tickCast(scene, c, ownerX, ownerY) {
  c.lineGfx.clear();
  c.lineGfx.lineStyle(1.5, 0xfafafa, 0.85);
  c.lineGfx.lineBetween(ownerX, ownerY, c.x, c.y);

  if (!c.hooked && scene.time.now >= c.readyAt) {
    c.hooked = true;
    c.species = rollFish();
    scene.tweens.add({ targets: c.bobber, y: c.y - 6, yoyo: true, repeat: 4, duration: 90 });
    c.indicator = scene.add.text(c.x, c.y - 22, "!", {
      fontFamily: "monospace", fontSize: "24px", color: "#ffd84a",
    }).setOrigin(0.5).setDepth(4);
    c.missDeadline = scene.time.now + 1800;
  }
  if (c.hooked && scene.time.now > c.missDeadline) {
    flashFloat(scene, c.x, c.y - 30, "got away", "#ccc");
    c.lineGfx.destroy(); c.bobber.destroy(); c.indicator.destroy();
    return null;
  }
  return c;
}

function reelCast(scene, c, ownerX, ownerY, seaBonus) {
  c.lineGfx.destroy(); c.bobber.destroy();
  if (c.indicator) c.indicator.destroy();
  if (c.hooked && c.species) {
    const rod = ROD_TIERS[G.rodTier];
    const value = Math.round(c.species.value * rod.mult * (seaBonus ? 1.25 : 1));
    G.money += value;
    G.todayLog.fishCaught.push(c.species.id);
    G.todayLog.moneyEarned += value;
    flashFloat(scene, ownerX, ownerY - 30, `+$${value} ${c.species.name}`, "#ffe27a");
  } else {
    flashFloat(scene, ownerX, ownerY - 30, "reeled in empty", "#bbb");
  }
}

function flashFloat(scene, x, y, str, color) {
  const t = scene.add.text(x, y, str, { fontFamily: "monospace", fontSize: "14px", color }).setOrigin(0.5).setDepth(50);
  scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
}

// === HarborScene ==========================================================
class HarborScene extends Phaser.Scene {
  constructor() { super("Harbor"); }

  create() {
    this.bg = this.add.graphics().setDepth(-2);
    this.drawWorld();

    const start = G.lastHarborPos ?? { x: 1000, y: 500 };
    this.player = this.add.sprite(start.x, start.y, "person").setDepth(5);

    this.shopRect = { x: 900, y: 220, w: 200, h: 200 };
    this.shopBuilding = this.add.image(this.shopRect.x + this.shopRect.w/2, this.shopRect.y + this.shopRect.h/2, "shop").setDepth(4);
    this.add.text(this.shopRect.x + this.shopRect.w/2, this.shopRect.y + 70, "SHOP", {
      fontFamily: "monospace", fontSize: "13px", fontStyle: "bold", color: "#4a2810",
    }).setOrigin(0.5).setDepth(5);

    this.dockedBoat = null;
    if (G.hasBoat) this.spawnDockedBoat();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,E");
    this.input.on("pointerdown", (p) => this.handleClick(p));
    this.keys.E.on("down", () => this.handleInteract());

    this.castLine = null;

    this.prompt = this.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: "14px",
      color: "#0a1628", backgroundColor: "#ffe27a", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._phaseChanged = () => this.drawWorld();
    this._inventoryChanged = () => { if (G.hasBoat && !this.dockedBoat) this.spawnDockedBoat(); };
    this.game.events.on("phaseChanged", this._phaseChanged);
    this.game.events.on("inventoryChanged", this._inventoryChanged);
    this.events.on("shutdown", () => {
      this.game.events.off("phaseChanged", this._phaseChanged);
      this.game.events.off("inventoryChanged", this._inventoryChanged);
    });

    if (G.day === 1 && G.todayLog.fishCaught.length === 0 && G.money < 30) {
      this.scene.get("UI").flashTitle(
        "Welcome, captain. Walk to the dock (WASD) and click the water to cast.", 6000
      );
    }
  }

  drawWorld() {
    this.bg.clear();
    const isNight = G.phase === "night";

    // Sea (left)
    const seaTop = isNight ? 0x041422 : 0x0d6a8e;
    const seaBot = isNight ? 0x021018 : 0x074c63;
    this.bg.fillGradientStyle(seaTop, seaTop, seaBot, seaBot, 1);
    this.bg.fillRect(0, 0, 760, GAME_H);
    this.bg.lineStyle(1, isNight ? 0x0a3850 : 0x18a0c0, 0.3);
    for (let y = 30; y < GAME_H; y += 50) {
      for (let x = 30; x < 760; x += 100) {
        const ox = (x + ((y / 50) % 2) * 50) % 760;
        this.bg.beginPath();
        this.bg.arc(ox, y, 18, 0, Math.PI, false);
        this.bg.strokePath();
      }
    }

    // Land (right)
    const landTop = isNight ? 0x1a2a18 : 0x4a7a3a;
    const landBot = isNight ? 0x10180e : 0x386028;
    this.bg.fillGradientStyle(landTop, landTop, landBot, landBot, 1);
    this.bg.fillRect(760, 0, GAME_W - 760, GAME_H);
    this.bg.fillStyle(isNight ? 0x101810 : 0x2c5020, 1);
    if (!this._grassDots) {
      this._grassDots = Array.from({ length: 80 }, () => ({
        x: 770 + Math.random() * (GAME_W - 780),
        y: 10 + Math.random() * (GAME_H - 20),
      }));
    }
    for (const d of this._grassDots) this.bg.fillCircle(d.x, d.y, 1.5);

    // Dock
    this.bg.fillStyle(0x8a5a2e, 1); this.bg.fillRect(460, 340, 300, 60);
    this.bg.fillStyle(0x6e451f, 1);
    for (let x = 470; x < 760; x += 24) this.bg.fillRect(x, 340, 2, 60);
    this.bg.fillStyle(0x4a2810, 1);
    [462, 556, 652, 750].forEach(x => {
      this.bg.fillCircle(x, 344, 4); this.bg.fillCircle(x, 396, 4);
    });

    if (isNight) {
      if (!this._stars) {
        this._stars = Array.from({ length: 60 }, () => ({
          x: Math.random() * 760, y: Math.random() * GAME_H * 0.5, r: Math.random() * 1.2 + 0.4,
        }));
      }
      this.bg.fillStyle(0xffffff, 0.85);
      for (const s of this._stars) this.bg.fillCircle(s.x, s.y, s.r);
    }
  }

  isWalkable(x, y) {
    if (x >= 760 && x <= GAME_W - 8 && y >= 8 && y <= GAME_H - 8) return true;
    if (x >= 460 && x <= 760 && y >= 340 && y <= 400) return true;
    return false;
  }

  isWaterAt(x, y) {
    if (x >= 760) return false;
    if (x >= 460 && x <= 760 && y >= 340 && y <= 400) return false;
    return true;
  }

  spawnDockedBoat() {
    this.dockedBoat = this.add.image(420, 370, "fisher_boat").setDepth(3);
  }

  handleClick(pointer) {
    const ui = this.scene.get("UI");
    if (ui.modalOpen) return;
    if (pointer.y > GAME_H - 50) return; // bottom HUD strip (dev skip button)
    if (this.castLine) {
      reelCast(this, this.castLine, this.player.x, this.player.y, false);
      this.castLine = null;
      return;
    }
    const dx = pointer.worldX - this.player.x;
    const dy = pointer.worldY - this.player.y;
    const dist = Math.hypot(dx, dy);
    const rod = ROD_TIERS[G.rodTier];
    if (dist > rod.castDist) { ui.flashTitle("Too far for this rod.", 1400); return; }
    if (!this.isWaterAt(pointer.worldX, pointer.worldY)) { ui.flashTitle("Aim for the water.", 1400); return; }
    if (dist < 30) { ui.flashTitle("Step back from the water before casting.", 1400); return; }
    const fishMul = G.phase === "night" ? 2 : 1;
    this.castLine = newCast(this, pointer.worldX, pointer.worldY, fishMul);
  }

  isNearShop() {
    const r = this.shopRect;
    return this.player.x > r.x - 30 && this.player.x < r.x + r.w + 30 &&
           this.player.y > r.y + r.h - 60 && this.player.y < r.y + r.h + 60;
  }
  isNearBoat() {
    if (!this.dockedBoat) return false;
    return Math.hypot(this.player.x - this.dockedBoat.x, this.player.y - this.dockedBoat.y) < 70;
  }

  handleInteract() {
    const ui = this.scene.get("UI");
    if (ui.modalOpen) return;
    if (this.isNearShop()) { this.game.events.emit("openShop"); return; }
    if (this.isNearBoat())  { this.setSail(); return; }
  }

  setSail() {
    G.mode = "sea";
    G.lastHarborPos = { x: this.player.x, y: this.player.y };
    writeSave(G);
    this.scene.start("Sea");
  }

  update(time, dtMs) {
    const ui = this.scene.get("UI");
    if (ui.modalOpen) return;
    const dt = dtMs / 1000;
    const speed = 180;
    let vx = 0, vy = 0;
    const left  = this.cursors.left.isDown  || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up    = this.cursors.up.isDown    || this.keys.W.isDown;
    const down  = this.cursors.down.isDown  || this.keys.S.isDown;
    if (left)  vx -= speed;
    if (right) vx += speed;
    if (up)    vy -= speed;
    if (down)  vy += speed;
    if (vx || vy) {
      const nx = this.player.x + vx * dt;
      const ny = this.player.y + vy * dt;
      if (this.isWalkable(nx, this.player.y)) this.player.x = nx;
      if (this.isWalkable(this.player.x, ny)) this.player.y = ny;
    }

    if (this.castLine) {
      this.castLine = tickCast(this, this.castLine, this.player.x, this.player.y);
    }

    if (this.isNearShop()) {
      this.prompt.setPosition(this.shopRect.x + this.shopRect.w/2, this.shopRect.y + this.shopRect.h + 8);
      this.prompt.setText("Press E — Shop").setVisible(true);
    } else if (this.isNearBoat()) {
      this.prompt.setPosition(this.dockedBoat.x, this.dockedBoat.y - 36);
      this.prompt.setText("Press E — Set Sail").setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
  }
}

// === SeaScene =============================================================
class SeaScene extends Phaser.Scene {
  constructor() { super("Sea"); }

  create() {
    this.bg = this.add.graphics().setDepth(-2);
    this.stars = this.add.graphics().setDepth(-1);

    this.player = this.physics.add.sprite(GAME_W/2, GAME_H/2, "fisher_boat");
    this.player.setCollideWorldBounds(true);
    this.player.hp = G.shipHp ?? 100;
    this.player.maxHp = 100;
    this.player.invulnUntil = 0;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,E");
    this.input.on("pointerdown", (p) => this.handleClick(p));
    this.keys.E.on("down", () => this.tryDock());

    this.castLine = null;

    this.pirates = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.physics.add.overlap(this.player, this.pirates, this.onPirateContact, null, this);
    this.physics.add.overlap(this.bullets, this.pirates, this.onBulletHit, null, this);
    this.pirateSpawnAccum = 0;
    this.lastFireAt = 0;

    this.dockZone = { x: GAME_W - 80, y: GAME_H - 80, r: 60 };
    this.dockMark = this.add.rectangle(this.dockZone.x, this.dockZone.y, 110, 110, 0x8a5a2e, 0.45)
      .setStrokeStyle(2, 0xffe27a).setDepth(0);
    this.add.text(this.dockZone.x, this.dockZone.y - 70, "Harbor", {
      fontFamily: "monospace", fontSize: "13px", color: "#ffe27a",
    }).setOrigin(0.5).setDepth(0);
    this.dockPrompt = this.add.text(this.dockZone.x, this.dockZone.y - 90, "", {
      fontFamily: "monospace", fontSize: "13px",
      color: "#0a1628", backgroundColor: "#ffe27a", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this.drawSea(); this.drawStars();
    this._phaseChanged = () => { this.drawSea(); this.drawStars(); };
    this.game.events.on("phaseChanged", this._phaseChanged);
    this.events.on("shutdown", () => this.game.events.off("phaseChanged", this._phaseChanged));

    this.scene.get("UI").flashTitle(
      "Open water. WASD/arrows to sail • SPACE to fire cannon • E inside the harbor zone to dock.", 5000
    );
  }

  drawSea() {
    this.bg.clear();
    const isNight = G.phase === "night";
    const top = isNight ? 0x041422 : 0x0d6a8e;
    const bot = isNight ? 0x021018 : 0x074c63;
    this.bg.fillGradientStyle(top, top, bot, bot, 1);
    this.bg.fillRect(0, 0, GAME_W, GAME_H);
    this.bg.lineStyle(1, isNight ? 0x0a3850 : 0x18a0c0, 0.3);
    for (let y = 30; y < GAME_H; y += 50) {
      for (let x = 30; x < GAME_W; x += 100) {
        const ox = (x + ((y / 50) % 2) * 50) % GAME_W;
        this.bg.beginPath();
        this.bg.arc(ox, y, 18, 0, Math.PI, false);
        this.bg.strokePath();
      }
    }
  }

  drawStars() {
    this.stars.clear();
    if (G.phase !== "night") return;
    if (!this._starPos) {
      this._starPos = Array.from({ length: 80 }, () => ({
        x: Math.random() * GAME_W, y: Math.random() * GAME_H * 0.45, r: Math.random() * 1.2 + 0.4,
      }));
    }
    this.stars.fillStyle(0xffffff, 0.85);
    for (const s of this._starPos) this.stars.fillCircle(s.x, s.y, s.r);
  }

  handleClick(pointer) {
    const ui = this.scene.get("UI");
    if (ui.modalOpen) return;
    if (pointer.y > GAME_H - 50) return;
    if (this.castLine) {
      reelCast(this, this.castLine, this.player.x, this.player.y, true);
      this.castLine = null;
      return;
    }
    const dist = Math.hypot(pointer.worldX - this.player.x, pointer.worldY - this.player.y);
    if (dist > 220) { ui.flashTitle("Too far — get closer.", 1200); return; }
    if (dist < 50) { ui.flashTitle("Can't fish under your own boat.", 1200); return; }
    const fishMul = G.phase === "night" ? 2 : 1;
    this.castLine = newCast(this, pointer.worldX, pointer.worldY, fishMul);
  }

  fireCannon() {
    if (this.time.now < this.lastFireAt + 600) return;
    this.lastFireAt = this.time.now;
    const ang = this.player.rotation;
    const b = this.add.circle(this.player.x, this.player.y, 4, 0xffd84a).setDepth(2);
    this.physics.add.existing(b);
    b.body.setVelocity(Math.cos(ang) * 520, Math.sin(ang) * 520);
    b.dmg = 15;
    this.bullets.add(b);
    this.time.delayedCall(1400, () => { if (b.active) b.destroy(); });
  }

  onBulletHit(bullet, pirate) {
    if (!bullet.active || !pirate.active) return;
    pirate.hp -= bullet.dmg;
    bullet.destroy();
    flashFloat(this, pirate.x, pirate.y - 24, `-${bullet.dmg}`, "#ffd84a");
    if (pirate.hp <= 0) {
      flashFloat(this, pirate.x, pirate.y, "sunk!", "#ffd84a");
      G.todayLog.piratesSunk += 1;
      G.money += 25;
      pirate.destroy();
    }
  }

  spawnPirate() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -40; y = Math.random() * GAME_H; }
    else if (side === 1) { x = GAME_W + 40; y = Math.random() * GAME_H; }
    else if (side === 2) { x = Math.random() * GAME_W; y = -40; }
    else { x = Math.random() * GAME_W; y = GAME_H + 40; }
    const p = this.physics.add.sprite(x, y, "pirate_boat");
    p.hp = 30; p.dmgPerHit = 14; p.lastHitAt = 0;
    this.pirates.add(p);
  }

  pirateSpawnRate() {
    let rate = 0;
    if (G.day >= 3) rate = 1.0;
    if (G.day >= 5) rate = 1.6;
    if (G.day >= 8) rate = 2.4;
    if (G.phase === "night") rate *= 2;
    return rate;
  }

  updatePirates(dt) {
    this.pirateSpawnAccum += this.pirateSpawnRate() * dt / 60;
    while (this.pirateSpawnAccum >= 1) { this.spawnPirate(); this.pirateSpawnAccum -= 1; }
    this.pirates.children.iterate((p) => {
      if (!p) return;
      const ang = Phaser.Math.Angle.Between(p.x, p.y, this.player.x, this.player.y);
      this.physics.velocityFromRotation(ang, 90, p.body.velocity);
      p.rotation = ang;
    });
  }

  onPirateContact(player, pirate) {
    if (this.time.now < player.invulnUntil) return;
    if (this.time.now < pirate.lastHitAt + 600) return;
    pirate.lastHitAt = this.time.now;
    player.hp -= pirate.dmgPerHit;
    this.cameras.main.shake(150, 0.01);
    flashFloat(this, player.x, player.y - 40, `-${pirate.dmgPerHit} hull`, "#ff6a6a");
    if (player.hp <= 0) this.handlePlayerSunk();
  }

  handlePlayerSunk() {
    flashFloat(this, this.player.x, this.player.y, "YOUR BOAT WAS SUNK", "#ff5555");
    G.todayLog.shipsLost += 1;
    const lost = Math.floor(G.todayLog.moneyEarned * 0.5);
    G.money = Math.max(0, G.money - lost);
    G.todayLog.fishCaught = [];
    this.player.hp = this.player.maxHp;
    this.player.x = GAME_W/2; this.player.y = GAME_H/2;
    this.player.invulnUntil = this.time.now + 3000;
    this.player.setAlpha(0.4);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 3000 });
    this.pirates.clear(true, true);
  }

  isInDockZone() {
    return Math.hypot(this.player.x - this.dockZone.x, this.player.y - this.dockZone.y) < this.dockZone.r;
  }

  tryDock() {
    if (!this.isInDockZone()) return;
    G.mode = "harbor";
    G.shipHp = this.player.hp;
    writeSave(G);
    this.scene.start("Harbor");
  }

  update(time, dtMs) {
    const ui = this.scene.get("UI");
    if (ui.modalOpen) return;
    const dt = dtMs / 1000;
    let vx = 0, vy = 0;
    const speed = 220;
    const left  = this.cursors.left.isDown  || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up    = this.cursors.up.isDown    || this.keys.W.isDown;
    const down  = this.cursors.down.isDown  || this.keys.S.isDown;
    if (left)  vx -= speed;
    if (right) vx += speed;
    if (up)    vy -= speed;
    if (down)  vy += speed;
    if (vx || vy) {
      this.player.setVelocity(vx, vy);
      this.player.rotation = Math.atan2(vy, vx);
    } else {
      this.player.setVelocity(0, 0);
    }
    if (this.keys.SPACE.isDown) this.fireCannon();
    if (this.castLine) {
      this.castLine = tickCast(this, this.castLine, this.player.x, this.player.y);
    }
    this.updatePirates(dt);

    G.shipHp = this.player.hp;

    this.dockPrompt.setVisible(this.isInDockZone());
    if (this.isInDockZone()) this.dockPrompt.setText("Press E — Dock at Harbor");
  }
}

// === Boot =================================================================
const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: "game",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
  scene: [BootScene, UIScene, HarborScene, SeaScene],
  backgroundColor: "#06283a",
};

new Phaser.Game(config);
