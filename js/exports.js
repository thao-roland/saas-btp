// ============================================================
// Devisly — Export PDF / Excel / Word
// ============================================================
import { computeQuote, SECTION_TYPES } from './store.js';
import { renderQuoteDoc } from './doc.js';
import { eur, num, escapeHtml, downloadBlob, dateLong } from './ui.js';

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

// ---------- PDF (via fenêtre d'impression du navigateur) ----------
export function exportPDF(q, owner, client, opts = {}) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) { alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.'); return; }
  const label = (opts.kind || 'Devis') + ' ' + (opts.number || q.number);
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
    <title>${escapeHtml(label)}</title><style>${DOC_CSS}</style></head>
    <body>${renderQuoteDoc(q, owner, client, opts)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 650);
}

// ---------- Excel (SpreadsheetML 2003 — ouvert nativement par Excel) ----------
function xmlCell(value, type = 'String', styleId) {
  const s = styleId ? ` ss:StyleID="${styleId}"` : '';
  const v = type === 'Number' ? (Number(value) || 0) : escapeHtml(value);
  return `<Cell${s}><Data ss:Type="${type}">${v}</Data></Cell>`;
}

export function exportExcel(q, owner, client) {
  const c = computeQuote(q);
  const co = owner.company;
  const rowsXml = [];
  const R = (cells) => rowsXml.push(`<Row>${cells}</Row>`);
  const blank = () => rowsXml.push('<Row></Row>');

  R(xmlCell('DEVIS ' + q.number, 'String', 'title'));
  R(xmlCell(co.name || '', 'String', 'h'));
  R(xmlCell([co.address, co.zip, co.city].filter(Boolean).join(' ')));
  R(xmlCell('SIRET : ' + (co.siret || '—')));
  blank();
  R(xmlCell('Client', 'String', 'h') + xmlCell(client?.name || '—'));
  R(xmlCell('Objet', 'String', 'h') + xmlCell(q.title || '—'));
  R(xmlCell('Date', 'String', 'h') + xmlCell(dateLong(q.date)));
  R(xmlCell('Validité', 'String', 'h') + xmlCell(dateLong(q.validUntil)));
  blank();
  R(['Section', 'Désignation', 'Détail', 'Unité', 'Quantité', 'Prix unit. HT', 'Coef. marge', 'TVA %', 'Total HT']
    .map(h => xmlCell(h, 'String', 'th')).join(''));

  for (const s of q.sections) {
    for (const l of s.lines) {
      const total = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      R(
        xmlCell(SECTION_TYPES[s.type]?.label || s.label) +
        xmlCell(l.designation || '') +
        xmlCell(l.detail || '') +
        xmlCell(l.unit || '') +
        xmlCell(l.qty, 'Number') +
        xmlCell(l.unitPrice, 'Number', 'eur') +
        xmlCell(l.marginCoef, 'Number') +
        xmlCell(l.tva, 'Number') +
        xmlCell(total, 'Number', 'eur')
      );
    }
  }
  blank();
  R(xmlCell('', 'String') + xmlCell('', 'String') + xmlCell('', 'String') + xmlCell('', 'String') +
    xmlCell('', 'String') + xmlCell('', 'String') + xmlCell('', 'String') +
    xmlCell('Total HT', 'String', 'th') + xmlCell(c.ht, 'Number', 'eurB'));
  if (c.discount > 0) {
    R(Array(7).fill(xmlCell('', 'String')).join('') +
      xmlCell('Remise', 'String', 'th') + xmlCell(-c.discount, 'Number', 'eur'));
  }
  for (const t of c.tvaLines) {
    R(Array(7).fill(xmlCell('', 'String')).join('') +
      xmlCell('TVA ' + num(t.rate, 1) + ' %', 'String', 'th') + xmlCell(t.amount, 'Number', 'eur'));
  }
  R(Array(7).fill(xmlCell('', 'String')).join('') +
    xmlCell('TOTAL TTC', 'String', 'th') + xmlCell(c.ttc, 'Number', 'eurB'));

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
 <Worksheet ss:Name="Devis ${escapeHtml(q.number)}">
  <Table>
   <Column ss:Width="120"/><Column ss:Width="220"/><Column ss:Width="170"/>
   <Column ss:Width="55"/><Column ss:Width="65"/><Column ss:Width="85"/>
   <Column ss:Width="75"/><Column ss:Width="55"/><Column ss:Width="95"/>
   ${rowsXml.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel' }), `Devis-${q.number}.xls`);
}

// ---------- Word (.doc — HTML lu et éditable par Word) ----------
export function exportWord(q, owner, client) {
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office"
   xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>Devis ${escapeHtml(q.number)}</title>
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
  </style></head><body>` + buildWordBody(q, owner, client) + `</body></html>`;
  downloadBlob(new Blob(['﻿' + html], { type: 'application/msword' }), `Devis-${q.number}.doc`);
}

function buildWordBody(q, owner, client) {
  const c = computeQuote(q);
  const co = owner.company;
  let body = `<h1>DEVIS</h1>
  <table style="border:none"><tr style="border:none">
    <td style="border:none;vertical-align:top">
      <strong>${escapeHtml(co.name || '')}</strong><br>
      ${escapeHtml([co.address, [co.zip, co.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}<br>
      ${co.phone ? 'Tél. ' + escapeHtml(co.phone) + '<br>' : ''}
      ${co.siret ? 'SIRET ' + escapeHtml(co.siret) : ''}
    </td>
    <td style="border:none;vertical-align:top;text-align:right">
      <strong>N° ${escapeHtml(q.number)}</strong><br>
      Date : ${escapeHtml(dateLong(q.date))}<br>
      Validité : ${escapeHtml(dateLong(q.validUntil))}<br><br>
      <strong>Client</strong><br>${escapeHtml(client?.name || '—')}<br>
      ${escapeHtml(client ? [client.address, [client.zip, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '')}
    </td>
  </tr></table>
  ${q.title ? `<h3>${escapeHtml(q.title)}</h3>` : ''}
  <table><tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. HT</th><th class="r">TVA</th><th class="r">Total HT</th></tr>`;
  for (const s of q.sections.filter(s => s.lines.length)) {
    body += `<tr><td class="sec" colspan="5">${escapeHtml(SECTION_TYPES[s.type]?.label || s.label)}</td></tr>`;
    for (const l of s.lines) {
      const total = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      const pu = (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
      body += `<tr><td>${escapeHtml(l.designation)}${l.detail ? `<br><span class="muted">${escapeHtml(l.detail)}</span>` : ''}</td>
        <td class="r">${num(l.qty)} ${escapeHtml(l.unit || '')}</td><td class="r">${eur(pu)}</td>
        <td class="r">${num(l.tva, 1)} %</td><td class="r">${eur(total)}</td></tr>`;
    }
  }
  body += `</table><br><table style="width:300px;margin-left:auto">
    <tr><td>Total HT</td><td class="r">${eur(c.ht)}</td></tr>`;
  if (c.discount > 0) body += `<tr><td>Remise</td><td class="r">- ${eur(c.discount)}</td></tr>`;
  for (const t of c.tvaLines) body += `<tr><td>TVA ${num(t.rate, 1)} %</td><td class="r">${eur(t.amount)}</td></tr>`;
  body += `<tr class="tot"><td>TOTAL TTC</td><td class="r">${eur(c.ttc)}</td></tr></table>`;
  if (q.payments?.length) {
    body += `<br><strong>Échéancier de paiement</strong><table><tr><th>Tranche</th><th class="r">Part</th><th class="r">Montant TTC</th></tr>`;
    body += q.payments.map(p => `<tr><td>${escapeHtml(p.label)}</td><td class="r">${num(p.percent, 1)} %</td><td class="r">${eur(c.ttc * p.percent / 100)}</td></tr>`).join('');
    body += `</table>`;
  }
  if (q.execDelay) body += `<p><strong>Délai d'exécution :</strong> ${escapeHtml(q.execDelay)}</p>`;
  if (q.conditions) body += `<p class="muted">${escapeHtml(q.conditions)}</p>`;
  body += `<br><table style="border:none"><tr style="border:none">
    <td style="border:1px dashed #bbb;height:80px;width:50%">Bon pour accord — le client (date et signature)</td>
    <td style="border:1px dashed #bbb;height:80px">L'entreprise</td></tr></table>`;
  return body;
}
