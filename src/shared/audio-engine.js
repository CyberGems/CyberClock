/**
 * CyberClock — Audio Engine
 * Procedural ambient synthesis + chime system
 * CyberGems © 2026
 *
 * Track switching is seamless: each track is built into its own gain "voice"
 * that hangs off _master, and switches crossfade (equal-power) between the
 * outgoing and incoming voices instead of hard-cutting.
 */

class AudioEngine {
  constructor() {
    this._ctx        = null;
    this._master     = null;
    this._analyser   = null;
    this._voices     = [];     // all live voices (current + those fading out)
    this._current    = null;   // the active voice
    this._building   = null;   // voice currently being constructed
    this._layers     = [];     // ambient mix layers (id -> gain + voice)
    this._layerDest  = null;   // routing hint while a layer voice is built
    this._layerTrack = null;
    this.isPlaying   = false;
    this.currentTrack = null;
    this.volume      = 0.8;
    this.muted       = false;   // master mute (tray toggle) — silences both
                                // the ambient master gain and the chimes
                                // (which bypass _master entirely)
    this.crossfadeTime = 2.0;  // seconds, track-to-track
    this.stopFadeTime  = 2.0;  // seconds, on explicit stop
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

  // Real pause: suspends the whole AudioContext so every voice freezes in
  // place (HTMLAudioElement media too, via createMediaElementSource).
  suspend() {
    this._ensureCtx();
    if (this._ctx.state === 'running') this._ctx.suspend();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._master && !this.muted) {
      this._master.gain.setTargetAtTime(this.volume, this._ctx.currentTime, 0.15);
    }
  }

  // Master mute: fades the ambient master gain to 0 (keeps this.volume
  // intact) and gates the chimes, which connect straight to the
  // destination and would otherwise ignore the gain change.
  setMuted(muted) {
    this.muted = !!muted;
    if (!this._master) return;
    const target = this.muted ? 0 : this.volume;
    this._master.gain.setTargetAtTime(target, this._ctx.currentTime, 0.15);
  }

  setCrossfade(secs) {
    this.crossfadeTime = Math.max(0, secs);
  }

  // Sleep-friendly auto stop: glide the master gain to silence over
  // `secs`. Any later setVolume/resume/stop cancels the glide cleanly.
  beginSlowFade(secs) {
    if (!this._master || !this._ctx) return;
    const now = this._ctx.currentTime;
    const from = Math.max(0.0001, this._master.gain.value);
    try {
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setValueAtTime(from, now);
      this._master.gain.linearRampToValueAtTime(0.0001, now + Math.max(1, secs));
    } catch (_) { /* a mid-ramp re-schedule is harmless to miss */ }
  }

  getAnalyserData() {
    if (!this._analyser) return new Uint8Array(128);
    const d = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteFrequencyData(d);
    return d;
  }

  // ── Voice lifecycle ───────────────────────────────────────
  _startVoice(track) {
    const bus = this._ctx.createGain();
    bus.gain.value = 0;            // fades in on commit
    // Layer mixing: when a layer is being (re)built, route the voice
    // through the layer's gain node instead of the master.
    const dest = this._layerDest || this._master;
    bus.connect(dest);
    const voice = { track, bus, dest, nodes: [], birdTimer: null, audioEl: null, alive: true, layer: this._layerTrack || null };
    this._building = voice;
    return voice;
  }

  // Equal-power crossfade curve (constant perceived loudness through the cross).
  _fadeCurve(rising, startLevel = 1, steps = 48) {
    const c = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);           // 0 → 1
      c[i] = rising
        ? Math.sin(t * Math.PI / 2)        // 0 → 1
        : startLevel * Math.cos(t * Math.PI / 2); // startLevel → 0
    }
    return c;
  }

  _commitVoice(voice, fade = this.crossfadeTime) {
    const now  = this._ctx.currentTime;
    // Fade out everything currently playing — except voices belonging
    // to other mix layers (those keep sounding across the commit).
    this._voices.forEach(v => {
      if (v === voice) return;
      if (voice.layer && v.layer && v.layer !== voice.layer) return;
      this._retireVoice(v, fade);
    });
    // Fade the new voice in.
    voice.bus.gain.cancelScheduledValues(now);
    if (fade > 0) {
      voice.bus.gain.setValueCurveAtTime(this._fadeCurve(true), now, fade);
    } else {
      voice.bus.gain.setValueAtTime(1, now);
    }
    this._voices.push(voice);
    if (!voice.layer) {
      // Solo (non-layer) commits own the global "current" state.
      this._current = voice;
      this.currentTrack = voice.track;
    }
    this._building     = null;
    this.isPlaying     = true;
  }

  _retireVoice(voice, fade) {
    if (!voice.alive) return;
    voice.alive = false;
    clearTimeout(voice.birdTimer);
    const now = this._ctx.currentTime;
    const g   = voice.bus.gain;
    const from = Math.max(0.0001, g.value);
    g.cancelScheduledValues(now);
    if (fade > 0) {
      g.setValueCurveAtTime(this._fadeCurve(false, from), now, fade);
    } else {
      g.setValueAtTime(0, now);
    }
    // Tear down nodes once the fade has fully elapsed.
    setTimeout(() => this._destroyVoice(voice), fade * 1000 + 120);
  }

  _destroyVoice(voice) {
    voice.nodes.forEach(n => {
      try { n.stop?.(); }       catch (_) {}
      try { n.disconnect?.(); } catch (_) {}
    });
    try { voice.bus.disconnect(); } catch (_) {}
    if (voice.audioEl) {
      try { voice.audioEl.pause(); } catch (_) {}
      try { voice.audioEl.currentTime = 0; } catch (_) {}
      voice.audioEl = null;
    }
    this._voices = this._voices.filter(v => v !== voice);
  }

  // ── Stop all (fade out, click-free) ───────────────────────
  stop(fadeTime = this.stopFadeTime) {
    this._voices.slice().forEach(v => this._retireVoice(v, fadeTime));
    this._layers.forEach(l => { l.active = false; l.voice = null; });
    this._current     = null;
    this.isPlaying    = false;
    this.currentTrack = null;
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
    this._building.nodes.push(lfo, gain);
    return { lfo, gain };
  }

  _noiseSource(buf) {
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this._building.nodes.push(src);
    return src;
  }

  _filter(type, freq, Q = 1) {
    const f = this._ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    this._building.nodes.push(f);
    return f;
  }

  _gain(val) {
    const g = this._ctx.createGain();
    g.gain.value = val;
    this._building.nodes.push(g);
    return g;
  }

  // ── Ambient Tracks ────────────────────────────────────────

  playRain() {
    this.resume();
    const voice = this._startVoice('rain');
    const noise = this._noiseSource(this._whiteNoiseBuf(3));
    const hp    = this._filter('highpass', 1600, 0.6);
    const bp    = this._filter('bandpass', 4500, 0.4);
    const g     = this._gain(2.8);

    noise.connect(hp); hp.connect(bp); bp.connect(g); g.connect(voice.bus);
    noise.start();
    this._commitVoice(voice);
  }

  playOcean() {
    this.resume();
    const voice = this._startVoice('ocean');
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
    voice.nodes.push(waveLfo, waveG);

    noise.connect(lp); lp.connect(g); g.connect(voice.bus);
    noise.start();
    this._commitVoice(voice);
  }

  playNight() { this._fire(false); }
  playFireplace() { this._fire(true); }

  _fire(indoor) {
    this.resume();
    const voice = this._startVoice(indoor ? 'fireplace' : 'night');
    const noise = this._noiseSource(this._pinkNoiseBuf(3));
    const bp    = this._filter('bandpass', indoor ? 250 : 450, 0.3);
    const g     = this._gain(indoor ? 1.6 : 2.0);

    this._lfo(indoor ? 0.25 : 0.4, 0.6, g.gain);

    noise.connect(bp); bp.connect(g); g.connect(voice.bus);
    noise.start();
    this._commitVoice(voice);
  }

  playForest() {
    this.resume();
    const voice = this._startVoice('forest');
    const noise = this._noiseSource(this._pinkNoiseBuf(4));
    const bp    = this._filter('bandpass', 700, 0.5);
    const g     = this._gain(1.1);

    this._lfo(0.07, 0.35, g.gain);

    noise.connect(bp); bp.connect(g); g.connect(voice.bus);
    noise.start();
    this._commitVoice(voice);
    this._scheduleBirds(voice);
  }

  _scheduleBirds(voice) {
    if (!voice.alive) return;
    const delay = 1800 + Math.random() * 7000;
    voice.birdTimer = setTimeout(() => {
      if (voice.alive) { this._chirp(voice); this._scheduleBirds(voice); }
    }, delay);
  }

  _chirp(voice) {
    const osc = this._ctx.createOscillator();
    const g   = this._ctx.createGain();
    const f   = 900 + Math.random() * 1400;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, this._ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f * 1.6, this._ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(f, this._ctx.currentTime + 0.22);
    g.gain.setValueAtTime(0.25, this._ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this._ctx.currentTime + 0.35);
    osc.connect(g); g.connect(voice.bus);
    osc.start(); osc.stop(this._ctx.currentTime + 0.4);
  }

  playSpace() {
    this.resume();
    const voice  = this._startVoice('space');
    const freqs  = [55, 82.5, 110, 137.5];
    const amps   = [0.32, 0.22, 0.15, 0.09];

    freqs.forEach((f, i) => {
      const osc = this._ctx.createOscillator();
      const g   = this._gain(amps[i]);
      osc.type = 'sine';
      osc.frequency.value = f;
      this._lfo(0.04 + i * 0.01, 0.25, g.gain);
      osc.connect(g); g.connect(voice.bus);
      osc.start();
      voice.nodes.push(osc);
    });

    // Shimmer layer
    const shimNoise = this._noiseSource(this._pinkNoiseBuf(2));
    const shimBp    = this._filter('bandpass', 3000, 2);
    const shimG     = this._gain(0.04);
    shimNoise.connect(shimBp); shimBp.connect(shimG); shimG.connect(voice.bus);
    shimNoise.start();

    this._commitVoice(voice);
  }

  // ── Play from ID ──────────────────────────────────────────
  playTrack(id) {
    this.isPlaying = true;
    this.currentTrack = id;
    // Capture any pending layer routing now: the HEAD fetch below is
    // async, and by the time it resolves the fields are already reset.
    const dest = this._layerDest || null;
    const layerId = this._layerTrack || null;
    const startVoice = () => {
      this._layerDest = dest;
      this._layerTrack = layerId;
      try { this._playSynth(id); } finally { this._layerDest = null; this._layerTrack = null; }
    };
    // Try real audio file first, fall back to procedural synthesis
    const realFile = `../assets/sounds/${id}.mp3`;
    fetch(realFile, { method: 'HEAD' })
      .then(r => {
        if (r.ok) {
          this._layerDest = dest;
          this._layerTrack = layerId;
          try { this.playFile(realFile, { id, fade: this.crossfadeTime }); }
          finally { this._layerDest = null; this._layerTrack = null; }
        } else {
          startVoice();
        }
      })
      .catch(() => startVoice());
  }

  // ── Layer mixing (ambient blend mode) ─────────────────────
  // Each layer keeps its own gain node off _master, so toggling one
  // layer fades it independently while the others keep playing.
  getLayer(id) {
    return this._layers.find(l => l.id === id) || null;
  }

  isLayerActive(id) {
    const l = this.getLayer(id);
    return !!(l && l.active);
  }

  activeLayerIds() {
    return this._layers.filter(l => l.active).map(l => l.id);
  }

  _ensureLayer(id) {
    let layer = this.getLayer(id);
    if (!layer) {
      const gain = this._ctx.createGain();
      gain.gain.value = 0;                 // silent until activated
      gain.connect(this._master);
      layer = { id, gain, active: false, voice: null };
      this._layers.push(layer);
    }
    return layer;
  }

  // Turn a layer on: (re)builds its voice routed through the layer gain.
  _startLayerVoice(layer) {
    // _startVoice consumes these fields while the (possibly async)
    // voice construction runs; the finally block restores them so a
    // normal playTrack call right after is never mis-routed.
    this._layerDest = layer.gain;
    this._layerTrack = layer.id;
    try {
      this.playTrack(layer.id);
    } finally {
      this._layerDest = null;
      this._layerTrack = null;
    }
    layer.active = true;
    layer.voice = this._current;
    this.isPlaying = true;
  }

  addLayer(id) {
    this._ensureCtx();
    this.resume();
    const layer = this._ensureLayer(id);
    if (layer.active) return;
    // If a solo track is currently playing, promote it to a layer first
    // so blending keeps it sounding instead of crossfading it away.
    if (this._current && this._current.alive && this.isPlaying) {
      const soloId = this._current.track;
      const soloLayer = this.getLayer(soloId);
      if (!soloLayer || !soloLayer.active) {
        const promoted = this._ensureLayer(soloId);
        promoted.active = true;
        promoted.voice = this._current;
        promoted.gain.gain.setTargetAtTime(1, this._ctx.currentTime, 0.05);
        // Re-wire the live voice's bus through the layer gain.
        try { this._current.bus.disconnect(); } catch (_) {}
        try { this._current.bus.connect(promoted.gain); } catch (_) {}
        this._current.layer = soloId;
        this._current.dest = promoted.gain;
      }
    }
    this._startLayerVoice(layer);
    layer.gain.gain.setTargetAtTime(1, this._ctx.currentTime, 0.4);
  }

  removeLayer(id, fade = 1.2) {
    const layer = this.getLayer(id);
    if (!layer || !layer.active) return;
    layer.active = false;
    const now = this._ctx.currentTime;
    layer.gain.gain.setTargetAtTime(0.0001, now, fade / 3);
    // Retire the voice underneath so its nodes/timers wind down too.
    if (layer.voice) this._retireVoice(layer.voice, fade);
    layer.voice = null;
    if (this.activeLayerIds().length === 0) {
      this.isPlaying = false;
      this.currentTrack = null;
    }
  }

  clearLayers(fade = 1.2) {
    this._layers.slice().forEach(l => this.removeLayer(l.id, fade));
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

  playFile(filePath, { id = null, fade = 0, loop = true } = {}) {
    this.isPlaying = true;
    if (id) this.currentTrack = id;
    this.resume();
    const voice = this._startVoice(id || 'file');
    // Resolve absolute path in Tauri
    let resolvedPath = filePath;
    if (typeof window !== 'undefined' && window.__TAURI__ && (String(filePath).match(/^[A-Za-z]:[\\/]/) || String(filePath).startsWith('/') || String(filePath).startsWith('\\'))) {
      resolvedPath = window.__TAURI__.core.convertFileSrc(filePath);
    }
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = resolvedPath;
    audio.loop  = false;
    audio.volume = 1;            // level is governed by the voice bus + _master
    const src  = this._ctx.createMediaElementSource(audio);
    src.connect(voice.bus);
    voice.audioEl = audio;

    let loopTriggered = false;
    audio.addEventListener('timeupdate', () => {
      if (!voice.alive || loopTriggered || !loop) return;
      const timeLeft = audio.duration - audio.currentTime;
      if (audio.duration > this.crossfadeTime && timeLeft <= this.crossfadeTime) {
        loopTriggered = true;
        // Keep layer routing across the crossfaded re-loop.
        this._layerDest = voice.dest || null;
        this._layerTrack = voice.layer || null;
        try {
          this.playFile(filePath, { id, fade: this.crossfadeTime, loop });
        } finally {
          this._layerDest = null;
          this._layerTrack = null;
        }
        if (voice.layer) {
          const layer = this.getLayer(voice.layer);
          if (layer && layer.active) layer.voice = this._voices[this._voices.length - 1] || layer.voice;
        }
      }
    });

    audio.addEventListener('ended', () => {
      if (!voice.alive || loopTriggered) return;
      loopTriggered = true;
      if (loop) {
        this._layerDest = voice.dest || null;
        this._layerTrack = voice.layer || null;
        try {
          this.playFile(filePath, { id, fade: 0, loop });
        } finally {
          this._layerDest = null;
          this._layerTrack = null;
        }
        if (voice.layer) {
          const layer = this.getLayer(voice.layer);
          if (layer && layer.active) layer.voice = this._voices[this._voices.length - 1] || layer.voice;
        }
      } else {
        this._destroyVoice(voice);
        if (this._current === voice) {
          this._current = null;
          this.isPlaying = false;
          this.currentTrack = null;
        }
      }
    });

    audio.play().catch(e => console.warn('[AudioEngine] File playback:', e));
    this._commitVoice(voice, fade);
  }

  // ── Alarm Chimes (built-in) ───────────────────────────────
  chime(id, vol = 0.7) {
    // Chimes connect straight to the destination (not via _master), so the
    // master mute gates them here. The Rust scheduler also never emits
    // chime events while muted — this is the in-page safety net (test
    // buttons, manual plays).
    if (this.muted) return;
    this._ensureCtx();
    this.resume();
    switch (id) {
      case 'chime-crystal': this._chimeCrystal(vol);  break;
      case 'chime-digital': this._chimeDigital(vol);  break;
      case 'chime-neon':    this._chimeNeon(vol);     break;
      case 'chime-zen':     this._chimeZen(vol);      break;
      case 'chime-cyber':   this._chimeCyber(vol);    break;
      case 'chime-music':   this._chimeMusic(vol);    break;
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
    const t = this._ctx.currentTime;
    const notes = [659.25, 880.00]; // E5, A5
    notes.forEach((f, i) => {
      const startTime = t + i * 0.15;
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(v * 0.35, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);
      
      osc.connect(gain);
      gain.connect(this._ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 1.3);
    });
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
    const t = this._ctx.currentTime;
    const notes = [293.66, 369.99, 440.00, 587.33]; // D Major Chord Detuned Aurora style
    notes.forEach((f) => {
      [-1.5, 1.5].forEach(detuneVal => {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        const filter = this._ctx.createBiquadFilter();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        osc.detune.setValueAtTime(detuneVal, t);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(v * 0.15, t + 0.4);
        gain.gain.setValueAtTime(v * 0.15, t + 1.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this._ctx.destination);
        
        osc.start(t);
        osc.stop(t + 3.3);
      });
    });
  }

  _chimeMusic(v) {
    const t = this._ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      const startTime = t + i * 0.12;
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(v * 0.4, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);
      
      osc.connect(gain);
      gain.connect(this._ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.9);
    });
  }
}

// Singleton export
window.audioEngine = new AudioEngine();
