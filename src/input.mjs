const MOVEMENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

const ACTION = {
  Space: 'shoot', KeyJ: 'poke', KeyK: 'check', KeyL: 'special',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

const FALLBACK_KEYS = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', j: 'KeyJ', k: 'KeyK', l: 'KeyL',
  ' ': 'Space', shift: 'ShiftLeft', escape: 'Escape',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
};

function keyCode(event) {
  if (event.code && event.code !== 'Unidentified') return event.code;
  return FALLBACK_KEYS[event.key?.toLowerCase()];
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function capture(element, pointerId) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // A pointer can end before capture is established.
  }
}

function release(element, pointerId) {
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

export class Input {
  constructor({ joystick, knob, actionButtons, onPause }) {
    this.joystick = joystick;
    this.knob = knob;
    this.actionButtons = actionButtons;
    this.onPause = onPause;
    this.enabled = false;
    this.held = new Set();
    this.pending = new Set();
    this.stick = { id: null, x: 0, y: 0 };
    this.touches = new Map();

    window.addEventListener('keydown', (event) => this.keydown(event));
    window.addEventListener('keyup', (event) => this.held.delete(keyCode(event)));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });

    joystick.addEventListener('pointerdown', (event) => this.startStick(event));
    joystick.addEventListener('pointermove', (event) => this.moveStick(event));
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      joystick.addEventListener(name, (event) => {
        if (event.pointerId === this.stick.id) this.resetStick();
      });
    }
    joystick.addEventListener('contextmenu', (event) => event.preventDefault());

    for (const [action, button] of Object.entries(actionButtons)) {
      if (!button) continue;
      button.addEventListener('pointerdown', (event) => this.startAction(event, action, button));
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(name, (event) => this.endAction(event.pointerId, button));
      }
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      button.addEventListener('click', (event) => {
        if (this.enabled && event.detail === 0) this.pending.add(action);
      });
    }
  }

  keydown(event) {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    const code = keyCode(event);
    const action = ACTION[code];

    if (code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) this.onPause?.();
      return;
    }
    if (!MOVEMENT.has(code) && !action) return;
    event.preventDefault();
    this.held.add(code);
    if (action && !event.repeat) this.pending.add(action);
  }

  startStick(event) {
    if (!this.enabled || event.button !== 0 || this.stick.id !== null) return;
    event.preventDefault();
    this.stick.id = event.pointerId;
    this.joystick.classList.add('is-active');
    capture(this.joystick, event.pointerId);
    this.moveStick(event);
  }

  moveStick(event) {
    if (event.pointerId !== this.stick.id) return;
    const bounds = this.joystick.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const range = Math.max(1, Math.min(bounds.width, bounds.height) * 0.31);
    const distance = Math.hypot(dx, dy);
    const scale = distance ? Math.min(1, range / distance) : 0;
    const strength = clamp((distance / range - 0.11) / 0.89, 0, 1);
    this.stick.x = distance ? dx / distance * strength : 0;
    this.stick.y = distance ? dy / distance * strength : 0;
    this.joystick.style.setProperty('--stick-x', `${this.stick.x * 100}%`);
    this.joystick.style.setProperty('--stick-y', `${this.stick.y * 100}%`);
    this.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  resetStick() {
    const previousId = this.stick.id;
    this.stick.id = null;
    this.stick.x = 0;
    this.stick.y = 0;
    this.joystick.classList.remove('is-active');
    this.joystick.style.removeProperty('--stick-x');
    this.joystick.style.removeProperty('--stick-y');
    this.knob.style.transform = '';
    if (previousId !== null) release(this.joystick, previousId);
  }

  startAction(event, action, button) {
    if (!this.enabled || event.button !== 0) return;
    event.preventDefault();
    this.touches.set(event.pointerId, action);
    this.pending.add(action);
    button.classList.add('is-pressed');
    capture(button, event.pointerId);
  }

  endAction(pointerId, button) {
    const action = this.touches.get(pointerId);
    if (!action) return;
    this.touches.delete(pointerId);
    if (![...this.touches.values()].includes(action)) button.classList.remove('is-pressed');
    release(button, pointerId);
  }

  sample() {
    const left = this.held.has('KeyA') || this.held.has('ArrowLeft');
    const right = this.held.has('KeyD') || this.held.has('ArrowRight');
    const up = this.held.has('KeyW') || this.held.has('ArrowUp');
    const down = this.held.has('KeyS') || this.held.has('ArrowDown');
    const x = this.stick.x + Number(right) - Number(left);
    const y = this.stick.y + Number(down) - Number(up);
    const length = Math.max(1, Math.hypot(x, y));
    let touchSprint = false;
    for (const action of this.touches.values()) touchSprint ||= action === 'sprint';
    const sample = {
      x: x / length,
      y: y / length,
      shoot: this.pending.has('shoot'),
      poke: this.pending.has('poke'),
      check: this.pending.has('check'),
      special: this.pending.has('special'),
      sprint: this.held.has('ShiftLeft') || this.held.has('ShiftRight') ||
        this.pending.has('sprint') || touchSprint,
    };
    this.pending.clear();
    return sample;
  }

  clear() {
    this.held.clear();
    this.pending.clear();
    this.resetStick();
    for (const [pointerId, action] of this.touches) this.endAction(pointerId, this.actionButtons[action]);
  }
}
