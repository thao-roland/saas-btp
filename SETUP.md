# Devisly — Connexion à Supabase & Stripe

Ce guide explique **pas à pas** comment relier l'application à une vraie base
de données (Supabase) et au paiement d'abonnements (Stripe).

> **Bon à savoir** — tant que vous n'avez pas renseigné les clés, l'application
> fonctionne en **mode local de secours** (données stockées dans le navigateur).
> Vous pouvez donc la tester immédiatement. Dès que `js/config.js` contient de
> vraies clés Supabase, elle bascule automatiquement en **mode cloud**.

---

## Vue d'ensemble

| Élément | Rôle |
|---|---|
| **Supabase** | Base de données PostgreSQL, authentification, Row Level Security |
| **Supabase Edge Functions** | Code serveur pour Stripe (checkout, webhook, portail) |
| **Stripe** | Paiement des abonnements (mensuel / annuel) |

Deux fichiers reçoivent des clés :
- `js/config.js` → 2 clés **publiques** Supabase (lues par le navigateur)
- Les **secrets des Edge Functions** → clés **secrètes** Supabase + Stripe

---

## Étape 1 — Créer le projet Supabase

1. Allez sur **https://supabase.com** → *Start your project* → connectez-vous.
2. Cliquez **New project**.
   - *Name* : `devisly`
   - *Database Password* : générez-en un et **conservez-le**.
   - *Region* : choisissez l'Europe (ex. *Paris* / *Frankfurt*).
3. Attendez ~2 min que le projet soit prêt.

### Récupérer les clés Supabase

Menu **Project Settings** (roue dentée) → **API** :

| Champ Supabase | Variable | Où la coller |
|---|---|---|
| *Project URL* | `SUPABASE_URL` | `js/config.js` **et** secrets Edge Functions |
| *Project API keys → `anon` `public`* | `SUPABASE_ANON_KEY` | `js/config.js` |
| *Project API keys → `service_role` `secret`* | `SUPABASE_SERVICE_ROLE_KEY` | secrets Edge Functions **uniquement** |

> ⚠️ La clé `service_role` contourne toute la sécurité : ne la mettez **jamais**
> dans `js/config.js` ni dans du code envoyé au navigateur.

---

## Étape 2 — Créer les tables et la sécurité

1. Dans Supabase, ouvrez **SQL Editor** → **New query**.
2. Ouvrez le fichier `supabase/migrations/0001_init.sql` de ce dépôt,
   copiez **tout** son contenu, collez-le dans l'éditeur.
3. Cliquez **Run**.

Cela crée les 6 tables — `users`, `entreprises`, `clients`, `devis`,
`prestations`, `abonnements` — avec :
- la **Row Level Security activée** sur chaque table (chaque utilisateur ne voit
  que les données de **son** entreprise) ;
- la création automatique du profil + entreprise + abonnement Starter à
  l'inscription ;
- les fonctions de partage public d'un devis (lien client).

Vérifiez dans **Table Editor** que les 6 tables apparaissent, et dans
**Authentication → Policies** que chaque table affiche des *policies*.

### Authentification

Menu **Authentication → Providers → Email** : laissez *Email* activé.

- Pour tester rapidement sans recevoir d'e-mail : **Authentication → Sign In / Up**
  → désactivez *Confirm email*. (À réactiver en production.)

---

## Étape 3 — Renseigner `js/config.js`

Ouvrez `js/config.js` et remplacez les deux valeurs d'exemple :

```js
export const CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',   // votre Project URL
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIs...',       // votre clé anon public
};
```

Dès l'enregistrement, l'application passe en **mode cloud** : l'inscription et
la connexion créent de vrais comptes Supabase.

---

## Étape 4 — Créer le compte et les produits Stripe

1. Allez sur **https://stripe.com** → créez un compte.
2. Restez en **mode Test** (interrupteur *Test mode* en haut à droite).

### Créer les 2 produits et leurs 4 tarifs

Menu **Product catalog** → **Add product** :

**Produit « Devisly Pro »**
- Ajoutez un tarif récurrent **Mensuel** : `29,00 EUR` / *month*
- Ajoutez un tarif récurrent **Annuel** : `290,00 EUR` / *year*

**Produit « Devisly Entreprise »**
- Tarif **Mensuel** : `79,00 EUR` / *month*
- Tarif **Annuel** : `790,00 EUR` / *year*

Pour chaque tarif, copiez son **Price ID** (commence par `price_...`).

### Récupérer les clés Stripe

Menu **Developers → API keys** :

| Champ Stripe | Variable |
|---|---|
| *Secret key* | `STRIPE_SECRET_KEY` |
| *Publishable key* | `STRIPE_PUBLISHABLE_KEY` (facultatif) |

---

## Étape 5 — Déployer les Edge Functions (Stripe)

Les fonctions serveur se trouvent dans `supabase/functions/`. Installez la
**CLI Supabase** : https://supabase.com/docs/guides/cli

```bash
# Se connecter et lier le projet
supabase login
supabase link --project-ref VOTRE-REF-PROJET     # la ref est dans l'URL du projet

# Enregistrer les secrets (utilisés par les fonctions)
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_PRICE_PRO_MONTHLY=price_xxx \
  STRIPE_PRICE_PRO_YEARLY=price_xxx \
  STRIPE_PRICE_ENTREPRISE_MONTHLY=price_xxx \
  STRIPE_PRICE_ENTREPRISE_YEARLY=price_xxx \
  APP_URL=https://votre-domaine.fr/index.html
# (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement)

# Déployer les 3 fonctions
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

> Le `--no-verify-jwt` du webhook est **obligatoire** : Stripe appelle cette
> fonction, pas un utilisateur connecté.

---

## Étape 6 — Brancher le webhook Stripe

Le webhook tient la table `abonnements` à jour en temps réel (souscription,
changement de plan, échec de paiement, résiliation).

1. Stripe → **Developers → Webhooks → Add endpoint**.
2. *Endpoint URL* :
   `https://VOTRE-REF-PROJET.supabase.co/functions/v1/stripe-webhook`
3. *Events to send* — sélectionnez :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Validez, puis copiez le **Signing secret** (commence par `whsec_...`).
5. Enregistrez-le côté Supabase :

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase functions deploy stripe-webhook --no-verify-jwt   # redéployer
```

### Activer le portail client Stripe

Stripe → **Settings → Billing → Customer portal** → activez-le et autorisez le
changement de plan et l'annulation. C'est ce portail qui gère
**upgrade / downgrade / résiliation**.

---

## Étape 7 — Tester de bout en bout

1. Ouvrez l'application, créez un compte → un compte Supabase réel est créé.
2. Onglet **Mon entreprise → Abonnement** → *Souscrire Pro*.
3. Page de paiement Stripe : utilisez la carte de test **4242 4242 4242 4242**,
   date future, CVC quelconque.
4. Après paiement, le webhook met à jour la table `abonnements` ;
   l'application affiche le plan **Pro** sous quelques secondes.
5. *Gérer mon abonnement* ouvre le portail Stripe (changement de plan, factures,
   résiliation).

### Échecs de paiement
Carte de test qui échoue : **4000 0000 0000 0341**. Le webhook
`invoice.payment_failed` bascule l'abonnement en statut *Paiement en échec*,
signalé dans l'onglet Abonnement.

---

## Récapitulatif : où va chaque clé

| Clé | Destination |
|---|---|
| `SUPABASE_URL` | `js/config.js` + `supabase secrets set` (auto) |
| `SUPABASE_ANON_KEY` | `js/config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret Edge Function (auto via la CLI) |
| `STRIPE_SECRET_KEY` | `supabase secrets set` |
| `STRIPE_WEBHOOK_SECRET` | `supabase secrets set` |
| `STRIPE_PRICE_*` (×4) | `supabase secrets set` |
| `APP_URL` | `supabase secrets set` |

Le fichier `.env.example` liste toutes ces variables. Copiez-le en `.env` pour
garder vos valeurs au même endroit — **ne le committez jamais rempli**
(`.gitignore` l'exclut déjà).

---

## Sécurité (rappel)

- **Row Level Security** activée sur les 6 tables : un utilisateur ne peut lire
  ni écrire que les lignes rattachées à son entreprise (`my_entreprise_id()`).
- La table `abonnements` est en **lecture seule** côté client ; seules les Edge
  Functions (clé `service_role`) y écrivent — impossible de s'auto-attribuer un
  plan payant.
- Les webhooks Stripe sont vérifiés par **signature** (`STRIPE_WEBHOOK_SECRET`).
- Les clés secrètes ne sont jamais exposées au navigateur.
