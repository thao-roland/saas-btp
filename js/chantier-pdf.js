// ============================================================
// Devisly — Export PDF du procès-verbal de validation de phase
// Ouvre une fenêtre d'impression (→ « Enregistrer en PDF »).
// ============================================================
import { escapeHtml, dateLong } from './ui.js';
import { PHASE_STATUS } from './chantiers-store.js';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#e9e7e2;color:#1a1a18;padding:2rem;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{background:#fff;max-width:820px;margin:0 auto;padding:3rem;border-radius:14px;box-shadow:0 30px 70px -30px rgba(0,0,0,.3)}
h1,h2,h3{font-family:'Sora',sans-serif}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #1a1a18;padding-bottom:1.2rem}
.head .co{font-size:1.2rem;font-weight:700}
.head p{font-size:.8rem;color:#57544d;line-height:1.5}
.title{font-family:'Sora',sans-serif;font-size:1.6rem;color:#d97706;font-weight:700;text-align:right}
.lbl{font-size:.66rem;text-transform:uppercase;letter-spacing:.1em;color:#8a867c;font-weight:700;margin-bottom:.3rem}
.row{display:flex;gap:2rem;margin-top:1.4rem}
.row>div{flex:1}
.box{border:1px solid #e3e1db;border-radius:10px;padding:1rem;margin-top:1rem}
.box strong{display:block;font-size:1rem;margin-bottom:.2rem}
.desc{font-size:.88rem;color:#3a3833;line-height:1.6;white-space:pre-wrap}
.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-top:.8rem}
.photos figure{border:1px solid #e3e1db;border-radius:8px;overflow:hidden}
.photos img{width:100%;height:120px;object-fit:cover;display:block}
.photos figcaption{font-size:.7rem;padding:.3rem .45rem;color:#57544d}
.sign{margin-top:1.6rem;display:flex;gap:2rem;align-items:flex-end}
.sign .sigimg{border:1px solid #ccc;border-radius:8px;background:#fff;width:240px;height:120px;object-fit:contain}
.foot{margin-top:2rem;padding-top:1rem;border-top:1px solid #ddd;font-size:.72rem;color:#8a867c;line-height:1.6}
@page{margin:1.3cm}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;max-width:100%;padding:0}}
`;

export function exportPhasePDF(chantier, phase, company, client) {
  const v = phase.clientValidation || {};
  const co = company || {};
  const statusLabel = (PHASE_STATUS[phase.status] || {}).label || phase.status;

  const photos = (phase.photos || []).map(p => `
    <figure>
      <img src="${p.dataUrl}" alt="">
      ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
    </figure>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <title>PV validation — ${escapeHtml(phase.name)}</title><style>${CSS}</style></head><body>
  <div class="page">
    <div class="head">
      <div>
        <div class="co">${escapeHtml(co.name || 'Entreprise')}</div>
        <p>
          ${escapeHtml([co.address, [co.zip, co.city].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}
          ${co.siret ? '<br>SIRET ' + escapeHtml(co.siret) : ''}
          ${co.phone ? '<br>Tél. ' + escapeHtml(co.phone) : ''}
        </p>
      </div>
      <div class="title">Procès-verbal<br>de validation</div>
    </div>

    <div class="row">
      <div>
        <div class="lbl">Chantier</div>
        <strong>${escapeHtml(chantier.name)}</strong>
        <p style="font-size:.84rem;color:#57544d">${escapeHtml(chantier.address || '')}</p>
      </div>
      <div style="text-align:right">
        <div class="lbl">Client</div>
        <strong>${escapeHtml(client ? client.name : (v.name || '—'))}</strong>
      </div>
    </div>

    <div class="box">
      <div class="lbl">Phase réceptionnée</div>
      <strong>${escapeHtml(phase.name)} — ${escapeHtml(statusLabel)}</strong>
      <p style="font-size:.82rem;color:#57544d">
        ${phase.startDate ? 'Du ' + dateLong(phase.startDate) : ''}
        ${phase.endDate ? ' au ' + dateLong(phase.endDate) : ''}
        ${phase.responsable ? ' · Responsable : ' + escapeHtml(phase.responsable) : ''}
      </p>
      ${phase.description ? `<p class="desc" style="margin-top:.6rem">${escapeHtml(phase.description)}</p>` : ''}
    </div>

    ${photos ? `<div style="margin-top:1.2rem"><div class="lbl">Photos des travaux réalisés</div>
      <div class="photos">${photos}</div></div>` : ''}

    <div class="sign">
      <div>
        <div class="lbl">Signature du client — bon pour réception</div>
        ${v.signature ? `<img class="sigimg" src="${v.signature}" alt="signature">` : '<p>Non signé</p>'}
      </div>
      <div>
        <p style="font-size:.84rem"><strong>${escapeHtml(v.name || '—')}</strong></p>
        <p style="font-size:.8rem;color:#57544d">Validé le ${v.at ? dateLong(new Date(v.at).toISOString().slice(0, 10)) : '—'}</p>
      </div>
    </div>

    <div class="foot">
      Ce procès-verbal atteste de la réception et de l'acceptation par le client de la phase
      de travaux désignée ci-dessus, sur la base des éléments et photos présentés.
      ${co.name ? escapeHtml(co.name) : ''}${co.siret ? ' — SIRET ' + escapeHtml(co.siret) : ''}.
    </div>
  </div></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) { alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 650);
}
