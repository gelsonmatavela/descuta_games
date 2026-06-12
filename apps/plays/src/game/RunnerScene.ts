import Phaser from "phaser";

export interface RunnerCallbacks {
  onScore: (score: number) => void;
  onShield: (secondsLeft: number) => void;
  onGameOver: (stats: { score: number; durationSeconds: number }) => void;
}

const WIDTH = 900;
const HEIGHT = 540;
const GROUND_Y = 470;

const SPEED_START = 320;
const SPEED_MAX = 820;
const SPEED_ACCEL = 12; // aceleração contínua (px/s por s)
const LEVEL_DIST = 1400; // distância por "grau" de velocidade
const LEVEL_BOOST = 32; // boost de velocidade por grau
const JUMP_V = -640; // calibrado para a gravidade 1350 (salto mais curto e rápido)
const FALL_GRAVITY_BONUS = 1200; // gravidade extra na descida: o coelho cai rápido em vez de "flutuar"
const MAX_JUMPS = 2;
const SHIELD_MS = 6000;

interface SceneData {
  callbacks: RunnerCallbacks;
}

export class RunnerScene extends Phaser.Scene {
  private callbacks!: RunnerCallbacks;
  private player!: Phaser.Physics.Arcade.Sprite;
  private groundBody!: Phaser.Physics.Arcade.Image;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private shieldAura!: Phaser.GameObjects.Image;
  private hazards!: Phaser.Physics.Arcade.Group;
  private carrots!: Phaser.Physics.Arcade.Group;
  private magics!: Phaser.Physics.Arcade.Group;
  private ships!: Phaser.GameObjects.Group;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private speed = SPEED_START;
  private distance = 0;
  private carrotScore = 0;
  private score = 0;
  private level = 0;
  private jumpsLeft = MAX_JUMPS;
  private distSinceSpawn = 0;
  private nextGap = 360;
  private shieldUntil = 0;
  private over = false;
  private startTime = 0;

  constructor() {
    super("RunnerScene");
  }

  init(data: SceneData) {
    this.callbacks = data.callbacks;
  }

  preload() {
    this.drawRabbit();
    this.drawCarrot("carrot", 0xf97316, 0x22c55e);
    this.drawCarrot("magic", 0xfacc15, 0xa855f7);
    this.drawShip();
    this.rect("rock", 34, 40, 0x475569);
    this.rect("laser", 16, 120, 0xf43f5e);
    this.dot("spark", 5, 0xffffff);
    this.drawShield();
    this.rect("ground", 64, 8, 0x1e293b);
  }

  private rect(key: string, w: number, h: number, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(2, 0x000000, 0.25);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private dot(key: string, r: number, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  private drawRabbit() {
    const g = this.add.graphics();
    // orelhas
    g.fillStyle(0xf8fafc, 1);
    g.fillRoundedRect(9, 0, 7, 20, 3);
    g.fillRoundedRect(21, 0, 7, 20, 3);
    g.fillStyle(0xf9a8d4, 1);
    g.fillRoundedRect(11, 3, 3, 13, 1);
    g.fillRoundedRect(23, 3, 3, 13, 1);
    // corpo / cabeça
    g.fillStyle(0xf8fafc, 1);
    g.fillRoundedRect(6, 16, 26, 28, 11);
    // cauda
    g.fillCircle(5, 40, 5);
    // olho
    g.fillStyle(0x0f172a, 1);
    g.fillCircle(24, 27, 2.6);
    // nariz
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(30, 33, 2.2);
    g.generateTexture("rabbit", 38, 46);
    g.destroy();
  }

  private drawCarrot(key: string, body: number, leaf: number) {
    const g = this.add.graphics();
    // folhas
    g.fillStyle(leaf, 1);
    g.fillTriangle(6, 8, 11, 0, 13, 8);
    g.fillTriangle(11, 8, 16, 0, 18, 8);
    // corpo (ponta pra baixo)
    g.fillStyle(body, 1);
    g.fillTriangle(5, 7, 19, 7, 12, 30);
    g.generateTexture(key, 24, 32);
    g.destroy();
  }

  private drawShip() {
    const g = this.add.graphics();
    g.fillStyle(0x64748b, 1);
    g.fillEllipse(26, 18, 52, 16);
    g.fillStyle(0x334155, 1);
    g.fillEllipse(26, 22, 40, 8);
    g.fillStyle(0x22d3ee, 1);
    g.fillCircle(26, 12, 9);
    g.fillStyle(0xa5f3fc, 1);
    g.fillCircle(23, 10, 3);
    g.generateTexture("ship", 52, 30);
    g.destroy();
  }

  private drawShield() {
    const g = this.add.graphics();
    g.lineStyle(3, 0x22d3ee, 0.9);
    g.strokeCircle(30, 30, 27);
    g.fillStyle(0x22d3ee, 0.12);
    g.fillCircle(30, 30, 27);
    g.generateTexture("shield", 60, 60);
    g.destroy();
  }

  create() {
    this.speed = SPEED_START;
    this.distance = 0;
    this.carrotScore = 0;
    this.score = 0;
    this.level = 0;
    this.jumpsLeft = MAX_JUMPS;
    this.distSinceSpawn = 0;
    this.nextGap = 340;
    this.shieldUntil = 0;
    this.over = false;
    this.startTime = this.time.now;

    this.cameras.main.setBackgroundColor("#070b16");

    this.groundTile = this.add
      .tileSprite(0, GROUND_Y, WIDTH, 70, "ground")
      .setOrigin(0, 0)
      .setAlpha(0.5);
    this.groundBody = this.physics.add.staticImage(WIDTH / 2, GROUND_Y + 4, "ground");
    this.groundBody.setVisible(false).setDisplaySize(WIDTH, 8).refreshBody();

    this.player = this.physics.add.sprite(160, GROUND_Y - 60, "rabbit");
    this.player.setCollideWorldBounds(false);
    this.player.body!.setSize(26, 40).setOffset(6, 6);
    this.physics.add.collider(this.player, this.groundBody);

    this.shieldAura = this.add.image(this.player.x, this.player.y, "shield").setVisible(false).setDepth(10);

    this.dust = this.add.particles(0, 0, "spark", {
      speed: { min: 40, max: 140 },
      scale: { start: 0.9, end: 0 },
      lifespan: 360,
      tint: [0xcbd5e1, 0x94a3b8],
      emitting: false,
    });

    this.hazards = this.physics.add.group({ allowGravity: false });
    this.carrots = this.physics.add.group({ allowGravity: false });
    this.magics = this.physics.add.group({ allowGravity: false });
    this.ships = this.add.group();

    this.physics.add.overlap(this.player, this.hazards, (_p, h) => this.hit(h as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.carrots, (_p, c) => {
      (c as Phaser.Physics.Arcade.Sprite).destroy();
      this.carrotScore += 25;
      this.popText((this.player.x + 30), this.player.y - 20, "+25", "#fbbf24");
    });
    this.physics.add.overlap(this.player, this.magics, (_p, m) => {
      (m as Phaser.Physics.Arcade.Sprite).destroy();
      this.activateShield();
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", () => this.onTap());
  }

  private onTap() {
    if (this.over) {
      this.scene.restart({ callbacks: this.callbacks } satisfies SceneData);
      return;
    }
    this.jump();
  }

  private jump() {
    if (this.jumpsLeft <= 0) return;
    const onGround = (this.player.body as Phaser.Physics.Arcade.Body).blocked.down;
    this.player.setVelocityY(JUMP_V);
    this.jumpsLeft -= 1;
    // Poeira ao saltar.
    this.dust.emitParticleAt(this.player.x, this.player.y + 20, onGround ? 10 : 6);
    this.tweens.add({ targets: this.player, scaleX: 0.82, scaleY: 1.18, yoyo: true, duration: 110 });
  }

  private activateShield() {
    this.shieldUntil = this.time.now + SHIELD_MS;
    this.shieldAura.setVisible(true);
    this.popText(this.player.x, this.player.y - 30, "ESCUDO!", "#22d3ee");
  }

  private get shielded() {
    return this.time.now < this.shieldUntil;
  }

  private hit(h: Phaser.Physics.Arcade.Sprite) {
    if (this.over) return;
    if (this.shielded) {
      // Escudo absorve: destrói o perigo com faíscas.
      this.burst(h.x, h.y, [0x22d3ee, 0xa5f3fc, 0xffffff]);
      h.destroy();
      return;
    }
    this.die();
  }

  private spawnRock() {
    const h = Phaser.Math.Between(34, 64);
    const w = Phaser.Math.Between(26, 40);
    const r = this.hazards.create(WIDTH + 40, GROUND_Y - h / 2, "rock") as Phaser.Physics.Arcade.Sprite;
    r.setDisplaySize(w, h);
    (r.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    r.body!.setSize(w, h);
  }

  private spawnShipLaser() {
    // Nave decorativa no alto + feixe baixo (pulável) que se move junto.
    const ship = this.add.image(WIDTH + 40, 120, "ship").setDepth(6);
    ship.setData("vx", true);
    this.ships.add(ship);
    const beamH = 120;
    const beam = this.hazards.create(WIDTH + 40, GROUND_Y - beamH / 2 + 4, "laser") as Phaser.Physics.Arcade.Sprite;
    beam.setDisplaySize(14, beamH);
    (beam.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    beam.body!.setSize(14, beamH);
    beam.setAlpha(0.85);
    beam.setData("ship", ship);
    this.tweens.add({ targets: beam, alpha: 0.4, yoyo: true, repeat: -1, duration: 200 });
  }

  private spawnCarrot(magic: boolean) {
    const y = GROUND_Y - Phaser.Math.Between(60, 170);
    const group = magic ? this.magics : this.carrots;
    const c = group.create(WIDTH + 40, y, magic ? "magic" : "carrot") as Phaser.Physics.Arcade.Sprite;
    (c.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    if (magic) {
      c.setScale(1.3);
      this.tweens.add({ targets: c, scale: 1.55, yoyo: true, repeat: -1, duration: 400 });
    }
  }

  private spawnSomething() {
    const roll = Math.random();
    if (roll < 0.06) this.spawnCarrot(true); // cenoura mágica (rara)
    else if (roll < 0.30) this.spawnCarrot(false); // cenoura comum
    else if (roll < 0.50 && this.level >= 1) this.spawnShipLaser(); // naves a partir do grau 1
    else this.spawnRock();
  }

  private burst(x: number, y: number, tint: number[]) {
    const e = this.add.particles(x, y, "spark", {
      speed: { min: 80, max: 320 },
      scale: { start: 1.3, end: 0 },
      lifespan: { min: 250, max: 550 },
      tint,
      blendMode: "ADD",
      emitting: false,
    });
    e.explode(22, x, y);
    this.time.delayedCall(700, () => e.destroy());
  }

  private popText(x: number, y: number, text: string, color: string) {
    const txt = this.add
      .text(x, y, text, { fontSize: "18px", fontStyle: "bold", color })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: txt, y: y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() });
  }

  update(_t: number, deltaMs: number) {
    if (this.over) return;
    const dt = deltaMs / 1000;

    // Velocidade: aceleração contínua + boost por grau.
    this.speed = Math.min(SPEED_MAX, this.speed + SPEED_ACCEL * dt);
    const dx = this.speed * dt;
    this.distance += dx;
    this.groundTile.tilePositionX += dx;

    const newLevel = Math.floor(this.distance / LEVEL_DIST);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.speed = Math.min(SPEED_MAX, this.speed + LEVEL_BOOST);
      this.popText(WIDTH / 2, 120, "+ VELOCIDADE", "#f472b6");
      this.cameras.main.flash(140, 80, 40, 120);
    }

    this.score = Math.floor(this.distance / 10) + this.carrotScore;
    this.callbacks.onScore(this.score);

    // Escudo: atualiza aura e timer.
    this.shieldAura.setPosition(this.player.x, this.player.y).setVisible(this.shielded);
    this.callbacks.onShield(Math.max(0, Math.ceil((this.shieldUntil - this.time.now) / 1000)));

    // Pulo por teclado.
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
    )
      this.jump();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(body.velocity.y > 0 ? FALL_GRAVITY_BONUS : 0);
    if (body.blocked.down) this.jumpsLeft = MAX_JUMPS;

    // Move e recicla tudo.
    const move = (obj: Phaser.GameObjects.GameObject) => {
      const s = obj as Phaser.GameObjects.Sprite & { x: number };
      s.x -= dx;
      if (s.x < -90) s.destroy();
    };
    this.hazards.getChildren().forEach(move);
    this.carrots.getChildren().forEach(move);
    this.magics.getChildren().forEach(move);
    this.ships.getChildren().forEach(move);

    // Spawns por distância.
    this.distSinceSpawn += dx;
    if (this.distSinceSpawn >= this.nextGap) {
      this.spawnSomething();
      this.distSinceSpawn = 0;
      this.nextGap = Phaser.Math.Between(280, 470);
    }

    if (this.player.y > HEIGHT + 60) this.die();
  }

  private die() {
    if (this.over) return;
    this.over = true;
    this.burst(this.player.x, this.player.y, [0x4ade80, 0x22d3ee, 0xf43f5e, 0xffffff]);
    this.shieldAura.setVisible(false);
    this.player.setTint(0xff3030).setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: this.player, scale: 1.7, alpha: 0, duration: 240 });
    this.cameras.main.shake(260, 0.02);
    this.cameras.main.flash(180, 255, 70, 40);
    const durationSeconds = Math.round((this.time.now - this.startTime) / 1000);
    this.callbacks.onGameOver({ score: this.score, durationSeconds });
  }
}
