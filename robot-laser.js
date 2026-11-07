/* Code Editor template: tap the robot and it fires red lasers from both eyes at a random spot.
   The hit spot sparks, smokes and is left scorched (burn marks scroll with the page). */
(function () {
    'use strict';

    var MAX_BURNS = 40;
    var CHARGE_MS = 220, BEAM_MS = 650;
    var busy = false, canvas = null, ctx = null, layer = null, audio = null;

    function setup() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.className = 'laser-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        layer = document.createElement('div');
        layer.className = 'burn-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
        size();
        window.addEventListener('resize', size);
    }
    function size() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function zap() {
        try {
            if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === 'suspended') audio.resume();
            var t0 = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(1800, t0);
            o.frequency.exponentialRampToValueAtTime(220, t0 + 0.45);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
            o.connect(g); g.connect(audio.destination);
            o.start(t0); o.stop(t0 + 0.55);
        } catch (_) { /* no audio */ }
    }

    function eyeCenters() {
        return Array.prototype.map.call(document.querySelectorAll('.robot-eye'), function (e) {
            var r = e.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
    }

    // a random point on screen, away from the robot itself
    function pickTarget(eyes) {
        var w = window.innerWidth, h = window.innerHeight, p, tries = 0;
        var c = eyes.length ? eyes[0] : { x: w - 80, y: 80 };
        do {
            p = { x: 30 + Math.random() * (w - 60), y: 30 + Math.random() * (h - 60) };
        } while (Math.hypot(p.x - c.x, p.y - c.y) < 180 && ++tries < 30);
        return p;
    }

    function lookAt(target) {
        var robot = document.getElementById('robotContainer');
        if (!robot) return;
        var r = robot.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 3;
        var dx = target.x - cx, dy = target.y - cy, d = Math.hypot(dx, dy) || 1;
        document.querySelectorAll('.robot-pupil').forEach(function (p) {
            p.style.transform = 'translate(calc(-50% + ' + (dx / d * 4) + 'px), calc(-50% + ' + (dy / d * 3) + 'px))';
        });
    }

    function burn(x, y) {
        var size = 46 + Math.random() * 40;
        var b = document.createElement('div');
        b.className = 'burn-mark';
        b.style.left = (x + window.scrollX) + 'px';
        b.style.top = (y + window.scrollY) + 'px';
        b.style.width = b.style.height = size + 'px';
        var rr = function () { return 38 + Math.round(Math.random() * 24) + '%'; };
        b.style.borderRadius = rr() + ' ' + rr() + ' ' + rr() + ' ' + rr() + ' / ' + rr() + ' ' + rr() + ' ' + rr() + ' ' + rr();
        b.style.transform = 'translate(-50%, -50%) rotate(' + Math.round(Math.random() * 360) + 'deg)';
        layer.appendChild(b);
        // smoke puffs
        for (var i = 0; i < 6; i++) {
            var s = document.createElement('span');
            s.className = 'burn-smoke';
            s.style.left = (x + window.scrollX + (Math.random() - 0.5) * size * 0.5) + 'px';
            s.style.top = (y + window.scrollY) + 'px';
            s.style.animationDelay = (i * 0.18) + 's';
            s.style.setProperty('--drift', ((Math.random() - 0.5) * 60) + 'px');
            layer.appendChild(s);
            setTimeout(function (n) { n.remove(); }.bind(null, s), 2600 + i * 180);
        }
        var marks = layer.querySelectorAll('.burn-mark');
        if (marks.length > MAX_BURNS) marks[0].remove();
        // the layer must cover the whole page so marks can sit anywhere
        layer.style.height = document.documentElement.scrollHeight + 'px';
    }

    function fire() {
        if (busy) return;
        setup();
        var eyes = eyeCenters();
        if (eyes.length < 2) return;
        var target = pickTarget(eyes);
        var robot = document.getElementById('robotContainer');
        busy = true;
        window.robotFiring = true;
        lookAt(target);
        robot && robot.classList.add('robot-firing');
        zap();

        var sparks = [], burned = false, t0 = performance.now();
        function frame(now) {
            var t = now - t0;
            eyes = eyeCenters();
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            if (t >= CHARGE_MS) {
                var k = (t - CHARGE_MS) / BEAM_MS;               // 0..1
                var reach = Math.min(1, k * 6);                  // beam shoots out in the first ~110ms
                var fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
                var flick = 0.75 + Math.random() * 0.25;
                eyes.forEach(function (e) {
                    var ex = e.x + (target.x - e.x) * reach, ey = e.y + (target.y - e.y) * reach;
                    ctx.lineCap = 'round';
                    [[14, 'rgba(255,30,30,' + 0.18 * fade + ')'], [7, 'rgba(255,40,40,' + 0.45 * fade * flick + ')'], [2.5, 'rgba(255,235,235,' + fade + ')']].forEach(function (l) {
                        ctx.strokeStyle = l[1];
                        ctx.lineWidth = l[0];
                        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(ex, ey); ctx.stroke();
                    });
                    var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 16);
                    g.addColorStop(0, 'rgba(255,255,255,' + fade + ')');
                    g.addColorStop(0.4, 'rgba(255,40,40,' + 0.7 * fade + ')');
                    g.addColorStop(1, 'rgba(255,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(e.x - 16, e.y - 16, 32, 32);
                });
                if (reach >= 1) {
                    if (!burned) { burned = true; burn(target.x, target.y); }
                    // impact glow + sparks
                    var ig = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 34);
                    ig.addColorStop(0, 'rgba(255,255,220,' + fade + ')');
                    ig.addColorStop(0.3, 'rgba(255,160,40,' + 0.8 * fade + ')');
                    ig.addColorStop(1, 'rgba(255,60,0,0)');
                    ctx.fillStyle = ig;
                    ctx.fillRect(target.x - 34, target.y - 34, 68, 68);
                    if (fade > 0.3) for (var i = 0; i < 4; i++) {
                        var a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
                        sparks.push({ x: target.x, y: target.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1 });
                    }
                }
            } else {
                // charging: eyes glow up
                var c = t / CHARGE_MS;
                eyes.forEach(function (e) {
                    var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 10 + c * 14);
                    g.addColorStop(0, 'rgba(255,90,90,' + c + ')');
                    g.addColorStop(1, 'rgba(255,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(e.x - 26, e.y - 26, 52, 52);
                });
            }
            sparks = sparks.filter(function (s) { return s.life > 0; });
            sparks.forEach(function (s) {
                s.x += s.vx; s.y += s.vy; s.vy += 0.35; s.life -= 0.04;
                ctx.fillStyle = 'rgba(255,' + Math.round(180 + 75 * s.life) + ',80,' + s.life + ')';
                ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
            });
            if (t < CHARGE_MS + BEAM_MS || sparks.length) requestAnimationFrame(frame);
            else {
                ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                busy = false;
                window.robotFiring = false;
                robot && robot.classList.remove('robot-firing');
            }
        }
        requestAnimationFrame(frame);
    }

    window.fireRobotLaser = fire;
})();
