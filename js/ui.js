// ============================================================
// Devisly — Helpers UI partagés
// ============================================================
import { icon } from './icons.js';

// ---------- Formatage ----------
export const eur = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const eur0 = (n) => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
export const num = (n, d = 2) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: d });

export function dateFR(d) {
  if (!d) return '—';
  const dt = typeof d === 'number' ? new Date(d) : new Date(d + (String(d).length === 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function dateLong(d) {
  if (!d) return '—';
  const dt = typeof d === 'number' ? new Date(d) : new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function relTime(ts) {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < day) return "aujourd'hui";
  if (diff < day * 2) return 'hier';
  if (diff < day * 30) return `il y a ${Math.floor(diff / day)} jours`;
  if (diff < day * 60) return 'il y a 1 mois';
  return `il y a ${Math.floor(diff / day / 30)} mois`;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

// ---------- Toast ----------
export function toast(msg, kind = 'ok') {
  const host = document.getElementById('toast-host');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const ic = kind === 'err' ? 'x' : kind === 'info' ? 'info' : 'check';
  el.innerHTML = `<span class="dot">${icon(ic)}</span><span>${escapeHtml(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 360);
  }, 3200);
}

// ---------- Modal ----------
export function modal({ title, body, foot, size = '', onMount }) {
  const host = document.getElementById('modal-host');
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3 style="font-size:1.15rem">${escapeHtml(title)}</h3>
        <button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  host.appendChild(scrim);
  const close = () => { scrim.style.animation = 'fade .25s reverse'; setTimeout(() => scrim.remove(), 200); };
  scrim.addEventListener('mousedown', e => { if (e.target === scrim) close(); });
  scrim.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  if (onMount) onMount(scrim.querySelector('.modal'), close);
  return { el: scrim.querySelector('.modal'), close };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise(resolve => {
    modal({
      title,
      body: `<p class="muted">${escapeHtml(message)}</p>`,
      foot: `<button class="btn btn-ghost" data-no>Annuler</button>
             <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${escapeHtml(confirmLabel)}</button>`,
      onMount(el, close) {
        el.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
        el.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
      },
    });
  });
}

// ---------- Thème ----------
export function getTheme() { return localStorage.getItem('devisly:theme') || 'light'; }
export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('devisly:theme', t);
}
export function toggleTheme() {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

// ---------- Reveal au scroll ----------
let revealObserver;
export function observeReveals(root = document) {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.12 });
  }
  root.querySelectorAll('.reveal:not(.in)').forEach((el, i) => {
    el.style.transitionDelay = Math.min(i * 60, 360) + 'ms';
    revealObserver.observe(el);
  });
}

// ---------- Dropdown ----------
export function bindDropdown(triggerEl, menuHtml, onAction) {
  triggerEl.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.innerHTML = menuHtml;
    triggerEl.parentElement.style.position = 'relative';
    triggerEl.parentElement.appendChild(menu);
    menu.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        menu.remove();
        onAction(b.dataset.act);
      });
    });
    setTimeout(() => {
      document.addEventListener('click', function off() {
        menu.remove();
        document.removeEventListener('click', off);
      }, { once: true });
    });
  });
}

// ---------- Téléchargement de fichier ----------
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function statusBadge(status, map) {
  const s = map[status];
  if (!s) return '';
  return `<span class="badge ${s.color}">${escapeHtml(s.label)}</span>`;
}
