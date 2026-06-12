// Sons do Warfront sintetizados com WebAudio — sem assets externos.
// Tudo passa por um master gain; desligar o som zera o ganho (e corta o ambiente).

export class WarAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private boomTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
    }
    if (on) this.resume();
  }

  isEnabled() {
    return this.enabled;
  }

  // Chamar num gesto do usuário (clique/toque) — autoplay policy.
  resume() {
    this.ensure();
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
  }

  private ensure() {
    if (this.ctx || this.destroyed || typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  private ready(): boolean {
    this.ensure();
    return !!this.ctx && !!this.master && this.enabled;
  }

  private noise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Rajada de ruído filtrado com envelope — base de tiros e impactos. */
  private burst(opts: {
    dur: number;
    type: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    peak: number;
    pan?: number;
    at?: number;
  }) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise(opts.dur);
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    src.connect(filter).connect(gain).connect(pan).connect(this.master!);
    src.start(t);
    src.stop(t + opts.dur + 0.05);
  }

  /** Tom com glide e envelope — corpos graves, blips e cornetas. */
  private tone(opts: {
    type: OscillatorType;
    freq: number;
    freqEnd?: number;
    dur: number;
    peak: number;
    at?: number;
    pan?: number;
  }) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + opts.dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    osc.connect(gain).connect(pan).connect(this.master!);
    osc.start(t);
    osc.stop(t + opts.dur + 0.05);
  }

  // ── Eventos do jogo ─────────────────────────────────────────────────
  playerShot() {
    // estalo seco + corpo grave (recuo)
    this.burst({ dur: 0.16, type: "bandpass", freq: 1900, freqEnd: 350, peak: 0.42 });
    this.burst({ dur: 0.08, type: "highpass", freq: 4500, peak: 0.18 });
    this.tone({ type: "triangle", freq: 160, freqEnd: 52, dur: 0.14, peak: 0.5 });
  }

  enemyShot(pan: number, dist: number) {
    const vol = Math.max(0.06, Math.min(0.3, 9 / (dist + 6)));
    this.burst({ dur: 0.14, type: "bandpass", freq: 900, freqEnd: 220, peak: vol, pan });
    this.tone({ type: "triangle", freq: 110, freqEnd: 45, dur: 0.12, peak: vol * 0.8, pan });
  }

  hitMarker() {
    this.tone({ type: "square", freq: 1900, dur: 0.045, peak: 0.12 });
  }

  kill() {
    this.tone({ type: "square", freq: 1300, freqEnd: 660, dur: 0.1, peak: 0.16 });
    this.tone({ type: "square", freq: 880, freqEnd: 440, dur: 0.12, peak: 0.14, at: 0.07 });
  }

  damage() {
    this.burst({ dur: 0.22, type: "lowpass", freq: 320, peak: 0.5 });
    this.tone({ type: "sine", freq: 95, freqEnd: 50, dur: 0.25, peak: 0.45 });
  }

  reload() {
    this.burst({ dur: 0.05, type: "highpass", freq: 2800, peak: 0.22 });
    this.burst({ dur: 0.05, type: "highpass", freq: 2200, peak: 0.26, at: 0.42 });
    this.tone({ type: "square", freq: 420, dur: 0.04, peak: 0.08, at: 0.46 });
  }

  emptyClick() {
    this.burst({ dur: 0.03, type: "highpass", freq: 3200, peak: 0.12 });
  }

  waveHorn() {
    this.tone({ type: "sawtooth", freq: 196, freqEnd: 294, dur: 0.7, peak: 0.12 });
    this.tone({ type: "sawtooth", freq: 98, freqEnd: 147, dur: 0.7, peak: 0.1 });
  }

  gameOver() {
    this.tone({ type: "sawtooth", freq: 220, freqEnd: 60, dur: 1.1, peak: 0.25 });
    this.burst({ dur: 0.8, type: "lowpass", freq: 200, peak: 0.3, at: 0.1 });
  }

  /** Batimento cardíaco quando a vida está no fim. */
  setHeartbeat(on: boolean) {
    if (on && !this.heartbeatTimer) {
      const beat = () => {
        this.tone({ type: "sine", freq: 58, freqEnd: 40, dur: 0.1, peak: 0.4 });
        this.tone({ type: "sine", freq: 52, freqEnd: 38, dur: 0.09, peak: 0.28, at: 0.18 });
      };
      beat();
      this.heartbeatTimer = setInterval(beat, 820);
    } else if (!on && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Ambiente de guerra: vento grave + explosões distantes ───────────
  private startAmbient() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(2.5);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 150;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();

    const scheduleBoom = () => {
      if (this.destroyed) return;
      this.boomTimer = setTimeout(() => {
        this.burst({
          dur: 1.1,
          type: "lowpass",
          freq: 90,
          peak: 0.14,
          pan: Math.random() * 1.6 - 0.8,
        });
        scheduleBoom();
      }, 3500 + Math.random() * 6500);
    };
    scheduleBoom();
  }

  destroy() {
    this.destroyed = true;
    if (this.boomTimer) clearTimeout(this.boomTimer);
    this.setHeartbeat(false);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }
}
