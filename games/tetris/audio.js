// Use decoded loops and the audio clock, avoiding HTMLAudio loop gaps.
class TetrisAudio {
  static ORCHESTRA_SCORE = 100;
  static assetPromise = null;
  constructor(scene) {
    this.scene = scene;
    this.buffers = {};
    this.voices = new Set();
    this.effects = new Set();
    this.offsets = {chip: 0, orchestra: 0};
    this.desired = 'chip';
    this.lastEffect = {};
    this.failed = false;
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    window.addEventListener('blur', () => { if (!this.scene.isActive) this.stop(); });
  }
  allowed() { return this.scene.isActive && !this.scene.isPaused && !this.scene.muted; }
  static loadAssets() {
    if (window.TETRIS_AUDIO_DATA) return Promise.resolve(window.TETRIS_AUDIO_DATA);
    if (!this.assetPromise) this.assetPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './games/tetris/sounds.js';
      script.onload = () => {
        if (window.TETRIS_AUDIO_DATA) resolve(window.TETRIS_AUDIO_DATA);
        else { script.remove(); this.assetPromise = null; reject(new Error('audio data')); }
      };
      script.onerror = () => { script.remove(); this.assetPromise = null; reject(new Error('audio load')); };
      document.head.appendChild(script);
    });
    return this.assetPromise;
  }
  unlock() {
    if (this.scene.muted) return;
    try {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) { this.failed = true; this.scene.syncSound(); return; }
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.context.onstatechange = () => {
          if (this.context.state === 'running') this.update();
          this.scene.syncSound();
        };
      }
      // Keep resume() in the user gesture for Safari's autoplay policy.
      if (this.context.state !== 'running') this.context.resume().catch(() => {});
      if (!this.ready) {
        this.ready = TetrisAudio.loadAssets().then(async data => {
          await Promise.all(Object.entries(data).map(async ([name, encoded]) => {
            try {
              const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
              this.buffers[name] = await this.context.decodeAudioData(bytes.buffer);
            } catch (_) { /* One broken asset does not block the game. */ }
          }));
          this.failed = !this.buffers.chip;
          if (this.failed) this.ready = null;
          this.update(); this.scene.syncSound();
        }).catch(() => { this.ready = null; this.failed = true; this.scene.syncSound(); });
      }
    } catch (_) { this.failed = true; this.scene.syncSound(); }
  }
  reset() {
    this.stop(false);
    this.offsets = {chip: 0, orchestra: 0};
    this.desired = 'chip';
    this.lastEffect = {};
  }
  duration(track) { return Math.min(track === 'chip' ? 25.6 : 51.2, this.buffers[track].duration); }
  position(voice, now = this.context.currentTime) {
    return (voice.offset + Math.max(0, now - voice.start)) % this.duration(voice.track);
  }
  createMusic(track, start, offset, fade = .06) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.buffers[track];
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = this.duration(track);
    const level = track === 'chip' ? .42 : .36;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + fade);
    source.connect(gain); gain.connect(this.master);
    const voice = {source, gain, track, start, offset, level};
    this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start(start, offset);
    return voice;
  }
  update(score = this.scene.score) {
    if (score >= TetrisAudio.ORCHESTRA_SCORE) this.desired = 'orchestra';
    if (!this.allowed() || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    if (this.transition && now >= this.transition.start) {
      this.current = this.transition.incoming;
      this.transition = null;
    }
    const track = this.buffers[this.desired] ? this.desired : 'chip';
    if (!this.buffers[track]) return;
    if (!this.current) {
      this.current = this.createMusic(track, now + .01, this.offsets[track]);
    } else if (track !== this.current.track && !this.transition) {
      // Start on the next bar (at most 1.6 seconds), overlapping for half a bar.
      const position = this.position(this.current, now);
      const start = now + 1.6 - position % 1.6;
      const incoming = this.createMusic(track, start, this.offsets[track], .8);
      const old = this.current;
      old.gain.gain.cancelScheduledValues(start);
      old.gain.gain.setValueAtTime(old.level, start);
      old.gain.gain.linearRampToValueAtTime(0, start + .8);
      old.source.stop(start + .81);
      this.transition = {incoming, start};
    }
  }
  stop(remember = true) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const effective = this.transition && now >= this.transition.start ? this.transition.incoming : this.current;
    if (remember && effective) this.offsets[effective.track] = this.position(effective, now);
    for (const voice of this.voices) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + .015);
      try { voice.source.stop(now + .02); } catch (_) {}
    }
    this.voices.clear();
    this.current = null; this.transition = null;
    for (const source of this.effects) try { source.stop(); } catch (_) {}
    this.effects.clear();
  }
  play(name, volume = .2) {
    if (!this.allowed() || this.context?.state !== 'running' || !this.buffers[name]) return false;
    const now = this.context.currentTime;
    if (this.effects.size >= 6 || now - (this.lastEffect[name] ?? -Infinity) < .05) return false;
    this.lastEffect[name] = now;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffers[name];
    gain.gain.value = volume;
    source.connect(gain); gain.connect(this.master); this.effects.add(source);
    source.onended = () => { this.effects.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
    return true;
  }
  finish() {
    this.stop();
    return this.play('over', .25);
  }
}
