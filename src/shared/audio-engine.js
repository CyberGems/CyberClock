/**
 * CyberClock — Audio Engine
 * Procedural ambient synthesis + chime system
 * CyberGems © 2026
 */

class AudioEngine {
  constructor() {
    this._ctx        = null;
    this._master     = null;
    this._analyser   = null;
    this._nodes      = [];
    this._birdTimer  = null;
    this.isPlaying   = false;
    this.currentTrack = null;
    this.volume      = 0.8;
  }

  // ── Init (lazy — needs user gesture on first call) ────────
  _ensureCtx() {
    if (this._ctx) return;
    this._ctx      = new (window.AudioContext || window.webkitAudioContext)();
    this._master   = this._ctx.createGain();
    this._master.gain.value = this.volume;
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 256;
    this._master.connect(this._analyser);
    this._analyser.connect(this._ctx.destination);
  }

  resume() {
    this._ensureCtx();
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._master) {
      this._master.gain.setTargetAtTime(this.volume, this._ctx.currentTime, 0.15);
    }
  }

  getAnalyserData() {
    if (!this._analyser) return new Uint8Array(128);
    const d = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteFrequencyData(d);
    return d;
  }

  // ── Stop all ambient nodes ────────────────────────────────
  stop() {
    clearTimeout(this._birdTimer);
    this._nodes.forEach(n => {
      try { n.stop?.(); } catch (_) {}
      try { n.disconnect?.(); } catch (_) {}
    });
    this._nodes = [];
    this.isPlaying  = false;
    this.currentTrack = null;
    // Stop any HTML5 Audio element from playFile()
    if (this._audioEl) {
      try { this._audioEl.pause(); } catch (_) {}
      try { this._audioEl.currentTime = 0; } catch (_) {}
      this._audioEl = null;
    }
  }

  // ── Noise helpers ─────────────────────────────────────────
  _pinkNoiseBuf(secs = 2) {
    const sr = this._ctx.sampleRate;
    const fr = sr * secs;
    const buf = this._ctx.createBuffer(2, fr, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < fr; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 =-0.76160*b5 - w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  _whiteNoiseBuf(secs = 2) {
    const sr = this._ctx.sampleRate;
    const fr = sr * secs;
    const buf = this._ctx.createBuffer(2, fr, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < fr; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _lfo(freq, depth, dest) {
    const lfo  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = freq;
    gain.gain.value = depth;
    lfo.connect(gain);
    gain.connect(dest);
    lfo.start();
    this._nodes.push(lfo, gain);
    return { lfo, gain };
  }

  _noiseSource(buf) {
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this._nodes.push(src);
    return src;
  }

  _filter(type, freq, Q = 1) {
    const f = this._ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    this._nodes.push(f);
    return f;
  }

  _gain(val) {
    const g = this._ctx.createGain();
    g.gain.value = val;
    this._nodes.push(g);
    return g;
  }

  // ── Ambient Tracks ────────────────────────────────────────

  playRain() {
    this.stop(); this.resume();
    const noise = this._noiseSource(this._whiteNoiseBuf(3));
    const hp    = this._filter('highpass', 1600, 0.6);
    const bp    = this._filter('bandpass', 4500, 0.4);
    const g     = this._gain(2.8);

    noise.connect(hp); hp.connect(bp); bp.connect(g); g.connect(this._master);
    noise.start();
    this.isPlaying = true; this.currentTrack = 'rain';
  }

  playOcean() {
    this.stop(); this.resume();
    const noise = this._noiseSource(this._pinkNoiseBuf(4));
    const lp    = this._filter('lowpass', 700, 0.8);
    const g     = this._gain(0.25);

    // Wave LFO
    const waveLfo = this._ctx.createOscillator();
    const waveG   = this._ctx.createGain();
    waveLfo.type = 'sine';
    waveLfo.frequency.value = 0.12;
    waveG.gain.value = 0.22;
    waveLfo.connect(waveG); waveG.connect(g.gain);
    waveLfo.start();
    this._nodes.push(waveLfo, waveG);

    noise.connect(lp); lp.connect(g); g.connect(this._master);
    noise.start();
    this.isPlaying = true; this.currentTrack = 'ocean';
  }

  playNight() { this._fire(false); }
  playFireplace() { this._fire(true); }

  _fire(indoor) {
    this.stop(); this.resume();
    const noise = this._noiseSource(this._pinkNoiseBuf(3));
    const bp    = this._filter('bandpass', indoor ? 250 : 450, 0.3);
    const g     = this._gain(indoor ? 1.6 : 2.0);

    this._lfo(indoor ? 0.25 : 0.4, 0.6, g.gain);

    noise.connect(bp); bp.connect(g); g.connect(this._master);
    noise.start();
    this.isPlaying = true;
    this.currentTrack = indoor ? 'fireplace' : 'night';
  }

  playForest() {
    this.stop(); this.resume();
    const noise = this._noiseSource(this._pinkNoiseBuf(4));
    const bp    = this._filter('bandpass', 700, 0.5);
    const g     = this._gain(1.1);

    this._lfo(0.07, 0.35, g.gain);

    noise.connect(bp); bp.connect(g); g.connect(this._master);
    noise.start();
    this.isPlaying = true; this.currentTrack = 'forest';
    this._scheduleBirds();
  }

  _scheduleBirds() {
    if (!this.isPlaying) return;
    const delay = 1800 + Math.random() * 7000;
    this._birdTimer = setTimeout(() => {
      if (this.isPlaying) { this._chirp(); this._scheduleBirds(); }
    }, delay);
  }

  _chirp() {
    const osc = this._ctx.createOscillator();
    const g   = this._ctx.createGain();
    const f   = 900 + Math.random() * 1400;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, this._ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f * 1.6, this._ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(f, this._ctx.currentTime + 0.22);
    g.gain.setValueAtTime(0.25, this._ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this._ctx.currentTime + 0.35);
    osc.connect(g); g.connect(this._master);
    osc.start(); osc.stop(this._ctx.currentTime + 0.4);
  }

  playSpace() {
    this.stop(); this.resume();
    const freqs  = [55, 82.5, 110, 137.5];
    const amps   = [0.32, 0.22, 0.15, 0.09];

    freqs.forEach((f, i) => {
      const osc = this._ctx.createOscillator();
      const g   = this._gain(amps[i]);
      osc.type = 'sine';
      osc.frequency.value = f;
      this._lfo(0.04 + i * 0.01, 0.25, g.gain);
      osc.connect(g); g.connect(this._master);
      osc.start();
      this._nodes.push(osc);
    });

    // Shimmer layer
    const shimNoise = this._noiseSource(this._pinkNoiseBuf(2));
    const shimBp    = this._filter('bandpass', 3000, 2);
    const shimG     = this._gain(0.04);
    shimNoise.connect(shimBp); shimBp.connect(shimG); shimG.connect(this._master);
    shimNoise.start();

    this.isPlaying = true; this.currentTrack = 'space';
  }

  // ── Play from ID ──────────────────────────────────────────
  playTrack(id) {
    // Try real audio file first, fall back to procedural synthesis
    const realFile = `../assets/sounds/${id}.mp3`;
    fetch(realFile, { method: 'HEAD' })
      .then(r => {
        if (r.ok) this.playFile(realFile);
        else this._playSynth(id);
      })
      .catch(() => this._playSynth(id));
  }

  _playSynth(id) {
    switch (id) {
      case 'rain':      this.playRain();      break;
      case 'ocean':     this.playOcean();     break;
      case 'night':     this.playNight();     break;
      case 'fireplace': this.playFireplace(); break;
      case 'forest':    this.playForest();    break;
      case 'space':     this.playSpace();     break;
    }
  }

  // ── Play custom audio file ────────────────────────────────
  playFile(filePath) {
    this.stop(); // Ensure nothing else is playing
    this.resume();
    // Use HTML Audio as pass-through into Web Audio analyser
    const audio = new Audio(filePath);
    audio.loop  = true;
    audio.volume = this.volume;
    const src  = this._ctx.createMediaElementSource(audio);
    src.connect(this._master);
    audio.play().catch(e => console.warn('[AudioEngine] File playback:', e));
    this._audioEl = audio;
    this.isPlaying = true;
  }

  // ── Alarm Chimes (built-in) ───────────────────────────────
  chime(id, vol = 0.7) {
    this._ensureCtx();
    this.resume();
    switch (id) {
      case 'chime-crystal': this._chimeCrystal(vol);  break;
      case 'chime-digital': this._chimeDigital(vol);  break;
      case 'chime-neon':    this._chimeNeon(vol);     break;
      case 'chime-zen':     this._chimeZen(vol);      break;
      case 'chime-cyber':   this._chimeCyber(vol);    break;
      default:              this._chimeDigital(vol);
    }
  }

  _chimeCrystal(v) {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      const t = this._ctx.currentTime + i * 0.28;
      const o = this._ctx.createOscillator();
      const g = this._ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(v * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
      o.connect(g); g.connect(this._ctx.destination);
      o.start(t); o.stop(t + 2.1);
    });
  }

  _chimeDigital(v) {
    const t  = this._ctx.currentTime;
    const o  = this._ctx.createOscillator();
    const g  = this._ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(440, t + 0.12);
    g.gain.setValueAtTime(v * 0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(this._ctx.destination);
    o.start(t); o.stop(t + 0.6);
  }

  _chimeNeon(v) {
    [0, 0.13, 0.26].forEach((d, i) => {
      const t = this._ctx.currentTime + d;
      const o = this._ctx.createOscillator();
      const g = this._ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 440 * Math.pow(2, i * 2 / 12);
      g.gain.setValueAtTime(v * 0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g); g.connect(this._ctx.destination);
      o.start(t); o.stop(t + 0.75);
    });
  }

  _chimeZen(v) {
    const t = this._ctx.currentTime;
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 2.5);
    g.gain.setValueAtTime(v * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g); g.connect(this._ctx.destination);
    o.start(t); o.stop(t + 3.6);
  }

  _chimeCyber(v) {
    [880, 1100, 1320, 1760].forEach((f, i) => {
      const t = this._ctx.currentTime + i * 0.09;
      const o = this._ctx.createOscillator();
      const g = this._ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.35);
      g.gain.setValueAtTime(v * 0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(this._ctx.destination);
      o.start(t); o.stop(t + 0.5);
    });
  }
}

// Singleton export
window.audioEngine = new AudioEngine();
