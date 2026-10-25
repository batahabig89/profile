/* Halloween template — renders profile-data.json with a playable spider web,
   flying bats, and a dancing zombie / pumpkin / dracula crew. */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Web geometry (in SVG units; a round web hanging in the top-right corner)
    var WEB_SIZE = 360;
    var WEB_CENTER = WEB_SIZE / 2;
    var RING_START = 24;
    var RING_GAP = 20;
    var RADIAL_COUNT = 14;
    var WEB_RADIUS = 172;
    var SPIDER_FOLLOW_RANGE = WEB_RADIUS + 80;
    var SPIDER_SPEED = 1.2;
    var SPIDER_LAG = 0.03;
    var STRAND_COOLDOWN_MS = 110;
    var DANCE_STEP_MS = 700;
    var DANCE_HOLD_MS = 2600;

    // One ring per solfège note, innermost = Do
    var NOTES = [
        { name: 'Do', freq: 523.25, color: '#ff5d5d' },
        { name: 'Re', freq: 587.33, color: '#ff9f43' },
        { name: 'Mi', freq: 659.25, color: '#ffd93d' },
        { name: 'Fa', freq: 698.46, color: '#7bd88f' },
        { name: 'Sol', freq: 783.99, color: '#4fc3f7' },
        { name: 'La', freq: 880.0, color: '#7c83ff' },
        { name: 'Ti', freq: 987.77, color: '#c77dff' },
        { name: 'Do', freq: 1046.5, color: '#ff7ad9' }
    ];

    var NOTE_SYMBOLS = ['♪', '♫', '♩', '♬'];

    var POTION_COLORS = ['#8bd450', '#ff7a18', '#c77dff', '#4fc3f7', '#ff5d8f', '#ffd93d'];

    var DANCE_MOVES = ['hw-m-hop', 'hw-m-spin', 'hw-m-sway', 'hw-m-shake', 'hw-m-squash', 'hw-m-slide', 'hw-m-flip'];

    var BATS = [
        { x: 18, y: 22, r: 70, d: 9, s: 84, delay: 0, rev: false },
        { x: 42, y: 14, r: 110, d: 13, s: 66, delay: -3, rev: true },
        { x: 64, y: 30, r: 90, d: 11, s: 92, delay: -6, rev: false },
        { x: 30, y: 55, r: 130, d: 16, s: 60, delay: -2, rev: true },
        { x: 78, y: 62, r: 80, d: 10, s: 74, delay: -8, rev: false },
        { x: 52, y: 78, r: 120, d: 14, s: 70, delay: -5, rev: true }
    ];

    // ---------- helpers ----------

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function chips(items) {
        return (items || []).map(function (item) {
            return '<span class="hw-chip">' + esc(item) + '</span>';
        }).join('');
    }

    // Deterministic pseudo-random so the web looks the same every visit
    function seeded(seed) {
        return function () {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    // ---------- artwork ----------

    var BAT_SVG =
        '<svg viewBox="0 0 100 50" aria-hidden="true">' +
        '<g class="hw-wing hw-wing-l"><path d="M48 24 C40 10 26 6 8 10 C14 14 12 19 4 22 C12 24 12 29 6 34 C20 30 34 32 46 30 Z"/></g>' +
        '<g class="hw-wing hw-wing-r"><path d="M52 24 C60 10 74 6 92 10 C86 14 88 19 96 22 C88 24 88 29 94 34 C80 30 66 32 54 30 Z"/></g>' +
        '<ellipse cx="50" cy="28" rx="6" ry="9"/>' +
        '<circle cx="50" cy="18" r="5.5"/>' +
        '<path d="M45.5 15 L46 8 L49 13 Z M54.5 15 L54 8 L51 13 Z"/>' +
        '<circle class="hw-bat-eye" cx="48" cy="18" r="1.1"/><circle class="hw-bat-eye" cx="52" cy="18" r="1.1"/>' +
        '</svg>';

    var PUMPKIN_SVG =
        '<svg viewBox="0 0 200 190" aria-hidden="true">' +
        '<defs><radialGradient id="hwPumpkinGlow" cx="50%" cy="55%" r="50%">' +
        '<stop offset="0%" stop-color="#fff3a0"/><stop offset="60%" stop-color="#ffc233"/><stop offset="100%" stop-color="#ff8a00"/>' +
        '</radialGradient></defs>' +
        '<path d="M96 40 C94 24 100 12 112 6 L118 14 C108 18 104 28 106 40 Z" fill="#4a7c2a"/>' +
        '<path d="M106 22 C122 14 136 20 140 30 C128 26 118 28 110 32 Z" fill="#5f9a35"/>' +
        '<ellipse cx="62" cy="112" rx="52" ry="68" fill="#d9590b"/>' +
        '<ellipse cx="138" cy="112" rx="52" ry="68" fill="#d9590b"/>' +
        '<ellipse cx="80" cy="112" rx="42" ry="72" fill="#f06d12"/>' +
        '<ellipse cx="120" cy="112" rx="42" ry="72" fill="#f06d12"/>' +
        '<ellipse cx="100" cy="112" rx="34" ry="74" fill="#ff8424"/>' +
        '<g class="hw-pumpkin-face" fill="url(#hwPumpkinGlow)">' +
        '<path d="M52 92 L80 84 L72 112 Z"/>' +
        '<path d="M148 92 L120 84 L128 112 Z"/>' +
        '<path d="M100 108 L90 124 L110 124 Z"/>' +
        '<path d="M44 132 C70 168 130 168 156 132 L144 136 L136 128 L126 140 L114 130 L100 142 L86 130 L74 140 L64 128 L56 136 Z"/>' +
        '</g>' +
        '</svg>';

    var ZOMBIE_HEAD =
        '<rect x="74" y="34" width="76" height="84" rx="22" fill="#8ec25a"/>' +
        '<path d="M70 50 L78 22 L88 38 L96 16 L106 34 L118 14 L124 34 L138 18 L140 38 L154 30 L150 54 L74 54 Z" fill="#2b2b2b"/>' +
        '<circle cx="96" cy="74" r="12" fill="#f4f1d0"/><circle class="hw-zombie-pupil" cx="92" cy="76" r="4.5" fill="#c1121f"/>' +
        '<ellipse cx="128" cy="78" rx="8" ry="6" fill="#f4f1d0"/><circle cx="126" cy="80" r="3" fill="#2b2b2b"/>' +
        '<path d="M118 66 L138 70" stroke="#2b2b2b" stroke-width="3"/>' +
        '<path d="M88 100 C100 108 118 108 134 98" stroke="#2b2b2b" stroke-width="3" fill="none"/>' +
        '<path d="M96 98 L94 106 M106 101 L105 109 M116 101 L117 109 M126 99 L128 106" stroke="#2b2b2b" stroke-width="2"/>' +
        '<path d="M140 50 L146 84 M136 58 L146 56 M138 68 L148 66 M140 78 L150 76" stroke="#3a5a24" stroke-width="2"/>';

    var ZOMBIE_SVG =
        '<svg viewBox="0 0 220 300" aria-hidden="true">' +
        // legs
        '<path class="hw-z-pants" d="M86 196 L80 280 L104 280 L108 214 Z" fill="#2f3d6b"/>' +
        '<path class="hw-z-pants" d="M120 196 L126 280 L150 280 L138 204 Z" fill="#2a365f"/>' +
        '<path d="M80 270 L104 270 L104 282 L82 286 Z M126 272 L150 272 L156 288 L126 284 Z" fill="#7bb04a"/>' +
        '<path d="M72 282 L106 282 L106 292 L68 292 Z M124 284 L160 284 L162 294 L124 294 Z" fill="#3b2a1e"/>' +
        // torso
        '<path class="hw-z-shirt" d="M78 116 L146 116 L150 204 L138 196 L128 208 L116 196 L104 208 L94 196 L80 206 Z" fill="#5b7f8a"/>' +
        '<path d="M100 116 L112 140 L124 116 Z" fill="#8ec25a"/>' +
        '<path d="M86 150 L96 160 M132 170 L122 178" stroke="#3c5560" stroke-width="3"/>' +
        // arms reaching to the left
        '<g class="hw-zombie-arms">' +
        '<path class="hw-z-shirt" d="M82 126 L24 132 L24 148 L84 146 Z" fill="#5b7f8a"/>' +
        '<path d="M24 132 L6 130 L2 136 L8 140 L2 144 L8 148 L24 148 Z" fill="#8ec25a"/>' +
        '<path class="hw-z-shirt hw-z-shade" d="M86 150 L30 162 L32 176 L88 168 Z" fill="#4f727c"/>' +
        '<path d="M30 162 L12 162 L8 168 L14 172 L8 176 L14 180 L32 176 Z" fill="#7bb04a"/>' +
        '</g>' +
        ZOMBIE_HEAD +
        '<g class="hw-party-hat" transform="rotate(14 118 30)">' +
        '<path class="hw-party-hat-cone" d="M98 34 L118 -26 L138 34 Z"/>' +
        '<path d="M109 6 L127 6 M103 22 L133 22" stroke="#ffe066" stroke-width="4"/>' +
        '<circle cx="118" cy="-28" r="7" fill="#ffe066"/>' +
        '</g>' +
        '</svg>';

    var DRACULA_SVG =
        '<svg viewBox="0 0 220 280" aria-hidden="true">' +
        // cape
        '<path class="hw-cape" d="M110 96 C60 110 26 190 10 274 L210 274 C194 190 160 110 110 96 Z" fill="#0d0d12"/>' +
        '<path class="hw-cape" d="M110 108 C74 120 50 190 40 268 L180 268 C170 190 146 120 110 108 Z" fill="#9b1020"/>' +
        // collar
        '<path d="M60 40 L88 108 L110 100 L132 108 L160 40 L136 86 L110 92 L84 86 Z" fill="#0d0d12"/>' +
        '<path d="M70 52 L90 100 L110 94 L130 100 L150 52 L132 88 L110 92 L88 88 Z" fill="#7a0b18"/>' +
        // suit
        '<path d="M84 110 L110 104 L136 110 L130 230 L90 230 Z" fill="#1a1a22"/>' +
        '<path d="M98 108 L110 104 L122 108 L114 160 L106 160 Z" fill="#f2f2f2"/>' +
        '<circle cx="110" cy="126" r="7" fill="#c1121f" stroke="#ffd166" stroke-width="2"/>' +
        // head
        '<ellipse cx="110" cy="66" rx="30" ry="38" fill="#e9e3f2"/>' +
        '<path d="M78 58 C76 30 92 22 110 22 C128 22 144 30 142 58 C136 46 126 40 120 40 L110 54 L100 40 C94 40 84 46 78 58 Z" fill="#111"/>' +
        '<path d="M88 60 L104 66 M132 60 L116 66" stroke="#111" stroke-width="3"/>' +
        '<ellipse class="hw-dracula-eye" cx="97" cy="71" rx="5" ry="4" fill="#ff1e3c"/>' +
        '<ellipse class="hw-dracula-eye" cx="123" cy="71" rx="5" ry="4" fill="#ff1e3c"/>' +
        '<path d="M96 90 C104 96 116 96 124 90" stroke="#5b0b14" stroke-width="3" fill="none"/>' +
        '<path d="M100 91 L103 100 L106 92 Z M114 92 L117 100 L120 91 Z" fill="#fff"/>' +
        '<path d="M80 66 L72 56 L80 74 Z M140 66 L148 56 L140 74 Z" fill="#e9e3f2"/>' +
        '</svg>';

    var CASTLE_SVG =
        '<svg class="hw-castle" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
        '<g class="hw-castle-body">' +
        '<rect x="660" y="140" width="320" height="60"/>' +
        '<path d="M660 140 V128 H676 V140 H692 V128 H708 V140 M932 140 V128 H948 V140 H964 V128 H980 V140"/>' +
        '<rect x="760" y="80" width="96" height="110"/>' +
        '<path d="M760 80 V66 H776 V80 H792 V66 H808 V80 H824 V66 H840 V80 H856 V66 H856 V80"/>' +
        '<rect x="718" y="44" width="38" height="146"/><path d="M712 46 L737 -14 L762 46 Z"/>' +
        '<rect x="862" y="62" width="42" height="128"/><path d="M856 64 L883 4 L910 64 Z"/>' +
        '<rect x="688" y="104" width="28" height="90"/><path d="M684 106 L702 66 L720 106 Z"/>' +
        '<rect x="920" y="100" width="30" height="94"/><path d="M916 102 L935 58 L954 102 Z"/>' +
        '<rect x="806" y="30" width="16" height="52"/><path d="M802 32 L814 2 L826 32 Z"/>' +
        '<path d="M737 -14 V-34 L752 -28 L737 -22" class="hw-castle-flag"/>' +
        '</g>' +
        '<g class="hw-castle-windows">' +
        '<rect x="733" y="70" width="8" height="14" rx="4"/><rect x="733" y="110" width="8" height="14" rx="4"/>' +
        '<rect x="878" y="90" width="9" height="15" rx="4.5"/><rect x="878" y="130" width="9" height="15" rx="4.5"/>' +
        '<rect x="790" y="100" width="10" height="18" rx="5"/><rect x="816" y="100" width="10" height="18" rx="5"/>' +
        '<rect x="698" y="128" width="7" height="12" rx="3.5"/><rect x="931" y="124" width="8" height="13" rx="4"/>' +
        '<path d="M796 190 V160 A12 12 0 0 1 820 160 V190 Z"/>' +
        '</g>' +
        '<path class="hw-hills" d="M0 300 L0 236 C140 214 300 232 430 214 C560 196 640 176 760 176 C880 176 960 192 1060 206 C1120 214 1170 220 1200 222 L1200 300 Z"/>' +
        '<path class="hw-hills hw-hills-front" d="M0 300 L0 262 C200 244 380 270 600 252 C820 236 1000 262 1200 248 L1200 300 Z"/>' +
        '</svg>';

    // ---------- audio ----------

    var audio = { ctx: null, master: null, unlocked: false };

    function ensureAudio() {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!audio.ctx) {
            audio.ctx = new Ctx();
            var compressor = audio.ctx.createDynamicsCompressor();
            audio.master = audio.ctx.createGain();
            audio.master.gain.value = 0.45;
            audio.master.connect(compressor);
            compressor.connect(audio.ctx.destination);
        }
        return audio.ctx;
    }

    // Sound is always on. Browsers keep audio suspended until the visitor's first
    // click / tap / key press (unless they already allow autoplay for this site),
    // so keep trying to resume until the context is running.
    function unlockAudio() {
        var ctx = ensureAudio();
        if (!ctx) return;
        if (ctx.state === 'running') {
            markAudioUnlocked();
            return;
        }
        ctx.resume().then(function () {
            if (ctx.state === 'running') markAudioUnlocked();
        }, function () { /* still blocked — the next gesture retries */ });
    }

    function markAudioUnlocked() {
        if (audio.unlocked) return;
        audio.unlocked = true;
        GESTURE_EVENTS.forEach(function (type) {
            window.removeEventListener(type, unlockAudio, true);
        });
    }

    var GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'click'];

    // Bell: a few slightly inharmonic sine partials with exponential decay
    function playBell(freq, when, volume, decay) {
        var ctx = audio.ctx;
        var partials = [[1, 1], [2.0, 0.45], [3.01, 0.22], [4.17, 0.1]];
        partials.forEach(function (p, i) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            var length = decay / (1 + i * 0.6);
            osc.type = 'sine';
            osc.frequency.value = freq * p[0];
            gain.gain.setValueAtTime(0.0001, when);
            gain.gain.exponentialRampToValueAtTime(volume * p[1], when + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
            osc.connect(gain);
            gain.connect(audio.master);
            osc.start(when);
            osc.stop(when + length + 0.05);
        });
    }

    // Short high-passed noise burst = the "jingle" shimmer
    function playShimmer(when) {
        var ctx = audio.ctx;
        var length = 0.18;
        var buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        var src = ctx.createBufferSource();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();
        src.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 6000;
        gain.gain.value = 0.12;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(audio.master);
        src.start(when);
    }

    function playNote(index, jingle) {
        if (!audio.unlocked) return;
        var now = audio.ctx.currentTime;
        var freq = NOTES[index].freq;
        playBell(freq, now, 0.32, 1.6);
        if (jingle) {
            playShimmer(now);
            playBell(freq * 2, now + 0.05, 0.08, 0.35);
            playBell(freq * 3, now + 0.1, 0.05, 0.25);
        }
    }

    // ---------- spider web ----------

    function buildWeb(svg) {
        var rand = seeded(13);
        var center = { x: WEB_CENTER, y: WEB_CENTER };
        var strands = [];
        var dirs = [];
        var i;

        for (i = 0; i < RADIAL_COUNT; i++) {
            var angle = (i * (360 / RADIAL_COUNT) + (rand() - 0.5) * 8) * Math.PI / 180;
            dirs.push({ x: Math.cos(angle), y: Math.sin(angle) });
        }

        function addPath(d, cls) {
            var path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', cls);
            svg.appendChild(path);
            return path;
        }

        // Anchor threads tying the web to the top and right edges of the screen
        [[-0.55, -1, 'top'], [0.35, -1, 'top'], [1, -0.2, 'right'], [1, 0.6, 'right']].forEach(function (a) {
            var len = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
            var from = { x: center.x + (a[0] / len) * WEB_RADIUS, y: center.y + (a[1] / len) * WEB_RADIUS };
            var to = a[2] === 'top'
                ? { x: from.x + a[0] * 30, y: -40 }
                : { x: WEB_SIZE + 40, y: from.y + a[1] * 30 };
            addPath('M' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + ' L' + to.x.toFixed(1) + ' ' + to.y.toFixed(1), 'hw-anchor');
        });

        // Radial threads
        dirs.forEach(function (dir) {
            var len = WEB_RADIUS * (0.97 + rand() * 0.06);
            var end = { x: center.x + dir.x * len, y: center.y + dir.y * len };
            var el = addPath('M' + center.x + ' ' + center.y + ' L' + end.x.toFixed(1) + ' ' + end.y.toFixed(1), 'hw-strand hw-radial');
            strands.push({ el: el, kind: 'radial', segs: [[center.x, center.y, end.x, end.y]], last: 0 });
        });

        // Rings: one strand per segment between neighbouring radials (all the way round), sagging toward the hub
        NOTES.forEach(function (note, ringIndex) {
            var r = RING_START + ringIndex * RING_GAP;
            for (var k = 0; k < dirs.length; k++) {
                var next = (k + 1) % dirs.length;
                var r1 = r * (1 + (rand() - 0.5) * 0.05);
                var r2 = r * (1 + (rand() - 0.5) * 0.05);
                var a = { x: center.x + dirs[k].x * r1, y: center.y + dirs[k].y * r1 };
                var b = { x: center.x + dirs[next].x * r2, y: center.y + dirs[next].y * r2 };
                var mx = (dirs[k].x + dirs[next].x) / 2;
                var my = (dirs[k].y + dirs[next].y) / 2;
                var mlen = Math.sqrt(mx * mx + my * my);
                var sag = r * 0.93;
                var c = { x: center.x + (mx / mlen) * sag, y: center.y + (my / mlen) * sag };

                var el = addPath(
                    'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
                    ' Q' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) +
                    ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1),
                    'hw-strand hw-ring'
                );
                el.style.setProperty('--note-color', note.color);

                // Approximate the curve with short segments for hit testing
                var segs = [];
                var prev = a;
                for (var s = 1; s <= 4; s++) {
                    var t = s / 4;
                    var pt = {
                        x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
                        y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
                    };
                    segs.push([prev.x, prev.y, pt.x, pt.y]);
                    prev = pt;
                }
                strands.push({ el: el, kind: 'ring', note: ringIndex, segs: segs, last: 0 });
            }
        });

        // Spider, drawn around (0,0) facing up; positioned and turned from JS
        var spider = document.createElementNS(SVG_NS, 'g');
        spider.setAttribute('class', 'hw-spider');
        spider.innerHTML =
            '<g class="hw-spider-body">' +
            '<path class="hw-legs hw-legs-a" d="M-4 -4 L-14 -14 L-18 -23 M-5 3 L-16 8 L-21 15 M5 0 L16 -4 L22 -9 M4 6 L12 16 L14 25" />' +
            '<path class="hw-legs hw-legs-b" d="M4 -4 L14 -14 L18 -23 M5 3 L16 8 L21 15 M-5 0 L-16 -4 L-22 -9 M-4 6 L-12 16 L-14 25" />' +
            '<ellipse cx="0" cy="7" rx="9" ry="11"/>' +
            '<circle cx="0" cy="-8" r="6"/>' +
            '<circle cx="-2.5" cy="-10" r="1.6" class="hw-spider-eye"/><circle cx="2.5" cy="-10" r="1.6" class="hw-spider-eye"/>' +
            '</g>';
        svg.appendChild(spider);

        return { strands: strands, spider: spider };
    }

    // Returns the hit point if segment p1→p2 crosses segment p3→p4
    function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        var den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 1e-9) return null;
        var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) return null;
        return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }

    function restartAnimation(el, cls) {
        el.classList.remove(cls);
        el.getBoundingClientRect(); // force reflow so the animation replays
        el.classList.add(cls);
    }

    // ---------- dancing ----------

    function createDanceFloor(dancers, onStart, onStop) {
        var danceUntil = 0;
        var timer = null;

        function clear(el) {
            DANCE_MOVES.forEach(function (m) { el.classList.remove(m); });
        }

        function step() {
            if (performance.now() > danceUntil) {
                dancers.forEach(function (d) { clear(d.el); });
                timer = null;
                onStop();
                return;
            }
            dancers.forEach(function (d) {
                clear(d.el);
                d.el.getBoundingClientRect();
                d.el.classList.add(DANCE_MOVES[d.move % DANCE_MOVES.length]);
                d.move++;
            });
            timer = setTimeout(step, DANCE_STEP_MS);
        }

        return function trigger() {
            danceUntil = performance.now() + DANCE_HOLD_MS;
            if (!timer) {
                onStart();
                step();
            }
        };
    }

    // ---------- page content ----------

    function renderContent(data) {
        var info = data.personalInfo || {};
        var location = (info.location || []).join(', ');
        var skills = data.workSkills || {};

        var contact = [
            info.email && '<a class="hw-chip hw-chip-link" href="mailto:' + esc(info.email) + '">✉️ ' + esc(info.email) + '</a>',
            info.phone && '<a class="hw-chip hw-chip-link" href="tel:' + esc(info.phone.replace(/\s+/g, '')) + '">📞 ' + esc(info.phone) + '</a>',
            location && '<span class="hw-chip">📍 ' + esc(location) + '</span>'
        ].filter(Boolean).join('');

        var spoken = Object.keys(data.spokenLanguages || {}).map(function (lang) {
            return lang + ' · ' + data.spokenLanguages[lang];
        });
        var platforms = data.platforms || {};

        // Every skill group becomes a bubbling potion jar
        var shelf = Object.keys(skills).map(function (key) {
            return { title: key, items: skills[key] };
        }).concat([
            { title: 'Languages', items: data.programmingLanguages },
            { title: 'Tools', items: data.tools },
            { title: 'Platforms', items: (platforms.primary || []).concat(platforms.secondary || []) },
            { title: 'Spoken', items: spoken },
            { title: 'Traits', items: data.profileTraits }
        ]).filter(function (group) {
            return group.items && group.items.length;
        });

        var jars = shelf.map(function (group, i) {
            return (
                '<div class="hw-jar hw-reveal-item" style="--liquid:' + POTION_COLORS[i % POTION_COLORS.length] + ';--i:' + i + '">' +
                '<div class="hw-jar-cork" aria-hidden="true"></div>' +
                '<div class="hw-jar-glass">' +
                '<span class="hw-jar-label">' + esc(group.title) + '</span>' +
                '<div class="hw-chips">' + chips(group.items) + '</div>' +
                '<div class="hw-jar-liquid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
                '</div></div>'
            );
        }).join('');

        var experience = (data.experience || []).map(function (exp) {
            var d = exp.duration || {};
            var corner = '<span class="hw-pc-rank">' + esc(String(d.start || '').split('-')[0]) + '</span><span class="hw-pc-suit">🎃</span>';
            return (
                '<article class="hw-playing-card">' +
                '<div class="hw-pc-corner hw-pc-top" aria-hidden="true">' + corner + '</div>' +
                '<div class="hw-pc-face">' +
                '<h3>' + esc(exp.role) + '</h3>' +
                '<p class="hw-pc-company">' + esc(exp.company) + '</p>' +
                '<p class="hw-pc-date">' + esc(d.start) + ' — ' + esc(d.end) + '</p>' +
                (exp.type ? '<p class="hw-pc-type">' + esc(exp.type) + '</p>' : '') +
                '<p class="hw-pc-desc">' + esc((exp.description || []).join(' ')) + '</p>' +
                '</div>' +
                '<div class="hw-pc-corner hw-pc-bottom" aria-hidden="true">' + corner + '</div>' +
                '</article>'
            );
        }).join('');

        var projects = (data.projects || []).map(function (p) {
            return (
                '<article class="hw-project hw-reveal-item">' +
                '<div class="hw-project-icon" aria-hidden="true">' + esc(p.icon || '🦇') + '</div>' +
                '<h3>' + esc(p.name) + '</h3>' +
                '<p>' + esc(p.description) + '</p>' +
                '<div class="hw-chips">' + chips(p.technologies) + '</div>' +
                (p.url ? '<a class="hw-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">Visit if you dare →</a>' : '') +
                '</article>'
            );
        }).join('');

        var education = (data.education || []).map(function (e) {
            return (
                '<div class="hw-tomb hw-reveal-item">' +
                '<span class="hw-tomb-rip" aria-hidden="true">✝ R.I.P ✝</span>' +
                '<h3>' + esc(e.level) + '</h3>' +
                '<p class="hw-company">' + esc(e.field) + '</p>' +
                '<p>' + esc(e.institution) + '</p>' +
                '<p class="hw-date">' + esc(e.date) + (e.GPA ? ' · GPA ' + esc(e.GPA) : '') + '</p>' +
                '</div>'
            );
        }).join('');

        var certifications = (data.certifications || []).map(function (c) {
            return (
                '<div class="hw-tomb hw-reveal-item">' +
                '<span class="hw-tomb-rip" aria-hidden="true">✦ Certified ✦</span>' +
                '<h3>' + esc(c.name) + '</h3>' +
                '<p class="hw-company">' + esc(c.issuer) + '</p>' +
                '<p class="hw-date">' + esc(c.date) + '</p>' +
                '</div>'
            );
        }).join('');

        function heading(icon, title, sub) {
            return '<h2><span class="hw-h2-icon" aria-hidden="true">' + icon + '</span>' + title + ' <span class="hw-h2-sub">' + sub + '</span></h2>';
        }

        return (
            '<main class="hw-page">' +
            '<header class="hw-hero">' +
            // Dracula (positioned from JS) lives inside this ring until the web rings
            '<div class="hw-photo"><div class="hw-photo-hole"></div></div>' +
            '<div class="hw-hero-text">' +
            '<h1 class="hw-name">' + esc(info.name) + '</h1>' +
            '<p class="hw-title">' + esc(info.title) + '</p>' +
            '<div class="hw-summary">' + ((data.summary && data.summary.lines) || []).map(function (l) { return '<p>🎃 ' + esc(l) + '</p>'; }).join('') + '</div>' +
            '<div class="hw-chips hw-contact">' + contact + '</div>' +
            '</div>' +
            '</header>' +

            '<section class="hw-section hw-reveal">' + heading('🧪', 'Potion shelf', 'skills') +
            '<div class="hw-shelf">' + jars + '</div></section>' +

            '<section class="hw-section hw-reveal">' + heading('🃏', 'Haunted deck', 'experience') +
            '<div class="hw-deck">' + experience + '</div></section>' +

            '<section class="hw-section hw-reveal">' + heading('🔮', 'Cursed creations', 'projects') +
            '<div class="hw-grid hw-grid-3">' + projects + '</div></section>' +

            '<section class="hw-section hw-reveal">' + heading('🪦', 'Graveyard of wisdom', 'education &amp; certifications') +
            '<div class="hw-graveyard">' + education + certifications + '</div></section>' +

            '<footer class="hw-footer">🕸️ Sweep your cursor across the spider web to play Do-Re-Mi and make the crew dance.</footer>' +
            '</main>'
        );
    }

    // ---------- render ----------

    function render(data, root) {
        var bats = BATS.map(function (b) {
            return (
                '<div class="hw-bat-drift" style="left:' + b.x + '%;top:' + b.y + '%;--delay:' + b.delay + 's">' +
                '<div class="hw-bat-orbit' + (b.rev ? ' hw-rev' : '') + '" style="--dur:' + b.d + 's;--delay:' + b.delay + 's">' +
                '<div class="hw-bat" style="--radius:' + b.r + 'px;--size:' + b.s + 'px">' + BAT_SVG + '</div>' +
                '</div></div>'
            );
        }).join('');

        root.innerHTML =
            '<div class="hw-root">' +
            '<div class="hw-sky" aria-hidden="true"><div class="hw-moon"></div>' + CASTLE_SVG + '<div class="hw-fog hw-fog-1"></div><div class="hw-fog hw-fog-2"></div></div>' +
            '<div class="hw-bats" aria-hidden="true">' + bats + '</div>' +
            '<div class="hw-lantern" aria-hidden="true"></div>' +
            renderContent(data) +
            '<div class="hw-web-wrap" aria-hidden="true"><svg class="hw-web" viewBox="0 0 ' + WEB_SIZE + ' ' + WEB_SIZE + '"></svg><span class="hw-web-hint">swipe the web ♪</span></div>' +
            '<div class="hw-char hw-dracula" aria-hidden="true"><div class="hw-dancer">' + DRACULA_SVG + '</div></div>' +
            '<div class="hw-char hw-pumpkin" aria-hidden="true"><div class="hw-dancer">' + PUMPKIN_SVG + '</div></div>' +
            [1, 2, 3].map(function (n) {
                return '<div class="hw-char hw-zombie hw-zombie-' + n + '" aria-hidden="true"><div class="hw-dancer">' + ZOMBIE_SVG + '</div></div>';
            }).join('') +
            '</div>';

        var hwRoot = root.querySelector('.hw-root');
        var webSvg = root.querySelector('.hw-web');
        var web = buildWeb(webSvg);
        var dracula = root.querySelector('.hw-dracula');
        var avatarRing = root.querySelector('.hw-photo');
        var flight = { active: false, landed: true, t: 0, x: 0, y: 0, rot: 0 };
        var spiderPos = { x: WEB_CENTER, y: WEB_CENTER, angle: 0 };
        var spiderGoal = { x: WEB_CENTER, y: WEB_CENTER };
        var pointer = null;

        GESTURE_EVENTS.forEach(function (type) {
            window.addEventListener(type, unlockAudio, true);
        });
        unlockAudio();

        var startDance = createDanceFloor(
            [
                { el: root.querySelector('.hw-zombie-1 .hw-dancer'), move: 0 },
                { el: root.querySelector('.hw-zombie-2 .hw-dancer'), move: 2 },
                { el: root.querySelector('.hw-zombie-3 .hw-dancer'), move: 5 },
                { el: root.querySelector('.hw-pumpkin .hw-dancer'), move: 3 }
            ],
            function () {
                hwRoot.classList.add('hw-dancing');
                flight.active = true;
                flight.t = 0;
            },
            function () {
                hwRoot.classList.remove('hw-dancing');
                flight.active = false;
            }
        );

        function showNoteLabel(note, clientX, clientY) {
            var label = document.createElement('span');
            label.className = 'hw-note';
            label.textContent = NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)];
            label.style.left = clientX + 'px';
            label.style.top = clientY + 'px';
            label.style.color = note.color;
            hwRoot.appendChild(label);
            label.addEventListener('animationend', function () { label.remove(); });
        }

        function pluck(strand, hit, clientX, clientY) {
            var noteIndex = strand.note;
            if (strand.kind === 'radial') {
                var dist = Math.sqrt(Math.pow(hit.x - WEB_CENTER, 2) + Math.pow(hit.y - WEB_CENTER, 2));
                noteIndex = Math.round((dist - RING_START) / RING_GAP);
                noteIndex = Math.max(0, Math.min(NOTES.length - 1, noteIndex));
            }
            var note = NOTES[noteIndex];
            strand.el.style.setProperty('--note-color', note.color);
            restartAnimation(strand.el, 'hw-pluck');
            restartAnimation(web.spider, 'hw-spider-jolt');
            restartAnimation(dracula, 'hw-alert');
            playNote(noteIndex, strand.kind === 'radial');
            showNoteLabel(note, clientX, clientY);
            startDance();
        }

        // Pointer → web coordinates
        var webRect = null;
        function measure() { webRect = webSvg.getBoundingClientRect(); }
        measure();
        window.addEventListener('resize', measure);

        var last = null;

        function track(clientX, clientY) {
            var scale = webRect.width / WEB_SIZE;
            var p = { x: (clientX - webRect.left) / scale, y: (clientY - webRect.top) / scale };
            if (last && !(p.x < -20 && last.x < -20) && !(p.y > WEB_SIZE + 20 && last.y > WEB_SIZE + 20)) {
                var now = performance.now();
                web.strands.forEach(function (strand) {
                    if (now - strand.last < STRAND_COOLDOWN_MS) return;
                    for (var i = 0; i < strand.segs.length; i++) {
                        var s = strand.segs[i];
                        var hit = intersect(last.x, last.y, p.x, p.y, s[0], s[1], s[2], s[3]);
                        if (hit) {
                            strand.last = now;
                            pluck(strand, hit, clientX, clientY);
                            break;
                        }
                    }
                });
            }
            last = p;
            pointer = p;
        }

        // Spider creeps after the cursor (with a lag) while it is near the web, then back to the hub
        function stepSpider() {
            var target = { x: WEB_CENTER, y: WEB_CENTER };
            if (pointer) {
                var dx = pointer.x - WEB_CENTER;
                var dy = pointer.y - WEB_CENTER;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < SPIDER_FOLLOW_RANGE) {
                    var k = d > 0 ? Math.min(d, WEB_RADIUS - 14) / d : 0;
                    target = { x: WEB_CENTER + dx * k, y: WEB_CENTER + dy * k };
                }
            }
            // The goal trails the cursor, so the spider reacts late and walks slowly
            spiderGoal.x += (target.x - spiderGoal.x) * SPIDER_LAG;
            spiderGoal.y += (target.y - spiderGoal.y) * SPIDER_LAG;
            var mx = spiderGoal.x - spiderPos.x;
            var my = spiderGoal.y - spiderPos.y;
            var dist = Math.sqrt(mx * mx + my * my);
            var running = dist > 0.8;
            if (running) {
                var stride = Math.min(SPIDER_SPEED, dist);
                spiderPos.x += (mx / dist) * stride;
                spiderPos.y += (my / dist) * stride;
                // The drawing faces up, so add 90° to the travel direction
                var turn = Math.atan2(my, mx) * 180 / Math.PI + 90 - spiderPos.angle;
                turn = ((turn + 540) % 360) - 180;
                spiderPos.angle += turn * 0.08;
            }
            web.spider.setAttribute('transform',
                'translate(' + spiderPos.x.toFixed(1) + ' ' + spiderPos.y.toFixed(1) + ') rotate(' + spiderPos.angle.toFixed(1) + ')');
            web.spider.classList.toggle('hw-running', running);
        }

        // Dracula's home is the centre of the profile ring (it moves as the page scrolls)
        function draculaHome() {
            var r = avatarRing.getBoundingClientRect();
            return {
                x: r.left + r.width / 2 - dracula.offsetWidth / 2,
                y: r.top + r.height / 2 - dracula.offsetHeight / 2
            };
        }

        // While the web plays, Dracula flies out of the ring and is tossed around like a flag in a gale
        function stepDracula(dt) {
            var home = draculaHome();
            if (flight.landed && !flight.active) {
                flight.x = home.x;
                flight.y = home.y;
                flight.rot = 0;
                dracula.style.transform = 'translate(' + home.x.toFixed(1) + 'px,' + home.y.toFixed(1) + 'px)';
                dracula.classList.remove('hw-flying');
                hwRoot.classList.remove('hw-dracula-out');
                return;
            }
            flight.landed = false;
            var tx = home.x;
            var ty = home.y;
            var trot = 0;
            if (flight.active) {
                flight.t += dt / 1000;
                var t = flight.t;
                var w = window.innerWidth - dracula.offsetWidth - 24;
                var h = window.innerHeight * 0.6;
                tx = 12 + w * (0.5 - 0.5 * Math.cos(t * 0.55 + Math.sin(t * 0.21) * 2));
                ty = 12 + h * (0.5 - 0.5 * Math.cos(t * 1.05 + Math.sin(t * 0.33) * 1.5));
                trot = Math.sin(t * 2.6) * 28 + Math.sin(t * 6.1) * 12;
            }
            flight.x += (tx - flight.x) * 0.05;
            flight.y += (ty - flight.y) * 0.05;
            flight.rot += (trot - flight.rot) * 0.12;
            dracula.style.transform =
                'translate(' + flight.x.toFixed(1) + 'px,' + flight.y.toFixed(1) + 'px) rotate(' + flight.rot.toFixed(1) + 'deg)';
            if (!flight.active && Math.abs(tx - flight.x) + Math.abs(ty - flight.y) < 3) flight.landed = true;
            dracula.classList.add('hw-flying');
            hwRoot.classList.add('hw-dracula-out');
        }

        var lastFrame = performance.now();
        function frame(now) {
            var dt = Math.min(50, now - lastFrame);
            lastFrame = now;
            stepSpider();
            stepDracula(dt);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);

        var lantern = root.querySelector('.hw-lantern');
        window.addEventListener('pointermove', function (e) {
            lantern.style.setProperty('--mx', e.clientX + 'px');
            lantern.style.setProperty('--my', e.clientY + 'px');
            if (e.pointerType !== 'touch') track(e.clientX, e.clientY);
        }, { passive: true });

        // Sections rise out of the ground as they scroll into view
        var reveals = root.querySelectorAll('.hw-reveal');
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('hw-in');
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.12 });
            reveals.forEach(function (el) { observer.observe(el); });
        } else {
            reveals.forEach(function (el) { el.classList.add('hw-in'); });
        }
        window.addEventListener('touchstart', function (e) {
            last = null;
            track(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchmove', function (e) {
            track(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        document.addEventListener('mouseleave', function () {
            last = null;
            pointer = null;
        });
    }

    window.ProfileTemplates = window.ProfileTemplates || {};
    window.ProfileTemplates.halloween = { render: render };
})();
