/* 5 минутын танилцуулга — presentation.html. Агуулга: presentation-data.js, намтар: profile-data.json */
(function () {
  const P = window.PRESENTATION;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ── Сайтын хаяг: localhost дээр local, бусад үед remote; ?site=local|remote хүчилнэ ──
  const params = new URLSearchParams(location.search);
  const isLocalHost = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  let siteMode = params.get('site') || localStorage.getItem('presentation.site') || (isLocalHost ? 'local' : 'remote');
  const siteUrl = (key, hash) => {
    const s = P.sites[key];
    const base = s[siteMode] || s.remote;
    return hash ? `${base}#${hash}` : base;
  };

  // ── Жижиг хөдөлгөөнт дүрслэлүүд (цагийн шугамын картуудад) ──
  const LIGHT_COLORS = ['#fbbf24', '#fb7185', '#38bdf8', '#4ec9b0', '#a78bfa'];
  function towerArt() {
    // Улаанбаатарын телевизийн цамхаг — ирмэг дагуух гэрлэн чимэглэл анивчина
    const lights = [];
    let i = 0;
    for (let t = 0; t <= 1.001; t += 1 / 6) {
      const y = 12 + 54 * t;
      const dx = 14 * t;
      for (const x of t === 0 ? [60] : [60 - dx, 60 + dx]) {
        lights.push(`<circle class="l" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7" style="--i:${i};--c:${LIGHT_COLORS[i % LIGHT_COLORS.length]}"/>`);
        i++;
      }
    }
    const wins = [[9, 44, 1], [14, 44, 4], [9, 50, 2], [14, 56, 6], [27, 52, 3], [27, 58, 5], [89, 48, 2], [94, 54, 7], [105, 40, 1], [110, 46, 4], [105, 58, 6], [110, 52, 3]]
      .map(([x, y, d]) => `<rect class="w" x="${x}" y="${y}" width="2" height="2" style="--i:${d}"/>`)
      .join('');
    return `<svg viewBox="0 0 120 70" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <g fill="#0f172a" stroke="#334155" stroke-width=".6"><rect x="6" y="40" width="14" height="26"/><rect x="24" y="48" width="10" height="18"/><rect x="86" y="44" width="12" height="22"/><rect x="102" y="36" width="12" height="30"/></g>
      <g fill="#fbbf24">${wins}</g>
      <line x1="60" y1="2" x2="60" y2="12" stroke="#cbd5e1" stroke-width="1.2"/>
      <circle class="beacon" cx="60" cy="3" r="1.6"/>
      <path d="M60 12 L54 36 L46 66 L74 66 L66 36 Z" fill="#0b1220" stroke="#64748b" stroke-width="1"/>
      <path d="M57 24h6M55 32h10M52 44h16M50 52h20M48 60h24" stroke="#475569" stroke-width=".7"/>
      <path d="M60 12l-3 12h6l-5 8h10l-8 12h16l-12 8h20l-14 8h24" fill="none" stroke="#475569" stroke-width=".5"/>
      <circle class="halo" cx="60" cy="36" r="11"/>
      <rect x="51" y="34" width="18" height="4" rx="1" fill="#1e293b" stroke="#94a3b8" stroke-width=".8"/>
      <g>${lights.join('')}</g>
      <rect x="0" y="66" width="120" height="2" fill="#1e293b"/>
    </svg>`;
  }
  function walleArt() {
    // Жижиг робот — мөрөөрөө явж, шоо руу очоод эргэнэ
    return `<svg viewBox="0 0 120 70" aria-hidden="true">
      <line x1="0" y1="64" x2="120" y2="64" stroke="#334155" stroke-width="1"/>
      <rect x="102" y="52" width="11" height="11" rx="1" fill="#475569" stroke="#64748b" stroke-width=".8"/>
      <path d="M102 56h11M106 52v11" stroke="#64748b" stroke-width=".5"/>
      <g class="bot">
        <rect class="track" x="4" y="50" width="34" height="12" rx="6" fill="#1f2937" stroke="#94a3b8" stroke-width="1"/>
        <rect x="9" y="36" width="24" height="18" rx="2" fill="#d6a84a" stroke="#8a6a1f" stroke-width="1"/>
        <rect x="12" y="40" width="18" height="6" rx="1" fill="#8a6a1f" opacity=".45"/>
        <rect class="arm" x="2" y="42" width="7" height="3" rx="1" fill="#9ca3af"/>
        <rect class="arm b" x="33" y="42" width="7" height="3" rx="1" fill="#9ca3af"/>
        <rect x="19" y="28" width="4" height="9" fill="#9ca3af"/>
        <g class="eyes">
          <rect x="11" y="22" width="9" height="8" rx="3" fill="#cbd5e1" stroke="#64748b" stroke-width=".8"/>
          <rect x="22" y="22" width="9" height="8" rx="3" fill="#cbd5e1" stroke="#64748b" stroke-width=".8"/>
          <circle cx="15.5" cy="26" r="2" fill="#0ea5e9"/><circle cx="26.5" cy="26" r="2" fill="#0ea5e9"/>
        </g>
      </g>
    </svg>`;
  }
  function lampsArt() {
    // Хотын гэрэлтүүлэг: 3 гэрэл асаалттай (60%), сүүлийн 2 нь асаж 100% болно
    const lamps = [12, 36, 60, 84, 108]
      .map(
        (x, i) =>
          `<g class="lamp ${i < 3 ? 'lit' : 'late'}" style="--d:${i - 3}"><line x1="${x}" y1="64" x2="${x}" y2="24" stroke="#64748b" stroke-width="1.4"/><line x1="${x}" y1="24" x2="${x + 6}" y2="24" stroke="#64748b" stroke-width="1.4"/><path class="cone" d="M${x + 7} 26 L${x - 2} 64 L${x + 16} 64 Z"/><circle class="bulb" cx="${x + 7}" cy="26" r="2.3"/></g>`,
      )
      .join('');
    return `<svg viewBox="0 0 120 70" aria-hidden="true"><line x1="0" y1="64" x2="120" y2="64" stroke="#334155"/><text x="2" y="9" font-size="7" fill="#94a3b8" font-family="monospace">60% → 100%</text><text class="pct" x="118" y="9" font-size="7" text-anchor="end" font-family="monospace"></text>${lamps}</svg>`;
  }
  function gateArt() {
    // Ухаалаг гарц — хаалт өргөгдөж машин 24 цаг нэвтэрнэ
    return `<svg viewBox="0 0 120 70" aria-hidden="true">
      <line x1="0" y1="64" x2="120" y2="64" stroke="#334155"/>
      <path d="M0 58h120" stroke="#1e293b" stroke-width="6"/><path d="M4 58h8M22 58h8M40 58h8M58 58h8M76 58h8M94 58h8M112 58h8" stroke="#475569" stroke-width="1" stroke-dasharray="4 4"/>
      <rect x="6" y="26" width="18" height="22" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <text x="15" y="39" font-size="6.5" fill="#38bdf8" text-anchor="middle" font-family="monospace">24h</text>
      <g class="car"><rect x="-26" y="44" width="22" height="9" rx="2" fill="#38bdf8"/><rect x="-21" y="40" width="12" height="5" rx="1.5" fill="#bae6fd"/><circle cx="-21" cy="54" r="2.4" fill="#0f172a" stroke="#94a3b8"/><circle cx="-9" cy="54" r="2.4" fill="#0f172a" stroke="#94a3b8"/></g>
      <rect x="34" y="36" width="5" height="22" rx="1" fill="#475569"/>
      <g class="arm"><rect x="36" y="38" width="52" height="3" rx="1.5" fill="#fbbf24"/><path d="M44 38h6v3h-6zM58 38h6v3h-6zM72 38h6v3h-6z" fill="#dc2626"/></g>
      <circle class="sig" cx="36.5" cy="34" r="2.2"/>
    </svg>`;
  }
  const ART = { tower: towerArt, walle: walleArt, lamps: lampsArt, gate: gateArt };

  // ── 1 · Intro ──
  function renderIntro(profile) {
    const info = profile?.personalInfo || {};
    const shown = info.nickname ? `${info.name} · ${info.nickname}` : info.name || 'Bataha';
    $('#introHead').innerHTML = P.intro.headline;
    $('#introLead').textContent = P.intro.lead;
    $('#introScript').innerHTML = P.intro.script.map((l) => `<li>${esc(l)}</li>`).join('');
    const facts = [];
    (profile?.platforms?.secondary || []).slice(0, 5).forEach((p) => facts.push(`<span class="chip slate">${esc(p)}</span>`));
    (profile?.profileTraits || []).forEach((t) => facts.push(`<span class="chip teal">${esc(t)}</span>`));
    $('#introFacts').innerHTML = facts.join('');
    const langs = profile?.programmingLanguages || [];
    const sk = profile?.workSkills || {};
    const tags = [...langs.join(', ').split(/,\s*/), ...(sk.cloud || []), ...(sk.database || []).slice(0, 4)].filter(Boolean);
    $('#skills').innerHTML = `<span class="lbl">STACK</span>` + [...new Set(tags)].map((t) => `<span class="chip slate">${esc(t)}</span>`).join('');
    $('#photoName').textContent = shown;
    $('#photoRole').textContent = info.title || '';
    $('#photoMeta').innerHTML = [info.location ? info.location.slice(0, 2).join(', ') : '', info.email, info.phone]
      .filter(Boolean)
      .map((m) => `<span class="chip slate">${esc(m)}</span>`)
      .join('');
    $('#brandName').textContent = info.nickname || info.name || 'Bataha';
    document.title = `${info.nickname || info.name || 'Bataha'} — 5 минутын танилцуулга`;
    $('#plan').innerHTML = visiblePlan()
      .map(
        (p, i) => `<li data-go="${p.id}"><b>0${i + 1}</b><span>${esc(p.label)}</span><span class="t">${mmss(p.from)} – ${mmss(p.to)}</span><span class="seg" style="--w:${Math.round(((p.to - p.from) / 300) * 100)}%"><i></i></span></li>`,
      )
      .join('');
  }

  // ── 2 · Боловсрол, туршлага (profile-data.json + presentation-data.js experience) ──
  function fmtYm(s) {
    if (!s) return '';
    if (/present|одоо/i.test(s)) return 'одоо';
    const [y, m] = s.split('-');
    return m ? `${y}.${String(m).padStart(2, '0')}` : y;
  }
  function renderBackground(profile) {
    const edu = profile?.education || [];
    $('#edu').innerHTML =
      edu
        .map(
          (e) => `<div class="card"><div class="ico">🎓</div><div><h4>${esc(e.field)}</h4><p>${esc(e.level)} · ${esc(e.institution)}</p><div class="yr">${esc(e.date)}${e.GPA ? ` · GPA ${esc(e.GPA)}` : ''}</div></div></div>`,
        )
        .join('') +
      (profile?.certifications?.length
        ? `<div class="cert">${profile.certifications.map((c) => `<span class="chip violet">${esc(c.name)} · ${esc(c.issuer)} ${esc(c.date)}</span>`).join('')}</div>`
        : '');

    const extra = P.experience || {};
    const jobs = (profile?.experience || []).slice().sort((a, b) => (a.duration.start < b.duration.start ? -1 : 1));
    const items = [];
    jobs.forEach((j) => {
      items.push({ company: j.company, role: j.role, start: j.duration.start, end: j.duration.end, description: j.description || [], x: extra[j.company] || {} });
      (P.extraExperience || [])
        .filter((e) => e.after === j.company)
        .forEach((e) => items.push({ company: e.company, role: e.role, start: e.start, end: e.end, description: [], x: e, extra: true }));
    });
    $('#timeline').innerHTML = items
      .map((j) => {
        const x = j.x;
        const projects = x.projects || (j.description.length ? [j.description.join(' · ')] : []);
        const now = /present|одоо/i.test(j.end);
        const yrs = j.start === j.end ? fmtYm(j.start) : `${fmtYm(j.start)} – ${fmtYm(j.end)}`;
        const hasArt = !!(x.art && ART[x.art]);
        return `<div class="job${now ? ' now' : ''}${j.extra ? ' extra' : ''}"><div class="card${hasArt ? ' has-art' : ''}">
          <div class="yrs">${yrs}</div>
          <h4>${esc(j.company)}</h4>
          <div class="role">${esc(x.role || j.role)}</div>
          ${projects.length ? `<ul class="pj">${projects.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
          ${x.badges?.length ? `<div class="badges">${x.badges.map((b) => `<span class="chip ${esc(b.tone || 'slate')}">${esc(b.text)}</span>`).join('')}</div>` : ''}
          ${hasArt ? `<div class="art art-${x.art}">${ART[x.art]()}</div>` : ''}
        </div></div>`;
      })
      .join('');

  }

  // ── 3 · Төслүүд ──
  function renderProjects() {
    $('#projectGrid').innerHTML = P.projects
      .map(
        (p) => `
      <article class="card project" data-site="${p.site}">
        <a class="shot" href="${siteUrl(p.site)}" target="_blank" rel="noopener" data-site-link="${p.site}">
          <img src="${p.image}" alt="${esc(p.title)}" loading="lazy">
          <span class="num">${p.n}</span>
          <span class="open">Танилцуулга нээх ↗</span>
        </a>
        <div class="body">
          <div class="meta"><b>${esc(p.period)}</b><span>${esc(p.org)}</span></div>
          <h3>${esc(p.title)}</h3>
          <p class="pitch">${esc(p.pitch)}</p>
          <ul class="results">${p.results.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
          <div class="tags">${p.tags.map((t) => `<span class="chip slate">${esc(t)}</span>`).join('')}</div>
          <div class="links">
            <a class="main" href="${siteUrl(p.site)}" target="_blank" rel="noopener" data-site-link="${p.site}">Нээх ↗</a>
            <span class="lbl">ХЭСЭГ:</span>
            ${p.links.map((l) => `<a href="${siteUrl(p.site, l.hash)}" target="_blank" rel="noopener" data-site-link="${p.site}" data-hash="${l.hash}">${esc(l.label)}</a>`).join('')}
          </div>
        </div>
      </article>`,
      )
      .join('');
    renderSiteBar();
  }
  function renderSiteBar() {
    const bar = $('#sitebar');
    bar.innerHTML = `<span>Холбоос:</span><span class="sw"><button data-mode="remote" class="${siteMode === 'remote' ? 'on' : ''}">GitHub Pages</button><button data-mode="local" class="${siteMode === 'local' ? 'on' : ''}">localhost</button></span><span class="notice">${siteMode === 'local' ? 'Локал серверүүд (3000 · 4173 · 4174) асаалттай байх ёстой' : 'Сайтуудыг GitHub Pages-д нийтэлсний дараа ажиллана'}</span>`;
    bar.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        siteMode = b.dataset.mode;
        localStorage.setItem('presentation.site', siteMode);
        document.querySelectorAll('[data-site-link]').forEach((a) => (a.href = siteUrl(a.dataset.siteLink, a.dataset.hash)));
        renderSiteBar();
      }),
    );
  }

  // ── 4 · Намайг сонгох 3 шалтгаан ──
  function renderWhy() {
    $('#whyTitle').innerHTML = P.why.title;
    $('#reasons').innerHTML = P.why.reasons
      .map(
        (r, i) => `<div class="card reason"><div class="big">${i + 1}</div><div class="rb"><h4>${esc(r.title)}</h4><p>${esc(r.desc)}</p>
          ${r.tags ? `<div class="tags">${r.tags.map((t) => `<span class="chip teal">${esc(t)}</span>`).join('')}</div>` : ''}
          ${r.link ? `<a class="rlink" href="${siteUrl(r.link.site, r.link.hash)}" target="_blank" rel="noopener" data-site-link="${r.link.site}" data-hash="${r.link.hash}">${esc(r.link.label)}</a>` : ''}
        </div></div>`,
      )
      .join('');
  }

  // ── 5 · Нэмэлт санал (хоосон бол хэсэг нуугдана) ──
  function renderProposal() {
    const list = P.proposals || [];
    if (!list.length) document.getElementById('proposal').remove();
    else $('#proposals').innerHTML = list.map((p, i) => `<div class="card proposal"><div class="k">САНАЛ 0${i + 1}</div><h4>${esc(p.title)}</h4><p>${esc(p.desc)}</p></div>`).join('');
    const sections = [...document.querySelectorAll('main section[id]')];
    sections[sections.length - 1].querySelector('.wrap').appendChild($('#closingWrap'));
    $('#closing').textContent = P.closing;
  }

  // Зөвхөн хуудсан дээр байгаа хэсгүүдийн хуваарь
  const visiblePlan = () => P.plan.filter((p) => document.getElementById(p.id));
  function renderMinutes() {
    visiblePlan().forEach((p) => {
      const el = document.querySelector(`[data-min="${p.id}"]`);
      if (el) el.textContent = `${mmss(p.from)} – ${mmss(p.to)}`;
    });
  }

  // ── Nav + timer ──
  function renderNav() {
    $('#topnav').innerHTML = visiblePlan()
      .map((p, i) => `<a href="#${p.id}" data-id="${p.id}"><b>0${i + 1}</b>${esc(p.label)}<span class="t">${mmss(p.to - p.from)}</span></a>`)
      .join('');
    const links = [...document.querySelectorAll('#topnav a')];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.dataset.id === e.target.id));
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    visiblePlan().forEach((p) => io.observe(document.getElementById(p.id)));
  }

  let t0 = null;
  let elapsedBefore = 0;
  let tick = null;
  const timerEl = () => $('#timer');
  function renderTimer() {
    const el = timerEl();
    const elapsed = elapsedBefore + (t0 ? (Date.now() - t0) / 1000 : 0);
    const left = 300 - elapsed;
    el.querySelector('.v').textContent = (left < 0 ? '-' : '') + mmss(Math.abs(left));
    el.querySelector('.bar i').style.width = `${Math.min(100, (elapsed / 300) * 100)}%`;
    el.classList.toggle('running', !!t0);
    el.classList.toggle('over', left < 0);
    const links = [...document.querySelectorAll('#topnav a')];
    visiblePlan().forEach((p, i) => links[i]?.classList.toggle('done', elapsed >= p.to));
  }
  function toggleTimer() {
    if (t0) {
      elapsedBefore += (Date.now() - t0) / 1000;
      t0 = null;
      clearInterval(tick);
    } else {
      t0 = Date.now();
      tick = setInterval(renderTimer, 500);
    }
    renderTimer();
  }
  function resetTimer() {
    t0 = null;
    elapsedBefore = 0;
    clearInterval(tick);
    renderTimer();
  }

  function go(delta) {
    const ids = visiblePlan().map((p) => p.id);
    const y = window.scrollY + 70;
    let cur = 0;
    ids.forEach((id, i) => {
      if (document.getElementById(id).offsetTop <= y) cur = i;
    });
    const next = Math.min(ids.length - 1, Math.max(0, cur + delta));
    document.getElementById(ids[next]).scrollIntoView({ behavior: 'smooth' });
  }

  async function main() {
    let profile = null;
    try {
      const r = await fetch('profile-data.json?v=' + Date.now(), { cache: 'no-store' });
      if (r.ok) profile = await r.json();
    } catch (e) {
      console.warn('profile-data.json уншигдсангүй:', e);
    }
    if (!profile) $('#bgNotice').textContent = 'profile-data.json уншигдсангүй — хавтсыг HTTP серверээр (жишээ нь python3 -m http.server) нээнэ үү.';
    renderProposal();
    renderMinutes();
    renderIntro(profile);
    renderBackground(profile);
    renderProjects();
    renderWhy();
    renderNav();
    renderTimer();
    timerEl().addEventListener('click', toggleTimer);
    timerEl().addEventListener('dblclick', resetTimer);
    $('#plan').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-go]');
      if (li) document.getElementById(li.dataset.go).scrollIntoView({ behavior: 'smooth' });
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key.toLowerCase() === 't') toggleTimer();
      else if (e.key.toLowerCase() === 'r') resetTimer();
    });
  }
  document.addEventListener('DOMContentLoaded', main);
})();
