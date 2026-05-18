// ============================================================
// Devisly — Page publique de visualisation client (lien partagé)
// Fonctionne en mode local (mémoire) comme en mode cloud (RPC Supabase).
// ============================================================
import { icon } from '../icons.js';
import { brand } from '../layout.js';
import {
  isCloudMode, findByShareToken, recordClientResponse,
  rowToQuote, rowToCompany, rowToClient,
} from '../store.js';
import { fetchSharedQuote, submitQuoteResponse } from '../supabase-client.js';
import { renderQuoteDoc } from '../doc.js';
import { exportPDF } from '../exports.js';
import { eur, escapeHtml, toast, modal } from '../ui.js';

export async function renderShare(ctx) {
  const token = ctx.params.token;

  ctx.app.innerHTML = `<div style="min-height:100dvh;display:grid;place-items:center">
    <div class="spin" style="width:32px;height:32px;border:3px solid var(--line);
      border-top-color:var(--accent);border-radius:50%"></div></div>`;

  // ---------- Récupération du devis ----------
  let quote, owner, client;
  try {
    if (isCloudMode()) {
      const data = await fetchSharedQuote(token);
      if (data && data.devis) {
        quote = rowToQuote(data.devis);
        owner = { company: rowToCompany(data.entreprise || {}) };
        client = data.client ? rowToClient(data.client) : null;
      }
    } else {
      const found = findByShareToken(token);
      if (found) {
        quote = found.quote;
        owner = found.owner;
        client = found.owner.clients.find(c => c.id === found.quote.clientId) || null;
      }
    }
  } catch (e) {
    console.error('Partage :', e);
  }

  if (!quote) {
    ctx.app.innerHTML = `
    <div style="min-height:100dvh;display:grid;place-items:center;padding:2rem">
      <div class="card card-pad center" style="max-width:420px">
        <div class="e-icon" style="margin:0 auto 1rem">${icon('xCircle')}</div>
        <h2 style="font-size:1.4rem">Lien introuvable</h2>
        <p class="muted" style="margin-top:.5rem">Ce devis n'existe plus ou le lien de partage n'est pas valide.</p>
        <a href="#/" class="btn btn-ghost" style="margin-top:1.2rem">${icon('arrow')} Retour à l'accueil</a>
      </div>
    </div>`;
    return;
  }

  function paint() {
    const responded = !!quote.clientResponse;
    ctx.app.innerHTML = `
    <div style="min-height:100dvh;background:var(--bg)">
      <div class="share-bar">
        ${brand()}
        <div class="share-action">
          <button class="btn btn-ghost btn-sm" id="dl-pdf">${icon('pdf')} Télécharger le PDF</button>
          ${!responded ? `
            <button class="btn btn-danger btn-sm" id="refuse">${icon('x')} Refuser</button>
            <button class="btn btn-primary btn-sm" id="accept">${icon('check')} Accepter le devis</button>
          ` : `<span class="badge ${quote.clientResponse.status === 'accepted' ? 'green' : 'red'} no-dot" style="padding:.5rem .9rem">
            ${quote.clientResponse.status === 'accepted' ? 'Devis accepté' : 'Devis refusé'}</span>`}
        </div>
      </div>

      ${!responded ? `
      <div class="wrap" style="max-width:820px;padding-top:1.5rem">
        <div class="card card-pad" style="display:flex;gap:1rem;align-items:center;background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 30%,transparent)">
          <span style="color:var(--accent-strong)">${icon('signature')}</span>
          <div class="grow">
            <strong style="font-size:.95rem">Ce devis attend votre réponse</strong>
            <div class="muted" style="font-size:.85rem">Valable jusqu'au ${escapeHtml(quote.validUntil || '—')}</div>
          </div>
        </div>
      </div>` : ''}

      <div class="share-body">${renderQuoteDoc(quote, owner, client)}</div>

      <footer style="text-align:center;padding:2rem;color:var(--ink-3);font-size:.82rem">
        Devis transmis via Devisly — logiciel de devis pour le BTP.
      </footer>
    </div>`;

    ctx.app.querySelector('#dl-pdf').onclick = () => exportPDF(quote, owner, client);
    const a = ctx.app.querySelector('#accept');
    const r = ctx.app.querySelector('#refuse');
    if (a) a.onclick = () => respondModal('accepted');
    if (r) r.onclick = () => respondModal('refused');
  }

  function respondModal(status) {
    const accept = status === 'accepted';
    modal({
      title: accept ? 'Accepter le devis' : 'Refuser le devis',
      body: `
        <p class="muted" style="font-size:.9rem">
          ${accept
            ? "En validant, vous donnez votre accord pour la réalisation des travaux décrits dans ce devis. L'entreprise sera notifiée de votre acceptation."
            : "Vous pouvez indiquer un motif à l'entreprise. Votre réponse lui sera transmise."}</p>
        <div class="field" style="margin-top:1rem">
          <label>Vos nom et prénom *</label>
          <input class="input" id="resp-name" placeholder="Signature électronique">
        </div>
        ${accept ? `
        <label class="checkrow" style="margin-top:1rem">
          <input type="checkbox" id="resp-cgu">
          <span style="font-size:.85rem;color:var(--ink-2)">Je reconnais avoir pris connaissance du devis et des conditions, et j'en accepte les termes (« Bon pour travaux »).</span>
        </label>` : `
        <div class="field" style="margin-top:1rem">
          <label>Motif (optionnel)</label>
          <textarea class="textarea" id="resp-reason" rows="3"></textarea>
        </div>`}`,
      foot: `<button class="btn btn-ghost" data-close>Annuler</button>
             <button class="btn ${accept ? 'btn-primary' : 'btn-danger'}" id="resp-confirm">
               ${accept ? 'Confirmer l\'acceptation' : 'Confirmer le refus'}</button>`,
      onMount(el, close) {
        el.querySelector('#resp-confirm').onclick = async () => {
          const name = el.querySelector('#resp-name').value.trim();
          if (!name) { toast('Veuillez indiquer votre nom.', 'err'); return; }
          if (accept && !el.querySelector('#resp-cgu').checked) {
            toast('Veuillez cocher la case d\'acceptation.', 'err'); return;
          }
          const btn = el.querySelector('#resp-confirm');
          btn.disabled = true;
          try {
            if (isCloudMode()) await submitQuoteResponse(token, status, name);
            else recordClientResponse(token, status, name);
            quote.clientResponse = { status, at: Date.now(), name };
            close();
            toast(accept ? 'Devis accepté — merci !' : 'Réponse enregistrée.');
            paint();
          } catch (e) {
            btn.disabled = false;
            toast('Erreur : ' + e.message, 'err');
          }
        };
      },
    });
  }

  paint();
}
