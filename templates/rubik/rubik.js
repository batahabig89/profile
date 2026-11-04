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
        // A small black hole that stays where it is while the sky changes around it: a black event horizon, a razor-thin photon ring,
        // a glowing accretion disc seen almost edge-on, its far side bent over the top and under the bottom (lensing), faint jets and a
        // sparkling Einstein ring.
        var BH_N = 260, BH_SPAN = 5.5, bhCv = document.createElement('canvas');
        bhCv.width = bhCv.height = BH_N;
        var bhCtx = bhCv.getContext('2d'), bhImg = bhCtx.createImageData(BH_N, BH_N);

        function drawBlackHole(ap, day) {
            if (ap < 0.02 || day > 0.97) return;
            ctx.fillStyle = 'rgba(3,4,10,' + clamp(ap * 3, 0, 0.96) + ')'; ctx.fillRect(0, 0, w, h);      // the solar system fades away behind it

            var cx = w * 0.5, cy = h * 0.5, Rh = Math.min(0.11 * h, 0.2 * w);
            var N = BH_N, data = bhImg.data, tilt = 0.2, i, j2;
            for (j2 = 0; j2 < N; j2++) for (i = 0; i < N; i++) {
                var x = (i + 0.5 - N / 2) / (N / 2) * BH_SPAN, y = (j2 + 0.5 - N / 2) / (N / 2) * BH_SPAN, r = Math.hypot(x, y), o = (j2 * N + i) * 4;
                var R = 0, G = 0, B2 = 0, A = 0;

                // a violet-orange halo that gets darker towards the horizon (depth)
                if (r > 1.0) {
                    var hg = Math.exp(-(r - 1) * 0.9);
                    R += 255 * 0.34 * hg; G += 120 * 0.34 * hg; B2 += 90 * 0.34 * hg; A += 0.3 * hg;
                    var vio = Math.exp(-Math.pow((r - 1.25) / 0.22, 2)) * 0.22;
                    R += 90 * vio; G += 40 * vio; B2 += 160 * vio; A += 0.25 * vio;
                }
                // faint relativistic jets along the axis
                var jet = Math.exp(-Math.pow(x / (0.12 + Math.abs(y) * 0.05), 2)) * Math.exp(-Math.abs(y) * 0.38) * (Math.abs(y) > 0.9 ? 1 : 0) * 0.35;
                if (jet > 0.01) { R += 110 * jet; G += 150 * jet; B2 += 255 * jet; A = Math.max(A, jet * 0.9); }

                // sparkling Einstein ring: background starlight smeared round the hole
                if (r > 1.55 && r < 2.3) {
                    var sp = Math.sin(Math.atan2(y, x) * 40 + T * 0.4) * 0.5 + 0.5, hs = hash(Math.floor(i / 2), Math.floor(j2 / 2), 61);
                    if (hs > 0.965) { var sb = (1 - Math.abs(r - 1.9) / 0.4) * (0.5 + 0.5 * sp); if (sb > 0) { R += 255 * sb; G += 255 * sb; B2 += 255 * sb; A = Math.max(A, sb); } }
                }

                // accretion disc (white-blue at the inner edge, yellow, orange, deep red outside); the left side rushes towards us and is brighter
                var rho = Math.hypot(x, y / tilt), front = y > 0, onDisc = false;
                if (rho > 1.6 && rho < 5.3 && (front || r > 1.0)) {
                    var ang = Math.atan2(y / tilt, x), dop = clamp(0.62 - 0.45 * (x / rho), 0.15, 1.15);
                    var streak = 0.7 + 0.3 * Math.sin(ang * 6 - T * 5 / Math.pow(rho, 1.3)) * (0.6 + 0.4 * Math.sin(rho * 9 + T * 0.6));
                    var br = clamp(Math.pow(1.6 / rho, 1.1) * 1.8 * dop * streak, 0, 1.5), t = clamp((rho - 1.6) / 3.6, 0, 1);
                    var dr, dg, db;
                    if (t < 0.18) { var u = t / 0.18; dr = lerp(215, 255, u); dg = lerp(228, 238, u); db = lerp(255, 190, u); }
                    else { var u2 = (t - 0.18) / 0.82; dr = lerp(255, 135, u2); dg = lerp(238, 28, Math.pow(u2, 0.8)); db = lerp(190, 14, u2); }
                    var edge = clamp((5.3 - rho) * 1.4, 0, 1) * clamp((rho - 1.6) * 8, 0, 1);
                    R = lerp(R, dr * br, edge); G = lerp(G, dg * br, edge); B2 = lerp(B2, db * br, edge); A = Math.max(A, edge * clamp(br * 1.5, 0, 1));
                    onDisc = true;
                }
                // the far side of the disc, bent over the top (strong) and under the bottom (weak) of the horizon
                var wt = y < 0 ? Math.pow(clamp(-y / Math.max(r, 0.001), 0, 1), 0.6) : 0.5 * Math.pow(clamp(y / Math.max(r, 0.001), 0, 1), 1.1);
                var arch = Math.exp(-Math.pow((r - 1.17) / 0.28, 2)) * wt;
                if (arch > 0.02 && r > 1.0) {
                    var ad = clamp(0.72 - 0.3 * (x / Math.max(r, 0.001)), 0.3, 1);
                    var av = arch * ad * (0.82 + 0.18 * Math.sin(Math.atan2(y, x) * 9 - T * 4));
                    R += 255 * av; G += 214 * av; B2 += 150 * av; A = Math.max(A, clamp(av * 1.3, 0, 1));
                }
                // photon rings: a bright razor-thin one with a blue inner and orange outer fringe, and a fainter second image
                var ring = Math.exp(-Math.pow((r - 1.035) / 0.03, 2)), ring2 = Math.exp(-Math.pow((r - 1.11) / 0.02, 2)) * 0.45;
                var sh2 = 0.85 + 0.15 * Math.sin(Math.atan2(y, x) * 3 + T * 1.2);
                if (ring > 0.02) { var rb = ring * sh2; R += 255 * rb; G += 245 * rb; B2 += 225 * rb; A = Math.max(A, clamp(rb * 1.5, 0, 1)); }
                if (r > 0.97 && r < 1.0) { var inn = (1 - Math.abs(r - 0.985) / 0.015) * 0.7; R += 120 * inn; G += 160 * inn; B2 += 255 * inn; A = Math.max(A, inn); }
                if (r > 1.06 && r < 1.15) { var out = (1 - Math.abs(r - 1.1) / 0.05) * 0.5; R += 255 * out; G += 150 * out; B2 += 60 * out; A = Math.max(A, out); }
                if (ring2 > 0.02) { R += 255 * ring2; G += 220 * ring2; B2 += 180 * ring2; A = Math.max(A, ring2); }
                // the event horizon is pure black (the near side of the disc passes in front of it)
                if (r < 0.985 && !onDisc) { R = G = B2 = 0; A = 1; }
                data[o] = clamp(R, 0, 255); data[o + 1] = clamp(G, 0, 255); data[o + 2] = clamp(B2, 0, 255); data[o + 3] = clamp(A * 255, 0, 255);
            }
            bhCtx.putImageData(bhImg, 0, 0);
            var half = BH_SPAN * Rh;
            ctx.globalAlpha = clamp(ap * 4, 0, 1) * (1 - day);
            ctx.drawImage(bhCv, Math.round(cx - half), Math.round(cy - half), Math.round(2 * half), Math.round(2 * half));
            ctx.globalAlpha = 1;
        }

        function drawSky(day) {
            if (day <= 0) return;
            var g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#4d8fe8'); g.addColorStop(0.55, '#7db8f5'); g.addColorStop(1, '#cfe8ff');
            ctx.globalAlpha = day; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
        }

        /* ---------- the bottom of the page: a Minecraft landscape in real perspective ----------
           A tiny voxel renderer: every block is a box whose visible faces (top, front, side) are projected with a perspective
           camera and painted back to front. The static scene (terrain, trees, the ger, the well, fences) is rendered once into two
           canvases; the herder, the bucket, the animals, the clouds and the smoke are drawn again every frame between them. */

        var CAM = { x: 0, y: 5.5, z: -10, pitch: 0.12 }, VW = { F: 1000, cx: 0, cy: 0, cs: 1, sn: 0 };
        function setupCam() {
            VW.F = 0.85 * w; VW.cs = Math.cos(CAM.pitch); VW.sn = Math.sin(CAM.pitch);
            VW.cx = w * 0.5; VW.cy = h * 0.6 + Math.tan(CAM.pitch) * VW.F;               // the horizon sits at 60% of the screen height
        }
        function proj(X, Y, Z) {
            var dx = X - CAM.x, dy = Y - CAM.y, dz = Z - CAM.z;
            var zz = -dy * VW.sn + dz * VW.cs, yy = dy * VW.cs + dz * VW.sn, k = VW.F / zz;
            return [VW.cx + dx * k, VW.cy - yy * k, zz];
        }
        var shCache = {};
        function sh(col, f) {
            var key = col + f;
            if (shCache[key]) return shCache[key];
            var n = parseInt(col.slice(1), 16);
            return (shCache[key] = 'rgb(' + Math.round(((n >> 16) & 255) * f) + ',' + Math.round(((n >> 8) & 255) * f) + ',' + Math.round((n & 255) * f) + ')');
        }
        function quad(g, p1, p2, p3, p4, fill, edge) {
            g.fillStyle = fill; g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.lineTo(p4[0], p4[1]); g.closePath(); g.fill();
            if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.stroke(); }
        }
        var EDGE = 'rgba(0,0,0,0.17)';
        function box(g, x, y, z, sx, sy, sz, col, edge) {                 // a block: top, front and the side that faces the middle of the screen
            var x1 = x + sx, y1 = y + sy, z1 = z + sz, e = edge === undefined ? EDGE : edge;
            if (CAM.y > y1) quad(g, proj(x, y1, z), proj(x1, y1, z), proj(x1, y1, z1), proj(x, y1, z1), sh(col, 1), e);
            quad(g, proj(x, y1, z), proj(x1, y1, z), proj(x1, y, z), proj(x, y, z), sh(col, 0.82), e);
            if (x1 <= CAM.x) quad(g, proj(x1, y1, z), proj(x1, y1, z1), proj(x1, y, z1), proj(x1, y, z), sh(col, 0.64), e);
            else if (x >= CAM.x) quad(g, proj(x, y1, z), proj(x, y1, z1), proj(x, y, z1), proj(x, y, z), sh(col, 0.64), e);
        }

        // scene layout (1 unit = 1 block, y is up, z is away from the viewer)
        var XMIN = -64, XMAX = 64, ZMIN = 8, ZMAX = 100, ZSPLIT = 24;
        var RIVER = { x0: 8, x1: 11 };
        var GER = { x: -14.5, z: 36, r: 4.0 }, WELL = { x: -4.5, z: 25 }, TROUGH = { x0: -1.8, x1: 4.8, z: 26.8 };
        var DUNES = [{ x: -36, z: 92, r: 30, hgt: 15 }, { x: 40, z: 94, r: 30, hgt: 17 }, { x: -4, z: 99, r: 24, hgt: 11 }];
        function peakH(x, z) {                                                  // smooth sand mounds on the horizon (no rock, no snow)
            var m = 0;
            DUNES.forEach(function (p) {
                var d = Math.hypot((x - p.x) * 0.9, (z - p.z) * 1.3) / p.r;
                if (d < 1) m = Math.max(m, p.hgt * (0.5 + 0.5 * Math.cos(Math.PI * d)) * (0.92 + 0.08 * Math.sin(x * 0.55 + z * 0.3)));
            });
            return Math.round(m);
        }
        function pathAt(x, z) {                                              // a dirt road from the foreground to the ger door
            var t = clamp((z - 8) / 22, 0, 1), cxp = lerp(2.2, GER.x + 0.5, Math.pow(t, 1.1));
            return z < GER.z - GER.r + 0.6 && Math.abs(x + 0.5 - cxp) < 1.6;
        }
        function hAt(x, z) {
            if (x === Math.floor(WELL.x) && z === Math.floor(WELL.z)) return -3;
            if (x >= RIVER.x0 && x < RIVER.x1 && z < 72) return -1;
            var base = 0, ramp = clamp((x - 46) / 6, 0, 1);
            if (ramp > 0) {                                                  // the Gobi: tall dunes that grow into mountains
                var rz = 0.55 + z / 90, zf = clamp((z - 32) / 22, 0, 1);
                var tall = rz * (7 * Math.abs(Math.sin(x * 0.12 + z * 0.045 + 0.6)) + 3 * Math.abs(Math.sin(x * 0.26 - z * 0.1 + 1.7)) + 1.4 * Math.abs(Math.sin(x * 0.5 + z * 0.2)));
                var ripple = 1.1 * Math.abs(Math.sin(x * 0.5 + z * 0.2 + 0.4)) + 0.9 * Math.abs(Math.sin(x * 0.23 - z * 0.15 + 1.1));      // low wind ripples near the viewer
                base = Math.round(ramp * (ripple * (1 - zf) + tall * zf));
            } else if (z > 55) base = Math.round((z - 55) / 12 * (0.6 + 0.4 * Math.sin(x * 0.09 + z * 0.05)));
            return base + peakH(x, z);
        }
        function matAt(x, z, hh) {
            if (x === Math.floor(WELL.x) && z === Math.floor(WELL.z)) return 'hole';
            if (x >= RIVER.x0 && x < RIVER.x1 && z < 72) return 'bed';
            if (peakH(x, z) > 1) return 'sand';
            if (x >= 50 || (x >= 46 && hash(x, z, 5) < (x - 46) / 4)) return 'sand';
            if (pathAt(x, z)) return 'path';
            return 'grass';
        }
        var GRASS = ['#5fae3a', '#58a533', '#66b840', '#53a02f'], SAND = ['#e8d08e', '#dfc27d', '#ecd699', '#d9bb74'], STONE = ['#7d7d7d', '#757575', '#848484'];
        function topCol(m, x, z) {
            var n = hash(x, z, 3);
            if (m === 'grass') return GRASS[Math.floor(n * 4) % 4];
            if (m === 'sand') return SAND[Math.floor(n * 4) % 4];
            if (m === 'stone') return STONE[Math.floor(n * 3) % 3];
            if (m === 'snow') return '#f2f6ff';
            if (m === 'path') return n < 0.5 ? '#b89a5a' : '#ad8f50';
            if (m === 'hole') return '#1b140e';
            return '#d9c88a';
        }
        function sideCol(m, first, x, z) {
            var n = hash(x, z, 4);
            if (m === 'grass') return first ? '#5fae3a' : (n < 0.5 ? '#8b5a2b' : '#835428');
            if (m === 'sand') return SAND[Math.floor(n * 4) % 4];
            if (m === 'stone') return STONE[Math.floor(n * 3) % 3];
            if (m === 'snow') return first ? '#f2f6ff' : '#7d7d7d';
            if (m === 'hole') return '#2b1d10';
            return n < 0.5 ? '#8b5a2b' : '#835428';
        }

        var world = { far: null, near: null, rise: 0, ents: null };
        var smokeAt = { x: 0, y: 0, z: 0 }, WF = { x: 0, y: 0, z: 0, h: 11 }, FLOW = 4.0;

        function buildWorld() {
            setupCam();
            var cwid = Math.max(1, Math.round(w)), chei = Math.max(1, Math.round(h));
            var far = document.createElement('canvas'), near = document.createElement('canvas');
            far.width = near.width = cwid; far.height = near.height = chei;
            var gf = far.getContext('2d'), gn = near.getContext('2d'), items = [], x, z, i, k;

            // ----- terrain heights -----
            var NX = XMAX - XMIN, NZ = ZMAX - ZMIN, H = new Int16Array(NX * NZ);
            function hget(xx, zz) { if (xx < XMIN || xx >= XMAX || zz < ZMIN || zz >= ZMAX) return null; return H[(zz - ZMIN) * NX + (xx - XMIN)]; }
            for (z = ZMIN; z < ZMAX; z++) for (x = XMIN; x < XMAX; x++) H[(z - ZMIN) * NX + (x - XMIN)] = hAt(x, z);
            world.H = hget;

            function add(kz, ax, y, f) { items.push({ k: kz, ax: ax, y: y, f: f }); }
            function addBox(bx, by, bz, sx, sy, sz, col) {
                var p = proj(bx + sx / 2, by + sy / 2, bz + sz / 2);
                if (p[0] < -250 || p[0] > w + 250) return;
                add(bz + sz / 2, Math.abs(bx + sx / 2 - CAM.x), by, function (g) { box(g, bx, by, bz, sx, sy, sz, col); });
            }
            function addBoxK(kz, bx, by, bz, sx, sy, sz, col) {
                var p = proj(bx + sx / 2, by + sy / 2, bz + sz / 2);
                if (p[0] < -250 || p[0] > w + 250) return;
                add(kz, Math.abs(bx + sx / 2 - CAM.x), by, function (g) { box(g, bx, by, bz, sx, sy, sz, col); });
            }
            function ground(xx, zz) { return hget(Math.floor(xx), Math.floor(zz)) || 0; }

            // ----- terrain columns -----
            for (z = ZMAX - 1; z >= ZMIN; z--) {
                for (x = XMIN; x < XMAX; x++) {
                    var pc = proj(x + 0.5, 0, z + 0.5);
                    if (pc[0] < -200 || pc[0] > w + 200) continue;
                    (function (x, z) {
                        var Hc = hget(x, z), m = matAt(x, z, Hc), Hf = hget(x, z - 1), sxn = (x + 0.5 < CAM.x) ? x + 1 : x - 1, Hs = hget(sxn, z);
                        if (Hf === null) Hf = Hc - 1; if (Hs === null) Hs = Hc - 1;
                        add(z + 0.5, Math.abs(x + 0.5 - CAM.x), Hc, function (g) {
                            var yy, lvl = 0;
                            for (yy = Hc - 1; yy >= Math.max(Hf, Hc - 20); yy--) quad(g, proj(x, yy + 1, z), proj(x + 1, yy + 1, z), proj(x + 1, yy, z), proj(x, yy, z), sh(sideCol(m, yy === Hc - 1, x, z), 0.82), EDGE);
                            for (yy = Hc - 1; yy >= Math.max(Hs, Hc - 20); yy--) {
                                if (x + 0.5 < CAM.x) quad(g, proj(x + 1, yy + 1, z), proj(x + 1, yy + 1, z + 1), proj(x + 1, yy, z + 1), proj(x + 1, yy, z), sh(sideCol(m, yy === Hc - 1, x, z), 0.64), EDGE);
                                else quad(g, proj(x, yy + 1, z), proj(x, yy + 1, z + 1), proj(x, yy, z + 1), proj(x, yy, z), sh(sideCol(m, yy === Hc - 1, x, z), 0.64), EDGE);
                            }
                            quad(g, proj(x, Hc, z), proj(x + 1, Hc, z), proj(x + 1, Hc, z + 1), proj(x, Hc, z + 1), sh(topCol(m, x, z), 1), 'rgba(0,0,0,0.1)');
                            if (m === 'bed') quad(g, proj(x, -0.3, z), proj(x + 1, -0.3, z), proj(x + 1, -0.3, z + 1), proj(x, -0.3, z + 1), 'rgba(59,111,224,0.9)', 'rgba(255,255,255,0.12)');
                            else if (m === 'hole') quad(g, proj(x, -2.4, z), proj(x + 1, -2.4, z), proj(x + 1, -2.4, z + 1), proj(x, -2.4, z + 1), '#2f5fc4', null);
                        });
                    })(x, z);
                }
            }

            var nTerrain = items.length;

            // ----- trees, bushes, flowers, shrubs -----
            var LEAF = ['#2f7d32', '#3a8f3a', '#2a6f2c', '#4aa04a'];
            function tree(tx, tz, tall) {
                var yb = ground(tx, tz), lx, lz, dy;
                addBox(tx, yb, tz, 1, tall, 1, '#6b4a2b');
                for (dy = 0; dy < 4; dy++) {
                    var r = dy < 2 ? 2 : (dy === 2 ? 1 : 0);
                    for (lx = -r; lx <= r; lx++) for (lz = -r; lz <= r; lz++) {
                        if (dy < 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                        if (dy === 3 && Math.abs(lx) + Math.abs(lz) > 1 && r === 0) continue;
                        if (dy === 0 && lx === 0 && lz === 0) continue;
                        addBox(tx + lx, yb + tall - 1 + dy, tz + lz, 1, 1, 1, LEAF[Math.floor(hash(tx + lx, tz + lz + dy * 7, 21) * 4) % 4]);
                    }
                }
            }
            function bush(bx, bz) { var yb = ground(bx, bz); for (var lx = 0; lx < 2; lx++) for (var lz = 0; lz < 2; lz++) addBox(bx + lx, yb, bz + lz, 1, 1, 1, LEAF[(lx + lz + Math.floor(bx)) & 3]); addBox(bx + 0.5, yb + 1, bz + 0.5, 1, 0.7, 1, LEAF[1]); }
            function saxaul(sx, sz) { var yb = ground(sx, sz); addBox(sx, yb, sz, 0.35, 1.6, 0.35, '#6b5a3a'); addBox(sx - 0.4, yb + 1.5, sz - 0.3, 1.1, 0.6, 1.1, '#8a8a4a'); addBox(sx - 0.1, yb + 2.0, sz, 0.8, 0.5, 0.8, '#7a7a3e'); }
            function rock(rx, rz) { var yb = ground(rx, rz); addBox(rx, yb, rz, 1.2, 0.8, 1.0, '#8a8070'); addBox(rx + 0.2, yb + 0.8, rz + 0.1, 0.8, 0.5, 0.7, '#9a9080'); }
            function flower(fx, fz, col) { var yb = ground(fx, fz); addBox(fx, yb, fz, 0.12, 0.55, 0.12, '#2f7d32'); addBox(fx - 0.1, yb + 0.5, fz - 0.1, 0.32, 0.32, 0.32, col); }

            [[-23, 14, 6], [-31, 20, 5], [-26, 30, 6], [-40, 52, 6], [-42, 70, 6], [14, 66, 5]]
                .forEach(function (t) { tree(t[0], t[1], t[2]); });
            [[-16, 21], [-1, 40], [3, 29], [-20, 38], [-6, 56]].forEach(function (b2) { bush(b2[0], b2[1]); });
            for (i = 0; i < 90; i++) {
                var fx = Math.floor(rand(-34, 7)), fz = Math.floor(rand(10, 46));
                if (matAt(fx, fz, 0) !== 'grass' || Math.hypot(fx - GER.x, fz - GER.z) < 5 || (fz > 22 && fz < 36 && fx > -9 && fx < 8)) continue;
                flower(fx + rand(0.1, 0.8), fz + rand(0.1, 0.8), hash(fx, fz, 9) > 0.7 ? '#d7263d' : (hash(fx, fz, 10) > 0.5 ? '#ffffff' : '#ffd400'));
            }
            for (i = 0; i < 40; i++) {
                var sx2 = Math.floor(rand(16, 56)), sz2 = Math.floor(rand(12, 70));
                if (matAt(sx2, sz2, hget(sx2, sz2)) !== 'sand') continue;
                if (hash(sx2, sz2, 31) > 0.5) saxaul(sx2, sz2); else rock(sx2, sz2);
            }

            // ----- Turtle Rock (Melkhii khad): a granite giant shaped like a tortoise - domed scuted shell, head stretched out to the left, four legs, a tail -----
            (function () {
                var cx = -10, cz = 70, gy = ground(cx, cz), px, py, pz;
                function inShell(a, b, c) { if (b < 2) return false; var dx = (a - cx) / 11, dy = (b - 2) / 11.5, dz = (c - cz) / 7.6; return dx * dx + dy * dy + dz * dz <= 1; }
                function inHead(a, b, c) { var dx = (a - (cx + 15)) / 4.4, dy = (b - 11.6) / 3.4, dz = (c - cz) / 3.4; if (a > cx + 16.5 && b > 10 && b < 11 && Math.abs(c - cz) < 1.9) return false; return dx * dx + dy * dy + dz * dz <= 1; }
                function inNeck(a, b, c) { var dx = (a - (cx + 11.8)) / 3.5, dy = (b - 7.6) / 5.4, dz = (c - cz) / 3.4; return dx * dx + dy * dy + dz * dz <= 1; }
                function inTail(a, b, c) { var dx = (a - (cx - 12)) / 2.8, dy = (b - 2.0) / 1.2, dz = (c - cz) / 1.1; return dx * dx + dy * dy + dz * dz <= 1; }
                function inLeg(a, b, c) {
                    if (b < 0 || b > 4.4) return false;
                    var dx = a - cx, dz = Math.abs(c - cz);
                    var sp = (4.4 - b) * 0.55; return (Math.abs(Math.abs(dx) - (6.6 + sp)) < 2.0) && dz > 2.4 + sp * 0.8 && dz < 6.2 + sp * 0.8;
                }
                function solid(a, b, c) { return inShell(a, b, c) || inHead(a, b, c) || inNeck(a, b, c) || inTail(a, b, c) || inLeg(a, b, c); }
                for (px = Math.floor(cx - 15); px <= Math.ceil(cx + 20); px++) for (pz = Math.floor(cz - 10); pz <= Math.ceil(cz + 10); pz++) for (py = 0; py <= 17; py++) {
                    var X = px + 0.5, Y = py + 0.5, Z = pz + 0.5;
                    if (!solid(X, Y, Z)) continue;
                    var sx2 = X < CAM.x ? X + 1 : X - 1;
                    if (solid(X, Y + 1, Z) && solid(X, Y, Z - 1) && solid(sx2, Y, Z)) continue;                                          // buried: never seen
                    var n = hash(px, py * 7 + pz, 77), top = !solid(X, Y + 1, Z), col;
                    var shell = inShell(X, Y, Z), skin = !shell && (inHead(X, Y, Z) || inNeck(X, Y, Z));
                    if (shell) {
                        // scutes: a brick-like net of dark seams, alternating light and warm grey plates, moss on the crown
                        var row = Math.floor((py + (pz - cz) * 0.35 + 30) / 2.6), u = px - cx + (row % 2 ? 1.6 : 0), cell = Math.floor((u + 40) / 3.2), fx = ((u % 3.2) + 3.2) % 3.2;
                        var seam = fx < 0.9 || ((py + (pz - cz) * 0.35 + 30) % 2.6) < 0.9;
                        if (py <= 4) col = seam ? '#1f4d22' : '#2f7a34';                                                                // the dark rim of the shell
                        else if (seam) col = '#1f5a26';
                        else if (top && n > 0.55 && py > 9) col = '#8fcf4a';
                        else col = (cell + row) % 2 ? '#52b24a' : '#3f9a3e';
                    } else if (skin) {
                        col = !solid(X, Y - 1, Z) ? '#4a3018' : (n < 0.5 ? '#9a6a3a' : '#8a5c30');
                        // eye and mouth on the side that faces us
                        if (inHead(X, Y, Z) && !solid(X, Y, Z - 1) && px === cx + 17 && py === 13) col = '#1b1a14';
                        if (inHead(X, Y, Z) && !solid(X, Y, Z - 1) && px === cx + 17 && py === 14) col = '#f4ecd8';
                        if (inHead(X, Y, Z) && !solid(X, Y, Z - 1) && py === 9 && px >= cx + 17) col = '#a02e2e';
                    } else {
                        col = inLeg(X, Y, Z) ? (py < 1 ? '#4a3018' : (n < 0.5 ? '#8a5c30' : '#7c5028')) : '#8a5c30';                    // legs and tail
                    }
                    addBox(px, gy + py, pz, 1, 1, 1, col);
                }
                // water pours from the mouth like a waterfall into a little pool
                var wy, wc = ['#4aa3ff', '#7cc4ff', '#bfe4ff', '#5ab0ff'];
                WF.x = cx + 19; WF.y = gy; WF.z = cz - 1;                                      // the falling water itself is animated every frame (drawWaterfall)
                // a few loose boulders in front of it
                [[cx - 5, cz - 11], [cx + 4, cz - 10], [cx - 11, cz - 8]].forEach(function (r2) { rock(Math.floor(r2[0]), Math.floor(r2[1])); });
            })();
            function pine(qx, qz, tall) {
                var yb = ground(qx, qz), lay, lx, lz, half = [2, 2, 1, 1, 0];
                addBox(qx, yb, qz, 1, tall, 1, '#5a3d22');
                for (lay = 0; lay < 5; lay++) for (lx = -half[lay]; lx <= half[lay]; lx++) for (lz = -half[lay]; lz <= half[lay]; lz++)
                    addBox(qx + lx, yb + tall - 2 + lay, qz + lz, 1, 1, 1, (lx + lz + lay) % 2 ? '#1f5a2a' : '#276a32');
            }
            [[34, 50, 7], [30, 58, 7], [26, 63, 7], [17, 61, 6], [37, 42, 5], [12, 60, 6], [36, 58, 7], [22, 66, 7]].forEach(function (p) { pine(p[0], p[1], p[2]); });
            for (i = 0; i < 70; i++) {                                                  // flowers in the meadow on the right as well
                var gx = Math.floor(rand(13, 36)), gz = Math.floor(rand(10, 36));
                if (matAt(gx, gz, 0) !== 'grass' || (gz > 22 && gz < 28 && gx > 12 && gx < 19)) continue;
                flower(gx + rand(0.1, 0.8), gz + rand(0.1, 0.8), hash(gx, gz, 9) > 0.7 ? '#d7263d' : (hash(gx, gz, 10) > 0.5 ? '#ffffff' : '#ffd400'));
            }

            // ----- the ger: a smooth round felt tent (cylinder wall and a round, gently domed roof), orange double door, crown and stovepipe -----
            (function () {
                var gy = ground(GER.x, GER.z), cx = GER.x, cz = GER.z, rW = GER.r, N = 72, LGT = [-0.45, 0.8, -0.4];
                function pt(r, y, ang) { return proj(cx + Math.cos(ang) * r, y, cz + Math.sin(ang) * r); }
                function lit(nx, ny, nz) { return 0.6 + 0.48 * Math.max(0, nx * LGT[0] + ny * LGT[1] + nz * LGT[2]); }
                add(cz, 0, gy, function (g) {
                    var i, a0, a1, am, nx, nz, f, lv;
                    // wall: white felt, a brown rope round it, a blue band with golden squares at the top
                    var levels = [[0, 0.9, 'w'], [0.9, 1.08, 'rope'], [1.08, 1.85, 'w'], [1.85, 2.03, 'rope'], [2.03, 2.7, 'w'], [2.7, 3.0, 'band']];
                    for (i = 0; i < N; i++) {
                        a0 = i / N * 6.2832; a1 = (i + 1) / N * 6.2832; am = (a0 + a1) / 2; nx = Math.cos(am); nz = Math.sin(am);
                        if ((CAM.x - (cx + nx * rW)) * nx + (CAM.z - (cz + nz * rW)) * nz <= 0) continue;
                        f = lit(nx, 0, nz);
                        for (var q = 0; q < levels.length; q++) {
                            lv = levels[q];
                            var col = lv[2] === 'w' ? '#f4efe3' : (lv[2] === 'rope' ? '#7a5a32' : (i % 4 === 1 ? '#ffd24a' : '#1f4aa3')), fs = sh(col, f);
                            quad(g, pt(rW, gy + lv[1], a0), pt(rW, gy + lv[1], a1), pt(rW, gy + lv[0], a1), pt(rW, gy + lv[0], a0), fs, fs);
                        }
                        // the double door, painted on the curved wall: orange panels, a dark frame, a seam and golden knobs
                        var dd = Math.abs(am - 4.7124) * rW;
                        if (dd < 1.3) {
                            function dq(y1b, y2b, c0) { var cc = sh(c0, f); quad(g, pt(rW + 0.02, gy + y2b, a0), pt(rW + 0.02, gy + y2b, a1), pt(rW + 0.02, gy + y1b, a1), pt(rW + 0.02, gy + y1b, a0), cc, cc); }
                            if (dd < 1.0) {
                                dq(0, 2.2, dd < 0.07 ? '#8b2e0f' : '#d4501e');
                            } else dq(0, 2.2, '#8b2e0f');
                            dq(2.2, 2.5, '#8b2e0f');
                        }
                    }
                    // the olziy (endless-knot) ornament and small handles on the door, drawn finely on the curved wall
                    (function () {
                        var A0 = 4.7124, fd = lit(0, 0, -1), OLZ = ['11111', '00001', '11101', '10001', '10111'];
                        function dp(s, y) { return pt(rW + 0.03, gy + y, A0 + s / rW); }
                        function dr(s0, s1, y0, y1, c0) { var cc = sh(c0, fd); quad(g, dp(s0, y1), dp(s1, y1), dp(s1, y0), dp(s0, y0), cc, cc); }
                        [-0.5, 0.5].forEach(function (sc, side) {
                            [1.65, 0.6].forEach(function (yc) {
                                var cs = 0.11, rr, cc2;
                                for (rr = 0; rr < 5; rr++) for (cc2 = 0; cc2 < 5; cc2++) {
                                    var col2 = side ? 4 - cc2 : cc2;                                                       // the right leaf is the mirror image
                                    if (OLZ[rr].charAt(col2) === '1') dr(sc + (cc2 - 2.5) * cs, sc + (cc2 - 1.5) * cs, yc + (2.5 - rr - 1) * cs, yc + (2.5 - rr) * cs, '#ffd24a');
                                }
                            });
                            dr(sc - 0.43, sc + 0.43, 1.12, 1.16, '#ffd24a'); dr(sc - 0.43, sc + 0.43, 0.04, 0.08, '#ffd24a');   // gold lines across the leaf
                        });
                        dr(-0.2, -0.14, 0.9, 1.25, '#3b2410'); dr(0.14, 0.2, 0.9, 1.25, '#3b2410');                   // small handles
                        dr(-0.19, -0.15, 0.93, 1.0, '#ffd24a'); dr(0.15, 0.19, 0.93, 1.0, '#ffd24a');
                    })();
                    // roof: a smooth round dome of white felt with ropes running down it and a darker flap at the eaves
                    var R0 = rW + 0.55, rings = 10, H = 2.6, y0 = gy + 3, r1, r2, y1, y2, t1, t2, j2, nyv;
                    function rad(t) { return R0 - (R0 - 1.0) * t; }                       // a straight cone, as a real ger roof is
                    function hgt(t) { return y0 + H * t; }
                    for (i = 0; i < rings; i++) {
                        t1 = i / rings; t2 = (i + 1) / rings; r1 = rad(t1); r2 = rad(t2); y1 = hgt(t1); y2 = hgt(t2);
                        var dy = y2 - y1, dr = r2 - r1, nl = Math.hypot(dy, dr);
                        for (j2 = 0; j2 < N; j2++) {
                            a0 = j2 / N * 6.2832; a1 = (j2 + 1) / N * 6.2832; am = (a0 + a1) / 2;
                            nx = Math.cos(am) * dy / nl; nyv = -dr / nl; nz = Math.sin(am) * dy / nl;
                            var mx = cx + Math.cos(am) * (r1 + r2) / 2, my = (y1 + y2) / 2, mz = cz + Math.sin(am) * (r1 + r2) / 2;
                            if ((CAM.x - mx) * nx + (CAM.y - my) * nyv + (CAM.z - mz) * nz <= 0) continue;
                            var rc = i === 0 ? '#ddd3b8' : ((j2 % 9 === 0) ? '#8b6b3b' : '#f3eddc'), fr2 = sh(rc, lit(nx, nyv, nz));
                            quad(g, pt(r1, y1, a0), pt(r1, y1, a1), pt(r2, y2, a1), pt(r2, y2, a0), fr2, fr2);
                        }
                    }
                    // the crown (toono): a round wooden ring with an open centre
                    var yt = hgt(1), k2, ring = [], hole = [];
                    for (k2 = 0; k2 < 28; k2++) { var ca = k2 / 28 * 6.2832; ring.push(pt(1.15, yt + 0.12, ca)); hole.push(pt(0.55, yt + 0.16, ca)); }
                    g.fillStyle = sh('#a0522d', 1); g.beginPath(); ring.forEach(function (p, n2) { if (n2) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill();
                    g.fillStyle = sh('#4a2410', 1); g.beginPath(); hole.forEach(function (p, n2) { if (n2) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill();
                });
                // crown spokes and the stovepipe sit on the roof, so they are drawn after it
                addBoxK(cz - 0.2, cx - 1.1, gy + 5.6, cz - 0.1, 2.2, 0.18, 0.2, '#6b3418'); addBoxK(cz - 0.2, cx - 0.1, gy + 5.6, cz - 1.1, 0.2, 0.18, 2.2, '#6b3418');
                addBoxK(cz - 0.2, cx + 0.625, gy + 5.5, cz - 0.075, 0.15, 0.62, 0.15, '#3b3b3b'); addBoxK(cz - 0.2, cx + 0.59, gy + 6.07, cz - 0.11, 0.22, 0.07, 0.22, '#2b2b2b');
                smokeAt.x = cx + 0.7; smokeAt.y = gy + 6.3; smokeAt.z = cz;
            })();

            // ----- the well: a stone crib round the shaft and an A-frame with a pulley -----
            (function () {
                var wx = Math.floor(WELL.x), wz = Math.floor(WELL.z), a, b2;
                for (a = -1; a <= 1; a++) for (b2 = -1; b2 <= 1; b2++) {
                    if (!a && !b2) continue;
                    addBox(wx + a, 0, wz + b2, 1, 0.9, 1, (a + b2) % 2 ? '#8a8a8a' : '#777777');
                }
                function post(x1, x2) {
                    var n = 9;
                    for (var q = 0; q <= n; q++) { var t = q / n; addBox(lerp(x1, x2, t) - 0.18, 0.9 + t * 4.6, wz + 0.4, 0.36, 0.6, 0.36, '#7a4a24'); }
                }
            })();

            // ----- fences: a corral behind the trough -----
            (function () {
                var fz = 33.2, xa = -3.5, xb = 7.5, q;
                function rails(x1, z1, x2, z2) {
                    var n = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.4));
                    for (q = 0; q <= n; q++) {
                        var px = lerp(x1, x2, q / n), pz = lerp(z1, z2, q / n);
                        addBox(px - 0.15, 0, pz - 0.15, 0.3, 1.4, 0.3, '#8b5a2b');
                        if (q < n) {
                            var nx = lerp(x1, x2, (q + 1) / n), nz = lerp(z1, z2, (q + 1) / n);
                            addBox(Math.min(px, nx), 0.45, Math.min(pz, nz) - 0.08, Math.abs(nx - px) + 0.12, 0.2, Math.abs(nz - pz) + 0.16, '#a97f48');
                            addBox(Math.min(px, nx), 0.95, Math.min(pz, nz) - 0.08, Math.abs(nx - px) + 0.12, 0.2, Math.abs(nz - pz) + 0.16, '#a97f48');
                        }
                    }
                }
                rails(xa, fz, xb, fz); rails(xa, 28.6, xa, fz); rails(xb, 28.6, xb, fz);
            })();

            // ----- render the static scene in two layers: everything behind the animals, and everything in front of them -----
            items.slice(0, nTerrain).forEach(function (it) { it.t = true; });
            items.sort(function (p, q) { return (q.k - p.k) || (q.ax - p.ax) || (p.y - q.y); });
            var mask = document.createElement('canvas'), gm;
            mask.width = cwid; mask.height = chei; gm = mask.getContext('2d');                       // only the standing things (no ground): they hide the river ripples
            items.forEach(function (it) { it.f(it.k >= ZSPLIT ? gf : gn); if (it.k >= ZSPLIT && !it.t) it.f(gm); });
            // distance haze, strongest at the horizon
            var hz = VW.cy - Math.tan(CAM.pitch) * VW.F, haze = gf.createLinearGradient(0, hz - h * 0.2, 0, hz + h * 0.1);
            haze.addColorStop(0, 'rgba(215,235,255,0)'); haze.addColorStop(0.6, 'rgba(215,235,255,0.42)'); haze.addColorStop(1, 'rgba(215,235,255,0)');
            gf.fillStyle = haze; gf.fillRect(0, hz - h * 0.2, w, h * 0.3);

            world.far = far; world.near = near; world.mask = mask; world.tmp = document.createElement('canvas'); world.tmp.width = cwid; world.tmp.height = chei;
            var mk = function (kind, x0, x1, zz) { return { kind: kind, x0: x0, x1: x1, x: rand(x0, x1), z: zz, dir: Math.random() < 0.5 ? -1 : 1, face: 1, t: rand(0.5, 4), sp: rand(0.35, 0.7), ph: rand(0, 6) }; };
            world.animals = [mk('sheep', -2.5, 6, 29.3), mk('sheep', -2.5, 6, 30.5), mk('goat', -2.5, 6, 29.9), mk('camel', 1.5, 6.4, 31.9), mk('bear', 12.6, 18, 24.4)];
        }

        // animal models (blocks, facing +x): [x, y, z, sx, sy, sz, colour]
        var MODELS = {
            sheep: { s: 1, legs: [[-0.7, -0.3], [-0.7, 0.1], [0.4, -0.3], [0.4, 0.1]], lw: 0.22, lh: 0.7, lc: '#6b6b6b',
                parts: [[-0.9, 0.7, -0.45, 1.8, 0.9, 0.9, '#f2f2f2'], [0.85, 0.85, -0.27, 0.6, 0.6, 0.54, '#c9ae8b'], [0.9, 1.35, -0.4, 0.2, 0.2, 0.15, '#b89a76'], [0.9, 1.35, 0.25, 0.2, 0.2, 0.15, '#b89a76']] },
            goat: { s: 1, legs: [[-0.7, -0.3], [-0.7, 0.1], [0.5, -0.3], [0.5, 0.1]], lw: 0.2, lh: 0.8, lc: '#8d7a62',
                parts: [[-0.9, 0.8, -0.4, 1.8, 0.8, 0.8, '#c4b08f'], [0.8, 1.0, -0.28, 0.75, 0.75, 0.56, '#b09a78'], [1.0, 1.7, -0.2, 0.12, 0.45, 0.12, '#f0e8d8'], [1.0, 1.7, 0.1, 0.12, 0.45, 0.12, '#f0e8d8'], [1.4, 0.75, -0.06, 0.12, 0.35, 0.12, '#8d7a62']] },
            camel: { s: 1.0, legs: [[-1.25, -0.4], [-1.25, 0.05], [1.0, -0.4], [1.0, 0.05]], lw: 0.32, lh: 1.5, lc: '#8a6a3a',
                parts: [[-1.55, 1.5, -0.5, 3.1, 1.1, 1.0, '#b08a55'], [-1.0, 2.55, -0.35, 0.85, 0.85, 0.7, '#a07a48'], [0.05, 2.55, -0.35, 0.85, 0.85, 0.7, '#a07a48'],
                    [-0.85, 3.35, -0.2, 0.55, 0.2, 0.4, '#8a6a3a'], [0.2, 3.35, -0.2, 0.55, 0.2, 0.4, '#8a6a3a'],
                    [1.3, 2.2, -0.27, 0.6, 1.0, 0.54, '#b08a55'], [1.5, 3.1, -0.27, 0.6, 0.85, 0.54, '#b08a55'], [1.7, 3.85, -0.3, 1.0, 0.52, 0.6, '#a07a48'],
                    [2.55, 3.75, -0.22, 0.32, 0.38, 0.44, '#c9a875'], [1.95, 4.35, -0.28, 0.18, 0.18, 0.16, '#8a6a3a'], [-1.75, 2.0, -0.1, 0.22, 1.0, 0.22, '#8a6a3a'], [1.45, 2.3, -0.3, 0.2, 0.7, 0.6, '#8a6a3a']] },
            bear: { s: 1.15, legs: [[-0.8, -0.55], [-0.8, 0.15], [0.7, -0.55], [0.7, 0.15]], lw: 0.42, lh: 0.8, lc: '#5a3d22',
                parts: [[-1.0, 0.75, -0.6, 2.0, 1.15, 1.2, '#7a5532'], [-0.3, 1.85, -0.5, 1.2, 0.35, 1.0, '#6b4a2e'], [0.7, 0.8, -0.62, 0.5, 1.0, 1.24, '#d9b98a'],
                    [0.9, 0.9, -0.4, 0.85, 0.85, 0.8, '#7a5532'], [1.65, 0.95, -0.22, 0.35, 0.42, 0.44, '#c9a572'], [1.95, 1.2, -0.1, 0.12, 0.14, 0.2, '#111111'],
                    [1.45, 1.45, -0.4, 0.1, 0.1, 0.06, '#111111'], [1.05, 1.7, -0.35, 0.24, 0.24, 0.2, '#5a3d22'], [1.05, 1.7, 0.15, 0.24, 0.24, 0.2, '#5a3d22'], [-1.1, 1.4, -0.1, 0.18, 0.18, 0.18, '#5a3d22']] }
        };

        MODELS.cub = { s: 0.6, legs: MODELS.bear.legs, lw: MODELS.bear.lw, lh: MODELS.bear.lh, lc: MODELS.bear.lc, parts: MODELS.bear.parts };      // a mazaalai cub

        // dynamic things, drawn every frame between the two static layers
        function entList(dt) {
            var list = [], a;
            // ---- animals wander inside their own area ----
            world.animals.forEach(function (an) {
                an.t -= dt;
                if (an.t <= 0) { an.t = rand(2, 6); an.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); an.sp = rand(0.35, 0.7); }
                an.x += an.dir * an.sp * dt * speed;
                if (an.x < an.x0) { an.x = an.x0; an.dir = 1; } if (an.x > an.x1) { an.x = an.x1; an.dir = -1; }
                if (an.dir) an.face = an.dir;
                list.push({ z: an.z, f: function (g) { drawAnimal(g, an); } });
            });
            list.push({ z: smokeAt.z, f: drawSmoke });
            list.push({ z: WF.z, f: drawWaterfall });
            list.sort(function (p, q) { return q.z - p.z; });
            return list;
        }
        function drawAnimal(g, an) {
            var md = MODELS[an.kind], gy = world.H(Math.floor(an.x), Math.floor(an.z)) || 0, f = an.face, s = md.s, sw = an.dir ? Math.sin(T * 7 + an.ph) * 0.25 : 0, parts = [], k;
            function P(px, py, pz, sx, sy, sz, col) { var cx = f > 0 ? px : -px - sx; parts.push([an.x + cx * s, gy + py * s, an.z + pz * s, sx * s, sy * s, sz * s, col]); }
            md.parts.forEach(function (p) { P(p[0], p[1], p[2], p[3], p[4], p[5], p[6]); });
            md.legs.forEach(function (l, i2) { P(l[0] + (i2 % 2 ? sw : -sw), 0, l[1], md.lw, md.lh, md.lw, md.lc); });
            parts.sort(function (p, q) { return (q[2] + q[5] / 2 - p[2] - p[5] / 2) || (Math.abs(q[0] + q[3] / 2 - CAM.x) - Math.abs(p[0] + p[3] / 2 - CAM.x)) || (p[1] - q[1]); });
            parts.forEach(function (p) { box(g, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); });
        }
        function drawWaterfall(g) {
            var k, y, cols = ['#4aa3ff', '#7cc4ff', '#bfe4ff', '#5ab0ff'];
            box(g, WF.x + 0.15, WF.y, WF.z + 0.15, 1.7, WF.h - 1, 1.7, '#3b8fe0', null);
            box(g, WF.x - 2.2, WF.y + WF.h - 1, WF.z + 0.3, 2.4, 0.8, 1.4, '#5ab0ff', null);                   // the stream leaves the open mouth ...
            box(g, WF.x - 0.05, WF.y + WF.h - 1.2, WF.z + 0.15, 1.9, 1.0, 1.7, '#7cc4ff', null);                  // ... and bends down                       // the body of the stream
            for (k = 0; k < 16; k++) {                                                                   // bright streaks sliding down it
                y = (WF.h - 1) - ((k * 0.7 + T * FLOW) % (WF.h - 1));
                box(g, WF.x + ((k * 5) % 3) * 0.45, WF.y + y - 0.55, WF.z - 0.05 - (k % 2) * 0.05, 0.7 + (k % 3) * 0.3, 0.55 + (k % 2) * 0.3, 1.1, cols[k % 4], null);
            }
            for (k = 0; k < 7; k++) {                                                                    // splash and foam where it lands
                var a2 = (T * 1.6 + k / 7) % 1, sx = WF.x + 1 + Math.sin(k * 2.4) * (0.6 + a2 * 1.6), sy = WF.y + 0.1 + Math.sin(a2 * 3.14) * 1.1;
                box(g, sx - 0.15, sy, WF.z + 0.4 + Math.cos(k * 1.7) * 1.2, 0.3, 0.3, 0.3, '#e8f6ff', null);
            }
        }
        function drawTrough(g) {
            var level = 0.8, x0 = TROUGH.x0, len = TROUGH.x1 - TROUGH.x0, z0 = TROUGH.z;
            box(g, x0, 0, z0, len, 0.35, 1.3, '#7a5230');
            box(g, x0, 0.35, z0, len, 0.75, 0.3, '#7a5230'); box(g, x0, 0.35, z0 + 1.0, len, 0.75, 0.3, '#7a5230');
            box(g, x0, 0.35, z0, 0.3, 0.75, 1.3, '#5a3a1e'); box(g, x0 + len - 0.3, 0.35, z0, 0.3, 0.75, 1.3, '#5a3a1e');
            box(g, x0 + 0.3, 0.35, z0 + 0.3, len - 0.6, 0.15 + 0.5 * level, 0.7, '#3b6fe0', 'rgba(255,255,255,0.15)');
        }
        function drawSmoke(g) {
            for (var i = 0; i < 6; i++) {
                var age = ((T * 0.28 + i / 6) % 1), p = proj(smokeAt.x + Math.sin(age * 7 + i) * 0.4, smokeAt.y + age * 4.5, smokeAt.z), s = (0.45 + age * 0.9) * VW.F / p[2];
                g.fillStyle = 'rgba(232,232,232,' + (0.6 * (1 - age)) + ')';
                g.fillRect(Math.round(p[0] - s / 2), Math.round(p[1] - s / 2), Math.round(s), Math.round(s));
            }
        }
        // the herder lowers the bucket, pulls it up hand over hand and pours it into the trough for the livestock
        function drawWellDyn(g) {
            var wx = Math.floor(WELL.x) + 0.5, wz = Math.floor(WELL.z) + 0.5, ph = (T % 9) / 9, depth = 0, pour = 0;
            if (ph < 0.28) depth = ph / 0.28; else if (ph < 0.38) depth = 1; else if (ph < 0.78) depth = 1 - (ph - 0.38) / 0.4; else if (ph < 0.94) pour = (ph - 0.78) / 0.16;
            var pulling = ph >= 0.38 && ph < 0.78, py = 5.45, by = lerp(4.0, -2.0, ease(depth));
            var hx = -8.1, hz = 25.4, handX = hx + 0.8, handY = 2.9 - (1 - depth) * 0 + (1 - depth) * -1.0 + (pulling ? Math.sin(T * 6) * 0.18 : 0);
            // herder (blue deel, red sash, pointed hat)
            var parts = [
                [hx - 0.34, 0, hz - 0.15, 0.32, 1.0, 0.32, '#2b1b10'], [hx + 0.04, 0, hz - 0.15, 0.32, 1.0, 0.32, '#2b1b10'],
                [hx - 0.45, 0.95, hz - 0.25, 0.9, 1.4, 0.6, '#1f4aa3'], [hx - 0.46, 1.55, hz - 0.26, 0.92, 0.25, 0.62, '#d7263d'], [hx - 0.46, 2.3, hz - 0.26, 0.92, 0.12, 0.62, '#ffd24a'],
                [hx - 0.28, 2.4, hz - 0.18, 0.56, 0.56, 0.46, '#e0b087'],
                [hx - 0.34, 2.9, hz - 0.22, 0.68, 0.3, 0.54, '#c1121f'], [hx - 0.2, 3.2, hz - 0.12, 0.4, 0.45, 0.34, '#c1121f'], [hx - 0.06, 3.62, hz - 0.02, 0.12, 0.12, 0.12, '#ffd900']
            ];
            // rope: pulley -> hands, pulley -> bucket
            var pp = proj(wx - 0.1, py, wz + 0.1), ph1 = proj(handX, handY, hz), bk = proj(wx + 0.55, py - 0.1, wz + 0.1), bb = proj(wx + 0.55, by + 0.55, wz + 0.1);
            g.strokeStyle = '#e0d2ab'; g.lineWidth = 2; g.beginPath(); g.moveTo(pp[0], pp[1]); g.lineTo(ph1[0], ph1[1]); g.stroke();
            g.beginPath(); g.moveTo(bk[0], bk[1]); g.lineTo(bb[0], bb[1]); g.stroke();
            parts.forEach(function (p) { box(g, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); });
            // arms as a few small blocks towards the hands
            for (var q = 0; q <= 4; q++) {
                var t = q / 4, ax = lerp(hx + 0.3, handX, t), ay = lerp(2.1, handY, t);
                box(g, ax - 0.12, ay - 0.12, hz - 0.12, 0.24, 0.24, 0.24, q === 4 ? '#e0b087' : '#1f4aa3', null);
            }
            // bucket (full when it comes up) and the stream into the trough
            box(g, wx + 0.3, by, wz - 0.15, 0.5, 0.5, 0.5, '#7a4a24');
            if (depth < 0.9 && ph > 0.3 && pour < 1) box(g, wx + 0.34, by + 0.46, wz - 0.11, 0.42, 0.08, 0.42, '#6f9bf5', null);
            if (pour > 0) {
                for (var s2 = 0; s2 < 9; s2++) {
                    var u = s2 / 8, px2 = lerp(wx + 0.8, TROUGH.x0 + 0.6, u), py2 = lerp(py - 0.5, 1.0, u * u), pz2 = lerp(wz, TROUGH.z + 0.6, u), pr = proj(px2, py2, pz2), ss = 0.18 * VW.F / pr[2];
                    g.fillStyle = '#6f9bf5'; g.fillRect(Math.round(pr[0]), Math.round(pr[1]), Math.max(2, Math.round(ss)), Math.max(3, Math.round(ss * 1.6)));
                }
            }
        }

        // clouds: soft, puffy cumulus (clusters of round puffs with a flat shaded underside), drawn from pre-rendered sprites
        var clouds = [];
        function makeCloudSprite() {
            var cw = 380, ch = 170, c = document.createElement('canvas'); c.width = cw; c.height = ch;
            var g = c.getContext('2d'), n = 8 + Math.floor(Math.random() * 4), i, base = 128;
            for (i = 0; i < n; i++) {
                var t = i / (n - 1), mid = 1 - Math.abs(t - 0.5) * 2;                          // puffs are bigger in the middle
                var r = 26 + mid * 34 + Math.random() * 14, x = 50 + t * (cw - 100) + (Math.random() - 0.5) * 20, y = base - r * (0.55 + Math.random() * 0.35);
                var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
                gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#f7fafd'); gr.addColorStop(1, '#e9f0f8');
                g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
            }
            g.globalCompositeOperation = 'source-atop';                                         // a grey-blue underside, only on the cloud itself
            var sg = g.createLinearGradient(0, base - 40, 0, base + 6); sg.addColorStop(0, 'rgba(190,205,228,0)'); sg.addColorStop(1, 'rgba(176,194,222,0.7)');
            g.fillStyle = sg; g.fillRect(0, base - 40, cw, 60);
            g.globalCompositeOperation = 'destination-out'; g.fillRect(0, base + 3, cw, ch);   // flat bottom
            return c;
        }
        function buildClouds() {
            clouds = [];
            for (var i = 0; i < 3; i++) {
                var cz = rand(45, 90);
                clouds.push({ x: -60 + i * 60 + rand(-15, 15), y: rand(15, 24) + cz * 0.1, z: cz, v: rand(0.8, 2.2), wd: rand(15, 28), spr: makeCloudSprite() });
            }
        }
        function drawClouds(day, dt) {
            if (day <= 0.02) return;
            ctx.globalAlpha = day * 0.95;
            ctx.imageSmoothingEnabled = true;
            clouds.slice().sort(function (p, q) { return q.z - p.z; }).forEach(function (c) {
                c.x += c.v * dt * speed; if (c.x > 100) c.x = -100;
                var pr = proj(c.x, c.y, c.z), pw = c.wd * VW.F / pr[2], ph = pw * c.spr.height / c.spr.width;
                if (pr[0] < -pw || pr[0] > w + pw) return;
                ctx.drawImage(c.spr, pr[0] - pw / 2, pr[1] - ph * 0.75, pw, ph);
            });
            ctx.imageSmoothingEnabled = false;
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
                ctx.fillRect(Math.round(b.x), Math.round(y), 2 * s, s);
                ctx.fillRect(Math.round(b.x - 2 * s), Math.round(y + (up ? -s : s)), 2 * s, s);
                ctx.fillRect(Math.round(b.x + 2 * s), Math.round(y + (up ? -s : s)), 2 * s, s);
            });
            ctx.globalAlpha = 1;
        }

        // light ripples slide down the river towards the viewer; far ones are sorted in with the animals (so a camel hides them), near ones go over the near layer
        function ripple(k) {
            var span = 71 - ZMIN, wd = RIVER.x1 - RIVER.x0;
            return { z: ZMIN + (((k * 3.71 - T * FLOW) % span) + span) % span, x: RIVER.x0 + 0.15 + ((k * 0.618) % 1) * (wd - 0.9), len: 0.9 + (k % 4) * 0.5 };
        }
        function drawRipple(g, k, base) {
            var q = ripple(k), y = -0.27;
            g.globalAlpha = base * clamp(0.42 * (1 - q.z / 105), 0, 1) * (0.7 + 0.3 * Math.sin(T * 3 + k));
            quad(g, proj(q.x, y, q.z), proj(q.x + 0.7, y, q.z), proj(q.x + 0.7, y, q.z + q.len), proj(q.x, y, q.z + q.len), (k % 2) ? '#ffffff' : '#bfe0ff', null);
            g.globalAlpha = base;
        }
        function drawRiverFlow(g) {
            var base = sstep(0.4, 0.56, prog);
            for (var k = 0; k < 90; k++) if (ripple(k).z < ZSPLIT) drawRipple(g, k, base);
            g.globalAlpha = base;
        }
        function drawFarRipples(g) {                                         // far ripples go on a scratch canvas, standing things are cut out of it, then it is laid over the ground
            var t = world.tmp, tg = t.getContext('2d'), k;
            tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1; tg.clearRect(0, 0, t.width, t.height);
            for (k = 0; k < 90; k++) if (ripple(k).z >= ZSPLIT) drawRipple(tg, k, 1);
            tg.globalAlpha = 1; tg.globalCompositeOperation = 'destination-out'; tg.drawImage(world.mask, 0, 0); tg.globalCompositeOperation = 'source-over';
            g.drawImage(t, 0, 0);
        }

        function drawWorld(day, dt) {
            if (!world.far || prog < 0.36) return;
            var rise = (1 - sstep(0.36, 0.62, prog)) * h * 0.22;
            world.rise = rise;
            ctx.globalAlpha = sstep(0.4, 0.56, prog);
            ctx.save(); ctx.translate(0, rise);
            ctx.drawImage(world.far, 0, 0);
            drawFarRipples(ctx);
            entList(dt).forEach(function (e) { e.f(ctx); });
            ctx.drawImage(world.near, 0, 0);
            drawRiverFlow(ctx);
            ctx.restore();
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
            drawBlackHole(clamp((prog - 0.06) / 0.14, 0, 1), day);
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
        // Scroll watcher. When the shape (not the section) reaches the middle of the screen it is held for about a second
        // and a half so you can see it, then it explodes. Scrolling back up past that line folds it again at once.
        var scrollHost = sec.closest('.rc-app'), reachedPrev = false, holdTimer = 0, holding = false;
        function reachedMiddle() {
            var ar = scrollHost.getBoundingClientRect(), sr = stage.getBoundingClientRect();
            return { ay: sr.top - ar.top + CH() / 2, mid: ar.height * 0.5 };
        }
        function stopHold() { clearTimeout(holdTimer); holding = false; hub.classList.remove('rc-charging'); updateBtn(); }
        function watchScroll() {
            var m = reachedMiddle(), reached = m.ay <= m.mid;
            if (reached && !reachedPrev) {
                reachedPrev = true;
                if (state !== 'open') {
                    holding = true; hub.classList.add('rc-charging'); hubHint.textContent = 'exploding…';
                    clearTimeout(holdTimer);
                    holdTimer = setTimeout(function () {
                        var m2 = reachedMiddle();
                        stopHold();
                        if (m2.ay <= m2.mid + 40 && state !== 'open') setState('open');
                    }, 1500);
                }
            } else if (!reached && reachedPrev && m.ay > m.mid + 30) {
                reachedPrev = false;
                stopHold();
                if (state !== 'shape') setState('shape');
            }
        }
        scrollHost.addEventListener('scroll', watchScroll, { passive: true });
        setTimeout(watchScroll, 300);

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
