import * as THREE from "three";
import { WarAudio } from "./WarAudio";

export interface WarHud {
  lives: number; // em metades de coração (2 tiros inimigos = 1 coração)
  maxLives: number;
  ammo: number;
  reloading: boolean;
  score: number;
  wave: number;
  enemiesLeft: number;
  kills: number;
}

export interface WarCallbacks {
  onHud: (hud: WarHud) => void;
  onDamage: () => void;
  onHit: (killed: boolean) => void;
  onLock: (locked: boolean) => void;
  onWave: (wave: number) => void;
  onGameOver: (stats: { score: number; wave: number; kills: number; durationSeconds: number }) => void;
}

export interface WarGameApi {
  lock: () => void;
  restart: () => void;
  setFiring: (firing: boolean) => void;
  reload: () => void;
  setSound: (on: boolean) => void;
  isTouch: boolean;
  destroy: () => void;
}

const ARENA = 60; // meio-lado da arena jogável
const EYE_Y = 1.7;
const PLAYER_SPEED = 9;
const GRAVITY = 26;
const JUMP_V = 8.5;
const MAG_SIZE = 30;
const RELOAD_S = 1.4;
const FIRE_INTERVAL = 0.12; // segurar o tiro = rajada automática
const BULLET_DMG = 15;
const ENEMY_HP = 30;
const MAX_HALF_LIVES = 10; // 5 corações; cada tiro inimigo tira meio
const MOUSE_SENS = 0.0023;
const TOUCH_LOOK_SENS = 0.006;

const CAMO_COLORS = [0x44523a, 0x575243, 0x4a4438, 0x3c4a4d];
const SKIN_TONES = [0xc9a07a, 0x9a6a45, 0xe2bb95, 0x7c4f33];

interface Enemy {
  root: THREE.Group;
  meshes: THREE.Mesh[];
  legs: [THREE.Mesh, THREE.Mesh];
  hp: number;
  speed: number;
  stopDist: number;
  nextShot: number; // em gameTime (s)
  strafeDir: number;
  strafeUntil: number;
  hitUntil: number; // flash vermelho ao ser atingido
  walkPhase: number;
  dead: boolean;
  removeAt: number;
}

interface Tracer {
  line: THREE.Line;
  until: number;
}

interface Collider {
  x: number;
  z: number;
  r: number;
}

class WarGame {
  private parent: HTMLElement;
  private cb: WarCallbacks;
  readonly isTouch: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private playerRig = new THREE.Object3D(); // yaw fica no rig, pitch na câmera
  private raycaster = new THREE.Raycaster();
  private audio = new WarAudio();

  private gun!: THREE.Group;
  private muzzleFlash!: THREE.Mesh;
  private muzzleLight!: THREE.PointLight;
  private gunKick = 0;
  private muzzleUntil = 0;
  private shake = 0;

  private yaw = 0;
  private pitch = 0;
  private velY = 0;
  private keys = new Set<string>();
  private moveTouch = { id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
  private lookTouch = { id: -1, lx: 0, ly: 0 };

  private halfLives = MAX_HALF_LIVES;
  private ammo = MAG_SIZE;
  private reloadEnd = 0; // 0 = não está recarregando
  private score = 0;
  private kills = 0;
  private wave = 0;
  private nextWaveAt = 0;
  private firing = false;
  private nextFireAt = 0;
  private over = false;
  private startedAt = 0;

  private gameTime = 0; // tempo de simulação (pausa quando desfocado no desktop)
  private enemies: Enemy[] = [];
  private tracers: Tracer[] = [];
  private flashes: { mesh: THREE.Mesh; until: number }[] = [];
  private colliders: Collider[] = [];
  private solidMeshes: THREE.Mesh[] = [];
  private lastHud = "";
  private raf = 0;
  private lastTime = 0;
  private resizeObs: ResizeObserver;
  private destroyed = false;

  constructor(parent: HTMLElement, cb: WarCallbacks) {
    this.parent = parent;
    this.cb = cb;
    this.isTouch = typeof window !== "undefined" && "ontouchstart" in window;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    parent.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 400);
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);

    this.buildWorld();
    this.buildGun();
    this.bindEvents();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(parent);
    this.resize();

    this.reset();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ── Mundo ────────────────────────────────────────────────────────────
  private buildWorld() {
    this.scene.background = new THREE.Color(0xa8b5a2);
    this.scene.fog = new THREE.Fog(0xa8b5a2, 40, 180);

    const hemi = new THREE.HemisphereLight(0xe8efe0, 0x4a5040, 1.6);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.8);
    sun.position.set(40, 60, 20);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2 + 80, ARENA * 2 + 80),
      new THREE.MeshLambertMaterial({ color: 0x4a5240 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Crateras e manchas no terreno (detalhe barato).
    const rng = this.seeded(7);
    for (let i = 0; i < 26; i++) {
      const r = 1.5 + rng() * 4;
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(r, 18),
        new THREE.MeshLambertMaterial({ color: rng() > 0.5 ? 0x39402f : 0x575f48 }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((rng() * 2 - 1) * ARENA, 0.01 + i * 0.0005, (rng() * 2 - 1) * ARENA);
      this.scene.add(patch);
    }

    // Caixotes (cobertura) — com colisão.
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x6b5435 });
    for (let i = 0; i < 16; i++) {
      const s = 1.8 + rng() * 1.4;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      const x = (rng() * 2 - 1) * (ARENA - 8);
      const z = (rng() * 2 - 1) * (ARENA - 8);
      if (Math.hypot(x, z) < 8) continue; // não nasce em cima do jogador
      crate.position.set(x, s / 2, z);
      crate.rotation.y = rng() * Math.PI;
      this.scene.add(crate);
      this.solidMeshes.push(crate);
      this.colliders.push({ x, z, r: s * 0.75 });
    }

    // Muros de sacos de areia.
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x7a6f50 });
    for (let i = 0; i < 8; i++) {
      const w = 5 + rng() * 3;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, 0.9), wallMat);
      const x = (rng() * 2 - 1) * (ARENA - 10);
      const z = (rng() * 2 - 1) * (ARENA - 10);
      if (Math.hypot(x, z) < 9) continue;
      const rot = rng() * Math.PI;
      wall.position.set(x, 0.65, z);
      wall.rotation.y = rot;
      this.scene.add(wall);
      this.solidMeshes.push(wall);
      // aproxima o muro com 2 círculos de colisão
      const off = w / 4;
      this.colliders.push(
        { x: x + Math.cos(rot) * off, z: z - Math.sin(rot) * off, r: w / 4 + 0.5 },
        { x: x - Math.cos(rot) * off, z: z + Math.sin(rot) * off, r: w / 4 + 0.5 },
      );
    }

    // Ruínas (torres baixas) nas bordas.
    const ruinMat = new THREE.MeshLambertMaterial({ color: 0x5d6258 });
    for (let i = 0; i < 5; i++) {
      const h = 4 + rng() * 5;
      const ruin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, h, 7), ruinMat);
      const ang = rng() * Math.PI * 2;
      const dist = ARENA - 4 - rng() * 6;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      ruin.position.set(x, h / 2, z);
      this.scene.add(ruin);
      this.solidMeshes.push(ruin);
      this.colliders.push({ x, z, r: 2.3 });
    }
  }

  private seeded(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ── Fuzil em primeira pessoa ─────────────────────────────────────────
  private buildGun() {
    this.gun = new THREE.Group();
    const part = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      this.gun.add(m);
      return m;
    };
    part(new THREE.BoxGeometry(0.07, 0.09, 0.34), 0x23251f, 0, 0, 0); // ferrolho
    part(new THREE.BoxGeometry(0.045, 0.045, 0.32), 0x141511, 0, 0.012, -0.31); // cano
    part(new THREE.BoxGeometry(0.06, 0.07, 0.18), 0x2e2a22, 0, -0.012, -0.16); // guarda-mão
    part(new THREE.BoxGeometry(0.05, 0.15, 0.08), 0x1c1e19, 0, -0.11, 0.03); // carregador
    part(new THREE.BoxGeometry(0.06, 0.1, 0.16), 0x33301f, 0, -0.025, 0.22); // coronha
    part(new THREE.BoxGeometry(0.018, 0.045, 0.06), 0x121310, 0, 0.065, -0.04); // alça de mira

    // clarão de boca: plano aditivo no fim do cano + luz pontual
    this.muzzleFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({
        color: 0xffe9a0,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.muzzleFlash.position.set(0, 0.012, -0.5);
    this.muzzleFlash.visible = false;
    this.gun.add(this.muzzleFlash);

    this.muzzleLight = new THREE.PointLight(0xffc966, 0, 7);
    this.muzzleLight.position.set(0, 0.012, -0.45);
    this.gun.add(this.muzzleLight);

    this.gun.position.set(0.32, -0.28, -0.55);
    this.camera.add(this.gun);
  }

  // ── Soldado inimigo v2 (colete, braços, fuzil, pernas animadas) ─────
  private buildSoldier(): { root: THREE.Group; meshes: THREE.Mesh[]; legs: [THREE.Mesh, THREE.Mesh] } {
    const root = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const camo = CAMO_COLORS[Math.floor(Math.random() * CAMO_COLORS.length)];
    const dark = new THREE.Color(camo).multiplyScalar(0.65).getHex();
    const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];

    const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      root.add(m);
      meshes.push(m);
      return m;
    };

    // pernas com pivô no quadril (geometria deslocada) para animar a marcha
    const legGeo = new THREE.BoxGeometry(0.19, 0.62, 0.23);
    legGeo.translate(0, -0.31, 0);
    const legL = add(legGeo, dark, -0.14, 0.64, 0);
    const legR = add(legGeo.clone(), dark, 0.14, 0.64, 0);
    add(new THREE.BoxGeometry(0.2, 0.08, 0.3), 0x1d1d18, -0.14, 0.04, 0.03); // botas
    add(new THREE.BoxGeometry(0.2, 0.08, 0.3), 0x1d1d18, 0.14, 0.04, 0.03);

    add(new THREE.BoxGeometry(0.6, 0.64, 0.32), camo, 0, 1.0, 0); // tronco
    add(new THREE.BoxGeometry(0.64, 0.34, 0.38), 0x2c3226, 0, 1.06, 0); // colete
    add(new THREE.BoxGeometry(0.16, 0.1, 0.12), 0x23251f, -0.16, 1.12, -0.22); // bolsos do colete
    add(new THREE.BoxGeometry(0.16, 0.1, 0.12), 0x23251f, 0.16, 1.12, -0.22);

    // braços apontando o fuzil para frente
    add(new THREE.BoxGeometry(0.13, 0.13, 0.46), camo, 0.26, 1.16, 0.16); // braço direito
    add(new THREE.BoxGeometry(0.12, 0.12, 0.34), camo, -0.08, 1.1, 0.3); // braço esquerdo (apoio)
    add(new THREE.BoxGeometry(0.07, 0.07, 0.09), skin, 0.22, 1.16, 0.36); // mãos
    add(new THREE.BoxGeometry(0.07, 0.07, 0.09), skin, -0.05, 1.1, 0.44);

    // fuzil
    add(new THREE.BoxGeometry(0.09, 0.11, 0.62), 0x1c1f1a, 0.1, 1.16, 0.38);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.3), 0x121310, 0.1, 1.18, 0.78); // cano
    add(new THREE.BoxGeometry(0.05, 0.13, 0.07), 0x151712, 0.1, 1.06, 0.32); // carregador

    // cabeça + capacete com aba
    add(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin, 0, 1.48, 0);
    add(new THREE.BoxGeometry(0.4, 0.17, 0.44), dark, 0, 1.68, 0);
    add(new THREE.BoxGeometry(0.44, 0.045, 0.5), dark, 0, 1.6, 0.02);

    return { root, meshes, legs: [legL, legR] };
  }

  // ── Estado / ondas ───────────────────────────────────────────────────
  private reset() {
    for (const e of this.enemies) this.scene.remove(e.root);
    for (const t of this.tracers) this.scene.remove(t.line);
    for (const f of this.flashes) this.scene.remove(f.mesh);
    this.enemies = [];
    this.tracers = [];
    this.flashes = [];

    this.halfLives = MAX_HALF_LIVES;
    this.ammo = MAG_SIZE;
    this.reloadEnd = 0;
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.over = false;
    this.gameTime = 0;
    this.velY = 0;
    this.firing = false;
    // gameTime volta a 0: timers absolutos precisam zerar junto, senão o
    // clarão fica preso ligado e o tiro é recusado até o relógio alcançá-los
    this.nextFireAt = 0;
    this.muzzleUntil = 0;
    this.gunKick = 0;
    this.shake = 0;
    this.startedAt = performance.now();
    this.audio.setHeartbeat(false);

    this.playerRig.position.set(0, EYE_Y, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.nextWaveAt = this.gameTime + 1.2;
    this.pushHud(true);
  }

  private spawnWave() {
    this.wave += 1;
    this.cb.onWave(this.wave);
    this.audio.waveHorn();
    const count = 3 + this.wave * 2;
    for (let i = 0; i < count; i++) {
      const { root, meshes, legs } = this.buildSoldier();
      const ang = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 18;
      const px = this.playerRig.position.x + Math.cos(ang) * dist;
      const pz = this.playerRig.position.z + Math.sin(ang) * dist;
      root.position.set(
        THREE.MathUtils.clamp(px, -ARENA + 3, ARENA - 3),
        0,
        THREE.MathUtils.clamp(pz, -ARENA + 3, ARENA - 3),
      );
      this.scene.add(root);
      const enemy: Enemy = {
        root,
        meshes,
        legs,
        hp: ENEMY_HP + Math.floor(this.wave / 3) * 10,
        speed: Math.min(5, 2.6 + this.wave * 0.18 + Math.random() * 0.8),
        stopDist: 13 + Math.random() * 9,
        nextShot: this.gameTime + 1 + Math.random() * 1.5,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeUntil: this.gameTime + 1 + Math.random() * 2,
        hitUntil: 0,
        walkPhase: Math.random() * Math.PI * 2,
        dead: false,
        removeAt: 0,
      };
      for (const m of meshes) m.userData.enemy = enemy;
      this.enemies.push(enemy);
    }
  }

  // ── Input ────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyR") this.reload();
    if (e.code === "Space") {
      e.preventDefault();
      this.jump();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked()) return;
    this.yaw -= e.movementX * MOUSE_SENS;
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * MOUSE_SENS, -1.45, 1.45);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && this.locked()) this.firing = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.firing = false;
  };

  private onLockChange = () => {
    this.cb.onLock(this.locked());
    if (!this.locked()) this.firing = false;
  };

  // Toque: metade esquerda = joystick de andar, metade direita = mirar.
  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    this.audio.resume();
    const rect = this.renderer.domElement.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const x = t.clientX - rect.left;
      if (x < rect.width / 2 && this.moveTouch.id === -1) {
        this.moveTouch = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
      } else if (this.lookTouch.id === -1) {
        this.lookTouch = { id: t.identifier, lx: t.clientX, ly: t.clientY };
      }
    }
  };
  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveTouch.id) {
        const dx = t.clientX - this.moveTouch.ox;
        const dy = t.clientY - this.moveTouch.oy;
        const len = Math.hypot(dx, dy) || 1;
        const cap = Math.min(len, 48);
        this.moveTouch.dx = (dx / len) * (cap / 48);
        this.moveTouch.dy = (dy / len) * (cap / 48);
      } else if (t.identifier === this.lookTouch.id) {
        this.yaw -= (t.clientX - this.lookTouch.lx) * TOUCH_LOOK_SENS;
        this.pitch = THREE.MathUtils.clamp(
          this.pitch - (t.clientY - this.lookTouch.ly) * TOUCH_LOOK_SENS,
          -1.45,
          1.45,
        );
        this.lookTouch.lx = t.clientX;
        this.lookTouch.ly = t.clientY;
      }
    }
  };
  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveTouch.id) this.moveTouch = { id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
      if (t.identifier === this.lookTouch.id) this.lookTouch = { id: -1, lx: 0, ly: 0 };
    }
  };

  private bindEvents() {
    const el = this.renderer.domElement;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    el.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onLockChange);
    el.addEventListener("touchstart", this.onTouchStart, { passive: false });
    el.addEventListener("touchmove", this.onTouchMove, { passive: false });
    el.addEventListener("touchend", this.onTouchEnd);
    el.addEventListener("touchcancel", this.onTouchEnd);
  }

  private unbindEvents() {
    const el = this.renderer.domElement;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    el.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    el.removeEventListener("touchstart", this.onTouchStart);
    el.removeEventListener("touchmove", this.onTouchMove);
    el.removeEventListener("touchend", this.onTouchEnd);
    el.removeEventListener("touchcancel", this.onTouchEnd);
  }

  private locked() {
    return document.pointerLockElement === this.renderer.domElement;
  }

  lock() {
    this.audio.resume();
    if (this.isTouch || this.locked()) return;
    try {
      // Em alguns browsers retorna Promise; rejeição (lock negado) não pode estourar.
      const p = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* lock negado */
    }
  }

  setFiring(f: boolean) {
    this.firing = f;
  }

  setSound(on: boolean) {
    this.audio.setEnabled(on);
  }

  private jump() {
    if (this.over) return;
    if (this.playerRig.position.y <= EYE_Y + 0.01) this.velY = JUMP_V;
  }

  reload() {
    if (this.over || this.reloadEnd > 0 || this.ammo === MAG_SIZE) return;
    this.audio.reload();
    this.reloadEnd = this.gameTime + RELOAD_S;
    this.pushHud(true);
  }

  // ── Tiro ─────────────────────────────────────────────────────────────
  private shoot() {
    if (this.ammo <= 0) {
      this.audio.emptyClick();
      this.reload();
      return;
    }
    this.ammo -= 1;
    this.audio.playerShot();

    // recuo visual: arma chuta + clarão de boca
    this.gunKick = 1;
    this.muzzleUntil = this.gameTime + 0.045;

    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const targets: THREE.Object3D[] = [...this.solidMeshes];
    for (const e of this.enemies) if (!e.dead) targets.push(...e.meshes);
    const hits = this.raycaster.intersectObjects(targets, false);

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const muzzle = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzle);
    let end = origin.clone().add(dir.multiplyScalar(150));

    const hit = hits[0];
    if (hit) {
      end = hit.point;
      const enemy = hit.object.userData.enemy as Enemy | undefined;
      if (enemy && !enemy.dead) {
        enemy.hp -= BULLET_DMG;
        enemy.hitUntil = this.gameTime + 0.12;
        this.spawnFlash(hit.point, 0xcc2222);
        if (enemy.hp <= 0) {
          this.killEnemy(enemy);
          this.audio.kill();
          this.cb.onHit(true);
        } else {
          this.audio.hitMarker();
          this.cb.onHit(false);
        }
      } else {
        this.spawnFlash(hit.point, 0xd8c98a);
      }
    }

    this.spawnTracer(muzzle, end, 0xffe08a);
    // recuo da mira
    this.pitch = Math.min(1.45, this.pitch + 0.006);
    this.yaw += (Math.random() - 0.5) * 0.004;
    this.pushHud(true);
  }

  private killEnemy(enemy: Enemy) {
    enemy.dead = true;
    enemy.removeAt = this.gameTime + 1.4;
    this.kills += 1;
    this.score += 100;
    this.pushHud(true);
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, until: this.gameTime + 0.07 });
  }

  private spawnFlash(at: THREE.Vector3, color: number) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.flashes.push({ mesh, until: this.gameTime + 0.16 });
  }

  // ── Loop ─────────────────────────────────────────────────────────────
  private loop = () => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // No desktop a simulação pausa sem pointer lock (menu/aba). No toque roda sempre.
    const running = !this.over && (this.isTouch || this.locked());
    if (running) this.tick(dt);

    // arma: recuo e clarão
    this.gunKick *= Math.exp(-dt * 13);
    this.gun.position.z = -0.55 + this.gunKick * 0.085;
    this.gun.rotation.x = this.gunKick * 0.07;
    const flashOn = this.gameTime < this.muzzleUntil;
    this.muzzleFlash.visible = flashOn;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = flashOn ? 2.2 : 0;

    // tremor de câmera ao levar dano
    this.shake *= Math.exp(-dt * 7);
    const jx = (Math.random() - 0.5) * this.shake;
    const jz = (Math.random() - 0.5) * this.shake;

    this.playerRig.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + jx;
    this.camera.rotation.z = jz * 0.6;
    this.renderer.render(this.scene, this.camera);
  };

  private tick(dt: number) {
    this.gameTime += dt;

    // ── movimento do jogador
    let mx = 0;
    let mz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) mz -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) mz += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (this.moveTouch.id !== -1) {
      mx += this.moveTouch.dx;
      mz += this.moveTouch.dy;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    // Gira o input (mx, mz) pelo yaw: câmera olha para -Z quando yaw = 0.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const pos = this.playerRig.position;
    pos.x += (mx * cos + mz * sin) * PLAYER_SPEED * dt;
    pos.z += (-mx * sin + mz * cos) * PLAYER_SPEED * dt;
    pos.x = THREE.MathUtils.clamp(pos.x, -ARENA + 1.5, ARENA - 1.5);
    pos.z = THREE.MathUtils.clamp(pos.z, -ARENA + 1.5, ARENA - 1.5);

    // gravidade / pulo
    this.velY -= GRAVITY * dt;
    pos.y += this.velY * dt;
    if (pos.y < EYE_Y) {
      pos.y = EYE_Y;
      this.velY = 0;
    }

    // colisão com obstáculos (empurra pra fora)
    this.resolveCollisions(pos, 0.8);

    // ── tiro automático segurando
    if (this.reloadEnd > 0 && this.gameTime >= this.reloadEnd) {
      this.reloadEnd = 0;
      this.ammo = MAG_SIZE;
      this.pushHud(true);
    }
    if (this.firing && this.reloadEnd === 0 && this.gameTime >= this.nextFireAt) {
      this.nextFireAt = this.gameTime + FIRE_INTERVAL;
      this.shoot();
    }

    // ── inimigos
    let alive = 0;
    for (const e of this.enemies) {
      if (e.dead) {
        // animação de queda
        e.root.rotation.x = Math.min(Math.PI / 2, e.root.rotation.x + dt * 4);
        continue;
      }
      alive += 1;
      const dx = pos.x - e.root.position.x;
      const dz = pos.z - e.root.position.z;
      const dist = Math.hypot(dx, dz);
      e.root.rotation.y = Math.atan2(dx, dz);

      // flash vermelho quando atingido
      const flashing = this.gameTime < e.hitUntil;
      for (const m of e.meshes) {
        (m.material as THREE.MeshLambertMaterial).emissive.setHex(flashing ? 0x7a1010 : 0x000000);
      }

      if (this.gameTime > e.strafeUntil) {
        e.strafeDir *= -1;
        e.strafeUntil = this.gameTime + 1 + Math.random() * 2;
      }

      let moving = true;
      if (dist > e.stopDist) {
        e.root.position.x += (dx / dist) * e.speed * dt;
        e.root.position.z += (dz / dist) * e.speed * dt;
      } else {
        // perto: anda de lado pra ser alvo difícil
        e.root.position.x += (-dz / dist) * e.strafeDir * e.speed * 0.5 * dt;
        e.root.position.z += (dx / dist) * e.strafeDir * e.speed * 0.5 * dt;
        moving = false;
      }

      // marcha: pernas balançam (mais devagar no strafe)
      e.walkPhase += dt * (moving ? 9 : 5);
      const swing = Math.sin(e.walkPhase) * (moving ? 0.5 : 0.22);
      e.legs[0].rotation.x = swing;
      e.legs[1].rotation.x = -swing;
      e.root.position.y = Math.abs(Math.sin(e.walkPhase)) * 0.05;

      this.resolveCollisions(e.root.position, 0.6);
      e.root.position.x = THREE.MathUtils.clamp(e.root.position.x, -ARENA + 1, ARENA - 1);
      e.root.position.z = THREE.MathUtils.clamp(e.root.position.z, -ARENA + 1, ARENA - 1);

      // tiro inimigo
      if (dist < 42 && this.gameTime >= e.nextShot) {
        e.nextShot = this.gameTime + 1.1 + Math.random() * 1.4;
        this.enemyShoot(e, dist);
      }
    }

    // remove corpos
    this.enemies = this.enemies.filter((e) => {
      if (e.dead && this.gameTime >= e.removeAt) {
        this.scene.remove(e.root);
        return false;
      }
      return true;
    });

    // ── ondas
    if (alive === 0 && this.nextWaveAt === 0) {
      // onda eliminada: bônus + recupera 1 coração e agenda a próxima
      if (this.wave > 0) {
        this.score += 250;
        this.halfLives = Math.min(MAX_HALF_LIVES, this.halfLives + 2);
        this.audio.setHeartbeat(this.halfLives <= 4);
      }
      this.nextWaveAt = this.gameTime + 2.5;
      this.pushHud(true);
    }
    if (this.nextWaveAt > 0 && this.gameTime >= this.nextWaveAt) {
      this.nextWaveAt = 0;
      this.spawnWave();
      this.pushHud(true);
    }

    // ── efeitos
    this.tracers = this.tracers.filter((t) => {
      if (this.gameTime >= t.until) {
        this.scene.remove(t.line);
        return false;
      }
      return true;
    });
    this.flashes = this.flashes.filter((f) => {
      const left = f.until - this.gameTime;
      if (left <= 0) {
        this.scene.remove(f.mesh);
        return false;
      }
      f.mesh.scale.setScalar(1 + (0.16 - left) * 10);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = left / 0.16;
      return true;
    });

    this.pushHud(false);
  }

  private enemyShoot(e: Enemy, dist: number) {
    const muzzle = e.root.position.clone().add(new THREE.Vector3(0, 1.18, 0));
    // chance de acerto cai com a distância
    const pHit = THREE.MathUtils.clamp(0.42 - dist * 0.006, 0.08, 0.42);
    const hitPlayer = Math.random() < pHit;
    const target = this.playerRig.position.clone();
    if (!hitPlayer) {
      target.x += (Math.random() - 0.5) * 4;
      target.y += (Math.random() - 0.3) * 2.5;
      target.z += (Math.random() - 0.5) * 4;
    }
    this.spawnTracer(muzzle, target, 0xff7b54);
    this.spawnFlash(muzzle, 0xffd27a);

    // som posicional: pan conforme o lado de onde veio o tiro
    const local = e.root.position.clone();
    this.camera.worldToLocal(local);
    const pan = THREE.MathUtils.clamp(local.normalize().x, -1, 1);
    this.audio.enemyShot(pan, dist);

    if (hitPlayer) {
      // cada tiro inimigo tira MEIO coração (2 tiros = 1 vida)
      this.halfLives -= 1;
      this.shake = 0.06;
      this.audio.damage();
      this.audio.setHeartbeat(!this.over && this.halfLives > 0 && this.halfLives <= 4);
      this.cb.onDamage();
      this.pushHud(true);
      if (this.halfLives <= 0) this.gameOver();
    }
  }

  private resolveCollisions(pos: THREE.Vector3, radius: number) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d > 0.0001 && d < min) {
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
  }

  private gameOver() {
    if (this.over) return;
    this.over = true;
    this.halfLives = 0;
    this.firing = false;
    this.audio.setHeartbeat(false);
    this.audio.gameOver();
    this.pushHud(true);
    if (this.locked()) document.exitPointerLock();
    const durationSeconds = Math.round((performance.now() - this.startedAt) / 1000);
    this.cb.onGameOver({ score: this.score, wave: this.wave, kills: this.kills, durationSeconds });
  }

  private pushHud(force: boolean) {
    const hud: WarHud = {
      lives: Math.max(0, this.halfLives),
      maxLives: MAX_HALF_LIVES,
      ammo: this.ammo,
      reloading: this.reloadEnd > 0,
      score: this.score,
      wave: this.wave,
      enemiesLeft: this.enemies.filter((e) => !e.dead).length,
      kills: this.kills,
    };
    const key = JSON.stringify(hud);
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    this.cb.onHud(hud);
  }

  restart() {
    this.reset();
  }

  private resize() {
    const w = this.parent.clientWidth || 900;
    const h = this.parent.clientHeight || Math.round((w * 9) / 16);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.unbindEvents();
    this.audio.destroy();
    if (this.locked()) document.exitPointerLock();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export function createWarGame(parent: HTMLElement, callbacks: WarCallbacks): WarGameApi {
  const game = new WarGame(parent, callbacks);
  return {
    lock: () => game.lock(),
    restart: () => game.restart(),
    setFiring: (f) => game.setFiring(f),
    reload: () => game.reload(),
    setSound: (on) => game.setSound(on),
    isTouch: game.isTouch,
    destroy: () => game.destroy(),
  };
}
