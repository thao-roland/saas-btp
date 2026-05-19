// ============================================================
// Devisly — Page publique de validation de phase (signature client)
// Accessible sans connexion via un lien unique #/valider/<token>
// ============================================================
import { icon } from '../icons.js';
import { brand } from '../layout.js';
import { findPhaseByToken, recordPhaseValidation, PHASE_STATUS } from '../chantiers-store.js';
import { escapeHtml, dateLong, toast } from '../ui.js';

// Widget de signature manuscrite (souris + tactile)
function initSignaturePad(canvas) {
  const g = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = 190;
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  canvas.style.height = h + 'px';
  g.scale(ratio, ratio);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#1a1a18';

  let drawing = false, last = null, hasInk = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const down = (e) => { drawing = true; last = pos(e); e.preventDefault(); };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke();
    last = p; hasInk = true; e.preventDefault();
  };
  const up = () => { drawing = false; };
  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up);

  return {
    clear() { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); hasInk = false; },
    isEmpty() { return !hasInk; },
    dataUrl() { return canvas.toDataURL('image/png'); },
  };
}

export function renderValidation(ctx) {
  const found = findPhaseByToken(ctx.params.token);

  if (!found) {
    ctx.app.innerHTML = `
    <div style="min-height:100dvh;display:grid;place-items:center;padding:2rem">
      <div class="card card-pad center" style="max-width:420px">
        <div class="e-icon" style="margin:0 auto 1rem">${icon('xCircle')}</div>
        <h2 style="font-size:1.4rem">Lien introuvable</h2>
        <p class="muted" style="margin-top:.5rem">Ce lien de validation n'est pas valide ou la phase n'existe plus.</p>
        <a href="#/" class="btn btn-ghost" style="margin-top:1.2rem">${icon('arrow')} Accueil</a>
      </div>
    </div>`;
    return;
  }

  const { chantier, phase } = found;

  function paint() {
    const validated = phase.status === 'validated' && phase.clientValidation;
    const photos = phase.photos || [];

    ctx.app.innerHTML = `
    <div style="min-height:100dvh;background:var(--bg)">
      <div class="share-bar">${brand()}
        <span class="badge ${validated ? 'green' : 'amber'} no-dot" style="margin-left:auto;padding:.5rem .9rem">
          ${validated ? 'Phase validée' : 'En attente de votre validation'}</span>
      </div>

      <div class="wrap" style="max-width:760px;padding:2rem 1.2rem">
        <span class="eyebrow">Validation de phase de chantier</span>
        <h1 style="font-size:1.9rem;margin-top:.8rem">${escapeHtml(chantier.name)}</h1>
        <p class="muted" style="margin-top:.3rem">${escapeHtml(chantier.address || '')}</p>

        <div class="card card-pad" style="margin-top:1.4rem">
          <div class="flex items-center gap-sm">
            <span class="qs-ic">${icon('layers')}</span>
            <div>
              <h3 style="font-size:1.15rem;font-family:var(--font-ui);font-weight:700">${escapeHtml(phase.name)}</h3>
              <div class="dim" style="font-size:.82rem">
                ${phase.startDate ? 'Du ' + dateLong(phase.startDate) : ''}${phase.endDate ? ' au ' + dateLong(phase.endDate) : ''}
                ${phase.responsable ? ' · Responsable : ' + escapeHtml(phase.responsable) : ''}
              </div>
            </div>
          </div>
          ${phase.description ? `
            <div style="margin-top:1rem">
              <div class="lbl">Résumé des travaux effectués</div>
              <p style="font-size:.92rem;white-space:pre-wrap;margin-top:.3rem">${escapeHtml(phase.description)}</p>
            </div>` : ''}

          ${photos.length ? `
            <div style="margin-top:1.2rem">
              <div class="lbl">Photos des travaux (${photos.length})</div>
              <div class="photo-grid" style="margin-top:.5rem">
                ${photos.map(ph => `
                  <div class="photo-thumb" data-photo="${ph.id}">
                    <img src="${ph.dataUrl}" alt="">
                    ${ph.caption ? `<div class="cap">${escapeHtml(ph.caption)}</div>` : ''}
                  </div>`).join('')}
              </div>
            </div>` : '<p class="dim" style="margin-top:1rem;font-size:.86rem">Aucune photo jointe à cette phase.</p>'}
        </div>

        ${validated ? `
        <div class="card card-pad" style="margin-top:1rem;background:var(--ok-soft);
          border-color:color-mix(in srgb,var(--ok) 30%,transparent)">
          <div class="flex items-center gap-sm">
            <span style="color:var(--ok)">${icon('checkCircle')}</span>
            <strong>Vous avez validé cette phase</strong>
          </div>
          <div class="flex gap items-center wrap-flex" style="margin-top:.8rem">
            <img class="sig-preview" src="${phase.clientValidation.signature}" alt="signature"
              style="width:200px;height:90px;object-fit:contain">
            <div style="font-size:.88rem">
              <div><b>${escapeHtml(phase.clientValidation.name)}</b></div>
              <div class="dim">Signé le ${dateLong(new Date(phase.clientValidation.at).toISOString().slice(0, 10))}</div>
            </div>
          </div>
        </div>
        ` : `
        <div class="card card-pad" style="margin-top:1rem">
          <h3 style="font-size:1.05rem;font-family:var(--font-ui);font-weight:700">Signer la réception de la phase</h3>
          <p class="dim" style="font-size:.86rem;margin:.3rem 0 1rem">
            En signant, vous confirmez avoir constaté la bonne réalisation des travaux décrits ci-dessus.</p>
          <div class="field">
            <label>Vos nom et prénom *</label>
            <input class="input" id="v-name" placeholder="Nom du client">
          </div>
          <div class="field">
            <label>Signature (dessinez ci-dessous à la souris ou au doigt)</label>
            <canvas class="sig-box" id="v-sig"></canvas>
            <div class="flex" style="justify-content:flex-end;margin-top:.4rem">
              <button class="btn btn-quiet btn-sm" id="v-clear">${icon('refresh')} Effacer</button>
            </div>
          </div>
          <button class="btn btn-primary btn-block btn-lg" id="v-confirm" style="margin-top:.6rem">
            ${icon('check')} Valider et signer</button>
        </div>`}

        <footer style="text-align:center;padding:2rem 0;color:var(--ink-3);font-size:.82rem">
          Validation transmise via Devisly — suivi de chantier BTP.
        </footer>
      </div>
    </div>`;

    // Visionneuse photo
    ctx.app.querySelectorAll('[data-photo]').forEach(t => t.onclick = () => {
      const ph = photos.find(x => x.id === t.dataset.photo);
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `<button class="lb-close">${icon('x')}</button>
        <div><img src="${ph.dataUrl}" alt="">${ph.caption ? `<div class="lb-cap">${escapeHtml(ph.caption)}</div>` : ''}</div>`;
      document.body.appendChild(lb);
      lb.onclick = (e) => { if (!e.target.closest('img')) lb.remove(); };
    });

    if (!validated) {
      const pad = initSignaturePad(ctx.app.querySelector('#v-sig'));
      ctx.app.querySelector('#v-clear').onclick = () => pad.clear();
      ctx.app.querySelector('#v-confirm').onclick = () => {
        const name = ctx.app.querySelector('#v-name').value.trim();
        if (!name) { toast('Veuillez indiquer votre nom.', 'err'); return; }
        if (pad.isEmpty()) { toast('Veuillez signer dans le cadre.', 'err'); return; }
        recordPhaseValidation(ctx.params.token, name, pad.dataUrl());
        toast('Phase validée — merci !');
        paint();
        window.scrollTo(0, 0);
      };
    }
  }

  paint();
}
