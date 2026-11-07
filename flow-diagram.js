/* Code Editor template: the profile drawn as a block-schema (flowchart) next to the code.
   START → input → education → certifications → for-each job (oldest → now) → decision →
   projects → output skills → END. Clicking a block scrolls to its code and flashes it;
   the block for the code currently on screen lights up. */
(function () {
    'use strict';

    var W = 340, CX = 170, BW = 264, PAD = 9, LH = 15, GAP = 20, CHARS = 37;
    var C = {
        term: '#6a9955', io: '#ce9178', proc: '#569cd6', loop: '#c586c0', dec: '#dcdcaa', now: '#4ec9b0', text: '#d4d4d4', dim: '#8b949e'
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function wrap(text, max) {
        var words = String(text || '').split(/\s+/), lines = [], cur = '';
        words.forEach(function (w) {
            if (!w) return;
            if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w.length > max ? w.slice(0, max - 1) + '…' : w; }
            else cur = (cur + ' ' + w).trim();
        });
        if (cur) lines.push(cur);
        return lines.length ? lines : [''];
    }
    function ym(s) {
        if (/present/i.test(String(s))) return 'NOW';
        var m = /^(\d{4})-(\d{1,2})$/.exec(String(s || '').trim());
        return m ? m[1] + '.' + (m[2].length < 2 ? '0' : '') + m[2] : String(s || '');
    }
    function months(a, b) {
        var pa = /^(\d{4})-(\d{1,2})$/.exec(String(a || '')), now = new Date();
        var pb = /present/i.test(String(b)) ? [0, now.getFullYear(), now.getMonth() + 1] : /^(\d{4})-(\d{1,2})$/.exec(String(b || ''));
        if (!pa || !pb) return 0;
        return Math.max(0, (+pb[1] - +pa[1]) * 12 + (+pb[2] - +pa[2]));
    }
    function span(m) {
        if (!m) return '';
        var y = Math.floor(m / 12), r = m % 12;
        return ((y ? y + 'y ' : '') + (r ? r + 'm' : '')).trim();
    }

    // ---- build the node list from the profile ----
    function nodesFor(data) {
        var info = data.personalInfo || {}, n = [];
        n.push({ type: 'term', lines: [{ t: 'START', b: 1 }, { t: 'main()' }], target: 'code-summary' });
        n.push({ type: 'io', label: 'INPUT', lines: [{ t: info.nickname || info.name, b: 1 }].concat(wrap(info.title, CHARS - 4).map(function (t) { return { t: t, d: 1 }; })), target: 'code-info' });
        var loc = (info.location || [])[1] || (info.location || [])[0];
        n.push({ type: 'proc', label: 'INFO', lines: [{ t: [info.age != null ? 'age ' + info.age : '', loc].filter(Boolean).join(' · ') }].concat(
            wrap(((data.platforms || {}).primary || []).join(' · '), CHARS).map(function (t) { return { t: t, d: 1 }; })), target: 'code-info' });
        if ((data.education || []).length) {
            n.push({ type: 'proc', label: 'EDUCATION', target: 'code-education', lines: data.education.map(function (e) {
                return { t: (String(e.date || '').match(/\d{4}/) || [''])[0] + ' ' + e.field };
            }).concat([{ t: wrap((data.education[0] || {}).institution, CHARS)[0], d: 1 }]) });
        }
        if ((data.certifications || []).length) {
            n.push({ type: 'proc', label: 'CERTIFICATIONS', target: 'code-certifications', lines: data.certifications.map(function (c) {
                return { t: c.date + ' ' + wrap(c.name, CHARS - 5)[0] };
            }) });
        }
        var jobs = data.experience || [];
        if (jobs.length) {
            var first = jobs[jobs.length - 1], total = months((first.duration || {}).start, 'Present');
            n.push({ type: 'loop', lines: [{ t: 'for (job : EXPERIENCE)', b: 1 }, { t: jobs.length + ' jobs · ' + span(total), d: 1 }], target: 'code-experience', loopStart: true });
            for (var i = jobs.length - 1; i >= 0; i--) {     // oldest first, like a program runs
                var j = jobs[i], d = j.duration || {}, live = /present/i.test(String(d.end));
                n.push({
                    type: live ? 'now' : 'proc', job: true, target: 'code-exp-' + i,
                    lines: [{ t: ym(d.start) + ' → ' + ym(d.end) + '  ' + span(months(d.start, d.end)), d: 1 }, { t: wrap(j.company, CHARS)[0], b: 1 }, { t: wrap(j.role, CHARS)[0] }],
                    loopEnd: i === 0
                });
            }
            n.push({ type: 'dec', lines: [{ t: 'keep learning?' }], target: 'code-experience' });
        }
        if ((data.projects || []).length) {
            n.push({ type: 'proc', label: 'PROJECTS', target: 'code-projects', lines: data.projects.map(function (p) {
                return { t: (p.icon ? p.icon + ' ' : '') + p.name };
            }) });
        }
        var skills = data.workSkills || {};
        var sk = Object.keys(skills).map(function (k) { return k + ' ×' + (skills[k] || []).length; }).join(' · ');
        if (sk) n.push({ type: 'io', label: 'OUTPUT', lines: wrap(sk, CHARS - 4).map(function (t) { return { t: t }; }) });
        n.push({ type: 'term', lines: [{ t: 'END', b: 1 }, { t: 'return 0;' }] });
        return n;
    }

    // ---- draw ----
    function shape(node, x, y, w, h) {
        var col = C[node.type], skew = 12;
        if (node.type === 'term') return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '" class="fl-shape" style="--c:' + col + '"/>';
        if (node.type === 'io') return '<path d="M' + (x + skew) + ' ' + y + 'H' + (x + w) + 'L' + (x + w - skew) + ' ' + (y + h) + 'H' + x + 'Z" class="fl-shape" style="--c:' + col + '"/>';
        if (node.type === 'loop') return '<path d="M' + (x + 14) + ' ' + y + 'H' + (x + w - 14) + 'L' + (x + w) + ' ' + (y + h / 2) + 'L' + (x + w - 14) + ' ' + (y + h) + 'H' + (x + 14) + 'L' + x + ' ' + (y + h / 2) + 'Z" class="fl-shape" style="--c:' + col + '"/>';
        if (node.type === 'dec') return '<path d="M' + CX + ' ' + y + 'L' + (x + w) + ' ' + (y + h / 2) + 'L' + CX + ' ' + (y + h) + 'L' + x + ' ' + (y + h / 2) + 'Z" class="fl-shape" style="--c:' + col + '"/>';
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" class="fl-shape" style="--c:' + col + '"/>';
    }

    function build(data) {
        var nodes = nodesFor(data), y = 14, svg = '', links = '', loopTop = 0, loopBottom = 0, spine = [];
        nodes.forEach(function (node, i) {
            var isDec = node.type === 'dec';
            var w = isDec ? 180 : BW, x = CX - w / 2;
            var labelH = node.label ? LH : 0;
            var h = isDec ? 64 : PAD * 2 + labelH + node.lines.length * LH;
            node.y = y; node.h = h;
            var cls = 'fl-node fl-' + node.type + (node.target ? ' fl-link' : '');
            var g = '<g class="' + cls + '"' + (node.target ? ' data-target="' + node.target + '" tabindex="0" role="button" aria-label="Show ' + esc(node.lines.map(function (l) { return l.t; }).join(' ')) + ' in the code"' : '') + ' style="--c:' + C[node.type] + '">';
            g += shape(node, x, y, w, h);
            if (node.type === 'now') g += '<rect x="' + (x - 3) + '" y="' + (y - 3) + '" width="' + (w + 6) + '" height="' + (h + 6) + '" rx="6" class="fl-pulse"/>';
            var ty = y + PAD + 11;
            if (isDec) ty = y + h / 2 + 4;
            if (node.label) { g += '<text x="' + (x + (node.type === 'io' ? 18 : 10)) + '" y="' + ty + '" class="fl-label">' + esc(node.label) + '</text>'; ty += LH; }
            node.lines.forEach(function (l) {
                var tx = node.type === 'io' ? x + 18 : node.job || node.label ? x + 10 : CX;
                var anchor = tx === CX ? ' text-anchor="middle"' : '';
                g += '<text x="' + tx + '" y="' + ty + '"' + anchor + ' class="fl-text' + (l.b ? ' fl-b' : '') + (l.d ? ' fl-d' : '') + '">' + esc(l.t) + '</text>';
                ty += LH;
            });
            if (node.type === 'now') g += '<text x="' + (x + w - 10) + '" y="' + (y + PAD + 11) + '" text-anchor="end" class="fl-badge">● NOW</text>';
            g += '</g>';
            svg += g;
            if (node.loopStart) loopTop = y + h / 2;
            if (node.loopEnd) loopBottom = y + h / 2;
            spine.push([y, y + h]);
            if (isDec) {
                // "no" branch: a dead end off to the right
                links += '<path d="M' + (CX + w / 2) + ' ' + (y + h / 2) + 'H' + (W - 12) + '" class="fl-edge fl-dim"/>' +
                    '<text x="' + (CX + w / 2 + 6) + '" y="' + (y + h / 2 - 5) + '" class="fl-yes">no</text>' +
                    '<text x="' + (W - 12) + '" y="' + (y + h / 2 + 14) + '" text-anchor="end" class="fl-yes fl-dim">∅</text>' +
                    '<text x="' + (CX + 6) + '" y="' + (y + h + 13) + '" class="fl-yes">yes</text>';
            }
            if (i < nodes.length - 1) {
                links += '<path d="M' + CX + ' ' + (y + h) + 'V' + (y + h + GAP - 2) + '" class="fl-edge" marker-end="url(#flArrow)"/>';
            }
            y += h + GAP;
        });
        // the loop: back from the last job to the for-header, along the left edge
        if (loopTop && loopBottom) {
            var lx = CX - BW / 2 - 14;
            links += '<path d="M' + (CX - BW / 2) + ' ' + loopBottom + 'H' + lx + 'V' + loopTop + 'H' + (CX - BW / 2 + 2) + '" class="fl-edge fl-loopedge" marker-end="url(#flArrow)"/>' +
                '<text x="' + (lx - 3) + '" y="' + ((loopTop + loopBottom) / 2) + '" class="fl-yes" transform="rotate(-90 ' + (lx - 3) + ' ' + ((loopTop + loopBottom) / 2) + ')" text-anchor="middle">next job</text>';
        }
        var H = y - GAP + 14;
        var packet = '<circle r="4" class="fl-packet"><animateMotion dur="' + Math.round(H / 70) + 's" repeatCount="indefinite" path="M' + CX + ' 14V' + (H - 14) + '"/></circle>';
        return '<svg class="flow-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Flowchart of the profile">' +
            '<defs><marker id="flArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
            '<path d="M0 0L10 5L0 10Z" fill="#6e7681"/></marker></defs>' +
            links + packet + svg + '</svg>';   // the packet runs behind the blocks, visible on the arrows
    }

    function flash(target) {
        var el = document.getElementById(target);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // flash the header line plus the lines that belong to it
        var group = [el];
        if (el.classList.contains('indent-1')) {
            var n = el.nextElementSibling;
            while (n && n.classList.contains('indent-2')) { group.push(n); n = n.nextElementSibling; }
        }
        group.forEach(function (g) {
            g.classList.remove('code-flash');
            void g.offsetWidth;
            g.classList.add('code-flash');
        });
    }

    function renderFlowDiagram(data, col) {
        if (!col) return;
        col.innerHTML =
            '<div class="flow-card">' +
                '<div class="flow-head"><span class="flow-file">profile.flow</span><span class="flow-hint">click a block → jump to code</span></div>' +
                '<div class="flow-legend"><span><i class="lg-term"></i>start/end</span><span><i class="lg-io"></i>I/O</span><span><i class="lg-proc"></i>process</span><span><i class="lg-loop"></i>loop</span><span><i class="lg-dec"></i>decision</span></div>' +
                build(data) +
            '</div>';
        col.addEventListener('click', function (e) {
            var g = e.target.closest('.fl-link');
            if (g) flash(g.getAttribute('data-target'));
        });
        col.addEventListener('keydown', function (e) {
            var g = e.target.closest && e.target.closest('.fl-link');
            if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flash(g.getAttribute('data-target')); }
        });

        // scroll spy: light up the block whose code is in the middle of the screen
        if (!('IntersectionObserver' in window)) return;
        var byTarget = {};
        col.querySelectorAll('.fl-link').forEach(function (g) {
            var t = g.getAttribute('data-target');
            (byTarget[t] = byTarget[t] || []).push(g);
        });
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                col.querySelectorAll('.fl-active').forEach(function (g) { g.classList.remove('fl-active'); });
                var hits = byTarget[en.target.id] || [];
                hits.forEach(function (g) { g.classList.add('fl-active'); });
                // keep the active block visible inside a scrolling column
                if (hits[0] && col.scrollHeight > col.clientHeight) {
                    var r = hits[0].getBoundingClientRect(), cr = col.getBoundingClientRect();
                    if (r.top < cr.top + 40 || r.bottom > cr.bottom - 40) col.scrollTo({ top: col.scrollTop + r.top - cr.top - cr.height / 2, behavior: 'smooth' });
                }
            });
        }, { rootMargin: '-45% 0px -45% 0px' });
        Object.keys(byTarget).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) io.observe(el);
        });
    }

    window.renderFlowDiagram = renderFlowDiagram;
})();
