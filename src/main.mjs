import { DIFFICULTIES, Game } from './game.mjs';
import { Renderer } from './render.mjs';
import { Input } from './input.mjs';
import { GameAudio } from './audio.mjs';
import { Coach } from './coach.mjs';

const byId = (id) => document.getElementById(id);
const playerName = (id) => `#${game.skaters[id].number}`;
const difficultyName = (key) => key[0].toUpperCase() + key.slice(1);
const storageKey = 'three-for-all-settings-v1';

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || {};
    return {
      difficulty: Object.hasOwn(DIFFICULTIES, saved.difficulty) ? saved.difficulty : 'normal',
      sound: typeof saved.sound === 'boolean' ? saved.sound : true,
      humanId: [0, 1, 2].includes(saved.humanId) ? saved.humanId : 0,
    };
  } catch {
    return { difficulty: 'normal', sound: true, humanId: 0 };
  }
}

const settings = readSettings();
const app = byId('app');
const world = byId('world');
const canvas = byId('ice');
const clock = byId('clock');
const scoreNodes = [0, 1, 2].map((id) => byId(`score-${id}`));
const scoreRows = scoreNodes.map((node) => node.closest('.score-row'));
const chargeMeters = scoreNodes.map((_, id) => byId(`charge-${id}`));
const scoreNumbers = scoreRows.map((row) => row.querySelector('.player-number'));
const scoreRoles = scoreRows.map((row) => row.querySelector('.player-role'));
const legendLabels = scoreNodes.map((_, id) => byId(`legend-label-${id}`));
const coachCall = byId('coach-call');
const goalCall = byId('goal-call');
const rivalCalls = [byId('rival-call-0'), byId('rival-call-1')];
const moveCall = byId('move-call');
const gmCall = byId('gm-call');
const touchShoot = byId('touch-shoot');
const touchSpecial = byId('touch-special');
const specialHint = byId('special-hint');
const rinkStatus = byId('rink-status');
const pauseDialog = byId('pause-dialog');
const resultsDialog = byId('results-dialog');
const touchMedia = matchMedia('(any-pointer: coarse), (pointer: coarse)');

const game = new Game({ difficulty: settings.difficulty, humanId: settings.humanId });
const renderer = new Renderer(canvas);
const audio = new GameAudio();
const coach = new Coach();
const input = new Input({
  joystick: byId('joystick'),
  knob: byId('knob'),
  actionButtons: {
    shoot: touchShoot,
    poke: byId('touch-poke'),
    check: byId('touch-check'),
    sprint: byId('touch-sprint'),
    special: touchSpecial,
  },
  onPause: pause,
});

const benchGreeting = { text: "LET’S GO, BOYS!", gesture: 'point' };
const effectTypes = new Set(['shot', 'check', 'poke', 'board', 'save', 'goal', 'special', 'michigan-release', 'eject', 'return', 'shake-throw', 'shake-hit']);
const moveNames = { deke: 'Edge Burst', slapshot: 'Slapshot', michigan: 'Michigan', muffin: 'Wobbly Shot' };
let screen = 'menu';
let discoveredTouch = false;
let displaySeconds = -1;
let displayOwner;
let rosterStamp;
let coachLine = benchGreeting;
let displayCoach;
let goalAge = 0;
let rivalsTalking = false;
let moveAge = 0;
let effects = [];
let frameTime;
let activeTime = 0;
let lastMenuDraw = -Infinity;
let redraw = true;

function saveSettings() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Play remains available when browser storage is blocked.
  }
}

function updateSettings() {
  const radio = document.querySelector(`[name="difficulty"][value="${settings.difficulty}"]`);
  radio.checked = true;
  byId('difficulty-tag').textContent = `${difficultyName(settings.difficulty)} AI`;
  byId('sound-setting').setAttribute('aria-checked', String(settings.sound));
  byId('sound-quick').setAttribute('aria-pressed', String(settings.sound));
  audio.setEnabled(settings.sound);
}

function toggleSound() {
  settings.sound = !settings.sound;
  updateSettings();
  saveSettings();
  if (settings.sound) audio.unlock();
}

const fullscreenSupported = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

function updateFullscreen() {
  const active = Boolean(document.fullscreenElement);
  byId('fullscreen-setting').setAttribute('aria-checked', String(active));
  byId('fullscreen-quick').setAttribute('aria-pressed', String(active));
}

async function toggleFullscreen() {
  if (!fullscreenSupported) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    byId('fullscreen-note').hidden = true;
  } catch {
    byId('fullscreen-note').hidden = false;
    byId('announcement').textContent = 'Fullscreen is unavailable in this browser window.';
  }
  updateFullscreen();
}

function updateTouch() {
  const available = touchMedia.matches || discoveredTouch;
  app.classList.toggle('has-touch', available);
  byId('stick-zone').hidden = !available || screen !== 'playing';
  byId('action-pad').hidden = !available || screen !== 'playing';
}

function setScreen(next) {
  screen = next;
  app.dataset.screen = next;
  byId('menu').hidden = next !== 'menu';
  byId('hud').hidden = next === 'menu';
  byId('pause-quick').hidden = next !== 'playing';
  input.clear();
  input.enabled = next === 'playing';
  if (next === 'playing') frameTime = performance.now();
  else audio.suspendSkate();

  const status = {
    menu: ['ready', 'Ready'],
    playing: ['live', 'Live'],
    paused: ['paused', 'Paused'],
    results: ['final', 'Final'],
  }[next];
  rinkStatus.dataset.state = status[0];
  rinkStatus.lastElementChild.textContent = status[1];
  updateTouch();
  redraw = true;
}

function clearPracticeOverlays() {
  effects = [];
  goalAge = 0;
  moveAge = 0;
  goalCall.hidden = true;
  moveCall.hidden = true;
  gmCall.hidden = true;
  hideRivalCalls();
  displaySeconds = -1;
  displayOwner = undefined;
  activeTime = 0;
  coach.reset();
}

function startPractice() {
  pauseDialog.close();
  resultsDialog.close();
  audio.unlock();
  game.reset(settings.difficulty, settings.humanId);
  game.drainEvents();
  clearPracticeOverlays();
  coachLine = null;
  byId('announcement').textContent = '';
  setScreen('playing');
  updateScoreboard();
  byId('pause-quick').focus({ preventScroll: true });
}

function pause() {
  if (screen !== 'playing') return;
  setScreen('paused');
  pauseDialog.showModal();
  byId('resume').focus();
}

function resume() {
  if (screen !== 'paused') return;
  pauseDialog.close();
  audio.unlock();
  setScreen('playing');
  byId('pause-quick').focus({ preventScroll: true });
}

function mainMenu() {
  pauseDialog.close();
  resultsDialog.close();
  game.reset(settings.difficulty, settings.humanId);
  game.drainEvents();
  clearPracticeOverlays();
  coachLine = benchGreeting;
  setScreen('menu');
  updateScoreboard();
  byId('play').focus({ preventScroll: true });
}

function ordinal(rank) {
  return `${rank}${['th', 'st', 'nd', 'rd'][rank] ?? 'th'}`;
}

function showResults() {
  setScreen('results');
  const rankings = game.rankings();
  const leaders = rankings.filter((entry) => entry.rank === 1).map((entry) => playerName(entry.id));
  const title = leaders.length === 1 ? `${leaders[0]} wins!`
    : leaders.length === 3 ? 'Three-way tie!'
    : `${leaders.join(' and ')} tie!`;
  byId('results-title').textContent = title;
  byId('announcement').textContent = title;
  const items = rankings.map(({ id, score, rank }) => {
    const row = document.createElement('li');
    const place = document.createElement('span');
    const label = document.createElement('span');
    const total = document.createElement('strong');
    place.className = 'rank-place';
    place.textContent = ordinal(rank);
    label.textContent = id === game.humanId ? `${playerName(id)} (You)` : playerName(id);
    total.className = 'rank-score';
    total.textContent = `${score} ${score === 1 ? 'goal' : 'goals'}`;
    row.append(place, label, total);
    return row;
  });
  byId('rankings').replaceChildren(...items);
  resultsDialog.showModal();
  byId('again').focus();
}

function updateRosterDisplay() {
  const signature = `${game.humanId}:${game.skaters.map(({ number }) => number).join(',')}`;
  if (signature === rosterStamp) return;
  rosterStamp = signature;
  for (const { id, number } of game.skaters) {
    const human = id === game.humanId;
    scoreNumbers[id].textContent = `#${number}`;
    scoreRoles[id].textContent = human ? 'You' : 'AI';
    scoreRows[id].toggleAttribute('data-human', human);
    chargeMeters[id].setAttribute('aria-label', `Number ${number} boost charge`);
    legendLabels[id].textContent = human ? `#${number} · You` : `#${number}`;
  }
  const race = Boolean(game.goalTarget);
  byId('mode-tag').textContent = race ? 'First to five goals' : '3-minute competition';
  byId('practice-mode').textContent = race ? 'Race to five' : 'Practice competition';
  byId('clock-caption').textContent = race ? 'Goals to win' : 'Time remaining';
}

function updateScoreboard() {
  updateRosterDisplay();
  const seconds = game.goalTarget ?? Math.ceil(Math.max(0, game.timeLeft));
  if (seconds !== displaySeconds && game.goalTarget) {
    clock.textContent = game.goalTarget;
    clock.setAttribute('aria-label', `First to ${game.goalTarget} goals`);
    clock.classList.remove('low');
    displaySeconds = seconds;
  } else if (seconds !== displaySeconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    clock.textContent = `${minutes}:${String(remainder).padStart(2, '0')}`;
    clock.setAttribute('aria-label', `${minutes} minutes ${remainder} seconds remaining`);
    clock.classList.toggle('low', seconds <= 15);
    displaySeconds = seconds;
  }
  for (const skater of game.skaters) {
    const score = String(skater.score);
    if (scoreNodes[skater.id].textContent !== score) scoreNodes[skater.id].textContent = score;
    const charge = Math.floor(skater.specialCharge * 100);
    const meter = chargeMeters[skater.id];
    if (meter.value !== charge) {
      meter.value = charge;
      scoreRows[skater.id].classList.toggle('ready', charge >= 100);
    }
  }
  if (displayOwner !== game.puck.owner) {
    scoreRows.forEach((row, id) => row.classList.toggle('possession', id === game.puck.owner));
    displayOwner = game.puck.owner;
  }
  const human = game.skaters[game.humanId];
  const hasPuck = game.puck.owner === human.id;
  const canUseSpecial = human.specialCharge >= 1 && hasPuck;
  const disabled = String(!canUseSpecial);
  if (touchSpecial.getAttribute('aria-disabled') !== disabled) touchSpecial.setAttribute('aria-disabled', disabled);
  const lifting = hasPuck && human.action === 'michigan';
  const shootText = lifting ? 'Throw' : 'Shoot';
  const specialKey = lifting ? 'Space' : 'L';
  const specialName = lifting ? 'Throw puck' : moveNames[human.move];
  if (touchShoot.textContent !== shootText) touchShoot.textContent = shootText;
  if (specialHint.firstElementChild.textContent !== specialKey) specialHint.firstElementChild.textContent = specialKey;
  if (specialHint.lastElementChild.textContent !== specialName) specialHint.lastElementChild.textContent = specialName;
}

function refreshCoachBubble() {
  if (displayCoach === coachLine?.text) return;
  displayCoach = coachLine?.text;
  coachCall.hidden = !displayCoach;
  if (displayCoach) {
    byId('coach-text').textContent = displayCoach;
    animate(coachCall);
  }
}

function animate(node) {
  node.classList.remove('enter');
  void node.offsetWidth;
  node.classList.add('enter');
}

function showRivalCalls() {
  const [white, black] = game.skaters;
  const neighbors = Math.abs(white.x - black.x) < 99 && Math.abs(white.y - black.y) < 38;
  const center = (white.x + black.x) * .5;
  [white, black].forEach((skater, index) => {
    const side = white.x === black.x ? (index === 0 ? -1 : 1) : (skater.x < center ? -1 : 1);
    const x = neighbors ? center + side * 44 : skater.x;
    const bubble = rivalCalls[index];
    bubble.style.left = `${Math.min(94, Math.max(6, x / 574 * 100))}%`;
    bubble.style.top = `${Math.min(96, Math.max(10, (skater.y - 20) / 608 * 100))}%`;
    bubble.hidden = false;
    animate(bubble);
  });
  rivalsTalking = true;
}

function hideRivalCalls() {
  for (const bubble of rivalCalls) bubble.hidden = true;
  rivalsTalking = false;
}

function refreshManagerBubble() {
  const manager = game.manager;
  if (!manager || manager.phase === 'enter') {
    gmCall.hidden = true;
    return;
  }
  gmCall.style.left = `${Math.min(87, manager.x / 574 * 100)}%`;
  gmCall.style.top = `${(manager.y - 23) / 608 * 100}%`;
  if (gmCall.hidden) {
    gmCall.hidden = false;
    animate(gmCall);
  }
}

function handleEvents(events) {
  for (const event of events) {
    audio.event(event);
    if (effectTypes.has(event.type)) effects.push({ ...event, age: 0 });
    if (event.type === 'goal') {
      goalAge = 1.03;
      goalCall.hidden = false;
      const player = playerName(event.player);
      const scoredBy39 = (event.number ?? game.skaters[event.player].number) === 39;
      byId('goal-player').textContent = event.player === game.humanId ? `${player} · You` : player;
      byId('announcement').textContent = scoredBy39 ? '#39 scores. #24 and #11 call him selfish.' : `${player} scores!`;
      animate(goalCall);
      if (scoredBy39) showRivalCalls();
    }
    if (event.type === 'special' && moveNames[event.move]) {
      moveCall.textContent = `${playerName(event.player)} · ${moveNames[event.move]}`;
      moveCall.hidden = false;
      moveAge = 1.4;
      animate(moveCall);
    }
    if (event.type === 'substitution') byId('announcement').textContent = 'The general manager sends 39 back to Russia. Number 44 takes over with four goals.';
  }
}

function resizeCanvas() {
  const { width, height } = world.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (!pixelWidth || !pixelHeight) return;
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    redraw = true;
  }
}

function frame(now) {
  const elapsed = frameTime === undefined ? 0 : Math.max(0, (now - frameTime) / 1000);
  const dt = Math.min(.12, elapsed);
  frameTime = now;

  if (screen === 'playing') {
    activeTime += dt;
    game.update(dt, input.sample(), elapsed);
    const events = game.drainEvents();
    handleEvents(events);
    coachLine = coach.update(dt, events, game);

    const { vx, vy } = game.skaters[game.humanId];
    audio.skate(Math.hypot(vx, vy), dt);
    for (const effect of effects) effect.age += dt;
    effects = effects.filter((effect) => effect.age < 1.2);
    if (goalAge > 0) {
      goalAge -= dt;
      if (goalAge <= 0) goalCall.hidden = true;
    }
    if (moveAge > 0) {
      moveAge -= dt;
      if (moveAge <= 0) moveCall.hidden = true;
    }
    if (rivalsTalking && (game.roundDelay <= 0 || game.manager?.age >= 1.85)) hideRivalCalls();
    refreshManagerBubble();
    updateScoreboard();
    if (game.finished) showResults();
    redraw = true;
  } else if (screen === 'menu' && now - lastMenuDraw > 50) {
    lastMenuDraw = now;
    redraw = true;
  }

  if (redraw) {
    refreshCoachBubble();
    renderer.draw(game, { time: screen === 'menu' ? now / 1000 : activeTime, coach: coachLine, effects });
    redraw = false;
  }
  requestAnimationFrame(frame);
}

byId('play').addEventListener('click', startPractice);
byId('again').addEventListener('click', startPractice);
byId('restart').addEventListener('click', startPractice);
byId('pause-quick').addEventListener('click', pause);
byId('pause').addEventListener('click', pause);
byId('resume').addEventListener('click', resume);
byId('results-menu').addEventListener('click', mainMenu);
byId('pause-menu').addEventListener('click', mainMenu);
byId('open-controls').addEventListener('click', () => byId('controls-dialog').showModal());
byId('open-settings').addEventListener('click', () => byId('settings-dialog').showModal());
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => byId(button.dataset.close).close());
}
for (const target of document.querySelectorAll('[name="difficulty"]')) {
  target.addEventListener('change', () => {
    settings.difficulty = target.value;
    updateSettings();
    saveSettings();
  });
}
for (const target of document.querySelectorAll('[name="skater"]')) {
  target.checked = Number(target.value) === settings.humanId;
  target.addEventListener('change', () => {
    settings.humanId = Number(target.value);
    game.reset(settings.difficulty, settings.humanId);
    game.drainEvents();
    displaySeconds = -1;
    updateScoreboard();
    redraw = true;
    saveSettings();
  });
}
for (const id of ['sound-quick', 'sound-setting']) byId(id).addEventListener('click', toggleSound);
for (const id of ['fullscreen-quick', 'fullscreen-setting']) {
  byId(id).addEventListener('click', toggleFullscreen);
  byId(id).disabled = !fullscreenSupported;
}
byId('fullscreen-note').hidden = fullscreenSupported;
document.addEventListener('fullscreenchange', updateFullscreen);
pauseDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  resume();
});
resultsDialog.addEventListener('cancel', (event) => event.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
document.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' && !discoveredTouch) {
    discoveredTouch = true;
    updateTouch();
  }
}, { passive: true, capture: true });
touchMedia.addEventListener('change', updateTouch);
new ResizeObserver(resizeCanvas).observe(world);
window.addEventListener('resize', resizeCanvas);
updateSettings();
updateFullscreen();
setScreen('menu');
updateScoreboard();
resizeCanvas();
requestAnimationFrame(frame);
