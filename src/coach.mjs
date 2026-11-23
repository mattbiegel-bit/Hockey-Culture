const LINES = {
  ready: [
    ["LET'S GO, BOYS!", 'point'],
    ['HUSTLE!', 'raise'],
  ],
  general: [
    ['GET TO THE NET!', 'point'],
    ['KEEP YOUR HEAD UP!', 'lean'],
    ['SKATE!', 'point'],
    ['HUSTLE!', 'raise'],
    ['SHOOT THE PUCK!', 'point'],
    ['FOLLOW YOUR SHOT!', 'point'],
  ],
  goal: [
    ["THAT'S THE WAY!", 'raise'],
    ['THAT ONE COUNTS!', 'raise'],
    ['NICE FINISH!', 'point'],
  ],
  goal39: [
    ['MOVE THAT BIG BUTT, 39!', 'point'],
    ['BIG GUYS STILL GOTTA BACKCHECK!', 'lean'],
    ['QUIT ADMIRING IT, BIG FELLA!', 'raise'],
  ],
  save: [
    ['GOOD SAVE!', 'raise'],
    ['GREAT STOP!', 'point'],
    ['NICE SAVE!', 'lean'],
  ],
  miss: [
    ['HIT THE NET!', 'point'],
    ['PICK YOUR CORNER!', 'lean'],
    ['KEEP IT ON TARGET!', 'point'],
  ],
  check: [
    ['KEEP YOUR HEAD UP!', 'lean'],
    ['THAT WAS A BIG HIT!', 'raise'],
    ['WHAT ARE WE DOING?!', 'raise'],
  ],
  battle: [
    ['WIN THAT BATTLE!', 'lean'],
    ['GET THE REBOUND!', 'point'],
    ['HUSTLE!', 'raise'],
  ],
  idle: [
    ['MOVE YOUR FEET!', 'point'],
    ['WAKE UP OUT THERE!', 'raise'],
    ['SKATE!', 'point'],
  ],
  'shake-throw': [
    ['HEADS UP, BIG FELLA!', 'raise'],
    ['CATCH, 39!', 'point'],
    ['HERE COMES YOUR PROTEIN, 39!', 'raise'],
  ],
  'shake-hit': [
    ['ON YOUR FEET, BIG FELLA!', 'point'],
    ['SHAKE IT OFF, 39!', 'lean'],
    ['THAT WAS FOR YOUR FEET, 39!', 'raise'],
  ],
};

const PRIORITY = {
  goal39: 8, goal: 7, 'shake-hit': 6, 'shake-throw': 5,
  save: 5, check: 4, miss: 3, battle: 2, idle: 1,
};

export class Coach {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.line = null;
    this.lastPhrases = [];
    this.lastType = new Map();
    this.pending = null;
    this.quietUntil = 0.28;
    this.idleTime = 0;
    this.greeting = true;
  }

  speak(type) {
    const pool = LINES[type];
    const unused = pool.filter(([text]) => !this.lastPhrases.includes(text));
    const options = unused.length ? unused : pool.filter(([text]) => text !== this.lastPhrases.at(-1));
    const candidates = options.length ? options : pool;
    const [text, gesture] = candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))];
    const until = this.elapsed + 2;
    this.line = { text, gesture, until };
    this.lastPhrases = [...this.lastPhrases.slice(-4), text];
    this.lastType.set(type, this.elapsed);
    this.quietUntil = until + 2.7 + this.random() * 2;
    this.pending = null;
    this.greeting = false;
  }

  consider(type) {
    if (!PRIORITY[type]) return;
    const sinceLast = this.elapsed - (this.lastType.get(type) ?? -Infinity);
    if (PRIORITY[type] < PRIORITY.goal && sinceLast < 5.5) return;
    if (!this.pending || PRIORITY[type] >= PRIORITY[this.pending.type]) {
      this.pending = { type, until: this.elapsed + 1.75 };
    }
  }

  update(dt, events, game) {
    this.elapsed += dt;
    if (this.line && this.elapsed >= this.line.until) this.line = null;
    if (this.pending && this.elapsed > this.pending.until) this.pending = null;

    for (const { type, player, number } of events) {
      const jersey = number ?? game?.skaters?.[player]?.number;
      if ((type === 'shake-throw' || type === 'shake-hit') && jersey === 44) continue;
      this.consider(type === 'goal' && jersey === 39 ? 'goal39' : type);
    }

    const stopped = game?.skaters?.filter(({ vx, vy }) => Math.hypot(vx, vy) < 22).length ?? 0;
    const wasIdle = this.idleTime >= 1.8;
    this.idleTime = stopped >= 2 ? this.idleTime + dt : 0;
    if (!wasIdle && this.idleTime >= 1.8) this.consider('idle');

    if (this.pending && (
      !this.line ||
      PRIORITY[this.pending.type] >= PRIORITY.goal ||
      (this.line.until - this.elapsed < 1.3 && PRIORITY[this.pending.type] >= PRIORITY.check)
    )) {
      this.speak(this.pending.type);
    } else if (!this.line && this.elapsed >= this.quietUntil) {
      this.speak(this.greeting ? 'ready' : 'general');
    }

    return this.line;
  }
}
