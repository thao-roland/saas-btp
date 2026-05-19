// ============================================================
// Devisly — Chantiers : liste + tableau de bord résumé
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, getClient } from '../store.js';
import {
  getChantiers, createChantier, addPhase, deleteChantier,
  CHANTIER_STATUS, chantierProgress, DEFAULT_PHASES,
} from '../chantiers-store.js';
import { eur, eur0, dateFR, escapeHtml, statusBadge, toast, modal, confirmDialog } from '../ui.js';

export function renderChantiers(ctx) {
  const u = currentUser();
  let filter = 'all';

  function clientName(id) {
    const c = getClient(id);
    return c ? c.name : 'Client non renseigné';
  }

  // ---------- Formulaire de création ----------
  function openCreate() {
    const clients = u.clients;
    modal({
      title: 'Nouveau chantier',
      body: `
        <div class="field"><label>Nom du chantier *</label>
          <input class="input" id="ch-name" placeholder="Ex. Rénovation appartement Garibaldi"></div>
        <div class="field"><label>Client</label>
          <select class="select" id="ch-client">
            <option value="">— Sélectionner un client —</option>
            ${clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
          ${clients.length ? '' : '<div class="hint">Aucun client — ajoutez-en un dans le carnet de clients.</div>'}
        </div>
        <div class="field"><label>Adresse du chantier</label>
          <input class="input" id="ch-address" placeholder="N°, rue, code postal, ville"></div>
        <div class="field-row cols-2">
          <div class="field" style="margin:0"><label>Date de début</label>
            <input class="input" id="ch-start" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field" style="margin:0"><label>Fin prévue</label>
            <input class="input" id="ch-end" type="date"></div>
        </div>
        <div class="field-row cols-2">
          <div class="field" style="margin:0"><label>Budget total alloué (€)</label>
            <input class="input" id="ch-budget" type="number" min="0" step="100" value="0"></div>
          <div class="field" style="margin:0"><label>Statut initial</label>
            <select class="select" id="ch-status">
              ${Object.entries(CHANTIER_STATUS).map(([k, v]) =>
                `<option value="${k}" ${k === 'pending' ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select></div>
        </div>
        <label class="checkrow" style="margin-top:1rem">
          <input type="checkbox" id="ch-phases" checked>
          <span style="font-size:.86rem;color:var(--ink-2)">Pré-remplir avec les 8 phases types d'un chantier BTP</span>
        </label>`,
      foot: `<button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn btn-primary" id="ch-save">${icon('plus')} Créer le chantier</button>`,
      onMount(el, close) {
        el.querySelector('#ch-save').onclick = () => {
          const name = el.querySelector('#ch-name').value.trim();
          if (!name) { toast('Le nom du chantier est requis.', 'err'); return; }
          const c = createChantier({
            name,
            clientId: el.querySelector('#ch-client').value,
            address: el.querySelector('#ch-address').value.trim(),
            startDate: el.querySelector('#ch-start').value,
            endDate: el.querySelector('#ch-end').value,
            budget: el.querySelector('#ch-budget').value,
            status: el.querySelector('#ch-status').value,
          });
          if (el.querySelector('#ch-phases').checked) {
            DEFAULT_PHASES.forEach(n => addPhase(c.id, { name: n }));
          }
          toast('Chantier créé.');
          close();
          ctx.navigate('#/app/chantiers/' + c.id);
        };
      },
    });
  }

  // ---------- Rendu ----------
  function chantierCard(c) {
    const pct = chantierProgress(c);
    const st = CHANTIER_STATUS[c.status] || CHANTIER_STATUS.pending;
    const phases = c.phases || [];
    return `
    <div class="card card-pad reveal" data-ch="${c.id}" style="cursor:pointer">
      <div class="flex-between gap" style="align-items:flex-start">
        <div style="min-width:0">
          <div class="flex items-center gap-sm" style="flex-wrap:wrap">
            <h3 style="font-size:1.1rem;font-family:var(--font-ui);font-weight:700">${escapeHtml(c.name)}</h3>
            ${statusBadge(c.status, CHANTIER_STATUS)}
          </div>
          <div class="dim" style="font-size:.84rem;margin-top:.2rem">${escapeHtml(clientName(c.clientId))}</div>
        </div>
        <button class="icon-btn" data-del="${c.id}" style="width:34px;height:34px">${icon('trash')}</button>
      </div>
      <div class="ch-meta" style="margin-top:.9rem">
        ${c.address ? `<span>${icon('pin')} ${escapeHtml(c.address)}</span>` : ''}
        <span>${icon('calendar')} ${dateFR(c.startDate)}${c.endDate ? ' → ' + dateFR(c.endDate) : ''}</span>
        ${c.budget ? `<span>${icon('euro')} <b>${eur0(c.budget)}</b></span>` : ''}
      </div>
      <div style="margin-top:1rem">
        <div class="flex-between" style="font-size:.8rem;margin-bottom:.35rem">
          <span class="muted">Avancement — ${phases.filter(p => ['done','validated'].includes(p.status)).length}/${phases.length} phases</span>
          <strong>${pct} %</strong>
        </div>
        <div class="progress progress-lg"><div style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }

  function summary() {
    const list = getChantiers();
    const byStatus = {};
    Object.keys(CHANTIER_STATUS).forEach(k => byStatus[k] = list.filter(c => c.status === k).length);
    const caEnCours = list.filter(c => c.status === 'ongoing').reduce((s, c) => s + (c.budget || 0), 0);
    const cards = [
      ['pending', 'clock', '#1d4ed8', 'var(--info-soft)'],
      ['ongoing', 'crane', '#b45309', 'var(--accent-soft)'],
      ['paused', 'warn', '#b45309', 'var(--warn-soft)'],
      ['done', 'checkCircle', '#15803d', 'var(--ok-soft)'],
    ];
    return `
    <div class="stat-grid">
      ${cards.map(([k, ic, col, soft]) => `
        <div class="stat reveal">
          <div class="s-top"><div class="s-icon" style="background:${soft};color:${col}">${icon(ic)}</div></div>
          <div class="s-val">${byStatus[k]}</div>
          <div class="s-lbl">${CHANTIER_STATUS[k].label}</div>
        </div>`).join('')}
    </div>
    <div class="panel reveal" style="margin-top:1rem;display:flex;align-items:center;gap:1rem;
      background:linear-gradient(160deg,var(--surface),var(--accent-soft))">
      <span class="s-icon" style="background:var(--accent);color:#fff;width:42px;height:42px">${icon('euro')}</span>
      <div>
        <div style="font-family:var(--font-display);font-size:1.7rem;font-weight:600">${eur(caEnCours)}</div>
        <div class="dim" style="font-size:.85rem">Budget cumulé des chantiers en cours</div>
      </div>
    </div>`;
  }

  function content() {
    let list = getChantiers();
    if (filter !== 'all') list = list.filter(c => c.status === filter);
    const total = getChantiers().length;

    return `
    <div class="page-head">
      <div><h2>Suivi de chantier</h2><p>${total} chantier${total > 1 ? 's' : ''} · phases, photos et validations client</p></div>
      <button class="btn btn-primary" data-add>${icon('plus')} Nouveau chantier</button>
    </div>
    ${total ? summary() : ''}
    ${total ? `
      <div class="toolbar" style="margin-top:1.4rem">
        <div class="seg" data-filter>
          <button data-f="all" class="${filter === 'all' ? 'on' : ''}">Tous (${total})</button>
          ${Object.entries(CHANTIER_STATUS).map(([k, v]) => {
            const n = getChantiers().filter(c => c.status === k).length;
            return n ? `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${v.label} (${n})</button>` : '';
          }).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:1rem" data-list>
        ${list.map(chantierCard).join('') || '<p class="dim">Aucun chantier pour ce filtre.</p>'}
      </div>
    ` : `
      <div class="card empty">
        <div class="e-icon">${icon('crane')}</div>
        <h3>Aucun chantier pour le moment</h3>
        <p>Créez votre premier chantier : découpez-le en phases, suivez l'avancement, ajoutez des photos et faites valider chaque étape par votre client.</p>
        <button class="btn btn-primary" data-add>${icon('plus')} Créer un chantier</button>
      </div>`}`;
  }

  function paint() {
    ctx.app.querySelector('.content').innerHTML = content();
    bindContent();
  }

  function bindContent() {
    ctx.app.querySelectorAll('[data-add]').forEach(b => b.onclick = openCreate);
    ctx.app.querySelectorAll('[data-filter] button').forEach(b => b.onclick = () => {
      filter = b.dataset.f; paint();
    });
    ctx.app.querySelectorAll('[data-ch]').forEach(card => card.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      ctx.navigate('#/app/chantiers/' + card.dataset.ch);
    });
    ctx.app.querySelectorAll('[data-del]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const c = getChantiers().find(x => x.id === b.dataset.del);
      if (await confirmDialog({
        title: 'Supprimer le chantier',
        message: `« ${c.name} », ses phases et ses photos seront définitivement supprimés.`,
        confirmLabel: 'Supprimer', danger: true,
      })) { deleteChantier(c.id); toast('Chantier supprimé.'); paint(); }
    });
  }

  ctx.app.innerHTML = appLayout('chantiers', {
    title: 'Suivi de chantier', sub: 'Chantiers, phases & validations', content: content(),
  });
  bindAppLayout(ctx.app, ctx.navigate);
  bindContent();
}
