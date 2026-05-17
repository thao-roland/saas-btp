// ============================================================
// Devisly — Point d'entrée & routeur (hash-based)
// ============================================================
import * as store from './store.js';
import { applyTheme, getTheme, observeReveals } from './ui.js';
import { renderLanding, renderPricing } from './pages/landing.js';
import { renderAuth } from './pages/auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderQuotes } from './pages/quotes.js';
import { renderEditor } from './pages/editor.js';
import { renderClients } from './pages/clients.js';
import { renderLibrary } from './pages/library.js';
import { renderInvoices } from './pages/invoices.js';
import { renderAccount } from './pages/account.js';
import { renderShare } from './pages/share.js';

store.init();
applyTheme(getTheme());

const app = document.getElementById('app');

export function navigate(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

const ROUTES = [
  { re: /^\/?$/, page: renderLanding, public: true },
  { re: /^\/pricing\/?$/, page: renderPricing, public: true },
  { re: /^\/(login|signup)\/?$/, page: renderAuth, public: true, params: m => ({ mode: m[1] }) },
  { re: /^\/share\/([\w-]+)\/?$/, page: renderShare, public: true, params: m => ({ token: m[1] }) },
  { re: /^\/app\/?$/, page: renderDashboard },
  { re: /^\/app\/quotes\/?$/, page: renderQuotes },
  { re: /^\/app\/quotes\/new\/?$/, page: renderEditor, params: () => ({ id: null }) },
  { re: /^\/app\/quotes\/([\w-]+)\/?$/, page: renderEditor, params: m => ({ id: m[1] }) },
  { re: /^\/app\/clients\/?$/, page: renderClients },
  { re: /^\/app\/library\/?$/, page: renderLibrary },
  { re: /^\/app\/invoices\/?$/, page: renderInvoices },
  { re: /^\/app\/account\/?$/, page: renderAccount },
];

function router() {
  let raw = location.hash.replace(/^#/, '') || '/';
  const [path, frag] = raw.split('#');
  let matched = null, params = {};
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) { matched = r; params = r.params ? r.params(m) : {}; break; }
  }

  if (!matched) { location.hash = '#/'; return; }

  const user = store.currentUser();
  if (!matched.public && !user) { location.hash = '#/login'; return; }
  if (matched.public && user && /^\/(login|signup)\/?$/.test(path)) { location.hash = '#/app'; return; }

  const ctx = { params, frag: frag || '', navigate, app };
  window.scrollTo(0, 0);
  document.getElementById('modal-host').innerHTML = '';
  document.querySelectorAll('.dropdown-menu, .sidebar-scrim').forEach(el => el.remove());
  app.innerHTML = '';
  matched.page(ctx);
  requestAnimationFrame(() => observeReveals(app));
}

window.addEventListener('hashchange', router);
window.addEventListener('rerender', router);
router();
