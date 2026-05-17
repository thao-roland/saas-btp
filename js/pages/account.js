// ============================================================
// Devisly — Mon entreprise (profil, paramètres, abonnement, compte)
// ============================================================
import { icon } from '../icons.js';
import { appLayout, bindAppLayout } from '../layout.js';
import {
  currentUser, updateCompany, updateSettings, updateUser, setPlan,
  PLANS, TVA_RATES, quotesThisMonth,
} from '../store.js';
import { escapeHtml, toast, initials, num } from '../ui.js';

const TABS = [
  { key: 'profil', label: 'Profil entreprise', icon: 'building' },
  { key: 'parametres', label: 'Paramètres devis', icon: 'settings' },
  { key: 'abonnement', label: 'Abonnement', icon: 'star' },
  { key: 'compte', label: 'Mon compte', icon: 'user' },
];

export function renderAccount(ctx) {
  const u = currentUser();
  let tab = TABS.some(t => t.key === ctx.frag) ? ctx.frag : 'profil';

  // ---------- Onglet : Profil entreprise ----------
  function profilTab() {
    const co = u.company;
    return `
    <form data-form="profil">
      <div class="card card-pad">
        <h3 style="font-size:1.15rem">Identité de l'entreprise</h3>
        <p class="dim" style="font-size:.85rem;margin:.3rem 0 1.2rem">Ces informations figurent sur tous vos devis et factures.</p>
        <div class="flex gap items-center" style="margin-bottom:1.3rem">
          <div class="avatar lg" id="logo-preview" style="${co.logo ? '' : 'background:var(--accent-soft);color:var(--accent-strong)'}">
            ${co.logo ? `<img src="${co.logo}">` : initials(co.name)}</div>
          <div class="grow">
            <div class="logo-drop" id="logo-drop">
              ${icon('upload')}
              <div style="font-size:.88rem;font-weight:600;margin-top:.3rem">Importer un logo</div>
              <div class="dim" style="font-size:.76rem">PNG ou JPG · format carré conseillé</div>
            </div>
            <input type="file" id="logo-input" accept="image/*" hidden>
          </div>
          ${co.logo ? `<button type="button" class="btn btn-ghost btn-sm" id="logo-remove">${icon('trash')} Retirer</button>` : ''}
        </div>
        <div class="field-row cols-2">
          <div class="field" style="margin:0"><label>Raison sociale</label><input class="input" name="name" value="${escapeHtml(co.name)}"></div>
          <div class="field" style="margin:0"><label>Forme juridique</label><input class="input" name="legalForm" value="${escapeHtml(co.legalForm || '')}" placeholder="SARL, EURL, SAS, EI..."></div>
        </div>
        <div class="field-row cols-3" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Capital social</label><input class="input" name="capital" value="${escapeHtml(co.capital || '')}" placeholder="15 000 €"></div>
          <div class="field" style="margin:0"><label>Code APE / NAF</label><input class="input" name="ape" value="${escapeHtml(co.ape || '')}" placeholder="4391B"></div>
          <div class="field" style="margin:0"><label>N° de TVA intracom.</label><input class="input" name="tvaNumber" value="${escapeHtml(co.tvaNumber || '')}" placeholder="FR..."></div>
        </div>
        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>N° SIRET</label><input class="input" name="siret" value="${escapeHtml(co.siret || '')}" placeholder="000 000 000 00000"></div>
          <div class="field" style="margin:0"><label>Mention RCS</label><input class="input" name="rcs" value="${escapeHtml(co.rcs || '')}" placeholder="RCS Lyon 000 000 000"></div>
        </div>
      </div>

      <div class="card card-pad mt">
        <h3 style="font-size:1.15rem">Coordonnées</h3>
        <div class="field" style="margin-top:1rem"><label>Adresse</label><input class="input" name="address" value="${escapeHtml(co.address || '')}"></div>
        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Code postal</label><input class="input" name="zip" value="${escapeHtml(co.zip || '')}"></div>
          <div class="field" style="margin:0"><label>Ville</label><input class="input" name="city" value="${escapeHtml(co.city || '')}"></div>
        </div>
        <div class="field-row cols-3" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Téléphone</label><input class="input" name="phone" value="${escapeHtml(co.phone || '')}"></div>
          <div class="field" style="margin:0"><label>E-mail professionnel</label><input class="input" name="emailPro" value="${escapeHtml(co.emailPro || '')}"></div>
          <div class="field" style="margin:0"><label>Site web</label><input class="input" name="website" value="${escapeHtml(co.website || '')}"></div>
        </div>
      </div>

      <div class="card card-pad mt">
        <h3 style="font-size:1.15rem">Mentions légales & bancaires</h3>
        <p class="dim" style="font-size:.85rem;margin:.3rem 0 1rem">Affichées dans le pied de page de vos documents.</p>
        <div class="field"><label>Assurance professionnelle (décennale, RC Pro)</label>
          <input class="input" name="insurance" value="${escapeHtml(co.insurance || '')}" placeholder="Décennale — assureur & n° de police"></div>
        <div class="field"><label>Coordonnées bancaires (IBAN)</label>
          <input class="input" name="iban" value="${escapeHtml(co.iban || '')}" placeholder="FR76 ...">
          <div class="hint">Permet à vos clients de régler les acomptes et le solde.</div></div>
      </div>
      <div class="flex" style="justify-content:flex-end;margin-top:1.2rem">
        <button type="submit" class="btn btn-primary">${icon('check')} Enregistrer le profil</button>
      </div>
    </form>`;
  }

  // ---------- Onglet : Paramètres devis ----------
  function parametresTab() {
    const s = u.settings;
    return `
    <form data-form="parametres">
      <div class="card card-pad">
        <h3 style="font-size:1.15rem">Numérotation & valeurs par défaut</h3>
        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Préfixe de numérotation des devis</label>
            <input class="input" name="quotePrefix" value="${escapeHtml(s.quotePrefix)}">
            <div class="hint">Format généré : ${escapeHtml(s.quotePrefix)}-${new Date().getFullYear()}-${String(s.nextSeq).padStart(4, '0')}</div></div>
          <div class="field" style="margin:0"><label>Préfixe des factures</label>
            <input class="input" name="invoicePrefix" value="${escapeHtml(s.invoicePrefix)}"></div>
        </div>
        <div class="field-row cols-3" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>TVA appliquée par défaut</label>
            <select class="select" name="defaultTva">
              ${TVA_RATES.map(t => `<option value="${t.rate}" ${s.defaultTva == t.rate ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select></div>
          <div class="field" style="margin:0"><label>Coefficient de marge par défaut</label>
            <input class="input" name="defaultMargin" type="number" step="0.01" min="1" value="${s.defaultMargin}">
            <div class="hint">1,15 = marge de 15 %</div></div>
          <div class="field" style="margin:0"><label>Durée de validité (jours)</label>
            <input class="input" name="defaultValidity" type="number" min="1" value="${s.defaultValidity}"></div>
        </div>
      </div>

      <div class="card card-pad mt">
        <h3 style="font-size:1.15rem">Textes par défaut</h3>
        <div class="field" style="margin-top:1rem"><label>Délai d'exécution par défaut</label>
          <input class="input" name="defaultExecDelay" value="${escapeHtml(s.defaultExecDelay)}"></div>
        <div class="field"><label>Conditions particulières & mentions légales</label>
          <textarea class="textarea" name="defaultConditions" rows="4">${escapeHtml(s.defaultConditions)}</textarea></div>
      </div>

      <div class="card card-pad mt">
        <h3 style="font-size:1.15rem">Relance automatique</h3>
        <p class="dim" style="font-size:.85rem;margin:.3rem 0 1rem">Devisly identifie les devis envoyés restés sans réponse et vous propose une relance sur le tableau de bord.</p>
        <label class="checkrow" style="margin-bottom:1rem">
          <input type="checkbox" name="relanceEnabled" ${s.relanceEnabled ? 'checked' : ''}>
          <span style="font-weight:500">Activer le suivi des relances</span>
        </label>
        <div class="field" style="max-width:280px"><label>Délai avant relance (jours)</label>
          <input class="input" name="relanceDelay" type="number" min="1" value="${s.relanceDelay}"></div>
      </div>
      <div class="flex" style="justify-content:flex-end;margin-top:1.2rem">
        <button type="submit" class="btn btn-primary">${icon('check')} Enregistrer les paramètres</button>
      </div>
    </form>`;
  }

  // ---------- Onglet : Abonnement ----------
  function abonnementTab() {
    const cur = PLANS[u.plan];
    const used = quotesThisMonth(u);
    return `
    <div class="card card-pad">
      <div class="flex-between wrap-flex gap">
        <div>
          <div class="eyebrow">Abonnement actuel</div>
          <h3 style="font-size:1.5rem;margin-top:.6rem">Plan ${cur.name}</h3>
          <p class="dim" style="font-size:.88rem">${cur.desc}</p>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-display);font-size:2rem;font-weight:600">${cur.price === 0 ? 'Gratuit' : cur.price + ' € / mois'}</div>
        </div>
      </div>
      ${cur.quota !== Infinity ? `
      <div style="margin-top:1.2rem">
        <div class="flex-between" style="font-size:.85rem;margin-bottom:.4rem">
          <span class="muted">Devis créés ce mois-ci</span><strong>${used} / ${cur.quota}</strong></div>
        <div class="progress"><div style="width:${Math.min(used / cur.quota * 100, 100)}%"></div></div>
      </div>` : `<p class="badge green no-dot" style="margin-top:1rem">Devis illimités</p>`}
    </div>

    <h3 style="font-size:1.15rem;margin:1.6rem 0 .9rem">Changer de plan</h3>
    <div class="price-grid">
      ${Object.values(PLANS).map(p => {
        const active = p.id === u.plan;
        return `
        <div class="card plan ${p.id === 'pro' ? 'featured' : ''}" style="padding:1.5rem">
          <h3 style="font-size:1.2rem">${p.name}</h3>
          <div class="price" style="font-size:2.2rem">${p.price === 0 ? 'Gratuit' : p.price + ' €'}<small>${p.price === 0 ? '' : '/mois'}</small></div>
          <p class="plan-desc" style="min-height:auto">${p.desc}</p>
          <ul style="margin:1rem 0">
            <li>${icon('check')}<span>${p.quota === Infinity ? 'Devis illimités' : p.quota + ' devis / mois'}</span></li>
            <li>${icon('check')}<span>${p.seats === 1 ? '1 utilisateur' : "Jusqu'à " + p.seats + ' utilisateurs'}</span></li>
            <li>${icon('check')}<span>${p.id === 'starter' ? 'Export PDF' : 'Export PDF, Excel & Word'}</span></li>
          </ul>
          <button class="btn ${active ? 'btn-ghost' : 'btn-primary'} btn-block" data-plan="${p.id}" ${active ? 'disabled' : ''}>
            ${active ? 'Plan actuel' : 'Choisir ce plan'}</button>
        </div>`;
      }).join('')}
    </div>
    <p class="dim" style="font-size:.82rem;margin-top:1.2rem">
      Démonstration : le changement de plan est immédiat et gratuit, aucun paiement n'est traité.</p>`;
  }

  // ---------- Onglet : Mon compte ----------
  function compteTab() {
    return `
    <form data-form="compte">
      <div class="card card-pad">
        <h3 style="font-size:1.15rem">Informations personnelles</h3>
        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Nom complet</label><input class="input" name="fullName" value="${escapeHtml(u.fullName || '')}"></div>
          <div class="field" style="margin:0"><label>Fonction</label><input class="input" name="role" value="${escapeHtml(u.role || '')}" placeholder="Gérant, Conducteur de travaux..."></div>
        </div>
        <div class="field" style="margin-top:1rem"><label>E-mail de connexion</label>
          <input class="input" name="email" type="email" value="${escapeHtml(u.email)}"></div>
      </div>
      <div class="card card-pad mt">
        <h3 style="font-size:1.15rem">Sécurité</h3>
        <div class="field-row cols-2" style="margin-top:1rem">
          <div class="field" style="margin:0"><label>Nouveau mot de passe</label>
            <input class="input" name="newPass" type="password" placeholder="Laisser vide pour conserver"></div>
          <div class="field" style="margin:0"><label>Confirmer le mot de passe</label>
            <input class="input" name="confirmPass" type="password"></div>
        </div>
      </div>
      <div class="flex" style="justify-content:flex-end;margin-top:1.2rem">
        <button type="submit" class="btn btn-primary">${icon('check')} Enregistrer</button>
      </div>
    </form>`;
  }

  function tabContent() {
    if (tab === 'profil') return profilTab();
    if (tab === 'parametres') return parametresTab();
    if (tab === 'abonnement') return abonnementTab();
    return compteTab();
  }

  function content() {
    return `
    <div class="page-head"><div><h2>Mon entreprise</h2><p>Profil, paramètres et abonnement</p></div></div>
    <div class="acc-grid">
      <nav class="acc-nav">
        ${TABS.map(t => `<button data-tab="${t.key}" class="${tab === t.key ? 'on' : ''}">${t.label}</button>`).join('')}
      </nav>
      <div data-tab-content>${tabContent()}</div>
    </div>`;
  }

  function paint() {
    ctx.app.querySelector('.content').innerHTML = content();
    bind();
  }

  function bind() {
    ctx.app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      tab = b.dataset.tab;
      location.hash = '#/app/account#' + tab;
      paint();
    });

    // Profil
    const drop = ctx.app.querySelector('#logo-drop');
    if (drop) {
      const input = ctx.app.querySelector('#logo-input');
      drop.onclick = () => input.click();
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) { toast('Image trop lourde (max 1,5 Mo).', 'err'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          updateCompany({ logo: reader.result });
          toast('Logo mis à jour.');
          paint();
        };
        reader.readAsDataURL(file);
      };
      const rm = ctx.app.querySelector('#logo-remove');
      if (rm) rm.onclick = () => { updateCompany({ logo: '' }); toast('Logo retiré.'); paint(); };
    }

    const form = ctx.app.querySelector('[data-form]');
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const which = form.dataset.form;
      if (which === 'profil') {
        updateCompany(fd);
        toast('Profil entreprise enregistré.');
      } else if (which === 'parametres') {
        updateSettings({
          quotePrefix: fd.quotePrefix || 'DEV',
          invoicePrefix: fd.invoicePrefix || 'FAC',
          defaultTva: Number(fd.defaultTva),
          defaultMargin: Number(fd.defaultMargin) || 1,
          defaultValidity: Number(fd.defaultValidity) || 30,
          defaultExecDelay: fd.defaultExecDelay,
          defaultConditions: fd.defaultConditions,
          relanceEnabled: !!fd.relanceEnabled,
          relanceDelay: Number(fd.relanceDelay) || 7,
        });
        toast('Paramètres enregistrés.');
      } else if (which === 'compte') {
        if (fd.newPass || fd.confirmPass) {
          if (fd.newPass !== fd.confirmPass) { toast('Les mots de passe ne correspondent pas.', 'err'); return; }
          if (fd.newPass.length < 6) { toast('Mot de passe trop court (6 caractères min.).', 'err'); return; }
          updateUser({ password: fd.newPass });
        }
        updateUser({ fullName: fd.fullName, role: fd.role, email: fd.email.trim().toLowerCase() });
        toast('Compte mis à jour.');
      }
      paint();
    };

    ctx.app.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
      setPlan(b.dataset.plan);
      toast('Vous êtes désormais sur le plan ' + PLANS[b.dataset.plan].name + '.');
      paint();
    });
  }

  ctx.app.innerHTML = appLayout('account', { title: 'Mon entreprise', sub: 'Réglages du compte', content: content() });
  bindAppLayout(ctx.app, ctx.navigate);
  bind();
}
