// Geração PROCEDURAL das fases. Cada fase tem um "orçamento" de armadilhas
// (LevelConfig). generateLevel() sorteia posições/tipos a cada chamada, com
// restrições que garantem que a fase é sempre atravessável:
//  - buracos nunca maiores que o alcance do pulo;
//  - zona de spawn e zona da bandeira sempre livres de armadilha;
//  - distância mínima entre perigos de chão (sempre há janela de passagem);
//  - lava/picos só sobre chão sólido, com sobra pra correr e pousar.

export const GROUND_Y = 560; // topo do chão
export const WORLD_H = 600;
export const GROUND_H = 40;

const SPAWN_X = 100;
const SPAWN_Y = 450;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelDef {
  name: string;
  worldW: number;
  spawnX: number;
  spawnY: number;
  goalX: number;
  ground: Rect[];
  platforms: Rect[];
  spikes: number[];
  fake: Rect[];
  hiddenSpikes: { x: number; triggerX: number }[];
  falling: { x: number; triggerX: number }[];
  lava: { x: number; w: number }[];
  fireballs: { x: number; y: number; vx: number; vy: number; everyMs: number }[];
  flamethrowers: {
    x: number;
    y: number;
    w: number;
    h: number;
    onMs: number;
    offMs: number;
    startDelay?: number;
  }[];
  attackers: { x: number; y: number; range: number; speed: number }[];
}

export interface LevelConfig {
  name: string;
  worldW: number;
  maxGap: number; // largura máxima de buraco (mantém puláveis)
  counts: {
    spikes: number;
    fake: number;
    hidden: number;
    falling: number;
    lava: number;
    fireballs: number;
    flamethrowers: number;
    attackers: number;
  };
}

// Curva de dificuldade: a "densidade" e a variedade de armadilhas crescem por fase.
export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    name: "Aquecimento",
    worldW: 2200,
    maxGap: 130,
    counts: { spikes: 3, fake: 0, hidden: 0, falling: 0, lava: 0, fireballs: 0, flamethrowers: 0, attackers: 0 },
  },
  {
    name: "Pegadinhas",
    worldW: 2600,
    maxGap: 135,
    counts: { spikes: 4, fake: 2, hidden: 2, falling: 0, lava: 0, fireballs: 0, flamethrowers: 0, attackers: 0 },
  },
  {
    name: "O chão é lava",
    worldW: 3000,
    maxGap: 140,
    counts: { spikes: 4, fake: 1, hidden: 1, falling: 2, lava: 3, fireballs: 0, flamethrowers: 0, attackers: 0 },
  },
  {
    name: "Linha de fogo",
    worldW: 3400,
    maxGap: 140,
    counts: { spikes: 4, fake: 1, hidden: 1, falling: 1, lava: 2, fireballs: 2, flamethrowers: 2, attackers: 0 },
  },
  {
    name: "Inferno",
    worldW: 4000,
    maxGap: 145,
    counts: { spikes: 5, fake: 2, hidden: 3, falling: 2, lava: 3, fireballs: 3, flamethrowers: 3, attackers: 2 },
  },
];

// ── Helpers de aleatoriedade ───────────────────────────────────────────
const rint = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;
const g = (x: number, w: number): Rect => ({ x, y: GROUND_Y, w, h: GROUND_H });

export function generateLevel(cfg: LevelConfig): LevelDef {
  // 1) Chão segmentado com buracos puláveis. Coletamos spans sólidos e gaps.
  const ground: Rect[] = [];
  const spans: Array<[number, number]> = [];
  const gaps: Array<[number, number]> = [];

  let x = rint(480, 560); // primeiro segmento: zona de spawn segura
  ground.push(g(0, x));
  spans.push([0, x]);

  while (x < cfg.worldW - 520) {
    const gap = rint(95, cfg.maxGap);
    gaps.push([x, x + gap]);
    x += gap;
    const w = rint(170, 340);
    if (x + w > cfg.worldW - 360) break;
    ground.push(g(x, w));
    spans.push([x, x + w]);
    x += w;
  }

  // Buraco final + segmento amplo da bandeira (sempre alcançável e seguro).
  const fgap = rint(95, cfg.maxGap);
  gaps.push([x, x + fgap]);
  const finalStart = x + fgap;
  const finalW = cfg.worldW - finalStart;
  ground.push(g(finalStart, finalW));
  spans.push([finalStart, finalStart + finalW]);
  const goalX = cfg.worldW - 70;

  // 2) Posicionamento de perigos de chão com distância mínima entre si.
  const placed: number[] = [];
  const farEnough = (px: number, min: number) => placed.every((q) => Math.abs(q - px) >= min);

  const usableSpans = (needW: number) =>
    spans.filter(([s, e]) => e - s >= needW + 60 && s > SPAWN_X + 170 && e < goalX - 110);

  // Retorna o X inicial de um espaço livre (largura needW) sobre chão sólido.
  const tryGroundX = (needW = 0, min = 120): number | null => {
    for (let i = 0; i < 16; i++) {
      const cand = usableSpans(needW);
      if (!cand.length) return null;
      const [s, e] = pick(cand);
      const lo = s + 30;
      const hi = e - 30 - needW;
      if (hi <= lo) continue;
      const px = rint(lo, hi);
      const center = px + needW / 2;
      if (farEnough(center, min)) {
        placed.push(center);
        return px;
      }
    }
    return null;
  };

  const c = cfg.counts;

  // Picos visíveis.
  const spikes: number[] = [];
  for (let i = 0; i < c.spikes; i++) {
    const px = tryGroundX(0, 110);
    if (px !== null) spikes.push(px);
  }

  // Lava: precisa de largura e de chão sobrando dos lados.
  const lava: { x: number; w: number }[] = [];
  for (let i = 0; i < c.lava; i++) {
    const w = rint(70, 150);
    const px = tryGroundX(w, w + 60);
    if (px !== null) lava.push({ x: px, w });
  }

  // Picos escondidos (sobem no gatilho).
  const hiddenSpikes: { x: number; triggerX: number }[] = [];
  for (let i = 0; i < c.hidden; i++) {
    const px = tryGroundX(0, 130);
    if (px !== null) hiddenSpikes.push({ x: px, triggerX: px - rint(55, 90) });
  }

  // Blocos que caem.
  const falling: { x: number; triggerX: number }[] = [];
  for (let i = 0; i < c.falling; i++) {
    const px = tryGroundX(0, 140);
    if (px !== null) falling.push({ x: px, triggerX: px - rint(55, 95) });
  }

  // Lança-chamas (ciclo liga/desliga — sempre há janela pra passar).
  const flamethrowers: LevelDef["flamethrowers"] = [];
  for (let i = 0; i < c.flamethrowers; i++) {
    const px = tryGroundX(40, 150);
    if (px !== null) {
      flamethrowers.push({
        x: px + 20,
        y: GROUND_Y - 40,
        w: 40,
        h: 80,
        onMs: rint(600, 950),
        offMs: rint(700, 1100),
        startDelay: rint(0, 700),
      });
    }
  }

  // Atacantes que patrulham (precisam de chão largo).
  const attackers: LevelDef["attackers"] = [];
  for (let i = 0; i < c.attackers; i++) {
    const range = rint(100, 170);
    const px = tryGroundX(range * 2, range * 2 + 40);
    if (px !== null) {
      attackers.push({ x: px + range, y: GROUND_Y - 20, range, speed: rint(110, 160) });
    }
  }

  // Plataformas falsas: ISCAS no meio de um buraco (que já é pulável sem elas).
  const fake: Rect[] = [];
  const wideGaps = gaps.filter(([s, e]) => e - s >= 95);
  for (let i = 0; i < c.fake && wideGaps.length; i++) {
    const [s, e] = pick(wideGaps);
    const mid = (s + e) / 2 - 40;
    fake.push({ x: mid, y: GROUND_Y, w: 80, h: GROUND_H });
  }

  // Bolas de fogo: emissores aéreos (horizontais ou verticais).
  const fireballs: LevelDef["fireballs"] = [];
  for (let i = 0; i < c.fireballs; i++) {
    const fx = rint(SPAWN_X + 260, goalX - 160);
    if (chance(0.6)) {
      // horizontal, varrendo para a esquerda
      fireballs.push({ x: fx, y: rint(330, 470), vx: -rint(160, 240), vy: 0, everyMs: rint(1000, 1700) });
    } else {
      // vertical, descendo
      fireballs.push({ x: fx, y: rint(280, 360), vx: 0, vy: rint(220, 300), everyMs: rint(1000, 1600) });
    }
  }

  // Plataformas reais ocasionais sobre buracos (rota alternativa/variedade).
  const platforms: Rect[] = [];
  for (const [s, e] of gaps) {
    if (e - s >= 110 && chance(0.35)) {
      platforms.push({ x: (s + e) / 2 - 30, y: GROUND_Y - rint(80, 110), w: 60, h: 20 });
    }
  }

  return {
    name: cfg.name,
    worldW: cfg.worldW,
    spawnX: SPAWN_X,
    spawnY: SPAWN_Y,
    goalX,
    ground,
    platforms,
    spikes,
    fake,
    hiddenSpikes,
    falling,
    lava,
    fireballs,
    flamethrowers,
    attackers,
  };
}
