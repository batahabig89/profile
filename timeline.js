/* Хийсэн ажлын дараалал — цагийн шугам. Профайлын Code Editor template ашиглана (бие даасан, дахин ашиглаж болно).
   render(host, profile): profile = profile-data.json (experience + careerDetails + extraExperience). */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ── Жижиг хөдөлгөөнт дүрслэлүүд ──
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
    return `<svg viewBox="0 0 120 70" aria-hidden="true"><line x1="0" y1="64" x2="120" y2="64" stroke="#334155"/><text x="2" y="9" font-size="7" fill="#94a3b8" font-family="monospace">60% → 100%</text>${lamps}</svg>`;
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

  function fmtYm(s) {
    if (!s) return '';
    if (/present|одоо/i.test(s)) return 'одоо';
    const [y, m] = String(s).split('-');
    return m ? `${y}.${String(m).padStart(2, '0')}` : y;
  }

  /** profile-data.json-ийн experience + PRESENTATION.experience / extraExperience → он цагийн дарааллаар картууд */
  /** Дэлгэрэнгүй: profile-data.json → careerDetails (компанийн нэрээр), extraExperience; хуучин P.experience-ийг ч ойлгоно */
  function details(profile, P) {
    if (P && (P.experience || P.extraExperience)) return { experience: P.experience || {}, extra: P.extraExperience || [] };
    return { experience: (profile && profile.careerDetails) || {}, extra: (profile && profile.extraExperience) || [] };
  }

  function items(profile, P) {
    const d = details(profile, P);
    const extra = d.experience;
    const jobs = ((profile && profile.experience) || []).slice().sort((a, b) => (a.duration.start < b.duration.start ? -1 : 1));
    const out = [];
    jobs.forEach((j) => {
      out.push({ company: j.company, role: j.role, start: j.duration.start, end: j.duration.end, description: j.description || [], x: extra[j.company] || {} });
      d.extra.filter((e) => e.after === j.company).forEach((e) =>
        out.push({ company: e.company, role: e.role, start: e.start, end: e.end, description: [], x: e, extra: true }),
      );
    });
    return out;
  }

  function render(host, profile, P) {
    if (!host) return 0;
    const list = items(profile, P);
    host.innerHTML = list
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
          ${x.badges && x.badges.length ? `<div class="badges">${x.badges.map((b) => `<span class="chip ${esc(b.tone || 'slate')}">${esc(b.text)}</span>`).join('')}</div>` : ''}
          ${hasArt ? `<div class="art art-${x.art}">${ART[x.art]()}</div>` : ''}
        </div></div>`;
      })
      .join('');
    return list.length;
  }

  window.CareerTimeline = { render, items, fmtYm, ART };
})();
