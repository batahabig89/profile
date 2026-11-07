/* C++ playground for the Code Editor template: a small editor (line numbers, highlighting,
   auto-indent) whose code is compiled and run on a public online compiler (Wandbox, with
   Compiler Explorer as a fallback). Code and stdin are kept in localStorage. */
(function () {
    'use strict';

    var STORE_KEY = 'cppPlayground.v1';
    var WANDBOX = 'https://wandbox.org/api/';
    var GODBOLT = 'https://godbolt.org/api/compiler/g132/compile';
    var TIMEOUT_MS = 30000;

    var KEYWORDS = ('alignas alignof and asm auto break case catch class const consteval constexpr constinit const_cast continue co_await co_return co_yield ' +
        'decltype default delete do dynamic_cast else enum explicit export extern false final for friend goto if inline mutable namespace new noexcept not nullptr ' +
        'operator or override private protected public register reinterpret_cast requires return sizeof static static_assert static_cast struct switch template this ' +
        'thread_local throw true try typedef typeid typename union using virtual volatile while').split(' ');
    var TYPES = ('bool char char8_t char16_t char32_t double float int long short signed unsigned void wchar_t size_t int8_t int16_t int32_t int64_t uint8_t ' +
        'uint16_t uint32_t uint64_t std string vector map unordered_map set unordered_set pair tuple array deque list queue stack priority_queue optional variant ' +
        'string_view unique_ptr shared_ptr cout cin cerr endl').split(' ');
    var KW = {}, TY = {};
    KEYWORDS.forEach(function (k) { KW[k] = 1; });
    TYPES.forEach(function (k) { TY[k] = 1; });

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function cstr(s) { return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'; }

    // ---------------------------------------------------------------- highlighting
    var TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|(?![\s\S])))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(^[ \t]*#[^\n]*)|(\b(?:0[xX][\da-fA-F']+|\d[\d']*(?:\.\d*)?(?:[eE][+-]?\d+)?)[uUlLfF]*\b)|([A-Za-z_]\w*)/gm;
    function highlight(src) {
        var out = '', last = 0, m;
        TOKEN.lastIndex = 0;
        while ((m = TOKEN.exec(src))) {
            if (m.index > last) out += esc(src.slice(last, m.index));
            var t = m[0], cls;
            if (m[1]) cls = 'cpp-t-com';
            else if (m[2]) cls = 'cpp-t-str';
            else if (m[3]) cls = 'cpp-t-pre';
            else if (m[4]) cls = 'cpp-t-num';
            else if (KW[t]) cls = 'cpp-t-kw';
            else if (TY[t]) cls = 'cpp-t-type';
            else if (/^\s*\(/.test(src.slice(TOKEN.lastIndex, TOKEN.lastIndex + 40))) cls = 'cpp-t-fn';
            out += cls ? '<span class="' + cls + '">' + esc(t) + '</span>' : esc(t);
            last = TOKEN.lastIndex;
            if (!t.length) TOKEN.lastIndex++;
        }
        return out + esc(src.slice(last));
    }

    // ---------------------------------------------------------------- examples
    function profileExample(data) {
        var info = data.personalInfo || {}, jobs = data.experience || [];
        var name = info.nickname || info.name || 'Developer';
        var rows = jobs.map(function (j) {
            var d = j.duration || {};
            return '        {' + [j.company, j.role, d.start, d.end].map(cstr).join(', ') + '},';
        }).join('\n');
        var skills = Object.keys(data.workSkills || {}).map(function (k) {
            return '        {' + cstr(k) + ', ' + (data.workSkills[k] || []).length + '},';
        }).join('\n');
        return [
            '// profile.cpp: my career, compiled and run for real',
            '#include <iostream>',
            '#include <string>',
            '#include <vector>',
            '#include <utility>',
            '',
            'struct Job {',
            '    std::string company, role, from, to;',
            '};',
            '',
            'int main() {',
            '    const std::string name = ' + cstr(name) + ';',
            '    std::vector<Job> career = {',
            rows,
            '    };',
            '    std::vector<std::pair<std::string, int>> skills = {',
            skills,
            '    };',
            '',
            '    std::cout << "Hello, I am " << name << "!\\n";',
            '    std::cout << ' + cstr(info.title || '') + ' << "\\n\\n";',
            '',
            '    std::cout << "== Career (" << career.size() << " jobs) ==\\n";',
            '    for (const auto& job : career) {',
            '        std::cout << "  " << job.from << " -> " << job.to',
            '                  << "  " << job.role << " @ " << job.company << "\\n";',
            '    }',
            '',
            '    std::cout << "\\n== Skills ==\\n";',
            '    for (const auto& [group, count] : skills) {',
            '        std::cout << "  " << group << ": " << std::string(count, \'#\') << " " << count << "\\n";',
            '    }',
            '    return 0;',
            '}',
            ''
        ].join('\n');
    }
    var EXAMPLES = [
        { id: 'profile', label: 'profile.cpp', code: null, stdin: '' },
        { id: 'hello', label: 'hello.cpp', stdin: 'World', code: [
            '#include <iostream>',
            '#include <string>',
            '',
            'int main() {',
            '    std::string who;',
            '    std::getline(std::cin, who);   // type it in the stdin box',
            '    std::cout << "Hello, " << (who.empty() ? "C++" : who) << "!" << std::endl;',
            '    return 0;',
            '}',
            ''].join('\n') },
        { id: 'sort', label: 'sort.cpp', stdin: '42 7 19 3 88 1 56', code: [
            '#include <algorithm>',
            '#include <iostream>',
            '#include <numeric>',
            '#include <vector>',
            '',
            'int main() {',
            '    std::vector<int> v;',
            '    for (int x; std::cin >> x;) v.push_back(x);',
            '',
            '    std::sort(v.begin(), v.end());',
            '    for (int x : v) std::cout << x << \' \';',
            '',
            '    double avg = v.empty() ? 0 : std::accumulate(v.begin(), v.end(), 0.0) / v.size();',
            '    std::cout << "\\nmin=" << v.front() << " max=" << v.back() << " avg=" << avg << "\\n";',
            '    return 0;',
            '}',
            ''].join('\n') },
        { id: 'fib', label: 'fibonacci.cpp', stdin: '20', code: [
            '#include <cstdint>',
            '#include <iostream>',
            '',
            'constexpr std::uint64_t fib(int n) {',
            '    std::uint64_t a = 0, b = 1;',
            '    for (int i = 0; i < n; ++i) {',
            '        auto t = a + b;',
            '        a = b;',
            '        b = t;',
            '    }',
            '    return a;',
            '}',
            '',
            'static_assert(fib(10) == 55);   // checked at compile time',
            '',
            'int main() {',
            '    int n = 10;',
            '    std::cin >> n;',
            '    for (int i = 0; i <= n; ++i)',
            '        std::cout << "fib(" << i << ") = " << fib(i) << "\\n";',
            '    return 0;',
            '}',
            ''].join('\n') },
        { id: 'robot', label: 'robot.cpp', stdin: 'F F R F F L F', code: [
            '#include <iostream>',
            '#include <string>',
            '',
            '// A tiny robot on a grid: F = forward, L / R = turn',
            'class Robot {',
            'public:',
            '    void exec(char c) {',
            '        if (c == \'L\') dir_ = (dir_ + 3) % 4;',
            '        else if (c == \'R\') dir_ = (dir_ + 1) % 4;',
            '        else if (c == \'F\') { x_ += DX[dir_]; y_ += DY[dir_]; }',
            '    }',
            '    void report() const {',
            '        std::cout << "robot at (" << x_ << ", " << y_ << ") facing " << "NESW"[dir_] << "\\n";',
            '    }',
            '',
            'private:',
            '    static constexpr int DX[4] = {0, 1, 0, -1};',
            '    static constexpr int DY[4] = {1, 0, -1, 0};',
            '    int x_ = 0, y_ = 0, dir_ = 0;',
            '};',
            '',
            'int main() {',
            '    Robot r;',
            '    for (char c; std::cin >> c;) {',
            '        r.exec(c);',
            '        r.report();',
            '    }',
            '    return 0;',
            '}',
            ''].join('\n') }
    ];

    // ---------------------------------------------------------------- compile-time rain
    // While compiling, the console shows a falling "digital rain" in the traditional Mongolian
    // script: the imperial seal inscription of the Great Mongol State (the formula opening the
    // khans' edicts, known from Güyük's 1246 seal and Möngke's letters), flowing in order across
    // the columns, plus names of heroes from Mongolian history. The script is vertical by nature,
    // so whole words fall (keeping the letters correctly joined).
    var SEAL = [
        'ᠮᠥᠩᠬᠡ ᠲᠩᠷᠢ ᠶᠢᠨ',          // möngke tngri-yin       By the power of
        'ᠬᠦᠴᠦᠨ ᠳᠦᠷ',               // küčün-dür              the Eternal Heaven,
        'ᠶᠡᠬᠡ ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ ᠤᠨ',     // yeke mongγol ulus-un   of the Great Mongol State
        'ᠳᠠᠯᠠᠢ ᠶᠢᠨ ᠬᠠᠨ ᠤ',         // dalai-yin qan-u        the Oceanic Khan's
        'ᠵᠠᠷᠯᠢᠭ',                  // jarliγ                 decree.
        'ᠢᠯ ᠪᠤᠯᠭᠠ ᠢᠷᠭᠡᠨ ᠳᠦᠷ',      // il bulγa irgen-dür     Where it reaches subject and rebel people,
        'ᠬᠦᠷᠪᠡᠰᠦ',                 // kürbesü
        'ᠪᠢᠰᠢᠷᠡᠭᠦ ᠠᠶᠤᠲᠤᠭᠠᠢ'        // bisiregü ayutuγai      let them revere and fear it.
    ];
    var HEROES = [
        'ᠴᠢᠩᠭᠢᠰ ᠬᠠᠭᠠᠨ', 'ᠲᠡᠮᠦᠵᠢᠨ', 'ᠥᠭᠡᠳᠡᠢ ᠬᠠᠭᠠᠨ', 'ᠮᠥᠩᠬᠡ ᠬᠠᠭᠠᠨ', 'ᠬᠤᠪᠢᠯᠠᠢ ᠰᠡᠴᠡᠨ',
        'ᠮᠠᠨᠳᠤᠬᠠᠢ ᠰᠡᠴᠡᠨ ᠬᠠᠲᠤᠨ', 'ᠳᠠᠶᠠᠨ ᠬᠠᠭᠠᠨ', 'ᠪᠥᠷᠲᠡ', 'ᠬᠠᠰᠠᠷ', 'ᠰᠦᠪᠡᠭᠡᠳᠡᠢ',
        'ᠵᠡᠯᠮᠡ', 'ᠮᠤᠬᠤᠯᠢ', 'ᠵᠠᠨᠠᠪᠠᠵᠠᠷ', 'ᠰᠦᠬᠡᠪᠠᠭᠠᠲᠤᠷ'
    ];
    var sealAt = 0;
    // next stream text: two lines of the seal in reading order (most columns), or a hero's name
    function nextRainText() {
        if (Math.random() < 0.7) {
            var a = SEAL[sealAt % SEAL.length], b = SEAL[(sealAt + 1) % SEAL.length];
            sealAt = (sealAt + 2) % SEAL.length;
            return a + '  ' + b;
        }
        return HEROES[Math.floor(Math.random() * HEROES.length)];
    }
    var MONGOL_FONT = "'Noto Sans Mongolian', 'Mongolian Baiti', 'Menk Qagan Tig', sans-serif";
    var fontReady = null;
    function loadMongolFont() {
        if (fontReady) return fontReady;
        if (!document.querySelector('link[data-mongol-font]')) {
            var l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Mongolian&display=swap';
            l.setAttribute('data-mongol-font', '1');
            document.head.appendChild(l);
        }
        fontReady = document.fonts && document.fonts.load
            ? Promise.race([document.fonts.load("18px 'Noto Sans Mongolian'", 'ᠮᠣᠩᠭᠣᠯ'), new Promise(function (r) { setTimeout(r, 1500); })]).catch(function () {})
            : Promise.resolve();
        return fontReady;
    }

    function startRain(host, out) {
        var cv = document.createElement('canvas');
        cv.className = 'cpp-rain';
        cv.setAttribute('aria-hidden', 'true');
        host.appendChild(cv);
        var ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = 0, h = 0, cols = [], raf = 0, last = performance.now(), stopped = false, alpha = 0, fadeOut = false;
        var FS = 17, COLW = 24;

        function place() {
            cv.style.top = out.offsetTop + 'px';
            cv.style.left = out.offsetLeft + 'px';
            w = out.clientWidth; h = out.clientHeight;
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            cv.style.width = w + 'px'; cv.style.height = h + 'px';
            var n = Math.max(1, Math.floor(w / COLW));
            while (cols.length < n) cols.push(newStream(true));
            cols.length = n;
        }
        function newStream(scatter) {
            var s = { text: nextRainText(), speed: 45 + Math.random() * 150, width: 0, y: 0 };
            ctx.font = FS + 'px ' + MONGOL_FONT;
            s.width = ctx.measureText(s.text).width;
            s.y = scatter ? Math.random() * (h + s.width) : -Math.random() * h * 0.6;
            return s;
        }
        function frame(now) {
            var dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            alpha = fadeOut ? Math.max(0, alpha - dt * 4) : Math.min(1, alpha + dt * 3);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalAlpha = alpha;
            ctx.font = FS + 'px ' + MONGOL_FONT;
            ctx.textBaseline = 'middle';
            cols.forEach(function (s, i) {
                s.y += s.speed * dt;
                if (s.y - s.width > h) { cols[i] = s = newStream(false); }
                var x = i * COLW + COLW / 2;
                // the text runs along the column; its end (the head) sits at s.y
                ctx.save();
                ctx.translate(x, 0);
                ctx.rotate(Math.PI / 2);
                var g = ctx.createLinearGradient(s.y - s.width, 0, s.y, 0);
                g.addColorStop(0, 'rgba(85,255,85,0)');
                g.addColorStop(0.75, 'rgba(85,255,85,0.75)');
                g.addColorStop(0.97, 'rgba(190,255,190,1)');
                g.addColorStop(1, '#ffffff');
                ctx.fillStyle = g;
                ctx.shadowColor = 'rgba(85,255,85,0.8)';
                ctx.shadowBlur = Math.random() < 0.04 ? 14 : 6;
                ctx.fillText(s.text, s.y - s.width, 0);
                ctx.restore();
            });
            ctx.globalAlpha = 1;
            if (fadeOut && alpha <= 0) { cv.remove(); return; }
            raf = requestAnimationFrame(frame);
        }
        loadMongolFont().then(function () {
            if (stopped) { cv.remove(); return; }
            place();
            cols = cols.map(function () { return newStream(true); });   // re-measure with the real font
            window.addEventListener('resize', place);
            raf = requestAnimationFrame(frame);
        });
        return {
            stop: function () {
                stopped = true;
                window.removeEventListener('resize', place);
                if (raf) fadeOut = true; else cv.remove();
            }
        };
    }

    function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { return {}; } }
    function save(state) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* storage blocked */ } }

    // ---------------------------------------------------------------- compilers
    var wandboxCompiler = null;
    function pickWandboxCompiler(signal) {
        if (wandboxCompiler) return Promise.resolve(wandboxCompiler);
        try {
            var cached = sessionStorage.getItem('cppPlayground.compiler');
            if (cached) return Promise.resolve(wandboxCompiler = JSON.parse(cached));
        } catch (_) { /* storage blocked */ }
        return fetch(WANDBOX + 'list.json', { signal: signal }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(function (list) {
            var gcc = list.filter(function (c) { return c.language === 'C++' && /^gcc-\d+\.\d+\.\d+$/.test(c.name); });
            gcc.sort(function (a, b) {
                var x = a.version.split('.').map(Number), y = b.version.split('.').map(Number);
                for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
                return 0;
            });
            var c = gcc[0] || { name: 'gcc-head', 'display-name': 'gcc', version: 'head' };
            wandboxCompiler = { name: c.name, label: 'gcc ' + c.version };
            try { sessionStorage.setItem('cppPlayground.compiler', JSON.stringify(wandboxCompiler)); } catch (_) { /* ignore */ }
            return wandboxCompiler;
        }).catch(function () {
            return (wandboxCompiler = { name: 'gcc-head', label: 'gcc (head)' });
        });
    }

    function runWandbox(code, stdin, std, signal) {
        return pickWandboxCompiler(signal).then(function (comp) {
            return fetch(WANDBOX + 'compile.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: signal,
                body: JSON.stringify({
                    compiler: comp.name,
                    code: code,
                    stdin: stdin,
                    'compiler-option-raw': ['-std=' + std, '-O2', '-Wall', '-Wextra'].join('\n'),
                    save: false
                })
            }).then(function (r) {
                if (!r.ok) throw new Error('Wandbox HTTP ' + r.status);
                return r.json();
            }).then(function (j) {
                var compileErr = j.compiler_error || '';
                var failed = /\berror\b/.test(compileErr) && !('program_output' in j) && !j.program_error;
                return {
                    service: 'wandbox.org · ' + comp.label,
                    compiler: (j.compiler_message || compileErr || '').trim(),
                    compiled: !failed,
                    stdout: j.program_output || '',
                    stderr: j.program_error || '',
                    exit: j.status != null ? String(j.status) : '',
                    signal: j.signal || ''
                };
            });
        });
    }

    function runGodbolt(code, stdin, std, signal) {
        return fetch(GODBOLT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            signal: signal,
            body: JSON.stringify({
                source: code,
                options: {
                    userArguments: '-std=' + std + ' -O2 -Wall -Wextra',
                    executeParameters: { args: [], stdin: stdin },
                    compilerOptions: { executorRequest: true },
                    filters: { execute: true },
                    tools: [], libraries: []
                },
                lang: 'c++',
                allowStoreCodeDebug: false
            })
        }).then(function (r) {
            if (!r.ok) throw new Error('Compiler Explorer HTTP ' + r.status);
            return r.json();
        }).then(function (j) {
            var text = function (arr) { return (arr || []).map(function (x) { return x.text; }).join('\n'); };
            var b = j.buildResult || {};
            var compilerOut = (text(b.stdout) + '\n' + text(b.stderr)).trim();
            return {
                service: 'godbolt.org · gcc 13.2',
                compiler: compilerOut,
                compiled: j.didExecute !== false && b.code === 0,
                stdout: text(j.stdout),
                stderr: text(j.stderr),
                exit: j.didExecute ? String(j.code) : '',
                signal: ''
            };
        });
    }

    // ---------------------------------------------------------------- UI
    // An old-school blue console IDE: menu bar, double-framed edit window, output window, key bar
    function markup() {
        return '' +
            '<div class="cpp-menubar" title="Drag to move · double-click to maximize">' +
                '<span class="cpp-logo" aria-hidden="true">≡</span>' +
                '<label class="cpp-sr" for="cppExample">Example</label>' +
                '<select id="cppExample" class="cpp-select">' + EXAMPLES.map(function (e) {
                    return '<option value="' + e.id + '">' + e.label.toUpperCase() + '</option>';
                }).join('') + '</select>' +
                '<label class="cpp-sr" for="cppStd">Standard</label>' +
                '<select id="cppStd" class="cpp-select">' +
                    '<option value="c++17">C++17</option><option value="c++20" selected>C++20</option><option value="c++23">C++23</option>' +
                '</select>' +
                '<button type="button" class="cpp-menu cpp-run" data-act="run" title="Compile & run (F5 / Ctrl+Enter)"><u>R</u>un</button>' +
                '<button type="button" class="cpp-menu" data-act="reset" title="Restore the example">R<u>e</u>set</button>' +
                '<span class="cpp-grab" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="cpp-desk">' +
                '<section class="cpp-win cpp-win-edit">' +
                    '<button type="button" class="cpp-wbtn cpp-wbtn-l" data-act="dock" title="Dock back to the side">[<b>■</b>]</button>' +
                    '<span class="cpp-wtitle" data-k="file">PROFILE.CPP</span>' +
                    '<button type="button" class="cpp-wbtn cpp-wbtn-r" data-act="max" title="Maximize / restore">[<b data-k="maxicon">↑</b>]</button>' +
                    '<div class="cpp-editor">' +
                        '<div class="cpp-gutter" aria-hidden="true"><div class="cpp-lines"></div></div>' +
                        '<div class="cpp-code">' +
                            '<pre class="cpp-hl" aria-hidden="true"><code></code></pre>' +
                            '<textarea class="cpp-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="C++ source code"></textarea>' +
                        '</div>' +
                    '</div>' +
                    '<span class="cpp-wpos" data-k="pos">1:1</span>' +
                '</section>' +
                '<section class="cpp-win cpp-win-out">' +
                    '<span class="cpp-wtitle">OUTPUT</span>' +
                    '<button type="button" class="cpp-wbtn cpp-wbtn-r" data-act="clear" title="Clear output">[<b>×</b>]</button>' +
                    '<div class="cpp-stdin-row">' +
                        '<label for="cppStdin">stdin&gt;</label>' +
                        '<textarea id="cppStdin" class="cpp-stdin" rows="1" spellcheck="false" placeholder="program input"></textarea>' +
                    '</div>' +
                    '<pre class="cpp-out" aria-live="polite"><span class="cpp-o-dim">Press F5 or Ctrl+Enter to compile and run.</span></pre>' +
                '</section>' +
            '</div>' +
            '<div class="cpp-keys">' +
                '<span><b>F5</b> Run</span><span><b>F2</b> Save</span><span><b>Tab</b> Indent</span>' +
                '<span class="cpp-state" data-k="state">ready</span>' +
            '</div>' +
            '<p class="cpp-note">Compiled on wandbox.org (fallback godbolt.org)</p>' +
            '<span class="cpp-resize" title="Drag to resize" aria-hidden="true"></span>';
    }

    function initCppEditor(data, panel) {
        if (!panel || panel.dataset.ready) return;
        panel.dataset.ready = '1';
        EXAMPLES[0].code = profileExample(data || {});
        panel.innerHTML = markup();

        var ta = panel.querySelector('.cpp-input'), hl = panel.querySelector('.cpp-hl code'), hlPre = panel.querySelector('.cpp-hl');
        var lines = panel.querySelector('.cpp-lines'), out = panel.querySelector('.cpp-out'), stdin = panel.querySelector('.cpp-stdin');
        var exSel = panel.querySelector('#cppExample'), stdSel = panel.querySelector('#cppStd'), runBtn = panel.querySelector('.cpp-run');
        var RUN_LABEL = runBtn.innerHTML;
        var stateEl = panel.querySelector('[data-k="state"]'), posEl = panel.querySelector('[data-k="pos"]'), fileEl = panel.querySelector('[data-k="file"]');
        var errLines = {}, running = null;

        var st = load();
        var ex = EXAMPLES.filter(function (e) { return e.id === st.example; })[0] || EXAMPLES[0];
        exSel.value = ex.id;
        if (st.std) stdSel.value = st.std;
        ta.value = st.code != null && st.example === ex.id ? st.code : ex.code;
        stdin.value = st.stdin != null && st.example === ex.id ? st.stdin : ex.stdin;
        fileEl.textContent = ex.label.toUpperCase();

        function persist() { save({ example: exSel.value, code: ta.value, stdin: stdin.value, std: stdSel.value }); }
        function paint() {
            hl.innerHTML = highlight(ta.value) + '\n ';
            var n = ta.value.split('\n').length, html = '';
            for (var i = 1; i <= n; i++) html += '<span' + (errLines[i] ? ' class="cpp-err-line" title="' + esc(errLines[i]) + '"' : '') + '>' + i + '</span>';
            lines.innerHTML = html;
            syncScroll();
        }
        function syncScroll() {
            hlPre.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)';
            lines.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
        }
        function caret() {
            var before = ta.value.slice(0, ta.selectionStart).split('\n');
            posEl.textContent = before.length + ':' + (before[before.length - 1].length + 1);
        }
        var saveT;
        ta.addEventListener('input', function () {
            if (Object.keys(errLines).length) errLines = {};
            paint(); caret();
            clearTimeout(saveT); saveT = setTimeout(persist, 400);
        });
        ta.addEventListener('scroll', syncScroll);
        // wheel over the line numbers scrolls the code too
        panel.querySelector('.cpp-gutter').addEventListener('wheel', function (e) {
            e.preventDefault();
            ta.scrollTop += e.deltaY;
            ta.scrollLeft += e.deltaX;
        }, { passive: false });
        ['keyup', 'click', 'select'].forEach(function (ev) { ta.addEventListener(ev, caret); });
        stdin.addEventListener('input', function () { clearTimeout(saveT); saveT = setTimeout(persist, 400); });

        // insert text at the selection, keeping the browser's undo history where possible
        function insert(text) {
            ta.focus();
            if (!document.execCommand || !document.execCommand('insertText', false, text)) {
                ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
                ta.dispatchEvent(new Event('input'));
            }
        }
        ta.addEventListener('keydown', function (e) {
            var v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
            if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F5') { e.preventDefault(); run(); return; }
            if (((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) || e.key === 'F2') { e.preventDefault(); persist(); stateEl.textContent = 'saved'; return; }
            if (e.key === 'Tab') {
                e.preventDefault();
                var ls = v.lastIndexOf('\n', s - 1) + 1;
                if (s === en && !e.shiftKey) { insert('    '); return; }
                // indent / outdent every selected line
                var block = v.slice(ls, en);
                var changed = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
                ta.setSelectionRange(ls, en);
                insert(changed);
                ta.setSelectionRange(ls, ls + changed.length);
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                var lineStart = v.lastIndexOf('\n', s - 1) + 1;
                var indent = /^[ \t]*/.exec(v.slice(lineStart, s))[0];
                var prev = v.slice(lineStart, s).trimEnd();
                var next = v.charAt(en);
                if (/[{([]$/.test(prev)) {
                    if (/[})\]]/.test(next)) {
                        insert('\n' + indent + '    \n' + indent);
                        var p = ta.selectionStart - indent.length - 1;
                        ta.setSelectionRange(p, p);
                        return;
                    }
                    indent += '    ';
                }
                insert('\n' + indent);
                return;
            }
            if (e.key === '}' && s === en) {
                var ls2 = v.lastIndexOf('\n', s - 1) + 1, cur = v.slice(ls2, s);
                if (/^ {4,}$/.test(cur)) {
                    e.preventDefault();
                    ta.setSelectionRange(s - 4, s);
                    insert('}');
                }
            }
        });

        exSel.addEventListener('change', function () {
            var e = EXAMPLES.filter(function (x) { return x.id === exSel.value; })[0];
            ta.value = e.code; stdin.value = e.stdin; fileEl.textContent = e.label.toUpperCase();
            errLines = {};
            paint(); persist();
            ta.scrollTop = 0;
        });
        stdSel.addEventListener('change', persist);

        panel.addEventListener('click', function (e) {
            var a = e.target.closest('[data-act]');
            if (!a) return;
            var act = a.getAttribute('data-act');
            if (act === 'run') run();
            else if (act === 'max') win.toggleMax();
            else if (act === 'dock') win.dock();
            else if (act === 'clear') out.innerHTML = '';
            else if (act === 'reset') {
                var ex2 = EXAMPLES.filter(function (x) { return x.id === exSel.value; })[0];
                if (ta.value !== ex2.code && !window.confirm('Replace your code with the original ' + ex2.label + '?')) return;
                ta.value = ex2.code; stdin.value = ex2.stdin; errLines = {};
                paint(); persist();
            }
        });

        function section(title, body, cls) {
            return '<span class="cpp-o-head">' + esc(title) + '</span>\n' + '<span class="' + cls + '">' + esc(body) + '</span>\n';
        }
        function markErrors(text) {
            errLines = {};
            String(text).split('\n').forEach(function (l) {
                var m = /(?:prog\.cc|source|<source>|example\.cpp)[^:]*:(\d+):\d+:\s*(error|warning):\s*(.*)/.exec(l);
                if (m && (m[2] === 'error' || !errLines[+m[1]])) errLines[+m[1]] = m[2] + ': ' + m[3];
            });
            paint();
        }

        function run() {
            if (running) { running.abort(); return; }
            var ctrl = window.AbortController ? new AbortController() : null;
            running = ctrl || { abort: function () {} };
            var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
            var t0 = performance.now(), code = ta.value, input = stdin.value, std = stdSel.value;
            persist();
            panel.classList.add('cpp-busy');
            runBtn.innerHTML = '<u>S</u>top';
            stateEl.textContent = 'compiling…';
            out.innerHTML = '<span class="cpp-o-dim">Compiling with ' + esc(std.toUpperCase()) + '…</span>';
            var rain = startRain(panel.querySelector('.cpp-win-out'), out);
            var minShow = new Promise(function (r) { setTimeout(r, 1100); });   // let the rain be seen
            var signal = ctrl ? ctrl.signal : undefined;
            runWandbox(code, input, std, signal).catch(function (err) {
                if (err && err.name === 'AbortError') throw err;
                out.innerHTML = '<span class="cpp-o-dim">wandbox.org unavailable, trying godbolt.org…</span>';
                return runGodbolt(code, input, std, signal);
            }).then(function (res) {
                return minShow.then(function () { return res; });
            }, function (err) {
                return minShow.then(function () { throw err; });
            }).then(function (res) {
                rain.stop();
                var html = '';
                if (res.compiler) html += section(res.compiled ? 'compiler' : 'compile error', res.compiler, res.compiled ? 'cpp-o-warn' : 'cpp-o-err');
                if (res.compiled) {
                    html += section('stdout', res.stdout || '(no output)', res.stdout ? 'cpp-o-out' : 'cpp-o-dim');
                    if (res.stderr) html += section('stderr', res.stderr, 'cpp-o-err');
                    var ok = res.exit === '0' && !res.signal;
                    html += '<span class="' + (ok ? 'cpp-o-ok' : 'cpp-o-err') + '">' +
                        (res.signal ? 'killed by ' + esc(res.signal) : 'exit code ' + esc(res.exit || '?')) + '</span>';
                }
                html += '<span class="cpp-o-dim"> · ' + ((performance.now() - t0) / 1000).toFixed(1) + 's · ' + esc(res.service) + '</span>';
                out.innerHTML = html;
                markErrors(res.compiler);
                stateEl.textContent = res.compiled ? (res.exit === '0' ? 'finished' : 'exited ' + res.exit) : 'compile error';
            }).catch(function (err) {
                rain.stop();
                var aborted = err && err.name === 'AbortError';
                out.innerHTML = '<span class="cpp-o-err">' + (aborted ? 'Stopped (or timed out after ' + TIMEOUT_MS / 1000 + 's).' :
                    'Could not reach the online compiler: ' + esc(err && err.message || err) + '</span>\n<span class="cpp-o-dim">Check your connection and try again.') + '</span>';
                stateEl.textContent = aborted ? 'stopped' : 'offline';
            }).then(function () {
                clearTimeout(timer);
                running = null;
                panel.classList.remove('cpp-busy');
                runBtn.innerHTML = RUN_LABEL;
                out.scrollTop = 0;
            });
        }

        var win = initWindow(panel, function () { syncScroll(); });
        paint();
        caret();
    }

    // ---------------------------------------------------------------- window: move, resize, maximize
    var WIN_KEY = 'cppPlayground.win';
    function initWindow(panel, onChange) {
        var bar = panel.querySelector('.cpp-menubar'), grip = panel.querySelector('.cpp-resize');
        var maxIcon = panel.querySelector('[data-k="maxicon"]');
        var MIN_W = 340, MIN_H = 360, M = 8;
        var g = null, mode = 'dock', before = 'dock';
        try { var s = JSON.parse(localStorage.getItem(WIN_KEY)); if (s && s.g) { g = s.g; mode = s.mode || 'dock'; } } catch (_) { /* ignore */ }

        function canFloat() { return window.innerWidth > 1100; }
        function store() { try { localStorage.setItem(WIN_KEY, JSON.stringify({ mode: mode, g: g })); } catch (_) { /* ignore */ } }
        function clampG() {
            var vw = window.innerWidth, vh = window.innerHeight;
            g.w = Math.max(MIN_W, Math.min(vw - 2 * M, g.w));
            g.h = Math.max(MIN_H, Math.min(vh - 2 * M, g.h));
            g.x = Math.max(M - g.w + 120, Math.min(vw - 120, g.x));   // always keep a corner reachable
            g.y = Math.max(M, Math.min(vh - 40, g.y));
        }
        function apply() {
            panel.classList.toggle('cpp-float', mode === 'float');
            panel.classList.toggle('cpp-max', mode === 'max');
            if (mode === 'float') {
                clampG();
                panel.style.left = g.x + 'px'; panel.style.top = g.y + 'px';
                panel.style.width = g.w + 'px'; panel.style.height = g.h + 'px';
            } else {
                panel.style.left = panel.style.top = panel.style.width = panel.style.height = '';
            }
            maxIcon.textContent = mode === 'max' ? '↓' : '↑';
            document.documentElement.classList.toggle('cpp-maxed', mode === 'max');
            onChange();
        }
        function toFloat() {
            if (mode === 'float') return;
            var r = panel.getBoundingClientRect();
            g = { x: r.left, y: r.top, w: r.width, h: r.height };
            mode = 'float';
            apply();
        }
        if (mode === 'float' && !canFloat()) mode = 'dock';
        if (mode === 'max') mode = 'dock';
        apply();

        function drag(e, onMove) {
            e.preventDefault();
            var sx = e.clientX, sy = e.clientY, g0 = { x: g.x, y: g.y, w: g.w, h: g.h };
            var target = e.currentTarget;
            try { target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            panel.classList.add('cpp-moving');
            function move(ev) { onMove(ev.clientX - sx, ev.clientY - sy, g0); apply(); }
            function up() {
                target.removeEventListener('pointermove', move);
                target.removeEventListener('pointerup', up);
                target.removeEventListener('pointercancel', up);
                panel.classList.remove('cpp-moving');
                store();
            }
            target.addEventListener('pointermove', move);
            target.addEventListener('pointerup', up);
            target.addEventListener('pointercancel', up);
        }
        bar.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || e.target.closest('select, button, label') || mode === 'max' || !canFloat()) return;
            toFloat();
            drag(e, function (dx, dy, g0) { g.x = g0.x + dx; g.y = g0.y + dy; });
        });
        bar.addEventListener('dblclick', function (e) {
            if (!e.target.closest('select, button')) api.toggleMax();
        });
        grip.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || mode === 'max' || !canFloat()) return;
            toFloat();
            drag(e, function (dx, dy, g0) { g.w = g0.w + dx; g.h = g0.h + dy; });
        });
        window.addEventListener('resize', function () {
            if (mode === 'float' && !canFloat()) mode = 'dock';
            apply();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mode === 'max') api.toggleMax();
        });

        var api = {
            toggleMax: function () {
                if (mode === 'max') mode = before === 'float' && canFloat() && g ? 'float' : 'dock';
                else { before = mode; mode = 'max'; }
                apply(); store();
            },
            dock: function () { mode = 'dock'; apply(); store(); }
        };
        return api;
    }

    window.initCppEditor = initCppEditor;
})();
