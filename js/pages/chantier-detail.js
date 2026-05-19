// ============================================================
// Devisly — Fiche chantier : phases, photos, documents, validation
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, getClient, computeQuote, QUOTE_STATUS } from '../store.js';
import {
  getChantier, updateChantier, deleteChantier,
  addPhase, updatePhase, deletePhase,
  addPhoto, deletePhoto, updatePhoto,
  addDocument, deleteDocument,
  CHANTIER_STATUS, PHASE_STATUS, chantierProgress, isPhaseOverdue,
} from '../chantiers-store.js';
import {
  eur, eur0, dateFR, dateLong, escapeHtml, statusBadge, toast,
  modal, confirmDialog,
} from '../ui.js';
import { exportPhasePDF } from '../chantier-pdf.js';

// Réduit une image avant stockage base64 (préserve le quota localStorage)
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1100;
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const cv = document.createElement('canvas');
        cv.width = width; cv.height = height;
        cv.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function lightbox(dataUrl, caption) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<button class="lb-close">${icon('x')}</button>
    <div><img src="${dataUrl}" alt="">${caption ? `<div class="lb-cap">${escapeHtml(caption)}</div>` : ''}</div>`;
  document.body.appendChild(lb);
  const close = () => lb.remove();
  lb.addEventListener('click', e => { if (!e.target.closest('img')) close(); });
}

export function renderChantierDetail(ctx) {
  const u = currentUser();
  const chantier = getChantier(ctx.params.id);
  if (!chantier) { ctx.navigate('#/app/chantiers'); return; }

  const clientObj = getClient(chantier.clientId);
  const shareBase = location.origin + location.pathname;

  // ---------- En-tête chantier ----------
  function headerCard() {
    const c = chantier;
    const pct = chantierProgress(c);
    const phases = c.phases || [];
    return `
    <a href="#/app/chantiers" class="btn btn-quiet btn-sm" style="margin-bottom:.8rem">${icon('arrow')} Retour aux chantiers</a>
    <div class="card card-pad reveal">
      <div class="flex-between gap wrap-flex" style="align-items:flex-start">
        <div style="min-width:0">
          <div class="flex items-center gap-sm" style="flex-wrap:wrap">
            <h2 style="font-size:1.5rem">${escapeHtml(c.name)}</h2>
            ${statusBadge(c.status, CHANTIER_STATUS)}
          </div>
          <div class="ch-meta" style="margin-top:.6rem">
            <span>${icon('user')} ${escapeHtml(clientObj ? clientObj.name : 'Client non renseigné')}</span>
            ${c.address ? `<span>${icon('pin')} ${escapeHtml(c.address)}</span>` : ''}
            <span>${icon('calendar')} ${dateFR(c.startDate)}${c.endDate ? ' → ' + dateFR(c.endDate) : ''}</span>
            ${c.budget ? `<span>${icon('euro')} <b>${eur0(c.budget)}</b> de budget</span>` : ''}
          </div>
        </div>
        <div class="flex gap-sm">
          <select class="select" data-ch-status style="width:auto">
            ${Object.entries(CHANTIER_STATUS).map(([k, v]) =>
              `<option value="${k}" ${c.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
          <button class="icon-btn" data-ch-edit title="Modifier le chantier">${icon('edit')}</button>
        </div>
      </div>
      <div style="margin-top:1.2rem">
        <div class="flex-between" style="font-size:.84rem;margin-bottom:.4rem">
          <span class="muted">Avancement global — ${phases.filter(p => ['done','validated'].includes(p.status)).length} / ${phases.length} phases terminées</span>
          <strong style="font-size:1rem">${pct} %</strong>
        </div>
        <div class="progress progress-lg"><div style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }

  // ---------- Une phase ----------
  function phaseEl(p, idx) {
    const overdue = isPhaseOverdue(p);
    const st = PHASE_STATUS[p.status] || PHASE_STATUS.todo;
    const v = p.clientValidation;
    return `
    <div class="phase ${overdue ? 'overdue' : ''}" data-phase="${p.id}">
      <div class="phase-head" data-toggle>
        <span class="phase-num">${idx + 1}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.96rem">${escapeHtml(p.name)}</div>
          <div class="dim" style="font-size:.78rem">
            ${p.startDate ? dateFR(p.startDate) : 'Début ?'}${p.endDate ? ' → ' + dateFR(p.endDate) : ''}
            ${p.responsable ? ' · ' + escapeHtml(p.responsable) : ''}
          </div>
        </div>
        ${overdue ? `<span class="overdue-flag">${icon('warn')} En retard</span>` : ''}
        ${statusBadge(p.status, PHASE_STATUS)}
        <span style="color:var(--ink-3)">${icon('chevDown')}</span>
      </div>
      <div class="phase-body" style="display:none">
        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Nom de la phase</label>
            <input class="input input-sm" data-p="name" value="${escapeHtml(p.name)}"></div>
          <div class="field" style="margin:0"><label>Responsable</label>
            <input class="input input-sm" data-p="responsable" value="${escapeHtml(p.responsable || '')}" placeholder="Nom du responsable"></div>
        </div>
        <div class="field-row cols-3" style="margin-top:.8rem">
          <div class="field" style="margin:0"><label>Début prévu</label>
            <input class="input input-sm" data-p="startDate" type="date" value="${p.startDate || ''}"></div>
          <div class="field" style="margin:0"><label>Fin prévue</label>
            <input class="input input-sm" data-p="endDate" type="date" value="${p.endDate || ''}"></div>
          <div class="field" style="margin:0"><label>Statut</label>
            <select class="select input-sm" data-p-status>
              ${Object.entries(PHASE_STATUS).map(([k, val]) =>
                `<option value="${k}" ${p.status === k ? 'selected' : ''}>${val.label}</option>`).join('')}
            </select></div>
        </div>
        <div class="field" style="margin-top:.8rem"><label>Résumé des travaux effectués</label>
          <textarea class="textarea" data-p="description" rows="2" placeholder="Description visible par le client lors de la validation">${escapeHtml(p.description || '')}</textarea></div>

        <div style="margin-top:1rem">
          <div class="lbl">Photos de la phase (${(p.photos || []).length})</div>
          <div class="photo-grid" style="margin-top:.5rem">
            ${(p.photos || []).map(ph => `
              <div class="photo-thumb" data-photo="${ph.id}">
                <img src="${ph.dataUrl}" alt="">
                ${ph.caption ? `<div class="cap">${escapeHtml(ph.caption)}</div>` : ''}
                <button class="pdel" data-photo-del="${ph.id}" title="Supprimer">${icon('trash')}</button>
              </div>`).join('')}
            <label class="photo-add">
              ${icon('photo')}<span>Ajouter</span>
              <input type="file" accept="image/*" multiple hidden data-photo-input>
            </label>
          </div>
        </div>

        ${validationBlock(p)}

        <div class="flex gap-sm" style="margin-top:1rem;justify-content:flex-end">
          <button class="btn btn-danger btn-sm" data-phase-del>${icon('trash')} Supprimer la phase</button>
        </div>
      </div>
    </div>`;
  }

  // ---------- Bloc validation client ----------
  function validationBlock(p) {
    const v = p.clientValidation;
    if (p.status === 'validated' && v) {
      return `
      <div class="card-pad" style="margin-top:1rem;background:var(--ok-soft);border-radius:var(--radius-md)">
        <div class="flex items-center gap-sm">
          <span style="color:var(--ok)">${icon('checkCircle')}</span>
          <strong style="font-size:.9rem">Phase validée par le client</strong>
        </div>
        <div class="flex gap items-center wrap-flex" style="margin-top:.7rem">
          <img class="sig-preview" src="${v.signature}" alt="signature" style="width:160px;height:74px;object-fit:contain">
          <div style="font-size:.85rem">
            <div><b>${escapeHtml(v.name)}</b></div>
            <div class="dim">Signé le ${dateLong(new Date(v.at).toISOString().slice(0, 10))}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-pv style="margin-left:auto">${icon('pdf')} Exporter le PV</button>
        </div>
      </div>`;
    }
    if (p.status === 'done') {
      return `
      <div class="card-pad" style="margin-top:1rem;background:var(--accent-soft);border-radius:var(--radius-md)">
        <div class="flex items-center gap-sm gap" style="flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <strong style="font-size:.9rem">${icon('signature')} Phase terminée — prête pour validation</strong>
            <div class="dim" style="font-size:.8rem">Envoyez le lien de validation à votre client pour qu'il signe la réception.</div>
          </div>
          <button class="btn btn-primary btn-sm" data-send-client>${icon('send')} Envoyer au client pour validation</button>
        </div>
      </div>`;
    }
    return '';
  }

  // ---------- Section documents ----------
  function documentsSection() {
    const c = chantier;
    const devis = u.quotes.filter(q => q.clientId === c.clientId);
    const factures = u.invoices.filter(i => i.clientId === c.clientId);
    const totalPhotos = (c.phases || []).reduce((n, p) => n + (p.photos || []).length, 0);

    return `
    <div class="card card-pad reveal" style="margin-top:1rem">
      <div class="flex items-center gap-sm" style="margin-bottom:1rem">
        <span class="qs-ic">${icon('folder')}</span>
        <h3 style="font-size:1.05rem;font-family:var(--font-ui);font-weight:700">Documents du chantier</h3>
      </div>

      <div class="lbl">Devis liés au client</div>
      ${devis.length ? `<div class="stack" style="margin:.5rem 0 1rem">
        ${devis.map(q => `
          <a href="#/app/quotes/${q.id}" class="mini-row" style="text-decoration:none">
            <span style="color:var(--accent-strong)">${icon('doc')}</span>
            <div class="mr-grow"><b style="font-size:.86rem">${escapeHtml(q.number)}</b>
              <span class="dim" style="font-size:.78rem"> — ${escapeHtml(q.title || 'Sans objet')}</span></div>
            ${statusBadge(q.status, QUOTE_STATUS)}
            <strong style="font-size:.84rem">${eur(computeQuote(q).ttc)}</strong>
          </a>`).join('')}
      </div>` : '<p class="dim" style="font-size:.84rem;margin:.4rem 0 1rem">Aucun devis pour ce client.</p>'}

      <div class="lbl">Factures liées au client</div>
      ${factures.length ? `<div class="stack" style="margin:.5rem 0 1rem">
        ${factures.map(f => `
          <a href="#/app/invoices" class="mini-row" style="text-decoration:none">
            <span style="color:var(--info)">${icon('invoice')}</span>
            <div class="mr-grow"><b style="font-size:.86rem">${escapeHtml(f.number)}</b></div>
            <strong style="font-size:.84rem">${eur(computeQuote(f.snapshot).ttc)}</strong>
          </a>`).join('')}
      </div>` : '<p class="dim" style="font-size:.84rem;margin:.4rem 0 1rem">Aucune facture pour ce client.</p>'}

      <div class="lbl">Photos de chantier</div>
      <p class="muted" style="font-size:.84rem;margin:.4rem 0 1rem">
        ${totalPhotos} photo${totalPhotos > 1 ? 's' : ''} réparties sur ${(c.phases || []).filter(p => (p.photos || []).length).length} phase(s) — consultables dans chaque phase ci-dessus.</p>

      <div class="lbl">Autres documents (contrats, plans…)</div>
      <div class="stack" style="margin-top:.5rem">
        ${(c.documents || []).map(d => `
          <div class="mini-row">
            <span style="color:var(--ink-3)">${icon('docs')}</span>
            <div class="mr-grow"><b style="font-size:.86rem">${escapeHtml(d.name)}</b>
              <span class="dim" style="font-size:.76rem"> · ${dateFR(d.uploadedAt)}</span></div>
            <a class="icon-btn" style="width:32px;height:32px" href="${d.dataUrl}" download="${escapeHtml(d.name)}" title="Télécharger">${icon('download')}</a>
            <button class="line-del" data-doc-del="${d.id}">${icon('trash')}</button>
          </div>`).join('')}
      </div>
      <label class="btn btn-ghost btn-sm" style="margin-top:.7rem">
        ${icon('upload')} Ajouter un document
        <input type="file" hidden data-doc-input>
      </label>
    </div>`;
  }

  // ---------- Assemblage ----------
  function content() {
    return `
    ${headerCard()}
    <div class="flex-between" style="margin:1.5rem 0 .8rem">
      <h3 style="font-size:1.2rem">Phases du chantier</h3>
      <button class="btn btn-primary btn-sm" data-add-phase>${icon('plus')} Ajouter une phase</button>
    </div>
    <div class="stack" data-phases>
      ${(chantier.phases || []).length
        ? chantier.phases.map(phaseEl).join('')
        : `<div class="card empty" style="padding:2.5rem 1.5rem">
            <div class="e-icon">${icon('layers')}</div>
            <h3 style="font-size:1.1rem">Aucune phase</h3>
            <p>Découpez votre chantier en phases (démolition, gros œuvre, finitions…) pour suivre l'avancement.</p>
            <button class="btn btn-primary btn-sm" data-add-phase>${icon('plus')} Ajouter une phase</button>
          </div>`}
    </div>
    ${documentsSection()}`;
  }

  function paint() {
    ctx.app.querySelector('.content').innerHTML = content();
    bindContent();
  }

  // ---------- Liaisons ----------
  function bindContent() {
    const root = ctx.app;

    // En-tête : statut + édition
    root.querySelector('[data-ch-status]').onchange = (e) => {
      updateChantier(chantier.id, { status: e.target.value });
      chantier.status = e.target.value;
      toast('Statut du chantier mis à jour.');
      paint();
    };
    root.querySelector('[data-ch-edit]').onclick = openEditChantier;

    // Ajout de phase
    root.querySelectorAll('[data-add-phase]').forEach(b => b.onclick = () => {
      const p = addPhase(chantier.id, { name: 'Nouvelle phase' });
      toast('Phase ajoutée.');
      paint();
      // ouvre la nouvelle phase
      const el = root.querySelector(`[data-phase="${p.id}"]`);
      if (el) { el.querySelector('.phase-body').style.display = 'block';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });

    // Chaque phase
    root.querySelectorAll('[data-phase]').forEach(el => bindPhase(el));

    // Documents
    const docInput = root.querySelector('[data-doc-input]');
    if (docInput) docInput.onchange = () => {
      const file = docInput.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo).', 'err'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        addDocument(chantier.id, { name: file.name, dataUrl: reader.result });
        toast('Document ajouté.');
        paint();
      };
      reader.readAsDataURL(file);
    };
    root.querySelectorAll('[data-doc-del]').forEach(b => b.onclick = () => {
      deleteDocument(chantier.id, b.dataset.docDel);
      toast('Document supprimé.');
      paint();
    });
  }

  // Re-rend une seule phase en gardant son corps ouvert
  function repaintPhase(phaseId) {
    const p = chantier.phases.find(x => x.id === phaseId);
    const el = ctx.app.querySelector(`[data-phase="${phaseId}"]`);
    if (!p || !el) return;
    el.outerHTML = phaseEl(p, chantier.phases.indexOf(p));
    const fresh = ctx.app.querySelector(`[data-phase="${phaseId}"]`);
    fresh.querySelector('.phase-body').style.display = 'block';
    bindPhase(fresh);
  }

  function bindPhase(el) {
    const phaseId = el.dataset.phase;
    const p = chantier.phases.find(x => x.id === phaseId);
    if (!p) return;

    // Repli / dépli
    el.querySelector('[data-toggle]').onclick = (e) => {
      if (e.target.closest('select') || e.target.closest('.badge')) return;
      const body = el.querySelector('.phase-body');
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    };

    // Champs texte / dates : sauvegarde à la perte de focus
    el.querySelectorAll('[data-p]').forEach(inp => {
      inp.addEventListener('change', () => {
        updatePhase(chantier.id, phaseId, { [inp.dataset.p]: inp.value });
        // re-rend uniquement cette phase (met à jour titre / dates / alerte retard)
        if (['name', 'startDate', 'endDate'].includes(inp.dataset.p)) repaintPhase(phaseId);
      });
    });

    // Statut : recalcul global + bloc validation
    el.querySelector('[data-p-status]').onchange = (e) => {
      updatePhase(chantier.id, phaseId, { status: e.target.value });
      toast('Statut de la phase mis à jour.');
      paint();
    };

    // Photos : upload (avec compression)
    const photoInput = el.querySelector('[data-photo-input]');
    if (photoInput) photoInput.onchange = async () => {
      const files = [...photoInput.files];
      if (!files.length) return;
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const dataUrl = await compressImage(f);
          addPhoto(chantier.id, phaseId, dataUrl, '');
        } catch { toast('Image illisible ignorée.', 'err'); }
      }
      toast(files.length > 1 ? files.length + ' photos ajoutées.' : 'Photo ajoutée.');
      paint();
      const again = ctx.app.querySelector(`[data-phase="${phaseId}"] .phase-body`);
      if (again) again.style.display = 'block';
    };

    // Photos : agrandir / légender / supprimer
    el.querySelectorAll('[data-photo]').forEach(thumb => {
      const photoId = thumb.dataset.photo;
      thumb.onclick = (e) => {
        if (e.target.closest('[data-photo-del]')) return;
        const photo = p.photos.find(x => x.id === photoId);
        openPhoto(phaseId, photo);
      };
    });
    el.querySelectorAll('[data-photo-del]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      deletePhoto(chantier.id, phaseId, b.dataset.photoDel);
      paint();
      const again = ctx.app.querySelector(`[data-phase="${phaseId}"] .phase-body`);
      if (again) again.style.display = 'block';
    });

    // Suppression de phase
    el.querySelector('[data-phase-del]').onclick = async () => {
      if (await confirmDialog({
        title: 'Supprimer la phase',
        message: `« ${p.name} » et ses photos seront supprimées.`,
        confirmLabel: 'Supprimer', danger: true,
      })) { deletePhase(chantier.id, phaseId); toast('Phase supprimée.'); paint(); }
    };

    // Envoyer au client
    const sendBtn = el.querySelector('[data-send-client]');
    if (sendBtn) sendBtn.onclick = () => openShareLink(p);

    // Exporter le PV
    const pvBtn = el.querySelector('[data-pv]');
    if (pvBtn) pvBtn.onclick = () => exportPhasePDF(chantier, p, u.company, clientObj);
  }

  // ---------- Photo : visionneuse + légende ----------
  function openPhoto(phaseId, photo) {
    modal({
      title: 'Photo',
      body: `
        <img src="${photo.dataUrl}" alt="" style="width:100%;border-radius:var(--radius-md)">
        <div class="field" style="margin-top:1rem"><label>Légende</label>
          <input class="input" id="cap" value="${escapeHtml(photo.caption || '')}" placeholder="Décrire la photo"></div>
        <p class="dim" style="font-size:.78rem">Ajoutée le ${dateLong(new Date(photo.uploadedAt).toISOString().slice(0, 10))}</p>`,
      foot: `<button class="btn btn-ghost" data-close>Fermer</button>
             <button class="btn btn-primary" id="cap-save">Enregistrer la légende</button>`,
      onMount(el, close) {
        el.querySelector('#cap-save').onclick = () => {
          updatePhoto(chantier.id, phaseId, photo.id, { caption: el.querySelector('#cap').value.trim() });
          toast('Légende enregistrée.');
          close(); paint();
        };
      },
    });
  }

  // ---------- Lien de validation client ----------
  function openShareLink(p) {
    const url = shareBase + '#/valider/' + p.shareToken;
    modal({
      title: 'Validation client de la phase',
      body: `
        <p class="muted" style="font-size:.9rem">Transmettez ce lien à votre client. Il pourra consulter
        les photos, le résumé des travaux et signer électroniquement la réception de la phase
        « ${escapeHtml(p.name)} ».</p>
        <div class="field" style="margin-top:1rem">
          <label>Lien de validation unique</label>
          <div class="flex gap-sm">
            <input class="input" id="vurl" value="${url}" readonly>
            <button class="btn btn-primary" id="vcopy">${icon('copy')} Copier</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="vmail" style="margin-top:.8rem">
          ${icon('mail')} Préparer l'e-mail au client</button>
        <p class="dim" style="font-size:.76rem;margin-top:.8rem">
          ${icon('info')} Le lien fonctionne dans ce navigateur (données stockées en local).</p>`,
      onMount(el) {
        el.querySelector('#vcopy').onclick = () => {
          const i = el.querySelector('#vurl');
          i.select();
          navigator.clipboard?.writeText(i.value).catch(() => document.execCommand('copy'));
          toast('Lien copié.');
        };
        el.querySelector('#vmail').onclick = () => {
          const subj = `Validation de phase — ${chantier.name}`;
          const body = `Bonjour,\n\nLa phase « ${p.name} » du chantier « ${chantier.name} » est terminée.\n` +
            `Merci de la valider et de la signer en ligne via ce lien :\n${url}\n\nCordialement,\n${u.company.name || ''}`;
          window.location.href = `mailto:${clientObj?.email || ''}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
        };
      },
    });
  }

  // ---------- Édition du chantier ----------
  function openEditChantier() {
    const c = chantier;
    modal({
      title: 'Modifier le chantier',
      body: `
        <div class="field"><label>Nom du chantier *</label>
          <input class="input" id="e-name" value="${escapeHtml(c.name)}"></div>
        <div class="field"><label>Client</label>
          <select class="select" id="e-client">
            <option value="">— Aucun —</option>
            ${u.clients.map(cl => `<option value="${cl.id}" ${cl.id === c.clientId ? 'selected' : ''}>${escapeHtml(cl.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Adresse du chantier</label>
          <input class="input" id="e-address" value="${escapeHtml(c.address || '')}"></div>
        <div class="field-row cols-2">
          <div class="field" style="margin:0"><label>Date de début</label>
            <input class="input" id="e-start" type="date" value="${c.startDate || ''}"></div>
          <div class="field" style="margin:0"><label>Fin prévue</label>
            <input class="input" id="e-end" type="date" value="${c.endDate || ''}"></div>
        </div>
        <div class="field"><label>Budget total alloué (€)</label>
          <input class="input" id="e-budget" type="number" min="0" step="100" value="${c.budget || 0}"></div>`,
      foot: `<button class="btn btn-danger" id="e-del">Supprimer</button>
             <button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn btn-primary" id="e-save">Enregistrer</button>`,
      onMount(el, close) {
        el.querySelector('#e-save').onclick = () => {
          const name = el.querySelector('#e-name').value.trim();
          if (!name) { toast('Le nom est requis.', 'err'); return; }
          Object.assign(chantier, {
            name,
            clientId: el.querySelector('#e-client').value,
            address: el.querySelector('#e-address').value.trim(),
            startDate: el.querySelector('#e-start').value,
            endDate: el.querySelector('#e-end').value,
            budget: Number(el.querySelector('#e-budget').value) || 0,
          });
          updateChantier(chantier.id, chantier);
          toast('Chantier mis à jour.');
          close();
          ctx.navigate('#/app/chantiers/' + chantier.id);
        };
        el.querySelector('#e-del').onclick = async () => {
          if (await confirmDialog({
            title: 'Supprimer le chantier',
            message: 'Le chantier, ses phases et ses photos seront supprimés.',
            confirmLabel: 'Supprimer', danger: true,
          })) { deleteChantier(chantier.id); close(); ctx.navigate('#/app/chantiers'); }
        };
      },
    });
  }

  ctx.app.innerHTML = appLayout('chantiers', {
    title: chantier.name, sub: 'Fiche chantier', content: content(),
  });
  bindAppLayout(ctx.app, ctx.navigate);
  bindContent();

  // Ouverture directe d'une phase (depuis le planning)
  if (ctx.query && ctx.query.phase) {
    const target = ctx.app.querySelector(`[data-phase="${ctx.query.phase}"]`);
    if (target) {
      target.querySelector('.phase-body').style.display = 'block';
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
