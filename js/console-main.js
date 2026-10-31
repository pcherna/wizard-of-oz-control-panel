/* Projection Console (16"): the Wizard's showmanship.
 * Crystal ball, gauges, oscilloscope, digit counters and the lever bank.
 * Keys: 1–6 pull levers.
 */
(() => {
  'use strict';

  OZ.consoles.main = () => {
    const { $, el, sv, rand, clamp, TAU, sprite, makeCanvas, onFrame, gears, flash, shake } = OZ;
    const C = { gauges: 4, tubes: 3, vtubes: 4, digits: 7, lamps: 13 };

    // ---------------------------------------------------------------- header + ticker
    const med = OZ.medallion('THE GREAT AND POWERFUL', '✦ WIZARD OF OZ ✦');
    sv('text', { class: 'oz oz-glow', y: 3, filter: 'url(#softGlow)' }, med).textContent = 'OZ';
    sv('text', { class: 'oz', y: 3 }, med).textContent = 'OZ';
    sv('path', { d: 'M -50 -18 A 56 56 0 0 1 18 -54 A 62 62 0 0 0 -50 -18 Z', fill: 'url(#glare)', opacity: 0.7 }, med);
    $('#markR').textContent = 'Projection';
    OZ.ticker([
      'Pay no attention to the man behind the curtain',
      'The Great and Powerful Oz has spoken',
      'All visitors must wear green spectacles',
      'Thunder reserves at full capacity',
      'Humbug levels nominal',
      'Emerald City welcomes you',
    ]);

    // ---------------------------------------------------------------- tube banks
    const liquids = [];
    function buildTubeBank(bank, side) {
      const tubes = el('div', 'tubes', bank);
      const heights = [0.86, 1, 0.92].slice(0, C.tubes);
      if (side === 'R') heights.reverse();
      heights.forEach((k) => {
        const t = el('div', 'tube', tubes);
        t.style.setProperty('--k', k);
        el('div', 'cap top steam-up', t);
        const glass = el('div', 'glass', t);
        el('div', 'cap', t);
        const liq = el('div', 'liquid', glass);
        for (let i = 0; i < 9; i++) {
          const b = el('span', 'bubble', liq);
          b.style.setProperty('--s', rand(4, 11) + 'px');
          b.style.setProperty('--x', rand(5, 75) + '%');
          b.style.setProperty('--d', rand(2.2, 4.5) + 's');
          b.style.setProperty('--delay', -rand(0, 4.5) + 's');
        }
        liquids.push({ node: liq, base: rand(0.5, 0.75), f: rand(0.15, 0.4), ph: rand(0, TAU), surge: 0 });
      });
      const rack = el('div', 'vrack', bank);
      for (let i = 0; i < C.vtubes; i++) {
        const v = el('div', 'vtube', rack);
        const bulb = el('div', 'bulb', v);
        el('div', 'plate-el', bulb);
        const fil = el('div', 'filament', bulb);
        fil.style.setProperty('--d', rand(1.6, 4.2) + 's');
        fil.style.setProperty('--delay', -rand(0, 4) + 's');
        el('div', 'vbase', v);
      }
    }
    buildTubeBank($('#bankL'), 'L');
    buildTubeBank($('#bankR'), 'R');
    onFrame((t, dt) => {
      for (const L of liquids) {
        L.surge = Math.max(0, L.surge - dt * 0.35);
        const lvl = L.base + 0.08 * Math.sin(t * L.f * TAU + L.ph) + 0.03 * Math.sin(t * 2.3 + L.ph) + L.surge * 0.3;
        L.node.style.height = (clamp(lvl, 0.15, 0.97) * 100).toFixed(1) + '%';
      }
    });

    // ---------------------------------------------------------------- crystal ball
    const frame = $('#orbFrame');
    for (let i = 0; i < 20; i++) {
      el('span', 'ring-rivet', frame).style.transform = `rotate(${(i * 360) / 20}deg) translateY(calc(var(--orb) / -2 + 7px))`;
    }

    const orb = (() => {
      const c = makeCanvas($('#orb'), 2);
      const bright = sprite(128, [[0, 'rgba(200,255,220,0.9)'], [0.4, 'rgba(90,235,150,0.35)'], [1, 'rgba(20,120,60,0)']]);
      const deep = sprite(128, [[0, 'rgba(70,210,120,0.75)'], [0.5, 'rgba(20,130,70,0.25)'], [1, 'rgba(10,80,40,0)']]);
      const ps = Array.from({ length: 70 }, () => ({
        a: rand(0, TAU),
        r: Math.sqrt(Math.random()) * 0.8,
        va: rand(0.12, 0.45) * (Math.random() < 0.8 ? 1 : -1),
        s: rand(0.22, 0.55),
        al: rand(0.12, 0.4),
        f: rand(0.3, 1.2),
        ph: rand(0, TAU),
        img: Math.random() < 0.35 ? bright : deep,
      }));
      let mist = 1;
      let mistTarget = 1;
      let flare = 0;
      let speak = 0;
      const SPEAK = 3.6;
      let bolts = [];
      let nextBolt = rand(2, 5);

      function jag(a, b, disp, depth, out) {
        if (depth === 0) return out.push(b);
        const mx = (a[0] + b[0]) / 2 + rand(-disp, disp);
        const my = (a[1] + b[1]) / 2 + rand(-disp, disp);
        jag(a, [mx, my], disp / 2, depth - 1, out);
        jag([mx, my], b, disp / 2, depth - 1, out);
      }
      function addBolt() {
        const a = rand(0, TAU);
        const a1 = a + rand(-0.9, 0.9);
        const r1 = rand(0.04, 0.3);
        const start = [0.98 * Math.cos(a), 0.98 * Math.sin(a)];
        const pts = [start];
        jag(start, [r1 * Math.cos(a1), r1 * Math.sin(a1)], 0.22, 6, pts);
        const life = rand(0.18, 0.35);
        bolts.push({ pts, life, max: life });
      }

      onFrame((t, dt) => {
        const { ctx, w: W, h: H } = c;
        const R = W / 2;
        const cx = W / 2;
        const cy = H / 2;
        mist += (mistTarget - mist) * Math.min(1, dt * 1.5);
        mistTarget += (1 - mistTarget) * Math.min(1, dt * 0.4);
        flare = Math.max(0, flare - dt * 0.45);
        speak = Math.max(0, speak - dt);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const bg = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy, R);
        bg.addColorStop(0, `rgb(${30 + flare * 90},${105 + flare * 110},${65 + flare * 60})`);
        bg.addColorStop(0.6, '#082a17');
        bg.addColorStop(1, '#010804');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'lighter';
        const spin = 1 + flare * 2 + (mist - 1) * 0.8;
        for (const p of ps) {
          p.a += p.va * dt * spin;
          const rr = p.r * R * (0.9 + 0.12 * Math.sin(t * p.f + p.ph));
          const x = cx + Math.cos(p.a) * rr;
          const y = cy + Math.sin(p.a) * rr * 0.78 + Math.sin(t * 0.5 + p.ph) * R * 0.05;
          const size = p.s * R * (1 + 0.25 * Math.sin(t * p.f * 1.3 + p.ph));
          ctx.globalAlpha = Math.min(1, p.al * mist * (0.85 + flare));
          ctx.drawImage(p.img, x - size, y - size, size * 2, size * 2);
        }

        // Breathing core
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
        const coreR = R * (0.3 + 0.06 * pulse + 0.35 * flare);
        ctx.globalAlpha = 0.45 + 0.2 * pulse + 0.4 * flare;
        ctx.drawImage(bright, cx - coreR, cy - coreR, coreR * 2, coreR * 2);

        // The great and powerful speaks
        if (speak > 0) {
          const k = 1 - speak / SPEAK;
          ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(0.9 + 0.15 * k, 0.9 + 0.15 * k);
          ctx.font = `900 ${Math.round(R * 0.62)}px "Cinzel Decorative", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(120,255,170,0.35)';
          for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) ctx.fillText('OZ', dx + Math.sin(t * 13) * 2, dy);
          ctx.fillStyle = 'rgba(220,255,232,0.9)';
          ctx.fillText('OZ', 0, 0);
          ctx.restore();
        }

        // Lightning
        nextBolt -= dt;
        if (nextBolt <= 0) {
          addBolt();
          nextBolt = rand(2.5, 8);
        }
        bolts = bolts.filter((b) => (b.life -= dt) > 0);
        for (const b of bolts) {
          ctx.beginPath();
          b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * R, cy + y * R) : ctx.moveTo(cx + x * R, cy + y * R)));
          ctx.globalAlpha = Math.random() < 0.25 ? 0.3 : b.life / b.max;
          ctx.strokeStyle = 'rgba(90,255,160,0.45)';
          ctx.lineWidth = R * 0.035;
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.strokeStyle = '#eafff2';
          ctx.lineWidth = R * 0.008;
          ctx.stroke();
        }

        // Spherical shading
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const vig = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,8,3,0.85)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
      });

      return {
        storm(n) { for (let i = 0; i < n; i++) setTimeout(addBolt, i * rand(60, 160)); },
        thicken() { mistTarget = 2.4; },
        flare() { flare = 1; },
        speak() { speak = SPEAK; },
      };
    })();

    // ---------------------------------------------------------------- gauges
    const GAUGE_SPECS = [
      { key: 'thunder', name: 'Thunder Pressure', unit: 'KILO-RUMBLES', max: 10, base: 0.38, range: 0.3 },
      { key: 'smoke', name: 'Smoke Density', unit: 'PUFFS PER MIN', max: 100, base: 0.5, range: 0.35 },
      { key: 'flame', name: 'Flame Heat', unit: 'DEGREES OZ', max: 1000, base: 0.42, range: 0.25 },
      { key: 'humbug', name: 'Humbug Index', unit: 'PER CENT', max: 100, base: 0.72, range: 0.35 },
    ];
    const gauges = {};
    const ang = (v) => ((-135 + 270 * v) * Math.PI) / 180;
    const polar = (r, a) => [r * Math.sin(a), -r * Math.cos(a)];
    function arcD(r, v0, v1) {
      const [x0, y0] = polar(r, ang(v0));
      const [x1, y1] = polar(r, ang(v1));
      return `M${x0} ${y0}A${r} ${r} 0 ${(v1 - v0) * 270 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
    }

    function buildGauge(parent, spec) {
      const wrap = el('div', 'gauge', parent);
      const svg = sv('svg', { viewBox: '-100 -100 200 200' }, wrap);
      sv('circle', { r: 99, fill: 'url(#brassRing)' }, svg);
      sv('circle', { r: 91, fill: 'url(#brassRingRev)' }, svg);
      sv('circle', { r: 85, fill: '#1c1206' }, svg);
      sv('circle', { r: 83, fill: 'url(#gaugeFace)' }, svg);
      sv('path', { d: arcD(71, 0.3, 0.62), stroke: '#2f8f55', 'stroke-width': 6, fill: 'none', opacity: 0.8 }, svg);
      sv('path', { d: arcD(71, 0.82, 1), stroke: '#a3201a', 'stroke-width': 6, fill: 'none', opacity: 0.9 }, svg);
      for (let i = 0; i <= 50; i++) {
        const a = ang(i / 50);
        const major = i % 10 === 0;
        const mid = i % 5 === 0;
        const [x1, y1] = polar(79, a);
        const [x2, y2] = polar(major ? 65 : mid ? 69 : 74, a);
        sv('line', { x1, y1, x2, y2, stroke: '#1d1408', 'stroke-width': major ? 2.4 : mid ? 1.5 : 0.8 }, svg);
        if (major) {
          const [tx, ty] = polar(54, a);
          sv('text', { x: tx, y: ty, class: 'g-num' }, svg).textContent = String((spec.max * i) / 50);
        }
      }
      sv('text', { y: -27, class: 'g-maker' }, svg).textContent = 'OZ & CO.';
      sv('text', { y: 25, class: 'g-unit' }, svg).textContent = spec.unit;
      const needle = sv('g', {}, svg);
      sv('path', { d: 'M-2.6 16L-0.8 -77L0.8 -77L2.6 16Z', fill: '#2a0d08', transform: 'translate(2.5 3.5)', opacity: 0.25 }, needle);
      sv('path', { d: 'M-2.6 16L-0.8 -77L0.8 -77L2.6 16Z', fill: '#2a0d08' }, needle);
      sv('circle', { cy: 12, r: 5.5, fill: '#2a0d08' }, needle);
      sv('circle', { r: 9, fill: 'url(#hubGrad)', stroke: '#3b2708', 'stroke-width': 0.8 }, svg);
      sv('circle', { r: 2.4, fill: '#2a1a04' }, svg);
      sv('path', { d: 'M-72 -18A76 76 0 0 1 18 -74A92 92 0 0 0 -72 -18Z', fill: 'url(#glare)' }, svg);
      for (const deg of [45, 135, 225, 315]) {
        const [x, y] = polar(95, (deg * Math.PI) / 180);
        sv('circle', { cx: x, cy: y, r: 3, fill: 'url(#hubGrad)', stroke: '#3b2708', 'stroke-width': 0.6 }, svg);
        sv('line', { x1: x - 2, y1: y, x2: x + 2, y2: y, stroke: '#3b2708', 'stroke-width': 0.9, transform: `rotate(${deg * 1.7} ${x} ${y})` }, svg);
      }
      el('div', 'plate', wrap, spec.name);

      const g = { v: spec.base, vel: 0, target: spec.base, next: 0, hold: 0, ph: rand(0, TAU) };
      g.spike = (amt) => {
        g.target = clamp(g.target + amt, 0, 1.02);
        g.vel += amt * 4;
        g.hold = 1.6;
      };
      onFrame((t, dt) => {
        g.hold -= dt;
        g.next -= dt;
        if (g.next <= 0 && g.hold <= 0) {
          g.target = clamp(spec.base + (Math.random() - 0.5) * spec.range * 2, 0.02, 0.98);
          g.next = rand(0.6, 2.8);
        }
        const acc = 20 * (g.target - g.v) - 4.2 * g.vel;
        g.vel += acc * dt;
        g.v += g.vel * dt;
        const shown = clamp(g.v + Math.sin(t * 23 + g.ph) * 0.004, -0.015, 1.03);
        needle.setAttribute('transform', `rotate(${(-135 + 270 * shown).toFixed(2)})`);
      });
      gauges[spec.key] = g;
    }
    GAUGE_SPECS.slice(0, C.gauges).forEach((s) => buildGauge($('#gauges'), s));
    const spike = (key, amt) => gauges[key] && gauges[key].spike(amt);

    // ---------------------------------------------------------------- oscilloscope
    const scope = (() => {
      const c = makeCanvas($('#scope'), 2);
      let boost = 0;
      onFrame((t, dt) => {
        const { ctx, w: W, h: H } = c;
        boost = Math.max(0, boost - dt * 0.3);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(1,10,5,0.32)';
        ctx.fillRect(0, 0, W, H);
        const f1 = 2 + 1.2 * Math.sin(t * 0.11);
        const f2 = 5 + 2 * Math.sin(t * 0.07 + 1);
        const amp = (0.26 + 0.06 * Math.sin(t * 0.5)) * (1 + boost * 0.5);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const u = x / W;
          let y = Math.sin(u * TAU * f1 + t * 2.2) * 0.65 + Math.sin(u * TAU * f2 - t * 3.1) * 0.3 * Math.sin(t * 0.3);
          if (boost > 0) y += boost * (Math.sin(u * 80 + t * 40) * 0.6 * Math.sin(u * 6 + t * 5) + (Math.random() - 0.5) * 0.5);
          const py = clamp(H / 2 - y * amp * H, 2, H - 2);
          if (x) ctx.lineTo(x, py);
          else ctx.moveTo(x, py);
        }
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(60,255,140,0.28)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = '#b6ffd0';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });
      return { boost() { boost = 1; } };
    })();

    // ---------------------------------------------------------------- digit counters
    function makeReadout(parent, label, digits, start) {
      const r = el('div', 'readout', parent);
      el('div', 'plate', r, label);
      const row = el('div', 'nixies', r);
      const cells = Array.from({ length: digits }, () => {
        const n = el('div', 'nixie', row);
        el('span', 'ghost', n, '8');
        return el('span', 'digit', n, '0');
      });
      let val = start;
      const cap = 10 ** digits;
      function render() {
        const str = String(Math.floor(val) % cap).padStart(digits, '0');
        cells.forEach((d, i) => {
          if (d.textContent !== str[i]) {
            d.textContent = str[i];
            const tube = d.parentNode;
            tube.classList.remove('flick');
            void tube.offsetWidth;
            tube.classList.add('flick');
          }
        });
      }
      render();
      return { add(n) { val += n; render(); } };
    }
    const nix = $('#nixies');
    const vault = makeReadout(nix, 'Emeralds in Vault', C.digits, Math.floor(rand(0.21, 0.24) * 10 ** C.digits));
    const awed = makeReadout(nix, 'Supplicants Awed', C.digits, Math.floor(rand(3000, 6000)));
    setInterval(() => vault.add(Math.floor(rand(1, 40))), 420);
    setInterval(() => Math.random() < 0.5 && awed.add(1), 900);

    // ---------------------------------------------------------------- lamps
    const lamps = (() => {
      const n = C.lamps;
      const parent = $('#lamps');
      const list = Array.from({ length: n }, (_, i) => el('div', 'lamp' + (i === 0 || i === n - 1 ? ' amber' : ''), parent));
      const MODES = ['chase', 'bounce', 'twinkle', 'alternate', 'fill'];
      let mode = 0;
      let tick = 0;
      let blaze = 0;
      setInterval(() => {
        tick++;
        if (tick % 60 === 0) mode = (mode + 1) % MODES.length;
        const bounceLen = 2 * n - 2;
        list.forEach((l, i) => {
          let on;
          if (blaze > 0) on = blaze % 2 === 0;
          else switch (MODES[mode]) {
            case 'chase': on = (((i - tick) % 4) + 4) % 4 === 0; break;
            case 'bounce': { const p = tick % bounceLen; on = i === (p < n ? p : bounceLen - p); break; }
            case 'twinkle': on = Math.random() < 0.35; break;
            case 'alternate': on = (i + Math.floor(tick / 4)) % 2 === 0; break;
            default: on = i < tick % (n + 5);
          }
          l.classList.toggle('on', on);
        });
        if (blaze > 0) blaze--;
      }, 130);
      return { blaze() { blaze = 10; } };
    })();

    // ---------------------------------------------------------------- levers
    const FX = [
      { name: 'Thunder', run() {
        flash(0.9, 700);
        setTimeout(() => flash(0.5, 500), 180);
        shake();
        spike('thunder', 0.6);
        Object.values(gauges).forEach((g) => g.spike(0.12));
        lamps.blaze();
      } },
      { name: 'Lightning', run() {
        orb.storm(9);
        flash(0.35, 350);
        setTimeout(() => flash(0.3, 300), 420);
        spike('thunder', 0.3);
      } },
      { name: 'Smoke', run() {
        OZ.steam.burst();
        orb.thicken();
        spike('smoke', 0.55);
      } },
      { name: 'Fire', run() {
        orb.flare();
        spike('flame', 0.6);
        liquids.forEach((l) => (l.surge = 1));
        lamps.blaze();
      } },
      { name: 'Voice', run() {
        orb.speak();
        scope.boost();
        awed.add(Math.floor(rand(25, 90)));
        spike('humbug', 0.3);
      } },
      { name: 'Engines', run() {
        gears.boost(3.5);
        spike('humbug', 0.4);
        spike('smoke', 0.2);
      } },
    ];

    const levers = FX.map((fx, i) => {
      const node = el('div', 'lever control', $('#levers'));
      const mech = el('div', 'lever-mech', node);
      el('div', 'lever-arc', mech);
      el('div', 'knob', el('div', 'arm', mech));
      el('div', 'pivot', mech);
      el('div', 'plate', node, fx.name);
      node.addEventListener('pointerdown', () => pull(i));
      OZ.keys[String(i + 1)] = () => pull(i);
      return { node, fx, busy: false };
    });

    function pull(i) {
      const L = levers[i];
      if (L.busy) return;
      L.busy = true;
      L.node.classList.add('on');
      setTimeout(() => L.fx.run(), 150);
      setTimeout(() => {
        L.node.classList.remove('on');
        L.busy = false;
      }, 1700);
    }

    OZ.phantom = () => pull(Math.floor(Math.random() * levers.length));
  };
})();
