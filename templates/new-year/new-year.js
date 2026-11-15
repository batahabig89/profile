/* New Year scene: fixed 3D Eiffel Tower with 10,000 programmable bulbs, summit searchlights,
   salute fireworks, Mongolian flag hoist, Mongolian reindeer, snowplow and a snowy garden. */
(function () {
    'use strict';
    const EFFECTS = ['tree', 'salute', 'gold', 'aurora', 'olympic', 'steady', 'twinkle', 'wave', 'pulse', 'chase', 'rainbow', 'flag'];
    const EFFECT_ALIASES = { fireworks: 'salute' };
    const EFFECT_LABELS = {
        tree: 'Сүлд мод', salute: 'Ёслолын буудлага', gold: 'Алтан гялбаа', aurora: 'Туйлын туяа', olympic: 'Paris 2024',
        steady: 'Тогтмол', twinkle: 'Анивчих', wave: 'Долгио', pulse: 'Лугшилт', chase: 'Хөөцөлдөөн', rainbow: 'Солонго', flag: 'Монгол туг'
    };
    const BEAM_MODES = ['sweep', 'fan', 'still', 'follow', 'off'];
    const FLAG_COLORS = ['#da2032', '#0066b3', '#ffd900'];
    const RAINBOW = ['#ff6b7f', '#ffb45e', '#fff07a', '#7ef0a8', '#6fd3ff', '#9d93ff', '#e48cff'];
    const PALETTES = {
        tree: ['#19b85a', '#ffd36b', '#ff4057', '#4fa3ff', '#fff4d6', '#ff8bd8'],
        salute: ['#ffd36b', '#ff5a6e', '#6fb6ff', '#b6ff7a', '#ffffff', '#ff9e3d'],
        gold: ['#ffc65c', '#fff1cf'],
        aurora: ['#4dffb5', '#3ad3ff', '#7a7cff', '#d07bff'],
        olympic: ['#ffd58a', '#ffffff', '#709dff', '#ff727d'],
        rainbow: RAINBOW,
        flag: FLAG_COLORS
    };
    const DEFAULT_PALETTE = ['#ffd58a', '#ffffff', '#709dff', '#ff727d'];
    const defaults = {
        colors: null, effects: ['tree', 'salute', 'gold', 'aurora', 'flag'], duration: 8, loop: false,
        speed: 1, snow: 0.8, brightness: 1, beams: 'sweep', beamcolor: '#cfe8ff'
    };
    const presets = {
        show: '// Шинэ жилийн гэрэлт шоу — эффектүүд дарааллаар\n// сүүлийнх нь Монгол туг мандана\neffect tree salute gold aurora flag\nduration 8\nloop off\nspeed 1\nbrightness 1\nsnow 0.8\nbeams sweep\nbeamcolor #cfe8ff',
        tree: '// Сүлд мод — ногоон гэрэл, ороомог гирлянд, од\neffect tree\ncolor auto\nspeed 1\nbrightness 1.1\nsnow 0.9\nbeams still\nbeamcolor #fff2c8',
        salute: '// Ёслолын буудлага — салют, цамхаг гялбана\neffect salute\ncolor #ffd36b #ff5a6e #6fb6ff #ffffff\nspeed 1.2\nbrightness 1\nsnow 0.5\nbeams fan\nbeamcolor #ffe6b0',
        gold: '// Алтан гялбаа — Эйфелийн цагийн гялбаа\neffect gold\nspeed 0.8\nbrightness 1\nsnow 0.6\nbeams follow\nbeamcolor #fff4ce',
        aurora: '// Туйлын туяа — тэнгэр ба цамхаг долгилно\neffect aurora\nspeed 1.3\nbrightness 1.2\nsnow 1\nbeams sweep\nbeamcolor #b8fff1',
        olympic: '// Paris 2024 · inspired light show\ncolor #ffd58a #ffffff #709dff #ff727d\neffect olympic\nspeed 1\nbrightness 1\nsnow 0.8\nbeams sweep\nbeamcolor #cfe8ff',
        flag: '// Монгол туг мандана — улаан, хөх, алтан соёмбо\neffect flag\nspeed 1\nbrightness 1.1\nsnow 0.7\nbeams sweep\nbeamcolor #ffffff'
    };
    const HEX = /^#[0-9a-f]{6}$/i;
    function parse(source) {
        const next = { ...defaults, effects: [...defaults.effects] };
        if (source.length > 6000) throw new Error('Код хэт урт байна (6000 тэмдэгт).');
        source.split('\n').forEach((raw, index) => {
            const line = raw.split('//')[0].trim();
            if (!line) return;
            const [cmd, ...args] = line.split(/\s+/);
            const fail = message => { const error = new Error(`${index + 1}-р мөр: ${message}`); error.line = index + 1; throw error; };
            if (cmd === 'color') {
                if (args.length === 1 && args[0] === 'auto') { next.colors = null; return; }
                if (!args.length || args.length > 8 || args.some(c => !HEX.test(c))) fail('color #RRGGBB — 1–8 өнгө, эсвэл color auto.');
                next.colors = args;
            } else if (cmd === 'effect') {
                const names = args.map(a => EFFECT_ALIASES[a] || a);
                if (!names.length || names.length > 8 || names.some(n => !EFFECTS.includes(n))) fail('effect: ' + EFFECTS.join(', ') + ' (1–8, дараалсан).');
                next.effects = names;
            } else if (cmd === 'beams') {
                if (args.length !== 1 || !BEAM_MODES.includes(args[0])) fail('beams: ' + BEAM_MODES.join(', ') + '.');
                next.beams = args[0];
            } else if (cmd === 'beamcolor') {
                if (args.length !== 1 || !HEX.test(args[0])) fail('beamcolor #RRGGBB — прожекторын өнгө.');
                next.beamcolor = args[0];
            } else if (cmd === 'loop') {
                if (args.length !== 1 || !['on', 'off'].includes(args[0])) fail('loop on эсвэл loop off.');
                next.loop = args[0] === 'on';
            } else if (cmd === 'rotate') {
                fail('Цамхаг хөдөлгөөнгүй. rotate командыг хасна уу.');
            } else if (['speed', 'snow', 'brightness', 'duration'].includes(cmd)) {
                const [min, max] = { speed: [0, 5], snow: [0, 1], brightness: [0, 2], duration: [2, 60] }[cmd];
                const value = Number(args[0]);
                if (args.length !== 1 || !Number.isFinite(value) || value < min || value > max) fail(`${cmd}: ${min}–${max} тоо оруулна уу.`);
                next[cmd] = value;
            } else fail(`Танихгүй команд: ${cmd}`);
        });
        return next;
    }
    function paletteFor(effect, colors) {
        if (effect === 'flag' || effect === 'rainbow') return PALETTES[effect];
        return colors || PALETTES[effect] || DEFAULT_PALETTE;
    }
    // Which effect is playing at a given number of seconds into the program, and how far the
    // crossfade from the previous one has progressed. Without loop the last effect holds.
    function showState(config, elapsed) {
        const list = config.effects, n = list.length, d = config.duration, e = Math.max(0, elapsed);
        let step = Math.floor(e / d), local = e - step * d;
        if (config.loop) step %= n;
        else if (step >= n) { step = n - 1; local = e - step * d; }
        const hasPrevious = n > 1 && (step > 0 || (config.loop && e >= d));
        const blend = hasPrevious ? Math.min(1, local / 1.2) : 1;
        return { step, effect: list[step], previous: hasPrevious ? list[(step - 1 + n) % n] : null, blend: blend * blend * (3 - 2 * blend), local };
    }
    // Flag ceremony: the pole rises out of the snow, then the flag is hoisted to the top.
    function flagProgress(local) {
        const pole = Math.max(0, Math.min(1, local / 1.2));
        const h = Math.max(0, Math.min(1, (local - 1.2) / 8));
        return { pole: pole * pole * (3 - 2 * pole), hoist: h * h * (3 - 2 * h), raised: local >= 9.2 };
    }

    const LIGHT_COUNT = 10000;
    const STORAGE_KEY = 'winterEiffelLights.v2';
    const LEVEL = { F1: .175, F2: .35, F3: .835, LANTERN: .905 };
    // Outer half-width of the tower follows the iron lady's exponential curve.
    const outerWidth = y => .008 + .186 * Math.exp(-3.37 * y);
    const legWidth = y => .006 + .072 * Math.exp(-2.4 * y);
    // Normalized 3D ironwork (height 1 = antenna tip). Geometry is fixed; only lights animate.
    function createTowerModel() {
        const segments = [];
        const add = (a, b, weight = 1, kind = 'lattice', density = 1) =>
            segments.push({ a, b, weight, kind, density, length: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) });
        const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
        const legLevels = [], shaftLevels = [];
        for (let i = 0; i <= 9; i++) legLevels.push(LEVEL.F1 * (i / 9) ** 1.08);
        for (let i = 1; i <= 9; i++) legLevels.push(LEVEL.F1 + (LEVEL.F2 - LEVEL.F1) * i / 9);
        for (let i = 0; i <= 18; i++) shaftLevels.push(LEVEL.F2 + (LEVEL.F3 - LEVEL.F2) * i / 18);
        // A truss face between two vertical girders: chords, struts and X-bracing per panel.
        function face(edgeA, edgeB, levels, density) {
            for (let i = 0; i < levels.length - 1; i++) {
                const a0 = edgeA(levels[i]), a1 = edgeA(levels[i + 1]), b0 = edgeB(levels[i]), b1 = edgeB(levels[i + 1]);
                add(a0, b0, .8, 'strut', density);
                add(a0, b1, .62, 'brace', density); add(b0, a1, .62, 'brace', density);
                const m0 = lerp(a0, b0, .5), m1 = lerp(a1, b1, .5);
                add(m0, m1, .35, 'fine', density * .6);
            }
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const corner = (ox, oz) => y => { const o = outerWidth(y), i = o - legWidth(y); return [sx * (ox ? o : i), y, sz * (oz ? o : i)]; };
            const oo = corner(1, 1), io = corner(0, 1), oi = corner(1, 0), ii = corner(0, 0);
            for (let i = 0; i < legLevels.length - 1; i++) {
                for (const edge of [oo, io, oi, ii]) add(edge(legLevels[i]), edge(legLevels[i + 1]), edge === oo ? 2.4 : 1.7, 'girder', 1.3);
            }
            face(oo, io, legLevels, 1); face(oo, oi, legLevels, 1); face(io, ii, legLevels, .55); face(oi, ii, legLevels, .55);
        }
        // Above the second floor the four legs merge into one tapering shaft.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const edge = y => { const o = outerWidth(y); return [sx * o, y, sz * o]; };
            for (let i = 0; i < shaftLevels.length - 1; i++) add(edge(shaftLevels[i]), edge(shaftLevels[i + 1]), 2.1, 'girder', 1.3);
        }
        for (const side of [-1, 1]) {
            face(y => [-outerWidth(y), y, side * outerWidth(y)], y => [outerWidth(y), y, side * outerWidth(y)], shaftLevels, 1);
            face(y => [side * outerWidth(y), y, -outerWidth(y)], y => [side * outerWidth(y), y, outerWidth(y)], shaftLevels, 1);
        }
        // Decorative double arches on all four faces under the first floor.
        for (const side of [-1, 1]) for (const axis of [0, 2]) {
            for (const [inset, weight] of [[0, 2.2], [.012, 1]]) {
                const spring = .018, span = outerWidth(spring) - legWidth(spring) - inset, rise = .118 - inset;
                let previous;
                for (let i = 0; i <= 36; i++) {
                    const th = Math.PI * i / 36, y = spring + rise * Math.sin(th), u = span * Math.cos(th), w = outerWidth(y);
                    const p = axis === 0 ? [u, y, side * w] : [side * w, y, u];
                    if (previous) add(previous, p, weight, 'arch', 1.6);
                    previous = p;
                }
            }
        }
        // Observation floors: double rim, deck struts and an arcade frieze on the first floor.
        for (const [y0, y1, r, frieze] of [[.166, .186, .118, 16], [.343, .357, .07, 10], [.83, .842, .027, 4]]) {
            for (const y of [y0, y1]) {
                const c = [[-r, y, -r], [r, y, -r], [r, y, r], [-r, y, r]];
                c.forEach((p, i) => add(p, c[(i + 1) % 4], 2.4, 'deck', 1.5));
            }
            for (let i = 0; i <= frieze; i++) {
                const u = -r + 2 * r * i / frieze;
                for (const side of [-1, 1]) { add([u, y0, side * r], [u, y1, side * r], .7, 'deck', 1.1); add([side * r, y0, u], [side * r, y1, u], .7, 'deck', 1.1); }
            }
            for (let i = 0; i < frieze; i++) for (const side of [-1, 1]) for (const axis of [0, 2]) {
                const u0 = -r + 2 * r * i / frieze, u1 = -r + 2 * r * (i + 1) / frieze, um = (u0 + u1) / 2, ya = y0 + (y1 - y0) * .25, yb = y0 + (y1 - y0) * .7;
                const P = (u, y) => axis === 0 ? [u, y, side * r] : [side * r, y, u];
                add(P(u0, ya), P(um, yb), .45, 'frieze', .9); add(P(um, yb), P(u1, ya), .45, 'frieze', .9);
            }
        }
        // Lantern, dome and antenna.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            add([sx * .018, .842, sz * .018], [sx * .015, .885, sz * .015], 1.4, 'girder', 1);
            add([sx * .015, .885, sz * .015], [0, .905, 0], 1.2, 'girder', .8);
        }
        for (const y of [.862, .885]) { const r = y < .87 ? .017 : .015, c = [[-r, y, -r], [r, y, -r], [r, y, r], [-r, y, r]]; c.forEach((p, i) => add(p, c[(i + 1) % 4], 1.2, 'deck', 1)); }
        add([0, .905, 0], [0, 1, 0], 1.3, 'antenna', .5);
        for (const y of [.93, .955, .975]) add([-.006, y, 0], [.006, y, 0], .6, 'antenna', .4);
        const total = segments.reduce((sum, s) => sum + s.length * s.density, 0);
        const lights = [];
        let segmentIndex = 0, start = 0;
        for (let i = 0; i < LIGHT_COUNT; i++) {
            const distance = (i + .5) / LIGHT_COUNT * total;
            while (segmentIndex < segments.length - 1 && distance > start + segments[segmentIndex].length * segments[segmentIndex].density) start += segments[segmentIndex].length * segments[segmentIndex++].density;
            const s = segments[segmentIndex], t = (distance - start) / (s.length * s.density);
            lights.push({ point: lerp(s.a, s.b, Math.min(1, t)), phase: ((i * 16807) % 2147483647) % 997 / 997 * Math.PI * 2, hash: ((i * 48271) % 2147483647) % 1009 / 1009, index: i });
        }
        return { segments, lights };
    }
    const SKY_BPM = 108;
    const SKY_EFFECTS = ['wave', 'chase', 'twinkle', 'pulse'];
    function beatStyle(beat) {
        const value = Math.max(0, beat);
        return { effect: SKY_EFFECTS[Math.floor(value) % SKY_EFFECTS.length], pulse: Math.exp(-(value % 1) * 4) };
    }
    function flightPosition(from, to, progress) {
        const p = Math.max(0, Math.min(1, progress)), eased = p * p * (3 - 2 * p);
        return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased - Math.sin(Math.PI * p) * Math.min(45, Math.hypot(to.x - from.x, to.y - from.y) * .12) };
    }
    // "Jingle Bells" chorus (J. L. Pierpont, 1857 — public domain) as [midi, eighth notes].
    // One audio clock drives the notes, the sleigh bells and the tower beats.
    const JINGLE = (([E, G, C, D, F]) => [
        [E, 2], [E, 2], [E, 4], [E, 2], [E, 2], [E, 4], [E, 2], [G, 2], [C, 3], [D, 1], [E, 8],
        [F, 2], [F, 2], [F, 3], [F, 1], [F, 2], [E, 2], [E, 2], [E, 1], [E, 1], [E, 2], [D, 2], [D, 2], [E, 2], [D, 4], [G, 4],
        [E, 2], [E, 2], [E, 4], [E, 2], [E, 2], [E, 4], [E, 2], [G, 2], [C, 3], [D, 1], [E, 8],
        [F, 2], [F, 2], [F, 3], [F, 1], [F, 2], [E, 2], [E, 2], [E, 1], [E, 1], [G, 2], [G, 2], [F, 2], [D, 2], [C, 8]
    ])([76, 79, 72, 74, 77]);
    const JINGLE_BASS = [48, 48, 48, 48, 53, 48, 50, 43, 48, 48, 48, 48, 53, 48, 43, 48];
    const JINGLE_AT = new Map();
    JINGLE.reduce((step, [midi, len]) => { JINGLE_AT.set(step, [midi, len]); return step + len; }, 0);
    const JINGLE_STEPS = JINGLE.reduce((sum, [, len]) => sum + len, 0);
    function createSkyMusic() {
        let audio, master, origin = 0, nextStep = 0, active = false, muted = false;
        const voices = new Set(), beatSeconds = 60 / SKY_BPM;
        function tone(midi, at, duration, volume, type) {
            const oscillator = audio.createOscillator(), gain = audio.createGain();
            oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
            gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .012);
            gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
            oscillator.connect(gain); gain.connect(master); voices.add(oscillator);
            oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
            oscillator.start(at); oscillator.stop(at + duration + .03);
        }
        function start() {
            if (active) return;
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) return;
            try {
                if (!audio) { audio = new Audio(); master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination); }
                active = true; origin = audio.currentTime + .04; nextStep = 0;
                audio.resume().catch(() => { active = false; });
                master.gain.cancelScheduledValues(audio.currentTime);
                master.gain.setTargetAtTime(muted ? 0 : .28, audio.currentTime, .025);
            } catch (_) { active = false; }
        }
        function stop() {
            active = false;
            if (!audio) return;
            master.gain.cancelScheduledValues(audio.currentTime);
            master.gain.setTargetAtTime(0, audio.currentTime, .015);
            for (const voice of voices) { try { voice.stop(audio.currentTime + .04); } catch (_) {} }
        }
        return {
            start, stop,
            update() {
                if (!active || audio.state !== 'running') return;
                // Skip missed notes after a stalled frame; never emit a catch-up burst.
                nextStep = Math.max(nextStep, Math.ceil((audio.currentTime - origin) / (beatSeconds / 2)));
                while (origin + nextStep * beatSeconds / 2 < audio.currentTime + .12) {
                    const at = origin + nextStep * beatSeconds / 2, step = nextStep % JINGLE_STEPS, note = JINGLE_AT.get(step);
                    if (note) {
                        const hold = Math.min(.9, note[1] * beatSeconds / 2 * .92);
                        tone(note[0], at, hold, .3, 'sine');
                        tone(note[0] + 12, at, Math.min(.3, hold), .05, 'sine');
                    }
                    if (step % 4 === 0) tone(JINGLE_BASS[Math.floor(step / 8) % JINGLE_BASS.length], at, .55, .2, 'triangle');
                    // Sleigh bells on every beat, a softer shake on the off-beats.
                    tone(100 + (step % 2), at, .07, step % 2 ? .012 : .025, 'triangle');
                    tone(105, at + .012, .05, step % 2 ? .008 : .016, 'triangle');
                    nextStep++;
                }
            },
            get beat() { return active && audio.state === 'running' ? Math.max(0, (audio.currentTime - origin) / beatSeconds) : null; },
            get playing() { return !!(active && audio && audio.state === 'running'); },
            mute(value) { muted = value; if (audio) { master.gain.cancelScheduledValues(audio.currentTime); master.gain.setTargetAtTime(active && !muted ? .28 : 0, audio.currentTime, .025); } },
            dispose() { stop(); if (audio && audio.state !== 'closed') audio.close().catch(() => {}); }
        };
    }
    // Short synthesized sound effects (sleigh bells, shimmer, snowball, fireworks). The audio
    // context is created only from a user gesture; fireworks stay silent until then.
    function createSfx() {
        let audio, master, noise, muted = false;
        function ready() {
            if (muted) return false;
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) return false;
            try {
                if (!audio) {
                    audio = new Audio(); master = audio.createGain(); master.gain.value = .5; master.connect(audio.destination);
                    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
                    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                }
                if (audio.state === 'suspended') audio.resume().catch(() => {});
                return audio.state !== 'closed';
            } catch (_) { return false; }
        }
        function env(g, at, peak, attack, decay) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + attack + decay); }
        function tone(freq, at, dur, vol, type, slideTo) {
            const o = audio.createOscillator(), g = audio.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, at);
            if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
            env(g, at, vol, .005, dur); o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + .05);
            o.onended = () => { o.disconnect(); g.disconnect(); };
        }
        function hiss(at, dur, vol, type, freq, q) {
            const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
            src.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
            env(g, at, vol, .004, dur); src.connect(f); f.connect(g); g.connect(master); src.start(at, Math.random() * .5); src.stop(at + dur + .05);
            src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
        }
        const live = () => !!audio && !muted && audio.state === 'running';
        return {
            unlock() { ready(); },
            mute(value) { muted = value; if (master) master.gain.value = value ? 0 : .5; },
            bells() { if (!ready()) return; const t = audio.currentTime; for (let i = 0; i < 8; i++) { const at = t + i * .07 + Math.random() * .02; hiss(at, .12, .2, 'bandpass', 7000 + Math.random() * 2500, 5); tone(2350 + Math.random() * 300, at, .2, .05); tone(3650 + Math.random() * 300, at, .14, .03); } },
            shimmer() { if (!ready()) return; const t = audio.currentTime; [1047, 1319, 1568, 1760, 2093, 2637, 3136].forEach((f, i) => tone(f, t + .08 + i * .07, .7, .06, 'triangle')); },
            whoosh() { if (!ready()) return; hiss(audio.currentTime, .22, .14, 'bandpass', 900, .8); },
            splat(v) { if (!ready()) return; const t = audio.currentTime, vol = v || .3; hiss(t, .16, vol, 'lowpass', 900); tone(170, t, .12, vol * .5, 'sine', 70); },
            thud() { if (!ready()) return; const t = audio.currentTime; tone(120, t, .22, .4, 'sine', 55); hiss(t, .09, .22, 'lowpass', 1300); },
            tick() { if (!live()) return; tone(1760, audio.currentTime, .12, .08, 'sine'); },
            boom(power) { if (!live()) return; const t = audio.currentTime, p = power || 1; hiss(t, .9 * p, .45 * p, 'lowpass', 230); tone(72, t, .5, .3 * p, 'sine', 34); for (let i = 0; i < 8; i++) hiss(t + .25 + Math.random() * .6, .03, .07, 'highpass', 3200); },
            dispose() { if (audio && audio.state !== 'closed') audio.close().catch(() => {}); }
        };
    }
    // New Year clock: counts down to 1 January 00:00 local time, then celebrates for a while.
    const CELEBRATE_MS = 90000;
    function newYearClock(now) {
        const year = new Date(now).getFullYear(), start = new Date(year, 0, 1).getTime();
        if (now - start >= 0 && now - start < CELEBRATE_MS) return { celebrating: true, year, since: now - start, remaining: 0 };
        const target = new Date(year + 1, 0, 1).getTime();
        return { celebrating: false, year: year + 1, since: -1, remaining: target - now };
    }
    function formatCountdown(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000)), pad = n => String(n).padStart(2, '0');
        return { days: Math.floor(total / 86400), seconds: total, clock: `${pad(Math.floor(total % 86400 / 3600))}:${pad(Math.floor(total % 3600 / 60))}:${pad(total % 60)}` };
    }
    // Snowball helper: ballistic velocity that reaches `to` after T seconds.
    function aimVelocity(from, to, gravity, T) { return { vx: (to.x - from.x) / T, vy: (to.y - from.y) / T - gravity * T / 2 }; }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const hexRgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

    /* ---------- Drawing helpers (all local Canvas paths, no external images) ---------- */
    function poly(ctx, pts, fill, stroke, width) {
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
    }
    function oval(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
    function linear(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
    function radial(ctx, x, y, r0, r1, stops, fx, fy) { const g = ctx.createRadialGradient(fx == null ? x : fx, fy == null ? y : fy, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

    // State flag of Mongolia (2:1) with the Soyombo on the hoist stripe.
    function drawMongolianFlag(c, W, H) {
        c.fillStyle = FLAG_COLORS[0]; c.fillRect(0, 0, W, H);
        c.fillStyle = FLAG_COLORS[1]; c.fillRect(W / 3, 0, W / 3, H);
        const u = H / 30, gold = FLAG_COLORS[2], red = FLAG_COLORS[0];
        c.save(); c.translate(W / 6, 15 * u); c.scale(.765 * u, .765 * u); c.translate(0, -.25);
        c.fillStyle = gold;
        // Fire: three tongues.
        c.beginPath(); c.moveTo(-2, -8.6);
        c.bezierCurveTo(-2.4, -9.6, -1.9, -10.4, -1.5, -11.2); c.bezierCurveTo(-1.2, -10.4, -.9, -10.1, -.6, -9.9);
        c.bezierCurveTo(-.85, -11.1, -.4, -11.9, 0, -12.7); c.bezierCurveTo(.4, -11.9, .85, -11.1, .6, -9.9);
        c.bezierCurveTo(.9, -10.1, 1.2, -10.4, 1.5, -11.2); c.bezierCurveTo(1.9, -10.4, 2.4, -9.6, 2, -8.6);
        c.quadraticCurveTo(0, -8.1, -2, -8.6); c.fill();
        // Sun and crescent moon.
        c.beginPath(); c.arc(0, -6.6, 1.75, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(0, -3.6, 2.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = red; c.beginPath(); c.arc(0, -4.5, 2.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = gold; c.beginPath(); c.arc(0, -6.6, 1.75, 0, Math.PI * 2); c.fill();
        // Triangles, bars and pillars.
        c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.lineTo(0, 2); c.closePath(); c.fill();
        c.fillRect(-3, 2.6, 6, 1); c.fillRect(-3, 9.6, 6, 1);
        c.beginPath(); c.moveTo(-3, 11.2); c.lineTo(3, 11.2); c.lineTo(0, 13.2); c.closePath(); c.fill();
        c.fillRect(-4.6, 0, 1, 13.2); c.fillRect(3.6, 0, 1, 13.2);
        // Taijitu: two fish inside a gold ring.
        const R = 2.15, cy = 6.6;
        c.beginPath(); c.arc(0, cy, R + .35, 0, Math.PI * 2); c.fill();
        c.fillStyle = red; c.beginPath(); c.arc(0, cy, R, 0, Math.PI * 2); c.fill();
        c.fillStyle = gold; c.beginPath(); c.moveTo(0, cy - R); c.arc(0, cy, R, -Math.PI / 2, Math.PI / 2);
        c.arc(0, cy + R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); c.arc(0, cy - R / 2, R / 2, Math.PI / 2, Math.PI * 1.5); c.fill();
        c.beginPath(); c.arc(0, cy + R / 2, R / 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = red; c.beginPath(); c.arc(0, cy - R / 2, R / 6, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    // Municipal snowplow truck, facing right, origin at road contact under the cab.
    function drawSnowplow(ctx, t, distance, lit) {
        const orange = linear(ctx, 0, -90, 0, -20, [[0, '#ffad55'], [.45, '#f07c1c'], [1, '#b9560e']]);
        oval(ctx, 8, 1, 112, 6, 'rgba(18,36,52,.35)');
        // Headlight beam on the snow ahead.
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        poly(ctx, [[76, -42], [230, -16], [230, 8]], linear(ctx, 76, 0, 230, 0, [[0, 'rgba(255,240,200,.55)'], [1, 'rgba(255,240,200,0)']]));
        ctx.restore();
        // Rear salt-spreader hopper with a heap of snow on top.
        poly(ctx, [[-94, -26], [-99, -68], [-22, -68], [-26, -26]], orange);
        ctx.strokeStyle = 'rgba(110,50,10,.55)'; ctx.lineWidth = 1.6;
        for (const x of [-86, -72, -58, -44, -32]) { ctx.beginPath(); ctx.moveTo(x - 1.5, -64); ctx.lineTo(x, -29); ctx.stroke(); }
        poly(ctx, [[-100, -68], [-21, -68], [-21, -63], [-100, -63]], '#ffb873');
        ctx.beginPath(); ctx.moveTo(-102, -67);
        ctx.bezierCurveTo(-96, -80, -82, -78, -74, -76); ctx.bezierCurveTo(-64, -86, -48, -82, -42, -77);
        ctx.bezierCurveTo(-34, -80, -22, -76, -19, -67); ctx.closePath();
        ctx.fillStyle = linear(ctx, 0, -86, 0, -66, [[0, '#ffffff'], [1, '#c9dbe4']]); ctx.fill();
        oval(ctx, -95, -40, 3, 4, lit ? '#ff4d4d' : '#9c2c2c');
        // Spinner throwing grit behind.
        for (let i = 0; i < 10; i++) { const a = (t * 2.2 + i / 10) % 1; oval(ctx, -100 - a * 40, -18 + a * a * 18 - Math.sin(i * 7) * 4, 1.2, 1.2, 'rgba(230,220,200,' + (1 - a) * .7 + ')'); }
        // Chassis rail and reflective stripe.
        ctx.fillStyle = '#272e34'; ctx.fillRect(-98, -28, 178, 9);
        // Exhaust stack.
        ctx.fillStyle = linear(ctx, -24, 0, -17, 0, [[0, '#8d969c'], [.5, '#f2f5f6'], [1, '#7c858b']]); ctx.fillRect(-24, -104, 6, 66);
        ctx.fillStyle = '#4b5359'; ctx.fillRect(-25, -106, 8, 4);
        // Cab.
        ctx.beginPath(); ctx.moveTo(-16, -24); ctx.lineTo(-16, -80); ctx.quadraticCurveTo(-16, -88, -8, -88);
        ctx.lineTo(20, -88); ctx.quadraticCurveTo(25, -88, 27, -83); ctx.lineTo(38, -60); ctx.lineTo(38, -24); ctx.closePath();
        ctx.fillStyle = orange; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-10, -60); ctx.lineTo(-10, -77); ctx.quadraticCurveTo(-10, -82, -5, -82); ctx.lineTo(18, -82); ctx.lineTo(29, -60); ctx.closePath();
        ctx.fillStyle = linear(ctx, -10, -82, 20, -60, [[0, '#173148'], [.55, '#2c5674'], [1, '#6c9fbd']]); ctx.fill();
        oval(ctx, 5, -70, 5, 5.5, '#10202c'); poly(ctx, [[-2, -60], [12, -60], [10, -65], [0, -65]], '#10202c');
        poly(ctx, [[-1, -74], [11, -74], [10, -77], [1, -77]], '#0c1a24');
        poly(ctx, [[2, -82], [10, -82], [-4, -60], [-9, -60]], 'rgba(255,255,255,.16)');
        ctx.strokeStyle = 'rgba(120,52,8,.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(-12, -57, 40, 30);
        ctx.fillStyle = '#5b2a07'; ctx.fillRect(20, -50, 6, 2);
        ctx.fillStyle = '#d5dade'; ctx.fillRect(-14, -24, 14, 3);
        ctx.fillStyle = 'rgba(255,244,205,.85)'; ctx.fillRect(-98, -37, 176, 3);
        ctx.fillStyle = 'rgba(120,52,8,.5)'; for (let x = -92; x < 74; x += 12) ctx.fillRect(x, -37, 6, 3);
        // Mirror.
        poly(ctx, [[36, -70], [46, -75]], null, '#2b3238', 1.6); ctx.fillStyle = '#2b3238'; ctx.fillRect(44, -84, 5, 16);
        // Roof light bar and snow cap.
        ctx.fillStyle = '#20262b'; ctx.fillRect(-12, -94, 30, 6);
        const flash = Math.sin(t * 9) > 0;
        for (const [x, on] of [[-6, flash], [12, !flash]]) {
            oval(ctx, x, -95, 4.5, 3.5, on ? '#ffd25a' : '#a66b14');
            if (on && lit) { ctx.save(); ctx.globalCompositeOperation = 'screen'; oval(ctx, x, -95, 34, 20, radial(ctx, x, -95, 0, 34, [[0, 'rgba(255,190,60,.55)'], [1, 'rgba(255,190,60,0)']])); ctx.restore(); }
        }
        ctx.beginPath(); ctx.moveTo(-18, -88); ctx.bezierCurveTo(-14, -96, -10, -93, -12, -94); ctx.lineTo(-17, -88); ctx.fillStyle = '#f3f8fa'; ctx.fill();
        // Hood and grille.
        ctx.beginPath(); ctx.moveTo(37, -24); ctx.lineTo(37, -58); ctx.lineTo(70, -52); ctx.quadraticCurveTo(76, -51, 76, -45); ctx.lineTo(76, -24); ctx.closePath(); ctx.fillStyle = orange; ctx.fill();
        poly(ctx, [[38, -58], [70, -52], [70, -55], [40, -61]], '#eef5f7');
        ctx.strokeStyle = 'rgba(110,50,10,.6)'; ctx.lineWidth = 1.2;
        for (const x of [46, 52, 58]) { ctx.beginPath(); ctx.moveTo(x, -48); ctx.lineTo(x + 6, -47); ctx.stroke(); }
        ctx.fillStyle = '#20272c'; ctx.fillRect(70, -46, 8, 20);
        ctx.fillStyle = '#aeb8be'; for (let y = -44; y < -27; y += 4) ctx.fillRect(71, y, 7, 1.6);
        oval(ctx, 74, -40, 3.6, 3.6, '#fff8de');
        if (lit) { ctx.save(); ctx.globalCompositeOperation = 'screen'; oval(ctx, 74, -40, 16, 16, radial(ctx, 74, -40, 0, 16, [[0, 'rgba(255,246,214,.9)'], [1, 'rgba(255,246,214,0)']])); ctx.restore(); }
        // Push frame, hydraulic ram and curved yellow moldboard.
        poly(ctx, [[76, -32], [96, -20]], null, '#353d44', 5); poly(ctx, [[76, -22], [96, -8]], null, '#353d44', 5);
        poly(ctx, [[70, -50], [96, -34]], null, '#c7cfd4', 3.2);
        const blade = (dx, dy) => { ctx.beginPath(); ctx.moveTo(94 + dx, -1 + dy); ctx.bezierCurveTo(90 + dx, -20 + dy, 90 + dx, -40 + dy, 100 + dx, -52 + dy);
            ctx.lineTo(108 + dx, -50 + dy); ctx.bezierCurveTo(99 + dx, -40 + dy, 99 + dx, -16 + dy, 108 + dx, -1 + dy); ctx.closePath(); };
        blade(-7, -5); ctx.fillStyle = '#b48a0c'; ctx.fill();
        poly(ctx, [[93, -6], [100, -52], [93, -57], [87, -10]], '#d9a714');
        blade(0, 0); ctx.fillStyle = linear(ctx, 90, 0, 110, 0, [[0, '#ffd84a'], [.6, '#f3b80f'], [1, '#b5850a']]); ctx.fill();
        poly(ctx, [[94, -3], [108, -3], [109, 1], [94, 1]], '#9aa6ae');
        for (const [x, y, top] of [[99, -52, -84], [93, -57, -88]]) { poly(ctx, [[x, y], [x + 2, top]], null, '#30383e', 1.3); oval(ctx, x + 2, top, 2.4, 2.4, '#ff8a2a'); }
        // Fenders and wheels with turning lugs and tread.
        for (const x of [-80, -50, 48]) {
            ctx.beginPath(); ctx.arc(x, -15, 21, Math.PI, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = '#1e2429'; ctx.stroke();
            oval(ctx, x, -15, 16, 16, '#161c20');
            const a = distance / 16;
            ctx.fillStyle = '#2a3237';
            for (let k = 0; k < 14; k++) { const q = a + k / 14 * Math.PI * 2; ctx.save(); ctx.translate(x + Math.cos(q) * 15, -15 + Math.sin(q) * 15); ctx.rotate(q); ctx.fillRect(-1.5, -2.4, 3, 4.8); ctx.restore(); }
            oval(ctx, x, -15, 9.5, 9.5, radial(ctx, x, -15, 1, 10, [[0, '#e3e9ec'], [.7, '#9aa7b0'], [1, '#5d6a73']], x - 3, -18));
            ctx.fillStyle = '#3f4a52';
            for (let k = 0; k < 6; k++) { const q = a + k / 6 * Math.PI * 2; oval(ctx, x + Math.cos(q) * 5.5, -15 + Math.sin(q) * 5.5, 1.3, 1.3, '#3f4a52'); }
            oval(ctx, x, -15, 2.6, 2.6, '#2b343b');
        }
    }
    // Snow rolling ahead of the blade and a curling spray ribbon thrown to the side.
    function drawPlowSnow(ctx, t) {
        ctx.beginPath(); ctx.moveTo(104, 2); ctx.bezierCurveTo(108, -30 - Math.sin(t * 3) * 2, 140, -30, 160, 2); ctx.closePath();
        ctx.fillStyle = linear(ctx, 0, -32, 0, 2, [[0, '#ffffff'], [.7, '#e3eef3'], [1, '#a9c3d1']]); ctx.fill();
        for (let i = 0; i < 9; i++) {
            const a = (t * .9 + i / 9) % 1, x = 112 + a * 42, y = -22 + Math.sin(a * Math.PI) * -6 + a * 20;
            oval(ctx, x, y, 3.2 + (i % 3), 2.6 + (i % 2), i % 2 ? '#ffffff' : '#dbe8ee');
        }
        for (let i = 0; i < 26; i++) {
            const a = (t * 1.4 + i / 26) % 1, spread = (i % 5) * 4;
            const x = 106 + a * (70 + spread), y = -46 - Math.sin(a * Math.PI) * (26 + spread) + a * 52;
            oval(ctx, x, y, 2.2 - a, 2.2 - a, 'rgba(255,255,255,' + (1 - a * .8) + ')');
        }
    }

    // Mongolian reindeer (цаа буга) in side view facing right. phase drives a rotary gallop.
    function drawReindeerBody(ctx, phase, moving, t) {
        const legDark = '#3d3128', sock = '#ece4d3';
        const pitch = moving ? Math.sin(phase) * .05 : Math.sin(t * 1.3) * .02;
        ctx.save(); ctx.rotate(pitch);
        function leg(hx, hy, off, fore, far) {
            const s = moving ? Math.sin(phase + off) : Math.sin(t * 1.6 + off) * .25, c = moving ? Math.cos(phase + off) : 0;
            let a1, a2, L1, L2;
            if (fore) { L1 = 24; L2 = 24; if (moving) { a1 = .25 + .72 * s; a2 = a1 - (c > 0 ? c * 1.7 : 0); } else { a1 = 1.05 + s * .4; a2 = a1 - 2.1; } }
            else { L1 = 30; L2 = 25; if (moving) { a1 = -.32 + .62 * s; a2 = a1 + .5 - (c > 0 ? c * 1.1 : 0); } else { a1 = -.95 + s * .3; a2 = a1 + .15; } }
            const k = [hx + Math.sin(a1) * L1, hy + Math.cos(a1) * L1], f = [k[0] + Math.sin(a2) * L2, k[1] + Math.cos(a2) * L2];
            const a3 = a2 + (fore ? .35 : .3), h = [f[0] + Math.sin(a3) * 8, f[1] + Math.cos(a3) * 8];
            const col = far ? '#2c231d' : legDark;
            poly(ctx, [[hx, hy - 6], k], null, far ? '#4a3b30' : '#6b5847', fore ? 12 : 15);
            poly(ctx, [k, f], null, col, fore ? 6 : 6.5);
            poly(ctx, [[k[0] + (f[0] - k[0]) * .7, k[1] + (f[1] - k[1]) * .7], f], null, far ? '#b8ae9c' : sock, 6.2);
            poly(ctx, [f, h], null, col, 5);
            ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-a3);
            poly(ctx, [[-5, -1], [6, -1], [7, 4], [-6, 4]], far ? '#15110e' : '#221a15'); ctx.restore();
        }
        leg(16, 4, 2.1, true, true); leg(-44, 0, 0, false, true);
        // Far antler, behind the head.
        antler(ctx, 5, -2, '#9c8a70', false);
        // Torso.
        ctx.beginPath(); ctx.moveTo(42, -4);
        ctx.bezierCurveTo(44, -18, 36, -30, 22, -34); ctx.bezierCurveTo(10, -38, -6, -32, -20, -31);
        ctx.bezierCurveTo(-34, -31, -46, -30, -52, -20); ctx.bezierCurveTo(-58, -10, -56, 4, -48, 10);
        ctx.bezierCurveTo(-40, 15, -28, 12, -18, 13); ctx.bezierCurveTo(-4, 16, 14, 18, 28, 14);
        ctx.bezierCurveTo(38, 10, 42, 4, 42, -4); ctx.closePath();
        ctx.fillStyle = linear(ctx, 0, -36, 0, 16, [[0, '#5a4a3c'], [.45, '#857160'], [.8, '#b6a38c'], [1, '#e4d9c6']]); ctx.fill();
        ctx.strokeStyle = 'rgba(220,235,255,.45)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(22, -34); ctx.bezierCurveTo(10, -38, -6, -32, -20, -31); ctx.bezierCurveTo(-34, -31, -46, -30, -52, -20); ctx.stroke();
        oval(ctx, -49, -9, 7, 11, 'rgba(236,228,212,.75)');
        ctx.beginPath(); ctx.moveTo(-52, -22); ctx.quadraticCurveTo(-63, -30, -61, -18); ctx.quadraticCurveTo(-58, -13, -52, -16); ctx.fillStyle = '#efe7d7'; ctx.fill();
        // Neck with a pale shaggy mane along the throat.
        ctx.beginPath(); ctx.moveTo(16, -31);
        ctx.bezierCurveTo(30, -46, 42, -58, 52, -66); ctx.lineTo(64, -56);
        ctx.bezierCurveTo(57, -44, 51, -26, 45, -6); ctx.bezierCurveTo(36, -12, 26, -22, 16, -31); ctx.closePath();
        ctx.fillStyle = linear(ctx, 30, -60, 50, -10, [[0, '#7a6754'], [.5, '#a8957f'], [1, '#d9cdb8']]); ctx.fill();
        ctx.beginPath(); ctx.moveTo(62, -54);
        const mane = [[58, -46], [56, -40], [53, -34], [51, -27], [48, -20], [46, -13], [44, -6]];
        let flip = 0;
        for (const [x, y] of mane) { const sway = moving ? Math.sin(phase * 2 + y) * 1.5 : Math.sin(t * 2 + y) * .8; ctx.lineTo(x - 9 + sway, y + 6); ctx.lineTo(x - (flip++ % 2 ? 1 : 3), y + 2); }
        ctx.lineTo(45, -8); ctx.lineTo(56, -48); ctx.closePath(); ctx.fillStyle = '#f2ebde'; ctx.fill();
        // Mongolian saddle over the shoulders: felt cloth, wooden frame, girth.
        ctx.beginPath(); ctx.moveTo(2, -35); ctx.quadraticCurveTo(18, -40, 34, -36); ctx.lineTo(37, -10); ctx.quadraticCurveTo(20, -4, 1, -10); ctx.closePath();
        ctx.fillStyle = '#1f5f9a'; ctx.fill(); ctx.strokeStyle = '#c8323c'; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.strokeStyle = '#f1c75b'; ctx.lineWidth = 1;
        for (let x = 6; x <= 30; x += 6) { ctx.beginPath(); ctx.moveTo(x, -18); ctx.lineTo(x + 3, -21); ctx.lineTo(x + 6, -18); ctx.lineTo(x + 3, -15); ctx.closePath(); ctx.stroke(); }
        poly(ctx, [[4, -10], [36, -12]], null, '#f1c75b', 1);
        poly(ctx, [[22, -36], [26, 10]], null, '#7a2a24', 4);
        ctx.beginPath(); ctx.moveTo(6, -37); ctx.quadraticCurveTo(4, -50, 9, -52); ctx.lineTo(12, -38); ctx.closePath(); ctx.fillStyle = '#8a5428'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(26, -38); ctx.quadraticCurveTo(28, -50, 33, -50); ctx.lineTo(32, -37); ctx.closePath(); ctx.fill();
        poly(ctx, [[8, -40], [30, -41], [30, -37], [8, -36]], '#6e3f1d');
        for (const x of [12, 20, 27]) oval(ctx, x, -39, 1.2, 1.2, '#f1c75b');
        // Head.
        ctx.beginPath(); ctx.moveTo(50, -66);
        ctx.bezierCurveTo(56, -72, 66, -70, 72, -64); ctx.bezierCurveTo(78, -60, 86, -56, 90, -52);
        ctx.bezierCurveTo(94, -49, 93, -43, 88, -42); ctx.bezierCurveTo(82, -40, 78, -42, 74, -42);
        ctx.bezierCurveTo(68, -44, 62, -48, 58, -50); ctx.bezierCurveTo(54, -54, 50, -60, 50, -66); ctx.closePath();
        ctx.fillStyle = linear(ctx, 50, -70, 90, -42, [[0, '#7d6a57'], [.6, '#a6937e'], [1, '#c9bba6']]); ctx.fill();
        oval(ctx, 84, -47, 8, 5.5, '#d8cebe'); oval(ctx, 90, -47.5, 1.8, 1.3, '#2b221c');
        poly(ctx, [[79, -42.5], [86, -43]], null, '#5a4a3e', 1);
        oval(ctx, 67, -60, 3.4, 2.8, '#e1d6c4'); oval(ctx, 67, -60, 2.4, 2.3, '#1a1310'); oval(ctx, 67.8, -60.8, .7, .7, '#ffffff');
        ctx.beginPath(); ctx.moveTo(55, -66); ctx.quadraticCurveTo(47, -79, 41, -73); ctx.quadraticCurveTo(47, -68, 55, -66); ctx.fillStyle = '#8f7b66'; ctx.fill();
        // Red halter with a lead rope and a small brass bell.
        ctx.strokeStyle = '#d0453b'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(80, -57); ctx.quadraticCurveTo(82, -50, 79, -42); ctx.moveTo(60, -65); ctx.quadraticCurveTo(66, -54, 62, -47); ctx.moveTo(62, -52); ctx.lineTo(80, -50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(78, -43); ctx.bezierCurveTo(70, -24, 48, -22, 33, -36); ctx.lineWidth = 1.2; ctx.strokeStyle = '#b8862f'; ctx.stroke();
        oval(ctx, 50, -14, 3, 3.4, '#e6b84f'); oval(ctx, 50, -12, 1, 1, '#7a5a1a');
        antler(ctx, 0, 0, '#e2d2b0', true);
        leg(24, 4, 1.6, true, false); leg(-36, 0, .5, false, false);
        ctx.restore();
    }
    function antler(ctx, dx, dy, color, shovel) {
        ctx.save(); ctx.translate(dx, dy); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
        const beam = [[56, -68], [50, -82], [46, -98], [48, -114], [56, -128], [67, -134]];
        for (let i = 0; i < beam.length - 1; i++) { ctx.lineWidth = 5.2 - i * .7; ctx.beginPath(); ctx.moveTo(...beam[i]); ctx.lineTo(...beam[i + 1]); ctx.stroke(); }
        const tine = (pts, w) => { ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); };
        tine([[49, -86], [59, -93], [65, -92]], 2.6);
        tine([[46, -104], [37, -110], [33, -119]], 2.4);
        tine([[56, -128], [54, -142]], 2); tine([[61, -131], [66, -146]], 2); tine([[66, -134], [77, -139]], 1.8);
        tine([[48, -114], [42, -124]], 1.8);
        if (shovel) { poly(ctx, [[55, -72], [62, -80], [70, -80], [77, -74], [74, -71], [70, -74], [67, -70], [62, -73]], color); }
        else tine([[55, -72], [64, -78], [70, -76]], 2.4);
        ctx.restore();
    }

    function drawSnowman(ctx, hatless) {
        oval(ctx, 0, 6, 54, 10, 'rgba(70,110,140,.35)');
        ctx.beginPath(); ctx.moveTo(-60, 8); ctx.bezierCurveTo(-40, -6, 40, -6, 62, 8); ctx.fillStyle = '#eef5f8'; ctx.fill();
        const ball = (y, r) => oval(ctx, 0, y, r, r * .96, radial(ctx, 0, y, r * .1, r, [[0, '#ffffff'], [.65, '#e8f1f5'], [1, '#a9c1cf']], -r * .35, y - r * .4));
        ball(-26, 35); ball(-77, 26); ball(-117, 19);
        // Stick arms with twigs.
        poly(ctx, [[-22, -88], [-50, -112], [-58, -132]], null, '#5d4636', 3.2); poly(ctx, [[-50, -112], [-66, -116]], null, '#5d4636', 2.2);
        poly(ctx, [[22, -86], [50, -98], [66, -94]], null, '#5d4636', 3.2); poly(ctx, [[50, -98], [58, -112]], null, '#5d4636', 2.2);
        // Striped scarf.
        ctx.beginPath(); ctx.moveTo(-20, -102); ctx.quadraticCurveTo(0, -94, 20, -102); ctx.lineTo(20, -94); ctx.quadraticCurveTo(0, -86, -20, -94); ctx.closePath(); ctx.fillStyle = '#c93c43'; ctx.fill();
        poly(ctx, [[8, -96], [18, -96], [22, -66], [12, -68]], '#c93c43');
        ctx.fillStyle = '#f5f0e6'; ctx.fillRect(13, -86, 7, 3); ctx.fillRect(14, -78, 7, 3);
        for (let x = 12; x < 23; x += 2.5) poly(ctx, [[x, -67], [x + .5, -62]], null, '#c93c43', 1.2);
        // Face: coal eyes, carrot, smile.
        oval(ctx, -7, -122, 2.4, 2.8, '#1f2d36'); oval(ctx, 7, -122, 2.4, 2.8, '#1f2d36');
        poly(ctx, [[0, -116], [24, -111], [0, -111]], '#e8873b');
        [-9, -5, 0, 5, 9].forEach((x, i) => oval(ctx, x, -106 + Math.abs(i - 2) * -1.4, 1.5, 1.5, '#1f2d36'));
        [-60, -44, -28].forEach(y => oval(ctx, 0, y, 3, 3, '#24343e'));
        if (!hatless) drawHat(ctx);
    }
    // Mongolian юүдэн малгай: funnel-shaped upturned brim, pointed silk crown with gold seams,
    // a red knot (жинс) on the tip and red tassels (залаа) down the back.
    function drawHat(ctx) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#d9333f'; ctx.lineWidth = 1.8;
        for (const dx of [9, 13, 17]) { ctx.beginPath(); ctx.moveTo(1, -176); ctx.quadraticCurveTo(dx, -164, dx + 5, -139); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-14, -137); ctx.quadraticCurveTo(-11, -160, 0, -178); ctx.quadraticCurveTo(11, -160, 14, -137); ctx.closePath();
        ctx.fillStyle = linear(ctx, -14, -178, 14, -137, [[0, '#3b8fe6'], [1, '#15468f']]); ctx.fill();
        ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = .9;
        for (const x of [-9, -4.5, 0, 4.5, 9]) { ctx.beginPath(); ctx.moveTo(x, -138); ctx.quadraticCurveTo(x * .45, -160, 0, -177); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-16, -129); ctx.lineTo(-27, -147); ctx.quadraticCurveTo(0, -137, 27, -147); ctx.lineTo(16, -129); ctx.quadraticCurveTo(0, -125, -16, -129); ctx.closePath();
        ctx.fillStyle = linear(ctx, 0, -147, 0, -127, [[0, '#30303a'], [1, '#111117']]); ctx.fill();
        ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-27, -147); ctx.quadraticCurveTo(0, -137, 27, -147); ctx.stroke();
        ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-21, -138); ctx.quadraticCurveTo(0, -131, 21, -138); ctx.stroke();
        oval(ctx, -15, -143, 7, 1.8, '#f5fafb'); oval(ctx, 13, -143.5, 5, 1.6, '#f5fafb');
        oval(ctx, 0, -180, 4.3, 4.3, '#d9333f'); oval(ctx, -1.2, -181.3, 1.3, 1.3, '#ff9a9a');
    }

    // Classic flying saucer, ported from the Tetris Arcade template: gun-metal disc that spins on its
    // axis, tinted glass dome, chasing green rim lights and a soft tractor beam.
    function drawSaucer(ctx, cx, cy, rx, time, spin, beam) {
        const K = .42, GREEN = '77,255,122', t = rx * .07;
        let ry = rx * K, g;
        if (beam > .01) {
            const r1 = rx * .28, r2 = rx * .8, L = rx * 2.6, by = cy + rx * .16;
            ctx.globalCompositeOperation = 'lighter';
            g = ctx.createLinearGradient(cx, by, cx, by + L);
            g.addColorStop(0, `rgba(${GREEN},${(.32 * beam * (.85 + .15 * Math.sin(time * 9))).toFixed(3)})`); g.addColorStop(1, `rgba(${GREEN},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - r1, by); ctx.lineTo(cx + r1, by); ctx.lineTo(cx + r2, by + L); ctx.lineTo(cx - r2, by + L); ctx.closePath(); ctx.fill();
            for (let i = 0; i < 3; i++) {
                const f = (time * .6 + i / 3) % 1, rr = r1 + (r2 - r1) * f;
                ctx.strokeStyle = `rgba(${GREEN},${(.45 * (1 - f) * beam).toFixed(3)})`; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(cx, by + L * f, rr, rr * K, 0, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        g = ctx.createLinearGradient(cx - rx * .6, 0, cx + rx * .6, 0); g.addColorStop(0, '#121418'); g.addColorStop(.55, '#3b4048'); g.addColorStop(1, '#14161a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + t + rx * .05, rx * .6, ry * .75, 0, 0, Math.PI); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const ug = ctx.createRadialGradient(cx, cy + rx * .15, 0, cx, cy + rx * .15, rx * .45);
        ug.addColorStop(0, `rgba(${GREEN},.55)`); ug.addColorStop(1, `rgba(${GREEN},0)`);
        ctx.fillStyle = ug; ctx.beginPath(); ctx.ellipse(cx, cy + rx * .15, rx * .45, ry * .45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
        g.addColorStop(0, '#1a1c20'); g.addColorStop(.35, '#5c626c'); g.addColorStop(.5, '#9aa2ad'); g.addColorStop(.7, '#4a4f58'); g.addColorStop(1, '#16181c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); ctx.ellipse(cx, cy + t, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
        g = ctx.createRadialGradient(cx - rx * .3, cy - ry * .5, rx * .05, cx, cy, rx);
        g.addColorStop(0, '#a7aeb8'); g.addColorStop(.45, '#545a63'); g.addColorStop(1, '#202328');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(200,210,220,.35)'; ctx.lineWidth = 1; ctx.stroke();
        const uy = cy - rx * .045;
        g = ctx.createRadialGradient(cx - rx * .2, uy - ry * .3, rx * .03, cx, uy, rx * .62);
        g.addColorStop(0, '#b9c0c9'); g.addColorStop(.6, '#5d636c'); g.addColorStop(1, '#2a2d33');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, uy, rx * .62, ry * .62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2 + spin, ca = Math.cos(a), sa = Math.sin(a);
            ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.moveTo(cx + ca * rx * .64, cy + sa * ry * .64); ctx.lineTo(cx + ca * rx * .98, cy + sa * ry * .98); ctx.stroke();
        }
        const dby = uy - rx * .02, drx = rx * .3, dry = drx * K, dh = rx * .26;
        g = ctx.createLinearGradient(cx, dby - dh, cx, dby + dry);
        g.addColorStop(0, 'rgba(70,140,100,.95)'); g.addColorStop(.6, 'rgba(18,48,34,.95)'); g.addColorStop(1, 'rgba(8,22,16,.95)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, dby, drx, dh, 0, Math.PI, Math.PI * 2); ctx.ellipse(cx, dby, drx, dry, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const dg = ctx.createRadialGradient(cx, dby - dh * .35, 0, cx, dby - dh * .35, drx);
        dg.addColorStop(0, `rgba(${GREEN},${(.35 + .15 * Math.sin(time * 2.4)).toFixed(3)})`); dg.addColorStop(1, `rgba(${GREEN},0)`);
        ctx.fillStyle = dg; ctx.fill();
        const on = Math.sin(time * 5) > .3, bg = ctx.createRadialGradient(cx, dby - dh, 0, cx, dby - dh, rx * .1);
        bg.addColorStop(0, `rgba(${GREEN},${on ? .95 : .2})`); bg.addColorStop(1, `rgba(${GREEN},0)`);
        ctx.fillStyle = bg; ctx.fillRect(cx - rx * .1, dby - dh - rx * .1, rx * .2, rx * .2);
        for (let i = 0; i < 18; i++) {
            const la = i / 18 * Math.PI * 2 + spin, ls = Math.sin(la);
            if (ls < -.1) continue;
            const lx = cx + Math.cos(la) * rx, ly = cy + t * .5 + ls * ry, lit = (i + Math.floor(time * 7)) % 3 === 0, q = Math.max(1.4, rx * .05);
            ctx.fillStyle = lit ? 'rgba(220,255,225,1)' : `rgba(${GREEN},.45)`; ctx.fillRect(lx - q / 2, ly - q / 2, q, q);
            if (lit) { const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, q * 4); lg.addColorStop(0, `rgba(${GREEN},.8)`); lg.addColorStop(1, `rgba(${GREEN},0)`); ctx.fillStyle = lg; ctx.fillRect(lx - q * 4, ly - q * 4, q * 8, q * 8); }
        }
        ctx.globalCompositeOperation = 'source-over';
    }
    // Red festive sleigh (чарга) with curled gold runners and a load of gifts; origin at the runner base.
    function drawSleigh(c, s) {
        c.save(); c.scale(s, s);
        oval(c, 4, 4, 92, 8, 'rgba(60,90,120,.35)');
        c.lineCap = 'round'; c.strokeStyle = '#e6b552'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(-78, 0); c.lineTo(62, 0); c.bezierCurveTo(88, 0, 96, -18, 84, -30); c.bezierCurveTo(76, -38, 66, -30, 72, -24); c.stroke();
        c.lineWidth = 3; for (const x of [-56, -12, 30]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 4, -16); c.stroke(); }
        c.beginPath(); c.moveTo(-82, -16); c.bezierCurveTo(-92, -40, -86, -66, -70, -70); c.lineTo(-64, -46); c.lineTo(36, -42);
        c.bezierCurveTo(52, -42, 62, -30, 58, -16); c.closePath();
        c.fillStyle = linear(c, 0, -70, 0, -16, [[0, '#e0464f'], [1, '#8f1f2a']]); c.fill();
        c.strokeStyle = '#f2c86a'; c.lineWidth = 2.4; c.stroke();
        c.lineWidth = 1.4; c.beginPath(); c.moveTo(-74, -30); c.bezierCurveTo(-40, -22, 10, -22, 50, -28); c.stroke();
        for (const x of [-50, -20, 10]) { c.beginPath(); c.arc(x, -32, 5, 0, Math.PI * 2); c.stroke(); }
        // Gifts stacked in the back.
        const gift = (x, y, w, h, col, rib) => { c.fillStyle = col; c.fillRect(x, y, w, h); c.fillStyle = rib; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h / 2 - 2, w, 4); c.beginPath(); c.ellipse(x + w / 2 - 5, y - 2, 5, 3, -.5, 0, Math.PI * 2); c.ellipse(x + w / 2 + 5, y - 2, 5, 3, .5, 0, Math.PI * 2); c.fill(); };
        gift(-70, -66, 26, 22, '#2f7fd0', '#ffd25a'); gift(-44, -60, 22, 18, '#2fa86a', '#f4f1ea'); gift(-62, -86, 20, 20, '#f2c86a', '#d9333f');
        // Snow on the rim and a hanging lantern.
        c.beginPath(); c.moveTo(-70, -70); c.bezierCurveTo(-66, -76, -56, -74, -50, -70); c.lineTo(-64, -68); c.closePath(); c.fillStyle = '#f2f8fb'; c.fill();
        c.strokeStyle = '#4b3a2c'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(50, -40); c.lineTo(60, -78); c.lineTo(72, -78); c.stroke();
        c.fillStyle = '#26323b'; c.fillRect(66, -76, 12, 4); c.fillStyle = '#ffcf73'; c.fillRect(67, -72, 10, 12); c.fillStyle = '#26323b'; c.fillRect(66, -60, 12, 3);
        c.restore();
        return [72 * s, -66 * s];
    }
    // Night valley behind the profile: snowy mountains, a steaming hot spring, a river that never
    // freezes, spruces along the edges and a bright snow field with a sleigh at the bottom.
    // `top`/`bottom` are where the profile cards start and end, so the hot spring and the sleigh stay in the open.
    function paintWinterValley(c, W, H, rnd, top, bottom) {
        const k = clamp(W / 1100, .62, 1), band = clamp(top - 8, 120, H * .6), ground = Math.min(H - 60, bottom + (H - bottom) * .38), strip = H - ground;
        c.fillStyle = linear(c, 0, 0, 0, band + 60, [[0, '#0a1f2d'], [1, '#17394e']]); c.fillRect(0, 0, W, H);
        c.fillStyle = '#ffffff';
        for (let i = 0; i < 90; i++) { c.globalAlpha = .25 + rnd() * .6; const r = rnd() * 1.3 + .3; c.fillRect(rnd() * W, rnd() * band * .8, r, r); }
        c.globalAlpha = 1;
        // Mountain range, taller on the right so the name on the left stays readable.
        const peaks = [];
        for (let x = -60; x < W + 80;) {
            const px = x + (60 + rnd() * 80) * k, lift = .4 + .8 * smooth((px / W - .25) / .6), ph = (60 + rnd() * 110) * k * lift;
            peaks.push([x, band - ph * .22], [px, band - ph]); x = px + (50 + rnd() * 70) * k;
        }
        c.beginPath(); c.moveTo(-60, band + 60); peaks.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W + 80, band + 60); c.closePath();
        c.fillStyle = linear(c, 0, band - 190 * k, 0, band + 60, [[0, '#2b4c63'], [1, '#132c3c']]); c.fill();
        for (let i = 1; i < peaks.length; i += 2) {
            const [px, py] = peaks[i], ch = (band - py) * .4, z = [];
            for (let j = 0; j <= 6; j++) z.push([px - ch * .75 + ch * 1.5 * j / 6, py + ch * (j % 2 ? .75 : 1) * (1 - Math.abs(j - 3) / 9)]);
            c.beginPath(); c.moveTo(px, py); z.slice().reverse().forEach(([x, y]) => c.lineTo(x, y)); c.closePath();
            c.fillStyle = linear(c, 0, py, 0, py + ch, [[0, '#d6e6ef'], [1, '#8eabbd']]); c.fill();
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + ch * .75, py + ch); c.lineTo(px + ch * .12, py + ch * .95); c.closePath(); c.fillStyle = 'rgba(30,58,82,.45)'; c.fill();
        }
        c.beginPath(); c.moveTo(0, band + 40);
        for (let x = 0; x <= W + 20; x += 20) c.lineTo(x, band - 22 * k - Math.sin(x * .006 + 1) * 14 * k - Math.sin(x * .017) * 6 * k);
        c.lineTo(W, band + 60); c.lineTo(0, band + 60); c.closePath(); c.fillStyle = '#1f4258'; c.fill();
        c.fillStyle = linear(c, 0, band, 0, ground, [[0, '#18384c'], [1, '#132c3c']]); c.fillRect(0, band + 40, W, ground - band - 40);
        // Bright snow field at the bottom with a distant tree line.
        for (let x = -10; x < W + 20; x += 16 * k) drawPine(c, x + rnd() * 8, ground + 4, (28 + rnd() * 26) * k, '#0f2a33', null);
        c.beginPath(); c.moveTo(0, ground);
        for (let x = 0; x <= W + 20; x += 18) c.lineTo(x, ground - Math.sin(x * .02) * 3 - Math.sin(x * .007) * 5);
        c.lineTo(W, H); c.lineTo(0, H); c.closePath();
        c.fillStyle = linear(c, 0, ground, 0, H, [[0, '#cddfea'], [1, '#eef5f9']]); c.fill();
        for (let i = 0; i < 7; i++) oval(c, rnd() * W, ground + 30 + rnd() * (H - ground - 40), 60 + rnd() * 90, 5 + rnd() * 5, 'rgba(110,150,180,.18)');
        // Unfrozen river from the hot spring down through the valley.
        const spring = { x: W * (W < 760 ? .8 : .86), y: band - 16 * k, rx: 66 * k, ry: 16 * k }, river = [];
        for (let i = 0; i <= 160; i++) {
            const t = i / 160, y = spring.y + t * (H + 30 - spring.y);
            river.push({ x: spring.x + (W * .38 - spring.x) * t + Math.sin(t * Math.PI * 3.2) * W * .14 * Math.sin(t * Math.PI), y, w: (8 + 38 * t * t) * k + (y > ground ? 10 * k : 0) });
        }
        for (let i = 0; i < river.length; i++) { const a = river[Math.max(0, i - 1)], b = river[Math.min(river.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; river[i].nx = -(b.y - a.y) / l; river[i].ny = (b.x - a.x) / l; river[i].tx = (b.x - a.x) / l; river[i].ty = (b.y - a.y) / l; }
        const side = (sgn, extra) => river.map(p => [p.x + p.nx * (p.w / 2 + extra) * sgn, p.y + p.ny * (p.w / 2 + extra) * sgn]);
        const bankL = side(1, 4 * k), bankR = side(-1, 4 * k);
        c.beginPath(); bankL.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); bankR.reverse().forEach(([x, y]) => c.lineTo(x, y)); c.closePath();
        c.fillStyle = 'rgba(215,232,242,.55)'; c.fill();
        const L = side(1, 0), R = side(-1, 0);
        c.beginPath(); L.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); R.reverse().forEach(([x, y]) => c.lineTo(x, y)); c.closePath();
        c.fillStyle = linear(c, 0, spring.y, 0, H, [[0, '#2b8f96'], [.4, '#13506a'], [1, '#1b5f78']]); c.fill();
        // Hot spring pool among snowy rocks, and its sign.
        oval(c, spring.x, spring.y, spring.rx + 10 * k, spring.ry + 7 * k, '#2c3d47');
        oval(c, spring.x, spring.y, spring.rx, spring.ry, radial(c, spring.x, spring.y, 2, spring.rx, [[0, '#8ff3e6'], [.6, '#3cb8b6'], [1, '#1d6f7d']]));
        for (let i = 0; i < 11; i++) {
            const a = Math.PI * 2 * i / 11 + .3, rx = (8 + rnd() * 6) * k, x = spring.x + Math.cos(a) * (spring.rx + 6 * k), y = spring.y + Math.sin(a) * (spring.ry + 5 * k);
            oval(c, x, y, rx, rx * .7, '#3b4c56'); oval(c, x - rx * .1, y - rx * .45, rx * .8, rx * .3, '#e6f0f5');
        }
        const sx = spring.x - spring.rx - 26 * k, sy = spring.y + 4 * k;
        c.fillStyle = '#5b4535'; c.fillRect(sx - 2 * k, sy - 34 * k, 4 * k, 36 * k);
        c.fillStyle = '#7a5a40'; c.fillRect(sx - 40 * k, sy - 46 * k, 80 * k, 16 * k);
        c.fillStyle = '#f2f8fb'; c.fillRect(sx - 41 * k, sy - 49 * k, 82 * k, 4 * k);
        c.fillStyle = '#ffe2a6'; c.font = `600 ${Math.round(8.5 * k + 1)}px ui-monospace, Menlo, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('♨ ХАЛУУН РАШААН', sx, sy - 37.5 * k);
        // Spruces along both edges, a small grove and a sleigh in the snow field.
        const lights = [];
        for (let y = band + 90; y < ground - 40; y += 150 + rnd() * 60) {
            drawPine(c, 14 + rnd() * 14, y, (90 + rnd() * 50) * k, '#123b33', '#e2eef4');
            drawPine(c, W - 14 - rnd() * 14, y + 60, (90 + rnd() * 50) * k, '#123b33', '#e2eef4');
        }
        const grove = W < 760 ? [[.08, 150], [.93, 140], [.72, 110]] : [[.04, 170], [.1, 130], [.66, 120], [.92, 165], [.97, 130]];
        for (const [gx, gh] of grove) {
            const x = W * gx, y = ground + 46 * k + rnd() * 10, h = gh * k;
            drawPine(c, x, y, h, '#123b33', '#f3f8fb');
            for (let j = 0; j < 14; j++) { const q = j / 14, yy = y - h * (.14 + q * .76), half = h * .3 * (1 - q * .75); lights.push([x + Math.sin(q * 22) * half, yy, j % 4]); }
            lights.push([x, y - h - 2, -1]);
        }
        const sleigh = { x: W * (W < 760 ? .3 : .2), y: ground + 62 * k, s: .85 * k };
        c.save(); c.translate(sleigh.x, sleigh.y); const lantern = drawSleigh(c, sleigh.s); c.restore();
        return { k, band, ground, strip, spring, river, lights, lantern: [sleigh.x + lantern[0], sleigh.y + lantern[1]] };
    }
    function drawPine(ctx, x, y, h, tone, snowy) {
        const w = h * .46, dark = tone || '#1f4a4f';
        ctx.fillStyle = '#3c2e26'; ctx.fillRect(x - h * .03, y - h * .12, h * .06, h * .14);
        for (let i = 0; i < 4; i++) {
            const top = y - h + i * h * .2, bottom = top + h * .38, r = w * (.38 + i * .2);
            ctx.beginPath(); ctx.moveTo(x, top);
            ctx.quadraticCurveTo(x + r * .4, top + h * .2, x + r, bottom); ctx.quadraticCurveTo(x, bottom - h * .05, x - r, bottom);
            ctx.quadraticCurveTo(x - r * .4, top + h * .2, x, top); ctx.fillStyle = dark; ctx.fill();
            if (snowy) {
                ctx.beginPath(); ctx.moveTo(x, top - 1);
                ctx.quadraticCurveTo(x + r * .4, top + h * .16, x + r * .92, bottom - h * .03);
                const bumps = 4;
                for (let b = bumps; b >= -bumps; b--) { const bx = x + r * .92 * b / bumps, by = bottom - h * .045 - (1 - Math.abs(b) / bumps) * h * .1; ctx.quadraticCurveTo(bx + r * .1, by + h * .05, bx, by); }
                ctx.quadraticCurveTo(x - r * .4, top + h * .16, x, top - 1);
                ctx.fillStyle = snowy; ctx.fill();
            }
        }
    }
    function drawGer(ctx, x, y, r) {
        ctx.fillStyle = '#d9e4e8'; ctx.fillRect(x - r, y - r * .62, r * 2, r * .62);
        ctx.strokeStyle = 'rgba(90,110,125,.5)'; ctx.lineWidth = .8;
        for (const yy of [.2, .42]) { ctx.beginPath(); ctx.moveTo(x - r, y - r * yy); ctx.lineTo(x + r, y - r * yy); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x - r * 1.08, y - r * .6); ctx.quadraticCurveTo(x - r * .5, y - r * 1.02, x - r * .16, y - r * 1.08);
        ctx.lineTo(x + r * .16, y - r * 1.08); ctx.quadraticCurveTo(x + r * .5, y - r * 1.02, x + r * 1.08, y - r * .6); ctx.closePath();
        ctx.fillStyle = '#f7fbfc'; ctx.fill();
        ctx.fillStyle = '#ffb347'; ctx.fillRect(x - r * .18, y - r * .46, r * .36, r * .46);
        ctx.fillStyle = '#c4572f'; ctx.fillRect(x - r * .22, y - r * .5, r * .44, r * .06);
        ctx.fillStyle = '#5c6870'; ctx.fillRect(x + r * .3, y - r * 1.3, r * .1, r * .3);
    }

    // Цасан өвгөн (Mongolian Grandfather Frost) in a blue deel: white-grey hair under a Mongolian
    // юүдэн малгай (upturned black brim, pointed blue silk crown, red knot and tassels), white beard, gold-trimmed collar and a front flap closing to his right side.
    function snowGrandpaSvg() {
        return `<svg class="ny-grandpa" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="sg-sky" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2a5a7c"/><stop offset="1" stop-color="#0c2335"/></radialGradient>
<linearGradient id="sg-deel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7fd6"/><stop offset="1" stop-color="#123f86"/></linearGradient>
<linearGradient id="sg-hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b8fe6"/><stop offset="1" stop-color="#15468f"/></linearGradient>
<radialGradient id="sg-face" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#ffdcc0"/><stop offset="1" stop-color="#eab08e"/></radialGradient>
<linearGradient id="sg-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfdde6"/></linearGradient>
<linearGradient id="sg-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3cfd8"/></linearGradient>
<linearGradient id="sg-brim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34343f"/><stop offset="1" stop-color="#101016"/></linearGradient>
<radialGradient id="sg-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e9fbff"/><stop offset=".35" stop-color="#9fe3ff" stop-opacity=".8"/><stop offset="1" stop-color="#9fe3ff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="200" height="200" fill="url(#sg-sky)"/>
<g fill="#ffffff" opacity=".75"><circle cx="24" cy="40" r="1.6"/><circle cx="170" cy="30" r="1.3"/><circle cx="184" cy="88" r="1.8"/><circle cx="14" cy="112" r="1.2"/><circle cx="160" cy="120" r="1.1"/><circle cx="60" cy="18" r="1.1"/></g>
<g class="sg-fig">
<g class="sg-staff"><path d="M30 204 L50 66" stroke="#c9d6df" stroke-width="5" stroke-linecap="round"/><path d="M30 204 L50 66" stroke="#7d8d99" stroke-width="1.6" stroke-linecap="round" transform="translate(1.6 0)"/>
<circle cx="51" cy="58" r="20" fill="url(#sg-glow)"/>
<g stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"><path d="M51 46 V70 M40.6 52 L61.4 64 M40.6 64 L61.4 52"/><path d="M51 46 l-3 -3 M51 46 l3 -3 M51 70 l-3 3 M51 70 l3 3" stroke-width="1.6"/></g></g>
<path d="M14 204 C16 166 44 140 78 134 L122 134 C156 140 184 166 186 204 Z" fill="url(#sg-deel)"/>
<path d="M150 150 C164 160 174 178 178 204" stroke="#0e3270" stroke-width="2" fill="none" opacity=".6"/>
<path d="M101 140 C88 150 72 154 62 162 C56 168 54 184 54 204" stroke="#f2c14e" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M101 140 C88 150 72 154 62 162 C56 168 54 184 54 204" stroke="#d9333f" stroke-width="2.6" fill="none" stroke-linecap="round" transform="translate(-4.5 1.5)"/>
<g fill="#ffd25a" stroke="#a67a1c" stroke-width="1"><circle cx="70" cy="157" r="3.6"/><circle cx="57" cy="178" r="3.6"/><circle cx="148" cy="150" r="3.2"/></g>
<g fill="#f2c14e" opacity=".9"><path d="M150 178 l6 -6 l6 6 l-6 6 Z"/><path d="M162 190 l5 -5 l5 5 l-5 5 Z"/><path d="M138 190 l5 -5 l5 5 l-5 5 Z"/></g>
<path d="M80 126 C88 132 112 132 120 126 L122 138 C110 144 90 144 78 138 Z" fill="#1d5fb8" stroke="#f2c14e" stroke-width="3"/>
<path d="M70 78 C56 90 52 114 56 136 C60 146 70 146 74 134 C76 118 75 98 76 84 Z" fill="url(#sg-hair)"/><path d="M130 78 C144 90 148 114 144 136 C140 146 130 146 126 134 C124 118 125 98 124 84 Z" fill="url(#sg-hair)"/>
<g stroke="#aebdc8" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"><path d="M64 92 C60 106 60 120 62 134 M70 90 C67 104 67 118 68 132 M136 92 C140 106 140 120 138 134 M130 90 C133 104 133 118 132 132"/></g>
<ellipse cx="100" cy="96" rx="27" ry="29" fill="url(#sg-face)"/>
<path d="M72 104 C70 128 78 152 92 166 C96 172 104 172 108 166 C122 152 130 128 128 104 C122 118 112 122 100 122 C88 122 78 118 72 104 Z" fill="url(#sg-fur)"/>
<g fill="#ffffff"><circle cx="80" cy="132" r="9"/><circle cx="120" cy="132" r="9"/><circle cx="88" cy="150" r="9"/><circle cx="112" cy="150" r="9"/><circle cx="100" cy="160" r="9"/><circle cx="100" cy="140" r="10"/></g>
<g fill="#ffffff"><circle cx="72" cy="112" r="7"/><circle cx="128" cy="112" r="7"/><circle cx="73" cy="124" r="8"/><circle cx="127" cy="124" r="8"/><circle cx="78" cy="142" r="8"/><circle cx="122" cy="142" r="8"/></g><g fill="#dfe9ef" opacity=".7"><circle cx="90" cy="162" r="4"/><circle cx="110" cy="162" r="4"/></g>
<circle cx="84" cy="104" r="7" fill="#f28c8c" opacity=".55"/><circle cx="116" cy="104" r="7" fill="#f28c8c" opacity=".55"/>
<path d="M84 96 Q90 91 96 96" stroke="#2b2230" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M104 96 Q110 91 116 96" stroke="#2b2230" stroke-width="2.6" fill="none" stroke-linecap="round"/>

<path d="M100 117 C92 108 78 109 72 118 C80 122 92 121 100 115 C108 121 120 122 128 118 C122 109 108 108 100 117 Z" fill="#ffffff" stroke="#dbe6ec" stroke-width="1"/>
<circle cx="100" cy="104" r="6.4" fill="#f09b86"/>
<path class="sg-tassel" d="M101 16 C114 22 128 32 142 52 M101 16 C116 26 126 40 134 62 M101 16 C112 30 118 44 122 64" stroke="#d9333f" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M77 68 C80 46 92 28 100 14 C108 28 120 46 123 68 Z" fill="url(#sg-hat)"/>
<g stroke="#f2c14e" stroke-width="1.3" fill="none" opacity=".9"><path d="M100 16 V66"/><path d="M99 17 C93 32 90 48 89 67"/><path d="M101 17 C107 32 110 48 111 67"/><path d="M98.5 17 C88 34 82 50 80 67"/><path d="M101.5 17 C112 34 118 50 120 67"/></g>
<path d="M70 84 L54 58 C76 68 124 68 146 58 L130 84 C116 79 84 79 70 84 Z" fill="url(#sg-brim)"/>
<path d="M54 58 C76 68 124 68 146 58" stroke="#f2c14e" stroke-width="3.2" fill="none" stroke-linecap="round"/>
<path d="M62 72 C80 78 120 78 138 72" stroke="#f2c14e" stroke-width="1.2" fill="none" opacity=".75"/>
<ellipse cx="72" cy="62" rx="9" ry="2.2" fill="#f5fafb" opacity=".9"/><ellipse cx="129" cy="62.5" rx="7" ry="2" fill="#f5fafb" opacity=".85"/>
<circle cx="100" cy="12" r="6.5" fill="#d9333f" stroke="#8f1f2a" stroke-width="1.2"/><circle cx="98.4" cy="10.4" r="1.8" fill="#ff9a9a"/>
<path d="M70 84 C66 88 66 94 70 98 C72 92 74 88 78 86 Z M130 84 C134 88 134 94 130 98 C128 92 126 88 122 86 Z" fill="#ffffff"/>
<path d="M79 90 C82 84 92 83 97 88 C91 87 85 88 79 90 Z M103 88 C108 83 118 84 121 90 C115 88 109 87 103 88 Z" fill="#ffffff" stroke="#c9d8e1" stroke-width=".8"/>
</g>
<g class="sg-flakes" fill="#ffffff"><circle cx="150" cy="58" r="2"/><circle cx="176" cy="150" r="2.2"/><circle cx="34" cy="146" r="1.8"/><circle cx="128" cy="12" r="1.6"/></g>
</svg>`;
    }
    // Profile introduction under the scene. Name shows the nickname only; email/phone stay blurred until hovered.
    function profileHtml(data) {
        const info = data.personalInfo || {}, name = info.nickname || String(info.name || '').split(/\s+/)[0];
        const loc = (info.location || []).join(', '), exp = data.experience || [];
        const starts = exp.map(e => parseInt(String((e.duration || {}).start || ''), 10)).filter(Number.isFinite);
        const years = starts.length ? new Date().getFullYear() - Math.min(...starts) : 0;
        const secret = (text, href, icon) => `<a class="ny-chip ny-secret" href="${esc(href)}">${icon} <span>${esc(text)}</span></a>`;
        const tags = list => (list || []).map(x => `<span>${esc(String(x).replace(/,\s*$/, ''))}</span>`).join('');
        const timeline = exp.map(e => { const d = e.duration || {}; return `<li><span class="ny-when">${esc(d.start)} — ${esc(d.end)}</span><b>${esc(e.role)}</b><em>${esc(e.company)}</em>${(e.description || []).map(x => `<p>${esc(x)}</p>`).join('')}</li>`; }).join('');
        const skills = Object.entries(data.workSkills || {}).map(([k, list]) => `<div class="ny-skill-row"><b>${esc(k)}</b><div class="ny-tags">${tags(list)}</div></div>`).join('');
        const projects = (data.projects || []).map(p => `<a class="ny-project" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="ny-picon">${esc(p.icon || '✦')}</span><b>${esc(p.name)}</b><p>${esc(p.description)}</p><div class="ny-tags">${tags(p.technologies)}</div></a>`).join('');
        const edu = (data.education || []).map(e => `<li><b>${esc(e.field)}</b><em>${esc(e.level)} · ${esc(e.date)}</em><p>${esc(e.institution)}</p></li>`).join('');
        const certs = (data.certifications || []).map(c => `<li><b>${esc(c.name)}</b><em>${esc(c.issuer)} · ${esc(c.date)}</em></li>`).join('');
        const langs = Object.entries(data.spokenLanguages || {}).map(([k, v]) => `<span>${esc(k)} · ${esc(v)}</span>`).join('');
        const summary = ((data.summary || {}).lines || []).join(' · ');
        const parts = String(info.name || '').trim().split(/\s+/).filter(Boolean), last = parts.length > 1 ? parts.pop() : '';
        const nameHtml = parts.length ? `<h2 class="ny-name" tabindex="0" aria-label="${esc(name)}"><span class="ny-name-nick" aria-hidden="true">${esc(name)}</span><span class="ny-name-full" aria-hidden="true">${esc(parts.join(' '))}${last ? ` <span class="ny-name-last">${esc(last)}</span>` : ''}</span></h2>` : `<h2>${esc(name)}</h2>`;
        return `<section class="ny-about" aria-label="Профайл танилцуулга"><canvas class="ny-herd ny-herd-back" aria-hidden="true"></canvas><div class="ny-about-inner">`
            + `<header class="ny-about-head"><div class="ny-avatar" role="img" aria-label="Цасан өвгөн — цэнхэр монгол дээлтэй">${snowGrandpaSvg()}</div><div><span class="ny-eyebrow">ТАНИЛЦУУЛГА · PROFILE</span>${nameHtml}<p class="ny-role">${esc(info.title)}</p>${summary ? `<p class="ny-summary">${esc(summary)}</p>` : ''}`
            + `<div class="ny-chips">${loc ? `<span class="ny-chip">⌖ ${esc(loc)}</span>` : ''}${years ? `<span class="ny-chip">❄ ${years}+ жил туршлага</span>` : ''}${info.email ? secret(info.email, 'mailto:' + info.email, '✉') : ''}${info.phone ? secret(info.phone, 'tel:' + String(info.phone).replace(/\s+/g, ''), '☎') : ''}</div></div></header>`
            + `<div class="ny-grid"><article class="ny-card ny-card-exp"><h3>Ажлын туршлага</h3><ol class="ny-timeline">${timeline}</ol></article>`
            + `<article class="ny-card ny-card-wide"><h3>Ур чадвар</h3>${skills}<div class="ny-skill-row"><b>languages</b><div class="ny-tags">${tags(data.programmingLanguages)}</div></div></article>`
            + `<article class="ny-card ny-card-projects"><h3>Төслүүд</h3><div class="ny-projects">${projects}</div></article>`
            + `<article class="ny-card"><h3>Боловсрол</h3><ul class="ny-list">${edu}</ul><h3>Сертификат</h3><ul class="ny-list">${certs}</ul></article>`
            + `<article class="ny-card"><h3>Хэл · Зан чанар</h3><div class="ny-tags">${langs}</div><div class="ny-tags ny-traits">${tags(data.profileTraits)}</div><h3>Хэрэгсэл</h3><div class="ny-tags">${tags(data.tools)}</div></article></div>`
            + `</div><canvas class="ny-herd ny-herd-front" aria-hidden="true"></canvas></section>`;
    }

    // Editor overlay: commands, numbers, effect names and hex colors get their own colors.
    function highlight(source, errorLine) {
        return source.split('\n').map((raw, i) => {
            const cut = raw.indexOf('//'), code = cut < 0 ? raw : raw.slice(0, cut), comment = cut < 0 ? '' : raw.slice(cut);
            let first = true;
            const html = code.split(/(\s+)/).map(tok => {
                if (!tok || /^\s+$/.test(tok)) return tok;
                const e = esc(tok);
                if (first) { first = false; return `<span class="k">${e}</span>`; }
                if (HEX.test(tok)) return `<span class="h" style="--c:${tok}">${e}</span>`;
                if (/^-?\d*\.?\d+$/.test(tok)) return `<span class="n">${e}</span>`;
                if (EFFECTS.includes(tok) || EFFECT_ALIASES[tok]) return `<span class="e">${e}</span>`;
                return `<span class="m">${e}</span>`;
            }).join('');
            const line = html + (comment ? `<span class="c">${esc(comment)}</span>` : '');
            return i + 1 === errorLine ? `<span class="err">${line || ' '}</span>` : line;
        }).join('\n') + '\n';
    }

    function render(data, root) {
        if (root._winterCleanup) root._winterCleanup();
        const info = data.personalInfo || {};
        const now = new Date(), year = now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0);
        const presetButtons = [['show', '✦ Бүтэн шоу'], ['tree', '✲ Сүлд мод'], ['salute', '✺ Ёслолын буудлага'], ['gold', '☼ Алтан гялбаа'], ['aurora', '✧ Туйлын туяа'], ['flag', '<i class="ny-flag-chip"></i> Монгол туг']];
        root.innerHTML = `<main class="ny-app"><header class="ny-header"><div class="ny-brand"><b>✳</b> WINTER / STUDIO</div><span class="ny-tag ny-year-tag">ШИНЭ ОН · ${year}</span></header><div class="ny-layout"><section class="ny-world" data-light-count="10000" data-projector-count="2" aria-label="Цасанд дарагдсан цэцэрлэг, хөдөлгөөнгүй 3D Эйфелийн цамхаг"><canvas class="ny-canvas" role="button" tabindex="0" aria-describedby="ny-flight-hint" aria-label="Тэнгэрт товшсон цэг рүү Монгол цаа буга давхина, цаа бугыг товшвол туурайнаас туйлын туяа цацарна. Цасан бөмбөгийн овоолгоос чирж бай руу шиднэ. Enter эсвэл сумтай товчоор цаа бугыг удирдана. Хөдөлгөөнгүй 3D Эйфелийн цамхаг, шинэ он хүртэлх тоолуур, цасан хүн, цас түрэгч машин"></canvas><div class="ny-intro"><span class="ny-eyebrow ny-year-eyebrow">ШИНЭ ОН ${year} · LIGHT SHOW</span><h1>Шинэ оны<br>гэрэлт үдэш.</h1><p>Эффектээ кодоор сольж,<br>тугаа мандуул.</p><p class="ny-flight-hint" id="ny-flight-hint">✧ Цаа бугыг товш · ❄ цасан бөмбөг чирж шид</p></div><div class="ny-scene-label"><span class="ny-show" aria-live="polite"></span><button class="ny-pause" type="button" aria-pressed="false">Ⅱ Түр зогсоох</button></div></section><aside class="ny-panel"><div class="ny-panel-top"><h2>Гэрлээр бүтээ.</h2><p>Эффектүүдээ дараалуулж бичээд<br>цамхгийн гэрлээ амилуулаарай.</p></div><div class="ny-presets">${presetButtons.map(([k, label]) => `<button type="button" data-preset="${k}">${label}</button>`).join('')}</div><div class="ny-music-bar"><button class="ny-mute" type="button" aria-label="Аяыг дуугүй болгох" aria-pressed="false">♪ Ая асаалттай</button><span class="ny-flight-state" aria-live="off">Монгол цаа буга · товшиж давхиулна</span></div><div class="ny-tab">● &nbsp; eiffel.lights <span style="float:right;color:#7896a0">LIVE EDITOR</span></div><div class="ny-editor"><div class="ny-lines" aria-hidden="true"></div><div class="ny-code-wrap"><pre class="ny-hl" aria-hidden="true"></pre><textarea class="ny-code" aria-label="Эйфелийн цамхгийн гэрлийн команд" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div></div><div class="ny-actions"><button type="button" class="ny-run">▶ &nbsp; Ажиллуулах <span style="opacity:.6"> / Ctrl + Enter</span></button><p class="ny-status" role="status" aria-live="polite"></p></div><details class="ny-help"><summary>Командын товч тайлбар</summary><code>effect tree salute flag</code> — эффектүүд дарааллаар (1–8)<br>&nbsp; tree · salute · gold · aurora · olympic · steady · twinkle · wave · pulse · chase · rainbow · flag<br><code>duration 8</code> — эффект бүрийн секунд (2–60)<br><code>loop on / off</code> — off үед сүүлийн эффект үлдэнэ<br><code>color #ffd58a #ef6f75</code> — өнгө, <code>color auto</code> — эффектийн өнгө<br><code>speed 0–5</code> · <code>brightness 0–2</code> · <code>snow 0–1</code><br><code>beams sweep / fan / still / follow / off</code> — оройн прожектор доош тусна<br><code>beamcolor #cfe8ff</code> — цацрагийн өнгө<br><code>//</code> — тайлбар. Preset сонгоход шууд ажиллана.</details></aside></div>${profileHtml(data)}</main>`;
        const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
        const editor = root.querySelector('textarea'), status = root.querySelector('.ny-status');
        const hl = root.querySelector('.ny-hl'), gutter = root.querySelector('.ny-lines'), showLabel = root.querySelector('.ny-show');
        let config = parse(presets.show), paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
        let width = 800, height = 650, time = 0, last = 0, frame, disposed = false, dirty = true, programStart = 0, errorLine = 0;
        const pauseButton = root.querySelector('.ny-pause');
        function syncPause() { pauseButton.textContent = paused ? '▶ Үргэлжлүүлэх' : 'Ⅱ Түр зогсоох'; pauseButton.setAttribute('aria-pressed', String(paused)); }
        syncPause();
        function paintEditor() {
            hl.innerHTML = highlight(editor.value, errorLine);
            gutter.innerHTML = editor.value.split('\n').map((_, i) => i + 1 === errorLine ? `<span class="err">${i + 1}</span>` : i + 1).join('\n');
            hl.scrollTop = gutter.scrollTop = editor.scrollTop; hl.scrollLeft = editor.scrollLeft;
        }
        let lastShowKey = '';
        function paintShow(state) {
            const key = config.effects.join() + state.step;
            if (key === lastShowKey) return;
            lastShowKey = key;
            const dots = config.effects.length > 1 ? config.effects.map((e, i) => `<i class="${i === state.step ? 'on' : i < state.step ? 'done' : ''}" title="${EFFECT_LABELS[e]}"></i>`).join('') : '';
            showLabel.innerHTML = `${dots}<b>${config.effects.length > 1 ? state.step + 1 + '/' + config.effects.length + ' · ' : ''}${EFFECT_LABELS[state.effect]}</b>`;
        }
        function run() {
            try {
                const next = parse(editor.value);
                config = next; programStart = time; dirty = true; errorLine = 0; resetShow();
                status.dataset.error = 'false';
                status.textContent = config.effects.length > 1
                    ? `✓ ${config.effects.map(e => EFFECT_LABELS[e]).join(' → ')} · ${config.duration}с${config.loop ? ' · давтана' : ''}`
                    : `✓ ${EFFECT_LABELS[config.effects[0]]}`;
                try { localStorage.setItem(STORAGE_KEY, editor.value); } catch (_) {}
            } catch (e) { status.dataset.error = 'true'; status.textContent = e.message; errorLine = e.line || 0; }
            paintEditor();
        }
        editor.value = presets.show;
        try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { parse(saved); editor.value = saved; } } catch (_) {}
        editor.addEventListener('input', () => { if (errorLine) errorLine = 0; paintEditor(); });
        editor.addEventListener('scroll', () => { hl.scrollTop = gutter.scrollTop = editor.scrollTop; hl.scrollLeft = editor.scrollLeft; });
        editor.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
            else if (e.key === 'Tab' && !e.shiftKey && !e.altKey) {
                e.preventDefault(); const s = editor.selectionStart;
                editor.setRangeText('  ', s, editor.selectionEnd, 'end'); paintEditor();
            }
        });
        root.querySelector('.ny-run').addEventListener('click', run);
        root.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { editor.value = presets[b.dataset.preset]; run(); }));
        pauseButton.addEventListener('click', () => {
            paused = !paused; dirty = true; syncPause();
            if (paused) { music.stop(); if (deer.moving) updateFlightLabel('Цаа буга ба ая түр зогслоо'); }
            else if (deer.moving) music.start();
        });
        if (!ctx) { status.textContent = 'Энэ хөтөч Canvas дүрслэл дэмжихгүй байна.'; return; }
        const music = createSkyMusic(), sfx = createSfx();
        const deer = { x: 0, y: 0, initialized: false, moving: false, auto: false, elapsed: 0, duration: 0, facing: -1, from: null, target: null, idle: 0, nextWander: 1.4, alpha: 1, vanish: 0, hiddenFor: 0 };
        const musicState = root.querySelector('.ny-flight-state'), muteButton = root.querySelector('.ny-mute');
        let muted = false, rhythm = null, lastBeatLabel = '', pointerStart = null, aiming = null, skyTop = 120;
        function updateFlightLabel(text) { if (text !== lastBeatLabel) { musicState.textContent = text; lastBeatLabel = text; } }
        function finishFlight() {
            const user = !deer.auto;
            deer.moving = false; deer.auto = false; deer.idle = 0; rhythm = null; dirty = true;
            if (user) { music.stop(); updateFlightLabel('Цаа буга очлоо · гэрэл таны тохиргоонд буцлаа'); }
        }
        const deerScale = () => Math.max(.5, Math.min(.82, width / 950));
        function flyTo(x, y, auto, fast) {
            const sc = deerScale(), marginX = 80 * sc, top = Math.max(110 * sc, skyTop + 125 * sc + 40);
            const target = { x: clamp(x, marginX, width - marginX), y: clamp(y, top, auto ? Math.max(top + 10, height * .5) : height - 150) };
            const distance = Math.hypot(target.x - deer.x, target.y - deer.y);
            if (distance < 8) return false;
            deer.from = { x: deer.x, y: deer.y }; deer.target = target; deer.elapsed = 0; deer.auto = auto;
            deer.duration = auto ? (fast ? clamp(distance / 300, .9, 2.4) : clamp(distance / 75, 2.4, 6)) : clamp(distance / 95, 2.4, 8);
            deer.facing = target.x >= deer.x ? 1 : -1; deer.moving = true; dirty = true;
            return true;
        }
        function startFlight(x, y) {
            // Paused/reduced-motion views wait for an explicit resume before moving or playing.
            if (paused) { updateFlightLabel('Давхиулахын өмнө «Үргэлжлүүлэх» дарна уу.'); return; }
            if (deer.vanish) { updateFlightLabel('Цаа буга туйлын туяанд уусчээ · удахгүй эргэж ирнэ'); return; }
            if (!flyTo(x, y, false)) { updateFlightLabel('Өөр цэг товшоод цаа бугаа давхиулаарай.'); return; }
            music.start();
        }
        // Left alone, the reindeer never hangs still for long: it drifts to a nearby spot of sky.
        function wander(fast) {
            for (let k = 0; k < 8; k++) {
                const a = random() * Math.PI * 2, d = (fast ? 240 : 110) + random() * 200;
                if (flyTo(deer.x + Math.cos(a) * d, deer.y + Math.sin(a) * d * .45, true, fast)) return;
            }
        }
        // Clicking the reindeer: bells and a shimmer, aurora sprays from its hooves and it melts away,
        // then it reappears somewhere else in the sky.
        const hoofAurora = [];
        let auroraBoost = 0;
        function deerHooves() { const sc = deerScale(), f = deer.facing; return [[deer.x + f * 14 * sc, deer.y + 60 * sc], [deer.x - f * 50 * sc, deer.y + 56 * sc]]; }
        function sprayAurora(points, count) {
            const pal = PALETTES.aurora;
            for (const [hx, hy] of points) for (let i = 0; i < count; i++) {
                const a = Math.PI * (.1 + random() * .8), v = (50 + random() * 160) * S;
                hoofAurora.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .55, life: 0, max: 2 + random() * 1.8, len: (22 + random() * 50) * S, w: (1.4 + random() * 3) * S, color: pal[i % pal.length] });
            }
            if (hoofAurora.length > 500) hoofAurora.splice(0, hoofAurora.length - 500);
        }
        function deerMagic() {
            sfx.bells(); sfx.shimmer();
            sprayAurora(deerHooves(), 48);
            auroraBoost = 1;
            if (deer.moving && !deer.auto) music.stop();
            deer.moving = false; deer.auto = false; rhythm = null;
            deer.vanish = 1; deer.hiddenFor = 2.2; dirty = true;
            updateFlightLabel('✧ Цаа буга туйлын туяанд ууслаа…');
        }
        function canvasPoint(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * width / r.width, y: (e.clientY - r.top) * height / r.height }; }
        const onPile = p => !!pile && Math.hypot(p.x - pile.x, p.y - pile.y) < pile.r + 16;
        function onDeer(p) { if (deer.vanish) return false; const sc = deerScale(); return Math.abs(p.x - deer.x) < 66 * sc && p.y > deer.y - 105 * sc && p.y < deer.y + 66 * sc; }
        root.addEventListener('pointerdown', () => sfx.unlock());
        canvas.addEventListener('pointerdown', e => {
            if (!e.isPrimary || e.button !== 0) return;
            const p = canvasPoint(e);
            if (!paused && onPile(p)) {
                aiming = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y };
                try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
                canvas.style.cursor = 'grabbing'; dirty = true; return;
            }
            pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
        });
        canvas.addEventListener('pointermove', e => {
            const p = canvasPoint(e);
            if (aiming && e.pointerId === aiming.id) { aiming.x = p.x; aiming.y = p.y; dirty = true; return; }
            if (e.pointerType === 'mouse') canvas.style.cursor = onPile(p) ? 'grab' : onDeer(p) ? 'pointer' : '';
        });
        canvas.addEventListener('pointercancel', () => { pointerStart = null; aiming = null; canvas.style.cursor = ''; });
        canvas.addEventListener('pointerup', e => {
            if (aiming && e.pointerId === aiming.id) { throwBall(aiming); aiming = null; canvas.style.cursor = ''; return; }
            const start = pointerStart; pointerStart = null;
            if (!start || start.id !== e.pointerId || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
            const p = canvasPoint(e);
            if (!paused && onDeer(p)) deerMagic(); else startFlight(p.x, p.y);
        });
        // A touch that starts on the snowball pile aims the throw instead of scrolling the page.
        canvas.addEventListener('touchstart', e => {
            const t = e.touches[0];
            if (t && !paused && onPile(canvasPoint(t))) e.preventDefault();
        }, { passive: false });
        canvas.addEventListener('keydown', e => {
            const directions = { ArrowLeft: [-110, 0], ArrowRight: [110, 0], ArrowUp: [0, -90], ArrowDown: [0, 90] };
            if (directions[e.key]) { e.preventDefault(); const [x, y] = directions[e.key]; startFlight(deer.x + x, deer.y + y); }
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startFlight(deer.x < width / 2 ? width * .8 : width * .2, height * .42); }
            if ((e.key === 'b' || e.key === 'B') && !paused) { e.preventDefault(); sfx.unlock(); throwBall(null); }
        });
        muteButton.addEventListener('click', () => {
            muted = !muted; music.mute(muted); sfx.mute(muted); muteButton.setAttribute('aria-pressed', String(muted));
            muteButton.textContent = muted ? '♫ Дуугүй' : '♪ Ая асаалттай';
            if (deer.moving && !deer.auto && !paused && !document.hidden && !muted) music.start();
        });
        function visibilityChanged() {
            if (document.hidden) music.stop();
            else if (deer.moving && !deer.auto && !paused) music.start();
            dirty = true;
        }
        document.addEventListener('visibilitychange', visibilityChanged);
        function updateDeer(dt) {
            if (deer.vanish) {
                deer.hiddenFor -= dt;
                if (deer.vanish === 1) {
                    deer.alpha = Math.max(0, deer.alpha - dt * 2.4);
                    if (deer.hiddenFor <= 0) {
                        deer.vanish = 2; deer.alpha = 0;
                        deer.x = width * (random() < .5 ? .14 + random() * .2 : .66 + random() * .2);
                        deer.y = clamp(skyTop + 110 * deerScale() + random() * height * .18, skyTop + 100, height * .5);
                        deer.facing = deer.x < width / 2 ? 1 : -1;
                        sprayAurora([[deer.x, deer.y + 20 * deerScale()]], 30);
                        updateFlightLabel('✧ Цаа буга эргэн ирлээ · дахин товшоорой');
                    }
                } else {
                    deer.alpha = Math.min(1, deer.alpha + dt * 1.6);
                    if (deer.alpha >= 1) { deer.vanish = 0; deer.idle = 0; }
                }
                return;
            }
            if (!deer.moving) {
                rhythm = null; deer.idle += dt;
                if (deer.idle > deer.nextWander) { deer.idle = 0; deer.nextWander = 1 + random() * 2.2; wander(false); }
                return;
            }
            deer.elapsed += dt;
            const progress = Math.min(1, deer.elapsed / deer.duration);
            const position = flightPosition(deer.from, deer.target, progress);
            deer.x = position.x; deer.y = position.y;
            if (!deer.auto) {
                music.update();
                const beat = music.beat ?? deer.elapsed * SKY_BPM / 60;
                rhythm = { ...beatStyle(beat), beat };
                updateFlightLabel(`${muted || !music.playing ? '♫ Дуугүй' : '♪ Jingle Bells'} · ${rhythm.effect.toUpperCase()} · Цаа буга давхиж байна`);
            } else rhythm = null;
            if (progress >= 1) finishFlight();
        }

        /* ---------- Scene layers ---------- */
        const model = createTowerModel();
        let ratio = 1, S = 1, G = 0, mobile = false, roadTop = 0, roadBottom = 0;
        let back, front, tower, flagTex, pole, pile, board, snowman = { x: 0, y: 0, s: 1 };
        let stars = [], gers = [], decor = [], fenceLights = [], lanterns = [];
        let seed = 31;
        const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const flakes = Array.from({ length: 320 }, () => ({ x: random(), y: random(), r: random() * 1.8 + .45, speed: random() * .05 + .025, drift: random() * 6 }));
        const offscreen = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
        function layer() { const c = offscreen(width * ratio, height * ratio), x = c.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0); return [c, x]; }
        function ridge(x, y, amp, freq, top, bottom, k) {
            x.beginPath(); x.moveTo(0, G + 20);
            for (let px = 0; px <= width + 8; px += 8) x.lineTo(px, y - amp * (.55 + .3 * Math.sin(px * freq + k * 2) + .15 * Math.sin(px * freq * 3.1 + k)));
            x.lineTo(width + 8, G + 20); x.closePath();
            x.fillStyle = linear(x, 0, y - amp, 0, y + amp * .6, [[0, top], [1, bottom]]); x.fill();
        }
        function paintBack() {
            const [c, x] = layer(), w = width, h = height; back = c; seed = 77;
            x.fillStyle = linear(x, 0, 0, 0, G, [[0, '#040d19'], [.45, '#0b2236'], [.82, '#21445d'], [1, '#476a82']]); x.fillRect(0, 0, w, h);
            const mx = w * (mobile ? .9 : .85), my = h * (mobile ? .22 : .12);
            x.fillStyle = radial(x, mx, my, 0, 170, [[0, 'rgba(232,228,190,.2)'], [1, 'rgba(232,228,190,0)']]); x.fillRect(0, 0, w, h);
            oval(x, mx, my, 19, 19, radial(x, mx, my, 2, 19, [[0, '#fdf8e0'], [1, '#e1d8b0']], mx - 6, my - 6));
            oval(x, mx + 5, my - 4, 3.6, 3, 'rgba(170,160,120,.32)'); oval(x, mx - 6, my + 6, 2.6, 2.2, 'rgba(170,160,120,.28)'); oval(x, mx + 3, my + 8, 1.8, 1.6, 'rgba(170,160,120,.25)');
            stars = Array.from({ length: 150 }, () => ({ x: random() * w, y: random() * (G - 150 * S), r: random() * 1.1 + .3, p: random() * 6.3 }));
            ridge(x, G - 118 * S, 70 * S, .0042, '#c5d8e2', '#2c4c62', 1);
            ridge(x, G - 66 * S, 44 * S, .0071, '#dbe8ee', '#46687d', 2.4);
            for (let i = 0, n = Math.ceil(w / (30 * S)) + 2; i < n; i++) drawPine(x, i * 30 * S - 10 + random() * 12, G - 4 + random() * 6, (46 + random() * 34) * S, '#1d434b', '#dce8ee');
            // Snowy hill with a small ger camp on each side, in front of the far forest.
            x.beginPath(); x.moveTo(0, G); x.bezierCurveTo(w * .1, G - 46 * S, w * .26, G - 36 * S, w * .4, G - 4);
            x.lineTo(w * .62, G - 4); x.bezierCurveTo(w * .76, G - 40 * S, w * .9, G - 48 * S, w, G - 20 * S); x.lineTo(w, G + 10); x.lineTo(0, G + 10); x.closePath();
            x.fillStyle = linear(x, 0, G - 48 * S, 0, G, [[0, '#e6eff4'], [1, '#b3cad6']]); x.fill();
            gers = [];
            const camp = mobile ? [[.07, 9], [.16, 7]] : [[.06, 12], [.13, 9], [.86, 11], [.93, 8.5]];
            for (const [px, r] of camp) {
                const gx = w * px, gy = G - (px < .5 ? 30 : 34) * S, rr = r * S * 1.2;
                oval(x, gx, gy + 1, rr * 1.5, rr * .22, 'rgba(90,120,140,.25)');
                drawGer(x, gx, gy, rr); gers.push([gx + rr * .35, gy - rr * 1.3]);
            }
            for (let i = 0, n = Math.ceil(w / (52 * S)) + 2; i < n; i++) {
                const px = i * 52 * S + random() * 22, ph = (70 + random() * 46) * S;
                if (camp.some(([cx2]) => Math.abs(px - w * cx2) < 34 * S)) continue;
                drawPine(x, px, G + 6 + random() * 6, ph, '#123238', '#eef5f8');
            }
            x.beginPath(); x.moveTo(0, G + 8);
            for (let px = 0; px <= w + 20; px += 20) x.lineTo(px, G + 8 - Math.sin(px * .013) * 5 - Math.sin(px * .031) * 3);
            x.lineTo(w, h); x.lineTo(0, h); x.closePath();
            x.fillStyle = linear(x, 0, G, 0, h, [[0, '#d7e5ed'], [.25, '#ebf3f6'], [1, '#f7fbfc']]); x.fill();
            for (let i = 0; i < 9; i++) oval(x, random() * w, G + 30 + random() * (roadTop - G - 40), 60 + random() * 90, 6 + random() * 6, 'rgba(120,160,190,.12)');
        }
        function paintFront() {
            const [c, x] = layer(), w = width, h = height; front = c; seed = 191;
            const gate0 = tower.cx - .14 * tower.size, gate1 = tower.cx + .14 * tower.size, fy = G + 16, ph = 34 * S;
            fenceLights = []; lanterns = [];
            // Wooden picket fence with snow on every cap and rail, open at the tower gate.
            const posts = [];
            for (let px = -12; px < w + 30; px += 30 * S) if (px < gate0 - 8 || px > gate1 + 8) posts.push(px);
            for (const [a, b] of [[-20, gate0 - 6], [gate1 + 6, w + 20]]) {
                for (const ry of [fy - ph * .72, fy - ph * .32]) { x.fillStyle = '#5e4a3e'; x.fillRect(a, ry, b - a, 4 * S); x.fillStyle = '#f4f9fa'; x.fillRect(a, ry - 2.5 * S, b - a, 3 * S); }
            }
            for (const px of posts) {
                poly(x, [[px - 3.5 * S, fy], [px - 3.5 * S, fy - ph], [px, fy - ph - 5 * S], [px + 3.5 * S, fy - ph], [px + 3.5 * S, fy]], '#6d5646');
                x.beginPath(); x.ellipse(px, fy - ph - 3 * S, 5.5 * S, 3.6 * S, 0, 0, Math.PI * 2); x.fillStyle = '#f7fbfc'; x.fill();
            }
            for (let i = 0; i < posts.length - 1; i++) {
                if (posts[i + 1] - posts[i] > 40 * S) continue;
                for (let k = 1; k <= 2; k++) { const t2 = k / 3, sag = Math.sin(t2 * Math.PI) * 6 * S; fenceLights.push([posts[i] + (posts[i + 1] - posts[i]) * t2, fy - ph + 2 + sag, (i * 2 + k) % 4]); }
            }
            // Stone gate pillars with lanterns.
            for (const gx of [gate0, gate1]) {
                x.fillStyle = linear(x, gx - 8 * S, 0, gx + 8 * S, 0, [[0, '#7b8a92'], [1, '#52626b']]); x.fillRect(gx - 7 * S, fy - ph * 1.35, 14 * S, ph * 1.35);
                x.fillStyle = '#f5f9fa'; x.fillRect(gx - 9 * S, fy - ph * 1.35 - 4 * S, 18 * S, 5 * S); oval(x, gx, fy - ph * 1.35 - 4 * S, 9 * S, 4 * S, '#f5f9fa');
                x.fillStyle = '#26343c'; x.fillRect(gx - 4 * S, fy - ph * 1.35 - 18 * S, 8 * S, 12 * S);
                lanterns.push([gx, fy - ph * 1.35 - 12 * S]);
            }
            // Drift burying the fence base.
            x.beginPath(); x.moveTo(-10, fy - 6 * S);
            for (let px = 0; px <= w + 20; px += 16) x.lineTo(px, fy - 5 * S - Math.sin(px * .05) * 3 * S - Math.sin(px * .017) * 4 * S);
            x.lineTo(w + 20, fy + 14 * S); x.lineTo(-10, fy + 14 * S); x.closePath(); x.fillStyle = '#eef5f8'; x.fill();
            // Snow-heavy bushes.
            for (const px of (mobile ? [.04] : [.03, .12, .3, .76, .99])) {
                const bx = w * px, by = G + 30 * S, r = (26 + random() * 10) * S;
                oval(x, bx, by, r * 1.3, r * .75, '#284a4c'); oval(x, bx - r * .5, by - r * .25, r * .6, r * .45, '#2f5455');
                x.beginPath(); x.moveTo(bx - r * 1.35, by - r * .05);
                for (let k = 0; k <= 8; k++) { const q = k / 8, xx = bx - r * 1.35 + q * r * 2.7, yy = by - r * .62 - Math.sin(q * Math.PI) * r * .45; x.quadraticCurveTo(xx - r * .17, yy - r * .22, xx, yy + (k % 2 ? r * .12 : 0)); }
                x.lineTo(bx + r * 1.3, by); x.closePath(); x.fillStyle = '#f4f9fb'; x.fill();
                oval(x, bx, by + r * .6, r * 1.5, r * .25, 'rgba(110,150,180,.2)');
            }
            // Two small decorated pines with their light positions.
            decor = [];
            for (const px of (mobile ? [.035] : [.05, .34])) {
                const tx = w * px, ty = G + 44 * S, th = 96 * S;
                drawPine(x, tx, ty, th, '#1a4a3a', '#f2f8fa');
                for (let k = 0; k < 30; k++) { const q = k / 30, yy = ty - th * (.12 + q * .8), half = th * .46 * (.38 + (1 - q) * .6) * .78; decor.push([tx + Math.sin(q * 26) * half, yy + Math.cos(q * 26) * 2, k % 5]); }
                decor.push([tx, ty - th - 2, -1]);
            }
            // Snowman.
            snowman = { x: w * (mobile ? .17 : w < 760 ? .13 : .2), y: G + 52 * S, s: clamp(width / 820, .48, .86) };
            // Snowball pile beside the snowman and a wooden target board on the right.
            pile = { x: snowman.x + 72 * snowman.s + 14 * S, y: G + 68 * S, r: 15 * Math.max(S, .7) };
            // Mongolian archery target (сур): a low wall of leather cylinders, the middle ones red.
            const ts = Math.max(S, .75), cols = 12, rows = 3, cw = 9 * ts, ch = 10 * ts;
            board = { x: w * (mobile ? .84 : .88), ground: G + 72 * S, cols, rows, cw, ch, w: cols * cw, h: rows * ch, slots: Array.from({ length: cols * rows }, () => ({ on: true, pop: 1 })), colWait: new Array(cols).fill(0) };
            board.x0 = board.x - board.w / 2; board.y0 = board.ground - board.h; board.y = board.y0 + board.h / 2;
            oval(x, pile.x, pile.y + 4, pile.r * 2.1, pile.r * .5, 'rgba(90,130,160,.3)');
            for (const [dx, dy] of [[-1.1, 0], [0, 0], [1.1, 0], [-.55, -.9], [.55, -.9], [0, -1.8]]) {
                const bx = pile.x + dx * pile.r * .9, by = pile.y - pile.r * .45 + dy * pile.r * .82, r = pile.r * .55;
                oval(x, bx, by, r, r, radial(x, bx, by, r * .1, r, [[0, '#ffffff'], [.7, '#e3eef3'], [1, '#a9c3d2']], bx - r * .35, by - r * .4));
            }
            // Foreground bank under the road.
            x.beginPath(); x.moveTo(0, roadBottom + 4);
            for (let px = 0; px <= w + 20; px += 18) x.lineTo(px, roadBottom + 4 + Math.sin(px * .04) * 2.5);
            x.lineTo(w, h); x.lineTo(0, h); x.closePath();
            x.fillStyle = linear(x, 0, roadBottom, 0, h, [[0, '#e9f2f6'], [1, '#ffffff']]); x.fill();
            x.beginPath(); x.moveTo(0, roadTop - 3);
            for (let px = 0; px <= w + 20; px += 18) x.lineTo(px, roadTop - 3 - Math.sin(px * .05 + 1) * 2);
            x.lineTo(w, roadTop + 2); x.lineTo(0, roadTop + 2); x.closePath(); x.fillStyle = '#f3f8fa'; x.fill();
        }

        /* ---------- Tower ---------- */
        function prepareTower() {
            const cx = width * (mobile ? .64 : .6), base = G + 14, size = Math.min(width * (mobile ? .98 : 1), height * (mobile ? .54 : .6));
            const D = 2.4, camY = .22, yaw = .36, ca = Math.cos(yaw), sa = Math.sin(yaw), k = size * D;
            const project = p => { const xr = p[0] * ca - p[2] * sa, zr = p[0] * sa + p[2] * ca, Z = D - zr; return { x: cx + k * xr / Z, y: base - k * ((p[1] - camY) / Z + camY / D), depth: zr, y3: p[1] }; };
            const segs = model.segments.map(s => ({ a: project(s.a), b: project(s.b), s }));
            segs.sort((p, q) => p.a.depth + p.b.depth - q.a.depth - q.b.depth);
            let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
            for (const s of segs) for (const p of [s.a, s.b]) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y); }
            bx0 -= size * .3; bx1 += size * .3; by0 -= size * .1; by1 += size * .06;
            const steel = offscreen((bx1 - bx0) * ratio, (by1 - by0) * ratio), c = steel.getContext('2d');
            c.setTransform(ratio, 0, 0, ratio, -bx0 * ratio, -by0 * ratio);
            c.fillStyle = radial(c, cx, base - size * .3, 0, size * .6, [[0, 'rgba(255,170,80,.2)'], [.6, 'rgba(255,150,60,.05)'], [1, 'rgba(255,150,60,0)']]);
            c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
            // Translucent iron faces give the lattice body and mass.
            const faces = [];
            const strip = (ea, eb, y0, y1) => { const pts = []; for (let i = 0; i <= 12; i++) pts.push(project(ea(y0 + (y1 - y0) * i / 12))); for (let i = 12; i >= 0; i--) pts.push(project(eb(y0 + (y1 - y0) * i / 12))); faces.push(pts); };
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                const o = y => outerWidth(y), i = y => outerWidth(y) - legWidth(y);
                strip(y => [sx * o(y), y, sz * o(y)], y => [sx * i(y), y, sz * o(y)], 0, LEVEL.F2);
                strip(y => [sx * o(y), y, sz * o(y)], y => [sx * o(y), y, sz * i(y)], 0, LEVEL.F2);
            }
            for (const side of [-1, 1]) {
                strip(y => [-outerWidth(y), y, side * outerWidth(y)], y => [outerWidth(y), y, side * outerWidth(y)], LEVEL.F2, LEVEL.F3);
                strip(y => [side * outerWidth(y), y, -outerWidth(y)], y => [side * outerWidth(y), y, outerWidth(y)], LEVEL.F2, LEVEL.F3);
            }
            faces.map(f => ({ f, d: f.reduce((s, p) => s + p.depth, 0) / f.length })).sort((a, b) => a.d - b.d).forEach(({ f, d }) => {
                c.beginPath(); f.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
                c.fillStyle = d < 0 ? 'rgba(34,20,10,.3)' : 'rgba(150,96,42,.17)'; c.fill();
            });
            // Platform undersides glow; the first deck carries a layer of snow.
            for (const [y, r, top] of [[.166, .118, false], [.186, .118, true], [.343, .07, false], [.83, .027, false]]) {
                const q = [[-r, y, -r], [r, y, -r], [r, y, r], [-r, y, r]].map(project);
                c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
                c.fillStyle = top ? 'rgba(232,242,247,.62)' : 'rgba(120,70,30,.45)'; c.fill();
            }
            for (const { a, b, s } of segs) {
                const front = a.depth + b.depth > 0, heat = 1 - clamp((a.y3 + b.y3) / 2, 0, 1) * .5, lw = Math.max(.4, size / 560 * s.weight);
                if (s.kind === 'girder' || s.kind === 'arch' || s.kind === 'deck') {
                    c.strokeStyle = front ? 'rgba(255,170,70,.13)' : 'rgba(255,150,60,.05)'; c.lineWidth = lw * 3.4;
                    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
                }
                c.strokeStyle = front ? `rgba(255,${190 + 35 * heat | 0},${105 + 45 * heat | 0},${(.5 + .42 * heat).toFixed(2)})` : 'rgba(165,112,62,.42)';
                c.lineWidth = lw; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
            }
            for (let i = 0; i < 3; i++) { const p = project([-.012 + i * .012, .87, .017]); c.fillStyle = 'rgba(255,226,150,.85)'; c.fillRect(p.x - size * .004, p.y - size * .009, size * .006, size * .012); }
            const top = [[-.027, .836, -.027], [.027, .836, -.027], [.027, .836, .027], [-.027, .836, .027]].map(project).sort((p, q) => p.x - q.x);
            tower = { cx, base, size, project, steel, bx0, by0, bw: bx1 - bx0, bh: by1 - by0, lamps: [top[0], top[3]], bulbs: prepareBulbs(project, cx, size) };
        }
        function prepareBulbs(project, cx, size) {
            const L = model.lights, n = L.length, P = L.map(l => project(l.point));
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const p of P) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
            x0 -= 3; y0 -= 3; x1 += 3; y1 += 3;
            const lw = Math.ceil((x1 - x0) * ratio) + 2, lh = Math.ceil((y1 - y0) * ratio) + 2;
            const canvasLayer = offscreen(lw, lh), lctx = canvasLayer.getContext('2d'), image = lctx.createImageData(lw, lh);
            const f32 = () => new Float32Array(n), B = {
                n, x0, y0, lw, lh, layer: canvasLayer, lctx, image, data: image.data, u32: new Uint32Array(image.data.buffer), idx: new Int32Array(n),
                w00: f32(), w10: f32(), w01: f32(), w11: f32(), y3: f32(), theta: f32(), u: f32(), sx: f32(), depthF: f32(), phase: f32(), hash: f32(), chain: []
            };
            const bins = 64, lo = new Float32Array(bins).fill(Infinity), hi = new Float32Array(bins).fill(-Infinity);
            const bin = y => clamp(Math.floor(y * bins), 0, bins - 1);
            P.forEach(p => { const b = bin(p.y3); lo[b] = Math.min(lo[b], p.x); hi[b] = Math.max(hi[b], p.x); });
            P.forEach((p, i) => {
                const px = (p.x - x0) * ratio, py = (p.y - y0) * ratio, ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
                B.idx[i] = (iy * lw + ix) * 4;
                B.w00[i] = (1 - fx) * (1 - fy); B.w10[i] = fx * (1 - fy); B.w01[i] = (1 - fx) * fy; B.w11[i] = fx * fy;
                const b = bin(p.y3), span = Math.max(1, hi[b] - lo[b]);
                B.y3[i] = p.y3; B.u[i] = 2 * (p.x - lo[b]) / span - 1; B.sx[i] = (p.x - cx) / size;
                B.theta[i] = Math.atan2(L[i].point[2], L[i].point[0]); B.depthF[i] = p.depth < 0 ? .55 : .95;
                B.phase[i] = L[i].phase; B.hash[i] = L[i].hash;
            });
            let cw = lw, ch = lh;
            for (let k = 0; k < 4; k++) { cw = Math.max(1, cw >> 1); ch = Math.max(1, ch >> 1); B.chain.push(offscreen(cw, ch)); }
            return B;
        }

        /* ---------- Lights ---------- */
        let flash = 0, flagFill = 0;
        const out = new Float32Array(3), paletteCache = new Map();
        function palRgb(effect) {
            const list = paletteFor(effect, config.colors), key = list.join();
            if (!paletteCache.has(key)) { if (paletteCache.size > 32) paletteCache.clear(); paletteCache.set(key, Float32Array.from(list.flatMap(hexRgb))); }
            return paletteCache.get(key);
        }
        function shade(effect, B, i, t, pal, np) {
            const y3 = B.y3[i], ph = B.phase[i], hs = B.hash[i];
            let I = .65, c = i % np, mix = 0;
            switch (effect) {
                case 'twinkle': I = .16 + .84 * Math.sin(t * 2 + ph) ** 8; break;
                case 'pulse': I = .15 + .65 * (Math.sin(t * 1.6) + 1) / 2; break;
                case 'wave': I = .12 + .8 * (Math.sin(t * 3 - y3 * 18) + 1) / 2; break;
                case 'chase': I = ((y3 * 8 - t * .5) % 1 + 1) % 1 < .18 ? 1 : .08; break;
                case 'rainbow': c = (Math.floor(y3 * 12 + t * 2) % np + np) % np; I = .72; break;
                case 'olympic': {
                    // 24-second interpretation: gold sparkle, rising waves, white chase, finale.
                    const phase = t % 24;
                    c = phase < 8 || phase >= 20 ? 0 : Math.floor(y3 * 3 + t * .2) % np;
                    I = .14 + .65 * Math.sin(t * 2 + ph) ** 12;
                    if (phase >= 8 && phase < 16) I = .12 + .8 * (Math.sin(y3 * 19 - t * 2) + 1) / 2;
                    if (phase >= 16 && phase < 20) { I = ((y3 * 4 - t * .7) % 1 + 1) % 1 < .22 ? .95 : .12; c = Math.min(1, np - 1); }
                    break;
                }
                case 'tree': {
                    // Green body, a gold garland spiralling around the 3D shaft, slow ornaments.
                    const g = ((B.theta[i] / 6.2832 + y3 * 4.5 - t * .12) % 1 + 1) % 1;
                    if (y3 > .84) { c = 1 % np; I = .95; }
                    else if (g < .075) { c = 1 % np; I = .8 + .2 * Math.sin(t * 6 + ph); }
                    else if (hs < .055 && np > 2) { c = 2 + i % (np - 2); I = .5 + .5 * Math.sin(t * 1.5 + ph) ** 2; }
                    else { c = 0; I = .3 + .14 * Math.sin(t * .8 + ph); }
                    break;
                }
                case 'salute':
                    c = flash > .12 ? i % np : 0;
                    I = .13 + Math.min(1, flash) * .8 + (Math.sin(t * 9 + ph * 7) > .985 ? .9 : 0);
                    break;
                case 'gold':
                    c = 0; I = .45 + .1 * Math.sin(t * 1.3 + y3 * 9);
                    if ((t * .9 + hs * 37.1) % 1 < .035) { c = 1 % np; I = 1.2; }
                    break;
                case 'aurora': {
                    const sx = B.sx[i], f = (Math.sin(sx * 5 + t * .8 + y3 * 3) + Math.sin(sx * 2.3 - t * .5 + y3 * 7) * .6) * .32 + .5, pos = clamp(f, 0, .999) * (np - 1);
                    c = Math.floor(pos); mix = np > 1 ? pos - c : 0; I = .3 + .6 * Math.sin(t * .7 + y3 * 5 + sx * 3) ** 2;
                    break;
                }
                case 'flag': {
                    // The flag colours climb the tower in step with the hoist.
                    const u = B.u[i], level = flagFill * 1.08 - .04;
                    if (y3 > level) { const edge = y3 - level < .018; out[0] = 255 * (edge ? .9 : .05); out[1] = 240 * (edge ? .9 : .05); out[2] = 210 * (edge ? .9 : .05); return; }
                    c = u < -1 / 3 || u > 1 / 3 ? 0 : 1; I = .66 + .22 * Math.sin(t * 2.2 - u * 4 + y3 * 6);
                    if (u < -1 / 3 && hs < .17) { c = 2; I = .9 + .1 * Math.sin(t * 3 + ph); }
                    break;
                }
            }
            const k = c * 3;
            let r = pal[k], g = pal[k + 1], b = pal[k + 2];
            if (mix > 0) { r += (pal[k + 3] - r) * mix; g += (pal[k + 4] - g) * mix; b += (pal[k + 5] - b) * mix; }
            out[0] = r * I; out[1] = g * I; out[2] = b * I;
        }
        function drawBulbs(state, t) {
            const B = tower.bulbs, data = B.data, row = B.lw * 4;
            B.u32.fill(0xff000000);
            const eA = rhythm ? rhythm.effect : state.effect, eB = !rhythm && state.previous && state.blend < 1 ? state.previous : null;
            const palA = palRgb(state.effect), palB = eB ? palRgb(eB) : null, npA = palA.length / 3, npB = palB ? palB.length / 3 : 0;
            const bright = config.brightness * 1.75 * (rhythm ? .5 + .5 * rhythm.pulse : 1), k = state.blend;
            for (let i = 0; i < B.n; i++) {
                shade(eA, B, i, t, palA, npA);
                let r = out[0], g = out[1], b = out[2];
                if (eB) { shade(eB, B, i, t, palB, npB); r = r * k + out[0] * (1 - k); g = g * k + out[1] * (1 - k); b = b * k + out[2] * (1 - k); }
                const v = bright * B.depthF[i]; r *= v; g *= v; b *= v;
                if (r + g + b < 4) continue;
                const p = B.idx[i];
                let w = B.w00[i]; data[p] += r * w; data[p + 1] += g * w; data[p + 2] += b * w;
                w = B.w10[i]; data[p + 4] += r * w; data[p + 5] += g * w; data[p + 6] += b * w;
                w = B.w01[i]; data[p + row] += r * w; data[p + row + 1] += g * w; data[p + row + 2] += b * w;
                w = B.w11[i]; data[p + row + 4] += r * w; data[p + row + 5] += g * w; data[p + row + 6] += b * w;
            }
            B.lctx.putImageData(B.image, 0, 0);
            let src = B.layer;
            for (const c of B.chain) { const cc = c.getContext('2d'); cc.globalCompositeOperation = 'copy'; cc.drawImage(src, 0, 0, c.width, c.height); src = c; }
            const dw = B.lw / ratio, dh = B.lh / ratio;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(B.layer, B.x0, B.y0, dw, dh);
            ctx.globalAlpha = .55; ctx.drawImage(B.chain[1], B.x0, B.y0, dw, dh);
            ctx.globalAlpha = .75; ctx.drawImage(B.chain[3], B.x0, B.y0, dw, dh);
            ctx.restore();
        }
        function drawStar(x, y, R, alpha, t) {
            if (alpha <= .01) return;
            ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter';
            oval(ctx, x, y, R * 5, R * 5, radial(ctx, x, y, 0, R * 5, [[0, 'rgba(255,220,120,.55)'], [1, 'rgba(255,220,120,0)']]));
            ctx.strokeStyle = 'rgba(255,236,170,.5)'; ctx.lineWidth = 1;
            for (let i = 0; i < 12; i++) { const a = t * .4 + i * Math.PI / 6, l = R * (i % 2 ? 2.6 : 4.2); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * .6, y + Math.sin(a) * R * .6); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .45 : R; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
            ctx.closePath(); ctx.fillStyle = radial(ctx, x, y, 0, R, [[0, '#fffbe6'], [.5, '#ffd767'], [1, '#e7a62c']]); ctx.fill();
            ctx.restore();
        }
        function drawRings(alpha) {
            if (alpha <= .01) return;
            const rings = [[-.076, .35], [0, .35], [.076, .35], [-.038, .316], [.038, .316]];
            ctx.save(); ctx.globalAlpha = alpha * Math.min(1, config.brightness); ctx.shadowColor = '#fff8df'; ctx.shadowBlur = 8;
            for (const [x, y] of rings) {
                ctx.beginPath();
                for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, p = tower.project([x + Math.cos(a) * .033, y - .1 + Math.sin(a) * .033, .14]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
                ctx.strokeStyle = '#fff8df'; ctx.lineWidth = Math.max(1.25, tower.size * .004); ctx.stroke();
            }
            ctx.restore();
        }

        /* ---------- Summit searchlights: they shine down onto the snow ---------- */
        const beams = [{ x: 0, y: 0, ready: false }, { x: 0, y: 0, ready: false }];
        let cones = [];
        function aimBeams(dt, tb, wFlag) {
            const w = width;
            beams.forEach((b, i) => {
                const sign = i ? 1 : -1, lamp = tower.lamps[i];
                let x, y;
                if (config.beams === 'fan') { x = w * (.5 + sign * (.4 + Math.sin(tb * .5) * .06)); y = G + (roadTop - G) * .55; }
                else if (config.beams === 'still') { x = tower.cx + sign * tower.size * .24; y = tower.base + 26 * S; }
                else if (config.beams === 'follow') {
                    if (i === 0) { x = plowX() + 30 * S; y = roadTop + 4; }
                    else if (deer.y > lamp.y + 50) { x = deer.x; y = deer.y; } else { x = deer.x; y = G + 26 * S; }
                } else { x = w * (.5 + .44 * Math.sin(tb * .42 + i * Math.PI)); y = G + (roadTop - G) * (.45 + .4 * Math.sin(tb * .7 + i * 2.1)); }
                if (wFlag > 0 && pole) { const fx = pole.x + pole.fw * .5, fy = pole.flagY + pole.fh * .5; x += (fx - x) * wFlag; y += (fy - y) * wFlag; }
                if (!b.ready) { b.x = x; b.y = y; b.ready = true; }
                const k = Math.min(1, dt * 4); b.x += (x - b.x) * k; b.y += (y - b.y) * k;
            });
        }
        function drawBeams() {
            cones = [];
            if (config.beams === 'off' || config.brightness <= 0) return;
            const col = config.beamcolor, [r, g, b] = hexRgb(col), rgba = a => `rgba(${r},${g},${b},${a})`;
            ctx.save(); ctx.globalCompositeOperation = 'screen';
            beams.forEach((t, i) => {
                const s = tower.lamps[i], dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
                const half = len * (config.beams === 'fan' ? .11 : .075), a = Math.min(1, config.brightness * .8);
                const pts = [[s.x + nx * 1.5, s.y + ny * 1.5], [t.x + nx * half, t.y + ny * half], [t.x - nx * half, t.y - ny * half], [s.x - nx * 1.5, s.y - ny * 1.5]];
                cones.push([s.x, s.y, pts[1][0], pts[1][1], pts[2][0], pts[2][1]]);
                ctx.globalAlpha = a;
                poly(ctx, pts, linear(ctx, s.x, s.y, t.x, t.y, [[0, rgba(.5)], [.7, rgba(.16)], [1, rgba(.1)]]));
                poly(ctx, [[s.x, s.y], [t.x, t.y]], null, rgba(.25), 1.2);
                const rx = half * 1.3;
                ctx.save(); ctx.translate(t.x, t.y); ctx.scale(1, .34);
                oval(ctx, 0, 0, rx, rx, radial(ctx, 0, 0, 0, rx, [[0, rgba(.55)], [.6, rgba(.18)], [1, rgba(0)]]));
                ctx.restore();
            });
            ctx.restore();
        }
        function drawLamps() {
            tower.lamps.forEach((s, i) => {
                const t = beams[i], a = Math.atan2(t.y - s.y, t.x - s.x), r = Math.max(2.4, tower.size * .007);
                ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
                ctx.fillStyle = '#26323b'; ctx.fillRect(-r, -r * .8, r * 2.2, r * 1.6);
                ctx.restore();
                const on = config.beams !== 'off';
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = on ? Math.min(1, config.brightness) : .15;
                oval(ctx, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, r * 4, r * 4, radial(ctx, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 0, r * 4, [[0, '#ffffff'], [.3, config.beamcolor + 'aa'], [1, config.beamcolor + '00']]));
                ctx.restore();
            });
        }
        function inCone(x, y) {
            for (const [ax, ay, bx, by, cx2, cy2] of cones) {
                const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by), d2 = (x - cx2) * (by - cy2) - (bx - cx2) * (y - cy2), d3 = (x - ax) * (cy2 - ay) - (cx2 - ax) * (y - ay);
                if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
            }
            return false;
        }

        /* ---------- Salute fireworks ---------- */
        const shells = [], bursts = [];
        let launchClock = .2, volley = 0, flagVolleys = 0, flagVolleyClock = 0, flagSaluted = false;
        function launch(x, y, tx, ty, color, type) { shells.push({ sx: x, sy: y, tx, ty, t: 0, dur: .95 + random() * .45, color, type }); }
        function fireVolley(colors) {
            volley++;
            const cx = tower.cx, s = tower.size, count = volley % 4 === 0 ? 5 : 2 + volley % 2, types = ['peony', 'ring', 'willow', 'glitter', 'peony'];
            for (let k = 0; k < count; k++) {
                const side = count === 1 ? 0 : (k / (count - 1)) * 2 - 1;
                const fromTower = k % 2 === 0, src = fromTower ? tower.project([side * .06, k % 4 === 0 ? LEVEL.F2 : LEVEL.F1, .08]) : { x: cx + side * s * .55, y: G + 6 };
                launch(src.x, src.y, cx + side * Math.min(width * .42, s * .75) + (random() - .5) * 40 * S, height * (.1 + random() * .26), colors[(volley + k) % colors.length], types[(volley + k) % types.length]);
            }
        }
        function explode(x, y, color, type) {
            const n = type === 'ring' ? 64 : type === 'willow' ? 90 : 120, spark = new Float32Array(n * 4), speed = (type === 'willow' ? 175 : type === 'ring' ? 250 : 270) * S * (.85 + random() * .3);
            for (let i = 0; i < n; i++) {
                let vx, vy;
                if (type === 'ring') { const a = i / n * Math.PI * 2; vx = Math.cos(a) * speed; vy = Math.sin(a) * speed * .45; }
                else { const a = random() * Math.PI * 2, z = random() * 2 - 1, m = Math.sqrt(1 - z * z) * speed * (.85 + random() * .15); vx = Math.cos(a) * m; vy = Math.sin(a) * m; }
                spark.set([x, y, vx, vy], i * 4);
            }
            bursts.push({ x, y, spark, n, age: 0, life: type === 'willow' ? 3.2 : type === 'glitter' ? 2.4 : 1.9, color, type, rgb: hexRgb(color) });
            if (bursts.length > 16) bursts.shift();
            flash = Math.min(1.5, flash + .55);
        }
        function updateFireworks(dt, wSalute, tb) {
            if (wSalute > .5) { launchClock -= dt * Math.max(.35, config.speed); if (launchClock <= 0) { fireVolley(paletteFor('salute', config.colors)); launchClock = 1.45; } }
            if (flagVolleys > 0) { flagVolleyClock -= dt; if (flagVolleyClock <= 0) { volley = 3; fireVolley(FLAG_COLORS); flagVolleys--; flagVolleyClock = .85; } }
            for (let i = shells.length - 1; i >= 0; i--) { const s = shells[i]; s.t += dt; if (s.t >= s.dur) { explode(s.tx, s.ty, s.color, s.type); shells.splice(i, 1); } }
            for (let i = bursts.length - 1; i >= 0; i--) {
                const b = bursts[i], drag = Math.pow(b.type === 'willow' ? .972 : .957, dt * 60), grav = (b.type === 'willow' ? 50 : 62) * S * dt;
                b.age += dt;
                for (let k = 0; k < b.n * 4; k += 4) { b.spark[k + 2] *= drag; b.spark[k + 3] = b.spark[k + 3] * drag + grav; b.spark[k] += b.spark[k + 2] * dt; b.spark[k + 1] += b.spark[k + 3] * dt; }
                if (b.age > b.life) bursts.splice(i, 1);
            }
            flash *= Math.exp(-dt * 3.5);
        }
        function drawFireworks(t) {
            if (!shells.length && !bursts.length) return;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            for (const s of shells) {
                const q = s.t / s.dur, e = 1 - (1 - q) * (1 - q), e0 = 1 - (1 - Math.max(0, q - .12)) ** 2;
                const x = s.sx + (s.tx - s.sx) * e, y = s.sy + (s.ty - s.sy) * e, x0 = s.sx + (s.tx - s.sx) * e0, y0 = s.sy + (s.ty - s.sy) * e0;
                ctx.globalAlpha = .9; poly(ctx, [[x0, y0], [x, y]], null, linear(ctx, x0, y0, x, y, [[0, 'rgba(255,200,120,0)'], [1, 'rgba(255,230,180,.9)']]), 1.6 * S);
                oval(ctx, x, y, 2 * S, 2 * S, '#fff3d6');
            }
            for (const b of bursts) {
                const life = 1 - b.age / b.life, [r, g, bl] = b.rgb;
                if (b.age < .35) { ctx.globalAlpha = (1 - b.age / .35) * .5; oval(ctx, b.x, b.y, 170 * S, 170 * S, radial(ctx, b.x, b.y, 0, 170 * S, [[0, 'rgba(255,250,235,.9)'], [.15, `rgba(${r},${g},${bl},.6)`], [1, `rgba(${r},${g},${bl},0)`]])); }
                ctx.globalAlpha = Math.max(0, life) ** 1.3;
                ctx.strokeStyle = b.type === 'willow' ? '#ffcf7a' : b.color; ctx.lineWidth = (b.type === 'willow' ? 1.6 : 2.3) * S;
                const streak = b.type === 'willow' ? .16 : .07;
                ctx.beginPath();
                for (let k = 0; k < b.n * 4; k += 4) { const x = b.spark[k], y = b.spark[k + 1]; ctx.moveTo(x, y); ctx.lineTo(x - b.spark[k + 2] * streak, y - b.spark[k + 3] * streak); }
                ctx.stroke();
                if (b.age < .9 && b.type !== 'willow') {
                    ctx.fillStyle = '#fff7e6'; const d = 1.6 * S;
                    for (let k = 0; k < b.n * 4; k += 4) ctx.fillRect(b.spark[k] - d / 2, b.spark[k + 1] - d / 2, d, d);
                }
                if (b.type === 'glitter' && b.age > .35 || b.type === 'peony' && life < .45) {
                    ctx.fillStyle = '#fffaf0';
                    for (let k = 0; k < b.n * 4; k += 4) if (Math.sin(t * 40 + k) > .2) ctx.fillRect(b.spark[k] - S, b.spark[k + 1] - S, 2 * S, 2 * S);
                }
            }
            ctx.restore();
        }

        /* ---------- Mongolian flag ceremony ---------- */
        function preparePole() {
            const s = tower.size, fh = Math.round(s * .12), fw = fh * 2;
            const x = tower.cx - s * (mobile ? .34 : .36), base = G + 22 * S, top = base - s * .66;
            flagTex = offscreen(fw * ratio, fh * ratio);
            drawMongolianFlag(flagTex.getContext('2d'), flagTex.width, flagTex.height);
            pole = { x, base, top, fw, fh, flagY: base - fh };
        }
        function drawFlag(local, alpha, t) {
            if (alpha <= .01 || !pole) return;
            const fp = flagProgress(local), { x, base, top, fw, fh } = pole, yTop = base - (base - top) * fp.pole;
            ctx.save(); ctx.globalAlpha = alpha;
            ctx.fillStyle = linear(ctx, x - 2, 0, x + 2, 0, [[0, '#8c979e'], [.5, '#f4f7f8'], [1, '#77828a']]); ctx.fillRect(x - 1.8 * S, yTop, 3.6 * S, base - yTop);
            oval(ctx, x, base + 2, 16 * S, 5 * S, '#f2f8fa');
            if (fp.pole >= 1) {
                oval(ctx, x, top - 3 * S, 4 * S, 4 * S, radial(ctx, x, top - 3 * S, 0, 4 * S, [[0, '#fff3b0'], [1, '#d39a1c']], x - 1, top - 4 * S));
                poly(ctx, [[x - 2.5 * S, top - 6 * S], [x, top - 16 * S], [x + 2.5 * S, top - 6 * S]], '#e4b23a');
                const y0 = base - fh - 10 * S, y1 = top + 4 * S, fy = y0 + (y1 - y0) * fp.hoist, open = smooth(.25 + fp.hoist * .9), wcur = fw * (.55 + .45 * open);
                pole.flagY = fy;
                poly(ctx, [[x + 1, top], [x + 1, fy], [x + 1, fy + fh]], null, 'rgba(230,236,240,.6)', .8);
                const N = 44, sw = wcur / N, src = flagTex.width / N;
                for (let j = 0; j < N; j++) {
                    const u = j / N, wave = u * 7 - t * 4.2, amp = fh * .1 * u * open + fh * .25 * (1 - open) * u * u;
                    const dy = Math.sin(wave) * amp + (1 - open) * u * fh * .35, shadeV = Math.cos(wave) * u;
                    ctx.drawImage(flagTex, j * src, 0, src + .5, flagTex.height, x + 2 + j * sw, fy + dy, sw + .6, fh);
                    ctx.fillStyle = shadeV > 0 ? `rgba(255,255,255,${(shadeV * .2).toFixed(3)})` : `rgba(0,10,30,${(-shadeV * .34).toFixed(3)})`;
                    ctx.fillRect(x + 2 + j * sw, fy + dy, sw + .6, fh);
                }
                if (fp.raised) {
                    ctx.globalCompositeOperation = 'lighter';
                    for (let i = 0; i < 18; i++) { const a = (t * .5 + i / 18) % 1, gx = x + 10 * S + (i * 37 % 100) / 100 * fw, gy = fy - 6 * S + a * fh * 1.6; ctx.globalAlpha = alpha * (1 - a) * .9; oval(ctx, gx, gy, 1.4 * S, 1.4 * S, i % 3 ? '#ffd900' : '#ffffff'); }
                }
            }
            ctx.restore();
        }

        /* ---------- Road, snowplow and decorations ---------- */
        const spriteCache = new Map();
        function lightSprite(color) {
            if (spriteCache.has(color)) return spriteCache.get(color);
            const sprite = offscreen(32, 32), c = sprite.getContext('2d'), g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
            g.addColorStop(0, color); g.addColorStop(.18, color); g.addColorStop(.45, color + '55'); g.addColorStop(1, color + '00');
            c.fillStyle = g; c.fillRect(0, 0, 32, 32);
            if (spriteCache.size > 48) spriteCache.clear();
            spriteCache.set(color, sprite); return sprite;
        }
        const PLOW_SPEED = 50;
        const plowLoop = () => width + 700 * S;
        function plowX() { return (time * PLOW_SPEED * S + width * .35 + 300 * S) % plowLoop() - 300 * S; }
        function drawRoad() {
            const px = plowX(), PS = S * .9, blade = px + 100 * PS, h = roadBottom - roadTop, ground = roadTop + h * .62;
            ctx.fillStyle = linear(ctx, 0, roadTop, 0, roadBottom, [[0, '#e8f0f4'], [1, '#d2e0e7']]); ctx.fillRect(0, roadTop, width, h);
            if (blade > 0) {
                const end = Math.min(width, blade);
                ctx.fillStyle = linear(ctx, 0, roadTop, 0, roadBottom, [[0, '#2b3943'], [.5, '#3b4b56'], [1, '#25313a']]); ctx.fillRect(0, roadTop + 2, end, h - 4);
                ctx.fillStyle = 'rgba(255,212,120,.6)'; for (let x = 8; x < end - 6; x += 40) ctx.fillRect(x, roadTop + h / 2 - 1, 18, 2);
                ctx.fillStyle = 'rgba(12,18,24,.35)'; ctx.fillRect(0, roadTop + h * .28, end, 2); ctx.fillRect(0, roadTop + h * .74, end, 2);
                // Fresh snow settles back on the older cleared stretch behind the plow.
                ctx.fillStyle = linear(ctx, blade - 520 * S, 0, blade, 0, [[0, 'rgba(232,241,245,1)'], [1, 'rgba(232,241,245,0)']]); ctx.fillRect(0, roadTop, end, h);
                ctx.beginPath(); ctx.moveTo(0, roadBottom + 3);
                for (let x = 0; x <= end; x += 9) ctx.lineTo(x, roadBottom - 2 - Math.abs(Math.sin(x * .09)) * 4 * S);
                ctx.lineTo(end, roadBottom + 3); ctx.closePath(); ctx.fillStyle = '#f6fafc'; ctx.fill();
            }
            for (let i = 0; i < 7; i++) {
                const a = (time * .7 + i / 7) % 1;
                oval(ctx, px + (-21 - a * 36) * PS, ground + (-110 - a * 46) * PS, (4 + a * 11) * PS, (3.5 + a * 9) * PS, `rgba(196,208,218,${((1 - a) * .32).toFixed(3)})`);
            }
            ctx.save(); ctx.translate(px, ground); ctx.scale(PS, PS);
            drawSnowplow(ctx, time, px / PS, true); drawPlowSnow(ctx, time);
            ctx.restore();
        }
        function drawSmoke() {
            for (const [x, y] of gers) for (let i = 0; i < 5; i++) {
                const a = (time * .25 + i / 5) % 1;
                oval(ctx, x + Math.sin(a * 4 + i) * 4 * S + a * 10 * S, y - a * 40 * S, (2 + a * 6) * S, (2 + a * 5) * S, `rgba(210,222,230,${((1 - a) * .28).toFixed(3)})`);
            }
        }
        function drawSky(t, wAurora) {
            ctx.fillStyle = '#ffffff';
            for (const s of stars) { ctx.globalAlpha = .3 + .7 * Math.sin(time * 1.3 + s.p) ** 2; ctx.fillRect(s.x, s.y, s.r, s.r); }
            ctx.globalAlpha = 1;
            if (wAurora <= .01) return;
            ctx.save(); ctx.globalCompositeOperation = 'screen';
            const pal = paletteFor('aurora', config.colors);
            for (let k = 0; k < 3; k++) {
                const [r, g, b] = hexRgb(pal[k % pal.length]), y0 = height * (.1 + k * .07);
                ctx.beginPath();
                for (let x = 0; x <= width + 12; x += 12) ctx.lineTo(x, y0 + Math.sin(x * .007 + t * .3 + k * 2) * 26 + Math.sin(x * .019 - t * .5 + k) * 10);
                for (let x = width + 12; x >= 0; x -= 12) ctx.lineTo(x, y0 + 100 * S + Math.sin(x * .006 + t * .25 + k) * 30);
                ctx.closePath();
                ctx.fillStyle = linear(ctx, 0, y0 - 30, 0, y0 + 130 * S, [[0, `rgba(${r},${g},${b},0)`], [.35, `rgba(${r},${g},${b},${(.3 * wAurora).toFixed(3)})`], [1, `rgba(${r},${g},${b},0)`]]);
                ctx.fill();
            }
            ctx.restore();
        }
        function drawDecorLights(t, pal) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const [x, y, k] of decor) {
                if (k < 0) { drawStar(x, y, 5 * S, .9, t); ctx.globalCompositeOperation = 'lighter'; continue; }
                ctx.globalAlpha = .45 + .55 * Math.sin(t * 2.4 + x * .3 + y) ** 2;
                const r = 7 * S; ctx.drawImage(lightSprite(pal[k % pal.length]), x - r, y - r, r * 2, r * 2);
            }
            const warm = ['#ffcf7a', '#ff8a7a', '#9fe3d2', '#fff1c9'];
            for (const [x, y, k] of fenceLights) { ctx.globalAlpha = .5 + .5 * Math.sin(t * 1.7 + x * .05) ** 2; const r = 6 * S; ctx.drawImage(lightSprite(warm[k]), x - r, y - r, r * 2, r * 2); }
            for (const [x, y] of lanterns) { ctx.globalAlpha = .75 + .25 * Math.sin(time * 7 + x); const r = 16 * S; ctx.drawImage(lightSprite('#ffc46a'), x - r, y - r, r * 2, r * 2); }
            ctx.restore();
        }
        function drawFestoon(t, pal) {
            const w = width, y0 = 16, sag = 30 * S, n = Math.max(10, Math.round(w / 44)), step = Math.floor(t * 3);
            ctx.beginPath(); for (let i = 0; i <= 40; i++) ctx.lineTo(w * i / 40, y0 + Math.sin(i / 40 * Math.PI) * sag);
            ctx.strokeStyle = '#2a3c46'; ctx.lineWidth = 1.2; ctx.stroke();
            for (let i = 1; i < n; i++) {
                const q = i / n, x = w * q, y = y0 + Math.sin(q * Math.PI) * sag, col = pal[i % pal.length], on = (i + step) % 3 !== 0;
                ctx.fillStyle = '#3c4c55'; ctx.fillRect(x - 1.6, y, 3.2, 4);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = on ? 1 : .3;
                ctx.drawImage(lightSprite(col), x - 10, y - 3, 20, 20); ctx.restore();
                ctx.globalAlpha = on ? 1 : .55; oval(ctx, x, y + 7.5, 2.4, 3.3, col); ctx.globalAlpha = 1;
            }
        }
        function drawDeer() {
            if (deer.alpha <= .01) return;
            const scale = deerScale(), phase = deer.elapsed * (deer.auto ? 8 : 11);
            ctx.save(); ctx.globalAlpha = deer.alpha;
            if (deer.moving) {
                if (!deer.auto) { ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = '#ddf9ff'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(deer.target.x, deer.target.y, 9 + (1 + Math.sin(time * 4)) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (let i = 0; i < 16; i++) {
                    const p = flightPosition(deer.from, deer.target, Math.max(0, (deer.elapsed - i * .045) / deer.duration));
                    ctx.globalAlpha = .5 * (1 - i / 16); const r = (1 - i / 18) * 9 * scale;
                    ctx.drawImage(lightSprite(i % 3 ? '#cfefff' : '#ffe3a0'), p.x - deer.facing * 40 * scale - r, p.y + 30 * scale + Math.sin(i * 2 + time * 3) * 7 - r, r * 2, r * 2);
                }
                ctx.restore();
            } else {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (let i = 0; i < 6; i++) { const a = (time * .6 + i / 6) % 1; ctx.globalAlpha = (1 - a) * .6; const r = 4 * scale; ctx.drawImage(lightSprite('#dff6ff'), deer.x + (i - 2.5) * 14 * scale - r, deer.y + (58 + a * 22) * scale - r, r * 2, r * 2); }
                ctx.restore();
            }
            ctx.save(); ctx.translate(deer.x, deer.y + (deer.moving ? Math.sin(phase) * 3 : Math.sin(time * 1.5) * 4) * scale);
            ctx.scale(scale * deer.facing, scale); ctx.translate(-16, 6);
            drawReindeerBody(ctx, phase, deer.moving, time);
            ctx.restore();
            ctx.restore();
        }
        function drawSnow() {
            const n = Math.round(flakes.length * config.snow), lit = [];
            ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const f = flakes[i], x = ((f.x + Math.sin(time * .17 + f.y * 6 + f.drift) * .02 + time * .008) % 1) * width, y = ((f.y + time * f.speed) % 1) * height;
                if (cones.length && inCone(x, y)) { lit.push(x, y, f.r); continue; }
                ctx.moveTo(x + f.r, y); ctx.arc(x, y, f.r, 0, Math.PI * 2);
            }
            ctx.fill();
            if (!lit.length) return;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const sprite = lightSprite(config.beamcolor);
            for (let i = 0; i < lit.length; i += 3) { const r = lit[i + 2] * 4; ctx.drawImage(sprite, lit[i] - r, lit[i + 1] - r, r * 2, r * 2); oval(ctx, lit[i], lit[i + 1], lit[i + 2] * 1.2, lit[i + 2] * 1.2, '#ffffff'); }
            ctx.restore();
        }

        /* ---------- Snowball game: pick a snowball from the pile, pull back and release ---------- */
        const balls = [], knocked = [], popups = [], puffs = [], BEST_KEY = 'winterSnowballBest.v1';
        const isRed = col => col >= board.cols / 2 - 2 && col < board.cols / 2 + 2;
        let score = 0, best = 0, hat = null, wobble = 0;
        try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) {}
        const gravity = () => 900 * S;
        const throwOrigin = () => ({ x: pile.x, y: pile.y - pile.r * 1.6 });
        function throwVelocity(a) {
            const dx = a.sx - a.x, dy = a.sy - a.y, pull = Math.hypot(dx, dy);
            if (pull < 14) return null;
            const m = Math.min(pull, 170 * S) / pull;
            return { vx: dx * m * 6.2, vy: dy * m * 6.2 };
        }
        // A short tap (or the B key) lobs a snowball at the board with a little human error.
        function throwBall(a) {
            if (!pile || !board) return;
            const from = throwOrigin();
            const v = (a && throwVelocity(a)) || aimVelocity(from, { x: board.x + (random() - .5) * board.w * .6, y: board.y + (random() - .5) * board.h * .5 }, gravity(), .85);
            balls.push({ x: from.x, y: from.y, vx: v.vx, vy: v.vy, r: Math.max(4, 6.5 * S) });
            sfx.whoosh(); dirty = true;
        }
        function puff(x, y, n) {
            for (let i = 0; i < n; i++) { const a = random() * Math.PI * 2, v = (40 + random() * 120) * S; puffs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * S, life: 0, max: .5 + random() * .4, r: (1.5 + random() * 2.5) * S }); }
        }
        // A struck cylinder flies off, and everything stacked above it in that column topples too.
        function knock(col, row, vx) {
            if (col < 0 || col >= board.cols) return;
            for (let r = row; r < board.rows; r++) {
                const slot = board.slots[r * board.cols + col];
                if (!slot.on) continue;
                slot.on = false;
                knocked.push({ x: board.x0 + (col + .5) * board.cw, y: board.ground - (r + .5) * board.ch, vx: vx * .25 + (random() - .5) * 90 * S, vy: -(170 + random() * 150 + (r - row) * 40) * S, rot: 0, vr: (random() - .5) * 14, red: isRed(col), t: 0 });
            }
            board.colWait[col] = 3.5 + random() * 1.5;
        }
        function addScore(points, x, y, label) {
            score += points; popups.push({ x, y, text: label || '+' + points, life: 0 });
            if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch (_) {} }
        }
        function snowmanParts() {
            const k = snowman.s;
            return { head: [snowman.x, snowman.y - 117 * k, 20 * k], hat: [snowman.x, snowman.y - 152 * k, 21 * k], body: [[snowman.x, snowman.y - 77 * k, 26 * k], [snowman.x, snowman.y - 26 * k, 35 * k]] };
        }
        function updateSnowballs(dt) {
            const g = gravity();
            for (let i = balls.length - 1; i >= 0; i--) {
                const b = balls[i], hit = (cx, cy, r) => Math.hypot(b.x - cx, b.y - cy) < r + b.r * .6;
                b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
                const parts = snowmanParts(), col = clamp(Math.floor((b.x - board.x0) / board.cw), 0, board.cols - 1), row = clamp(Math.floor((board.ground - b.y) / board.ch), 0, board.rows - 1);
                const inWall = b.x > board.x0 - b.r * .4 && b.x < board.x0 + board.w + b.r * .4 && b.y > board.y0 - b.r * .5 && b.y < board.ground;
                let gone = true;
                if (inWall && board.slots[row * board.cols + col].on) {
                    // A ball through a gap keeps flying; a hit knocks the leather cylinders off.
                    const red = isRed(col);
                    knock(col, row, b.vx); if (random() < .5) knock(col + (b.vx > 0 ? 1 : -1), row, b.vx);
                    addScore(red ? 50 : 25, board.x, board.y0 - 34 * S, red ? 'УУХАЙ! +50' : '+25');
                    sfx.thud(); if (red) sfx.shimmer(); puff(b.x, b.y, 8);
                } else if (!hat && (hit(...parts.hat) || hit(...parts.head))) {
                    const side = Math.sign(b.vx) || 1;
                    hat = { x: 0, y: 0, vx: side * 150 * S, vy: -330 * S, rot: 0, vr: side * 7, t: 0 };
                    wobble = 1; addScore(15, parts.head[0], parts.head[1] - 70 * snowman.s); sfx.splat(.35); puff(b.x, b.y, 10);
                } else if (parts.body.some(c => hit(...c))) {
                    wobble = Math.max(wobble, .7); addScore(5, snowman.x, snowman.y - 110 * snowman.s); sfx.splat(.3); puff(b.x, b.y, 10);
                } else if (!deer.vanish && onDeer(b)) {
                    sfx.bells(); puff(b.x, b.y, 10); addScore(20, deer.x, deer.y - 80 * deerScale());
                    if (deer.moving && !deer.auto) music.stop();
                    wander(true);
                } else if (b.vy > 0 && b.y > board.ground + 6 * S) { puff(b.x, b.y, 7); sfx.splat(.12); }
                else gone = b.y > height + 30 || b.x < -40 || b.x > width + 40;
                if (gone) balls.splice(i, 1);
            }
            for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.life += dt; q.vy += g * .4 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life > q.max) puffs.splice(i, 1); }
            for (let i = popups.length - 1; i >= 0; i--) { popups[i].life += dt; if (popups[i].life > 1.2) popups.splice(i, 1); }
            for (let i = knocked.length - 1; i >= 0; i--) {
                const q = knocked[i]; q.t += dt; q.vy += g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
                if (q.y > board.ground && q.vy > 0) { q.y = board.ground; q.vy *= -.25; q.vx *= .5; q.vr *= .5; }
                if (q.t > 2.4) knocked.splice(i, 1);
            }
            for (let c = 0; c < board.cols; c++) {
                if (board.colWait[c] > 0 && (board.colWait[c] -= dt) <= 0) for (let r = 0; r < board.rows; r++) { const sl = board.slots[r * board.cols + c]; if (!sl.on) { sl.on = true; sl.pop = 0; } }
            }
            for (const sl of board.slots) if (sl.pop < 1) sl.pop = Math.min(1, sl.pop + dt * 2.5);
            if (hat) {
                const floor = 126 * snowman.s;
                hat.t += dt; hat.vy += g * .9 * dt; hat.x += hat.vx * dt; hat.y += hat.vy * dt; hat.rot += hat.vr * dt;
                if (hat.y > floor) { hat.y = floor; hat.vy = 0; hat.vx *= .85; hat.vr *= .8; }
                if (hat.t > 2.8) { puff(snowman.x, snowman.y - 152 * snowman.s, 8); hat = null; }
            }
            wobble = Math.max(0, wobble - dt * 1.2);
        }
        function paintSnowman() {
            const k = snowman.s;
            ctx.save(); ctx.translate(snowman.x, snowman.y); ctx.rotate(Math.sin(time * 18) * wobble * .06); ctx.scale(k, k); drawSnowman(ctx, !!hat); ctx.restore();
            if (hat) { ctx.save(); ctx.translate(snowman.x + hat.x, snowman.y - 131 * k + hat.y); ctx.rotate(hat.rot); ctx.scale(k, k); ctx.translate(0, 131); drawHat(ctx); ctx.restore(); }
        }
        function drawSur(cx, cy, w, h, red) {
            const x = cx - w / 2, y = cy - h / 2;
            ctx.fillStyle = red ? linear(ctx, x, 0, x + w, 0, [[0, '#7a1822'], [.45, '#e0464f'], [1, '#6e1520']]) : linear(ctx, x, 0, x + w, 0, [[0, '#6a3d1c'], [.45, '#c98b50'], [1, '#5c3416']]);
            ctx.fillRect(x, y + h * .18, w, h * .82);
            oval(ctx, cx, y + h * .18, w / 2, h * .18, red ? '#f27f86' : '#e3ad74');
            oval(ctx, cx, y + h * .18, w * .26, h * .08, red ? '#5e1018' : '#4e2c12');
            ctx.strokeStyle = 'rgba(40,18,6,.45)'; ctx.lineWidth = .7;
            ctx.beginPath(); ctx.moveTo(x + .5, y + h * .62); ctx.lineTo(x + w - .5, y + h * .62); ctx.stroke();
        }
        // The archery target: a low wall of leather cylinders on the snow, with a score plaque above.
        function drawBoard() {
            const b = board, fs = Math.max(.75, S);
            oval(ctx, b.x, b.ground + 2, b.w * .62, 4.5 * fs, 'rgba(70,110,140,.32)');
            for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
                const sl = b.slots[r * b.cols + c];
                if (!sl.on) continue;
                ctx.globalAlpha = sl.pop;
                drawSur(b.x0 + (c + .5) * b.cw, b.ground - (r + .5) * b.ch - (1 - sl.pop) * 10 * fs, b.cw * .94, b.ch * .96, isRed(c));
                if (r === b.rows - 1 && c % 3 === 1) oval(ctx, b.x0 + (c + .5) * b.cw, b.ground - (r + 1) * b.ch + b.ch * .16, b.cw * .5, b.ch * .12, '#f5fafb');
            }
            ctx.globalAlpha = 1;
            for (const q of knocked) {
                ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, Math.max(0, (2.4 - q.t) / .6));
                drawSur(0, 0, b.cw * .94, b.ch * .96, q.red); ctx.restore();
            }
            ctx.globalAlpha = 1;
            const sy = b.y0 - 16 * fs, label = `СУР · ОНОО ${score}  ·  ДЭЭД ${best}`;
            ctx.font = `600 ${Math.round(10 * fs)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const tw = ctx.measureText(label).width + 16 * fs, sx = clamp(b.x, tw / 2 + 6, width - tw / 2 - 6);
            ctx.fillStyle = 'rgba(14,38,50,.86)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - tw / 2, sy - 9 * fs, tw, 18 * fs, 9 * fs) : ctx.rect(sx - tw / 2, sy - 9 * fs, tw, 18 * fs); ctx.fill();
            ctx.fillStyle = '#ffd58a'; ctx.fillText(label, sx, sy + .5);
        }
        function drawSnowGame() {
            const g = gravity(), from = throwOrigin();
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = aiming ? .25 : .3 + .25 * Math.sin(time * 3);
            const gr = pile.r * 3.2; ctx.drawImage(lightSprite('#bfe9ff'), pile.x - gr, pile.y - pile.r * .6 - gr, gr * 2, gr * 2); ctx.restore();
            if (aiming) {
                const dx = aiming.x - aiming.sx, dy = aiming.y - aiming.sy, pull = Math.hypot(dx, dy), m = pull ? Math.min(pull, 170 * S) / pull * .5 : 0;
                const hx = from.x + dx * m, hy = from.y + dy * m, v = throwVelocity(aiming);
                poly(ctx, [[from.x, from.y], [hx, hy]], null, 'rgba(30,70,95,.6)', 1.5);
                if (v) {
                    ctx.fillStyle = 'rgba(28,74,104,.78)';
                    for (let k = 1; k < 26; k++) { const t2 = k * .055, px = from.x + v.vx * t2, py = from.y + v.vy * t2 + g * t2 * t2 / 2; if (py > board.ground) break; ctx.beginPath(); ctx.arc(px, py, Math.max(.8, 2.6 - k * .08), 0, Math.PI * 2); ctx.fill(); }
                }
                const r = Math.max(4, 6.5 * S); oval(ctx, hx, hy, r, r, radial(ctx, hx, hy, r * .1, r, [[0, '#ffffff'], [1, '#b5cddb']], hx - r * .35, hy - r * .4));
            }
            for (const b of balls) oval(ctx, b.x, b.y, b.r, b.r, radial(ctx, b.x, b.y, b.r * .1, b.r, [[0, '#ffffff'], [1, '#b5cddb']], b.x - b.r * .35, b.y - b.r * .4));
            for (const q of puffs) { ctx.globalAlpha = 1 - q.life / q.max; oval(ctx, q.x, q.y, q.r, q.r, '#ffffff'); }
            ctx.globalAlpha = 1;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.round(15 * Math.max(.8, S))}px ui-monospace, Menlo, monospace`;
            for (const q of popups) { ctx.globalAlpha = 1 - q.life / 1.2; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,30,45,.8)'; ctx.strokeText(q.text, q.x, q.y - q.life * 40); ctx.fillStyle = '#ffd58a'; ctx.fillText(q.text, q.x, q.y - q.life * 40); }
            ctx.globalAlpha = 1;
        }

        /* ---------- New Year countdown in the sky above the tower ---------- */
        // ?nytest=SECONDS starts the countdown that many seconds before midnight (for previewing the celebration).
        const testSeconds = Number(new URLSearchParams(location.search).get('nytest'));
        const clockOffset = Number.isFinite(testSeconds) && testSeconds > 0 ? new Date(new Date().getFullYear() + 1, 0, 1).getTime() - testSeconds * 1000 - Date.now() : 0;
        let celebrating = false, celebrateClock = 0, lastSecond = -1;
        function updateNewYear(ny, dt) {
            if (ny.celebrating && !celebrating) {
                celebrating = true; celebrateClock = 0; flash = 1.5; sfx.boom(1.4); lastSecond = -1;
                root.querySelectorAll('.ny-year-tag').forEach(n => { n.textContent = `ШИНЭ ОН · ${ny.year}`; });
                root.querySelectorAll('.ny-year-eyebrow').forEach(n => { n.textContent = `ШИНЭ ОН ${ny.year} · LIGHT SHOW`; });
            } else if (!ny.celebrating && celebrating) celebrating = false;
            if (!celebrating && ny.remaining <= 10000) {
                const sec = Math.ceil(ny.remaining / 1000);
                if (sec !== lastSecond) { lastSecond = sec; flash = Math.max(flash, .9); sfx.tick(); }
            }
            if (celebrating && dt > 0) {
                celebrateClock -= dt;
                if (celebrateClock <= 0) { fireVolley(volley % 3 === 2 ? FLAG_COLORS : PALETTES.salute); sfx.boom(.7); celebrateClock = .6; }
            }
        }
        function glowText(text, x, y, font, alpha) {
            ctx.font = font; ctx.globalAlpha = alpha;
            ctx.shadowColor = 'rgba(255,186,80,.95)'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffd77e'; ctx.fillText(text, x, y);
            ctx.shadowBlur = 0; ctx.fillStyle = '#fff4d4'; ctx.fillText(text, x, y);
        }
        function countdownLayout() {
            const fs = clamp(width / 900, .72, 1), top = tower.project([0, 1, 0]);
            const x = mobile ? width / 2 : clamp(tower.cx, 150 * fs, width - 150 * fs), label = mobile ? 60 : top.y - 50 * fs;
            return { fs, x, label, main: label + 30 * fs };
        }
        function drawCountdown(ny) {
            const L = countdownLayout(), fs = L.fs;
            ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(3 * fs)}px`;
            const small = `600 ${Math.round(10 * fs)}px ui-monospace, Menlo, monospace`;
            if (celebrating) {
                const pulse = 1 + .06 * Math.sin(time * 6);
                glowText('✦ ШИНЭ ОНЫ МЭНД ХҮРГЭЕ ✦', L.x, L.label, small, 1);
                if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
                glowText(String(ny.year), L.x, L.main + 6 * fs, `700 ${Math.round(38 * fs * pulse)}px Georgia, serif`, 1);
            } else if (ny.remaining <= 10000) {
                const sec = Math.ceil(ny.remaining / 1000), frac = (ny.remaining / 1000) % 1;
                glowText('ШИНЭ ОН ИРЖ БАЙНА', L.x, L.label, small, 1);
                if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
                glowText(String(sec), L.x, L.main + 8 * fs, `700 ${Math.round((40 + frac * 14) * fs)}px Georgia, serif`, .6 + .4 * frac);
            } else {
                const c = formatCountdown(ny.remaining);
                glowText(`${ny.year} ОН ХҮРТЭЛ`, L.x, L.label, small, .9);
                if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(1 * fs)}px`;
                glowText(`${c.days ? c.days + ' өдөр  ' : ''}${c.clock}`, L.x, L.main, `700 ${Math.round(24 * fs)}px ui-monospace, Menlo, monospace`, 1);
            }
            ctx.restore();
        }

        /* ---------- A flying saucer occasionally drifts across the far sky ---------- */
        const saucer = { active: false, wait: 9, x: 0, baseY: 0, dir: 1, speed: 0, t: 0, spin: 0, rx: 16 };
        function updateSaucer(dt) {
            if (!saucer.active) {
                saucer.wait -= dt;
                if (saucer.wait <= 0) {
                    saucer.active = true; saucer.dir = random() < .5 ? 1 : -1; saucer.rx = (12 + random() * 7) * Math.max(.7, S); saucer.t = 0;
                    saucer.x = saucer.dir > 0 ? -60 : width + 60; saucer.baseY = skyTop + 30 + random() * Math.max(20, height * .3 - skyTop);
                    saucer.speed = (width + 120) / (10 + random() * 5);
                }
                return;
            }
            const mid = 1 - Math.min(1, Math.abs(saucer.x - width * .5) / (width * .3));
            saucer.t += dt; saucer.spin += dt * 3; saucer.x += saucer.dir * saucer.speed * (1 - .55 * mid) * dt;
            if (saucer.dir > 0 ? saucer.x > width + 70 : saucer.x < -70) { saucer.active = false; saucer.wait = 22 + random() * 30; }
        }
        function drawSaucerFar() {
            if (!saucer.active) return;
            const mid = 1 - Math.min(1, Math.abs(saucer.x - width * .5) / (width * .3)), y = saucer.baseY + Math.sin(saucer.t * 1.3) * 7 * S;
            ctx.save(); ctx.globalAlpha = .88; ctx.translate(saucer.x, y); ctx.rotate(saucer.dir * .07 + Math.sin(saucer.t * .9) * .035);
            drawSaucer(ctx, 0, 0, saucer.rx, time, saucer.spin, mid);
            ctx.restore();
        }

        /* ---------- Aurora sprayed from the hooves ---------- */
        function updateHoofAurora(dt) {
            for (let i = hoofAurora.length - 1; i >= 0; i--) {
                const q = hoofAurora[i]; q.life += dt;
                q.vx *= Math.pow(.96, dt * 60); q.vy = q.vy * Math.pow(.95, dt * 60) - 16 * S * dt; q.x += q.vx * dt; q.y += q.vy * dt;
                if (q.life > q.max) hoofAurora.splice(i, 1);
            }
            auroraBoost = Math.max(0, auroraBoost - dt * .25);
        }
        function drawHoofAurora() {
            if (!hoofAurora.length) return;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            for (const q of hoofAurora) {
                const k = q.life / q.max, a = Math.sin(Math.PI * Math.min(1, k * 1.15)) * .85, [r, g, b] = q.rgb || (q.rgb = hexRgb(q.color));
                const gr = ctx.createLinearGradient(q.x, q.y, q.x, q.y - q.len);
                gr.addColorStop(0, `rgba(${r},${g},${b},${a.toFixed(3)})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.strokeStyle = gr; ctx.lineWidth = q.w; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.sin(time * 2 + q.len) * 4, q.y - q.len); ctx.stroke();
            }
            ctx.restore();
        }

        /* ---------- Profile valley: background art, steam, river flow and a galloping herd ---------- */
        const about = root.querySelector('.ny-about'), herdBack = about.querySelector('.ny-herd-back'), herdFront = about.querySelector('.ny-herd-front');
        const hb = herdBack.getContext('2d'), hf = herdFront.getContext('2d'), herd = [], steam = [];
        let aboutW = 0, aboutH = 0, aboutVisible = false, herdRatio = 1, valley = null, valleyArt = null, steamClock = 0;
        const steamSprite = (() => { const c = offscreen(64, 64), x = c.getContext('2d'); x.fillStyle = radial(x, 32, 32, 0, 32, [[0, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, 64, 64); return c; })();
        const valleyFlakes = Array.from({ length: 70 }, () => ({ x: random(), y: random(), r: random() * 1.6 + .5, v: random() * .03 + .015 }));
        function sizeHerd() {
            const r = about.getBoundingClientRect(), g = about.querySelector('.ny-grid').getBoundingClientRect();
            if (!r.width || !r.height) return;
            aboutW = r.width; aboutH = r.height; herdRatio = Math.min(devicePixelRatio || 1, 1.5);
            for (const c of [herdBack, herdFront]) { c.width = Math.max(1, Math.round(aboutW * herdRatio)); c.height = Math.max(1, Math.round(aboutH * herdRatio)); }
            valleyArt = offscreen(aboutW * herdRatio, aboutH * herdRatio);
            const vc = valleyArt.getContext('2d'); vc.setTransform(herdRatio, 0, 0, herdRatio, 0, 0);
            let vs = 404; valley = paintWinterValley(vc, aboutW, aboutH, () => { vs = (vs * 16807) % 2147483647; return vs / 2147483647; }, g.top - r.top, g.bottom - r.top);
            herd.length = 0; steam.length = 0;
            drawHerd();
        }
        function laneFor(front) {
            const v = valley;
            if (front || random() < .35) return v.ground + (front ? 4 + random() * v.strip * .22 : -6 + random() * 10);
            return v.band + 60 + random() * Math.max(20, v.ground - v.band - 160);
        }
        function spawnRunner(initial) {
            if (!valley) return;
            const front = random() < .45, dir = random() < .5 ? 1 : -1, size = valley.k, y = laneFor(front);
            const far = !front && y < valley.ground - 20;
            herd.push({
                front, dir, y, scale: (front ? .5 + random() * .16 : far ? .3 + random() * .1 : .4 + random() * .1) * size, phase: random() * 6,
                wait: initial ? random() * 1.5 : .6 + random() * 2.8, x: initial ? 80 + random() * Math.max(10, aboutW - 160) : dir > 0 ? -130 : aboutW + 130,
                speed: (150 + random() * 110) * (front ? 1.1 : .78)
            });
        }
        function updateHerd(dt) {
            if (!valley) return;
            if (!herd.length) for (let i = 0; i < 6; i++) spawnRunner(true);
            for (let i = herd.length - 1; i >= 0; i--) {
                const r = herd[i];
                if (r.wait > 0) { r.wait -= dt; continue; }
                r.x += r.dir * r.speed * dt; r.phase += dt * r.speed / 13;
                if (r.dir > 0 ? r.x > aboutW + 140 : r.x < -140) { herd.splice(i, 1); spawnRunner(false); }
            }
            // Steam: thick over the hot spring, wisps along the warm river.
            steamClock += dt;
            const sp = valley.spring, k = valley.k;
            while (steamClock > .06) {
                steamClock -= .06;
                steam.push({ x: sp.x + (random() - .5) * sp.rx * 1.6, y: sp.y - 2, vx: (random() - .3) * 8 * k, vy: -(14 + random() * 14) * k, life: 0, max: 2.6 + random() * 1.6, r: (10 + random() * 10) * k });
                const p = valley.river[Math.floor(random() * valley.river.length)];
                if (p.y < aboutH && random() < .7) steam.push({ x: p.x + (random() - .5) * p.w, y: p.y, vx: (random() - .5) * 6 * k, vy: -(8 + random() * 8) * k, life: 0, max: 2 + random() * 1.4, r: (6 + random() * 8) * k * (.6 + p.w / 50) });
            }
            for (let i = steam.length - 1; i >= 0; i--) { const q = steam[i]; q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life > q.max) steam.splice(i, 1); }
            if (steam.length > 420) steam.splice(0, steam.length - 420);
        }
        function drawValley(c) {
            c.drawImage(valleyArt, 0, 0, aboutW, aboutH);
            const v = valley, k = v.k;
            // Flowing light streaks show the open water moving downstream.
            c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
            for (let n = 0; n < 70; n++) {
                const u = ((n * .618 + time * .025) % 1), i = Math.floor(u * (v.river.length - 2)), p = v.river[i];
                if (p.y > aboutH + 10) continue;
                const off = Math.sin(n * 7.3) * p.w * .32, len = (6 + p.w * .35);
                c.globalAlpha = .18 + .22 * Math.sin(n + time * 2) ** 2;
                c.strokeStyle = '#bff3ff'; c.lineWidth = Math.max(.8, p.w * .05);
                c.beginPath(); c.moveTo(p.x + p.nx * off, p.y + p.ny * off); c.lineTo(p.x + p.nx * off + p.tx * len, p.y + p.ny * off + p.ty * len); c.stroke();
            }
            c.globalAlpha = .35 + .15 * Math.sin(time * 1.7);
            oval(c, v.spring.x, v.spring.y, v.spring.rx * 1.4, v.spring.ry * 2.2, radial(c, v.spring.x, v.spring.y, 0, v.spring.rx * 1.4, [[0, 'rgba(140,255,240,.5)'], [1, 'rgba(140,255,240,0)']]));
            const [lx, ly] = v.lantern, lr = 26 * k * (1 + .08 * Math.sin(time * 9));
            c.globalAlpha = .9; c.drawImage(lightSprite('#ffc46a'), lx - lr, ly - lr, lr * 2, lr * 2);
            const cols = ['#ff5a6e', '#ffd36b', '#6fb6ff', '#8ee6b0'];
            for (const [x, y, q] of v.lights) {
                if (q < 0) { c.globalAlpha = .9; const r = 12 * k; c.drawImage(lightSprite('#ffe08a'), x - r, y - r, r * 2, r * 2); continue; }
                c.globalAlpha = .45 + .55 * Math.sin(time * 2.2 + x * .3 + y * .1) ** 2; const r = 6 * k; c.drawImage(lightSprite(cols[q]), x - r, y - r, r * 2, r * 2);
            }
            c.restore();
            for (const q of steam) { const a = Math.sin(Math.PI * q.life / q.max), r = q.r * (1 + q.life * .5); c.globalAlpha = a * .7; c.drawImage(steamSprite, q.x - r, q.y - r, r * 2, r * 2); }
            c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath();
            for (const f of valleyFlakes) { const x = ((f.x + Math.sin(time * .2 + f.y * 9) * .01) % 1) * aboutW, y = ((f.y + time * f.v) % 1) * aboutH; c.moveTo(x + f.r, y); c.arc(x, y, f.r, 0, Math.PI * 2); }
            c.fill();
        }
        function drawHerd() {
            if (!valley || !valleyArt) return;
            for (const [c, front] of [[hb, false], [hf, true]]) {
                c.setTransform(herdRatio, 0, 0, herdRatio, 0, 0); c.clearRect(0, 0, aboutW, aboutH);
                if (!front) drawValley(c);
                for (const r of herd.slice().sort((a, b) => a.y - b.y)) {
                    if (r.front !== front || r.wait > 0) continue;
                    const k = r.scale, foot = r.y + 64 * k, onSnow = r.y > valley.ground - 20;
                    c.globalAlpha = front ? 1 : .78;
                    oval(c, r.x, foot, 62 * k, 7 * k, onSnow ? 'rgba(70,110,140,.28)' : 'rgba(150,200,230,.14)');
                    for (let q = 0; q < 6; q++) { const a = (r.phase * .3 + q / 6) % 1; c.globalAlpha = (front ? .75 : .5) * (1 - a); oval(c, r.x - r.dir * (40 + a * 70) * k, foot - a * 18 * k, (3 + a * 7) * k, (3 + a * 6) * k, '#f2f8ff'); }
                    c.globalAlpha = front ? 1 : .8;
                    c.save(); c.translate(r.x, r.y + Math.sin(r.phase) * 3 * k); c.scale(k * r.dir, k); c.translate(-16, 6); drawReindeerBody(c, r.phase, true, time); c.restore();
                }
                c.globalAlpha = 1;
            }
        }
        const aboutResize = new ResizeObserver(sizeHerd); aboutResize.observe(about);
        const aboutSeen = new IntersectionObserver(entries => { aboutVisible = entries.some(e => e.isIntersecting); if (aboutVisible) drawHerd(); }); aboutSeen.observe(about);
        // Name: the nickname turns into the full name on hover; the surname stays blurred until the
        // pointer comes close to it. On touch, the first tap shows the name, the second the surname.
        const nameEl = about.querySelector('.ny-name'), nickEl = about.querySelector('.ny-name-nick'), lastEl = about.querySelector('.ny-name-last');
        const rectDist = (el, x, y) => { const r = el.getBoundingClientRect(); return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); };
        let nameTimer = null;
        function nameMove(e) {
            if (!nameEl || e.pointerType === 'touch') return;
            const onNick = rectDist(nickEl, e.clientX, e.clientY) < 6, inName = rectDist(nameEl, e.clientX, e.clientY) < 24;
            const full = onNick || (nameEl.classList.contains('full') && inName);
            nameEl.classList.toggle('full', full);
            nameEl.classList.toggle('near-last', full && !!lastEl && rectDist(lastEl, e.clientX, e.clientY) < 34);
        }
        if (nameEl) {
            window.addEventListener('pointermove', nameMove, { passive: true });
            nameEl.addEventListener('focus', () => nameEl.classList.add('full'));
            nameEl.addEventListener('blur', () => nameEl.classList.remove('full', 'near-last'));
            nameEl.addEventListener('click', () => {
                if (!matchMedia('(hover: none)').matches) return;
                if (nameEl.classList.contains('full')) nameEl.classList.add('near-last'); else nameEl.classList.add('full');
                clearTimeout(nameTimer); nameTimer = setTimeout(() => nameEl.classList.remove('full', 'near-last'), 8000);
            });
        }
        root.addEventListener('click', e => {
            const s2 = e.target.closest('.ny-secret');
            if (s2 && matchMedia('(hover: none)').matches && !s2.classList.contains('revealed')) { e.preventDefault(); s2.classList.add('revealed'); }
        });

        /* ---------- Frame ---------- */
        function resetShow() { shells.length = 0; bursts.length = 0; flagVolleys = 0; flagSaluted = false; launchClock = .3; flagFill = 0; lastShowKey = ''; }
        const weightOf = (state, name) => (state.effect === name ? state.blend : 0) + (state.previous === name ? 1 - state.blend : 0);
        function scene(dt) {
            let state = showState(config, time - programStart);
            const t = time * config.speed, ny = newYearClock(Date.now() + clockOffset);
            paintShow(state);
            updateNewYear(ny, dt);
            if (celebrating) state = { ...state, effect: 'salute', previous: null, blend: 1 };
            const wFlag = weightOf(state, 'flag'), flagLocal = state.effect === 'flag' ? state.local : state.previous === 'flag' ? 99 : 0;
            if (state.effect === 'flag') {
                const fp = flagProgress(state.local); flagFill = fp.hoist;
                if (state.local < .3) flagSaluted = false;
                if (fp.raised && !flagSaluted) { flagSaluted = true; flagVolleys = 3; flagVolleyClock = 0; }
            } else if (state.previous !== 'flag') flagFill = 0;
            if (dt > 0) { updateFireworks(dt, weightOf(state, 'salute'), t); updateSnowballs(dt); updateHoofAurora(dt); updateSaucer(dt); }
            aimBeams(dt || 1, t, flagProgress(flagLocal).pole >= 1 ? wFlag : 0);
            const pal = paletteFor(state.effect, config.colors);
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
            ctx.drawImage(back, 0, 0, width, height);
            // The aurora and the star on the summit stay on whatever the program does.
            drawSky(t, Math.min(1.4, Math.max(weightOf(state, 'aurora'), .6) + auroraBoost * .6)); drawSmoke();
            drawSaucerFar();
            drawFireworks(time);
            ctx.drawImage(tower.steel, tower.bx0, tower.by0, tower.bw, tower.bh);
            drawBulbs(state, t);
            drawRings(weightOf(state, 'olympic'));
            const top = tower.project([0, .945, 0]); drawStar(top.x, top.y, tower.size * .034, 1, t);
            drawLamps();
            drawCountdown(ny);
            ctx.drawImage(front, 0, 0, width, height);
            drawDecorLights(t, pal);
            paintSnowman(); drawBoard();
            drawFlag(flagLocal, wFlag, time);
            drawRoad();
            drawBeams();
            drawHoofAurora();
            drawDeer();
            drawSnowGame();
            drawSnow();
            drawFestoon(t, pal);
        }
        function resize() {
            const rect = canvas.getBoundingClientRect(), oldWidth = width, oldHeight = height;
            width = Math.max(1, rect.width); height = Math.max(1, rect.height);
            if (!deer.initialized) { deer.x = width * .82; deer.y = height * .36; deer.initialized = true; }
            else {
                deer.x *= width / oldWidth; deer.y *= height / oldHeight;
                for (const p of [deer.from, deer.target]) if (p) { p.x *= width / oldWidth; p.y *= height / oldHeight; }
            }
            ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            mobile = width < 500; S = clamp(width / 900, .55, 1); G = height * .75; roadTop = height - 96; roadBottom = height - 64;
            prepareTower(); paintBack(); paintFront(); preparePole();
            const cd = countdownLayout(); skyTop = cd.main + 10;
            if (!deer.moving) deer.y = clamp(deer.y, skyTop + 110 * deerScale(), height * .55);
            beams.forEach(b => { b.ready = false; }); dirty = true;
        }
        const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
        function tick(now) {
            if (disposed) return;
            const dt = Math.min((now - last) / 1000 || 0, .05), active = !paused && !document.hidden; last = now;
            if (active) { time += dt; updateDeer(dt); }
            if (!document.hidden && (active || dirty)) { scene(active ? dt : 0); dirty = false; }
            if (active && aboutVisible) { updateHerd(dt); drawHerd(); }
            frame = requestAnimationFrame(tick);
        }
        run();
        frame = requestAnimationFrame(tick);
        root._winterCleanup = () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); aboutResize.disconnect(); aboutSeen.disconnect(); window.removeEventListener('pointermove', nameMove); clearTimeout(nameTimer); music.dispose(); sfx.dispose(); document.removeEventListener('visibilitychange', visibilityChanged); window.removeEventListener('pagehide', root._winterCleanup); };
        window.addEventListener('pagehide', root._winterCleanup, { once: true });
        // Test/debug hook: jump the program clock (used by automated screenshots).
        root._winterSeek = seconds => { time = programStart + seconds; dirty = true; };
        root._winterTime = () => (time - programStart).toFixed(2);
        root._winterAdvance = seconds => { for (let k = 0; k < seconds * 30; k++) { time += 1 / 30; updateDeer(1 / 30); scene(1 / 30); updateHerd(1 / 30); } drawHerd(); };
        root._winterThrow = (dx, dy) => { const a = { x: pile.x + dx, y: pile.y + dy, sx: pile.x, sy: pile.y }; aiming = a; dirty = true; return () => { throwBall(a); aiming = null; }; };
        root._winterMagic = () => deerMagic();
        root._winterUfo = () => { saucer.wait = 0; saucer.active = false; };
    }
    window.ProfileTemplates = window.ProfileTemplates || {};
    window.ProfileTemplates['new-year'] = { render, parseCommands: parse, createTowerModel, beatStyle, flightPosition, createSkyMusic, createSfx, showState, flagProgress, drawMongolianFlag, profileHtml, newYearClock, formatCountdown, aimVelocity, EFFECTS, presets };
}());
