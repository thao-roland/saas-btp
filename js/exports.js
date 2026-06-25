// ============================================================
// Devisly — Export PDF / Excel / Word
// ============================================================
import { computeQuote, SECTION_TYPES } from './store.js';
import { renderQuoteDoc } from './doc.js';
import { eur, num, escapeHtml, downloadBlob, dateLong, toast } from './ui.js';

const DOC_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#e9e7e2;color:#1a1a18;padding:2rem;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h3{font-family:'Sora',sans-serif;font-weight:600}
.doc-page{background:#fff;max-width:820px;margin:0 auto;padding:3rem;border-radius:14px;box-shadow:0 30px 70px -30px rgba(0,0,0,.3)}
.doc-head{display:flex;justify-content:space-between;gap:2rem;padding-bottom:1.6rem;border-bottom:2px solid #1a1a18}
.doc-logo{width:84px;height:84px;border-radius:10px;object-fit:contain;background:#f1f0ed;display:grid;place-items:center}
.doc-logo.ph{font-family:'Sora',sans-serif;font-size:1.5rem;color:#d97706;font-weight:700}
.doc-co h3{font-size:1.3rem}
.doc-co p,.doc-meta p{font-size:.82rem;color:#57544d;line-height:1.6}
.doc-meta{text-align:right}
.doc-meta .doc-title{font-family:'Sora',sans-serif;font-size:1.7rem;color:#d97706;font-weight:600}
.doc-parties{display:flex;justify-content:space-between;gap:2rem;margin:1.6rem 0}
.doc-party{font-size:.85rem;line-height:1.55}
.doc-party .dp-lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:#8a867c;font-weight:700;margin-bottom:.35rem}
.doc-party strong{display:block;font-size:.95rem}
.doc-tbl{width:100%;border-collapse:collapse;margin-top:1rem}
.doc-tbl th{background:#f1f0ed;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#57544d;padding:.55rem .7rem;text-align:left}
.doc-tbl th.r,.doc-tbl td.r{text-align:right}
.doc-tbl td{padding:.5rem .7rem;font-size:.82rem;border-bottom:1px solid #eee}
.doc-tbl .sec-row td{background:#faf6ef;font-weight:700;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em;color:#b45309}
.doc-totals{margin-top:1rem;margin-left:auto;width:300px}
.doc-totals .tr{display:flex;justify-content:space-between;padding:.3rem 0;font-size:.85rem}
.doc-totals .tr.grand{border-top:2px solid #1a1a18;margin-top:.35rem;padding-top:.6rem;font-size:1.15rem;font-weight:700;font-family:'Sora',sans-serif}
.doc-foot{margin-top:2rem;padding-top:1.2rem;border-top:1px solid #ddd;font-size:.72rem;color:#8a867c;line-height:1.6}
.doc-sign{display:flex;gap:2rem;margin-top:1.8rem}
.doc-sign .box{flex:1;border:1px dashed #bbb;border-radius:8px;padding:1rem;height:92px;font-size:.72rem;color:#8a867c}
@page{margin:1.3cm}
@media print{body{background:#fff;padding:0}.doc-page{box-shadow:none;border-radius:0;max-width:100%;padding:0}}
`;

// ---------- PDF — téléchargement direct via html2pdf (html2canvas + jsPDF) ----------
// Chargé à la demande depuis un CDN public, avec un CDN de secours.
let _h2p = null;
const H2P_CDNS = [
  'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js',
  'https://unpkg.com/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js',
];
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script load failed: ' + url));
    document.head.appendChild(s);
  });
}
async function loadHtml2Pdf() {
  if (_h2p) return _h2p;
  if (window.html2pdf) { _h2p = window.html2pdf; return _h2p; }
  let lastErr;
  for (const url of H2P_CDNS) {
    try { await loadScript(url); break; }
    catch (e) { lastErr = e; }
  }
  if (!window.html2pdf) {
    throw new Error('Bibliothèque PDF indisponible (CDN injoignable). ' + (lastErr?.message || ''));
  }
  _h2p = window.html2pdf;
  return _h2p;
}

const safeFile = (s) => String(s).replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80);

export async function exportPDF(q, owner, client, opts = {}) {
  const label = (opts.kind || 'Devis') + ' ' + (opts.number || q.number);
  toast('Génération du PDF en cours…');

  // Conteneur attaché au document : il hérite de assets/app.css et le rendu
  // est donc strictement identique à l'aperçu à l'écran.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;background:#ffffff;color:#1a1a18;font-family:var(--font-ui,sans-serif)';
  wrap.innerHTML = renderQuoteDoc(q, owner, client, opts);
  // Annule l'ombre/le rayon du conteneur — propres au cadre d'aperçu
  const page = wrap.querySelector('.doc-page');
  if (page) { page.style.boxShadow = 'none'; page.style.borderRadius = '0'; }
  document.body.appendChild(wrap);

  try {
    // Laisse les polices Google se charger avant la capture
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }
    const html2pdf = await loadHtml2Pdf();
    await html2pdf().from(page || wrap).set({
      filename: safeFile(label) + '.pdf',
      margin: [10, 10, 12, 10],
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 820, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.doc-sign', '.doc-totals', '.doc-parties', '.doc-head'] },
    }).save();
    toast('PDF téléchargé.');
  } catch (e) {
    console.error('exportPDF:', e);
    toast('PDF impossible : ' + (e.message || 'erreur inconnue'), 'err');
  } finally {
    wrap.remove();
  }
}

// ---------- Excel (SpreadsheetML 2003 — ouvert nativement par Excel) ----------
function xmlCell(value, type = 'String', styleId) {
  const s = styleId ? ` ss:StyleID="${styleId}"` : '';
  const v = type === 'Number' ? (Number(value) || 0) : escapeHtml(value);
  return `<Cell${s}><Data ss:Type="${type}">${v}</Data></Cell>`;
}

export function exportExcel(q, owner, client, opts = {}) {
  const c = computeQuote(q);
  const noTva = !!q.noTva;
  const co = owner.company;
  const kind = (opts.kind || 'Devis').toUpperCase();
  const docNum = opts.number || q.number;
  const docTitle = opts.title ? opts.title.toUpperCase() : `${kind} ${docNum}`;
  const rowsXml = [];
  const R = (cells) => rowsXml.push(`<Row>${cells}</Row>`);
  const blank = () => rowsXml.push('<Row></Row>');

  R(xmlCell(docTitle, 'String', 'title'));
  R(xmlCell(co.name || '', 'String', 'h'));
  R(xmlCell([co.address, co.zip, co.city].filter(Boolean).join(' ')));
  R(xmlCell('SIRET : ' + (co.siret || '—')));
  blank();
  R(xmlCell('Client', 'String', 'h') + xmlCell(client?.name || '—'));
  R(xmlCell('Objet', 'String', 'h') + xmlCell(q.title || '—'));
  R(xmlCell('Date', 'String', 'h') + xmlCell(dateLong(opts.date || q.date)));
  R(xmlCell(opts.kind === 'Facture' ? 'Échéance' : 'Validité', 'String', 'h')
    + xmlCell(dateLong(opts.dueDate || q.validUntil)));
  if (opts.paymentMethod) R(xmlCell('Mode de paiement', 'String', 'h') + xmlCell(opts.paymentMethod));
  if (opts.kind === 'Facture' && co.iban) R(xmlCell('IBAN', 'String', 'h') + xmlCell(co.iban));
  blank();
  const headers = noTva
    ? ['Section', 'Désignation', 'Détail', 'Unité', 'Quantité', 'Prix unitaire', 'Coef. marge', 'Total']
    : ['Section', 'Désignation', 'Détail', 'Unité', 'Quantité', 'Prix unit. HT', 'Coef. marge', 'TVA %', 'Total HT'];
  R(headers.map(h => xmlCell(h, 'String', 'th')).join(''));

  for (const s of q.sections) {
    for (const l of s.lines) {
      const total = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      const base =
        xmlCell(SECTION_TYPES[s.type]?.label || s.label) +
        xmlCell(l.designation || '') +
        xmlCell(l.detail || '') +
        xmlCell(l.unit || '') +
        xmlCell(l.qty, 'Number') +
        xmlCell(l.unitPrice, 'Number', 'eur') +
        xmlCell(l.marginCoef, 'Number');
      R(base + (noTva ? '' : xmlCell(l.tva, 'Number')) + xmlCell(total, 'Number', 'eur'));
    }
  }
  blank();
  // Nombre de cellules vides avant la cellule "label" des totaux
  const pad = noTva ? 6 : 7;
  const empties = () => Array(pad).fill(xmlCell('', 'String')).join('');
  R(empties() + xmlCell(noTva ? 'Sous-total' : 'Total HT', 'String', 'th') + xmlCell(c.ht, 'Number', 'eurB'));
  if (c.discount > 0) {
    R(empties() + xmlCell('Remise', 'String', 'th') + xmlCell(-c.discount, 'Number', 'eur'));
  }
  for (const t of c.tvaLines) {
    R(empties() + xmlCell('TVA ' + num(t.rate, 1) + ' %', 'String', 'th') + xmlCell(t.amount, 'Number', 'eur'));
  }
  R(empties() + xmlCell(noTva ? 'TOTAL' : 'TOTAL TTC', 'String', 'th') + xmlCell(c.ttc, 'Number', 'eurB'));
  if (noTva) {
    blank();
    R(xmlCell('TVA non applicable, art. 293 B du CGI.', 'String', 'h'));
  }

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#D97706"/></Style>
  <Style ss:ID="h"><Font ss:Bold="1"/></Style>
  <Style ss:ID="th"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#D97706" ss:Pattern="Solid"/></Style>
  <Style ss:ID="eur"><NumberFormat ss:Format="#,##0.00\\ &quot;€&quot;"/></Style>
  <Style ss:ID="eurB"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0.00\\ &quot;€&quot;"/></Style>
 </Styles>
 <Worksheet ss:Name="${escapeHtml((opts.kind || 'Devis') + ' ' + docNum).slice(0, 28)}">
  <Table>
   <Column ss:Width="120"/><Column ss:Width="220"/><Column ss:Width="170"/>
   <Column ss:Width="55"/><Column ss:Width="65"/><Column ss:Width="85"/>
   <Column ss:Width="75"/><Column ss:Width="55"/><Column ss:Width="95"/>
   ${rowsXml.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel' }), safeFile((opts.kind || 'Devis') + '-' + docNum) + '.xls');
}

// ---------- Word (.doc — HTML lu et éditable par Word) ----------
export function exportWord(q, owner, client, opts = {}) {
  const kind = opts.kind || 'Devis';
  const num = opts.number || q.number;
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office"
   xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>${escapeHtml(kind + ' ' + num)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
  <style>
   body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a18;font-size:11pt}
   h1{color:#d97706;font-size:20pt}
   table{border-collapse:collapse;width:100%}
   td,th{border:1px solid #ccc;padding:6px 8px;font-size:9.5pt}
   th{background:#d97706;color:#fff;text-align:left}
   .sec{background:#faf6ef;color:#b45309;font-weight:bold;text-transform:uppercase}
   .r{text-align:right}
   .tot{font-weight:bold;font-size:13pt}
   .muted{color:#777;font-size:8.5pt}
   .pay-box{background:#faf6ef;border:1px solid #ecd9b6;padding:10pt;margin-top:14pt}
   .pay-box .lbl{color:#b45309;font-size:8.5pt;text-transform:uppercase;letter-spacing:.06em;font-weight:bold;margin-bottom:4pt}
   .iban{font-family:'Courier New',monospace;font-size:10pt;letter-spacing:.02em}
  </style></head><body>` + buildWordBody(q, owner, client, opts) + `</body></html>`;
  downloadBlob(new Blob(['﻿' + html], { type: 'application/msword' }), safeFile(kind + '-' + num) + '.doc');
}

function buildWordBody(q, owner, client, opts = {}) {
  const c = computeQuote(q);
  const co = owner.company;
  const docKind = opts.kind || 'Devis';
  const isInvoice = docKind === 'Facture';
  const docNumber = opts.number || q.number;
  const docTitle = (opts.title || docKind).toUpperCase();
  const dateLabel = isInvoice ? 'Échéance' : 'Validité';
  const dateValue = dateLong(isInvoice ? (opts.dueDate || q.validUntil) : q.validUntil);
  let body = `<h1>${escapeHtml(docTitle)}</h1>
  <table style="border:none"><tr style="border:none">
    <td style="border:none;vertical-align:top">
      <strong>${escapeHtml(co.name || '')}</strong><br>
      ${escapeHtml([co.address, [co.zip, co.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}<br>
      ${co.phone ? 'Tél. ' + escapeHtml(co.phone) + '<br>' : ''}
      ${co.siret ? 'SIRET ' + escapeHtml(co.siret) : ''}
    </td>
    <td style="border:none;vertical-align:top;text-align:right">
      <strong>N° ${escapeHtml(docNumber)}</strong><br>
      Date : ${escapeHtml(dateLong(opts.date || q.date))}<br>
      ${escapeHtml(dateLabel)} : ${escapeHtml(dateValue)}<br><br>
      <strong>Client</strong><br>${escapeHtml(client?.name || '—')}<br>
      ${escapeHtml(client ? [client.address, [client.zip, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '')}
    </td>
  </tr></table>
  ${q.title ? `<h3>${escapeHtml(q.title)}</h3>` : ''}`;
  const noTva = !!q.noTva;
  const colSpan = noTva ? 4 : 5;
  body += `<table><tr>
    <th>Désignation</th><th class="r">Qté</th>
    <th class="r">${noTva ? 'Prix unitaire' : 'P.U. HT'}</th>
    ${noTva ? '' : '<th class="r">TVA</th>'}
    <th class="r">${noTva ? 'Total' : 'Total HT'}</th></tr>`;
  for (const s of q.sections.filter(s => s.lines.length)) {
    body += `<tr><td class="sec" colspan="${colSpan}">${escapeHtml(SECTION_TYPES[s.type]?.label || s.label)}</td></tr>`;
    for (const l of s.lines) {
      const total = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      const pu = (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      body += `<tr><td>${escapeHtml(l.designation)}${l.detail ? `<br><span class="muted">${escapeHtml(l.detail)}</span>` : ''}</td>
        <td class="r">${num(l.qty)} ${escapeHtml(l.unit || '')}</td><td class="r">${eur(pu)}</td>
        ${noTva ? '' : `<td class="r">${num(l.tva, 1)} %</td>`}<td class="r">${eur(total)}</td></tr>`;
    }
  }
  body += `</table><br><table style="width:300px;margin-left:auto">
    <tr><td>${noTva ? 'Sous-total' : 'Total HT'}</td><td class="r">${eur(c.ht)}</td></tr>`;
  if (c.discount > 0) body += `<tr><td>Remise</td><td class="r">- ${eur(c.discount)}</td></tr>`;
  for (const t of c.tvaLines) body += `<tr><td>TVA ${num(t.rate, 1)} %</td><td class="r">${eur(t.amount)}</td></tr>`;
  body += `<tr class="tot"><td>${noTva ? 'TOTAL' : 'TOTAL TTC'}</td><td class="r">${eur(c.ttc)}</td></tr></table>`;
  if (noTva) {
    body += `<p class="muted" style="font-style:italic">TVA non applicable, art. 293 B du CGI.</p>`;
  }
  if (!isInvoice && q.payments?.length) {
    body += `<br><strong>Échéancier de paiement</strong><table><tr><th>Tranche</th><th class="r">Part</th><th class="r">${noTva ? 'Montant' : 'Montant TTC'}</th></tr>`;
    body += q.payments.map(p => `<tr><td>${escapeHtml(p.label)}</td><td class="r">${num(p.percent, 1)} %</td><td class="r">${eur(c.ttc * p.percent / 100)}</td></tr>`).join('');
    body += `</table>`;
  }
  if (isInvoice) {
    body += `<div class="pay-box">
      <div class="lbl">Modalités de règlement</div>
      <table style="border:none;width:100%"><tr style="border:none">
        <td style="border:none;vertical-align:top">
          <span class="muted">À régler avant le</span><br>
          <strong>${escapeHtml(dateValue)}</strong>
        </td>
        <td style="border:none;vertical-align:top">
          <span class="muted">Mode de paiement</span><br>
          <strong>${escapeHtml(opts.paymentMethod || 'Virement bancaire')}</strong>
        </td>
        <td style="border:none;vertical-align:top">
          <span class="muted">Coordonnées bancaires (IBAN)</span><br>
          <span class="iban">${escapeHtml(co.iban || '—')}</span>
        </td>
      </tr></table>
      <p class="muted" style="margin-top:8pt">Pénalités de retard : taux égal à 3 fois le taux d'intérêt légal applicables sans rappel.
      Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.</p>
    </div>`;
  }
  if (q.execDelay && !isInvoice) body += `<p><strong>Délai d'exécution :</strong> ${escapeHtml(q.execDelay)}</p>`;
  if (q.conditions && !isInvoice) body += `<p class="muted">${escapeHtml(q.conditions)}</p>`;
  if (!isInvoice) {
    body += `<br><table style="border:none"><tr style="border:none">
      <td style="border:1px dashed #bbb;height:80px;width:50%">Bon pour accord — le client (date et signature)</td>
      <td style="border:1px dashed #bbb;height:80px">L'entreprise</td></tr></table>`;
  }
  return body;
}
