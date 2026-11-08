// the current palette's thread colour, for SVG drawn from script
const threadColor = () => getComputedStyle(document.documentElement).getPropertyValue('--thread').trim() || '#c2362b';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

/* ---------------- Clocks ---------------- */
function fmt(tz) { return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date()); }
function offset(tz) {
  const d = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())) / 60000;
}
function clocks() {
  $('clockIST').innerHTML = `${fmt('Asia/Kolkata')}<small>IST</small>`;
  $('clockEST').innerHTML = `${fmt('America/New_York')}<small>ET</small>`;
  const g = (offset('Asia/Kolkata') - offset('America/New_York')) / 60;
  $('gap').textContent = Number.isInteger(g) ? g : g.toFixed(1);
}
if ($('clockIST')) { clocks(); setInterval(clocks, 20000); }

/* ---------------- Hero thread: strung between the two clocks ---------------- */
(function heroThread() {
  if (!$('rope')) return;
  const cv = $('rope'), ctx = cv.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  function draw() {
    const r = cv.getBoundingClientRect(), W = r.width, H = r.height, y = 214;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cs = getComputedStyle(cv);
    // the rope is the start of the page thread, so it takes the same line colour
    ctx.strokeStyle = cs.getPropertyValue('--thread-line').trim() || cs.getPropertyValue('--thread').trim() || '#c2362b'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, y); ctx.quadraticCurveTo(W / 2, y + 46, W - 6, y); ctx.stroke();
    ctx.fillStyle = cs.color;
    [[6, y], [W - 6, y]].forEach(([x, yy]) => { ctx.beginPath(); ctx.arc(x, yy, 4, 0, 7); ctx.fill(); });
  }
  addEventListener('resize', draw);
  draw();
})();

/* ---------------- The page-long thread ---------------- */
(function pageThread() {
  const svg = $('thread'), path = $('threadPath');
  let len = 0;
  if (!svg) return;
  const knot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  knot.setAttribute('r', 4); knot.setAttribute('class', 'thread-start'); knot.style.display = 'none';
  svg.appendChild(knot);
  // The charcoal bands sit on their own layer underneath the thread, so the thread is
  // drawn over them; cards and text in the cream sections still sit on top of it.
  const bands = document.createElement('div');
  bands.id = 'bands'; bands.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(bands, svg);
  document.documentElement.classList.remove('no-bands');
  function placeBands() {
    bands.innerHTML = [...document.querySelectorAll('.hero, .page-head, .contact')].map(el => {
      const r = el.getBoundingClientRect();
      return `<i style="top:${Math.round(r.top + scrollY)}px;height:${Math.round(r.height)}px"></i>`;
    }).join('');
  }
  function build() {
    const doc = document.documentElement;
    placeBands();
    svg.setAttribute('height', 0); svg.style.height = '0px';
    const w = doc.clientWidth, h = Math.ceil(document.querySelector('footer').getBoundingClientRect().bottom + scrollY);
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.style.width = w + 'px'; svg.style.height = h + 'px';
    const narrow = w < 860;
    // Each anchor contributes a top and bottom point on its outer edge, so the thread
    // runs down the margins and only crosses sides in the white space between chapters.
    const pts = [];
    document.querySelectorAll('[data-anchor]').forEach(el => {
      const r = el.getBoundingClientRect(), top = r.top + scrollY, kind = el.dataset.anchor;
      if (kind === 'hero') { pts.push({ x: r.right - 6, y: top + 214 }); return; }
      if (kind === 'end') { pts.push({ x: r.left + r.width / 2, y: top + 4 }); return; }
      const cs = getComputedStyle(el), pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop);
      let x = kind === 'left' ? r.left + pl - 30 : r.right - pr + 30;
      if (narrow) x = kind === 'left' ? 8 : w - 8;
      x = Math.max(6, Math.min(w - 6, x));
      pts.push({ x, y: top + pt + 4 }, { x, y: top + r.height - 4 });
    });
    pts.sort((a, b) => a.y - b.y);
    // Section pages have no rope, so the thread starts from a knot in the header above
    // the first chapter instead of appearing out of nowhere in the cream.
    const head = document.querySelector('.page-head');
    if (head && pts.length) {
      const start = { x: pts[0].x, y: head.getBoundingClientRect().bottom + scrollY - 34 };
      pts.unshift(start);
      knot.setAttribute('cx', start.x); knot.setAttribute('cy', start.y); knot.style.display = '';
    } else knot.style.display = 'none';
    if (pts.length < 2) { path.setAttribute('d', ''); return; }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = (b.y - a.y) * .55;
      d += ` C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
    }
    path.setAttribute('d', d);
    len = path.getTotalLength();
    path.style.strokeDasharray = len;
    // sample the path so a scroll position can be turned into a drawn length
    table = [];
    for (let l = 0; l <= len; l += 12) table.push([path.getPointAtLength(l).y, l]);
    table.push([path.getPointAtLength(len).y, len]);
    update();
  }
  let table = [];
  function update() {
    if (reduce) { path.style.strokeDashoffset = 0; return; }
    const y = scrollY + innerHeight * .7;
    let drawn = 0;
    for (const [py, l] of table) { if (py <= y) drawn = l; else break; }
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) drawn = len;
    path.style.strokeDashoffset = len - drawn;
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(build));
  addEventListener('load', build);
  document.fonts && document.fonts.ready.then(build);
  // images and late layout shifts change section heights after load; re-measure when <main> resizes
  if ('ResizeObserver' in window) { let q = 0; new ResizeObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(build); }).observe(document.getElementById('main')); }
  build();
})();

/* ---------------- Reveal + counters ---------------- */
if (!reduce) document.querySelectorAll('[data-count]').forEach(n => { n.textContent = '0'; });
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  e.target.querySelectorAll('[data-count]').forEach(n => {
    const end = +n.dataset.count, t0 = performance.now();
    const tick = t => { const k = Math.min(1, (t - t0) / 1200); n.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
    reduce ? (n.textContent = end) : requestAnimationFrame(tick);
  });
  io.unobserve(e.target);
}), { threshold: .2 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
// If the observer never fires (old browser, hidden tab), show everything anyway.
setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('in'); }), 1500);

/* ---------------- 01 Weave: a handloom at work ----------------
   Plain cotton woven one-over-one with the small irregularities of a hand loom, a dhoti stripe
   on one side, a red and zari border with a temple motif on the other, and buttas in the body.
   It runs on a loom's own rhythm rather than on scroll: the shed opens, the shuttle carries one
   weft thread across, the reed beats it into the cloth, and the cloth is taken up. */
(function weave() {
  if (!$('weave')) return;
  const cv = $('weave'), ctx = cv.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const C = { warp: '#e2d6bf', weft: '#f3ecdc', red: '#c2362b', deep: '#8f2219', zari: '#b8954f', zari2: '#d8bd7f', ink: '#2a2622', wood: '#8a5a2b', woodLight: '#b07a43' };
  const cell = 5, PASS = 1000, BEAT = 300;   // ms for one shuttle pass, and for the reed to beat up
  let W, H, cols, rows, regions, picks = 0, phase = 0, t0 = 0, running = false, visible = false;
  const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function layout() {
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    const border = Math.max(14, Math.round(cols * .2));
    regions = { kara: [2, 7], borderStart: cols - border, temple: 5 };
  }
  // What colour the warp (vertical) thread is in column c.
  function warpColor(c) {
    const k = regions.kara[0], bs = regions.borderStart;
    if (c === k || c === k + 1) return C.red;
    if (c === k + 3) return C.zari;
    if (c === k + 5) return C.ink;
    if (c >= bs) {
      const i = c - bs;
      if (i === 2 || i === 3 || i === cols - bs - 4) return C.zari;
      if (i === 6) return C.zari2;
      return i < 1 ? C.deep : C.red;
    }
    return C.warp;
  }
  // The colour of a woven cell: which thread shows on top, plus border and motif rules.
  function cellColor(r, c) {
    const bs = regions.borderStart, warpUp = (r + c) % 2 === 0;
    const P = 10, t = regions.temple, tooth = t - Math.abs((r % P) - P / 2) * (t / (P / 2));
    if (c < bs && c >= bs - t && bs - c <= tooth) return warpUp ? C.red : C.deep;
    if (c >= bs) return warpUp ? warpColor(c) : (c - bs === 2 || c - bs === 3 ? C.zari : C.red);
    const br = r % 16, bc = (c + (Math.floor(r / 16) % 2) * 8) % 16;
    if (c > regions.kara[1] + 3 && c < bs - t - 2 && Math.abs(br - 8) + Math.abs(bc - 8) <= 1) return C.zari;
    if (warpUp) return warpColor(c);
    return hash(0, r) > .93 ? '#e9dfc9' : C.weft;
  }
  function row(p, y, from, to) {
    for (let c = from; c < to; c++) {
      ctx.globalAlpha = 1 - Math.abs(hash(c, p) * .12 - .06);
      ctx.fillStyle = cellColor(p, c);
      ctx.fillRect(c * cell, y, cell, cell);
    }
    ctx.globalAlpha = 1;
  }
  // The fell (where cloth meets open warp) climbs from the bottom, then holds while the cloth is taken up.
  const fellY = n => Math.max(Math.round(H * .42 / cell) * cell, H - n * cell);

  function draw(now) {
    if (!W) return;
    const el = now - t0, pass = Math.min(1, el / PASS), beat = el > PASS ? Math.min(1, (el - PASS) / BEAT) : 0;
    const fy = fellY(picks), cur = fy - cell;          // the row being woven sits just above the fell
    ctx.fillStyle = '#efe7d6'; ctx.fillRect(0, 0, W, H);
    // open warp above the fell; the lifted half of the shed swaps every pick
    for (let c = 0; c < cols; c++) {
      const up = (c + picks) % 2 === 0;
      ctx.fillStyle = warpColor(c); ctx.globalAlpha = up ? 1 : .55;
      ctx.fillRect(c * cell + 1.5, 0, 2, cur);
    }
    ctx.globalAlpha = 1;
    // finished cloth below the fell, newest row on top
    for (let k = 0; k < picks && fy + k * cell < H; k++) row(picks - 1 - k, fy + k * cell, 0, cols);
    // this pick's weft, laid behind the shuttle; passes alternate direction
    const ltr = picks % 2 === 0, x = ease(pass) * cols;
    if (ltr) row(picks, cur, 0, Math.floor(x)); else row(picks, cur, cols - Math.floor(x), cols);
    // the reed: hangs a little above the cloth and swings down once the shuttle is through
    const swing = beat ? Math.sin(beat * Math.PI) : 0, ry = cur - 16 + swing * 13;
    ctx.fillStyle = 'rgba(42,38,34,.55)'; ctx.fillRect(0, ry, W, 2);
    ctx.fillStyle = 'rgba(42,38,34,.18)';
    for (let c = 0; c < cols; c += 2) ctx.fillRect(c * cell + 2, ry - 6, 1, 6);
    // the shuttle, riding the shed
    if (pass < 1) {
      const sx = ltr ? x * cell : W - x * cell, sy = cur + cell / 2, L = 30, h = 7;
      ctx.fillStyle = C.wood;
      ctx.beginPath(); ctx.moveTo(sx - L / 2, sy); ctx.quadraticCurveTo(sx, sy - h, sx + L / 2, sy); ctx.quadraticCurveTo(sx, sy + h, sx - L / 2, sy); ctx.fill();
      ctx.fillStyle = C.woodLight; ctx.fillRect(sx - 6, sy - 1.5, 12, 3);
    }
    // a soft fold of shadow to give the cloth some body
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,.05)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function tick(now) {
    if (!running) return;
    if (now - t0 >= PASS + BEAT) { picks++; t0 = now; }   // beat done: the cloth takes up one pick
    draw(now);
    requestAnimationFrame(tick);
  }
  function play() { if (running || reduce) return; running = true; t0 = performance.now(); requestAnimationFrame(tick); }
  function size() {
    const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    if (reduce) { picks = Math.round(rows * .55); t0 = -1e9; }   // a still loom: cloth half woven, no shuttle
    else if (!picks) picks = Math.round(rows * .58);              // start with the fell mid-card, so the shuttle is in view at once
    draw(reduce ? 0 : performance.now());
  }
  // weave only while the loom is on screen
  new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    if (visible) play(); else running = false;
  })).observe(cv);
  addEventListener('resize', size);
  size();
})();

/* ---------------- 02 Waterfall ---------------- */
(function waterfall() {
  const steps = [
    ['MRP', 100, 'start', 'The sticker price the customer sees.'],
    ['Discounts', -18, 'minus', 'Sale and coupon discounts come off first.'],
    ['Tax', -9, 'minus', 'GST is separated out of the selling price.'],
    ['Returns', -7, 'minus', 'Returned orders are reversed against the week.'],
    ['Net sales', 66, 'sub', 'What the brand actually sold.'],
    ['Commission', -13, 'minus', 'The marketplace takes its commission.'],
    ['Marketing', -5, 'minus', 'Marketing and promotion deductions.'],
    ['Platform fees', -4, 'minus', 'Fixed platform and shipping fees.'],
    ['Payable', 44, 'total', 'What the brand is finally paid. I reconciled this chain every week.']
  ];
  const wf = $('wf'); if (!wf) return; let run = 0;
  steps.forEach(([name, v, kind, tip]) => {
    let left, width;
    if (kind === 'start' || kind === 'sub' || kind === 'total') { left = 0; width = v; run = v; }
    else { run += v; left = run; width = -v; }
    const row = document.createElement('div');
    row.className = 'wf-row ' + (kind === 'minus' ? 'minus' : kind === 'total' ? 'total' : '');
    row.innerHTML = `<span>${name}</span><span class="bar-track"><span class="bar" style="left:0;width:0"></span></span><span class="v">${v > 0 ? v : '−' + (-v)}</span>`;
    row.dataset.l = left; row.dataset.w = width;
    row.addEventListener('mouseenter', () => $('wfTip').textContent = tip);
    row.addEventListener('click', () => $('wfTip').textContent = tip);
    wf.appendChild(row);
  });
  const go = () => wf.querySelectorAll('.wf-row').forEach((r, i) => setTimeout(() => {
    const b = r.querySelector('.bar'); b.style.left = r.dataset.l + '%'; b.style.width = r.dataset.w + '%';
  }, reduce ? 0 : i * 110));
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { go(); o.disconnect(); } }, { threshold: .3 }).observe(wf);
})();

/* ---------------- 03 Two drafts ---------------- */
(function drafts() {
  const g = $('draftsG'); if (!g) return;
  const N = (id, x, y, label, person) => ({ id, x, y, label, person });
  const nodes = [
    N('order', 20, 30, 'Orders in', false),
    N('stock', 20, 130, 'Raw material', false),
    N('lines', 200, 80, 'Production lines', false),
    N('dispatch', 380, 80, 'Dispatch', false),
    N('acct', 380, 220, 'Billing + books', false),
    N('sup', 200, 200, 'Line supervisors', true),
    N('staff', 380, 150, 'Accounts staff', true),
    N('floor', 200, 260, 'Floor teams', true)
  ];
  const at = id => nodes.find(n => n.id === id);
  const W = 120, H = 34;
  const draft1 = [['order', 'lines'], ['stock', 'lines'], ['lines', 'dispatch'], ['dispatch', 'acct']];
  const draft2 = [['order', 'sup'], ['stock', 'sup'], ['sup', 'lines'], ['floor', 'sup'], ['lines', 'dispatch'], ['dispatch', 'staff'], ['staff', 'acct']];
  function edge(a, b, cls) {
    const A = at(a), B = at(b);
    const sx = B.x > A.x ? A.x + W : A.x + W / 2, sy = B.x > A.x ? A.y + H / 2 : (B.y > A.y ? A.y + H : A.y);
    const ex = B.x > A.x ? B.x - 4 : B.x + W / 2, ey = B.x > A.x ? B.y + H / 2 : (B.y > A.y ? B.y - 4 : B.y + H + 4);
    const mx = (sx + ex) / 2;
    return B.x > A.x
      ? `<path class="edge ${cls}" d="M${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}"/>`
      : `<path class="edge ${cls}" d="M${sx} ${sy} L ${ex} ${ey}"/>`;
  }
  function render(which) {
    const edges = which === 1 ? draft1 : draft2;
    const show = new Set(edges.flat());
    g.innerHTML =
      edges.map(([a, b]) => edge(a, b, at(a).person || at(b).person ? 'person' : '')).join('') +
      nodes.map(n => `<g class="node fade${n.person ? ' person' : ''}" style="opacity:${show.has(n.id) ? 1 : .12}"><rect x="${n.x}" y="${n.y}" width="${W}" height="${H}" rx="3"/><text x="${n.x + 10}" y="${n.y + 21}">${n.label}</text></g>`).join('') +
      (which === 1 ? `<text x="200" y="182" font-family="Geist Mono, monospace" font-size="11" fill="${threadColor()}">no room for the people who run it</text>` : '');
    $('draftNote').textContent = which === 1
      ? 'Version one: machines hand work straight to machines, which is not how the mill runs.'
      : 'Version two: work routes through the people who actually run the floor.';
    document.querySelectorAll('.toggle button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.draft === which));
  }
  document.querySelectorAll('.toggle button').forEach(b => b.addEventListener('click', () => render(+b.dataset.draft)));
  render(2);
})();

/* ---------------- 06 Audit ---------------- */
(function audit() {
  const items = [
    ['Structural steel beams', 'Bolted, accessible', 'SAVE'],
    ['Timber joists', 'Some water damage', 'CHECK'],
    ['Brick facade', 'Mortar condition unknown', 'CHECK'],
    ['Glass curtain wall', 'Removal cost too high', 'SKIP'],
    ['Hardwood flooring', 'Good condition, easy to lift', 'SAVE']
  ];
  const order = ['SAVE', 'CHECK', 'SKIP'];
  const el = $('audit'); if (!el) return;
  items.forEach(([name, note, v]) => {
    const row = document.createElement('div');
    row.className = 'audit-row';
    row.innerHTML = `<span>${name}<small>${note}</small></span><button class="verdict" data-v="${v}" aria-label="Verdict for ${name}">${v}</button>`;
    row.querySelector('button').addEventListener('click', ev => {
      const b = ev.currentTarget; b.dataset.v = order[(order.indexOf(b.dataset.v) + 1) % 3]; b.textContent = b.dataset.v; count();
    });
    el.appendChild(row);
  });
  function count() {
    const vs = [...el.querySelectorAll('.verdict')].map(b => b.dataset.v);
    $('auditCount').textContent = `${vs.filter(v => v === 'SAVE').length} save · ${vs.filter(v => v === 'CHECK').length} check · ${vs.filter(v => v === 'SKIP').length} skip`;
  }
  count();
})();

/* ---------------- 07 Hello in seven languages ---------------- */
(function hello() {
  const words = [['Hello', 'English'], ['வணக்கம்', 'Tamil'], ['నమస్కారం', 'Telugu'], ['नमस्ते', 'Hindi'], ['ನಮಸ್ಕಾರ', 'Kannada'], ['നമസ്കാരം', 'Malayalam'], ['Bonjour', 'French']];
  let i = 0;
  if (!$('hello')) return;
  // Scripts differ a lot in width; shrink the word until it fits its card.
  function fit() {
    const w = $('hello'), box = w.parentElement.clientWidth - 2 * parseFloat(getComputedStyle(w.parentElement).paddingLeft);
    w.style.fontSize = ''; let s = parseFloat(getComputedStyle(w).fontSize);
    w.style.whiteSpace = 'nowrap';
    while (w.scrollWidth > box && s > 24) { s -= 2; w.style.fontSize = s + 'px'; }
  }
  addEventListener('resize', fit); fit();
  if (reduce) return;
  const next = () => {
    const w = $('hello'); w.style.opacity = 0;
    setTimeout(() => { i = (i + 1) % words.length; w.textContent = words[i][0]; $('helloLang').textContent = words[i][1]; fit(); w.style.opacity = 1; }, 200);
  };
  // Each time the tennis ball is struck at a baseline, the greeting changes language.
  // Without a court on the page, fall back to the same rhythm on a timer.
  if ($('ball')) addEventListener('rally-shot', next);
  else setInterval(next, 1720);
})();

/* ---------------- A rally on the court ----------------
   Seen from above: the ball leaves one baseline, clears the net in the middle, bounces
   once deep in the other court and is met at the far baseline. Each player steps across
   to meet it, and there is a short pause on every shot. */
(function rally() {
  const ball = $('ball'); if (!ball) return;
  const shadow = $('ballShadow'), pL = $('playerL'), pR = $('playerR');
  const BASE_L = 16, BASE_R = 184, rand = (a, b) => a + Math.random() * (b - a);
  let from = { x: BASE_L, y: 50 }, to = { x: BASE_R, y: rand(30, 70) }, t = 0, pause = 0, last = 0;
  const FLIGHT = 1300, PAUSE = 420;
  function place(x, y, h) {
    ball.setAttribute('cx', x); ball.setAttribute('cy', y - h * 6); ball.setAttribute('r', 3.2 + h * 1.4);
    shadow.setAttribute('cx', x); shadow.setAttribute('cy', y + 1.5);
  }
  function step(now) {
    const dt = Math.min(50, now - (last || now)); last = now;
    if (pause > 0) { pause -= dt; }
    else {
      t = Math.min(1, t + dt / FLIGHT);
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      // one bounce at 72% of the way: a high arc over the net, then a lower one after the bounce
      const h = t < .72 ? Math.sin(Math.PI * t / .72) : .45 * Math.sin(Math.PI * (t - .72) / .28);
      place(x, y, h);
      // the receiving player drifts to where the ball is going
      const recv = to.x > 100 ? pR : pL;
      recv.setAttribute('cy', +recv.getAttribute('cy') + (to.y - +recv.getAttribute('cy')) * .06);
      if (t >= 1) { from = to; to = { x: to.x > 100 ? BASE_L : BASE_R, y: rand(28, 72) }; t = 0; pause = PAUSE; dispatchEvent(new Event('rally-shot')); }
    }
    requestAnimationFrame(step);
  }
  place(from.x, from.y, 0);
  if (!reduce) requestAnimationFrame(step);
})();

/* ---------------- 07 Storyboard: A Boy on the Bench ----------------
   Five shots drawn as simple storyboard sketches. The red line is the headphone
   cable in every frame: the same thread that runs through the rest of the site. */
(function storyboard() {
  const svg = $('frame'); if (!svg) return;
  const fig = (x, y, s = 1, red = false) =>
    `<circle class="ink" cx="${x}" cy="${y - 30 * s}" r="${6 * s}"/>` +
    `<path class="ink" d="M${x} ${y - 24 * s} L${x} ${y - 6 * s} M${x - 7 * s} ${y - 18 * s} L${x + 7 * s} ${y - 18 * s} M${x} ${y - 6 * s} L${x - 5 * s} ${y + 6 * s} M${x} ${y - 6 * s} L${x + 5 * s} ${y + 6 * s}"/>` +
    (red ? `<path class="red" d="M${x - 6 * s} ${y - 30 * s} Q${x - 9 * s} ${y - 20 * s} ${x - 3 * s} ${y - 12 * s}"/><path class="ink" d="M${x - 7 * s} ${y - 31 * s} A ${7 * s} ${7 * s} 0 0 1 ${x + 7 * s} ${y - 31 * s}"/>` : '');
  const tree = (x, y) => `<path class="ink" d="M${x} ${y} L${x} ${y - 34}"/><circle class="ink" cx="${x}" cy="${y - 50}" r="20"/>`;
  const bench = (x, y, w) => `<path class="ink" d="M${x} ${y} L${x + w} ${y} M${x} ${y - 14} L${x + w} ${y - 14} M${x + 6} ${y} L${x + 6} ${y + 14} M${x + w - 6} ${y} L${x + w - 6} ${y + 14}"/>`;

  const shots = [
    { type: 'WIDE', cap: 'A park full of couples.', draw: () =>
      `<path class="soft" d="M0 205 L480 205"/>` + tree(50, 205) + tree(150, 205) + tree(430, 205) +
      fig(95, 200) + fig(110, 200) + fig(200, 200) + fig(214, 200) + fig(270, 200) + fig(284, 200) +
      bench(330, 196, 70) + fig(365, 194, 1, true) +
      `<text x="16" y="24">EXT. PARK - DAY</text>` },
    { type: 'MEDIUM', cap: 'On a bench, a BOY sits alone, headphones on, lost in his music.', draw: () =>
      // backrest behind him, then the boy seated, then the seat in front
      `<path class="ink" d="M110 128 L370 128 M110 142 L370 142 M126 128 L126 172 M354 128 L354 172"/>` +
      `<circle class="ink" cx="240" cy="78" r="22"/>` +
      `<path class="ink" d="M216 74 A 25 25 0 0 1 264 74"/><rect class="fill" x="210" y="70" width="9" height="16" rx="3"/><rect class="fill" x="261" y="70" width="9" height="16" rx="3"/>` +
      `<path class="ink" d="M240 100 L240 168 M240 118 L214 152 L226 172 M240 118 L266 152 L254 172"/>` +
      `<path class="ink" d="M100 172 L380 172 M100 180 L380 180 M118 180 L118 236 M362 180 L362 236"/>` +
      `<path class="ink" d="M226 172 L222 236 M254 172 L258 236"/>` +
      `<path class="red" d="M214 86 Q 198 130 222 160"/>` +
      `<text x="300" y="58">&#9835;</text><text x="316" y="44">&#9835;</text>` },
    { type: 'POV', cap: 'A PHOTOGRAPHER frames him and takes the picture.', draw: () =>
      `<path class="ink" d="M40 40 L40 70 M40 40 L70 40 M440 40 L410 40 M440 40 L440 70 M40 230 L40 200 M40 230 L70 230 M440 230 L410 230 M440 230 L440 200"/>` +
      `<path class="soft" d="M40 185 L440 185"/>` + bench(205, 182, 70) + fig(240, 180, 1.2, true) +
      `<rect x="214" y="116" width="52" height="74" fill="none" stroke="${threadColor()}" stroke-width="1.4"/>` +
      `<text x="56" y="222">1/250  f2.8  ISO 200</text><text x="384" y="58">&#9679; REC</text>` },
    { type: 'INSERT', cap: 'He posts it. It goes viral.', draw: () =>
      `<rect class="ink" x="180" y="18" width="120" height="236" rx="16"/>` +
      `<rect class="ink" x="192" y="48" width="96" height="96"/>` + bench(212, 128, 56) + fig(240, 126, .8, true) +
      `<path class="redfill" d="M196 172 c -6 -8 5 -14 8 -6 c 3 -8 14 -2 8 6 l -8 8 z"/>` +
      `<text class="big" id="likes" x="218" y="186" style="font-size:20px">0</text>` +
      `<text x="240" y="208" text-anchor="middle">likes, climbing</text>` },
    { type: 'CLOSE-UPS', cap: 'Then the story turns: everything he is wearing carries its own memory, and anyone can relate to it.', draw: () =>
      `<path class="red" d="M110 135 C 170 70, 190 200, 240 135 S 330 70, 370 135"/>` +
      `<circle class="ink" cx="110" cy="135" r="52"/><circle class="ink" cx="240" cy="135" r="52"/><circle class="ink" cx="370" cy="135" r="52"/>` +
      `<path class="ink" d="M84 140 A 28 28 0 0 1 136 140"/><rect class="fill" x="78" y="136" width="10" height="20" rx="3"/><rect class="fill" x="132" y="136" width="10" height="20" rx="3"/>` +
      `<rect class="ink" x="222" y="118" width="36" height="34" rx="6"/><path class="ink" d="M230 118 L230 100 M250 118 L250 100 M230 152 L230 170 M250 152 L250 170"/>` +
      `<path class="ink" d="M336 150 L336 124 Q 350 118 360 128 L 400 140 Q 408 146 400 152 Z M336 150 L400 152"/>` +
      `<text x="80" y="212">memory 01</text><text x="210" y="212">memory 02</text><text x="340" y="212">memory 03</text>` }
  ];
  let i = 0, timer = null, likeAnim = null;
  const dots = $('shotDots');
  shots.forEach((_, k) => { const b = document.createElement('button'); b.setAttribute('aria-label', `Shot ${k + 1}`); b.addEventListener('click', () => { stop(); show(k); }); dots.appendChild(b); });
  function show(k) {
    i = (k + shots.length) % shots.length;
    const sh = shots[i];
    svg.innerHTML = sh.draw();
    $('shotType').textContent = sh.type;
    $('shotCap').textContent = sh.cap;
    $('shotNo').textContent = `Shot ${i + 1} / ${shots.length}`;
    [...dots.children].forEach((d, n) => d.setAttribute('aria-current', n === i));
    cancelAnimationFrame(likeAnim);
    const likes = $('likes');
    if (likes) {
      const t0 = performance.now(), end = 128400;
      const tick = t => { const k2 = Math.min(1, (t - t0) / 2200); const v = Math.round(end * (1 - Math.pow(1 - k2, 3))); likes.textContent = v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v; if (k2 < 1) likeAnim = requestAnimationFrame(tick); };
      reduce ? (likes.textContent = '128.4K') : (likeAnim = requestAnimationFrame(tick));
    }
  }
  function stop() { clearInterval(timer); timer = null; }
  $('shotPrev').addEventListener('click', () => { stop(); show(i - 1); });
  $('shotNext').addEventListener('click', () => { stop(); show(i + 1); });
  show(0);
  // play through slowly while the board is on screen, until someone takes over
  if (!reduce) new IntersectionObserver(es => {
    if (es[0].isIntersecting && timer === null) timer = setInterval(() => show(i + 1), 4200);
    else if (!es[0].isIntersecting) stop();
  }, { threshold: .5 }).observe(svg);
})();

/* ---------------- 01 Early work: the trash-sorting rover ----------------
   A sketch of the idea: the rover picks the next item, carries it to the bin for
   its shape, and each bin's pressure reading rises until it reads FULL. */
(function rover() {
  const svg = $('roverSim'); if (!svg) return;
  const PICK = 70, BINS = [{ x: 330, shape: 'circle' }, { x: 410, shape: 'square' }], CAP = 5, Y = 190;
  let fill = [0, 0], queue = [], carrying = null, x = PICK, target = PICK, phase = 'pick', pause = 0, raf = null, last = 0;
  const refill = () => { queue = Array.from({ length: 6 }, (_, i) => (i * 7 + fill[0] + fill[1]) % 3 === 0 ? 'square' : 'circle'); };
  refill();
  const shape = (s, cx, cy, r = 6) => s === 'circle' ? `<circle class="item" cx="${cx}" cy="${cy}" r="${r}"/>` : `<rect class="item" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`;
  function render() {
    let h = `<path class="ink" d="M10 ${Y + 18} L470 ${Y + 18}"/>`;
    // pile of items waiting
    queue.slice(0, 5).forEach((s, i) => { h += shape(s, 22 + (i % 3) * 14, Y + 8 - Math.floor(i / 3) * 14); });
    // bins with level and sensor readout
    BINS.forEach((b, i) => {
      const lvl = fill[i] / CAP, full = fill[i] >= CAP;
      h += `<rect class="lvl" x="${b.x - 26}" y="${Y + 16 - 70 * lvl}" width="52" height="${70 * lvl}"/>`;
      h += `<path class="ink" d="M${b.x - 28} ${Y - 56} L${b.x - 24} ${Y + 16} L${b.x + 24} ${Y + 16} L${b.x + 28} ${Y - 56}"/>`;
      h += shape(b.shape, b.x, Y - 70, 5);
      h += `<circle cx="${b.x + 20}" cy="${Y - 64}" r="4" fill="${full ? threadColor() : '#d6d1c4'}"/>`;
      h += `<text x="${b.x - 30}" y="${Y - 84}" class="${full ? 'full' : ''}">${full ? 'FULL' : 'pressure ' + Math.round(lvl * 100) + '%'}</text>`;
    });
    // the rover
    h += `<rect class="ink" x="${x - 26}" y="${Y - 14}" width="52" height="22" rx="4"/><circle class="fill" cx="${x - 15}" cy="${Y + 11}" r="6"/><circle class="fill" cx="${x + 15}" cy="${Y + 11}" r="6"/>`;
    h += `<path class="ink" d="M${x + 26} ${Y - 6} L${x + 34} ${Y - 6}"/>`;
    if (carrying) h += shape(carrying, x, Y - 24, 6);
    h += `<text x="16" y="88">FIRST LEGO LEAGUE</text>`;
    svg.innerHTML = h;
  }
  function step(dt) {
    if (pause > 0) { pause -= dt; return; }
    if (Math.abs(target - x) > 1) { x += Math.sign(target - x) * Math.min(Math.abs(target - x), dt * .12); return; }
    if (phase === 'pick') {
      if (!queue.length || (fill[0] >= CAP && fill[1] >= CAP)) { fill = [0, 0]; refill(); pause = 1200; return; }
      carrying = queue.shift();
      const b = BINS.findIndex(bb => bb.shape === carrying);
      if (fill[b] >= CAP) { queue.push(carrying); carrying = null; pause = 300; return; } // that bin reads full: skip it
      target = BINS[b].x; phase = 'drop'; pause = 250;
    } else {
      const b = BINS.findIndex(bb => bb.x === target);
      fill[b] = Math.min(CAP, fill[b] + 1); carrying = null; target = PICK; phase = 'pick'; pause = 350;
    }
  }
  function loop(t) { const dt = Math.min(50, t - (last || t)); last = t; step(dt); render(); raf = requestAnimationFrame(loop); }
  render();
  if (reduce) return;
  new IntersectionObserver(es => {
    if (es[0].isIntersecting && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    else if (!es[0].isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; }
  }).observe(svg);
})();

/* Belt and braces: reveal anything already on screen while scrolling, in case the
   observer is throttled (background tabs, some in-app browsers). */
addEventListener('scroll', () => {
  document.querySelectorAll('.reveal:not(.in)').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
  });
}, { passive: true });

/* Intro: let a click or key skip it, and take it out of the page once it has gone. */
(function intro() {
  const el = $('intro'); if (!el) return;
  const done = () => el.remove();
  const skip = () => { el.classList.add('skip'); setTimeout(done, 260); };
  el.addEventListener('click', skip);
  addEventListener('keydown', skip, { once: true });
  el.addEventListener('animationend', e => { if (e.target === el) done(); });
})();

/* ---------------- Guitar: each string rings as the pointer crosses it ---------------- */
(function guitar() {
  const neck = $('neck');
  if (!neck) return;
  const strings = [...neck.querySelectorAll('.string')];
  let last = -1;
  const hint = neck.parentElement.querySelector('.hint');
  if (hint && matchMedia('(hover: none)').matches) hint.textContent = 'Drag across the strings.';
  function at(e) {
    const r = neck.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * 90;
    // nearest string within half the spacing
    let best = -1, d = 7;
    strings.forEach((s, i) => { const dy = Math.abs(+s.getAttribute('y1') - y); if (dy < d) { d = dy; best = i; } });
    if (best >= 0 && best !== last) {
      const s = strings[best];
      s.classList.remove('ring'); void s.getBoundingClientRect(); s.classList.add('ring');
    }
    last = best;
  }
  neck.addEventListener('pointermove', at);
  neck.addEventListener('pointerdown', at);
  neck.addEventListener('pointerleave', () => { last = -1; });
  strings.forEach(s => s.addEventListener('animationend', () => s.classList.remove('ring')));
})();
