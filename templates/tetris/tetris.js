/* Tetris template — a playable falling-blocks arcade cabinet. While idle an AI plays a demo;
   every line the visitor clears unlocks a piece of the profile (job, project, skill...). */
(function () {
    'use strict';

    // ======================================================================
    // Engine: 10x20 well (+2 hidden spawn rows), SRS rotation with wall kicks, 7-bag,
    // hold, ghost, lock delay, T-spins, combos and back-to-back bonuses.
    // ======================================================================
    var COLS = 10, ROWS = 20, HIDDEN = 2, H = ROWS + HIDDEN;
    var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    var COLORS = { I: '#2de2e6', O: '#ffd23f', T: '#b967ff', S: '#3bf07a', Z: '#ff3864', J: '#3d7bff', L: '#ff9f1c' };
    var SHAPES = {
        I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
        L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
        O: [[1, 1], [1, 1]],
        S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
        T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
    };

    function rotateCW(m) {
        var n = m.length, out = [];
        for (var y = 0; y < n; y++) {
            out.push([]);
            for (var x = 0; x < n; x++) out[y].push(m[n - 1 - x][y]);
        }
        return out;
    }
    function cellsOf(m) {
        var cells = [];
        m.forEach(function (row, y) { row.forEach(function (v, x) { if (v) cells.push([x, y]); }); });
        return cells;
    }
    // PIECES[type][rot] = [[x, y], ...]
    var PIECES = {};
    TYPES.forEach(function (t) {
        var m = SHAPES[t], states = [];
        for (var r = 0; r < 4; r++) { states.push(cellsOf(m)); m = rotateCW(m); }
        PIECES[t] = states;
    });

    // SRS kick offsets (x right, y up), keyed "from>to"
    var KICKS = {
        '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
    };
    var KICKS_I = {
        '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
        '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
    };

    var LINE_SCORE = [0, 100, 300, 500, 800];
    var TSPIN_SCORE = [400, 800, 1200, 1600];
    var LOCK_DELAY = 500, LOCK_RESETS = 15, CLEAR_MS = 280;

    function gravityMs(level) {
        // Guideline curve: seconds per row = (0.8 - (level - 1) * 0.007) ^ (level - 1)
        return Math.max(16, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);
    }

    function emptyGrid() {
        var g = [];
        for (var y = 0; y < H; y++) g.push(new Array(COLS).fill(null));
        return g;
    }

    function createGame(events) {
        var g = {};
        events = events || {};
        function emit(name, payload) { if (events[name]) events[name](payload); }

        g.reset = function (startLevel) {
            g.grid = emptyGrid();
            g.bag = [];
            g.queue = [];
            g.hold = null;
            g.canHold = true;
            g.score = 0;
            g.lines = 0;
            g.startLevel = startLevel || 1;
            g.level = g.startLevel;
            g.combo = -1;
            g.b2b = false;
            g.over = false;
            g.clearing = null;
            g.piece = null;
            g.softDrop = false;
            g.dropAcc = 0;
            g.lockAcc = 0;
            g.lockResets = 0;
            g.lastWasRotate = false;
            g.lastKick = 0;
            fillQueue();
            spawn();
        };

        function fillQueue() {
            while (g.queue.length < 6) {
                if (!g.bag.length) {
                    g.bag = TYPES.slice();
                    for (var i = g.bag.length - 1; i > 0; i--) {
                        var j = Math.floor(Math.random() * (i + 1)), t = g.bag[i];
                        g.bag[i] = g.bag[j]; g.bag[j] = t;
                    }
                }
                g.queue.push(g.bag.pop());
            }
        }

        function collides(type, rot, x, y, grid) {
            grid = grid || g.grid;
            var cells = PIECES[type][rot];
            for (var i = 0; i < cells.length; i++) {
                var cx = x + cells[i][0], cy = y + cells[i][1];
                if (cx < 0 || cx >= COLS || cy >= H) return true;
                if (cy >= 0 && grid[cy][cx]) return true;
            }
            return false;
        }
        g.collides = collides;

        function spawn(type) {
            type = type || g.queue.shift();
            fillQueue();
            var p = { type: type, rot: 0, x: type === 'O' ? 4 : 3, y: 0 };
            if (collides(p.type, p.rot, p.x, p.y)) {
                g.piece = p;
                g.over = true;
                emit('gameOver', g);
                return;
            }
            // Drop straight into view when there's room, like the guideline spawn
            if (!collides(p.type, p.rot, p.x, p.y + 1)) p.y += 1;
            g.piece = p;
            g.dropAcc = 0;
            g.lockAcc = 0;
            g.lockResets = 0;
            g.lastWasRotate = false;
            emit('spawn', g);
        }

        function grounded() {
            var p = g.piece;
            return collides(p.type, p.rot, p.x, p.y + 1);
        }

        function touched() {
            // Moving/rotating a grounded piece buys more lock time, up to a limit
            if (grounded() && g.lockResets < LOCK_RESETS) { g.lockAcc = 0; g.lockResets++; }
        }

        g.active = function () { return !g.over && !g.clearing && g.piece; };

        g.move = function (dx) {
            if (!g.active()) return false;
            var p = g.piece;
            if (collides(p.type, p.rot, p.x + dx, p.y)) return false;
            p.x += dx;
            g.lastWasRotate = false;
            touched();
            emit('move', g);
            return true;
        };

        g.rotate = function (dir) {
            if (!g.active()) return false;
            var p = g.piece;
            if (p.type === 'O') return false;
            var to = (p.rot + (dir > 0 ? 1 : 3)) % 4;
            var table = (p.type === 'I' ? KICKS_I : KICKS)[p.rot + '>' + to];
            for (var i = 0; i < table.length; i++) {
                var nx = p.x + table[i][0], ny = p.y - table[i][1];
                if (!collides(p.type, to, nx, ny)) {
                    p.x = nx; p.y = ny; p.rot = to;
                    g.lastWasRotate = true;
                    g.lastKick = i;
                    touched();
                    emit('rotate', g);
                    return true;
                }
            }
            return false;
        };

        g.ghostY = function () {
            var p = g.piece, y = p.y;
            while (!collides(p.type, p.rot, p.x, y + 1)) y++;
            return y;
        };

        g.hardDrop = function () {
            if (!g.active()) return 0;
            var y = g.ghostY(), dist = y - g.piece.y;
            if (dist > 0) g.lastWasRotate = false;
            g.piece.y = y;
            g.score += dist * 2;
            emit('hardDrop', { dist: dist, game: g });
            lock();
            return dist;
        };

        g.holdPiece = function () {
            if (!g.active() || !g.canHold) return false;
            var cur = g.piece.type;
            g.canHold = false;
            if (g.hold) {
                var next = g.hold;
                g.hold = cur;
                spawn(next);
            } else {
                g.hold = cur;
                spawn();
            }
            emit('hold', g);
            return true;
        };

        function stepDown(soft) {
            var p = g.piece;
            if (collides(p.type, p.rot, p.x, p.y + 1)) return false;
            p.y++;
            g.lastWasRotate = false;
            if (soft) g.score += 1;
            return true;
        }

        function tSpinKind() {
            var p = g.piece;
            if (p.type !== 'T' || !g.lastWasRotate) return null;
            // 3-corner rule around the T's centre (which sits at 1,1 in its 3x3 box)
            var corners = [[0, 0], [2, 0], [0, 2], [2, 2]], filled = 0;
            var front = { 0: [[0, 0], [2, 0]], 1: [[2, 0], [2, 2]], 2: [[0, 2], [2, 2]], 3: [[0, 0], [0, 2]] }[p.rot];
            function solid(c) {
                var x = p.x + c[0], y = p.y + c[1];
                return x < 0 || x >= COLS || y >= H || (y >= 0 && !!g.grid[y][x]);
            }
            corners.forEach(function (c) { if (solid(c)) filled++; });
            if (filled < 3) return null;
            var frontFilled = front.filter(solid).length;
            return frontFilled === 2 || g.lastKick === 4 ? 'full' : 'mini';
        }

        function lock() {
            var p = g.piece, spin = tSpinKind(), topOut = true;
            PIECES[p.type][p.rot].forEach(function (c) {
                var y = p.y + c[1];
                if (y >= 0) g.grid[y][p.x + c[0]] = p.type;
                if (y >= HIDDEN) topOut = false;
            });
            var rows = [];
            for (var y = 0; y < H; y++) {
                if (g.grid[y].every(Boolean)) rows.push(y);
            }
            var n = rows.length;
            var difficult = n === 4 || (spin && n > 0);
            var gained = 0, wasB2b = g.b2b;
            if (spin === 'full') gained = TSPIN_SCORE[n] * g.level;
            else if (spin === 'mini') gained = (n ? 200 * n : 100) * g.level;
            else gained = LINE_SCORE[n] * g.level;
            if (n) {
                if (difficult && wasB2b) gained = Math.floor(gained * 1.5);
                g.b2b = difficult;
                g.combo++;
                if (g.combo > 0) gained += 50 * g.combo * g.level;
            } else {
                g.combo = -1;
            }
            g.score += gained;
            g.canHold = true;
            emit('lock', { game: g, rows: rows, spin: spin, gained: gained });

            if (topOut && !n) {
                g.over = true;
                emit('gameOver', g);
                return;
            }
            if (n) {
                g.piece = null;
                g.clearing = { rows: rows, t: 0, spin: spin, b2b: difficult && wasB2b };
                emit('clear', { game: g, count: n, rows: rows, spin: spin, combo: g.combo, gained: gained });
            } else {
                spawn();
            }
        }

        function finishClear() {
            var rows = g.clearing.rows;
            var keep = g.grid.filter(function (_, y) { return rows.indexOf(y) < 0; });
            while (keep.length < H) keep.unshift(new Array(COLS).fill(null));
            g.grid = keep;
            g.lines += rows.length;
            var newLevel = g.startLevel + Math.floor(g.lines / 10);
            if (newLevel !== g.level) {
                g.level = newLevel;
                emit('levelUp', g);
            }
            g.clearing = null;
            spawn();
        }

        g.update = function (dt) {
            if (g.over) return;
            if (g.clearing) {
                g.clearing.t += dt;
                if (g.clearing.t >= CLEAR_MS) finishClear();
                return;
            }
            if (!g.piece) return;
            var interval = gravityMs(g.level);
            if (g.softDrop) interval = Math.min(interval, 32);
            if (grounded()) {
                g.dropAcc = 0;
                g.lockAcc += dt;
                if (g.lockAcc >= LOCK_DELAY || (g.softDrop && g.lockAcc >= LOCK_DELAY * 0.6)) lock();
                return;
            }
            g.dropAcc += dt;
            while (g.dropAcc >= interval && g.piece && !g.clearing) {
                g.dropAcc -= interval;
                if (!stepDown(g.softDrop)) break;
            }
        };

        g.softStep = function () {
            if (!g.active()) return false;
            var moved = stepDown(true);
            if (moved) g.dropAcc = 0;
            return moved;
        };

        return g;
    }

    // ======================================================================
    // Demo AI: tries every rotation x column for the current piece and scores the
    // resulting well (height, holes, bumpiness, cleared lines).
    // ======================================================================
    function evaluateGrid(grid, cleared) {
        var heights = [], holes = 0, agg = 0, bump = 0;
        for (var x = 0; x < COLS; x++) {
            var h = 0, seen = false;
            for (var y = 0; y < H; y++) {
                if (grid[y][x]) { if (!seen) { h = H - y; seen = true; } }
                else if (seen) holes++;
            }
            heights.push(h);
            agg += h;
        }
        for (var i = 0; i < COLS - 1; i++) bump += Math.abs(heights[i] - heights[i + 1]);
        return -0.510066 * agg + 0.760666 * cleared - 0.35663 * holes - 0.184483 * bump;
    }

    function bestPlacement(game) {
        var p = game.piece, best = null;
        var rots = p.type === 'O' ? 1 : (p.type === 'I' || p.type === 'S' || p.type === 'Z') ? 2 : 4;
        for (var r = 0; r < rots; r++) {
            for (var x = -2; x < COLS; x++) {
                if (game.collides(p.type, r, x, p.y)) continue;
                var y = p.y;
                while (!game.collides(p.type, r, x, y + 1)) y++;
                var grid = game.grid.map(function (row) { return row.slice(); });
                PIECES[p.type][r].forEach(function (c) { if (y + c[1] >= 0) grid[y + c[1]][x + c[0]] = p.type; });
                var cleared = 0;
                grid = grid.filter(function (row) {
                    var full = row.every(Boolean);
                    if (full) cleared++;
                    return !full;
                });
                while (grid.length < H) grid.unshift(new Array(COLS).fill(null));
                var s = evaluateGrid(grid, cleared);
                if (!best || s > best.score) best = { rot: r, x: x, score: s };
            }
        }
        return best;
    }

    // ======================================================================
    // Drawing helpers
    // ======================================================================
    function shade(hex, amt) {
        var n = parseInt(hex.slice(1), 16);
        var r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
        function f(c) { return Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)); }
        return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
    }

    function drawBlock(ctx, x, y, s, color, alpha) {
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        var b = Math.max(2, Math.round(s * 0.14));
        ctx.fillStyle = color;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = shade(color, 0.45);                     // lit top / left bevel
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s - b, y + b); ctx.lineTo(x + b, y + b); ctx.lineTo(x + b, y + s - b); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(color, -0.42);                    // shaded bottom / right bevel
        ctx.beginPath(); ctx.moveTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x + b, y + s - b); ctx.lineTo(x + s - b, y + s - b); ctx.lineTo(x + s - b, y + b); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';               // glossy glint
        ctx.fillRect(x + b + 1, y + b + 1, Math.max(1, s * 0.22), Math.max(1, s * 0.12));
        ctx.globalAlpha = 1;
    }

    function drawGhost(ctx, x, y, s, color) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = Math.max(1, s * 0.07);
        var i = ctx.lineWidth / 2 + 1;
        ctx.strokeRect(x + i, y + i, s - i * 2, s - i * 2);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.fillRect(x + i, y + i, s - i * 2, s - i * 2);
        ctx.globalAlpha = 1;
    }

    function fitCanvas(cv, w, h) {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width = w + 'px';
        cv.style.height = h + 'px';
        var ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    }

    function drawMini(ctx, type, cx, cy, s) {
        if (!type) return;
        var cells = PIECES[type][0];
        var minX = 9, maxX = -9, minY = 9, maxY = -9;
        cells.forEach(function (c) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
        var w = (maxX - minX + 1) * s, h = (maxY - minY + 1) * s;
        cells.forEach(function (c) {
            drawBlock(ctx, Math.round(cx - w / 2 + (c[0] - minX) * s), Math.round(cy - h / 2 + (c[1] - minY) * s), s, COLORS[type]);
        });
    }

    // Tiny inline SVG tetromino used as a decorative glyph
    function minoSvg(type, size) {
        var cells = PIECES[type][0], s = size || 10;
        var minY = Math.min.apply(null, cells.map(function (c) { return c[1]; }));
        var maxX = Math.max.apply(null, cells.map(function (c) { return c[0]; })) + 1;
        var maxY = Math.max.apply(null, cells.map(function (c) { return c[1]; })) + 1 - minY;
        return '<svg class="tx-mino" viewBox="0 0 ' + maxX * s + ' ' + maxY * s + '" width="' + maxX * s + '" height="' + maxY * s + '" aria-hidden="true">' +
            cells.map(function (c) {
                return '<rect x="' + (c[0] * s + 0.5) + '" y="' + ((c[1] - minY) * s + 0.5) + '" width="' + (s - 1) + '" height="' + (s - 1) + '" fill="' + COLORS[type] + '"/>';
            }).join('') + '</svg>';
    }

    // ======================================================================
    // Sound: tiny square-wave bleeps, off until the visitor turns them on
    // ======================================================================
    var SOUND_KEY = 'tetrisSound.v1', BEST_KEY = 'tetrisBest.v1';
    function store(key, val) {
        try {
            if (val === undefined) return localStorage.getItem(key);
            localStorage.setItem(key, val);
        } catch (_) { /* storage blocked */ }
        return null;
    }

    // Sound is on unless the visitor muted it; the context is created by the START click
    var audio = { ctx: null, on: store(SOUND_KEY) !== '0' };
    function audioCtx() {
        if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return audio.ctx;
    }
    // Filtered white noise: whooshes, rumbles, booms
    function noise(dur, vol, freq, endFreq, delay) {
        if (!audio.on) return;
        try {
            var a = audioCtx(), t = a.currentTime + (delay || 0), len = Math.floor(a.sampleRate * dur);
            var buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
            for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            var src = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
            src.buffer = buf;
            f.type = 'lowpass';
            f.frequency.setValueAtTime(freq, t);
            f.frequency.exponentialRampToValueAtTime(endFreq || Math.max(40, freq * 0.25), t + dur);
            gn.gain.setValueAtTime(vol, t);
            gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(f); f.connect(gn); gn.connect(a.destination);
            src.start(t);
        } catch (_) { /* audio unavailable */ }
    }
    function beep(freq, dur, type, vol, slide) {
        if (!audio.on) return;
        try {
            var a = audioCtx(), o = a.createOscillator(), gn = a.createGain(), t = a.currentTime;
            o.type = type || 'square';
            o.frequency.setValueAtTime(freq, t);
            if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
            gn.gain.setValueAtTime(vol || 0.05, t);
            gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(gn); gn.connect(a.destination);
            o.start(t); o.stop(t + dur + 0.02);
        } catch (_) { /* audio unavailable */ }
    }
    var SFX = {
        move: function () { beep(220, 0.03, 'square', 0.02); },
        rotate: function () { beep(440, 0.04, 'square', 0.025); },
        drop: function () { beep(140, 0.09, 'triangle', 0.08, 60); },
        hold: function () { beep(330, 0.06, 'triangle', 0.04, 500); },
        // Line clear: a sweep across the row, then a rising chime (one note per line, a fanfare for a Tetris)
        clear: function (n) {
            noise(0.28, 0.09, 6000, 900);
            var notes = n >= 4 ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047].slice(0, n + 1);
            notes.forEach(function (f, i) {
                setTimeout(function () { beep(f, 0.14, 'square', 0.05); beep(f * 2, 0.1, 'triangle', 0.02); }, 60 + i * 65);
            });
        },
        // The volcano answering: a low boom and a rumble, bigger for more lines
        erupt: function (n) {
            beep(90, 0.6 + n * 0.15, 'sine', 0.3, 32);
            beep(55, 0.9 + n * 0.15, 'sine', 0.22, 28);
            noise(0.9 + n * 0.3, 0.12 + n * 0.05, 700, 50, 0.04);
            noise(1.2 + n * 0.2, 0.08 + n * 0.03, 2400, 200, 0.12);     // hiss of the magma spray
            if (n >= 4) { noise(1.8, 0.22, 320, 35, 0.25); beep(42, 1.4, 'sine', 0.28, 25); }
        },
        level: function () { [392, 523, 659, 784].forEach(function (f, i) { setTimeout(function () { beep(f, 0.1, 'square', 0.04); }, i * 90); }); },
        over: function () { [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, 'triangle', 0.06); }, i * 160); }); }
    };

    // ======================================================================
    // Page content
    // ======================================================================
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function parseYm(s) {
        var m = /^(\d{4})-(\d{1,2})$/.exec(String(s || '').trim());
        if (!m) return null;
        var y = +m[1], mo = +m[2], now = new Date();
        if (y < 1950 || y > now.getFullYear() + 1 || mo < 1 || mo > 12) return null;
        return { y: y, m: mo };
    }
    function fmtYm(s) {
        if (/present/i.test(String(s))) return 'NOW';
        var p = parseYm(s);
        return p ? p.y + '.' + (p.m < 10 ? '0' : '') + p.m : esc(s);
    }
    function monthsBetween(start, end) {
        var a = parseYm(start), now = new Date();
        var b = /present/i.test(String(end)) ? { y: now.getFullYear(), m: now.getMonth() + 1 } : parseYm(end);
        if (!a || !b) return 0;
        return Math.max(0, (b.y - a.y) * 12 + (b.m - a.m));
    }
    function monthsText(months) {
        if (!months) return '';
        var yrs = Math.floor(months / 12), mo = months % 12;
        return (yrs ? yrs + 'y ' : '') + (mo ? mo + 'm' : '').trim();
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function spanText(start, end) {
        var months = monthsBetween(start, end);
        if (months <= 0) return '';
        var yrs = Math.floor(months / 12), mo = months % 12;
        return (yrs ? yrs + 'y ' : '') + (mo ? mo + 'm' : '').trim();
    }
    function hostOf(url) {
        try { return new URL(url).host.replace(/^www\./, ''); } catch (_) { return url; }
    }
    function pieceFor(i) { return TYPES[i % TYPES.length]; }

    function nameBlock(info) {
        if (typeof window.nameRevealMarkup === 'function') return window.nameRevealMarkup(info, false);
        return esc(info.nickname || info.name);
    }

    function secret(text, href, icon) {
        return '<a class="tx-chip tx-secret" href="' + esc(href) + '">' + icon + ' <span class="tx-secret-text">' + esc(text) + '</span></a>';
    }

    function stageHead(no, title, type, sub) {
        return '<header class="tx-stage-head">' +
            '<span class="tx-stage-no" style="--c:' + COLORS[type] + '">' + minoSvg(type, 9) + ' STAGE ' + (no < 10 ? '0' : '') + no + '</span>' +
            '<h2>' + esc(title) + '</h2>' +
            (sub ? '<p>' + esc(sub) + '</p>' : '') +
            '</header>';
    }

    function renderPage(data) {
        var info = data.personalInfo || {};
        var skills = data.workSkills || {};
        var platforms = data.platforms || {};
        // This template always shows its own pixel-art alien as the avatar
        var photo = typeof window.profileImageSrc === 'function' ? window.profileImageSrc('templates/tetris/alien.svg') : 'templates/tetris/alien.svg';
        var location = (info.location || []).join(', ');
        var spoken = data.spokenLanguages || {};
        var traits = data.profileTraits || [];

        var stats = [
            info.age != null && ['AGE', info.age],
            location && ['BASE', (info.location || [])[1] || location],
            (data.experience || []).length && ['QUESTS', data.experience.length],
            (data.projects || []).length && ['ITEMS', data.projects.length]
        ].filter(Boolean).map(function (s) {
            return '<div class="tx-stat"><span>' + s[0] + '</span><b>' + esc(s[1]) + '</b></div>';
        }).join('');

        var contact = [
            info.email && secret(info.email, 'mailto:' + info.email, '✉'),
            info.phone && secret(info.phone, 'tel:' + String(info.phone).replace(/\s+/g, ''), '☎'),
            location && '<span class="tx-chip">⌖ ' + esc(location) + '</span>'
        ].filter(Boolean).join('');

        var player =
            '<div class="tx-player">' +
                '<div class="tx-p1"><span class="tx-blink">▶</span> PLAYER 1</div>' +
                '<div class="tx-id">' +
                    (photo ? '<div class="tx-avatar"><img src="' + esc(photo) + '" alt="Pixel alien avatar"></div>' : '') +
                    '<div><h1 class="tx-name">' + nameBlock(info) + '</h1>' +
                    '<p class="tx-title">' + esc(info.title) + '</p></div>' +
                '</div>' +
                '<a class="tx-scroll" href="#tx-profile">▼ SCROLL TO SEE STAGES</a>' +
            '</div>';

        var profile =
            '<section class="tx-profile" id="tx-profile">' +
                '<div class="tx-profile-main">' +
                '<div class="tx-summary">' + ((data.summary && data.summary.lines) || []).map(function (l) {
                    return '<p><span class="tx-prompt">&gt;</span> ' + esc(l) + '</p>';
                }).join('') + '</div>' +
                (traits.length ? '<div class="tx-traits">' + traits.map(function (t, i) {
                    return '<span class="tx-trait" style="--c:' + COLORS[pieceFor(i + 2)] + '">' + minoSvg(pieceFor(i + 2), 7) + esc(t) + '</span>';
                }).join('') + '</div>' : '') +
                '</div>' +
                '<div class="tx-profile-side">' +
                '<div class="tx-stats">' + stats + '</div>' +
                '<div class="tx-contact">' + contact + '</div>' +
                '</div>' +
            '</section>';

        var cabinet =
            '<div class="tx-cabinet">' +
                '<div class="tx-marquee"><span>B</span><span>L</span><span>O</span><span>C</span><span>K</span><i></i><span>F</span><span>A</span><span>L</span><span>L</span></div>' +
                '<div class="tx-play">' +
                    '<aside class="tx-side tx-side-l">' +
                        '<div class="tx-box tx-box-hold"><label>HOLD</label><canvas class="tx-hold"></canvas></div>' +
                        '<div class="tx-box tx-score"><label>SCORE</label><b data-k="score">0</b>' +
                            '<label>LEVEL</label><b data-k="level">1</b>' +
                            '<label>LINES</label><b data-k="lines">0</b>' +
                            '<label>BEST</label><b data-k="best">0</b></div>' +
                    '</aside>' +
                    '<div class="tx-well">' +
                        '<canvas class="tx-board" aria-label="Block fall game board"></canvas>' +
                        '<div class="tx-pop" aria-live="polite"></div>' +
                        '<div class="tx-overlay"></div>' +
                    '</div>' +
                    '<aside class="tx-side tx-side-r">' +
                        '<div class="tx-box tx-box-next"><label>NEXT</label><canvas class="tx-next"></canvas></div>' +
                        '<div class="tx-box tx-loot"><label>UNLOCKED</label><b data-k="loot">0</b><div class="tx-lootbar"><i></i></div></div>' +
                        '<div class="tx-tools">' +
                            '<button type="button" class="tx-tool" data-act="sound" aria-label="Toggle sound">♪</button>' +
                            '<button type="button" class="tx-tool" data-act="pause" aria-label="Pause">❚❚</button>' +
                        '</div>' +
                    '</aside>' +
                '</div>' +
                '<div class="tx-pad" aria-label="Touch controls">' +
                    '<button type="button" data-pad="hold">HOLD</button>' +
                    '<button type="button" data-pad="ccw" aria-label="Rotate left">⟲</button>' +
                    '<button type="button" data-pad="cw" aria-label="Rotate right">⟳</button>' +
                    '<button type="button" data-pad="hard" aria-label="Hard drop">⤓</button>' +
                    '<button type="button" data-pad="left" aria-label="Move left">◀</button>' +
                    '<button type="button" data-pad="soft" aria-label="Soft drop">▼</button>' +
                    '<button type="button" data-pad="right" aria-label="Move right">▶</button>' +
                '</div>' +
                '<p class="tx-keys"><kbd>← →</kbd> move <kbd>↓</kbd> soft <kbd>SPACE</kbd> drop <kbd>↑ X</kbd> / <kbd>Z</kbd> rotate <kbd>C</kbd> / <kbd>TAB</kbd> hold <kbd>P</kbd> pause</p>' +
            '</div>';

        // ---- experience: a Tetris well; every job is a band of blocks, oldest at the bottom,
        //      taller the longer it lasted. Picking a band opens its LEVEL panel. ----
        var jobs = data.experience || [];
        var firstStart = null, current = null;
        jobs.forEach(function (e) {
            var d = e.duration || {}, p = parseYm(d.start);
            if (p && (!firstStart || p.y * 12 + p.m < firstStart.y * 12 + firstStart.m)) firstStart = p;
            if (!current && /present/i.test(String(d.end))) current = e;
        });
        var totalXp = firstStart ? monthsBetween(firstStart.y + '-' + firstStart.m, 'Present') : 0;
        var bands = jobs.map(function (e, i) {
            var d = e.duration || {}, months = monthsBetween(d.start, d.end);
            var rows = months ? Math.max(2, Math.min(7, Math.round(months / 6))) : 2;
            var startY = parseYm(d.start);
            var live = /present/i.test(String(d.end));
            return '<button type="button" class="tx-band' + (live ? ' tx-band-now' : '') + '" id="tx-exp-' + i + '" data-job="' + i + '"' +
                ' style="--c:' + COLORS[pieceFor(i)] + ';--rows:' + rows + ';--i:' + (jobs.length - 1 - i) + ';--gap:' + (6 + (i * 5) % 6) + '"' +
                ' aria-label="Level ' + (jobs.length - i) + ': ' + esc(e.company) + '">' +
                (startY ? '<span class="tx-band-year">' + startY.y + '</span>' : '') +
                '<span class="tx-band-label"><small>LV ' + pad2(jobs.length - i) + '</small><b>' + esc(e.company) + '</b></span>' +
                '<span class="tx-band-dur">' + (monthsText(months) || '???') + '</span>' +
            '</button>';
        }).join('');
        var exp = jobs.length ? '<div class="tx-career">' +
            '<div class="tx-career-hud">' +
                (totalXp ? '<span>TOTAL XP <b>' + monthsText(totalXp) + '</b></span>' : '') +
                '<span>LEVELS <b>' + jobs.length + '</b></span>' +
                (current ? '<span class="tx-career-cur">NOW PLAYING <b>' + esc(current.role) + '</b></span>' : '') +
            '</div>' +
            '<div class="tx-career-main">' +
                '<div class="tx-stackwrap">' +
                    '<div class="tx-stack-next">' + minoSvg('T', 12) + '<span>NEXT LEVEL ???</span></div>' +
                    '<div class="tx-stack">' + bands + '</div>' +
                    '<div class="tx-stack-floor">' + (firstStart ? 'START ' + firstStart.y : 'START') + '</div>' +
                '</div>' +
                '<aside class="tx-lvl" aria-live="polite"></aside>' +
            '</div>' +
        '</div>' : '';

        // ---- projects ----
        var proj = (data.projects || []).map(function (p, i) {
            var t = pieceFor(i + 3);
            return '<article class="tx-card tx-proj tx-drop" id="tx-proj-' + i + '" style="--c:' + COLORS[t] + '">' +
                '<div class="tx-proj-top"><span class="tx-proj-icon">' + esc(p.icon || '◆') + '</span>' + minoSvg(t, 7) + '</div>' +
                '<h3>' + esc(p.name) + '</h3>' +
                '<p>' + esc(p.description) + '</p>' +
                '<div class="tx-tags">' + (p.technologies || []).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
                (p.url ? '<a class="tx-visit" href="' + esc(p.url) + '" target="_blank" rel="noopener">▶ ' + esc(hostOf(p.url)) + '</a>' : '') +
                '<span class="tx-got-badge">★ UNLOCKED</span>' +
            '</article>';
        }).join('');

        // ---- skills: every skill is a block in its group's well ----
        var groups = Object.keys(skills).map(function (k) { return { title: k, items: skills[k] }; });
        groups.push({ title: 'languages', items: (data.programmingLanguages || []).join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean) });
        groups.push({ title: 'tools', items: (data.tools || []).join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean) });
        groups.push({ title: 'platforms', items: (platforms.primary || []).concat(platforms.secondary || []) });
        var skillId = 0;
        var matrix = groups.filter(function (g) { return g.items && g.items.length; }).map(function (g, gi) {
            var t = pieceFor(gi);
            var seen = {};
            var tiles = g.items.filter(function (s) {
                var k = String(s).toLowerCase();
                if (seen[k]) return false;
                seen[k] = true;
                return true;
            }).map(function (s) {
                return '<span class="tx-tile" id="tx-skill-' + (skillId++) + '" data-skill="' + esc(String(s).toLowerCase()) + '">' + esc(s) + '</span>';
            }).join('');
            return '<div class="tx-card tx-group tx-drop" style="--c:' + COLORS[t] + '">' +
                '<h3>' + minoSvg(t, 7) + ' ' + esc(g.title) + ' <small>×' + g.items.length + '</small></h3>' +
                '<div class="tx-tiles">' + tiles + '</div></div>';
        }).join('');

        // ---- education + certifications: save files ----
        var saves = (data.education || []).map(function (e, i) {
            return '<article class="tx-card tx-save tx-drop" id="tx-edu-' + i + '" style="--c:' + COLORS[pieceFor(i + 5)] + '">' +
                '<div class="tx-save-slot">SLOT ' + (i + 1) + '</div>' +
                '<h3>' + esc(e.level) + ' · ' + esc(e.field) + '</h3>' +
                '<p>' + esc(e.institution) + '</p>' +
                '<div class="tx-save-meta"><span>' + esc(e.date) + '</span>' + (e.GPA ? '<span>GPA ' + esc(e.GPA) + '</span>' : '') + '</div>' +
                '<span class="tx-got-badge">★ UNLOCKED</span>' +
            '</article>';
        }).concat((data.certifications || []).map(function (c, i) {
            return '<article class="tx-card tx-save tx-cert tx-drop" id="tx-cert-' + i + '" style="--c:' + COLORS[pieceFor(i + 1)] + '">' +
                '<div class="tx-save-slot">🏆 BADGE</div>' +
                '<h3>' + esc(c.name) + '</h3>' +
                '<p>' + esc(c.issuer) + '</p>' +
                '<div class="tx-save-meta"><span>' + esc(c.date) + '</span></div>' +
                '<span class="tx-got-badge">★ UNLOCKED</span>' +
            '</article>';
        })).join('');

        var langs = Object.keys(spoken).map(function (k) {
            return '<span class="tx-chip">' + esc(k) + ' · <b>' + esc(spoken[k]) + '</b></span>';
        }).join('') + (info.vehicleLicense ? '<span class="tx-chip">🚗 Driver license</span>' : '');

        var shownName = info.nickname || String(info.name || '').split(/\s+/)[0];

        return '<div class="tx-root">' +
            '<canvas class="tx-volcano" aria-hidden="true"></canvas>' +
            '<canvas class="tx-rain" aria-hidden="true"></canvas>' +
            '<div class="tx-crt" aria-hidden="true"></div>' +
            '<main class="tx-page">' +
                '<section class="tx-hero">' + player + cabinet + '</section>' +
                profile +
                '<section class="tx-stage" id="tx-exp">' + stageHead(1, 'Experience', 'I', 'Every job a level. Pick one to replay it') +
                    exp + '</section>' +
                '<section class="tx-stage" id="tx-proj">' + stageHead(2, 'Projects', 'T', 'Shipped and in production') +
                    '<div class="tx-grid">' + proj + '</div></section>' +
                '<section class="tx-stage" id="tx-skills">' + stageHead(3, 'Skill matrix', 'S', 'One block per skill') +
                    '<div class="tx-grid tx-grid-skills">' + matrix + '</div></section>' +
                '<section class="tx-stage" id="tx-edu">' + stageHead(4, 'Save files', 'L', 'Education & certifications') +
                    '<div class="tx-grid">' + saves + '</div></section>' +
                '<section class="tx-stage tx-continue" id="tx-contact">' +
                    '<div class="tx-continue-box">' +
                        '<p class="tx-continue-q">CONTINUE?</p>' +
                        '<div class="tx-count" aria-hidden="true">9</div>' +
                        '<p class="tx-continue-sub">Insert coin — get in touch</p>' +
                        '<div class="tx-contact tx-contact-big">' + contact + '</div>' +
                        (langs ? '<div class="tx-langs">' + langs + '</div>' : '') +
                    '</div>' +
                '</section>' +
                '<footer class="tx-foot">© ' + new Date().getFullYear() + ' ' + esc(shownName) + ' · <span data-k="footBest">HI-SCORE 0</span></footer>' +
            '</main>' +
        '</div>';
    }

    // Everything a line clear can unlock, each pointing at the card it reveals
    function buildLoot(data) {
        var loot = [];
        (data.experience || []).forEach(function (e, i) {
            loot.push({ kind: 'QUEST', title: e.company, sub: e.role, anchor: 'tx-exp-' + i });
        });
        (data.projects || []).forEach(function (p, i) {
            loot.push({ kind: 'ITEM', title: (p.icon ? p.icon + ' ' : '') + p.name, sub: (p.technologies || []).slice(0, 3).join(' · '), anchor: 'tx-proj-' + i });
        });
        (data.education || []).forEach(function (e, i) {
            loot.push({ kind: 'SAVE', title: e.field, sub: e.date, anchor: 'tx-edu-' + i });
        });
        (data.certifications || []).forEach(function (c, i) {
            loot.push({ kind: 'BADGE', title: c.name, sub: c.issuer + ' · ' + c.date, anchor: 'tx-cert-' + i });
        });
        return loot;
    }

    // ======================================================================
    // Render + wire everything together
    // ======================================================================
    function render(data, root) {
        root.innerHTML = renderPage(data);
        var el = root.querySelector('.tx-root');
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var touchUI = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;
        if (touchUI) el.classList.add('tx-touch');

        if (typeof window.initNameReveal === 'function') window.initNameReveal(el);

        // Skill tiles become loot too, once the DOM gives them ids
        var loot = buildLoot(data);
        el.querySelectorAll('.tx-tile').forEach(function (t) {
            loot.push({ kind: 'SKILL', title: t.textContent, sub: t.closest('.tx-group').querySelector('h3').childNodes[1].textContent.trim(), anchor: t.id });
        });
        var lootOrder = loot.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
        var lootGot = 0;

        initSecrets(el);
        initDropIns(el, reduceMotion);
        initCareer(el, data.experience || [], reduceMotion);
        initCountdown(el, reduceMotion);
        var volcano = null;
        var rain = initRain(el.querySelector('.tx-rain'), reduceMotion);

        // ---------- the cabinet ----------
        var boardCv = el.querySelector('.tx-board');
        var holdCv = el.querySelector('.tx-hold');
        var nextCv = el.querySelector('.tx-next');
        var well = el.querySelector('.tx-well');
        var overlay = el.querySelector('.tx-overlay');
        var popEl = el.querySelector('.tx-pop');
        var hud = {};
        el.querySelectorAll('[data-k]').forEach(function (n) { hud[n.dataset.k] = n; });

        var best = parseInt(store(BEST_KEY), 10) || 0;
        var mode = 'demo';          // demo | playing | paused | over
        var cell = 28, ctx, hctx, nctx, sideCell;
        var flashes = [];           // landing sparks
        var shake = 0;

        var game = createGame({
            spawn: function () { aiPlan = null; },
            move: function () { if (mode === 'playing') SFX.move(); },
            rotate: function () { if (mode === 'playing') SFX.rotate(); },
            hold: function () { if (mode === 'playing') SFX.hold(); },
            hardDrop: function (e) {
                if (mode !== 'playing') return;
                SFX.drop();
                if (e.dist > 3) shake = Math.min(6, e.dist * 0.5);
            },
            lock: function (e) {
                var p = e.game.piece;
                PIECES[p.type][p.rot].forEach(function (c) { flashes.push({ x: p.x + c[0], y: p.y + c[1], t: 0, color: COLORS[p.type] }); });
            },
            clear: function (e) {
                if (volcano) volcano.erupt(e.count, mode === 'playing');
                if (mode !== 'playing') return;
                SFX.clear(e.count);
                SFX.erupt(e.count);
                var label = e.spin ? (e.spin === 'mini' ? 'T-SPIN MINI' : 'T-SPIN') + (e.count ? ' ' + ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][e.count] : '') :
                    ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'][e.count];
                popText(label, e.gained, e.combo > 0 ? e.combo + ' COMBO' : '', e.game.clearing && e.game.clearing.b2b);
                if (e.count >= 4) shake = 8;
                for (var i = 0; i < e.count; i++) unlockNext(i * 380);
            },
            levelUp: function () { if (mode === 'playing') { SFX.level(); popText('LEVEL ' + game.level, 0, ''); } },
            gameOver: function () {
                if (mode === 'demo') {
                    setTimeout(function () { if (mode === 'demo') game.reset(1); }, 900);
                    return;
                }
                mode = 'over';
                SFX.over();
                if (game.score > best) { best = game.score; store(BEST_KEY, String(best)); }
                updateHud(true);
                showOverlay();
                syncTouchLock();
            }
        });
        game.reset(1);

        function popText(big, pts, small, b2b) {
            var d = document.createElement('div');
            d.className = 'tx-popline';
            d.innerHTML = (b2b ? '<small>BACK-TO-BACK</small>' : '') + '<b>' + esc(big) + '</b>' + (pts ? '<span>+' + pts + '</span>' : '') + (small ? '<small>' + esc(small) + '</small>' : '');
            popEl.appendChild(d);
            setTimeout(function () { d.remove(); }, 1300);
        }

        // ---------- loot toasts ----------
        var toastWrap = document.createElement('div');
        toastWrap.className = 'tx-toasts';
        el.appendChild(toastWrap);
        function unlockNext(delay) {
            if (!loot.length) return;
            var idx = lootOrder[lootGot % loot.length];
            var item = loot[idx];
            var firstTime = lootGot < loot.length;
            lootGot++;
            setTimeout(function () {
                var target = document.getElementById(item.anchor);
                if (target && firstTime) target.classList.add('tx-got');
                var t = document.createElement('button');
                t.type = 'button';
                t.className = 'tx-toast';
                t.innerHTML = '<span class="tx-toast-kind">' + item.kind + ' UNLOCKED</span><b>' + esc(item.title) + '</b>' +
                    (item.sub ? '<small>' + esc(item.sub) + '</small>' : '') + '<em>VIEW ▸</em>';
                t.addEventListener('click', function () {
                    if (mode === 'playing') pause();
                    if (target) {
                        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
                        target.classList.remove('tx-flash');
                        void target.offsetWidth;
                        target.classList.add('tx-flash');
                        if (target.classList.contains('tx-band')) target.click();
                    }
                    t.remove();
                });
                toastWrap.appendChild(t);
                while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
                setTimeout(function () { t.classList.add('tx-out'); setTimeout(function () { t.remove(); }, 400); }, 4200);
                updateHud();
            }, delay);
        }

        // ---------- sizing ----------
        function layout() {
            var play = el.querySelector('.tx-play');
            var side = el.querySelector('.tx-side');
            var narrow = window.innerWidth < 640;
            var sideW = side ? side.offsetWidth : 116;
            var gap = narrow ? 6 : 12, frame = narrow ? 8 : 14;
            var availW = play.clientWidth - 2 * sideW - 2 * gap - frame;
            var availH = narrow ? window.innerHeight * 0.6 : window.innerHeight - 200;
            cell = Math.max(12, Math.floor(Math.min(availW / COLS, availH / ROWS, 34)));
            ctx = fitCanvas(boardCv, cell * COLS, cell * ROWS);
            sideCell = Math.max(7, Math.min(16, Math.floor((sideW - 12) / 4.6)));
            var count = narrow ? 2 : 3;
            hctx = fitCanvas(holdCv, sideCell * 4.6, sideCell * 3);
            nctx = fitCanvas(nextCv, sideCell * 4.6, sideCell * 3 * count);
            nextCv.dataset.count = count;
        }
        layout();
        volcano = initVolcano(el.querySelector('.tx-volcano'), reduceMotion, function () {
            if (window.innerWidth <= 1024) return null;
            var cab = el.querySelector('.tx-cabinet').getBoundingClientRect();
            var head = el.querySelector('.tx-player').getBoundingClientRect();
            var top = Math.min(head.bottom + window.scrollY + 16, window.innerHeight * 0.45);
            return { x: 8, y: top, w: Math.max(320, cab.left - 28), h: window.innerHeight - top };
        });
        var resizeT;
        window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(layout, 120); });

        // ---------- drawing ----------
        function drawBoard(now) {
            var w = cell * COLS, h = cell * ROWS;
            ctx.clearRect(0, 0, w, h);
            ctx.save();
            if (shake > 0.2) {
                ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
                shake *= 0.85;
            } else shake = 0;

            // grid
            ctx.strokeStyle = 'rgba(120,140,255,0.07)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (var x = 1; x < COLS; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, h); }
            for (var y = 1; y < ROWS; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(w, y * cell + 0.5); }
            ctx.stroke();

            var clearing = game.clearing;
            for (var gy = HIDDEN; gy < H; gy++) {
                var row = game.grid[gy];
                var isClearing = clearing && clearing.rows.indexOf(gy) >= 0;
                for (var gx = 0; gx < COLS; gx++) {
                    if (!row[gx]) continue;
                    var px = gx * cell, py = (gy - HIDDEN) * cell;
                    if (isClearing) {
                        var k = clearing.t / CLEAR_MS;
                        // Row bursts outward from the centre column
                        var dist = Math.abs(gx - 4.5) / 5;
                        if (k > dist * 0.6) {
                            ctx.globalAlpha = Math.max(0, 1 - (k - dist * 0.6) * 2.2);
                            ctx.fillStyle = '#fff';
                            ctx.fillRect(px, py, cell, cell);
                            ctx.globalAlpha = 1;
                        } else drawBlock(ctx, px, py, cell, COLORS[row[gx]]);
                    } else {
                        drawBlock(ctx, px, py, cell, mode === 'over' ? '#555a78' : COLORS[row[gx]]);
                    }
                }
            }

            var p = game.piece;
            if (p && !clearing && !game.over) {
                var gyy = game.ghostY();
                PIECES[p.type][p.rot].forEach(function (c) {
                    var yy = gyy + c[1] - HIDDEN;
                    if (yy >= 0) drawGhost(ctx, (p.x + c[0]) * cell, yy * cell, cell, COLORS[p.type]);
                });
                PIECES[p.type][p.rot].forEach(function (c) {
                    var yy = p.y + c[1] - HIDDEN;
                    if (yy >= 0) drawBlock(ctx, (p.x + c[0]) * cell, yy * cell, cell, COLORS[p.type]);
                });
            }

            // landing sparks
            flashes = flashes.filter(function (f) {
                f.t += 16;
                if (f.t > 220) return false;
                var yy = f.y - HIDDEN;
                if (yy < 0) return true;
                ctx.globalAlpha = 0.55 * (1 - f.t / 220);
                ctx.fillStyle = '#fff';
                ctx.fillRect(f.x * cell, yy * cell, cell, cell);
                ctx.globalAlpha = 1;
                return true;
            });
            ctx.restore();
        }

        function drawSide() {
            var hw = sideCell * 4.6, hh = sideCell * 3;
            hctx.clearRect(0, 0, hw, hh);
            hctx.globalAlpha = game.canHold ? 1 : 0.35;
            drawMini(hctx, game.hold, hw / 2, hh / 2, sideCell);
            hctx.globalAlpha = 1;
            var count = +nextCv.dataset.count;
            nctx.clearRect(0, 0, hw, sideCell * 3 * count);
            for (var i = 0; i < count; i++) {
                var s = i === 0 ? sideCell : Math.round(sideCell * 0.8);
                drawMini(nctx, game.queue[i], hw / 2, hh / 2 + i * sideCell * 3, s);
            }
        }

        var lastHud = {};
        var lootBar = el.querySelector('.tx-lootbar i');
        function setHud(k, v) {
            if (hud[k] && lastHud[k] !== v) { hud[k].textContent = v; lastHud[k] = v; }
        }
        function updateHud(force) {
            if (force) lastHud = {};
            var shown = mode === 'demo';
            setHud('score', shown ? 'DEMO' : String(game.score));
            setHud('level', String(game.level));
            setHud('lines', String(game.lines));
            setHud('best', String(Math.max(best, mode === 'demo' ? 0 : game.score)));
            setHud('footBest', 'HI-SCORE ' + Math.max(best, mode === 'demo' ? 0 : game.score));
            var got = Math.min(lootGot, loot.length);
            setHud('loot', got + '/' + loot.length);
            if (lootBar) lootBar.style.width = (loot.length ? got / loot.length * 100 : 0) + '%';
        }

        // ---------- overlay screens ----------
        function showOverlay() {
            var html = '';
            if (mode === 'demo') {
                html = '<div class="tx-ov-card">' +
                    '<p class="tx-ov-kicker">DEMO PLAY</p>' +
                    '<p class="tx-ov-big">CLEAR LINES<br>TO UNLOCK<br>MY PROFILE</p>' +
                    '<button type="button" class="tx-start" data-act="start">▶ PRESS START</button>' +
                    '<p class="tx-ov-hint">' + (touchUI ? 'Tap = rotate · drag = move<br>flick ↓ = drop · flick ↑ = hold' : 'or press <kbd>ENTER</kbd>') + '</p>' +
                '</div>';
            } else if (mode === 'paused') {
                html = '<div class="tx-ov-card"><p class="tx-ov-big">PAUSED</p>' +
                    '<button type="button" class="tx-start" data-act="resume">▶ RESUME</button>' +
                    '<button type="button" class="tx-ghostbtn" data-act="quit">QUIT TO DEMO</button></div>';
            } else if (mode === 'over') {
                var newBest = game.score >= best && game.score > 0;
                html = '<div class="tx-ov-card"><p class="tx-ov-big tx-ov-over">GAME OVER</p>' +
                    '<p class="tx-ov-score">' + game.score + '</p>' +
                    (newBest ? '<p class="tx-ov-kicker tx-ov-hi">★ NEW HI-SCORE ★</p>' : '<p class="tx-ov-kicker">BEST ' + best + '</p>') +
                    '<p class="tx-ov-hint">' + game.lines + ' lines · level ' + game.level + ' · ' + Math.min(lootGot, loot.length) + '/' + loot.length + ' unlocked</p>' +
                    '<button type="button" class="tx-start" data-act="start">▶ PLAY AGAIN</button>' +
                    '<button type="button" class="tx-ghostbtn" data-act="quit">BACK TO DEMO</button></div>';
            }
            overlay.innerHTML = html;
            overlay.classList.toggle('tx-on', !!html);
            var pauseBtn = el.querySelector('[data-act="pause"]');
            if (pauseBtn) pauseBtn.textContent = mode === 'paused' ? '▶' : '❚❚';
        }

        function syncTouchLock() {
            el.classList.toggle('tx-playing', mode === 'playing');
            document.documentElement.classList.toggle('tx-is-playing', mode === 'playing');
        }

        function start() {
            mode = 'playing';
            heldKeys = {};
            game.reset(1);
            updateHud(true);
            showOverlay();
            syncTouchLock();
            beep(660, 0.08, 'square', 0.04);
            var r = well.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) well.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
        function pause() {
            if (mode !== 'playing') return;
            mode = 'paused';
            game.softDrop = false;
            das.dir = 0;
            showOverlay();
            syncTouchLock();
        }
        function resume() {
            if (mode !== 'paused') return;
            mode = 'playing';
            showOverlay();
            syncTouchLock();
        }
        function quitToDemo() {
            if (mode === 'playing' || mode === 'over' || mode === 'paused') {
                if (game.score > best) { best = game.score; store(BEST_KEY, String(best)); }
            }
            mode = 'demo';
            game.reset(1);
            updateHud(true);
            showOverlay();
            syncTouchLock();
        }

        el.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            var act = b.dataset.act;
            if (act === 'start') start();
            else if (act === 'resume') resume();
            else if (act === 'quit') quitToDemo();
            else if (act === 'pause') { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
            else if (act === 'sound') {
                audio.on = !audio.on;
                store(SOUND_KEY, audio.on ? '1' : '0');
                b.classList.toggle('tx-off', !audio.on);
                if (audio.on) beep(880, 0.08);
            }
        });
        var soundBtn = el.querySelector('[data-act="sound"]');
        if (soundBtn) soundBtn.classList.toggle('tx-off', !audio.on);

        // ---------- input: actions with DAS / ARR auto-repeat ----------
        var DAS = 150, ARR = 45;
        var das = { dir: 0, t: 0, arr: 0 };
        var heldKeys = {};

        function press(action) {
            if (mode !== 'playing') return;
            switch (action) {
                case 'left': game.move(-1); das.dir = -1; das.t = 0; das.arr = 0; break;
                case 'right': game.move(1); das.dir = 1; das.t = 0; das.arr = 0; break;
                case 'soft': game.softDrop = true; game.softStep(); break;
                case 'hard': game.hardDrop(); break;
                case 'cw': game.rotate(1); break;
                case 'ccw': game.rotate(-1); break;
                case 'hold': game.holdPiece(); break;
            }
        }
        function release(action) {
            if (action === 'left' && das.dir === -1) das.dir = heldKeys.right ? 1 : 0;
            if (action === 'right' && das.dir === 1) das.dir = heldKeys.left ? -1 : 0;
            if (action === 'soft') game.softDrop = false;
        }

        var KEYMAP = {
            ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'soft', ArrowUp: 'cw',
            ' ': 'hard', x: 'cw', X: 'cw', z: 'ccw', Z: 'ccw', Control: 'ccw',
            c: 'hold', C: 'hold', Shift: 'hold', Tab: 'hold', a: 'left', d: 'right', s: 'soft', w: 'cw'
        };
        document.addEventListener('keydown', function (e) {
            if (e.target.closest && e.target.closest('input, textarea, select')) return;
            if (e.key === 'Enter' && (mode === 'demo' || mode === 'over') && wellVisible) { e.preventDefault(); start(); return; }
            if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (mode === 'playing' || mode === 'paused')) {
                e.preventDefault();
                if (mode === 'playing') pause(); else resume();
                return;
            }
            if (mode !== 'playing') return;
            var action = KEYMAP[e.key];
            if (!action) return;
            e.preventDefault();                       // keep arrows / space from scrolling the page mid-game
            if (e.repeat) return;                     // our own DAS handles repeats
            heldKeys[action] = true;
            press(action);
        });
        document.addEventListener('keyup', function (e) {
            var action = KEYMAP[e.key];
            if (!action) return;
            heldKeys[action] = false;
            release(action);
        });
        window.addEventListener('blur', function () { heldKeys = {}; das.dir = 0; game.softDrop = false; pause(); });
        document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

        // Touch pad buttons (press-and-hold repeats via the same DAS)
        el.querySelectorAll('[data-pad]').forEach(function (b) {
            var action = b.dataset.pad;
            b.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                if (mode === 'demo' || mode === 'over') { start(); return; }
                b.classList.add('tx-down');
                heldKeys[action] = true;
                press(action);
                try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            });
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
                b.addEventListener(ev, function () {
                    if (!heldKeys[action]) return;
                    b.classList.remove('tx-down');
                    heldKeys[action] = false;
                    release(action);
                });
            });
            b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        });

        // Gestures on the well: tap rotates, drag moves, flick down drops, flick up holds
        var gest = null;
        boardCv.addEventListener('pointerdown', function (e) {
            if (mode !== 'playing') return;
            gest = { x: e.clientX, y: e.clientY, t: performance.now(), mx: 0, my: 0, moved: false, id: e.pointerId };
            try { boardCv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        });
        boardCv.addEventListener('pointermove', function (e) {
            if (!gest || e.pointerId !== gest.id || mode !== 'playing') return;
            var step = cell * 0.9;
            var dx = e.clientX - gest.x - gest.mx * step;
            while (Math.abs(dx) >= step) {
                var dir = dx > 0 ? 1 : -1;
                game.move(dir);
                gest.mx += dir;
                gest.moved = true;
                dx -= dir * step;
            }
            var dy = e.clientY - gest.y - gest.my * cell;
            while (dy >= cell) {
                game.softStep();
                gest.my++;
                gest.moved = true;
                dy -= cell;
            }
        });
        boardCv.addEventListener('pointerup', function (e) {
            if (!gest || e.pointerId !== gest.id) return;
            var dt = performance.now() - gest.t, dy = e.clientY - gest.y, dx = e.clientX - gest.x;
            var vy = dy / Math.max(dt, 1);
            if (mode === 'playing') {
                if (vy > 0.8 && dy > cell * 2) game.hardDrop();
                else if (vy < -0.6 && dy < -cell * 1.5) game.holdPiece();
                else if (!gest.moved && Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
                    var r = boardCv.getBoundingClientRect();
                    game.rotate(e.clientX < r.left + r.width * 0.33 ? -1 : 1);
                }
            }
            gest = null;
        });
        boardCv.addEventListener('pointercancel', function () { gest = null; });

        // Pause when the cabinet scrolls out of view
        var wellVisible = true;
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                wellVisible = entries[0].isIntersecting;
                if (!wellVisible) pause();
            }, { threshold: 0.25 }).observe(well);
        }

        // ---------- demo AI driver ----------
        var aiPlan = null, aiT = 0, aiSteps = 0;
        function runAI(dt) {
            if (!game.active()) return;
            aiT += dt;
            if (aiT < 85) return;
            aiT = 0;
            if (!aiPlan) { aiPlan = bestPlacement(game); aiSteps = 0; if (!aiPlan) { game.hardDrop(); return; } }
            var p = game.piece;
            aiSteps++;
            if (aiSteps > 14) { game.hardDrop(); return; }
            if (p.rot !== aiPlan.rot) { if (!game.rotate(1)) game.hardDrop(); return; }
            if (p.x < aiPlan.x) { if (!game.move(1)) game.hardDrop(); return; }
            if (p.x > aiPlan.x) { if (!game.move(-1)) game.hardDrop(); return; }
            game.hardDrop();
        }

        // ---------- main loop ----------
        var last = performance.now();
        function frame(now) {
            var dt = Math.min(50, now - last);
            last = now;
            if (mode === 'playing') {
                if (das.dir) {
                    das.t += dt;
                    if (das.t >= DAS) {
                        das.arr += dt;
                        while (das.arr >= ARR) { das.arr -= ARR; if (!game.move(das.dir)) break; }
                    }
                }
                game.update(dt);
            } else if (mode === 'demo') {
                runAI(dt);
                game.update(dt);
            }
            if (wellVisible) {
                drawBoard(now);
                drawSide();
            }
            updateHud();
            if (volcano) volcano.tick(dt);
            if (rain) rain(dt);
            requestAnimationFrame(frame);
        }
        showOverlay();
        updateHud(true);
        requestAnimationFrame(frame);
    }

    // ======================================================================
    // Decorations
    // ======================================================================

    // ======================================================================
    // Background: a Minecraft-style voxel volcano on a floating island, drawn in
    // true isometric. Magma runs from the crater as a river and pours off the
    // island edge; clouds drift over it; every line clear makes it erupt.
    // ======================================================================
    var VW = 48, VD = 48, VDEPTH = 4, VPEAK = 17, VCX = 22, VCZ = 20, VR = 12.5;
    // Snowy stone mountains around the volcano (kept behind it so they never hide the crater)
    var MOUNTAINS = [{ x: 8, z: 9, r: 8, h: 12 }, { x: 37, z: 6, r: 6, h: 9 }, { x: 7, z: 26, r: 6, h: 8 }];
    // Tetris pieces lying around the island as if they'd landed there
    var LANDED = [
        { t: 'L', x: 20, z: 40, stand: true }, { t: 'S', x: 38, z: 40 }, { t: 'T', x: 40, z: 28, stand: true },
        { t: 'O', x: 10, z: 46, stand: true }, { t: 'I', x: 23, z: 45 }, { t: 'J', x: 42, z: 44, stand: true },
        { t: 'Z', x: 15, z: 29, stand: true }, { t: 'T', x: 3, z: 40 }
    ];

    function mulberry(seed) {
        return function () {
            seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }

    // 16x16 pixel textures, Minecraft style
    function makeTex(rnd, fn) {
        var c = document.createElement('canvas');
        c.width = c.height = 16;
        var g = c.getContext('2d');
        for (var y = 0; y < 16; y++) {
            for (var x = 0; x < 16; x++) { g.fillStyle = fn(x, y, rnd()); g.fillRect(x, y, 1, 1); }
        }
        return c;
    }

    function buildTextures() {
        var rnd = mulberry(7), T = {}, i;
        var GRASS = ['#5b8f2e', '#6aa336', '#4e7d27', '#79b33f', '#62992f'];
        var DIRT = ['#7a5232', '#8b5e3c', '#6b4528', '#94694a', '#5f3d22'];
        var STONE = ['#7d7d7d', '#8a8a8a', '#6f6f6f', '#949494', '#767676'];
        var BLACK = ['#2a2530', '#35303c', '#221e28', '#3d3744'];
        T.grass_top = makeTex(rnd, function (x, y, r) { return pick(GRASS, r); });
        T.dirt = makeTex(rnd, function (x, y, r) { return pick(DIRT, r); });
        var edge = [];
        for (i = 0; i < 16; i++) edge.push(2 + Math.floor(rnd() * 3));
        T.grass_side = makeTex(rnd, function (x, y, r) { return y < edge[x] ? pick(GRASS, r) : pick(DIRT, r); });
        T.stone = makeTex(rnd, function (x, y, r) { return pick(STONE, r); });
        T.gravel = makeTex(rnd, function (x, y, r) { return pick(['#6e6a68', '#857f7c', '#5c5856', '#9a9390'], r); });
        T.coal = makeTex(rnd, function (x, y, r) { return ((x * 7 + y * 13) % 11) < 2 && r < 0.85 ? '#1a1a1a' : pick(STONE, r); });
        T.blackstone = makeTex(rnd, function (x, y, r) { return pick(BLACK, r); });
        T.obsidian = makeTex(rnd, function (x, y, r) { return r < 0.08 ? '#4a3478' : pick(['#140f22', '#1d1530', '#0e0a18', '#22193a'], rnd()); });
        T.magma = makeTex(rnd, function (x, y, r) {
            var crack = Math.sin(x * 1.3 + y * 0.7) + Math.sin(y * 1.9 - x * 0.4) > 1.1;
            return crack ? (r < 0.5 ? '#ff7a1a' : '#ffae2a') : pick(['#5a1a0c', '#6e2410', '#4a140a'], r);
        });
        T.log = makeTex(rnd, function (x, y, r) { return x % 4 === 0 ? '#4a361c' : pick(['#6b4f2a', '#5a4122', '#7a5b33'], r); });
        T.log_top = makeTex(rnd, function (x, y) {
            var d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
            return d > 6.5 ? '#5a4122' : (Math.floor(d) % 2 ? '#a88552' : '#b8955f');
        });
        T.leaves = makeTex(rnd, function (x, y, r) { return r < 0.12 ? '#173d10' : pick(['#2f6b1f', '#3c7f27', '#24561a', '#468c2c'], rnd()); });
        T.spruce_log = makeTex(rnd, function (x, y, r) { return x % 3 === 0 ? '#2e1f10' : pick(['#3f2b16', '#4a331b', '#36250f'], r); });
        T.spruce_leaves = makeTex(rnd, function (x, y, r) { return r < 0.12 ? '#0f2a1a' : pick(['#1f4a2e', '#28573a', '#183d26', '#2f6142'], rnd()); });
        T.snow = makeTex(rnd, function (x, y, r) { return pick(['#f4f6fb', '#e8ecf5', '#ffffff', '#dde3ef'], r); });
        var snowEdge = [];
        for (i = 0; i < 16; i++) snowEdge.push(2 + Math.floor(rnd() * 3));
        T.snow_side = makeTex(rnd, function (x, y, r) { return y < snowEdge[x] ? pick(['#f4f6fb', '#e8ecf5', '#ffffff'], r) : pick(STONE, r); });
        T.sand = makeTex(rnd, function (x, y, r) { return pick(['#dbcf8e', '#d2c47f', '#e4d89c', '#c9ba74'], r); });
        T.path = makeTex(rnd, function (x, y, r) { return pick(['#9b7d4a', '#a88a55', '#8c6f3f', '#b0925c'], r); });
        T.planks = makeTex(rnd, function (x, y, r) { return y % 4 === 3 ? '#5e4422' : ((x + (y >> 2) * 5) % 8 === 0 ? '#6e5029' : pick(['#a07a45', '#9a7442', '#a9824c'], r)); });
        // Tetris-coloured blocks with the same bevel as the game pieces
        TYPES.forEach(function (tp) {
            var base = COLORS[tp], lite = shade(base, 0.45), dark = shade(base, -0.42), glint = shade(base, 0.7);
            T['tet_' + tp] = makeTex(rnd, function (x, y) {
                if (x < 2 || y < 2) return x > 13 || y > 13 ? base : lite;
                if (x > 13 || y > 13) return dark;
                if (y >= 3 && y <= 4 && x >= 3 && x <= 6) return glint;
                return base;
            });
        });

        // Lava: tileable value noise; each frame scrolls it by one texel
        var grid = [], fine = [];
        for (i = 0; i < 16; i++) grid.push(rnd());
        for (i = 0; i < 256; i++) fine.push(rnd());
        function g4(a, b) { return grid[(((b % 4) + 4) % 4) * 4 + (((a % 4) + 4) % 4)]; }
        function val(x, y) {
            var gx = x / 4, gy = y / 4, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
            var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
            return (g4(x0, y0) * (1 - sx) + g4(x0 + 1, y0) * sx) * (1 - sy) + (g4(x0, y0 + 1) * (1 - sx) + g4(x0 + 1, y0 + 1) * sx) * sy;
        }
        var LAVA = ['#a8280f', '#d4461a', '#f06a1d', '#ff9a2a', '#ffc23d', '#fff09a'];
        function lavaColor(v) { return LAVA[Math.max(0, Math.min(5, Math.floor(v * 6)))]; }
        var WATER = ['#16306e', '#1d3f8f', '#2452b5', '#2d66d1', '#4a86e0', '#8fbcf5'];
        function waterColor(v) { return WATER[Math.max(0, Math.min(5, Math.floor(v * 6)))]; }
        T.lavaU = []; T.lavaV = []; T.waterU = []; T.waterV = [];
        for (var f = 0; f < 16; f++) {
            (function (f) {
                T.lavaU.push(makeTex(rnd, function (x, y) { var xx = (x - f + 16) % 16; return lavaColor(val(xx, y) * 0.8 + fine[y * 16 + xx] * 0.25); }));
                T.lavaV.push(makeTex(rnd, function (x, y) { var yy = (y - f + 16) % 16; return lavaColor(val(x, yy) * 0.8 + fine[yy * 16 + x] * 0.25); }));
                T.waterU.push(makeTex(rnd, function (x, y) { var xx = (x - f + 16) % 16; return waterColor(val(y, xx) * 0.75 + fine[xx * 16 + y] * 0.3); }));
                T.waterV.push(makeTex(rnd, function (x, y) { var yy = (y - f + 16) % 16; return waterColor(val(yy, x) * 0.75 + fine[x * 16 + yy] * 0.3); }));
            })(f);
        }
        return T;
    }

    function vkey(x, y, z) { return x + ',' + y + ',' + z; }

    function buildWorld() {
        var rnd = mulberry(1234), hm = [], lv = [], wt = [], road = [], mtn = [], dist = [], x, z, y;
        for (x = 0; x < VW; x++) {
            hm.push([]); lv.push([]); wt.push([]); road.push([]); mtn.push([]); dist.push([]);
            for (z = 0; z < VD; z++) {
                var d = Math.hypot(x + 0.5 - VCX, z + 0.5 - VCZ), hh = rnd() < 0.1 ? 1 : 0, mt = 0;
                MOUNTAINS.forEach(function (m) {
                    var md = Math.hypot(x + 0.5 - m.x, z + 0.5 - m.z);
                    if (md < m.r) {
                        var mh = Math.round(m.h * Math.pow(1 - md / m.r, 1.1) + (rnd() - 0.5) * 1.2);
                        if (mh > hh) { hh = mh; mt = m.h; }
                    }
                });
                if (d < VR) {
                    var f = Math.min(1, (VR - d) / (VR - 4.6));
                    var vh = Math.round(VPEAK * Math.pow(f, 1.35) + (rnd() - 0.5) * 1.4);
                    if (vh > hh) { hh = vh; mt = 0; }
                }
                if (d < 4.6 && d >= 3) hh = VPEAK - (rnd() < 0.35 ? 1 : 0);   // jagged crater rim
                if (d < 3) hh = VPEAK - 2;                                      // magma pool
                hm[x].push(hh); lv[x].push(d < 3); wt[x].push(false); road[x].push(false); mtn[x].push(mt); dist[x].push(d);
            }
        }

        // The magma river: cut a notch through the rim and step down the slope towards +x
        var river = [], prev = VPEAK - 2, lastZ = VCZ, lastL = prev;
        for (x = Math.floor(VCX) + 1; x < VW; x++) {
            var zc = Math.min(VD - 2, Math.round(VCZ - 0.5 + 1.8 * Math.sin((x - VCX) / 3.4)));
            var base = Math.min(hm[x][zc], hm[x][zc + 1]);
            var carved = lv[x][zc] && lv[x][zc + 1] ? base : base - 1;
            var lvl = Math.max(-1, Math.min(prev, carved));
            [zc, zc + 1].forEach(function (zz) { hm[x][zz] = lvl; lv[x][zz] = true; mtn[x][zz] = 0; river.push([x, lvl, zz]); });
            prev = lvl; lastZ = zc; lastL = lvl;
        }

        // A water river winding across the grassland, falling off the same edge
        var waterZ = 0;
        for (x = 3; x < VW; x++) {
            var wz = Math.round(34 + 1.8 * Math.sin(x / 4.5));
            [wz, wz + 1].forEach(function (zz) { hm[x][zz] = -1; wt[x][zz] = true; mtn[x][zz] = 0; });
            waterZ = wz;
        }

        // Portal plaza at the volcano's foot, where the space yak steps out
        for (x = 34; x <= 38; x++) for (z = 27; z <= 33; z++) road[x][z] = true;
        // Roads: one from the front edge up to the volcano, one branching off to the west
        for (z = 30; z < VD; z++) [30, 31].forEach(function (rx) { road[rx][z] = true; });
        for (x = 3; x < 32; x++) [42, 43].forEach(function (rz) { road[x][rz] = true; });
        for (x = 0; x < VW; x++) for (z = 0; z < VD; z++) if (road[x][z] && !wt[x][z]) { hm[x][z] = 0; mtn[x][z] = 0; }

        function near(map, x, z, r) {
            for (var a = -r; a <= r; a++) for (var b = -r; b <= r; b++) {
                if ((a || b) && map[x + a] && map[x + a][z + b]) return true;
            }
            return false;
        }

        var occ = new Map();
        for (x = 0; x < VW; x++) {
            for (z = 0; z < VD; z++) {
                var top = hm[x][z], dd = dist[x][z], volcanic = dd < VR - 0.3 && top >= 2, rocky = mtn[x][z] && top >= 3;
                for (y = -VDEPTH; y <= top; y++) {
                    var t;
                    if (y === top) {
                        if (lv[x][z]) t = 'lava';
                        else if (wt[x][z]) t = 'water';
                        else if (near(lv, x, z, 1) && dd < VR + 1) t = rnd() < 0.6 ? 'obsidian' : 'magma';
                        else if (dd < 5.2) t = 'blackstone';
                        else if (volcanic) t = rnd() < 0.1 ? 'gravel' : (rnd() < 0.06 ? 'coal' : 'stone');
                        else if (rocky) t = top >= mtn[x][z] - 3 ? 'snow' : (rnd() < 0.12 ? 'gravel' : 'stone');
                        else if (road[x][z]) t = 'path';
                        else if (near(wt, x, z, 1)) t = 'sand';
                        else t = 'grass';
                    } else if (lv[x][z] && y >= top - 1) t = 'magma';
                    else if (wt[x][z] && y >= top - 1) t = 'sand';
                    else if ((volcanic || rocky) && y > 0) t = dd < 5.2 ? 'blackstone' : (rnd() < 0.05 ? 'coal' : 'stone');
                    else if (y >= -1) t = 'dirt';
                    else t = 'stone';
                    occ.set(vkey(x, y, z), t);
                }
                // plank bridge where the road crosses the water
                if (road[x][z] && wt[x][z]) occ.set(vkey(x, 0, z), 'planks');
            }
        }

        // Lava and water pouring off the edge of the island
        for (y = lastL; y >= lastL - 46; y--) {
            occ.set(vkey(VW, y, lastZ), 'lava');
            occ.set(vkey(VW, y, lastZ + 1), 'lava');
        }
        for (y = -1; y >= -47; y--) {
            occ.set(vkey(VW, y, waterZ), 'water');
            occ.set(vkey(VW, y, waterZ + 1), 'water');
        }

        var taken = {};
        function put(x, y, z, t) { occ.set(vkey(x, y, z), t); taken[x + ',' + z] = true; }

        // Tetris gates over the roads: I-piece pillars, a lintel and a T piece crowning it
        function gate(along, at, lane, pillarT, lintelT, crownT) {
            // along 'z': road runs along z (lanes are x = lane, lane+1), gate sits at z = at
            for (var i = -1; i <= 2; i += 3) {
                for (var yy = 1; yy <= 4; yy++) {
                    if (along === 'z') put(lane + i, yy, at, 'tet_' + pillarT); else put(at, yy, lane + i, 'tet_' + pillarT);
                }
            }
            for (var j = -2; j <= 3; j++) {
                if (along === 'z') put(lane + j, 5, at, 'tet_' + lintelT); else put(at, 5, lane + j, 'tet_' + lintelT);
            }
            [[-1, 6], [0, 6], [1, 6], [0, 7]].forEach(function (c) {
                if (along === 'z') put(lane + c[0] + 0, c[1], at, 'tet_' + crownT); else put(at, c[1], lane + c[0], 'tet_' + crownT);
            });
        }
        gate('z', 45, 30, 'I', 'T', 'Z');
        gate('z', 31, 30, 'I', 'L', 'S');
        gate('x', 12, 42, 'J', 'O', 'T');

        // Landed tetrominoes: flat on the grass or standing on edge
        LANDED.forEach(function (p) {
            var cells = PIECES[p.t][0], maxY = Math.max.apply(null, cells.map(function (c) { return c[1]; }));
            cells.forEach(function (c) {
                var gx = p.x + c[0], gz = p.stand ? p.z : p.z + c[1];
                if (gx >= VW || gz >= VD) return;
                var gy = (hm[gx][gz] < 0 ? 0 : hm[gx][gz]) + (p.stand ? 1 + maxY - c[1] : 1);
                put(gx, gy, gz, 'tet_' + p.t);
            });
        });

        // Forest: oaks and spruces wherever the grass is free
        var spots = [];
        for (var tries = 0; tries < 1500 && spots.length < 30; tries++) {
            var tx = 2 + Math.floor(rnd() * (VW - 4)), tz = 2 + Math.floor(rnd() * (VD - 4));
            if (dist[tx][tz] < VR + 1.5 || hm[tx][tz] < 0 || hm[tx][tz] > 1 || mtn[tx][tz]) continue;
            if (near(lv, tx, tz, 2) || near(wt, tx, tz, 1) || near(road, tx, tz, 1) || road[tx][tz]) continue;
            var busy = false;
            for (var a = -2; a <= 2; a++) for (var b = -2; b <= 2; b++) if (taken[(tx + a) + ',' + (tz + b)]) busy = true;
            if (busy || spots.some(function (p) { return Math.abs(p[0] - tx) + Math.abs(p[1] - tz) < 4; })) continue;
            spots.push([tx, tz]);
            var g0 = hm[tx][tz], spruce = rnd() < 0.4, dx, dz, k, ly;
            if (spruce) {
                var sh = 5 + Math.floor(rnd() * 2);
                for (y = 1; y <= sh; y++) occ.set(vkey(tx, g0 + y, tz), 'spruce_log');
                [[2, 2], [3, 1], [4, 2], [5, 1], [6, 0], [7, 0]].forEach(function (lr) {
                    ly = g0 + lr[0] + (sh - 5);
                    var r = lr[1];
                    for (dx = -r; dx <= r; dx++) for (dz = -r; dz <= r; dz++) {
                        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                        k = vkey(tx + dx, ly, tz + dz);
                        if (!occ.has(k)) occ.set(k, 'spruce_leaves');
                    }
                });
            } else {
                var th = 4 + Math.floor(rnd() * 2);
                for (y = 1; y <= th; y++) occ.set(vkey(tx, g0 + y, tz), 'log');
                for (ly = g0 + th - 1; ly <= g0 + th + 1; ly++) {
                    var rr = ly === g0 + th + 1 ? 1 : 2;
                    for (dx = -rr; dx <= rr; dx++) {
                        for (dz = -rr; dz <= rr; dz++) {
                            if (Math.abs(dx) === rr && Math.abs(dz) === rr && (rr === 1 || rnd() < 0.6)) continue;
                            k = vkey(tx + dx, ly, tz + dz);
                            if (!occ.has(k)) occ.set(k, 'leaves');
                        }
                    }
                }
                occ.set(vkey(tx, g0 + th + 2, tz), 'leaves');
            }
        }

        // Keep only cubes with a face the camera can see (top, +x, +z), drawn back to front
        var cubes = [], animCubes = [];
        occ.forEach(function (t, k) {
            var p = k.split(','), cx = +p[0], cy = +p[1], cz = +p[2];
            var f = [!occ.has(vkey(cx, cy + 1, cz)), !occ.has(vkey(cx + 1, cy, cz)), !occ.has(vkey(cx, cy, cz + 1))];
            if (!f[0] && !f[1] && !f[2]) return;
            var c = { x: cx, y: cy, z: cz, t: t, f: f, pool: t === 'lava' && cx < VW && dist[cx][cz] < 3 };
            cubes.push(c);
            if (t === 'lava' || t === 'water') animCubes.push(c);
        });
        function order(p, q) { return (p.x + p.y + p.z) - (q.x + q.y + q.z); }
        cubes.sort(order);
        animCubes.sort(order);
        return { hm: hm, cubes: cubes, animCubes: animCubes, river: river };
    }

    function initVolcano(cv, reduceMotion, getRect) {
        if (!cv || !cv.getContext) return null;
        var T = buildTextures(), world = buildWorld();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);          // full sharpness on retina screens
        var ctx = cv.getContext('2d');
        function layer() { return document.createElement('canvas').getContext('2d'); }
        var S = layer(), M = layer(), L = layer();          // static terrain, lava visibility mask, animated lava
        var w = 0, h = 0, s = 10, A = 8.66, B = 5, ox = 0, oy = 0, lastRect = '', sceneRect = null;
        var acc = 0, time = 0, lavaT = 0, tickN = 0, flash = 0, shake = 0, lastOpacity = -1;
        var bombs = [], embers = [], smoke = [], rings = [], smokeT = 0, emberT = 0, riverT = 0, spitT = 2, fountain = 0, fountainPower = 1, fountainBig = false;
        var clouds = makeClouds();

        function P(x, y, z) { return [ox + (x - z) * A, oy + (x + z) * B - y * s]; }

        // Map a 16x16 texture onto one cube face: 0 = top, 1 = +x (right), 2 = +z (left)
        function setFace(g, face, x, y, z) {
            var k = dpr / 16, o;
            if (face === 0) { o = P(x, y + 1, z); g.setTransform(A * k, B * k, -A * k, B * k, o[0] * dpr, o[1] * dpr); }
            else if (face === 1) { o = P(x + 1, y + 1, z); g.setTransform(-A * k, B * k, 0, s * k, o[0] * dpr, o[1] * dpr); }
            else { o = P(x, y + 1, z + 1); g.setTransform(A * k, B * k, 0, s * k, o[0] * dpr, o[1] * dpr); }
        }
        function texFor(t, face) {
            if (t === 'grass') return face ? T.grass_side : T.grass_top;
            if (t === 'log') return face ? T.log : T.log_top;
            if (t === 'spruce_log') return face ? T.spruce_log : T.log_top;
            if (t === 'snow') return face ? T.snow_side : T.snow;
            if (t === 'lava') return face ? T.lavaV[0] : T.lavaU[0];
            if (t === 'water') return face ? T.waterV[0] : T.waterU[0];
            return T[t];
        }
        var SHADE = [0, 0.2, 0.4];

        function makeClouds() {
            var rnd = mulberry(99), list = [];
            for (var i = 0; i < 8; i++) {
                var cw = 3 + Math.floor(rnd() * 5), cd = 2 + Math.floor(rnd() * 3), cells = [];
                for (var a = 0; a < cw; a++) {
                    for (var b = 0; b < cd; b++) {
                        if (rnd() < 0.75 || (a > 0 && a < cw - 1 && b > 0 && b < cd - 1)) cells.push([a, b]);
                    }
                }
                cells.sort(function (p, q) { return (p[0] + p[1]) - (q[0] + q[1]); });
                list.push({
                    x: -30 + rnd() * (VW + 50), z: -8 + rnd() * (VD + 4), y: VPEAK + 6 + rnd() * 5, w: cw * 2,
                    cells: cells, set: new Set(cells.map(function (c) { return c[0] + ',' + c[1]; })), v: 0.35 + rnd() * 0.3
                });
            }
            return list;
        }

        function size() {
            var nw = window.innerWidth, nh = window.innerHeight;
            var rect = getRect ? getRect() : null, rectKey = rect ? [rect.x, rect.y, rect.w, rect.h].map(Math.round).join(',') : '';
            if (w && nw === w && Math.abs(nh - h) < 120 && rectKey === lastRect) return;   // ignore mobile URL-bar jiggle
            w = nw; h = nh; lastRect = rectKey; sceneRect = rect;
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            cv.style.width = w + 'px'; cv.style.height = h + 'px';
            [S, M, L].forEach(function (g) { g.canvas.width = cv.width; g.canvas.height = cv.height; });
            [ctx, S, M, L].forEach(function (g) { g.imageSmoothingEnabled = false; });
            if (rect) {
                // Desktop: the whole island fits in the free space left of the game cabinet
                s = Math.min(rect.w / ((VW + VD) * 0.866), rect.h / ((VW + VD) * 0.5 + VDEPTH + 9));
                A = s * 0.866; B = s * 0.5;
                ox = rect.x + rect.w / 2;
                oy = rect.y + rect.h - (VW + VD) * B - VDEPTH * s - 8;
            } else {
                var narrow = w < 700;
                s = Math.min(w * (narrow ? 1.15 : 0.78) / ((VW + VD) * 0.866), h * 0.75 / ((VW + VD) * 0.5 + VPEAK + VDEPTH));
                A = s * 0.866; B = s * 0.5;
                ox = w / 2;
                oy = h * 0.97 - (VW + VD) * B - VDEPTH * s;
            }
            renderStatic();
            renderLava();
            draw();
        }

        function renderStatic() {
            var W2 = S.canvas.width, H2 = S.canvas.height;
            [S, M].forEach(function (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W2, H2); });
            M.fillStyle = '#fff';
            world.cubes.forEach(function (c) {
                var lava = c.t === 'lava' || c.t === 'water';
                for (var face = 0; face < 3; face++) {
                    if (!c.f[face]) continue;
                    setFace(S, face, c.x, c.y, c.z);
                    S.drawImage(texFor(c.t, face), -0.3, -0.3, 16.6, 16.6);
                    if (SHADE[face]) { S.fillStyle = 'rgba(0,0,0,' + SHADE[face] + ')'; S.fillRect(-0.3, -0.3, 16.6, 16.6); }
                    setFace(M, face, c.x, c.y, c.z);
                    M.globalCompositeOperation = lava ? 'source-over' : 'destination-out';
                    M.fillRect(-0.3, -0.3, 16.6, 16.6);
                }
            });
            M.globalCompositeOperation = 'source-over';
            // Night tint on the terrain only, then a warm glow along the magma
            S.setTransform(1, 0, 0, 1, 0, 0);
            S.globalCompositeOperation = 'source-atop';
            S.fillStyle = 'rgba(28,12,70,0.16)';
            S.fillRect(0, 0, W2, H2);
            S.globalCompositeOperation = 'lighter';
            S.setTransform(dpr, 0, 0, dpr, 0, 0);
            world.river.forEach(function (rc, i) {
                if (i % 3) return;
                var p = P(rc[0] + 0.5, rc[1] + 1, rc[2] + 0.5), r = s * 3.2;
                var g = S.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
                g.addColorStop(0, 'rgba(255,110,30,0.2)');
                g.addColorStop(1, 'rgba(255,60,20,0)');
                S.fillStyle = g;
                S.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
            });
            S.globalCompositeOperation = 'source-over';
        }

        function renderLava() {
            L.setTransform(1, 0, 0, 1, 0, 0);
            L.globalCompositeOperation = 'source-over';
            L.clearRect(0, 0, L.canvas.width, L.canvas.height);
            var fr = tickN % 16, frPool = Math.floor(tickN / 3) % 16, frWater = Math.floor(tickN / 2) % 16;
            function paint(type) {
                world.animCubes.forEach(function (c) {
                    if (c.t !== type) return;
                    var water = type === 'water', f = water ? frWater : (c.pool ? frPool : fr);
                    for (var face = 0; face < 3; face++) {
                        if (!c.f[face]) continue;
                        setFace(L, face, c.x, c.y, c.z);
                        L.drawImage(face ? (water ? T.waterV : T.lavaV)[f] : (water ? T.waterU : T.lavaU)[f], -0.3, -0.3, 16.6, 16.6);
                        if (face) { L.fillStyle = 'rgba(0,0,0,' + SHADE[face] * (water ? 1 : 0.6) + ')'; L.fillRect(-0.3, -0.3, 16.6, 16.6); }
                    }
                });
            }
            // water gets the same night tint as the terrain; lava stays bright
            paint('water');
            L.setTransform(1, 0, 0, 1, 0, 0);
            L.globalCompositeOperation = 'source-atop';
            L.fillStyle = 'rgba(28,12,70,0.16)';
            L.fillRect(0, 0, L.canvas.width, L.canvas.height);
            L.globalCompositeOperation = 'source-over';
            paint('lava');
            L.setTransform(1, 0, 0, 1, 0, 0);
            if (flash > 0.05) {
                L.globalCompositeOperation = 'source-atop';
                L.fillStyle = 'rgba(255,236,170,' + Math.min(0.5, flash * 0.3) + ')';
                L.fillRect(0, 0, L.canvas.width, L.canvas.height);
            }
            L.globalCompositeOperation = 'destination-in';     // hide lava behind terrain
            L.drawImage(M.canvas, 0, 0);
            L.globalCompositeOperation = 'source-over';
        }

        function poly(pts, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            ctx.fill();
        }
        function box(x0, y0, z0, x1, y1, z1, top, right, left) {
            poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], top);
            if (right) poly([P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)], right);
            if (left) poly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)], left);
        }
        function cube(x, y, z, k, top, right, left) {
            var q = k / 2;
            box(x - q, y - q, z - q, x + q, y + q, z + q, top, right, left);
        }

        function drawMoon() {
            var narrow = w < 700;
            var m = Math.max(28, Math.min(60, Math.min(w, h) * 0.065));
            var mx = narrow ? w * 0.8 : w * 0.2, my = narrow ? h * 0.07 : h * 0.1;
            if (sceneRect) { mx = sceneRect.x + sceneRect.w * 0.86; my = sceneRect.y + m * 0.9; }
            ctx.globalCompositeOperation = 'lighter';
            var g = ctx.createRadialGradient(mx, my, 0, mx, my, m * 2.4);
            g.addColorStop(0, 'rgba(255,248,210,0.2)');
            g.addColorStop(1, 'rgba(255,248,210,0)');
            ctx.fillStyle = g;
            ctx.fillRect(mx - m * 2.4, my - m * 2.4, m * 4.8, m * 4.8);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#efeacb';
            ctx.fillRect(mx - m / 2, my - m / 2, m, m);
            ctx.fillStyle = '#d3cda6';
            ctx.fillRect(mx - m * 0.3, my - m * 0.28, m * 0.2, m * 0.2);
            ctx.fillRect(mx + m * 0.08, my + m * 0.02, m * 0.26, m * 0.26);
            ctx.fillRect(mx - m * 0.2, my + m * 0.22, m * 0.12, m * 0.12);
        }

        // ---------- physics around the island: spacetime, a wormhole, strings, an atom,
        //            and a space-yak teleporting between two quantum portals ----------
        var WH = { x: -7.5, y: VPEAK + 6, z: 17.5 };          // wormhole, up in space
        var PORTAL_A = { x: 2, y: VPEAK + 3, z: 13 };        // portal on a floating asteroid
        var PORTAL_B = { x: 36, y: 1, z: 28.5 };             // portal on the plaza at the volcano's foot
        var STRINGS = [
            { x: 20, y: VPEAK + 9, z: -4, r: 3.2, n: 5, c: [45, 226, 230], sp: 1.3, label: 'STRING THEORY' },
            { x: -10, y: 4, z: 30, r: 2.6, n: 3, c: [255, 63, 164], sp: 1.7 },
            { open: true, a: [46, 12, 4], b: [50, 8, 12], n: 3, c: [255, 210, 63], sp: 2.1 }
        ];
        var ATOM = { x: 40, y: VPEAK + 3, z: -6 };
        var YS = 2.3;                                         // yak model scale
        // Yak timeline (seconds): open A, walk in, dissolve, travel, appear at B, walk out,
        // look around, walk back, dissolve, travel, appear at A, walk out, turn around
        var QP = [1.0, 2.0, 0.8, 1.4, 0.8, 2.2, 1.6, 2.2, 0.8, 1.4, 0.8, 1.8, 1.6], QT = 0;
        QP.forEach(function (d) { QT += d; });
        var QPARTS = [];
        (function () {
            var r = mulberry(77);
            var cols = ['#4a3a2e', '#2de2e6', '#ff3fa4', '#ffffff', '#b967ff', '#efe6cf'];
            for (var i = 0; i < 44; i++) QPARTS.push({ lag: r(), jit: (r() - 0.5) * 2, ph: r() * 6, c: cols[i % cols.length], k: 0.6 + r() * 0.8 });
        })();

        function label(text, x, y) {
            ctx.font = Math.round(Math.max(6, Math.min(9, s * 0.9))) + 'px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(210,210,255,0.6)';
            ctx.fillText(text, x, y);
        }

        function drawSpacetime() {
            var cx0 = VW / 2, cz0 = VD / 2, base = -VDEPTH - 7, amp = 0.35 + Math.min(1.2, flash * 0.6);
            function gy(x, z) {
                var r = Math.hypot(x - cx0, z - cz0);
                return base - 10 / (1 + (r / 11) * (r / 11)) + amp * Math.sin(r * 0.55 - time * 2) / (1 + r * 0.04);
            }
            ctx.strokeStyle = 'rgba(120,140,255,0.22)';
            ctx.lineWidth = 1;
            for (var dir = 0; dir < 2; dir++) {
                for (var i = -20; i <= VW + 20; i += 4) {
                    ctx.beginPath();
                    for (var j = -20; j <= VD + 20; j++) {
                        var x = dir ? j : i, z = dir ? i : j, p = P(x, gy(x, z), z);
                        if (j === -20) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
                    }
                    ctx.stroke();
                }
            }
            var lp = P(VW + 6, gy(VW + 6, VD + 6), VD + 6);
            label('SPACETIME', lp[0], lp[1]);
        }

        function drawWormhole() {
            var c = P(WH.x, WH.y, WH.z), R = 6.5 * s, i;
            ctx.globalCompositeOperation = 'lighter';
            var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R * 1.6);
            g.addColorStop(0, 'rgba(150,80,255,0.35)');
            g.addColorStop(1, 'rgba(150,80,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(c[0] - R * 1.6, c[1] - R * 1.6, R * 3.2, R * 3.2);
            for (i = 0; i < 16; i++) {                       // the tunnel: rings shrinking into the throat
                var t = i / 16, rad = R * (1 - t * 0.92);
                ctx.strokeStyle = 'hsla(' + (270 - t * 90) + ',95%,' + (55 + t * 15) + '%,' + (0.18 + t * 0.5) + ')';
                ctx.lineWidth = Math.max(1, s * 0.22 * (1 - t * 0.5));
                ctx.beginPath();
                ctx.ellipse(c[0] + Math.sin(time * 0.7) * t * R * 0.12, c[1] + t * R * 0.08, rad, rad * 0.45,
                    -0.35 + Math.sin(time * 0.6 + t * 4) * 0.12, 0, Math.PI * 2);
                ctx.stroke();
            }
            var PAL = ['rgba(45,226,230,', 'rgba(255,63,164,', 'rgba(255,255,255,'];
            for (i = 0; i < 48; i++) {                       // matter spiralling in
                var f = (time * 0.25 + i / 48) % 1, ang = i * 2.4 + time * (1 + (1 - f) * 2), rr = R * (1 - f) * 1.05;
                var q = Math.max(1.5, s * 0.3 * (1 - f) + 1);
                ctx.fillStyle = PAL[i % 3] + ((1 - f) * 0.9) + ')';
                ctx.fillRect(c[0] + Math.cos(ang) * rr - q / 2, c[1] + Math.sin(ang) * rr * 0.45 - q / 2, q, q);
            }
            ctx.globalCompositeOperation = 'source-over';
            var g2 = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R * 0.24);
            g2.addColorStop(0, '#000');
            g2.addColorStop(0.7, '#05010f');
            g2.addColorStop(1, 'rgba(5,1,15,0)');
            ctx.fillStyle = g2;
            ctx.fillRect(c[0] - R * 0.24, c[1] - R * 0.24, R * 0.48, R * 0.48);
            label('WORMHOLE', c[0], c[1] + R * 0.75);
        }

        function drawStrings() {
            ctx.globalCompositeOperation = 'lighter';
            STRINGS.forEach(function (st) {
                var pts = [], j;
                if (!st.open) {
                    var c = P(st.x, st.y, st.z), R = st.r * s;
                    for (j = 0; j <= 64; j++) {
                        var th = j / 64 * Math.PI * 2;
                        var rr = R * (1 + 0.16 * Math.sin(st.n * th + time * st.sp * 2) + 0.06 * Math.sin((st.n + 2) * th - time * st.sp * 3));
                        pts.push([c[0] + Math.cos(th) * rr, c[1] + Math.sin(th) * rr * 0.6]);
                    }
                    if (st.label) label(st.label, c[0], c[1] + R + 12);
                } else {
                    var a = P(st.a[0], st.a[1], st.a[2]), b = P(st.b[0], st.b[1], st.b[2]);
                    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
                    for (j = 0; j <= 48; j++) {              // standing wave between two branes
                        var u = j / 48, amp = s * 1.2 * Math.sin(st.n * Math.PI * u) * Math.sin(time * st.sp * 3);
                        pts.push([a[0] + dx * u + nx * amp, a[1] + dy * u + ny * amp]);
                    }
                    ctx.fillStyle = 'rgba(' + st.c.join(',') + ',0.8)';
                    [a, b].forEach(function (e) { ctx.fillRect(e[0] - s * 0.35, e[1] - s * 0.35, s * 0.7, s * 0.7); });
                }
                [[Math.max(3, s * 0.5), 0.22], [Math.max(1, s * 0.13), 0.95]].forEach(function (pass) {
                    ctx.strokeStyle = 'rgba(' + st.c.join(',') + ',' + pass[1] + ')';
                    ctx.lineWidth = pass[0];
                    ctx.beginPath();
                    pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
                    ctx.stroke();
                });
            });
            ctx.globalCompositeOperation = 'source-over';
        }

        function drawAtom() {
            var c = P(ATOM.x, ATOM.y, ATOM.z), R = 2.8 * s, k;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            for (k = 0; k < 3; k++) {
                ctx.beginPath();
                ctx.ellipse(c[0], c[1], R, R * 0.35, k * Math.PI / 3, 0, Math.PI * 2);
                ctx.stroke();
            }
            [[-1, -1, '#ff3864'], [1, 0, '#3d7bff'], [0, 1, '#ff3864'], [-1, 1, '#3d7bff'], [0, 0, '#ff3864']].forEach(function (n) {
                var q = Math.max(2, s * 0.32);
                ctx.fillStyle = n[2];
                ctx.fillRect(c[0] + n[0] * q * 0.6 - q / 2, c[1] + n[1] * q * 0.6 - q / 2, q, q);
            });
            ctx.globalCompositeOperation = 'lighter';
            for (k = 0; k < 3; k++) {
                var an = time * 2.2 + k * 2.1, rot = k * Math.PI / 3, ex = Math.cos(an) * R, ey = Math.sin(an) * R * 0.35;
                var px = c[0] + ex * Math.cos(rot) - ey * Math.sin(rot), py = c[1] + ex * Math.sin(rot) + ey * Math.cos(rot), q = Math.max(2, s * 0.35);
                ctx.fillStyle = 'rgba(45,226,230,0.35)';
                ctx.fillRect(px - q, py - q, q * 2, q * 2);
                ctx.fillStyle = '#c9fbff';
                ctx.fillRect(px - q / 2, py - q / 2, q, q);
            }
            ctx.globalCompositeOperation = 'source-over';
            label('ATOM', c[0], c[1] + R * 0.6 + 12);
        }

        // ----- quantum teleport: portals, the yak, the entanglement beam -----
        function qState() {
            var t = time % QT, ph = 0;
            while (ph < QP.length - 1 && t > QP[ph]) { t -= QP[ph]; ph++; }
            return { ph: ph, k: Math.min(1, t / QP[ph]) };
        }
        function ramp(k, a, b) { return Math.max(0, Math.min(1, (k - a) / (b - a))); }
        function portalOpen(which, q) {
            var ph = q.ph, k = q.k;
            if (which === 'A') {
                if (ph === 0) return ramp(k, 0, 1);
                if (ph === 1 || ph === 2 || ph === 10) return 1;
                if (ph === 3 || ph === 11) return 1 - ramp(k, 0, 0.5);
                if (ph === 9) return ramp(k, 0.55, 1);
                return 0;
            }
            if (ph === 3 || ph === 7) return ramp(k, ph === 3 ? 0.55 : 0.5, 1);
            if (ph === 4 || ph === 8) return 1;
            if (ph === 5 || ph === 9) return 1 - ramp(k, 0, 0.5);
            return 0;
        }
        function yakState(q, bobA) {
            var A = PORTAL_A, B = PORTAL_B, ph = q.ph, k = q.k;
            function lerp(a, b) { return a + (b - a) * k; }
            switch (ph) {
                case 0: return { x: A.x, y: A.y + bobA, z: A.z + 3, dir: -1 };
                case 1: return { x: A.x, y: A.y + bobA, z: lerp(A.z + 3, A.z + 0.8), dir: -1, walk: true };
                case 2: return { x: A.x, y: A.y + bobA, z: A.z + 0.8, dir: -1, out: k };
                case 4: return { x: B.x, y: B.y, z: B.z + 0.8, dir: 1, inn: k };
                case 5: return { x: B.x, y: B.y, z: lerp(B.z + 0.8, B.z + 4.5), dir: 1, walk: true };
                case 6: return { x: B.x, y: B.y + (Math.abs(k - 0.6) < 0.08 ? 0.25 : 0), z: B.z + 4.5, dir: k < 0.6 ? 1 : -1 };
                case 7: return { x: B.x, y: B.y, z: lerp(B.z + 4.5, B.z + 0.8), dir: -1, walk: true };
                case 8: return { x: B.x, y: B.y, z: B.z + 0.8, dir: -1, out: k };
                case 10: return { x: A.x, y: A.y + bobA, z: A.z + 0.8, dir: 1, inn: k };
                case 11: return { x: A.x, y: A.y + bobA, z: lerp(A.z + 0.8, A.z + 3), dir: 1, walk: true };
                case 12: return { x: A.x, y: A.y + bobA + (Math.abs(k - 0.6) < 0.08 ? 0.25 : 0), z: A.z + 3, dir: k < 0.6 ? 1 : -1 };
            }
            return null;   // phases 3 and 9: travelling as a quantum state
        }

        // A portal: a vertical oval in the x-y plane that swirls open from a single point
        function drawPortal(p, yOff, open, hue) {
            if (open <= 0.01) {
                var d0 = P(p.x, p.y + yOff + 1.45 * YS, p.z);
                ctx.fillStyle = 'rgba(' + hue + ',' + (0.35 + 0.25 * Math.sin(time * 4)) + ')';
                ctx.fillRect(d0[0] - 1.5, d0[1] - 1.5, 3, 3);
                return;
            }
            var e = Math.sin(open * Math.PI / 2), rx = 0.95 * YS * e, ry = 1.45 * YS * e, cy = p.y + yOff + 1.45 * YS, i;   // taller than the yak
            function at(th, sc) { return P(p.x + Math.cos(th) * rx * sc, cy + Math.sin(th) * ry * sc, p.z); }
            var c = P(p.x, cy, p.z);
            ctx.save();
            ctx.beginPath();
            for (i = 0; i <= 40; i++) { var q = at(i / 40 * Math.PI * 2, 1); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
            ctx.closePath();
            ctx.save();
            ctx.clip();
            var R = 1.3 * YS * s;
            var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.18, 'rgba(' + hue + ',1)');
            g.addColorStop(0.65, '#2a0f6e');
            g.addColorStop(1, '#0a0620');
            ctx.fillStyle = g;
            ctx.fillRect(c[0] - R * 1.5, c[1] - R * 1.5, R * 3, R * 3);
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineWidth = Math.max(1, s * 0.18);
            for (var arm = 0; arm < 4; arm++) {               // swirl
                ctx.strokeStyle = arm % 2 ? 'rgba(45,226,230,0.55)' : 'rgba(255,63,164,0.5)';
                ctx.beginPath();
                for (var j = 0; j <= 30; j++) {
                    var an = -time * 3.2 + arm * Math.PI / 2 + j * 0.24, sc = j / 30, sp = at(an, sc);
                    if (j) ctx.lineTo(sp[0], sp[1]); else ctx.moveTo(sp[0], sp[1]);
                }
                ctx.stroke();
            }
            ctx.restore();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(' + hue + ',0.95)';     // bright rim
            ctx.lineWidth = Math.max(1.5, s * 0.28);
            ctx.stroke();
            for (i = 0; i < 14; i++) {                        // sparks orbiting the rim
                var sp2 = at(time * 2.5 + i * 0.45, 1.05 + 0.1 * Math.sin(time * 6 + i)), q2 = Math.max(1.5, s * 0.22);
                ctx.fillStyle = i % 2 ? '#ffffff' : 'rgba(' + hue + ',1)';
                ctx.fillRect(sp2[0] - q2 / 2, sp2[1] - q2 / 2, q2, q2);
            }
            var g3 = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R * 1.6);
            g3.addColorStop(0, 'rgba(' + hue + ',' + (0.35 * open) + ')');
            g3.addColorStop(1, 'rgba(' + hue + ',0)');
            ctx.fillStyle = g3;
            ctx.fillRect(c[0] - R * 1.6, c[1] - R * 1.6, R * 3.2, R * 3.2);
            ctx.restore();
        }

        function drawAsteroid(p, yOff) {
            var gy = p.y + yOff;
            box(p.x - 1.5, gy - 2.6, p.z + 0.2, p.x + 1.5, gy - 1.8, p.z + 2.6, '#57506b', '#433d55', '#353046');
            box(p.x - 2.2, gy - 1.8, p.z - 0.6, p.x + 2.2, gy - 0.9, p.z + 4.8, '#625b78', '#4b4561', '#3b3650');
            box(p.x - 2.6, gy - 0.9, p.z - 1.2, p.x + 2.6, gy, p.z + 5.6, '#7a7392', '#5c5674', '#48435c');
            box(p.x + 1.6, gy, p.z + 4.4, p.x + 2.1, gy + 0.6, p.z + 4.9, '#9df7ff', '#2de2e6', '#1aa9b0');   // crystal
        }

        function drawYak(st) {
            var walk = st.walk, lp = time * 9, d = st.dir, bob = walk ? Math.abs(Math.sin(lp)) * 0.04 : 0;
            var boxes = [];
            function add(b, cols) { boxes.push({ b: b, c: cols }); }
            var BODY = ['#4a3a2e', '#3a2c22', '#2a1f18'], HAIR = ['#2b1f17', '#1f1610', '#16100b'], HORN = ['#efe6cf', '#d4c8aa', '#bfb293'];
            [-1, 1].forEach(function (sxx) {
                [-1, 1].forEach(function (szz) {
                    var sw = walk ? Math.sin(lp + (sxx * szz > 0 ? 0 : Math.PI)) * 0.12 : 0;
                    add([sxx * 0.28 - 0.09, 0, szz * 0.5 - 0.09 + sw, sxx * 0.28 + 0.09, 0.45, szz * 0.5 + 0.09 + sw], HAIR);
                });
            });
            add([-0.48, 0.32, -0.66, 0.48, 0.62, 0.66], HAIR);                 // long yak skirt of hair
            add([-0.42, 0.45 + bob, -0.7, 0.42, 1.05 + bob, 0.7], BODY);
            add([-0.34, 1.05 + bob, 0.0, 0.34, 1.2 + bob, 0.5], BODY);         // hump
            add([-0.26, 1.05 + bob, -0.55, 0.26, 1.38 + bob, -0.12], ['#e8ecf5', '#c3c9d6', '#a8afbf']);   // oxygen pack
            add([-0.06, 1.38 + bob, -0.4, 0.06, 1.46 + bob, -0.28], ['#9df7ff', '#2de2e6', '#2de2e6']);
            add([-0.05, 0.55, -0.8, 0.05, 1.0, -0.7], HAIR);                   // tail
            add([-0.25, 0.62 + bob, 0.68, 0.25, 1.02 + bob, 1.12], BODY);       // head
            add([-0.17, 0.6 + bob, 1.12, 0.17, 0.8 + bob, 1.28], ['#7a5f4c', '#634c3c', '#56412f']);
            add([-0.22, 0.86 + bob, 1.12, -0.12, 0.94 + bob, 1.15], ['#111', '#111', '#fff']);
            add([0.12, 0.86 + bob, 1.12, 0.22, 0.94 + bob, 1.15], ['#111', '#111', '#fff']);
            add([-0.46, 0.92 + bob, 0.82, -0.3, 1.04 + bob, 0.94], HORN);
            add([0.3, 0.92 + bob, 0.82, 0.46, 1.04 + bob, 0.94], HORN);
            add([-0.46, 1.04 + bob, 0.82, -0.36, 1.26 + bob, 0.92], HORN);
            add([0.36, 1.04 + bob, 0.82, 0.46, 1.26 + bob, 0.92], HORN);
            function world(b) {
                var z0 = d > 0 ? b[2] : -b[5], z1 = d > 0 ? b[5] : -b[2];
                return [st.x + b[0] * YS, st.y + b[1] * YS, st.z + z0 * YS, st.x + b[3] * YS, st.y + b[4] * YS, st.z + z1 * YS];
            }
            boxes.forEach(function (o) { o.w = world(o.b); o.k = o.w[0] + o.w[3] + o.w[1] + o.w[4] + o.w[2] + o.w[5]; });
            boxes.sort(function (p, q) { return p.k - q.k; });
            boxes.forEach(function (o) { box(o.w[0], o.w[1], o.w[2], o.w[3], o.w[4], o.w[5], o.c[0], o.c[1], o.c[2]); });
            // astronaut helmet: a glass bubble around the head
            var hz0 = d > 0 ? 0.6 : -1.36, hz1 = d > 0 ? 1.36 : -0.6, ga = ctx.globalAlpha;
            ctx.globalAlpha = ga * 0.28;
            box(st.x - 0.36 * YS, st.y + (0.52 + bob) * YS, st.z + hz0 * YS, st.x + 0.36 * YS, st.y + (1.14 + bob) * YS, st.z + hz1 * YS,
                '#d6f3ff', '#a8dcff', '#8fd0ff');
            ctx.globalAlpha = ga;
        }

        // The yak, cut off at a scanline while it materialises or dissolves
        function drawYakQuantum(st) {
            var foot = P(st.x, st.y, st.z), head = P(st.x, st.y + 1.5 * YS, st.z);
            var top = head[1] - s, bottom = foot[1] + s * 1.2, k = st.inn != null ? st.inn : (st.out != null ? 1 - st.out : 1);
            if (k >= 1) { drawYak(st); return; }
            var cut = bottom - (bottom - top) * k;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, cut, w, h);
            ctx.clip();
            ctx.globalAlpha = 0.6 + 0.4 * k;
            drawYak({ x: st.x + (Math.random() - 0.5) * 0.15 * (1 - k), y: st.y, z: st.z, dir: st.dir });
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#c9fbff';
            ctx.fillRect(foot[0] - s * 1.6 * YS / 2, cut - 1, s * 1.6 * YS, 2);
            ctx.globalCompositeOperation = 'lighter';
            for (var i = 0; i < 18; i++) {                    // quantum sparkle
                var q = Math.max(1.5, s * 0.2);
                ctx.fillStyle = i % 2 ? 'rgba(45,226,230,0.9)' : 'rgba(255,63,164,0.9)';
                ctx.fillRect(foot[0] + (Math.random() - 0.5) * s * 2.2 * YS, top + Math.random() * (bottom - top), q, q);
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        function drawQuantum() {
            var q = qState(), bobA = Math.sin(time * 0.9) * 0.35;
            var pa = P(PORTAL_A.x, PORTAL_A.y + bobA + 1.45 * YS, PORTAL_A.z), pb = P(PORTAL_B.x, PORTAL_B.y + 1.45 * YS, PORTAL_B.z), pw = P(WH.x, WH.y, WH.z);
            var ctl = [2 * pw[0] - (pa[0] + pb[0]) / 2, 2 * pw[1] - (pa[1] + pb[1]) / 2];
            function bez(u) {
                var v = 1 - u;
                return [v * v * pa[0] + 2 * v * u * ctl[0] + u * u * pb[0], v * v * pa[1] + 2 * v * u * ctl[1] + u * u * pb[1]];
            }
            var transit = q.ph === 3 || q.ph === 9, j, p;
            // entangled portals: a faint dashed link, bright and wavy while the yak is in transit
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.setLineDash([Math.max(3, s * 0.6), Math.max(3, s * 0.6)]);
            ctx.lineDashOffset = -time * 20;
            ctx.strokeStyle = 'rgba(185,103,255,' + (transit ? 0.5 : 0.22) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (j = 0; j <= 40; j++) { p = bez(j / 40); if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
            ctx.stroke();
            ctx.setLineDash([]);
            if (transit) {
                [[Math.max(3, s * 0.45), 'rgba(45,226,230,0.35)'], [Math.max(1, s * 0.12), 'rgba(255,255,255,0.9)']].forEach(function (pass) {
                    ctx.strokeStyle = pass[1];
                    ctx.lineWidth = pass[0];
                    ctx.beginPath();
                    for (j = 0; j <= 80; j++) {
                        var u = j / 80, a = bez(u), b2 = bez(Math.min(1, u + 0.01));
                        var dx = b2[0] - a[0], dy = b2[1] - a[1], L = Math.hypot(dx, dy) || 1;
                        var off = Math.sin(u * 22 - time * 16) * s * 0.55 * Math.sin(u * Math.PI);
                        var x = a[0] - dy / L * off, y = a[1] + dx / L * off;
                        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                    }
                    ctx.stroke();
                });
                var fwd = q.ph === 3;
                QPARTS.forEach(function (pt, i) {               // the yak, travelling as a cloud of qubits
                    var u = Math.max(0, Math.min(1, (q.k - pt.lag * 0.35) / 0.65));
                    if (u <= 0 || u >= 1) return;
                    var a = bez(fwd ? u : 1 - u), qq = Math.max(1.5, s * 0.32 * pt.k);
                    var wob = Math.sin(u * 12 + pt.ph) * s * 1.1 * pt.jit;
                    ctx.fillStyle = pt.c;
                    ctx.fillRect(a[0] + wob - qq / 2, a[1] - wob * 0.5 - qq / 2, qq, qq);
                });
            }
            ctx.restore();
            var lp = bez(0.78);
            label('|ψ⟩ QUANTUM TELEPORT', lp[0], lp[1] - 8);

            // the floating asteroid portal (A) and the portal at the volcano's foot (B)
            var st = yakState(q, bobA);
            drawAsteroid(PORTAL_A, bobA);
            drawPortal(PORTAL_A, bobA, portalOpen('A', q), '45,226,230');
            if (st && st.x === PORTAL_A.x) drawYakQuantum(st);
            drawPortal(PORTAL_B, 0, portalOpen('B', q), '255,63,164');
            if (st && st.x === PORTAL_B.x) drawYakQuantum(st);
        }

        function draw() {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cv.width, cv.height);
            var sx = shake ? (Math.random() - 0.5) * shake * dpr : 0, sy = shake ? (Math.random() - 0.5) * shake * dpr : 0;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawMoon();
            drawSpacetime();
            drawWormhole();
            drawStrings();
            drawAtom();
            ctx.setTransform(1, 0, 0, 1, sx, sy);
            ctx.drawImage(S.canvas, 0, 0);
            ctx.drawImage(L.canvas, 0, 0);
            ctx.setTransform(dpr, 0, 0, dpr, sx, sy);

            // crater glow, pulsing; flares up on an eruption
            ctx.globalCompositeOperation = 'lighter';
            var c = P(VCX, VPEAK - 1, VCZ), r = s * (7 + flash * 9);
            var a = Math.min(0.95, 0.2 + 0.06 * Math.sin(time * 2.1) + flash * 0.4);
            if (flash > 0.5) {
                ctx.fillStyle = 'rgba(255,90,20,' + Math.min(0.22, (flash - 0.5) * 0.12) + ')';
                ctx.fillRect(0, 0, w, h);
            }
            rings.forEach(function (rg) {
                if (rg.age < 0) return;
                var k = rg.age / rg.max, rr = rg.r * (0.15 + k * 0.85);
                ctx.strokeStyle = 'rgba(255,170,60,' + (0.85 * (1 - k)) + ')';
                ctx.lineWidth = Math.max(1, s * 0.6 * (1 - k));
                ctx.beginPath();
                for (var i = 0; i <= 32; i++) {
                    var an = i / 32 * Math.PI * 2, q = P(VCX + Math.cos(an) * rr, VPEAK - 0.5, VCZ + Math.sin(an) * rr);
                    if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
                }
                ctx.stroke();
            });
            var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
            g.addColorStop(0, 'rgba(255,150,50,' + a + ')');
            g.addColorStop(1, 'rgba(255,60,20,0)');
            ctx.fillStyle = g;
            ctx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
            bombs.forEach(function (b) {
                var p = P(b.x, b.y, b.z), q = b.k * s * 1.3;
                ctx.fillStyle = 'rgba(255,110,30,0.3)';
                ctx.fillRect(p[0] - q, p[1] - q, q * 2, q * 2);
            });
            embers.forEach(function (e) {
                var p = P(e.x, e.y, e.z), q = Math.max(1.5, s * 0.16) * (1 - e.age / e.max * 0.5);
                ctx.fillStyle = e.c;
                ctx.globalAlpha = Math.max(0, 1 - e.age / e.max);
                ctx.fillRect(p[0] - q / 2, p[1] - q / 2, q, q);
            });
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            drawQuantum();

            smoke.forEach(function (p) {
                ctx.globalAlpha = Math.max(0, 0.5 * (1 - p.age / p.max));
                cube(p.x, p.y, p.z, p.k, '#6d6878', '#57536a', '#46425a');
            });
            ctx.globalAlpha = 1;
            bombs.forEach(function (b) { cube(b.x, b.y, b.z, b.k, '#ffe27a', '#ff9a2a', '#e0501c'); });

            var crater = P(VCX, VPEAK, VCZ);
            ctx.save();
            if (sceneRect) {                       // desktop: keep clouds out of the name / heading area
                ctx.beginPath();
                ctx.rect(0, sceneRect.y - 10, w, h);
                ctx.clip();
            }
            clouds.forEach(function (cl) {
                // clouds thin out while they drift across the crater so eruptions stay visible
                var mid = P(cl.x + cl.w / 2, cl.y, cl.z + 3);
                var dd = Math.hypot(mid[0] - crater[0], (mid[1] - crater[1]) * 1.4) / s;
                ctx.globalAlpha = 0.86 * Math.max(0.15, Math.min(1, (dd - 5) / 7));
                cl.cells.forEach(function (cell) {
                    var x0 = cl.x + cell[0] * 2, z0 = cl.z + cell[1] * 2;
                    box(x0, cl.y, z0, x0 + 2, cl.y + 0.8, z0 + 2, '#d6d2ea',
                        cl.set.has((cell[0] + 1) + ',' + cell[1]) ? null : '#b3aed0',
                        cl.set.has(cell[0] + ',' + (cell[1] + 1)) ? null : '#958fb8');
                });
            });
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        function groundAt(x, z) {
            var xi = Math.floor(x), zi = Math.floor(z);
            if (xi < 0 || zi < 0 || xi >= VW || zi >= VD) return -999;
            return world.hm[xi][zi] + 1;
        }
        function ember(x, y, z, hot) {
            embers.push({
                x: x, y: y, z: z, vx: (Math.random() - 0.5) * (hot ? 3 : 0.8), vz: (Math.random() - 0.5) * (hot ? 3 : 0.8),
                vy: hot ? 2 + Math.random() * 4 : 1.2 + Math.random() * 2.2, age: 0, max: 0.7 + Math.random() * 1.3,
                c: Math.random() < 0.5 ? '#ffcf4a' : '#ff7a1a'
            });
        }
        function spawnBombs(n, power, big) {
            for (var i = 0; i < n; i++) {
                var ang = Math.random() * Math.PI * 2, sp = Math.random() * 4.5 * Math.min(power, 1.4) + 0.4, off = Math.random() * 1.6;
                bombs.push({
                    x: VCX + Math.cos(ang) * off, y: VPEAK - 0.5, z: VCZ + Math.sin(ang) * off,
                    vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp,
                    vy: (11 + Math.random() * 9) * (0.55 + power * 0.45),
                    k: big ? 0.45 + Math.random() * 0.75 : 0.3 + Math.random() * 0.45
                });
            }
        }

        function update(dt) {
            time += dt;
            flash *= Math.pow(0.18, dt);
            shake *= Math.pow(0.04, dt);
            if (shake < 0.3) shake = 0;

            smokeT -= dt;
            if (smokeT <= 0) {
                smokeT = 0.35;
                smoke.push({ x: VCX + Math.random() * 2 - 1, y: VPEAK, z: VCZ + Math.random() * 2 - 1, k: 0.6, vy: 1.5, age: 0, max: 5 + Math.random() * 2 });
            }
            emberT -= dt;
            while (emberT <= 0) { emberT += 0.08; ember(VCX + Math.random() * 4 - 2, VPEAK - 0.8, VCZ + Math.random() * 4 - 2); }
            riverT -= dt;
            if (riverT <= 0 && world.river.length) {
                riverT = 0.12;
                var rc = world.river[Math.floor(Math.random() * world.river.length)];
                ember(rc[0] + Math.random(), rc[1] + 1, rc[2] + Math.random());
            }
            spitT -= dt;
            if (spitT <= 0) { spitT = 1.2 + Math.random() * 2.5; spawnBombs(2 + Math.floor(Math.random() * 3), 0.5); }

            if (fountain > 0) {                                  // lava fountain keeps spouting for a moment
                fountain -= dt;
                if (fountainBig) spawnBombs(Math.max(1, Math.round(150 * dt * fountainPower)), 0.6 + fountainPower * 0.45, true);
                else spawnBombs(Math.max(1, Math.round(60 * dt * fountainPower)), 0.35 + fountainPower * 0.3);
            }
            bombs = bombs.filter(function (b) {
                b.vy -= 26 * dt;
                b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
                if (b.vy < 0 && b.y - b.k / 2 <= groundAt(b.x, b.z)) {
                    for (var i = 0; i < 3; i++) ember(b.x, b.y, b.z, true);
                    return false;
                }
                return b.y > -40;
            });
            smoke = smoke.filter(function (p) {
                p.age += dt; p.y += p.vy * dt; p.x += 0.6 * dt; p.k += 0.3 * dt;
                return p.age < p.max;
            });
            embers = embers.filter(function (e) {
                e.age += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
                return e.age < e.max;
            });
            rings = rings.filter(function (rg) { rg.age += dt; return rg.age < rg.max; });
            if (embers.length > 700) embers.splice(0, embers.length - 700);
            if (bombs.length > 900) bombs.splice(0, bombs.length - 900);
            clouds.forEach(function (cl) {
                cl.x += cl.v * dt;
                if (cl.x > VW + 22) cl.x = -30 - cl.w;
            });
        }

        size();
        var rt;
        window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 160); });

        return {
            tick: function (dt) {
                if (reduceMotion) return;
                acc += dt;
                if (acc < 33) return;
                var step = Math.min(0.1, acc / 1000);
                acc = 0;
                update(step);
                lavaT += step;
                if (lavaT >= 0.11) { lavaT = 0; tickN++; renderLava(); }
                // fade the scene a little once the visitor scrolls into the content
                var op = Math.round((1 - Math.min(0.25, Math.max(0, window.scrollY - h) / (h * 2))) * 100) / 100;   // stays fully clear over the hero
                if (op !== lastOpacity) { cv.style.opacity = op; lastOpacity = op; }
                draw();
            },
            // Line clears: magma bombs fly out of the crater, the lava flares and the ground shakes
            // big = the visitor cleared the lines: the full blast. Otherwise (AI demo) the mild one.
            erupt: function (lines, big) {
                if (reduceMotion) return;
                var i;
                if (!big) {
                    spawnBombs(Math.round(12 * lines), 0.8 + lines * 0.15);
                    fountain = Math.max(fountain, (0.35 + 0.25 * lines) * 0.6);
                    fountainPower = lines >= 4 ? 2 : 1 + lines * 0.2;
                    fountainBig = false;
                    flash = Math.min(1.6, flash + (0.45 + 0.25 * lines) * 0.6);
                    shake = Math.max(shake, (lines >= 4 ? 10 : 2 + lines) * 0.6);
                    for (i = 0; i < 5 * lines; i++) {
                        smoke.push({ x: VCX + Math.random() * 3 - 1.5, y: VPEAK, z: VCZ + Math.random() * 3 - 1.5, k: 1 + Math.random(), vy: 2.5 + Math.random() * 1.5, age: 0, max: 3 + Math.random() * 2 });
                    }
                    for (i = 0; i < 20 * lines; i++) ember(VCX + Math.random() * 3 - 1.5, VPEAK, VCZ + Math.random() * 3 - 1.5, true);
                    return;
                }
                var p = 1, tetris = lines >= 4;
                fountainBig = true;
                spawnBombs(Math.round((big ? 70 : 30) * lines), 1.5 + lines * 0.3, true);
                fountain = Math.max(fountain, (0.9 + 0.45 * lines) * p);
                fountainPower = tetris ? 3 : 1.4 + lines * 0.35;
                flash = Math.min(2.6, flash + (0.9 + 0.4 * lines) * p);
                shake = Math.max(shake, (tetris ? 20 : 6 + 2 * lines) * p);
                for (i = 0; i < 14 * lines; i++) {          // ash column
                    smoke.push({ x: VCX + Math.random() * 3 - 1.5, y: VPEAK, z: VCZ + Math.random() * 3 - 1.5, k: 1.5 + Math.random() * 1.5, vy: 4 + Math.random() * 4, age: 0, max: 3.5 + Math.random() * 2.5 });
                }
                for (i = 0; i < 60 * lines; i++) ember(VCX + Math.random() * 3 - 1.5, VPEAK, VCZ + Math.random() * 3 - 1.5, true);
                for (i = 0; i < (tetris ? 3 : 1 + (lines > 1 ? 1 : 0)); i++) {
                    rings.push({ r: 10 + lines * 3 + i * 4, age: -i * 0.18, max: 0.9 + i * 0.15 });
                }
            }
        };
    }

    // Background: translucent tetrominoes drifting down behind everything
    function initRain(cv, reduceMotion) {
        if (!cv) return null;
        var ctx, w, h, drops = [];
        function size() {
            w = window.innerWidth; h = window.innerHeight;
            ctx = fitCanvas(cv, w, h);
            var n = Math.round(Math.min(22, Math.max(8, w * h / 70000)));
            drops = [];
            for (var i = 0; i < n; i++) drops.push(newDrop(true));
            paint();
        }
        function newDrop(anywhere) {
            var s = 10 + Math.random() * 18;
            return {
                t: TYPES[Math.floor(Math.random() * 7)], r: Math.floor(Math.random() * 4),
                x: Math.random() * w, y: anywhere ? Math.random() * h : -s * 4,
                s: s, v: 0.012 + s * 0.0016, a: 0.06 + Math.random() * 0.1
            };
        }
        function paint() {
            ctx.clearRect(0, 0, w, h);
            drops.forEach(function (d) {
                PIECES[d.t][d.r].forEach(function (c) {
                    drawBlock(ctx, Math.round(d.x + c[0] * d.s), Math.round(d.y + c[1] * d.s), Math.round(d.s), COLORS[d.t], d.a);
                });
            });
        }
        size();
        var rt;
        window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 150); });
        if (reduceMotion) return null;
        var acc = 0;
        return function (dt) {
            acc += dt;
            if (acc < 33) return;                       // ~30fps is plenty for a backdrop
            drops.forEach(function (d, i) {
                d.y += d.v * acc;
                if (d.y > h + 20) drops[i] = newDrop(false);
            });
            acc = 0;
            paint();
        };
    }

    // Cards fall into place like pieces when they scroll into view
    function initDropIns(el, reduceMotion) {
        var cards = el.querySelectorAll('.tx-drop');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            cards.forEach(function (c) { c.classList.add('tx-landed'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var c = en.target, siblings = Array.prototype.indexOf.call(c.parentNode.children, c);
                c.style.transitionDelay = (siblings % 4) * 70 + 'ms';
                c.classList.add('tx-landed');
                io.unobserve(c);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        cards.forEach(function (c) { io.observe(c); });
    }

    // Experience well: select a band to show its level panel. On narrow screens the panel
    // opens right under the picked band instead of beside the well.
    function initCareer(el, jobs, reduceMotion) {
        var stack = el.querySelector('.tx-stack'), panel = el.querySelector('.tx-lvl');
        if (!stack || !panel) return;
        var main = panel.parentNode, n = jobs.length, cur = -1;
        var narrow = window.matchMedia('(max-width: 760px)');

        function panelHtml(i) {
            var e = jobs[i], d = e.duration || {}, months = monthsBetween(d.start, d.end);
            var live = /present/i.test(String(d.end));
            var blocks = months ? Math.min(48, Math.ceil(months / 3)) : 0, meter = '';
            for (var k = 0; k < blocks; k++) meter += '<i style="--d:' + (k * 25) + 'ms"></i>';
            return '<div class="tx-lvl-in">' +
                '<div class="tx-lvl-top"><span>LEVEL ' + pad2(n - i) + ' / ' + pad2(n) + '</span>' +
                    (live ? '<span class="tx-lvl-live">● NOW PLAYING</span>' : '<span class="tx-lvl-clear">✓ CLEARED</span>') + '</div>' +
                '<h3>' + esc(e.company) + '</h3>' +
                '<p class="tx-lvl-role">' + esc(e.role) + (e.type ? ' <span>' + esc(e.type) + '</span>' : '') + '</p>' +
                '<div class="tx-lvl-when"><b>' + fmtYm(d.start) + '</b><i></i><b>' + fmtYm(d.end) + '</b></div>' +
                (blocks ? '<div class="tx-meter" aria-hidden="true">' + meter + '</div>' : '') +
                '<p class="tx-meter-cap">' + (monthsText(months) ? 'TIME ON LEVEL ' + monthsText(months) + ' · 1 block = 3 months' : 'Time on level unknown') + '</p>' +
                ((e.description || []).length ? '<p class="tx-lvl-qh">QUESTS</p><ul class="tx-lvl-quests">' +
                    e.description.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') +
                '<div class="tx-lvl-nav">' +
                    '<button type="button" data-step="1"' + (i >= n - 1 ? ' disabled' : '') + '>◀ OLDER</button>' +
                    '<button type="button" data-step="-1"' + (i <= 0 ? ' disabled' : '') + '>NEWER ▶</button>' +
                '</div>' +
            '</div>';
        }

        function show(i, fromUser) {
            if (i < 0 || i >= n) return;
            cur = i;
            var band = null;
            stack.querySelectorAll('.tx-band').forEach(function (b) {
                var on = +b.dataset.job === i;
                b.classList.toggle('tx-sel', on);
                b.setAttribute('aria-pressed', String(on));
                if (on) band = b;
            });
            panel.style.setProperty('--c', band ? band.style.getPropertyValue('--c') : '#2de2e6');
            panel.innerHTML = panelHtml(i);
            if (narrow.matches && band) band.after(panel);
            else if (panel.parentNode !== main) main.appendChild(panel);
            if (fromUser && narrow.matches) panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
        }

        stack.addEventListener('click', function (e) {
            var b = e.target.closest('.tx-band');
            if (b) show(+b.dataset.job, true);
        });
        panel.addEventListener('click', function (e) {
            var b = e.target.closest('[data-step]');
            if (!b) return;
            show(cur + (+b.dataset.step), true);
            var sel = stack.querySelector('.tx-sel');
            if (sel && !narrow.matches) sel.focus({ preventScroll: true });
        });
        stack.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            show(cur + (e.key === 'ArrowUp' ? -1 : 1), true);
            var sel = stack.querySelector('.tx-sel');
            if (sel) sel.focus();
        });
        var onChange = function () { show(cur); };
        if (narrow.addEventListener) narrow.addEventListener('change', onChange);
        else if (narrow.addListener) narrow.addListener(onChange);

        // The bands drop in one after another, oldest first, the first time the well is seen
        if (reduceMotion || !('IntersectionObserver' in window)) stack.classList.add('tx-stack-in');
        else {
            var io = new IntersectionObserver(function (entries) {
                if (!entries[0].isIntersecting) return;
                stack.classList.add('tx-stack-in');
                io.disconnect();
            }, { threshold: 0.15 });
            io.observe(stack);
        }
        show(0);
    }

    // "CONTINUE? 9..0" countdown in the contact stage
    function initCountdown(el, reduceMotion) {
        var n = el.querySelector('.tx-count');
        if (!n || reduceMotion) return;
        var v = 9;
        setInterval(function () {
            v = v <= 0 ? 9 : v - 1;
            n.textContent = v;
            n.classList.remove('tx-tick');
            void n.offsetWidth;
            n.classList.add('tx-tick');
        }, 1000);
    }

    // Email / phone stay blurred until hovered; on touch the first tap reveals, the second follows the link
    function initSecrets(el) {
        el.addEventListener('click', function (e) {
            var s = e.target.closest('.tx-secret');
            if (!s) return;
            if (window.matchMedia('(hover: none)').matches && !s.classList.contains('tx-revealed')) {
                e.preventDefault();
                s.classList.add('tx-revealed');
            }
        });
    }

    window.ProfileTemplates = window.ProfileTemplates || {};
    window.ProfileTemplates.tetris = { render: render };
})();
