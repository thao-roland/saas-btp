// ============================================================
// Devisly — Factures
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, getClient, computeQuote, save, convertToInvoice, QUOTE_STATUS, INVOICE_KINDS } from '../store.js';
import { eur, dateFR, escapeHtml, statusBadge, toast, modal, bindDropdown } from '../ui.js';
import { renderQuoteDoc } from '../doc.js';
import { exportPDF } from '../exports.js';

const INV_STATUS = {
  unpaid: { label: 'À encaisser', color: 'amber' },
  paid: { label: 'Payée', color: 'green' },
};

export function renderInvoices(ctx) {
  const u = currentUser();
  const total = (inv) => computeQuote(inv.snapshot).ttc;

  function docOpts(inv) {
    const titles = { acompte: "Facture d'acompte", situation: 'Facture de situation', solde: 'Facture de solde' };
    const opts = {
      kind: 'Facture',
      number: inv.number,
      date: inv.date,
      dueDate: inv.dueDate,
      paymentMethod: inv.paymentMethod || 'Virement bancaire',
    };
    if (inv.kind && inv.kind !== 'full') {
      opts.title = (titles[inv.kind] || 'Facture') + (inv.percent ? ' ' + inv.percent + ' %' : '');
    }
    return opts;
  }

  function openInvoice(inv) {
    const client = getClient(inv.clientId);
    modal({
      title: 'Facture ' + inv.number, size: 'lg',
      body: renderQuoteDoc(inv.snapshot, u, client, docOpts(inv)),
      foot: `<button class="btn btn-ghost" data-close>Fermer</button>
             <button class="btn btn-primary" id="inv-pdf">${icon('pdf')} Télécharger en PDF</button>`,
      onMount(el) {
        el.querySelector('#inv-pdf').onclick = () => exportPDF(inv.snapshot, u, client, docOpts(inv));
      },
    });
  }

  // Étape 2 : formulaire de paramètres de la facture (type, %, échéance, paiement)
  function openInvoiceForm(q) {
    const c = computeQuote(q);
    const cli = getClient(q.clientId);
    const today = new Date();
    const due30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    let kind = 'full';
    let percent = 100;

    const previewAmount = () => eur(c.ttc * percent / 100);
    const optionRow = (k, defaultPct, hint) => `
      <label class="checkrow" data-kind-row="${k}" style="border:1px solid var(--line);border-radius:var(--radius-md);padding:.75rem .9rem;cursor:pointer;${kind===k?'border-color:var(--accent);background:var(--accent-soft)':''}">
        <input type="radio" name="inv-kind" value="${k}" ${kind===k?'checked':''} data-default-pct="${defaultPct}">
        <span style="flex:1">
          <strong style="font-size:.92rem">${INVOICE_KINDS[k].title}</strong>
          <div class="dim" style="font-size:.78rem">${hint}</div>
        </span>
      </label>`;

    modal({
      title: 'Détails de la facture', size: 'lg',
      body: `
        <div class="card-pad" style="background:var(--surface-2);border-radius:var(--radius-md);margin-bottom:1.1rem">
          <div class="dim" style="font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Devis source</div>
          <strong style="font-size:.95rem">${escapeHtml(q.number)} — ${escapeHtml(q.title || 'Sans objet')}</strong>
          <div class="dim" style="font-size:.82rem">${escapeHtml(cli?.name || '—')} · Total : <strong>${eur(c.ttc)}</strong></div>
        </div>

        <div class="lbl">Type de facture</div>
        <div class="stack" style="margin-top:.4rem">
          ${optionRow('full', 100, 'Facturer la totalité du devis (100 %).')}
          ${optionRow('acompte', 30, 'Premier versement avant le démarrage.')}
          ${optionRow('situation', 40, 'Avancement en cours de chantier.')}
          ${optionRow('solde', 30, 'Solde à la fin des travaux.')}
        </div>

        <div class="field-row cols-2" style="margin-top:1rem" id="inv-partial-fields">
          <div class="field" style="margin:0">
            <label>Pourcentage à facturer</label>
            <div class="flex items-center gap-sm">
              <input class="input" id="inv-pct" type="number" min="1" max="100" step="1" value="${percent}">
              <span class="dim">%</span>
            </div>
            <div class="hint">Montant facturé : <strong id="inv-amount">${previewAmount()}</strong></div>
          </div>
          <div class="field" style="margin:0"></div>
        </div>

        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0">
            <label>Date d'échéance</label>
            <input class="input" id="inv-due" type="date" value="${due30}">
          </div>
          <div class="field" style="margin:0">
            <label>Mode de paiement</label>
            <input class="input" id="inv-pay" value="Virement bancaire" placeholder="Virement, chèque…">
          </div>
        </div>
        ${u.company.iban ? '' : `
          <div class="card-pad" style="margin-top:1rem;background:var(--warn-soft);border-radius:var(--radius-md)">
            <strong style="font-size:.84rem;color:var(--warn)">${icon('warn')} Aucun IBAN renseigné</strong>
            <p style="font-size:.8rem;margin-top:.3rem">Renseignez votre IBAN dans <a href="#/app/account" style="color:var(--accent-strong);font-weight:600;text-decoration:underline">Mon entreprise</a> pour qu'il s'affiche sur la facture.</p>
          </div>`}`,
      foot: `<button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn btn-primary" id="inv-create">${icon('check')} Créer la facture</button>`,
      onMount(el, close) {
        const pctInput = el.querySelector('#inv-pct');
        const amountEl = el.querySelector('#inv-amount');
        const partial = el.querySelector('#inv-partial-fields');

        const refreshKindUI = () => {
          el.querySelectorAll('[data-kind-row]').forEach(row => {
            const on = row.querySelector('input').checked;
            row.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
            row.style.background = on ? 'var(--accent-soft)' : 'transparent';
          });
          partial.style.opacity = kind === 'full' ? '.5' : '1';
          pctInput.disabled = kind === 'full';
        };
        const refreshAmount = () => { amountEl.textContent = eur(c.ttc * percent / 100); };
        refreshKindUI();

        el.querySelectorAll('input[name="inv-kind"]').forEach(r => r.onchange = () => {
          kind = r.value;
          percent = kind === 'full' ? 100 : Number(r.dataset.defaultPct);
          pctInput.value = percent;
          refreshKindUI();
          refreshAmount();
        });
        pctInput.oninput = () => {
          percent = Math.max(1, Math.min(100, Number(pctInput.value) || 0));
          refreshAmount();
        };

        el.querySelector('#inv-create').onclick = () => {
          const inv = convertToInvoice(q.id, {
            kind, percent,
            dueDate: el.querySelector('#inv-due').value,
            paymentMethod: el.querySelector('#inv-pay').value.trim() || 'Virement bancaire',
          });
          close();
          if (inv) { toast('Facture créée : ' + inv.number); paint(); }
        };
      },
    });
  }

  // Modal : choisir un devis à transformer en facture (aucun filtre)
  function openNewInvoice() {
    const list = [...u.quotes].sort((a, b) => b.createdAt - a.createdAt);

    modal({
      title: 'Nouvelle facture', size: 'lg',
      body: `
        <p class="muted" style="font-size:.9rem;margin-bottom:1rem">
          Sélectionnez le devis à transformer en facture. Tous les postes, la TVA
          et l'éventuelle remise sont repris automatiquement. Vous pouvez créer
          plusieurs factures à partir d'un même devis (acompte, situations…).</p>
        ${list.length ? `
          <div class="search" style="margin-bottom:1rem">${icon('search')}
            <input id="conv-search" placeholder="Numéro, objet, client..."></div>
          <div id="conv-list" class="stack" style="max-height:55vh;overflow:auto"></div>
        ` : `
          <div class="empty" style="padding:1.5rem">
            <div class="e-icon">${icon('doc')}</div>
            <h3 style="font-size:1.05rem">Aucun devis enregistré</h3>
            <p>Créez d'abord un devis pour pouvoir en générer une facture.</p>
            <a href="#/app/quotes/new" class="btn btn-primary btn-sm">${icon('plus')} Créer un devis</a>
          </div>`}`,
      onMount(el, close) {
        if (!list.length) return;
        const host = el.querySelector('#conv-list');
        const draw = (filter = '') => {
          const f = filter.toLowerCase();
          const items = list.filter(q => {
            const c = getClient(q.clientId);
            return q.number.toLowerCase().includes(f)
              || (q.title || '').toLowerCase().includes(f)
              || (c?.name || '').toLowerCase().includes(f);
          });
          host.innerHTML = items.map(q => {
            const c = getClient(q.clientId);
            return `
            <div class="lib-item" data-q="${q.id}">
              <span class="li-cat">${icon('doc')}</span>
              <div class="li-meta">
                <div class="li-name">${escapeHtml(q.number)} — ${escapeHtml(q.title || 'Sans objet')}</div>
                <div class="li-sub">${escapeHtml(c?.name || 'Client non renseigné')} · ${dateFR(q.createdAt)}</div>
              </div>
              ${statusBadge(q.status, QUOTE_STATUS)}
              <span class="li-price">${eur(computeQuote(q).ttc)}</span>
            </div>`;
          }).join('') || '<p class="dim">Aucun devis ne correspond.</p>';
          host.querySelectorAll('[data-q]').forEach(it => it.onclick = () => {
            const q = u.quotes.find(x => x.id === it.dataset.q);
            close();
            openInvoiceForm(q);
          });
        };
        draw();
        el.querySelector('#conv-search').addEventListener('input', e => draw(e.target.value));
      },
    });
  }

  function content() {
    const paid = u.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + total(i), 0);
    const due = u.invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + total(i), 0);
    return `
    <div class="page-head">
      <div><h2>Factures</h2><p>Issues de vos devis acceptés — conversion en un clic</p></div>
      <button class="btn btn-primary" data-new-inv>${icon('plus')} Nouvelle facture</button>
    </div>
    ${u.invoices.length ? `
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1.2rem">
      <div class="stat"><div class="s-top"><div class="s-icon" style="background:var(--info-soft);color:var(--info)">${icon('invoice')}</div></div>
        <div class="s-val">${u.invoices.length}</div><div class="s-lbl">Factures émises</div></div>
      <div class="stat"><div class="s-top"><div class="s-icon" style="background:var(--ok-soft);color:var(--ok)">${icon('check')}</div></div>
        <div class="s-val">${eur(paid)}</div><div class="s-lbl">Encaissé</div></div>
      <div class="stat"><div class="s-top"><div class="s-icon" style="background:var(--warn-soft);color:var(--warn)">${icon('clock')}</div></div>
        <div class="s-val">${eur(due)}</div><div class="s-lbl">En attente d'encaissement</div></div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Facture</th><th>Devis d'origine</th><th>Client</th><th>Statut</th>
          <th class="num">Montant TTC</th><th>Émise le</th><th>Échéance</th><th></th></tr></thead>
        <tbody>
          ${u.invoices.map(inv => {
            const c = getClient(inv.clientId);
            const kindLbl = inv.kind && inv.kind !== 'full'
              ? `<div class="cell-sub">${escapeHtml(INVOICE_KINDS[inv.kind]?.title || inv.kind)} ${inv.percent || ''} %</div>` : '';
            return `<tr data-inv="${inv.id}">
              <td class="t-strong">${escapeHtml(inv.number)}${kindLbl}</td>
              <td>${escapeHtml(inv.quoteNumber)}</td>
              <td>${escapeHtml(c?.name || '—')}</td>
              <td>${statusBadge(inv.status, INV_STATUS)}</td>
              <td class="num t-strong">${eur(total(inv))}</td>
              <td>${dateFR(inv.date)}</td>
              <td>${dateFR(inv.dueDate)}</td>
              <td><button class="icon-btn" data-menu="${inv.id}" style="width:34px;height:34px">${icon('grip')}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>` : `
    <div class="card empty">
      <div class="e-icon">${icon('invoice')}</div>
      <h3>Aucune facture pour l'instant</h3>
      <p>Choisissez un devis à transformer en facture — tous les postes sont repris automatiquement.</p>
      <button class="btn btn-primary" data-new-inv>${icon('plus')} Créer une facture</button>
    </div>`}`;
  }

  function paint() { ctx.app.querySelector('.content').innerHTML = content(); bind(); }

  function bind() {
    ctx.app.querySelectorAll('[data-new-inv]').forEach(b => b.onclick = openNewInvoice);
    ctx.app.querySelectorAll('tr[data-inv]').forEach(tr => tr.onclick = (e) => {
      if (e.target.closest('[data-menu]')) return;
      openInvoice(u.invoices.find(i => i.id === tr.dataset.inv));
    });
    ctx.app.querySelectorAll('[data-menu]').forEach(btn => {
      const inv = u.invoices.find(i => i.id === btn.dataset.menu);
      bindDropdown(btn, `
        <a data-act="view">${icon('eye')} Consulter</a>
        <a data-act="pdf">${icon('pdf')} Télécharger en PDF</a>
        <div class="dropdown-sep"></div>
        <button data-act="toggle">${icon(inv.status === 'paid' ? 'clock' : 'check')} Marquer ${inv.status === 'paid' ? 'à encaisser' : 'comme payée'}</button>`,
        (act) => {
          const client = getClient(inv.clientId);
          if (act === 'view') openInvoice(inv);
          else if (act === 'pdf') exportPDF(inv.snapshot, u, client, docOpts(inv));
          else if (act === 'toggle') {
            inv.status = inv.status === 'paid' ? 'unpaid' : 'paid';
            save();
            toast('Statut de la facture mis à jour.');
            paint();
          }
        });
    });
  }

  ctx.app.innerHTML = appLayout('invoices', { title: 'Factures', sub: 'Suivi des encaissements', content: content() });
  bindAppLayout(ctx.app, ctx.navigate);
  bind();
}
