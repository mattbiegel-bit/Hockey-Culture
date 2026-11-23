import assert from 'node:assert/strict';
import test from 'node:test';
import { Coach } from '../src/coach.mjs';
import { DIFFICULTIES, Game, RINK, SKATER_PROFILES } from '../src/game.mjs';

const tick = 1 / 120;
const noInput = Object.freeze({ x: 0, y: 0, shoot: false, poke: false, check: false, sprint: false, special: false });

function randomWithSeed(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function createGame(difficulty = 'normal', seed = 52, humanId = 0) {
  const game = new Game({ difficulty, humanId, random: randomWithSeed(seed) });
  game.drainEvents();
  return game;
}

function play(game, seconds, input = noInput) {
  const events = [];
  for (let frame = 0; frame < Math.ceil(seconds / tick) && !game.finished; frame++) {
    game.update(tick, input);
    events.push(...game.drainEvents());
  }
  return events;
}

function armCarrier(game, player, x, y) {
  const skater = game.skaters[player];
  Object.assign(skater, { x, y, angle: -Math.PI / 2, carryTime: 1, specialCharge: 1 });
  Object.assign(game.puck, { x, y: y - 17, owner: player, lastTouch: player });
  return skater;
}

function outsideBoards({ x, y }) {
  return x < RINK.left || x > RINK.right || y < RINK.top || y > RINK.bottom;
}

function tuckPuckInsidePost(game, player) {
  // Send the puck across the goal line, clear of the centered goalie.
  Object.assign(game.puck, {
    x: RINK.goalX + RINK.goalWidth / 2 - 8,
    y: RINK.goalY + 14,
    vx: 0,
    vy: -650,
    height: 0,
    owner: null,
    lastTouch: player,
  });
  return play(game, 0.15);
}

function finishRound(game) {
  return play(game, game.roundDelay + tick * 2);
}

test('starts a fresh three-minute free-for-all in each difficulty', () => {
  assert.deepEqual(Object.keys(DIFFICULTIES).sort(), ['easy', 'hard', 'normal']);
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const game = createGame(difficulty);
    assert.equal(game.difficulty, difficulty);
    assert.equal(game.timeLeft, 180);
    assert.equal(game.finished, false);
    assert.equal(game.puck.owner, null);
    assert.ok(game.skaters.every((skater) => skater.y > (RINK.top + RINK.bottom) / 2));
    assert.ok(game.goalie.y < (RINK.top + RINK.bottom) / 2);
    assert.deepEqual(game.rankings(), [0, 1, 2].map((id) => ({ id, score: 0, rank: 1 })));
  }
});

test('alternate skaters can be selected, and the chosen skater receives the human movement', () => {
  for (const { humanId, number, target } of [
    { humanId: 1, number: 11, target: null },
    { humanId: 2, number: 39, target: 5 },
  ]) {
    const game = createGame('normal', 52, humanId);
    const selected = game.skaters[humanId];
    assert.equal(game.humanId, humanId);
    assert.equal(selected.number, number);
    assert.equal(game.goalTarget, target);
    const startX = selected.x;
    play(game, 0.2, { ...noInput, x: 1 });
    assert.ok(selected.x > startX + 8);
    const clock = game.timeLeft;
    game.update(tick, noInput, 1);
    assert.equal(game.timeLeft, target === null ? clock - 1 : clock);
  }
});

test('human #11 can press Special to charge and release a slapshot', () => {
  const game = createGame('normal', 52, 1);
  const human = armCarrier(game, 1, RINK.goalX - 26, RINK.goalY + 115);
  const start = play(game, tick, { ...noInput, special: true });
  assert.ok(start.some(({ type, player, move }) => type === 'special' && player === human.id && move === 'slapshot'));
  const shot = play(game, 0.45);
  assert.ok(shot.some(({ type, player, speed }) => type === 'shot' && player === human.id && speed > SKATER_PROFILES[1].shotSpeed));
});

test('human #39 lifts with Special and waits for Shoot to release the Michigan', () => {
  const game = createGame('normal', 52, 2);
  armCarrier(game, 2, RINK.goalX + 14, RINK.goalY + 77);
  const lift = play(game, tick, { ...noInput, special: true });
  assert.ok(lift.some(({ type, player, move }) => type === 'special' && player === 2 && move === 'michigan'));

  const hold = play(game, 0.65);
  assert.ok(game.puck.height > 0);
  assert.equal(game.puck.owner, 2);
  assert.ok(!hold.some(({ type }) => type === 'michigan-release'));

  const release = [...play(game, tick, { ...noInput, shoot: true }), ...play(game, 0.45)];
  assert.ok(release.some(({ type, player }) => type === 'michigan-release' && player === 2));
  assert.ok(release.some(({ type, player, number }) => type === 'goal' && player === 2 && number === 39));
});

test('an unreleased Michigan returns to the ice with #39 still in possession', () => {
  const game = createGame('normal', 52, 2);
  const human = armCarrier(game, 2, RINK.goalX + 42, RINK.goalY + 59);
  game.skaters.slice(0, 2).forEach((skater) => { skater.stun = 2; });
  play(game, tick, { ...noInput, special: true });
  const hold = play(game, 1.6);
  assert.ok(!hold.some(({ type }) => type === 'michigan-release'));
  assert.equal(human.specialTime, 0);
  assert.equal(game.puck.height, 0);
  assert.equal(game.puck.owner, 2);
});

test('timed practice does not substitute AI #39 after his fourth goal', () => {
  const game = createGame('normal', 52, 1);
  game.skaters[2].score = 3;
  const scored = tuckPuckInsidePost(game, 2);
  assert.ok(scored.some(({ type, player, number }) => type === 'goal' && player === 2 && number === 39));
  assert.ok(!scored.some(({ type }) => type === 'substitution'));
  finishRound(game);
  assert.equal(game.skaters[2].number, 39);
  assert.equal(game.skaters[2].score, 4);
  assert.equal(game.humanId, 1);
});

test('the GM substitutes #44 after human #39’s fourth, and the fifth wins the race', () => {
  const game = createGame('normal', 52, 2);
  for (let goalNumber = 1; goalNumber <= 4; goalNumber++) {
    const events = tuckPuckInsidePost(game, 2);
    assert.ok(events.some(({ type, player, number }) => type === 'goal' && player === 2 && number === 39));
    assert.equal(game.skaters[2].score, goalNumber);
    assert.equal(game.finished, false);
    if (goalNumber < 4) {
      assert.ok(!events.some(({ type }) => type === 'substitution'));
      finishRound(game);
      continue;
    }

    const swap = events.find(({ type }) => type === 'substitution');
    assert.ok(swap);
    assert.equal(swap.outgoing, 39);
    assert.equal(swap.incoming, 44);
    assert.equal(game.lastScorerNumber, 39);
    assert.ok(game.roundDelay > 3);
  }

  play(game, 1);
  assert.ok(game.manager);
  assert.equal(game.skaters[2].number, 39);
  finishRound(game);
  const replacement = game.skaters[2];
  assert.equal(game.manager, null);
  assert.equal(replacement.number, 44);
  assert.equal(replacement.handedness, 'left');
  assert.equal(replacement.score, 4);
  assert.ok(replacement.specialCharge < 0.01);
  assert.equal(replacement.move, 'muffin');
  assert.equal(game.humanId, 2);
  assert.ok(replacement.profile.pace < Math.min(...SKATER_PROFILES.map(({ pace }) => pace)));
  assert.ok(replacement.profile.shotSpeed < Math.min(...SKATER_PROFILES.map(({ shotSpeed }) => shotSpeed)));
  const startX = replacement.x;
  play(game, 0.25, { ...noInput, x: 1 });
  assert.ok(replacement.x > startX);

  armCarrier(game, 2, RINK.goalX, RINK.bottom - 115);
  const charge = play(game, tick, { ...noInput, special: true });
  assert.ok(charge.some(({ type, player, move }) => type === 'special' && player === 2 && move === 'muffin'));
  assert.ok(play(game, 0.6).some(({ type, player }) => type === 'shot' && player === 2));

  const winning = tuckPuckInsidePost(game, 2);
  assert.ok(winning.some(({ type, player, number }) => type === 'goal' && player === 2 && number === 44));
  assert.equal(game.finished, true);
  assert.deepEqual(game.rankings()[0], { id: 2, score: 5, rank: 1 });

  game.reset();
  assert.equal(game.finished, false);
  assert.equal(game.goalTarget, 5);
  assert.equal(game.humanId, 2);
  assert.equal(game.skaters[2].number, 39);
  assert.equal(game.skaters[2].score, 0);
});

test('an AI rival can win the first-to-five race and time alone never ends it', () => {
  const game = createGame('normal', 52, 2);
  const clock = game.timeLeft;
  game.update(tick, noInput, 181);
  assert.equal(game.timeLeft, clock);
  assert.equal(game.finished, false);
  game.skaters[1].score = 4;
  const events = tuckPuckInsidePost(game, 1);
  assert.ok(events.some(({ type, number }) => type === 'goal' && number === 11));
  assert.equal(game.finished, true);
  assert.deepEqual(game.rankings()[0], { id: 1, score: 5, rank: 1 });
});

test('the updated roster has jersey numbers, handedness, builds, and empty meters', () => {
  const game = createGame();
  assert.deepEqual(game.skaters.map(({ number, handedness }) => [number, handedness]), [
    [24, 'left'], [11, 'right'], [39, 'left'],
  ]);
  assert.deepEqual(SKATER_PROFILES.map(({ color }) => color), ['white', 'black', 'orange']);
  assert.deepEqual(SKATER_PROFILES.map(({ move }) => move), ['deke', 'slapshot', 'michigan']);
  assert.ok(game.skaters[0].radius > game.skaters[1].radius);
  assert.ok(SKATER_PROFILES[2].mass > SKATER_PROFILES[1].mass);
  assert.deepEqual(game.skaters.map(({ specialCharge }) => specialCharge), [0, 0, 0]);
});

test('#11 wins an even skate race and #24 trades regular shot power for stronger checks', () => {
  const [white, black, orange] = SKATER_PROFILES;
  assert.ok(white.checkStrength > black.checkStrength && white.checkStrength > orange.checkStrength);
  assert.ok(white.shotSpeed < black.shotSpeed && white.shotSpeed < orange.shotSpeed);

  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const game = createGame(difficulty);
    for (let frame = 0; frame < 120; frame++) {
      for (const skater of game.skaters) game.steer(skater, { x: 1, y: 0 }, tick);
    }
    const [whiteSpeed, blackSpeed, orangeSpeed] = game.skaters.map(({ vx }) => vx);
    assert.ok(blackSpeed > whiteSpeed && whiteSpeed > orangeSpeed, difficulty);
  }
});

test('#39 sometimes holds the puck under contact and still loses it on another check', () => {
  function checkedOwner(random) {
    const game = new Game({ random: () => random });
    const [human, , orange] = game.skaters;
    Object.assign(human, { x: 266, y: 370, angle: 0, action: 'check' });
    Object.assign(orange, { x: 296, y: 370, angle: 0 });
    Object.assign(game.puck, { owner: orange.id, lastTouch: orange.id });
    game.tryHit(human, orange, { x: 1, y: 0, length: 30 });
    assert.ok(orange.stun > 0);
    return game.puck.owner;
  }

  assert.equal(checkedOwner(0), 2);
  assert.equal(checkedOwner(0.99), null);
});

test('#24 builds charge and can spend a full meter on a puck-carrying deke', () => {
  const game = createGame();
  const human = game.skaters[0];
  const uncharged = play(game, 0.25, { ...noInput, x: 1, sprint: true, special: true });
  assert.ok(human.specialCharge > 0 && human.specialCharge < 1);
  assert.ok(!uncharged.some(({ type }) => type === 'special'));

  human.specialCharge = 1;
  const withoutPuck = play(game, tick, { ...noInput, x: 1, special: true });
  assert.ok(!withoutPuck.some(({ type }) => type === 'special'));
  assert.equal(human.specialCharge, 1);

  armCarrier(game, 0, human.x, human.y);
  const previousSpeed = human.vx;
  const deke = play(game, tick, { ...noInput, x: 1, special: true });
  assert.ok(deke.some(({ type, move, player }) => type === 'special' && move === 'deke' && player === 0));
  assert.equal(game.puck.owner, 0);
  assert.ok(human.specialCharge < 0.05);
  assert.ok(human.specialTime > 0);
  assert.ok(human.vx > previousSpeed);
});

test('#11 spends a full meter on a harder slapshot in scoring position', () => {
  const game = createGame();
  const rival = armCarrier(game, 1, RINK.goalX - 26, RINK.goalY + 115);
  const windup = play(game, tick);
  assert.ok(windup.some(({ type, move, player }) => type === 'special' && move === 'slapshot' && player === 1));
  assert.ok(rival.specialCharge < 0.1);

  const release = play(game, 0.45);
  assert.ok(release.some(({ type, player, speed }) => type === 'shot' && player === 1 && speed > SKATER_PROFILES[1].shotSpeed));
});

test('#39 lifts the puck for a Michigan and is credited when it crosses the goal line', () => {
  const game = createGame();
  const rival = armCarrier(game, 2, RINK.goalX + 42, RINK.goalY + 59);
  const lift = play(game, 0.12);
  assert.ok(lift.some(({ type, move, player }) => type === 'special' && move === 'michigan' && player === 2));
  assert.ok(game.puck.height > 0);
  assert.ok(rival.specialCharge < 0.1);

  const flight = play(game, 1.1);
  assert.ok(flight.some(({ type, player }) => type === 'michigan-release' && player === 2));
  assert.deepEqual(flight.filter(({ type }) => type === 'goal').map(({ player }) => player), [2]);
  assert.deepEqual(game.skaters.map(({ score }) => score), [0, 0, 1]);
  assert.equal(game.lastScorer, 2);
  const [white, black] = game.skaters;
  assert.equal(white.angle, Math.atan2(black.y - white.y, black.x - white.x));
  assert.equal(black.angle, Math.atan2(white.y - black.y, white.x - black.x));
});

test('a big check can eject a skater and the mascot returns them from outside the boards', () => {
  const game = createGame();
  const [human, rival] = game.skaters;
  Object.assign(human, { x: RINK.right - 48, y: 290, angle: 0, vx: 185 });
  Object.assign(rival, { x: RINK.right - rival.radius - 1, y: human.y, angle: 0 });
  Object.assign(game.puck, { x: rival.x, y: rival.y, owner: rival.id, lastTouch: rival.id });

  const hit = play(game, tick, { ...noInput, x: 1, check: true, sprint: true });
  assert.ok(hit.some(({ type, player, target }) => type === 'eject' && player === human.id && target === rival.id));
  assert.ok(rival.ejection);
  assert.equal(game.puck.owner, null);

  const events = [];
  let crossedBoards = false;
  for (let frame = 0; frame < 6 / tick && rival.ejection; frame++) {
    events.push(...play(game, tick));
    crossedBoards ||= outsideBoards(rival);
    assert.ok(outsideBoards(game.mascot));
    assert.ok(!outsideBoards(game.puck));
  }
  assert.ok(crossedBoards);
  assert.ok(events.some(({ type, player }) => type === 'return' && player === rival.id));
  assert.equal(rival.ejection, null);
  assert.ok(!outsideBoards(rival));
});

test('a thrown protein shake can knock #39 down and spill the puck', () => {
  const game = createGame();
  const rival = game.skaters[2];
  Object.assign(rival, { x: RINK.right - 38, y: 323, vx: -43, vy: -121 });
  Object.assign(game.puck, { x: rival.x, y: rival.y, owner: rival.id, lastTouch: rival.id });
  game.shakeCooldown = 0;

  const throwEvents = play(game, tick);
  assert.ok(game.shake);
  assert.ok(throwEvents.some(({ type, target }) => type === 'shake-throw' && target === rival.id));

  let impact;
  for (let frame = 0; frame < 2 / tick && !impact; frame++) {
    impact = play(game, tick).find(({ type }) => type === 'shake-hit');
  }
  assert.equal(impact?.target, rival.id);
  assert.ok(rival.stun > 0);
  assert.equal(rival.action, 'bottle-hit');
  assert.equal(game.puck.owner, null);
  assert.equal(game.shake, null);
});

test('human movement, sprint, puck collection, and shooting work through update', () => {
  const game = createGame();
  const skatingGame = createGame();
  const startY = game.skaters[0].y;
  play(game, 0.2, { ...noInput, y: -1, sprint: true });
  play(skatingGame, 0.2, { ...noInput, y: -1 });
  assert.ok(game.skaters[0].y < skatingGame.skaters[0].y);
  assert.ok(skatingGame.skaters[0].y < startY);

  const human = game.skaters[0];
  Object.assign(game.puck, { x: human.x, y: human.y - 7, vx: 0, vy: 0, owner: null });
  const pickups = play(game, 0.05);
  assert.equal(game.puck.owner, human.id);
  assert.ok(pickups.some(({ type, player }) => type === 'pickup' && player === human.id));

  const shots = play(game, 0.025, { ...noInput, shoot: true });
  assert.ok(shots.some(({ type, player }) => type === 'shot' && player === human.id));
  assert.equal(game.puck.owner, null);
  assert.ok(game.puck.vy < 0);
});

test('the human can beat the goalie by shooting from a flank', () => {
  const game = createGame();
  Object.assign(game.skaters[0], { x: 220, y: 130, angle: -Math.PI / 2 });
  Object.assign(game.puck, { owner: 0, lastTouch: 0 });
  const events = play(game, 0.2, { ...noInput, shoot: true });
  assert.ok(events.some(({ type, player }) => type === 'shot' && player === 0));
  assert.ok(events.some(({ type, player }) => type === 'goal' && player === 0));
  assert.deepEqual(game.skaters.map(({ score }) => score), [1, 0, 0]);
});

test('poke and body checks free a rival’s puck, which can be recovered', () => {
  for (const action of ['poke', 'check']) {
    const game = createGame();
    const [human, carrier, third] = game.skaters;
    Object.assign(human, { x: 266, y: 370, angle: 0 });
    Object.assign(carrier, { x: 296, y: human.y, angle: 0 });
    Object.assign(third, { x: 140, y: 500, stun: 2 });
    Object.assign(game.puck, { x: 313, y: human.y, owner: carrier.id, lastTouch: carrier.id });

    const events = play(game, tick, { ...noInput, [action]: true });
    assert.ok(events.some(({ type, player, target }) => type === action && player === human.id && target === carrier.id));
    assert.equal(game.puck.owner, null);
    assert.ok(carrier.stun > 0);
    assert.ok(game.puck.vx > 0);
    if (action === 'poke') assert.equal(game.puck.lastTouch, human.id);

    let recovered;
    for (let frame = 0; frame < 120 && !recovered; frame++) {
      const x = game.puck.x - human.x;
      const y = game.puck.y - human.y;
      const recovery = play(game, tick, { ...noInput, x, y, sprint: true });
      recovered = recovery.find(({ type }) => type === 'pickup');
    }
    assert.ok(recovered, `${action} creates a recoverable puck`);
    assert.equal(game.puck.owner, recovered.player);
    if (action === 'check') assert.equal(recovered.player, human.id);
  }
});

test('each scoring touch earns exactly one goal for that skater and resets the round', () => {
  const game = createGame();
  for (const id of [0, 1, 2]) {
    const events = tuckPuckInsidePost(game, id);
    assert.deepEqual(events.filter(({ type }) => type === 'goal').map(({ player }) => player), [id]);
    assert.deepEqual(game.skaters.map(({ score }) => score), [0, 1, 2].map((player) => Number(player <= id)));

    const resetEvents = finishRound(game);
    assert.ok(resetEvents.some(({ type }) => type === 'round'));
    assert.equal(game.puck.owner, null);
    assert.ok(game.puck.y > RINK.goalY + RINK.goalDepth);
    assert.ok(game.skaters.every(({ y }) => y > (RINK.top + RINK.bottom) / 2));
  }
});

test('a centered shot produces a goalie save and live rebound', () => {
  const game = createGame();
  Object.assign(game.puck, {
    x: game.goalie.x,
    y: game.goalie.y + 44,
    vx: 0,
    vy: -620,
    owner: null,
    lastTouch: 0,
  });
  const events = play(game, 0.15);
  assert.ok(events.some(({ type }) => type === 'save'));
  assert.ok(!events.some(({ type }) => type === 'goal'));
  assert.equal(game.puck.owner, null);
  assert.ok(game.puck.vy > 0);
});

test('a fast loose puck bounces off the boards and remains playable', () => {
  const game = createGame();
  Object.assign(game.puck, {
    x: RINK.left + 10,
    y: RINK.top + 140,
    vx: -650,
    vy: 0,
    owner: null,
  });
  const events = play(game, 0.1);
  assert.ok(events.some(({ type }) => type === 'board'));
  assert.ok(game.puck.vx > 0);
  assert.ok(game.puck.x >= RINK.left && game.puck.x <= RINK.right);
});

test('the timer ends a full practice, supports ties, and resets for another game', () => {
  const game = createGame();
  const events = play(game, 181);
  assert.equal(game.finished, true);
  assert.equal(game.timeLeft, 0);
  assert.equal(events.filter(({ type }) => type === 'end').length, 1);
  game.update(tick, { ...noInput, shoot: true });
  assert.deepEqual(game.drainEvents(), []);

  [3, 1, 3].forEach((score, id) => { game.skaters[id].score = score; });
  assert.deepEqual(game.rankings().sort((a, b) => a.rank - b.rank || a.id - b.id), [
    { id: 0, score: 3, rank: 1 },
    { id: 2, score: 3, rank: 1 },
    { id: 1, score: 1, rank: 3 },
  ]);

  game.reset('hard');
  assert.equal(game.difficulty, 'hard');
  assert.equal(game.finished, false);
  assert.equal(game.timeLeft, 180);
  assert.deepEqual(game.skaters.map(({ score }) => score), [0, 0, 0]);
  assert.deepEqual(game.skaters.map(({ specialCharge }) => specialCharge), [0, 0, 0]);
  assert.ok(game.skaters.every(({ ejection }) => ejection === null));
  assert.equal(game.puck.owner, null);
  assert.equal(game.lastScorer, null);
  assert.equal(game.shake, null);
});

test('both AI rivals fight for the puck, shoot, and use specials at every difficulty', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const game = createGame(difficulty, 163);
    const events = play(game, 181);
    assert.equal(game.finished, true);
    for (const player of [1, 2]) {
      assert.ok(events.some((event) => event.type === 'pickup' && event.player === player), `${difficulty}, player ${player + 1} pickup`);
      assert.ok(events.some((event) => event.type === 'shot' && event.player === player), `${difficulty}, player ${player + 1} shot`);
      assert.ok(events.some((event) => event.type === 'special' && event.player === player), `${difficulty}, player ${player + 1} special`);
      assert.ok(events.some((event) => (event.type === 'poke' || event.type === 'check') &&
        event.player === player && event.target === 3 - player), `${difficulty}, player ${player + 1} challenges the other AI`);
    }
    for (const skater of game.skaters) {
      const goals = events.filter(({ type, player }) => type === 'goal' && player === skater.id).length;
      assert.equal(skater.score, goals);
    }
  }
});

test('coach reacts to the puck battle and keeps each line visible for about two seconds', () => {
  const coach = new Coach({ random: () => 0 });
  const call = coach.update(0.1, [{ type: 'battle' }]);
  assert.match(call.text, /BATTLE/);
  assert.equal(coach.update(1.95, []), call);
  assert.equal(coach.update(0.1, []), null);

  assert.match(coach.update(0.1, [{ type: 'save' }]).text, /SAVE/);
  assert.equal(coach.update(2.05, [{ type: 'save' }]), null);
  coach.reset();
  assert.equal(coach.update(0.1, []), null);
  assert.match(coach.update(0.2, []).text, /LET'S GO/);
});

test('coach prioritizes goals and varies the reaction on consecutive goals', () => {
  const coach = new Coach({ random: () => 0 });
  const first = coach.update(0.1, [{ type: 'miss' }, { type: 'goal' }, { type: 'save' }]);
  assert.equal(first.text, "THAT'S THE WAY!");
  const next = coach.update(0.1, [{ type: 'goal' }]);
  assert.notEqual(next.text, first.text);
});

test('coach has separate goal reactions for #39', () => {
  const coach = new Coach({ random: () => 0 });
  const goal = [{ type: 'goal', player: 2, number: 39 }];
  const first = coach.update(0.1, goal);
  assert.match(first.text, /39/);
  assert.notEqual(coach.update(0.1, goal).text, first.text);
  const replacementGoal = coach.update(0.1, [{ type: 'goal', player: 2, number: 44 }]);
  assert.equal(replacementGoal.text, "THAT'S THE WAY!");
});

test('the practice clock measures elapsed time when physics steps are capped', () => {
  const game = new Game({ difficulty: 'normal' });
  const startingX = game.skaters[0].x;

  game.update(0.1, { x: 1 }, 0.5);

  assert.equal(game.timeLeft, 179.5);
  assert.ok(game.skaters[0].x > startingX && game.skaters[0].x < startingX + 16.1);

  game.timeLeft = 0.25;
  game.update(0.1, {}, 0.5);

  assert.equal(game.timeLeft, 0);
  assert.equal(game.finished, true);
  assert.equal(game.drainEvents().filter(({ type }) => type === 'end').length, 1);
});
