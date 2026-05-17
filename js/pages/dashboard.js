// ============================================================
// Devisly — Tableau de bord
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import { currentUser, computeQuote, getClient, QUOTE_STATUS, canCreateQuote } from '../store.js';
import { eur, eur0, dateFR, relTime, escapeHtml, statusBadge, initials, toast } from '../ui.js';

export function renderDashboard(ctx) {
  const u = currentUser();
  const quotes = u.quotes;
  const ttc = q => computeQuote(q).ttc;

  const pending = quotes.filter(q => q.status === 'sent');
  const accepted = quotes.filter(q => q.status === 'accepted' || q.status === 'invoiced');
  const decided = quotes.filter(q => ['accepted', 'refused', 'invoiced'].includes(q.status));
  const acceptRate = decided.length ? Math.round(accepted.length / decided.length * 100) : 0;
  const caPotentiel = quotes.filter(q => ['draft', 'sent'].includes(q.status)).reduce((s, q) => s + ttc(q), 0);
  const caSigne = accepted.reduce((s, q) => s + ttc(q), 0);

  // Graphe : 6 derniers mois (CA des devis créés)
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), m: d.getMonth(), y: d.getFullYear(), val: 0 });
  }
  quotes.forEach(q => {
    const d = new Date(q.createdAt);
    const slot = months.find(x => x.m === d.getMonth() && x.y === d.getFullYear());
    if (slot) slot.val += ttc(q);
  });
  const maxVal = Math.max(...months.map(m => m.val), 1);

  // Donut : répartition par statut
  const statusCounts = {};
  quotes.forEach(q => statusCounts[q.status] = (statusCounts[q.status] || 0) + 1);
  const donutColors = { draft: '#8a867c', sent: '#1d4ed8', accepted: '#15803d', refused: '#b91c1c', expired: '#b45309', invoiced: '#0f766e' };
  let acc = 0;
  const donutSegs = Object.entries(statusCounts).map(([st, n]) => {
    const frac = n / quotes.length;
    const seg = { st, n, color: donutColors[st], from: acc, to: acc + frac };
    acc += frac;
    return seg;
  });

  // Relances à effectuer
  const relances = pending.filter(q => (Date.now() - q.createdAt) > u.settings.relanceDelay * 86400000);

  const recent = [...quotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  function stat(ic, color, soft, val, lbl, trend) {
    return `
    <div class="stat reveal">
      <div class="s-top">
        <div class="s-icon" style="background:${soft};color:${color}">${icon(ic)}</div>
        ${trend || ''}
      </div>
      <div class="s-val">${val}</div>
      <div class="s-lbl">${lbl}</div>
    </div>`;
  }

  const donutGrad = donutSegs.length
    ? `conic-gradient(${donutSegs.map(s => `${s.color} ${s.from * 100}% ${s.to * 100}%`).join(',')})`
    : 'var(--line-strong)';

  const content = `
    <div class="page-head">
      <div>
        <h2>Bonjour, ${escapeHtml((u.fullName || '').split(' ')[0] || u.company.name)} 👋</h2>
        <p>Voici l'activité de ${escapeHtml(u.company.name)} en un coup d'œil.</p>
      </div>
      <a href="#/app/quotes/new" class="btn btn-primary" data-newquote>${icon('plus')} Nouveau devis</a>
    </div>

    <div class="stat-grid">
      ${stat('euro', '#b45309', 'var(--accent-soft)', eur0(caPotentiel), 'CA potentiel en cours',
        `<span class="s-trend up">${icon('arrowUp')} ${pending.length + quotes.filter(q => q.status === 'draft').length} devis</span>`)}
      ${stat('target', '#15803d', 'var(--ok-soft)', acceptRate + ' %', "Taux d'acceptation",
        `<span class="s-trend ${acceptRate >= 50 ? 'up' : 'down'}">${accepted.length}/${decided.length} signés</span>`)}
      ${stat('clock', '#1d4ed8', 'var(--info-soft)', String(pending.length), 'Devis en attente de réponse',
        relances.length ? `<span class="s-trend down">${icon('bell')} ${relances.length} à relancer</span>` : '')}
      ${stat('trophy', '#0f766e', 'var(--ok-soft)', eur0(caSigne), 'CA signé',
        `<span class="s-trend up">${accepted.length} chantiers</span>`)}
    </div>

    <div class="dash-grid">
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="panel reveal">
          <div class="flex-between" style="margin-bottom:.4rem">
            <h3 style="font-size:1.1rem;font-family:var(--font-ui);font-weight:700">Volume de devis — 6 mois</h3>
            <span class="dim" style="font-size:.82rem">Montant TTC créé</span>
          </div>
          <div class="chart">
            ${months.map(m => `
              <div class="col">
                <div class="bar-track">
                  <div class="bar ${m.val === 0 ? 'muted' : ''}" style="height:${Math.max(m.val / maxVal * 100, 3)}%"
                    title="${eur(m.val)}"></div>
                </div>
                <span class="c-lbl">${m.label}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="panel reveal" style="padding:0">
          <div class="flex-between" style="padding:1.3rem 1.5rem .6rem">
            <h3 style="font-size:1.1rem;font-family:var(--font-ui);font-weight:700">Devis récents</h3>
            <a href="#/app/quotes" class="btn btn-quiet btn-sm">Tout voir ${icon('arrow')}</a>
          </div>
          ${recent.length ? `
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Numéro</th><th>Client</th><th>Statut</th><th class="num">Montant TTC</th><th>Date</th></tr></thead>
              <tbody>
                ${recent.map(q => {
                  const c = getClient(q.clientId);
                  return `<tr data-quote="${q.id}">
                    <td class="t-strong">${escapeHtml(q.number)}<div class="cell-sub">${escapeHtml(q.title || 'Sans objet')}</div></td>
                    <td>${escapeHtml(c?.name || '—')}</td>
                    <td>${statusBadge(q.status, QUOTE_STATUS)}</td>
                    <td class="num t-strong">${eur(ttc(q))}</td>
                    <td>${dateFR(q.createdAt)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : `
          <div class="empty">
            <div class="e-icon">${icon('doc')}</div>
            <h3>Aucun devis pour le moment</h3>
            <p>Créez votre premier devis BTP — il apparaîtra ici avec son statut et son montant.</p>
            <a href="#/app/quotes/new" class="btn btn-primary">${icon('plus')} Créer un devis</a>
          </div>`}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="panel reveal">
          <h3 style="font-size:1.1rem;font-family:var(--font-ui);font-weight:700;margin-bottom:1rem">Répartition des devis</h3>
          ${quotes.length ? `
          <div class="donut-wrap">
            <div class="donut" style="border-radius:50%;background:${donutGrad};
              -webkit-mask:radial-gradient(transparent 38%,#000 39%);mask:radial-gradient(transparent 38%,#000 39%)"></div>
            <div class="donut-legend">
              ${donutSegs.map(s => `
                <div class="legend-row">
                  <span class="swatch" style="background:${s.color}"></span>
                  <span>${QUOTE_STATUS[s.st]?.label || s.st}</span>
                  <span class="lr-val">${s.n}</span>
                </div>`).join('')}
            </div>
          </div>` : `<p class="dim" style="font-size:.88rem">Les statistiques apparaîtront dès votre premier devis.</p>`}
        </div>

        <div class="panel reveal">
          <div class="flex items-center gap-sm" style="margin-bottom:.8rem">
            <span class="b-icon" style="width:34px;height:34px;margin:0">${icon('bell')}</span>
            <h3 style="font-size:1.1rem;font-family:var(--font-ui);font-weight:700">Relances à effectuer</h3>
          </div>
          ${relances.length ? `
          <div class="stack">
            ${relances.map(q => {
              const c = getClient(q.clientId);
              return `<div class="mini-row">
                <div class="mr-grow">
                  <div style="font-weight:600;font-size:.88rem">${escapeHtml(q.number)} — ${escapeHtml(c?.name || 'Client')}</div>
                  <div class="dim" style="font-size:.76rem">Envoyé ${relTime(q.createdAt)} · ${eur(ttc(q))}</div>
                </div>
                <button class="btn btn-ghost btn-sm" data-relance="${q.id}">${icon('mail')} Relancer</button>
              </div>`;
            }).join('')}
          </div>
          <p class="dim" style="font-size:.76rem;margin-top:.8rem">
            Relance configurée à ${u.settings.relanceDelay} jours sans réponse.</p>
          ` : `<p class="dim" style="font-size:.88rem">Aucune relance en attente. Tous vos devis envoyés sont récents. ✓</p>`}
        </div>

        <div class="panel reveal" style="background:linear-gradient(160deg,var(--surface),var(--accent-soft))">
          <div class="flex items-center gap-sm">
            <span class="b-icon" style="width:34px;height:34px;margin:0">${icon('sparkle')}</span>
            <h3 style="font-size:1.05rem;font-family:var(--font-ui);font-weight:700">Astuce</h3>
          </div>
          <p class="muted" style="font-size:.88rem;margin-top:.6rem">
            Enregistrez vos ouvrages courants dans la bibliothèque de prestations
            pour composer vos devis encore plus vite.</p>
          <a href="#/app/library" class="btn btn-ghost btn-sm" style="margin-top:.8rem">
            ${icon('library')} Ouvrir la bibliothèque</a>
        </div>
      </div>
    </div>`;

  ctx.app.innerHTML = appLayout('dashboard', {
    title: 'Tableau de bord', sub: 'Vue d\'ensemble de votre activité', content,
  });
  bindAppLayout(ctx.app, ctx.navigate);

  ctx.app.querySelectorAll('[data-quote]').forEach(tr =>
    tr.addEventListener('click', () => ctx.navigate('#/app/quotes/' + tr.dataset.quote)));

  ctx.app.querySelector('[data-newquote]')?.addEventListener('click', e => {
    if (!canCreateQuote(u)) {
      e.preventDefault();
      toast('Quota du plan Starter atteint. Passez au plan Pro pour des devis illimités.', 'err');
      ctx.navigate('#/app/account#abonnement');
    }
  });

  ctx.app.querySelectorAll('[data-relance]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const q = u.quotes.find(x => x.id === b.dataset.relance);
    const c = getClient(q.clientId);
    const subject = `Relance — Devis ${q.number}`;
    const body = `Bonjour,\n\nNous revenons vers vous concernant notre devis ${q.number}` +
      (q.title ? ` (${q.title})` : '') + ` d'un montant de ${eur(ttc(q))}.\n\n` +
      `Nous restons à votre disposition pour toute question.\n\nCordialement,\n${u.company.name}`;
    window.location.href = `mailto:${c?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast('E-mail de relance préparé.');
  }));
}
