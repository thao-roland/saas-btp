// ============================================================
// Devisly — Rendu du document devis (aperçu / partage / PDF)
// ============================================================
import { computeQuote, SECTION_TYPES } from './store.js';
import { eur, num, dateLong, escapeHtml } from './ui.js';

export function renderQuoteDoc(q, owner, client, opts = {}) {
  const kind = opts.kind || 'Devis';
  const docNumber = opts.number || q.number;
  const c = computeQuote(q);
  const co = owner.company;
  const logo = co.logo
    ? `<img class="doc-logo" src="${co.logo}" alt="logo" />`
    : `<div class="doc-logo ph">${escapeHtml((co.name || 'E')[0])}</div>`;

  const rows = q.sections.filter(s => s.lines.length).map(s => {
    const head = `<tr class="sec-row"><td colspan="5">${escapeHtml(SECTION_TYPES[s.type]?.label || s.label)}</td></tr>`;
    const lines = s.lines.map(l => {
      const total = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      const pu = (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      return `<tr>
        <td>${escapeHtml(l.designation || '—')}${l.detail ? `<br><span style="color:#8a867c;font-size:.74rem">${escapeHtml(l.detail)}</span>` : ''}</td>
        <td class="r">${num(l.qty)} ${escapeHtml(l.unit || '')}</td>
        <td class="r">${eur(pu)}</td>
        <td class="r">${num(l.tva, 1)} %</td>
        <td class="r">${eur(total)}</td>
      </tr>`;
    }).join('');
    return head + lines;
  }).join('');

  const tvaRows = c.tvaLines.map(t =>
    `<div class="tr"><span>TVA ${num(t.rate, 1)} % &nbsp;<span style="color:#8a867c">(base ${eur(t.base)})</span></span><span>${eur(t.amount)}</span></div>`
  ).join('');

  const payRows = q.payments && q.payments.length
    ? q.payments.map(p =>
        `<tr><td>${escapeHtml(p.label)}</td><td class="r">${num(p.percent, 1)} %</td><td class="r">${eur(c.ttc * p.percent / 100)}</td></tr>`
      ).join('')
    : '';

  const resp = q.clientResponse;
  const respBanner = resp
    ? `<div style="margin-bottom:1.4rem;padding:.8rem 1rem;border-radius:10px;font-size:.85rem;font-weight:600;
        background:${resp.status === 'accepted' ? '#e7f4ec' : '#fbeaea'};
        color:${resp.status === 'accepted' ? '#15803d' : '#b91c1c'}">
        ${resp.status === 'accepted' ? '✓ Devis accepté' : '✕ Devis refusé'} par ${escapeHtml(resp.name || 'le client')}
        le ${dateLong(new Date(resp.at).toISOString().slice(0, 10))}.</div>`
    : '';

  return `
  <div class="doc-page" id="doc-print">
    ${respBanner}
    <div class="doc-head">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        ${logo}
        <div class="doc-co">
          <h3>${escapeHtml(co.name || 'Votre entreprise')}</h3>
          <p>
            ${co.legalForm ? escapeHtml(co.legalForm) + (co.capital ? ' au capital de ' + escapeHtml(co.capital) : '') + '<br>' : ''}
            ${[co.address, [co.zip, co.city].filter(Boolean).join(' ')].filter(Boolean).map(escapeHtml).join('<br>')}
            ${co.phone ? '<br>Tél. ' + escapeHtml(co.phone) : ''}
            ${co.emailPro ? '<br>' + escapeHtml(co.emailPro) : ''}
          </p>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${escapeHtml(kind)}</div>
        <p>
          <strong>N° ${escapeHtml(docNumber)}</strong><br>
          Date : ${dateLong(opts.date || q.date)}<br>
          ${kind === 'Facture'
            ? "Échéance : " + dateLong(opts.dueDate || q.validUntil)
            : "Validité : jusqu'au " + dateLong(q.validUntil)}
        </p>
      </div>
    </div>

    <div class="doc-parties">
      <div class="doc-party">
        <div class="dp-lbl">Émetteur</div>
        <strong>${escapeHtml(co.name || '—')}</strong>
        ${co.siret ? 'SIRET ' + escapeHtml(co.siret) + '<br>' : ''}
        ${co.rcs ? escapeHtml(co.rcs) + '<br>' : ''}
        ${co.ape ? 'Code APE ' + escapeHtml(co.ape) + '<br>' : ''}
        ${co.tvaNumber ? 'TVA ' + escapeHtml(co.tvaNumber) : ''}
      </div>
      <div class="doc-party" style="text-align:right">
        <div class="dp-lbl">Client</div>
        <strong>${escapeHtml(client?.name || 'Client non renseigné')}</strong>
        ${client?.contact && client.contact !== client.name ? escapeHtml(client.contact) + '<br>' : ''}
        ${client ? [client.address, [client.zip, client.city].filter(Boolean).join(' ')].filter(Boolean).map(escapeHtml).join('<br>') : ''}
        ${client?.phone ? '<br>' + escapeHtml(client.phone) : ''}
      </div>
    </div>

    ${q.title ? `<div style="font-family:'Sora',sans-serif;font-size:1.25rem;font-weight:600;margin:.4rem 0 .2rem">${escapeHtml(q.title)}</div>` : ''}

    <table class="doc-tbl">
      <thead><tr>
        <th>Désignation</th><th class="r">Quantité</th><th class="r">Prix unit. HT</th>
        <th class="r">TVA</th><th class="r">Total HT</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="color:#8a867c">Aucune ligne saisie.</td></tr>'}</tbody>
    </table>

    <div class="doc-totals">
      <div class="tr"><span>Total HT</span><span>${eur(c.ht)}</span></div>
      ${c.discount > 0 ? `<div class="tr"><span>Remise (${num(q.globalDiscount, 1)} %)</span><span>− ${eur(c.discount)}</span></div>` : ''}
      ${c.discount > 0 ? `<div class="tr"><span>Total HT net</span><span>${eur(c.htNet)}</span></div>` : ''}
      ${tvaRows}
      <div class="tr grand"><span>Total TTC</span><span>${eur(c.ttc)}</span></div>
    </div>

    ${payRows ? `
    <div style="clear:both;margin-top:2rem">
      <div class="dp-lbl" style="font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:#8a867c;font-weight:700;margin-bottom:.4rem">Échéancier de paiement</div>
      <table class="doc-tbl"><thead><tr><th>Tranche</th><th class="r">Part</th><th class="r">Montant TTC</th></tr></thead>
      <tbody>${payRows}</tbody></table>
    </div>` : ''}

    ${q.execDelay ? `<div style="margin-top:1.4rem;font-size:.84rem"><strong>Délai d'exécution :</strong> ${escapeHtml(q.execDelay)}</div>` : ''}
    ${q.notes ? `<div style="margin-top:.6rem;font-size:.84rem"><strong>Note :</strong> ${escapeHtml(q.notes)}</div>` : ''}

    ${kind === 'Devis' ? `
    <div class="doc-sign">
      <div class="box"><strong style="color:#1a1a18">Bon pour accord — le client</strong><br>Date et signature, précédées de la mention « Bon pour travaux »</div>
      <div class="box"><strong style="color:#1a1a18">L'entreprise</strong><br>${escapeHtml(co.name || '')}</div>
    </div>` : ''}

    <div class="doc-foot">
      ${q.conditions ? escapeHtml(q.conditions) + '<br><br>' : ''}
      ${co.name || ''}${co.legalForm ? ' — ' + co.legalForm : ''}${co.siret ? ' — SIRET ' + co.siret : ''}${co.rcs ? ' — ' + co.rcs : ''}.
      ${co.insurance ? '<br>Assurance : ' + escapeHtml(co.insurance) + '.' : ''}
      ${co.iban ? '<br>Coordonnées bancaires : ' + escapeHtml(co.iban) + '.' : ''}
      <br>Devis établi en deux exemplaires. En cas d'acceptation, retourner un exemplaire daté et signé.
    </div>
  </div>`;
}
