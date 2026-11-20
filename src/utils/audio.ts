/**
 * Trình phát âm thanh WebAudio API chiptune / pixel art
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private master: GainNode | null = null;
  public volume: number = 0.8;
  private lastPlayed: Record<string, number> = {};
  private canPlay(key: string, minMs: number): boolean {
    const now = Date.now();
    if (now - (this.lastPlayed[key] || 0) < minMs) return false;
    this.lastPlayed[key] = now;
    return true;
  }

  constructor() {
    try {
      const saved = localStorage.getItem('pixelEmpireVolume');
      if (saved !== null) {
        const n = parseFloat(saved);
        if (Number.isFinite(n)) this.volume = Math.max(0, Math.min(1, n));
      }
    } catch {}
  }

  private output(): AudioNode {
    const ctx = this.ctx as AudioContext;
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);
    }
    return this.master;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
    try { localStorage.setItem('pixelEmpireVolume', String(this.volume)); } catch {}
  }

  private tone(type: OscillatorType, f0: number, f1: number, delay: number, dur: number, vol: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.output());
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playClick() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  playAttack() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }

  playGeneralHorn() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [330, 440, 554, 660];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);

        gain.gain.setValueAtTime(0.12, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.18);

        osc.connect(gain);
        gain.connect(this.output());

        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.18);
      });
    } catch {}
  }

  playCapture() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.06);
      osc.frequency.setValueAtTime(783.99, now + 0.12);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start();
      osc.stop(now + 0.18);
    } catch {}
  }

  playBuild() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start();
      osc.stop(now + 0.15);
    } catch {}
  }

  playTruce() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [587.33, 739.99, 880];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.09, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);

        osc.connect(gain);
        gain.connect(this.output());

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.25);
      });
    } catch {}
  }

  playVictory() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.1, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.2);

        osc.connect(gain);
        gain.connect(this.output());

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.2);
      });
    } catch {}
  }

  playDefeat() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const notes = [400, 350, 300, 220];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.12, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.25);

        osc.connect(gain);
        gain.connect(this.output());

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.25);
      });
    } catch {}
  }

  playThunder() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      // Tần số rền sấm sét từ thấp xuống siêu trầm
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.7);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start(now);
      osc.stop(now + 0.75);
    } catch {}
  }

  playWarningSiren() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(587.33, now + 0.25);
      osc.frequency.linearRampToValueAtTime(880, now + 0.5);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {}
  }

  playMissileLaunch() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.35);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }

  playNukeExplosion() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      // Sóng xung kích siêu trầm
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 1.2);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start(now);
      osc.stop(now + 1.25);
    } catch {}
  }

  playAchievement() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);

        osc.connect(gain);
        gain.connect(this.output());

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.22);
      });
    } catch {}
  }

  playTitanRoar() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Tầng trầm chính (tiếng gầm sâu của Tà Thần)
      const oscLow = this.ctx.createOscillator();
      const gainLow = this.ctx.createGain();
      oscLow.type = 'sawtooth';
      oscLow.frequency.setValueAtTime(115, now);
      oscLow.frequency.exponentialRampToValueAtTime(52, now + 0.35);
      oscLow.frequency.exponentialRampToValueAtTime(34, now + 1.1);

      gainLow.gain.setValueAtTime(0.01, now);
      gainLow.gain.linearRampToValueAtTime(0.22, now + 0.12);
      gainLow.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

      oscLow.connect(gainLow);
      gainLow.connect(this.output());
      oscLow.start(now);
      oscLow.stop(now + 1.15);

      // Tầng rung cộng hưởng (hơi thở năng lượng hắc ám)
      const oscSub = this.ctx.createOscillator();
      const gainSub = this.ctx.createGain();
      oscSub.type = 'triangle';
      oscSub.frequency.setValueAtTime(72, now + 0.05);
      oscSub.frequency.exponentialRampToValueAtTime(26, now + 1.05);

      gainSub.gain.setValueAtTime(0.01, now + 0.05);
      gainSub.gain.linearRampToValueAtTime(0.18, now + 0.18);
      gainSub.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

      oscSub.connect(gainSub);
      gainSub.connect(this.output());
      oscSub.start(now + 0.05);
      oscSub.stop(now + 1.05);
    } catch {}
  }

  playBorderAlert() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [660, 520];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.08, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.11);

        osc.connect(gain);
        gain.connect(this.output());

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.11);
      });
    } catch {}
  }

  playTitanQ() {
    if (!this.enabled) return; this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 700, 180, 0, 0.18, 0.12); } catch {}
  }
  playTitanW() {
    if (!this.enabled) return; this.initContext(); if (!this.ctx) return;
    try { this.tone('square', 160, 90, 0, 0.45, 0.10); this.tone('triangle', 240, 120, 0.05, 0.4, 0.08); } catch {}
  }
  playTitanE() {
    if (!this.enabled) return; this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 300, 60, 0, 0.35, 0.12); this.tone('square', 110, 55, 0.1, 0.3, 0.09); } catch {}
  }
  playTitanUltCharge() {
    if (!this.enabled) return; this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 60, 520, 0, 3.0, 0.10); this.tone('triangle', 90, 700, 0, 3.0, 0.07); } catch {}
  }
  playTitanUlt() {
    if (!this.enabled) return; this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 140, 30, 0, 1.4, 0.2); this.tone('square', 80, 25, 0, 1.2, 0.15); this.tone('triangle', 400, 40, 0, 0.9, 0.1); } catch {}
  }
  playTitanDeath() {
    if (!this.enabled) return; this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 220, 28, 0, 1.8, 0.16); this.tone('triangle', 130, 24, 0.2, 1.6, 0.12); } catch {}
  }

  playAirLaunch() {
    if (!this.enabled) return;
    if (!this.canPlay('airLaunch', 300)) return;
    this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 150, 700, 0, 0.6, 0.07); this.tone('triangle', 300, 1100, 0.05, 0.55, 0.05); } catch {}
  }
  playAirStrike() {
    if (!this.enabled) return;
    if (!this.canPlay('airStrike', 120)) return;
    this.initContext(); if (!this.ctx) return;
    try { this.tone('sine', 900, 200, 0, 0.25, 0.06); this.tone('sawtooth', 120, 35, 0.2, 0.45, 0.16); this.tone('square', 80, 30, 0.2, 0.35, 0.10); } catch {}
  }
  playCannon() {
    if (!this.enabled) return;
    if (!this.canPlay('cannon', 700)) return;
    this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 220, 50, 0, 0.3, 0.14); this.tone('square', 90, 40, 0, 0.25, 0.10); } catch {}
  }
  playShipSunk() {
    if (!this.enabled) return;
    if (!this.canPlay('shipSunk', 300)) return;
    this.initContext(); if (!this.ctx) return;
    try { this.tone('sawtooth', 300, 40, 0, 1.2, 0.15); this.tone('triangle', 180, 30, 0.15, 1.0, 0.10); } catch {}
  }
}

export const soundManager = new SoundSystem();
