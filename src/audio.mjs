const ENTRANCE_CUES = [
  {
    voice: 'triangle',
    notes: [[0, 147], [0.16, 220], [0.32, 175], [0.51, 294]],
  },
  {
    voice: 'sawtooth',
    notes: [[0, 73], [0.12, 73], [0.29, 104], [0.50, 78], [0.63, 117]],
  },
  {
    voice: 'square',
    notes: [[0, 233], [0.11, 294], [0.29, 247], [0.46, 311], [0.63, 349]],
  },
];

export class GameAudio {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.skateDelay = 0;
    this.lastBoard = -Infinity;
  }

  async unlock() {
    if (!this.enabled) return;
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;

    try {
      if (!this.context) {
        const context = new Audio();
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = 0.48;
        this.master.connect(context.destination);
        const size = Math.ceil(context.sampleRate * 0.43);
        this.noiseBuffer = context.createBuffer(1, size, context.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < size; i += 1) samples[i] = Math.random() * 2 - 1;
      }
      if (this.context.state !== 'running') await this.context.resume();
    } catch {
      // A browser may restrict audio playback until another user gesture.
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.context && this.master) {
      const time = this.context.currentTime;
      this.master.gain.cancelScheduledValues(time);
      this.master.gain.setTargetAtTime(this.enabled ? 0.48 : 0, time, 0.012);
    }
    if (!this.enabled) this.suspendSkate();
  }

  get ready() {
    return this.enabled && this.context?.state === 'running';
  }

  envelope(time, duration, volume, attack = 0.006) {
    const output = this.context.createGain();
    output.gain.setValueAtTime(0.0001, time);
    output.gain.exponentialRampToValueAtTime(volume, time + attack);
    output.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    output.connect(this.master);
    return output;
  }

  tone({ time, duration, from, to, volume, type = 'triangle', attack }) {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    const output = this.envelope(time, duration, volume, attack);
    oscillator.connect(output);
    oscillator.start(time);
    oscillator.stop(time + duration);
    oscillator.onended = () => output.disconnect();
  }

  noise({ time, duration, frequency, volume, filter = 'bandpass', attack, quality = 0.7 }) {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const band = this.context.createBiquadFilter();
    band.type = filter;
    band.frequency.value = frequency;
    band.Q.value = quality;
    const output = this.envelope(time, duration, volume, attack);
    source.connect(band);
    band.connect(output);
    const offset = Math.random() * Math.max(0, this.noiseBuffer.duration - duration);
    source.start(time, offset, duration);
    source.onended = () => output.disconnect();
  }

  special(move, time) {
    switch (move) {
      case 'deke':
        this.noise({ time, duration: 0.18, frequency: 2900, volume: 0.28, filter: 'highpass', attack: 0.022 });
        this.tone({ time, duration: 0.12, from: 380, to: 910, volume: 0.23, type: 'sine' });
        this.tone({ time: time + 0.08, duration: 0.11, from: 780, to: 350, volume: 0.15, type: 'sine' });
        break;
      case 'slapshot':
        this.noise({ time, duration: 0.26, frequency: 1950, volume: 0.46, attack: 0.004 });
        this.tone({ time, duration: 0.23, from: 211, to: 43, volume: 0.53 });
        this.tone({ time: time + 0.07, duration: 0.18, from: 460, to: 142, volume: 0.15, type: 'sine' });
        break;
      case 'michigan':
        this.tone({ time, duration: 0.07, from: 610, to: 350, volume: 0.23 });
        this.tone({ time: time + 0.04, duration: 0.23, from: 450, to: 1130, volume: 0.21, type: 'sine', attack: 0.025 });
        break;
      case 'muffin':
        this.tone({ time, duration: 0.16, from: 260, to: 430, volume: 0.19, type: 'sine', attack: 0.03 });
        break;
    }
  }

  entrance(player, time) {
    const cue = ENTRANCE_CUES[player];
    if (!cue) return;

    for (const [index, [delay, frequency]] of cue.notes.entries()) {
      const noteTime = time + delay;
      const last = index === cue.notes.length - 1;
      this.tone({
        time: noteTime, duration: last ? 0.32 : 0.17, from: frequency, to: frequency * 0.985,
        volume: last ? 0.24 : 0.16, type: cue.voice, attack: 0.013,
      });
      if (last || index % 2 === 0) {
        this.tone({
          time: noteTime, duration: last ? 0.26 : 0.14, from: frequency / 2, to: frequency / 2,
          volume: 0.19, type: 'triangle', attack: 0.009,
        });
        this.noise({
          time: noteTime, duration: 0.085, frequency: index === 0 ? 450 : 1920, volume: 0.20,
        });
      }
    }
  }

  event(event) {
    if (!this.ready) return;
    const time = this.context.currentTime + 0.004;

    switch (event.type) {
      case 'entrance':
        this.entrance(event.player, time);
        break;
      case 'faceoff':
        this.tone({ time, duration: 0.19, from: 990, to: 1470, volume: 0.24, type: 'sine' });
        this.noise({ time: time + 0.12, duration: 0.075, frequency: 1580, volume: 0.29 });
        this.tone({ time: time + 0.13, duration: 0.08, from: 170, to: 89, volume: 0.22 });
        break;
      case 'pickup':
        this.tone({ time, duration: 0.045, from: 510, to: 305, volume: 0.15 });
        break;
      case 'shot':
        if (event.move === 'muffin') {
          this.noise({ time, duration: 0.12, frequency: 510, volume: 0.22 });
          this.tone({ time, duration: 0.12, from: 325, to: 155, volume: 0.23, type: 'sine' });
          this.tone({ time: time + 0.10, duration: 0.11, from: 196, to: 263, volume: 0.17, type: 'sine' });
          this.tone({ time: time + 0.20, duration: 0.14, from: 245, to: 105, volume: 0.14, type: 'sine' });
        } else {
          this.noise({ time, duration: 0.095, frequency: 2250, volume: 0.29, attack: 0.004 });
          this.tone({ time, duration: 0.09, from: 410, to: 130, volume: 0.24 });
        }
        break;
      case 'poke':
        this.noise({ time, duration: 0.05, frequency: 1950, volume: 0.30 });
        this.tone({ time, duration: 0.055, from: 730, to: 380, volume: 0.18 });
        break;
      case 'check':
        this.noise({ time, duration: 0.16, frequency: 540, volume: 0.44 });
        this.tone({ time, duration: 0.16, from: 150, to: 53, volume: 0.33 });
        break;
      case 'board':
        if (time - this.lastBoard < 0.09) break;
        this.lastBoard = time;
        this.noise({ time, duration: 0.085, frequency: 900, volume: 0.26 });
        this.tone({ time, duration: 0.075, from: 183, to: 99, volume: 0.22 });
        break;
      case 'save':
        this.noise({ time, duration: 0.12, frequency: 1200, volume: 0.33 });
        this.tone({ time, duration: 0.11, from: 280, to: 85, volume: 0.32 });
        break;
      case 'goal':
        this.tone({ time, duration: 0.70, from: 146.8, to: 146.2, volume: 0.57, type: 'sawtooth', attack: 0.045 });
        this.tone({ time, duration: 0.62, from: 220.5, to: 219, volume: 0.32, attack: 0.065 });
        this.tone({ time: time + 0.24, duration: 0.48, from: 293.7, to: 289, volume: 0.22, attack: 0.05 });
        break;
      case 'special':
        this.special(event.move, time);
        break;
      case 'michigan-release':
        this.noise({ time, duration: 0.16, frequency: 3160, volume: 0.35, filter: 'highpass' });
        this.tone({ time, duration: 0.20, from: 967, to: 190, volume: 0.24, type: 'sine' });
        break;
      case 'eject':
        this.tone({ time, duration: 0.31, from: 1350, to: 265, volume: 0.24, type: 'sine', attack: 0.018 });
        this.noise({ time: time + 0.23, duration: 0.15, frequency: 650, volume: 0.32 });
        this.tone({ time: time + 0.24, duration: 0.14, from: 188, to: 62, volume: 0.36 });
        break;
      case 'return':
        this.tone({ time, duration: 0.09, from: 440, to: 565, volume: 0.15, type: 'sine' });
        this.tone({ time: time + 0.075, duration: 0.10, from: 659, to: 881, volume: 0.15, type: 'sine' });
        break;
      case 'substitution':
        this.tone({ time, duration: 0.21, from: 550, to: 410, volume: 0.29, type: 'triangle' });
        this.tone({ time: time + 0.16, duration: 0.28, from: 288, to: 117, volume: 0.24, type: 'sine' });
        this.noise({ time: time + 0.28, duration: 0.15, frequency: 510, volume: 0.29 });
        break;
      case 'shake-throw':
        this.noise({ time, duration: 0.22, frequency: 2200, volume: 0.23, filter: 'highpass', attack: 0.016 });
        this.tone({ time, duration: 0.24, from: 680, to: 300, volume: 0.22, type: 'sine' });
        break;
      case 'shake-hit':
        this.noise({ time, duration: 0.22, frequency: 405, volume: 0.57, quality: 1.2 });
        this.tone({ time, duration: 0.15, from: 240, to: 81, volume: 0.32 });
        this.tone({ time: time + 0.06, duration: 0.14, from: 242, to: 126, volume: 0.24, type: 'sine' });
        break;
    }
  }

  skate(speed, dt) {
    if (!this.ready || speed < 47) {
      this.suspendSkate();
      return;
    }

    this.skateDelay -= dt;
    if (this.skateDelay > 0) return;
    const effort = Math.min(speed / 280, 1);
    this.skateDelay = 0.26 - effort * 0.13;
    this.noise({
      time: this.context.currentTime + 0.004,
      duration: 0.12,
      frequency: 1250 + 750 * effort,
      volume: 0.045 + 0.14 * effort,
      filter: 'highpass',
      attack: 0.023,
    });
  }

  suspendSkate() {
    this.skateDelay = 0;
  }
}
