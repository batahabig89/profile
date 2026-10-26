/* Halloween template — renders profile-data.json with a playable spider web,
   flying bats, a haunted-house graveyard scene and a dancing zombie / pumpkin / dracula crew. */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Web geometry (in SVG units; a round web hanging in the top-right corner)
    var WEB_SIZE = 360;
    var WEB_CENTER = WEB_SIZE / 2;
    var RING_START = 24;
    var RING_GAP = 20;
    var RADIAL_COUNT = 23;
    var WEB_RADIUS = 172;
    var SPIDER_FOLLOW_RANGE = WEB_RADIUS + 80;
    var SPIDER_SPEED = 1.2;
    var SPIDER_LAG = 0.03;
    var STRAND_COOLDOWN_MS = 110;
    var DANCE_STEP_MS = 700;
    var DANCE_HOLD_MS = 2600;
    // Notes within this window decide the mood: fewer than DANCE_RATE → a single hop, otherwise a full party
    var RATE_WINDOW_MS = 1000;
    var DANCE_RATE = 3;

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

    // Skull drawn in a 64×64 box; reused by the poison labels, jar watermarks and the skeleton
    var SKULL_PARTS =
        '<path class="hw-bone" d="M32 6C18 6 9 16 9 29c0 8 4 13 9 16v7c0 3 2 5 5 5h18c3 0 5-2 5-5v-7c5-3 9-8 9-16C55 16 46 6 32 6z"/>' +
        '<ellipse class="hw-socket" cx="22.5" cy="31" rx="6.5" ry="7.5"/><ellipse class="hw-socket" cx="41.5" cy="31" rx="6.5" ry="7.5"/>' +
        '<circle class="hw-eye-glow" cx="22.5" cy="32" r="2.4"/><circle class="hw-eye-glow" cx="41.5" cy="32" r="2.4"/>' +
        '<path class="hw-socket" d="M32 39l-4 7h8z"/>' +
        '<path class="hw-teeth" d="M26 50v7M30.7 50v7M35.3 50v7M40 50v7"/>';

    var SKULL_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true">' + SKULL_PARTS + '</svg>';

    var POISON_SVG =
        '<svg viewBox="0 0 64 64" aria-hidden="true">' +
        '<path class="hw-crossbones" d="M10 12L54 56M54 12L10 56"/>' +
        '<circle class="hw-bone" cx="8" cy="10" r="5"/><circle class="hw-bone" cx="56" cy="10" r="5"/>' +
        '<circle class="hw-bone" cx="8" cy="58" r="5"/><circle class="hw-bone" cx="56" cy="58" r="5"/>' +
        '<g transform="translate(13 6) scale(0.6)">' + SKULL_PARTS + '</g>' +
        '</svg>';

    // Skeleton sitting on the potion shelf, legs dangling, one arm waving
    var SKELETON_SVG =
        '<svg viewBox="0 0 120 210" aria-hidden="true">' +
        '<g class="hw-skel-bones">' +
        '<path d="M60 44V122"/>' +
        '<path d="M60 64C46 62 40 70 43 80M60 64C74 62 80 70 77 80M60 76C48 75 44 81 46 89M60 76C72 75 76 81 74 89M60 88C51 88 49 92 50 98M60 88C69 88 71 92 70 98"/>' +
        '<path d="M38 58Q60 52 82 58"/>' +
        '<path d="M38 58L28 92L40 124"/>' +
        '<g class="hw-skel-leg hw-skel-leg-l"><path d="M50 124L40 166L46 202h-10"/></g>' +
        '<g class="hw-skel-leg hw-skel-leg-r"><path d="M70 124L80 166L74 202h10"/></g>' +
        '<g class="hw-skel-arm"><path d="M82 58L102 36L106 10M106 10l-5-7M106 10l0-8M106 10l5-6"/></g>' +
        '</g>' +
        '<path class="hw-bone" d="M44 118Q60 136 76 118Q68 112 60 116Q52 112 44 118z"/>' +
        '<g transform="translate(36 0) scale(0.75)"><g class="hw-skel-head">' + SKULL_PARTS + '</g></g>' +
        '</svg>';

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
        '<path d="M96 40 C94 24 100 12 112 6 L118 14 C108 18 104 28 106 40 Z" fill="#1a1030"/>' +
        '<path d="M106 22 C122 14 136 20 140 30 C128 26 118 28 110 32 Z" fill="#241640"/>' +
        '<ellipse cx="62" cy="112" rx="52" ry="68" fill="#1c1130"/>' +
        '<ellipse cx="138" cy="112" rx="52" ry="68" fill="#1c1130"/>' +
        '<ellipse cx="80" cy="112" rx="42" ry="72" fill="#241640"/>' +
        '<ellipse cx="120" cy="112" rx="42" ry="72" fill="#241640"/>' +
        '<ellipse cx="100" cy="112" rx="34" ry="74" fill="#2c1b4d"/>' +
        '<g class="hw-pumpkin-face" fill="url(#hwPumpkinGlow)">' +
        '<path d="M52 92 L80 84 L72 112 Z"/>' +
        '<path d="M148 92 L120 84 L128 112 Z"/>' +
        '<path d="M100 108 L90 124 L110 124 Z"/>' +
        '<path d="M44 132 C70 168 130 168 156 132 L144 136 L136 128 L126 140 L114 130 L100 142 L86 130 L74 140 L64 128 L56 136 Z"/>' +
        '</g>' +
        '</svg>';

    // Graveyard gang: four zombie characters drawn on the same 220×300 canvas with arms reaching
    // to the left (CSS mirrors them so they face into the page). Arms sit in .hw-zombie-arms.
    // Invisible pin marking where a marionette string attaches (strings are drawn by stepPuppets)
    function pin(name, x, y) {
        return '<circle class="hw-pin" data-pin="' + name + '" cx="' + x + '" cy="' + y + '" r="0.5"/>';
    }

    // Puppeteer's shadowy hand holding a T-shaped wooden controller; local origin = centre of the main bar
    var CONTROLLER_SVG =
        '<rect class="hw-ctrl-wood" x="-46" y="0" width="92" height="8" rx="4"/>' +
        '<rect class="hw-ctrl-wood" x="-4" y="4" width="8" height="30" rx="3"/>' +
        '<rect class="hw-ctrl-wood" x="-28" y="30" width="56" height="7" rx="3.5"/>' +
        '<g class="hw-ctrl-hand">' +
        '<ellipse cx="2" cy="-10" rx="15" ry="11"/>' +
        '<path d="M-13 -12 C-22 -6 -20 2 -14 4 L-9 -4 Z"/>' +
        '<rect x="-11" y="-6" width="6" height="16" rx="3"/><rect x="-4" y="-6" width="6" height="17" rx="3"/>' +
        '<rect x="3" y="-6" width="6" height="17" rx="3"/><rect x="10" y="-6" width="6" height="14" rx="3"/>' +
        '</g>';
    var CONTROLLER_ENDS = { hands: [[-42, 4], [42, 4]], knees: [[-24, 34], [24, 34]], head: [0, 34] };

    function zombieArms(sleeve, sleeveShade, skin, skinShade, extra) {
        return (
            '<g class="hw-zombie-arms">' +
            '<g class="hw-arm hw-arm-a">' +
            '<path d="M82 126 L24 132 L24 148 L84 146 Z" fill="' + sleeve + '"/>' +
            '<path d="M24 132 L6 130 L2 136 L8 140 L2 144 L8 148 L24 148 Z" fill="' + skin + '"/>' +
            pin('handA', 8, 134) +
            '</g>' +
            '<g class="hw-arm hw-arm-b">' +
            '<path d="M86 150 L30 162 L32 176 L88 168 Z" fill="' + sleeveShade + '"/>' +
            '<path d="M30 162 L12 162 L8 168 L14 172 L8 176 L14 180 L32 176 Z" fill="' + skinShade + '"/>' +
            (extra || '') +
            pin('handB', 14, 166) +
            '</g>' +
            '</g>'
        );
    }

    function zombieLegs(left, right, kneeL, kneeR) {
        return (
            '<g class="hw-leg hw-leg-l">' + left + pin('kneeL', kneeL[0], kneeL[1]) + '</g>' +
            '<g class="hw-leg hw-leg-r">' + right + pin('kneeR', kneeR[0], kneeR[1]) + '</g>'
        );
    }

    var ZOMBIES = [
        // Classic green zombie
        '<svg viewBox="0 0 220 300" aria-hidden="true">' +
        zombieLegs(
            '<path d="M86 196 L80 280 L104 280 L108 214 Z" fill="#2f3d6b"/>' +
            '<path d="M80 270 L104 270 L104 282 L82 286 Z" fill="#7bb04a"/><path d="M72 282 L106 282 L106 292 L68 292 Z" fill="#3b2a1e"/>',
            '<path d="M120 196 L126 280 L150 280 L138 204 Z" fill="#2a365f"/>' +
            '<path d="M126 272 L150 272 L156 288 L126 284 Z" fill="#7bb04a"/><path d="M124 284 L160 284 L162 294 L124 294 Z" fill="#3b2a1e"/>',
            [92, 240], [134, 240]) +
        '<path d="M78 116 L146 116 L150 204 L138 196 L128 208 L116 196 L104 208 L94 196 L80 206 Z" fill="#5b7f8a"/>' +
        '<path d="M100 116 L112 140 L124 116 Z" fill="#8ec25a"/>' +
        '<path d="M86 150 L96 160 M132 170 L122 178" stroke="#3c5560" stroke-width="3"/>' +
        zombieArms('#5b7f8a', '#4f727c', '#8ec25a', '#7bb04a') +
        '<rect x="74" y="34" width="76" height="84" rx="22" fill="#8ec25a"/>' +
        '<path d="M70 50 L78 22 L88 38 L96 16 L106 34 L118 14 L124 34 L138 18 L140 38 L154 30 L150 54 L74 54 Z" fill="#2b2b2b"/>' +
        '<circle cx="96" cy="74" r="12" fill="#f4f1d0"/><circle cx="92" cy="76" r="4.5" fill="#c1121f"/>' +
        '<ellipse cx="128" cy="78" rx="8" ry="6" fill="#f4f1d0"/><circle cx="126" cy="80" r="3" fill="#2b2b2b"/>' +
        '<path d="M118 66 L138 70" stroke="#2b2b2b" stroke-width="3"/>' +
        '<path d="M88 100 C100 108 118 108 134 98" stroke="#2b2b2b" stroke-width="3" fill="none"/>' +
        '<path d="M96 98 L94 106 M106 101 L105 109 M116 101 L117 109 M126 99 L128 106" stroke="#2b2b2b" stroke-width="2"/>' +
        '<path d="M140 50 L146 84 M136 58 L146 56 M138 68 L148 66 M140 78 L150 76" stroke="#3a5a24" stroke-width="2"/>' +
        pin('head', 112, 18) +
        '</svg>',

        // Zombie bride: torn wedding dress, wild red hair, veil
        '<svg viewBox="0 0 220 300" aria-hidden="true">' +
        '<path d="M100 30 C132 20 170 44 186 120 C190 162 180 204 194 246 L162 214 C150 152 146 92 128 40 Z" fill="rgba(255,255,255,0.45)"/>' +
        '<path d="M72 60 C60 100 66 150 56 192 L74 178 L80 202 L94 150 L98 54 Z M150 56 C166 100 160 150 172 188 L154 178 L148 198 L136 150 Z" fill="#b8312f"/>' +
        zombieLegs('<path d="M96 262 L94 290 L106 290 L106 262 Z" fill="#b6a6c8"/>',
            '<path d="M122 262 L122 290 L134 290 L132 262 Z" fill="#b6a6c8"/>', [100, 262], [128, 262]) +
        '<path d="M84 116 L140 116 L170 282 L156 272 L146 286 L132 274 L118 288 L104 274 L90 286 L78 272 L62 282 Z" fill="#ece6f2"/>' +
        '<path d="M84 116 L140 116 L136 150 L88 150 Z" fill="#ddd4e8"/>' +
        '<path d="M96 210 C102 220 96 232 104 240 M138 232 C132 244 140 254 134 262" stroke="#9b1020" stroke-width="4" fill="none" opacity="0.7"/>' +
        zombieArms('#ece6f2', '#ddd4e8', '#b6a6c8', '#a796ba') +
        '<rect x="78" y="38" width="68" height="78" rx="26" fill="#b6a6c8"/>' +
        '<path d="M74 64 C76 30 100 22 116 24 C138 26 152 38 152 66 C140 50 126 44 112 46 C100 50 88 54 74 64 Z" fill="#b8312f"/>' +
        '<circle cx="92" cy="30" r="5" fill="#ff5d8f"/><circle cx="106" cy="24" r="5" fill="#fff"/><circle cx="120" cy="24" r="5" fill="#ff5d8f"/><circle cx="134" cy="30" r="5" fill="#fff"/>' +
        '<circle cx="98" cy="78" r="9" fill="#2a1f35"/><circle cx="98" cy="78" r="3" fill="#ffe066"/>' +
        '<circle cx="126" cy="78" r="9" fill="#2a1f35"/><circle cx="127" cy="79" r="3" fill="#ffe066"/>' +
        '<path d="M98 102 C106 108 118 108 128 100" stroke="#7a0b18" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<path d="M86 92 L92 96 M134 90 L140 86" stroke="#8a6fa8" stroke-width="2"/>' +
        pin('head', 112, 22) +
        '</svg>',

        // Office zombie: shirt and tie, cracked glasses, briefcase
        '<svg viewBox="0 0 220 300" aria-hidden="true">' +
        zombieLegs(
            '<path d="M86 200 L82 282 L104 282 L108 214 Z" fill="#2d2d38"/><path d="M76 282 L106 282 L106 292 L72 292 Z" fill="#111"/>',
            '<path d="M120 200 L124 282 L146 282 L140 204 Z" fill="#2d2d38"/><path d="M122 282 L152 282 L156 292 L122 292 Z" fill="#111"/>',
            [94, 242], [132, 242]) +
        '<path d="M78 116 L146 116 L150 206 L140 198 L130 210 L118 200 L104 210 L92 200 L80 208 Z" fill="#f0eee6"/>' +
        '<path d="M100 116 L112 128 L124 116 L118 134 L112 128 L106 134 Z" fill="#d8d5c8"/>' +
        '<path d="M108 128 L116 128 L120 172 L112 184 L104 172 Z" fill="#c1121f"/>' +
        '<path d="M90 160 C96 166 92 176 98 182" stroke="#9b6b3a" stroke-width="3" fill="none" opacity="0.6"/>' +
        zombieArms('#f0eee6', '#e2dfd2', '#9fb7c7', '#8ea6b7',
            '<path d="M18 180 L18 188" stroke="#3a2416" stroke-width="3"/>' +
            '<rect x="2" y="188" width="34" height="26" rx="3" fill="#6b4226"/><rect x="2" y="196" width="34" height="3" fill="#4a2c18"/>') +
        '<rect x="74" y="34" width="76" height="84" rx="20" fill="#9fb7c7"/>' +
        '<path d="M72 60 C72 30 98 22 118 24 C142 26 154 40 152 60 L136 46 C120 52 96 50 72 60 Z" fill="#3a2a1e"/>' +
        '<rect x="82" y="66" width="26" height="20" rx="4" fill="rgba(255,255,255,0.18)" stroke="#1d1d24" stroke-width="3"/>' +
        '<rect x="116" y="66" width="26" height="20" rx="4" fill="rgba(255,255,255,0.18)" stroke="#1d1d24" stroke-width="3"/>' +
        '<path d="M108 74 H116 M74 72 H82 M142 72 H150" stroke="#1d1d24" stroke-width="3"/>' +
        '<path d="M86 68 L96 78 L92 84 M96 78 L104 76" stroke="#fff" stroke-width="1.5" fill="none"/>' +
        '<circle cx="96" cy="77" r="3" fill="#c1121f"/><circle cx="129" cy="77" r="3" fill="#c1121f"/>' +
        '<ellipse cx="112" cy="104" rx="10" ry="7" fill="#3a0d14"/>' +
        '<path d="M106 100 L108 104 L110 100 M114 100 L116 104 L118 100" fill="#f4f1d0"/>' +
        pin('head', 112, 22) +
        '</svg>',

        // Kid zombie: backwards cap, stitched teddy bear
        '<svg viewBox="0 0 220 300" aria-hidden="true">' +
        zombieLegs(
            '<path d="M92 230 L92 280 L104 280 L104 230 Z" fill="#a6c96a"/><path d="M86 278 L106 278 L108 292 L82 292 Z" fill="#e63946"/>',
            '<path d="M120 230 L120 280 L132 280 L132 230 Z" fill="#a6c96a"/><path d="M118 278 L138 278 L142 292 L116 292 Z" fill="#e63946"/>',
            [98, 256], [126, 256]) +
        '<path d="M88 196 L136 196 L140 238 L114 238 L112 218 L110 238 L84 238 Z" fill="#3b5ba5"/>' +
        '<path d="M80 120 L144 120 L146 200 L78 200 Z" fill="#ff8a3d"/>' +
        '<circle cx="112" cy="156" r="12" fill="#fff3e6"/><circle cx="108" cy="154" r="3" fill="#ff8a3d"/><circle cx="116" cy="154" r="3" fill="#ff8a3d"/>' +
        zombieArms('#ff8a3d', '#e9762c', '#a6c96a', '#95b85b',
            '<g transform="translate(16 196)">' +
            '<circle cx="0" cy="0" r="12" fill="#8b5a2b"/><circle cx="-9" cy="-10" r="5" fill="#8b5a2b"/><circle cx="9" cy="-10" r="5" fill="#8b5a2b"/>' +
            '<ellipse cx="0" cy="20" rx="11" ry="13" fill="#8b5a2b"/>' +
            '<circle cx="-4" cy="-2" r="1.8" fill="#111"/><path d="M3 -4 L7 0 M7 -4 L3 0" stroke="#111" stroke-width="1.5"/>' +
            '<path d="M-6 14 H6 M-4 11 V17 M0 11 V17 M4 11 V17" stroke="#3a2416" stroke-width="1.2"/></g>') +
        '<rect x="72" y="30" width="80" height="90" rx="32" fill="#a6c96a"/>' +
        '<path d="M70 58 C70 20 154 20 154 58 Z" fill="#2f6fd6"/>' +
        '<path d="M152 50 L182 56 L180 66 L150 62 Z" fill="#2457b0"/>' +
        '<circle cx="112" cy="26" r="5" fill="#2457b0"/>' +
        '<circle cx="96" cy="80" r="13" fill="#fff"/><circle cx="99" cy="82" r="4" fill="#111"/>' +
        '<circle cx="130" cy="82" r="9" fill="#fff"/><circle cx="128" cy="84" r="3" fill="#111"/>' +
        '<path d="M96 104 C106 112 120 112 130 104" stroke="#2b2b2b" stroke-width="3" fill="none"/>' +
        '<rect x="108" y="106" width="7" height="7" fill="#fff"/>' +
        '<path d="M80 98 L88 94 M82 92 L86 100" stroke="#5f7d3a" stroke-width="2"/>' +
        pin('head', 112, 18) +
        '</svg>'
    ];

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

    // Background scene: crooked haunted house, bare tree with a hanging lantern, graveyard
    var HOUSE_SVG =
        '<svg class="hw-house" viewBox="0 -40 300 460" preserveAspectRatio="xMinYMax meet" aria-hidden="true">' +
        '<g class="hw-house-body">' +
        '<path d="M34 300 L40 214 L58 216 L54 300 Z"/><path d="M34 214 L62 210 L60 222 L36 224 Z"/>' +
        '<path d="M44 410 L54 268 L244 258 L256 412 Z"/>' +
        '<path d="M16 290 C30 286 40 280 52 270 L132 196 L250 258 C262 264 272 266 282 264 C270 276 254 276 240 270 L56 280 C44 290 30 294 16 290 Z"/>' +
        '<path d="M74 268 L80 152 L212 140 L222 262 Z"/>' +
        '<path d="M50 168 C60 166 70 160 80 150 L148 86 L226 140 C236 146 246 148 254 146 C244 158 230 158 218 152 L82 162 C72 170 60 172 50 168 Z"/>' +
        '<path d="M106 150 L112 56 L190 50 L194 146 Z"/>' +
        '<path d="M90 70 C100 68 108 62 114 54 L156 -6 L196 48 C204 54 212 56 220 54 C212 64 200 64 190 58 L116 64 C108 72 98 74 90 70 Z"/>' +
        '<path d="M212 150 L222 40 L240 42 L232 152 Z"/><path d="M212 46 L242 -34 L248 48 Z"/>' +
        '<path d="M22 410 L28 330 L50 332 L46 410 Z"/><path d="M16 338 L36 284 L58 340 Z"/>' +
        '</g>' +
        '<g class="hw-house-windows">' +
        '<path d="M88 400 V330 A18 18 0 0 1 124 330 V400 Z"/>' +
        '<path d="M160 400 V320 A20 20 0 0 1 200 320 V400 Z"/>' +
        '<rect x="118" y="186" width="44" height="40" rx="4"/>' +
        '<circle cx="196" cy="204" r="12"/>' +
        '<path d="M136 128 V96 A14 14 0 0 1 164 96 V128 Z"/>' +
        '<circle cx="228" cy="96" r="6"/>' +
        '<rect x="31" y="358" width="10" height="22" rx="5"/>' +
        '</g>' +
        '<path class="hw-house-mullions" d="M106 324 V400 M88 362 H124 M180 312 V400 M160 356 H200 M140 186 V226 M118 206 H162 M150 90 V128 M136 110 H164 M184 204 H208 M196 192 V216"/>' +
        '</svg>';

    var TREE_SVG =
        '<svg class="hw-tree" viewBox="0 0 300 800" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">' +
        '<g class="hw-tree-limbs">' +
        '<path d="M262 800 C252 680 272 590 236 500 C206 420 220 330 206 250" stroke-width="18"/>' +
        '<path d="M206 250 C196 180 204 110 236 20" stroke-width="10"/>' +
        '<path d="M236 500 C190 478 150 486 96 452 C80 442 60 444 34 430" stroke-width="7"/>' +
        '<path d="M120 466 L104 432 M70 446 L56 466 M150 478 L146 506" stroke-width="3"/>' +
        '<path d="M214 360 C170 344 130 344 84 312 C70 302 52 300 36 288" stroke-width="6"/>' +
        '<path d="M108 330 L96 296 M60 300 L44 318 M140 344 L150 372" stroke-width="3"/>' +
        '<path d="M206 250 C176 232 156 204 118 192 C100 186 86 176 76 160" stroke-width="5"/>' +
        '<path d="M130 196 L126 168 M96 182 L80 194" stroke-width="2.5"/>' +
        '<path d="M216 140 C196 120 178 94 152 82 C140 76 130 66 124 52" stroke-width="4"/>' +
        '<path d="M166 88 L170 62 M228 80 L254 54 M224 60 L210 36" stroke-width="2.5"/>' +
        '<path d="M248 610 C220 600 196 610 168 596" stroke-width="5"/>' +
        '</g>' +
        '<g class="hw-hang">' +
        '<path class="hw-hang-rope" d="M96 452 V522"/>' +
        '<g transform="translate(96 552)">' +
        '<path d="M-3 -27 L-1 -36 L4 -36 L3 -27 Z" fill="#1a1030"/>' +
        '<ellipse cx="-14" cy="0" rx="20" ry="26" fill="#1c1130"/><ellipse cx="14" cy="0" rx="20" ry="26" fill="#1c1130"/>' +
        '<ellipse cx="0" cy="0" rx="16" ry="28" fill="#2c1b4d"/>' +
        '<g class="hw-pumpkin-face" fill="#ffb02e">' +
        '<path d="M-20 -8 L-6 -4 L-12 6 Z"/><path d="M20 -8 L6 -4 L12 6 Z"/>' +
        '<path d="M-20 10 C-10 22 10 22 20 10 L14 12 L10 8 L5 14 L0 9 L-5 14 L-10 8 L-14 12 Z"/>' +
        '</g></g></g>' +
        '</svg>';

    var HAND_PATH = '<path class="hw-hand" d="M-7 0 L-6 -32 L-12 -40 L-15 -52 L-11 -53 L-8 -44 L-7 -58 L-3 -58 L-2 -46 L0 -62 L4 -62 L4 -46 L7 -58 L11 -57 L8 -42 L12 -48 L15 -46 L9 -32 L7 0 Z"/>';

    var GRAVEYARD_SVG =
        '<svg class="hw-ground" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
        '<g class="hw-ground-stones">' +
        '<path d="M300 176 V150 A16 16 0 0 1 332 150 V176 Z" transform="rotate(6 316 176)"/>' +
        '<path d="M600 160 V128 A22 22 0 0 1 644 128 V160 Z" transform="rotate(-8 622 160)"/>' +
        '<path d="M760 160 L762 128 L776 120 L784 132 L796 126 L798 160 Z"/>' +
        '</g>' +
        '<path class="hw-ground-cross" d="M396 176 V100 M376 118 H416 M520 166 V94 M500 114 H540 M980 176 V120 M966 134 H994"/>' +
        '<circle class="hw-ground-cross" cx="520" cy="114" r="15" fill="none"/>' +
        [[450, 172, ''], [566, 164, ' scale(-1 1)'], [700, 158, ''], [868, 170, ' scale(-1 1)'], [240, 178, '']].map(function (h, i) {
            return '<g transform="translate(' + h[0] + ' ' + h[1] + ')' + h[2] + '" style="--i:' + i + '">' + HAND_PATH + '</g>';
        }).join('') +
        '<path class="hw-ground-fill" d="M0 220 L0 172 C120 152 220 178 340 170 C460 162 560 142 700 152 C820 160 940 180 1060 170 C1120 165 1170 162 1200 164 L1200 220 Z"/>' +
        '</svg>';

    // Dark wavy border around the whole scene
    var FRAME_SVG =
        '<svg class="hw-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<path fill-rule="evenodd" d="M-1 -1 H101 V101 H-1 Z M4 9 C10 4 18 6 26 4 C38 2 48 6 60 4 C72 2 84 5 93 6 C97 14 95 26 96 38 C98 52 95 64 96 76 C97 84 95 90 93 93 C80 95 66 93 52 95 C38 96 22 93 8 94 C4 86 5 74 3 62 C2 48 5 36 3 24 C2 16 3 12 4 9 Z"/>' +
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
            info.email && '<a class="hw-chip hw-chip-link hw-secret" href="mailto:' + esc(info.email) + '">✉️ <span class="hw-secret-text">' + esc(info.email) + '</span></a>',
            info.phone && '<a class="hw-chip hw-chip-link hw-secret" href="tel:' + esc(info.phone.replace(/\s+/g, '')) + '">📞 <span class="hw-secret-text">' + esc(info.phone) + '</span></a>',
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
                '<span class="hw-jar-label"><span class="hw-poison-icon">' + POISON_SVG + '</span>' + esc(group.title) + '</span>' +
                '<div class="hw-jar-mark" aria-hidden="true">' + SKULL_SVG + '</div>' +
                '<div class="hw-chips">' + chips(group.items) + '</div>' +
                '<div class="hw-jar-liquid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
                '</div></div>'
            );
        }).join('');

        var experience = (data.experience || []).map(function (exp) {
            var d = exp.duration || {};
            var corner = '<span class="hw-pc-rank">' + esc(String(d.start || '').split('-')[0]) + '</span><span class="hw-pc-suit">🦇</span>';
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

            '<section class="hw-section hw-reveal hw-skills">' + heading('🧪', 'Potion shelf', 'skills') +
            '<div class="hw-skeleton" aria-hidden="true">' + SKELETON_SVG + '</div>' +
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

            '<div class="hw-sky" aria-hidden="true">' +
            '<div class="hw-cloud hw-cloud-1"></div><div class="hw-cloud hw-cloud-2"></div><div class="hw-cloud hw-cloud-3"></div><div class="hw-cloud hw-cloud-4"></div>' +
            FRAME_SVG + '<div class="hw-moon"></div>' + HOUSE_SVG + TREE_SVG + GRAVEYARD_SVG +
            '</div>' +
            '<div class="hw-bats" aria-hidden="true">' + bats + '</div>' +
            '<div class="hw-lantern" aria-hidden="true"></div>' +
            renderContent(data) +
            '<div class="hw-web-wrap" aria-hidden="true"><svg class="hw-web" viewBox="0 0 ' + WEB_SIZE + ' ' + WEB_SIZE + '"></svg><span class="hw-web-hint">swipe the web ♪</span></div>' +
            '<div class="hw-char hw-dracula" aria-hidden="true"><div class="hw-dancer">' + DRACULA_SVG + '</div></div>' +
            ZOMBIES.map(function (svg, i) {
                return '<div class="hw-char hw-zombie hw-zombie-' + (i + 1) + '" aria-hidden="true"><div class="hw-dancer">' + svg + '</div></div>';
            }).join('') +
            '<svg class="hw-puppet-layer" aria-hidden="true"></svg>' +
            '<div class="hw-char hw-pumpkin hw-pumpkin-1" aria-hidden="true"><div class="hw-dancer">' + PUMPKIN_SVG + '</div></div>' +
            '<div class="hw-char hw-pumpkin hw-pumpkin-2" aria-hidden="true"><div class="hw-dancer">' + PUMPKIN_SVG + '</div></div>' +
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
                { el: root.querySelector('.hw-pumpkin-1 .hw-dancer'), move: 0 },
                { el: root.querySelector('.hw-pumpkin-2 .hw-dancer'), move: 3 }
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

        // A lone note makes one zombie and one pumpkin hop once (taking turns)
        var hoppers = {
            zombies: Array.prototype.slice.call(root.querySelectorAll('.hw-zombie .hw-dancer')),
            pumpkins: Array.prototype.slice.call(root.querySelectorAll('.hw-pumpkin .hw-dancer'))
        };

        // Random pick that never repeats the previous one
        function pickNew(list) {
            var choice = list[Math.floor(Math.random() * list.length)];
            if (choice === list.last && list.length > 1) choice = list[(list.indexOf(choice) + 1) % list.length];
            list.last = choice;
            return choice;
        }

        function hop(el) {
            restartAnimation(el, 'hw-m-hop');
            clearTimeout(el.hopTimer);
            // Timer rather than animationend: a full dance can override the hop before it finishes
            el.hopTimer = setTimeout(function () { el.classList.remove('hw-m-hop'); }, 750);
        }

        function hopOnce() {
            hop(pickNew(hoppers.zombies));
            hop(pickNew(hoppers.pumpkins));
        }

        var recentNotes = [];

        function react(now) {
            recentNotes.push(now);
            while (recentNotes.length && now - recentNotes[0] > RATE_WINDOW_MS) recentNotes.shift();
            if (recentNotes.length >= DANCE_RATE) {
                startDance();
            } else if (!hwRoot.classList.contains('hw-dancing')) {
                hopOnce();
            }
        }

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
            react(performance.now());
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

        // Marionettes: a controller hangs above each zombie and strings run straight up to it
        var puppetLayer = root.querySelector('.hw-puppet-layer');
        var puppets = Array.prototype.map.call(root.querySelectorAll('.hw-zombie'), function (zombie, i) {
            var group = document.createElementNS(SVG_NS, 'g');
            var lines = {};
            ['head', 'handA', 'handB', 'kneeL', 'kneeR'].forEach(function (name) {
                var line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('class', 'hw-puppet-string');
                group.appendChild(line);
                lines[name] = line;
            });
            var controller = document.createElementNS(SVG_NS, 'g');
            controller.setAttribute('class', 'hw-controller');
            controller.innerHTML = CONTROLLER_SVG;
            group.appendChild(controller);
            puppetLayer.appendChild(group);
            var pins = {};
            zombie.querySelectorAll('.hw-pin').forEach(function (el) { pins[el.getAttribute('data-pin')] = el; });
            return { zombie: zombie, pins: pins, lines: lines, controller: controller, i: i };
        });
        var puppetsVisibleUntil = 0;

        function centreOf(el) {
            var r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }

        function setLine(line, a, b) {
            line.setAttribute('x1', a.x.toFixed(1));
            line.setAttribute('y1', a.y.toFixed(1));
            line.setAttribute('x2', b.x.toFixed(1));
            line.setAttribute('y2', b.y.toFixed(1));
        }

        function byX(a, b) { return a.x - b.x; }

        function stepPuppets(now) {
            if (hwRoot.classList.contains('hw-dancing')) puppetsVisibleUntil = now + 600;
            if (now > puppetsVisibleUntil) return; // hidden: nothing to draw
            var t = now / 1000;
            puppets.forEach(function (p) {
                var pts = {};
                Object.keys(p.pins).forEach(function (name) { pts[name] = centreOf(p.pins[name]); });
                var scale = p.zombie.offsetWidth / 120;
                var cx = (pts.head.x + pts.handA.x + pts.handB.x) / 3;
                var cy = Math.max(24 * scale, pts.head.y - 120 * scale - Math.abs(Math.sin(t * 7 + p.i)) * 12 * scale);
                var angle = Math.sin(t * 6.5 + p.i * 1.3) * 14;
                var rad = angle * Math.PI / 180;
                var cos = Math.cos(rad);
                var sin = Math.sin(rad);
                function world(local) {
                    var lx = local[0] * scale;
                    var ly = local[1] * scale;
                    return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
                }
                p.controller.setAttribute('transform',
                    'translate(' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ') rotate(' + angle.toFixed(1) + ') scale(' + scale.toFixed(3) + ')');
                // Pair left-most limb with left-most bar end so strings never cross
                var handEnds = CONTROLLER_ENDS.hands.map(world).sort(byX);
                var kneeEnds = CONTROLLER_ENDS.knees.map(world).sort(byX);
                var hands = [{ name: 'handA', p: pts.handA }, { name: 'handB', p: pts.handB }].sort(function (a, b) { return a.p.x - b.p.x; });
                var knees = [{ name: 'kneeL', p: pts.kneeL }, { name: 'kneeR', p: pts.kneeR }].sort(function (a, b) { return a.p.x - b.p.x; });
                hands.forEach(function (h, k) { setLine(p.lines[h.name], handEnds[k], h.p); });
                knees.forEach(function (h, k) { setLine(p.lines[h.name], kneeEnds[k], h.p); });
                setLine(p.lines.head, world(CONTROLLER_ENDS.head), pts.head);
            });
        }

        var lastFrame = performance.now();
        function frame(now) {
            var dt = Math.min(50, now - lastFrame);
            lastFrame = now;
            stepSpider();
            stepDracula(dt);
            stepPuppets(now);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);

        var lantern = root.querySelector('.hw-lantern');

        // Email / phone sharpen as the pointer approaches: clear within 40px, fully blurred past ~190px
        var secrets = root.querySelectorAll('.hw-secret');
        function revealNear(clientX, clientY) {
            secrets.forEach(function (el) {
                var r = el.getBoundingClientRect();
                var dx = Math.max(r.left - clientX, 0, clientX - r.right);
                var dy = Math.max(r.top - clientY, 0, clientY - r.bottom);
                var blur = Math.min(6, Math.max(0, (Math.sqrt(dx * dx + dy * dy) - 40) / 25));
                el.style.setProperty('--hw-blur', blur.toFixed(2) + 'px');
            });
        }
        window.addEventListener('pointermove', function (e) {
            lantern.style.setProperty('--mx', e.clientX + 'px');
            lantern.style.setProperty('--my', e.clientY + 'px');
            revealNear(e.clientX, e.clientY);
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
            revealNear(e.touches[0].clientX, e.touches[0].clientY);
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
