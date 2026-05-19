// ============================================================
// Devisly — Layouts partagés (marketing & application)
// ============================================================
import { icon } from './icons.js';
import { currentUser, PLANS, quotesThisMonth } from './store.js';
import { initials, escapeHtml, toggleTheme, getTheme, bindDropdown } from './ui.js';
import { logout } from './store.js';

export function brand(size = '') {
  return `<a href="#/" class="brand ${size}">
    <span class="mark">${icon('logo')}</span><span>Devisly</span></a>`;
}

function themeBtn() {
  return `<button class="icon-btn" data-theme-toggle aria-label="Changer de thème">
    ${getTheme() === 'light' ? icon('moon') : icon('sun')}</button>`;
}

// ---------- Marketing ----------
export function marketingNav(active = '') {
  const u = currentUser();
  return `
  <div class="nav-host">
    <nav class="nav">
      ${brand()}
      <div class="nav-links">
        <a href="#/" class="${active === 'home' ? 'on' : ''}">Accueil</a>
        <a href="#/#features">Fonctionnalités</a>
        <a href="#/pricing" class="${active === 'pricing' ? 'on' : ''}">Tarifs</a>
        <a href="#/#how">Comment ça marche</a>
      </div>
      <div class="nav-right">
        ${themeBtn()}
        ${u
          ? `<a href="#/app" class="btn btn-primary btn-sm">Mon espace ${icon('arrow')}</a>`
          : `<a href="#/login" class="btn btn-ghost btn-sm">Connexion</a>
             <a href="#/signup" class="btn btn-primary btn-sm">Essai gratuit</a>`}
        <button class="icon-btn nav-burger" data-burger aria-label="Menu">${icon('menu')}</button>
      </div>
    </nav>
  </div>`;
}

export function marketingFooter() {
  const y = new Date().getFullYear();
  return `
  <footer class="footer">
    <div class="wrap">
      <div class="footer-grid">
        <div style="max-width:18rem">
          ${brand()}
          <p class="muted" style="margin-top:.8rem;font-size:.9rem">
            Le logiciel de devis pensé pour les artisans et les PME du bâtiment.
            Sections BTP, TVA multiple, signature en ligne.</p>
        </div>
        <div class="footer-col">
          <h4>Produit</h4>
          <a href="#/#features">Fonctionnalités</a>
          <a href="#/pricing">Tarifs</a>
          <a href="#/#how">Comment ça marche</a>
          <a href="#/signup">Créer un compte</a>
        </div>
        <div class="footer-col">
          <h4>Ressources</h4>
          <a href="#/#faq">Questions fréquentes</a>
          <a href="#/login">Connexion</a>
          <a href="#/pricing">Comparatif des plans</a>
        </div>
        <div class="footer-col">
          <h4>Légal</h4>
          <a href="#/#">Mentions légales</a>
          <a href="#/#">Conditions générales</a>
          <a href="#/#">Confidentialité (RGPD)</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${y} Devisly — Tous droits réservés.</span>
        <span>Conçu en France pour le bâtiment 🇫🇷</span>
      </div>
    </div>
  </footer>`;
}

export function bindMarketingNav(root) {
  root.querySelectorAll('[data-theme-toggle]').forEach(b =>
    b.addEventListener('click', () => { toggleTheme(); window.dispatchEvent(new Event('rerender')); }));
  const burger = root.querySelector('[data-burger]');
  if (burger) {
    burger.addEventListener('click', () => {
      const items = [
        ['Accueil', '#/'], ['Fonctionnalités', '#/#features'], ['Tarifs', '#/pricing'],
        ['Comment ça marche', '#/#how'], ['Connexion', '#/login'], ['Essai gratuit', '#/signup'],
      ];
      const ov = document.createElement('div');
      ov.className = 'modal-scrim';
      ov.innerHTML = `<div style="display:flex;flex-direction:column;gap:.4rem;text-align:center">
        ${items.map(it => `<a href="${it[1]}" style="font-family:var(--font-display);font-size:1.8rem;font-weight:600;padding:.4rem">${it[0]}</a>`).join('')}</div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click', () => ov.remove());
    });
  }
}

// ---------- Application (authentifiée) ----------
const NAV = [
  { sec: 'Pilotage' },
  { key: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', href: '#/app' },
  { key: 'quotes', label: 'Devis', icon: 'doc', href: '#/app/quotes' },
  { key: 'invoices', label: 'Factures', icon: 'invoice', href: '#/app/invoices' },
  { sec: 'Chantiers' },
  { key: 'chantiers', label: 'Suivi de chantier', icon: 'crane', href: '#/app/chantiers' },
  { key: 'planning', label: 'Planning', icon: 'cal2', href: '#/app/planning' },
  { sec: 'Gestion' },
  { key: 'clients', label: 'Carnet de clients', icon: 'users', href: '#/app/clients' },
  { key: 'library', label: 'Bibliothèque', icon: 'library', href: '#/app/library' },
  { sec: 'Compte' },
  { key: 'account', label: 'Mon entreprise', icon: 'building', href: '#/app/account' },
];

export function sidebar(active) {
  const u = currentUser();
  const plan = PLANS[u.plan];
  const used = quotesThisMonth(u);
  const quotaTxt = plan.quota === Infinity ? 'Devis illimités' : `${used} / ${plan.quota} devis ce mois`;
  return `
  <aside class="sidebar" id="sidebar">
    ${brand()}
    ${NAV.map(n => n.sec
      ? `<div class="side-sec">${n.sec}</div>`
      : `<a href="${n.href}" class="side-link ${active === n.key ? 'on' : ''}">
           ${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
    <div class="side-foot">
      <a href="#/app/account#abonnement" class="plan-pill" style="text-decoration:none">
        <span class="b-icon" style="width:34px;height:34px;margin:0">${icon('star')}</span>
        <span style="flex:1">
          <span class="pp-name">Plan ${plan.name}</span><br>
          <span class="pp-sub">${quotaTxt}</span>
        </span>
        ${icon('chevRight')}
      </a>
    </div>
  </aside>`;
}

export function topbar(title, sub, actions = '') {
  const u = currentUser();
  return `
  <header class="topbar">
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
    </div>
    <div class="topbar-right">
      ${actions}
      <button class="icon-btn" data-theme-toggle aria-label="Thème">
        ${getTheme() === 'light' ? icon('moon') : icon('sun')}</button>
      <div class="dropdown">
        <button class="flex items-center gap-sm" data-user-menu style="padding:.2rem;border-radius:999px">
          <span class="avatar">${u.company.logo ? `<img src="${u.company.logo}">` : initials(u.company.name)}</span>
        </button>
      </div>
    </div>
  </header>`;
}

export function mobileTop(title) {
  const u = currentUser();
  return `
  <div class="mobile-top">
    <button class="icon-btn" data-open-sidebar aria-label="Menu">${icon('menu')}</button>
    <strong style="font-family:var(--font-display);flex:1">${escapeHtml(title)}</strong>
    <button class="icon-btn" data-theme-toggle>${getTheme() === 'light' ? icon('moon') : icon('sun')}</button>
    <span class="avatar sm">${initials(u.company.name)}</span>
  </div>`;
}

// Enveloppe une page applicative dans le shell (sidebar + topbar)
export function appLayout(activeKey, { title, sub, actions, content }) {
  return `
  <div class="app-shell">
    ${sidebar(activeKey)}
    <div class="main">
      ${mobileTop(title)}
      ${topbar(title, sub, actions || '')}
      <div class="content">${content}</div>
    </div>
  </div>`;
}

export function bindAppLayout(root, navigate) {
  root.querySelectorAll('[data-theme-toggle]').forEach(b =>
    b.addEventListener('click', () => { toggleTheme(); window.dispatchEvent(new Event('rerender')); }));

  const sb = root.querySelector('#sidebar');
  root.querySelectorAll('[data-open-sidebar]').forEach(b => b.addEventListener('click', () => {
    sb.classList.add('open');
    const scrim = document.createElement('div');
    scrim.className = 'sidebar-scrim';
    document.body.appendChild(scrim);
    scrim.onclick = () => { sb.classList.remove('open'); scrim.remove(); };
  }));

  const um = root.querySelector('[data-user-menu]');
  if (um) {
    const u = currentUser();
    bindDropdown(um, `
      <div style="padding:.5rem .7rem">
        <div style="font-weight:700;font-size:.88rem">${escapeHtml(u.fullName)}</div>
        <div class="dim" style="font-size:.78rem">${escapeHtml(u.email)}</div>
      </div>
      <div class="dropdown-sep"></div>
      <a data-act="account">${icon('building')} Mon entreprise</a>
      <a data-act="settings">${icon('settings')} Paramètres devis</a>
      <a data-act="plan">${icon('star')} Abonnement</a>
      <div class="dropdown-sep"></div>
      <button data-act="logout">${icon('logout')} Se déconnecter</button>`,
      async (act) => {
        if (act === 'account') navigate('#/app/account');
        else if (act === 'settings') navigate('#/app/account#parametres');
        else if (act === 'plan') navigate('#/app/account#abonnement');
        else if (act === 'logout') { await logout(); navigate('#/'); }
      });
  }
}
