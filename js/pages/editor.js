// ============================================================
// Devisly — Éditeur de devis
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import {
  currentUser, getQuote, newQuote, saveQuote, getClient, saveClient,
  computeQuote, SECTION_TYPES, TVA_RATES, canCreateQuote, saveLibraryItem,
} from '../store.js';
import { eur, num, escapeHtml, toast, modal, confirmDialog, statusBadge } from '../ui.js';
import { renderQuoteDoc } from '../doc.js';
import { exportPDF, exportExcel, exportWord } from '../exports.js';
import { QUOTE_STATUS } from '../store.js';

export function renderEditor(ctx) {
  const u = currentUser();
  const isNew = !ctx.params.id;

  if (isNew && !canCreateQuote(u)) {
    toast('Quota Starter atteint — passez au plan Pro pour des devis illimités.', 'err');
    ctx.navigate('#/app/account#abonnement');
    return;
  }

  let q = isNew ? newQuote() : getQuote(ctx.params.id);
  if (!q) { ctx.navigate('#/app/quotes'); return; }
  // copie de travail
  q = JSON.parse(JSON.stringify(q));
  let savedOnce = !isNew;

  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  function persist(silent) {
    saveQuote(q);
    savedOnce = true;
    if (!silent) toast('Devis enregistré.');
  }
  function autosave() { saveQuote(q); savedOnce = true; }

  // ---------- Sous-rendus ----------
  function clientSelect() {
    return `<select class="select" data-field="clientId">
      <option value="">— Sélectionner un client —</option>
      ${u.clients.map(c => `<option value="${c.id}" ${q.clientId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
    </select>`;
  }

  function lineRow(s, l) {
    const total = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
    return `
    <div class="line-row" data-line="${l.id}" data-sec="${s.id}">
      <div>
        <input class="input input-sm" data-l="designation" value="${escapeHtml(l.designation)}" placeholder="Désignation de la prestation">
        <input class="input input-sm" data-l="detail" value="${escapeHtml(l.detail || '')}" placeholder="Détail (optionnel)" style="margin-top:.3rem;font-size:.8rem">
      </div>
      <input class="input input-sm" data-l="qty" type="number" step="0.01" min="0" value="${l.qty}">
      <input class="input input-sm" data-l="unit" value="${escapeHtml(l.unit || '')}" placeholder="u">
      <input class="input input-sm" data-l="unitPrice" type="number" step="0.01" min="0" value="${l.unitPrice}">
      <input class="input input-sm" data-l="marginCoef" type="number" step="0.01" min="1" value="${l.marginCoef}" title="Coefficient de marge">
      <select class="select input-sm" data-l="tva">
        ${TVA_RATES.map(t => `<option value="${t.rate}" ${Number(l.tva) === t.rate ? 'selected' : ''}>${num(t.rate, 1)} %</option>`).join('')}
      </select>
      <span class="line-total" data-line-total>${eur(total)}</span>
      <div style="display:flex;flex-direction:column;gap:2px">
        <button class="line-del" data-save-lib title="Enregistrer dans la bibliothèque" style="color:var(--accent-strong)">${icon('bookmark')}</button>
        <button class="line-del" data-del-line title="Supprimer la ligne">${icon('trash')}</button>
      </div>
    </div>`;
  }

  function sectionCard(s) {
    const meta = SECTION_TYPES[s.type];
    const st = s.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1), 0);
    return `
    <div class="card qsection reveal" data-section="${s.id}">
      <div class="qsection-head">
        <span class="qs-ic">${icon(meta.icon)}</span>
        <h3>${escapeHtml(meta.label)}</h3>
        <span class="qs-sum" data-sec-sum>${eur(st)} HT</span>
        <button class="icon-btn" data-del-section title="Retirer la section" style="width:32px;height:32px">${icon('x')}</button>
      </div>
      <div class="qsection-body">
        ${s.lines.length ? `
        <div class="line-row line-head">
          <span>Désignation</span><span>Qté</span><span>Unité</span><span>P.U. HT</span>
          <span>Coef.</span><span>TVA</span><span style="text-align:right">Total HT</span><span></span>
        </div>
        <div data-lines>${s.lines.map(l => lineRow(s, l)).join('')}</div>
        ` : `<p class="dim" style="font-size:.85rem;padding:.6rem 0">Aucune ligne dans cette section.</p>`}
        <div class="flex gap-sm" style="margin-top:.7rem">
          <button class="btn btn-ghost btn-sm" data-add-line>${icon('plus')} Ligne vierge</button>
          <button class="btn btn-ghost btn-sm" data-lib>${icon('library')} Depuis la bibliothèque</button>
        </div>
      </div>
    </div>`;
  }

  function totalsPanel() {
    const c = computeQuote(q);
    const payTotal = (q.payments || []).reduce((a, p) => a + (Number(p.percent) || 0), 0);
    return `
    <div class="panel" data-totals>
      <h3 style="font-size:1rem;font-family:var(--font-ui);font-weight:700;margin-bottom:.6rem">Récapitulatif</h3>
      <div class="totals-row"><span class="tr-lbl">Total HT brut</span><span>${eur(c.ht)}</span></div>
      <div class="totals-row">
        <span class="tr-lbl">Remise globale</span>
        <span class="flex items-center gap-sm">
          <input class="input input-sm" data-field="globalDiscount" type="number" min="0" max="100" step="0.5"
            value="${q.globalDiscount || 0}" style="width:62px;text-align:right"> %
        </span>
      </div>
      ${c.discount > 0 ? `<div class="totals-row"><span class="tr-lbl">Total HT net</span><span>${eur(c.htNet)}</span></div>` : ''}
      ${c.tvaLines.map(t => `
        <div class="totals-row"><span class="tr-lbl">TVA ${num(t.rate, 1)} % <span class="dim">· base ${eur(t.base)}</span></span><span>${eur(t.amount)}</span></div>`).join('')}
      <div class="totals-row grand"><span class="tr-lbl">Total TTC</span><span>${eur(c.ttc)}</span></div>
      <p class="dim" style="font-size:.72rem;margin-top:.7rem;line-height:1.5">
        <strong>HT</strong> = prix hors taxes &nbsp;·&nbsp; <strong>TVA</strong> = taxe ajoutée
        &nbsp;·&nbsp; <strong>TTC</strong> = montant final payé par le client.</p>
      ${payTotal !== 100 && q.payments?.length ? `
        <p class="field-err" style="margin-top:.5rem">${icon('warn')} Les versements totalisent ${num(payTotal, 1)} % au lieu de 100 %.</p>` : ''}
    </div>`;
  }

  function paymentsCard() {
    const ttc = computeQuote(q).ttc;
    const payTotal = (q.payments || []).reduce((a, p) => a + (Number(p.percent) || 0), 0);
    return `
    <div class="card card-pad reveal" data-pay-card>
      <div class="flex items-center gap-sm" style="margin-bottom:.4rem">
        <span class="qs-ic">${icon('wallet')}</span>
        <h3 style="font-size:1rem;font-family:var(--font-ui);font-weight:700">Comment le client paie</h3>
      </div>
      <p class="dim" style="font-size:.82rem;margin-bottom:.8rem">
        Découpez le règlement en plusieurs versements : un acompte à la signature, des
        paiements en cours de chantier, puis le solde à la fin. Indiquez la part de
        chaque versement en % — le montant en euros s'affiche automatiquement.</p>
      <div class="mini-list" data-pay-list>
        ${(q.payments || []).map((p, i) => `
          <div class="mini-row" data-pay="${i}">
            <input class="input input-sm mr-grow" data-p="label" value="${escapeHtml(p.label)}" placeholder="Ex. Acompte à la signature">
            <input class="input input-sm" data-p="percent" type="number" min="0" max="100" step="1" value="${p.percent}" style="width:62px;text-align:right">
            <span class="dim">%</span>
            <span data-pay-amount style="font-weight:700;font-size:.84rem;min-width:92px;text-align:right;white-space:nowrap">
              ${eur(ttc * (Number(p.percent) || 0) / 100)}</span>
            <button class="line-del" data-del-pay>${icon('trash')}</button>
          </div>`).join('')}
      </div>
      <div class="flex-between" style="margin-top:.7rem">
        <button class="btn btn-ghost btn-sm" data-add-pay>${icon('plus')} Ajouter un versement</button>
        <span class="badge ${payTotal === 100 ? 'green' : 'amber'} no-dot" data-pay-total>
          Total des parts : ${num(payTotal, 1)} %</span>
      </div>
    </div>`;
  }

  // ---------- Layout ----------
  function build() {
    const usedTypes = q.sections.map(s => s.type);
    const content = `
    <a href="#/app/quotes" class="btn btn-quiet btn-sm" style="margin-bottom:.8rem">${icon('arrow')} Retour aux devis</a>
    <div class="editor">
      <div class="editor-main">

        <div class="card card-pad reveal">
          <div class="flex-between wrap-flex gap" style="margin-bottom:1rem">
            <div>
              <div class="flex items-center gap-sm">
                <h2 style="font-size:1.4rem">${escapeHtml(q.number)}</h2>
                ${statusBadge(q.status, QUOTE_STATUS)}
              </div>
              <p class="dim" style="font-size:.84rem">Numérotation automatique au format BTP</p>
            </div>
          </div>
          <div class="field">
            <label>Objet du devis</label>
            <input class="input" data-field="title" value="${escapeHtml(q.title || '')}" placeholder="Ex. Rénovation complète salle de bain">
          </div>
          <div class="field-row cols-3" style="margin-top:1rem">
            <div class="field" style="margin:0">
              <label>Client</label>
              <div class="flex gap-sm">
                ${clientSelect()}
                <button class="icon-btn" data-new-client title="Nouveau client">${icon('plus')}</button>
              </div>
            </div>
            <div class="field" style="margin:0">
              <label>Date d'émission</label>
              <input class="input" data-field="date" type="date" value="${q.date}">
            </div>
            <div class="field" style="margin:0">
              <label>Valable jusqu'au</label>
              <input class="input" data-field="validUntil" type="date" value="${q.validUntil}">
            </div>
          </div>
        </div>

        <div data-sections>${q.sections.map(sectionCard).join('')}</div>

        <div class="card card-pad reveal" style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center">
          <span class="dim" style="font-size:.85rem;font-weight:600;margin-right:.3rem">Ajouter une section :</span>
          ${Object.entries(SECTION_TYPES).map(([type, m]) => `
            <button class="btn btn-ghost btn-sm" data-add-section="${type}" ${usedTypes.includes(type) ? 'disabled' : ''}>
              ${icon(m.icon)} ${escapeHtml(m.label)}</button>`).join('')}
        </div>

        ${paymentsCard()}

        <div class="card card-pad reveal">
          <div class="flex items-center gap-sm" style="margin-bottom:.7rem">
            <span class="qs-ic">${icon('clipboard')}</span>
            <h3 style="font-size:1rem;font-family:var(--font-ui);font-weight:700">Délais & conditions</h3>
          </div>
          <div class="field">
            <label>Délai d'exécution des travaux</label>
            <input class="input" data-field="execDelay" value="${escapeHtml(q.execDelay || '')}" placeholder="Ex. Démarrage sous 3 semaines, durée estimée 4 semaines">
          </div>
          <div class="field">
            <label>Conditions particulières & mentions légales</label>
            <textarea class="textarea" data-field="conditions" rows="4">${escapeHtml(q.conditions || '')}</textarea>
          </div>
          <div class="field">
            <label>Note interne / commentaire client</label>
            <textarea class="textarea" data-field="notes" rows="2" placeholder="Visible sur le devis">${escapeHtml(q.notes || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="editor-side">
        ${totalsPanel()}
        <div class="panel">
          <h3 style="font-size:1rem;font-family:var(--font-ui);font-weight:700;margin-bottom:.7rem">Actions</h3>
          <div class="stack">
            <button class="btn btn-primary btn-block" data-save>${icon('check')} Enregistrer le devis</button>
            <button class="btn btn-ghost btn-block" data-preview>${icon('eye')} Aperçu du document</button>
            <button class="btn btn-ghost btn-block" data-share>${icon('link')} Lien de partage client</button>
          </div>
          <div class="dropdown" style="margin-top:.6rem">
            <button class="btn btn-ghost btn-block" data-export>${icon('download')} Exporter ${icon('chevDown')}</button>
          </div>
          <div class="dropdown" style="margin-top:.6rem">
            <label class="lbl">Statut du devis</label>
            <select class="select" data-field="status">
              ${Object.entries(QUOTE_STATUS).map(([k, v]) =>
                `<option value="${k}" ${q.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="panel" style="background:var(--surface-2)">
          <div class="flex items-center gap-sm">
            <span style="color:var(--accent-strong)">${icon('info')}</span>
            <strong style="font-size:.86rem">Marge & TVA</strong>
          </div>
          <p class="dim" style="font-size:.8rem;margin-top:.5rem">
            Le coefficient de marge multiplie le prix unitaire (1,15 = +15 %).
            La TVA se règle ligne par ligne selon la nature des travaux.</p>
        </div>
      </div>
    </div>`;

    ctx.app.innerHTML = appLayout('quotes', {
      title: isNew ? 'Nouveau devis' : 'Édition du devis',
      sub: q.number, content,
    });
    bindAppLayout(ctx.app, ctx.navigate);
    bind();
    // Les cartes portent la classe `reveal` (animation d'entrée). Elle n'est
    // déclenchée qu'au 1er rendu par le routeur ; sur les re-rendus partiels
    // on la retire pour que les sections restent visibles immédiatement.
    ctx.app.querySelectorAll('.reveal').forEach(e => e.classList.remove('reveal'));
  }

  // ---------- Mises à jour ciblées ----------
  function refreshTotals() {
    const host = ctx.app.querySelector('[data-totals]');
    if (host) host.outerHTML = totalsPanel();
    bindTotals();
  }
  function refreshSection(secId) {
    const s = q.sections.find(x => x.id === secId);
    const el = ctx.app.querySelector(`[data-section="${secId}"]`);
    if (s && el) {
      el.outerHTML = sectionCard(s);
      const fresh = ctx.app.querySelector(`[data-section="${secId}"]`);
      fresh.classList.remove('reveal');
      bindSection(fresh);
    }
    refreshTotals();
  }
  function refreshPayments() {
    const el = ctx.app.querySelector('[data-pay-card]');
    if (el) {
      el.outerHTML = paymentsCard();
      ctx.app.querySelector('[data-pay-card]').classList.remove('reveal');
      bindPayments();
    }
    refreshTotals();
  }

  // ---------- Bindings ----------
  function bindField(el) {
    el.addEventListener('input', () => {
      const f = el.dataset.field;
      q[f] = el.type === 'number' ? Number(el.value) : el.value;
      if (f === 'globalDiscount') refreshTotals();
      autosave();
    });
  }

  function bindSection(card) {
    const secId = card.dataset.section;
    const s = q.sections.find(x => x.id === secId);

    card.querySelector('[data-del-section]').onclick = async () => {
      if (s.lines.length && !await confirmDialog({
        title: 'Retirer la section', message: 'Cette section et ses lignes seront supprimées du devis.',
        confirmLabel: 'Retirer', danger: true })) return;
      q.sections = q.sections.filter(x => x.id !== secId);
      card.remove();
      refreshTotals();
      ctx.app.querySelectorAll(`[data-add-section="${s.type}"]`).forEach(b => b.disabled = false);
      autosave();
    };

    card.querySelector('[data-add-line]').onclick = () => {
      s.lines.push({ id: uid('ln'), designation: '', detail: '', unit: SECTION_TYPES[s.type].defaultUnit,
        qty: 1, unitPrice: 0, marginCoef: u.settings.defaultMargin, tva: u.settings.defaultTva });
      refreshSection(secId);
      autosave();
    };

    card.querySelector('[data-lib]').onclick = () => openLibrary(s);

    card.querySelectorAll('[data-line]').forEach(row => {
      const lineId = row.dataset.line;
      const line = s.lines.find(x => x.id === lineId);
      row.querySelectorAll('[data-l]').forEach(inp => {
        inp.addEventListener('input', () => {
          const k = inp.dataset.l;
          line[k] = (inp.type === 'number') ? Number(inp.value) : inp.value;
          const t = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0) * (Number(line.marginCoef) || 1);
          row.querySelector('[data-line-total]').textContent = eur(t);
          const sum = s.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1), 0);
          card.querySelector('[data-sec-sum]').textContent = eur(sum) + ' HT';
          refreshTotals();
          autosave();
        });
      });
      row.querySelector('[data-del-line]').onclick = () => {
        s.lines = s.lines.filter(x => x.id !== lineId);
        refreshSection(secId);
        autosave();
      };
      row.querySelector('[data-save-lib]').onclick = () => {
        if (!line.designation) { toast('Renseignez la désignation avant d\'enregistrer.', 'err'); return; }
        saveLibraryItem({ label: line.designation, unit: line.unit, price: line.unitPrice, section: s.type, cat: 'Mes prestations' });
        toast('Prestation ajoutée à la bibliothèque.');
      };
    });
  }

  function bindPayments() {
    const card = ctx.app.querySelector('[data-pay-card]');
    card.querySelector('[data-add-pay]').onclick = () => {
      q.payments = q.payments || [];
      q.payments.push({ label: 'Nouveau versement', percent: 0 });
      refreshPayments(); autosave();
    };
    card.querySelectorAll('[data-pay]').forEach(row => {
      const i = Number(row.dataset.pay);
      row.querySelectorAll('[data-p]').forEach(inp => {
        inp.addEventListener('input', () => {
          q.payments[i][inp.dataset.p] = inp.type === 'number' ? Number(inp.value) : inp.value;
          // Met à jour en direct le montant € de la tranche et le total des parts
          if (inp.dataset.p === 'percent') {
            const c = computeQuote(q);
            const amt = row.querySelector('[data-pay-amount]');
            if (amt) amt.textContent = eur(c.ttc * (Number(inp.value) || 0) / 100);
            const total = q.payments.reduce((a, p) => a + (Number(p.percent) || 0), 0);
            const badge = card.querySelector('[data-pay-total]');
            if (badge) {
              badge.textContent = 'Total des parts : ' + num(total, 1) + ' %';
              badge.className = 'badge ' + (total === 100 ? 'green' : 'amber') + ' no-dot';
            }
          }
          refreshTotals(); autosave();
        });
      });
      row.querySelector('[data-del-pay]').onclick = () => {
        q.payments.splice(i, 1); refreshPayments(); autosave();
      };
    });
  }

  function bindTotals() {
    const el = ctx.app.querySelector('[data-totals] [data-field]');
    if (el) bindField(el);
  }

  function bind() {
    ctx.app.querySelectorAll('.editor-main > .card [data-field], .editor-side [data-field]')
      .forEach(el => { if (!el.closest('[data-totals]')) bindField(el); });
    bindTotals();

    ctx.app.querySelectorAll('[data-section]').forEach(bindSection);
    bindPayments();

    ctx.app.querySelectorAll('[data-add-section]').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      const type = b.dataset.addSection;
      const s = { id: uid('sec'), type, label: SECTION_TYPES[type].label, lines: [] };
      q.sections.push(s);
      // Ajout fluide : on insère la nouvelle section sans reconstruire la page
      const host = ctx.app.querySelector('[data-sections]');
      host.insertAdjacentHTML('beforeend', sectionCard(s));
      const newSec = ctx.app.querySelector(`[data-section="${s.id}"]`);
      newSec.classList.remove('reveal');   // visible immédiatement
      bindSection(newSec);
      b.disabled = true;
      refreshTotals();
      autosave();
      newSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    ctx.app.querySelector('[data-new-client]').onclick = () => openNewClient();

    ctx.app.querySelector('[data-save]').onclick = () => { persist(); };
    ctx.app.querySelector('[data-preview]').onclick = () => openPreview();
    ctx.app.querySelector('[data-share]').onclick = () => openShare();

    const exportBtn = ctx.app.querySelector('[data-export]');
    exportBtn.onclick = (e) => {
      e.stopPropagation();
      autosave();
      document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
      const menu = document.createElement('div');
      menu.className = 'dropdown-menu';
      menu.style.width = 'calc(100% - 2rem)';
      menu.innerHTML = `
        <button data-x="pdf">${icon('pdf')} Export PDF</button>
        <button data-x="excel">${icon('excel')} Export Excel</button>
        <button data-x="word">${icon('word')} Export Word</button>`;
      exportBtn.parentElement.appendChild(menu);
      const client = getClient(q.clientId);
      menu.querySelectorAll('button').forEach(bb => bb.onclick = () => {
        menu.remove();
        if (bb.dataset.x === 'pdf') exportPDF(q, u, client);
        if (bb.dataset.x === 'excel') exportExcel(q, u, client);
        if (bb.dataset.x === 'word') exportWord(q, u, client);
        toast('Export généré.');
      });
      setTimeout(() => document.addEventListener('click', function off() { menu.remove(); document.removeEventListener('click', off); }, { once: true }));
    };
  }

  // ---------- Bibliothèque ----------
  function openLibrary(section) {
    const list = u.library;
    modal({
      title: 'Bibliothèque de prestations', size: 'lg',
      body: `
        <div class="search" style="margin-bottom:1rem">
          ${icon('search')}<input id="lib-search" placeholder="Rechercher une prestation...">
        </div>
        <div id="lib-list" class="stack" style="max-height:50vh;overflow:auto"></div>
        ${list.length === 0 ? '<p class="dim">Votre bibliothèque est vide. Ajoutez des prestations depuis le menu Bibliothèque.</p>' : ''}`,
      onMount(el, close) {
        const listEl = el.querySelector('#lib-list');
        const draw = (filter = '') => {
          const f = filter.toLowerCase();
          const items = list.filter(p => p.label.toLowerCase().includes(f) || (p.cat || '').toLowerCase().includes(f));
          listEl.innerHTML = items.map(p => `
            <div class="lib-item" data-p="${p.id}">
              <span class="li-cat">${icon(SECTION_TYPES[p.section]?.icon || 'brick')}</span>
              <div class="li-meta">
                <div class="li-name">${escapeHtml(p.label)}</div>
                <div class="li-sub">${escapeHtml(p.cat || '')} · ${escapeHtml(SECTION_TYPES[p.section]?.label || '')}</div>
              </div>
              <span class="li-price">${eur(p.price)} / ${escapeHtml(p.unit)}</span>
            </div>`).join('') || '<p class="dim">Aucun résultat.</p>';
          listEl.querySelectorAll('[data-p]').forEach(it => it.onclick = () => {
            const p = list.find(x => x.id === it.dataset.p);
            section.lines.push({ id: uid('ln'), designation: p.label, detail: '', unit: p.unit,
              qty: 1, unitPrice: p.price, marginCoef: u.settings.defaultMargin, tva: u.settings.defaultTva });
            refreshSection(section.id);
            autosave();
            toast('Prestation ajoutée au devis.');
            close();
          });
        };
        draw();
        el.querySelector('#lib-search').addEventListener('input', e => draw(e.target.value));
      },
    });
  }

  // ---------- Nouveau client ----------
  function openNewClient() {
    modal({
      title: 'Nouveau client',
      body: `
        <div class="field"><label>Nom / raison sociale *</label><input class="input" id="c-name"></div>
        <div class="field"><label>Personne de contact</label><input class="input" id="c-contact"></div>
        <div class="field-row cols-2"><div class="field" style="margin:0"><label>E-mail</label><input class="input" id="c-email" type="email"></div>
        <div class="field" style="margin:0"><label>Téléphone</label><input class="input" id="c-phone"></div></div>
        <div class="field"><label>Adresse</label><input class="input" id="c-address"></div>
        <div class="field-row cols-2"><div class="field" style="margin:0"><label>Code postal</label><input class="input" id="c-zip"></div>
        <div class="field" style="margin:0"><label>Ville</label><input class="input" id="c-city"></div></div>`,
      foot: `<button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn btn-primary" id="c-save">Créer le client</button>`,
      onMount(el, close) {
        el.querySelector('#c-save').onclick = () => {
          const name = el.querySelector('#c-name').value.trim();
          if (!name) { toast('Le nom du client est requis.', 'err'); return; }
          const c = saveClient({
            name, contact: el.querySelector('#c-contact').value.trim(),
            email: el.querySelector('#c-email').value.trim(), phone: el.querySelector('#c-phone').value.trim(),
            address: el.querySelector('#c-address').value.trim(), zip: el.querySelector('#c-zip').value.trim(),
            city: el.querySelector('#c-city').value.trim(), kind: 'pro',
          });
          q.clientId = c.id;
          build();
          autosave();
          toast('Client créé et associé au devis.');
          close();
        };
      },
    });
  }

  // ---------- Aperçu ----------
  function openPreview() {
    autosave();
    modal({
      title: 'Aperçu du devis', size: 'lg',
      body: `<div style="transform-origin:top center">${renderQuoteDoc(q, u, getClient(q.clientId))}</div>`,
      foot: `<button class="btn btn-ghost" data-close>Fermer</button>
             <button class="btn btn-primary" id="pv-pdf">${icon('pdf')} Télécharger en PDF</button>`,
      onMount(el) { el.querySelector('#pv-pdf').onclick = () => exportPDF(q, u, getClient(q.clientId)); },
    });
  }

  // ---------- Partage ----------
  function openShare() {
    autosave();
    const url = location.origin + location.pathname + '#/share/' + q.shareToken;
    modal({
      title: 'Partager le devis avec le client',
      body: `
        <p class="muted" style="font-size:.9rem">Envoyez ce lien à votre client : il pourra consulter le devis
        et l'accepter ou le refuser en ligne. Vous serez notifié de sa réponse.</p>
        <div class="field" style="margin-top:1rem">
          <label>Lien de visualisation unique</label>
          <div class="flex gap-sm">
            <input class="input" id="share-url" value="${url}" readonly>
            <button class="btn btn-primary" id="copy-url">${icon('copy')} Copier</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="mail-client" style="margin-top:1rem">
          ${icon('mail')} Préparer l'e-mail récapitulatif</button>`,
      onMount(el) {
        el.querySelector('#copy-url').onclick = () => {
          const inp = el.querySelector('#share-url');
          inp.select();
          navigator.clipboard?.writeText(inp.value).catch(() => document.execCommand('copy'));
          toast('Lien copié dans le presse-papier.');
        };
        el.querySelector('#mail-client').onclick = () => {
          const client = getClient(q.clientId);
          const c = computeQuote(q);
          const subject = `Votre devis ${q.number} — ${u.company.name}`;
          const body = `Bonjour,\n\nVeuillez trouver ci-dessous le récapitulatif de votre devis ${q.number}` +
            (q.title ? ` : ${q.title}` : '') + `.\n\nMontant total : ${eur(c.ttc)} TTC\n` +
            `Validité : jusqu'au ${q.validUntil}\n\n` +
            `Consulter et signer le devis en ligne :\n${url}\n\nCordialement,\n${u.company.name}`;
          window.location.href = `mailto:${client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          if (q.status === 'draft') { q.status = 'sent'; autosave(); }
          toast('E-mail récapitulatif préparé.');
        };
      },
    });
  }

  build();
}
