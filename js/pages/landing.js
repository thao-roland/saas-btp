// ============================================================
// Devisly — Page d'accueil & Tarifs
// ============================================================
import { icon } from '../icons.js';
import { marketingNav, marketingFooter, bindMarketingNav } from '../layout.js';
import { PLANS } from '../store.js';

const FEATURES = [
  { span: 3, icon: 'hammer', t: 'Sections 100 % BTP',
    d: "Main d'œuvre, matériaux, sous-traitance, déplacements et location de matériel : chaque poste a sa place et son calcul." },
  { span: 3, icon: 'percent', t: 'TVA multiple maîtrisée',
    d: 'Appliquez 5,5 %, 10 % ou 20 % ligne par ligne. La ventilation de TVA est calculée et détaillée automatiquement.' },
  { span: 2, icon: 'library', t: 'Bibliothèque de prestations',
    d: 'Enregistrez vos ouvrages récurrents (pose carrelage m², peinture, maçonnerie) et insérez-les en un clic.' },
  { span: 2, icon: 'wallet', t: 'Tranches de paiement',
    d: 'Acompte, situations de travaux, solde : votre échéancier est généré sur le devis.' },
  { span: 2, icon: 'signature', t: 'Signature en ligne',
    d: 'Le client accepte ou refuse depuis un lien sécurisé. Vous êtes notifié immédiatement.' },
  { span: 3, icon: 'download', t: 'Export PDF, Excel & Word',
    d: 'Un devis soigné avec logo, en-tête et pied de page légal — dans le format attendu par chaque client.' },
  { span: 3, icon: 'refresh', t: 'Devis converti en facture',
    d: "D'un clic, transformez un devis accepté en facture conforme, sans ressaisie." },
];

const STEPS = [
  { t: 'Créez votre entreprise', d: 'Logo, SIRET, RCS, assurance : votre identité apparaît sur chaque document.' },
  { t: 'Composez le devis', d: 'Ajoutez vos sections BTP, vos prestations et vos coefficients de marge.' },
  { t: 'Envoyez au client', d: 'Partagez un lien de visualisation et laissez le client signer en ligne.' },
  { t: 'Suivez & facturez', d: 'Relances automatiques, tableau de bord et conversion en facture.' },
];

const FAQ = [
  { q: "Devisly est-il adapté aux artisans seuls ?",
    a: "Oui. Le plan Starter est gratuit et le plan Pro propose les devis illimités pour un indépendant. Le plan Entreprise ajoute le multi-utilisateurs pour les PME." },
  { q: 'Mes données sont-elles en sécurité ?',
    a: "Cette démonstration fonctionne entièrement dans votre navigateur : aucune donnée n'est transmise à un serveur tiers. En production, les données sont chiffrées et hébergées en France." },
  { q: 'Puis-je gérer plusieurs taux de TVA sur un même devis ?',
    a: 'Oui. Chaque ligne porte son propre taux (5,5 %, 10 % ou 20 %) et la ventilation est récapitulée en pied de devis.' },
  { q: 'Le devis peut-il être converti en facture ?',
    a: "Un devis accepté se transforme en facture en un clic, en conservant l'intégralité des postes et des montants." },
];

function appMock() {
  return `
  <div class="hero-frame reveal">
    <div class="shell">
      <div class="app-preview" style="background:var(--surface)">
        <div style="display:flex">
          <div style="width:62px;border-right:1px solid var(--line);padding:1rem .6rem;display:flex;flex-direction:column;gap:.55rem">
            ${['logo', 'dashboard', 'doc', 'invoice', 'users', 'library'].map((ic, i) =>
              `<div style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
                background:${i === 1 ? 'var(--accent-soft)' : 'transparent'};
                color:${i === 1 ? 'var(--accent-strong)' : i === 0 ? '#fff' : 'var(--ink-3)'};
                ${i === 0 ? 'background:var(--accent)' : ''}">${icon(ic)}</div>`).join('')}
          </div>
          <div style="flex:1;padding:1.3rem 1.5rem">
            <div class="flex-between">
              <div>
                <div style="font-family:var(--font-display);font-size:1.15rem;font-weight:600">Tableau de bord</div>
                <div class="dim" style="font-size:.78rem">Vue d'ensemble de votre activité</div>
              </div>
              <div class="btn btn-primary btn-sm">${icon('plus')} Nouveau devis</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-top:1rem">
              ${[['CA potentiel', '48 250 €', 'euro'], ['Taux d\'acceptation', '67 %', 'target'], ['Devis en attente', '2', 'clock']].map(s => `
                <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:13px;padding:.9rem">
                  <div style="color:var(--accent-strong)">${icon(s[2])}</div>
                  <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:600;margin-top:.4rem">${s[1]}</div>
                  <div class="dim" style="font-size:.74rem">${s[0]}</div>
                </div>`).join('')}
            </div>
            <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:13px;padding:.9rem;margin-top:.7rem">
              <div style="display:flex;align-items:flex-end;gap:.4rem;height:80px">
                ${[40, 65, 35, 80, 55, 95, 70].map(h =>
                  `<div style="flex:1;height:${h}%;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,var(--accent),var(--accent-strong))"></div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

export function renderLanding(ctx) {
  ctx.app.innerHTML = `
  ${marketingNav('home')}
  <main>
    <section class="hero">
      <div class="wrap center">
        <div class="reveal in" style="display:flex;justify-content:center"><span class="eyebrow">Devis BTP · Artisans & PME du bâtiment</span></div>
        <h1 class="reveal in" style="margin-top:1.2rem">Le devis bâtiment,<br>enfin sans prise de tête.</h1>
        <p class="lead reveal in">
          Devisly réunit sections de chantier, TVA multiple, bibliothèque de prestations
          et signature en ligne dans un logiciel pensé pour le BTP.</p>
        <div class="hero-cta reveal in">
          <a href="#/signup" class="btn btn-primary btn-lg">Créer un devis gratuitement
            <span class="nub">${icon('arrow')}</span></a>
          <a href="#/pricing" class="btn btn-ghost btn-lg">Voir les tarifs</a>
        </div>
        <div class="hero-meta reveal in">
          <span>${icon('check')} Sans carte bancaire</span>
          <span>${icon('check')} 5 devis/mois offerts</span>
          <span>${icon('check')} Export PDF, Excel & Word</span>
        </div>
        ${appMock()}
      </div>
    </section>

    <section class="section" id="features">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Fonctionnalités</span>
          <h2>Tout le chantier, dans un seul outil</h2>
          <p>Chaque détail du devis BTP est pris en charge — de la main d'œuvre à la signature du client.</p>
        </div>
        <div class="bento">
          ${FEATURES.map(f => `
            <div class="b feature span-${f.span} reveal">
              <div class="b-icon">${icon(f.icon)}</div>
              <h3>${f.t}</h3>
              <p>${f.d}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" id="how" style="background:var(--surface-2);border-block:1px solid var(--line)">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Comment ça marche</span>
          <h2>De l'estimation à la facture</h2>
          <p>Quatre étapes pour transformer un chiffrage en chantier signé.</p>
        </div>
        <div class="steps">
          ${STEPS.map((s, i) => `
            <div class="step card reveal">
              <div class="num">0${i + 1}</div>
              <h3>${s.t}</h3>
              <p>${s.d}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="bento">
          <div class="b span-3 reveal" style="display:flex;flex-direction:column;justify-content:center">
            <span class="eyebrow">Conçu pour le bâtiment</span>
            <h2 style="font-size:2rem;margin-top:1rem">La TVA BTP, calculée pour vous</h2>
            <p class="muted" style="margin-top:.8rem">
              Rénovation énergétique à 5,5 %, travaux d'entretien à 10 %, construction neuve à 20 % :
              appliquez le bon taux par ligne. Devisly ventile et récapitule la TVA sans erreur.</p>
            <div style="margin-top:1.2rem;display:flex;gap:.5rem;flex-wrap:wrap">
              <span class="badge green no-dot">5,5 % rénovation</span>
              <span class="badge blue no-dot">10 % entretien</span>
              <span class="badge amber no-dot">20 % neuf</span>
            </div>
          </div>
          <div class="b span-3 reveal" style="padding:0;overflow:hidden">
            <div style="background:var(--surface-2);padding:1.5rem;height:100%">
              <div class="dim" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;font-weight:700">Récapitulatif TVA</div>
              ${[['Base 5,5 %', '8 400 €', '462,00 €'], ['Base 10 %', '21 500 €', '2 150,00 €'], ['Base 20 %', '6 200 €', '1 240,00 €']].map(r => `
                <div class="flex-between" style="padding:.6rem 0;border-bottom:1px solid var(--line);font-size:.9rem">
                  <span class="muted">${r[0]} <span class="dim">· ${r[1]}</span></span><strong>${r[2]}</strong>
                </div>`).join('')}
              <div class="flex-between" style="padding-top:.8rem;font-family:var(--font-display);font-size:1.3rem;font-weight:600">
                <span>Total TTC</span><span>39 892,00 €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="faq" style="background:var(--surface-2);border-block:1px solid var(--line)">
      <div class="wrap" style="max-width:780px">
        <div class="section-head">
          <span class="eyebrow">Questions fréquentes</span>
          <h2>Vous hésitez encore ?</h2>
        </div>
        <div class="stack">
          ${FAQ.map(f => `
            <details class="card card-pad reveal">
              <summary style="cursor:pointer;font-weight:600;font-family:var(--font-display);font-size:1.05rem;list-style:none;display:flex;justify-content:space-between;align-items:center">
                ${f.q}<span style="color:var(--accent)">${icon('plus')}</span></summary>
              <p class="muted" style="margin-top:.8rem">${f.a}</p>
            </details>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="shell reveal">
          <div class="card card-pad center" style="padding:3.5rem 2rem;background:linear-gradient(160deg,var(--surface),var(--surface-2))">
            <span class="eyebrow">Prêt à chiffrer ?</span>
            <h2 style="font-size:2.4rem;margin-top:1rem">Votre premier devis BTP en 5 minutes</h2>
            <p class="muted" style="margin-top:.7rem;max-width:30rem;margin-inline:auto">
              Créez un compte gratuit ou explorez immédiatement le compte de démonstration.</p>
            <div class="hero-cta">
              <a href="#/signup" class="btn btn-primary btn-lg">Commencer gratuitement
                <span class="nub">${icon('arrow')}</span></a>
              <a href="#/login" class="btn btn-ghost btn-lg">Voir la démo</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  ${marketingFooter()}`;

  bindMarketingNav(ctx.app);
  ctx.app.querySelectorAll('details').forEach(d => {
    d.addEventListener('toggle', () => {
      const s = d.querySelector('summary span');
      if (s) s.innerHTML = d.open ? icon('minus') : icon('plus');
    });
  });
}

// ---------- Tarifs ----------
const PLAN_FEATURES = {
  starter: ['5 devis par mois', 'Sections BTP & TVA multiple', 'Bibliothèque de prestations',
    'Export PDF', 'Carnet de clients', '1 utilisateur'],
  pro: ['Devis illimités', 'Sections BTP & TVA multiple', 'Bibliothèque de prestations',
    'Export PDF, Excel & Word', 'Signature en ligne du client', 'Relances automatiques',
    'Conversion devis → facture', 'Tableau de bord & statistiques', '1 utilisateur'],
  entreprise: ['Tout le plan Pro', "Jusqu'à 8 utilisateurs", 'Modèles de devis partagés',
    'Pilotage multi-équipes', 'Personnalisation avancée des documents', 'Support prioritaire'],
};

const COMPARE = [
  ['Devis par mois', '5', 'Illimités', 'Illimités'],
  ['Sections BTP & TVA multiple', 1, 1, 1],
  ['Bibliothèque de prestations', 1, 1, 1],
  ['Export PDF', 1, 1, 1],
  ['Export Excel & Word', 0, 1, 1],
  ['Signature en ligne', 0, 1, 1],
  ['Relances automatiques', 0, 1, 1],
  ['Conversion en facture', 0, 1, 1],
  ['Tableau de bord & stats', 0, 1, 1],
  ['Utilisateurs inclus', '1', '1', "Jusqu'à 8"],
  ['Modèles partagés', 0, 0, 1],
  ['Support prioritaire', 0, 0, 1],
];

export function renderPricing(ctx) {
  const cell = (v) => typeof v === 'number'
    ? (v ? icon('check') : `<span class="x">—</span>`)
    : v;

  ctx.app.innerHTML = `
  ${marketingNav('pricing')}
  <main>
    <section class="section" style="padding-top:3.5rem">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Tarifs</span>
          <h2>Un plan pour chaque taille d'entreprise</h2>
          <p>De l'artisan indépendant à la PME du bâtiment. Sans engagement, résiliable à tout moment.</p>
        </div>

        <div class="price-grid">
          ${Object.values(PLANS).map(p => {
            const featured = p.id === 'pro';
            return `
            <div class="card plan ${featured ? 'featured' : ''} reveal">
              ${featured ? `<span class="plan-tag">Le plus choisi</span>` : ''}
              <h3>${p.name}</h3>
              <p class="plan-desc">${p.desc}</p>
              <div class="price">${p.price === 0 ? 'Gratuit' : p.price + ' €'}<small>${p.price === 0 ? '' : ' / mois HT'}</small></div>
              <ul>
                ${PLAN_FEATURES[p.id].map(f => `<li>${icon('check')}<span>${f}</span></li>`).join('')}
              </ul>
              <a href="#/signup" class="btn ${featured ? 'btn-primary' : 'btn-ghost'} btn-block btn-lg">
                ${p.price === 0 ? 'Commencer gratuitement' : 'Choisir ' + p.name}
              </a>
            </div>`;
          }).join('')}
        </div>

        <div class="card card-pad reveal" style="margin-top:2.5rem;overflow-x:auto">
          <h3 style="font-size:1.4rem">Comparatif détaillé des plans</h3>
          <table class="compare">
            <thead><tr><th></th><th>Starter</th><th>Pro</th><th>Entreprise</th></tr></thead>
            <tbody>
              ${COMPARE.map(r => `
                <tr><td>${r[0]}</td><td>${cell(r[1])}</td><td>${cell(r[2])}</td><td>${cell(r[3])}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <p class="dim center" style="margin-top:1.5rem;font-size:.85rem">
          Les prix sont indicatifs et hors taxes. Cette application est une démonstration ;
          aucun paiement réel n'est traité.</p>
      </div>
    </section>
  </main>
  ${marketingFooter()}`;

  bindMarketingNav(ctx.app);
}
