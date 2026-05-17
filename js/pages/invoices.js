// ============================================================
// Devisly — Factures
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, getClient, computeQuote, save } from '../store.js';
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
    return { kind: 'Facture', number: inv.number, date: inv.date, dueDate: inv.dueDate };
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

  function content() {
    const paid = u.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + total(i), 0);
    const due = u.invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + total(i), 0);
    return `
    <div class="page-head">
      <div><h2>Factures</h2><p>Issues de vos devis acceptés — conversion en un clic</p></div>
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
            return `<tr data-inv="${inv.id}">
              <td class="t-strong">${escapeHtml(inv.number)}</td>
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
      <p>Convertissez un devis accepté en facture depuis la liste des devis : tous les postes sont repris automatiquement.</p>
      <a href="#/app/quotes" class="btn btn-primary">${icon('doc')} Voir mes devis</a>
    </div>`}`;
  }

  function paint() { ctx.app.querySelector('.content').innerHTML = content(); bind(); }

  function bind() {
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
