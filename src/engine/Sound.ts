import type { SfxName } from './sfx';

const KEY = 'pale-lamps-sound';

/**
 * All sound is synthesised: no audio files to load. A river-and-wind bed that changes
 * with the hour and with being indoors, and short effects for interface and play.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private river!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  enabled: boolean;

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* storage unavailable */
    }
    this.enabled = saved !== 'off';
    window.addEventListener('sfx', (e) => this.play((e as CustomEvent<SfxName>).detail));
    // Browsers only allow audio after a gesture.
    const unlock = () => {
      this.start();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock);
    document.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.play('click');
    });
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(KEY, this.enabled ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime, 0.1);
    return this.enabled;
  }

  private start(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(ctx.destination);

    // Brown noise, two seconds, looped.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }

    const loop = (gain: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      src.start();
      return { src, g };
    };
    // River: low, steady lapping.
    const r = loop(0);
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 380;
    r.g.connect(rf).connect(this.master);
    this.river = r.g;
    // Wind: band-passed, slowly breathing.
    const w = loop(0);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.8;
    w.g.connect(this.windFilter).connect(this.master);
    this.wind = w.g;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(this.windFilter.frequency);
    lfo.start();
  }

  /** Called every frame: louder wind at night, muffled indoors. */
  setAmbience(hour: number, indoors: boolean, busy: boolean): void {
    if (!this.ctx) return;
    const night = hour >= 20 || hour < 6 ? 1 : 0;
    const t = this.ctx.currentTime;
    this.river.gain.setTargetAtTime(busy ? 0.05 : indoors ? 0.05 : 0.35, t, 0.5);
    this.wind.gain.setTargetAtTime(busy ? 0.02 : indoors ? 0.04 + night * 0.04 : 0.08 + night * 0.16, t, 0.8);
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(this.master);
      o.start(t + start);
      o.stop(t + start + dur + 0.02);
    };
    const burst = (dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass') => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random());
      src.stop(t + dur + 0.02);
    };
    switch (name) {
      case 'click': tone(660, 0, 0.05, 0.05, 'triangle'); break;
      case 'coin': tone(1320, 0, 0.12, 0.08); tone(1760, 0.07, 0.18, 0.07); break;
      case 'hit': burst(0.12, 0.9, 900); tone(90, 0, 0.15, 0.25, 'sine'); break;
      case 'hurt': burst(0.18, 0.7, 500); tone(70, 0, 0.2, 0.3, 'sine'); break;
      case 'drop': tone(110, 0, 0.18, 0.3, 'triangle'); burst(0.08, 0.4, 300); break;
      case 'splash': burst(0.5, 0.8, 1800, 'bandpass'); break;
      case 'pour': burst(0.25, 0.25, 2500, 'bandpass'); tone(880, 0.05, 0.08, 0.04); break;
      case 'bad': tone(220, 0, 0.18, 0.08, 'sawtooth'); tone(180, 0.08, 0.2, 0.06, 'sawtooth'); break;
      // A rising minor arpeggio with a bell on top: promotions and goals.
      case 'fanfare': [392, 466, 587, 784].forEach((f, i) => tone(f, i * 0.09, 0.6, 0.07, 'triangle')); tone(1568, 0.36, 1.2, 0.05); burst(0.8, 0.12, 4000, 'highpass'); break;
      case 'chime': [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.9, 0.05)); break;
      case 'flip': tone(1400, 0, 0.05, 0.04, 'triangle'); tone(2100, 0.08, 0.08, 0.03, 'triangle'); burst(0.06, 0.15, 5000, 'highpass'); break;
      case 'page': burst(0.22, 0.25, 3000, 'bandpass'); break;
      case 'tick': tone(3200, 0, 0.02, 0.05, 'square'); tone(3200, 0.12, 0.02, 0.04, 'square'); break;
    }
  }
}
