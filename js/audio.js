(function (global) {
  'use strict';

  const MT = (global.ManicTerrier = global.ManicTerrier || {});

  // Note frequencies (Hz)
  const N = {
    REST: 0,
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, Ds4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, Gs4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
  };

  // Upbeat jaunty 8-bit melody inspired by Huddersfield Town's "Smile Awhile" terrace anthem
  // Format: [leadFreq, bassFreq, stepsInEighths]
  // 4 bars + 4 bars + 4 bars + 4 bars (cheerful marching/music-hall bounce in C Major)
  const SMILE_AWHILE_TRACK = [
    // Phrase 1: "Smile awhile and give your face a rest..."
    [N.G4, N.C3, 2], [N.E4, N.G3, 1], [N.G4, N.C3, 1], [N.A4, N.G3, 2], [N.G4, N.C3, 2],
    [N.E4, N.G3, 1], [N.C4, N.C3, 1], [N.D4, N.G3, 1], [N.E4, N.C3, 1], [N.G4, N.G3, 4],
    // Phrase 2: "Raise your hands to the one you love the best..."
    [N.A4, N.F3, 2], [N.G4, N.C3, 1], [N.A4, N.F3, 1], [N.C5, N.C3, 2], [N.A4, N.F3, 2],
    [N.G4, N.C3, 1], [N.E4, N.G3, 1], [N.G4, N.C3, 1], [N.E4, N.G3, 1], [N.D4, N.G3, 4],
    // Phrase 3: "Then shake hands with the ones nearby..."
    [N.G4, N.C3, 2], [N.E4, N.G3, 1], [N.G4, N.C3, 1], [N.A4, N.G3, 2], [N.G4, N.C3, 2],
    [N.C5, N.A3, 2], [N.B4, N.G3, 1], [N.A4, N.F3, 1], [N.G4, N.E3, 2], [N.E4, N.C3, 2],
    // Phrase 4: "And greet them with a Terrier smile!" (classic Spectrum turnaround)
    [N.F4, N.F3, 1], [N.A4, N.F3, 1], [N.G4, N.G3, 1], [N.E4, N.C3, 1], [N.D4, N.G3, 2], [N.G4, N.G3, 2],
    [N.C5, N.C3, 2], [N.G4, N.G3, 1], [N.E4, N.G3, 1], [N.C4, N.C3, 2], [N.REST, N.G3, 2],
  ];

  class RetroAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.musicEnabled = true;
      this.musicPlaying = false;
      this.stepIndex = 0;
      this.stepTimer = 0;
      this.tempoMultiplier = 1.0; // speeds up as match clock gets low
      this.lastCrumbleTime = 0;
    }

    ensureContext() {
      try {
        if (!this.ctx) {
          const AudioCtx = global.AudioContext || global.webkitAudioContext;
          if (!AudioCtx) return false;
          this.ctx = new AudioCtx();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.28;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
          const p = this.ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.28, this.ctx.currentTime, 0.01);
      }
      return this.muted;
    }

    setMusicPlaying(active) {
      this.musicPlaying = active;
      if (!active) {
        this.stepTimer = 0;
      }
    }

    resetMusic() {
      this.stepIndex = 0;
      this.stepTimer = 0;
      this.tempoMultiplier = 1.0;
    }

    setClockRatio(ratio) {
      // ratio: 1.0 = full 90 minutes, 0.0 = 0 remaining
      if (ratio > 0.35) {
        this.tempoMultiplier = 1.0;
      } else {
        // Ramp smoothly from 1.0x up to 1.55x in injury time!
        const urgency = (0.35 - Math.max(0, ratio)) / 0.35;
        this.tempoMultiplier = 1.0 + urgency * 0.55;
      }
    }

    updateMusic(dt) {
      if (!this.musicPlaying || !this.musicEnabled || this.muted) return;
      if (!this.ctx || this.ctx.state !== 'running') return;

      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        const [lead, bass, eighths] = SMILE_AWHILE_TRACK[this.stepIndex];
        const baseEighthSec = 0.205 / this.tempoMultiplier;
        const dur = eighths * baseEighthSec;

        if (lead > 0) {
          this._playTone(lead, dur * 0.78, 'square', 0.14);
        }
        if (bass > 0) {
          this._playTone(bass, dur * 0.65, 'triangle', 0.16);
        }

        this.stepIndex = (this.stepIndex + 1) % SMILE_AWHILE_TRACK.length;
        this.stepTimer = dur;
      }
    }

    _playTone(freq, duration, type, volume, startOffset) {
      if (this.muted || !this.ensureContext()) return;
      const now = this.ctx.currentTime + (startOffset || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.008);
      gain.gain.setValueAtTime(volume, now + Math.max(0.01, duration - 0.02));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.015);
    }

    _playSweep(fStart, fEnd, duration, type, volume, startOffset) {
      if (this.muted || !this.ensureContext()) return;
      const now = this.ctx.currentTime + (startOffset || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(fStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), now + duration);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.015);
    }

    _playNoise(duration, volume, highpassHz) {
      if (this.muted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      const sampleCount = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpassHz || 800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
    }

    playJump(isZeroG) {
      if (isZeroG) {
        // Dreamy floating slow-mo retro blip
        this._playSweep(240, 620, 0.22, 'triangle', 0.24, 0);
        this._playSweep(480, 960, 0.18, 'square', 0.10, 0.04);
      } else {
        // Classic Spectrum crisp upward jump blip
        this._playSweep(210, 560, 0.12, 'square', 0.22, 0);
      }
    }

    playPickup(isLast) {
      // Sparkling 8-bit chime
      this._playTone(587.33, 0.06, 'square', 0.22, 0.0);
      this._playTone(880.00, 0.07, 'square', 0.22, 0.055);
      this._playTone(1174.66, 0.11, 'square', 0.24, 0.11);
      if (isLast) {
        this.playTunnelOpen();
      }
    }

    playTunnelOpen() {
      const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
      notes.forEach((f, idx) => {
        this._playTone(f, 0.09, 'square', 0.24, 0.16 + idx * 0.075);
      });
    }

    playGravityFlip(newDir) {
      // Iconic retro antigravity whoosh
      if (newDir < 0) {
        this._playSweep(140, 1280, 0.28, 'sawtooth', 0.22, 0);
        this._playSweep(280, 960, 0.24, 'square', 0.14, 0.03);
      } else {
        this._playSweep(1280, 140, 0.28, 'sawtooth', 0.22, 0);
        this._playSweep(960, 220, 0.24, 'square', 0.14, 0.03);
      }
      this._playNoise(0.18, 0.12, 1200);
    }

    playCrumble() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastCrumbleTime < 0.08) return;
      this.lastCrumbleTime = now;
      this._playNoise(0.05, 0.12, 1800);
      this._playTone(150 + Math.random() * 60, 0.035, 'square', 0.08, 0);
    }

    playDeath() {
      // Classic Manic Miner downward chromatic buzz
      this._playSweep(520, 72, 0.45, 'sawtooth', 0.28, 0);
      this._playSweep(410, 58, 0.42, 'square', 0.20, 0.05);
      this._playNoise(0.28, 0.16, 400);
    }

    playBonusTick(pitchStep) {
      const freq = 520 + (pitchStep % 14) * 42;
      this._playTone(freq, 0.032, 'square', 0.14, 0);
    }

    playLevelClear() {
      // Referee full-time whistle trill + triumphant HTAFC chord
      this._playTone(2350, 0.10, 'sine', 0.16, 0.0);
      this._playTone(2650, 0.08, 'sine', 0.16, 0.08);
      this._playTone(2350, 0.14, 'sine', 0.16, 0.15);
      const fanfare = [523.25, 659.25, 783.99, 1046.50];
      fanfare.forEach((f, i) => {
        this._playTone(f, 0.13, 'square', 0.22, 0.30 + i * 0.09);
      });
    }

    playGameOver() {
      // Classic retro descending doom buzz
      const notes = [392.00, 369.99, 349.23, 329.63, 261.63, 196.00];
      notes.forEach((f, i) => {
        this._playTone(f, i === notes.length - 1 ? 0.48 : 0.16, 'sawtooth', 0.24, i * 0.17);
        this._playTone(f * 0.5, i === notes.length - 1 ? 0.48 : 0.16, 'square', 0.16, i * 0.17);
      });
    }

    playVictory() {
      const fanfare = [
        [523.25, 0.00, 0.12],
        [523.25, 0.13, 0.12],
        [523.25, 0.26, 0.12],
        [659.25, 0.39, 0.22],
        [587.33, 0.62, 0.16],
        [659.25, 0.79, 0.16],
        [783.99, 0.96, 0.26],
        [1046.50, 1.24, 0.48],
      ];
      fanfare.forEach(([f, t, d]) => {
        this._playTone(f, d, 'square', 0.24, t);
        this._playTone(f * 0.5, d, 'triangle', 0.20, t);
      });
    }
  }

  MT.audio = new RetroAudio();
})(window);
