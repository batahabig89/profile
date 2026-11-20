// Run with: node --test tests/space.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../templates/space/space.js'), 'utf8'), sandbox);
const api = sandbox.window.ProfileTemplates.space;

test('figure-eight three-body orbit returns to its start and conserves energy', () => {
    const b = api.figureEight(), start = JSON.parse(JSON.stringify(b)), e0 = api.energy(b);
    // Softening stretches the period slightly (≈6.37 instead of 6.33); find the closest return.
    let best = Infinity;
    for (let i = 1; i <= 7000; i++) {
        api.step(b, .001, null);
        if (i > 5800) best = Math.min(best, b.reduce((m, p, j) => m + Math.hypot(p.x - start[j].x, p.y - start[j].y), 0));
    }
    assert(best < .1, 'returns to the start: ' + best);
    assert(Math.abs(api.energy(b) - e0) < 1e-3);
    const px = b.reduce((s, p) => s + p.m * p.vx, 0), py = b.reduce((s, p) => s + p.m * p.vy, 0);
    assert(Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9);
});

test('a flung sun moves away but stays gravitationally pulled back', () => {
    const b = api.figureEight(); b[0].vx = 2; b[0].vy = 0;
    const [ax] = api.accelerations(b, null);
    const d0 = Math.hypot(b[0].x - b[2].x, b[0].y - b[2].y);
    for (let i = 0; i < 200; i++) api.step(b, .002, null);
    assert(Math.hypot(b[0].x - b[2].x, b[0].y - b[2].y) !== d0);
    assert(ax[0] > 0, 'sun 0 is pulled toward the others');
});

test('X boson: weightlessness switches gravity off, the well pulls everything in', () => {
    const b = api.figureEight();
    const [ax0, ay0] = api.accelerations(b, null);
    const [axz, ayz] = api.accelerations(b, { mode: 'zero', x: 0, y: 0, strength: 1, radius: 10 });
    for (let i = 0; i < 3; i++) assert(Math.hypot(axz[i], ayz[i]) <= Math.hypot(ax0[i], ay0[i]) * .2 + 1e-9);
    assert(Math.hypot(ax0[0], ay0[0]) > .1, 'without the boson the suns pull each other');
    const probe = [{ x: 1, y: 0, vx: 0, vy: 0, m: 0 }];
    const [axw] = api.accelerations(probe, { mode: 'well', x: 0, y: 0, strength: 1, mass: 4 });
    assert(axw[0] < 0);
    const [axn] = api.accelerations(probe, { mode: 'well', x: 0, y: 0, strength: 0, mass: 4 });
    assert.equal(axn[0], 0);
});

test('black hole lensing pushes images outward and vanishes far away', () => {
    assert(api.lensImage(10, 20) > 10);
    assert(Math.abs(api.lensImage(1e6, 20) - 1e6) < 1);
    assert(Math.abs(api.lensImage(0, 20) - 20) < 1e-9);
});

test('counter-rotating hydrogen beams meet at the detector and approach light speed', () => {
    const d = Math.PI / 2, [a, b] = api.beamAngles(Math.PI, d);
    assert(Math.abs(Math.cos(a) - Math.cos(b)) < 1e-12 && Math.abs(Math.sin(a) - Math.sin(d)) < 1e-12);
    assert.equal(api.meetsAtDetector(3, 3.2), true);
    assert.equal(api.meetsAtDetector(3.2, 6), false);
    assert(api.beamSpeed(.6) < .1 && api.beamSpeed(16) > .99 && api.beamSpeed(100) < 1);
});

test('profile shows the nickname only and escapes data', () => {
    const html = api.profileHtml({ personalInfo: { name: 'Batbayar Altankhuyag', nickname: 'Bataha', email: 'a@b.c' } });
    assert.match(html, /<h2>Bataha<\/h2>/);
    assert.doesNotMatch(html, /Altankhuyag/);
    assert.doesNotMatch(api.profileHtml({ personalInfo: { nickname: '<b>x</b>' } }), /<b>x<\/b>/);
});

test('3D: bodies off the plane pull each other in z, and the camera projects depth with perspective', () => {
    const b = [{ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 1 }, { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, m: 1 }];
    const [, , az] = api.accelerations(b, null);
    assert(az[0] > 0 && az[1] < 0);
    const near = api.viewProject(0, 1, 0, 0, .5), far = api.viewProject(0, -1, 0, 0, .5);
    assert(near.depth > 0 && far.depth < 0 && near.p > 1 && far.p < 1);
    const flat = api.figureEight(); for (let i = 0; i < 500; i++) api.step(flat, .002, null);
    assert(flat.every(p => p.z === 0), 'the figure-eight stays in its plane');
});
