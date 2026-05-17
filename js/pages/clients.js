// ============================================================
// Devisly — Carnet de clients
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, saveClient, deleteClient, computeQuote } from '../store.js';
import { eur, escapeHtml, initials, toast, modal, confirmDialog } from '../ui.js';

export function renderClients(ctx) {
  const u = currentUser();
  let search = '';

  function stats(c) {
    const qs = u.quotes.filter(q => q.clientId === c.id);
    const ca = qs.filter(q => ['accepted', 'invoiced'].includes(q.status))
      .reduce((s, q) => s + computeQuote(q).ttc, 0);
    return { count: qs.length, ca };
  }

  function cardHtml(c) {
    const s = stats(c);
    return `
    <div class="card card-pad reveal" data-client="${c.id}" style="cursor:pointer">
      <div class="flex items-center gap-sm" style="margin-bottom:.8rem">
        <span class="avatar lg" style="background:var(--accent-soft);color:var(--accent-strong)">${initials(c.name)}</span>
        <div class="grow" style="min-width:0">
          <div style="font-weight:700;font-family:var(--font-display);font-size:1.05rem">${escapeHtml(c.name)}</div>
          <div class="dim" style="font-size:.8rem">${c.kind === 'particulier' ? 'Particulier' : 'Professionnel'}</div>
        </div>
        <button class="icon-btn" data-edit="${c.id}" style="width:34px;height:34px">${icon('edit')}</button>
      </div>
      <div class="stack" style="font-size:.85rem">
        ${c.contact ? `<div class="flex items-center gap-sm muted">${icon('user')} ${escapeHtml(c.contact)}</div>` : ''}
        ${c.email ? `<div class="flex items-center gap-sm muted">${icon('mail')} ${escapeHtml(c.email)}</div>` : ''}
        ${c.phone ? `<div class="flex items-center gap-sm muted">${icon('phone')} ${escapeHtml(c.phone)}</div>` : ''}
        ${(c.city || c.address) ? `<div class="flex items-center gap-sm muted">${icon('pin')} ${escapeHtml([c.address, c.zip, c.city].filter(Boolean).join(', '))}</div>` : ''}
      </div>
      <div class="flex-between" style="margin-top:1rem;padding-top:.8rem;border-top:1px solid var(--line)">
        <span class="dim" style="font-size:.82rem">${s.count} devis</span>
        <span style="font-weight:700;font-size:.9rem">${eur(s.ca)} signés</span>
      </div>
    </div>`;
  }

  function grid() {
    let list = u.clients;
    if (search) {
      const f = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(f) ||
        (c.contact || '').toLowerCase().includes(f) || (c.city || '').toLowerCase().includes(f));
    }
    if (!u.clients.length) {
      return `<div class="card empty">
        <div class="e-icon">${icon('users')}</div>
        <h3>Votre carnet de clients est vide</h3>
        <p>Ajoutez vos clients pour les associer à vos devis et suivre votre chiffre d'affaires par client.</p>
        <button class="btn btn-primary" data-add>${icon('plus')} Ajouter un client</button>
      </div>`;
    }
    if (!list.length) return `<div class="card empty"><div class="e-icon">${icon('search')}</div><h3>Aucun client trouvé</h3><p>Affinez votre recherche.</p></div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">
      ${list.map(cardHtml).join('')}</div>`;
  }

  function clientForm(c = {}) {
    return `
      <div class="field"><label>Nom / raison sociale *</label><input class="input" id="c-name" value="${escapeHtml(c.name || '')}"></div>
      <div class="field"><label>Type de client</label>
        <select class="select" id="c-kind">
          <option value="pro" ${c.kind !== 'particulier' ? 'selected' : ''}>Professionnel / entreprise</option>
          <option value="particulier" ${c.kind === 'particulier' ? 'selected' : ''}>Particulier</option>
        </select></div>
      <div class="field"><label>Personne de contact</label><input class="input" id="c-contact" value="${escapeHtml(c.contact || '')}"></div>
      <div class="field-row cols-2">
        <div class="field" style="margin:0"><label>E-mail</label><input class="input" id="c-email" type="email" value="${escapeHtml(c.email || '')}"></div>
        <div class="field" style="margin:0"><label>Téléphone</label><input class="input" id="c-phone" value="${escapeHtml(c.phone || '')}"></div>
      </div>
      <div class="field"><label>Adresse</label><input class="input" id="c-address" value="${escapeHtml(c.address || '')}"></div>
      <div class="field-row cols-2">
        <div class="field" style="margin:0"><label>Code postal</label><input class="input" id="c-zip" value="${escapeHtml(c.zip || '')}"></div>
        <div class="field" style="margin:0"><label>Ville</label><input class="input" id="c-city" value="${escapeHtml(c.city || '')}"></div>
      </div>
      <div class="field"><label>SIRET (client professionnel)</label><input class="input" id="c-siret" value="${escapeHtml(c.siret || '')}"></div>`;
  }

  function openForm(c) {
    const editing = !!c;
    modal({
      title: editing ? 'Modifier le client' : 'Nouveau client',
      body: clientForm(c || {}),
      foot: `${editing ? '<button class="btn btn-danger" id="c-del">Supprimer</button>' : ''}
             <button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn btn-primary" id="c-save">${editing ? 'Enregistrer' : 'Créer le client'}</button>`,
      onMount(el, close) {
        el.querySelector('#c-save').onclick = () => {
          const name = el.querySelector('#c-name').value.trim();
          if (!name) { toast('Le nom est requis.', 'err'); return; }
          const data = {
            ...(c || {}), name, kind: el.querySelector('#c-kind').value,
            contact: el.querySelector('#c-contact').value.trim(),
            email: el.querySelector('#c-email').value.trim(),
            phone: el.querySelector('#c-phone').value.trim(),
            address: el.querySelector('#c-address').value.trim(),
            zip: el.querySelector('#c-zip').value.trim(),
            city: el.querySelector('#c-city').value.trim(),
            siret: el.querySelector('#c-siret').value.trim(),
          };
          saveClient(data);
          toast(editing ? 'Client mis à jour.' : 'Client créé.');
          close(); paint();
        };
        if (editing) el.querySelector('#c-del').onclick = async () => {
          if (await confirmDialog({ title: 'Supprimer le client',
            message: `${c.name} sera retiré du carnet. Les devis existants sont conservés.`,
            confirmLabel: 'Supprimer', danger: true })) {
            deleteClient(c.id); toast('Client supprimé.'); close(); paint();
          }
        };
      },
    });
  }

  function content() {
    return `
    <div class="page-head">
      <div><h2>Carnet de clients</h2><p>${u.clients.length} client${u.clients.length > 1 ? 's' : ''} enregistré${u.clients.length > 1 ? 's' : ''}</p></div>
      <button class="btn btn-primary" data-add>${icon('plus')} Ajouter un client</button>
    </div>
    ${u.clients.length ? `<div class="toolbar"><div class="search">${icon('search')}
      <input id="cl-search" placeholder="Rechercher un client..." value="${escapeHtml(search)}"></div></div>` : ''}
    <div data-grid>${grid()}</div>`;
  }

  function paint() {
    ctx.app.querySelector('.content').innerHTML = content();
    bindContent();
  }
  function bindContent() {
    ctx.app.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openForm(null));
    const s = ctx.app.querySelector('#cl-search');
    if (s) s.oninput = () => { search = s.value; ctx.app.querySelector('[data-grid]').innerHTML = grid(); bindCards(); };
    bindCards();
  }
  function bindCards() {
    ctx.app.querySelectorAll('[data-client]').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('[data-edit]')) return;
        ctx.navigate('#/app/quotes');
      };
    });
    ctx.app.querySelectorAll('[data-edit]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      openForm(u.clients.find(c => c.id === b.dataset.edit));
    });
  }

  ctx.app.innerHTML = appLayout('clients', { title: 'Carnet de clients', sub: 'Vos contacts BTP', content: content() });
  bindAppLayout(ctx.app, ctx.navigate);
  bindContent();
}
