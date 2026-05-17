// ============================================================
// Devisly — Inscription / Connexion
// ============================================================
import { icon } from '../icons.js';
import { brand } from '../layout.js';
import { signup, login } from '../store.js';
import { toast, getTheme, toggleTheme } from '../ui.js';

export function renderAuth(ctx) {
  let mode = ctx.params.mode === 'signup' ? 'signup' : 'login';

  function view() {
    ctx.app.innerHTML = `
    <div class="auth-wrap">
      <aside class="auth-aside">
        <div>${brand()}</div>
        <div>
          <div class="eyebrow" style="color:#f5c98a;background:rgba(217,119,6,.18);border-color:rgba(217,119,6,.4)">
            Logiciel de devis BTP</div>
          <p class="auth-quote" style="margin-top:1.2rem">
            « Mes devis de chantier sont prêts en quelques minutes, avec la bonne TVA
            et un rendu qui inspire confiance à mes clients. »</p>
          <p style="margin-top:1rem;color:rgba(243,241,236,.6);font-size:.88rem">
            Julien M. — Gérant, entreprise de rénovation</p>
        </div>
        <div class="auth-stats">
          <div><div class="n">5,5 → 20 %</div><div class="l">TVA BTP gérées</div></div>
          <div><div class="n">PDF · Excel · Word</div><div class="l">Exports professionnels</div></div>
        </div>
      </aside>

      <main class="auth-main">
        <div class="auth-card reveal in">
          <button class="icon-btn" data-theme style="position:absolute;top:1.5rem;right:1.5rem">
            ${getTheme() === 'light' ? icon('moon') : icon('sun')}</button>
          <h1>${mode === 'login' ? 'Bon retour parmi nous' : 'Créez votre compte'}</h1>
          <p class="muted" style="margin-top:.4rem">
            ${mode === 'login'
              ? 'Connectez-vous pour piloter vos devis et vos chantiers.'
              : 'Démarrez gratuitement — aucune carte bancaire requise.'}</p>

          <div class="auth-tabs">
            <button data-tab="login" class="${mode === 'login' ? 'on' : ''}">Connexion</button>
            <button data-tab="signup" class="${mode === 'signup' ? 'on' : ''}">Inscription</button>
          </div>

          <form id="auth-form">
            ${mode === 'signup' ? `
            <div class="field">
              <label for="f-name">Nom du responsable</label>
              <input class="input" id="f-name" name="fullName" placeholder="Prénom et nom" autocomplete="name" required>
            </div>
            <div class="field">
              <label for="f-company">Nom de l'entreprise</label>
              <input class="input" id="f-company" name="companyName" placeholder="Raison sociale" autocomplete="organization" required>
            </div>` : ''}
            <div class="field">
              <label for="f-email">E-mail professionnel</label>
              <input class="input" id="f-email" name="email" type="email" placeholder="vous@entreprise.fr" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="f-pass">Mot de passe</label>
              <input class="input" id="f-pass" name="password" type="password" placeholder="${mode === 'signup' ? '8 caractères minimum' : 'Votre mot de passe'}" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6">
            </div>
            ${mode === 'signup' ? `
            <div class="field">
              <label class="checkrow" style="font-weight:400;color:var(--ink-2);font-size:.85rem">
                <input type="checkbox" name="cgu" required>
                <span>J'accepte les conditions générales d'utilisation et la politique de confidentialité.</span>
              </label>
            </div>` : `
            <div class="flex-between" style="margin-top:.6rem">
              <label class="checkrow" style="font-weight:400;font-size:.85rem;color:var(--ink-2)">
                <input type="checkbox" name="remember" checked><span>Rester connecté</span></label>
              <a href="#/login" style="font-size:.85rem;color:var(--accent-strong);font-weight:600">Mot de passe oublié&nbsp;?</a>
            </div>`}
            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:1.3rem">
              ${mode === 'login' ? 'Se connecter' : 'Créer mon compte gratuit'}
              <span class="nub">${icon('arrow')}</span>
            </button>
            <p class="field-err" id="auth-err" style="display:none"></p>
          </form>

          <div class="auth-sep">ou</div>
          <button class="btn btn-ghost btn-block" id="demo-btn">
            ${icon('rocket')} Découvrir avec le compte de démonstration</button>
          <p class="dim" style="font-size:.78rem;text-align:center;margin-top:.7rem">
            Compte démo : demo@devisly.fr — un dossier BTP complet déjà rempli.</p>
        </div>
      </main>
    </div>`;

    ctx.app.querySelector('[data-theme]').onclick = () => { toggleTheme(); view(); };
    ctx.app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      mode = b.dataset.tab; view();
    });

    const form = ctx.app.querySelector('#auth-form');
    const err = ctx.app.querySelector('#auth-err');
    form.onsubmit = (e) => {
      e.preventDefault();
      err.style.display = 'none';
      const fd = Object.fromEntries(new FormData(form));
      try {
        if (mode === 'login') {
          login(fd.email, fd.password);
          toast('Connexion réussie. Bon chantier !');
        } else {
          if ((fd.password || '').length < 6) throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
          signup(fd);
          toast('Compte créé — bienvenue sur Devisly !');
        }
        ctx.navigate('#/app');
      } catch (ex) {
        err.textContent = ex.message;
        err.style.display = 'block';
      }
    };

    ctx.app.querySelector('#demo-btn').onclick = () => {
      try {
        login('demo@devisly.fr', 'demo1234');
        toast('Vous explorez le compte de démonstration.');
        ctx.navigate('#/app');
      } catch (ex) { toast(ex.message, 'err'); }
    };
  }

  view();
}
