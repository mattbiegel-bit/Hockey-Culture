export const RINK = Object.freeze({
  left: 99,
  right: 433,
  top: 39,
  bottom: 573,
  goalX: 266,
  goalY: 73,
  goalWidth: 76,
  goalDepth: 22,
  corner: 29,
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ speed: 115, reaction: 0.27, pressure: 0.53, shotSpeed: 478, accuracy: 19, goalieSpeed: 91, goalieRead: 0.17, goalieDelay: 0.14, goaliePad: -2 }),
  normal: Object.freeze({ speed: 139, reaction: 0.15, pressure: 0.75, shotSpeed: 550, accuracy: 13, goalieSpeed: 136, goalieRead: 0.37, goalieDelay: 0.11, goaliePad: -1 }),
  hard: Object.freeze({ speed: 164, reaction: 0.09, pressure: 0.94, shotSpeed: 610, accuracy: 9, goalieSpeed: 174, goalieRead: 0.51, goalieDelay: 0.09, goaliePad: 0 }),
});

export const SKATER_PROFILES = Object.freeze([
  Object.freeze({
    number: 24, color: 'white', handedness: 'left', radius: 13.2, mass: 1.14,
    pace: 151, boost: 1.30, checkStrength: 1.28, shotSpeed: 555, accuracy: 13, holdChance: 0, move: 'deke',
  }),
  Object.freeze({
    number: 11, color: 'black', handedness: 'right', radius: 12, mass: 1,
    pace: 174, boost: 1.28, checkStrength: 0.91, shotSpeed: 625, accuracy: 8, holdChance: 0, move: 'slapshot',
  }),
  Object.freeze({
    number: 39, color: 'orange', handedness: 'left', radius: 12.5, mass: 1.23,
    pace: 145, boost: 1.24, checkStrength: 1.03, shotSpeed: 595, accuracy: 10, holdChance: 0.34, move: 'michigan',
  }),
]);

export const SUBSTITUTE_PROFILE = Object.freeze({
  number: 44, color: 'orange', handedness: 'left', radius: 14.2, mass: 1.27,
  pace: 116, boost: 1.17, checkStrength: 0.82, shotSpeed: 434, accuracy: 20, holdChance: 0, move: 'muffin',
});

const MATCH_SECONDS = 180;
const CHARGE_RATE = 1 / 35;
const PUCK_RADIUS = 4;
const GOALIE_RADIUS = 15;
const GOAL_LEFT = RINK.goalX - RINK.goalWidth / 2;
const GOAL_RIGHT = RINK.goalX + RINK.goalWidth / 2;
const GOAL_BACK = RINK.goalY - RINK.goalDepth;
const STARTS = [[266, 429], [175, 399], [357, 399]];
const COACH = { x: 471, y: 292 };
const TRACK = { left: 65, right: 531, top: 19, bottom: 591 };
const TRACK_WIDTH = TRACK.right - TRACK.left;
const TRACK_HEIGHT = TRACK.bottom - TRACK.top;
const TRACK_LENGTH = 2 * (TRACK_WIDTH + TRACK_HEIGHT);
const MICHIGAN_PLAYER = 2;
const SPECIAL_SECONDS = { deke: 0.68, slapshot: 0.31, michigan: 0.45, muffin: 0.24 };
const MICHIGAN_HOLD_SECONDS = 1.45;
const SUBSTITUTION_SECONDS = 3.8;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toward = (value, target, travel) => value + clamp(target - value, -travel, travel);

function unit(x, y) {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length, length } : { x: 0, y: 0, length: 0 };
}

function face(skater) {
  return { x: Math.cos(skater.angle), y: Math.sin(skater.angle) };
}

function clearance(start, targetX, goalie) {
  const endY = RINK.goalY - 3;
  const shotX = (targetX - start.x) / 18;
  const shotY = (endY - start.y) / 14;
  const keeperX = (goalie.x + goalie.vx * 0.08 - start.x) / 18;
  const keeperY = (goalie.y - start.y) / 14;
  const closest = clamp((keeperX * shotX + keeperY * shotY) / (shotX ** 2 + shotY ** 2 || 1), 0, 1);
  return Math.hypot(keeperX - shotX * closest, keeperY - shotY * closest);
}

function trackPosition(distance) {
  if (distance < TRACK_WIDTH) return { x: TRACK.left + distance, y: TRACK.top, angle: 0 };
  distance -= TRACK_WIDTH;
  if (distance < TRACK_HEIGHT) return { x: TRACK.right, y: TRACK.top + distance, angle: Math.PI / 2 };
  distance -= TRACK_HEIGHT;
  if (distance < TRACK_WIDTH) return { x: TRACK.right - distance, y: TRACK.bottom, angle: Math.PI };
  return { x: TRACK.left, y: TRACK.bottom - (distance - TRACK_WIDTH), angle: -Math.PI / 2 };
}

function rescueDistance(ejection) {
  if (ejection.edge === 'top') return ejection.toX - TRACK.left;
  if (ejection.edge === 'right') return TRACK_WIDTH + ejection.toY - TRACK.top;
  if (ejection.edge === 'bottom') return TRACK_WIDTH + TRACK_HEIGHT + TRACK.right - ejection.toX;
  return 2 * TRACK_WIDTH + TRACK_HEIGHT + TRACK.bottom - ejection.toY;
}

function boardExit(skater, direction, impact) {
  const distance = skater.radius + 19 * impact;
  if (direction.x > 0.65 && RINK.right - skater.x < distance) return { edge: 'right', dx: 1, dy: 0 };
  if (direction.x < -0.65 && skater.x - RINK.left < distance) return { edge: 'left', dx: -1, dy: 0 };
  if (direction.y > 0.65 && RINK.bottom - skater.y < distance) return { edge: 'bottom', dx: 0, dy: 1 };
  if (direction.y < -0.65 && skater.y - RINK.top < distance) return { edge: 'top', dx: 0, dy: -1 };
  return null;
}

function constrain(body, radius, bounce = 0) {
  const nearestX = clamp(body.x, RINK.left + RINK.corner, RINK.right - RINK.corner);
  const nearestY = clamp(body.y, RINK.top + RINK.corner, RINK.bottom - RINK.corner);
  const normal = unit(body.x - nearestX, body.y - nearestY);
  const limit = RINK.corner - radius;
  if (normal.length <= limit) return 0;
  body.x = nearestX + normal.x * limit;
  body.y = nearestY + normal.y * limit;
  const speed = body.vx * normal.x + body.vy * normal.y;
  if (speed > 0) {
    body.vx -= normal.x * speed * (1 + bounce);
    body.vy -= normal.y * speed * (1 + bounce);
  }
  return speed;
}

function newSkater(id, previous, profile = previous?.profile ?? SKATER_PROFILES[id]) {
  const [x, y] = STARTS[id];
  const { number, handedness, radius, mass, move } = profile;
  return {
    id, x, y, number, handedness, radius, mass, move, profile,
    score: previous?.score ?? 0,
    specialCharge: previous?.profile === profile ? previous.specialCharge : 0,
    vx: 0, vy: 0, angle: -Math.PI / 2,
    stun: 0, action: null, actionTime: 0,
    pokeCooldown: 0, checkCooldown: 0, pickupCooldown: 0,
    carryTime: 0, decisionTime: 0, pokeNext: false, checkNext: false,
    checkHit: false, specialTime: 0, specialAge: 0, specialRelease: false,
    ejection: null, departing: false,
  };
}

function newPuck(x = RINK.goalX, y = 334) {
  return {
    x, y, vx: 0, vy: 0, radius: PUCK_RADIUS, height: 0,
    owner: null, lastTouch: null, shotBy: null, shotOriginX: null, shotAge: 0, pickupDelay: 0,
    flightTime: 0, flightDuration: 0, wobble: 0,
  };
}

export class Game {
  constructor({ difficulty = 'normal', random = Math.random, humanId = 0 } = {}) {
    this.random = random;
    this.reset(difficulty, humanId);
  }

  reset(difficulty = this.difficulty, humanId = this.humanId) {
    this.difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'normal';
    this.settings = DIFFICULTIES[this.difficulty];
    this.humanId = Number.isInteger(humanId) && humanId >= 0 && humanId < STARTS.length ? humanId : 0;
    this.goalTarget = this.humanId === MICHIGAN_PLAYER ? 5 : null;
    this.events = [];
    this.timeLeft = MATCH_SECONDS;
    this.roundDelay = 0;
    this.finished = false;
    this.skaters = [];
    this.round = 0;
    this.manager = null;
    const initialTrack = TRACK_WIDTH + 45;
    this.mascot = { ...trackPosition(initialTrack), distance: initialTrack, action: 'run', actionTime: 0 };
    this.shake = null;
    this.shakeCooldown = 9;
    this.resetRound();
  }

  resetRound() {
    const substituting = this.manager !== null;
    this.skaters = STARTS.map((_, id) => newSkater(
      id,
      this.skaters[id],
      substituting && id === MICHIGAN_PLAYER ? SUBSTITUTE_PROFILE : undefined,
    ));
    this.manager = null;
    this.goalie = {
      x: RINK.goalX, y: 93, vx: 0, vy: 0, radius: GOALIE_RADIUS,
      action: null, actionTime: 0,
    };
    // Vary later drops across neutral ice to give all three skaters a fair race.
    this.puck = this.round === 0
      ? newPuck()
      : newPuck(RINK.goalX + (this.random() * 2 - 1) * 85, 321 + this.random() * 32);
    this.round += 1;
    this.roundDelay = 0;
    this.lastScorer = null;
    this.lastScorerNumber = null;
    this.shake = null;
    this.idleTime = 0;
    this.battleTime = 0;
    this.emit('round', this.puck, { round: this.round });
  }

  rankings() {
    const sorted = this.skaters
      .map(({ id, score }) => ({ id, score }))
      .sort((a, b) => b.score - a.score || a.id - b.id);
    return sorted.map((skater) => ({
      ...skater,
      rank: sorted.findIndex(({ score }) => score === skater.score) + 1,
    }));
  }

  drainEvents() {
    return this.events.splice(0);
  }

  emit(type, position, detail = {}) {
    this.events.push({ type, x: position.x, y: position.y, ...detail });
  }

  // Cap physics catch-up in the browser while keeping the clock on elapsed time.
  update(dt, input = {}, elapsed = dt) {
    if (this.finished || !Number.isFinite(elapsed) || elapsed <= 0) return;
    const timed = this.goalTarget === null;
    let remaining = Math.min(dt, elapsed, timed ? this.timeLeft : elapsed);
    let controls = input;
    while (remaining > 0.000001 && !this.finished) {
      const step = Math.min(remaining, 1 / 120);
      this.step(step, controls);
      remaining -= step;
      if (controls.shoot || controls.poke || controls.check || controls.special) {
        controls = { ...controls, shoot: false, poke: false, check: false, special: false };
      }
    }
    if (timed) {
      this.timeLeft = Math.max(0, this.timeLeft - elapsed);
      if (this.timeLeft <= 0.000001) {
        this.timeLeft = 0;
        this.finish();
      }
    }
  }

  finish() {
    this.finished = true;
    this.emit('end', this.puck, { rankings: this.rankings() });
  }

  step(dt, input) {
    this.moveMascot(dt);
    for (const skater of this.skaters) {
      if (skater.ejection) this.moveEjected(skater, dt);
    }
    if (this.roundDelay > 0) {
      if (this.manager) this.moveManager(dt);
      this.roundDelay = Math.max(0, this.roundDelay - dt);
      if (this.roundDelay === 0) this.resetRound();
      return;
    }

    this.puck.pickupDelay = Math.max(0, this.puck.pickupDelay - dt);
    this.puck.shotAge += dt;
    for (const skater of this.skaters) {
      if (skater.ejection) continue;
      this.tickSkater(skater, dt);
      const human = skater.id === this.humanId;
      const commands = human ? input : this.planAI(skater);
      if (skater.stun <= 0) {
        if (commands.special) this.startSpecial(skater, commands);
        const winding = skater.specialTime > 0 && skater.move !== 'deke';
        this.steer(skater, commands, dt);
        if (winding && human && skater.move === 'michigan' && commands.shoot) skater.specialRelease = true;
        if (!winding) {
          if (commands.check) this.startCheck(skater);
          if (commands.poke) this.poke(skater);
          if (commands.shoot && this.puck.owner === skater.id &&
              (human || skater.move !== 'deke' || skater.specialTime < 0.37)) this.shoot(skater, commands);
        }
      } else {
        skater.vx *= Math.exp(-4.7 * dt);
        skater.vy *= Math.exp(-4.7 * dt);
      }
    }

    for (const skater of this.skaters) {
      if (skater.ejection) continue;
      skater.x += skater.vx * dt;
      skater.y += skater.vy * dt;
      this.constrainSkater(skater);
    }
    this.resolveSkaters();
    this.moveGoalie(dt);
    this.movePuck(dt);
    this.moveShake(dt, input);
    this.observePractice(dt, input);
  }

  tickSkater(skater, dt) {
    skater.stun = Math.max(0, skater.stun - dt);
    skater.actionTime = Math.max(0, skater.actionTime - dt);
    skater.pokeCooldown = Math.max(0, skater.pokeCooldown - dt);
    skater.checkCooldown = Math.max(0, skater.checkCooldown - dt);
    skater.pickupCooldown = Math.max(0, skater.pickupCooldown - dt);
    skater.decisionTime = Math.max(0, skater.decisionTime - dt);
    this.addCharge(skater, CHARGE_RATE * dt);
    skater.carryTime = this.puck.owner === skater.id ? skater.carryTime + dt : 0;
    if (skater.actionTime === 0) skater.action = null;
    this.tickSpecial(skater, dt);
  }

  addCharge(skater, amount) {
    skater.specialCharge = Math.min(1, skater.specialCharge + amount);
  }

  startSpecial(skater, controls = {}) {
    if (skater.specialCharge < 1 || skater.specialTime > 0 || skater.stun > 0 ||
        skater.ejection || this.puck.owner !== skater.id) return false;
    const { move } = skater;
    skater.specialCharge = 0;
    skater.specialTime = move === 'michigan' && skater.id === this.humanId
      ? MICHIGAN_HOLD_SECONDS
      : SPECIAL_SECONDS[move];
    skater.specialAge = 0;
    skater.specialRelease = false;
    skater.action = move;
    skater.actionTime = skater.specialTime;
    if (move === 'deke') {
      const direction = unit(controls.x || 0, controls.y || 0);
      if (direction.length > 0.1) skater.angle = Math.atan2(direction.y, direction.x);
      const front = face(skater);
      skater.vx = front.x * 244;
      skater.vy = front.y * 244;
    }
    this.emit('special', skater, { player: skater.id, number: skater.number, move });
    return true;
  }

  tickSpecial(skater, dt) {
    if (skater.specialTime === 0) return;
    if (this.puck.owner !== skater.id || skater.stun > 0) {
      skater.specialTime = 0;
      if (skater.action === skater.move) {
        skater.action = null;
        skater.actionTime = 0;
      }
      return;
    }
    skater.specialAge += dt;
    skater.specialTime = Math.max(0, skater.specialTime - dt);
    const manualRelease = skater.move === 'michigan' && skater.id === this.humanId;
    if (manualRelease && skater.specialRelease && skater.specialAge >= 0.16) {
      skater.specialTime = 0;
      this.shoot(skater, {}, skater.move);
    } else if (!manualRelease && skater.specialTime === 0 && skater.move !== 'deke') {
      this.shoot(skater, {}, skater.move);
    }
  }

  steer(skater, commands, dt) {
    let direction = unit(commands.x || 0, commands.y || 0);
    const deking = skater.move === 'deke' && skater.specialTime > 0;
    if (deking && direction.length < 0.1) direction = { ...face(skater), length: 1 };
    const power = Math.min(1, direction.length);
    const { profile } = skater;
    const ease = skater.id === this.humanId ? 0 : (this.settings.speed - DIFFICULTIES.normal.speed) * 0.18;
    const pace = profile.pace + ease;
    const carrying = this.puck.owner === skater.id;
    const boost = commands.sprint ? profile.boost - (carrying ? 0.06 : 0) : 1;
    const strength = skater.action === 'check' ? 3.1 : power > 0 ? 11.5 + ease * 0.43 : 6.9;
    const movePace = skater.specialTime > 0 ? (deking ? 1.66 / boost : 0.64) : 1;
    const carryPace = skater.number === 39 ? 0.92 : 0.89;
    const speed = pace * boost * (carrying ? carryPace : 1) * power * movePace;
    const blend = 1 - Math.exp(-strength * dt);
    skater.vx += (direction.x * speed - skater.vx) * blend;
    skater.vy += (direction.y * speed - skater.vy) * blend;

    if (power > 0.1 && skater.action !== 'check') {
      skater.angle = Math.atan2(direction.y, direction.x);
    }
  }

  constrainSkater(skater) {
    if (skater.ejection) return;
    constrain(skater, skater.radius);
    const front = RINK.goalY + skater.radius + 3;
    const left = GOAL_LEFT - skater.radius;
    const right = GOAL_RIGHT + skater.radius;
    if (skater.y >= front || skater.x <= left || skater.x >= right) return;
    const edge = skater.x < RINK.goalX ? left : right;
    if (front - skater.y <= Math.abs(skater.x - edge)) {
      skater.y = front;
      skater.vy = Math.max(0, skater.vy);
    } else {
      skater.x = edge;
      skater.vx = edge === left ? Math.min(0, skater.vx) : Math.max(0, skater.vx);
    }
  }

  eject(attacker, skater, { edge, dx, dy }) {
    const outsideX = dx < 0 ? RINK.left - 25 : RINK.right + 25;
    const outsideY = dy < 0 ? RINK.top - 14 : RINK.bottom + 15;
    skater.ejection = {
      edge, dx, dy, phase: 'exit', progress: 0, height: 0,
      fromX: skater.x, fromY: skater.y,
      toX: dx ? outsideX : clamp(skater.x + skater.vx * 0.14, RINK.left + 12, RINK.right - 12),
      toY: dy ? outsideY : clamp(skater.y + skater.vy * 0.14, RINK.top + 12, RINK.bottom - 12),
    };
    skater.action = 'ejected';
    skater.actionTime = 0.3;
    skater.specialTime = 0;
    this.emit('eject', skater, { player: attacker.id, target: skater.id, edge });
  }

  moveEjected(skater, dt) {
    const { ejection } = skater;
    if (ejection.phase === 'waiting') return;
    const returning = ejection.phase === 'return';
    ejection.progress = Math.min(1, ejection.progress + dt / (returning ? 0.42 : 0.29));
    const progress = ejection.progress;
    skater.x = ejection.fromX + (ejection.toX - ejection.fromX) * progress;
    skater.y = ejection.fromY + (ejection.toY - ejection.fromY) * progress;
    ejection.height = Math.sin(Math.PI * progress) * (returning ? 23 : 16);
    skater.actionTime = (1 - progress) * (returning ? 0.42 : 0.29);
    if (progress < 1) return;

    skater.vx = 0;
    skater.vy = 0;
    if (returning) {
      skater.ejection = null;
      skater.stun = 0.17;
      skater.action = 'stun';
      skater.actionTime = 0.17;
      skater.pickupCooldown = 0.24;
    } else {
      ejection.phase = 'waiting';
    }
  }

  moveMascot(dt) {
    const { mascot } = this;
    if (mascot.actionTime > 0) {
      mascot.actionTime = Math.max(0, mascot.actionTime - dt);
      return;
    }
    mascot.action = 'run';
    const ejected = this.skaters.find(({ ejection }) => ejection?.phase === 'waiting');
    let travel = dt * 210;
    if (ejected) {
      const destination = rescueDistance(ejected.ejection);
      const difference = (destination - mascot.distance + 1.5 * TRACK_LENGTH) % TRACK_LENGTH - 0.5 * TRACK_LENGTH;
      travel = clamp(difference, -780 * dt, 780 * dt);
      if (Math.abs(difference) <= 780 * dt) {
        mascot.distance = destination;
        Object.assign(mascot, trackPosition(destination));
        this.throwSkaterBack(ejected);
        return;
      }
    }
    mascot.distance = (mascot.distance + travel + TRACK_LENGTH) % TRACK_LENGTH;
    Object.assign(mascot, trackPosition(mascot.distance));
    if (travel < 0) mascot.angle += Math.PI;
  }

  throwSkaterBack(skater) {
    const { ejection } = skater;
    const { dx, dy, edge } = ejection;
    const clampX = clamp(skater.x - dx * 66, RINK.left + 38, RINK.right - 38);
    const clampY = clamp(skater.y - dy * 63, RINK.top + 51, RINK.bottom - 38);
    Object.assign(ejection, {
      phase: 'return', progress: 0, height: 0,
      fromX: skater.x, fromY: skater.y, toX: clampX, toY: clampY,
    });
    this.mascot.action = 'throw';
    this.mascot.actionTime = 0.42;
    this.mascot.angle = Math.atan2(-dy, -dx);
    this.mascot.x = skater.x + dx * 13;
    this.mascot.y = skater.y + dy * 5;
    skater.action = 'thrown';
    skater.actionTime = 0.42;
    skater.angle = this.mascot.angle;
    this.emit('return', skater, { player: skater.id, edge });
  }

  startSubstitution(skater) {
    const manager = {
      x: 563, y: 375, angle: Math.PI, action: 'walk', phase: 'enter', age: 0,
      playerX: skater.x, playerY: skater.y,
    };
    this.manager = manager;
    this.roundDelay = SUBSTITUTION_SECONDS;
    this.shake = null;
    skater.ejection = null;
    skater.vx = 0;
    skater.vy = 0;
    skater.action = null;
    skater.stun = 0;
    this.emit('substitution', manager, { player: skater.id, outgoing: 39, incoming: 44 });
  }

  moveManager(dt) {
    const { manager } = this;
    const skater = this.skaters[MICHIGAN_PLAYER];
    manager.age += dt;
    if (manager.age < 0.95) {
      const walk = manager.age / 0.95;
      manager.x = 563 - walk * 96;
      manager.y = 375 - walk * 5;
      return;
    }

    if (manager.age < 2.47) {
      Object.assign(manager, { phase: 'dismiss', action: 'point', x: 467, y: 370, angle: Math.PI });
      const approach = clamp((manager.age - 1.25) / 0.83, 0, 1);
      const gate = clamp((manager.age - 2.08) / 0.39, 0, 1);
      if (approach === 0) return;
      skater.departing = true;
      const dx = 414 - manager.playerX;
      const dy = 367 - manager.playerY;
      skater.x = manager.playerX + dx * approach + 39 * gate;
      skater.y = manager.playerY + dy * approach;
      skater.angle = gate > 0 ? 0 : Math.atan2(dy, dx);
      return;
    }

    const exit = clamp((manager.age - 2.47) / (SUBSTITUTION_SECONDS - 2.47), 0, 1);
    Object.assign(manager, { phase: 'escort', action: 'walk', x: 467 + 122 * exit, y: 370, angle: 0 });
    skater.x = 453 + 118 * exit;
    skater.y = 367;
    skater.angle = 0;
  }

  throwShake(input) {
    const target = this.skaters[MICHIGAN_PLAYER];
    if (this.shake || target.number !== 39 || target.ejection || this.roundDelay > 0) return false;
    const distance = Math.hypot(target.x - COACH.x, target.y - COACH.y);
    const duration = clamp(distance / 350, 0.35, 0.88);
    const commands = target.id === this.humanId ? (input ?? {}) : this.planAI(target, false);
    const planned = unit(commands.x || 0, commands.y || 0);
    const { profile } = target;
    const carrying = this.puck.owner === target.id;
    const boost = commands.sprint ? profile.boost : 1;
    const pace = target.stun > 0 ? 0 : profile.pace * boost * (carrying ? 0.92 : 1);
    const momentum = (1 - Math.exp(-11.5 * duration)) / 11.5;
    const travel = Math.min(planned.length, 1) * pace * (duration - momentum) * 0.86;
    const toX = clamp(target.x + target.vx * momentum + planned.x * travel, RINK.left + 10, RINK.right - 8);
    const toY = clamp(target.y + target.vy * momentum + planned.y * travel, RINK.top + 10, RINK.bottom - 10);
    this.shake = {
      x: COACH.x, y: COACH.y, height: 9, angle: Math.atan2(toY - COACH.y, toX - COACH.x),
      age: 0, duration, toX, toY,
    };
    this.shakeCooldown = 13 + this.random() * 8;
    this.emit('shake-throw', COACH, { player: target.id, target: target.id, number: target.number });
    return true;
  }

  moveShake(dt, input) {
    this.shakeCooldown = Math.max(0, this.shakeCooldown - dt);
    const target = this.skaters[MICHIGAN_PLAYER];
    if (target.number !== 39) return;
    if (!this.shake) {
      if (this.shakeCooldown === 0 && Math.hypot(target.x - COACH.x, target.y - COACH.y) < 249) this.throwShake(input);
      return;
    }

    const { shake } = this;
    shake.age += dt;
    const travel = Math.min(1, shake.age / shake.duration);
    shake.x = COACH.x + (shake.toX - COACH.x) * travel;
    shake.y = COACH.y + (shake.toY - COACH.y) * travel;
    shake.height = (1 - travel) * 9 + 24 * Math.sin(Math.PI * travel);
    shake.angle += dt * 13;
    if (!target.ejection && travel > 0.68 && shake.height < 18 &&
        Math.hypot(target.x - shake.x, target.y - shake.y) < target.radius + 6) {
      this.knockDownWithShake(target, shake);
      this.shake = null;
    } else if (travel === 1 && shake.age > shake.duration + 0.22) {
      this.shake = null;
    }
  }

  knockDownWithShake(skater, shake) {
    skater.stun = 0.79;
    skater.action = 'bottle-hit';
    skater.actionTime = skater.stun;
    skater.specialTime = 0;
    if (this.puck.owner === skater.id) {
      this.setStickPosition(skater);
      this.release(skater.vx * 0.75 - 38, skater.vy * 0.65, 0.15);
      skater.pickupCooldown = skater.stun;
    }
    skater.vx *= 0.55;
    skater.vy *= 0.55;
    this.emit('shake-hit', shake, { player: skater.id, target: skater.id, number: skater.number });
  }

  planAI(skater, decide = true) {
    const { puck, goalie, settings } = this;
    const opponent = puck.owner === null ? null : this.skaters[puck.owner];
    const side = skater.id === 1 ? -1 : 1;
    let targetX = puck.x;
    let targetY = puck.y;
    let shoot = false;
    let poke = false;
    let check = false;
    let special = false;

    if (opponent === skater) {
      const lane = RINK.goalX + side * 61;
      targetX = skater.y > 238 ? lane : RINK.goalX + side * 40;
      targetY = 125;
      if (skater.y < 123) {
        targetX = RINK.goalX + (Math.sign(skater.x - RINK.goalX) || side) * 73;
        targetY = 156;
      }
      const shotDistance = skater.y - RINK.goalY;
      const clearEnough = Math.abs(skater.x - RINK.goalX) < (shotDistance < 143 ? 108 : 76);
      const chargeReady = skater.specialCharge >= 1;
      if (chargeReady && skater.carryTime > 0.12 && clearEnough) {
        special = skater.move === 'michigan'
          ? shotDistance > 25 && shotDistance < 125 && Math.abs(skater.x - RINK.goalX) < 86
          : shotDistance > 39 && shotDistance < 205;
      }
      const savingForMichigan = chargeReady && skater.move === 'michigan' && shotDistance > 125;
      if (!special && !savingForMichigan && skater.carryTime > settings.reaction + 0.13 &&
          clearEnough && shotDistance > 29 && shotDistance < (this.difficulty === 'easy' ? 136 : 170)) {
        shoot = true;
      }
    } else if (opponent) {
      const gap = Math.hypot(opponent.x - skater.x, opponent.y - skater.y);
      targetX = opponent.x + opponent.vx * 0.13 + (gap > 47 ? side * 17 : 0);
      targetY = opponent.y + opponent.vy * 0.13;
      if (decide && gap < 52 && skater.decisionTime === 0) {
        skater.decisionTime = settings.reaction;
        skater.pokeNext = this.random() < settings.pressure;
        skater.checkNext = this.random() < settings.pressure * 0.56;
      }
      check = gap < 35 && skater.checkNext && skater.checkCooldown === 0;
      poke = !check && gap < 42 && skater.pokeNext && skater.pokeCooldown === 0;
      if (decide && check) skater.checkNext = false;
      if (decide && poke) skater.pokeNext = false;
    } else {
      const gap = Math.hypot(puck.x - skater.x, puck.y - skater.y);
      const lead = clamp(gap / 410, 0, 0.22);
      targetX = clamp(puck.x + puck.vx * lead, RINK.left + 12, RINK.right - 12);
      targetY = clamp(puck.y + puck.vy * lead, RINK.top + 12, RINK.bottom - 12);
      if (targetY < RINK.goalY + 11) {
        const laneSide = Math.sign(targetX - RINK.goalX) || side;
        const laneX = RINK.goalX + laneSide * 64;
        if ((skater.x - laneX) * laneSide < 0) {
          targetX = laneX + laneSide * 8;
          targetY = Math.max(skater.y, RINK.goalY + 60);
        }
      }
    }

    const direction = unit(targetX - skater.x, targetY - skater.y);
    let steerX = direction.x;
    let steerY = direction.y;
    for (const rival of [...this.skaters, goalie]) {
      if (rival === skater || rival.ejection || rival === opponent && opponent !== skater) continue;
      const away = unit(skater.x - rival.x, skater.y - rival.y);
      if (away.length >= 44 || away.length === 0) continue;
      const strength = (1 - away.length / 44) * 0.77;
      steerX += away.x * strength;
      steerY += away.y * strength;
    }
    return { x: steerX, y: steerY, shoot, poke, check, special, sprint: direction.length > 95 && opponent !== skater };
  }

  resolveSkaters() {
    for (let index = 0; index < this.skaters.length; index++) {
      const first = this.skaters[index];
      if (first.ejection) continue;
      for (const second of this.skaters.slice(index + 1)) {
        if (second.ejection) continue;
        const gap = unit(second.x - first.x, second.y - first.y);
        const contact = first.radius + second.radius;
        if (gap.length <= contact + 14) {
          this.tryHit(first, second, gap);
          this.tryHit(second, first, { x: -gap.x, y: -gap.y, length: gap.length });
        }
        if (first.ejection) break;
        if (second.ejection || gap.length >= contact) continue;
        const dx = gap.length === 0 ? 1 : gap.x;
        const dy = gap.y;
        const overlap = (contact - gap.length) * 1.02;
        const weight = second.mass / (first.mass + second.mass);
        first.x -= dx * overlap * weight;
        first.y -= dy * overlap * weight;
        second.x += dx * overlap * (1 - weight);
        second.y += dy * overlap * (1 - weight);
        const closeSpeed = (first.vx - second.vx) * dx + (first.vy - second.vy) * dy;
        if (closeSpeed > 0) {
          const impulse = closeSpeed * 0.48;
          first.vx -= dx * impulse;
          first.vy -= dy * impulse;
          second.vx += dx * impulse;
          second.vy += dy * impulse;
        }
      }
      this.constrainSkater(first);
    }
  }

  startCheck(skater) {
    if (skater.checkCooldown > 0 || skater.specialTime > 0) return;
    const { checkStrength } = skater.profile;
    skater.checkCooldown = 1.04;
    skater.action = 'check';
    skater.actionTime = 0.26;
    skater.checkHit = false;
    const front = face(skater);
    skater.vx += front.x * 93 * checkStrength;
    skater.vy += front.y * 93 * checkStrength;
  }

  tryHit(skater, rival, direction) {
    const front = face(skater);
    if (skater.action !== 'check' || skater.checkHit || skater.ejection || rival.ejection ||
        direction.x * front.x + direction.y * front.y < 0.30) return;

    skater.checkHit = true;
    this.addCharge(skater, 0.07);
    const { checkStrength } = skater.profile;
    const { holdChance } = rival.profile;
    const exit = boardExit(rival, direction, checkStrength);
    const impact = checkStrength * skater.mass / rival.mass;
    const retained = this.puck.owner === rival.id && !exit && holdChance > 0 && this.random() < holdChance;
    rival.stun = 0.49 * checkStrength;
    rival.action = 'stun';
    rival.actionTime = rival.stun;
    rival.vx = direction.x * 160 * impact + skater.vx * 0.25;
    rival.vy = direction.y * 160 * impact + skater.vy * 0.25;
    if (this.puck.owner === rival.id && !retained) {
      this.setStickPosition(rival);
      this.release(direction.x * 179, direction.y * 179, 0.13);
      rival.pickupCooldown = rival.stun;
    }
    this.emit('check', rival, { player: skater.id, target: rival.id, retained });
    if (exit) this.eject(skater, rival, exit);
  }

  poke(skater) {
    if (skater.pokeCooldown > 0 || skater.action === 'check' || this.puck.owner === skater.id) return;
    skater.pokeCooldown = 0.52;
    skater.action = 'poke';
    skater.actionTime = 0.24;
    const owner = this.skaters[this.puck.owner];
    const front = face(skater);
    const target = owner || this.puck;
    const gap = unit(target.x - skater.x, target.y - skater.y);
    if (gap.length > (owner ? 43 : 37) || gap.x * front.x + gap.y * front.y < 0.13 ||
        this.puck.height > 12 || owner?.action === 'deke') return;

    if (owner) {
      this.setStickPosition(owner);
      owner.pickupCooldown = 0.38;
      owner.stun = Math.max(0.12, owner.stun);
    }
    this.release(front.x * 132 + skater.vx * 0.2, front.y * 132 + skater.vy * 0.2, 0.09);
    this.puck.lastTouch = skater.id;
    this.addCharge(skater, 0.035);
    this.emit('poke', this.puck, { player: skater.id, target: owner?.id });
  }

  shoot(skater, controls, move) {
    const { profile } = skater;
    const human = skater.id === this.humanId;
    const front = face(skater);
    this.setStickPosition(skater);
    let heading = front;
    const toGoal = unit(RINK.goalX - this.puck.x, RINK.goalY - this.puck.y);
    const towardGoal = front.x * toGoal.x + front.y * toGoal.y;
    if (!human || (this.puck.y > RINK.goalY + 7 && towardGoal > 0.32)) {
      let side = human && Math.abs(controls.x || 0) > 0.3
        ? Math.sign(controls.x)
        : Math.sign(RINK.goalX - (this.goalie.x + this.goalie.vx * 0.16)) || (this.random() < 0.5 ? -1 : 1);
      if (move === 'michigan') {
        const left = clearance(this.puck, RINK.goalX - 30, this.goalie);
        const right = clearance(this.puck, RINK.goalX + 30, this.goalie);
        if (Math.abs(left - right) > 0.01) side = left > right ? -1 : 1;
      }
      const spread = move && move !== 'muffin' ? 4 : profile.accuracy + (human ? 0 : (this.settings.accuracy - 13) * 0.35);
      const offset = side * 30 + (this.random() * 2 - 1) * spread;
      heading = unit(RINK.goalX + offset - this.puck.x, RINK.goalY - 3 - this.puck.y);
    }
    const settingBoost = human ? 0 : (this.settings.shotSpeed - DIFFICULTIES.normal.shotSpeed) * 0.38;
    const specialSpeeds = { slapshot: 875, michigan: 654, muffin: 478 };
    const speed = specialSpeeds[move] ?? profile.shotSpeed + settingBoost;
    this.release(heading.x * speed, heading.y * speed, 0.21);
    if (skater.move === 'deke') skater.specialTime = 0;
    this.puck.shotBy = skater.id;
    this.puck.shotOriginX = this.puck.x;
    this.puck.shotAge = 0;
    this.puck.lastTouch = skater.id;
    skater.pickupCooldown = 0.34;
    skater.action = move || 'shot';
    skater.actionTime = move ? 0.37 : 0.31;
    if (move === 'michigan') {
      this.puck.flightDuration = 0.36;
      this.puck.height = 13;
      this.emit('michigan-release', this.puck, { player: skater.id, number: skater.number, speed, move });
    }
    if (move === 'muffin') this.puck.wobble = 1;
    this.emit('shot', this.puck, { player: skater.id, number: skater.number, speed, move });
  }

  release(vx, vy, delay) {
    Object.assign(this.puck, {
      owner: null, vx, vy, pickupDelay: delay, shotBy: null,
      height: 0, flightTime: 0, flightDuration: 0, wobble: 0,
    });
  }

  setStickPosition(skater) {
    const front = face(skater);
    const handOffset = skater.handedness === 'left' ? 5 : -5;
    this.puck.x = skater.x + front.x * 17 + front.y * handOffset;
    this.puck.y = skater.y + front.y * 17 - front.x * handOffset;
    this.puck.height = skater.move === 'michigan' && skater.specialTime > 0
      ? 13 * Math.min(1, skater.specialAge * 10)
      : 0;
    if (skater.y >= RINK.goalY && this.puck.x > GOAL_LEFT && this.puck.x < GOAL_RIGHT) {
      this.puck.y = Math.max(RINK.goalY + PUCK_RADIUS + 1, this.puck.y);
    }
    this.puck.vx = skater.vx;
    this.puck.vy = skater.vy;
    constrain(this.puck, PUCK_RADIUS);
  }

  moveGoalie(dt) {
    const { goalie, puck, settings } = this;
    goalie.actionTime = Math.max(0, goalie.actionTime - dt);
    if (goalie.actionTime === 0) goalie.action = null;

    const trackX = puck.shotBy !== null && puck.shotOriginX !== null ? puck.shotOriginX : puck.x;
    let target = RINK.goalX + (trackX - RINK.goalX) * (puck.y < 230 ? 0.32 : 0.19);
    if (puck.shotBy !== null && puck.shotAge > settings.goalieDelay &&
        puck.vy < -110 && puck.y > goalie.y && puck.y < 249) {
      const prediction = puck.x + puck.vx * (goalie.y - puck.y) / puck.vy;
      target += (clamp(prediction, GOAL_LEFT - 14, GOAL_RIGHT + 14) - target) * settings.goalieRead;
    }
    target = clamp(target, RINK.goalX - 29, RINK.goalX + 29);
    const targetY = 86 + clamp((225 - puck.y) / 17, 0, 7);
    const nextX = toward(goalie.x, target, settings.goalieSpeed * dt);
    const nextY = toward(goalie.y, targetY, 46 * dt);
    goalie.vx = (nextX - goalie.x) / dt;
    goalie.vy = (nextY - goalie.y) / dt;
    goalie.x = nextX;
    goalie.y = nextY;

    for (const skater of this.skaters) {
      if (skater.ejection) continue;
      const gap = unit(skater.x - goalie.x, skater.y - goalie.y);
      const contact = skater.radius + goalie.radius;
      if (gap.length >= contact || gap.length === 0) continue;
      skater.x = goalie.x + gap.x * contact;
      skater.y = goalie.y + gap.y * contact;
      const inward = skater.vx * gap.x + skater.vy * gap.y;
      if (inward < 0) {
        skater.vx -= gap.x * inward;
        skater.vy -= gap.y * inward;
      }
      this.constrainSkater(skater);
    }
  }

  movePuck(dt) {
    const { puck } = this;
    if (puck.owner !== null) {
      this.setStickPosition(this.skaters[puck.owner]);
      if (puck.y >= RINK.goalY) this.collideGoalie();
      return;
    }

    const beforeX = puck.x;
    const beforeY = puck.y;
    if (puck.wobble && puck.shotBy !== null) {
      const turn = Math.cos(puck.shotAge * 23) * dt * 0.92;
      const x = puck.vx * Math.cos(turn) - puck.vy * Math.sin(turn);
      puck.vy = puck.vx * Math.sin(turn) + puck.vy * Math.cos(turn);
      puck.vx = x;
    }
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    if (puck.flightDuration > 0) {
      puck.flightTime += dt;
      const arc = Math.min(1, puck.flightTime / puck.flightDuration);
      puck.height = 13 * (1 - arc) + 17 * Math.sin(arc * Math.PI);
      if (arc === 1) puck.flightDuration = 0;
    }
    if (puck.y < GOAL_BACK && puck.x > GOAL_LEFT - 8 && puck.x < GOAL_RIGHT + 8 && Math.abs(puck.vx) < 42) {
      // The gap between the net and boards is too narrow for a skater to enter.
      puck.vx += (Math.sign(puck.x - RINK.goalX) || 1) * 94 * dt;
    }
    const speed = Math.hypot(puck.vx, puck.vy);
    const friction = Math.max(0, 1 - dt * (0.33 + 18 / Math.max(speed, 18)));
    puck.vx *= friction;
    puck.vy *= friction;

    if (this.collideGoalie()) return;
    this.collideNet(beforeX, beforeY);
    if (this.roundDelay > 0) return;

    const impact = constrain(puck, PUCK_RADIUS, 0.77);
    if (impact > 39) this.emit('board', puck, { speed: impact });
    if (puck.shotBy !== null && (speed < 100 || (impact > 39 && puck.y < RINK.goalY + 19))) {
      this.miss();
    }
    if (puck.pickupDelay > 0 || speed > 286 || puck.height > 10) return;

    let nearest = null;
    let closestDistance = 23;
    for (const skater of this.skaters) {
      if (skater.stun > 0 || skater.pickupCooldown > 0 || skater.ejection) continue;
      const front = face(skater);
      const distance = Math.min(
        Math.hypot(puck.x - skater.x, puck.y - skater.y),
        Math.hypot(puck.x - skater.x - front.x * 9, puck.y - skater.y - front.y * 9),
      );
      if (distance >= closestDistance) continue;
      nearest = skater;
      closestDistance = distance;
    }
    if (!nearest) return;
    puck.owner = nearest.id;
    puck.lastTouch = nearest.id;
    puck.shotBy = null;
    this.setStickPosition(nearest);
    this.addCharge(nearest, 0.03);
    this.emit('pickup', puck, { player: nearest.id });
  }

  collideGoalie() {
    const { puck, goalie } = this;
    const width = goalie.radius + PUCK_RADIUS + this.settings.goaliePad +
      (goalie.actionTime > 0 ? 2 : 0) - (puck.height > 13 ? 2 : 0);
    const height = goalie.radius - 5 + PUCK_RADIUS;
    const x = (puck.x - goalie.x) / width;
    const y = (puck.y - goalie.y) / height;
    if (x * x + y * y >= 1) return false;

    let normal = unit(x, y);
    if (normal.length === 0) normal = { x: 0, y: 1 };
    const arriving = puck.vx * normal.x + puck.vy * normal.y;
    if (puck.owner === null && arriving > 0 && goalie.actionTime > 0) return false;
    const player = puck.shotBy ?? puck.owner ?? puck.lastTouch;
    const save = puck.shotBy !== null || puck.owner !== null || arriving < -100;
    if (puck.owner !== null) this.skaters[puck.owner].pickupCooldown = 0.28;

    const side = normal.x || (this.random() < 0.5 ? -0.5 : 0.5);
    const rebound = unit(side * 1.18 + (this.random() - 0.5) * 0.5, Math.max(0.63, normal.y));
    const speed = clamp(140 + Math.abs(arriving) * 0.34, 160, 322);
    puck.x = goalie.x + rebound.x * (width + 1);
    puck.y = goalie.y + rebound.y * (height + 4);
    this.release(rebound.x * speed, rebound.y * speed, 0.15);
    goalie.action = 'save';
    goalie.actionTime = 0.32;
    if (save) this.emit('save', puck, { player, speed });
    return true;
  }

  collideNet(beforeX, beforeY) {
    const { puck } = this;
    if (beforeY >= RINK.goalY && puck.y < RINK.goalY) {
      const crossingX = beforeX + (puck.x - beforeX) * (beforeY - RINK.goalY) / (beforeY - puck.y);
      if (crossingX > GOAL_LEFT + PUCK_RADIUS && crossingX < GOAL_RIGHT - PUCK_RADIUS &&
          puck.lastTouch !== null) {
        this.goal(puck.lastTouch);
        return;
      }
      if (puck.shotBy !== null && (crossingX <= GOAL_LEFT + PUCK_RADIUS || crossingX >= GOAL_RIGHT - PUCK_RADIUS)) {
        this.miss();
      }
    }

    for (const post of [GOAL_LEFT, GOAL_RIGHT]) {
      const normal = unit(puck.x - post, puck.y - RINK.goalY);
      if (normal.length >= PUCK_RADIUS + 3 || normal.length === 0) continue;
      const speed = puck.vx * normal.x + puck.vy * normal.y;
      puck.x = post + normal.x * (PUCK_RADIUS + 3);
      puck.y = RINK.goalY + normal.y * (PUCK_RADIUS + 3);
      if (speed < 0) {
        puck.vx -= normal.x * speed * 1.71;
        puck.vy -= normal.y * speed * 1.71;
        if (speed < -39) this.emit('board', puck, { speed: -speed });
      }
    }

    if (puck.x > GOAL_LEFT && puck.x < GOAL_RIGHT && beforeY <= GOAL_BACK && puck.y > GOAL_BACK - PUCK_RADIUS) {
      puck.y = GOAL_BACK - PUCK_RADIUS;
      puck.vy = -Math.abs(puck.vy) * 0.68;
    }
    if (puck.y < RINK.goalY - 4 && puck.y > GOAL_BACK) {
      for (const post of [GOAL_LEFT, GOAL_RIGHT]) {
        const side = Math.sign(beforeX - post);
        if ((post === GOAL_LEFT ? side < 0 : side > 0) && Math.abs(puck.x - post) < PUCK_RADIUS) {
          puck.x = post + side * PUCK_RADIUS;
          puck.vx = side * Math.abs(puck.vx) * 0.68;
        }
      }
    }
  }

  goal(player) {
    const scorer = this.skaters[player];
    scorer.score += 1;
    const { puck } = this;
    puck.y = RINK.goalY - 9;
    this.release(0, 0, 0);
    this.lastScorer = player;
    this.lastScorerNumber = scorer.number;
    this.roundDelay = scorer.number === 39 ? 1.85 : 1.35;
    if (scorer.number === 39) {
      const [white, black] = this.skaters;
      white.angle = Math.atan2(black.y - white.y, black.x - white.x);
      black.angle = Math.atan2(white.y - black.y, white.x - black.x);
    }
    this.emit('goal', puck, { player, number: scorer.number, score: scorer.score });
    if (this.goalTarget !== null && scorer.score >= this.goalTarget) {
      this.finish();
    } else if (scorer.number === 39 && this.humanId === player && scorer.score === 4) {
      this.startSubstitution(scorer);
    }
  }

  miss() {
    this.emit('miss', this.puck, { player: this.puck.shotBy });
    this.puck.shotBy = null;
  }

  observePractice(dt, input) {
    const { puck } = this;
    const human = this.skaters[this.humanId];
    this.idleTime = Math.hypot(input.x || 0, input.y || 0) > 0.15 || Math.hypot(human.vx, human.vy) > 24
      ? 0
      : this.idleTime + dt;
    if (this.idleTime >= 5.6) {
      this.idleTime = 0;
      this.emit('idle', human, { player: human.id });
    }

    this.battleTime = Math.max(0, this.battleTime - dt);
    if (this.battleTime > 0 || puck.owner !== null || Math.hypot(puck.vx, puck.vy) > 210) return;
    const rivals = this.skaters.filter((skater) => Math.hypot(skater.x - puck.x, skater.y - puck.y) < 49);
    if (rivals.length < 2) return;
    this.battleTime = 4.6;
    this.emit('battle', puck, { players: rivals.map(({ id }) => id) });
  }
}
