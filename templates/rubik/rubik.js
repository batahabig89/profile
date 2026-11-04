/* Rubik template (Minecraft look).
   - Hero: intro on the left, a scrambled, self-turning, playable 3×3×3 cube on the right.
       · drag a coloured sticker -> that layer follows the pointer (with / against the drag)
       · drag a face-centre sticker or the empty space -> trackball: the whole cube rolls like a ball
   - Scrolling: the cube flies to the bottom-right corner and turns the face of the chapter you are reading
     (Experience / Projects / Abilities / Certs / Contact) towards you.
   - Every chapter starts exploded into cards. Click its centre block and it folds into a 3D shape
     (Projects = pyramid, Abilities = cube, Certs = sphere, …) whose cells carry short names.
     Click a cell and that item opens in full.
   - Background: a blocky solar system (Mercury … Pluto), a pixel rocket Earth -> Moon / Mars, floating
     Steve / Creeper heads and rocks. Pure CSS 3D + canvas, no libraries. */
(function () {
    'use strict';

    var TOUCH = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
    var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var DRAG_PX = 8;
    var DEG = Math.PI / 180;
    var HALF_PI = Math.PI / 2;
    var PERSP = 1400;                                   // keep in sync with .rc-sstage perspective

    /* ---------- helpers ---------- */

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function chips(items) {
        return (items || []).map(function (i) { return '<span class="rc-chip">' + esc(i) + '</span>'; }).join('');
    }
    function splitList(list) {
        var out = [];
        (list || []).forEach(function (s) {
            String(s).split(',').forEach(function (p) { p = p.trim(); if (p) out.push(p); });
        });
        return out;
    }
    function shortName(s, max) {
        var words = String(s || '').replace(/[()]/g, '').split(/\s+/), out = '';
        for (var i = 0; i < words.length; i++) {
            var next = out ? out + ' ' + words[i] : words[i];
            if (next.length > max) break;
            out = next;
        }
        return out || String(s || '').slice(0, max);
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    /* ---------- 3×3 matrix maths (CSS space: x right, y down, z toward the viewer) ---------- */

    var IDENT = function () { return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; };
    function rotMat(axis, a) {
        var c = Math.cos(a), s = Math.sin(a);
        if (axis === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]];
        if (axis === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
        return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    }
    function mul(a, b) {
        var r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], i, j, k;
        for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) for (k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
        return r;
    }
    function transpose(m) { return [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]]; }
    function apply(m, v) {
        return [
            m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
        ];
    }
    function roundMat(m) { return m.map(function (r) { return r.map(Math.round); }); }
    function roundVec(v) { return v.map(Math.round); }
    function same(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function orthonormalize(m) {
        var x = [m[0][0], m[1][0], m[2][0]], y = [m[0][1], m[1][1], m[2][1]];
        x = norm(x);
        var d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
        y = norm([y[0] - d * x[0], y[1] - d * x[1], y[2] - d * x[2]]);
        var z = cross(x, y);
        return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
    }
    function axisAngleOf(R) {
        var c = clamp((R[0][0] + R[1][1] + R[2][2] - 1) / 2, -1, 1), a = Math.acos(c), s = Math.sin(a);
        if (a < 1e-4) return { ax: [0, 1, 0], a: 0 };
        if (Math.PI - a < 1e-3) {                                // half-turn: axis from R + I
            var best = 0, i;
            for (i = 1; i < 3; i++) if (R[i][i] > R[best][best]) best = i;
            var col = [R[0][best], R[1][best], R[2][best]]; col[best] += 1;
            return { ax: norm(col), a: a };
        }
        return { ax: [(R[2][1] - R[1][2]) / (2 * s), (R[0][2] - R[2][0]) / (2 * s), (R[1][0] - R[0][1]) / (2 * s)], a: a };
    }
    function rodrigues(ax, a) {
        var x = ax[0], y = ax[1], z = ax[2], c = Math.cos(a), s = Math.sin(a), t = 1 - c;
        return [
            [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c]
        ];
    }
    function cssMatrix(R, tx, ty, tz) {
        return 'matrix3d(' + [
            R[0][0], R[1][0], R[2][0], 0,
            R[0][1], R[1][1], R[2][1], 0,
            R[0][2], R[1][2], R[2][2], 0,
            tx, ty, tz, 1
        ].map(function (v) { return Math.abs(v) < 1e-6 ? 0 : +v.toFixed(4); }).join(',') + ')';
    }

    /* ---------- sound: the grinding click of a twisting cube, synthesised with Web Audio ---------- */

    var Sound = (function () {
        var ctx = null, master = null, noise = null, on = true;
        function unlock() {
            if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
            noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            var d = noise.getChannelData(0);
            for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        function click(t, vol, freq, q, dur) {
            var src = ctx.createBufferSource(); src.buffer = noise;
            var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
            var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            src.connect(f); f.connect(g); g.connect(master);
            src.start(t, Math.random() * 0.8, dur + 0.02);
            var o = ctx.createOscillator(); o.type = 'triangle';
            o.frequency.setValueAtTime(freq / 14 + 45, t); o.frequency.exponentialRampToValueAtTime(40, t + dur);
            var og = ctx.createGain(); og.gain.setValueAtTime(vol * 0.45, t); og.gain.exponentialRampToValueAtTime(0.001, t + dur);
            o.connect(og); og.connect(master); o.start(t); o.stop(t + dur + 0.02);
        }
        return {
            unlock: unlock,
            setOn: function (v) { on = v; },
            // a few quick, gritty clicks, like plastic edges ratcheting past each other
            crunch: function (power) {
                if (!on || !ctx || ctx.state !== 'running') return;
                var t = ctx.currentTime, n = 3 + Math.floor(Math.random() * 3);
                for (var i = 0; i < n; i++) {
                    t += 0.03 + Math.random() * 0.035;
                    click(t, 0.35 + 0.45 * power, rand(900, 3200), 3 + Math.random() * 4, 0.045 + Math.random() * 0.03);
                }
            },
            creak: function () {
                if (!on || !ctx || ctx.state !== 'running') return;
                var t = ctx.currentTime;
                click(t, 0.16, rand(700, 1800), 2 + Math.random() * 2, 0.05);
                if (Math.random() < 0.5) click(t + 0.045, 0.1, rand(1500, 2600), 3, 0.04);
            }
        };
    })();

    /* ---------- cube definition ---------- */

    var SIDES = {
        R: { n: [1, 0, 0], css: 'rotateY(90deg)' },
        L: { n: [-1, 0, 0], css: 'rotateY(-90deg)' },
        D: { n: [0, 1, 0], css: 'rotateX(-90deg)' },
        U: { n: [0, -1, 0], css: 'rotateX(90deg)' },
        F: { n: [0, 0, 1], css: '' },
        B: { n: [0, 0, -1], css: 'rotateY(180deg)' }
    };
    var SIDE_KEYS = ['U', 'D', 'L', 'R', 'F', 'B'];
    var MOVES = {
        U: { axis: 1, layer: -1, dir: -1 }, D: { axis: 1, layer: 1, dir: 1 },
        R: { axis: 0, layer: 1, dir: 1 }, L: { axis: 0, layer: -1, dir: -1 },
        F: { axis: 2, layer: 1, dir: 1 }, B: { axis: 2, layer: -1, dir: -1 }
    };

    var FACES = {
        U: { id: 'about', label: 'About', icon: '👤', color: '#f2f2ee', ink: '#1b1f2a' },
        F: { id: 'experience', label: 'Experience', icon: '💼', color: '#14a85a', ink: '#ffffff' },
        R: { id: 'projects', label: 'Projects', icon: '🚀', color: '#d7263d', ink: '#ffffff' },
        B: { id: 'abilities', label: 'Abilities', icon: '⚡', color: '#2467e8', ink: '#ffffff' },
        L: { id: 'certs', label: 'Certs & Study', icon: '🎓', color: '#ff7a1a', ink: '#1b1f2a' },
        D: { id: 'contact', label: 'Contact', icon: '✉️', color: '#ffd400', ink: '#1b1f2a' }
    };
    // camera [rx, ry] (deg) that looks straight at each face
    var FACE_VIEW = { F: [-12, 0], R: [-12, -90], B: [-12, 180], L: [-12, 90], U: [-70, 0], D: [70, 0] };
    var ID_TO_SIDE = {};
    SIDE_KEYS.forEach(function (k) { ID_TO_SIDE[FACES[k].id] = k; });
    function faceMatrix(k) { var v = FACE_VIEW[k]; return mul(rotMat(0, v[0] * DEG), rotMat(1, v[1] * DEG)); }

    /* ---------- chapters ---------- */

    function secret(text, href) {
        var inner = '<span class="rc-secret-text">' + esc(text) + '</span>';
        return href ? '<a class="rc-secret" href="' + esc(href) + '">' + inner + '</a>' : '<span class="rc-secret">' + inner + '</span>';
    }

    function buildChapters(d) {
        var info = d.personalInfo || {};
        var ws = d.workSkills || {};
        var plat = d.platforms || {};
        var loc = Array.isArray(info.location) ? info.location.join(', ') : (info.location || '');
        var spoken = Object.keys(d.spokenLanguages || {}).map(function (k) { return k + ' · ' + d.spokenLanguages[k]; });

        var experience = (d.experience || []).map(function (e) {
            var du = e.duration || {};
            return {
                icon: '💼', title: e.company, short: shortName(e.company, 10), sub: [e.role, e.type].filter(Boolean).join(' · '),
                meta: (du.start || '') + ' → ' + (du.end || ''), lines: e.description || []
            };
        });

        var projects = (d.projects || []).map(function (p) {
            return { icon: p.icon || '🚀', title: p.name, short: shortName(String(p.name).split('.')[0], 9), url: p.url, text: p.description, chips: p.technologies || [] };
        });

        var abilities = [{ icon: '⌨️', title: 'Languages', chips: splitList(d.programmingLanguages) }]
            .concat(Object.keys(ws).map(function (k) {
                var ico = { frontend: '🎨', backend: '🛠️', database: '🗄️', cloud: '☁️', mobile: '📱', devops: '♾️' }[k] || '⚙️';
                return { icon: ico, title: k.charAt(0).toUpperCase() + k.slice(1), chips: ws[k] };
            }))
            .concat([
                { icon: '🧰', title: 'Tools', chips: splitList(d.tools) },
                { icon: '🖥️', title: 'Platforms', chips: (plat.primary || []).concat(plat.secondary || []) }
            ])
            .filter(function (g) { return g.chips && g.chips.length; })
            .map(function (g) { g.short = shortName(g.title, 9); return g; });

        var certs = (d.certifications || []).map(function (c) {
            return { icon: '📜', title: c.name, short: shortName(c.name, 10), sub: c.issuer, meta: c.date };
        }).concat((d.education || []).map(function (e) {
            return {
                icon: '🎓', title: [e.level, e.field].filter(Boolean).join(' — '), short: shortName(e.field || e.level, 10), sub: e.institution,
                meta: [e.date, e.GPA ? 'GPA ' + e.GPA : ''].filter(Boolean).join(' · ')
            };
        }));

        var contact = [
            info.email && { icon: '✉️', title: 'Email', short: 'Email', value: secret(info.email, 'mailto:' + info.email) },
            info.phone && { icon: '📞', title: 'Phone', short: 'Phone', value: secret(info.phone, 'tel:' + String(info.phone).replace(/\s+/g, '')) },
            loc && { icon: '📍', title: 'Location', short: 'Where', text: loc },
            spoken.length && { icon: '🗣️', title: 'Languages', short: 'Speak', chips: spoken },
            info.vehicleLicense && { icon: '🚗', title: 'Driving', short: 'Driving', text: 'Licensed driver' }
        ].filter(Boolean);

        var defs = [
            { key: 'F', kind: 'cuboid', shapeName: '4×4 cube', shape: { w: 4, h: 4, d: 4, grow: 'n' }, items: experience, desc: 'Where I have worked. Click the centre block to fold the cards into a 4×4 cube; click a cell to open that job beside it.' },
            { key: 'R', kind: 'pyramid', shapeName: 'pyramid', items: projects, desc: 'Things I have built. Click the centre block to fold the cards into a pyramid; click a cell to open that project beside it.' },
            { key: 'B', kind: 'cuboid', shapeName: 'cube', shape: { w: 3, h: 3, d: 3, grow: 'n' }, items: abilities, desc: 'Languages, stacks and tools. Click the centre block to fold the cards into a cube; click a cell to open that skill group beside it.' },
            { key: 'L', kind: 'sphere', shapeName: 'sphere', items: certs, desc: 'Certificates and degrees. Click the centre block to fold the cards into a sphere; click a cell to open it beside the ball.' },
            { key: 'D', kind: 'cuboid', shapeName: '2×2 cube', shape: { w: 2, h: 2, d: 2, grow: 'n' }, items: contact, desc: 'Let’s talk. ' + (TOUCH ? 'Tap' : 'Hover over') + ' a blurred line to reveal it.' }
        ];
        return defs.map(function (c) {
            var f = FACES[c.key];
            c.id = f.id; c.label = f.label; c.icon = f.icon; c.color = f.color; c.ink = f.ink;
            return c;
        });
    }

    function itemHtml(it) {
        var title = it.url
            ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + ' ↗</a>'
            : esc(it.title);
        return (
            '<div class="rc-item">' +
            '<div class="rc-item-head"><span class="rc-item-ico">' + esc(it.icon) + '</span>' +
            '<div><strong>' + title + '</strong>' + (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') + '</div></div>' +
            (it.meta ? '<time>' + esc(it.meta) + '</time>' : '') +
            (it.value ? '<div class="rc-item-value">' + it.value + '</div>' : '') +
            (it.text ? '<p>' + esc(it.text) + '</p>' : '') +
            (it.lines && it.lines.length ? '<ul>' + it.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') +
            (it.chips && it.chips.length ? '<div class="rc-chips">' + chips(it.chips) + '</div>' : '') +
            '</div>'
        );
    }

    /* =====================================================================
       Space background — blocky Minecraft style
       ===================================================================== */

    function initSpace(canvas, root, getScroll, getProgress) {
        var ctx = canvas.getContext('2d');
        var w = 0, h = 0, dpr = 1;
        var speed = REDUCED ? 0.25 : 1;
        var T = 0, last = performance.now();
        var CELL = 3;                                    // size of one "pixel" of a planet

        function hash(i, j, s) { var v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); }

        // sprite = canvas with one pixel per cell, drawn scaled up with smoothing off
        function makeBall(r, o) {
            var n = Math.max(3, Math.round(r * 2 / CELL)), wide = o.ring ? n + 6 : n;
            var c = document.createElement('canvas'); c.width = wide; c.height = n;
            var g = c.getContext('2d'), off = (wide - n) / 2, i, j;
            if (o.ring) {
                g.fillStyle = o.ring;
                for (i = 0; i < wide; i++) { g.fillRect(i, Math.floor(n / 2), 1, 1); if (i > 1 && i < wide - 2) g.fillRect(i, Math.floor(n / 2) + 1, 1, 1); }
            }
            for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
                var dx = i + 0.5 - n / 2, dy = j + 0.5 - n / 2;
                if (dx * dx + dy * dy > (n / 2) * (n / 2) + 0.2) continue;
                var light = (-dx * 0.55 - dy * 0.65) / (n / 2);
                var col = light > 0.4 ? o.c[0] : (light > -0.25 ? o.c[1] : o.c[2]);
                var nz = hash(i, j, o.seed);
                if (o.bands) col = o.bands[(j + (nz > 0.8 ? 1 : 0)) % o.bands.length];
                else if (o.spot && nz > o.spotAt) col = light < -0.25 ? o.spot[1] : o.spot[0];
                g.fillStyle = col; g.fillRect(i + off, j, 1, 1);
            }
            if (o.ring) {                               // front half of the ring crosses over the planet
                g.fillStyle = o.ring;
                for (i = 0; i < wide; i++) g.fillRect(i, Math.floor(n / 2) + 1, 1, 1);
            }
            return { c: c, w: wide * CELL, h: n * CELL };
        }

        // name, orbit factor, radius, sprite options
        var PLANETS = [
            ['Mercury', 0.10, 5, { c: ['#cfc9bd', '#a59f94', '#6c675f'], seed: 1, spot: ['#8d877c', '#5b574f'], spotAt: 0.6 }],
            ['Venus', 0.15, 8, { c: ['#f3d796', '#dcb35e', '#9b7a34'], seed: 2, spot: ['#e9c176', '#b0883c'], spotAt: 0.7 }],
            ['Earth', 0.20, 9, { c: ['#5aa0ff', '#2f6fd8', '#1d4f9f'], seed: 3, spot: ['#4caf50', '#2e7d32'], spotAt: 0.62 }],
            ['Mars', 0.26, 7, { c: ['#f08a5d', '#d9532b', '#8f2f18'], seed: 4, spot: ['#b8431f', '#7a2411'], spotAt: 0.66 }],
            ['Jupiter', 0.36, 16, { c: ['#e8c9a0', '#c9a07a', '#8a6a49'], seed: 5, bands: ['#e8d0a8', '#c79a6e', '#f0dfc0', '#b9825a', '#d9b88f'] }],
            ['Saturn', 0.46, 13, { c: ['#f2e1ad', '#dcc27e', '#9a8650'], seed: 6, ring: '#cdb77a', bands: ['#f2e1ad', '#dcc27e', '#e9d598'] }],
            ['Uranus', 0.56, 11, { c: ['#b4f2f6', '#7fd6de', '#4aa3ad'], seed: 7, spot: ['#9fe6ec', '#5fb8c2'], spotAt: 0.8 }],
            ['Neptune', 0.66, 11, { c: ['#6f8cff', '#3f5df0', '#2238a8'], seed: 8, spot: ['#2c46c8', '#1b2e8a'], spotAt: 0.74 }],
            ['Pluto', 0.76, 5, { c: ['#e2cdb8', '#bba28d', '#8d7967'], seed: 9, spot: ['#a88f7a', '#7b6757'], spotAt: 0.6 }]
        ].map(function (p, i) {
            return { name: p[0], f: p[1], sprite: makeBall(p[2], p[3]), r: p[2], phase: i * 1.37 + 0.5, period: 34 * Math.pow(p[1] / 0.2, 1.5) };
        });
        var EARTH = PLANETS[2], MARS = PLANETS[3];
        var TILT = -0.2;

        // pixel sprites (letter maps)
        function makeSprite(rows, pal, px) {
            var c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
            var g = c.getContext('2d');
            rows.forEach(function (row, y) {
                for (var x = 0; x < row.length; x++) { var k = row.charAt(x); if (pal[k]) { g.fillStyle = pal[k]; g.fillRect(x, y, 1, 1); } }
            });
            return { c: c, w: c.width * px, h: c.height * px };
        }
        var STEVE = makeSprite(['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'SWBSSBWS', 'SSSNNSSS', 'SSMMMMSS', 'SSMMMMSS', 'SSSSSSSS'],
            { H: '#4a3321', S: '#c4875e', W: '#ffffff', B: '#3a2f8a', N: '#9a5f3e', M: '#6b3f27' }, 5);
        var CREEPER = makeSprite(['GgGGGgGG', 'GKKGGKKG', 'GKKGGKKG', 'GGGKKGGG', 'GGKKKKGG', 'GGKKKKGG', 'GGKGGKGG', 'gGGGGGgG'],
            { G: '#4fae3d', g: '#3f8a31', K: '#0d1a0a' }, 5);

        // spiral galaxies, drawn as blocky pixel sprites, drift across the sky on crossing paths
        var GALAXY_COLORS = [['#ffe9a8', '#8a6bff', '#ff6bd6'], ['#fff2c4', '#4aa8ff', '#7cf0ff'], ['#fff0c0', '#ff9d5c', '#ff5c8a'], ['#f4ffd0', '#7dff9b', '#4ac8e0']];
        function makeGalaxy(R, pal, arms) {
            var n = Math.round(R * 2 / CELL), c = document.createElement('canvas'); c.width = n; c.height = n;
            var g = c.getContext('2d'), half = n / 2, count = Math.round(R * 16), i;
            for (i = 0; i < count; i++) {
                var t = Math.pow(Math.random(), 0.75), arm = Math.floor(Math.random() * arms);
                var ang = arm * 6.2832 / arms + t * 4.4 + (Math.random() + Math.random() - 1) * 0.55 * (1.1 - t * 0.5);
                var rr = t * half, x = Math.floor(half + Math.cos(ang) * rr), y = Math.floor(half + Math.sin(ang) * rr);
                g.globalAlpha = clamp(0.95 - t * 0.55, 0.25, 0.95);
                g.fillStyle = Math.random() < 0.06 ? '#ffffff' : (t < 0.3 ? pal[0] : (t < 0.62 ? pal[1] : pal[2]));
                g.fillRect(x, y, 1, 1);
            }
            for (i = 0; i < count * 0.35; i++) {                       // glowing core
                var a = Math.random() * 6.2832, d = Math.pow(Math.random(), 1.6) * half * 0.28;
                g.globalAlpha = 0.9; g.fillStyle = Math.random() < 0.5 ? pal[0] : '#ffffff';
                g.fillRect(Math.floor(half + Math.cos(a) * d), Math.floor(half + Math.sin(a) * d), 1, 1);
            }
            return { c: c, w: n * CELL, h: n * CELL };
        }
        var galaxies = [];
        function spawnGalaxy(onScreen) {
            var R = Math.max(9, Math.round(rand(34, 150) * rand(0.25, 0.5) / CELL) * CELL), sp = makeGalaxy(R, GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)], 2 + Math.floor(Math.random() * 3));
            var speed = rand(7, 26), dir = Math.random() < 0.5 ? 1 : -1, m = R * 1.3;
            var x = onScreen ? rand(0, w) : (dir > 0 ? -m : w + m), y = rand(h * 0.04, h * 0.96);
            var dx = dir, dy = rand(-0.02, 0.02), len = 1;
            galaxies.push({
                sp: sp, R: R, x: x, y: y, vx: dx / len * speed, vy: dy / len * speed, rot: rand(0, 6.28), vr: rand(-0.06, 0.06),
                squash: rand(0.32, 0.8), alpha: rand(0.45, 0.8), age: 0
            });
        }

        // sun flares: sparks fly off a random part of the sun, on their own now and then and on every cube crunch
        var sparks = [], sunPulse = 0, nextFlare = 4;
        function sunR() { return Math.round(clamp(w * 0.022, 20, 30) / 3) * 3; }
        function sunBurst(power, wide) {
            var base = rand(0, 6.2832), n = wide ? 70 : Math.round(12 + power * 22), spread = wide ? 0.42 : 0.6, sr = sunR();
            var cols = ['#fff3a6', '#ffc83d', '#ff9b1f', '#ff5a1f', '#ffffff'];
            for (var i = 0; i < n; i++) {
                var a = base + rand(-spread, spread), sp = rand(60, wide ? 230 : 280) * (0.7 + power * 0.5);
                sparks.push({
                    x: geo.cx + Math.cos(a) * sr * 0.9, y: geo.cy + Math.sin(a) * sr * 0.9,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(1.1, wide ? 3 : 2.2),
                    s: Math.random() < 0.3 ? 6 : 3, c: cols[Math.floor(Math.random() * cols.length)]
                });
            }
            if (sparks.length > 520) sparks.splice(0, sparks.length - 520);
            sunPulse = Math.min(1, sunPulse + (wide ? 1 : 0.45 + power * 0.3));
        }
        root.addEventListener('rc-crunch', function (e) { sunBurst((e.detail && e.detail.power) || 0.6, false); });

        var stars = [], rocks = [], flames = [];
        var geo = { cx: 0, cy: 0, a: 0, k: 0.34 };

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = canvas.clientWidth; h = canvas.clientHeight;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = false;
            geo.cx = w * 0.2; geo.cy = h * 0.27; geo.a = Math.min(w * 0.55, h * 1.5);
            if (!galaxies.length) { for (var gi = 0; gi < 4; gi++) spawnGalaxy(true); for (gi = 0; gi < 3; gi++) spawnGalaxy(false); }
            stars = [];
            var n = Math.round(clamp(w * h / 7000, 70, 220));
            for (var i = 0; i < n; i++) stars.push({ x: Math.floor(Math.random() * w), y: Math.floor(Math.random() * h), z: rand(0.2, 1), tw: rand(0, 6.28), s: rand(0.25, 1) });
            buildWorld(); buildClouds(); buildBirds();
        }

        function planetPos(p, t) {
            var th = p.phase + t * 6.2832 / p.period;
            var a = geo.a * p.f, b = a * geo.k;
            var x = Math.cos(th) * a, y = Math.sin(th) * b;
            return { x: geo.cx + x * Math.cos(TILT) - y * Math.sin(TILT), y: geo.cy + x * Math.sin(TILT) + y * Math.cos(TILT) };
        }
        function moonPos(t) {
            var e = planetPos(EARTH, t), th = t * 6.2832 / 5.5;
            return { x: e.x + Math.cos(th) * 24, y: e.y + Math.sin(th) * 16 };
        }

        for (var ri = 0; ri < 12; ri++) rocks.push({
            x: Math.random(), y: Math.random(), vx: rand(-0.004, 0.004), vy: rand(-0.003, 0.003),
            rot: rand(0, 6), vr: rand(-0.4, 0.4), s: Math.round(rand(2, 4)) * 3, z: rand(0.5, 1)
        });
        var floaters = [
            { sp: STEVE, x: 0.18, y: 0.7, vx: 0.006, vy: -0.002, rot: 0.3, vr: 0.12 },
            { sp: CREEPER, x: 0.82, y: 0.25, vx: -0.005, vy: 0.002, rot: -0.4, vr: -0.08 }
        ];

        // rocket: idle -> lift (standing on Earth) -> fly (bezier to the moving target) -> done
        var rocket = { state: 'idle', t0: T + 2.5, target: 'moon' };
        var flash = null;
        function targetPos(which, t) { return which === 'moon' ? moonPos(t) : planetPos(MARS, t); }

        function stepRocket() {
            var r = rocket, LIFT = 1.1;
            if (r.state === 'idle' && T >= r.t0) { r.state = 'lift'; r.t0 = T; }
            if (r.state === 'lift') {
                var e = planetPos(EARTH, T);
                r.x = e.x; r.y = e.y - 12; r.ang = -HALF_PI;
                r.shake = (T - r.t0) / LIFT;
                if (T - r.t0 >= LIFT) {
                    r.state = 'fly'; r.t1 = T;
                    r.dur = r.target === 'moon' ? 5 : 11;
                    r.S = { x: r.x, y: r.y };
                    r.E = targetPos(r.target, T + r.dur);
                    var mx = (r.S.x + r.E.x) / 2, my = (r.S.y + r.E.y) / 2;
                    var dx = r.E.x - r.S.x, dy = r.E.y - r.S.y;
                    var side = r.target === 'moon' ? -1 : 1;
                    r.C = { x: mx - dy * 0.35 * side, y: my + dx * 0.35 * side };
                }
            }
            if (r.state === 'fly') {
                var u = clamp((T - r.t1) / r.dur, 0, 1), v = u * u * (3 - 2 * u) * 0.55 + u * 0.45;
                var iu = 1 - v;
                r.x = iu * iu * r.S.x + 2 * iu * v * r.C.x + v * v * r.E.x;
                r.y = iu * iu * r.S.y + 2 * iu * v * r.C.y + v * v * r.E.y;
                var tx = 2 * iu * (r.C.x - r.S.x) + 2 * v * (r.E.x - r.C.x);
                var ty = 2 * iu * (r.C.y - r.S.y) + 2 * v * (r.E.y - r.C.y);
                r.ang = Math.atan2(ty, tx);
                if (u >= 1) { r.state = 'done'; r.t2 = T; flash = { x: r.x, y: r.y, t: T }; }
            }
            if (r.state === 'done' && T - r.t2 > 1.6) {
                r.state = 'idle'; r.t0 = T + 4; r.target = r.target === 'moon' ? 'mars' : 'moon';
            }
        }

        function emitFlames() {
            var r = rocket;
            if (r.state !== 'fly' && r.state !== 'lift') return;
            var n = r.state === 'lift' ? Math.round(1 + r.shake * 3) : 3;
            for (var i = 0; i < n; i++) {
                var a = r.ang + Math.PI + rand(-0.25, 0.25), sp = rand(18, 50);
                flames.push({
                    x: r.x + Math.cos(r.ang + Math.PI) * 13, y: r.y + Math.sin(r.ang + Math.PI) * 13,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.5, 1.1), s: Math.random() < 0.5 ? 3 : 6
                });
            }
            if (flames.length > 200) flames.splice(0, flames.length - 200);
        }

        function px(x, y, wd, ht, col) { ctx.fillStyle = col; ctx.fillRect(x, y, wd, ht); }

        function drawRocket() {
            var r = rocket;
            if (r.state === 'idle') return;
            var alpha = r.state === 'done' ? clamp(1 - (T - r.t2) / 1.2, 0, 1) : 1;
            if (alpha <= 0) return;
            ctx.save();
            var jx = r.state === 'lift' ? Math.sin(T * 60) * r.shake * 1.5 : 0;
            ctx.translate(r.x + jx, r.y); ctx.rotate(r.ang); ctx.globalAlpha = alpha;
            var flick = Math.floor(T * 14) % 2;
            px(-19, -2, 6, 4, flick ? '#ff8a1f' : '#ff5a1f');                      // flame
            px(-14, -3, 6, 6, '#ffd25a');
            px(-8, -6, 6, 3, '#d7263d'); px(-8, 3, 6, 3, '#d7263d');               // fins
            px(-8, -3, 14, 6, '#f2f2f2'); px(-8, 1, 14, 2, '#c9c9c9');             // body
            px(0, -2, 4, 4, '#4aa8ff'); px(0, -2, 2, 2, '#bfe3ff');               // window
            px(6, -3, 3, 6, '#d7263d'); px(9, -2, 3, 4, '#d7263d'); px(12, -1, 2, 2, '#d7263d'); // nose
            ctx.restore();
        }

        function drawSprite(sp, x, y, rot, alpha) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.globalAlpha = alpha == null ? 1 : alpha;
            ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
            ctx.restore();
        }

        /* ---- the descent: the Earth rises, the sky turns blue, a blocky Minecraft world appears ---- */
        var prog = 0;
        function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
        function vnoise(x, y, sd) {
            var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
            var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            return lerp(lerp(hash(xi, yi, sd), hash(xi + 1, yi, sd), u), lerp(hash(xi, yi + 1, sd), hash(xi + 1, yi + 1, sd), u), v);
        }
        var EARTH_BIG = (function () {
            var n = 130, c = document.createElement('canvas'); c.width = n; c.height = n;
            var g = c.getContext('2d');
            for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
                var dx = (i + 0.5 - n / 2) / (n / 2), dy = (j + 0.5 - n / 2) / (n / 2);
                if (dx * dx + dy * dy > 1) continue;
                var light = clamp(0.62 - dy * 0.55 - dx * 0.25, 0, 1);
                var land = vnoise(i * 0.09, j * 0.09, 11) * 0.65 + vnoise(i * 0.24, j * 0.24, 12) * 0.35, col;
                if (vnoise(i * 0.16, j * 0.16, 21) > 0.7) col = light > 0.45 ? '#ffffff' : '#dfe8f5';
                else if (land > 0.56) col = land > 0.7 ? (light > 0.45 ? '#9c7a45' : '#7a5c32') : (light > 0.45 ? '#58b34a' : '#3d8f38');
                else col = light > 0.55 ? '#4a8cf0' : (light > 0.3 ? '#2f6fd8' : '#1d4f9f');
                g.fillStyle = col; g.fillRect(i, j, 1, 1);
            }
            return c;
        })();

        // The globe: a land mask built from coarse continent outlines (North America, South America, Africa, Eurasia,
        // Australia, Antarctica), drawn as a blocky sphere that spins in towards Mongolia while you scroll down
        var CONTINENTS = [
            [1, [[-168, 66], [-162, 71], [-140, 70], [-125, 72], [-110, 73], [-95, 73], [-82, 70], [-80, 63], [-90, 58], [-79, 52], [-66, 60], [-60, 55], [-55, 50], [-66, 44], [-76, 38], [-81, 30], [-80, 25], [-84, 30], [-90, 29], [-97, 26], [-97, 20], [-90, 21], [-87, 16], [-83, 10], [-78, 8], [-85, 12], [-92, 15], [-105, 20], [-110, 24], [-112, 29], [-117, 32], [-124, 40], [-124, 48], [-133, 55], [-148, 60], [-158, 58], [-165, 62]]],
            [1, [[-73, 78], [-60, 82], [-30, 83], [-20, 78], [-20, 70], [-30, 67], [-43, 60], [-52, 64], [-58, 75]]],
            [2, [[-80, 9], [-72, 12], [-62, 10], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-38, -14], [-40, -22], [-48, -26], [-53, -34], [-58, -38], [-65, -42], [-66, -47], [-69, -52], [-73, -52], [-75, -46], [-73, -37], [-71, -27], [-70, -18], [-76, -14], [-81, -6], [-80, 0], [-77, 4]]],
            [3, [[-17, 21], [-16, 28], [-9, 32], [-5, 36], [10, 37], [11, 33], [20, 31], [32, 31], [34, 28], [38, 21], [43, 12], [51, 12], [48, 5], [41, -3], [40, -11], [40, -17], [35, -25], [32, -29], [27, -34], [19, -35], [16, -29], [12, -17], [13, -8], [9, -1], [9, 4], [3, 6], [-8, 4], [-13, 8], [-17, 14]]],
            [3, [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]]],
            [4, [[-10, 36], [-9, 43], [-2, 43], [-1, 48], [3, 51], [8, 54], [10, 57], [5, 60], [8, 63], [15, 68], [25, 71], [40, 68], [45, 68], [60, 70], [70, 73], [80, 73], [100, 77], [115, 73], [130, 71], [142, 72], [160, 70], [172, 67], [180, 66], [180, 62], [163, 58], [156, 51], [143, 52], [141, 46], [135, 43], [130, 43], [127, 38], [126, 35], [122, 40], [121, 32], [122, 28], [117, 23], [109, 21], [108, 16], [109, 11], [105, 9], [100, 13], [100, 5], [104, 1], [98, 8], [98, 16], [94, 17], [90, 22], [86, 20], [80, 13], [77, 8], [73, 17], [70, 21], [67, 25], [60, 25], [57, 26], [56, 25], [52, 27], [48, 30], [50, 26], [56, 24], [59, 22], [53, 16], [44, 13], [39, 22], [35, 28], [34, 31], [36, 36], [30, 36], [27, 37], [26, 40], [23, 38], [21, 40], [19, 42], [15, 45], [12, 45], [16, 41], [18, 40], [15, 38], [9, 44], [3, 43], [-1, 38]]],
            [4, [[-5, 50], [1, 51], [2, 53], [-2, 58], [-6, 57], [-5, 54]]],
            [4, [[130, 31], [132, 34], [135, 35], [140, 36], [142, 40], [141, 45], [145, 44], [140, 41], [137, 38], [131, 34]]],
            [5, [[113, -22], [122, -18], [130, -12], [136, -12], [142, -11], [146, -19], [153, -26], [151, -34], [146, -39], [140, -38], [135, -34], [129, -32], [116, -35], [114, -28]]],
            [5, [[109, 2], [117, 7], [119, 1], [116, -4], [110, -3]]]
        ];
        var MASK_W = 180, MASK_H = 90, MASK = new Uint8Array(MASK_W * MASK_H);
        (function buildMask() {
            function inPoly(x, y, P) {
                var c = false;
                for (var i = 0, k = P.length - 1; i < P.length; k = i++) {
                    var xi = P[i][0], yi = P[i][1], xk = P[k][0], yk = P[k][1];
                    if (((yi > y) !== (yk > y)) && (x < (xk - xi) * (y - yi) / (yk - yi) + xi)) c = !c;
                }
                return c;
            }
            for (var jj = 0; jj < MASK_H; jj++) for (var ii = 0; ii < MASK_W; ii++) {
                var lon = -180 + (ii + 0.5) * 2, lat = 90 - (jj + 0.5) * 2, id = 0;
                if (lat < -69 + 1.5 * Math.sin(lon * 0.09)) id = 6;
                else for (var k2 = 0; k2 < CONTINENTS.length; k2++) if (inPoly(lon, lat, CONTINENTS[k2][1])) { id = CONTINENTS[k2][0]; break; }
                MASK[jj * MASK_W + ii] = id;
            }
        })();

        function earthColor(lat, lon, id, shade, cloud) {
            var r, g, b, rgb;
            if (!id) { var k = 0.8 + 0.2 * Math.cos(lat * DEG); r = 36 * k; g = 95 * k; b = 184 * k; }
            else {
                if (id === 6 || lat > 70 || (id === 1 && lat > 60 && lon > -75 && lon < -10)) rgb = [238, 246, 255];
                else if ((id === 3 && lat > 13 && lat < 31) || (id === 4 && lon > 35 && lon < 58 && lat > 16 && lat < 30)) rgb = [210, 180, 105];
                else if (id === 5 && lon > 120 && lon < 146 && lat > -31 && lat < -20) rgb = [207, 159, 90];
                else if (lon > 70 && lon < 100 && lat > 27 && lat < 40) rgb = [139, 122, 85];
                else if (lon > 88 && lon < 122 && lat > 41 && lat < 52) rgb = [158, 194, 79];
                else if ((id === 2 && lat > -12 && lat < 6) || (id === 3 && lat > -6 && lat < 6)) rgb = [47, 143, 58];
                else rgb = [79, 174, 72];
                r = rgb[0]; g = rgb[1]; b = rgb[2];
            }
            r *= shade; g *= shade; b *= shade;
            if (cloud > 0) { r += (255 - r) * cloud; g += (255 - g) * cloud; b += (255 - b) * cloud; }
            return [r, g, b];
        }

        var EARTH_N = 128, earthCv = document.createElement('canvas'), earthCtx;
        earthCv.width = earthCv.height = EARTH_N; earthCtx = earthCv.getContext('2d');
        var earthImg = earthCtx.createImageData(EARTH_N, EARTH_N);

        function drawEarth(ap, day) {
            if (ap < 0.02) return;
            // fade the solar system out behind the globe (the sun stays: it is drawn afterwards)
            ctx.fillStyle = 'rgba(4,6,14,' + clamp(ap * 3, 0, 0.94) + ')'; ctx.fillRect(0, 0, w, h);

            var N = EARTH_N, data = earthImg.data, e = ease(clamp(ap / 0.75, 0, 1));
            var lon0 = lerp(-95, 106, e), lat0 = lerp(-28, 47, e), cp = Math.cos(lat0 * DEG), sp = Math.sin(lat0 * DEG), i, j;
            for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
                var x = (i + 0.5 - N / 2) / (N / 2), y = -(j + 0.5 - N / 2) / (N / 2), r2 = x * x + y * y, o = (j * N + i) * 4;
                if (r2 > 1) { data[o + 3] = 0; continue; }
                var z = Math.sqrt(1 - r2), y2 = y * cp + z * sp, z2 = -y * sp + z * cp;
                var lat = Math.asin(clamp(y2, -1, 1)) / DEG, lon = ((lon0 + Math.atan2(x, z2) / DEG + 540) % 360) - 180;
                var id = MASK[clamp(Math.floor((90 - lat) / 2), 0, MASK_H - 1) * MASK_W + clamp(Math.floor((lon + 180) / 2), 0, MASK_W - 1)];
                var cloud = Math.min(0.7, Math.max(0, (vnoise(lon * 0.08 + 3, lat * 0.1, 31) * 0.6 + vnoise(lon * 0.25, lat * 0.3, 32) * 0.4 - 0.66) * 3));
                var shade = clamp(0.4 - x * 0.35 + y * 0.45 + z * 0.55, 0.12, 1) * (0.7 + 0.3 * z);
                var col = earthColor(lat, lon, id, 0.35 + 0.65 * shade, cloud);
                data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
            }
            earthCtx.putImageData(earthImg, 0, 0);

            // the whole globe stays in view while it spins; only then does it zoom in
            var R = ap < 0.55 ? lerp(0.22 * h, 0.7 * h, ap / 0.55) : lerp(0.7 * h, 3.4 * h, Math.pow((ap - 0.55) / 0.45, 2)), cx = w * 0.5, cy = h * 0.5;
            ctx.globalAlpha = clamp(ap * 8, 0, 1);
            ctx.drawImage(earthCv, Math.round(cx - R), Math.round(cy - R), Math.round(2 * R), Math.round(2 * R));
            if (R < 2 * h) {                                                   // thin blue atmosphere
                var rg = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.07);
                rg.addColorStop(0, 'rgba(130,200,255,0.5)'); rg.addColorStop(1, 'rgba(130,200,255,0)');
                ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.07, 0, 6.2832); ctx.fill();
            }
            // a pulsing marker on Mongolia (Ulaanbaatar) once it turns into view
            var mla = 47.9 * DEG, mlo = (106.9 - lon0) * DEG;
            var mx = Math.cos(mla) * Math.sin(mlo), my = Math.sin(mla), mz = Math.cos(mla) * Math.cos(mlo);
            var yv = my * cp - mz * sp, zv = my * sp + mz * cp;
            if (zv > 0.1) {
                var sx = cx + mx * R, sy = cy - yv * R, pulse = 6 + (Math.sin(T * 5) + 1) * 4;
                ctx.fillStyle = '#ff2a2a'; ctx.fillRect(Math.round(sx - 4), Math.round(sy - 4), 8, 8);
                ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(Math.round(sx - pulse), Math.round(sy - pulse), pulse * 2, pulse * 2);
                if (R > 0.3 * h) { ctx.font = '16px VT323, monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText('Mongolia', Math.round(sx + pulse + 6), Math.round(sy + 5)); }
            }
            ctx.globalAlpha = 1;
        }

        function drawEarthLimb(ap) {
            if (ap < 0.01) return;
            var De = Math.max(w * 3.4, h * 3.2), R = De / 2, top = h - ap * h * 0.58, cy = top + R;
            ctx.drawImage(EARTH_BIG, Math.round(w / 2 - R), Math.round(top), Math.round(De), Math.round(De));
            var rg = ctx.createRadialGradient(w / 2, cy, R * 0.99, w / 2, cy, R * 1.07);
            rg.addColorStop(0, 'rgba(130,200,255,0.55)'); rg.addColorStop(1, 'rgba(130,200,255,0)');
            ctx.fillStyle = rg; ctx.fillRect(0, top - R * 0.08, w, R * 0.14);
        }

        function drawSky(day) {
            if (day <= 0) return;
            var g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#4d8fe8'); g.addColorStop(0.55, '#7db8f5'); g.addColorStop(1, '#cfe8ff');
            ctx.globalAlpha = day; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
        }

        // pixel clouds
        var clouds = [];
        function buildClouds() {
            clouds = [];
            var cb = Math.round(clamp(w / 60, 12, 22)), i, k;
            for (i = 0; i < 7; i++) {
                var a = 3 + Math.floor(Math.random() * 3), rows = [[1, 0, a], [0, 1, a + 2], [1, 2, a]];
                clouds.push({ x: Math.random() * w, y: rand(h * 0.05, h * 0.42), v: rand(5, 14), cb: cb, rows: rows });
            }
        }
        function drawClouds(day, dt) {
            if (day <= 0.02) return;
            clouds.forEach(function (c) {
                c.x += c.v * dt * speed; if (c.x > w + c.cb * 8) c.x = -c.cb * 8;
                ctx.globalAlpha = day * 0.92;
                c.rows.forEach(function (r, i) {
                    ctx.fillStyle = i === 2 ? '#dbe7f5' : '#ffffff';
                    ctx.fillRect(Math.round(c.x + r[0] * c.cb), Math.round(c.y + r[1] * c.cb), r[2] * c.cb, c.cb);
                });
            });
            ctx.globalAlpha = 1;
        }

        var birds = [];
        function buildBirds() {
            birds = [];
            for (var i = 0; i < 7; i++) birds.push({ x: Math.random() * w, y: rand(h * 0.06, h * 0.4), v: rand(28, 60) * (Math.random() < 0.7 ? 1 : -1), ph: rand(0, 6), s: Math.random() < 0.3 ? 4 : 3, wob: rand(0, 6) });
        }
        function drawBirds(day, dt) {
            if (day <= 0.25) return;
            ctx.fillStyle = '#26303f';
            birds.forEach(function (b) {
                b.x += b.v * dt * speed;
                if (b.v > 0 && b.x > w + 30) b.x = -30; if (b.v < 0 && b.x < -30) b.x = w + 30;
                var up = Math.sin(T * 9 + b.ph) > 0, s = b.s, y = b.y + Math.sin(T * 0.9 + b.wob) * 10;
                ctx.globalAlpha = day;
                ctx.fillRect(Math.round(b.x), Math.round(y), 2 * s, s);                                   // body
                ctx.fillRect(Math.round(b.x - 2 * s), Math.round(y + (up ? -s : s)), 2 * s, s);           // wings flap up and down
                ctx.fillRect(Math.round(b.x + 2 * s), Math.round(y + (up ? -s : s)), 2 * s, s);
            });
            ctx.globalAlpha = 1;
        }

        // the blocky world at the bottom of the page: grass, trees, bushes, houses, a tower, a well, sheep and goats
        var world = { c: null, B: 10, top: [], animals: [], river: null, well: null, chimney: null, rise: 0 };
        function topY(x) { return world.top[clamp(Math.floor(x / world.B), 0, world.top.length - 1)] || h; }

        function buildWorld() {
            var B = clamp(Math.round(w / 100), 8, 14), U = Math.round(B * 1.4), cols = Math.ceil(w / B) + 1, g0 = Math.round(h * 0.84 / B) * B;
            var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
            var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
            var wide = cols > 80, c, r, i;
            // left: green steppe with a ger, a well and a river; right: the Gobi with dunes and a Gobi bear
            var dsC = Math.round(cols * (wide ? 0.6 : 0.78));
            function sandAt(col) { if (col >= dsC + 6) return true; if (col < dsC - 6) return false; return hash(col, 0, 77) < (col - (dsC - 6)) / 12; }
            var hoff = [], spans = [];
            for (c = 0; c < cols; c++) {
                var amp = clamp((c - (dsC - 6)) / 14, 0, 1);
                hoff[c] = Math.round(Math.sin(c * 0.035 + 0.4) * 0.55 * (1 - amp) + -amp * (10 * Math.abs(Math.sin((c - dsC) * 0.07 + 0.7)) + 4 * Math.abs(Math.sin((c - dsC) * 0.17 + 1.7)) + 1.5 * Math.abs(Math.sin((c - dsC) * 0.45))));
            }
            function place(type, widthU, frac) {
                var cw = Math.ceil(widthU * U / B) + 1, c0 = clamp(Math.round(cols * frac - cw / 2), 1, Math.max(1, cols - cw - 1)), mid = hoff[c0 + (cw >> 1)];
                for (var k = c0 - 1; k <= c0 + cw; k++) if (k >= 0 && k < cols) hoff[k] = mid;
                spans.push({ type: type, c0: c0, cw: cw });
            }
            if (wide) { place('ger', 11, 0.13); place('well', 16, 0.33); } else { place('ger', 10, 0.15); place('well', 14, 0.52); }
            var rw = wide ? 8 : 0, rc0 = wide ? Math.round(cols * 0.5 - rw / 2) : -10;
            if (rw) {
                var bank = hoff[rc0 - 1];
                spans.push({ type: 'river', c0: rc0, cw: rw });
                for (c = rc0; c < rc0 + rw; c++) hoff[c] = bank + 2;
                world.river = { x0: rc0 * B, x1: (rc0 + rw) * B };
            } else world.river = null;
            world.B = B; world.top = [];
            for (c = 0; c < cols; c++) world.top[c] = g0 + hoff[c] * B;

            function fr(x, y, wd, ht, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(wd)), Math.max(1, Math.round(ht))); }

            // far horizon: hazy bands of low land (green on the steppe side, tan over the Gobi)
            var FAR = [{ base: g0 - B * 2.4, col: '#a9dd92', sand: '#ecdcae', ph: 0.6 }, { base: g0 - B * 1.2, col: '#86c46c', sand: '#dcc88a', ph: 2.1 }];
            FAR.forEach(function (L, li) {
                for (c = 0; c < cols; c++) {
                    var hc = Math.round((Math.sin(c * 0.07 + L.ph) + Math.sin(c * 0.023 + L.ph * 2) * 1.4) * 0.5) * B * 0.45, sd = sandAt(c);
                    fr(c * B, L.base - hc, B, g0 + B * 2 - (L.base - hc), sd ? L.sand : L.col);
                    if (!sd && hash(c, li, 41) > 0.9) { fr(c * B + B * 0.35, L.base - hc - B * 0.9, B * 0.3, B * 0.9, '#5a8f46'); fr(c * B, L.base - hc - B * 1.8, B, B, '#4f8a3c'); }
                }
            });
            var haze = g.createLinearGradient(0, g0 - B * 6, 0, g0); haze.addColorStop(0, 'rgba(225,240,255,0)'); haze.addColorStop(1, 'rgba(225,240,255,0.45)');
            g.fillStyle = haze; g.fillRect(0, g0 - B * 6, w, B * 6);

            // ground: green grass cubes, sand cubes in the Gobi
            var GRASS = ['#5fae3a', '#58a533', '#66b840', '#53a02f'], SAND = ['#e8d08e', '#dfc27d', '#ecd699', '#d9bb74'];
            for (c = 0; c < cols; c++) {
                var x = c * B, inRiver = rw && c >= rc0 && c < rc0 + rw, sand = sandAt(c);
                for (r = 0; r * B + world.top[c] < h; r++) {
                    var y = world.top[c] + r * B, n = hash(c, r, 3), n2 = hash(c, r, 8);
                    if (inRiver && r === 0) {
                        fr(x, y, B, B, n < 0.5 ? '#d9c88a' : '#cdbb7c');                                                       // sandy river bed, green cubes below
                        continue;
                    }
                    if (sand) {
                        fr(x, y, B, B, SAND[Math.floor(n * 4) % 4]);
                        fr(x + n2 * B * 0.6, y + n * B * 0.6, B * 0.26, B * 0.26, '#c9aa62');
                        fr(x + (1 - n) * B * 0.6, y + (1 - n2) * B * 0.6, B * 0.2, B * 0.2, '#f4e3ab');
                        if (r === 0) fr(x, y, B, Math.max(2, B * 0.3), '#f4e3ab');
                        if (r < 3 && hoff[c] < (hoff[c + 1] === undefined ? hoff[c] : hoff[c + 1])) fr(x, y, B, B, 'rgba(150,100,40,0.14)');     // shaded side of a dune
                        fr(x, y, B, 1, 'rgba(255,255,255,0.14)'); fr(x + B - 1, y, 1, B, 'rgba(0,0,0,0.16)'); fr(x, y + B - 1, B, 1, 'rgba(0,0,0,0.16)');
                        continue;
                    }
                    fr(x, y, B, B, GRASS[Math.floor(n * 4) % 4]);
                    fr(x + n2 * B * 0.6, y + n * B * 0.6, B * 0.28, B * 0.28, '#3f8a22');
                    fr(x + (1 - n) * B * 0.6, y + (1 - n2) * B * 0.6, B * 0.22, B * 0.22, '#7acb52');
                    if (r === 0) fr(x, y, B, Math.max(2, B * 0.3), '#78cf4e');
                    fr(x, y, B, 1, 'rgba(255,255,255,0.16)'); fr(x, y, 1, B, 'rgba(255,255,255,0.1)');
                    fr(x + B - 1, y, 1, B, 'rgba(0,0,0,0.22)'); fr(x, y + B - 1, B, 1, 'rgba(0,0,0,0.22)');
                }
            }

            // water fills the river channel
            for (c = rc0; c < rc0 + rw; c++) {
                var wt = world.top[rc0 - 1] + B * 0.35;
                fr(c * B, wt, B, world.top[c] - wt, '#3b6fe0');
                fr(c * B, wt, B, B * 0.18, '#6f9bf5');
                if (c % 2) fr(c * B + B * 0.2, wt + B * 0.8, B * 0.6, B * 0.18, '#5b8ff0');
            }

            var LEAF = ['#2f7d32', '#3a8f3a', '#2a6f2c', '#4aa04a'];
            function leaves(x, y, wU, hU) {
                for (var xx = 0; xx < wU * 2; xx++) for (var yy = 0; yy < hU * 2; yy++)
                    fr(x + xx * U / 2, y + yy * U / 2, U / 2 + 1, U / 2 + 1, LEAF[Math.floor(Math.random() * LEAF.length)]);
            }
            function tree(cx, gy, tall) {
                var tw = U * 0.9, th = tall * U;
                fr(cx - tw / 2, gy - th, tw, th, '#6b4a2b'); fr(cx - tw / 2, gy - th, tw * 0.3, th, '#57391f');
                var top = gy - th - U * 2.2;
                leaves(cx - 1.5 * U, top, 3, 1); leaves(cx - 2.5 * U, top + U, 5, 2); leaves(cx - 1.5 * U, top + 3 * U, 3, 1);
            }
            function bush(x, gy) { leaves(x, gy - 1.4 * U, 3, 1.4); }
            function flower(x, gy, col) { fr(x + 1, gy - 8, 2, 8, '#2f7d32'); fr(x - 1, gy - 12, 6, 5, col); fr(x + 1, gy - 10, 2, 2, '#ffd400'); }
            function saxaul(x, gy) {                                       // the dry desert shrub of the Gobi
                fr(x, gy - 1.7 * U, 0.35 * U, 1.7 * U, '#6b5a3a'); fr(x - 0.5 * U, gy - 2.3 * U, 0.3 * U, 1.1 * U, '#6b5a3a');
                fr(x - 0.9 * U, gy - 2.7 * U, 1.2 * U, 0.8 * U, '#8a8a4a'); fr(x + 0.1 * U, gy - 2.3 * U, 1.1 * U, 0.8 * U, '#7a7a3e'); fr(x - 0.3 * U, gy - 3.1 * U, 1.0 * U, 0.7 * U, '#8a8a4a');
            }
            function rock(x, gy) { fr(x, gy - 0.9 * U, 1.4 * U, 0.9 * U, '#8a8070'); fr(x + 0.2 * U, gy - 1.3 * U, 0.8 * U, 0.5 * U, '#9a9080'); }

            // the felt tent (ger): white walls and a round roof, an orange door and a stovepipe
            function ger(x0, gy) {
                var wd = 8 * U, wh = 3.2 * U, cxm = x0 + wd / 2, k, rows = 7;
                for (k = 0; k < 6; k++) fr(x0, gy - wh + k * wh / 6, wd, wh / 6 + 1, k % 2 ? '#f1ecdf' : '#f6f2e7');
                for (k = 1; k < 8; k++) fr(x0 + k * U, gy - wh, 1, wh, 'rgba(0,0,0,0.07)');
                fr(x0, gy - wh * 0.62, wd, 3, '#6b4a2b'); fr(x0, gy - wh * 0.28, wd, 3, '#6b4a2b');            // the ropes round the wall
                fr(x0, gy - wh, wd, U * 0.28, '#1f4aa3'); for (k = 0; k < 8; k++) fr(x0 + k * U + U * 0.35, gy - wh + U * 0.08, U * 0.3, U * 0.12, '#ffd24a');
                for (k = 0; k < rows; k++) {
                    var rw2 = (wd + U) * (1 - k / (rows + 0.9));
                    fr(cxm - rw2 / 2, gy - wh - (k + 1) * U * 0.5, rw2, U * 0.5 + 1, k % 2 ? '#ece5d3' : '#f3eddc');
                    fr(cxm - rw2 / 2, gy - wh - k * U * 0.5 - 2, rw2, 2, 'rgba(0,0,0,0.12)');
                }
                var topY = gy - wh - rows * U * 0.5;
                fr(cxm - U * 0.7, topY - U * 0.35, U * 1.4, U * 0.5, '#a0522d'); fr(cxm - U * 0.25, topY - U * 0.7, U * 0.5, U * 0.4, '#6b3418');   // the crown (toono)
                fr(cxm + 1.2 * U, topY - 0.6 * U, 0.45 * U, 2.4 * U, '#3b3b3b');                                                                  // stovepipe
                world.chimney = { x: cxm + 1.2 * U + 0.22 * U, y: topY - 0.6 * U, U: U };
                var dw = 1.7 * U, dh = 2.3 * U, dx = cxm - dw / 2;
                fr(dx - 3, gy - dh - 3, dw + 6, dh + 3, '#8b2e0f'); fr(dx, gy - dh, dw, dh, '#d4501e');
                fr(dx + dw / 2 - 1, gy - dh, 2, dh, '#8b2e0f'); fr(dx + 0.25 * U, gy - dh + 0.3 * U, 0.3 * U, 0.3 * U, '#ffd24a'); fr(dx + dw - 0.55 * U, gy - dh + 0.3 * U, 0.3 * U, 0.3 * U, '#ffd24a');
                fr(dx + dw * 0.5 - 0.15 * U, gy - dh * 0.45, 0.3 * U, 0.3 * U, '#ffd24a');
            }

            // a herder's well: a wooden shaft with a pulley frame; the bucket, the herder and the trough are animated every frame
            function herderWell(wx, gy) {
                fr(wx - U, gy, 2 * U, 3.8 * U, '#1b140e');
                fr(wx - U, gy, 0.22 * U, 3.8 * U, '#6b4a2b'); fr(wx + U - 0.22 * U, gy, 0.22 * U, 3.8 * U, '#6b4a2b');
                fr(wx - 0.78 * U, gy + 3.1 * U, 1.56 * U, 0.7 * U, '#2f5fc4'); fr(wx - 0.78 * U, gy + 3.1 * U, 1.56 * U, 0.12 * U, '#6f9bf5');
                fr(wx - 1.5 * U, gy - 0.9 * U, 3 * U, 0.45 * U, '#8b5a2b'); fr(wx - 1.5 * U, gy - 0.45 * U, 3 * U, 0.45 * U, '#7a4a24');
                for (var k = 0; k < 3; k++) { fr(wx - 1.5 * U + k * U, gy - 0.9 * U, 2, 0.9 * U, '#5a3418'); }
                function post(x1, y1, x2, y2) { var n = 16; for (var q = 0; q <= n; q++) { var t = q / n; fr(x1 + (x2 - x1) * t - 0.2 * U, y1 + (y2 - y1) * t, 0.4 * U, (y1 - y2) / n + 2, '#7a4a24'); } }
                post(wx - 1.8 * U, gy - 0.9 * U, wx, gy - 5.4 * U); post(wx + 1.8 * U, gy - 0.9 * U, wx, gy - 5.4 * U);
                fr(wx - 0.5 * U, gy - 5.9 * U, U, U, '#cfcfcf'); fr(wx - 0.2 * U, gy - 5.6 * U, 0.4 * U, 0.4 * U, '#555');
                world.well = { x: wx, gy: gy, U: U };
            }

            function inSpan(col, pad) { return spans.some(function (s) { return col >= s.c0 - pad && col <= s.c0 + s.cw + pad; }); }
            // trees and bushes on the steppe, shrubs and stones in the desert
            for (c = 2; c < cols - 2; c += Math.round(rand(7, 13))) {
                if (inSpan(c, 4) || sandAt(c)) continue;
                if (Math.random() < 0.75) tree(c * B + B / 2, world.top[c], 4 + Math.floor(Math.random() * 2)); else bush(c * B, world.top[c]);
            }
            for (c = 1; c < cols - 1; c++) {
                var q = hash(c, 5, 9);
                if (sandAt(c)) {
                    if (c > dsC + 3 && q > 0.94) saxaul(c * B, world.top[c]);
                    else if (q < 0.05) rock(c * B, world.top[c]);
                    continue;
                }
                if (inSpan(c, 1)) continue;
                if (q > 0.93) flower(c * B + 3, world.top[c], q > 0.97 ? '#d7263d' : '#ffffff');
                else if (q < 0.04) bush(c * B, world.top[c]);
            }
            var gerX0 = 0, troughX0 = 0, troughX1 = 0;
            spans.forEach(function (s) {
                if (s.type === 'river') return;
                var gy = world.top[s.c0 + (s.cw >> 1)], sx = s.c0 * B;
                if (s.type === 'ger') { gerX0 = sx + U; ger(gerX0, gy); }
                else { var wx = sx + 5.2 * U; herderWell(wx, gy); troughX0 = wx + 2.8 * U; troughX1 = troughX0 + 7 * U; }
            });

            world.c = cv;
            // livestock at the trough, a horse near the ger, a Gobi bear (mazaalai) in the desert
            var mk = function (kind, reg) { return { kind: kind, region: reg, x: rand(reg[0], reg[1]), dir: Math.random() < 0.5 ? -1 : 1, face: 1, t: rand(0.5, 4), sp: rand(8, 18), ph: rand(0, 6) }; };
            world.animals = [
                mk('horse', [Math.max(40, gerX0 - U), gerX0 + 14 * U]),
                mk('sheep', [troughX0 - 2 * U, troughX1 + 3 * U]), mk('sheep', [troughX0 - 2 * U, troughX1 + 3 * U]), mk('goat', [troughX0 - 2 * U, troughX1 + 3 * U]),
                mk('bear', [(dsC + 8) * B, w - 30])
            ];
            world.troughX0 = troughX0;
        }

        var SHEEP = [[-2.6, -3.7, 5.2, 3, '#f2f2f2'], [-2.6, -1.3, 5.2, 0.7, '#d4d4d4'], [-2.2, -4.1, 1.4, 0.5, '#fafafa'], [0, -4.1, 1.6, 0.5, '#fafafa'],
            [2.4, -3.4, 1.9, 1.9, '#c9ae8b'], [3.7, -2.9, 0.35, 0.35, '#222'], [2.3, -3.6, 0.5, 0.5, '#b89a76']];
        var GOAT = [[-2.4, -3.6, 4.8, 2.9, '#c4b08f'], [-2.4, -1.4, 4.8, 0.7, '#a8946f'], [2.2, -4.4, 2, 2.1, '#b09a78'], [3.7, -3.4, 0.9, 1, '#cdbb9b'],
            [2.5, -5.5, 0.4, 1.1, '#f0e8d8'], [3.3, -5.5, 0.4, 1.1, '#f0e8d8'], [3.9, -2.4, 0.35, 0.9, '#8d7a62'], [3.5, -4, 0.35, 0.35, '#222'], [-2.8, -3.8, 0.5, 0.9, '#a8946f']];
        var HORSE = [[-3.2, -4.4, 6.4, 3.1, '#8b5a2b'], [-3.2, -1.6, 6.4, 0.6, '#6e4520'], [2.7, -6.4, 1.7, 3.3, '#8b5a2b'], [3.5, -6.6, 2.5, 1.6, '#7d4f24'],
            [5.3, -5.7, 0.8, 1, '#c9a27a'], [4, -6.2, 0.3, 0.3, '#111'], [2.5, -7, 0.7, 2.2, '#3b2a18'], [-3.8, -4.3, 0.7, 2.4, '#3b2a18'], [-1.5, -4.7, 3, 0.4, '#7d4f24']];
        var BEAR = [[-3, -3.6, 6, 3, '#6b4a2e'], [-1.8, -4.5, 3.2, 1, '#6b4a2e'], [2.7, -4.3, 2.4, 2.4, '#6b4a2e'], [4.6, -3.4, 1.1, 1.2, '#b89870'],
            [5.4, -3.3, 0.4, 0.4, '#111'], [3.1, -4.8, 0.8, 0.6, '#5a3d22'], [4, -3.9, 0.3, 0.3, '#111'], [-3.2, -3.9, 0.7, 0.7, '#5a3d22']];
        var KINDS = {
            bear: { body: BEAR, legs: [-2.6, -1.6, 1.2, 2.2], lw: 0.95, lh: 1.3, col: '#5a3d22', k: 1.15 },
            sheep: { body: SHEEP, legs: [-2.1, -1.2, 0.9, 1.8], lw: 0.55, lh: 0.8, col: '#6b6b6b', k: 1.15 },
            goat: { body: GOAT, legs: [-2.1, -1.2, 0.9, 1.8], lw: 0.5, lh: 0.8, col: '#8d7a62', k: 1.15 },
            horse: { body: HORSE, legs: [-2.9, -2, 1.9, 2.8], lw: 0.6, lh: 1.9, col: '#6e4520', k: 1.25 }
        };
        function drawAnimals(dt, rise) {
            world.animals.forEach(function (a) {
                var kd = KINDS[a.kind], u = Math.round(world.B * kd.k);
                a.t -= dt;
                if (a.t <= 0) { a.t = rand(2, 6); a.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); a.sp = rand(8, 18); }
                a.x += a.dir * a.sp * dt;
                var lo = a.region ? a.region[0] : 20, hi = a.region ? a.region[1] : w - 20;
                if (a.x < lo) { a.x = lo; a.dir = 1; } if (a.x > hi) { a.x = hi; a.dir = -1; }
                var rv = world.river;
                if (rv && a.x > rv.x0 - 14 && a.x < rv.x1 + 14) { var left = a.x < (rv.x0 + rv.x1) / 2; a.x = left ? rv.x0 - 14 : rv.x1 + 14; a.dir = left ? -1 : 1; }
                if (a.dir) a.face = a.dir;
                ctx.save(); ctx.translate(Math.round(a.x), Math.round(topY(a.x) + rise)); if (a.face < 0) ctx.scale(-1, 1);
                kd.body.forEach(function (p) { ctx.fillStyle = p[4]; ctx.fillRect(Math.round(p[0] * u), Math.round(p[1] * u), Math.max(1, Math.round(p[2] * u)), Math.max(1, Math.round(p[3] * u))); });
                var sw = a.dir ? Math.sin(T * 7 + a.ph) * 0.25 : 0;
                kd.legs.forEach(function (lx, k) {
                    ctx.fillStyle = kd.col;
                    ctx.fillRect(Math.round((lx + (k % 2 ? sw : -sw)) * u), Math.round(-(kd.lh - 0.1) * u), Math.round(kd.lw * u), Math.round(kd.lh * u));
                });
                ctx.restore();
            });
        }

        // the herder draws water: lowers the bucket, pulls it up hand over hand, pours it into the trough (onggots) for the livestock
        function drawWell() {
            var wl = world.well;
            if (!wl) return;
            var U = wl.U, x = wl.x, gy = wl.gy + world.rise, py = gy - 5.4 * U;
            var ph = (T % 9) / 9, depth = 0, pour = 0;
            if (ph < 0.28) depth = ph / 0.28; else if (ph < 0.38) depth = 1; else if (ph < 0.78) depth = 1 - (ph - 0.38) / 0.4; else if (ph < 0.94) pour = (ph - 0.78) / 0.16;
            var bucketY = lerp(gy - 3.2 * U, gy + 2.7 * U, ease(depth)), pulling = ph >= 0.38 && ph < 0.78;
            var hx = x - 3.4 * U, handX = hx + 0.95 * U, handY = gy - 3.9 * U + (1 - depth) * 1.5 * U + (pulling ? Math.sin(T * 6) * 0.25 * U : 0);

            // trough
            var tx = x + 2.8 * U, tl = 7 * U, level = ph < 0.78 ? lerp(1, 0.35, ph / 0.78) : lerp(0.35, 1, clamp((ph - 0.78) / 0.16, 0, 1));
            ctx.fillStyle = '#7a5230'; ctx.fillRect(Math.round(tx), Math.round(gy - 1.3 * U), Math.round(tl), Math.round(1.3 * U));
            ctx.fillStyle = '#5a3a1e'; ctx.fillRect(Math.round(tx), Math.round(gy - 1.3 * U), Math.round(0.35 * U), Math.round(1.3 * U)); ctx.fillRect(Math.round(tx + tl - 0.35 * U), Math.round(gy - 1.3 * U), Math.round(0.35 * U), Math.round(1.3 * U));
            ctx.fillStyle = '#2b1d10'; ctx.fillRect(Math.round(tx + 0.35 * U), Math.round(gy - 1.1 * U), Math.round(tl - 0.7 * U), Math.round(0.9 * U));
            ctx.fillStyle = '#3b6fe0'; var wh = 0.9 * U * level; ctx.fillRect(Math.round(tx + 0.35 * U), Math.round(gy - 0.2 * U - wh), Math.round(tl - 0.7 * U), Math.round(wh));
            ctx.fillStyle = '#6f9bf5'; ctx.fillRect(Math.round(tx + 0.35 * U), Math.round(gy - 0.2 * U - wh), Math.round(tl - 0.7 * U), 2);
            ctx.fillStyle = '#5a3a1e'; ctx.fillRect(Math.round(tx + 0.6 * U), Math.round(gy), Math.round(0.5 * U), Math.round(0.35 * U)); ctx.fillRect(Math.round(tx + tl - 1.1 * U), Math.round(gy), Math.round(0.5 * U), Math.round(0.35 * U));

            // ropes
            ctx.strokeStyle = '#d9c9a0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x - 0.3 * U, py); ctx.lineTo(handX, handY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + 0.2 * U, py); ctx.lineTo(x + 0.2 * U, bucketY); ctx.stroke();
            // bucket (full when it comes up), and the stream it pours towards the trough
            var bx = x + 0.2 * U - 0.45 * U;
            ctx.fillStyle = '#7a4a24'; ctx.fillRect(Math.round(bx), Math.round(bucketY), Math.round(0.9 * U), Math.round(0.9 * U));
            ctx.fillStyle = '#4a2a12'; ctx.fillRect(Math.round(bx), Math.round(bucketY + 0.3 * U), Math.round(0.9 * U), Math.round(0.12 * U));
            if (depth < 0.9 && pour < 1 && ph > 0.3) { ctx.fillStyle = '#6f9bf5'; ctx.fillRect(Math.round(bx + 3), Math.round(bucketY), Math.round(0.9 * U - 6), 3); }
            if (pour > 0) {
                ctx.fillStyle = '#6f9bf5';
                for (var k = 0; k < 9; k++) ctx.fillRect(Math.round(bx + 0.9 * U + k * 0.27 * U), Math.round(bucketY + 0.3 * U + k * k * 0.07 * U), 3, 6);
            }

            // the herder in a blue deel, red sash and a pointed hat, arms on the rope
            var q = function (dx, dy, wd, ht, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(hx + dx * U), Math.round(gy + dy * U), Math.max(1, Math.round(wd * U)), Math.max(1, Math.round(ht * U))); };
            q(-0.45, -0.5, 0.4, 0.5, '#2b1b10'); q(0.05, -0.5, 0.4, 0.5, '#2b1b10');
            q(-0.55, -2.8, 1.1, 2.4, '#1f4aa3'); q(-0.55, -1.7, 1.1, 0.28, '#d7263d'); q(-0.55, -2.8, 1.1, 0.18, '#ffd24a');
            q(-0.4, -3.6, 0.8, 0.8, '#e0b087'); q(0.2, -3.35, 0.15, 0.15, '#111');
            q(-0.55, -4.05, 1.1, 0.5, '#c1121f'); q(-0.3, -4.6, 0.6, 0.6, '#c1121f'); q(-0.1, -4.85, 0.2, 0.25, '#ffd900');
            ctx.strokeStyle = '#1f4aa3'; ctx.lineWidth = Math.max(2, 0.38 * U);
            ctx.beginPath(); ctx.moveTo(hx + 0.3 * U, gy - 2.6 * U); ctx.lineTo(handX, handY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(hx + 0.3 * U, gy - 2.5 * U); ctx.lineTo(handX - 0.1 * U, handY + 0.8 * U); ctx.stroke();
            ctx.fillStyle = '#e0b087'; ctx.fillRect(Math.round(handX - 0.2 * U), Math.round(handY - 0.2 * U), Math.round(0.4 * U), Math.round(0.4 * U));
            ctx.fillRect(Math.round(handX - 0.3 * U), Math.round(handY + 0.6 * U), Math.round(0.4 * U), Math.round(0.4 * U));
        }

        // smoke curling out of the ger's stovepipe
        function drawSmoke() {
            var ch = world.chimney;
            if (!ch) return;
            for (var i = 0; i < 6; i++) {
                var age = ((T * 0.28 + i / 6) % 1), s = ch.U * (0.35 + age * 0.7);
                ctx.globalAlpha *= 1;
                ctx.fillStyle = 'rgba(225,225,225,' + (0.55 * (1 - age)) + ')';
                ctx.fillRect(Math.round(ch.x + Math.sin(age * 7 + i) * ch.U * 0.5 - s / 2), Math.round(ch.y + world.rise - age * 4.2 * ch.U), Math.round(s), Math.round(s));
            }
        }

        function drawWorld(day, dt) {
            if (!world.c || prog < 0.36) return;
            var rise = (1 - sstep(0.36, 0.62, prog)) * h * 0.22;
            ctx.globalAlpha = sstep(0.4, 0.56, prog);
            ctx.drawImage(world.c, 0, Math.round(rise), w, h);
            world.rise = rise;
            drawAnimals(dt, rise);
            drawWell();
            drawSmoke();
            ctx.globalAlpha = 1;
        }

        function drawSunAndSparks(dt) {
            var i, sr;
            // the sun: a square, like the one in the Minecraft sky
            sr = sunR();
            sunPulse = Math.max(0, sunPulse - dt * 1.6);
            if (T >= nextFlare) { sunBurst(1, true); nextFlare = T + rand(7, 14); }
            sr = Math.round(sr * (1 + 0.14 * sunPulse) / 3) * 3;
            for (i = 4; i >= 1; i--) {
                ctx.fillStyle = 'rgba(255,170,60,' + (0.018 * (5 - i)) + ')';
                var gs = sr * (1 + i * 0.55); ctx.fillRect(geo.cx - gs, geo.cy - gs, gs * 2, gs * 2);
            }
            px(geo.cx - sr, geo.cy - sr, sr * 2, sr * 2, '#ff9b1f');
            px(geo.cx - sr + 3, geo.cy - sr + 3, sr * 2 - 6, sr * 2 - 6, '#ffc83d');
            px(geo.cx - sr * 0.6, geo.cy - sr * 0.6, sr * 1.2, sr * 1.2, '#fff3a6');

            // flare sparks fly off in every direction and fade
            for (i = sparks.length - 1; i >= 0; i--) {
                var sp2 = sparks[i];
                sp2.life += dt; if (sp2.life >= sp2.max) { sparks.splice(i, 1); continue; }
                sp2.x += sp2.vx * dt; sp2.y += sp2.vy * dt; sp2.vx *= 0.995; sp2.vy *= 0.995;
                ctx.globalAlpha = (1 - sp2.life / sp2.max) * 0.95;
                ctx.fillStyle = sp2.c;
                ctx.fillRect(Math.round(sp2.x), Math.round(sp2.y), sp2.s, sp2.s);
            }
            ctx.globalAlpha = 1;

        }

        function draw(dt) {
            ctx.clearRect(0, 0, w, h);
            var sy = getScroll(), i;
            prog += (getProgress() - prog) * Math.min(1, dt * 3.2);
            var approach = ease(clamp((prog - 0.04) / 0.3, 0, 1)), day = sstep(0.34, 0.5, prog), zoom = 1 + approach * 2.2;

            stars.forEach(function (s) {
                var y = Math.floor((((s.y - sy * s.z * 0.15) % h) + h) % h);
                var zx = w / 2 + (s.x - w / 2) * zoom, zy = h / 2 + (y - h / 2) * zoom;       // flying towards the Earth: the stars stream outwards
                if (zx < 0 || zx > w || zy < 0 || zy > h) return;
                ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(T * 0.6 * s.s + s.tw))) * s.z;
                ctx.fillStyle = '#fff';
                var sz = s.s > 0.8 ? 3 : 2;
                ctx.fillRect(Math.round(zx), Math.round(zy), sz, sz);
            });
            ctx.globalAlpha = 1;

            // galaxies: big and small, crossing each other's paths behind the solar system
            for (i = galaxies.length - 1; i >= 0; i--) {
                var ga = galaxies[i];
                ga.x += ga.vx * dt * speed; ga.y += ga.vy * dt * speed; ga.rot += ga.vr * dt * speed; ga.age += dt;
                var lim = ga.R * 1.6;
                if (ga.age > 4 && (ga.x < -lim || ga.x > w + lim || ga.y < -lim || ga.y > h + lim)) { galaxies.splice(i, 1); spawnGalaxy(false); continue; }
                ctx.save(); ctx.translate(Math.round(ga.x), Math.round(ga.y)); ctx.rotate(ga.rot); ctx.scale(1, ga.squash);
                ctx.globalAlpha = ga.alpha * clamp(ga.age / 3, 0, 1);
                ctx.drawImage(ga.sp.c, -ga.sp.w / 2, -ga.sp.h / 2, ga.sp.w, ga.sp.h);
                ctx.restore();
            }
            ctx.globalAlpha = 1;

            // dotted orbits
            ctx.fillStyle = 'rgba(160,180,255,0.20)';
            PLANETS.forEach(function (p) {
                var a = geo.a * p.f, b = a * geo.k, steps = Math.round(a / 5);
                for (i = 0; i < steps; i++) {
                    var th = i / steps * 6.2832, x = Math.cos(th) * a, y = Math.sin(th) * b;
                    ctx.fillRect(Math.round(geo.cx + x * Math.cos(TILT) - y * Math.sin(TILT)), Math.round(geo.cy + x * Math.sin(TILT) + y * Math.cos(TILT)), 2, 2);
                }
            });

            ctx.font = '15px VT323, monospace';
            PLANETS.forEach(function (p) {
                var q = planetPos(p, T);
                ctx.drawImage(p.sprite.c, Math.round(q.x - p.sprite.w / 2), Math.round(q.y - p.sprite.h / 2), p.sprite.w, p.sprite.h);
                ctx.fillStyle = 'rgba(220,228,255,0.6)';
                ctx.fillText(p.name, Math.round(q.x + p.sprite.w / 2 + 4), Math.round(q.y + 4));
            });
            var m = moonPos(T);
            px(Math.round(m.x) - 3, Math.round(m.y) - 3, 6, 6, '#d6d6d6'); px(Math.round(m.x), Math.round(m.y), 3, 3, '#8d8d8d');

            // tumbling cobblestone
            rocks.forEach(function (r) {
                r.x += r.vx * dt * speed; r.y += r.vy * dt * speed; r.rot += r.vr * dt * speed;
                if (r.x < -0.05) r.x = 1.05; if (r.x > 1.05) r.x = -0.05;
                if (r.y < -0.05) r.y = 1.05; if (r.y > 1.05) r.y = -0.05;
                ctx.save(); ctx.translate(r.x * w, r.y * h); ctx.rotate(r.rot); ctx.globalAlpha = 0.7 * r.z;
                px(-r.s / 2, -r.s / 2, r.s, r.s, '#7d7d7d'); px(-r.s / 2 + 3, -r.s / 2 + 3, r.s - 6, r.s - 6, '#a0a0a0');
                ctx.restore();
            });
            ctx.globalAlpha = 1;

            // Steve and a Creeper drift by, slowly tumbling
            floaters.forEach(function (f) {
                f.x += f.vx * dt * speed; f.y += f.vy * dt * speed; f.rot += f.vr * dt * speed;
                if (f.x < -0.06) f.x = 1.06; if (f.x > 1.06) f.x = -0.06;
                if (f.y < -0.06) f.y = 1.06; if (f.y > 1.06) f.y = -0.06;
                drawSprite(f.sp, f.x * w, f.y * h + Math.sin(T * 0.8 + f.x * 9) * 6, f.rot, 0.9);
            });

            for (i = flames.length - 1; i >= 0; i--) {
                var f2 = flames[i];
                f2.life += dt; if (f2.life >= f2.max) { flames.splice(i, 1); continue; }
                f2.x += f2.vx * dt; f2.y += f2.vy * dt;
                var k = f2.life / f2.max;
                ctx.globalAlpha = (1 - k) * 0.85;
                ctx.fillStyle = k < 0.35 ? '#ffd25a' : (k < 0.6 ? '#ff7a2a' : '#9aa0b8');
                ctx.fillRect(Math.round(f2.x), Math.round(f2.y), f2.s, f2.s);
            }
            ctx.globalAlpha = 1;
            drawRocket();

            if (flash) {
                var fk = (T - flash.t) / 1.1;
                if (fk >= 1) flash = null;
                else {
                    ctx.strokeStyle = 'rgba(255,235,160,' + (1 - fk) + ')'; ctx.lineWidth = 3;
                    var rr = 8 + fk * 40; ctx.strokeRect(Math.round(flash.x - rr), Math.round(flash.y - rr), rr * 2, rr * 2);
                }
            }

            // the descent: the Earth rises from below, then the sky turns blue and the blocky world appears. The sun stays.
            drawEarth(clamp((prog - 0.06) / 0.28, 0, 1), day);
            drawSky(day);
            drawSunAndSparks(dt);
            drawClouds(day, dt);
            drawBirds(day, dt);
            drawWorld(day, dt);
        }

        function loop(now) {
            if (!root.isConnected) { window.removeEventListener('resize', resize); return; }
            var dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            T += dt * speed;
            stepRocket(); emitFlames();
            draw(dt);
            requestAnimationFrame(loop);
        }
        window.addEventListener('resize', resize);
        resize();
        requestAnimationFrame(loop);
    }

    /* =====================================================================
       Hero cube (also the docked companion cube)
       ===================================================================== */

    function initHeroCube(host, dock, slot, app, navEl, chapterIds, scrollToChapter) {
        var cubeEl = dock.querySelector('.rc-hcube');
        var statusEl = host.querySelector('.rc-hstatus');
        var autoBtn = host.querySelector('[data-act=auto]');

        /* --- 27 cubies --- */
        var cubies = [], x, y, z;
        for (x = -1; x <= 1; x++) for (y = -1; y <= 1; y++) for (z = -1; z <= 1; z++) {
            var cb = { p: [x, y, z], R: IDENT(), stickers: [], el: document.createElement('div') };
            cb.el.className = 'rc-cubie';
            SIDE_KEYS.forEach(function (k) {
                var n = SIDES[k].n;
                var on = (n[0] && n[0] === cb.p[0]) || (n[1] && n[1] === cb.p[1]) || (n[2] && n[2] === cb.p[2]);
                var f = document.createElement('div');
                f.className = 'rc-face' + (on ? ' rc-sticker' : '');
                f.style.transform = SIDES[k].css + ' translateZ(calc(var(--s) / 2))';
                if (on) {
                    var fi = FACES[k];
                    f.style.setProperty('--c', fi.color);
                    f.dataset.cubie = String(cubies.length);
                    f.dataset.side = k;
                    if (Math.abs(cb.p[0]) + Math.abs(cb.p[1]) + Math.abs(cb.p[2]) === 1) {
                        f.classList.add('rc-centre');
                        f.style.setProperty('--ink', fi.ink);
                        f.innerHTML = '<span class="rc-centre-ico">' + fi.icon + '</span><span class="rc-centre-lbl">' + esc(fi.label) + '</span>';
                    }
                    cb.stickers.push({ n: n, color: k });
                }
                cb.el.appendChild(f);
            });
            cubeEl.appendChild(cb.el);
            cubies.push(cb);
        }

        // the centre cubie of every colour (slice turns can carry it away from its home face)
        var centres = {};
        cubies.forEach(function (c) {
            SIDE_KEYS.forEach(function (k) { if (same(c.p, SIDES[k].n)) centres[k] = c; });
        });
        function faceFor(k) {
            var nW = roundVec(apply(centres[k].R, SIDES[k].n));
            for (var i = 0; i < SIDE_KEYS.length; i++) if (same(SIDES[SIDE_KEYS[i]].n, nW)) return SIDE_KEYS[i];
            return k;
        }

        function fx(power) {
            Sound.crunch(power);
            host.dispatchEvent(new CustomEvent('rc-crunch', { bubbles: true, detail: { power: power } }));
        }

        /* --- rendering --- */
        var S = 90;
        var M = mul(rotMat(0, -26 * DEG), rotMat(1, -38 * DEG));
        var anim = null;

        function measure() {
            S = clamp(Math.min(dock.clientWidth * 0.23, dock.clientHeight * 0.24), 44, 104);
            dock.style.setProperty('--s', S + 'px');
            draw();
        }
        function place(cb) {
            var R = cb.R, p = cb.p;
            if (anim && anim.cubies.indexOf(cb) !== -1) {
                var Q = rotMat(anim.axis, anim.angle);
                R = mul(Q, R); p = apply(Q, p);
            }
            cb.el.style.transform = cssMatrix(R, p[0] * S, p[1] * S, p[2] * S);
        }
        function draw() { cubies.forEach(place); cubeEl.style.transform = cssMatrix(M, 0, 0, 0); }
        function drawCamOnly() { cubeEl.style.transform = cssMatrix(M, 0, 0, 0); }

        /* --- model --- */
        var history = [], queue = [];
        var running = false, userBusy = false, autoTurn = true, wasScrambled = true;

        function pushHistory(m) {
            var last = history[history.length - 1];
            if (last && last.axis === m.axis && last.layer === m.layer && last.dir === -m.dir) history.pop();
            else history.push(m);
        }
        function applyMove(m, record) {
            var Q = rotMat(m.axis, m.dir * HALF_PI);
            cubies.forEach(function (c) {
                if (c.p[m.axis] === m.layer) { c.R = roundMat(mul(Q, c.R)); c.p = roundVec(apply(Q, c.p)); }
            });
            if (record !== false) pushHistory(m);
        }
        function randomMove(prev) {
            var m;
            do {
                m = { axis: Math.floor(Math.random() * 3), layer: [-1, 1][Math.floor(Math.random() * 2)], dir: Math.random() < 0.5 ? -1 : 1 };
            } while (prev && prev.axis === m.axis && prev.layer === m.layer);
            return m;
        }
        function enqueue(m, ms, record) {
            queue.push({ m: m, ms: ms, record: record !== false });
            if (!running) next();
        }
        var epoch = 0, current = null;
        function finishAllNow() {                       // snap the running + queued automatic turns to their end state
            if (userBusy) return;
            epoch++;
            if (current) { applyMove(current.m, current.record); current = null; }
            queue.forEach(function (job) { applyMove(job.m, job.record); });
            queue = []; anim = null; running = false;
            draw(); settle();
        }
        function next() {
            var job = queue.shift();
            if (!job) { running = false; anim = null; current = null; settle(); return; }
            running = true; current = job;
            fx(0.7);
            var myEpoch = epoch;
            var m = job.m, t0 = performance.now();
            var group = cubies.filter(function (c) { return c.p[m.axis] === m.layer; });
            (function step(now) {
                if (myEpoch !== epoch) return;
                var t = clamp((now - t0) / job.ms, 0, 1);
                anim = { cubies: group, axis: m.axis, angle: m.dir * HALF_PI * ease(t) };
                if (t < 1) { draw(); requestAnimationFrame(step); return; }
                applyMove(m, job.record);
                anim = null; current = null; draw(); next();
            })(t0);
        }

        function sideSolved(k) {
            var n = SIDES[k].n, ok = true, total = 0;
            cubies.forEach(function (c) {
                if (c.p[0] * n[0] + c.p[1] * n[1] + c.p[2] * n[2] !== 1) return;
                c.stickers.forEach(function (st) {
                    if (same(roundVec(apply(c.R, st.n)), n)) { total++; if (st.color !== k) ok = false; }
                });
            });
            return total === 9 && ok;
        }
        var toastTimer;
        function say(msg) {
            var el = host.querySelector('.rc-htoast');
            el.textContent = msg; el.classList.add('rc-on');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { el.classList.remove('rc-on'); }, 2800);
        }
        function settle() {
            var n = 0;
            SIDE_KEYS.forEach(function (k) { if (sideSolved(k)) n++; });
            statusEl.textContent = 'Faces solved: ' + n + ' / 6';
            statusEl.classList.toggle('rc-all', n === 6);
            if (n === 6 && wasScrambled) { wasScrambled = false; history.length = 0; say('Cube solved ✨'); }
        }

        function scramble(animated) {
            if (running || queue.length || userBusy) return;
            var prev = null, i, m;
            wasScrambled = true;
            for (i = 0; i < 24; i++) {
                m = randomMove(prev); prev = m;
                if (animated) enqueue(m, 150); else applyMove(m);
            }
            if (!animated) { draw(); settle(); }
        }
        function solve() {
            if (running || queue.length || userBusy) return;
            if (!history.length) { say('Already solved'); return; }
            autoTurn = false; autoBtn.setAttribute('aria-pressed', 'false');
            var moves = history.slice().reverse().map(function (m) { return { axis: m.axis, layer: m.layer, dir: -m.dir }; });
            var ANIM = 40, instant = Math.max(0, moves.length - ANIM);
            moves.slice(0, instant).forEach(function (m) { applyMove(m, false); });
            history = [];
            draw();
            var rest = moves.slice(instant);
            var ms = clamp(2800 / Math.max(rest.length, 1), 90, 260);
            wasScrambled = true;
            rest.forEach(function (m) { enqueue(m, ms, false); });
            if (!rest.length) settle();
        }

        /* --- dock: the cube follows the scroll to the bottom-right corner and faces the chapter being read --- */
        var dockP = 0, curFace = null, curId = null;
        var sizeKey = '';

        function updateDock() {
            var ar = app.getBoundingClientRect(), sr = slot.getBoundingClientRect();
            var phone = ar.width < 900, w, h, bx, by;
            if (phone) { w = Math.round(ar.width * 0.94); h = Math.round(ar.height * 0.38); bx = (ar.width - w) / 2; by = ar.height - h - 8; }
            else { w = Math.round(slot.offsetWidth); h = Math.round(slot.offsetHeight); bx = sr.left - ar.left; by = sr.top - ar.top; }
            if (w < 40 || h < 40) return;
            var key = w + 'x' + h;
            if (key !== sizeKey) { sizeKey = key; dock.style.width = w + 'px'; dock.style.height = h + 'px'; measure(); }
            var raw = clamp(app.scrollTop / (ar.height * (phone ? 0.3 : 0.5)), 0, 1);
            dockP = ease(raw);
            var dsz = ar.width < 700 ? 124 : clamp(ar.width * 0.14, 150, 200);
            var k = dsz / Math.max(w, h);
            var dx = ar.width - w * k - 14, dy = ar.height - h * k - 14;
            var px = lerp(bx, dx, dockP), py = lerp(by, dy, dockP);
            dock.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) scale(' + lerp(1, k, dockP).toFixed(4) + ')';
            dock.classList.toggle('rc-docked', dockP > 0.9);

            var cur = null;
            chapterIds.forEach(function (id) {
                var el = document.getElementById('rc-sec-' + id);
                if (el && el.getBoundingClientRect().top - ar.top <= ar.height * 0.45) cur = id;
            });
            if (cur !== curId) {
                curId = cur;
                navEl.querySelectorAll('.rc-lchip').forEach(function (b) { b.classList.toggle('rc-cur', b.dataset.go === cur); });
            }
            curFace = cur ? ID_TO_SIDE[cur] : null;
        }
        app.addEventListener('scroll', updateDock, { passive: true });
        // wheel over the docked cube still scrolls the page
        dock.addEventListener('wheel', function (e) { app.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });

        /* --- camera: auto spin, trackball with inertia, turn-to-face when docked --- */
        var vel = { x: 0, y: 0 };
        var dragging = false, hovering = false;
        var NEAR = 110;                                  // px around the cube in which the pointer freezes the automatic motion
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch' || !dock.isConnected) return;
            var r = dock.getBoundingClientRect();
            hovering = e.clientX > r.left - NEAR && e.clientX < r.right + NEAR && e.clientY > r.top - NEAR && e.clientY < r.bottom + NEAR;
        }, { passive: true });
        document.addEventListener('pointerleave', function () { hovering = false; });
        var lastInput = performance.now() - 5000;
        var lastAutoTurn = performance.now();

        function rollBy(dx, dy) { M = orthonormalize(mul(mul(rotMat(0, dy), rotMat(1, dx)), M)); }
        function rotateToward(Mt, frac) {
            var aa = axisAngleOf(mul(Mt, transpose(M)));
            if (aa.a < 1e-3) { M = Mt; return; }
            M = orthonormalize(mul(rodrigues(aa.ax, aa.a * frac), M));
        }

        (function tick(now) {
            if (!host.isConnected) return;
            var heroMode = dockP < 0.02;
            if (!dragging && !userBusy) {
                if (Math.abs(vel.x) > 1e-5 || Math.abs(vel.y) > 1e-5) {
                    rollBy(vel.x, vel.y); vel.x *= 0.94; vel.y *= 0.94; drawCamOnly();
                } else if (heroMode) {
                    if (!REDUCED && !hovering && now - lastInput > 1800) { rollBy(0.0042, 0.0011); drawCamOnly(); }
                } else if (curFace && now - lastInput > 1200) {
                    rotateToward(faceMatrix(faceFor(curFace)), 0.07); drawCamOnly();
                }
            }
            if (heroMode && autoTurn && !hovering && !REDUCED && !running && !userBusy && !dragging && now - lastInput > 1800 && now - lastAutoTurn > 2600) {
                lastAutoTurn = now;
                enqueue(randomMove(history[history.length - 1]), 620);
            }
            requestAnimationFrame(tick);
        })(performance.now());

        /* --- pointer: drag a sticker = turn that layer, drag centre / space = roll the cube --- */
        var pt = null, lastCreak = 0;
        var dragMode = 'roll';                           // 'roll' = drag rolls the whole cube in 3D; 'layer' = drag a sticker to turn its layer

        function turnFace(name) {                        // "R" = clockwise quarter turn of the right face, "R'" = the other way
            if (userBusy) return;
            var base = MOVES[name.charAt(0)];
            if (!base) return;
            lastInput = performance.now();
            if (running || queue.length) finishAllNow();
            wasScrambled = true;
            enqueue({ axis: base.axis, layer: base.layer, dir: name.length > 1 ? -base.dir : base.dir }, 340);
        }
        function turnFaceOf(sticker) {                   // tap on a sticker: turn the face that sticker is on
            var cb = cubies[+sticker.dataset.cubie];
            var n = roundVec(apply(cb.R, SIDES[sticker.dataset.side].n));
            for (var i = 0; i < SIDE_KEYS.length; i++) if (same(SIDES[SIDE_KEYS[i]].n, n)) { turnFace(SIDE_KEYS[i]); return; }
        }

        function tangentPx(cb, axis) {
            var q = rotMat(axis, 0.01), m = apply(q, cb.p);
            var t = [(m[0] - cb.p[0]) / 0.01, (m[1] - cb.p[1]) / 0.01, (m[2] - cb.p[2]) / 0.01];
            var sc = apply(M, t);
            return [sc[0] * S, sc[1] * S];
        }
        function lockLayer(cb, normal, dx, dy) {
            var best = null, bestScore = 0;
            for (var axis = 0; axis < 3; axis++) {
                if (normal[axis] !== 0) continue;
                var T = tangentPx(cb, axis), len = Math.hypot(T[0], T[1]);
                if (len < 25) continue;
                var score = Math.abs(T[0] * dx + T[1] * dy) / len;
                if (score > bestScore) { bestScore = score; best = { axis: axis, layer: cb.p[axis], T: T }; }
            }
            return best;
        }

        dock.addEventListener('pointerdown', function (e) {
            if (e.button != null && e.button > 0) return;
            e.preventDefault();                          // no text selection / native drag: those cancel the pointer mid-drag
            completeLayerNow();
            if (pt) { dragging = false; pt = null; }
            var st = e.target.closest ? e.target.closest('.rc-sticker') : null;
            pt = {
                id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp,
                moved: false, sticker: st, mode: null, lock: null, scale: dock.getBoundingClientRect().width / (dock.offsetWidth || 1)
            };
            lastInput = performance.now(); vel.x = vel.y = 0;
            try { dock.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        });

        dock.addEventListener('pointermove', function (e) {
            if (!pt || e.pointerId !== pt.id) return;
            lastInput = performance.now();
            var sc = pt.scale || 1;
            var dx = (e.clientX - pt.x) / sc, dy = (e.clientY - pt.y) / sc;       // in the cube's own (unscaled) pixels
            if (!pt.moved) {
                if (Math.hypot(e.clientX - pt.x, e.clientY - pt.y) < DRAG_PX) return;
                pt.moved = true;
                var movable = dragMode === 'layer' && pt.sticker && !pt.sticker.classList.contains('rc-centre') && !userBusy;
                if (movable && (running || queue.length)) finishAllNow();
                if (movable) {
                    var cb = cubies[+pt.sticker.dataset.cubie];
                    var normal = roundVec(apply(cb.R, SIDES[pt.sticker.dataset.side].n));
                    var lk = lockLayer(cb, normal, dx, dy);
                    if (lk) {
                        pt.mode = 'layer'; pt.lock = lk; userBusy = true; fx(0.5);
                        pt.lock.group = cubies.filter(function (c) { return c.p[lk.axis] === lk.layer; });
                    }
                }
                if (!pt.mode) { pt.mode = 'roll'; dragging = true; }
            }
            if (pt.mode === 'layer') {
                var T = pt.lock.T;
                var ang = 1.5 * (T[0] * dx + T[1] * dy) / (T[0] * T[0] + T[1] * T[1]);
                pt.speed = Math.hypot(e.clientX - pt.lx, e.clientY - pt.ly) / Math.max(e.timeStamp - pt.lt, 4);
                anim = { cubies: pt.lock.group, axis: pt.lock.axis, angle: clamp(ang, -HALF_PI * 1.05, HALF_PI * 1.05) };
                draw();
            } else if (pt.mode === 'roll') {
                var k = 0.0085 / sc;
                var rx = -(e.clientY - pt.ly) * k, ry = (e.clientX - pt.lx) * k;
                rollBy(ry, rx); drawCamOnly();
                if (e.timeStamp - lastCreak > 140 && Math.hypot(e.clientX - pt.lx, e.clientY - pt.ly) > 2) {
                    lastCreak = e.timeStamp; Sound.creak();
                    host.dispatchEvent(new CustomEvent('rc-crunch', { bubbles: true, detail: { power: 0.25 } }));
                }
                var dt = Math.max(e.timeStamp - pt.lt, 8);
                vel.x = ry * (16 / dt); vel.y = rx * (16 / dt);
            }
            pt.lx = e.clientX; pt.ly = e.clientY; pt.lt = e.timeStamp;
        });

        var layerEpoch = 0, pendingFinish = null;
        function completeLayerNow() {                    // a new touch arrives while the last layer is still snapping: finish it at once
            if (!pendingFinish) return;
            layerEpoch++;
            var pf = pendingFinish; pendingFinish = null;
            if (pf.target) applyMove({ axis: pf.lock.axis, layer: pf.lock.layer, dir: pf.target }, true);
            anim = null; running = false; userBusy = false;
            draw(); settle();
        }
        function finishLayer(lock, angle, flick) {
            var turn = Math.abs(angle) > 18 * DEG || (flick && Math.abs(angle) > 4 * DEG);
            var target = turn ? (angle > 0 ? 1 : -1) : 0;
            var from = angle, to = target * HALF_PI, t0 = performance.now(), group = lock.group, my = ++layerEpoch;
            pendingFinish = { lock: lock, target: target };
            running = true;
            (function step(now) {
                if (my !== layerEpoch) return;
                var t = clamp((now - t0) / 180, 0, 1);
                anim = { cubies: group, axis: lock.axis, angle: from + (to - from) * ease(t) };
                if (t < 1) { draw(); requestAnimationFrame(step); return; }
                pendingFinish = null;
                if (target) { applyMove({ axis: lock.axis, layer: lock.layer, dir: target }, true); fx(1); }
                anim = null; running = false; userBusy = false;
                draw(); settle();
                if (queue.length) next();
            })(t0);
        }

        function endPointer(e) {
            if (!pt || e.pointerId !== pt.id) return;
            var p = pt; pt = null; dragging = false;
            try { dock.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            if (p.mode === 'layer') finishLayer(p.lock, anim ? anim.angle : 0, p.speed > 0.4 && e.timeStamp - p.lt < 90);
            else if (p.mode === 'roll') { if (e.timeStamp - p.lt > 90) vel.x = vel.y = 0; }
            else if (!p.moved && p.sticker) {
                if (p.sticker.classList.contains('rc-centre')) scrollToChapter(FACES[p.sticker.dataset.side].id);
                else turnFaceOf(p.sticker);
            }
        }
        dock.addEventListener('dragstart', function (e) { e.preventDefault(); });
        dock.addEventListener('selectstart', function (e) { e.preventDefault(); });
        dock.addEventListener('pointerup', endPointer);
        dock.addEventListener('pointercancel', endPointer);
        dock.addEventListener('lostpointercapture', function (e) { if (pt && e.pointerId === pt.id) endPointer(e); });

        host.querySelector('.rc-hbar').addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            lastInput = performance.now();
            if (b.dataset.act === 'scramble') scramble(true);
            else if (b.dataset.act === 'solve') solve();
            else if (b.dataset.act === 'mode') {
                dragMode = dragMode === 'roll' ? 'layer' : 'roll';
                b.innerHTML = dragMode === 'roll' ? '🧭 Drag: 3D' : '🧩 Drag: Layer';
                b.setAttribute('aria-pressed', String(dragMode === 'layer'));
            } else if (b.dataset.act === 'sound') {
                var son = b.getAttribute('aria-pressed') !== 'true';
                b.setAttribute('aria-pressed', String(son));
                b.innerHTML = son ? '🔊 Sound' : '🔇 Muted';
                Sound.setOn(son);
                if (son) Sound.unlock();
            } else if (b.dataset.act === 'auto') {
                autoTurn = b.getAttribute('aria-pressed') !== 'true';
                b.setAttribute('aria-pressed', String(autoTurn));
            }
        });

        host.querySelector('.rc-moves').addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (b && b.dataset.move) turnFace(b.dataset.move);
        });

        window.addEventListener('resize', function () { sizeKey = ''; updateDock(); });
        updateDock();
        scramble(false);
        setTimeout(updateDock, 60);
    }

    /* =====================================================================
       Chapter shapes: each returns cells in "who gets an item first" order.
       A cell = { tf: css transform, w, h, tri, lx, ly (label position, px from the shape anchor) }
       ===================================================================== */

    var RC = mul(rotMat(0, -24 * DEG), rotMat(1, -34 * DEG));       // same as .rc-shape's rotateX(-24deg) rotateY(-34deg)
    function project(p) {
        var q = apply(RC, p), s = PERSP / (PERSP - q[2]);
        return [q[0] * s, q[1] * s];
    }

    // every visible side of a shape gets its own colour, like a real cube: the chapter colour plus three neighbours
    var SHAPE_PAL = ['#14a85a', '#d7263d', '#2467e8', '#ff7a1a', '#ffd400'];
    function faceColors(base) {
        var i = SHAPE_PAL.indexOf(base);
        return [base, SHAPE_PAL[(i + 1) % 5], SHAPE_PAL[(i + 2) % 5], SHAPE_PAL[(i + 3) % 5]];
    }

    function cuboidCells(shape, n, P, cols) {
        var s = { w: shape.w, h: shape.h, d: shape.d }, guard = 0;
        while (s.w * s.h + s.d * s.h + s.w * s.d < n && guard++ < 30) {
            if (shape.grow === 'h') s.h++; else if (shape.grow === 'w') s.w++; else { s.w++; s.h++; s.d++; }
        }
        if (Math.max(s.w, s.h, s.d) >= 4) P = Math.round(P * 0.86);
        var size = P - 5, faces = [[], [], []], i, j, k;
        function add(f, x, y, z, rot) {
            var l = project([x, y, z]);
            faces[f].push({
                tf: 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) ' + rot + ' translate(-50%,-50%)',
                w: size, h: size, tri: false, lx: l[0], ly: l[1], col: cols[f]
            });
        }
        for (j = 0; j < s.h; j++) for (i = 0; i < s.w; i++) add(0, (i - (s.w - 1) / 2) * P, (j - (s.h - 1) / 2) * P, s.d * P / 2, '');
        for (j = 0; j < s.h; j++) for (k = 0; k < s.d; k++) add(1, s.w * P / 2, (j - (s.h - 1) / 2) * P, ((s.d - 1) / 2 - k) * P, 'rotateY(90deg)');
        for (k = 0; k < s.d; k++) for (i = 0; i < s.w; i++) add(2, (i - (s.w - 1) / 2) * P, -s.h * P / 2, (k - (s.d - 1) / 2) * P, 'rotateX(90deg)');
        return roundRobin(faces);
    }

    function roundRobin(lists) {
        var out = [], idx = lists.map(function () { return 0; }), f = 0, total = 0;
        lists.forEach(function (l) { total += l.length; });
        while (out.length < total) {
            if (idx[f] < lists[f].length) out.push(lists[f][idx[f]++]);
            f = (f + 1) % lists.length;
        }
        return out;
    }

    // Pyraminx-style tetrahedron: only the three faces that look at the viewer are built
    function pyramidCells(n, E, cols) {
        var sub = Math.max(2, Math.ceil(Math.sqrt(n / 2)));      // two faces are in view
        var H = E * Math.sqrt(2 / 3), r = E / Math.sqrt(3);
        // turn the pyramid so one vertex points at the viewer: the left and right faces are then equally visible
        var yaw = rotMat(1, 34 * DEG);
        var A = apply(yaw, [0, -0.75 * H, 0]);
        var B = [90, 210, 330].map(function (d) { return apply(yaw, [r * Math.cos(d * DEG), 0.25 * H, r * Math.sin(d * DEG)]); });
        var faceDefs = [[A, B[0], B[1]], [A, B[1], B[2]], [A, B[2], B[0]], [B[0], B[1], B[2]]];
        var faces = [];

        faceDefs.forEach(function (f) {
            var c = [(f[0][0] + f[1][0] + f[2][0]) / 3, (f[0][1] + f[1][1] + f[2][1]) / 3, (f[0][2] + f[1][2] + f[2][2]) / 3];
            if (apply(RC, c)[2] <= 0.02) return;                         // faces turned away from the viewer are never seen
            var P0 = f[0], Q0 = f[1], R0 = f[2], list = [], i, j, col = cols[faces.length % cols.length];
            function V(a, b) {
                return [
                    P0[0] + (Q0[0] - P0[0]) * a / sub + (R0[0] - Q0[0]) * b / sub,
                    P0[1] + (Q0[1] - P0[1]) * a / sub + (R0[1] - Q0[1]) * b / sub,
                    P0[2] + (Q0[2] - P0[2]) * a / sub + (R0[2] - Q0[2]) * b / sub
                ];
            }
            for (i = 0; i < sub; i++) {
                for (j = 0; j <= i; j++) list.push(triCell([V(i, j), V(i + 1, j), V(i + 1, j + 1)], false, col));
                for (j = 0; j < i; j++) list.push(triCell([V(i, j), V(i + 1, j + 1), V(i, j + 1)], true, col));
            }
            faces.push(list);
        });
        return roundRobin(faces);
    }

    // Place an equilateral triangle element (wide edge on top, point down) onto three 3D vertices
    function triCell(v, alt, col) {
        var cen = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3];
        var pts = v.map(function (p) { return [cen[0] + (p[0] - cen[0]) * 0.86, cen[1] + (p[1] - cen[1]) * 0.86, cen[2] + (p[2] - cen[2]) * 0.86]; });
        var best = null;
        for (var rot = 0; rot < 3; rot++) for (var mir = 0; mir < 2; mir++) {
            var a = pts[rot], b = pts[(rot + 1) % 3], c = pts[(rot + 2) % 3];
            if (mir) { var t = a; a = b; b = t; }
            var X = norm(sub(b, a)), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
            var Y = norm(sub(c, mid)), Z = cross(X, Y);
            var Xc = apply(RC, X), Yc = apply(RC, Y);
            if (Xc[0] * Yc[1] - Xc[1] * Yc[0] <= 0) continue;                // would show its back to the viewer
            var ang = Math.abs(Math.atan2(Xc[1], Xc[0]));
            if (!best || ang < best.ang) best = { ang: ang, a: a, X: X, Y: Y, Z: Z, W: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) };
        }
        if (!best) best = { a: pts[0], X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1], W: 80 };
        var Rm = [[best.X[0], best.Y[0], best.Z[0]], [best.X[1], best.Y[1], best.Z[1]], [best.X[2], best.Y[2], best.Z[2]]];
        var l = project(cen);
        return { tf: cssMatrix(Rm, best.a[0], best.a[1], best.a[2]), w: best.W, h: best.W * Math.sqrt(3) / 2, tri: true, alt: !!alt, col: col, lx: l[0], ly: l[1] + best.W * 0.04 };
    }

    // A ball made of flat tiles; only the half that faces the viewer is built
    function sphereCells(R, t, cols) {
        var rows = [[-60, 6], [-30, 10], [0, 12], [30, 10], [60, 6]], out = [];
        rows.forEach(function (row, ri) {
            var lat = row[0], count = row[1];
            for (var c = 0; c < count; c++) {
                var lon = c / count * 360 + (ri % 2 ? 180 / count : 0);
                var nrm = [Math.cos(lat * DEG) * Math.sin(lon * DEG), -Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)];
                var zc = apply(RC, nrm)[2];
                if (zc < 0.1) continue;
                var l = project([nrm[0] * R, nrm[1] * R, nrm[2] * R]);
                out.push({
                    tf: 'rotateY(' + lon.toFixed(2) + 'deg) rotateX(' + lat + 'deg) translateZ(' + R + 'px) translate(-50%,-50%)',
                    w: t, h: t, tri: false, lx: l[0], ly: l[1], zc: zc,
                    col: lat >= 60 ? cols[3] : (l[0] < -0.28 * R ? cols[2] : (l[0] > 0.28 * R ? cols[1] : cols[0]))
                });
            }
        });
        out.sort(function (a, b) { return b.zc - a.zc; });
        return out;
    }

    function makeCells(ch, n, narrow) {
        var cols = faceColors(ch.color);
        if (ch.kind === 'pyramid') return pyramidCells(n, narrow ? 200 : 300, cols);
        if (ch.kind === 'sphere') return sphereCells(narrow ? 104 : 132, narrow ? 46 : 60, cols);
        return cuboidCells(ch.shape, n, narrow ? 50 : 72, cols);
    }

    /* =====================================================================
       A chapter: open (cards) <-> shape (3D, short names) <-> detail (one item)
       ===================================================================== */

    
    function initChapter(sec, ch) {
        var stage = sec.querySelector('.rc-sstage');
        var shapeEl = sec.querySelector('.rc-shape');
        var labelsEl = sec.querySelector('.rc-labels');
        var flow = sec.querySelector('.rc-flow');
        var btn = sec.querySelector('.rc-xbtn');
        var hub = sec.querySelector('.rc-stitle');
        var back = sec.querySelector('.rc-back');
        var detailEl = sec.querySelector('.rc-detail');
        var hubHint = hub.querySelector('small');
        var items = ch.items;
        var tiles = [], cards = [], hubSlot = null, byItem = [];
        var state = 'shape', pending = true, sel = -1, wasNarrow = null;

        function narrow() { return window.innerWidth < 700; }
        function CH() { return narrow() ? 420 : 480; }

        function build() {
            wasNarrow = narrow();
            shapeEl.innerHTML = ''; labelsEl.innerHTML = ''; flow.innerHTML = '';
            tiles = []; cards = []; byItem = [];
            var cells = makeCells(ch, items.length, wasNarrow);
            cells.forEach(function (cell, n) {
                var it = items[n] || null;
                var el = document.createElement('div');
                el.className = 'rc-tile' + (it ? '' : ' rc-filler') + (cell.tri ? ' rc-tri' : '') + (cell.alt ? ' rc-alt' : '');
                el.style.setProperty('--i', String(n));
                if (cell.col) el.style.setProperty('--tc', cell.col);
                el.innerHTML = '<span class="rc-tface"></span><span class="rc-tcard"></span>' + (it ? '<div class="rc-tin">' + itemHtml(it) + '</div>' : '');
                shapeEl.appendChild(el);
                var tile = { el: el, cell: cell, item: it, n: n, scatter: null };
                var a = rand(0, 6.28), r = rand(320, 560);
                tile.scatter = 'translate3d(' + (Math.cos(a) * r).toFixed(0) + 'px,' + (Math.sin(a) * r).toFixed(0) + 'px,' + rand(-250, 250).toFixed(0) + 'px) translate(-50%,-50%) scale(0.2)';
                tiles.push(tile);
                if (it) {
                    byItem[n] = tile;
                    var lab = document.createElement('div');
                    lab.className = 'rc-tlabel';
                    lab.style.left = cell.lx.toFixed(1) + 'px'; lab.style.top = cell.ly.toFixed(1) + 'px';
                    lab.innerHTML = '<i>' + esc(it.icon) + '</i><span>' + esc(it.short || it.title) + '</span>';
                    lab.style.maxWidth = Math.round(cell.w + 8) + 'px';
                    labelsEl.appendChild(lab);
                }
            });
            var hubAt = Math.floor(items.length / 2);
            items.forEach(function (it, i) {
                if (i === hubAt) { hubSlot = document.createElement('div'); hubSlot.className = 'rc-flowcard rc-hubslot'; flow.appendChild(hubSlot); }
                var c = document.createElement('div');
                c.className = 'rc-flowcard'; c.innerHTML = itemHtml(it);
                flow.appendChild(c); cards.push(c);
            });
        }

        function setCH() { var v = CH() + 'px'; stage.style.setProperty('--ch', v); }

        function openMetrics() {                         // lay the hidden grid out and read where every card goes
            flow.style.display = 'grid';
            var H = Math.max(CH(), flow.offsetHeight + 24);
            return H;
        }

        function applyShapeTiles() {
            tiles.forEach(function (t) {
                t.el.style.width = t.cell.w + 'px'; t.el.style.height = t.cell.h + 'px';
                t.el.style.transform = t.cell.tf;
            });
        }
        function placeHub(shift) {
            hub.style.left = 'calc(50% - ' + shift + 'px)'; hub.style.top = (CH() - 40) + 'px';
            hub.style.width = '210px'; hub.style.height = '80px';
        }
        function noDetail() {
            detailEl.classList.remove('rc-on');
            stage.style.setProperty('--shift', '0px');
        }

        function layoutShape(height) {
            flow.style.display = 'none';
            noDetail();
            stage.style.height = (height || CH()) + 'px';
            applyShapeTiles();
            placeHub(0);
        }

        function layoutOpen() {
            noDetail();
            var sw = stage.clientWidth, c0 = CH(), H = openMetrics();
            stage.style.height = H + 'px';
            tiles.forEach(function (t) {
                if (!t.item) { t.el.style.transform = t.scatter; return; }
                var c = cards[t.n];
                var tx = c.offsetLeft + c.offsetWidth / 2 - sw / 2, ty = c.offsetTop + c.offsetHeight / 2 - c0 / 2;
                t.el.style.width = c.offsetWidth + 'px'; t.el.style.height = c.offsetHeight + 'px';
                t.el.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) translate(-50%,-50%)';
            });
            if (hubSlot) {
                hub.style.left = (hubSlot.offsetLeft + hubSlot.offsetWidth / 2) + 'px';
                hub.style.top = (hubSlot.offsetTop + hubSlot.offsetHeight / 2) + 'px';
                hub.style.width = hubSlot.offsetWidth + 'px'; hub.style.height = hubSlot.offsetHeight + 'px';
            }
        }

        // the shape stays put (nudged left) and the chosen item opens as a card on its right
        function layoutDetail(idx) {
            var sw = stage.clientWidth, c0 = CH(), nar = narrow();
            flow.style.display = 'none';
            applyShapeTiles();
            var shift = nar ? 0 : Math.round(Math.min(sw * 0.2, 250));
            stage.style.setProperty('--shift', shift + 'px');
            placeHub(shift);
            detailEl.innerHTML = itemHtml(items[idx]);
            detailEl.style.width = (nar ? sw : Math.round(Math.min(500, sw * 0.4))) + 'px';
            var dh = detailEl.offsetHeight, top, height;
            if (nar) {
                top = c0 + 6; height = c0 + dh + 24;
                detailEl.style.left = '0px'; detailEl.style.right = 'auto'; detailEl.style.translate = '0 0';
            } else {
                var mid = Math.max(dh / 2 + 10, c0 / 2);
                top = mid; height = Math.max(c0, mid + dh / 2 + 20);
                detailEl.style.left = 'auto'; detailEl.style.right = '0px'; detailEl.style.translate = '0 -50%';
            }
            detailEl.style.top = top + 'px';
            stage.style.height = height + 'px';
            detailEl.classList.remove('rc-on'); void detailEl.offsetWidth; detailEl.classList.add('rc-on');
        }

        var HINT_LABEL = ch.shapeName || 'shape';
        function updateBtn() {
            hubHint.textContent = state === 'open' ? 'click to fold into a ' + HINT_LABEL : 'click to explode';
            btn.innerHTML = state === 'open' ? '🧊 Fold to ' + HINT_LABEL : (state === 'shape' ? '💥 Explode' : '↩ Back');
        }

        function setState(next, idx) {
            pending = false;
            state = next; sel = idx == null ? -1 : idx;
            sec.classList.remove('rc-s-open', 'rc-s-shape', 'rc-s-detail');
            sec.classList.add('rc-s-' + next);
            tiles.forEach(function (t) { t.el.classList.toggle('rc-sel', t.n === sel); });
            if (next === 'open') layoutOpen(); else if (next === 'shape') layoutShape(); else layoutDetail(idx);
            updateBtn();
        }

        function relayout() {
            if (state === 'open') layoutOpen(); else if (state === 'detail') layoutDetail(sel);
            else layoutShape(pending ? openMetrics() : 0);
        }

        /* --- init --- */
        setCH();
        build();
        sec.classList.add('rc-s-shape');
        updateBtn();
        // start as a shape, with the stage already as tall as the open layout so nothing jumps when it explodes
        var h0 = openMetrics();
        layoutShape(h0);

        stage.addEventListener('click', function (e) {
            if (e.target.closest('.rc-back')) { setState('shape'); return; }
            if (e.target.closest('.rc-stitle')) { setState(state === 'open' ? 'shape' : 'open'); return; }
            if (state === 'open') return;
            if (state === 'shape') {
                var t = e.target.closest('.rc-tile');
                if (t && !t.classList.contains('rc-filler')) {
                    for (var i = 0; i < tiles.length; i++) if (tiles[i].el === t) { setState('detail', tiles[i].n); break; }
                }
                return;
            }
            if (state === 'detail') {
                if (e.target.closest('.rc-detail')) return;
                var t2 = e.target.closest('.rc-tile');
                if (t2) {
                    if (t2.classList.contains('rc-filler')) return;
                    for (var k = 0; k < tiles.length; k++) if (tiles[k].el === t2) { setState('detail', tiles[k].n); break; }
                } else setState('shape');
            }
        });
        btn.addEventListener('click', function () {
            if (state === 'open') setState('shape');
            else if (state === 'shape') setState('open');
            else setState('shape');
        });

        // arriving at the chapter: the shape explodes into cards
        // scrolling down to the middle of the screen explodes the chapter after a moment; scrolling back up past it folds it again
        if ('IntersectionObserver' in window) {
            var autoTimer = 0;
            var io = new IntersectionObserver(function (es) {
                var en = es[es.length - 1];
                clearTimeout(autoTimer);
                if (en.isIntersecting) {
                    autoTimer = setTimeout(function () { if (state !== 'open') setState('open'); }, 350);
                } else if (en.rootBounds && en.boundingClientRect.top > en.rootBounds.top + en.rootBounds.height / 2) {
                    autoTimer = setTimeout(function () { if (state !== 'shape') setState('shape'); }, 600);
                }
            }, { root: sec.closest('.rc-app'), rootMargin: '-46% 0px -46% 0px', threshold: 0 });
            io.observe(sec);
        } else setState('open');

        var api = {
            open: function () { if (state !== 'open') setState('open'); },
            toggle: function () { setState(state === 'open' ? 'shape' : 'open'); }
        };

        window.addEventListener('resize', function () {
            if (!sec.isConnected) return;
            setCH();
            if (narrow() !== wasNarrow) { build(); tiles.forEach(function (t) { t.el.classList.toggle('rc-sel', t.n === sel); }); }
            relayout();
        });
        return api;
    }

    /* =====================================================================
       render
       ===================================================================== */

    function render(data, root) {
        var info = data.personalInfo || {};
        var shown = info.nickname || info.name || 'Profile';
        var chapters = buildChapters(data);
        var loc = Array.isArray(info.location) ? info.location.join(', ') : (info.location || '');
        var plat = data.platforms || {};

        var navChips = '<button type="button" class="rc-lchip" data-go="about" style="--c:' + FACES.U.color + '"><i></i><span>' + FACES.U.icon + ' About</span></button>' +
            chapters.map(function (c) {
                return '<button type="button" class="rc-lchip" data-go="' + c.id + '" style="--c:' + c.color + '"><i></i><span>' + c.icon + ' ' + esc(c.label) + '</span></button>';
            }).join('');

        var sections = chapters.map(function (c) {
            return (
                '<section class="rc-sec" id="rc-sec-' + c.id + '" style="--c:' + c.color + ';--ink:' + c.ink + '">' +
                '<header class="rc-sec-head"><span class="rc-sec-ico">' + c.icon + '</span>' +
                '<div><h2>' + esc(c.label) + '</h2><p>' + esc(c.desc) + '</p></div>' +
                '<button type="button" class="rc-xbtn rc-mc"></button></header>' +
                '<div class="rc-sstage">' +
                '<div class="rc-sfloat"><div class="rc-shape"></div></div>' +
                '<div class="rc-labels"></div>' +
                '<div class="rc-stitle" role="button" tabindex="0"><span>' + c.icon + '</span><b>' + esc(c.label) + '</b><small></small></div>' +
                '<button type="button" class="rc-back rc-mc">↩ Back</button>' +
                '<div class="rc-flow"></div><div class="rc-detail"></div></div>' +
                '</section>'
            );
        }).join('');

        root.innerHTML =
            '<canvas class="rc-space" id="rcSpace" aria-hidden="true"></canvas>' +
            '<nav class="rc-nav"><div class="rc-legend">' + navChips + '</div></nav>' +
            '<div class="rc-hstage rc-dock" id="rcDock"><div class="rc-hfloat"><div class="rc-hcube"></div></div></div>' +
            '<div class="rc-app" id="rcApp"><div class="rc-page">' +

            '<section class="rc-hero" id="rc-sec-about">' +
            '<div class="rc-intro">' +
            '<p class="rc-eyebrow">Hello, I’m</p>' +
            '<h1>' + (typeof nameRevealMarkup === 'function' ? nameRevealMarkup(info) : esc(shown)) + '</h1>' +
            '<p class="rc-role">' + esc(info.title || '') + '</p>' +
            '<ul class="rc-summary">' + ((data.summary || {}).lines || []).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
            '<div class="rc-chips">' + chips(data.profileTraits) + '</div>' +
            '<div class="rc-chips rc-plat">' + chips((plat.primary || []).concat(plat.secondary || [])) + '</div>' +
            '<div class="rc-quick">' +
            (loc ? '<span class="rc-chip">📍 ' + esc(loc) + '</span>' : '') +
            (info.email ? '<a class="rc-chip rc-secret" href="mailto:' + esc(info.email) + '">✉️ <span class="rc-secret-text">' + esc(info.email) + '</span></a>' : '') +
            (info.phone ? '<a class="rc-chip rc-secret" href="tel:' + esc(String(info.phone).replace(/\s+/g, '')) + '">📞 <span class="rc-secret-text">' + esc(info.phone) + '</span></a>' : '') +
            '</div>' +
            '<button type="button" class="rc-more rc-mc rc-green" data-go="experience">Explore my world ↓</button>' +
            '</div>' +

            '<div class="rc-hero-cube">' +
            '<div class="rc-hslot"></div>' +
            '<div class="rc-htoast" role="status"></div>' +
            '<div class="rc-hbar">' +
            '<button type="button" class="rc-mc" data-act="scramble">🔀 Scramble</button>' +
            '<button type="button" class="rc-mc rc-green" data-act="solve">✨ Solve</button>' +
            '<button type="button" class="rc-mc" data-act="auto" aria-pressed="true">🔄 Auto</button>' +
            '<button type="button" class="rc-mc" data-act="sound" aria-pressed="true">🔊 Sound</button>' +
            '<button type="button" class="rc-mc" data-act="mode" aria-pressed="false">🧭 Drag: 3D</button>' +
            '</div>' +
            '<div class="rc-moves" aria-label="Turn a face">' + SIDE_KEYS.map(function (k) {
                return '<button type="button" class="rc-mc" data-move="' + k + '" style="--c:' + FACES[k].color + '">' + k + '</button>' +
                    '<button type="button" class="rc-mc" data-move="' + k + "'\" style=\"--c:" + FACES[k].color + '">' + k + '′</button>';
            }).join('') + '</div>' +
            '<p class="rc-hstatus"></p>' +
            '<p class="rc-hhint">' + (TOUCH
                ? 'Swipe to roll the cube in 3D · tap a sticker to turn its face · buttons turn any face'
                : 'Drag to roll the cube in 3D · click a sticker to turn its face · buttons turn any face · “Drag: Layer” lets you drag a sticker to turn its layer') + '</p>' +
            '</div>' +
            '</section>' +

            sections +
            '<footer class="rc-foot">You made it all the way down — welcome to the surface 🌍</footer>' +
            '</div></div>';

        var app = document.getElementById('rcApp');
        // nickname -> full name when the pointer comes near; the surname stays blurred until hovered (shared with the other templates)
        if (typeof initNameReveal === 'function') initNameReveal(root.querySelector('.rc-intro h1'));
        var navEl = root.querySelector('.rc-nav');
        // every button / chip gets the Minecraft button look
        root.querySelectorAll('.rc-lchip').forEach(function (b) { b.classList.add('rc-mc'); });

        // sound can only start after the first touch / click (browser rule)
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, Sound.unlock, { capture: true, passive: true }); });

        // every letter of the intro is its own little box, so the whole text can rattle on the spot
        var intro = root.querySelector('.rc-intro');
        (function wrapChars(el) {
            var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
                acceptNode: function (n) { return n.nodeValue.trim() && !n.parentElement.closest('button') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
            });
            var nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(function (n) {
                var frag = document.createDocumentFragment();
                n.nodeValue.split(/(\s+)/).forEach(function (part) {
                    if (!part) return;
                    if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
                    var word = document.createElement('span'); word.className = 'rc-w';
                    Array.from(part).forEach(function (chr) {
                        var s = document.createElement('span'); s.className = 'rc-ch'; s.textContent = chr;
                        s.style.setProperty('--dx', (rand(-1, 1) * 2.6).toFixed(2) + 'px');
                        s.style.setProperty('--dy', (rand(-1, 1) * 2.6).toFixed(2) + 'px');
                        s.style.setProperty('--r', rand(-6, 6).toFixed(1) + 'deg');
                        word.appendChild(s);
                    });
                    frag.appendChild(word);
                });
                n.parentNode.replaceChild(frag, n);
            });
        })(intro);
        var shakeTimer = 0;
        root.addEventListener('rc-crunch', function (e) {
            if (REDUCED || app.scrollTop > app.clientHeight * 0.8) return;
            intro.style.setProperty('--amp', (0.5 + ((e.detail && e.detail.power) || 0.5) * 1.1).toFixed(2));
            intro.classList.remove('rc-shake'); void intro.offsetWidth; intro.classList.add('rc-shake');
            clearTimeout(shakeTimer); shakeTimer = setTimeout(function () { intro.classList.remove('rc-shake'); }, 380);
        });

        initSpace(document.getElementById('rcSpace'), root, function () { return app.scrollTop; }, function () {
            var max = app.scrollHeight - app.clientHeight;
            return max > 0 ? clamp(app.scrollTop / max, 0, 1) : 0;
        });

        function scrollToChapter(id) {
            var el = document.getElementById('rc-sec-' + id);
            if (!el) return;
            var top = id === 'about' ? 0 : app.scrollTop + el.getBoundingClientRect().top - app.getBoundingClientRect().top - 70;
            app.scrollTo({ top: top, behavior: 'smooth' });
        }
        var ctl = {};
        // menu chips: first click scrolls there and explodes it; clicking the chapter you are reading folds it back into its shape, and again explodes it
        root.addEventListener('click', function (e) {
            var g = e.target.closest('[data-go]');
            if (!g) return;
            var id = g.dataset.go, c = ctl[id];
            if (c && g.classList.contains('rc-lchip')) {
                if (g.classList.contains('rc-cur')) c.toggle();
                else { scrollToChapter(id); c.open(); }
                return;
            }
            scrollToChapter(id);
        });

        chapters.forEach(function (c) { ctl[c.id] = initChapter(document.getElementById('rc-sec-' + c.id), c); });
        initHeroCube(root.querySelector('.rc-hero-cube'), document.getElementById('rcDock'), root.querySelector('.rc-hslot'),
            app, navEl, chapters.map(function (c) { return c.id; }), scrollToChapter);

        // On touch screens the first tap unblurs the email / phone, the second follows the link
        root.addEventListener('click', function (e) {
            var s = e.target.closest('.rc-secret');
            if (!s || !TOUCH || s.classList.contains('rc-revealed')) return;
            e.preventDefault();
            s.classList.add('rc-revealed');
            setTimeout(function () { s.classList.remove('rc-revealed'); }, 8000);
        });
    }

    window.ProfileTemplates = window.ProfileTemplates || {};
    window.ProfileTemplates.rubik = { render: render };
})();
