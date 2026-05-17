// ============================================================
// Devisly — Bibliothèque de prestations
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, saveLibraryItem, deleteLibraryItem, SECTION_TYPES } from '../store.js';
import { eur, escapeHtml, toast, modal, confirmDialog } from '../ui.js';

export function renderLibrary(ctx) {
  const u = currentUser();
  let search = '';

  function rows() {
    let list = u.library;
    if (search) {
      const f = search.toLowerCase();
      list = list.filter(p => p.label.toLowerCase().includes(f) || (p.cat || '').toLowerCase().includes(f));
    }
    if (!u.library.length) {
      return `<div class="card empty">
        <div class="e-icon">${icon('library')}</div>
        <h3>Votre bibliothèque est vide</h3>
        <p>Enregistrez vos ouvrages récurrents — pose de carrelage au m², peinture, maçonnerie — pour les insérer en un clic dans vos devis.</p>
        <button class="btn btn-primary" data-add>${icon('plus')} Ajouter une prestation</button>
      </div>`;
    }
    if (!list.length) return `<div class="card empty"><div class="e-icon">${icon('search')}</div><h3>Aucune prestation</h3><p>Affinez votre recherche.</p></div>`;

    // Groupement par catégorie
    const groups = {};
    list.forEach(p => { (groups[p.cat || 'Autres'] ||= []).push(p); });
    return Object.entries(groups).map(([cat, items]) => `
      <div class="card" style="padding:0;margin-bottom:1rem">
        <div class="qsection-head"><span class="qs-ic">${icon('layers')}</span><h3>${escapeHtml(cat)}</h3>
          <span class="qs-sum" style="font-weight:500;color:var(--ink-3);font-size:.85rem">${items.length} prestation${items.length > 1 ? 's' : ''}</span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Prestation</th><th>Section BTP</th><th>Unité</th><th class="num">Prix unitaire HT</th><th></th></tr></thead>
          <tbody>
            ${items.map(p => `<tr data-edit="${p.id}">
              <td class="t-strong">${escapeHtml(p.label)}</td>
              <td><span class="badge gray no-dot">${escapeHtml(SECTION_TYPES[p.section]?.label || p.section)}</span></td>
              <td>${escapeHtml(p.unit)}</td>
              <td class="num t-strong">${eur(p.price)}</td>
              <td><button class="icon-btn" data-del="${p.id}" style="width:32px;height:32px">${icon('trash')}</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`).join('');
  }

  function form(p = {}) {
    return `
      <div class="field"><label>Désignation de la prestation *</label>
        <input class="input" id="p-label" value="${escapeHtml(p.label || '')}" placeholder="Ex. Pose de carrelage sol — format standard"></div>
      <div class="field-row cols-2">
        <div class="field" style="margin:0"><label>Section BTP</label>
          <select class="select" id="p-section">
            ${Object.entries(SECTION_TYPES).map(([k, v]) =>
              `<option value="${k}" ${p.section === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select></div>
        <div class="field" style="margin:0"><label>Unité</label>
          <input class="input" id="p-unit" value="${escapeHtml(p.unit || 'm²')}" placeholder="m², u, h, forfait..."></div>
      </div>
      <div class="field-row cols-2">
        <div class="field" style="margin:0"><label>Prix unitaire HT (€)</label>
          <input class="input" id="p-price" type="number" step="0.01" min="0" value="${p.price || 0}"></div>
        <div class="field" style="margin:0"><label>Catégorie</label>
          <input class="input" id="p-cat" value="${escapeHtml(p.cat || 'Mes prestations')}" placeholder="Ex. Carrelage"></div>
      </div>`;
  }

  function openForm(p) {
    const editing = !!p;
    modal({
      title: editing ? 'Modifier la prestation' : 'Nouvelle prestation',
      body: form(p || {}),
      foot: `${editing ? '<button class="btn btn-danger" id="p-del">Supprimer</button>' : ''}
             <button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn btn-primary" id="p-save">${editing ? 'Enregistrer' : 'Ajouter'}</button>`,
      onMount(el, close) {
        el.querySelector('#p-save').onclick = () => {
          const label = el.querySelector('#p-label').value.trim();
          if (!label) { toast('La désignation est requise.', 'err'); return; }
          saveLibraryItem({
            ...(p || {}), label,
            section: el.querySelector('#p-section').value,
            unit: el.querySelector('#p-unit').value.trim() || 'u',
            price: Number(el.querySelector('#p-price').value) || 0,
            cat: el.querySelector('#p-cat').value.trim() || 'Autres',
          });
          toast(editing ? 'Prestation mise à jour.' : 'Prestation ajoutée.');
          close(); paint();
        };
        if (editing) el.querySelector('#p-del').onclick = () => {
          deleteLibraryItem(p.id); toast('Prestation supprimée.'); close(); paint();
        };
      },
    });
  }

  function content() {
    return `
    <div class="page-head">
      <div><h2>Bibliothèque de prestations</h2><p>${u.library.length} ouvrage${u.library.length > 1 ? 's' : ''} réutilisable${u.library.length > 1 ? 's' : ''} dans vos devis</p></div>
      <button class="btn btn-primary" data-add>${icon('plus')} Ajouter une prestation</button>
    </div>
    ${u.library.length ? `<div class="toolbar"><div class="search">${icon('search')}
      <input id="lib-search" placeholder="Rechercher une prestation..." value="${escapeHtml(search)}"></div></div>` : ''}
    <div data-list>${rows()}</div>`;
  }

  function paint() { ctx.app.querySelector('.content').innerHTML = content(); bindContent(); }
  function bindContent() {
    ctx.app.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openForm(null));
    const s = ctx.app.querySelector('#lib-search');
    if (s) s.oninput = () => { search = s.value; ctx.app.querySelector('[data-list]').innerHTML = rows(); bindRows(); };
    bindRows();
  }
  function bindRows() {
    ctx.app.querySelectorAll('tr[data-edit]').forEach(tr => tr.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      openForm(u.library.find(p => p.id === tr.dataset.edit));
    });
    ctx.app.querySelectorAll('[data-del]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const p = u.library.find(x => x.id === b.dataset.del);
      if (await confirmDialog({ title: 'Supprimer la prestation',
        message: `« ${p.label} » sera retirée de la bibliothèque.`, confirmLabel: 'Supprimer', danger: true })) {
        deleteLibraryItem(p.id); toast('Prestation supprimée.'); paint();
      }
    });
  }

  ctx.app.innerHTML = appLayout('library', { title: 'Bibliothèque', sub: 'Prestations réutilisables', content: content() });
  bindAppLayout(ctx.app, ctx.navigate);
  bindContent();
}
