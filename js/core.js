/* The Wizard's Control Panel: shared core.
 *
 * Each screen size runs a different console. Both consoles share this core:
 * the scaled stage, header gears, medallion ring, pipes, steam, ticker, input
 * handling and the frame loop.
 *
 * URL params:
 *   ?size=16          16" laptop: Projection Console (default)
 *   ?size=14          14" laptop: Works Console
 *   ?rotate=ccw|cw|none
 *                     how the panel sits on a landscape screen. The default, ccw,
 *                     suits a laptop turned clockwise onto its side (hinge on
 *                     the left). cw suits the hinge on the right. none is upright.
 *   ?auto=0           disable the phantom operator that works the controls when idle
 *
 * F toggles fullscreen. R cycles the rotation and remembers it on this machine.
 * Each console registers its own keys.
 */
(() => {
  'use strict';

  // w/h are the portrait CSS-pixel viewport of each MacBook Pro at its default
  // "looks like" resolution (16": 1728×1117, 14": 1512×982), rotated.
  const PROFILES = {
    16: { cls: 'p16', w: 1117, h: 1728, console: 'main', mark: 'Mk. XVI' },
    14: { cls: 'p14', w: 982, h: 1512, console: 'works', mark: 'Mk. XIV' },
  };
  const params = new URLSearchParams(location.search);
  const P = PROFILES[(params.get('size') || '').replace(/\D/g, '')] || PROFILES[16];

  // Rotation: URL param, else this machine's saved choice, else hinge-on-the-left.
  const ROTATIONS = { ccw: -90, cw: 90, none: 0 };
  const ROT_KEY = 'oz-rotate';
  let rotation = (() => {
    const fromUrl = params.get('rotate');
    if (fromUrl in ROTATIONS) return fromUrl;
    try {
      const saved = localStorage.getItem(ROT_KEY);
      if (saved in ROTATIONS) return saved;
    } catch { /* storage blocked: fall through to the default */ }
    return 'ccw';
  })();
  const AUTO = params.get('auto') !== '0';

  // ---------------------------------------------------------------- helpers
  const $ = (sel) => document.querySelector(sel);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const stage = $('#stage');
  const rig = $('#rig');

  // ---------------------------------------------------------------- canvases
  const canvases = [];
  function makeCanvas(node, maxK) {
    const c = { node, ctx: node.getContext('2d'), w: 1, h: 1 };
    c.resize = (k) => {
      k = Math.min(k, maxK);
      c.w = node.clientWidth;
      c.h = node.clientHeight;
      node.width = Math.max(1, Math.round(c.w * k));
      node.height = Math.max(1, Math.round(c.h * k));
      c.ctx.setTransform(node.width / c.w, 0, 0, node.height / c.h, 0, 0);
    };
    canvases.push(c);
    return c;
  }
  function sprite(size, stops) {
    const s = document.createElement('canvas');
    s.width = s.height = size;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) grd.addColorStop(o, col);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return s;
  }

  // Rotate the stage, then scale it to fill the window. When the window is
  // proportionally taller than the design, the stage grows taller (never
  // narrower) so it fills edge to edge. The extra height spreads into the gaps
  // between rows. The stretch is capped so a very tall window still letterboxes.
  function fit() {
    const rot = ROTATIONS[rotation];
    const aw = rot ? innerHeight : innerWidth;
    const ah = rot ? innerWidth : innerHeight;
    const h = Math.round(clamp((P.w * ah) / aw, P.h, P.h * 1.25));
    stage.style.height = h + 'px';
    const scale = Math.min(aw / P.w, ah / h);
    stage.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;
    const k = scale * (devicePixelRatio || 1);
    canvases.forEach((c) => c.resize(k));
  }

  // ---------------------------------------------------------------- gears
  // All gears share one drive phase so meshed gears turn at the right ratio.
  const gearList = [];
  const gears = { phase: 0, speed: 1, boostUntil: 0, engaged: true };
  gears.boost = (seconds) => { gears.boostUntil = performance.now() / 1000 + seconds; };

  function circlePath(cx, cy, r) {
    return `M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`;
  }
  function gearPathD(teeth, m) {
    const rp = (m * teeth) / 2;
    const ro = rp + m;
    const rr = rp - 1.25 * m;
    const step = TAU / teeth;
    const pts = [];
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      for (const [r, f] of [[rr, -0.5], [rr, -0.27], [ro, -0.13], [ro, 0.13], [rr, 0.27]]) {
        pts.push(`${(r * Math.cos(a + f * step)).toFixed(2)} ${(r * Math.sin(a + f * step)).toFixed(2)}`);
      }
    }
    let d = 'M' + pts.join('L') + 'Z';
    if (teeth >= 12) {
      const n = teeth >= 24 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        d += circlePath(rr * 0.56 * Math.cos(a), rr * 0.56 * Math.sin(a), rr * 0.21);
      }
    }
    return d;
  }

  // specs: [{teeth, x, y} | {teeth, parent: index, angle: degrees}]
  function gearCluster(svg, specs, m, fill, mirrorW) {
    const placed = [];
    for (const spec of specs) {
      const g = { ...spec };
      if (mirrorW != null) {
        if (g.parent == null) g.x = mirrorW - g.x;
        else g.angle = 180 - g.angle;
      }
      const rp = (m * g.teeth) / 2;
      let x, y, off, dir;
      if (g.parent == null) {
        x = g.x;
        y = g.y;
        off = 0;
        dir = mirrorW != null ? -1 : 1;
      } else {
        const p = placed[g.parent];
        const th = (g.angle * Math.PI) / 180;
        x = p.x + (p.rp + rp) * Math.cos(th);
        y = p.y + (p.rp + rp) * Math.sin(th);
        dir = -p.dir;
        // Phase the child so a gap faces the parent's tooth at the contact point.
        const stepA = TAU / p.teeth;
        const stepB = TAU / g.teeth;
        const phaseA = ((((th - p.off) / stepA) % 1) + 1) % 1;
        off = th + Math.PI - stepB * (0.5 - phaseA);
      }
      const grp = sv('g', {}, svg);
      const paint = `url(#${g.fill || fill})`;
      sv('path', { d: gearPathD(g.teeth, m), fill: paint, 'fill-rule': 'evenodd', stroke: '#2a1a05', 'stroke-width': m * 0.25 }, grp);
      const rr = rp - 1.25 * m;
      sv('circle', { r: rr * 0.27, fill: paint, stroke: '#2a1a05', 'stroke-width': m * 0.25 }, grp);
      sv('circle', { r: rr * 0.09, fill: '#1a1004' }, grp);
      const rec = { x, y, rp, teeth: g.teeth, off, dir, grp };
      placed.push(rec);
      gearList.push(rec);
    }
  }

  function updateGears(dt, t) {
    const target = !gears.engaged ? 0 : t < gears.boostUntil ? 7 : 1;
    gears.speed += (target - gears.speed) * Math.min(1, dt * 1.6);
    gears.phase += dt * 0.45 * gears.speed;
    for (const g of gearList) {
      const deg = ((g.off + (g.dir * gears.phase * 24) / g.teeth) * 180) / Math.PI;
      g.grp.setAttribute('transform', `translate(${g.x.toFixed(2)} ${g.y.toFixed(2)}) rotate(${deg.toFixed(2)})`);
    }
  }

  function buildGears() {
    const header = [
      { teeth: 36, x: 118, y: 104 },
      { teeth: 18, parent: 0, angle: -22 },
      { teeth: 14, parent: 0, angle: 148, fill: 'gearCopper' },
      { teeth: 12, parent: 1, angle: 62 },
      { teeth: 10, parent: 0, angle: 245, fill: 'gearCopper' },
    ];
    gearCluster($('#gearsL'), header, 3.2, 'gearFill');
    gearCluster($('#gearsR'), header, 3.2, 'gearFill', 300);

    // Big, dim gears behind the panels, visible in the gaps.
    const bg = $('#bgGears');
    bg.setAttribute('viewBox', `0 0 ${P.w} ${P.h}`);
    const u = P.w / 1117;
    gearCluster(bg, [
      { teeth: 40, x: P.w * 0.5, y: P.h * 0.33 },
      { teeth: 22, parent: 0, angle: 200 },
      { teeth: 30, parent: 0, angle: -18 },
      { teeth: 16, parent: 2, angle: 75 },
      { teeth: 26, parent: 1, angle: 120 },
    ], 9 * u, 'gearDark');
    gearCluster(bg, [
      { teeth: 34, x: P.w * 0.82, y: P.h * 0.74 },
      { teeth: 18, parent: 0, angle: 200 },
      { teeth: 24, parent: 1, angle: 150 },
    ], 8 * u, 'gearDark');
  }

  // Brass medallion ring with curved text. The console draws the centre.
  function medallion(top, bottom) {
    const m = $('#medallion');
    const defs = sv('defs', {}, m);
    sv('path', { id: 'arcTop', d: 'M -74 0 A 74 74 0 0 1 74 0' }, defs);
    sv('path', { id: 'arcBot', d: 'M -83 0 A 83 83 0 0 0 83 0' }, defs);
    sv('circle', { r: 99, fill: 'url(#brassRing)' }, m);
    sv('circle', { r: 92, fill: 'url(#brassRingRev)' }, m);
    sv('circle', { r: 88, fill: '#0a1d12', stroke: '#2a1a05', 'stroke-width': 1.5 }, m);
    for (const [href, text] of [['#arcTop', top], ['#arcBot', bottom]]) {
      const tp = sv('textPath', { href, startOffset: '50%' }, sv('text', { class: 'medal-text' }, m));
      tp.textContent = text;
    }
    sv('circle', { r: 64, fill: 'url(#brassRing)' }, m);
    sv('circle', { r: 59, fill: 'url(#ozGlass)' }, m);
    return m;
  }

  // ---------------------------------------------------------------- pipes
  function buildPipes() {
    document.querySelectorAll('.pipe').forEach((pipe) => {
      for (let y = 0.06; y < 1; y += 0.12) el('div', 'flange', pipe).style.top = (y * 100).toFixed(1) + '%';
      for (const y of [0.24, 0.53, 0.83]) el('div', 'valve', pipe).style.top = y * 100 + '%';
    });
  }

  // ---------------------------------------------------------------- steam + fog
  function stagePos(node) {
    let x = node.offsetWidth / 2;
    let y = node.offsetHeight / 2;
    for (let n = node; n && n !== stage; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return [x, y];
  }

  function makeSteam(node) {
    const c = makeCanvas(node, 1);
    const puffImg = sprite(96, [[0, 'rgba(225,255,235,0.55)'], [0.5, 'rgba(170,230,195,0.18)'], [1, 'rgba(150,210,180,0)']]);
    const emitters = [];
    let parts = [];
    let fog = false;

    function addEmitter(n, vx, vy, scale, minGap, maxGap) {
      const [x, y] = stagePos(n);
      emitters.push({ node: n, x, y, vx, vy, scale, minGap, maxGap, next: rand(0.5, maxGap) });
    }
    function emit(x, y, vx, vy, scale, count, power) {
      for (let i = 0; i < count; i++) {
        const l = rand(1.4, 2.8);
        parts.push({
          x: x + rand(-4, 4),
          y: y + rand(-4, 4),
          vx: (vx + rand(-25, 25)) * power,
          vy: (vy + rand(-25, 15)) * power,
          s: rand(10, 20) * scale,
          grow: rand(30, 55) * scale,
          lift: 22,
          alpha: 0.6,
          life: l,
          max: l,
        });
      }
    }
    // Stage fog: big, faint, slow banks that hang near the bottom of the panel.
    function emitFog() {
      const l = rand(5, 8);
      parts.push({ x: rand(-40, c.w + 40), y: c.h + 30, vx: rand(-12, 12), vy: rand(-28, -14), s: rand(70, 110), grow: rand(8, 16), lift: 0, alpha: 0.42, life: l, max: l });
    }
    const puff = (e, count, power) => emit(e.x, e.y, e.vx, e.vy, e.scale, count, power);

    return {
      init() {
        emitters.length = 0;
        document.querySelectorAll('.pipe.left .valve').forEach((v) => addEmitter(v, 110, -40, 1, 3, 9));
        document.querySelectorAll('.pipe.right .valve').forEach((v) => addEmitter(v, -110, -40, 1, 3, 9));
        document.querySelectorAll('.steam-up').forEach((v) => addEmitter(v, 0, -55, 0.55, 2, 7));
      },
      burst() {
        emitters.forEach((e, i) => setTimeout(() => {
          puff(e, e.scale < 1 ? 8 : 26, 1.8);
          if (e.node.classList.contains('valve')) {
            e.node.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(240deg)' }], { duration: 900, easing: 'ease-out' });
          }
        }, i * 40));
      },
      puffAt(n, count = 14, power = 1.3) {
        const [x, y] = stagePos(n);
        emit(x, y, 0, -70, 0.8, count, power);
      },
      setFog(on) { fog = on; },
      update(dt) {
        for (const e of emitters) {
          e.next -= dt;
          if (e.next <= 0) {
            puff(e, Math.round(rand(4, 10)), 1);
            e.next = rand(e.minGap, e.maxGap);
          }
        }
        // Fog rolls up from the floor of the panel while switched on.
        if (fog && Math.random() < dt * 9) emitFog();

        const { ctx, w: W, h: H } = c;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'screen';
        parts = parts.filter((p) => (p.life -= dt) > 0);
        for (const p of parts) {
          p.vy -= p.lift * dt;
          p.vx *= 1 - dt * 0.9;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.s += p.grow * dt;
          const k = p.life / p.max;
          // Fade in over the first fifth of life, fade out over the rest.
          ctx.globalAlpha = Math.min(1, (1 - k) * 5, k * 1.4) * p.alpha;
          ctx.drawImage(puffImg, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
        }
        ctx.globalAlpha = 1;
      },
    };
  }

  // ---------------------------------------------------------------- effects
  const flashEl = $('#flash');
  function flash(strength, ms, tint) {
    flashEl.classList.toggle('red', tint === 'red');
    flashEl.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }
  function shake(px = 9, ms = 650) {
    const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      transform: `translate(${rand(-px, px) * (1 - i / 8)}px, ${rand(-px, px) * 0.8 * (1 - i / 8)}px)`,
    }));
    rig.animate(frames.concat({ transform: 'none' }), { duration: ms, easing: 'ease-out' });
  }
  function ticker(messages) {
    const msg = messages.map((s) => s.toUpperCase()).join('   ✦   ') + '   ✦   ';
    const tk = $('#ticker');
    tk.textContent = msg + msg;
    tk.style.setProperty('--ticker-dur', Math.round(msg.length * 0.32) + 's');
  }

  // ---------------------------------------------------------------- frame loop
  const frameFns = [];
  const onFrame = (fn) => frameFns.push(fn);

  // ---------------------------------------------------------------- export
  const OZ = (window.OZ = {
    consoles: {},
    P, AUTO, TAU, $, rand, clamp, el, sv, sprite, makeCanvas,
    stage, rig, gears, medallion, flash, shake, ticker, onFrame,
    keys: {},          // console key handlers, keyed by KeyboardEvent.key
    phantom: null,     // console's idle-time action
  });

  // ---------------------------------------------------------------- input
  let lastInput = performance.now();
  let idleTimer;
  function markActive() {
    lastInput = performance.now();
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  addEventListener('pointermove', markActive);
  addEventListener('pointerdown', markActive);
  addEventListener('keydown', (e) => {
    markActive();
    if (e.repeat) return;
    if (e.key === 'f' || e.key === 'F') return toggleFullscreen();
    if (e.key === 'r' || e.key === 'R') return cycleRotation();
    const fn = OZ.keys[e.key] || OZ.keys[e.key.toLowerCase()];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });
  addEventListener('dblclick', (e) => {
    if (!e.target.closest('.control') && !document.fullscreenElement) toggleFullscreen();
  });

  // Re-fit, then re-read steam emitter positions, which move when the stage height changes.
  function refit() {
    fit();
    if (OZ.steam) OZ.steam.init();
  }
  function cycleRotation() {
    const order = Object.keys(ROTATIONS);
    rotation = order[(order.indexOf(rotation) + 1) % order.length];
    try { localStorage.setItem(ROT_KEY, rotation); } catch { /* not saved; still applies now */ }
    refit();
  }

  // ---------------------------------------------------------------- boot
  OZ.boot = () => {
    stage.classList.add(P.cls);
    stage.style.width = P.w + 'px';
    $('#mark').textContent = P.mark;

    const tpl = document.getElementById('console-' + P.console);
    rig.insertBefore(tpl.content.cloneNode(true), rig.querySelector('footer'));

    buildGears();
    buildPipes();
    OZ.steam = makeSteam($('#steam'));
    OZ.consoles[P.console]();

    // Phantom operator: works a control when nobody has touched anything for a while.
    if (AUTO) {
      (function autopilot() {
        if (OZ.phantom && performance.now() - lastInput > 12000) OZ.phantom();
        setTimeout(autopilot, rand(6000, 13000));
      })();
    }

    addEventListener('resize', refit);
    fit();
    // Steam emitters read element positions, so wait until fonts settle the layout.
    document.fonts.ready.then(() => OZ.steam.init());

    let last = performance.now();
    requestAnimationFrame(function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      updateGears(dt, t);
      for (const fn of frameFns) fn(t, dt);
      OZ.steam.update(dt);
      requestAnimationFrame(frame);
    });
  };
})();
