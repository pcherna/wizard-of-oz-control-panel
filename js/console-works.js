/* Works Console (14"): the machinery behind the curtain.
 * Witch & monkey detector, arc generators, boon selector + dispenser,
 * stock meters, split-flap oracle board, toggle switches and an alarm.
 *
 * Keys: 1–5 flip toggles · ← → turn the selector · D / Space / Enter dispense · A alarm
 */
(() => {
  'use strict';

  OZ.consoles.works = () => {
    const { $, el, sv, rand, TAU, sprite, makeCanvas, onFrame, gears, flash, shake } = OZ;
    const now = () => performance.now() / 1000;

    // ---------------------------------------------------------------- header + ticker
    const med = OZ.medallion('EMERALD CITY WORKS', '✦ BOONS & WONDERS ✦');
    buildEmerald(med);
    $('#markR').textContent = 'Works';
    OZ.ticker([
      'Emerald City Works: boons dispensed daily',
      'Brains of the finest bran, with pins and needles',
      'Hearts of silk, stuffed with sawdust',
      'Courage must be taken internally',
      'Beware of flying monkeys',
      'Pay no attention to the man behind the curtain',
    ]);

    // A step-cut emerald that glows in the centre of the medallion.
    function buildEmerald(svg) {
      const g = sv('g', { class: 'emerald' }, svg);
      sv('circle', { r: 40, fill: '#3dff8a', filter: 'url(#softGlow)', class: 'oz-glow' }, g);
      const oct = (w, h, c) => [[-w + c, -h], [w - c, -h], [w, -h + c], [w, h - c], [w - c, h], [-w + c, h], [-w, h - c], [-w, -h + c]];
      const outer = oct(33, 42, 13);
      const inner = oct(18, 25, 7);
      const shades = ['#b9ffd3', '#7dffb0', '#2bd46f', '#128a44', '#0a5a2c', '#0e6b35', '#1fa35a', '#5dff9e'];
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        const pts = [outer[i], outer[j], inner[j], inner[i]].map((p) => p.join(',')).join(' ');
        sv('polygon', { points: pts, fill: shades[i], stroke: '#03301a', 'stroke-width': 0.8 }, g);
      }
      sv('polygon', { points: inner.map((p) => p.join(',')).join(' '), fill: 'url(#emeraldTable)', stroke: '#03301a', 'stroke-width': 0.8 }, g);
      sv('path', { d: 'M-12 -22L4 -22L-14 6Z', fill: '#fff', opacity: 0.35 }, g);
      sv('path', { class: 'sparkle', d: 'M14 -30L16 -24L22 -22L16 -20L14 -14L12 -20L6 -22L12 -24Z', fill: '#fff' }, g);
    }

    // ---------------------------------------------------------------- split-flap oracle board
    const flap = (() => {
      const N = 22;
      const CH = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:&!.-'";
      const cells = Array.from({ length: N }, () => {
        const c = el('div', 'flap', $('#flaps'));
        return { span: el('span', '', c, ' '), cur: 0, target: 0, delay: 0 };
      });
      let timer = null;
      let lastEvent = -99;
      function step() {
        let moving = false;
        for (const cell of cells) {
          if (cell.delay > 0) {
            cell.delay--;
            moving = true;
          } else if (cell.cur !== cell.target) {
            cell.cur = (cell.cur + 1) % CH.length;
            cell.span.textContent = CH[cell.cur];
            cell.span.animate([{ transform: 'scaleY(0.15)' }, { transform: 'scaleY(1)' }], { duration: 32 });
            moving = true;
          }
        }
        if (!moving) {
          clearInterval(timer);
          timer = null;
        }
      }
      function show(text, isEvent = true) {
        if (isEvent) lastEvent = now();
        text = text.toUpperCase().slice(0, N);
        const full = (' '.repeat(Math.floor((N - text.length) / 2)) + text).padEnd(N);
        cells.forEach((cell, i) => {
          cell.target = Math.max(0, CH.indexOf(full[i]));
          cell.delay = Math.floor(i / 2 + rand(0, 3));
        });
        if (!timer) timer = setInterval(step, 32);
      }
      const IDLE = [
        'AWAITING SUPPLICANTS',
        'ALL QUIET IN THE WEST',
        'BALLOON FULLY INFLATED',
        'EMERALD GATES SECURED',
        'SPECTACLES ISSUED: ALL',
        'HUMBUG LEVEL NOMINAL',
      ];
      let idleIdx = 0;
      setInterval(() => {
        if (now() - lastEvent > 8) show(IDLE[idleIdx++ % IDLE.length], false);
      }, 10000);
      show('THE WORKS ARE RUNNING', false);
      return { show };
    })();

    // ---------------------------------------------------------------- witch & monkey detector
    const radarFrame = $('#radarFrame');
    for (let i = 0; i < 20; i++) {
      el('span', 'ring-rivet', radarFrame).style.transform = `rotate(${(i * 360) / 20}deg) translateY(calc(var(--radar) / -2 + 7px))`;
    }

    const radar = (() => {
      const c = makeCanvas($('#radar'), 2);
      let sweep = -Math.PI / 2;
      let alarmUntil = 0;
      const state = { on: true };

      // Flying monkeys travel in a V across the scope.
      const flock = { x: 0, y: 0, heading: 0, speed: 0 };
      function spawnFlock() {
        const a = rand(0, TAU);
        Object.assign(flock, { x: Math.cos(a) * 0.98, y: Math.sin(a) * 0.98, heading: a + Math.PI + rand(-0.5, 0.5), speed: rand(0.05, 0.08) });
      }
      const monkeys = Array.from({ length: 7 }, (_, i) => {
        const row = Math.ceil(i / 2);
        const side = i === 0 ? 0 : i % 2 ? 1 : -1;
        return { back: row * 0.055, lat: side * row * 0.05, x: 0, y: 0, seen: -99 };
      });
      // The witch always comes out of the west.
      const witch = { x: 0, y: 0, heading: 0, speed: 0, seen: -99 };
      function spawnWitch(r = 0.98) {
        const a = Math.PI + rand(-0.6, 0.6);
        Object.assign(witch, { x: Math.cos(a) * r, y: Math.sin(a) * r, heading: rand(-0.5, 0.5), speed: rand(0.07, 0.11) });
      }
      const balloon = { x: 0.2, y: -0.28, seen: -99 };
      spawnFlock();
      spawnWitch();

      const angOf = (b) => Math.atan2(b.y, b.x);
      const mod = (a) => ((a % TAU) + TAU) % TAU;

      onFrame((t, dt) => {
        const { ctx, w: W, h: H } = c;
        const R = W / 2;
        const cx = W / 2;
        const cy = H / 2;
        const alarm = t < alarmUntil;
        const fs = R / 200;

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        bg.addColorStop(0, alarm ? '#1a1608' : '#082a17');
        bg.addColorStop(1, '#010a05');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        if (!state.on) {
          ctx.fillStyle = 'rgba(120,255,170,0.25)';
          ctx.font = `700 ${Math.round(18 * fs)}px Cinzel, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('DETECTOR OFFLINE', cx, cy);
          return;
        }

        // Range rings, crosshair, bearing ticks
        ctx.strokeStyle = 'rgba(90,255,150,0.18)';
        ctx.lineWidth = 1;
        for (const k of [0.25, 0.5, 0.75]) {
          ctx.beginPath();
          ctx.arc(cx, cy, R * k, 0, TAU);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx - R, cy);
        ctx.lineTo(cx + R, cy);
        ctx.moveTo(cx, cy - R);
        ctx.lineTo(cx, cy + R);
        ctx.stroke();
        for (let d = 0; d < 360; d += 10) {
          const a = (d * Math.PI) / 180;
          const r1 = R * (d % 30 === 0 ? 0.9 : 0.94);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
          ctx.strokeStyle = 'rgba(90,255,150,0.35)';
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(150,255,190,0.55)';
        ctx.font = `700 ${Math.round(13 * fs)}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const [label, a] of [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]]) {
          ctx.fillText(label, cx + Math.cos(a) * R * 0.83, cy + Math.sin(a) * R * 0.83);
        }

        // Move the contacts
        flock.heading += Math.sin(t * 0.4) * 0.15 * dt;
        flock.x += Math.cos(flock.heading) * flock.speed * dt;
        flock.y += Math.sin(flock.heading) * flock.speed * dt;
        if (Math.hypot(flock.x, flock.y) > 1.05) spawnFlock();
        const ch = Math.cos(flock.heading);
        const sh = Math.sin(flock.heading);
        for (const m of monkeys) {
          m.x = flock.x - ch * m.back - sh * m.lat + Math.sin(t * 3 + m.back * 40) * 0.006;
          m.y = flock.y - sh * m.back + ch * m.lat + Math.cos(t * 2.6 + m.lat * 40) * 0.006;
        }
        witch.heading += Math.sin(t * 0.7) * 0.5 * dt;
        witch.x += Math.cos(witch.heading) * witch.speed * dt * (alarm ? 1.8 : 1);
        witch.y += Math.sin(witch.heading) * witch.speed * dt * (alarm ? 1.8 : 1);
        if (Math.hypot(witch.x, witch.y) > 1.05) spawnWitch();

        // Sweep, and light up contacts the beam has just crossed
        const prev = sweep;
        sweep += dt * (alarm ? 3.6 : 1.4);
        const swept = mod(sweep - prev);
        const all = [...monkeys, witch, balloon];
        for (const b of all) if (mod(angOf(b) - prev) <= swept) b.seen = t;

        const trail = 1.0;
        if (ctx.createConicGradient) {
          const cg = ctx.createConicGradient(sweep - trail, cx, cy);
          cg.addColorStop(0, 'rgba(60,255,140,0)');
          cg.addColorStop(trail / TAU, alarm ? 'rgba(255,200,90,0.32)' : 'rgba(60,255,140,0.32)');
          cg.addColorStop(trail / TAU + 0.0005, 'rgba(0,0,0,0)');
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, TAU);
          ctx.fill();
        }
        ctx.strokeStyle = alarm ? '#ffe3a0' : '#c8ffdc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
        ctx.stroke();

        // Contacts
        ctx.globalCompositeOperation = 'lighter';
        const blip = (b, color, size) => {
          const a = Math.exp(-(t - b.seen) * 0.55);
          if (a < 0.02) return 0;
          ctx.globalAlpha = a;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx + b.x * R, cy + b.y * R, size * fs, 0, TAU);
          ctx.fill();
          return a;
        };
        const label = (b, text, color, a) => {
          ctx.globalAlpha = a;
          ctx.fillStyle = color;
          ctx.font = `700 ${Math.round(11 * fs)}px Cinzel, serif`;
          ctx.textAlign = 'left';
          ctx.fillText(text, cx + b.x * R + 9 * fs, cy + b.y * R - 9 * fs);
        };
        const green = 'rgb(140,255,185)';
        monkeys.forEach((m) => blip(m, green, 3.6));
        const ma = Math.exp(-(t - monkeys[0].seen) * 0.55);
        if (ma > 0.02) label(monkeys[0], 'MONKEYS', green, ma);

        if (alarm) witch.seen = t - 0.4 - 0.4 * Math.sin(t * 12);
        const witchColor = alarm ? 'rgb(255,110,80)' : green;
        const wa = blip(witch, witchColor, alarm ? 7 : 5);
        if (wa) label(witch, alarm ? 'WICKED WITCH' : 'WITCH', witchColor, wa);

        const ba = blip(balloon, 'rgb(255,225,150)', 5);
        if (ba) label(balloon, 'OUR BALLOON', 'rgb(255,225,150)', ba);

        // Emerald City at the centre
        ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 2);
        ctx.fillStyle = '#c8ffdc';
        ctx.beginPath();
        ctx.arc(cx, cy, 4 * fs, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.font = `700 ${Math.round(10 * fs)}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('EMERALD CITY', cx, cy + 16 * fs);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const vig = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,8,3,0.8)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
      });

      return {
        state,
        alarm(seconds) {
          alarmUntil = now() + seconds;
          if (Math.hypot(witch.x, witch.y) > 0.75) spawnWitch(0.7);
        },
      };
    })();

    // ---------------------------------------------------------------- arc generators
    const glowImg = sprite(64, [[0, 'rgba(200,255,225,0.9)'], [0.4, 'rgba(80,255,150,0.3)'], [1, 'rgba(20,120,60,0)']]);
    const ladders = Array.from(document.querySelectorAll('.ladder')).map((node) => {
      const c = makeCanvas(node, 2);
      const L = { on: true, fast: false, p: Math.random(), pause: 0, pop: 0 };
      onFrame((t, dt) => {
        const { ctx, w: W, h: H } = c;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Copper electrodes in a V
        const bx = W / 2 - 7;
        const tx = W * 0.13;
        const yb = H - 6;
        const yt = 16;
        for (const s of [1, -1]) {
          const x0 = s > 0 ? bx : W - bx;
          const x1 = s > 0 ? tx : W - tx;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#6b3415';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(x0, yb);
          ctx.lineTo(x1, yt);
          ctx.stroke();
          ctx.strokeStyle = '#d98a52';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x0 - 1, yb);
          ctx.lineTo(x1 - 1, yt);
          ctx.stroke();
        }
        if (!L.on) return;

        if (L.pause > 0) {
          L.pause -= dt;
        } else {
          L.p += dt * (0.2 + L.p * 0.8) * (L.fast ? 2.2 : 1);
          if (L.p >= 1) {
            L.p = 0;
            L.pop = 0.15;
            L.pause = rand(0.05, 0.35);
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        if (L.pop > 0) {
          L.pop -= dt;
          ctx.globalAlpha = L.pop / 0.15;
          ctx.drawImage(glowImg, W / 2 - 60, yt - 50, 120, 120);
        }
        if (L.pause > 0) return;

        // The arc climbs as the hot air rises, stretching wider until it snaps.
        const y = yb - 14 - L.p * (yb - yt - 24);
        const f = (yb - y) / (yb - yt);
        const xl = bx + (tx - bx) * f;
        const xr = W - xl;
        const gap = xr - xl;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const jit = i > 0 && i < 12 ? rand(-1, 1) * (3 + gap * 0.05) : 0;
          pts.push([xl + gap * u, y - Math.sin(u * Math.PI) * gap * 0.16 * (0.5 + L.p) + jit]);
        }
        ctx.globalAlpha = 0.7 + Math.random() * 0.3;
        ctx.drawImage(glowImg, W / 2 - gap * 0.6, y - gap * 0.6, gap * 1.2, gap * 1.2);
        for (const [w, col] of [[10, 'rgba(80,255,150,0.22)'], [4, 'rgba(150,255,200,0.6)'], [1.5, '#f4fff8']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
          ctx.stroke();
        }
      });
      return L;
    });

    // ---------------------------------------------------------------- boon selector
    const BOONS = [
      { name: 'Brains', stock: 6 },
      { name: 'Heart', stock: 8 },
      { name: 'Courage', stock: 3 },
      { name: 'Home', stock: 2 },
    ];
    const ANGLES = [-72, -24, 24, 72];
    let selected = 0;

    const selector = $('#selector');
    const knobY = 30;
    const selLamps = [];
    const selLabels = [];
    ANGLES.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const lx = Math.sin(a) * 62;
      const ly = knobY - Math.cos(a) * 62;
      selLamps.push(sv('circle', { cx: lx, cy: ly, r: 6, class: 'sel-lamp' }, selector));
      const tx = Math.sin(a) * 84;
      const ty = knobY - Math.cos(a) * 84;
      const t = sv('text', { x: tx, y: ty, class: 'sel-label' }, selector);
      t.textContent = BOONS[i].name.toUpperCase();
      selLabels.push(t);
    });
    sv('circle', { cy: knobY, r: 52, fill: 'url(#brassRing)' }, selector);
    sv('circle', { cy: knobY, r: 48, fill: '#1a1004' }, selector);
    const knobWrap = sv('g', { transform: `translate(0 ${knobY})` }, selector);
    const knob = sv('g', { class: 'sel-knob' }, knobWrap);
    let fluted = '';
    for (let i = 0; i <= 96; i++) {
      const th = (i / 96) * TAU;
      const r = 44 + 1.8 * Math.cos(th * 24);
      fluted += (i ? 'L' : 'M') + (r * Math.cos(th)).toFixed(2) + ' ' + (r * Math.sin(th)).toFixed(2);
    }
    sv('path', { d: fluted + 'Z', fill: 'url(#bakelite)', stroke: '#000', 'stroke-width': 1 }, knob);
    sv('circle', { r: 31, fill: 'url(#bakeliteCap)' }, knob);
    sv('rect', { x: -3, y: -42, width: 6, height: 30, rx: 3, fill: '#f3ecd0' }, knob);
    sv('circle', { r: 8, fill: 'url(#hubGrad)' }, knob);

    const meters = BOONS.map((b) => {
      const m = el('div', 'meter', $('#meters'));
      const cells = el('div', 'cells', m);
      const list = Array.from({ length: 10 }, () => el('div', 'cell', cells));
      el('div', 'plate', m, b.name);
      return { m, list };
    });
    function renderMeters() {
      meters.forEach(({ m, list }, i) => {
        m.classList.toggle('selected', i === selected);
        list.forEach((cell, k) => cell.classList.toggle('on', k < BOONS[i].stock));
      });
    }

    function select(i) {
      selected = (i + BOONS.length) % BOONS.length;
      knob.style.transform = `rotate(${ANGLES[selected]}deg)`;
      selLamps.forEach((l, k) => l.classList.toggle('on', k === selected));
      selLabels.forEach((l, k) => l.classList.toggle('on', k === selected));
      renderMeters();
    }
    selector.addEventListener('pointerdown', (e) => {
      const r = selector.getBoundingClientRect();
      // Click the left half to turn back, the right half to turn forward.
      select(selected + ((e.clientX - r.left) / r.width < 0.5 ? -1 : 1));
      flap.show('SELECTED: ' + BOONS[selected].name);
    });
    select(0);

    // Stock slowly replenishes from the workshop.
    setInterval(() => {
      const low = BOONS.map((b, i) => [b, i]).filter(([b]) => b.stock < 10);
      if (!low.length) return;
      low[Math.floor(Math.random() * low.length)][0].stock++;
      renderMeters();
    }, 9000);

    // ---------------------------------------------------------------- dispense plunger
    const plunger = $('#plunger');
    function dispense() {
      plunger.classList.add('pressed');
      setTimeout(() => plunger.classList.remove('pressed'), 260);
      const b = BOONS[selected];
      if (b.stock <= 0) {
        flap.show('OUT OF ' + b.name);
        return;
      }
      b.stock--;
      const cell = meters[selected].list[b.stock];
      cell.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 500 });
      setTimeout(renderMeters, 500);
      flap.show('ONE ' + b.name + ' DISPENSED');
      OZ.steam.puffAt(plunger, 16, 1.4);
      flash(0.25, 400);
    }
    plunger.addEventListener('pointerdown', dispense);

    // ---------------------------------------------------------------- toggle switches
    const radarEl = $('.radar');
    const TOGGLES = [
      { name: 'Detector', on: true, set: (v) => (radar.state.on = v), msg: ['DETECTOR ONLINE', 'DETECTOR OFFLINE'] },
      { name: 'Arcs', on: true, set: (v) => ladders.forEach((l) => (l.on = v)), msg: ['ARC GENERATORS ON', 'ARC GENERATORS OFF'] },
      { name: 'Clutch', on: true, set: (v) => (gears.engaged = v), msg: ['CLUTCH ENGAGED', 'CLUTCH DISENGAGED'] },
      { name: 'Fog', on: false, set: (v) => OZ.steam.setFog(v), msg: ['FOG MACHINE ON', 'FOG CLEARED'] },
      { name: 'Curtain', on: false, set: (v) => radarEl.classList.toggle('curtained', v), msg: ['CURTAIN DRAWN', 'CURTAIN OPEN'] },
    ];
    TOGGLES.forEach((tg, i) => {
      const node = el('div', 'toggle control', $('#toggles'));
      tg.lamp = el('div', 'lamp', node);
      const plate = el('div', 'toggle-plate', node);
      el('span', 'eng top', plate, 'ON');
      el('div', 'bat', plate);
      el('div', 'nut', plate);
      el('span', 'eng bot', plate, 'OFF');
      el('div', 'plate', node, tg.name);
      tg.node = node;
      node.addEventListener('pointerdown', () => flip(i));
      OZ.keys[String(i + 1)] = () => flip(i);
      apply(tg);
    });
    function apply(tg) {
      tg.node.classList.toggle('on', tg.on);
      tg.lamp.classList.toggle('on', tg.on);
      tg.set(tg.on);
    }
    function flip(i, quiet) {
      const tg = TOGGLES[i];
      tg.on = !tg.on;
      apply(tg);
      if (!quiet) flap.show(tg.msg[tg.on ? 0 : 1]);
    }

    // ---------------------------------------------------------------- alarm
    const alarmEl = $('#alarm');
    let alarmUntil = 0;
    function alarm() {
      if (now() < alarmUntil) return;
      const DUR = 5;
      alarmUntil = now() + DUR;
      alarmEl.classList.add('ringing');
      radar.alarm(DUR);
      ladders.forEach((l) => (l.fast = true));
      flap.show('WITCH SIGHTED IN WEST');
      shake(5, 500);
      for (let k = 0; k < 4; k++) setTimeout(() => flash(0.45, 500, 'red'), k * 1100);
      setTimeout(() => {
        alarmEl.classList.remove('ringing');
        ladders.forEach((l) => (l.fast = false));
      }, DUR * 1000);
    }
    alarmEl.addEventListener('pointerdown', alarm);

    // ---------------------------------------------------------------- keys + phantom operator
    Object.assign(OZ.keys, {
      arrowright: () => select(selected + 1),
      arrowleft: () => select(selected - 1),
      d: dispense,
      ' ': dispense,
      enter: dispense,
      a: alarm,
    });

    OZ.phantom = () => {
      const r = Math.random();
      if (r < 0.5) {
        select(Math.floor(Math.random() * BOONS.length));
        flap.show('SELECTED: ' + BOONS[selected].name);
        setTimeout(dispense, 1600);
      } else if (r < 0.88) {
        // Flip a switch away from its resting position, then put it back.
        const i = Math.floor(Math.random() * TOGGLES.length);
        const tg = TOGGLES[i];
        const resting = tg.on;
        flip(i);
        setTimeout(() => tg.on !== resting && flip(i), rand(5000, 9000));
      } else {
        alarm();
      }
    };
  };
})();
