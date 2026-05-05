// Fishing Battle — v1
// Core loop: drive a small fishing boat, click water to cast, reel fish in,
// dodge pirates from day 3 onward, end the day with a report, choose to skip
// the night or fish through it for double yield + double pirates. Saves to
// localStorage every 5s and on day end.

// === Tunables =============================================================
const GAME_W = 1280;
const GAME_H = 720;

// Per design: 10 minute day, 10 minute night.
const DAY_SECONDS = 600;
const NIGHT_SECONDS = 600;

// Idle simulation cap when the tab is closed.
const IDLE_CAP_SECONDS = 30 * 60;

const SAVE_KEY = "fishingBattle.save.v1";

const FISH = [
  { id: "sardine",   name: "Sardine",   value: 5,   weight: 50 },
  { id: "mackerel",  name: "Mackerel",  value: 14,  weight: 28 },
  { id: "snapper",   name: "Snapper",   value: 32,  weight: 12 },
  { id: "tuna",      name: "Tuna",      value: 80,  weight: 7  },
  { id: "swordfish", name: "Swordfish", value: 200, weight: 2.5 },
  { id: "marlin",    name: "Marlin",    value: 500, weight: 0.5 },
];

function rollFish() {
  const total = FISH.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of FISH) { r -= f.weight; if (r <= 0) return f; }
  return FISH[0];
}

// === Save / load ==========================================================
function newSave() {
  return {
    money: 0,
    day: 1,
    phase: "day",
    phaseTimeLeft: DAY_SECONDS,
    todayLog: { fishCaught: [], moneyEarned: 0, shipsLost: 0, piratesSunk: 0 },
    history: [],
    lastSaveTs: Date.now(),
  };
}

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); }
  catch { return null; }
}

function writeSave(state) {
  state.lastSaveTs = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

// === Scenes ===============================================================
class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  create() { this.scene.start("Game"); }
}

class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }

  create() {
    this.makeProceduralTextures();

    this.bg = this.add.graphics().setDepth(-2);
    this.stars = this.add.graphics().setDepth(-1);

    this.state = loadSave() ?? newSave();
    this.applyIdleCatchup();

    this.player = this.physics.add.sprite(GAME_W / 2, GAME_H / 2, "fisher_boat");
    this.player.setCollideWorldBounds(true);
    this.player.hp = 100;
    this.player.maxHp = 100;
    this.player.invulnUntil = 0;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE");
    this.input.on("pointerdown", (p) => this.handleClick(p));

    this.castLine = null;

    this.pirates = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.physics.add.overlap(this.player, this.pirates, this.onPirateContact, null, this);
    this.physics.add.overlap(this.bullets, this.pirates, this.onBulletHit, null, this);
    this.pirateSpawnAccum = 0;
    this.lastFireAt = 0;

    this.buildHud();
    this.drawSea();
    this.drawStars();

    this.time.addEvent({ delay: 5000, loop: true, callback: () => writeSave(this.state) });

    if (this.state.day === 1 && this.state.todayLog.moneyEarned === 0) {
      this.showToast("WASD/arrows to move • click water to cast • SPACE to fire cannon", 6000);
    } else {
      this.showToast(`Welcome back, captain. Day ${this.state.day}.`, 3000);
    }
  }

  // --- Procedural textures ------------------------------------------------
  makeProceduralTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Fisher boat: brown hull, bow pointing right (+x), white cabin
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

    // Pirate sloop: dark hull, sail, skull mark
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

    g.destroy();
  }

  drawSea() {
    this.bg.clear();
    const isNight = this.state.phase === "night";
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
    if (this.state.phase !== "night") return;
    if (!this._starPositions) {
      this._starPositions = Array.from({ length: 80 }, () => ({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H * 0.45,
        r: Math.random() * 1.2 + 0.4,
      }));
    }
    this.stars.fillStyle(0xffffff, 0.85);
    for (const s of this._starPositions) this.stars.fillCircle(s.x, s.y, s.r);
  }

  // --- HUD ----------------------------------------------------------------
  buildHud() {
    const base = { fontFamily: "monospace", fontSize: "18px", color: "#e8f0fa" };
    this.hud = {};
    this.hud.day = this.add.text(16, 12, "", base).setScrollFactor(0).setDepth(100);
    this.hud.phase = this.add.text(16, 36, "", base).setScrollFactor(0).setDepth(100);
    this.hud.timer = this.add.text(16, 60, "", base).setScrollFactor(0).setDepth(100);
    this.hud.money = this.add.text(GAME_W - 16, 12, "", { ...base, fontSize: "22px", color: "#ffe27a" })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.hp = this.add.text(GAME_W - 16, 42, "", { ...base, color: "#ff8a8a" })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.fishToday = this.add.text(GAME_W - 16, 66, "", base)
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.hud.skipBtn = this.add.text(GAME_W / 2, GAME_H - 24, "[ dev: skip phase ]", { ...base, color: "#88a" })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    this.hud.skipBtn.on("pointerdown", (p, lx, ly, e) => {
      e?.stopPropagation?.();
      this.state.phaseTimeLeft = 1;
    });
  }

  refreshHud() {
    this.hud.day.setText(`Day ${this.state.day}`);
    this.hud.phase.setText(this.state.phase === "day" ? "Daytime" : "Nightfall");
    const m = Math.floor(this.state.phaseTimeLeft / 60);
    const s = Math.floor(this.state.phaseTimeLeft % 60).toString().padStart(2, "0");
    this.hud.timer.setText(`${m}:${s} remaining`);
    this.hud.money.setText(`$${this.state.money.toLocaleString()}`);
    this.hud.hp.setText(`Hull ${Math.max(0, this.player.hp) | 0}/${this.player.maxHp}`);
    this.hud.fishToday.setText(`Today: ${this.state.todayLog.fishCaught.length} fish`);
  }

  // --- Click / cast / reel ------------------------------------------------
  handleClick(pointer) {
    if (this.modalOpen) return;

    if (this.castLine) {
      this.reelIn(this.castLine.hooked);
      return;
    }

    const dx = pointer.worldX - this.player.x;
    const dy = pointer.worldY - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 220) { this.showToast("Too far — get closer to cast.", 1200); return; }
    if (dist < 50)  { this.showToast("Can't fish under your own boat.", 1200); return; }

    const lineGfx = this.add.graphics().setDepth(2);
    const bobber = this.add.circle(pointer.worldX, pointer.worldY, 4, 0xff5555).setDepth(3);
    const fishMul = this.state.phase === "night" ? 2 : 1;
    const wait = (1500 + Math.random() * 3500) / fishMul;
    this.castLine = {
      x: pointer.worldX, y: pointer.worldY,
      lineGfx, bobber,
      readyAt: this.time.now + wait,
      hooked: false, missDeadline: 0, species: null, indicator: null,
    };
  }

  reelIn(success) {
    const c = this.castLine; if (!c) return;
    c.lineGfx.destroy(); c.bobber.destroy();
    if (c.indicator) c.indicator.destroy();
    if (success && c.species) {
      this.state.money += c.species.value;
      this.state.todayLog.fishCaught.push(c.species.id);
      this.state.todayLog.moneyEarned += c.species.value;
      this.flashFloat(this.player.x, this.player.y - 30, `+$${c.species.value} ${c.species.name}`, "#ffe27a");
    } else {
      this.flashFloat(this.player.x, this.player.y - 30, "reeled in empty", "#bbb");
    }
    this.castLine = null;
  }

  updateCastLine() {
    const c = this.castLine; if (!c) return;
    c.lineGfx.clear();
    c.lineGfx.lineStyle(1.5, 0xfafafa, 0.85);
    c.lineGfx.lineBetween(this.player.x, this.player.y, c.x, c.y);

    if (!c.hooked && this.time.now >= c.readyAt) {
      c.hooked = true;
      c.species = rollFish();
      this.tweens.add({ targets: c.bobber, y: c.y - 6, yoyo: true, repeat: 4, duration: 90 });
      c.indicator = this.add.text(c.x, c.y - 22, "!", { fontFamily: "monospace", fontSize: "24px", color: "#ffd84a" })
        .setOrigin(0.5).setDepth(4);
      c.missDeadline = this.time.now + 1800;
    }

    if (c.hooked && this.time.now > c.missDeadline) {
      this.flashFloat(c.x, c.y - 30, "got away", "#ccc");
      c.lineGfx.destroy(); c.bobber.destroy(); c.indicator.destroy();
      this.castLine = null;
    }
  }

  // --- Cannon -------------------------------------------------------------
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
    this.flashFloat(pirate.x, pirate.y - 24, `-${bullet.dmg}`, "#ffd84a");
    if (pirate.hp <= 0) {
      this.flashFloat(pirate.x, pirate.y, "sunk!", "#ffd84a");
      this.state.todayLog.piratesSunk += 1;
      this.state.money += 25;
      pirate.destroy();
    }
  }

  // --- Pirates ------------------------------------------------------------
  spawnPirate() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -40; y = Math.random() * GAME_H; }
    else if (side === 1) { x = GAME_W + 40; y = Math.random() * GAME_H; }
    else if (side === 2) { x = Math.random() * GAME_W; y = -40; }
    else { x = Math.random() * GAME_W; y = GAME_H + 40; }
    const p = this.physics.add.sprite(x, y, "pirate_boat");
    p.hp = 30;
    p.dmgPerHit = 14;
    p.lastHitAt = 0;
    this.pirates.add(p);
  }

  pirateSpawnRate() {
    let rate = 0;
    if (this.state.day >= 3) rate = 1.0;
    if (this.state.day >= 5) rate = 1.6;
    if (this.state.day >= 8) rate = 2.4;
    if (this.state.phase === "night") rate *= 2;
    return rate;
  }

  updatePirates(dtSec) {
    this.pirateSpawnAccum += this.pirateSpawnRate() * dtSec / 60;
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
    this.flashFloat(player.x, player.y - 40, `-${pirate.dmgPerHit} hull`, "#ff6a6a");
    if (player.hp <= 0) this.handlePlayerSunk();
  }

  handlePlayerSunk() {
    this.flashFloat(this.player.x, this.player.y, "YOUR BOAT WAS SUNK", "#ff5555");
    this.state.todayLog.shipsLost += 1;
    const lost = Math.floor(this.state.todayLog.moneyEarned * 0.5);
    this.state.money = Math.max(0, this.state.money - lost);
    this.state.todayLog.fishCaught = [];
    this.player.hp = this.player.maxHp;
    this.player.x = GAME_W / 2; this.player.y = GAME_H / 2;
    this.player.invulnUntil = this.time.now + 3000;
    this.player.setAlpha(0.4);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 3000 });
    this.pirates.clear(true, true);
  }

  // --- Day / night --------------------------------------------------------
  advancePhase() {
    if (this.state.phase === "day") this.showEndOfDayReport();
    else this.startNewDay();
  }

  startNewDay() {
    this.state.history.push({ day: this.state.day, ...this.state.todayLog });
    if (this.state.history.length > 30) this.state.history.shift();
    this.state.day += 1;
    this.state.phase = "day";
    this.state.phaseTimeLeft = DAY_SECONDS;
    this.state.todayLog = { fishCaught: [], moneyEarned: 0, shipsLost: 0, piratesSunk: 0 };
    this.pirates.clear(true, true);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
    this.drawSea(); this.drawStars();
    this.showToast(`Day ${this.state.day} begins.`, 2500);
    writeSave(this.state);
  }

  startNight() {
    this.state.phase = "night";
    this.state.phaseTimeLeft = NIGHT_SECONDS;
    this.drawSea(); this.drawStars();
    this.showToast("Night fishing: ×2 fish, ×2 pirates.", 3000);
    writeSave(this.state);
  }

  // --- End of day modal ---------------------------------------------------
  showEndOfDayReport() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    this.physics.world.pause();

    const log = this.state.todayLog;
    const counts = {};
    for (const id of log.fishCaught) counts[id] = (counts[id] || 0) + 1;
    const fishLines = Object.keys(counts).length
      ? Object.keys(counts).map((id) => {
          const f = FISH.find((x) => x.id === id);
          return `  ${f.name.padEnd(11)} ×${String(counts[id]).padStart(3)}   $${(counts[id] * f.value).toLocaleString()}`;
        }).join("\n")
      : "  (no fish caught today)";

    const text = [
      `DAY ${this.state.day} REPORT`,
      ``,
      `Catch:`,
      fishLines,
      ``,
      `Earnings today: $${log.moneyEarned.toLocaleString()}`,
      `Battles:        ${log.piratesSunk} pirate sunk • ${log.shipsLost} ship lost`,
      ``,
      `Cash on hand:   $${this.state.money.toLocaleString()}`,
    ].join("\n");

    const overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.6).setDepth(200);
    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 580, 460, 0x101820, 1)
      .setStrokeStyle(2, 0xffe27a).setDepth(201);
    const t = this.add.text(GAME_W / 2, GAME_H / 2 - 200, text, {
      fontFamily: "monospace", fontSize: "16px", color: "#e8f0fa", align: "left",
    }).setOrigin(0.5, 0).setDepth(202);

    const btn = (x, label, color) => {
      const b = this.add.text(x, GAME_H / 2 + 180, label, {
        fontFamily: "monospace", fontSize: "16px",
        color: "#0a1628", backgroundColor: color, padding: { x: 14, y: 10 },
      }).setOrigin(0.5).setDepth(202).setInteractive({ useHandCursor: true });
      return b;
    };
    const skipBtn = btn(GAME_W / 2 - 130, `Skip night → Day ${this.state.day + 1}`, "#ffe27a");
    const fishBtn = btn(GAME_W / 2 + 130, `Fish through night (×2/×2)`, "#9be7a3");

    const close = (cb) => {
      overlay.destroy(); panel.destroy(); t.destroy();
      skipBtn.destroy(); fishBtn.destroy();
      this.modalOpen = false;
      this.physics.world.resume();
      cb();
    };
    skipBtn.on("pointerdown", () => close(() => this.startNewDay()));
    fishBtn.on("pointerdown", () => close(() => this.startNight()));
  }

  // --- Idle catch-up ------------------------------------------------------
  applyIdleCatchup() {
    if (!this.state.lastSaveTs) return;
    const elapsed = Math.min(IDLE_CAP_SECONDS, (Date.now() - this.state.lastSaveTs) / 1000);
    if (elapsed < 5) return;
    const passiveFish = Math.floor(elapsed / 25);
    const passiveMoney = passiveFish * 6;
    if (passiveFish > 0) {
      this.state.money += passiveMoney;
      this.state.todayLog.moneyEarned += passiveMoney;
      this._idleNote = `Crew earned $${passiveMoney} while you were away.`;
    }
    this.state.phaseTimeLeft = Math.max(0, this.state.phaseTimeLeft - elapsed);
  }

  // --- Util ---------------------------------------------------------------
  flashFloat(x, y, str, color) {
    const t = this.add.text(x, y, str, { fontFamily: "monospace", fontSize: "14px", color }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  showToast(str, ms = 2500) {
    if (this.toast) this.toast.destroy();
    this.toast = this.add.text(GAME_W / 2, 96, str, {
      fontFamily: "monospace", fontSize: "16px",
      color: "#0a1628", backgroundColor: "#ffe27a", padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.time.delayedCall(ms, () => { if (this.toast) { this.toast.destroy(); this.toast = null; } });
  }

  // --- Update -------------------------------------------------------------
  update(time, dtMs) {
    if (this.modalOpen) return;
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

    this.updateCastLine();
    this.updatePirates(dt);

    this.state.phaseTimeLeft -= dt;
    if (this.state.phaseTimeLeft <= 0) {
      this.state.phaseTimeLeft = 0;
      this.advancePhase();
    }

    this.refreshHud();
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
  scene: [BootScene, GameScene],
  backgroundColor: "#06283a",
};

new Phaser.Game(config);
