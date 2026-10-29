/* Chess Halloween template — renders profile-data.json around a living chess board where an
   armoured legion of light (angels & gods on pegasi) fights a legion of night (Dracula, demons
   and witches on brooms). The two sides take turns making real chess-shaped moves and attacks. */
(function () {
    'use strict';

    var MOVE_MS = 1700;
    var SLIDE_MS = 700;
    var RIDE_EVERY_MS = 2300;
    var MAX_PLIES = 120;
    var VERDICT_MS = 3200;
    var FILES = 'abcdefgh';
    var START = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'];
    var VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
    // Taps on the board beat a war drum; DANCE_TAPS taps within DANCE_WINDOW_MS make every piece dance
    var DANCES = ['chDanceHop', 'chDanceSway', 'chDanceSpin', 'chDanceShake'];
    var DANCE_TAPS = 4;
    var DANCE_WINDOW_MS = 1500;
    var DANCE_HOLD_MS = 2600;
    // Phones and tablets get tap-to-reveal / tap-to-flip instead of hover
    var TOUCH = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);

    var NAMES = {
        w: { k: 'Zeus', q: 'Athena', b: 'Angel on a camel', n: 'Pegasus', r: 'Archangel war-wagon', p: 'Cherub' },
        b: { k: 'Dracula', q: 'Witch queen', b: 'Demon on a camel', n: 'Nightmare', r: 'Demon war-wagon', p: 'Imp' }
    };

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
            return '<span class="ch-chip">' + esc(item) + '</span>';
        }).join('');
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    // ---------- artwork ----------

    var PALETTE = {
        w: {
            skin: '#ffe6d2', armor: '#fbf8ee', shade: '#d8ceb0', trim: '#e2b84a', metal: '#f1d27c',
            crest: '#ffffff', cloth: '#ffffff', shield: '#f6f1e2', wing: '#ffffff', ol: '#2c4a3a',
            eye: '#2c4a3a', coat: '#fbfbf6', mane: '#f3dc8c'
        },
        b: {
            skin: '#cfeedd', armor: '#2b2534', shade: '#15111b', trim: '#7dff9b', metal: '#463d52',
            crest: '#c1121f', cloth: '#3a0d18', shield: '#221d2a', wing: '#1c1622', ol: '#050308',
            eye: '#7dff9b', coat: '#1d1824', mane: '#5cff86'
        }
    };

    function feathers(p, cls) {
        return (
            '<g class="ch-wing ch-wing-l ' + cls + '"><path d="M42 48C30 33 16 28 5 32c7 4 5 8-1 12 8 2 8 6 2 10 12 1 24 3 36 4z" fill="' + p.wing + '"/>' +
            '<path d="M38 50C28 42 18 38 10 39M36 54c-9-3-18-4-26-3" fill="none" stroke="' + p.shade + '"/></g>' +
            '<g class="ch-wing ch-wing-r ' + cls + '"><path d="M58 48c12-15 26-20 37-16-7 4-5 8 1 12-8 2-8 6-2 10-12 1-24 3-36 4z" fill="' + p.wing + '"/>' +
            '<path d="M62 50c10-8 20-12 28-11M64 54c9-3 18-4 26-3" fill="none" stroke="' + p.shade + '"/></g>'
        );
    }

    function batWings(p) {
        return (
            '<g class="ch-wing ch-wing-l"><path d="M42 48C34 36 20 30 6 32l6 8-8 6 10 4-6 8c12-4 24-2 34 0z" fill="' + p.wing + '"/>' +
            '<path d="M42 50 12 40M42 54 14 50" fill="none" stroke="#c1121f" stroke-width="0.8"/></g>' +
            '<g class="ch-wing ch-wing-r"><path d="M58 48c8-12 22-18 36-16l-6 8 8 6-10 4 6 8c-12-4-24-2-34 0z" fill="' + p.wing + '"/>' +
            '<path d="M58 50 88 40M58 54 86 50" fill="none" stroke="#c1121f" stroke-width="0.8"/></g>'
        );
    }

    // Weapon held in the right hand; the whole group thrusts forward when the piece attacks
    function weapon(side, type, p) {
        var arm = '<path d="M61 47l10 10-3 3-9-9z" fill="' + p.skin + '"/>';
        var hand = '<circle cx="70" cy="58" r="2.8" fill="' + p.skin + '"/>';
        var held;
        if (type === 'k' && side === 'w') {
            held = '<path class="ch-bolt" d="M74 6 66 28h7l-8 26 15-30h-7l5-18z" fill="#ffd84d"/>';
        } else if (type === 'k') {
            held = '<path d="M70 18v74" stroke="#2a1a12" stroke-width="2.4"/><path d="M63 8v10q7 6 14 0V8l-3 6-4-8-4 8z" fill="#7dff9b"/>';
        } else if (type === 'q') {
            held = '<path d="M70 16v76" stroke="' + (side === 'w' ? '#c79a2e' : '#2a1a12') + '" stroke-width="2.2"/>' +
                '<circle class="ch-orb" cx="70" cy="12" r="5" fill="' + (side === 'w' ? '#fff6c4' : '#5cff86') + '"/>';
        } else if (type === 'b' && side === 'w') {
            held = '<path class="ch-flame" d="M70 6c4 6 2 10 2 14v34h-4V20c0-4-2-8 2-14z" fill="#ffd84d"/><path d="M64 54h12" stroke="' + p.trim + '" stroke-width="3"/>';
        } else if (type === 'b') {
            held = '<path d="M70 18v74" stroke="#4a2a14" stroke-width="2.2"/><circle cx="70" cy="13" r="5.5" fill="#e9f2e2"/>' +
                '<circle cx="68" cy="12.5" r="1.3" fill="#050308"/><circle cx="72" cy="12.5" r="1.3" fill="#050308"/>';
        } else {
            held = '<path d="M70 14v78" stroke="#6b4a2a" stroke-width="2.2"/><path d="M70 4l3.6 10h-7.2z" fill="' + p.metal + '"/>';
        }
        return '<g class="ch-weapon">' + arm + held + hand + '</g>';
    }

    function shield(side, type, p) {
        var big = type === 'r';
        var x = big ? 15 : 20, y = big ? 42 : 46, w = big ? 26 : 19, h = big ? 38 : 30;
        var cx = x + w / 2, cy = y + h / 2;
        var emblem = side === 'w'
            ? '<path d="M' + cx + ' ' + (y + 4) + 'V' + (y + h - 4) + 'M' + (x + 3) + ' ' + cy + 'H' + (x + w - 3) + '" stroke="' + p.trim + '" stroke-width="1.4"/>'
            : '<path d="M' + (x + 3) + ' ' + (y + 7) + 'l' + (w / 2 - 3) + ' 7 ' + (w / 2 - 3) + '-7M' + (x + 3) + ' ' + (y + h - 7) + 'l' + (w / 2 - 3) + '-7 ' + (w / 2 - 3) + ' 7" stroke="' + p.trim + '" stroke-width="1.4" fill="none"/>';
        return (
            '<g class="ch-shield"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + p.shield + '" stroke="' + p.trim + '" stroke-width="1.6"/>' +
            emblem + '<circle cx="' + cx + '" cy="' + cy + '" r="3.6" fill="' + p.trim + '"/></g>'
        );
    }

    // Helmet / headwear and everything that sits above the face
    function headgear(side, type, p) {
        var galea =
            '<path d="M41 33q0-11 9-11t9 11h-2.5v-4.5h-13V33z" fill="' + p.metal + '"/>' +
            '<path d="M41.5 32H44l.5 7-2.5-1zm17 0H56l-.5 7 2.5-1z" fill="' + p.metal + '"/>' +
            '<path d="M42 28.5h16" stroke="' + p.trim + '" stroke-width="1.5"/>';
        var crest = '<path class="ch-crest" d="M41 24q3-12 9-12 7 0 10 10-5-5-10-5t-9 7z" fill="' + p.crest + '"/>';
        var centurion = '<path class="ch-crest" d="M37 23q13-18 26 0-13-8-26 0z" fill="' + p.crest + '"/>';
        var crown = '<path d="M41 23v-9l4.5 5 4.5-8 4.5 8 4.5-5v9z" fill="' + (side === 'w' ? '#ffd84d' : '#9a8f2a') + '"/>' +
            (side === 'b' ? '<circle cx="50" cy="19" r="1.6" fill="#c1121f"/>' : '<circle cx="50" cy="19" r="1.6" fill="#4fc3f7"/>');
        var halo = '<ellipse class="ch-halo" cx="50" cy="8" rx="10" ry="2.8" fill="none" stroke="#ffd84d" stroke-width="2"/>';
        var horns = '<path d="M43 25q-6-5-5-13 3 7 8 10zm14 0q6-5 5-13-3 7-8 10z" fill="#c1121f"/>';
        var witchHat = '<path d="M35 27q15 4 30 0l-9-3-4-20q-2-2-5 2l-3 18z" fill="#1b1426"/>' +
            '<path d="M44.5 21.5q5.5 2 11 0l.4 2.8q-5.9 2-11.8 0z" fill="#7dff9b"/>';
        var hair = side === 'w'
            ? '<path d="M42 30q-4 14-1 24l4-9zm16 0q4 14 1 24l-4-9z" fill="#f3dc8c"/>'
            : '<path d="M42 30q-4 14-2 22l4-8zm16 0q4 14 2 22l-4-8z" fill="#3fbf6a"/>';

        if (side === 'w') {
            if (type === 'k') return galea + crown + halo;
            if (type === 'q') return hair + galea + crown + halo;
            if (type === 'r') return galea + centurion + halo;
            return galea + crest + halo;
        }
        if (type === 'k') return galea + crown;
        if (type === 'q') return hair + galea + witchHat + '<path d="M46 23l2-3 2 2 2-2 2 3z" fill="#ffd84d"/>';
        if (type === 'b') return hair + galea + witchHat;
        if (type === 'r') return galea + horns + centurion;
        return galea + horns;
    }

    function face(side, type, p) {
        var eyes = '<circle class="ch-eye" cx="47" cy="34" r="1.1" fill="' + (side === 'b' && (type === 'r' || type === 'p') ? '#ff3b3b' : p.eye) + '"/>' +
            '<circle class="ch-eye" cx="53" cy="34" r="1.1" fill="' + (side === 'b' && (type === 'r' || type === 'p') ? '#ff3b3b' : p.eye) + '"/>';
        var mouth = side === 'w'
            ? '<path d="M47.5 37.5q2.5 2 5 0" fill="none" stroke="#b5735a" stroke-width="0.9"/>'
            : '<path d="M47 37.5h6" stroke="#3a0d18" stroke-width="1"/>' +
              (type === 'k' ? '<path d="M47.6 37.6l.9 2.6.9-2.6zm3.2 0l.9 2.6.9-2.6z" fill="#fff"/>' : '');
        return '<circle cx="50" cy="33" r="8" fill="' + p.skin + '"/>' + eyes + mouth;
    }

    // Armoured legionary: wings or cape behind, greaves, pteruges skirt, segmented cuirass, scutum and weapon
    function soldier(side, type) {
        var p = PALETTE[side];
        var back = '';
        if (side === 'w') {
            back = feathers(p, type === 'p' ? 'ch-wing-small' : '');
            if (type === 'k') back += '<path d="M37 44 24 94h52L63 44z" fill="#fff7dc"/>';
        } else if (type === 'k') {
            back = '<path d="M37 44 22 94h56L63 44z" fill="#100c14"/><path d="M40 46 30 92h40L60 46z" fill="#c1121f"/>' +
                '<path d="M37 44l-7-15 12 11zm26 0 7-15-12 11z" fill="#100c14"/>';
        } else if (type === 'r') {
            back = batWings(p);
        } else if (type === 'q' || type === 'b') {
            back = '<path d="M38 44 28 92h44L62 44z" fill="#2a0f3a"/>';
        } else {
            back = '<path class="ch-tail" d="M58 74q18 4 14 18l5-1" fill="none" stroke="#c1121f" stroke-width="1.8"/>';
        }
        return '<svg class="ch-fig" viewBox="0 0 100 100" aria-hidden="true">' + soldierParts(side, type, p, back) + '</svg>';
    }

    function soldierParts(side, type, p, back) {
        return (
            '<g stroke="' + p.ol + '" stroke-width="0.9" stroke-linejoin="round">' +
            back +
            '<rect x="42" y="75" width="6" height="17" rx="2" fill="' + p.skin + '"/><rect x="52" y="75" width="6" height="17" rx="2" fill="' + p.skin + '"/>' +
            '<rect x="41.5" y="80" width="7" height="10" rx="2" fill="' + p.metal + '"/><rect x="51.5" y="80" width="7" height="10" rx="2" fill="' + p.metal + '"/>' +
            '<path d="M39 92h10v3H38zm12 0h10l1 3H51z" fill="#6b4a2a"/>' +
            '<path d="M38 64h24l2 14H36z" fill="' + p.cloth + '"/>' +
            '<path d="M41 66v12M45 66v12M49 66v12M53 66v12M57 66v12M61 66v12" stroke="' + p.trim + '" stroke-width="0.8"/>' +
            '<path d="M37 44q13-5 26 0l-2 22H39z" fill="' + p.armor + '"/>' +
            '<path d="M39 51q11 3 22 0M39 57q11 3 22 0M39.5 62q10.5 3 21 0" fill="none" stroke="' + p.shade + '"/>' +
            '<path d="M33 46q4-6 10-3l-2 7q-5 0-8-4zm34 0q-4-6-10-3l2 7q5 0 8-4z" fill="' + p.metal + '"/>' +
            face(side, type, p) +
            headgear(side, type, p) +
            weapon(side, type, p) +
            shield(side, type, p) +
            '</g>'
        );
    }

    // A rider: the same legionary, shrunk and set at (x, y) = where its hips should sit
    function rider(side, type, x, y, scale) {
        var p = PALETTE[side];
        var back = side === 'w' ? feathers(p, '') : batWings(p);
        return '<g transform="translate(' + (x - 50 * scale) + ' ' + (y - 66 * scale) + ') scale(' + scale + ')">' + soldierParts(side, type, p, back) + '</g>';
    }

    // Bishop: an angel (light) or a demon (night) riding a two-humped camel
    function camel(side) {
        var p = PALETTE[side];
        var w = side === 'w';
        var coat = w ? '#f1dfb4' : '#2a2030', dark = w ? '#c9ae78' : '#16101c';
        return (
            '<svg class="ch-fig ch-camel" viewBox="0 0 100 100" aria-hidden="true">' +
            '<g stroke="' + p.ol + '" stroke-width="0.9" stroke-linejoin="round">' +
            '<g class="ch-legs"><path class="ch-leg-a" d="M33 62l-2 32M63 62l1 32" stroke="' + dark + '" stroke-width="4.5" stroke-linecap="round"/>' +
            '<path class="ch-leg-b" d="M40 62l3 32M70 60l4 34" stroke="' + coat + '" stroke-width="4.5" stroke-linecap="round"/></g>' +
            '<path d="M27 55q-7 4-4 13" fill="none" stroke="' + dark + '" stroke-width="2"/>' +
            '<path d="M26 57q-2-14 10-15 4-13 12-8 5 6 10 2 6-9 12 4l4 6q6-6 6-18 0-10 8-12l6 4q2 4-2 5l-4 1q-2 10-4 22-2 12-14 16H34q-8 0-8-7z" fill="' + coat + '"/>' +
            '<circle class="ch-eye" cx="89" cy="20" r="1.4" fill="' + (w ? '#2c4a3a' : '#ff3b3b') + '"/>' +
            '<path d="M86 17l4-5" stroke="' + p.metal + '" stroke-width="1.6"/>' +
            rider(side, w ? 'b' : 'r', 52, 46, 0.7) +
            '<path d="M41 43h22l-2 13H43z" fill="' + (w ? '#ffd84d' : '#c1121f') + '"/>' +
            '<path d="M42 52h20" stroke="' + p.trim + '" stroke-width="1.4"/>' +
            '<path d="M48 56l-1 5m10-5 1 5" stroke="' + p.trim + '" stroke-width="1.2"/>' +
            '</g></svg>'
        );
    }

    // Rook: a square wooden war-wagon / tank on four wheels with battlements, a cannon and a crew member on top
    function tank(side) {
        var p = PALETTE[side];
        var w = side === 'w';
        var wood = w ? '#ecdcaa' : '#3b2a22', plank = w ? '#b89b5e' : '#1d130f', band = w ? '#e2b84a' : '#463d52';
        var slit = w ? '#ffd84d' : '#7dff9b';
        var wheels = [22, 40, 60, 78].map(function (x) {
            return '<g class="ch-wheel" style="transform-origin:' + x + 'px 84px"><circle cx="' + x + '" cy="84" r="9" fill="' + plank + '"/>' +
                '<circle cx="' + x + '" cy="84" r="6.5" fill="' + wood + '"/>' +
                '<path d="M' + (x - 6) + ' 84h12M' + x + ' 78v12" stroke="' + plank + '" stroke-width="1.6"/>' +
                '<circle cx="' + x + '" cy="84" r="2" fill="' + band + '"/></g>';
        }).join('');
        return (
            '<svg class="ch-fig ch-tank" viewBox="0 0 100 100" aria-hidden="true">' +
            rider(side, w ? 'r' : 'p', 50, 54, 0.72) +
            '<g stroke="' + p.ol + '" stroke-width="0.9" stroke-linejoin="round">' +
            '<g class="ch-barrel"><rect x="76" y="56" width="20" height="7" rx="2" fill="' + band + '"/><rect x="93" y="54.5" width="4" height="10" rx="1" fill="' + plank + '"/>' +
            '<circle class="ch-muzzle" cx="100" cy="59.5" r="6" fill="' + slit + '"/></g>' +
            '<path d="M14 80V44h10v6h8v-6h10v6h8v-6h10v6h8v-6h10v6h0V80z" fill="' + wood + '"/>' +
            '<path d="M23 50v30M32 50v30M41 50v30M50 50v30M59 50v30M68 50v30M77 50v30" stroke="' + plank + '" stroke-width="0.9"/>' +
            '<path d="M14 58h72M14 72h72" stroke="' + band + '" stroke-width="2.6"/>' +
            [20, 36, 52, 68, 82].map(function (x) {
                return '<circle cx="' + x + '" cy="58" r="1.1" fill="' + plank + '"/><circle cx="' + x + '" cy="72" r="1.1" fill="' + plank + '"/>';
            }).join('') +
            '<rect class="ch-slit" x="27" y="62" width="12" height="4" rx="1" fill="' + slit + '"/><rect class="ch-slit" x="55" y="62" width="12" height="4" rx="1" fill="' + slit + '"/>' +
            (w ? '<path d="M44 66l6-5 6 5-6 3z" fill="#ffd84d"/>' : '<path d="M44 63l6 4 6-4M44 69l6-4 6 4" fill="none" stroke="#7dff9b" stroke-width="1.2"/>') +
            wheels +
            '</g></svg>'
        );
    }

    // Side-view winged horse; white = feathered pegasus, black = bat-winged nightmare with a green flame mane
    function horse(side, cls) {
        var p = PALETTE[side];
        var wing = side === 'w'
            ? '<path d="M46 50C40 30 30 18 14 12c6 8 4 12-2 14 8 4 6 8 2 12 12 2 22 8 32 16z" fill="' + p.wing + '"/>' +
              '<path d="M44 48C38 36 30 28 20 22M42 50C34 42 26 38 18 36" fill="none" stroke="' + p.shade + '"/>'
            : '<path d="M46 50C42 32 34 22 18 14l4 10-10 2 8 6-8 6c12 0 24 6 34 16z" fill="' + p.wing + '"/>' +
              '<path d="M46 50 20 24M44 52 16 38" fill="none" stroke="#c1121f" stroke-width="0.8"/>';
        return (
            '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true">' +
            '<g stroke="' + p.ol + '" stroke-width="0.9" stroke-linejoin="round">' +
            '<g class="ch-wing ch-wing-far">' + wing + '</g>' +
            '<path d="M30 54q-14-2-16 16 8-8 16-8z" fill="' + p.mane + '"/>' +
            '<g class="ch-legs"><path class="ch-leg-a" d="M36 66l-3 24M62 68l-2 22" stroke="' + p.coat + '" stroke-width="5" stroke-linecap="round"/>' +
            '<path class="ch-leg-b" d="M44 68l3 22M70 66l5 24" stroke="' + p.coat + '" stroke-width="5" stroke-linecap="round"/></g>' +
            '<path d="M28 60q2-12 16-12h18q4-18 12-26 6-4 12 0l4 8q-2 4-6 3l-4-1q-4 8-6 20 2 12-4 18H34q-8-2-6-10z" fill="' + p.coat + '"/>' +
            '<path class="ch-mane" d="M64 46q-4-12 6-24 2 6-2 12 4-2 4 4-4 2-6 8z" fill="' + p.mane + '"/>' +
            '<path d="M44 48h16l-2 14H46z" fill="' + (side === 'w' ? '#ffd84d' : '#c1121f') + '"/>' +
            '<path d="M74 20q6-6 12 0" fill="none" stroke="' + p.metal + '" stroke-width="3"/>' +
            '<path class="ch-crest" d="M76 18q-2-12 8-14-4 6-2 12z" fill="' + p.crest + '"/>' +
            '<circle class="ch-eye" cx="80" cy="26" r="1.5" fill="' + (side === 'w' ? '#2c4a3a' : '#ff3b3b') + '"/>' +
            '<g class="ch-wing ch-wing-near">' + wing + '</g>' +
            '</g></svg>'
        );
    }

    var BROOM_SVG =
        '<svg class="ch-broom" viewBox="0 0 100 30" aria-hidden="true">' +
        '<path d="M14 17 94 11" stroke="#6b3f1c" stroke-width="3.4" stroke-linecap="round"/>' +
        '<path d="M18 17 2 6 0 12l-4 2 3 4-2 6 7 1 14-6z" fill="#c9a24a" stroke="#5a3a14" stroke-width="0.8"/>' +
        '<path d="M16 15l3 4" stroke="#7dff9b" stroke-width="2"/>' +
        '</svg>';

    function pieceArt(side, type) {
        if (type === 'n') return horse(side, 'ch-fig ch-horse');
        if (type === 'b') return camel(side);
        if (type === 'r') return tank(side);
        var fig = soldier(side, type);
        // Night rides brooms on the spot; light summons a pegasus to fly on while idle
        return side === 'b' ? fig + BROOM_SVG : '<div class="ch-mount">' + horse('w', 'ch-mount-horse') + '</div>' + fig;
    }

    // ---------- page content ----------

    // Shows the nickname; the full name fades in as the pointer comes near, with the surname still blurred
    function nameHeading(info) {
        var parts = String(info.name || '').trim().split(/\s+/);
        var last = parts.length > 1 ? parts.pop() : '';
        var nick = info.nickname || parts[0] || '';
        return (
            '<h1 class="ch-name" tabindex="0" aria-label="' + esc(nick) + '">' +
            '<span class="ch-nick" aria-hidden="true">' + esc(nick) + '</span>' +
            '<span class="ch-full" aria-hidden="true">' + esc(parts.join(' ')) +
            (last ? ' <span class="ch-secret-text ch-last">' + esc(last) + '</span>' : '') + '</span>' +
            '</h1>'
        );
    }

    function renderContent(data) {
        var info = data.personalInfo || {};
        var location = (info.location || []).join(', ');
        var skills = data.workSkills || {};
        var platforms = data.platforms || {};
        var photo = info.profileImage
            ? (typeof window.profileImageSrc === 'function' ? window.profileImageSrc(info.profileImage) : info.profileImage)
            : '';

        var contact = [
            info.email && '<a class="ch-chip ch-chip-link ch-secret" href="mailto:' + esc(info.email) + '">✉️ <span class="ch-secret-text">' + esc(info.email) + '</span></a>',
            info.phone && '<a class="ch-chip ch-chip-link ch-secret" href="tel:' + esc(info.phone.replace(/\s+/g, '')) + '">📞 <span class="ch-secret-text">' + esc(info.phone) + '</span></a>',
            location && '<span class="ch-chip">📍 ' + esc(location) + '</span>'
        ].filter(Boolean).join('');

        var spoken = Object.keys(data.spokenLanguages || {}).map(function (lang) {
            return lang + ' · ' + data.spokenLanguages[lang];
        });

        var ICONS = ['♜', '♞', '♝', '♛', '♚', '♟', '♖', '♘', '♗', '♕', '♔', '♙'];
        var armory = Object.keys(skills).map(function (key) {
            return { title: key, items: skills[key] };
        }).concat([
            { title: 'Languages', items: data.programmingLanguages },
            { title: 'Tools', items: data.tools },
            { title: 'Platforms', items: (platforms.primary || []).concat(platforms.secondary || []) },
            { title: 'Spoken', items: spoken },
            { title: 'Traits', items: data.profileTraits }
        ]).filter(function (group) {
            return group.items && group.items.length;
        }).map(function (group, i) {
            return (
                '<div class="ch-card ch-armory-card ch-reveal-item" style="--i:' + i + '">' +
                '<h3><span class="ch-card-icon" aria-hidden="true">' + ICONS[i % ICONS.length] + '</span>' + esc(group.title) + '</h3>' +
                '<div class="ch-chips">' + chips(group.items) + '</div></div>'
            );
        }).join('');

        // Experience fills a little chessboard: each square is a job (newest = king) that flips over for details
        var CAMPAIGN_ICONS = ['♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟'];
        var campaigns = (data.experience || []).map(function (exp, i) {
            var d = exp.duration || {};
            var from = String(d.start || '').split('-')[0];
            var to = /present/i.test(d.end) ? 'now' : String(d.end || '').split('-')[0];
            var square = FILES[i % 8] + (8 - Math.floor(i / 8));
            return (
                '<article class="ch-exp ch-reveal-item" tabindex="0">' +
                '<div class="ch-exp-inner">' +
                '<div class="ch-exp-face ch-exp-front">' +
                '<span class="ch-exp-square">' + square + '</span>' +
                '<span class="ch-exp-icon" aria-hidden="true">' + CAMPAIGN_ICONS[i % CAMPAIGN_ICONS.length] + '</span>' +
                '<span class="ch-exp-years">' + esc(from) + (to && to !== from ? '<small> → ' + esc(to) + '</small>' : '') + '</span>' +
                '<h3>' + esc(exp.role) + '</h3>' +
                '<p class="ch-exp-company">' + esc(exp.company) + '</p>' +
                '</div>' +
                '<div class="ch-exp-face ch-exp-back">' +
                '<p class="ch-exp-desc">' + esc((exp.description || []).join(' ')) + '</p>' +
                '<p class="ch-exp-meta">' + esc(d.start) + ' — ' + esc(d.end) + (exp.type ? '<br>' + esc(exp.type) : '') + '</p>' +
                '</div>' +
                '</div></article>'
            );
        }).join('');

        var conquests = (data.projects || []).map(function (p, i) {
            return (
                '<article class="ch-card ch-project ch-reveal-item">' +
                '<span class="ch-project-no">' + FILES[i % 8] + (8 - Math.floor(i / 8) % 8) + '</span>' +
                '<h3>' + esc(p.name) + '</h3>' +
                '<p>' + esc(p.description) + '</p>' +
                '<div class="ch-chips">' + chips(p.technologies) + '</div>' +
                (p.url ? '<a class="ch-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">Advance <span aria-hidden="true">→</span></a>' : '') +
                '</article>'
            );
        }).join('');

        var scrolls = (data.education || []).map(function (e) {
            return (
                '<div class="ch-card ch-scroll ch-reveal-item">' +
                '<h3>🏛️ ' + esc(e.level) + '</h3>' +
                '<p class="ch-at">' + esc(e.field) + '</p>' +
                '<p>' + esc(e.institution) + '</p>' +
                '<p class="ch-date">' + esc(e.date) + (e.GPA ? ' · GPA ' + esc(e.GPA) : '') + '</p>' +
                '</div>'
            );
        }).concat((data.certifications || []).map(function (c) {
            return (
                '<div class="ch-card ch-scroll ch-reveal-item">' +
                '<h3>🏅 ' + esc(c.name) + '</h3>' +
                '<p class="ch-at">' + esc(c.issuer) + '</p>' +
                '<p class="ch-date">' + esc(c.date) + '</p>' +
                '</div>'
            );
        })).join('');

        function heading(icon, title, sub) {
            return '<h2><span class="ch-h2-icon" aria-hidden="true">' + icon + '</span>' + title + ' <span class="ch-h2-sub">' + sub + '</span></h2>';
        }

        return (
            '<main class="ch-page">' +
            '<header class="ch-hero">' +
            '<div class="ch-hero-text">' +
            (photo ? '<div class="ch-photo"><img src="' + esc(photo) + '" alt="' + esc(info.name) + '"></div>' : '') +
            nameHeading(info) +
            '<p class="ch-title">' + esc(info.title) + '</p>' +
            '<div class="ch-summary">' + ((data.summary && data.summary.lines) || []).map(function (l) { return '<p>♟ ' + esc(l) + '</p>'; }).join('') + '</div>' +
            '<div class="ch-chips ch-contact">' + contact + '</div>' +
            '</div>' +

            '<section class="ch-battle" aria-label="Animated chess battle between the legion of light and the legion of night">' +
            '<div class="ch-side ch-side-b"><span class="ch-side-icon" aria-hidden="true">☾</span><b>Legio Noctis</b><small>Dracula · demons · witches · war-wagons</small></div>' +
            '<div class="ch-board-frame">' +
            '<div class="ch-board">' +
            '<div class="ch-squares" aria-hidden="true"></div>' +
            '<div class="ch-pieces" aria-hidden="true"></div>' +
            '<div class="ch-verdict" aria-live="polite"></div>' +
            '</div></div>' +
            '<div class="ch-side ch-side-w"><span class="ch-side-icon" aria-hidden="true">☀</span><b>Legio Lucis</b><small>gods · angels · pegasi</small></div>' +
            '<ol class="ch-log" aria-label="Latest moves"></ol>' +
            '</section>' +
            '</header>' +

            '<section class="ch-section ch-reveal">' + heading('🛡️', 'Armory', 'skills') +
            '<div class="ch-grid ch-armory">' + armory + '</div></section>' +

            '<section class="ch-section ch-reveal">' + heading('⚔️', 'Campaigns', 'experience') +
            '<div class="ch-campaigns">' + campaigns + '</div></section>' +

            '<section class="ch-section ch-reveal">' + heading('🏰', 'Conquests', 'projects') +
            '<div class="ch-grid ch-grid-3">' + conquests + '</div></section>' +

            '<section class="ch-section ch-reveal">' + heading('📜', 'Scrolls of wisdom', 'education &amp; certifications') +
            '<div class="ch-grid">' + scrolls + '</div></section>' +

            '</main>'
        );
    }

    // ---------- background map ----------
    // A top-down strategy-game map: the light kingdom's green continent on the left, and on the right
    // a gloomy island carried on the deck of a giant ghost ship, both dotted with castles.

    function seeded(seed) {
        return function () {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    // Smooth closed blob with a wobbly outline
    function blob(cx, cy, rx, ry, rnd, jitter) {
        var n = 26, pts = [];
        for (var i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2;
            var k = 1 + (rnd() - 0.5) * 2 * (jitter || 0.2);
            pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
        }
        function mid(p, q) { return ((p[0] + q[0]) / 2).toFixed(1) + ' ' + ((p[1] + q[1]) / 2).toFixed(1); }
        var d = 'M' + mid(pts[0], pts[1]);
        for (var j = 1; j <= n; j++) {
            var p = pts[j % n], q = pts[(j + 1) % n];
            d += 'Q' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' ' + mid(p, q);
        }
        return d + 'Z';
    }

    // Coast = shallow-water halo, sand rim, then land
    function island(d, land) {
        return (
            '<path d="' + d + '" fill="none" stroke="#5fb3a1" stroke-width="44" stroke-opacity="0.45" stroke-linejoin="round"/>' +
            '<path d="' + d + '" fill="none" stroke="#efe6c4" stroke-width="12" stroke-linejoin="round"/>' +
            '<path d="' + d + '" fill="' + land + '"/>'
        );
    }

    function forest(cx, cy, spread, count, rnd, spooky) {
        var out = '';
        for (var i = 0; i < count; i++) {
            var a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * spread;
            var x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist * 0.75;
            var r = 7 + rnd() * 7;
            if (spooky && rnd() < 0.35) {
                // Bare dead tree seen from above: a twisted cross of branches
                out += '<path d="M' + (x - r) + ' ' + y + 'L' + (x + r) + ' ' + (y - 2) + 'M' + x + ' ' + (y - r) + 'L' + (x + 2) + ' ' + (y + r) + '" stroke="#1a1420" stroke-width="2.4" stroke-linecap="round"/>';
                continue;
            }
            var base = spooky ? (rnd() < 0.5 ? '#2c2238' : '#1f3a2c') : (rnd() < 0.5 ? '#2f7d4a' : '#3a8f55');
            out += '<circle cx="' + (x + 3) + '" cy="' + (y + 3) + '" r="' + r + '" fill="rgba(0,0,0,0.25)"/>' +
                '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + base + '"/>' +
                '<circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.3) + '" r="' + (r * 0.45) + '" fill="' + (spooky ? '#4a3a5c' : '#5cb46f') + '" opacity="0.7"/>';
        }
        return out;
    }

    function mountains(cx, cy, count, rnd) {
        var out = '';
        for (var i = 0; i < count; i++) {
            var x = cx + (rnd() - 0.5) * 160, y = cy + (rnd() - 0.5) * 90, s = 18 + rnd() * 18;
            out += '<path d="M' + (x - s) + ' ' + (y + s * 0.6) + 'L' + x + ' ' + (y - s) + 'L' + x + ' ' + (y + s * 0.6) + 'Z" fill="#8aa58c"/>' +
                '<path d="M' + x + ' ' + (y - s) + 'L' + (x + s) + ' ' + (y + s * 0.6) + 'L' + x + ' ' + (y + s * 0.6) + 'Z" fill="#56715b"/>' +
                '<path d="M' + (x - s * 0.3) + ' ' + (y - s * 0.45) + 'L' + x + ' ' + (y - s) + 'L' + (x + s * 0.3) + ' ' + (y - s * 0.45) + 'Z" fill="#ffffff"/>';
        }
        return out;
    }

    function farms(x, y, cols, rows) {
        var out = '', tones = ['#d9d27a', '#b9cf6a', '#e8dc96', '#9cc463'];
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                out += '<rect x="' + (x + c * 30) + '" y="' + (y + r * 22) + '" width="27" height="19" rx="2" fill="' + tones[(r * 3 + c) % 4] + '" stroke="#7a8f4a" stroke-width="0.8"/>' +
                    '<path d="M' + (x + c * 30 + 4) + ' ' + (y + r * 22 + 6) + 'h19M' + (x + c * 30 + 4) + ' ' + (y + r * 22 + 12) + 'h19" stroke="#7a8f4a" stroke-width="0.6" opacity="0.6"/>';
            }
        }
        return out;
    }

    // Castle seen from directly above: curtain wall, round corner towers, pyramid-roofed keep, flag
    function castle(x, y, s, side) {
        var w = side === 'w';
        var wall = w ? '#f4efe2' : '#3a3344', yard = w ? '#d6e8cb' : '#26302b', tower = w ? '#ffffff' : '#2a2433';
        var roofA = w ? '#e8c25a' : '#5a2f6e', roofB = w ? '#c79a2e' : '#331b40', flag = w ? '#ffd84d' : '#c1121f';
        var ol = w ? '#6a7a66' : '#050308';
        var towers = [[-36, -36], [36, -36], [-36, 36], [36, 36]].map(function (t) {
            return '<circle cx="' + t[0] + '" cy="' + t[1] + '" r="11" fill="' + tower + '" stroke="' + ol + '" stroke-width="1.5"/>' +
                '<circle cx="' + t[0] + '" cy="' + t[1] + '" r="6" fill="' + roofA + '"/>' +
                (w ? '' : '<circle class="ch-map-glow" cx="' + t[0] + '" cy="' + t[1] + '" r="2" fill="#7dff9b"/>');
        }).join('');
        return (
            '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
            (w ? '' : '<circle r="78" fill="url(#chGloom)"/>') +
            '<rect x="-34" y="-34" width="80" height="80" rx="6" fill="rgba(0,0,0,0.28)"/>' +
            '<rect x="-36" y="-36" width="72" height="72" fill="' + yard + '" stroke="' + wall + '" stroke-width="9"/>' +
            '<rect x="-41" y="-41" width="82" height="82" fill="none" stroke="' + ol + '" stroke-width="1.2" stroke-dasharray="5 4"/>' +
            '<rect x="-8" y="31" width="16" height="12" fill="' + (w ? '#c8b98a' : '#14101a') + '"/>' +
            towers +
            '<rect x="-17" y="-15" width="38" height="38" fill="rgba(0,0,0,0.25)"/>' +
            '<path d="M-19-19H19L0 0Z" fill="' + roofA + '"/><path d="M19-19V19L0 0Z" fill="' + roofB + '"/>' +
            '<path d="M19 19H-19L0 0Z" fill="' + roofB + '"/><path d="M-19 19V-19L0 0Z" fill="' + roofA + '"/>' +
            '<path d="M-19-19H19V19H-19Z" fill="none" stroke="' + ol + '" stroke-width="1.2"/>' +
            '<path d="M0 0V-30" stroke="' + ol + '" stroke-width="1.6"/>' +
            '<path class="ch-map-flag" d="M0-30h16l-4 5 4 5H0z" fill="' + flag + '"/>' +
            '</g>'
        );
    }

    function road(d, side) {
        return '<path d="' + d + '" fill="none" stroke="' + (side === 'w' ? '#efe2b4' : '#2a2030') + '" stroke-width="7" stroke-linecap="round" opacity="0.9"/>' +
            '<path d="' + d + '" fill="none" stroke="' + (side === 'w' ? '#c9b67a' : '#5a2f6e') + '" stroke-width="1.4" stroke-dasharray="6 6" opacity="0.8"/>';
    }

    function ship(x, y, dur, delay, flip) {
        return '<g transform="translate(' + x + ' ' + y + ')' + (flip ? ' scale(-1 1)' : '') + '"><g class="ch-ship" style="--dur:' + dur + 's;--delay:' + delay + 's">' +
            '<path d="M-26 6q-10-20 0-20" stroke="rgba(255,255,255,0.5)" stroke-width="2" fill="none"/>' +
            '<path d="M-18-6H14L22 0 14 6H-18Z" fill="#6b4a2a" stroke="#3b2a1a"/>' +
            '<path d="M-4-12V12" stroke="#3b2a1a" stroke-width="2"/><path d="M-4-11q8 11 0 22" fill="#ffffff" stroke="#9aa"/>' +
            '</g></g>';
    }

    function sunRays() {
        var out = '';
        for (var i = 0; i < 12; i++) {
            out += '<path d="M-10-70 0-150 10-70Z" fill="#ffe27a" opacity="0.45" transform="rotate(' + (i * 30) + ')"/>';
        }
        return out;
    }

    // Stars over the night half plus green castle glows and lanterns on the ghost ship's masts
    function nightLights() {
        var rnd = seeded(7), out = '';
        for (var i = 0; i < 70; i++) {
            var x = 900 + rnd() * 700, y = rnd() * 1000, r = 0.8 + rnd() * 1.8;
            if (x < 1000 && rnd() < 0.6) continue;
            out += '<circle class="ch-star" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + r.toFixed(1) + '" fill="#ffffff" style="animation-delay:-' + (rnd() * 3).toFixed(2) + 's"/>';
        }
        [[1230, 480, 1.9], [1380, 300, 0.85], [1120, 740, 0.9]].forEach(function (c) {
            out += '<circle class="ch-map-glow" cx="' + c[0] + '" cy="' + c[1] + '" r="' + (90 * c[2]) + '" fill="url(#chGloom)"/>';
            [[-36, -36], [36, -36], [-36, 36], [36, 36], [0, 0]].forEach(function (t) {
                out += '<circle class="ch-map-glow" cx="' + (c[0] + t[0] * c[2]) + '" cy="' + (c[1] + t[1] * c[2]) + '" r="' + (2.6 * c[2]) + '" fill="#7dff9b"/>';
            });
        });
        [[1010, 300], [1010, 660], [1470, 300], [1470, 660]].forEach(function (m) {
            out += '<circle cx="' + m[0] + '" cy="' + m[1] + '" r="22" fill="url(#chGloom)"/><circle class="ch-map-glow" cx="' + m[0] + '" cy="' + m[1] + '" r="4" fill="#d6ff9b"/>';
        });
        return out;
    }

    function mapSvg() {
        var rnd = seeded(13);
        var continent = blob(430, 520, 420, 390, rnd, 0.16);
        var north = blob(300, 220, 260, 170, rnd, 0.2);
        var islets = [[860, 120, 80, 45], [880, 900, 110, 55], [1530, 920, 90, 55], [70, 940, 80, 45]].map(function (i) {
            return island(blob(i[0], i[1], i[2], i[3], rnd, 0.25), '#4aa167');
        }).join('');
        var gloomIsland = blob(1230, 480, 250, 290, rnd, 0.18);
        var graves = '';
        for (var g = 0; g < 18; g++) {
            var gx = 1300 + (g % 6) * 18, gy = 610 + Math.floor(g / 6) * 20;
            graves += '<path d="M' + gx + ' ' + (gy - 6) + 'v12M' + (gx - 4) + ' ' + (gy - 2) + 'h8" stroke="#d9d4e4" stroke-width="2"/>';
        }

        var glowDefs =
            '<radialGradient id="chGloom"><stop offset="0%" stop-color="#7dff9b" stop-opacity="0.35"/><stop offset="100%" stop-color="#7dff9b" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="chSun"><stop offset="0%" stop-color="#fffbe0"/><stop offset="45%" stop-color="#ffe27a"/><stop offset="100%" stop-color="#ffcf4d" stop-opacity="0"/></radialGradient>';

        // Everything that never moves is drawn once into an <img>: the rough-coast filter is far too costly
        // to re-run every frame, which is what made the page flicker while the map was one live SVG
        var still =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">' +
            '<defs>' + glowDefs +
            '<pattern id="chWaves" width="60" height="30" patternUnits="userSpaceOnUse">' +
            '<path d="M4 18q8-6 16 0t16 0" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.6"/></pattern>' +
            '<filter id="chRough"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="4"/>' +
            '<feDisplacementMap in="SourceGraphic" scale="22"/></filter>' +
            '<linearGradient id="chSea" x1="0" x2="1"><stop offset="0%" stop-color="#2aa394"/><stop offset="45%" stop-color="#17786c"/>' +
            '<stop offset="60%" stop-color="#0f3d4a"/><stop offset="100%" stop-color="#081a2c"/></linearGradient>' +
            '<linearGradient id="chDayNight" x1="0" x2="1">' +
            '<stop offset="0%" stop-color="#fff3b0" stop-opacity="0.22"/><stop offset="40%" stop-color="#fff3b0" stop-opacity="0"/>' +
            '<stop offset="49%" stop-color="#ff8a5c" stop-opacity="0.16"/><stop offset="57%" stop-color="#1a0f3a" stop-opacity="0.45"/>' +
            '<stop offset="70%" stop-color="#070722" stop-opacity="0.62"/><stop offset="100%" stop-color="#04041a" stop-opacity="0.7"/></linearGradient>' +
            '<radialGradient id="chSunlight" cx="0%" cy="0%" r="60%"><stop offset="0%" stop-color="#fffbe0" stop-opacity="0.45"/><stop offset="100%" stop-color="#fffbe0" stop-opacity="0"/></radialGradient>' +
            '<radialGradient id="chMoonGlow"><stop offset="0%" stop-color="#e9fbef" stop-opacity="0.55"/><stop offset="100%" stop-color="#e9fbef" stop-opacity="0"/></radialGradient>' +
            '<mask id="chCrescent"><circle r="48" fill="#fff"/><circle cx="20" cy="-12" r="44" fill="#000"/></mask>' +
            '<radialGradient id="chVignette" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#03130d" stop-opacity="0.7"/></radialGradient>' +
            '</defs>' +
            '<rect width="1600" height="1000" fill="url(#chSea)"/><rect width="1600" height="1000" fill="url(#chWaves)"/>' +

            // Light kingdom
            '<g filter="url(#chRough)">' + island(north, '#55ad6e') + island(continent, '#4ea468') + islets + '</g>' +
            '<path d="M420 170Q470 330 560 420T640 640Q700 720 830 760" fill="none" stroke="#3f8f9a" stroke-width="12" stroke-linecap="round"/>' +
            '<path d="M420 170Q470 330 560 420T640 640Q700 720 830 760" fill="none" stroke="#7fd0d6" stroke-width="3" stroke-linecap="round" opacity="0.6"/>' +
            farms(470, 560, 4, 3) + farms(150, 300, 3, 2) + farms(680, 820, 3, 2) +
            mountains(210, 640, 7, rnd) + mountains(150, 150, 5, rnd) +
            forest(620, 300, 70, 26, rnd) + forest(320, 800, 80, 30, rnd) + forest(120, 470, 60, 20, rnd) + forest(400, 90, 60, 16, rnd) +
            road('M420 460Q520 360 660 230', 'w') + road('M420 460Q560 600 620 760', 'w') + road('M420 460Q320 330 250 250', 'w') +
            castle(420, 460, 1.5, 'w') + castle(620, 760, 0.95, 'w') + castle(250, 250, 0.95, 'w') + castle(660, 230, 0.8, 'w') +

            // Ghost ship carrying the gloom island
            '<g class="ch-map-ghostship">' +
            '<path d="M930 480Q960 150 1290 120L1540 210Q1590 480 1540 760L1290 850Q960 820 930 480Z" fill="#3b2a22" stroke="#140c08" stroke-width="5"/>' +
            '<path d="M960 480Q985 190 1290 160L1515 235Q1555 480 1515 735L1290 810Q985 780 960 480Z" fill="none" stroke="#5a4232" stroke-width="3" stroke-dasharray="26 8"/>' +
            [[1010, 300], [1010, 660], [1470, 300], [1470, 660]].map(function (m) {
                return '<circle cx="' + m[0] + '" cy="' + m[1] + '" r="14" fill="#2a1a12" stroke="#140c08" stroke-width="3"/><path d="M' + (m[0] - 30) + ' ' + m[1] + 'h60" stroke="#d9d4e4" stroke-width="4" opacity="0.5"/>';
            }).join('') +
            '<g filter="url(#chRough)">' + island(gloomIsland, '#2b4334') + '</g>' +
            forest(1110, 330, 70, 26, rnd, true) + forest(1350, 760, 60, 18, rnd, true) + forest(1090, 640, 60, 20, rnd, true) + forest(1390, 330, 50, 14, rnd, true) +
            graves +
            road('M1230 480Q1300 380 1380 300', 'b') + road('M1230 480Q1160 640 1120 740', 'b') +
            castle(1230, 480, 1.9, 'b') + castle(1380, 300, 0.85, 'b') + castle(1120, 740, 0.9, 'b') +
            '</g>' +

            // Day on the light kingdom, night over the ghost ship; lights that glow in the dark sit above the shade
            '<rect width="1600" height="1000" fill="url(#chDayNight)"/>' +
            '<rect width="1600" height="1000" fill="url(#chSunlight)"/>' +
            '<g transform="translate(1420 170)"><circle r="150" fill="url(#chMoonGlow)"/>' +
            '<circle r="48" fill="#f2fff6" mask="url(#chCrescent)"/></g>' +

            // Compass rose
            '<g transform="translate(790 80)" opacity="0.85"><circle r="34" fill="#efe6c4" stroke="#6b4a2a" stroke-width="2"/>' +
            '<path d="M0-30 7 0 0 30-7 0Z" fill="#2c4a3a"/><path d="M-30 0 0 7 30 0 0-7Z" fill="#8a7a50"/>' +
            '<text y="-38" text-anchor="middle" font-family="Cinzel, serif" font-size="14" fill="#efe6c4">N</text></g>' +
            '<rect width="1600" height="1000" fill="url(#chVignette)"/>' +
            '</svg>';

        // Only the small moving bits stay live, in a filter-free overlay with the same framing
        var live =
            '<svg class="ch-map-fx" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">' +
            '<defs>' + glowDefs + '</defs>' +
            ship(780, 420, 18, 0) + ship(760, 620, 22, -8, true) + ship(1000, 920, 26, -4) + ship(180, 40, 20, -12, true) +
            '<g class="ch-map-fog"><ellipse cx="1150" cy="380" rx="220" ry="70" fill="#ffffff" opacity="0.22"/>' +
            '<ellipse cx="1320" cy="640" rx="200" ry="60" fill="#ffffff" opacity="0.18"/>' +
            '<ellipse cx="820" cy="520" rx="160" ry="50" fill="#ffffff" opacity="0.14"/></g>' +
            nightLights() +
            '<g transform="translate(150 120)"><g class="ch-sun-rays">' + sunRays() + '</g>' +
            '<circle r="110" fill="url(#chSun)"/><circle r="46" fill="#fff6c4"/></g>' +
            '</svg>';

        return (
            '<div class="ch-map">' +
            '<img class="ch-map-img" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(still) + '">' +
            live +
            '</div>'
        );
    }

    function sky() {
        var pegasi = [
            { top: 12, dur: 26, delay: -4, size: 120 },
            { top: 30, dur: 34, delay: -19, size: 90 },
            { top: 58, dur: 40, delay: -9, size: 70 }
        ].map(function (f) {
            return '<div class="ch-flyer ch-flyer-pegasus" style="top:' + f.top + '%;--dur:' + f.dur + 's;--delay:' + f.delay + 's;--size:' + f.size + 'px">' + horse('w', 'ch-flyer-art') + '</div>';
        }).join('');
        var witches = [
            { top: 20, dur: 30, delay: -12, size: 90 },
            { top: 44, dur: 38, delay: -27, size: 70 }
        ].map(function (f) {
            return '<div class="ch-flyer ch-flyer-witch" style="top:' + f.top + '%;--dur:' + f.dur + 's;--delay:' + f.delay + 's;--size:' + f.size + 'px">' +
                '<div class="ch-flyer-rider">' + BROOM_SVG + soldier('b', 'b') + '</div></div>';
        }).join('');
        return (
            '<div class="ch-sky" aria-hidden="true">' +
            mapSvg() +
            '<div class="ch-mist ch-mist-1"></div><div class="ch-mist ch-mist-2"></div><div class="ch-mist ch-mist-3"></div>' +
            pegasi + witches +
            '</div>'
        );
    }

    // ---------- war drum ----------

    var audio = null;

    // Deep tom: a sine whose pitch falls quickly, plus a short filtered-noise stick click
    function drum(freq) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio = audio || new Ctx();
        if (audio.state === 'suspended') audio.resume();
        var now = audio.currentTime;

        var osc = audio.createOscillator();
        var body = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 2.2, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.12);
        body.gain.setValueAtTime(0.9, now);
        body.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(body).connect(audio.destination);
        osc.start(now);
        osc.stop(now + 0.55);

        var noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.08), audio.sampleRate);
        var samples = noise.getChannelData(0);
        for (var i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        var click = audio.createBufferSource();
        var band = audio.createBiquadFilter();
        var clickGain = audio.createGain();
        click.buffer = noise;
        band.type = 'bandpass';
        band.frequency.value = 1800;
        clickGain.gain.setValueAtTime(0.35, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        click.connect(band).connect(clickGain).connect(audio.destination);
        click.start(now);
    }

    // ---------- chess battle ----------

    function createBattle(boardEl) {
        var piecesEl = boardEl.querySelector('.ch-pieces');
        var verdictEl = boardEl.querySelector('.ch-verdict');
        var battleEl = boardEl.closest('.ch-battle');
        var logEl = battleEl.querySelector('.ch-log');
        var squaresEl = boardEl.querySelector('.ch-squares');
        var board, pieces, turn, ply, moveNo, timer, visible = true, busy = false;

        var squares = '';
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                squares += '<i class="' + ((r + c) % 2 ? 'ch-dark' : 'ch-light') + '"></i>';
            }
        }
        squaresEl.innerHTML = squares;

        function place(pc) {
            pc.el.style.setProperty('--c', pc.c);
            pc.el.style.setProperty('--r', pc.r);
        }

        function makePiece(side, type, r, c) {
            var el = document.createElement('div');
            el.className = 'ch-piece ch-' + side + ' ch-t-' + type;
            el.title = NAMES[side][type];
            el.style.setProperty('--d', (-rand(0, 6)).toFixed(2) + 's');
            el.style.setProperty('--spin', rand(6, 11).toFixed(2) + 's');
            el.style.setProperty('--dance', DANCES[Math.floor(Math.random() * DANCES.length)]);
            el.innerHTML = '<div class="ch-float"><div class="ch-spin"><div class="ch-act">' + pieceArt(side, type) + '</div></div></div>';
            var pc = { side: side, type: type, r: r, c: c, el: el };
            el.chPiece = pc;
            place(pc);
            piecesEl.appendChild(el);
            return pc;
        }

        function setup() {
            if (hintsEl) deselect();
            piecesEl.innerHTML = '';
            if (hintsEl) {
                piecesEl.appendChild(hintsEl);
                piecesEl.appendChild(targetEl);
            }
            logEl.innerHTML = '';
            verdictEl.className = 'ch-verdict';
            verdictEl.textContent = '';
            board = [];
            pieces = [];
            for (var r = 0; r < 8; r++) {
                board.push([null, null, null, null, null, null, null, null]);
                for (var c = 0; c < 8; c++) {
                    var ch = START[r][c];
                    if (!ch) continue;
                    var side = ch === ch.toUpperCase() ? 'w' : 'b';
                    var pc = makePiece(side, ch.toLowerCase(), r, c);
                    board[r][c] = pc;
                    pieces.push(pc);
                }
            }
            turn = 'w';
            ply = 0;
            moveNo = 1;
            markTurn();
        }

        function markTurn() {
            battleEl.classList.toggle('ch-turn-w', turn === 'w');
            battleEl.classList.toggle('ch-turn-b', turn === 'b');
        }

        function inside(r, c) {
            return r >= 0 && r < 8 && c >= 0 && c < 8;
        }

        var KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
        var KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        var ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        var BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

        // Pseudo-legal moves (no check rules): kings can be captured, which ends the battle
        function movesFor(pc) {
            var out = [];
            function add(r, c) {
                if (!inside(r, c)) return false;
                var t = board[r][c];
                if (t && t.side === pc.side) return false;
                out.push({ pc: pc, r: r, c: c, cap: t });
                return !t;
            }
            function rays(dirs) {
                dirs.forEach(function (d) {
                    for (var i = 1; i < 8 && add(pc.r + d[0] * i, pc.c + d[1] * i); i++) { /* slide */ }
                });
            }
            if (pc.type === 'p') {
                var dir = pc.side === 'w' ? -1 : 1;
                var home = pc.side === 'w' ? 6 : 1;
                if (inside(pc.r + dir, pc.c) && !board[pc.r + dir][pc.c]) {
                    out.push({ pc: pc, r: pc.r + dir, c: pc.c, cap: null });
                    if (pc.r === home && !board[pc.r + 2 * dir][pc.c]) out.push({ pc: pc, r: pc.r + 2 * dir, c: pc.c, cap: null });
                }
                [-1, 1].forEach(function (dc) {
                    var r = pc.r + dir, c = pc.c + dc;
                    if (inside(r, c) && board[r][c] && board[r][c].side !== pc.side) out.push({ pc: pc, r: r, c: c, cap: board[r][c] });
                });
            } else if (pc.type === 'n') {
                KNIGHT.forEach(function (d) { add(pc.r + d[0], pc.c + d[1]); });
            } else if (pc.type === 'k') {
                KING.forEach(function (d) { add(pc.r + d[0], pc.c + d[1]); });
            } else {
                rays(pc.type === 'r' ? ROOK : pc.type === 'b' ? BISHOP : ROOK.concat(BISHOP));
            }
            return out;
        }

        // Squares the enemy could hit next turn (pawns only hit diagonally)
        function attacked(side) {
            var hit = {};
            pieces.forEach(function (pc) {
                if (pc.side === side) return;
                if (pc.type === 'p') {
                    var dir = pc.side === 'w' ? -1 : 1;
                    hit[(pc.r + dir) + ',' + (pc.c - 1)] = true;
                    hit[(pc.r + dir) + ',' + (pc.c + 1)] = true;
                } else {
                    movesFor(pc).forEach(function (m) { hit[m.r + ',' + m.c] = true; });
                }
            });
            return hit;
        }

        // Greedy but lively: grab the most valuable target, avoid hanging pieces, march forward
        function chooseMove() {
            var moves = [];
            pieces.forEach(function (pc) {
                if (pc.side === turn) moves = moves.concat(movesFor(pc));
            });
            if (!moves.length) return null;
            var danger = attacked(turn);
            var best = null, bestScore = -Infinity;
            moves.forEach(function (m) {
                var score = Math.random() * 3;
                if (m.cap) score += VALUE[m.cap.type] * 4;
                if (danger[m.r + ',' + m.c]) score -= VALUE[m.pc.type] * 2.5;
                if (danger[m.pc.r + ',' + m.pc.c]) score += VALUE[m.pc.type] * 1.5;
                if (m.pc.type === 'p') score += 0.8;
                if (m.pc.type === 'k' && !m.cap) score -= 2;
                score += (3.5 - Math.abs(3.5 - m.c)) * 0.15;
                if (score > bestScore) {
                    bestScore = score;
                    best = m;
                }
            });
            return best;
        }

        function notation(m, fromC) {
            var letter = m.pc.type === 'p' ? (m.cap ? FILES[fromC] : '') : m.pc.type.toUpperCase();
            return letter + (m.cap ? 'x' : '') + FILES[m.c] + (8 - m.r);
        }

        function log(text, side) {
            var li;
            if (side === 'w') {
                li = document.createElement('li');
                li.innerHTML = '<span class="ch-log-no">' + moveNo + '.</span> <span class="ch-log-w"></span> <span class="ch-log-b"></span>';
                logEl.appendChild(li);
                while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild);
            } else {
                li = logEl.lastChild;
                if (!li) {
                    li = document.createElement('li');
                    li.innerHTML = '<span class="ch-log-no">' + moveNo + '.</span> <span class="ch-log-w">…</span> <span class="ch-log-b"></span>';
                    logEl.appendChild(li);
                }
            }
            li.querySelector(side === 'w' ? '.ch-log-w' : '.ch-log-b').textContent = text;
        }

        function restart(el, cls) {
            el.classList.remove(cls);
            void el.offsetWidth;
            el.classList.add(cls);
        }

        function clash(r, c, side) {
            var fx = document.createElement('div');
            fx.className = 'ch-clash ch-clash-' + side;
            fx.style.setProperty('--c', c);
            fx.style.setProperty('--r', r);
            fx.innerHTML = '<span>⚔</span>';
            piecesEl.appendChild(fx);
            fx.addEventListener('animationend', function () { fx.remove(); });
        }

        function promote(pc) {
            pc.type = 'q';
            pc.el.className = pc.el.className.replace('ch-t-p', 'ch-t-q');
            pc.el.title = NAMES[pc.side].q;
            pc.el.querySelector('.ch-act').innerHTML = pieceArt(pc.side, 'q');
        }

        function verdict(winner) {
            verdictEl.className = 'ch-verdict ch-show ch-win-' + (winner || 'none');
            verdictEl.innerHTML = winner === 'w'
                ? '<b>☀ Light prevails</b><small>the gods hold Olympus</small>'
                : winner === 'b'
                    ? '<b>☾ Night prevails</b><small>Dracula rules the board</small>'
                    : '<b>⚖ Truce</b><small>both legions retreat to regroup</small>';
            busy = true;
            setTimeout(function () {
                busy = false;
                setup();
            }, VERDICT_MS);
        }

        function step() {
            if (busy || drag || selected || battleEl.classList.contains('ch-dancing')) return;
            var m = chooseMove();
            if (!m || ply >= MAX_PLIES) {
                verdict(m ? null : (turn === 'w' ? 'b' : 'w'));
                return;
            }
            execute(m, false);
        }

        // Plays a move for either the computer or a piece the visitor dragged; `dropped` skips the long slide
        function execute(m, dropped) {
            var pc = m.pc;
            var fromC = pc.c;
            var el = pc.el;
            var leap = pc.type === 'n' && !dropped;
            var hitDelay = dropped ? 120 : SLIDE_MS * 0.6;

            // A dragged piece may move out of turn; mark the skipped half-move so numbering stays right
            if (pc.side !== turn) {
                if (pc.side === 'w') {
                    log('…', 'b');
                    moveNo++;
                } else {
                    log('…', 'w');
                }
            }
            log(notation(m, fromC), pc.side);
            el.classList.remove('ch-ride');
            el.classList.add('ch-moving');
            restart(el, leap ? 'ch-leap' : 'ch-attack');
            board[pc.r][pc.c] = null;
            pc.r = m.r;
            pc.c = m.c;
            place(pc);

            if (m.cap) {
                var victim = m.cap;
                board[m.r][m.c] = null;
                pieces.splice(pieces.indexOf(victim), 1);
                setTimeout(function () {
                    clash(m.r, m.c, pc.side);
                    restart(victim.el, 'ch-hit');
                    setTimeout(function () {
                        victim.el.classList.add('ch-fall');
                        setTimeout(function () { victim.el.remove(); }, 900);
                    }, 350);
                }, hitDelay);
            }
            board[m.r][m.c] = pc;

            setTimeout(function () {
                el.classList.remove('ch-moving', 'ch-attack', 'ch-leap');
                if (pc.type === 'p' && (pc.r === 0 || pc.r === 7)) promote(pc);
            }, SLIDE_MS + 120);

            if (m.cap && m.cap.type === 'k') {
                setTimeout(function () { verdict(pc.side); }, SLIDE_MS + 500);
                return;
            }
            ply++;
            if (pc.side === 'b') moveNo++;
            turn = pc.side === 'w' ? 'b' : 'w';
            markTurn();
        }

        // ---------- visitor moves: tap / click a piece to see its legal moves, then tap a square or drag ----------

        var SELECT_TIMEOUT_MS = 10000;
        var taps = [];
        var danceTimer = null;
        var frameEl = boardEl.parentNode;

        // Lower ranks boom deeper; a quick flurry of beats sets the whole board dancing
        piecesEl.addEventListener('pointerdown', function (e) {
            var sq = squareAt(e.clientX, e.clientY);
            drum(55 + (sq ? 7 - sq.r : 4) * 9);
            restart(frameEl, 'ch-thump');
            var now = performance.now();
            taps = taps.filter(function (t) { return now - t < DANCE_WINDOW_MS; });
            taps.push(now);
            if (taps.length < DANCE_TAPS) return;
            battleEl.classList.add('ch-dancing');
            clearTimeout(danceTimer);
            danceTimer = setTimeout(function () { battleEl.classList.remove('ch-dancing'); }, DANCE_HOLD_MS);
        });

        var drag = null;
        var selected = null;
        var selectTimer = null;
        var hintsEl = document.createElement('div');
        hintsEl.className = 'ch-hints';
        var targetEl = document.createElement('div');
        targetEl.className = 'ch-target';
        piecesEl.appendChild(hintsEl);
        piecesEl.appendChild(targetEl);

        function squareAt(clientX, clientY) {
            var rect = boardEl.getBoundingClientRect();
            var c = Math.floor(((clientX - rect.left) / rect.width) * 8);
            var r = Math.floor(((clientY - rect.top) / rect.height) * 8);
            return inside(r, c) ? { r: r, c: c } : null;
        }

        function legalMove(sq) {
            if (!selected || !sq) return null;
            for (var i = 0; i < selected.moves.length; i++) {
                var m = selected.moves[i];
                if (m.r === sq.r && m.c === sq.c) return m;
            }
            return null;
        }

        // Pawns get a dot ahead and a red ring on each diagonal enemy, rooks a line of dots along files/ranks, etc.
        function select(pc) {
            var moves = movesFor(pc);
            selected = { pc: pc, moves: moves };
            hintsEl.innerHTML =
                '<i class="ch-hint-from" style="--c:' + pc.c + ';--r:' + pc.r + '"></i>' +
                moves.map(function (m) {
                    return '<i class="' + (m.cap ? 'ch-hint-cap' : 'ch-hint') + '" style="--c:' + m.c + ';--r:' + m.r + '"></i>';
                }).join('');
            pc.el.classList.add('ch-selected');
            clearTimeout(selectTimer);
            selectTimer = setTimeout(deselect, SELECT_TIMEOUT_MS);
        }

        function deselect() {
            clearTimeout(selectTimer);
            if (selected) selected.pc.el.classList.remove('ch-selected');
            selected = null;
            hintsEl.innerHTML = '';
        }

        function play(m) {
            deselect();
            execute(m, true);
            // Give the visitor's move a moment on stage before the next computer move
            clearTimeout(timer);
            timer = setTimeout(loop, MOVE_MS);
        }

        function showTarget(sq) {
            var m = legalMove(sq);
            if (!m) {
                targetEl.className = 'ch-target';
                return;
            }
            targetEl.style.setProperty('--c', m.c);
            targetEl.style.setProperty('--r', m.r);
            targetEl.className = 'ch-target ch-show' + (m.cap ? ' ch-enemy' : '');
        }

        function follow(clientX, clientY) {
            var rect = boardEl.getBoundingClientRect();
            var size = rect.width / 8;
            drag.moved = drag.moved || Math.abs(clientX - drag.x) + Math.abs(clientY - drag.y) > 6;
            if (!drag.moved) return;
            drag.pc.el.classList.add('ch-drag');
            drag.pc.el.style.left = (clientX - rect.left - size / 2) + 'px';
            drag.pc.el.style.top = (clientY - rect.top - size * 0.7) + 'px';
            showTarget(squareAt(clientX, clientY));
        }

        piecesEl.addEventListener('pointerdown', function (e) {
            if (busy || drag) return;
            // With a piece selected, tapping one of its highlighted squares (empty or enemy) plays the move
            var m = legalMove(squareAt(e.clientX, e.clientY));
            if (m) {
                e.preventDefault();
                play(m);
                return;
            }
            var el = e.target.closest('.ch-piece');
            var pc = el && el.chPiece;
            if (!pc || pieces.indexOf(pc) < 0 || el.classList.contains('ch-moving') || el.classList.contains('ch-fall')) {
                deselect();
                return;
            }
            e.preventDefault();
            deselect();
            select(pc);
            drag = { pc: pc, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
            el.classList.remove('ch-ride');
            try {
                el.setPointerCapture(e.pointerId);
            } catch (_) {
                /* pointer already gone — moves still bubble to the board */
            }
        });

        piecesEl.addEventListener('pointermove', function (e) {
            if (drag && e.pointerId === drag.id) follow(e.clientX, e.clientY);
        });

        function endDrag(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var pc = drag.pc;
            var moved = drag.moved;
            var sq = e.type === 'pointerup' ? squareAt(e.clientX, e.clientY) : null;
            drag = null;
            targetEl.className = 'ch-target';
            pc.el.classList.remove('ch-drag');
            // Inline left/top go away, so the CSS transition glides the piece back or into its new square
            pc.el.style.left = '';
            pc.el.style.top = '';
            if (!moved || busy) return;
            var m = legalMove(sq);
            if (m) play(m);
        }

        piecesEl.addEventListener('pointerup', endDrag);
        piecesEl.addEventListener('pointercancel', endDrag);

        // Idle light pieces now and then call down a pegasus and take a short flight
        function summonPegasus() {
            if (busy || document.hidden || !visible) return;
            var idle = pieces.filter(function (pc) {
                return pc.side === 'w' && 'nbr'.indexOf(pc.type) < 0 && !pc.el.classList.contains('ch-moving') && !pc.el.classList.contains('ch-ride');
            });
            if (!idle.length) return;
            var pc = idle[Math.floor(Math.random() * idle.length)];
            pc.el.classList.add('ch-ride');
            setTimeout(function () { pc.el.classList.remove('ch-ride'); }, 3400);
        }

        function loop() {
            if (!document.hidden && visible) step();
            timer = setTimeout(loop, MOVE_MS);
        }

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
            }).observe(boardEl);
        }

        setup();
        timer = setTimeout(loop, 900);
        setInterval(summonPegasus, RIDE_EVERY_MS);
    }

    // ---------- render ----------

    function render(data, root) {
        root.innerHTML = '<div class="ch-root">' + sky() + renderContent(data) + '</div>';

        createBattle(root.querySelector('.ch-board'));

        // Full name appears while the pointer is within NAME_NEAR_PX of the heading; touch: tap for the name,
        // tap again to unblur the surname
        var NAME_NEAR_PX = 140;
        var nameEl = root.querySelector('.ch-name');
        var nameTimer = null;
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch') return;
            var r = nameEl.getBoundingClientRect();
            var dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
            var dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
            nameEl.classList.toggle('ch-near', Math.sqrt(dx * dx + dy * dy) < NAME_NEAR_PX);
        }, { passive: true });
        nameEl.addEventListener('click', function () {
            if (!TOUCH) return;
            if (nameEl.classList.contains('ch-near')) nameEl.classList.add('ch-revealed');
            nameEl.classList.add('ch-near');
            clearTimeout(nameTimer);
            nameTimer = setTimeout(function () { nameEl.classList.remove('ch-near', 'ch-revealed'); }, 8000);
        });

        // Campaign squares flip on tap for touch screens (hover / focus handles the rest)
        root.querySelectorAll('.ch-exp').forEach(function (el) {
            el.addEventListener('click', function () {
                if (TOUCH) el.classList.toggle('ch-flipped');
            });
        });

        // On touch screens the first tap unblurs the email / phone, a second tap opens it
        root.querySelectorAll('.ch-secret').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (!TOUCH || el.classList.contains('ch-revealed')) return;
                e.preventDefault();
                el.classList.add('ch-revealed');
                setTimeout(function () { el.classList.remove('ch-revealed'); }, 8000);
            });
        });

        var reveals = root.querySelectorAll('.ch-reveal');
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('ch-in');
                    observer.unobserve(entry.target);
                });
            }, { threshold: 0.1 });
            reveals.forEach(function (el) { observer.observe(el); });
        } else {
            reveals.forEach(function (el) { el.classList.add('ch-in'); });
        }
    }

    window.ProfileTemplates = window.ProfileTemplates || {};
    window.ProfileTemplates['chess-halloween'] = { render: render };
})();
