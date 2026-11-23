/* Space template: a three-body sky (drag a sun), a black hole with its event horizon,
   and a particle accelerator whose hydrogen collisions release an X boson that bends gravity. */
(function () {
    'use strict';
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- Physics (pure, unit-tested) ---------- */
    const EPS = 0.06;
    // Chenciner–Montgomery figure-eight: three equal suns chasing each other on one curve.
    function figureEight() {
        const v3 = [-0.93240737, -0.86473146];
        return [
            { x: -0.97000436, y: 0.24308753, vx: -v3[0] / 2, vy: -v3[1] / 2, m: 1 },
            { x: 0.97000436, y: -0.24308753, vx: -v3[0] / 2, vy: -v3[1] / 2, m: 1 },
            { x: 0, y: 0, vx: v3[0], vy: v3[1], m: 1 }
        ];
    }
    // field: { mode: 'zero' | 'well', x, y, strength 0–1, radius, mass }
    // 'zero' switches gravity off around the boson (weightlessness); 'well' is an extra point mass.
    function gravityScale(b, field) {
        if (!field || field.mode !== 'zero' || field.strength <= 0) return 1;
        const d = Math.hypot(b.x - field.x, b.y - field.y, (b.z || 0) - (field.z || 0));
        return 1 - field.strength * smooth(1 - d / field.radius);
    }
    // Bodies live in 3D (z defaults to 0, so the planar figure-eight stays planar).
    function accelerations(bodies, field) {
        const n = bodies.length, ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n), sc = bodies.map(b => gravityScale(b, field));
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, dz = (b.z || 0) - (a.z || 0), r2 = dx * dx + dy * dy + dz * dz + EPS * EPS;
            const g = sc[i] * sc[j] / (r2 * Math.sqrt(r2));
            ax[i] += g * b.m * dx; ay[i] += g * b.m * dy; az[i] += g * b.m * dz; ax[j] -= g * a.m * dx; ay[j] -= g * a.m * dy; az[j] -= g * a.m * dz;
        }
        if (field && field.mode === 'well' && field.strength > 0) {
            for (let i = 0; i < n; i++) {
                const dx = field.x - bodies[i].x, dy = field.y - bodies[i].y, dz = (field.z || 0) - (bodies[i].z || 0), r2 = dx * dx + dy * dy + dz * dz + .15;
                const g = field.mass * field.strength / (r2 * Math.sqrt(r2));
                ax[i] += g * dx; ay[i] += g * dy; az[i] += g * dz;
            }
        }
        return [ax, ay, az];
    }
    // Leapfrog (kick–drift–kick): symplectic, keeps the orbits from drifting in energy.
    function step(bodies, dt, field) {
        let [ax, ay, az] = accelerations(bodies, field);
        bodies.forEach((b, i) => { b.vx += ax[i] * dt / 2; b.vy += ay[i] * dt / 2; b.vz = (b.vz || 0) + az[i] * dt / 2; b.x += b.vx * dt; b.y += b.vy * dt; b.z = (b.z || 0) + b.vz * dt; });
        [ax, ay, az] = accelerations(bodies, field);
        bodies.forEach((b, i) => { b.vx += ax[i] * dt / 2; b.vy += ay[i] * dt / 2; b.vz += az[i] * dt / 2; });
    }
    function energy(bodies) {
        let e = 0;
        bodies.forEach((a, i) => {
            e += .5 * a.m * (a.vx * a.vx + a.vy * a.vy + (a.vz || 0) ** 2);
            for (let j = i + 1; j < bodies.length; j++) { const b = bodies[j]; e -= a.m * b.m / Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z || 0) - (b.z || 0)) ** 2 + EPS * EPS); }
        });
        return e;
    }
    // Perspective camera looking at the orbital plane from an elevation, slowly circling it.
    // Returns screen offsets in units, depth (toward the viewer is positive) and the perspective factor.
    function viewProject(x, y, z, az, el) {
        const xr = x * Math.cos(az) - y * Math.sin(az), yr = x * Math.sin(az) + y * Math.cos(az);
        const depth = yr * Math.cos(el) + z * Math.sin(el), p = 4.5 / (4.5 - depth);
        return { u: xr * p, v: (yr * Math.sin(el) - z * Math.cos(el)) * p, depth, p };
    }
    // Gravitational lens: a star at distance d from the hole appears at the primary image distance.
    function lensImage(d, einstein) { return (d + Math.sqrt(d * d + 4 * einstein * einstein)) / 2; }
    // Two counter-rotating beams start opposite each other; they meet at the detector whenever
    // the travelled angle s crosses an odd multiple of π.
    function beamAngles(s, detector) { return [detector + Math.PI + s, detector + Math.PI - s]; }
    function meetsAtDetector(prev, s) { return Math.floor((prev - Math.PI) / TAU) < Math.floor((s - Math.PI) / TAU); }
    function beamSpeed(omega) { return Math.min(.999999, .05 + .949999 * (1 - Math.exp(-Math.max(0, omega - .6) / 3.2))); }

    /* ---------- Profile ---------- */
    // Small line icons for the profile (stroke = currentColor).
    const ICONS = {
        rocket: '<path d="M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10z"/><circle cx="12" cy="10" r="2"/><path d="M9 16l-3 4 4-1M15 16l3 4-4-1M12 18v4"/>',
        satellite: '<rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)"/><path d="M4 4l4 4M16 16l4 4M2 8l4-4 3 3-4 4zM22 16l-4 4-3-3 4-4z"/><path d="M15 6a4 4 0 013 3"/>',
        planet: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>',
        telescope: '<path d="M3 11l13-5 2 5-13 5zM16 6l3-1 2 5-3 1M9 15l-2 6M11 14l3 7"/>',
        comet: '<circle cx="17" cy="7" r="3"/><path d="M15 9L4 20M13 6L5 14M18 10l-6 10"/>',
        star: '<path d="M12 2l2.6 6.6L21 9l-5 4.4L17.6 21 12 17l-5.6 4L8 13.4 3 9l6.4-.4z"/>',
        pin: '<path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        phone: '<path d="M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z"/>'
    };
    // Project badges: a space icon on a glowing coloured disc (emoji from the data are not used,
    // because some systems render them as "?").
    const PROJECT_BADGES = [['planet', 265], ['satellite', 195], ['rocket', 20], ['comet', 320], ['telescope', 150], ['star', 45]];
    const icon = (name, cls) => `<svg class="sp-ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
    function profileHtml(data) {
        const info = data.personalInfo || {}, name = info.nickname || String(info.name || '').split(/\s+/)[0];
        const exp = data.experience || [], loc = (info.location || []).join(', ');
        const starts = exp.map(e => parseInt(String((e.duration || {}).start || ''), 10)).filter(Number.isFinite);
        const years = starts.length ? new Date().getFullYear() - Math.min(...starts) : 0;
        const skillCount = Object.values(data.workSkills || {}).reduce((n, l) => n + (l || []).length, 0);
        const tags = list => (list || []).map(x => `<span>✦ ${esc(String(x).replace(/,\s*$/, ''))}</span>`).join('');
        const secret = (text, href, ic) => `<a class="sp-chip sp-secret" href="${esc(href)}">${icon(ic)} <span>${esc(text)}</span></a>`;
        const head = (ic, title, sub) => `<header class="sp-card-head">${icon(ic, 'sp-ic-lg')}<div><h3>${esc(title)}</h3>${sub ? `<small>${esc(sub)}</small>` : ''}</div></header>`;
        const stat = (value, label, ic) => `<div class="sp-stat">${icon(ic)}<b>${esc(value)}</b><span>${esc(label)}</span></div>`;
        // The introduction as a planetary system: the person is the star, each section a planet.
        const planets = [['exp', 'earth', 'Туршлага', 'Дэлхий', 205], ['edu', 'mars', 'Боловсрол', 'Ангараг', 15], ['skills', 'jupiter', 'Ур чадвар', 'Бархасбадь', 30], ['proj', 'saturn', 'Төслүүд', 'Санчир', 45], ['comm', 'neptune', 'Холбоо', 'Далайн ван', 225]];
        const system = `<div class="sp-system" role="tablist" aria-label="Профайлын гаригийн систем"><canvas class="sp-system-canvas" aria-hidden="true"></canvas>`
            + `<div class="sp-star" aria-hidden="true"><b>${esc(name)}</b><small>${esc(String(info.title || '').split('|')[0].trim())}</small></div>`
            + planets.map(([id, kind, lbl, pname, h], i) => `<button type="button" class="sp-planet${i ? '' : ' is-active'}" role="tab" id="sp-t-${id}" aria-selected="${!i}" aria-controls="sp-p-${id}" data-panel="${id}" data-kind="${kind}" style="--h:${h}"><span class="sp-planet-body"></span><span class="sp-planet-label">${lbl}<small>${pname}</small></span></button>`).join('')
            + `</div>`;
        const panel = (id, extra) => `<article class="sp-card sp-panel${id === 'exp' ? ' is-active' : ''}${extra || ''}" role="tabpanel" id="sp-p-${id}" aria-labelledby="sp-t-${id}" data-panel="${id}">`;
        return `<section class="sp-about" aria-label="Профайл"><canvas class="sp-about-bg" aria-hidden="true"></canvas><div class="sp-about-inner">`
            + `<header class="sp-about-head"><div class="sp-emblem" aria-hidden="true"><span class="sp-orbit"><i></i></span><span class="sp-orbit sp-orbit2"><i></i></span>${icon('planet', 'sp-emblem-ic')}</div>`
            + `<div class="sp-about-text"><span class="sp-eyebrow">${icon('star')} ОПЕРАТОР · PROFILE</span><h2>${esc(name)}</h2><p class="sp-role">${esc(info.title)}</p>`
            + `<p class="sp-summary">${esc(((data.summary || {}).lines || []).join(' · '))}</p><div class="sp-chips">${loc ? `<span class="sp-chip">${icon('pin')} ${esc(loc)}</span>` : ''}${info.email ? secret(info.email, 'mailto:' + info.email, 'mail') : ''}${info.phone ? secret(info.phone, 'tel:' + String(info.phone).replace(/\s+/g, ''), 'phone') : ''}</div></div>`
            + `<div class="sp-stats">${years ? stat(years + '+', 'жил тойрог замд', 'rocket') : ''}${stat((data.projects || []).length, 'төсөл', 'planet')}${stat(skillCount, 'ур чадвар', 'satellite')}</div></header>`
            + `<div class="sp-system-wrap">${system}<div class="sp-panels">${panel('exp')}${head('rocket', 'Нислэгийн бүртгэл', 'Ажлын туршлага')}<ol class="sp-timeline">${exp.map((e, i) => { const d = e.duration || {}; return `<li style="--i:${i}"><span class="sp-when">${esc(d.start)} — ${esc(d.end)}</span><b>${esc(e.role)}</b><em>${esc(e.company)}</em>${(e.description || []).map(x => `<p>${esc(x)}</p>`).join('')}</li>`; }).join('')}</ol></article>`
            + `${panel('skills')}${head('satellite', 'Бортын системүүд', 'Ур чадвар')}${Object.entries(data.workSkills || {}).map(([k, v]) => `<div class="sp-row"><b>${esc(k)}</b><div class="sp-tags">${tags(v)}</div></div>`).join('')}<div class="sp-row"><b>languages</b><div class="sp-tags">${tags(data.programmingLanguages)}</div></div></article>`
            + `${panel('proj')}${head('planet', 'Нээсэн гарагууд', 'Төслүүд')}<div class="sp-projects">${(data.projects || []).map((p, i) => `<a class="sp-project" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="sp-project-ic" style="--h:${PROJECT_BADGES[i % PROJECT_BADGES.length][1]}">${icon(PROJECT_BADGES[i % PROJECT_BADGES.length][0])}</span><div><b>${esc(p.name)}</b><p>${esc(p.description)}</p><div class="sp-tags">${tags(p.technologies)}</div></div></a>`).join('')}</div></article>`
            + `${panel('edu')}${head('telescope', 'Сургалтын ажиглалтын төв', 'Боловсрол · Сертификат')}<ul class="sp-list">${(data.education || []).map(e => `<li><b>${esc(e.field)}</b><em>${esc(e.level)} · ${esc(e.date)}</em><p>${esc(e.institution)}</p></li>`).join('')}${(data.certifications || []).map(c => `<li><b>${esc(c.name)}</b><em>${esc(c.issuer)} · ${esc(c.date)}</em></li>`).join('')}</ul></article>`
            + `${panel('comm')}${head('comet', 'Холбооны суваг', 'Хэл · Зан чанар · Хэрэгсэл')}<div class="sp-tags">${Object.entries(data.spokenLanguages || {}).map(([k, v]) => `<span>✦ ${esc(k)} · ${esc(v)}</span>`).join('')}</div><div class="sp-tags sp-traits">${tags(data.profileTraits)}</div><div class="sp-tags">${tags(data.tools)}</div></article></div></div></div></section>`;
    }

    /* ---------- Drawing helpers ---------- */
    const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
    function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    // Photosphere texture: granulation cells and a few sunspots (rotated each frame; limb darkening is applied on top).
    function sunTexture(pal, seed) {
        const S = 256, c = mkCanvas(S, S), x = c.getContext('2d'), r = rng(seed);
        x.fillStyle = pal.mid; x.fillRect(0, 0, S, S);
        for (let i = 0; i < 1500; i++) {
            const px = r() * S, py = r() * S, rad = 2 + r() * 6, light = r() < .55;
            const g = x.createRadialGradient(px, py, 0, px, py, rad);
            g.addColorStop(0, light ? pal.hot + 'cc' : pal.cool + '88'); g.addColorStop(1, light ? pal.hot + '00' : pal.cool + '00');
            x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
        }
        for (let i = 0; i < 3; i++) {
            const px = 60 + r() * 136, py = 70 + r() * 110, rad = 6 + r() * 9;
            x.fillStyle = pal.cool + 'aa'; x.beginPath(); x.ellipse(px, py, rad * 1.7, rad * 1.3, r() * 3, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#2a0f05cc'; x.beginPath(); x.ellipse(px, py, rad * .8, rad * .6, 0, 0, Math.PI * 2); x.fill();
        }
        return c;
    }
    function drawSun(c, x, y, r, pal, tex, t, spin) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const corona = c.createRadialGradient(x, y, r * .9, x, y, r * 7);
        corona.addColorStop(0, pal.glow + 'cc'); corona.addColorStop(.18, pal.glow + '44'); corona.addColorStop(1, pal.glow + '00');
        c.fillStyle = corona; c.beginPath(); c.arc(x, y, r * 7, 0, TAU); c.fill();
        // Coronal streamers.
        for (let i = 0; i < 9; i++) {
            const a = i / 9 * TAU + spin * .4 + Math.sin(t * .3 + i) * .08, len = r * (3.2 + 1.4 * Math.sin(t * .5 + i * 1.7)), w = r * .35;
            const g = c.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len); g.addColorStop(0, pal.glow + '55'); g.addColorStop(1, pal.glow + '00');
            c.fillStyle = g; c.beginPath(); c.moveTo(x + Math.cos(a + 1.3) * w, y + Math.sin(a + 1.3) * w); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.lineTo(x + Math.cos(a - 1.3) * w, y + Math.sin(a - 1.3) * w); c.closePath(); c.fill();
        }
        // Prominences: glowing plasma loops standing on the limb.
        c.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const a = spin * .7 + i * 2.6, h = r * (.45 + .25 * Math.sin(t * .8 + i * 3)), a1 = a - .25, a2 = a + .25;
            const p1 = [x + Math.cos(a1) * r, y + Math.sin(a1) * r], p2 = [x + Math.cos(a2) * r, y + Math.sin(a2) * r], cpd = r + h * 1.6;
            c.strokeStyle = pal.prom; c.lineWidth = r * .09; c.shadowColor = pal.prom; c.shadowBlur = 8;
            c.beginPath(); c.moveTo(...p1); c.bezierCurveTo(x + Math.cos(a1) * cpd, y + Math.sin(a1) * cpd, x + Math.cos(a2) * cpd, y + Math.sin(a2) * cpd, ...p2); c.stroke();
        }
        c.restore();
        // Photosphere with rotating granulation, then limb darkening.
        c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
        c.translate(x, y); c.rotate(spin); c.drawImage(tex, -r * 1.05, -r * 1.05, r * 2.1, r * 2.1);
        c.rotate(-spin * 2.3); c.globalAlpha = .35; c.drawImage(tex, -r * 1.05, -r * 1.05, r * 2.1, r * 2.1); c.globalAlpha = 1;
        c.setTransform(c.getTransform().a, 0, 0, c.getTransform().d, c.getTransform().e, c.getTransform().f);
        c.restore();
        c.save();
        const limb = c.createRadialGradient(x - r * .15, y - r * .15, r * .1, x, y, r);
        limb.addColorStop(0, pal.core + '99'); limb.addColorStop(.6, pal.core + '00'); limb.addColorStop(.88, '#00000022'); limb.addColorStop(1, pal.edge + 'dd');
        c.fillStyle = limb; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        c.restore();
    }

    // 3D James Webb model (units ≈ metres / 2): five-layer sunshield, bus, solar array, tower,
    // 18 slightly concave gold hexagons, and a secondary mirror held by three struts. y is up.
    const WEBB_MODEL = (() => {
        const polys = [], lines = [];
        const add = (pts, kind, layer) => polys.push({ pts, kind, layer: layer || 0 });
        const box = (x0, y0, z0, x1, y1, z1, kind) => {
            const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
            for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) add(f.map(i => v[i]), kind);
        };
        const kite = [[-7.6, 0, 0], [-2.6, 0, 3.9], [4.2, 0, 3.3], [7.8, 0, 0], [4.2, 0, -3.3], [-2.6, 0, -3.9]];
        for (let L = 0; L < 5; L++) add(kite.map(([x, , z]) => [x * (1 - L * .025), -.9 - L * .3, z * (1 - L * .025)]), 'shield', L);
        box(-.9, -2.7, -.9, .9, -2.15, .9, 'bus');
        add([[-.9, -2.45, -.55], [-3.6, -2.45, -.55], [-3.6, -2.45, .55], [-.9, -2.45, .55]], 'solar');
        box(-.28, -.9, -.6, .28, 1.4, -.1, 'tower');
        const R = .62;
        for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
            const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)); if (d < 1 || d > 2) continue;
            const cx = R * 1.5 * q * 1.04, cy = R * Math.sqrt(3) * (r + q / 2) * 1.04;
            add(Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3, px = cx + Math.cos(a) * R * .95, py = cy + Math.sin(a) * R * .95; return [px, py + 3.2, .2 - .035 * (px * px + py * py)]; }), 'mirror');
        }
        add(Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3; return [Math.cos(a) * .4, 3.2 + Math.sin(a) * .4, 4.4]; }).reverse(), 'mirror2');
        for (const p of [[-2, 1.9, .1], [2, 1.9, .1], [0, 5.4, .1]]) lines.push([p, [0, 3.2, 4.4]]);
        return { polys, lines };
    })();
    function drawWebb3D(c, yaw, pitch, scale, t, glint) {
        const cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), D = 40;
        const tr = ([x, y, z]) => { const x1 = x * cy0 + z * sy0, z1 = -x * sy0 + z * cy0, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, f = D / (D - z2); return [x1 * scale * f, -y2 * scale * f, z2, x1, y2]; };
        const L = [-.35, .62, .7], Ln = Math.hypot(...L), light = L.map(v => v / Ln), half = [light[0], light[1], light[2] + 1].map((v, _, a) => v / Math.hypot(...a));
        const items = [];
        for (const poly of WEBB_MODEL.polys) {
            const P = poly.pts.map(tr), depth = P.reduce((s2, p) => s2 + p[2], 0) / P.length;
            // Normal from the rotated (unprojected) vertices.
            const R3 = poly.pts.map(([x, y, z]) => { const x1 = x * cy0 + z * sy0, z1 = -x * sy0 + z * cy0; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; });
            const u = R3[1].map((v, i) => v - R3[0][i]), w = R3[2].map((v, i) => v - R3[0][i]);
            let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n) || 1; n = n.map(v => v / nl);
            items.push({ P, depth, kind: poly.kind, layer: poly.layer, n });
        }
        for (const [a, b] of WEBB_MODEL.lines) { const A = tr(a), B = tr(b); items.push({ line: true, A, B, depth: (A[2] + B[2]) / 2 }); }
        items.sort((a, b) => a.depth - b.depth);
        c.lineJoin = 'round';
        for (const it of items) {
            if (it.line) { c.strokeStyle = '#3c3f4a'; c.lineWidth = Math.max(1, scale * .12); c.beginPath(); c.moveTo(it.A[0], it.A[1]); c.lineTo(it.B[0], it.B[1]); c.stroke(); continue; }
            const facing = it.n[2] >= 0, n = facing ? it.n : it.n.map(v => -v), lam = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
            const spec = Math.max(0, n[0] * half[0] + n[1] * half[1] + n[2] * half[2]) ** 24;
            let col;
            if (it.kind === 'mirror' || it.kind === 'mirror2') {
                if (!it.n[2] || it.n[2] < 0) col = 'rgb(38,38,46)';
                else { const sweep = Math.max(0, Math.sin(t * 1.2 + it.P[0][0] * .04)) ** 8 * .35, k2 = .45 + .55 * lam + spec * .9 + sweep + glint * .6; col = `rgb(${Math.min(255, 231 * k2 + 40 * spec) | 0},${Math.min(255, 180 * k2 + 60 * spec) | 0},${Math.min(255, 60 * k2 + 120 * spec) | 0})`; }
            } else if (it.kind === 'shield') { const k2 = .35 + .6 * lam + spec * .5 - it.layer * .05; col = `rgb(${Math.min(255, 205 * k2) | 0},${Math.min(255, 192 * k2) | 0},${Math.min(255, 235 * k2) | 0})`; }
            else if (it.kind === 'solar') col = `rgb(${30 + 40 * lam | 0},${60 + 60 * lam | 0},${130 + 90 * lam | 0})`;
            else { const k2 = .4 + .6 * lam; col = `rgb(${70 * k2 + 20 | 0},${72 * k2 + 20 | 0},${84 * k2 + 24 | 0})`; }
            c.fillStyle = col; c.strokeStyle = it.kind === 'shield' ? 'rgba(60,50,90,.5)' : 'rgba(20,16,10,.55)'; c.lineWidth = .7;
            c.beginPath(); it.P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.stroke();
        }
        if (glint > 0) { const m = tr([0, 3.2, .2]); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(m[0], m[1], 0, m[0], m[1], scale * 9); g.addColorStop(0, `rgba(255,230,160,${(.6 * glint).toFixed(3)})`); g.addColorStop(1, 'rgba(255,230,160,0)'); c.fillStyle = g; c.fillRect(m[0] - scale * 9, m[1] - scale * 9, scale * 18, scale * 18); c.restore(); }
    }

    // Voyager: big high-gain dish, ten-sided bus with the golden record, magnetometer boom,
    // RTG boom with three power units, science platform and two long plasma-wave antennas.
    function drawVoyager(c, t, glint) {
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = '#b9c2cc'; c.lineWidth = .7;
        c.beginPath(); c.moveTo(4, 14); c.lineTo(-30, 70); c.moveTo(4, 14); c.lineTo(36, 66); c.stroke();
        c.strokeStyle = '#8a95a0'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(10, 8); c.lineTo(118, -46); c.stroke();
        c.fillStyle = '#c9d0d7'; for (const f of [.35, .7, 1]) c.fillRect(10 + 108 * f - 2, 8 - 54 * f - 2, 4, 4);
        c.strokeStyle = '#7d8790'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, 16); c.lineTo(-46, 34); c.stroke();
        for (let i = 0; i < 3; i++) { const x = -22 - i * 10, y = 24 + i * 4.2; c.fillStyle = '#2c2a2a'; c.fillRect(x - 4, y - 3, 8, 6); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,120,60,.25)'; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); c.restore(); }
        c.strokeStyle = '#7d8790'; c.beginPath(); c.moveTo(10, 16); c.lineTo(38, 30); c.stroke();
        c.fillStyle = '#4b4f58'; c.fillRect(34, 26, 12, 8); c.fillStyle = '#9fb8d6'; c.beginPath(); c.arc(46, 29, 2.2, 0, TAU); c.arc(46, 33, 1.6, 0, TAU); c.fill();
        // Ten-sided bus with the golden record.
        c.fillStyle = '#7a7f86'; c.strokeStyle = '#2c3036'; c.lineWidth = 1;
        c.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; c.lineTo(4 + Math.cos(a) * 11, 14 + Math.sin(a) * 6); } c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#5f646c'; c.fillRect(-7, 14, 22, 8);
        const gr = c.createRadialGradient(10, 18, 0, 10, 18, 4); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(1, '#c8962a');
        c.fillStyle = gr; c.beginPath(); c.arc(10, 18, 3.4, 0, TAU); c.fill();
        if (glint > 0) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(10, 18, 0, 10, 18, 40); g.addColorStop(0, `rgba(255,220,140,${glint})`); g.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = g; c.fillRect(-30, -22, 80, 80); c.restore(); }
        // High-gain antenna dish facing home.
        const dg = c.createRadialGradient(-2, -12, 2, 4, -6, 26); dg.addColorStop(0, '#ffffff'); dg.addColorStop(.7, '#dde3e8'); dg.addColorStop(1, '#9aa5ae');
        c.fillStyle = dg; c.strokeStyle = '#59616a'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(4, -6, 24, 11, -.12, 0, TAU); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(90,100,110,.35)'; c.beginPath(); c.ellipse(4, -6, 15, 7, -.12, 0, TAU); c.stroke();
        c.strokeStyle = '#59616a'; c.beginPath(); c.moveTo(4, -6); c.lineTo(2, -22); c.stroke(); c.fillStyle = '#c9d0d7'; c.fillRect(0, -25, 4, 4);
        c.strokeStyle = '#59616a'; c.beginPath(); c.moveTo(4, 5); c.lineTo(4, 8); c.stroke();
    }

    // An original capital ship (long armoured hull, stepped superstructure, command tower) with a bank
    // of blue ion engines. Faces left; `engine` 0–1 sets the exhaust, `warp` 0–1 stretches it into a jump.
    function drawShip(c, t, engine, warp) {
        const hull = c.createLinearGradient(0, -40, 0, 34); hull.addColorStop(0, '#d7dee6'); hull.addColorStop(.45, '#8d99a6'); hull.addColorStop(1, '#2d3640');
        c.save(); c.scale(1 + warp * 5, 1 - warp * .25);
        // Ion exhaust plumes.
        c.save(); c.globalCompositeOperation = 'lighter';
        const engines = [[-17, 12], [0, 13], [17, 12], [-30, 6], [30, 6], [-8, 6], [8, 6]];
        for (const [ey, er] of engines) {
            const len = (70 + 50 * engine + Math.sin(t * 30 + ey) * 6) * (1 + warp * 2), g = c.createLinearGradient(178, ey, 178 + len, ey);
            g.addColorStop(0, `rgba(220,245,255,${.9 * engine})`); g.addColorStop(.2, `rgba(110,200,255,${.6 * engine})`); g.addColorStop(1, 'rgba(60,140,255,0)');
            c.fillStyle = g; c.beginPath(); c.moveTo(178, ey - er * .8); c.lineTo(178 + len, ey - er * .25); c.lineTo(178 + len, ey + er * .25); c.lineTo(178, ey + er * .8); c.closePath(); c.fill();
        }
        c.restore();
        // Keel and main hull.
        c.fillStyle = '#39434d'; c.beginPath(); c.moveTo(-130, 12); c.lineTo(110, 18); c.lineTo(150, 34); c.lineTo(-40, 30); c.closePath(); c.fill();
        c.fillStyle = hull; c.strokeStyle = '#1c232a'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-185, 0); c.lineTo(-125, -20); c.lineTo(60, -32); c.lineTo(150, -36); c.lineTo(178, -24); c.lineTo(178, 24); c.lineTo(150, 31); c.lineTo(60, 27); c.lineTo(-125, 14); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(30,40,50,.55)'; c.lineWidth = .8;
        for (let x = -150; x < 175; x += 16) { const top = x < -125 ? -20 + (x + 125) * -.33 : x < 60 ? -20 - (x + 125) * .065 : -32 - (x - 60) * .045; c.beginPath(); c.moveTo(x, top + 2); c.lineTo(x, 24); c.stroke(); }
        c.beginPath(); c.moveTo(-180, 0); c.lineTo(176, 0); c.stroke();
        c.fillStyle = 'rgba(20,28,36,.6)'; c.fillRect(-100, -4, 240, 3);
        // Stepped superstructure and command tower with sensor globes.
        const block = (x, y, w, h) => { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#e3e9ef'); g.addColorStop(1, '#6e7a86'); c.fillStyle = g; c.fillRect(x, y, w, h); c.strokeStyle = '#1c232a'; c.strokeRect(x, y, w, h); };
        block(-40, -42, 150, 12); block(30, -56, 90, 14); block(70, -76, 30, 20); block(64, -82, 42, 6);
        c.fillStyle = '#cfd8e0'; c.beginPath(); c.arc(68, -88, 5, 0, TAU); c.arc(102, -88, 5, 0, TAU); c.fill();
        c.strokeStyle = '#9aa6b2'; c.beginPath(); c.moveTo(85, -82); c.lineTo(85, -104); c.moveTo(80, -98); c.lineTo(90, -98); c.stroke();
        for (const x of [-90, -60, -10, 130]) { c.fillStyle = '#7d8995'; c.beginPath(); c.arc(x, -28 + (x < 60 ? (x + 125) * -.06 : -6), 5, Math.PI, TAU); c.fill(); c.strokeStyle = '#2a333c'; c.beginPath(); c.moveTo(x, -31 + (x < 60 ? (x + 125) * -.06 : -6)); c.lineTo(x - 12, -34 + (x < 60 ? (x + 125) * -.06 : -6)); c.stroke(); }
        // Windows, hangar glow and running lights.
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 70; i++) { const x = -110 + (i * 37) % 280, y = -14 + ((i * 13) % 5) * 6; if (Math.sin(i * 7.3) > -.2) { c.fillStyle = i % 5 ? 'rgba(255,236,190,.85)' : 'rgba(150,210,255,.9)'; c.fillRect(x, y, 2, 1.2); } }
        for (let i = 0; i < 18; i++) { c.fillStyle = 'rgba(255,240,200,.8)'; c.fillRect(-30 + i * 8, -50, 3, 1.4); }
        const hangar = c.createRadialGradient(20, 26, 0, 20, 26, 40); hangar.addColorStop(0, 'rgba(120,200,255,.5)'); hangar.addColorStop(1, 'rgba(120,200,255,0)'); c.fillStyle = hangar; c.fillRect(-20, 10, 80, 40);
        if (Math.sin(t * 4) > .6) { c.fillStyle = '#ff5a4a'; c.beginPath(); c.arc(-183, 0, 2, 0, TAU); c.fill(); }
        if (Math.sin(t * 4 + 2) > .6) { c.fillStyle = '#7dff9e'; c.beginPath(); c.arc(150, -36, 2, 0, TAU); c.fill(); }
        c.restore();
        // Engine bells.
        for (const [ey, er] of engines) {
            c.fillStyle = '#20282f'; c.beginPath(); c.ellipse(178, ey, 4, er * .85, 0, 0, TAU); c.fill();
            c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(150,220,255,${.5 + .5 * engine})`; c.beginPath(); c.ellipse(179, ey, 2.6, er * .6, 0, 0, TAU); c.fill(); c.restore();
        }
        if (warp > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(190,230,255,${(warp * .6).toFixed(3)})`; c.beginPath(); c.ellipse(0, 0, 200, 40, 0, 0, TAU); c.fill(); c.restore(); }
        c.restore();
    }

    // Planet surface strips (equirectangular-ish, scrolled to spin) for the profile solar system.
    function planetTexture(kind) {
        const W = 256, H = 128, c = mkCanvas(W, H), x = c.getContext('2d'), r = rng(kind.length * 977 + 13);
        const band = (stops) => { const g = x.createLinearGradient(0, 0, 0, H); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, W, H); };
        const blob = (cx, cy, rad, col) => { x.fillStyle = col; x.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, rr = rad * (.6 + r() * .5); x.lineTo(cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
        if (kind === 'earth') {
            band([[0, '#1a4f9c'], [.5, '#2f7fd0'], [1, '#1a4f9c']]);
            for (let i = 0; i < 9; i++) { const cx = r() * W, cy = 24 + r() * 80, rad = 8 + r() * 16; for (const dx of [0, -W, W]) { blob(cx + dx, cy, rad, '#3f8f45'); blob(cx + dx + 4, cy + 3, rad * .55, '#a88a52'); } }
            x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, W, 9); x.fillRect(0, H - 9, W, 9);
        } else if (kind === 'mars') {
            band([[0, '#b5532c'], [.5, '#d9763f'], [1, '#a0461f']]);
            for (let i = 0; i < 14; i++) { const cx = r() * W, cy = r() * H; for (const dx of [0, -W, W]) blob(cx + dx, cy, 4 + r() * 12, 'rgba(90,30,15,.45)'); }
            x.fillStyle = '#f3ece6'; x.fillRect(0, 0, W, 6);
        } else if (kind === 'mercury') {
            band([[0, '#8a8580'], [.5, '#a9a39c'], [1, '#7c7772']]);
            for (let i = 0; i < 60; i++) { const cx = r() * W, cy = r() * H, rad = 1 + r() * 6; x.fillStyle = 'rgba(60,56,52,.45)'; x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fill(); x.strokeStyle = 'rgba(220,214,206,.35)'; x.beginPath(); x.arc(cx - .6, cy - .6, rad, Math.PI, Math.PI * 1.6); x.stroke(); }
        } else if (kind === 'jupiter' || kind === 'saturn' || kind === 'neptune' || kind === 'venus' || kind === 'uranus') {
            const pal = kind === 'venus' ? ['#f2deb0', '#e8cc90', '#f6e8c6', '#dcbf86', '#efd9a6'] : kind === 'uranus' ? ['#bfeaf0', '#a8dde6', '#c9f0f4', '#9fd4de'] : kind === 'jupiter' ? ['#e9d4b0', '#c58a5a', '#f2e4c8', '#a8643c', '#ead2a6', '#8f5434'] : kind === 'saturn' ? ['#efe0b8', '#d6bd88', '#f5e9c8', '#c4a670', '#e9d6a8'] : ['#3d6fe0', '#2b4fb8', '#5a8af0', '#24439e'];
            let y = 0; while (y < H) { const h = 5 + r() * (kind === 'neptune' ? 18 : 12); x.fillStyle = pal[Math.floor(r() * pal.length)]; x.fillRect(0, y, W, h + 1); y += h; }
            x.globalAlpha = .35;
            for (let i = 0; i < 40; i++) { const yy = r() * H; x.strokeStyle = pal[i % pal.length]; x.lineWidth = 1 + r() * 2; x.beginPath(); for (let xx = 0; xx <= W; xx += 8) x.lineTo(xx, yy + Math.sin(xx * .06 + i) * 2.5); x.stroke(); }
            x.globalAlpha = 1;
            if (kind === 'jupiter') for (const dx of [0, -W]) { x.fillStyle = '#c0492c'; x.beginPath(); x.ellipse(170 + dx, 82, 15, 8, 0, 0, TAU); x.fill(); x.fillStyle = '#e27a52'; x.beginPath(); x.ellipse(170 + dx, 82, 9, 4.5, 0, 0, TAU); x.fill(); }
            if (kind === 'neptune') { x.fillStyle = '#1a2f78'; x.beginPath(); x.ellipse(90, 50, 12, 7, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(60, 40, 40, 2); x.fillRect(150, 86, 30, 2); }
        }
        return c;
    }
    // Negative spin = turning on its axis the other way (Venus and Uranus really do; Saturn by the page's
    // design). All planets orbit the same way.
    const PLANET_LOOK = { mercury: { size: .55, spin: 4 }, uranus: { size: 1.2, spin: -11, atmo: 'rgba(170,235,240,.45)', tiltedRing: true }, venus: { size: .92, spin: -6, atmo: 'rgba(255,230,170,.45)' }, earth: { size: 1, spin: 10, atmo: 'rgba(120,190,255,.55)' }, mars: { size: .78, spin: 9, atmo: 'rgba(255,150,110,.25)' }, jupiter: { size: 1.75, spin: 18 }, saturn: { size: 1.45, spin: -15, rings: true }, neptune: { size: 1.1, spin: 12, atmo: 'rgba(110,160,255,.45)' } };
    function drawSaturnRing(c, x, y, r, front) {
        const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
        c.save(); c.translate(x, y); c.rotate(-.32);
        for (const [rr, w, col] of [[2.28, .16, 'rgba(176,150,110,.55)'], [2.05, .22, 'rgba(232,214,170,.9)'], [1.86, .05, 'rgba(10,10,20,.0)'], [1.72, .2, 'rgba(214,190,140,.85)'], [1.5, .14, 'rgba(160,140,110,.45)']]) {
            if (col.endsWith('.0)')) continue;
            c.strokeStyle = col; c.lineWidth = r * w; c.beginPath(); c.ellipse(0, 0, r * rr, r * rr * .3, 0, a0, a1); c.stroke();
        }
        c.restore();
    }
    // A planet with a spinning surface, lit from the side facing the star (lightAngle).
    function drawPlanet(c, x, y, r, kind, tex, t, lightAngle, clouds) {
        const look = PLANET_LOOK[kind];
        if (look.rings) drawSaturnRing(c, x, y, r, false);
        if (look.tiltedRing) { c.strokeStyle = 'rgba(190,230,240,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, r * .45, r * 1.8, .12, Math.PI / 2, Math.PI * 1.5); c.stroke(); }
        if (kind === 'jupiter') { c.strokeStyle = 'rgba(200,180,150,.25)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, r * 1.7, r * .35, -.1, Math.PI, TAU); c.stroke(); }
        c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
        const off = ((t * look.spin) % tex.width + tex.width) % tex.width, s = (2 * r) / tex.height;
        c.drawImage(tex, -off * s + x - r, y - r, tex.width * s, 2 * r); c.drawImage(tex, (tex.width - off) * s + x - r, y - r, tex.width * s, 2 * r);
        if (clouds) { const co = ((t * look.spin * 1.6) % clouds.width + clouds.width) % clouds.width; c.globalAlpha = .55; c.drawImage(clouds, -co * s + x - r, y - r, clouds.width * s, 2 * r); c.drawImage(clouds, (clouds.width - co) * s + x - r, y - r, clouds.width * s, 2 * r); c.globalAlpha = 1; }
        // Day/night: dark on the side away from the star, plus a soft limb.
        const lx = Math.cos(lightAngle), ly = Math.sin(lightAngle), sh = c.createLinearGradient(x + lx * r, y + ly * r, x - lx * r, y - ly * r);
        sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.45, 'rgba(0,0,10,.08)'); sh.addColorStop(.75, 'rgba(0,0,12,.6)'); sh.addColorStop(1, 'rgba(0,0,15,.88)');
        c.fillStyle = sh; c.fillRect(x - r, y - r, 2 * r, 2 * r);
        const limb = c.createRadialGradient(x, y, r * .55, x, y, r); limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = limb; c.fillRect(x - r, y - r, 2 * r, 2 * r);
        c.restore();
        if (look.atmo) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = look.atmo; c.lineWidth = Math.max(1.2, r * .12); c.beginPath(); c.arc(x, y, r * 1.02, lightAngle - 1.3, lightAngle + 1.3); c.stroke(); c.restore(); }
        if (look.rings) drawSaturnRing(c, x, y, r, true);
        if (look.tiltedRing) { c.strokeStyle = 'rgba(190,230,240,.45)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, r * .45, r * 1.8, .12, -Math.PI / 2, Math.PI / 2); c.stroke(); }
    }
    function cloudTexture() {
        const c = mkCanvas(256, 128), x = c.getContext('2d'), r = rng(4242);
        for (let i = 0; i < 60; i++) { const cx = r() * 256, cy = 10 + r() * 108; x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(cx, cy, 6 + r() * 16, 1.5 + r() * 3, 0, 0, TAU); x.fill(); }
        return c;
    }
    function drawArtificialSatellite(c, x, y, s, t) {
        c.save(); c.translate(x, y); c.rotate(t * .8);
        c.fillStyle = '#d9dde3'; c.fillRect(-s * .5, -s * .5, s, s);
        c.fillStyle = '#2f5fb8'; c.fillRect(-s * 2.4, -s * .35, s * 1.6, s * .7); c.fillRect(s * .8, -s * .35, s * 1.6, s * .7);
        c.strokeStyle = 'rgba(200,220,255,.6)'; c.lineWidth = .5; c.strokeRect(-s * 2.4, -s * .35, s * 1.6, s * .7); c.strokeRect(s * .8, -s * .35, s * 1.6, s * .7);
        c.fillStyle = '#ffcf4d'; c.beginPath(); c.arc(0, -s * .7, s * .25, 0, TAU); c.fill();
        c.restore();
    }

    // An original hand-built junkyard robot: riveted boiler body, telescopic neck, one big lens eye.
    function drawRobot(c, p) {
        const ink = '#2a1d17', rust = c.createLinearGradient(-20, -70, 20, -30); rust.addColorStop(0, '#c8753f'); rust.addColorStop(.6, '#a35a31'); rust.addColorStop(1, '#6e3a22');
        c.lineJoin = 'round'; c.lineCap = 'round';
        const sw = Math.sin(p.walk), leg = (side, ph) => {
            const s = p.moving ? Math.sin(p.walk + ph) : 0, hip = [side * 8, -26], knee = [side * 8 + s * 6, -14 - Math.max(0, s) * 3], foot = [side * 8 + s * 10, -Math.max(0, -s) * 4];
            c.strokeStyle = ink; c.lineWidth = 5; c.beginPath(); c.moveTo(...hip); c.lineTo(...knee); c.lineTo(...foot); c.stroke();
            c.strokeStyle = '#5a504a'; c.lineWidth = 3; c.stroke();
            c.fillStyle = '#7a4428'; c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.ellipse(foot[0] + 3, foot[1] - 2, 8, 4.5, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
        };
        leg(-1, Math.PI); leg(1, 0);
        const bob = p.moving ? Math.abs(sw) * 2 : 0;
        c.save(); c.translate(0, -bob);
        // Back chimney with a puff of steam.
        c.fillStyle = '#4b3f3a'; c.fillRect(10, -66, 6, 14); c.strokeStyle = ink; c.lineWidth = 1.5; c.strokeRect(10, -66, 6, 14);
        for (let i = 0; i < 3; i++) { const f = (p.t * .6 + i / 3) % 1; c.fillStyle = `rgba(210,210,215,${(.35 * (1 - f)).toFixed(3)})`; c.beginPath(); c.arc(13 + f * 8, -68 - f * 22, 3 + f * 6, 0, TAU); c.fill(); }
        // Boiler body with riveted bands and a pressure gauge.
        c.fillStyle = rust; c.strokeStyle = ink; c.lineWidth = 2;
        c.beginPath(); c.roundRect ? c.roundRect(-17, -62, 34, 38, 9) : c.rect(-17, -62, 34, 38); c.fill(); c.stroke();
        c.fillStyle = '#7d4a2e'; c.fillRect(-17, -50, 34, 4); c.fillRect(-17, -36, 34, 4);
        c.fillStyle = '#e0b07a'; for (let i = -14; i <= 14; i += 7) { c.beginPath(); c.arc(i, -48, 1.1, 0, TAU); c.arc(i, -34, 1.1, 0, TAU); c.fill(); }
        c.fillStyle = '#efe6d2'; c.beginPath(); c.arc(-6, -42, 5, 0, TAU); c.fill(); c.stroke();
        const needle = -2.4 + Math.sin(p.t * 2.2) * .6 + p.excite * 1.5; c.strokeStyle = '#c0392b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -42); c.lineTo(-6 + Math.cos(needle) * 4, -42 + Math.sin(needle) * 4); c.stroke();
        c.fillStyle = '#3c3430'; c.fillRect(4, -45, 8, 6); c.fillStyle = Math.sin(p.t * 6) > 0 ? '#7dff9e' : '#2e6b3c'; c.fillRect(5.5, -43.5, 2, 2); c.fillStyle = '#ffcf4d'; c.fillRect(8.5, -43.5, 2, 2);
        // Arms: left one waves, right one carries scrap or reaches down.
        const arm = (side, a1, a2, claw, paddle) => {
            const sh = [side * 17, -54], el = [sh[0] + Math.sin(a1) * 13 * side, sh[1] + Math.cos(a1) * 13], hd = [el[0] + Math.sin(a2) * 12 * side, el[1] + Math.cos(a2) * 12];
            c.strokeStyle = ink; c.lineWidth = 4.5; c.beginPath(); c.moveTo(...sh); c.lineTo(...el); c.lineTo(...hd); c.stroke();
            c.strokeStyle = '#6a605a'; c.lineWidth = 2.5; c.stroke();
            c.fillStyle = '#b06a3c'; c.beginPath(); c.arc(...el, 2.6, 0, TAU); c.fill();
            c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(hd[0], hd[1]); c.lineTo(hd[0] + side * 4, hd[1] + 4); c.moveTo(hd[0], hd[1]); c.lineTo(hd[0] - side * 1, hd[1] + 5); c.stroke();
            if (paddle) {
                c.save(); c.translate(hd[0], hd[1]); c.rotate(.5 - p.swing * .9);
                c.fillStyle = '#6b4a2e'; c.fillRect(-1.6, -2, 3.2, 9);
                c.fillStyle = '#c9302c'; c.strokeStyle = ink; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, -9, 7, 8, 0, 0, TAU); c.fill(); c.stroke();
                c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-2, -11, 2.5, 3, 0, 0, TAU); c.fill();
                c.restore();
            }
            if (claw) { c.fillStyle = '#8f9aa3'; c.strokeStyle = ink; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, rr = i % 2 ? 4.5 : 6; c.lineTo(hd[0] + side * 3 + Math.cos(a) * rr, hd[1] + 6 + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); }
        };
        arm(-1, p.wave > 0 ? Math.PI * .9 + Math.sin(p.t * 14) * .35 * p.wave : .35 + Math.sin(p.walk) * .2, p.wave > 0 ? Math.PI * 1.1 : .2, false);
        if (p.paddle) arm(1, .75 + p.swing * .75, 1.25 + p.swing * .45, false, true);
        else arm(1, p.reach ? 1.1 : .4 - Math.sin(p.walk) * .2, p.reach ? 1.6 : .5, p.carry);
        // Telescopic neck and the domed head with one big lens eye.
        const nh = 6 + p.neck * 18;
        for (let i = 0; i < 3; i++) { const w = 7 - i * 1.5, y0 = -62 - nh * i / 3; c.fillStyle = i % 2 ? '#8b7d74' : '#6e625b'; c.fillRect(-w / 2, y0 - nh / 3, w, nh / 3 + 1); c.strokeStyle = ink; c.lineWidth = 1; c.strokeRect(-w / 2, y0 - nh / 3, w, nh / 3 + 1); }
        const hy = -62 - nh;
        c.fillStyle = rust; c.strokeStyle = ink; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-15, hy); c.quadraticCurveTo(-16, hy - 20, 0, hy - 21); c.quadraticCurveTo(16, hy - 20, 15, hy); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#5a3a28'; c.fillRect(-15, hy - 3, 30, 3);
        c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(6, hy - 19); c.lineTo(9, hy - 30); c.stroke();
        for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(7.5 + i * .6, hy - 22 - i * 2.6, 2, .9, 0, 0, TAU); c.stroke(); }
        c.fillStyle = Math.sin(p.t * 3) > .2 ? '#ff4d3d' : '#7a1d16'; c.beginPath(); c.arc(9, hy - 31, 2.2, 0, TAU); c.fill();
        const lx = clamp(p.lookX, -1, 1) * 2.2, ly = clamp(p.lookY, -1, 1) * 2.2;
        c.fillStyle = '#d9d2c4'; c.beginPath(); c.arc(-4, hy - 10, 8, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#20262a'; c.beginPath(); c.arc(-4, hy - 10, 6, 0, TAU); c.fill();
        const eye = c.createRadialGradient(-4 + lx, hy - 10 + ly, 0, -4 + lx, hy - 10 + ly, 4.5); eye.addColorStop(0, '#eaffff'); eye.addColorStop(.4, '#4fe3ff'); eye.addColorStop(1, '#0a3a4a');
        c.fillStyle = eye; c.beginPath(); c.arc(-4 + lx, hy - 10 + ly, 4.5 * (p.blink ? .2 : 1), 0, TAU); c.fill();
        c.fillStyle = '#d9d2c4'; c.beginPath(); c.arc(8, hy - 9, 3.6, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#20262a'; c.beginPath(); c.arc(8 + lx * .5, hy - 9 + ly * .5, 1.8 * (p.blink ? .3 : 1), 0, TAU); c.fill();
        c.restore();
        return hy - bob;
    }

    // An original scientist in a lab coat; pose.press reaches for the console, pose.lift raises both arms.
    function drawScientist(c, p) {
        const ink = '#1d2328';
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.fillStyle = '#2b3442'; c.fillRect(-12, -46, 9, 44); c.fillRect(3, -46, 9, 44);
        c.fillStyle = '#16191d'; c.beginPath(); c.ellipse(-7, -1, 9, 4, 0, 0, TAU); c.ellipse(9, -1, 9, 4, 0, 0, TAU); c.fill();
        // Lab coat flaring with the pose.
        const flare = p.float * 6;
        c.fillStyle = '#f2f5f7'; c.strokeStyle = '#aab6c0'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(-15, -98); c.lineTo(15, -98); c.lineTo(19 + flare, -36); c.lineTo(-19 - flare, -36); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#c7d0d8'; c.beginPath(); c.moveTo(0, -94); c.lineTo(0, -38); c.stroke();
        c.fillStyle = '#4f7fb8'; c.beginPath(); c.moveTo(-4, -98); c.lineTo(4, -98); c.lineTo(2, -78); c.lineTo(0, -74); c.lineTo(-2, -78); c.closePath(); c.fill();
        c.fillStyle = '#8fb6d9'; c.fillRect(6, -86, 7, 9); c.fillStyle = '#e04f4f'; c.fillRect(8, -88, 1.5, 6); c.fillStyle = '#2f6fd6'; c.fillRect(10.5, -88, 1.5, 6);
        // Arms from explicit joints, mirrored left/right, so every pose stays symmetric and natural.
        const limb = (sh, el, hd, open) => {
            c.strokeStyle = '#e4e9ed'; c.lineWidth = 8; c.beginPath(); c.moveTo(...sh); c.lineTo(...el); c.lineTo(...hd); c.stroke();
            c.strokeStyle = '#c7d0d8'; c.lineWidth = 1; c.beginPath(); c.moveTo(el[0] + (hd[0] - el[0]) * .8 - 3, el[1] + (hd[1] - el[1]) * .8); c.lineTo(el[0] + (hd[0] - el[0]) * .8 + 3, el[1] + (hd[1] - el[1]) * .8); c.stroke();
            c.fillStyle = '#e8b896'; c.beginPath(); c.arc(...hd, 3.6, 0, TAU); c.fill();
            if (open) {
                const dx = hd[0] - el[0], dy = hd[1] - el[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
                c.strokeStyle = '#e8b896'; c.lineWidth = 1.6; c.lineCap = 'round';
                for (const spread of [-.6, 0, .6]) { const a = Math.atan2(uy, ux) + spread; c.beginPath(); c.moveTo(hd[0] + Math.cos(a) * 3, hd[1] + Math.sin(a) * 3); c.lineTo(hd[0] + Math.cos(a) * 7, hd[1] + Math.sin(a) * 7); c.stroke(); }
            }
        };
        const pose = p.pose || (p.press > 0 ? 'press' : 'idle'), tt = p.t || 0;
        for (const side of [-1, 1]) {
            const sh = [side * 14, -94];
            let el, hd, open = false;
            if (pose === 'amazed') { el = [sh[0] + side * 12, sh[1] - 16]; hd = [el[0] + side * 6, el[1] - 18]; open = true; }
            else if (pose === 'float') { const w = Math.sin(tt * 2.2 + side) * 5; el = [sh[0] + side * 19, sh[1] + 2 + w]; hd = [el[0] + side * 17, el[1] - 4 + w * 1.4]; open = true; }
            else if (pose === 'brace') { const tr = Math.sin(tt * 30 + side) * .8; el = [sh[0] - 15, sh[1] + 5 + tr]; hd = [el[0] - 17, el[1] + 1 + tr]; open = true; }
            else if (side === 1 && pose === 'press') { const a1 = .9 + p.press * .5; el = [sh[0] + Math.sin(a1) * 20, sh[1] + Math.cos(a1) * 20]; hd = [el[0] + Math.sin(1.5) * 18, el[1] + Math.cos(1.5) * 18]; }
            else { const a1 = side < 0 ? -.15 : .35, a2 = side < 0 ? .1 : .9; el = [sh[0] + Math.sin(a1) * 20, sh[1] + Math.cos(a1) * 20]; hd = [el[0] + Math.sin(a2) * 18, el[1] + Math.cos(a2) * 18]; }
            limb(sh, el, hd, open);
        }
        // Head: hair, round glasses, a little smile (or an "o" when amazed).
        c.fillStyle = '#e8b896'; c.fillRect(-4, -104, 8, 8);
        c.beginPath(); c.ellipse(0, -114, 11, 13, 0, 0, TAU); c.fill();
        c.fillStyle = p.hair || '#3a3330'; c.beginPath(); c.ellipse(-1, -124, 12, 6, -.15, Math.PI, TAU); c.fill(); c.beginPath(); c.ellipse(-10, -117, 3.5, 7, .2, 0, TAU); c.fill(); c.beginPath(); c.ellipse(9.5, -118, 3, 6, -.2, 0, TAU); c.fill();
        c.strokeStyle = ink; c.lineWidth = 1.4; c.beginPath(); c.arc(-4.5, -114, 4, 0, TAU); c.moveTo(8.5, -114); c.arc(4.5, -114, 4, 0, TAU); c.moveTo(-.5, -114); c.lineTo(.5, -114); c.stroke();
        c.fillStyle = ink; c.beginPath(); c.arc(-4.5 + p.look, -114, 1.3, 0, TAU); c.arc(4.5 + p.look, -114, 1.3, 0, TAU); c.fill();
        c.beginPath(); if (p.lift) c.ellipse(0, -106, 2, 2.6, 0, 0, TAU); else c.arc(0, -108, 3, .2, Math.PI - .2); p.lift ? c.fill() : c.stroke();
        if (p.tablet && (!p.pose || p.pose === 'idle')) {
            c.save(); c.translate(14, -72); c.rotate(-.35);
            c.fillStyle = '#20262c'; c.fillRect(-11, -8, 22, 16); c.fillStyle = '#123a4e'; c.fillRect(-9, -6, 18, 12);
            c.strokeStyle = '#7fd0ff'; c.lineWidth = .8; c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(-8 + i * 2, 3 - Math.sin(i + (p.t || 0) * 4) * 3); c.stroke(); c.restore();
        }
    }
    // Junk heaps on the scrap planet: tyres, pipes, gears, barrels, an old screen and a broken dish.
    function drawJunk(c, x, y, s, r) {
        const ink = '#120d0c', piece = r() * 6 | 0;
        c.save(); c.translate(x, y); c.scale(s, s); c.rotate((r() - .5) * .5); c.strokeStyle = ink; c.lineWidth = 1.2;
        if (piece === 0) { for (let i = 0; i < 3; i++) { c.fillStyle = '#1e1b1c'; c.beginPath(); c.ellipse(0, -6 - i * 9, 16, 6, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#0b0a0a'; c.beginPath(); c.ellipse(0, -6 - i * 9, 7, 2.6, 0, 0, TAU); c.fill(); } }
        else if (piece === 1) { const g = c.createLinearGradient(0, -14, 0, 0); g.addColorStop(0, '#7b8a92'); g.addColorStop(1, '#2f3a40'); c.fillStyle = g; c.fillRect(-26, -14, 52, 12); c.strokeRect(-26, -14, 52, 12); c.fillStyle = '#151a1d'; c.beginPath(); c.ellipse(26, -8, 3, 6, 0, 0, TAU); c.fill(); }
        else if (piece === 2) { c.fillStyle = '#8a5a34'; c.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, rr = i % 2 ? 12 : 15; c.lineTo(Math.cos(a) * rr, -15 + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(0, -15, 4, 0, TAU); c.fill(); }
        else if (piece === 3) { c.fillStyle = '#6b3b25'; c.fillRect(-10, -26, 20, 26); c.strokeRect(-10, -26, 20, 26); c.fillStyle = '#4a2818'; c.fillRect(-10, -19, 20, 3); c.fillRect(-10, -9, 20, 3); }
        else if (piece === 4) { c.fillStyle = '#3d3a36'; c.fillRect(-16, -26, 32, 24); c.strokeRect(-16, -26, 32, 24); c.fillStyle = '#1d3b3a'; c.fillRect(-12, -22, 22, 16); c.strokeStyle = '#5aa'; c.beginPath(); c.moveTo(-10, -12); c.lineTo(-2, -18); c.lineTo(4, -9); c.stroke(); }
        else { c.fillStyle = '#9aa3a8'; c.beginPath(); c.ellipse(0, -14, 18, 8, -.6, 0, Math.PI); c.fill(); c.stroke(); c.strokeStyle = ink; c.beginPath(); c.moveTo(0, -14); c.lineTo(8, -30); c.stroke(); }
        c.restore();
    }

    const SUN_PALS = [
        { name: 'Нар α', core: '#fffbe8', hot: '#fff3c4', mid: '#ffd36b', cool: '#e8902e', edge: '#b4521a', glow: '#ffcf6a', prom: '#ff7a3d', trail: '255,200,90' },
        { name: 'Нар β', core: '#fff0e0', hot: '#ffd2a8', mid: '#ff9a52', cool: '#d4572a', edge: '#8c2a10', glow: '#ff8a4d', prom: '#ff4a2a', trail: '255,140,90' },
        { name: 'Нар γ', core: '#ffffff', hot: '#eef6ff', mid: '#bcd8ff', cool: '#7aa6f0', edge: '#3d63c4', glow: '#a8ccff', prom: '#d0e4ff', trail: '160,205,255' }
    ];

    function render(data, root) {
        if (root._spaceCleanup) root._spaceCleanup();
        root.innerHTML = `<main class="sp-app"><header class="sp-header"><div class="sp-brand"><b>✦</b> DEEP SPACE / LAB</div><span class="sp-tag">3-BODY · BLACK HOLE · X-BOSON</span></header>`
            + `<div class="sp-stage"><section class="sp-world"><canvas class="sp-canvas" aria-label="Гурван нар бие биенээ таталцлаар тойрон эргэнэ. Нарыг чирж хаявал холдоно, хар нүх рүү ойртуулбал сорогдоно. Доор хогийн цэгт робот тэнүүчилнэ."></canvas>`
            + ``
            + `<div class="sp-hud"><button type="button" data-act="tight">⚡ Ойрын тойрог</button><button type="button" data-act="reset">∞ 8 дүрс</button><button type="button" data-act="pause" aria-pressed="false">Ⅱ</button></div><p class="sp-status" aria-live="polite"></p></section>`
            + `<section class="sp-lab-wrap"><div class="sp-lab-head"><span class="sp-eyebrow">ДЭЛХИЙ · ГАЗАР ДООРХ ЛАБОРАТОРИ</span><h2>Бөөмийн хурдасгуур</h2><p>Эрдэмтэн устөрөгчийн атомуудыг гэрлийн хурдад ойртуулж мөргөлдүүлнэ. Тэсрэлтээс гарсан X бозон камерын голд жингүйдэл эсвэл хэт таталцал үүсгэнэ.</p></div>`
            + `<div class="sp-lab"><canvas class="sp-lab-canvas" aria-label="Лабораторид эрдэмтэн бөөмийн хурдасгуураар туршилт хийж байна"></canvas><div class="sp-hud sp-lab-hud"><button type="button" data-act="fire">⚛ Туршилт эхлүүлэх</button><div class="sp-mode" role="group" aria-label="X бозоны нөлөө"><button type="button" data-mode="zero" aria-pressed="true">◯ Жингүйдэл</button><button type="button" data-mode="well" aria-pressed="false">● Хэт таталцал</button></div></div><p class="sp-status sp-lab-status" aria-live="polite"></p></div></section></div>`
            + `${profileHtml(data)}</main>`;
        const canvas = root.querySelector('.sp-canvas'), ctx = canvas.getContext('2d'), status = root.querySelector('.sp-world .sp-status');
        if (!ctx) return;
        let width = 900, height = 700, ratio = 1, k = 1, time = 0, last = 0, frame = 0, disposed = false, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const random = rng(7);
        let back, stars = [], sys, bh, ground;
        const textures = SUN_PALS.map((p, i) => sunTexture(p, 31 + i * 97));
        const SIM_RATE = 1.25, LIMIT = 2.7;
        function label(c, text, x, y, color, align, size) {
            c.font = `600 ${Math.round((size || 11) * Math.max(.85, k))}px ui-monospace, Menlo, monospace`; c.textAlign = align || 'center'; c.textBaseline = 'alphabetic';
            if ('letterSpacing' in c) c.letterSpacing = '2px';
            c.fillStyle = color; c.fillText(text, x, y);
            if ('letterSpacing' in c) c.letterSpacing = '0px';
        }

        /* --- Three suns --- */
        let bodies, trails, grabbed = null, chaotic = false, event = null;
        function resetBodies() { bodies = figureEight().concat([{ x: 0, y: 1.7, vx: .78, vy: 0, m: 0 }]).map(b => ({ z: 0, vz: 0, ...b })); trails = bodies.map(() => []); chaotic = false; event = null; }
        resetBodies();
        const view = { az: .35, el: .5 };
        const toPx = (x, y, z) => { const q = viewProject(x, y, z || 0, view.az, view.el); return { x: sys.cx + q.u * sys.scale, y: sys.cy + q.v * sys.scale, depth: q.depth, p: q.p }; };
        const bodyPx = b => toPx(b.x, b.y, b.z);
        // Screen point back onto the orbital plane at height z (perspective taken from a reference factor).
        function toSim(sx, sy, z, p) {
            const u = (sx - sys.cx) / sys.scale / (p || 1), v = (sy - sys.cy) / sys.scale / (p || 1), yr = (v + (z || 0) * Math.cos(view.el)) / Math.sin(view.el);
            return { x: u * Math.cos(view.az) + yr * Math.sin(view.az), y: -u * Math.sin(view.az) + yr * Math.cos(view.az) };
        }
        const alive = i => !(event && event.sun === i && event.phase !== 'reborn');
        function respawnPlanet() {
            const live = [0, 1, 2].filter(alive), s = bodies[live[Math.floor(random() * live.length)]], a = random() * TAU, r = .5;
            Object.assign(bodies[3], { x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, z: s.z || 0, vx: s.vx - Math.sin(a) * 1.4, vy: s.vy + Math.cos(a) * 1.4, vz: (s.vz || 0) + (random() - .5) * .3 });
            trails[3].length = 0;
        }
        function physics(dt) {
            const sub = 14, h = dt * SIM_RATE / sub, ev = event && event.phase !== 'reborn' ? event.sun : -1;
            if (ev >= 0) bodies[ev].m = 0;
            for (let n = 0; n < sub; n++) {
                step(bodies, h, null);
                for (let i = 0; i < 3; i++) {
                    if (i === ev) continue;
                    const b = bodies[i], d = Math.hypot(b.x, b.y, b.z);
                    if (d > LIMIT) { const f = 5.4 * (d - LIMIT) * h; b.vx -= b.x / d * f; b.vy -= b.y / d * f; b.vz -= b.z / d * f; }
                    b.vz -= b.z * .25 * h; // a gentle pull back toward the orbital plane
                    const v = Math.hypot(b.vx, b.vy, b.vz); if (v > 4) { b.vx *= 4 / v; b.vy *= 4 / v; b.vz *= 4 / v; }
                }
                if (grabbed !== null) { const b = bodies[grabbed]; b.x = grab.x; b.y = grab.y; b.vx = grab.vx; b.vy = grab.vy; b.vz = 0; }
            }
            const live = [0, 1, 2].filter(i => i !== ev);
            // Tidal friction: very close, fast passes bleed orbital energy; touching suns merge.
            contacts = [];
            for (let a = 0; a < live.length; a++) for (let c = a + 1; c < live.length; c++) {
                const A = bodies[live[a]], B = bodies[live[c]], d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
                if (d < .55) contacts.push([live[a], live[c], d]);
                if (d < .3 && grabbed === null) {
                    const f = 1 - Math.exp(-dt * .55 * (1 - d / .3)), mvx = (A.vx + B.vx) / 2, mvy = (A.vy + B.vy) / 2, mvz = (A.vz + B.vz) / 2;
                    for (const b of [A, B]) { b.vx += (mvx - b.vx) * f * .5; b.vy += (mvy - b.vy) * f * .5; b.vz += (mvz - b.vz) * f * .5; }
                }
                if (!event && d < .15) { touch += dt; if (touch > .35) { merge(live[a], live[c]); return; } }
            }
            if (!contacts.some(c => c[2] < .15)) touch = Math.max(0, touch - dt);
            let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
            for (const i of live) { const b = bodies[i], n = live.length; cx += b.x / n; cy += b.y / n; cz += b.z / n; vx += b.vx / n; vy += b.vy / n; vz += b.vz / n; }
            const ease = grabbed === null ? .04 : .01;
            bodies.forEach((b, i) => { if (i === ev) return; b.x -= cx * ease; b.y -= cy * ease; b.z -= cz * ease; b.vx -= vx * ease; b.vy -= vy * ease; b.vz -= vz * ease; });
            for (const tr of trails) for (const p of tr) { p[0] -= cx * ease; p[1] -= cy * ease; p[2] -= cz * ease; }
            bodies.forEach((b, i) => { if (i === ev) { trails[i].length = 0; return; } trails[i].push([b.x, b.y, b.z]); if (trails[i].length > (i === 3 ? 90 : 150)) trails[i].shift(); });
            const pl = bodies[3];
            if (Math.hypot(pl.x, pl.y, pl.z) > 4.5 || live.some(i => Math.hypot(bodies[i].x - pl.x, bodies[i].y - pl.y, bodies[i].z - pl.z) < .08)) respawnPlanet();
            // A sun that wanders (or is dragged) too close to the black hole is captured.
            if (!event) for (const i of live) { const q = bodyPx(bodies[i]); if (Math.hypot(q.x - bh.x, q.y - bh.y) < bh.R * 3.2) { capture(i, q); break; } }
        }

        /* --- Tidal disruption, supernova and the butterfly nebula --- */
        let nebula = [], shock = null, contacts = [], touch = 0;
        const GIANT_PAL = { name: 'Аврага улаан од', core: '#ffe0c0', hot: '#ffb070', mid: '#e0602a', cool: '#7a1e0c', edge: '#3a0a04', glow: '#ff5a2a', prom: '#ff3a1a', trail: '255,110,70' };
        const giantTex = sunTexture(GIANT_PAL, 777);
        const sunRadius = i => event && event.type === 'merge' && event.giant === i ? sys.sun * giantScale() : sys.sun;
        function giantScale() {
            const e = event; if (!e || e.type !== 'merge') return 1;
            if (e.phase === 'rednova') return 1.25;
            if (e.phase === 'swell') return 1.25 + 1.55 * smooth(e.t / 4.5);
            if (e.phase === 'giant') return 2.8 * (1 + .05 * Math.sin(e.t * 1.3) + .03 * Math.sin(e.t * 3.1));
            if (e.phase === 'collapse') return 2.8 * (1 - .8 * smooth(e.t / .7));
            return 1;
        }
        // Two suns touch: they merge in a luminous red nova and swell into a red supergiant
        // (Betelgeuse may itself be the product of such a merger), which later explodes.
        function merge(i, j) {
            const A = bodies[i], B = bodies[j];
            Object.assign(A, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: (A.z + B.z) / 2, vx: (A.vx + B.vx) / 2, vy: (A.vy + B.vy) / 2, vz: (A.vz + B.vz) / 2, m: 2 });
            B.m = 0; trails[j].length = 0; if (grabbed === i || grabbed === j) grabbed = null;
            const q = bodyPx(A); event = { type: 'merge', giant: i, sun: j, phase: 'rednova', t: 0, cx: q.x, cy: q.y }; touch = 0; chaotic = true;
            shock = { r: sys.sun, x: q.x, y: q.y, col: '255,120,80' };
        }
        function tightBinary() {
            if (event) return;
            const A = bodies[0], B = bodies[1], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, mz = (A.z + B.z) / 2, mvx = (A.vx + B.vx) / 2, mvy = (A.vy + B.vy) / 2;
            const r = .22, v = Math.sqrt(2 / (r * 2)) * .5;
            Object.assign(A, { x: mx - r, y: my, z: mz, vx: mvx, vy: mvy - v * 2, vz: 0 }); Object.assign(B, { x: mx + r, y: my, z: mz, vx: mvx, vy: mvy + v * 2, vz: 0 });
            chaotic = true;
        }
        // The captured sun spirals in the plane of the accretion disk (3D, seen at the disk's tilt):
        // it passes behind the hole (hidden by the shadow) and in front of it, staying round while it
        // shrinks, reddens and fades at the horizon. Its torn-off gas forms a luminous 3D spiral stream.
        const DISK_TILT = .2;
        function diskPoint(X, Z) { const pp = 1 / (1 - Z / (bh.R * 16)); return { x: bh.x + X * pp, y: bh.y + Z * DISK_TILT * pp, depth: Z, pp }; }
        function capture(i, q) {
            if (grabbed === i) grabbed = null;
            const X0 = q.x - bh.x, Z0 = (q.y - bh.y) / DISK_TILT;
            event = { sun: i, phase: 'fall', t: 0, a0: Math.atan2(Z0, X0), r0: clamp(Math.hypot(X0, q.y - bh.y), bh.R * 2.4, bh.R * 3.6), from: { x: q.x, y: q.y }, stream: [] };
            chaotic = true; canvas.style.cursor = '';
        }
        function fallState(e) {
            const f = Math.min(1, e.t / 3.4), r = bh.R * 1.08 + (e.r0 - bh.R * 1.08) * (1 - f) ** 1.5, a = e.a0 + 10.5 * f ** 1.7;
            return { f, X: Math.cos(a) * r, Z: Math.sin(a) * r };
        }
        function updateEvent(dt) {
            const e = event; if (!e) return; e.t += dt;
            if (e.phase === 'fall') {
                const st = fallState(e); e.f = st.f; e.X = st.X; e.Z = st.Z;
                e.stream.push([st.X, st.Z, 1]); if (e.stream.length > 220) e.stream.shift();
                if (st.f >= 1) { e.phase = 'quiet'; e.t = 0; }
            } else if (e.phase === 'quiet') { for (const p of e.stream) p[2] -= dt * .8; if (e.t > 1.3) supernova(); }
            else if (e.phase === 'rednova') { if (e.t > 1.6) { e.phase = 'swell'; e.t = 0; } }
            else if (e.phase === 'swell') { if (e.t > 4.5) { e.phase = 'giant'; e.t = 0; } }
            else if (e.phase === 'giant') { if (e.t > 13) { e.phase = 'collapse'; e.t = 0; } }
            else if (e.phase === 'collapse') { if (e.t > .7) { const q = bodyPx(bodies[e.giant]); e.cx = q.x; e.cy = q.y; supernova(); } }
            else if (e.phase === 'nova') { if (e.t > 6.5) { e.phase = 'reborn'; e.t = 0; if (e.type === 'merge') bodies[e.giant].m = 1; reborn(e.sun); } }
            else if (e.phase === 'reborn' && e.t > 2.2) event = null;
            for (const n of nebula) { n.x += n.vx * dt; n.y += n.vy * dt; n.vx *= Math.exp(-dt * .5); n.vy *= Math.exp(-dt * .5); n.life += dt; }
            nebula = nebula.filter(n => n.life < n.max);
            if (e.type === 'merge' && e.phase !== 'nova' && e.phase !== 'reborn') { const q = bodyPx(bodies[e.giant]); e.cx = q.x; e.cy = q.y; }
            if (shock) { shock.r += dt * 520 * k; if (shock.r > Math.max(width, height) * 1.4) shock = null; }
        }
        function supernova() {
            const e = event; e.phase = 'nova'; e.t = 0; e.flash = 1;
            const ox = e.type === 'merge' ? e.cx : bh.x, oy = e.type === 'merge' ? e.cy : bh.y; e.ox = ox; e.oy = oy;
            // Bipolar ejecta along the hole's spin axis: two glowing lobes like butterfly wings.
            const cols = ['255,120,80', '255,190,110', '120,170,255', '220,120,255', '255,90,140'];
            for (let n = 0; n < 420; n++) {
                const lobe = n % 2 ? 1 : -1, spread = (random() - .5) * 1.6, sp = (60 + random() * 260) * k, a = -Math.PI / 2 + (lobe > 0 ? Math.PI : 0) + spread * (.4 + random() * .6);
                nebula.push({ x: ox, y: oy, vx: Math.cos(a) * sp + (random() - .5) * 30 * k, vy: Math.sin(a) * sp * .9, life: 0, max: 6 + random() * 3, r: (6 + random() * 18) * k, c: cols[n % cols.length] });
            }
            shock = { r: bh.R, x: ox, y: oy, col: '255,220,190' };
            // The butterfly effect: the blast nudges every surviving body.
            for (let i = 0; i < 4; i++) { if (i === e.sun || (e.type === 'merge' && i === e.giant)) continue; const b = bodies[i], q = bodyPx(b), d = Math.hypot(q.x - ox, q.y - oy) || 1, push = toSim(sys.cx + (q.x - ox) / d * sys.scale, sys.cy + (q.y - oy) / d * sys.scale, 0); b.vx += push.x * .9; b.vy += push.y * .9; b.vz += (random() - .5) * 1.2; }
        }
        function reborn(i) {
            const others = [0, 1, 2].filter(j => j !== i), a = bodies[others[0]], b = bodies[others[1]];
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            Object.assign(bodies[i], { x: mx - dy / d * .9, y: my + dx / d * .9, z: (a.z + b.z) / 2, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2, vz: 0, m: 1 });
            trails[i].length = 0;
        }
        function drawFall(front) {
            const e = event; if (!e || (e.phase !== 'fall' && e.phase !== 'quiet')) return;
            const pal = SUN_PALS[e.sun], n = e.stream.length;
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            for (let j = 1; j < n; j++) {
                const [X0, Z0] = e.stream[j - 1], [X1, Z1, life] = e.stream[j];
                if ((Z1 >= 0) !== front) continue;
                const a = diskPoint(X0, Z0), b = diskPoint(X1, Z1), f = j / n, al = Math.max(0, Math.min(1, life)) * f;
                ctx.strokeStyle = `rgba(${pal.trail},${(.8 * al).toFixed(3)})`; ctx.lineWidth = (1 + f * 6 * k) * b.pp; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                ctx.strokeStyle = `rgba(255,250,235,${(.5 * al).toFixed(3)})`; ctx.lineWidth = (.6 + f * 1.6) * b.pp; ctx.stroke();
            }
            ctx.restore();
            if (e.phase !== 'fall' || (e.Z >= 0) !== front) return;
            const d = diskPoint(e.X, e.Z), blend = smooth(e.t / .6), x = e.from.x + (d.x - e.from.x) * blend, y = e.from.y + (d.y - e.from.y) * blend;
            const r = sys.sun * .95 * d.pp * (1 - .7 * e.f), fade = 1 - .9 * smooth((e.f - .7) / .3);
            ctx.save(); ctx.globalAlpha = fade; drawSun(ctx, x, y, r, pal, textures[e.sun], time, time * .3);
            // Gravitational redshift: the sun reddens as it nears the horizon.
            ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(200,40,20,${(.5 * smooth((e.f - .4) / .6)).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            ctx.restore();
        }
        function drawEvent() {
            const e = event; if (!e && !nebula.length && !shock) return;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const n of nebula) {
                const f = n.life / n.max, a = Math.sin(Math.PI * Math.min(1, f * 1.4)) * .26, r = n.r * (1 + n.life * .6);
                const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r); g.addColorStop(0, `rgba(${n.c},${a.toFixed(3)})`); g.addColorStop(1, `rgba(${n.c},0)`);
                ctx.fillStyle = g; ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
            }
            if (shock) { ctx.strokeStyle = `rgba(${shock.col},${Math.max(0, .6 - shock.r / (width * 1.6))})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(shock.x, shock.y, shock.r, shock.r * .8, 0, 0, TAU); ctx.stroke(); }
            if (e && e.phase === 'nova' && e.t < 1.5) {
                const f = 1 - e.t / 1.5, g = ctx.createRadialGradient(e.ox, e.oy, 0, e.ox, e.oy, 400 * k);
                g.addColorStop(0, `rgba(255,255,255,${f})`); g.addColorStop(.2, `rgba(255,200,140,${f * .7})`); g.addColorStop(1, 'rgba(255,120,80,0)');
                ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
            }
            ctx.restore();
            if (e && e.phase === 'nova' && e.t > .6) label(ctx, 'СУПЕРНОВА · ЭРВЭЭХЭЙ МАНАНЦАР', e.ox, e.oy + bh.R * 4, `rgba(255,214,190,${Math.min(1, (e.t - .6) * 2) * Math.min(1, (6.5 - e.t) / 1.5)})`, 'center', 10);
            if (e && e.phase === 'reborn') { const q = bodyPx(bodies[e.sun]), f = 1 - Math.min(1, e.t / 2.2); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,240,200,${f})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, sys.sun * (1 + (1 - f) * 6), 0, TAU); ctx.stroke(); ctx.restore(); }
        }

        /* --- Two junkyard robots playing table tennis on a wrecked starship hull --- */
        function groundY(x) { return ground.cy - Math.sqrt(Math.max(0, ground.R * ground.R - (x - ground.cx) ** 2)); }
        function robotScale() { return clamp(width / 1100, .62, 1) * 1.2; }
        function tableGeom() {
            const m = width < 640, s = robotScale(), tx = width * (m ? .58 : .68), tw = (m ? 50 : 70) * s, py = groundY(tx) - 4 * s;
            return { tx, tw, py, ty: py - 26 * s, s, depth: 10 * s, px0: tx - tw - 66 * s, px1: tx + tw + 66 * s };
        }
        const players = [0, 1].map(i => ({ side: i ? 1 : -1, swing: 0, wave: 0, beep: 0, excite: 0, t: random() * 3, hit: null }));
        const pong = { from: 0, t: 0, dur: 1.05, state: 'serve', score: [0, 0], hits: 0, missAt: 5, x: 0, y: 0, vx: 0, vy: 0, bounced: 0 };
        function playerX(i) { const g = tableGeom(); return g.tx + players[i].side * (g.tw + 34 * g.s); }
        function paddlePoint(i) { const g = tableGeom(), x = playerX(i); return { x: x - players[i].side * 22 * g.s, y: g.py - 50 * g.s }; }
        function updateRobot(dt) {
            const g = tableGeom();
            for (const r of players) { r.t += dt; r.wave = Math.max(0, r.wave - dt * .6); r.beep = Math.max(0, r.beep - dt); r.excite = Math.max(0, r.excite - dt * .5); r.swing *= Math.exp(-dt * 5); }
            const P = pong; P.t += dt;
            if (P.state === 'serve') {
                const a = paddlePoint(P.from); P.x = a.x; P.y = a.y - Math.sin(Math.min(1, P.t / .6) * Math.PI) * 26 * g.s;
                if (P.t > .7) { P.state = 'rally'; P.t = 0; P.hits = 0; P.missAt = 4 + Math.floor(random() * 8); players[P.from].swing = 1; }
            } else if (P.state === 'rally') {
                const to = 1 - P.from, a = paddlePoint(P.from), b = paddlePoint(to), bx = g.tx + players[to].side * g.tw * .55, u = Math.min(1, P.t / P.dur);
                if (u < .55) { const v = u / .55; P.x = a.x + (bx - a.x) * v; P.y = a.y + (g.ty - a.y) * v - Math.sin(v * Math.PI) * 38 * g.s; }
                else { const v = (u - .55) / .45; P.x = bx + (b.x - bx) * v; P.y = g.ty + (b.y - g.ty) * v - Math.sin(v * Math.PI) * 24 * g.s; }
                if (u > .72) players[to].swing = Math.max(players[to].swing, -smooth((u - .72) / .28) * .8);
                if (u >= 1) {
                    if (P.hits >= P.missAt) {
                        P.state = 'miss'; P.t = 0; P.vx = players[to].side * 150 * g.s; P.vy = -60 * g.s; P.bounced = 0;
                        P.score[P.from]++; players[to].excite = 1; players[to].beep = 1.1; players[P.from].wave = 1.4;
                    } else { P.from = to; P.t = 0; P.hits++; P.dur = .85 + random() * .35; players[to].swing = 1; }
                }
            } else if (P.state === 'miss') {
                P.vy += 600 * g.s * dt; P.x += P.vx * dt; P.y += P.vy * dt;
                const gy = (P.x > g.px0 && P.x < g.px1 ? g.py - 3 * g.s : groundY(P.x)) - 3 * g.s;
                if (P.y > gy && P.vy > 0) { P.y = gy; P.vy *= -.5; P.vx *= .7; P.bounced++; }
                if (P.t > 1.8) { P.state = 'serve'; P.t = 0; P.from = 1 - P.from; }
            }
        }
        function drawTable() {
            const { tx, tw, ty, s, depth, py, px0, px1 } = tableGeom(), x0 = tx - tw, x1 = tx + tw;
            // A level deck plate salvaged from the same ship, so the court is flat on the curved planet.
            ctx.fillStyle = '#2a211d'; ctx.beginPath(); ctx.moveTo(px0, py); ctx.lineTo(px1, py); ctx.lineTo(px1, groundY(px1) + 2); ctx.lineTo(px0, groundY(px0) + 2); ctx.closePath(); ctx.fill();
            const deck = ctx.createLinearGradient(0, py - 5 * s, 0, py + 4 * s); deck.addColorStop(0, '#8d6a4f'); deck.addColorStop(1, '#4a3324');
            ctx.fillStyle = deck; ctx.fillRect(px0, py - 3 * s, px1 - px0, 6 * s); ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1; ctx.strokeRect(px0, py - 3 * s, px1 - px0, 6 * s);
            ctx.fillStyle = '#c9a26a'; for (let xx = px0 + 8 * s; xx < px1; xx += 16 * s) ctx.fillRect(xx, py - 1 * s, 1.6, 1.6);
            // Supports: a rusty barrel and a stack of tyres.
            const gl = py - 3 * s, gr = py - 3 * s;
            ctx.fillStyle = '#6b3b25'; ctx.fillRect(x0 + 6 * s, ty + 6 * s, 16 * s, gl - ty - 6 * s); ctx.fillStyle = '#4a2818'; ctx.fillRect(x0 + 6 * s, ty + 14 * s, 16 * s, 3 * s);
            for (let i = 0; i < 3; i++) { const yy = gr - 5 * s - i * 8 * s; ctx.fillStyle = '#1e1b1c'; ctx.beginPath(); ctx.ellipse(x1 - 16 * s, yy, 13 * s, 5 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b0a0a'; ctx.beginPath(); ctx.ellipse(x1 - 16 * s, yy, 5 * s, 2 * s, 0, 0, TAU); ctx.fill(); }
            // The tabletop is a slab of wrecked starship hull with a broken corner, scorch marks and rivets.
            const top = ctx.createLinearGradient(0, ty - depth, 0, ty); top.addColorStop(0, '#9aa6b1'); top.addColorStop(1, '#5d6873');
            ctx.fillStyle = top; ctx.strokeStyle = '#151b20'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(x0 + 12 * s, ty - depth); ctx.lineTo(x1 - 2 * s, ty - depth); ctx.lineTo(x1 + 8 * s, ty - depth * .3); ctx.lineTo(x1, ty);
            ctx.lineTo(x0 + 18 * s, ty); ctx.lineTo(x0 + 12 * s, ty + 3 * s); ctx.lineTo(x0 + 6 * s, ty - 1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#3a434c'; ctx.beginPath(); ctx.moveTo(x0 + 6 * s, ty - 1 * s); ctx.lineTo(x0 + 12 * s, ty + 3 * s); ctx.lineTo(x0 + 18 * s, ty); ctx.lineTo(x1, ty); ctx.lineTo(x1, ty + 6 * s); ctx.lineTo(x0 + 4 * s, ty + 6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.save(); ctx.globalAlpha = .45; const burn = ctx.createRadialGradient(tx - tw * .45, ty - depth * .5, 0, tx - tw * .45, ty - depth * .5, 18 * s); burn.addColorStop(0, '#1a1210'); burn.addColorStop(1, 'rgba(26,18,16,0)'); ctx.fillStyle = burn; ctx.fillRect(x0, ty - depth, tw * 2, depth); ctx.restore();
            ctx.strokeStyle = 'rgba(240,240,230,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 8 * s, ty - depth * .5); ctx.lineTo(x1 + 2 * s, ty - depth * .5); ctx.stroke();
            ctx.fillStyle = '#2a3138'; for (let xx = x0 + 16 * s; xx < x1; xx += 14 * s) { ctx.fillRect(xx, ty + 2 * s, 1.6, 1.6); }
            ctx.fillStyle = 'rgba(220,120,60,.55)'; ctx.font = `700 ${Math.round(6 * s)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'left'; ctx.fillText('NX-17', x1 - 34 * s, ty + 5 * s);
            // Net made from a bent pipe and a strip of chain-link.
            ctx.strokeStyle = '#8c969e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 11 * s); ctx.lineTo(tx + 9 * s, ty - depth - 10 * s); ctx.lineTo(tx + 9 * s, ty - depth); ctx.stroke();
            ctx.strokeStyle = 'rgba(200,210,220,.55)'; ctx.lineWidth = .7;
            for (let n = 1; n < 6; n++) { const f = n / 6; ctx.beginPath(); ctx.moveTo(tx + 9 * s * f, ty - depth * f); ctx.lineTo(tx + 9 * s * f, ty - depth * f - 10.5 * s); ctx.stroke(); }
            for (let n = 0; n < 4; n++) { const h = n * 3 * s; ctx.beginPath(); ctx.moveTo(tx, ty - h); ctx.lineTo(tx + 9 * s, ty - depth - h); ctx.stroke(); }
            // Scoreboard: an old screen on a pole.
            const sy = ty - 70 * s; ctx.fillStyle = '#4a4038'; ctx.fillRect(tx - 1.5 * s, sy + 14 * s, 3 * s, ty - depth - sy - 14 * s);
            ctx.fillStyle = '#2c2a28'; ctx.fillRect(tx - 22 * s, sy - 4 * s, 44 * s, 20 * s); ctx.fillStyle = '#123a2e'; ctx.fillRect(tx - 19 * s, sy - 1 * s, 38 * s, 14 * s);
            ctx.fillStyle = '#7dffb0'; ctx.font = `700 ${Math.round(10 * s)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${pong.score[0]} : ${pong.score[1]}`, tx, sy + 6.5 * s); ctx.textBaseline = 'alphabetic';
        }
        function drawRobotNow() {
            const g = tableGeom(), P = pong;
            drawTable();
            players.forEach((r, i) => {
                const x = playerX(i), y = g.py - 3 * g.s, s = g.s, dir = -r.side, bob = r.beep > 0 ? Math.sin((1 - r.beep) * Math.PI) * 12 * s : Math.abs(Math.sin(r.t * 5)) * 1.5 * s;
                const lookX = clamp((P.x - x) / 120 * dir, -1, 1), lookY = clamp((P.y - (y - 80 * s)) / 60, -1, 1);
                ctx.save(); ctx.translate(x, y - bob); ctx.scale(s * dir, s);
                ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 1, 22, 4, 0, 0, TAU); ctx.fill();
                const headY = drawRobot(ctx, { walk: r.t * 6, moving: false, t: r.t + time, neck: .25 + .2 * Math.max(0, -lookY), wave: r.wave, carry: false, reach: false, paddle: true, swing: r.swing, lookX, lookY, blink: (r.t % 3.9) < .12, excite: r.excite });
                ctx.restore();
                r.hit = { x, y: y + headY * s / 2, r: 40 * s };
                if (r.beep > 0) {
                    const bx = x + (r.side > 0 ? 10 : -74) * s, by = y + headY * s - 24 * s;
                    ctx.fillStyle = 'rgba(240,236,224,.95)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by - 16, 64, 20, 9) : ctx.rect(bx, by - 16, 64, 20); ctx.fill();
                    ctx.font = '700 11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#3a2a20'; ctx.textAlign = 'left'; ctx.fillText('бип-буп!', bx + 8, by - 2);
                }
            });
            // The ball, with a soft shadow on the table or the ground.
            const onTable = Math.abs(P.x - g.tx) < g.tw, sh = onTable ? g.ty - g.depth * .5 : P.x > g.px0 && P.x < g.px1 ? g.py - 3 * g.s : groundY(P.x);
            ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(P.x, sh, 4 * g.s, 1.4 * g.s, 0, 0, TAU); ctx.fill();
            const bg = ctx.createRadialGradient(P.x - 1, P.y - 1, 0, P.x, P.y, 3.4 * g.s); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#ffb36b');
            ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(P.x, P.y, 3.2 * g.s, 0, TAU); ctx.fill();
        }

        /* --- Voyager 1 drifting across the far sky, James Webb hovering at its post --- */
        const webb = { x: 0, y: 0, s: 1, glint: 0, msg: 0, yaw: -.6, pitch: .32, vyaw: .25, vpitch: 0, drag: null }, voyager = { x: 0, y: 0, s: 1, glint: 0, msg: 0 };
        function placeProbes() {
            const m = width < 640;
            Object.assign(webb, { x: width * (m ? .2 : .13), y: height * (m ? .34 : .17), s: k * (m ? .62 : .95) });
            voyager.y = height * (m ? .6 : .62); voyager.s = k * (m ? .55 : .8); if (!voyager.x) voyager.x = width * .78;
        }
        function updateProbes(dt) {
            voyager.x -= 9 * k * dt; if (voyager.x < -140 * voyager.s) voyager.x = width + 140 * voyager.s;
            for (const p of [webb, voyager]) { p.glint = Math.max(0, p.glint - dt * .8); p.msg = Math.max(0, p.msg - dt); }
            // After a drag the telescope coasts and settles back into a slow turn.
            if (!webb.drag) { webb.yaw += webb.vyaw * dt; webb.pitch = clamp(webb.pitch + webb.vpitch * dt, -1.25, 1.25); webb.vyaw += (.25 - webb.vyaw) * Math.min(1, dt * .8); webb.vpitch *= Math.exp(-dt * 2); }
        }
        function drawProbes() {
            const wy = webb.y + Math.sin(time * .6) * 3 * k;
            ctx.save(); ctx.translate(webb.x, wy); drawWebb3D(ctx, webb.yaw, webb.pitch, 8.2 * webb.s, time, webb.glint); ctx.restore();
            label(ctx, webb.drag ? 'JAMES WEBB · 3D' : 'JAMES WEBB · чирж эргүүл', webb.x, wy + 70 * webb.s, 'rgba(255,224,150,.75)', 'center', 8);
            const vy = voyager.y + Math.sin(time * .35) * 4 * k;
            ctx.save(); ctx.translate(voyager.x, vy); ctx.rotate(-.12); ctx.scale(voyager.s, voyager.s); drawVoyager(ctx, time, voyager.glint); ctx.restore();
            label(ctx, 'VOYAGER 1', voyager.x, vy + 52 * voyager.s, 'rgba(200,215,235,.7)', 'center', 8);
            for (const [p, text, y] of [[webb, '◎ Хэт улаан туяаны зураг авлаа!', wy - 58 * webb.s], [voyager, '📡 «Сайн уу, сансар!»', vy - 40 * voyager.s]]) {
                if (p.msg <= 0) continue;
                ctx.globalAlpha = Math.min(1, p.msg); ctx.font = '600 11px ui-monospace, Menlo, monospace';
                const w = ctx.measureText(text).width + 16, x = clamp(p.x - w / 2, 6, width - w - 6);
                ctx.fillStyle = 'rgba(14,20,48,.9)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - 16, w, 22, 10) : ctx.rect(x, y - 16, w, 22); ctx.fill();
                ctx.fillStyle = '#ffe2a0'; ctx.textAlign = 'left'; ctx.fillText(text, x + 8, y - 1); ctx.globalAlpha = 1;
            }
        }
        const onProbe = p => Math.hypot(p.x - webb.x, p.y - webb.y) < 75 * webb.s ? webb : Math.hypot(p.x - voyager.x, p.y - voyager.y) < 50 * voyager.s ? voyager : null;

        /* --- Pointer: drag a sun (toward the hole if you dare), poke the robot --- */
        const grab = { x: 0, y: 0, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0, id: null };
        const point = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * width / r.width, y: (e.clientY - r.top) * height / r.height }; };
        function sunAt(p) { let hit = null, best = -Infinity; for (const i of [0, 1, 2].filter(alive)) { const q = bodyPx(bodies[i]); if (Math.hypot(q.x - p.x, q.y - p.y) < sunRadius(i) * q.p * 1.6 && q.depth > best) { hit = i; best = q.depth; } } return hit; }
        const onRobot = p => players.find(r => r.hit && Math.hypot(p.x - r.hit.x, p.y - r.hit.y) < r.hit.r);
        canvas.addEventListener('pointerdown', e => {
            if (!e.isPrimary || e.button !== 0) return;
            const p = point(e), i = sunAt(p);
            if (i !== null) {
                grabbed = i; chaotic = true; const b0 = bodies[i], s = toSim(p.x, p.y, b0.z, bodyPx(b0).p);
                Object.assign(grab, { x: s.x, y: s.y, vx: 0, vy: 0, lx: s.x, ly: s.y, lt: performance.now(), id: e.pointerId });
                try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
                canvas.style.cursor = 'grabbing'; return;
            }
            const probe = onProbe(p);
            if (probe === webb) { webb.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false }; webb.vyaw = 0; webb.vpitch = 0; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} canvas.style.cursor = 'grabbing'; return; }
            if (probe) { probe.glint = 1; probe.msg = 2.6; return; }
            const bot = onRobot(p); if (bot) { bot.wave = 1.6; bot.beep = 1.2; bot.excite = 1; }
        });
        canvas.addEventListener('pointermove', e => {
            const p = point(e);
            if (grabbed !== null && e.pointerId === grab.id) {
                const gb = bodies[grabbed], s = toSim(p.x, p.y, gb.z, bodyPx(gb).p), now = performance.now(), dt = Math.max(8, now - grab.lt) / 1000 * SIM_RATE;
                grab.vx = grab.vx * .5 + clamp((s.x - grab.lx) / dt, -6, 6) * .5; grab.vy = grab.vy * .5 + clamp((s.y - grab.ly) / dt, -6, 6) * .5;
                const lim = Math.max(width, height) / sys.scale; grab.x = clamp(s.x, -lim, lim); grab.y = clamp(s.y, -lim, lim); grab.lx = s.x; grab.ly = s.y; grab.lt = now;
                return;
            }
            if (webb.drag && e.pointerId === webb.drag.id) {
                const d = webb.drag, now = performance.now(), dt = Math.max(8, now - d.lt) / 1000, dx = e.clientX - d.lx, dy = e.clientY - d.ly;
                webb.yaw += dx * .012; webb.pitch = clamp(webb.pitch + dy * .01, -1.25, 1.25);
                webb.vyaw = webb.vyaw * .5 + dx * .012 / dt * .5; webb.vpitch = webb.vpitch * .5 + dy * .01 / dt * .5;
                if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
                d.lx = e.clientX; d.ly = e.clientY; d.lt = now; return;
            }
            if (e.pointerType === 'mouse') canvas.style.cursor = sunAt(p) !== null ? 'grab' : onProbe(p) === webb ? 'grab' : onRobot(p) || onProbe(p) ? 'pointer' : '';
        });
        const release = e => {
            if (webb.drag && e.pointerId === webb.drag.id) {
                if (!webb.drag.moved) { webb.glint = 1; webb.msg = 2.6; webb.vyaw = .25; }
                webb.vyaw = clamp(webb.vyaw, -6, 6); webb.vpitch = clamp(webb.vpitch, -4, 4); webb.drag = null; canvas.style.cursor = ''; return;
            }
            if (grabbed === null || e.pointerId !== grab.id) return;
            const b = bodies[grabbed], v = Math.hypot(grab.vx, grab.vy);
            b.vx = v > 3.5 ? grab.vx * 3.5 / v : grab.vx; b.vy = v > 3.5 ? grab.vy * 3.5 / v : grab.vy; b.vz = (random() - .5) * Math.min(1.6, v * .5);
            grabbed = null; canvas.style.cursor = '';
        };
        canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
        canvas.addEventListener('touchstart', e => { const t = e.touches[0]; if (t && (sunAt(point(t)) !== null || onProbe(point(t)) === webb)) e.preventDefault(); }, { passive: false });

        /* --- Layout, cached sky and the scrap planet --- */
        function layout() {
            const m = width < 640;
            k = clamp(Math.min(width, height) / 720, .55, 1.15);
            sys = { cx: width * (m ? .5 : .42), cy: height * (m ? .38 : .4), scale: Math.min(width, height) * (m ? .15 : .16), sun: (m ? 17 : 24) * k };
            bh = { x: width * (m ? .8 : .82), y: height * (m ? .14 : .24), R: Math.min(width, height) * (m ? .045 : .052) };
            ground = { cx: width / 2, R: width * 1.8, top: height * (m ? .84 : .8) };
            ground.cy = ground.top + ground.R;
            placeProbes();
            const c = mkCanvas(width * ratio, height * ratio), x = c.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0); back = c;
            x.fillStyle = '#030611'; x.fillRect(0, 0, width, height);
            const neb = (px, py, r, col) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, width, height); };
            x.globalCompositeOperation = 'screen';
            neb(width * .2, height * .25, width * .45, 'rgba(80,40,160,.28)'); neb(width * .7, height * .6, width * .5, 'rgba(20,90,140,.22)');
            neb(width * .55, height * .1, width * .3, 'rgba(170,50,110,.16)'); neb(bh.x, bh.y, bh.R * 9, 'rgba(255,140,60,.12)');
            x.save(); x.translate(width / 2, height / 2); x.rotate(-.35);
            const band = x.createLinearGradient(0, -height * .18, 0, height * .18); band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(.5, 'rgba(150,170,255,.10)'); band.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = band; x.fillRect(-width, -height * .18, width * 2, height * .36); x.restore();
            x.globalCompositeOperation = 'source-over';
            const r = rng(11);
            stars = Array.from({ length: Math.round(width * height / 1400) }, () => ({ x: r() * width, y: r() * ground.top, s: r() < .06 ? 1.6 + r() : .4 + r() * .9, p: r() * TAU, c: r() < .15 ? '#ffd9b0' : r() < .2 ? '#b8d4ff' : '#ffffff' }));
            // Scrap planet: curved horizon, rusty regolith, craters and heaps of junk lit by the suns.
            x.beginPath(); x.arc(ground.cx, ground.cy, ground.R, 0, TAU);
            const soil = x.createLinearGradient(0, ground.top - 10, 0, height); soil.addColorStop(0, '#5a4236'); soil.addColorStop(.25, '#2e2320'); soil.addColorStop(1, '#120d0c');
            x.fillStyle = soil; x.fill();
            x.save(); x.clip();
            for (let i = 0; i < 18; i++) { const cx = r() * width, cy = ground.top + 20 + r() * (height - ground.top), rr = 6 + r() * 22; x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(cx, cy, rr, rr * .3, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(200,140,100,.18)'; x.beginPath(); x.ellipse(cx, cy - 1, rr, rr * .3, 0, Math.PI, TAU); x.stroke(); }
            x.restore();
            x.strokeStyle = 'rgba(255,190,120,.55)'; x.lineWidth = 2; x.beginPath(); x.arc(ground.cx, ground.cy, ground.R, Math.PI * 1.25, Math.PI * 1.75); x.stroke();
            const heaps = m ? 8 : 13;
            for (let i = 0; i < heaps; i++) {
                const hx = (i + .2 + r() * .6) / heaps * width, tg = tableGeom();
                if (Math.abs(hx - tg.tx) < tg.tw + 95 * tg.s) continue;
                const hs = (1 + r() * .8) * k, gy = ground.cy - Math.sqrt(Math.max(0, ground.R ** 2 - (hx - ground.cx) ** 2));
                for (let j = 0; j < 7; j++) drawJunk(x, hx + (r() - .5) * 60 * hs, gy + 8 + r() * 12 - (j > 4 ? 14 * hs : 0), hs * (.6 + r() * .6), r);
            }
            // A wrecked rocket lying on its side and a crooked sign.
            const wx = width * (m ? .2 : .14), wy = ground.cy - Math.sqrt(ground.R ** 2 - (wx - ground.cx) ** 2) + 4;
            x.save(); x.translate(wx, wy); x.rotate(-.22); x.scale(k, k);
            x.fillStyle = '#9aa3aa'; x.strokeStyle = '#141414'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-40, -8); x.lineTo(28, -12); x.quadraticCurveTo(50, -6, 28, 0); x.lineTo(-40, 2); x.closePath(); x.fill(); x.stroke();
            x.fillStyle = '#b94a3a'; x.beginPath(); x.moveTo(-40, -8); x.lineTo(-52, -20); x.lineTo(-34, -8); x.closePath(); x.fill(); x.fillStyle = '#1d2b36'; x.beginPath(); x.arc(14, -6, 4, 0, TAU); x.fill(); x.restore();
            const sx = width * (m ? .3 : .38), sy = ground.cy - Math.sqrt(ground.R ** 2 - (sx - ground.cx) ** 2) + 6;
            x.save(); x.translate(sx, sy); x.rotate(.12); x.fillStyle = '#5a4030'; x.fillRect(-2, -34 * k, 4, 34 * k); x.fillStyle = '#c9a26a'; x.fillRect(-30 * k, -44 * k, 60 * k, 16 * k);
            x.fillStyle = '#3a2618'; x.font = `700 ${Math.round(8 * k + 1)}px ui-monospace, Menlo, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ХОГИЙН ЦЭГ', 0, -36 * k); x.restore();
        }

        /* --- Drawing --- */
        function drawStars() {
            const E = bh.R * 2.3;
            for (const s of stars) {
                const dx = s.x - bh.x, dy = s.y - bh.y, d = Math.hypot(dx, dy) || 1, img = lensImage(d, E);
                ctx.globalAlpha = .45 + .55 * Math.sin(time * 1.4 + s.p) ** 2; ctx.fillStyle = s.c;
                ctx.fillRect(bh.x + dx / d * img, bh.y + dy / d * img, s.s, s.s);
                if (d < E * 2.6) { const inner = (Math.sqrt(d * d + 4 * E * E) - d) / 2; ctx.globalAlpha *= .45; ctx.fillRect(bh.x - dx / d * inner, bh.y - dy / d * inner, s.s, s.s); }
            }
            ctx.globalAlpha = 1;
        }
        function drawGrid() {
            const ws = [{ x: bh.x, y: bh.y, p: bh.R * bh.R * 2.2 }];
            for (const i of [0, 1, 2].filter(alive)) { const q = bodyPx(bodies[i]); ws.push({ x: q.x, y: q.y, p: 900 * k * k * bodies[i].m }); }
            const gap = 40 * k, cols = Math.ceil(width / gap) + 1, rows = Math.ceil(ground.top / gap) + 1, pts = new Float32Array(cols * rows * 2);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const x = c * gap, y = r * gap; let dx = 0, dy = 0;
                for (const w of ws) { const ex = w.x - x, ey = w.y - y, d = Math.hypot(ex, ey) || 1, s = Math.min(w.p / (d + 30), d * .75); dx += ex / d * s; dy += ey / d * s; }
                pts[(r * cols + c) * 2] = x + dx; pts[(r * cols + c) * 2 + 1] = y + dy;
            }
            ctx.strokeStyle = 'rgba(90,130,220,.12)'; ctx.lineWidth = 1; ctx.beginPath();
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = (r * cols + c) * 2; c ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]); }
            for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const i = (r * cols + c) * 2; r ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]); }
            ctx.stroke();
        }
        function diskArc(a0, a1, boost) {
            const R = bh.R, inner = R * 1.55, outer = R * 3.5, tilt = .2;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 9; i++) {
                const r = inner + (outer - inner) * i / 8, g = ctx.createLinearGradient(bh.x - outer, 0, bh.x + outer, 0), hot = (1 - i / 9) * boost;
                g.addColorStop(0, `rgba(255,248,225,${Math.min(1, .55 * hot + .15).toFixed(3)})`); g.addColorStop(.5, `rgba(255,170,80,${Math.min(1, .45 * hot + .1).toFixed(3)})`); g.addColorStop(1, `rgba(170,60,25,${Math.min(1, .3 * hot + .05).toFixed(3)})`);
                ctx.strokeStyle = g; ctx.lineWidth = (outer - inner) / 8 * 1.25; ctx.beginPath(); ctx.ellipse(bh.x, bh.y, r, r * tilt, -.08, a0, a1); ctx.stroke();
            }
            for (let n = 0; n < 46; n++) {
                const r = inner + (outer - inner) * ((n * .618) % 1), a = (n * 2.39 + time * 2.4 * Math.pow(inner / r, 1.5)) % TAU;
                if (!(a >= a0 && a <= a1) && !(a + TAU >= a0 && a + TAU <= a1)) continue;
                ctx.strokeStyle = `rgba(255,236,200,${(.6 * (.55 + .45 * Math.cos(a - Math.PI))).toFixed(3)})`; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.ellipse(bh.x, bh.y, r, r * tilt, -.08, a, a + .22); ctx.stroke();
            }
            ctx.restore();
        }
        function drawBlackHole() {
            const { x, y, R } = bh, boost = event && (event.phase === 'fall' || event.phase === 'quiet') ? 1.8 : 1;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const halo = ctx.createRadialGradient(x, y, R, x, y, R * 5); halo.addColorStop(0, `rgba(255,160,70,${.35 * boost})`); halo.addColorStop(1, 'rgba(255,160,70,0)');
            ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, R * 5, 0, TAU); ctx.fill(); ctx.restore();
            diskArc(Math.PI, TAU, boost);
            drawFall(false);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const [r, w, a, a0, a1] of [[R * 1.5, R * .42, .85, Math.PI * 1.02, Math.PI * 1.98], [R * 1.22, R * .14, .55, Math.PI * .08, Math.PI * .92]]) {
                const g = ctx.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, `rgba(255,245,215,${a})`); g.addColorStop(.6, `rgba(255,160,70,${a * .8})`); g.addColorStop(1, `rgba(180,70,30,${a * .5})`);
                ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
            }
            ctx.restore();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
            ctx.save(); ctx.shadowColor = '#ffd9a0'; ctx.shadowBlur = 12; ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, R * 1.04, 0, TAU); ctx.stroke(); ctx.restore();
            diskArc(0, Math.PI, boost);
            drawFall(true);
            const roomy = x + R * 2.25 + 120 < width;
            label(ctx, 'ХАР НҮХ', x, y - R * 2.5 - (roomy ? 0 : 12), '#ffd9a0', 'center');
            if (roomy) {
                ctx.strokeStyle = 'rgba(255,217,160,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + R * .74, y - R * .74); ctx.lineTo(x + R * 2.2, y - R * 1.9); ctx.lineTo(x + R * 3.6, y - R * 1.9); ctx.stroke();
                label(ctx, 'Үзэгдлийн хаяа', x + R * 2.25, y - R * 2.05, '#ffe8c4', 'left', 10);
            } else label(ctx, 'үзэгдлийн хаяа', x, y - R * 2.5, '#ffe8c4', 'center', 9);
        }
        function drawBodies() {
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            trails.forEach((tr, i) => {
                const col = i === 3 ? '120,200,255' : SUN_PALS[i].trail;
                for (let j = 1; j < tr.length; j++) {
                    const a = toPx(tr[j - 1][0], tr[j - 1][1], tr[j - 1][2]), b = toPx(tr[j][0], tr[j][1], tr[j][2]);
                    ctx.strokeStyle = `rgba(${col},${(j / tr.length * (i === 3 ? .5 : .55) * clamp(.55 + b.depth * .25, .3, 1)).toFixed(3)})`; ctx.lineWidth = ((i === 3 ? 1 : 2.4) * k * j / tr.length + .3) * b.p;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            });
            // Mass transfer: when two suns come very close a bridge of hot gas flows between them.
            for (const [a, c, d] of contacts) {
                const A = bodyPx(bodies[a]), B = bodyPx(bodies[c]), f = clamp(1 - d / .55, 0, 1), pa = SUN_PALS[a], pb = SUN_PALS[c];
                const mx = (A.x + B.x) / 2 + (B.y - A.y) * .25, my = (A.y + B.y) / 2 - (B.x - A.x) * .25;
                const g = ctx.createLinearGradient(A.x, A.y, B.x, B.y); g.addColorStop(0, `rgba(${pa.trail},${(.7 * f).toFixed(3)})`); g.addColorStop(1, `rgba(${pb.trail},${(.7 * f).toFixed(3)})`);
                ctx.strokeStyle = g; ctx.lineWidth = sys.sun * .5 * f * A.p; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(mx, my, B.x, B.y); ctx.stroke();
                for (let n = 0; n < 14; n++) { const u = (time * 1.6 + n / 14) % 1, x = (1 - u) ** 2 * A.x + 2 * (1 - u) * u * mx + u * u * B.x, y = (1 - u) ** 2 * A.y + 2 * (1 - u) * u * my + u * u * B.y; ctx.fillStyle = `rgba(255,240,210,${(.8 * f * Math.sin(Math.PI * u)).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 * k * A.p, 0, TAU); ctx.fill(); }
                if (d < .25) { const env = ctx.createRadialGradient((A.x + B.x) / 2, (A.y + B.y) / 2, 0, (A.x + B.x) / 2, (A.y + B.y) / 2, sys.sun * 3.5); env.addColorStop(0, `rgba(255,190,140,${(.45 * (1 - d / .25)).toFixed(3)})`); env.addColorStop(1, 'rgba(255,150,100,0)'); ctx.fillStyle = env; ctx.fillRect((A.x + B.x) / 2 - sys.sun * 3.5, (A.y + B.y) / 2 - sys.sun * 3.5, sys.sun * 7, sys.sun * 7); }
            }
            ctx.restore();
            // Depth-sorted drawing: far suns are smaller, dimmer and warmer; near ones cover them.
            const list = [0, 1, 2, 3].filter(i => i === 3 || alive(i)).map(i => ({ i, q: bodyPx(bodies[i]) })).sort((a, b) => a.q.depth - b.q.depth);
            for (const { i, q } of list) {
                if (i === 3) { const pr = 5 * k * q.p, pg = ctx.createRadialGradient(q.x - pr * .4, q.y - pr * .4, 0, q.x, q.y, pr); pg.addColorStop(0, '#d8f0ff'); pg.addColorStop(1, '#2b5a8f'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(q.x, q.y, pr, 0, TAU); ctx.fill(); continue; }
                const near = clamp(.5 + q.depth * .35, 0, 1), grow = event && event.phase === 'reborn' && event.sun === i ? smooth(event.t / 1.6) : 1;
                const isGiant = event && event.type === 'merge' && event.giant === i && event.phase !== 'nova' && event.phase !== 'reborn';
                const r = sunRadius(i) * q.p * (grabbed === i ? 1.1 : 1) * grow;
                ctx.save(); ctx.globalAlpha = .62 + .38 * near;
                if (isGiant) drawGiant(q, r, i);
                else drawSun(ctx, q.x, q.y, r, SUN_PALS[i], textures[i], time, time * (.05 + i * .02));
                ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(90,20,40,${(.38 * (1 - near)).toFixed(3)})`; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
                ctx.restore();
                label(ctx, isGiant ? GIANT_PAL.name : SUN_PALS[i].name, q.x, q.y - r - 14 * k, `rgba(230,236,255,${(.45 + .4 * near).toFixed(2)})`, 'center', 9);
            }
        }
        function drawGiant(q, r, i) {
            const e = event;
            if (e.phase === 'rednova') {
                const f = e.t / 1.6;
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 9); g.addColorStop(0, `rgba(255,240,220,${1 - f})`); g.addColorStop(.25, `rgba(255,120,70,${.8 * (1 - f)})`); g.addColorStop(1, 'rgba(200,40,30,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r * 9, 0, TAU); ctx.fill(); ctx.restore();
                drawSun(ctx, q.x, q.y, r, SUN_PALS[i], textures[i], time, time * .1);
                return;
            }
            const mix = e.phase === 'swell' ? smooth(e.t / 4.5) : 1, dim = e.phase === 'giant' ? .5 + .5 * Math.sin(e.t * .45) : 1;
            if (mix < 1) drawSun(ctx, q.x, q.y, r, SUN_PALS[i], textures[i], time, time * .05);
            ctx.save(); ctx.globalAlpha *= mix;
            // Dusty, lopsided mass loss around the bloated star.
            ctx.globalCompositeOperation = 'lighter';
            for (let n = 0; n < 6; n++) { const a = n * 1.1 + time * .05, d = r * (1.5 + .4 * Math.sin(time * .3 + n)), pr = r * (.9 + .3 * (n % 3)); const g = ctx.createRadialGradient(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, 0, q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, pr); g.addColorStop(0, 'rgba(255,110,60,.10)'); g.addColorStop(1, 'rgba(255,110,60,0)'); ctx.fillStyle = g; ctx.fillRect(q.x + Math.cos(a) * d - pr, q.y + Math.sin(a) * d - pr, pr * 2, pr * 2); }
            ctx.globalCompositeOperation = 'source-over';
            drawSun(ctx, q.x, q.y, r, GIANT_PAL, giantTex, time, time * .02);
            // "Great dimming": a dark dust veil drifts over the lower half now and then.
            ctx.save(); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.clip();
            const veil = ctx.createLinearGradient(q.x, q.y - r, q.x, q.y + r); veil.addColorStop(0, 'rgba(20,6,4,0)'); veil.addColorStop(.55, `rgba(20,6,4,${(.55 * (1 - dim)).toFixed(3)})`); veil.addColorStop(1, `rgba(20,6,4,${(.75 * (1 - dim)).toFixed(3)})`);
            ctx.fillStyle = veil; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); ctx.restore();
            if (e.phase === 'collapse') { const f = e.t / .7; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,250,240,${f})`; ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.2, 0, TAU); ctx.fill(); }
            ctx.restore();
        }
        function spaceScene() {
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
            ctx.drawImage(back, 0, 0, width, height);
            drawStars(); drawGrid(); drawProbes(); drawBlackHole(); drawEvent(); drawBodies();
            drawRobotNow();
            const e = event, text = e && e.type === 'merge' && e.phase === 'rednova' ? '✸ Хоёр нар нийлж УЛААН НОВА гялбалаа' : e && e.phase === 'swell' ? '◉ Нийлсэн од хавдаж улайж байна — аврага улаан од болж хувирна…' : e && e.phase === 'giant' ? '● Аврага улаан од (Бетельгейзе шиг) — лугшиж, тоосоор бүрхэгдэн бүдгэрнэ' : e && e.phase === 'collapse' ? '… цөм нурж байна!'
                : contacts.some(c => c[2] < .3) ? '⇄ Нарс маш ойр эргэлдэж, бие биеэсээ масс сорж байна' : e && e.phase === 'fall' ? '☄ Нар хар нүхэнд сорогдож, урт гэрлэн урсгал болж байна…' : e && e.phase === 'quiet' ? '… хар нүх нарыг залгилаа' : e && e.phase === 'nova' ? '✸ Супернова! Эрвээхэй мананцар цацагдаж, бүх тойрог зам хөдөллөө' : e && e.phase === 'reborn' ? '✦ Шинэ нар асав — гурван бие дахин тойрон эргэнэ'
                : chaotic ? '⚠ Эмх замбараагүй эрин — гурван нар чөлөөтэй эргэлдэнэ' : '∞ Тогтвортой 8 дүрс — гурван нар нэг замаар эргэнэ';
            if (status.textContent !== text) status.textContent = text;
        }

        /* ---------- Earth lab: scientist, accelerator ring, collision and the X boson ---------- */
        const lab = root.querySelector('.sp-lab-canvas'), lx = lab.getContext('2d'), labStatus = root.querySelector('.sp-lab-status');
        let LW = 900, LH = 520, lk = 1, labBack, acc, chamber, desk, labVisible = false, mode = 'zero';
        const DETECTOR = Math.PI / 2;
        const collider = { phase: 'idle', t: 0, s: 0, omega: .6, idle: 7, press: 0 };
        let tracks = [], shocks = [], flash = 0, boson = null, items = [];
        const sci = { x: 0, y: 0, float: 0, lean: 0, lift: false };
        // Lab furniture (filled in by labLayout) and the running physics results.
        let win = null, screen = null, racks = null, tanks = null, beacon = null, assistant = null, collisions = 0, eventDisplay = [];
        function labLayout() {
            lk = clamp(Math.min(LW / 1000, LH / 520), .55, 1.1);
            // m = tall/narrow lab (the side column on desktops, or a phone): screen on top, ring in the
            // middle, console and people at the bottom.
            const m = LW < 700, floor = LH * (m ? .84 : .78);
            const scrH = m ? clamp(LH * .2, 90, 150) : 120 * lk, scrTop = m ? 100 : 62 * lk, scrBottom = scrTop + scrH;
            acc = m ? { x: LW * .5, y: scrBottom + (floor - scrBottom) * .4, rx: Math.min(LW * .42, 340), ry: LH * .085, floor }
                : { x: LW * .6, y: LH * .5, rx: Math.min(LW * .3, 340), ry: LH * .14, floor };
            chamber = { x: acc.x, y: acc.y - 6 * lk, w: 44 * lk, h: 70 * lk };
            desk = { x: LW * (m ? .03 : .05), w: LW * (m ? .34 : .22), y: floor - 52 * lk };
            sci.x = desk.x + desk.w + 26 * lk; sci.y = floor + 18 * lk;
            const c = mkCanvas(LW * ratio, LH * ratio), x = c.getContext('2d'); x.setTransform(ratio, 0, 0, ratio, 0, 0); labBack = c;
            const wall = x.createLinearGradient(0, 0, 0, floor); wall.addColorStop(0, '#16222d'); wall.addColorStop(1, '#22313d'); x.fillStyle = wall; x.fillRect(0, 0, LW, floor);
            x.strokeStyle = 'rgba(255,255,255,.04)'; x.lineWidth = 1;
            for (let px = 0; px < LW; px += 120 * lk) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, floor); x.stroke(); }
            for (let py = 60 * lk; py < floor; py += 90 * lk) { x.beginPath(); x.moveTo(0, py); x.lineTo(LW, py); x.stroke(); }
            const fl = x.createLinearGradient(0, floor, 0, LH); fl.addColorStop(0, '#2d3740'); fl.addColorStop(1, '#151b21'); x.fillStyle = fl; x.fillRect(0, floor, LW, LH - floor);
            x.strokeStyle = 'rgba(255,255,255,.05)';
            for (let i = -10; i <= 10; i++) { x.beginPath(); x.moveTo(LW / 2 + i * 40 * lk, floor); x.lineTo(LW / 2 + i * 120 * lk, LH); x.stroke(); }
            for (let i = 1; i < 5; i++) { const y = floor + (LH - floor) * (i / 5) ** 1.4; x.beginPath(); x.moveTo(0, y); x.lineTo(LW, y); x.stroke(); }
            x.fillStyle = '#d9b43a'; x.fillRect(0, floor - 3, LW, 3);
            for (let i = 0; i < 4; i++) {
                const cx = LW * (.15 + i * .24); x.fillStyle = '#c9d6e0'; x.fillRect(cx - 34 * lk, 8, 68 * lk, 6);
                const g = x.createLinearGradient(0, 14, 0, floor); g.addColorStop(0, 'rgba(220,240,255,.16)'); g.addColorStop(1, 'rgba(220,240,255,0)');
                x.fillStyle = g; x.beginPath(); x.moveTo(cx - 34 * lk, 14); x.lineTo(cx + 34 * lk, 14); x.lineTo(cx + 110 * lk, floor); x.lineTo(cx - 110 * lk, floor); x.closePath(); x.fill();
            }
            // Ceiling pipes and cable trays.
            for (const [y, col, w] of [[22, '#7d8a96', 6], [31, '#c8742c', 4], [38, '#3a73c9', 4]]) {
                x.fillStyle = col; x.fillRect(0, y * lk, LW, w * lk); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, y * lk, LW, 1);
            }
            x.fillStyle = '#5a6672'; for (let px = 30 * lk; px < LW; px += 140 * lk) x.fillRect(px, 16 * lk, 4 * lk, 28 * lk);
            // Observation window into the accelerator tunnel (perspective).
            win = m ? null : { x: LW * .03, y: 64 * lk, w: LW * .24, h: 118 * lk };
            if (win) {
                const { x: wx, y: wy, w: ww, h: wh } = win, vx = wx + ww * .55, vy = wy + wh * .52;
                x.fillStyle = '#0a1118'; x.fillRect(wx, wy, ww, wh);
                x.strokeStyle = 'rgba(120,150,180,.35)'; x.lineWidth = 1;
                for (const [cx, cy] of [[wx, wy], [wx + ww, wy], [wx, wy + wh], [wx + ww, wy + wh]]) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(vx, vy); x.stroke(); }
                for (let i = 1; i < 7; i++) { const f = 1 - (i / 7) ** .6; x.strokeRect(vx - (vx - wx) * f, vy - (vy - wy) * f, ww * f, wh * f); }
                x.fillStyle = 'rgba(255,220,150,.5)'; for (let i = 1; i < 7; i++) { const f = 1 - (i / 7) ** .6; x.fillRect(vx - (vx - wx) * f + ww * f * .4, vy - (vy - wy) * f + 1, ww * f * .2, 2); }
                x.strokeStyle = '#4d5d6b'; x.lineWidth = 6 * lk; x.strokeRect(wx, wy, ww, wh); x.lineWidth = 2; x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
                x.fillStyle = '#9fb3c6'; x.font = `600 ${Math.round(8 * lk + 1)}px ui-monospace, Menlo, monospace`; x.textAlign = 'left'; x.fillText('ХОНГИЛ · 27 КМ', wx + 6, wy + wh + 14 * lk);
            }
            // Whiteboard with the physics of the run.
            if (!m) {
                const bx = LW * .3, by = 66 * lk, bw = LW * .2, bh = 96 * lk;
                x.fillStyle = '#e9edf0'; x.fillRect(bx, by, bw, bh); x.strokeStyle = '#8d99a5'; x.lineWidth = 3; x.strokeRect(bx, by, bw, bh);
                x.fillStyle = '#1d4ea8'; x.font = `600 ${Math.round(12 * lk + 1)}px Georgia, serif`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
                x.fillText('E = mc²', bx + 10 * lk, by + 22 * lk); x.fillStyle = '#b8322e'; x.fillText('p + p → X + …', bx + 10 * lk, by + 44 * lk);
                x.fillStyle = '#2d6a3a'; x.font = `600 ${Math.round(10 * lk + 1)}px Georgia, serif`; x.fillText('√s = 13.6 TeV', bx + 10 * lk, by + 64 * lk); x.fillText('g → 0 ?', bx + 10 * lk, by + 84 * lk);
                // A little Feynman diagram.
                const fx = bx + bw * .72, fy = by + bh * .5; x.strokeStyle = '#333'; x.lineWidth = 1.4;
                x.beginPath(); x.moveTo(fx - 26 * lk, fy - 22 * lk); x.lineTo(fx - 8 * lk, fy); x.lineTo(fx - 26 * lk, fy + 22 * lk); x.moveTo(fx + 26 * lk, fy - 22 * lk); x.lineTo(fx + 8 * lk, fy); x.lineTo(fx + 26 * lk, fy + 22 * lk); x.stroke();
                x.strokeStyle = '#8a2be2'; x.beginPath(); for (let i = 0; i <= 16; i++) x.lineTo(fx - 8 * lk + i, fy + Math.sin(i * 1.4) * 3); x.stroke();
            }
            // Big wall screen frame (contents are live), server racks and liquid-helium tanks.
            screen = m ? { x: LW * .05, y: scrTop, w: LW * .9, h: scrH } : { x: LW * .74, y: 62 * lk, w: LW * .24, h: scrH };
            x.fillStyle = '#0c1218'; x.fillRect(screen.x - 6, screen.y - 6, screen.w + 12, screen.h + 12); x.strokeStyle = '#4a5866'; x.strokeRect(screen.x - 6, screen.y - 6, screen.w + 12, screen.h + 12);
            racks = m ? { x: LW * .92, y: floor - LH * .2, w: LW * .065, h: LH * .2 } : { x: LW * .945, y: floor - 190 * lk, w: LW * .048, h: 190 * lk };
            if (racks) { x.fillStyle = '#1a2128'; x.fillRect(racks.x, racks.y, racks.w, racks.h); x.strokeStyle = '#3e4a56'; for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(racks.x, racks.y + racks.h * i / 8); x.lineTo(racks.x + racks.w, racks.y + racks.h * i / 8); x.stroke(); } x.strokeRect(racks.x, racks.y, racks.w, racks.h); }
            tanks = (m ? [LW * .81, LW * .87] : [LW * .898, LW * .924]).map((tx, i) => { const h = m ? LH * (.17 - i * .04) : (150 - i * 30) * lk; return { x: tx, y: floor - h, r: m ? Math.max(8, LW * .022) : 13 * lk, h }; });
            if (tanks) for (const t of tanks) {
                const g = x.createLinearGradient(t.x - t.r, 0, t.x + t.r, 0); g.addColorStop(0, '#7a8894'); g.addColorStop(.4, '#e6edf2'); g.addColorStop(1, '#55626d');
                x.fillStyle = g; x.fillRect(t.x - t.r, t.y, t.r * 2, t.h); x.beginPath(); x.ellipse(t.x, t.y, t.r, t.r * .35, 0, 0, TAU); x.fill();
                x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 6; i++) x.fillRect(t.x - t.r + 2, t.y + t.h * (.2 + i * .12), t.r * 2 - 4, 1.5);
                x.fillStyle = '#2f6fd6'; x.fillRect(t.x - t.r, t.y + t.h * .45, t.r * 2, 14 * lk); x.fillStyle = '#fff'; x.font = `700 ${Math.round(6 * lk + 1)}px ui-monospace, Menlo, monospace`; x.textAlign = 'center'; x.fillText('He', t.x, t.y + t.h * .45 + 10 * lk);
            }
            // Hazard stripes on the floor around the detector.
            const dpt = { x: acc.x, y: acc.y + acc.ry };
            x.save(); x.beginPath(); x.rect(dpt.x - 80 * lk, floor + 4, 160 * lk, 16 * lk); x.clip();
            for (let i = -12; i < 20; i++) { x.fillStyle = i % 2 ? '#1a1a1a' : '#d9b43a'; x.beginPath(); x.moveTo(dpt.x - 80 * lk + i * 12 * lk, floor + 4); x.lineTo(dpt.x - 80 * lk + i * 12 * lk + 12 * lk, floor + 4); x.lineTo(dpt.x - 80 * lk + i * 12 * lk, floor + 20 * lk); x.lineTo(dpt.x - 80 * lk + i * 12 * lk - 12 * lk, floor + 20 * lk); x.closePath(); x.fill(); }
            x.restore();
            beacon = { x: LW * .5 + (m ? 95 * lk + 14 : 160 * lk), y: m ? 78 : 40 * lk };
            assistant = { x: LW * (m ? .68 : .855), y: floor + 18 * lk };
            // Wall sign with a radiation trefoil.
            const sx = LW * .5, sy = m ? 78 : 40 * lk;
            {
                x.fillStyle = '#0f171e'; x.fillRect(sx - 150 * lk, sy - 16 * lk, 300 * lk, 30 * lk); x.strokeStyle = '#d9b43a'; x.strokeRect(sx - 150 * lk, sy - 16 * lk, 300 * lk, 30 * lk);
                x.fillStyle = '#e8d7a0'; x.font = `700 ${Math.round(11 * lk + 1)}px ui-monospace, Menlo, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
                x.fillText('ӨНДӨР ЭНЕРГИЙН ЛАБОРАТОРИ', sx + 14 * lk, sy);
                x.fillStyle = '#d9b43a'; x.beginPath(); x.arc(sx - 128 * lk, sy, 10 * lk, 0, TAU); x.fill(); x.fillStyle = '#0f171e';
                for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(sx - 128 * lk, sy); x.arc(sx - 128 * lk, sy, 9 * lk, i * TAU / 3 - .5, i * TAU / 3 + .5); x.closePath(); x.fill(); }
                x.beginPath(); x.arc(sx - 128 * lk, sy, 2.4 * lk, 0, TAU); x.fill();
            }
            // Ring supports.
            x.fillStyle = '#3a4652';
            for (let n = 0; n < 10; n++) { const a = n / 10 * TAU, px = acc.x + Math.cos(a) * acc.rx, py = acc.y + Math.sin(a) * acc.ry; if (Math.sin(a) < -.2) continue; x.fillRect(px - 3 * lk, py, 6 * lk, floor - py); }
            // Control desk with monitors.
            x.fillStyle = '#3b4652'; x.fillRect(desk.x, desk.y, desk.w, 14 * lk); x.fillStyle = '#28313a'; x.fillRect(desk.x + 6 * lk, desk.y + 14 * lk, desk.w - 12 * lk, floor - desk.y - 14 * lk);
            items = [
                { kind: 'sphere', hx: chamber.x, hy: chamber.y + chamber.h * .32, r: 9 * lk },
                { kind: 'apple', hx: acc.x - acc.rx * .55, hy: floor - 6 * lk, r: 7 * lk },
                { kind: 'wrench', hx: acc.x + acc.rx * .5, hy: floor - 3 * lk, r: 12 * lk },
                { kind: 'mug', hx: desk.x + desk.w * .82, hy: desk.y - 6 * lk, r: 6 * lk },
                { kind: 'paper', hx: desk.x + desk.w * .55, hy: desk.y - 1, r: 9 * lk },
                { kind: 'paper', hx: desk.x + desk.w * .62, hy: desk.y - 2, r: 9 * lk },
                { kind: 'bolt', hx: acc.x + acc.rx * .2, hy: floor - 2 * lk, r: 4 * lk },
                { kind: 'bolt', hx: acc.x - acc.rx * .2, hy: floor - 2 * lk, r: 4 * lk }
            ].map(o => ({ ...o, x: o.hx, y: o.hy, vx: 0, vy: 0, rot: 0, vr: 0 }));
        }
        const ringPoint = a => ({ x: acc.x + Math.cos(a) * acc.rx, y: acc.y + Math.sin(a) * acc.ry });
        function fire() { if (collider.phase !== 'idle') return; Object.assign(collider, { phase: 'accel', t: 0, s: 0, omega: .6, press: 1 }); }
        function explode() {
            const d = ringPoint(DETECTOR); flash = 1; shocks.push({ t: 0 }, { t: -.18 });
            const r = rng(Math.floor(time * 1000) + 3);
            tracks = Array.from({ length: 70 }, (_, i) => { const a = r() * TAU, v = (80 + r() * 240) * lk; return { x: d.x, y: d.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7, curl: (r() - .5) * 9, life: 0, max: 1.3 + r() * 1.3, path: [], c: ['#7ff3ff', '#ffd36b', '#ff6fa8', '#b38bff', '#8bff9e'][i % 5] }; });
            boson = { t: 0, from: d, x: d.x, y: d.y, mode, strength: 0 };
            collisions++;
            eventDisplay = Array.from({ length: 22 }, (_, i) => ({ a: r() * TAU, curl: (r() - .5) * 2.2, len: .45 + r() * .55, c: ['#7ff3ff', '#ffd36b', '#ff6fa8', '#b38bff', '#8bff9e'][i % 5] }));
            collider.phase = 'boom'; collider.t = 0;
        }
        function updateLab(dt) {
            const c = collider; c.t += dt; c.press = Math.max(0, c.press - dt * 1.5);
            if (c.phase === 'idle') { c.omega = .6; c.s += c.omega * dt; c.idle -= dt; if (c.idle <= 0 && !boson) fire(); }
            else if (c.phase === 'accel') { c.omega = Math.min(16, c.omega + dt * (2 + c.omega * .9)); const prev = c.s; c.s += c.omega * dt; if (c.t > 3.6 && meetsAtDetector(prev, c.s)) explode(); }
            else if (c.phase === 'boom') { c.omega = Math.max(.6, c.omega * Math.exp(-dt * 3)); c.s += c.omega * dt; if (c.t > 2) { c.phase = 'idle'; c.idle = 16; } }
            flash = Math.max(0, flash - dt * 1.6);
            for (const s of shocks) s.t += dt; shocks = shocks.filter(s => s.t < 1.6);
            for (const p of tracks) { p.life += dt; const ca = Math.cos(p.curl * dt), sa = Math.sin(p.curl * dt); [p.vx, p.vy] = [(p.vx * ca - p.vy * sa) * Math.exp(-dt * 1.1), (p.vx * sa + p.vy * ca) * Math.exp(-dt * 1.1)]; p.x += p.vx * dt; p.y += p.vy * dt; p.path.push([p.x, p.y]); if (p.path.length > 40) p.path.shift(); }
            tracks = tracks.filter(p => p.life < p.max);
            let s = 0, zero = false;
            if (boson) {
                const b = boson; b.t += dt;
                const tr = smooth(b.t / 1.8), mx = (b.from.x + chamber.x) / 2, my = chamber.y - 60 * lk;
                b.x = (1 - tr) ** 2 * b.from.x + 2 * (1 - tr) * tr * mx + tr * tr * chamber.x; b.y = (1 - tr) ** 2 * b.from.y + 2 * (1 - tr) * tr * my + tr * tr * chamber.y;
                b.strength = s = b.t < 1.8 ? 0 : b.t < 2.8 ? smooth(b.t - 1.8) : b.t < 10.5 ? 1 : 1 - smooth((b.t - 10.5) / 1.5);
                zero = b.mode === 'zero';
                if (b.t > 12) boson = null;
            }
            // Loose objects: normal gravity, weightless drift, or pulled into orbit round the boson.
            const g = 600 * lk;
            for (const o of items) {
                if (s > 0 && zero) { o.vy += (-18 * lk - o.vy * .4) * dt * s; o.vx += Math.sin(time * 1.3 + o.hx) * 6 * lk * dt; o.vr += (Math.sin(time + o.hy) * .6 - o.vr) * dt; }
                else if (s > 0) { const dx = boson.x - o.x, dy = boson.y - o.y, d = Math.hypot(dx, dy) + 14 * lk, a = 9e5 * lk * lk * s / (d * d); o.vx += (dx / d * a - dy / d * a * .55) * dt; o.vy += (dy / d * a + dx / d * a * .55) * dt; o.vx *= Math.exp(-dt * .8); o.vy *= Math.exp(-dt * .8); o.vr += dt * 4; }
                else if (boson || Math.abs(o.y - o.hy) > .5 || Math.abs(o.vy) > 1) { o.vy += g * dt; if (o.y >= o.hy && o.vy > 0) { o.y = o.hy; o.vy *= -.25; o.vx *= .6; o.vr *= .5; } }
                if (!boson && Math.abs(o.vy) < 4 && o.y >= o.hy - 1) { o.x += (o.hx - o.x) * Math.min(1, dt * 2); o.rot += (0 - o.rot) * Math.min(1, dt * 3); o.vx = 0; o.vr = 0; }
                o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
                if (o.y < 20 * lk) { o.y = 20 * lk; o.vy = Math.abs(o.vy) * .3; }
                o.x = clamp(o.x, 10, LW - 10);
            }
            sci.float += ((s > 0 && zero ? s * 34 * lk : 0) - sci.float) * Math.min(1, dt * 1.5);
            sci.lean += ((s > 0 && !zero ? s * .35 : 0) - sci.lean) * Math.min(1, dt * 2);
            sci.lift = s > .3;
        }
        function drawLabItem(o) {
            const c = lx; c.save(); c.translate(o.x, o.y); c.rotate(o.rot); c.strokeStyle = '#141a20'; c.lineWidth = 1;
            if (o.kind === 'sphere') { const g = c.createRadialGradient(-o.r * .3, -o.r * .3, 1, 0, 0, o.r); g.addColorStop(0, '#f2f6f9'); g.addColorStop(1, '#5c6b78'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, o.r, 0, TAU); c.fill(); }
            else if (o.kind === 'apple') { c.fillStyle = '#d33a3a'; c.beginPath(); c.arc(0, 0, o.r, 0, TAU); c.fill(); c.fillStyle = '#3d8a3a'; c.beginPath(); c.ellipse(3, -o.r - 1, 4, 2, -.5, 0, TAU); c.fill(); }
            else if (o.kind === 'wrench') { c.fillStyle = '#9aa6b0'; c.fillRect(-o.r, -2, o.r * 2, 4); c.beginPath(); c.arc(o.r, 0, 5, 0, TAU); c.fill(); c.fillStyle = '#28313a'; c.fillRect(o.r, -2, 6, 4); }
            else if (o.kind === 'mug') { c.fillStyle = '#e8eef2'; c.fillRect(-o.r, -o.r * 1.2, o.r * 2, o.r * 2.2); c.strokeRect(-o.r, -o.r * 1.2, o.r * 2, o.r * 2.2); c.beginPath(); c.arc(o.r + 2, 0, 3, -1.4, 1.4); c.stroke(); }
            else if (o.kind === 'paper') { c.fillStyle = '#f6f3ea'; c.fillRect(-o.r, -o.r * .7, o.r * 2, o.r * 1.4); c.fillStyle = '#9aa'; for (let i = 0; i < 3; i++) c.fillRect(-o.r * .7, -o.r * .4 + i * 4, o.r * 1.4, 1); }
            else { c.fillStyle = '#b8c0c6'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.lineTo(Math.cos(a) * o.r, Math.sin(a) * o.r); } c.closePath(); c.fill(); }
            c.restore();
        }
        // Body language: amazed when the boson appears, swimming in zero-g, bracing in the pull.
        function labPose() {
            if (boson && boson.t > .3) return boson.strength < .6 ? 'amazed' : boson.mode === 'zero' ? 'float' : 'brace';
            return collider.press > 0 ? 'press' : 'idle';
        }
        function labLabel(text, x, y, color, size) { label(lx, text, x, y, color, 'center', size); }
        function drawLabLive() {
            const c = lx, col = collider, running = col.phase !== 'idle' || !!boson;
            // Beam pulses racing down the tunnel seen through the window.
            if (win) {
                const { x: wx, y: wy, w: ww, h: wh } = win, vx = wx + ww * .55, vy = wy + wh * .52, by = wy + wh * .82;
                c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
                c.strokeStyle = '#6f8fb0'; c.lineWidth = 7 * lk; c.beginPath(); c.moveTo(wx - 10, by); c.lineTo(vx, vy + 4); c.stroke();
                c.globalCompositeOperation = 'lighter';
                for (let n = 0; n < 5; n++) {
                    const f = (time * (.15 + col.omega * .06) + n / 5) % 1, px = vx + (wx - 10 - vx) * (1 - f) ** 2, py = vy + 4 + (by - vy - 4) * (1 - f) ** 2, rr = (2 + 8 * (1 - f) ** 2) * lk;
                    const g = c.createRadialGradient(px, py, 0, px, py, rr * 3); g.addColorStop(0, `rgba(140,220,255,${running ? .9 : .35})`); g.addColorStop(1, 'rgba(140,220,255,0)'); c.fillStyle = g; c.fillRect(px - rr * 3, py - rr * 3, rr * 6, rr * 6);
                }
                c.restore();
            }
            // Rotating amber beacon and the BEAM ON lamp.
            if (beacon) {
                const { x, y } = beacon;
                c.fillStyle = '#2a2f35'; c.fillRect(x - 7 * lk, y + 4 * lk, 14 * lk, 5 * lk);
                c.fillStyle = running ? '#ffb02e' : '#6b4a1a'; c.beginPath(); c.arc(x, y + 4 * lk, 7 * lk, Math.PI, TAU); c.fill();
                if (running) {
                    c.save(); c.globalCompositeOperation = 'lighter'; const a = time * 6;
                    for (const dir of [0, Math.PI]) { const g = c.createRadialGradient(x, y, 0, x, y, 160 * lk); g.addColorStop(0, 'rgba(255,170,60,.35)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 160 * lk, a + dir - .25, a + dir + .25); c.closePath(); c.fill(); }
                    c.restore();
                }
                c.fillStyle = running ? '#d9333f' : '#3a1d1f'; c.fillRect(x + 14 * lk, y - 6 * lk, 58 * lk, 18 * lk);
                c.fillStyle = running ? '#fff' : '#7a5a5c'; c.font = `700 ${Math.round(8 * lk + 1)}px ui-monospace, Menlo, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BEAM ON', x + 43 * lk, y + 3 * lk); c.textBaseline = 'alphabetic';
            }
            // Wall screen: event display of the last collision and the invariant-mass histogram.
            if (screen) {
                const { x, y, w, h } = screen, half = w * .45, ex = x + half / 2, ey = y + h / 2 + 4, er = Math.min(half, h) * .42;
                c.fillStyle = '#04080c'; c.fillRect(x, y, w, h);
                c.strokeStyle = 'rgba(120,170,220,.35)'; c.lineWidth = 1;
                for (const [rr, cl] of [[er, '#3a73c9'], [er * .72, '#c77a2c'], [er * .42, '#2e6b3c']]) { c.strokeStyle = cl; c.beginPath(); c.arc(ex, ey, rr, 0, TAU); c.stroke(); }
                for (let n = 0; n < 8; n++) { const a = n / 8 * TAU; c.strokeStyle = 'rgba(120,170,220,.2)'; c.beginPath(); c.moveTo(ex + Math.cos(a) * er * .42, ey + Math.sin(a) * er * .42); c.lineTo(ex + Math.cos(a) * er, ey + Math.sin(a) * er); c.stroke(); }
                const fresh = col.phase === 'boom' ? Math.min(1, col.t * 2) : 1;
                c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 1.2;
                for (const tr of eventDisplay) {
                    c.strokeStyle = tr.c; c.beginPath(); c.moveTo(ex, ey);
                    for (let i = 1; i <= 12; i++) { const f = i / 12 * tr.len * fresh, a = tr.a + tr.curl * f; c.lineTo(ex + Math.cos(a) * er * f, ey + Math.sin(a) * er * f); }
                    c.stroke();
                }
                c.restore();
                const hx = x + half + 10, hw = w - half - 18, hy = y + 14, hh = h - 30, bins = 24;
                c.strokeStyle = '#5f7486'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx, hy + hh); c.lineTo(hx + hw, hy + hh); c.stroke();
                const peak = Math.min(1, collisions / 4);
                for (let b = 0; b < bins; b++) {
                    const f = b / bins, bg = .75 * Math.exp(-f * 2.6), sig = peak * .8 * Math.exp(-(((f - .62) / .05) ** 2)), v = Math.min(1, bg + sig + .03 * Math.sin(b * 7.1));
                    c.fillStyle = sig > .05 ? '#c79bff' : '#4f8fc8'; c.fillRect(hx + 2 + f * (hw - 4), hy + hh - v * hh, (hw - 4) / bins - 1, v * hh);
                }
                c.fillStyle = '#9fb3c6'; c.font = `600 ${Math.round(7 * lk + 2)}px ui-monospace, Menlo, monospace`; c.textAlign = 'left';
                c.fillText(`EVENT #${String(collisions).padStart(4, '0')}`, x + 4, y + 10);
                c.fillText('m [GeV]', hx + hw - 40, y + h - 4);
                if (collisions >= 3) { c.fillStyle = '#e3d0ff'; c.textAlign = 'center'; c.fillText(collisions >= 4 ? 'X · 5σ НЭЭЛТ!' : 'X · 3σ', hx + hw * .62, hy + 8); }
            }
            // Server LEDs and liquid-helium vapour.
            if (racks) for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { const on = Math.sin(time * (3 + i) + j * 2.3 + i) > .2; c.fillStyle = on ? (j % 3 ? '#4dff9e' : '#ffcf4d') : '#173022'; c.fillRect(racks.x + 5 + j * (racks.w - 10) / 5, racks.y + racks.h * (i + .5) / 8 - 1, 3, 2); }
            if (tanks) for (const t of tanks) for (let n = 0; n < 5; n++) { const f = (time * .35 + n / 5 + t.x * .01) % 1; c.fillStyle = `rgba(220,240,255,${(.28 * (1 - f)).toFixed(3)})`; c.beginPath(); c.arc(t.x + Math.sin(f * 6 + n) * 5 * lk, t.y - f * 46 * lk, (4 + f * 10) * lk, 0, TAU); c.fill(); }
        }
        function labScene() {
            const c = lx, col = collider; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
            c.drawImage(labBack, 0, 0, LW, LH);
            drawLabLive();
            // Monitors on the desk: beam energy and a live trace.
            for (let i = 0; i < 3; i++) {
                const mx = desk.x + 8 * lk + i * (desk.w - 16 * lk) / 3, mw = (desk.w - 28 * lk) / 3, my = desk.y - 44 * lk;
                c.fillStyle = '#0b1218'; c.fillRect(mx, my, mw, 34 * lk); c.strokeStyle = '#4a5866'; c.strokeRect(mx, my, mw, 34 * lk);
                c.strokeStyle = ['#7dffb0', '#7fd0ff', '#ffcf6a'][i]; c.beginPath();
                for (let n = 0; n <= 20; n++) { const f = n / 20, v = i === 0 ? Math.sin(f * 12 + time * 6) * (.2 + col.omega / 20) : i === 1 ? (f < beamSpeed(col.omega) ? .4 : -.3) : Math.sin(f * 30 + time * 10) * Math.min(.45, flash + .08); c.lineTo(mx + 3 + f * (mw - 6), my + 17 * lk - v * 30 * lk); }
                c.stroke();
            }
            c.fillStyle = col.press > 0 ? '#ff7a6a' : '#d9333f'; c.beginPath(); c.arc(desk.x + desk.w * .28, desk.y + 2, 6 * lk, Math.PI, TAU); c.fill();
            // Accelerator ring: tunnel, magnets and the detector at the front.
            c.save();
            c.strokeStyle = '#0d1a2a'; c.lineWidth = 16 * lk; c.beginPath(); c.ellipse(acc.x, acc.y, acc.rx, acc.ry, 0, 0, TAU); c.stroke();
            const pipe = c.createLinearGradient(0, acc.y - acc.ry, 0, acc.y + acc.ry); pipe.addColorStop(0, '#9fb2c6'); pipe.addColorStop(1, '#3e5266'); c.strokeStyle = pipe; c.lineWidth = 6 * lk; c.stroke();
            const charge = col.phase === 'accel' ? .4 + .6 * Math.sin(time * 18) ** 2 : .25;
            for (let n = 0; n < 28; n++) {
                const a = n / 28 * TAU, p = ringPoint(a), t = Math.atan2(acc.ry * Math.cos(a), -acc.rx * Math.sin(a));
                c.save(); c.translate(p.x, p.y); c.rotate(t); c.fillStyle = n % 2 ? '#2f6fd6' : '#d9434f'; c.fillRect(-6 * lk, -5 * lk, 12 * lk, 10 * lk);
                c.globalCompositeOperation = 'lighter'; c.fillStyle = n % 2 ? `rgba(120,190,255,${charge})` : `rgba(255,120,140,${charge})`; c.fillRect(-5 * lk, -2 * lk, 10 * lk, 4 * lk); c.restore();
            }
            c.restore();
            // Test chamber in the middle of the ring.
            c.fillStyle = '#3a4652'; c.fillRect(chamber.x - chamber.w * .7, chamber.y + chamber.h * .5, chamber.w * 1.4, 10 * lk);
            c.fillStyle = 'rgba(160,210,255,.08)'; c.strokeStyle = 'rgba(180,220,255,.5)'; c.lineWidth = 1.5;
            c.beginPath(); c.roundRect ? c.roundRect(chamber.x - chamber.w / 2, chamber.y - chamber.h / 2, chamber.w, chamber.h, 10 * lk) : c.rect(chamber.x - chamber.w / 2, chamber.y - chamber.h / 2, chamber.w, chamber.h); c.fill(); c.stroke();
            if (!boson) labLabel('ТУРШИЛТЫН КАМЕР', chamber.x, chamber.y - chamber.h / 2 - 8 * lk, '#9fc6ff', 9);
            const [a1, a2] = beamAngles(col.s, DETECTOR), fast = smooth((col.omega - 1) / 8);
            [[a1, 1, '111,211,255'], [a2, -1, '255,122,138']].forEach(([a, dir, cl]) => {
                c.save(); c.globalCompositeOperation = 'lighter';
                const len = Math.min(2.6, .15 + col.omega * .18);
                for (let n = 0; n < 24; n++) { const q = ringPoint(a - dir * len * n / 24); c.fillStyle = `rgba(${cl},${((1 - n / 24) * (.25 + .6 * fast)).toFixed(3)})`; c.beginPath(); c.arc(q.x, q.y, (3 - n / 12) * lk, 0, TAU); c.fill(); }
                for (let n = 0; n < 4; n++) {
                    const q = ringPoint(a - dir * n * .09); c.fillStyle = '#ff6a5a'; c.beginPath(); c.arc(q.x, q.y, 2.2 * lk, 0, TAU); c.fill();
                    if (fast < .5) { c.strokeStyle = `rgba(${cl},${(.6 * (1 - fast * 2)).toFixed(3)})`; c.lineWidth = .8; c.beginPath(); c.ellipse(q.x, q.y, 6 * lk, 3 * lk, time * 4 + n, 0, TAU); c.stroke(); }
                }
                c.restore();
            });
            const d = ringPoint(DETECTOR);
            for (const [r, cl] of [[30, '#26384d'], [23, '#c77a2c'], [15, '#3a73c9'], [7, '#0b1422']]) { c.fillStyle = cl; c.beginPath(); for (let n = 0; n < 8; n++) { const a = n / 8 * TAU + Math.PI / 8; c.lineTo(d.x + Math.cos(a) * r * lk, d.y + Math.sin(a) * r * lk * .8); } c.closePath(); c.fill(); }
            labLabel('ДЕТЕКТОР', d.x, d.y + 40 * lk, '#ffcf8a', 9);
            const v = beamSpeed(col.omega);
            labLabel(`H⁺ → ← H⁺   v = ${v > .9999 ? v.toFixed(6) : v.toFixed(3)}c`, acc.x, acc.y - acc.ry - 18 * lk, col.phase === 'accel' ? '#ffd36b' : '#7f9dc2', 10);
            // Collision: flash, shock rings and curling particle tracks.
            if (flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, 260 * lk * (1.4 - flash)); g.addColorStop(0, `rgba(255,255,255,${flash})`); g.addColorStop(.25, `rgba(190,150,255,${flash * .6})`); g.addColorStop(1, 'rgba(120,80,255,0)'); c.fillStyle = g; c.fillRect(0, 0, LW, LH); c.restore(); }
            for (const s of shocks) { if (s.t < 0) continue; c.strokeStyle = `rgba(200,180,255,${(1 - s.t / 1.6) * .7})`; c.lineWidth = 2; c.beginPath(); c.ellipse(d.x, d.y, s.t * 240 * lk, s.t * 90 * lk, 0, 0, TAU); c.stroke(); }
            c.save(); c.globalCompositeOperation = 'lighter';
            for (const p of tracks) { if (p.path.length < 2) continue; c.globalAlpha = 1 - p.life / p.max; c.strokeStyle = p.c; c.lineWidth = 1.3; c.beginPath(); p.path.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
            c.restore();
            if (shocks.length) labLabel('ТЭСРЭЛТ', d.x, d.y - 46 * lk, `rgba(255,220,255,${Math.max(0, 1 - shocks[0].t)})`, 12);
            // X boson and its field.
            if (boson) {
                const b = boson, s = b.strength;
                c.save(); c.globalCompositeOperation = 'lighter';
                if (s > 0 && b.mode === 'zero') { for (let n = 0; n < 3; n++) { const f = (time * .5 + n / 3) % 1; c.strokeStyle = `rgba(150,230,255,${(.5 * (1 - f) * s).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, LW * .45 * f, 0, TAU); c.stroke(); } }
                if (s > 0 && b.mode === 'well') { for (let n = 0; n < 50; n++) { const f = (time * .35 + n / 50) % 1, a = n * 2.4 + f * 5, r = (1 - f) * 160 * lk; c.fillStyle = `rgba(200,150,255,${(f * .8 * s).toFixed(3)})`; c.beginPath(); c.arc(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r * .7, 1.6 * lk, 0, TAU); c.fill(); } }
                const pulse = 1 + .15 * Math.sin(time * 9), core = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, 26 * lk * pulse);
                core.addColorStop(0, 'rgba(255,255,255,.95)'); core.addColorStop(.3, 'rgba(190,140,255,.8)'); core.addColorStop(.7, 'rgba(120,255,200,.25)'); core.addColorStop(1, 'rgba(120,255,200,0)');
                c.fillStyle = core; c.beginPath(); c.arc(b.x, b.y, 26 * lk * pulse, 0, TAU); c.fill();
                c.strokeStyle = 'rgba(200,170,255,.7)'; c.lineWidth = 1; c.beginPath(); for (let n = 0; n <= 6; n++) { const a = n / 6 * TAU + time; c.lineTo(b.x + Math.cos(a) * 14 * lk, b.y + Math.sin(a) * 14 * lk); } c.stroke();
                c.restore();
                labLabel('X БОЗОН', b.x, b.y - 30 * lk, '#e3d0ff', 10);
                if (s > .2) labLabel(b.mode === 'zero' ? 'ЖИНГҮЙДЭЛ · 0 g' : 'ХЭТ ТАТАЛЦАЛ', b.x, b.y + chamber.h / 2 + 26 * lk, b.mode === 'zero' ? '#9fe7ff' : '#d6a6ff', 10);
            }
            for (const o of items) drawLabItem(o);
            if (assistant) {
                c.save(); c.translate(assistant.x, assistant.y - sci.float * .8 + (sci.float > 2 ? Math.sin(time * 1.3 + 1) * 4 : 0)); c.rotate(-sci.lean * .8 + (sci.float > 2 ? Math.sin(time * .8 + 2) * .2 : 0)); c.scale(lk * 1.15, lk * 1.15);
                drawScientist(c, { press: 0, pose: labPose(), lift: sci.lift, float: sci.float / (34 * lk) || 0, look: boson ? -1.4 : -.6, hair: '#9a5a2a', tablet: true, t: time + 1.3 });
                c.restore();
            }
            // The scientist: presses the button, floats when gravity vanishes, leans into the pull.
            c.save(); c.translate(sci.x, sci.y - sci.float + Math.sin(time * 1.6) * (sci.float > 2 ? 4 : .6)); c.rotate(sci.lean + (sci.float > 2 ? Math.sin(time * .9) * .15 : 0)); c.scale(-lk * 1.25, lk * 1.25);
            drawScientist(c, { press: collider.press, pose: labPose(), t: time, lift: sci.lift, float: sci.float / (34 * lk) || 0, look: boson ? -1.2 : collider.phase === 'accel' ? -.8 : .6 });
            c.restore();
            const text = boson && boson.strength > .2 ? (boson.mode === 'zero' ? '◯ X бозон: камерын голд таталцал алга болж, бүх юм хөвж байна' : '● X бозон: хэт таталцал бүх биетийг өөртөө татаж байна')
                : collider.phase === 'accel' ? '⚛ Эрдэмтэн устөрөгчийн атомуудыг хурдасгаж байна…' : collider.phase === 'boom' ? '✸ Мөргөлдөөн! Тэсрэлтээс X бозон гарлаа' : 'Эрдэмтэн туршилтаа бэлдэж байна · «Туршилт эхлүүлэх»';
            if (labStatus.textContent !== text) labStatus.textContent = text;
        }

        /* ---------- Profile background: starfield, ringed planet and a capital ship that jumps to lightspeed ---------- */
        const aboutEl = root.querySelector('.sp-about'), aboutCanvas = root.querySelector('.sp-about-bg'), ac = aboutCanvas.getContext('2d');
        let AW = 1, AH = 1, aboutBack, aboutStars = [], aboutVisible = false;
        const ship = { phase: 'cruise', t: 0, x: 0, y: 0, warp: 0, engine: .6 };
        function aboutLayout() {
            const r = aboutEl.getBoundingClientRect(); AW = Math.max(1, r.width); AH = Math.max(1, r.height);
            const ar = Math.min(devicePixelRatio || 1, 1.5); aboutCanvas.width = Math.round(AW * ar); aboutCanvas.height = Math.round(AH * ar); ac.setTransform(ar, 0, 0, ar, 0, 0);
            const c = mkCanvas(AW * ar, AH * ar), x = c.getContext('2d'), rr = rng(99); x.setTransform(ar, 0, 0, ar, 0, 0); aboutBack = c;
            const bg = x.createLinearGradient(0, 0, 0, AH); bg.addColorStop(0, '#070a1f'); bg.addColorStop(1, '#02030a'); x.fillStyle = bg; x.fillRect(0, 0, AW, AH);
            x.globalCompositeOperation = 'screen';
            for (const [px, py, rad, col] of [[.15, .1, .5, 'rgba(110,60,200,.32)'], [.85, .45, .5, 'rgba(30,110,170,.28)'], [.4, .85, .45, 'rgba(190,60,120,.2)'], [.7, .05, .3, 'rgba(255,140,80,.14)']]) {
                const g = x.createRadialGradient(AW * px, AH * py, 0, AW * px, AH * py, AW * rad); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, AW, AH);
            }
            // A distant spiral galaxy.
            x.save(); x.translate(AW * .12, Math.min(AH * .55, 520)); x.rotate(-.5); x.scale(1, .45);
            for (let i = 0; i < 700; i++) { const arm = i % 2, tt = rr() * 4, a = tt * 1.9 + arm * Math.PI, rad = tt * 26 + rr() * 8; x.fillStyle = `rgba(${200 + rr() * 55},${190 + rr() * 50},255,${(.6 - tt * .12).toFixed(3)})`; x.fillRect(Math.cos(a) * rad, Math.sin(a) * rad, 1.2, 1.2); }
            const core = x.createRadialGradient(0, 0, 0, 0, 0, 30); core.addColorStop(0, 'rgba(255,240,220,.8)'); core.addColorStop(1, 'rgba(255,240,220,0)'); x.fillStyle = core; x.beginPath(); x.arc(0, 0, 30, 0, TAU); x.fill(); x.restore();
            x.globalCompositeOperation = 'source-over';
            // A small grey moon in the background.
            if (AW >= 700) { const mg = x.createRadialGradient(AW * .78 - 10, AH * .62 - 10, 2, AW * .78, AH * .62, 22); mg.addColorStop(0, '#d9dce4'); mg.addColorStop(1, '#3a3f4c'); x.fillStyle = mg; x.beginPath(); x.arc(AW * .78, AH * .62, 22, 0, TAU); x.fill(); }
            aboutStars = Array.from({ length: Math.round(AW * AH / 2600) }, () => ({ x: rr() * AW, y: rr() * AH, s: rr() < .08 ? 1.6 : .5 + rr() * .8, p: rr() * TAU, d: .2 + rr() * .8 }));
            ship.y = Math.min(150, AH * .12); if (!ship.x) ship.x = AW * .7;
            systemLayout();
        }
        /* ---------- Profile as a planetary system: real-looking planets on slow, stable Keplerian orbits ---------- */
        // Each planet carries the items of its section as moons; selecting a planet zooms its moon system.
        const sysEl = aboutEl.querySelector('.sp-system'), sysCanvas = sysEl.querySelector('.sp-system-canvas'), sc2 = sysCanvas.getContext('2d');
        const planetEls = [...sysEl.querySelectorAll('.sp-planet')];
        const short = v => { const t = String(v == null ? '' : v).replace(/,\s*$/, '').trim(); return t.length > 22 ? t.slice(0, 21) + '…' : t; };
        const MOON_SETS = {
            exp: (data.experience || []).map(e => short(`${e.company} · ${e.role}`)),
            edu: (data.education || []).map(e => short(e.field)).concat((data.certifications || []).map(c => short(c.name))),
            skills: Object.entries(data.workSkills || {}).map(([k, v]) => short(`${k}: ${(v || []).slice(0, 2).join(', ')}`)),
            proj: (data.projects || []).map(p => short(p.name)),
            comm: Object.entries(data.spokenLanguages || {}).map(([k, v]) => short(`${k} · ${v}`)).concat((data.profileTraits || []).map(short))
        };
        const MOON_COLORS = { exp: ['#cfd2d8'], edu: ['#9a7a64', '#b08c74'], skills: ['#f2d34f', '#e8dcc8', '#a7a29a', '#6e6558', '#c7b49a', '#8c8f96'], proj: ['#e0a85a', '#d8d4cc', '#b9b4aa', '#9fb4c8', '#e6dccb', '#c9c2b4'], comm: ['#c9d6e8', '#9fb4d8', '#e0e6ef'] };
        const planetTex = {}, clouds = cloudTexture();
        for (const el of planetEls) planetTex[el.dataset.kind] = planetTexture(el.dataset.kind);
        // Planets without a section: Mercury and Venus inside Earth's orbit, Uranus between Saturn and Neptune.
        const DECOR = [{ kind: 'mercury', name: 'Буд', f: [.27, .15], a: 1 }, { kind: 'venus', name: 'Сугар ↺', f: [.38, .25], a: 4 }, { kind: 'uranus', name: 'Тэнгэрийн ван ↺', f: [.9, .875], a: 2.6 }];
        for (const d of DECOR) planetTex[d.kind] = planetTexture(d.kind);
        let SW = 1, SH = 1, ORBITS = [.32, .48, .64, .81, .97], TILT = .42, sysRatio = 1, lastSys = 0;
        const angles = planetEls.map((_, i) => i * TAU / planetEls.length + .4), zoom = planetEls.map((el, i) => i === 0 ? 1 : 0);
        const selectedIndex = () => Math.max(0, planetEls.findIndex(p => p.classList.contains('is-active')));
        const orbitRadius = i => Math.max(40, Math.min(SW / 2 - (SW < 520 ? 30 : 50), (SH / 2 - 50) / TILT)) * ORBITS[i];
        function systemLayout() {
            const r = sysEl.getBoundingClientRect(); SW = Math.max(1, r.width); SH = Math.max(1, r.height);
            const narrow = SW < 520; TILT = narrow ? .78 : .52; ORBITS = narrow ? [.49, .59, .69, .8, .99] : [.36, .48, .62, .76, .99];
            sysRatio = Math.min(devicePixelRatio || 1, 2); sysCanvas.width = Math.round(SW * sysRatio); sysCanvas.height = Math.round(SH * sysRatio);
            systemTick();
        }
        function systemTick() {
            const dt = clamp(time - lastSys, 0, .1); lastSys = time;
            const c = sc2, cx = SW / 2, cy = SH / 2, sel = selectedIndex(), base = clamp(SW / 54, 8, 16), sunR = clamp(Math.min(SW, SH) * .075, 24, 44), labels = [];
            c.setTransform(sysRatio, 0, 0, sysRatio, 0, 0); c.clearRect(0, 0, SW, SH);
            // Orbits (the selected one glows).
            planetEls.forEach((_, i) => { const R = orbitRadius(i); c.strokeStyle = i === sel ? 'rgba(199,155,255,.45)' : 'rgba(170,180,255,.16)'; c.lineWidth = i === sel ? 1.4 : 1; c.setLineDash([3, 5]); c.beginPath(); c.ellipse(cx, cy, R, R * TILT, 0, 0, TAU); c.stroke(); });
            c.setLineDash([]);
            const scaleR = Math.max(40, Math.min(SW / 2 - (SW < 520 ? 30 : 50), (SH / 2 - 50) / TILT));
            const extras = DECOR.map(d => {
                const f = d.f[SW < 520 ? 0 : 1], R = scaleR * f;
                d.a += dt * .16 * (ORBITS[0] / f) ** 1.5;
                c.strokeStyle = 'rgba(255,220,160,.12)'; c.setLineDash([2, 6]); c.beginPath(); c.ellipse(cx, cy, R, R * TILT, 0, 0, TAU); c.stroke(); c.setLineDash([]);
                const depth = Math.sin(d.a), b = { el: null, i: -1, name: d.name, x: cx + R * Math.cos(d.a), y: cy + R * depth * TILT, depth, kind: d.kind };
                b.pr = base * PLANET_LOOK[d.kind].size * (.82 + .3 * (depth + 1) / 2); b.light = Math.atan2(cy - b.y, cx - b.x);
                return b;
            });
            const bodiesList = planetEls.map((el, i) => {
                // Kepler: angular speed ∝ r^-1.5; the selected planet slows down so its moons are easy to read.
                zoom[i] += ((i === sel ? 1 : 0) - zoom[i]) * Math.min(1, dt * 3);
                // Every planet orbits the same way (clockwise on screen).
                angles[i] += dt * .16 * (ORBITS[0] / ORBITS[i]) ** 1.5 * (1 - .75 * zoom[i]);
                const R = orbitRadius(i), a = angles[i], depth = Math.sin(a), kind = el.dataset.kind;
                const x = cx + R * Math.cos(a), y = cy + R * depth * TILT, pr = base * PLANET_LOOK[kind].size * (.82 + .3 * (depth + 1) / 2) * (1 + .75 * zoom[i]);
                return { el, i, x, y, depth, pr, kind, light: Math.atan2(cy - y, cx - x) };
            });
            const drawOne = b => {
                if (!b.el) {
                    drawPlanet(c, b.x, b.y, b.pr, b.kind, planetTex[b.kind], time, b.light, null);
                    c.font = '600 8px ui-monospace, Menlo, monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,230,180,.8)'; c.fillText(b.name, b.x, b.y + b.pr + (b.kind === 'uranus' ? 16 : 11));
                    return;
                }
                const set = MOON_SETS[b.el.dataset.panel] || [], z = zoom[b.i], cols = MOON_COLORS[b.el.dataset.panel] || ['#cfd2d8'];
                const shown = z > .05 ? Math.min(set.length, 8) : b.kind === 'earth' ? 1 : b.kind === 'jupiter' ? 2 : b.kind === 'saturn' ? 1 : 0;
                const moons = [];
                for (let j = 0; j < shown; j++) {
                    const mr = b.pr * (1.7 + z * .5) + (b.kind === 'saturn' ? b.pr * 1.1 : 0) + j * (5 + z * 22), ma = time * (.45 / (1 + j * .3)) + j * 2.1 + b.i;
                    moons.push({ j, x: b.x + Math.cos(ma) * mr, y: b.y + Math.sin(ma) * mr * (.42 + z * .16), d: Math.sin(ma), size: 1.8 + z * 3.6 + (b.kind === 'earth' && j === 0 ? 1 : 0), mr });
                }
                // Expanded moon orbits for the selected planet.
                if (z > .05) for (const m of moons) { c.strokeStyle = `rgba(200,210,255,${(.18 * z).toFixed(3)})`; c.lineWidth = .8; c.beginPath(); c.ellipse(b.x, b.y, m.mr, m.mr * (.42 + z * .16), 0, 0, TAU); c.stroke(); }
                const drawMoon = m => {
                    if (b.kind === 'earth' && m.j > 0) drawArtificialSatellite(c, m.x, m.y, m.size * .9, time + m.j);
                    else { const g = c.createRadialGradient(m.x - m.size * .35, m.y - m.size * .35, 0, m.x, m.y, m.size); const col = b.kind === 'earth' ? '#cfd2d8' : cols[m.j % cols.length]; g.addColorStop(0, '#ffffff'); g.addColorStop(.35, col); g.addColorStop(1, '#1a1c22'); c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, m.size, 0, TAU); c.fill(); }
                    if (z > .5 && set[m.j]) labels.push(() => {
                        const text = (b.kind === 'earth' ? (m.j === 0 ? '☾ Сар · ' : '⛯ ') : '') + set[m.j];
                        c.font = `600 ${Math.round(9 + z)}px ui-monospace, Menlo, monospace`; const w = c.measureText(text).width + 12;
                        const lx = clamp(m.x + m.size + 4, 4, SW - w - 4), ly = m.y - 7;
                        c.globalAlpha = (z - .5) * 2 * (.65 + .35 * (m.d + 1) / 2); c.fillStyle = 'rgba(8,12,34,.82)'; c.beginPath(); c.roundRect ? c.roundRect(lx, ly, w, 15, 7) : c.rect(lx, ly, w, 15); c.fill();
                        c.fillStyle = '#e6e9ff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, lx + 6, ly + 7.5); c.globalAlpha = 1; c.textBaseline = 'alphabetic';
                    });
                };
                moons.filter(m => m.d < 0).forEach(drawMoon);
                if (z > .05) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(b.x, b.y, b.pr, b.x, b.y, b.pr * 2.4); g.addColorStop(0, `rgba(199,155,255,${(.25 * z).toFixed(3)})`); g.addColorStop(1, 'rgba(199,155,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.pr * 2.4, 0, TAU); c.fill(); c.restore(); }
                drawPlanet(c, b.x, b.y, b.pr, b.kind, planetTex[b.kind], time + b.i * 3, b.light, b.kind === 'earth' ? clouds : null);
                moons.filter(m => m.d >= 0).forEach(drawMoon);
            };
            const sorted = bodiesList.concat(extras).sort((p, q) => p.depth - q.depth);
            sorted.filter(b => b.depth < 0).forEach(drawOne);
            drawSun(c, cx, cy, sunR, SUN_PALS[0], textures[0], time, time * .03);
            sorted.filter(b => b.depth >= 0).forEach(drawOne);
            labels.forEach(f => f()); // moon names always sit on top
            // Keep the accessible buttons (hit areas + labels) on top of the drawn planets.
            for (const b of bodiesList) {
                b.el.style.setProperty('--sz', `${Math.round(b.pr * 2 + 6)}px`);
                b.el.style.transform = `translate(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px) translate(-50%,-${Math.round(b.pr + 3)}px)`;
                b.el.style.zIndex = b.depth > 0 ? 4 : 1; b.el.style.opacity = (.75 + .25 * (b.depth + 1) / 2).toFixed(3);
            }
            const star = sysEl.querySelector('.sp-star'); star.style.setProperty('--sun', `${Math.round(sunR * 2)}px`);
        }
        sysEl.addEventListener('click', e => {
            const btn = e.target.closest('.sp-planet'); if (!btn) return;
            planetEls.forEach(p => { const on = p === btn; p.classList.toggle('is-active', on); p.setAttribute('aria-selected', String(on)); });
            aboutEl.querySelectorAll('.sp-panel').forEach(p => { const on = p.dataset.panel === btn.dataset.panel; p.classList.toggle('is-active', on); p.classList.toggle('sp-anim', on); });
            if (paused) { zoom.fill(0); zoom[planetEls.indexOf(btn)] = 1; systemTick(); }
        });
        function shipScale() { return clamp(AW / 1500, .38, .85); }
        function updateShip(dt) {
            const sh = ship, sc = shipScale(); sh.t += dt;
            if (sh.phase === 'cruise') { sh.x -= 14 * sc * dt; sh.engine = .6 + .1 * Math.sin(sh.t * 2); sh.warp = 0; if (sh.t > 20 || sh.x < AW * .2) { sh.phase = 'charge'; sh.t = 0; } }
            else if (sh.phase === 'charge') { sh.engine = Math.min(1.4, .6 + sh.t * .6); if (sh.t > 1.4) { sh.phase = 'jump'; sh.t = 0; } }
            else if (sh.phase === 'jump') { sh.warp = smooth(sh.t / .5); sh.x -= (200 + sh.t * 6000) * dt * sc; if (sh.t > .8) { sh.phase = 'gone'; sh.t = 0; } }
            else if (sh.phase === 'gone') { sh.warp = 0; if (sh.t > 5) { sh.phase = 'arrive'; sh.t = 0; sh.x = AW * .82 + 600 * sc; } }
            else if (sh.phase === 'arrive') { const f = smooth(sh.t / 1.1); sh.warp = 1 - f; sh.x = AW * .82 + 600 * sc * (1 - f); sh.engine = .6; if (sh.t > 1.1) { sh.phase = 'cruise'; sh.t = 0; sh.x = AW * .82; } }
        }
        function aboutScene() {
            const c = ac; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage(aboutBack, 0, 0, AW, AH);
            const streak = ship.phase === 'jump' ? ship.warp : ship.phase === 'arrive' ? ship.warp : ship.phase === 'charge' ? ship.t / 1.4 * .15 : 0;
            for (const st of aboutStars) {
                c.globalAlpha = .4 + .6 * Math.sin(time * 1.2 + st.p) ** 2; c.fillStyle = '#fff';
                if (streak > .05) { c.fillRect(st.x, st.y, st.s + streak * 160 * st.d, st.s * .8); } else c.fillRect(st.x, st.y, st.s, st.s);
            }
            c.globalAlpha = 1;
            if (ship.phase !== 'gone') {
                const sc = shipScale();
                c.save(); c.translate(ship.x, ship.y); c.scale(sc, sc); drawShip(c, time, ship.engine, ship.warp); c.restore();
                if (ship.phase === 'jump' && ship.t < .25 || ship.phase === 'arrive' && ship.t < .3) {
                    const f = ship.phase === 'jump' ? 1 - ship.t / .25 : 1 - ship.t / .3, g = c.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, 300 * sc);
                    g.addColorStop(0, `rgba(220,240,255,${f})`); g.addColorStop(1, 'rgba(120,180,255,0)'); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(ship.x - 300 * sc, ship.y - 300 * sc, 600 * sc, 600 * sc); c.restore();
                }
            }
        }

        /* --- Loop, controls, cleanup --- */
        function resize() {
            const r = canvas.getBoundingClientRect(); width = Math.max(1, r.width); height = Math.max(1, r.height);
            ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0); layout(); spaceScene();
        }
        function resizeLab() {
            const r = lab.getBoundingClientRect(); LW = Math.max(1, r.width); LH = Math.max(1, r.height);
            lab.width = Math.round(LW * ratio); lab.height = Math.round(LH * ratio); lx.setTransform(ratio, 0, 0, ratio, 0, 0); labLayout(); labScene();
        }
        const observer = new ResizeObserver(() => { resize(); resizeLab(); aboutLayout(); aboutScene(); }); observer.observe(canvas); observer.observe(lab); observer.observe(aboutEl);
        let spaceVisible = true;
        const seen = new IntersectionObserver(entries => entries.forEach(e => { if (e.target === lab) labVisible = e.isIntersecting; else if (e.target === aboutEl) aboutVisible = e.isIntersecting; else spaceVisible = e.isIntersecting; }));
        seen.observe(canvas); seen.observe(lab); seen.observe(aboutEl);
        resize(); resizeLab(); aboutLayout();
        function advance(dt) { time += dt; view.az += dt * .07; updateProbes(dt); physics(dt); updateEvent(dt); updateRobot(dt); updateLab(dt); updateShip(dt); }
        function tick(now) {
            if (disposed) return;
            const dt = Math.min((now - last) / 1000 || 0, .05); last = now;
            if (!paused && !document.hidden) { advance(dt); if (spaceVisible) spaceScene(); if (labVisible) labScene(); if (aboutVisible) { aboutScene(); systemTick(); } }
            frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        const pauseBtn = root.querySelector('[data-act="pause"]');
        const syncPause = () => { pauseBtn.textContent = paused ? '▶' : 'Ⅱ'; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.setAttribute('aria-label', paused ? 'Үргэлжлүүлэх' : 'Түр зогсоох'); };
        syncPause();
        root.addEventListener('click', e => {
            const btn = e.target.closest('.sp-hud button');
            if (btn) {
                if (btn.dataset.act === 'fire') fire();
                if (btn.dataset.act === 'reset') { resetBodies(); nebula = []; shock = null; }
                if (btn.dataset.act === 'tight') tightBinary();
                if (btn.dataset.act === 'pause') { paused = !paused; syncPause(); }
                if (btn.dataset.mode) { mode = btn.dataset.mode; root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === btn))); if (boson) boson.mode = mode; }
                return;
            }
            const s = e.target.closest('.sp-secret');
            if (s && matchMedia('(hover: none)').matches && !s.classList.contains('revealed')) { e.preventDefault(); s.classList.add('revealed'); }
        });
        lab.addEventListener('click', e => { const r = lab.getBoundingClientRect(), x = (e.clientX - r.left) * LW / r.width, y = (e.clientY - r.top) * LH / r.height; if (Math.hypot((x - acc.x) / acc.rx, (y - acc.y) / acc.ry) > .7 || Math.hypot(x - desk.x - desk.w * .28, y - desk.y) < 20) fire(); });
        root._spaceCleanup = () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); seen.disconnect(); };
        // Test hooks: advance deterministically, fling a sun, push one into the black hole, fire the lab.
        root._spaceAdvance = (seconds, fireNow) => { if (fireNow) fire(); for (let n = 0; n < seconds * 30; n++) { advance(1 / 30); systemTick(); } spaceScene(); labScene(); aboutScene(); };
        root._spaceTight = () => tightBinary();
        root._spaceWebb = (yaw, pitch) => { webb.yaw = yaw; webb.pitch = pitch; webb.vyaw = 0; };
        root._spaceFling = (i, vx, vy) => { bodies[i].vx = vx; bodies[i].vy = vy; chaotic = true; };
        root._spaceFeed = i => { const q = bodyPx(bodies[i]); capture(i, { x: bh.x + (q.x - bh.x) * .5, y: bh.y + (q.y - bh.y) * .5 }); };
    }

    window.ProfileTemplates = window.ProfileTemplates || {};
    window.ProfileTemplates.space = { render, figureEight, accelerations, step, energy, viewProject, lensImage, beamAngles, meetsAtDetector, beamSpeed, profileHtml };
}());
