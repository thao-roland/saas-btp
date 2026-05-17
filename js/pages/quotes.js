// ============================================================
// Devisly — Liste des devis (historique & filtres)
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import {
  currentUser, computeQuote, getClient, QUOTE_STATUS, duplicateQuote,
  deleteQuote, convertToInvoice, canCreateQuote,
} from '../store.js';
import { eur, dateFR, escapeHtml, statusBadge, toast, confirmDialog, bindDropdown } from '../ui.js';

let filters = { status: 'all', q: '', sort: 'recent' };

export function renderQuotes(ctx) {
  const u = currentUser();
  const ttc = q => computeQuote(q).ttc;

  function apply() {
    let list = [...u.quotes];
    if (filters.status !== 'all') list = list.filter(q => q.status === filters.status);
    if (filters.q) {
      const f = filters.q.toLowerCase();
      list = list.filter(q => {
        const c = getClient(q.clientId);
        return q.number.toLowerCase().includes(f) ||
          (q.title || '').toLowerCase().includes(f) ||
          (c?.name || '').toLowerCase().includes(f);
      });
    }
    const sorts = {
      recent: (a, b) => b.createdAt - a.createdAt,
      old: (a, b) => a.createdAt - b.createdAt,
      high: (a, b) => ttc(b) - ttc(a),
      low: (a, b) => ttc(a) - ttc(b),
    };
    list.sort(sorts[filters.sort]);
    return list;
  }

  function tableHtml(list) {
    if (!u.quotes.length) {
      return `<div class="card empty">
        <div class="e-icon">${icon('doc')}</div>
        <h3>Votre historique de devis est vide</h3>
        <p>Créez votre premier devis BTP : sections de chantier, TVA multiple, échéancier de paiement et export professionnel.</p>
        <a href="#/app/quotes/new" class="btn btn-primary" data-newquote>${icon('plus')} Créer un devis</a>
      </div>`;
    }
    if (!list.length) {
      return `<div class="card empty">
        <div class="e-icon">${icon('search')}</div>
        <h3>Aucun devis ne correspond</h3>
        <p>Ajustez vos filtres ou votre recherche pour retrouver un devis.</p>
      </div>`;
    }
    return `<div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Numéro & objet</th><th>Client</th><th>Statut</th>
            <th class="num">Montant TTC</th><th>Émis le</th><th>Validité</th><th></th>
          </tr></thead>
          <tbody>
            ${list.map(q => {
              const c = getClient(q.clientId);
              const expired = new Date(q.validUntil) < new Date() && ['draft', 'sent'].includes(q.status);
              return `<tr data-open="${q.id}">
                <td class="t-strong">${escapeHtml(q.number)}<div class="cell-sub">${escapeHtml(q.title || 'Sans objet')}</div></td>
                <td>${escapeHtml(c?.name || '—')}</td>
                <td>${statusBadge(q.status, QUOTE_STATUS)}
                  ${expired ? '<div class="cell-sub" style="color:var(--warn)">Validité dépassée</div>' : ''}</td>
                <td class="num t-strong">${eur(ttc(q))}</td>
                <td>${dateFR(q.date)}</td>
                <td>${dateFR(q.validUntil)}</td>
                <td><button class="icon-btn" data-menu="${q.id}" style="width:34px;height:34px">${icon('grip')}</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function content() {
    const list = apply();
    const counts = { all: u.quotes.length };
    Object.keys(QUOTE_STATUS).forEach(s => counts[s] = u.quotes.filter(q => q.status === s).length);
    return `
    <div class="page-head">
      <div><h2>Devis</h2><p>${u.quotes.length} devis · historique complet et filtres</p></div>
      <a href="#/app/quotes/new" class="btn btn-primary" data-newquote>${icon('plus')} Nouveau devis</a>
    </div>
    <div class="toolbar">
      <div class="seg" data-status-seg>
        <button data-s="all" class="${filters.status === 'all' ? 'on' : ''}">Tous (${counts.all})</button>
        ${Object.entries(QUOTE_STATUS).filter(([k]) => counts[k]).map(([k, v]) =>
          `<button data-s="${k}" class="${filters.status === k ? 'on' : ''}">${v.label} (${counts[k]})</button>`).join('')}
      </div>
      <div class="spacer"></div>
      <div class="search">${icon('search')}<input id="q-search" placeholder="Numéro, client, objet..." value="${escapeHtml(filters.q)}"></div>
      <select class="select" id="q-sort" style="width:auto">
        <option value="recent" ${filters.sort === 'recent' ? 'selected' : ''}>Plus récents</option>
        <option value="old" ${filters.sort === 'old' ? 'selected' : ''}>Plus anciens</option>
        <option value="high" ${filters.sort === 'high' ? 'selected' : ''}>Montant décroissant</option>
        <option value="low" ${filters.sort === 'low' ? 'selected' : ''}>Montant croissant</option>
      </select>
    </div>
    <div data-table>${tableHtml(list)}</div>`;
  }

  function paint() {
    ctx.app.querySelector('.content').innerHTML = content();
    bindContent();
  }

  function bindContent() {
    const root = ctx.app;
    root.querySelectorAll('[data-status-seg] button').forEach(b => b.onclick = () => {
      filters.status = b.dataset.s; paint();
    });
    const search = root.querySelector('#q-search');
    if (search) search.oninput = () => {
      filters.q = search.value;
      root.querySelector('[data-table]').innerHTML = tableHtml(apply());
      bindRows();
    };
    const sort = root.querySelector('#q-sort');
    if (sort) sort.onchange = () => { filters.sort = sort.value; paint(); };

    root.querySelectorAll('[data-newquote]').forEach(b => b.addEventListener('click', e => {
      if (!canCreateQuote(u)) {
        e.preventDefault();
        toast('Quota Starter atteint — passez au plan Pro.', 'err');
        ctx.navigate('#/app/account#abonnement');
      }
    }));
    bindRows();
  }

  function bindRows() {
    ctx.app.querySelectorAll('tr[data-open]').forEach(tr => {
      tr.addEventListener('click', e => {
        if (e.target.closest('[data-menu]')) return;
        ctx.navigate('#/app/quotes/' + tr.dataset.open);
      });
    });
    ctx.app.querySelectorAll('[data-menu]').forEach(btn => {
      const id = btn.dataset.menu;
      const q = u.quotes.find(x => x.id === id);
      const invoiced = u.invoices.some(i => i.quoteId === id);
      bindDropdown(btn, `
        <a data-act="open">${icon('edit')} Ouvrir / modifier</a>
        <a data-act="duplicate">${icon('dup')} Dupliquer</a>
        ${!invoiced ? `<a data-act="invoice">${icon('invoice')} Convertir en facture</a>` : ''}
        <div class="dropdown-sep"></div>
        <button data-act="delete" style="color:var(--danger)">${icon('trash')} Supprimer</button>`,
        async (act) => {
          if (act === 'open') ctx.navigate('#/app/quotes/' + id);
          else if (act === 'duplicate') {
            const copy = duplicateQuote(id);
            toast('Devis dupliqué : ' + copy.number);
            ctx.navigate('#/app/quotes/' + copy.id);
          } else if (act === 'invoice') {
            const inv = convertToInvoice(id);
            toast('Facture créée : ' + inv.number);
            ctx.navigate('#/app/invoices');
          } else if (act === 'delete') {
            if (await confirmDialog({ title: 'Supprimer le devis',
              message: `Le devis ${q.number} sera définitivement supprimé.`,
              confirmLabel: 'Supprimer', danger: true })) {
              deleteQuote(id); toast('Devis supprimé.'); paint();
            }
          }
        });
    });
  }

  ctx.app.innerHTML = appLayout('quotes', { title: 'Devis', sub: 'Historique & suivi', content: content() });
  bindAppLayout(ctx.app, ctx.navigate);
  bindContent();
}
