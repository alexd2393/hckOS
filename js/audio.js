/**
 * audio.js — Procedural Audio System
 * AleXim Mobile — Hacking Narrative Game
 *
 * All sounds are generated with the Web Audio API — no external files needed.
 * Call AudioSystem.init() once on first user interaction or at startup.
 */

const AudioSystem = (() => {

  let ctx          = null;
  let masterGain   = null;
  let muted        = false;
  let _volume      = 0.3;

  // ─── Internal helpers ─────────────────────────────────────────

  function _init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = _volume;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[AudioSystem] Web Audio API unavailable.');
    }
  }

  /** Resume context if suspended (required after first user gesture). */
  function _ensure() {
    if (!ctx) _init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /**
   * Play a simple oscillator tone.
   * @param {number} freq      - Frequency in Hz
   * @param {number} duration  - Duration in seconds
   * @param {string} type      - OscillatorType: 'sine'|'square'|'sawtooth'|'triangle'
   * @param {number} vol       - Peak gain 0–1
   * @param {number} delay     - Start delay in seconds
   */
  function _tone(freq, duration, type = 'sine', vol = 0.08, delay = 0) {
    if (muted || !ctx) return;
    const now = ctx.currentTime + delay;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /** Short burst of white noise. */
  function _noise(duration, vol = 0.04, delay = 0) {
    if (muted || !ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain);
    gain.connect(masterGain);
    gain.gain.value = vol;
    src.start(ctx.currentTime + delay);
  }

  // ─── Public API ───────────────────────────────────────────────
  return {

    init() { _init(); },

    mute()    { muted = true; },
    unmute()  { muted = false; },
    toggle()  { muted = !muted; return muted; },
    isMuted() { return muted; },

    setVolume(v) {
      _volume = Math.max(0, Math.min(1, v));
      if (masterGain) masterGain.gain.value = _volume;
    },

    // ── UI sounds ───────────────────────────────────────────────

    /** Soft mechanical key click for terminal typing. */
    keyClick() {
      _ensure();
      _tone(600 + Math.random() * 300, 0.018, 'square', 0.015);
    },

    /** Opening a window. */
    windowOpen() {
      _ensure();
      _tone(700, 0.06, 'sine', 0.06);
      _tone(1050, 0.08, 'sine', 0.05, 0.07);
    },

    /** Notification ping. */
    notification() {
      _ensure();
      _tone(1200, 0.06, 'sine', 0.05);
      _tone(1600, 0.09, 'sine', 0.04, 0.09);
    },

    // ── Feedback sounds ─────────────────────────────────────────

    /** Generic success — ascending triad. */
    success() {
      _ensure();
      _tone(523, 0.09, 'sine', 0.08);
      _tone(659, 0.09, 'sine', 0.07, 0.10);
      _tone(784, 0.18, 'sine', 0.09, 0.20);
    },

    /** Generic error — descending growl. */
    error() {
      _ensure();
      _tone(280, 0.14, 'sawtooth', 0.07);
      _tone(200, 0.18, 'sawtooth', 0.06, 0.16);
    },

    /** Warning — double beep. */
    warning() {
      _ensure();
      _tone(900, 0.08, 'square', 0.05);
      _tone(900, 0.08, 'square', 0.05, 0.18);
    },

    // ── Hacking sounds ──────────────────────────────────────────

    /**
     * Network scan — frequency sweep up then down.
     */
    scan() {
      _ensure();
      if (!ctx) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.5);
      osc.frequency.linearRampToValueAtTime(180,  now + 1.0);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.start(now);
      osc.stop(now + 1.1);
    },

    /**
     * Data transfer / download — noise burst + low rumble.
     */
    dataTransfer() {
      _ensure();
      _noise(0.25, 0.04);
      _tone(80, 0.25, 'sawtooth', 0.03);
    },

    /**
     * Decrypt sequence — ascending steps.
     */
    decrypt() {
      _ensure();
      const steps = [200, 280, 360, 460, 560, 680, 820, 1000];
      steps.forEach((f, i) => _tone(f, 0.07, 'square', 0.035, i * 0.09));
    },

    /**
     * Connection established — clean digital click.
     */
    connect() {
      _ensure();
      _tone(440,  0.04, 'square', 0.04);
      _tone(880,  0.04, 'square', 0.03, 0.05);
      _tone(1320, 0.10, 'square', 0.05, 0.10);
    },

    /**
     * Boot sound — slow ascending chord.
     */
    boot() {
      _ensure();
      _tone(261, 0.12, 'sine', 0.10);
      _tone(329, 0.12, 'sine', 0.09, 0.18);
      _tone(392, 0.12, 'sine', 0.09, 0.36);
      _tone(523, 0.35, 'sine', 0.12, 0.52);
    },

    /**
     * "Busted" — descending alarm.
     */
    busted() {
      _ensure();
      for (let i = 0; i < 6; i++) {
        _tone(800, 0.12, 'sawtooth', 0.1, i * 0.22);
        _tone(600, 0.12, 'sawtooth', 0.1, i * 0.22 + 0.12);
      }
    },
  };

})();
