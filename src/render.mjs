import { RINK } from './game.mjs';

const WIDTH = 574;
const HEIGHT = 608;
const ORANGE = '#ff632b';
const TEAMS = [
  { jersey: '#f8f4e8', light: '#ffffff', seam: '#b9b9ae', trim: '#ed5428', text: '#232629', width: 1.06, height: 1.14 },
  { jersey: '#202426', light: '#3e444a', seam: '#101214', trim: '#da653a', text: '#fff6ed', width: 1, height: 1 },
  { jersey: '#f45d28', light: '#ff9150', seam: '#b74123', trim: '#252627', text: '#201d1b', width: 1.16, height: .87 },
];
const REPLACEMENT_UNIFORM = {
  jersey: '#e95e28', light: '#ff9c51', seam: '#9f3e25', trim: '#292526', text: '#211c1b', width: 1.24, height: 1.43,
};
const FUR_OFFSETS = Array.from({ length: 35 }, (_, index) => {
  const angle = index * Math.PI * 2 / 35;
  const length = index % 2 === 0 ? 1 + Math.sin(index * 31.2) * .09 : .84;
  return [Math.cos(angle) * length, Math.sin(angle) * length];
});

function rect(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function shape(ctx, points, fill, border, width = 1) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function line(ctx, from, to, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.lineTo(...to);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke, lineWidth = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function ellipse(ctx, x, y, rx, ry, fill, border, width = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function label(ctx, value, x, y, options = {}) {
  const { size = 11, color = '#b9aaa0', weight = 700, align = 'left', font = 'monospace' } = options;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function dotNoise(ctx, x, y, width, height, count, color, seed) {
  let state = seed;
  function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  ctx.fillStyle = color;
  for (let n = 0; n < count; n++) {
    const px = x + next() * width;
    const py = y + next() * height;
    ctx.fillRect(px, py, 1 + next() * 1.8, .45 + next() * 1.1);
  }
}

function drawRink(ctx) {
  const { left, right, top, bottom, goalX, goalY } = RINK;
  const w = right - left;
  const h = bottom - top;
  const centerY = (top + bottom) / 2;
  const upperBlue = top + h * .32;
  const lowerBlue = top + h * .68;
  const ice = ctx.createLinearGradient(left, top, right, bottom);
  ice.addColorStop(0, '#d9e6ea');
  ice.addColorStop(.47, '#eff8f7');
  ice.addColorStop(1, '#d1e4e9');

  roundRect(ctx, left - 12, top - 11, w + 25, h + 28, 40, '#111315');
  roundRect(ctx, left - 8, top - 8, w + 16, h + 16, 36, '#e9e5d9', '#111313', 2);
  roundRect(ctx, left - 5, top - 5, w + 10, h + 10, 32, '#9faaa7');
  roundRect(ctx, left - 2, top - 2, w + 4, h + 4, 29, '#fdc188');
  roundRect(ctx, left, top, w, h, 27, ice, '#687679', 1.4);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 27);
  ctx.clip();
  const boardsShadow = ctx.createLinearGradient(left, top, right, top);
  boardsShadow.addColorStop(0, '#7297a94c');
  boardsShadow.addColorStop(.12, '#7297a900');
  boardsShadow.addColorStop(.88, '#7297a900');
  boardsShadow.addColorStop(1, '#7297a95c');
  rect(ctx, boardsShadow, left, top, w, h);
  const endShadow = ctx.createLinearGradient(0, top, 0, bottom);
  endShadow.addColorStop(0, '#7a929946');
  endShadow.addColorStop(.10, '#7a929900');
  endShadow.addColorStop(.9, '#7a929900');
  endShadow.addColorStop(1, '#7a92994d');
  rect(ctx, endShadow, left, top, w, h);

  for (let n = 0; n < 32; n++) {
    const y = top + n * 14.1;
    line(ctx, [left, y], [right, y - 18], '#ffffff1f', 1);
  }
  dotNoise(ctx, left, top, w, h, 650, '#6c9ba329', 96);
  dotNoise(ctx, left, top, w, h, 350, '#ffffff99', 16);

  for (const y of [goalY, bottom - 33]) {
    line(ctx, [left, y], [right, y], '#b95c60a6', 2);
  }
  for (const y of [upperBlue, lowerBlue]) {
    line(ctx, [left, y], [right, y], '#417aa4af', 5);
    line(ctx, [left, y - 1], [right, y - 1], '#8eb4d068', 1);
  }
  line(ctx, [left, centerY], [right, centerY], '#ae515b9f', 4);
  for (let x = left + 4; x < right; x += 10) {
    shape(ctx, [[x, centerY], [x + 2, centerY - 2], [x + 5, centerY], [x + 2, centerY + 2]], '#edd2ce9f');
  }

  const circle = 38;
  for (const [x, y] of [[goalX - 82, top + 92], [goalX + 82, top + 92], [goalX - 82, bottom - 92], [goalX + 82, bottom - 92]]) {
    ellipse(ctx, x, y, circle, circle, null, '#b4585fa5', 1.5);
    ellipse(ctx, x, y, 4.3, 4.3, '#b65d64');
    line(ctx, [x - 10, y - 4], [x - 10, y + 4], '#b65d646c');
    line(ctx, [x + 10, y - 4], [x + 10, y + 4], '#b65d646c');
    for (const side of [-1, 1]) {
      for (const offset of [-1, 1]) {
        line(ctx, [x + offset * 13, y + side * 35], [x + offset * 15, y + side * 45], '#b4585fb5', 1.6);
      }
    }
  }
  for (const y of [upperBlue + 23, lowerBlue - 23]) {
    for (const x of [goalX - 82, goalX + 82]) ellipse(ctx, x, y, 3, 3, '#bb6468a8');
  }
  ellipse(ctx, goalX, centerY, 48, 48, '#eff8f32a', '#397faaa5', 2);
  ellipse(ctx, goalX, centerY, 4, 4, '#568aa9');
  ctx.save();
  ctx.translate(goalX, centerY);
  ctx.rotate(-.10);
  label(ctx, '3', 0, 1, { size: 65, color: '#65899a2d', weight: 900, align: 'center', font: 'Arial, sans-serif' });
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(goalX, goalY + 1, 42, 37, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#8db9d189';
  ctx.fill();
  ctx.strokeStyle = '#b45e669f';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.restore();

  for (const y of [80, 138, 196, 254, 312, 370, 428, 486, 544]) {
    rect(ctx, '#585f5d', left - 9, y, 2.3, 3);
    rect(ctx, '#f5ead1', left - 6.6, y, 2, 3);
    rect(ctx, '#585f5d', right + 6, y, 2.3, 3);
    rect(ctx, '#f5ead1', right + 4, y, 2, 3);
  }
  for (const x of [139, 193, 249, 306, 362, 395]) {
    rect(ctx, '#626463', x, top - 8, 2, 4);
    rect(ctx, '#626463', x, bottom + 4, 2, 4);
  }
  for (const y of [349, 385]) {
    line(ctx, [right + 1, y], [right + 9, y], '#484944', 1.4);
  }
  line(ctx, [right + 7, 352], [right + 7, 381], '#f0e6ca', .8);
}

function drawOpenBenchGate(ctx) {
  const x = RINK.right;
  rect(ctx, '#383631', x + 1, 350, 16, 34);
  rect(ctx, '#767065', x + 1, 350, 7, 34);
  rect(ctx, '#979d97', x - 1, 354, 3, 25);
  for (const y of [355, 360, 365, 370, 375, 380]) {
    line(ctx, [x + 3, y], [x + 8, y], '#4c4b44', .85);
  }
  line(ctx, [x + 1, 384.3], [x + 31, 384.3], '#161718', 5.4);
  line(ctx, [x + 1, 383.3], [x + 30, 383.3], '#d9d5c2', 3);
  line(ctx, [x + 4, 384.1], [x + 29, 384.1], '#da9a63', .9);
  ellipse(ctx, x + 4, 383.5, 1.5, 1.5, '#535552');
}

function drawNet(ctx) {
  const { goalX: x, goalY: y, goalWidth, goalDepth } = RINK;
  const half = goalWidth / 2;
  const back = y - goalDepth;
  const posts = [[x - half, y], [x - half + 5, back + 7], [x - half + 13, back], [x + half - 13, back], [x + half - 5, back + 7], [x + half, y]];
  ellipse(ctx, x + 1, y + 2, half + 5, 7, '#2938412c');
  shape(ctx, posts, '#6a7e86a1', '#3c4b52', 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...posts[0]);
  for (const point of posts.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.clip();
  for (let n = -5; n < goalWidth + goalDepth; n += 5) {
    line(ctx, [x - half + n, back], [x - half + n - 18, y + 3], '#eef6f49a', .9);
    line(ctx, [x - half + n - 23, back], [x - half + n - 5, y + 3], '#eff6f39a', .9);
  }
  ctx.restore();
  for (let n = 0; n < posts.length - 1; n++) {
    line(ctx, posts[n], posts[n + 1], '#982b2e', 4.6);
    line(ctx, [posts[n][0], posts[n][1] - .7], [posts[n + 1][0], posts[n + 1][1] - .7], '#ea6661', 1.6);
  }
  line(ctx, posts[0], posts.at(-1), '#9c373979', 1.2);
  ellipse(ctx, x - half, y + .5, 2.8, 2.5, '#b73937');
  ellipse(ctx, x + half, y + .5, 2.8, 2.5, '#b73937');
}

function drawFacility(ctx) {
  const floor = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  floor.addColorStop(0, '#211f1d');
  floor.addColorStop(.45, '#343330');
  floor.addColorStop(1, '#26201c');
  rect(ctx, floor, 0, 0, WIDTH, HEIGHT);
  for (let y = 13; y < HEIGHT; y += 29) line(ctx, [0, y], [WIDTH, y], '#0d0e0f35', 1);
  for (const x of [37, 70, 449, 538]) {
    rect(ctx, '#121210', x, 0, 3, HEIGHT);
    rect(ctx, '#7162534d', x + 3, 0, 1, HEIGHT);
  }
  dotNoise(ctx, 0, 0, WIDTH, HEIGHT, 1500, '#e2b39128', 820);
  dotNoise(ctx, 0, 0, WIDTH, HEIGHT, 1200, '#05050538', 518);

  for (const y of [36, 249, 465]) {
    roundRect(ctx, 36, y, 28, 106, 3, '#383330', '#574139');
    rect(ctx, '#201e1c', 41, y + 4, 18, 95);
    for (let n = y + 7; n < y + 99; n += 8) rect(ctx, '#63534a', 41, n, 18, 1);
  }
  for (const y of [153, 392]) {
    rect(ctx, '#181615', 45, y, 31, 61);
    for (let n = 0; n < 8; n++) {
      shape(ctx, [[50, y + 6 + n * 7], [54, y + 3 + n * 7], [70, y + 3 + n * 7], [66, y + 6 + n * 7]], '#a95230aa');
    }
  }
  const bench = ctx.createLinearGradient(450, 0, 531, 0);
  bench.addColorStop(0, '#2c2926');
  bench.addColorStop(.75, '#504033');
  bench.addColorStop(1, '#29241f');
  roundRect(ctx, 444, 222, 97, 205, 6, '#151411', '#696056', 1.5);
  roundRect(ctx, 449, 230, 86, 189, 3, bench);
  for (let y = 231; y < 419; y += 9) {
    line(ctx, [449, y], [535, y], '#1817146d');
    line(ctx, [449, y + 1], [535, y + 1], '#98745828');
  }
  roundRect(ctx, 492, 251, 33, 151, 2, '#1f1a16');
  roundRect(ctx, 489, 247, 33, 151, 2, '#8a5336', '#1e1816', 1.5);
  rect(ctx, '#bc7552', 491, 251, 2, 145);
  rect(ctx, '#75432f', 504, 249, 2, 148);
  rect(ctx, '#603c2a', 518, 249, 3, 147);
  for (const y of [268, 288, 307, 331, 352, 374, 393]) line(ctx, [492, y], [520, y], '#d4905e77');
  roundRect(ctx, 458, 394, 24, 13, 2, '#ad5737', '#2b211c');
  rect(ctx, '#e8ae79', 460, 396, 19, 2);
  for (let n = 0; n < 3; n++) {
    const x = 502 + n * 6;
    roundRect(ctx, x, 252 + (n % 2) * 4, 4, 12, 1, n === 1 ? '#d9b17e' : '#797d75');
    rect(ctx, '#c96844', x, 251 + (n % 2) * 4, 4, 2);
  }
  rect(ctx, '#47403a', 535, 234, 7, 179);
  rect(ctx, '#bc8c66', 536, 234, 1, 179);
  roundRect(ctx, 455, 132, 78, 31, 2, '#1d1b18', '#70614f');
  rect(ctx, '#ae4f2a', 460, 137, 3, 21);
  label(ctx, 'BENCH', 498, 148, { align: 'center', size: 12, color: '#ded1ba', weight: 900 });

  for (const y of [452, 542]) {
    roundRect(ctx, 466, y, 59, 18, 2, '#2c2824', '#756054');
    for (let x = 472; x < 520; x += 6) line(ctx, [x, y + 5], [x, y + 13], '#8c7662');
  }
  const light = ctx.createRadialGradient(268, 283, 144, 268, 283, 360);
  light.addColorStop(0, '#00000000');
  light.addColorStop(1, '#0b09095c');
  rect(ctx, light, 0, 0, WIDTH, HEIGHT);
}

function drawCoach(ctx, time, speech, throwAge = Infinity) {
  ctx.save();
  ctx.translate(471, 292);
  const pulse = speech ? Math.sin(time * 15) : Math.sin(time * 3) * .13;
  const throwing = throwAge < .44;
  const posedThrow = Math.sin(Math.PI * Math.min(1, throwAge / .44));
  const pose = throwing ? 'throw' : speech?.gesture;
  const lean = pose === 'lean' ? 5 + pulse * .7 : pose === 'point' ? 2.5 : .25;
  ellipse(ctx, 3, 29, 17, 5, '#1010109c');
  for (const [x, angle] of [[-7, .08], [8, -.16]]) {
    ctx.save();
    ctx.translate(x, 14);
    ctx.rotate(angle);
    roundRect(ctx, -4, 0, 9, 17, 2, '#212224', '#121315', 1.1);
    roundRect(ctx, -7, 14, 12, 5, 2, '#161616');
    line(ctx, [-6, 17], [3, 17], '#6b6257', .7);
    ctx.restore();
  }
  ctx.translate(-lean, 0);
  const arm = pose === 'throw' ? -18 + 27 * posedThrow : pose === 'raise' ? -13 - pulse * 5 : -pulse * 3;
  const otherArm = pose === 'raise' ? -9 - pulse * 4 : 0;
  const reach = pose === 'point' || pose === 'throw' ? -26 : -21;
  shape(ctx, [[-8, -5], [-14, -5], [reach + 4, -1 + arm], [reach, -2 + arm], [reach, 5 + arm], [reach + 6, 7 + arm], [-10, 7], [-5, 3]], '#34383a', '#141516', 1.5);
  roundRect(ctx, reach - 2, -2 + arm, 6, 7, 2, '#c78962', '#342220');
  line(ctx, [reach + 5, -1 + arm], [reach + 4, 5 + arm], '#b85d38', 2);
  shape(ctx, [[8, -5], [15, -6], [20, 1 + otherArm], [17, 9 + otherArm], [9, 7]], '#282a2c', '#121315', 1.3);
  roundRect(ctx, 13, 7 + otherArm, 6, 6, 2, '#b67856', '#392523');
  shape(ctx, [[-8, -11], [7, -10], [13, -5], [14, 15], [7, 19], [-9, 18], [-14, 13], [-14, -4]], '#2b2e30', '#131416', 1.4);
  shape(ctx, [[-13, -3], [-5, -9], [-6, 15], [-10, 16], [-13, 12]], '#3d4243');
  line(ctx, [3, -9], [3, 17], '#111314', 1.1);
  line(ctx, [-12, 12], [11, 13], '#753b2e', 1.3);
  rect(ctx, '#c96a43', 6, 0, 5, 2);
  ellipse(ctx, -4, -13, 11, 13, '#ce906a', '#362421', 1.4);
  ellipse(ctx, -2, -17, 9.1, 9.1, '#e2a87d');
  ellipse(ctx, -11, -12, 2.3, 3.2, '#b17458');
  ellipse(ctx, 6, -12, 2.1, 2.8, '#b17458');
  line(ctx, [-13, -12], [8, -12], '#1b1717', 2);
  roundRect(ctx, -15, -13.5, 9.2, 6.9, 1.3, '#747474', '#100f0f', 2);
  roundRect(ctx, -4.2, -13.5, 9.2, 6.9, 1.3, '#747474', '#100f0f', 2);
  line(ctx, [-13.3, -12.2], [-11, -10], '#f8dac1', .8);
  line(ctx, [-2.5, -12.2], [-.2, -10], '#f8dac1', .8);
  line(ctx, [-11, -3], [-5, -3], speech ? '#42251f' : '#82513e', speech ? 2.7 : 1.1);
  line(ctx, [-5, -25], [1, -25], '#f3c49d', 1);
  ctx.restore();
  label(ctx, 'COACH', 472, 334, { align: 'center', color: '#e8c8af', size: 8, weight: 900 });
}

function drawManager(ctx, manager, time) {
  if (!Number.isFinite(manager.x) || !Number.isFinite(manager.y)) return;
  const escorting = manager.phase === 'escort';
  const walking = manager.phase === 'enter' || escorting;
  const stride = walking ? Math.sin(time * 17) * 2.3 : 0;
  const shoulder = walking ? -Math.abs(stride) * .6 : 0;
  const arm = walking ? stride : -3.6 + Math.sin(time * 12) * 1.2;

  ellipse(ctx, manager.x + 1, manager.y + 13, 10, 3.2, '#0b090a9b');
  ctx.save();
  ctx.translate(manager.x, manager.y + shoulder);
  if (escorting) ctx.scale(-1, 1);
  for (const side of [-1, 1]) {
    const x = side * 3.1;
    const step = side * stride;
    roundRect(ctx, x - 2, 5 + step, 4.5, 6.1, .7, '#29292c', '#151419', .7);
    roundRect(ctx, x - 3.45, 10 + step, 6, 2.8, .9, '#1b1718', '#100e0f', .6);
  }

  line(ctx, [-5, -3], [-10.6, 1.5 + arm], '#161418', 3.6);
  line(ctx, [-5.6, -3], [-10.6, 1.5 + arm], '#4c4d52', 2.1);
  ellipse(ctx, -11.5, 1.5 + arm, 1.75, 1.4, '#d29c74', '#352827', .6);
  line(ctx, [4.8, -3.1], [8.3, 4 - stride * .45], '#24242a', 3.8);
  line(ctx, [7.8, 4 - stride * .45], [9.1, 4 - stride * .45], '#d39a73', 1.4);
  shape(ctx, [[-4.8, -6], [4.4, -6], [7, -.7], [5.9, 7], [-5.8, 7], [-7.1, -1]], '#36383f', '#14141a', .95);
  shape(ctx, [[-3.1, -5.7], [3.4, -5.7], [0, 2.3]], '#efebd9');
  shape(ctx, [[-.9, -4.1], [1, -4.1], [1.55, .9], [0, 2.7], [-1.5, .8]], '#d87349');
  line(ctx, [-5.4, -3.2], [-2.8, 1.5], '#6a6c73', 1);
  line(ctx, [4.5, -3.2], [2.7, 1.5], '#75757b', 1);
  rect(ctx, '#aeaa97', 3.8, .5, 2.1, .8);
  roundRect(ctx, 7.4, 4.6 - stride * .45, 9.2, 5.8, 1, '#855c46', '#23191a', .9);
  line(ctx, [8.6, 7.6 - stride * .45], [15.5, 7.6 - stride * .45], '#d9a778', .7);

  ellipse(ctx, -.8, -10.1, 5.85, 6.35, '#d9a982', '#47302a', .95);
  shape(ctx, [[-6.6, -10.7], [-6.4, -14.6], [-2.8, -16.9], [2.9, -16], [5, -13.6], [3, -12], [1.4, -14.2], [-2.2, -12.8], [-5.2, -12.4]], '#a39d91', '#51453d', .6);
  line(ctx, [-4.5, -10.8], [-3.3, -10.6], '#25201d', .75);
  line(ctx, [-.2, -10.6], [1, -10.6], '#25201d', .75);
  line(ctx, [-3.4, -7.25], [.35, -7.4], '#815444', .68);
  ctx.restore();
}

function skaterFoot(ctx, side, stride, color) {
  const x = side * 5.5;
  const y = 7 + stride * side;
  roundRect(ctx, x - 4, y - 1, 8, 9, 1.5, '#202225', '#111719', 1.1);
  rect(ctx, color, x - 3, y + 2, 6, 2);
  roundRect(ctx, x - 3.6, y + 5, 7.2, 7, 1.2, '#131718', '#0b1011', .9);
  line(ctx, [x - 2.7, y + 11], [x + 3, y + 11], '#a8b5b9', 1);
}

function drawSkater(ctx, skater, time, stickPuck, glanceAngle, isHuman) {
  const { x, y, id, angle, action, actionTime, stun, ejection } = skater;
  const uniform = skater.number === 44 ? REPLACEMENT_UNIFORM : TEAMS[id];
  const speed = Math.hypot(skater.vx, skater.vy);
  const ejectionProgress = ejection?.progress ?? 0;
  const airborne = ejection?.height ?? 0;
  const floored = action === 'bottle-hit' || ejection?.phase === 'waiting';
  const rotation = floored ? 1.18 : ejection?.phase === 'return' ? Math.PI * 2 * ejectionProgress
    : ejection?.phase === 'exit' ? Math.PI * 1.35 * ejectionProgress : 0;
  const heading = (glanceAngle ?? angle ?? -Math.PI / 2) + Math.PI / 2 + rotation;
  const stride = skater.departing
    ? Math.sin(time * 18) * 2.5
    : Math.sin(time * (speed > 175 ? 22 : 17) + id * 2) * Math.min(4, speed / 35);
  ellipse(ctx, x + 1, y + 5, 16, 12, airborne ? '#1021244d' : '#23323733');

  if (stickPuck) ellipse(ctx, x, y, 20, 16, '#ff87351f', '#e45f2eb8', 2);
  if (skater.specialCharge >= 1 && !ejection) {
    const pulse = (Math.sin(time * 9) + 1) / 2;
    ellipse(ctx, x, y, 23 + pulse * 2, 19 + pulse * 2, null, '#ed7839bd', 1.6);
  }
  if (action === 'deke') {
    const trail = Math.min(.085, 25 / (speed || 1));
    line(ctx, [x - skater.vx * trail, y - skater.vy * trail + 6], [x, y + 6], '#fbfbf5a0', 6);
    line(ctx, [x - skater.vx * trail, y - skater.vy * trail + 10], [x, y + 10], '#fb81383d', 2);
  }
  if (isHuman && !ejection) {
    ctx.save();
    ctx.setLineDash([6, 3]);
    ellipse(ctx, x, y, 19 * uniform.width, 16 * uniform.height, null, '#0817198e', 1.5);
    ctx.restore();
    const mark = y - 27 * uniform.height - 1.15 * Math.sin(time * 7);
    shape(ctx, [[x - 6, mark], [x + 6, mark], [x, mark + 7.5]], ORANGE, '#37271d', 1.1);
    line(ctx, [x - 4, mark + 1.2], [x + 4, mark + 1.2], '#ffac76', .8);
  }
  ctx.save();
  ctx.translate(x, y - airborne);
  ctx.rotate(heading);
  ctx.scale(uniform.width, uniform.height * (floored ? .75 : 1));
  if (stun > 0) ctx.rotate(.20 * Math.sin(time * 28));

  skaterFoot(ctx, -1, stride, uniform.trim);
  skaterFoot(ctx, 1, stride, uniform.trim);
  roundRect(ctx, -9, 3, 18, 9, 2, '#252729', '#14191a', 1.3);
  rect(ctx, '#626464', -7, 9, 14, 1);

  const reach = actionTime > 0 && (action === 'shoot' || action === 'shot' || action === 'poke') ? 5 : 0;
  const scooping = action === 'michigan' && stickPuck;
  const hand = skater.handedness === 'left' ? -1 : 1;
  const stickStart = [9 * hand, 7];
  let tip = [4 * hand, -18 - reach];
  if (stickPuck) {
    const dx = stickPuck.x - x;
    const dy = stickPuck.y - (stickPuck.height ?? 0) - (y - airborne);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    tip = [(dx * cos + dy * sin) / uniform.width, (-dx * sin + dy * cos) / uniform.height];
  }
  const elbow = [tip[0] + 7.5 * hand, tip[1] + 4];
  ctx.save();
  if ((action === 'slapshot' || action === 'muffin') && !stickPuck) {
    ctx.translate(...stickStart);
    const swing = action === 'muffin' ? -.12 - actionTime * 1.35 : .45 - actionTime * 2.7;
    ctx.rotate(hand * swing);
    ctx.translate(-stickStart[0], -stickStart[1]);
  }
  line(ctx, stickStart, elbow, '#1b2226', 3.2);
  line(ctx, [8.7 * hand, 7], [elbow[0] - .3 * hand, elbow[1]], '#977a5c', 1.1);
  line(ctx, elbow, tip, '#202326', 4.4);
  line(ctx, [elbow[0], elbow[1] - 1.2], [tip[0], tip[1] - 1.2], '#ddd5c3', 1.2);
  if (scooping) {
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 8, -.94 * Math.PI, -.06 * Math.PI);
    ctx.strokeStyle = '#fc9b5c';
    ctx.lineWidth = 1.65;
    ctx.stroke();
  }
  ctx.restore();

  shape(ctx, [[-8, -8], [-13, -5], [-15, 0], [-13, 6], [-8, 8], [-6, 4], [-7, 0]], uniform.jersey, '#192124', 1.5);
  shape(ctx, [[8, -8], [13, -4], [14, 2], [12, 7], [7, 6], [6, 2]], uniform.jersey, '#192124', 1.5);
  line(ctx, [-14, 2], [-8, 4], uniform.trim, 2.5);
  line(ctx, [9, 2], [13, 3], uniform.trim, 2.5);
  roundRect(ctx, -13, 4, 6, 5, 1.3, '#1b1d1d', '#101517', .8);
  roundRect(ctx, 7, 4, 6, 5, 1.3, '#1b1d1d', '#101517', .8);

  shape(ctx, [[-8, -8], [-4, -12], [4, -12], [8, -8], [9, 4], [6, 7], [-6, 7], [-9, 4]], uniform.jersey, '#161b1d', 1.5);
  shape(ctx, [[-7, -5], [-3, -8], [4, -8], [7, -6], [7, -3], [-7, -3]], uniform.light);
  line(ctx, [-7, 5], [7, 5], uniform.seam, 1.1);
  label(ctx, String(skater.number), 0, 2, { size: 7.2, color: uniform.text, weight: 900, align: 'center' });

  ellipse(ctx, 0, -10.5, 6.3, 6.7, '#111719', '#0b1011', 1);
  ellipse(ctx, -1.4, -12.6, 4.2, 3.4, '#343b3d');
  line(ctx, [-3.8, -15], [1.2, -16], '#687170', 1.2);
  line(ctx, [-4, -7.5], [3.4, -7.5], '#6f7772', .75);
  ctx.restore();
  if (floored) {
    for (let n = 0; n < 3; n++) {
      const phase = time * 4.4 + n * Math.PI * .67;
      const starX = x + Math.sin(phase) * 13;
      const starY = y - 14 + Math.cos(phase) * 3;
      line(ctx, [starX - 2.1, starY], [starX + 2.1, starY], '#dd722f', 1.2);
      line(ctx, [starX, starY - 2.1], [starX, starY + 2.1], '#dd722f', 1.2);
    }
  } else if (stun > .05) {
    ellipse(ctx, x + 13, y - 13, 1.7, 1.7, '#ff953f');
  }
}

function drawGoalie(ctx, goalie, time) {
  const { x, y, action, actionTime } = goalie;
  const saving = (action === 'save' || action === 'block') && actionTime > 0;
  const drift = Math.max(-.22, Math.min(.22, goalie.vx / 450)) || 0;
  const spread = saving ? Math.sin(Math.PI * Math.min(1, actionTime / .32)) : 0;
  ellipse(ctx, x + 1, y + 5, 15 + spread * 10, 15, '#2e42484f');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(drift);
  ctx.scale(1, 1.21 - spread * .18);
  const padWidth = 8.5 + spread * 2.8;
  const padOffset = 6 + spread * 7.4;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * padOffset, 9 + spread * 2);
    ctx.rotate(side * (-.08 - spread * .63));
    roundRect(ctx, -padWidth / 2, -6, padWidth, 22, 1.7, '#585b5e', '#22262b', 1.25);
    roundRect(ctx, -padWidth / 2 + .9, -5, padWidth - 1.8, 4, .9, '#898982');
    rect(ctx, '#c3633e', -padWidth / 2 + 1, 9, padWidth - 2, 2.2);
    rect(ctx, '#292c2e', -padWidth / 2 + 1.2, 13.4, padWidth - 2.4, 2.1);
    line(ctx, [-2.5, -.6], [-2.5, 7], '#939896', 1.1);
    ctx.restore();
  }
  const arm = spread * 6;
  shape(ctx, [[-5, -11], [-10, -12], [-13 - arm, 1], [-9 - arm, 5], [-5, 1]], '#404447', '#202326', 1.2);
  shape(ctx, [[5, -11], [10, -12], [13 + arm, 1], [10 + arm, 7], [5, 1]], '#494b4f', '#202326', 1.2);
  shape(ctx, [[-6, -15], [6, -15], [9, -10], [7, 4], [4, 7], [-4, 7], [-7, 4], [-9, -10]], '#373b40', '#1f252a', 1.35);
  shape(ctx, [[-6, -11], [-3, -14], [4, -14], [6, -11], [4, -8], [-4, -8]], '#575c60');
  line(ctx, [-7, -7], [7, -7], '#ad5137', 2);
  rect(ctx, '#a75439', -5, .7, 10, 2);
  roundRect(ctx, 9 + arm, -1, 8, 10.5, 1.4, '#555a5d', '#232526', 1.2);
  rect(ctx, '#cf7850', 10 + arm, 1.7, 6, 1.9);
  ellipse(ctx, -12 - arm, 3.5, 5.3, 4.6, '#606164', '#2f3236', 1.2);
  line(ctx, [-15 - arm, 2.5], [-11 - arm, 4.5], '#cb6a47', 1.4);
  line(ctx, [13 + arm, 8], [12, 20], '#88705a', 2.35);
  line(ctx, [12, 20], [-2, 22], '#353436', 3.15);
  line(ctx, [12, 19], [-2, 21], '#baa18a', 1.05);
  ellipse(ctx, 0, -14.4, 6.25, 7.5, '#3f4549', '#151a1c', 1.1);
  ellipse(ctx, -1.2, -17.1, 3.6, 2.6, '#6c7678');
  roundRect(ctx, -4.5, -13.6, 9, 4.9, 1.2, '#161b1d', '#969c98', .8);
  line(ctx, [-4, -11], [4, -11], '#a6aeaa', .65);
  line(ctx, [-1.4, -13.1], [-1.4, -9], '#a3a8a3', .65);
  line(ctx, [1.4, -13.1], [1.4, -9], '#a3a8a3', .65);
  ctx.restore();
  if (saving) ellipse(ctx, x, y, 25 + Math.sin(time * 26) * 2, 18, null, '#fdf1bcab', 1.5);
}

function fur(ctx, x, y, rx, ry, fill, outline) {
  ctx.beginPath();
  for (const [i, [dx, dy]] of FUR_OFFSETS.entries()) {
    if (i === 0) ctx.moveTo(x + dx * rx, y + dy * ry);
    else ctx.lineTo(x + dx * rx, y + dy * ry);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.05;
    ctx.stroke();
  }
}

function drawMascot(ctx, mascot, time) {
  const { x, y, angle, action, actionTime } = mascot;
  const throwing = action === 'throw';
  const stride = throwing ? 0 : Math.sin(time * 21);
  const facing = throwing || Math.abs(Math.cos(angle)) > .4
    ? Math.sign(Math.cos(angle)) || 1
    : x > RINK.goalX ? -1 : 1;
  const tuck = throwing ? -(Math.sin(Math.PI * Math.min(1, actionTime / .5))) : Math.abs(stride);
  const furDark = '#cc4b1d';
  const furMid = '#f36b25';
  const furLight = '#ff8c3d';

  ellipse(ctx, x + 1, y + 15, 14, 5.25, '#0807069c');
  ctx.save();
  ctx.translate(x, y - Math.max(0, tuck) * 2);
  ctx.scale(facing, 1);
  ctx.rotate(stride * .085 - tuck * .11);
  for (const side of [-1, 1]) {
    const kick = side * stride * 5;
    line(ctx, [side * 5, 7], [side * 6 + kick, 14], furDark, 5.8);
    roundRect(ctx, side * 6 + kick - 4, 12 + kick * .3, 11, 5.2, 2, '#341c18', '#171310', .6);
    line(ctx, [side * 6 + kick, 13 + kick * .3], [side * 6 + kick + 5, 13 + kick * .3], '#ffa85e', .75);
  }

  const frontArm = throwing ? -11 - tuck * 5 : stride * 5;
  const backArm = throwing ? -8 : -stride * 4;
  line(ctx, [-7, 0], [-15, 2 + backArm], '#5a2b1f', 7);
  line(ctx, [-7, 0], [-15, 2 + backArm], furDark, 5.5);
  line(ctx, [7, 0], [throwing ? 22 : 14, 3 + frontArm], '#5a2b1f', 8);
  line(ctx, [7, 0], [throwing ? 22 : 14, 3 + frontArm], furMid, 6.5);
  fur(ctx, -15, 2 + backArm, 4.5, 4.3, furMid, '#8b421f');
  fur(ctx, throwing ? 22 : 14, 3 + frontArm, 5.3, 4.5, furLight, '#8b421f');

  fur(ctx, 0, 2, 12, 13, furMid, '#722e1d');
  fur(ctx, 0, 6, 8, 7, '#ffa458', null);
  shape(ctx, [[-6, 3], [1, 1], [7, 4], [6, 9], [-2, 11], [-7, 7]], '#292127', '#813b21', .7);
  ellipse(ctx, .3, 6, 3.8, 2.5, '#fcbe79');
  line(ctx, [-2.7, 5.4], [2.4, 5.4], '#85412e', .6);
  fur(ctx, 0, -10, 13.5, 13, furLight, '#70301c');
  fur(ctx, -8, -16, 5.75, 6.4, furMid, null);
  fur(ctx, 7, -17, 4.75, 6, furLight, null);
  fur(ctx, 4.2, -10.1, 9.6, 8.2, '#ffa150', null);

  const blink = Math.sin(time * 3.4) > .992;
  ellipse(ctx, -3.8, -12, 4.4, blink ? .6 : 4.6, '#fff9e6', '#6e351f', .9);
  ellipse(ctx, 5.8, -13, 4.7, blink ? .65 : 5.2, '#fff9e6', '#6e351f', .9);
  if (!blink) {
    ellipse(ctx, -2.5, -11.4, 1.65, 2, '#212025');
    ellipse(ctx, 7.3, -12.6, 1.8, 2.25, '#212025');
  }
  line(ctx, [-7, -17.1], [-3, -18.2], '#ae441f', 1.15);
  line(ctx, [5, -19.2], [9, -18.3], '#ae441f', 1.15);
  shape(ctx, [[-.8, -8.8], [2.6, -10.2], [5.2, -7.1], [1.3, -6]], '#ce4a22', '#9a3b22', .65);
  shape(ctx, [[-5, -5], [1, -4], [7.1, -6], [6, -1.8], [1.5, .1], [-2.7, -1.2]], '#351b1d');
  line(ctx, [-1, -1.7], [3.2, -1.9], '#ef7670', 1.1);
  ctx.restore();
}

function drawPuck(ctx, puck) {
  const { x, y, vx, vy, owner } = puck;
  const height = puck.height ?? 0;
  const puckY = y - height;
  const speed = Math.hypot(vx, vy);
  ellipse(ctx, x + 1.2, y + 2.5, 6.6, 4.5, height > 1 ? '#45575e35' : '#45575e56');
  if (owner === null && speed > 210) {
    const length = Math.min(.053, 21 / speed);
    line(ctx, [x - vx * length, puckY - vy * length], [x, puckY], height > 1 ? '#f7683285' : '#273c4963', 4.7);
    line(ctx, [x - vx * length, puckY - vy * length], [x, puckY], '#f7fbf4b5', 1.4);
  }
  ellipse(ctx, x, puckY, 5.6, 4.6, '#131a1d', height > 1 ? '#ff9959' : '#fffaf2db', 1.15);
  line(ctx, [x - 2, puckY - 1.7], [x + 1, puckY - 1.7], '#687a82', 1);
}

function drawShake(ctx, { x, y, height, angle }) {
  ellipse(ctx, x + 1, y + 2, 8, 4.1, '#291b203f');
  ctx.save();
  ctx.translate(x, y - height);
  ctx.rotate(angle);
  roundRect(ctx, -4.2, -8, 8.4, 16, 2.4, '#784124', '#322321', 1.4);
  roundRect(ctx, -3, -10.3, 6, 3.5, .7, '#24211f', '#131212', .75);
  rect(ctx, '#fff1d8', -3.4, -4.1, 6.8, 8);
  line(ctx, [-2.6, -.7], [2.5, -.7], '#a75833', 1.1);
  line(ctx, [-2.1, 1.3], [2.1, 1.3], '#a75833', .9);
  line(ctx, [-2.85, 4.9], [-2.85, 6.75], '#d59865', .85);
  ctx.restore();
}

function drawEffects(ctx, effects) {
  for (const effect of effects) {
    const { type, x, y, age, move } = effect;
    if (type === 'shake-throw' || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const goal = type === 'goal';
    const spectacle = type === 'special' || type === 'return' || type === 'eject' || type === 'michigan-release';
    const spill = type === 'shake-hit';
    const accent = spill ? '#a76040' : move === 'deke' ? '#528ba2' : '#f2612d';
    const duration = goal ? .9 : spectacle || spill ? .58 : .34;
    const life = age / duration;
    if (life >= 1) continue;
    const color = goal || type === 'check' || spectacle || spill ? accent : type === 'save' ? '#f9f5e1' : '#4c7489';
    ctx.save();
    ctx.globalAlpha = (1 - life) * (type === 'shot' || type === 'board' ? .64 : .94);
    if (goal || type === 'check' || type === 'save' || spectacle) {
      ellipse(ctx, x, y, (goal ? 15 : 5) + life * (goal ? 64 : 32), (goal ? 9 : 4) + life * (goal ? 36 : 26), null, color, 2.5 - life);
    }
    const count = goal ? 14 : spectacle || spill ? 10 : 6;
    for (let n = 0; n < count; n++) {
      const angle = n * Math.PI * 2 / count + n % 2;
      const dist = 6 + life * (goal ? 68 : spectacle ? 36 : 24) * (1 + (n % 3) * .23);
      ctx.save();
      ctx.translate(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * .73);
      ctx.rotate(angle);
      if (spill) {
        ellipse(ctx, 0, 0, n % 3 === 0 ? 2.9 : 1.85, 1.2, n % 2 ? color : '#ffd5a3');
      } else {
        rect(ctx, color, -3, -1, goal ? 9 : 6, goal ? 2.5 : 1.5);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.backdrop = document.createElement('canvas');
  }

  draw(game, { time = 0, coach = null, effects = [] } = {}) {
    const { canvas, ctx, backdrop } = this;
    if (backdrop.width !== canvas.width || backdrop.height !== canvas.height || !this.backdropReady) {
      backdrop.width = canvas.width;
      backdrop.height = canvas.height;
      const background = backdrop.getContext('2d', { alpha: false });
      background.setTransform(backdrop.width / WIDTH, 0, 0, backdrop.height / HEIGHT, 0, 0);
      drawFacility(background);
      drawRink(background);
      drawNet(background);
      this.backdropReady = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    const orange = game.skaters[2];
    if (game.manager && orange.departing) drawOpenBenchGate(ctx);
    const shakeThrow = effects.findLast(({ type }) => type === 'shake-throw');
    drawCoach(ctx, time, coach, shakeThrow?.age);
    if (game.mascot) drawMascot(ctx, game.mascot, time);
    drawGoalie(ctx, game.goalie, time);
    const looks = orange.number === 39 && game.roundDelay > 0 &&
      (game.lastScorer === orange.id || effects.some(({ type, player }) => type === 'goal' && player === orange.id));
    const humanId = game.humanId ?? 0;
    const skaters = [...game.skaters].sort((a, b) => a.y - b.y);
    for (const skater of skaters) {
      const rival = looks && skater.id < 2 ? game.skaters[1 - skater.id] : null;
      const glance = rival ? Math.atan2(rival.y - skater.y, rival.x - skater.x) : undefined;
      drawSkater(ctx, skater, time, game.puck.owner === skater.id ? game.puck : null, glance, skater.id === humanId);
    }
    drawPuck(ctx, game.puck);
    if (game.manager) drawManager(ctx, game.manager, time);
    if (game.shake) drawShake(ctx, game.shake);
    drawEffects(ctx, effects);
  }
}
