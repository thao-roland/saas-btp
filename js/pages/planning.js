// ============================================================
// Devisly — Planning chantier : vue calendrier semaine / mois
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { allPhases, isPhaseOverdue, PHASE_STATUS, CHANTIER_STATUS } from '../chantiers-store.js';
import { escapeHtml } from '../ui.js';

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Date locale au format YYYY-MM-DD (évite tout décalage de fuseau horaire)
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => iso(new Date());
function mondayOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function renderPlanning(ctx) {
  let view = 'month';            // 'month' | 'week'
  let cursor = new Date();       // date de référence affichée
  cursor.setHours(0, 0, 0, 0);

  // Phases datées des chantiers non terminés
  function plannablePhases() {
    return allPhases()
      .filter(({ chantier }) => chantier.status !== 'done')
      .filter(({ phase }) => phase.startDate)
      .map(({ phase, chantier }) => ({
        phase, chantier,
        from: phase.startDate,
        to: phase.endDate || phase.startDate,
      }));
  }

  // Phases présentes un jour donné (dayISO compris dans [from, to])
  function phasesOn(dayISO, list) {
    return list.filter(p => dayISO >= p.from && dayISO <= p.to);
  }

  function chip(p) {
    const overdue = isPhaseOverdue(p.phase);
    const color = overdue ? '#b91c1c' : (PHASE_STATUS[p.phase.status] || PHASE_STATUS.todo).cal;
    return `<div class="cal-chip" style="background:${color}"
      data-go="${p.chantier.id}" data-phase="${p.phase.id}"
      title="${escapeHtml(p.chantier.name)} — ${escapeHtml(p.phase.name)}">
      ${escapeHtml(p.phase.name)}</div>`;
  }

  function dayCell(date, list, dim) {
    const di = iso(date);
    const items = phasesOn(di, list);
    return `
    <div class="cal-cell ${dim ? 'dim' : ''} ${di === todayISO() ? 'today' : ''}">
      <div class="cal-daynum">${date.getDate()}</div>
      ${items.map(chip).join('')}
    </div>`;
  }

  function monthGrid() {
    const list = plannablePhases();
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = mondayOf(first);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      cells += dayCell(d, list, d.getMonth() !== cursor.getMonth());
    }
    return `<div class="cal-grid">
      ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells}
    </div>`;
  }

  function weekGrid() {
    const list = plannablePhases();
    const start = mondayOf(cursor);
    return `<div class="cal-week">
      ${DOW.map((d, i) => {
        const date = addDays(start, i);
        return `<div><div class="cal-dow">${d} ${date.getDate()}</div>${dayCell(date, list, false)}</div>`;
      }).join('')}
    </div>`;
  }

  function periodLabel() {
    if (view === 'month') return MONTHS[cursor.getMonth()] + ' ' + cursor.getFullYear();
    const s = mondayOf(cursor), e = addDays(s, 6);
    return `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 4)}. – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 4)}. ${e.getFullYear()}`;
  }

  function legend() {
    const items = Object.values(PHASE_STATUS).map(s =>
      `<span class="legend-row" style="font-size:.8rem"><span class="swatch" style="background:${s.cal}"></span>${s.label}</span>`);
    items.push(`<span class="legend-row" style="font-size:.8rem"><span class="swatch" style="background:#b91c1c"></span>En retard</span>`);
    return `<div class="flex gap wrap-flex" style="margin-top:1rem">${items.join('')}</div>`;
  }

  function content() {
    const count = plannablePhases().length;
    return `
    <div class="page-head">
      <div><h2>Planning</h2><p>${count} phase${count > 1 ? 's' : ''} planifiée${count > 1 ? 's' : ''} sur les chantiers actifs</p></div>
      <div class="seg" data-view>
        <button data-v="week" class="${view === 'week' ? 'on' : ''}">Semaine</button>
        <button data-v="month" class="${view === 'month' ? 'on' : ''}">Mois</button>
      </div>
    </div>
    <div class="panel reveal">
      <div class="flex-between" style="margin-bottom:1rem">
        <div class="flex gap-sm items-center">
          <button class="icon-btn" data-prev>${icon('arrow')}</button>
          <button class="icon-btn" data-next style="transform:scaleX(-1)">${icon('arrow')}</button>
          <button class="btn btn-ghost btn-sm" data-today>Aujourd'hui</button>
        </div>
        <strong style="font-family:var(--font-display);font-size:1.1rem;text-transform:capitalize">${periodLabel()}</strong>
      </div>
      ${count ? (view === 'month' ? monthGrid() : weekGrid()) : `
        <div class="empty">
          <div class="e-icon">${icon('cal2')}</div>
          <h3 style="font-size:1.1rem">Aucune phase planifiée</h3>
          <p>Ajoutez des dates de début à vos phases de chantier pour les voir apparaître ici.</p>
        </div>`}
      ${count ? legend() : ''}
    </div>`;
  }

  function paint() {
    ctx.app.querySelector('.content').innerHTML = content();
    bindContent();
  }

  function bindContent() {
    ctx.app.querySelectorAll('[data-view] button').forEach(b => b.onclick = () => { view = b.dataset.v; paint(); });
    ctx.app.querySelector('[data-prev]').onclick = () => {
      if (view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      else cursor = addDays(cursor, -7);
      paint();
    };
    ctx.app.querySelector('[data-next]').onclick = () => {
      if (view === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      else cursor = addDays(cursor, 7);
      paint();
    };
    ctx.app.querySelector('[data-today]').onclick = () => { cursor = new Date(); cursor.setHours(0,0,0,0); paint(); };
    ctx.app.querySelectorAll('[data-go]').forEach(chip => chip.onclick = () => {
      ctx.navigate('#/app/chantiers/' + chip.dataset.go + '?phase=' + chip.dataset.phase);
    });
  }

  ctx.app.innerHTML = appLayout('planning', {
    title: 'Planning', sub: 'Calendrier des phases', content: content(),
  });
  bindAppLayout(ctx.app, ctx.navigate);
  bindContent();
}
