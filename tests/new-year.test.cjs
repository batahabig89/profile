// Run with: node --test tests/new-year.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../templates/new-year/new-year.js'), 'utf8'), sandbox);
const api = sandbox.window.ProfileTemplates['new-year'];
const { parseCommands: parse, createTowerModel, showState, flagProgress } = api;

test('tower has exactly 10,000 distinct, finite, deterministic 3D light positions', () => {
    const a = createTowerModel(), b = createTowerModel();
    assert.equal(a.lights.length, 10000);
    assert.equal(new Set(a.lights.map(l => l.point.join(','))).size, 10000);
    assert(a.lights.every(l => l.point.length === 3 && l.point.every(Number.isFinite)));
    assert(a.lights.some(l => l.point[2] < 0) && a.lights.some(l => l.point[2] > 0));
    assert(a.lights.every(l => l.point[1] >= 0 && l.point[1] <= 1));
    assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('default program is a show that ends with the Mongolian flag', () => {
    const c = parse('');
    assert.deepEqual([...c.effects], ['tree', 'salute', 'gold', 'aurora', 'flag']);
    assert.equal(c.loop, false);
    assert.equal(c.duration, 8);
    assert.equal(c.colors, null);
    assert.equal(c.beams, 'sweep');
    assert.throws(() => parse('rotate 1'), /хөдөлгөөнгүй/);
    for (const [name, source] of Object.entries(api.presets)) assert.doesNotThrow(() => parse(source), name);
    assert.equal(api.presets.olympic !== undefined, true); // effect stays available from code
    assert.equal(parse(api.presets.show).effects.at(-1), 'flag');
});

test('editor accepts every effect, sequences, aliases, projector modes, colors and comments', () => {
    for (const effect of api.EFFECTS) assert.deepEqual([...parse('effect ' + effect).effects], [effect]);
    assert.deepEqual([...parse('effect tree fireworks flag').effects], ['tree', 'salute', 'flag']);
    for (const mode of ['sweep', 'fan', 'still', 'follow', 'off']) assert.equal(parse('beams ' + mode).beams, mode);
    const c = parse('// show\ncolor #FF00FF #00aaff\nbeamcolor #aaffff\nbrightness 0 // dark\nspeed 0\nsnow 0\nduration 2\nloop on');
    assert.equal(c.colors.join(','), '#FF00FF,#00aaff');
    assert.equal(c.beamcolor, '#aaffff');
    assert.equal(c.brightness, 0);
    assert.equal(c.speed, 0);
    assert.equal(c.snow, 0);
    assert.equal(c.duration, 2);
    assert.equal(c.loop, true);
    assert.equal(parse('color #ffffff\ncolor auto').colors, null);
});

test('bad input reports its line and does not mutate previously parsed settings', () => {
    const previous = parse('color #ffffff\nbeams off');
    const before = JSON.stringify(previous);
    for (const source of ['color red', 'color #fff', 'color', 'beams spin', 'beams', 'beamcolor #fff', 'beamcolor red', 'snow 2', 'brightness 3', 'speed -1', 'speed Infinity', 'speed NaN', 'speed 1 2', 'effect other', 'effect', 'effect tree tree tree tree tree tree tree tree tree', 'duration 1', 'duration 61', 'loop maybe', 'alert(1)', 'x'.repeat(6001)]) assert.throws(() => parse(source), source);
    assert.throws(() => parse('// comment\nsnow 9'), /2-р мөр/);
    try { parse('speed 1\n\nflag up'); } catch (e) { assert.equal(e.line, 3); }
    assert.equal(JSON.stringify(previous), before);
    assert.notEqual(parse('').effects, parse('').effects);
});

test('show steps through effects, crossfades, and holds the last one unless looping', () => {
    const c = parse('effect tree salute flag\nduration 5');
    assert.equal(showState(c, 0).effect, 'tree');
    assert.equal(showState(c, 0).previous, null);
    assert.equal(showState(c, 5.1).effect, 'salute');
    assert.equal(showState(c, 5.1).previous, 'tree');
    assert(showState(c, 5.1).blend < showState(c, 5.9).blend);
    assert.equal(showState(c, 6.5).blend, 1);
    assert.equal(showState(c, 10.2).effect, 'flag');
    assert.equal(showState(c, 500).effect, 'flag');
    assert(showState(c, 500).local > 400);
    const looped = parse('effect tree salute flag\nduration 5\nloop on');
    assert.equal(showState(looped, 15.5).effect, 'tree');
    assert.equal(showState(looped, 15.5).previous, 'flag');
    assert.equal(showState(parse('effect gold'), 99).blend, 1);
});

test('flag ceremony raises the pole first, then hoists the flag to the top', () => {
    assert.equal(flagProgress(0).pole, 0);
    assert.equal(flagProgress(0).hoist, 0);
    assert.equal(flagProgress(1.2).pole, 1);
    assert.equal(flagProgress(1.2).hoist, 0);
    let last = -1;
    for (let t = 1.2; t <= 9.2; t += .25) { const h = flagProgress(t).hoist; assert(h >= last); last = h; }
    assert.equal(flagProgress(9.2).hoist, 1);
    assert.equal(flagProgress(9.2).raised, true);
    assert.equal(flagProgress(5).raised, false);
});

test('flag texture paints red-blue-red stripes and a gold Soyombo on the hoist side', () => {
    const fills = [];
    const ctx = new Proxy({}, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'fillRect') return (x, y, w, h) => fills.push({ color: target.fillStyle, x, w });
            if (key === 'fill') return () => fills.push({ color: target.fillStyle, path: true });
            return () => {};
        },
        set(target, key, value) { target[key] = value; return true; }
    });
    api.drawMongolianFlag(ctx, 300, 150);
    assert.equal(fills[0].color, '#da2032'); assert.equal(fills[0].w, 300);
    assert.equal(fills[1].color, '#0066b3'); assert.equal(fills[1].x, 100); assert.equal(fills[1].w, 100);
    assert(fills.filter(f => f.color === '#ffd900').length >= 8);
});

test('New Year clock counts down to local midnight on 1 January, then celebrates', () => {
    const { newYearClock, formatCountdown } = api;
    const eve = new Date(2026, 11, 31, 23, 59, 50).getTime();
    const c = newYearClock(eve);
    assert.equal(c.celebrating, false); assert.equal(c.year, 2027); assert.equal(c.remaining, 10000);
    const party = newYearClock(new Date(2027, 0, 1, 0, 0, 30).getTime());
    assert.equal(party.celebrating, true); assert.equal(party.year, 2027); assert.equal(party.since, 30000);
    const after = newYearClock(new Date(2027, 0, 1, 0, 5, 0).getTime());
    assert.equal(after.celebrating, false); assert.equal(after.year, 2028);
    assert.deepEqual({ ...formatCountdown(46 * 86400000 + 4 * 3600000 + 9 * 60000 + 51000) }, { days: 46, seconds: 46 * 86400 + 14991, clock: '04:09:51' });
    assert.equal(formatCountdown(400).clock, '00:00:01');
    assert.equal(formatCountdown(-5).seconds, 0);
});

test('snowball auto-aim lands exactly on the aimed point', () => {
    const { aimVelocity } = api;
    const from = { x: 10, y: 300 }, to = { x: 600, y: 200 }, g = 900, T = .85, v = aimVelocity(from, to, g, T);
    assert(Math.abs(from.x + v.vx * T - to.x) < 1e-9);
    assert(Math.abs(from.y + v.vy * T + g * T * T / 2 - to.y) < 1e-9);
    assert(v.vy < 0);
});

test('sound effects stay silent and safe without Web Audio', () => {
    const sfx = api.createSfx();
    assert.doesNotThrow(() => { sfx.unlock(); sfx.bells(); sfx.shimmer(); sfx.whoosh(); sfx.splat(); sfx.thud(); sfx.tick(); sfx.boom(); sfx.mute(true); sfx.dispose(); });
});

test('profile shows the nickname, with the full name ready and the surname wrapped for blurring', () => {
    const html = api.profileHtml({ personalInfo: { name: 'Batbayar Altankhuyag', nickname: 'Bataha', title: 'Engineer', email: 'a@b.c' }, experience: [{ company: 'X', role: 'Dev', duration: { start: '2011-9', end: 'Present' } }] });
    assert.match(html, /<span class="ny-name-nick" aria-hidden="true">Bataha<\/span>/);
    assert.match(html, /<span class="ny-name-full" aria-hidden="true">Batbayar <span class="ny-name-last">Altankhuyag<\/span><\/span>/);
    assert.match(html, /aria-label="Bataha"/);
    assert.match(html, /ny-secret/);
    assert.match(html, /class="ny-grandpa"/);
    assert.match(html, /aria-label="Цасан өвгөн — цэнхэр монгол дээлтэй"/);
    assert.doesNotMatch(html, /<img /);
    assert.match(api.profileHtml({ personalInfo: { nickname: 'Solo' } }), /<h2>Solo<\/h2>/);
    assert.doesNotMatch(api.profileHtml({ personalInfo: { name: '<b>x</b> y' } }), /<b>x<\/b>/);
});

test('reindeer reaches the target exactly and can redirect from its current position', () => {
    const { flightPosition } = api;
    const from = { x: 100, y: 200 }, to = { x: 700, y: 300 };
    for (const p of [-1, 0]) assert.equal(JSON.stringify(flightPosition(from, to, p)), JSON.stringify(from));
    for (const p of [1, 2]) {
        const arrived = flightPosition(from, to, p);
        assert.equal(arrived.x, to.x); assert(Math.abs(arrived.y - to.y) < 1e-9);
    }
    const middle = flightPosition(from, to, .5);
    assert(middle.x > from.x && middle.x < to.x);
    assert(middle.y < (from.y + to.y) / 2);
    assert.equal(JSON.stringify(flightPosition(middle, from, 0)), JSON.stringify(middle));
});

test('light effects change on beat boundaries with a smoothly decaying pulse', () => {
    const { beatStyle } = api;
    assert.equal(beatStyle(0).effect, 'wave');
    assert.equal(beatStyle(.999).effect, 'wave');
    assert.equal(beatStyle(1).effect, 'chase');
    assert.equal(beatStyle(2).effect, 'twinkle');
    assert.equal(beatStyle(3).effect, 'pulse');
    assert.equal(beatStyle(4).effect, 'wave');
    assert(beatStyle(.1).pulse > beatStyle(.9).pulse);
    assert.equal(beatStyle(1).pulse, 1);
});

test('music is lazy, uses one audio clock, supports mute, and closes on cleanup', () => {
    const { createSkyMusic } = api;
    let contexts = 0, audio, master, tones = 0;
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
    sandbox.window.AudioContext = class {
        constructor() { contexts++; audio = this; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        createGain() { const node = { gain: param(), connect() {}, disconnect() {} }; if (!master) master = node; return node; }
        createOscillator() { tones++; return { frequency: param(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
    };
    const music = createSkyMusic();
    assert.equal(contexts, 0); assert.equal(music.beat, null);
    music.start(); music.start(); music.update();
    assert.equal(contexts, 1); assert(tones > 0); assert(master.gain.value > 0);
    audio.currentTime = .04 + 60 / 108;
    assert(Math.abs(music.beat - 1) < 1e-9);
    music.mute(true); assert.equal(master.gain.value, 0); assert.equal(music.playing, true);
    music.mute(false); assert(master.gain.value > 0);
    music.stop(); assert.equal(music.playing, false); assert.equal(music.beat, null); assert.equal(master.gain.value, 0);
    music.dispose(); assert.equal(audio.state, 'closed');
    delete sandbox.window.AudioContext;
});

test('unsupported audio still allows a silent rhythm fallback', () => {
    const music = api.createSkyMusic();
    assert.doesNotThrow(() => { music.start(); music.update(); music.mute(true); music.stop(); music.dispose(); });
    assert.equal(music.playing, false); assert.equal(music.beat, null);
});
