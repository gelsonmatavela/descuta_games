import Phaser from "phaser";
import { LEVEL_CONFIGS, LevelDef, generateLevel, GROUND_Y, WORLD_H } from "./levels";

export type ControlMode = "buttons" | "gestures";

export interface TrapSceneCallbacks {
  onDeath: (deaths: number) => void;
  onLevel: (index: number, total: number, name: string) => void;
  onWin: (stats: { deaths: number; durationSeconds: number }) => void;
}

interface SceneData {
  callbacks: TrapSceneCallbacks;
  levelIndex: number;
  deaths: number;
  startTime: number; // 0 = ainda não iniciado (primeira fase)
  controlMode: ControlMode;
}

export class TrapScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private deaths = 0;
  private levelIndex = 0;
  private level!: LevelDef;
  private startTime = 0;
  private dead = false;
  private won = false;
  private callbacks!: TrapSceneCallbacks;

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private fakeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private spikeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private hiddenGroup!: Phaser.Physics.Arcade.Group;
  private fallingGroup!: Phaser.Physics.Arcade.Group;
  private lavaRects: { x: number; w: number }[] = [];
  private fireballGroup!: Phaser.Physics.Arcade.Group;
  private flameGroup!: Phaser.Physics.Arcade.StaticGroup;
  private attackerGroup!: Phaser.Physics.Arcade.Group;
  private goal!: Phaser.Physics.Arcade.Sprite;

  private touch = { left: false, right: false, jump: false };
  private touchButtons: {
    rect: Phaser.Geom.Rectangle;
    key: "left" | "right" | "jump";
    btn: Phaser.GameObjects.Text;
  }[] = [];
  private jumpQueued = false;
  private controlMode: ControlMode = "buttons";
  private lavaEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor() {
    super("TrapScene");
  }

  init(data: SceneData) {
    this.callbacks = data.callbacks;
    this.levelIndex = data.levelIndex ?? 0;
    this.deaths = data.deaths ?? 0;
    this.startTime = data.startTime || this.time.now;
    this.controlMode = data.controlMode ?? "buttons";
    // Zera o estado de toque: a cena reinicia com a mesma instância e um dedo
    // segurado durante a morte deixava o botão "preso".
    this.touch = { left: false, right: false, jump: false };
    this.jumpQueued = false;
    // Sorteia um layout novo a cada entrada na fase (morte ou avanço).
    this.level = generateLevel(LEVEL_CONFIGS[this.levelIndex]);
    this.dead = false;
    this.won = false;
  }

  preload() {
    this.drawSuperDog();
    this.makeTexture("ground", 40, 40, 0x334155);
    this.makeTexture("platform", 40, 20, 0x64748b);
    this.makeTexture("fake", 40, 40, 0x334155); // idêntico ao chão de propósito
    this.makeTriangle("spike", 24, 24, 0xef4444);
    this.makeTexture("block", 40, 40, 0x92400e);
    this.makeTexture("goal", 16, 64, 0xfacc15);
    this.makeTexture("lava", 40, 18, 0xf97316);
    this.makeCircle("fireball", 14, 0xfb923c);
    this.makeTexture("flame", 40, 80, 0xf59e0b);
    this.makeTexture("enemy", 28, 28, 0xa855f7);
    this.makeDot("spark", 5, 0xffffff);
  }

  private makeDot(key: string, r: number, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  // Cão super-herói (textura "player").
  private drawSuperDog() {
    const g = this.add.graphics();
    // capa vermelha esvoaçando atrás
    g.fillStyle(0xdc2626, 1);
    g.fillTriangle(0, 9, 11, 8, 3, 31);
    // corpo dourado
    g.fillStyle(0xd4a017, 1);
    g.fillRoundedRect(7, 13, 18, 18, 5);
    // cabeça
    g.fillRoundedRect(12, 3, 17, 16, 6);
    // orelha pendurada
    g.fillStyle(0xa16207, 1);
    g.fillRoundedRect(12, 4, 5, 13, 2);
    // focinho
    g.fillStyle(0xeab308, 1);
    g.fillRoundedRect(24, 11, 7, 7, 2);
    // nariz e olho
    g.fillStyle(0x0f172a, 1);
    g.fillCircle(30, 13, 1.7);
    g.fillCircle(24, 10, 1.8);
    // emblema no peito
    g.fillStyle(0x2563eb, 1);
    g.fillCircle(14, 23, 3.2);
    g.fillStyle(0xfde047, 1);
    g.fillCircle(14, 23, 1.5);
    g.generateTexture("player", 33, 34);
    g.destroy();
  }

  private makeTexture(key: string, w: number, h: number, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(2, 0x000000, 0.3);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeTriangle(key: string, w: number, h: number, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillTriangle(0, h, w / 2, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeCircle(key: string, r: number, color: number) {
    const g = this.add.graphics();
    g.fillStyle(0xfde047, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r * 0.7);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }

  create() {
    this.buildLevel();
    this.spawnPlayer();
    this.setupInput();
    this.setupTouchControls();

    this.cameras.main.setBounds(0, 0, this.level.worldW, WORLD_H);
    this.physics.world.setBounds(0, 0, this.level.worldW, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBackgroundColor("#0f172a");

    // Avisa o React qual fase começou (para o HUD).
    this.callbacks.onLevel(this.levelIndex, LEVEL_CONFIGS.length, this.level.name);
  }

  private buildLevel() {
    const lv = this.level;

    this.solids = this.physics.add.staticGroup();
    for (const seg of lv.ground) this.addSolid(seg, "ground");
    for (const p of lv.platforms) this.addSolid(p, "platform");

    this.fakeGroup = this.physics.add.staticGroup();
    for (const f of lv.fake) {
      const s = this.fakeGroup.create(f.x + f.w / 2, f.y + f.h / 2, "fake") as Phaser.Physics.Arcade.Sprite;
      s.setDisplaySize(f.w, f.h).refreshBody();
    }

    this.spikeGroup = this.physics.add.staticGroup();
    for (const x of lv.spikes) {
      this.spikeGroup.create(x, GROUND_Y - 20, "spike");
    }

    // Picos escondidos: começam embaixo do chão, sobem no gatilho.
    this.hiddenGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const h of lv.hiddenSpikes) {
      const spike = this.hiddenGroup.create(h.x, GROUND_Y + 40, "spike") as Phaser.Physics.Arcade.Sprite;
      spike.setData("triggerX", h.triggerX);
      spike.setData("armed", false);
    }

    // Blocos que caem.
    this.fallingGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const b of lv.falling) {
      const block = this.fallingGroup.create(b.x, -50, "block") as Phaser.Physics.Arcade.Sprite;
      block.setData("triggerX", b.triggerX);
      block.setData("dropped", false);
    }

    // Lava: chamas ardentes de verdade (partículas) sobre uma base brilhante.
    // A colisão é checada manualmente em update() via lavaRects.
    this.lavaRects = lv.lava;
    this.lavaEmitters = [];
    for (const l of lv.lava) {
      // base incandescente
      const base = this.add.image(l.x + l.w / 2, GROUND_Y - 2, "lava");
      base.setDisplaySize(l.w, 12).setTint(0xfacc15).setDepth(4);
      this.tweens.add({
        targets: base,
        alpha: { from: 0.6, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: 220 + Math.random() * 160,
      });
      // chamas subindo (fogo a arder)
      const fire = this.add.particles(0, 0, "spark", {
        x: { min: l.x + 2, max: l.x + l.w - 2 },
        y: GROUND_Y - 4,
        speedY: { min: -110, max: -40 },
        speedX: { min: -18, max: 18 },
        scale: { start: 2.2, end: 0 },
        lifespan: { min: 280, max: 560 },
        frequency: Math.max(18, 70 - l.w / 4),
        tint: [0xfde047, 0xf97316, 0xef4444],
        blendMode: "ADD",
      });
      fire.setDepth(5);
      this.lavaEmitters.push(fire);
    }

    // Bolas de fogo: emissores que cospem projéteis em ciclo.
    this.fireballGroup = this.physics.add.group({ allowGravity: false });
    for (const fb of lv.fireballs) {
      const spawn = () => {
        if (this.dead || this.won) return;
        const ball = this.fireballGroup.create(fb.x, fb.y, "fireball") as Phaser.Physics.Arcade.Sprite;
        ball.setVelocity(fb.vx, fb.vy);
        (ball.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        ball.setData("ttl", this.time.now + 5000);
      };
      spawn();
      this.time.addEvent({ delay: fb.everyMs, loop: true, callback: spawn });
    }

    // Lança-chamas: jato que liga/desliga.
    this.flameGroup = this.physics.add.staticGroup();
    for (const ft of lv.flamethrowers) {
      const flame = this.flameGroup.create(ft.x, ft.y, "flame") as Phaser.Physics.Arcade.Sprite;
      flame.setDisplaySize(ft.w, ft.h).refreshBody();
      flame.setTint(0xf59e0b);
      const setOn = (on: boolean) => {
        flame.setVisible(on);
        flame.setData("on", on);
        if (flame.body) (flame.body as Phaser.Physics.Arcade.StaticBody).enable = on;
      };
      setOn(false);
      const cycle = () => {
        setOn(true);
        this.time.delayedCall(ft.onMs, () => {
          setOn(false);
          this.time.delayedCall(ft.offMs, cycle);
        });
      };
      this.time.delayedCall(ft.startDelay ?? 0, cycle);
    }

    // Atacantes: patrulham horizontalmente.
    this.attackerGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const at of lv.attackers) {
      const enemy = this.attackerGroup.create(at.x, at.y, "enemy") as Phaser.Physics.Arcade.Sprite;
      enemy.setData("homeX", at.x);
      enemy.setData("range", at.range);
      enemy.setData("speed", at.speed);
      enemy.setVelocityX(at.speed);
      (enemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    // Bandeira de chegada.
    this.goal = this.physics.add.staticSprite(lv.goalX, GROUND_Y - 52, "goal");
  }

  private addSolid(r: { x: number; y: number; w: number; h: number }, key: string) {
    const s = this.solids.create(r.x + r.w / 2, r.y + r.h / 2, key) as Phaser.Physics.Arcade.Sprite;
    s.setDisplaySize(r.w, r.h).refreshBody();
  }

  private spawnPlayer() {
    this.player = this.physics.add.sprite(this.level.spawnX, this.level.spawnY, "player");
    this.player.setCollideWorldBounds(false);
    this.player.setBounce(0);
    // Hitbox justa no corpo do cão (a textura é maior que a hitbox).
    this.player.body!.setSize(20, 28);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(7, 5);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.fallingGroup);

    // Pisar na falsa = ela some.
    this.physics.add.collider(this.player, this.fakeGroup, (_p, fake) => {
      const f = fake as Phaser.Physics.Arcade.Sprite;
      this.time.delayedCall(120, () => f.disableBody(true, true));
    });

    this.physics.add.overlap(this.player, this.goal, () => this.win());
    this.physics.add.overlap(this.player, this.spikeGroup, () => this.die());
    // Lava: colisão checada manualmente em update() (ver lavaRects).
    this.physics.add.overlap(this.player, this.fireballGroup, () => this.die());
    this.physics.add.overlap(this.player, this.attackerGroup, () => this.die());
    this.physics.add.overlap(this.player, this.flameGroup, (_p, flame) => {
      if ((flame as Phaser.Physics.Arcade.Sprite).getData("on")) this.die();
    });
    this.physics.add.overlap(this.player, this.hiddenGroup, (_p, spike) => {
      if ((spike as Phaser.Physics.Arcade.Sprite).getData("armed")) this.die();
    });
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,D,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  private setupTouchControls() {
    if (this.controlMode === "gestures") {
      this.setupGestureControls();
      return;
    }

    const cam = this.cameras.main;
    this.touchButtons = [];
    const mk = (x: number, label: string, key: "left" | "right" | "jump") => {
      const btn = this.add
        .text(x, cam.height - 80, label, {
          fontSize: "44px",
          backgroundColor: "#1e293b",
          color: "#e2e8f0",
          padding: { x: 24, y: 14 },
        })
        .setScrollFactor(0)
        .setAlpha(0.6)
        .setDepth(1000);
      // Área de toque maior que o desenho (folga para o dedo).
      const m = 16;
      const rect = new Phaser.Geom.Rectangle(btn.x - m, btn.y - m, btn.width + m * 2, btn.height + m * 2);
      this.touchButtons.push({ rect, key, btn });
    };

    mk(20, "<", "left");
    mk(130, ">", "right");
    mk(cam.width - 160, "PULAR", "jump");
  }

  // Lê todos os ponteiros ativos a cada frame em vez de eventos pointerdown/up:
  // suporta toques simultâneos e nunca deixa botão "preso" após restart da cena.
  private pollTouchButtons() {
    this.touch.left = this.touch.right = this.touch.jump = false;
    for (const b of this.touchButtons) b.btn.setAlpha(0.6);
    for (const p of this.input.manager.pointers) {
      if (!p.isDown) continue;
      for (const b of this.touchButtons) {
        if (b.rect.contains(p.x, p.y)) {
          this.touch[b.key] = true;
          b.btn.setAlpha(1);
        }
      }
    }
  }

  // Modo gestos: segurar = andar pra frente; deslizar pra cima ou tocar = pular.
  private setupGestureControls() {
    let startY = 0;
    let startT = 0;
    let swiped = false;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      startY = p.y;
      startT = this.time.now;
      swiped = false;
      this.touch.right = true; // anda pra frente enquanto segura
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (!swiped && startY - p.y > 34) {
        swiped = true;
        this.jumpQueued = true; // deslizou pra cima = pular
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      this.touch.right = false;
      // toque rápido sem deslizar = pular
      if (!swiped && this.time.now - startT < 220) this.jumpQueued = true;
    });
  }

  update() {
    if (this.dead || this.won) return;

    if (this.controlMode === "buttons") this.pollTouchButtons();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touch.right;
    const jump =
      this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown || this.touch.jump;

    if (left) {
      this.player.setVelocityX(-220);
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(220);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if ((jump || this.jumpQueued) && onGround) this.player.setVelocityY(-440);
    this.jumpQueued = false;

    // Cair no buraco = morte.
    if (this.player.y > WORLD_H + 40) this.die();

    // Lava: morre se estiver sobre uma poça E baixo (perto do chão).
    // Pular por cima salva (o corpo sobe acima da faixa de lava).
    for (const l of this.lavaRects) {
      if (body.right > l.x && body.left < l.x + l.w && body.bottom > GROUND_Y - 16) {
        this.die();
        break;
      }
    }

    // Armar picos escondidos.
    this.hiddenGroup.getChildren().forEach((obj) => {
      const spike = obj as Phaser.Physics.Arcade.Sprite;
      if (!spike.getData("armed") && this.player.x > spike.getData("triggerX")) {
        spike.setData("armed", true);
        this.tweens.add({ targets: spike, y: GROUND_Y - 12, duration: 90 });
      }
    });

    // Soltar blocos.
    this.fallingGroup.getChildren().forEach((obj) => {
      const block = obj as Phaser.Physics.Arcade.Sprite;
      if (!block.getData("dropped") && this.player.x > block.getData("triggerX")) {
        block.setData("dropped", true);
        const b = block.body as Phaser.Physics.Arcade.Body;
        b.setAllowGravity(true);
        this.physics.add.overlap(this.player, block, () => this.die());
      }
    });

    // Limpar bolas de fogo que saíram do mundo ou expiraram.
    this.fireballGroup.getChildren().forEach((obj) => {
      const ball = obj as Phaser.Physics.Arcade.Sprite;
      if (
        this.time.now > ball.getData("ttl") ||
        ball.x < -40 ||
        ball.x > this.level.worldW + 40 ||
        ball.y > WORLD_H + 40
      ) {
        ball.destroy();
      }
    });

    // Patrulha dos atacantes: inverte a direção nos limites do range.
    this.attackerGroup.getChildren().forEach((obj) => {
      const enemy = obj as Phaser.Physics.Arcade.Sprite;
      const homeX = enemy.getData("homeX") as number;
      const range = enemy.getData("range") as number;
      const speed = enemy.getData("speed") as number;
      const eb = enemy.body as Phaser.Physics.Arcade.Body;
      if (enemy.x > homeX + range && eb.velocity.x > 0) enemy.setVelocityX(-speed);
      else if (enemy.x < homeX - range && eb.velocity.x < 0) enemy.setVelocityX(speed);
    });
  }

  private die() {
    if (this.dead || this.won) return;
    this.dead = true;
    this.deaths += 1;

    const px = this.player.x;
    const py = this.player.y;

    // Explosão de faíscas no ponto da morte.
    const emitter = this.add.particles(px, py, "spark", {
      speed: { min: 80, max: 360 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: { min: 300, max: 650 },
      tint: [0xff5722, 0xffc107, 0xff1744, 0xffffff],
      blendMode: "ADD",
      emitting: false,
    });
    emitter.explode(30, px, py);
    this.time.delayedCall(800, () => emitter.destroy());

    // Player "estoura": cresce, fica vermelho e some.
    this.player.setTint(0xff3030);
    this.player.setVelocity(0, 0);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: this.player, scale: 1.7, alpha: 0, duration: 240, ease: "Quad.easeOut" });

    this.callbacks.onDeath(this.deaths);
    this.cameras.main.shake(260, 0.02);
    this.cameras.main.flash(180, 255, 70, 40);

    // Reinicia a MESMA fase, preservando mortes e cronômetro.
    this.time.delayedCall(600, () => this.restartScene(this.levelIndex));
  }

  private win() {
    if (this.won || this.dead) return;
    this.won = true;

    const isLast = this.levelIndex >= LEVEL_CONFIGS.length - 1;
    if (!isLast) {
      // Avança para a próxima fase.
      this.cameras.main.flash(300, 74, 222, 128);
      this.time.delayedCall(500, () => this.restartScene(this.levelIndex + 1));
      return;
    }

    // Última fase concluída: venceu o jogo inteiro.
    const durationSeconds = Math.round((this.time.now - this.startTime) / 1000);
    this.callbacks.onWin({ deaths: this.deaths, durationSeconds });
  }

  private restartScene(levelIndex: number) {
    this.scene.restart({
      callbacks: this.callbacks,
      levelIndex,
      deaths: this.deaths,
      startTime: this.startTime,
      controlMode: this.controlMode,
    } satisfies SceneData);
  }
}
