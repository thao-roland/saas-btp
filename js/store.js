// ============================================================
// Devisly — Couche de données (double mode)
//   • Mode CLOUD : Supabase (Postgres + Auth + RLS) — actif dès
//     que js/config.js contient de vraies clés.
//   • Mode LOCAL : localStorage — secours de démonstration.
// L'API exposée est identique dans les deux modes : seules les
// fonctions d'authentification et init() sont asynchrones.
// ============================================================
import { isCloud } from './config.js';
import * as cloud from './supabase-client.js';

const CLOUD = isCloud();
export function isCloudMode() { return CLOUD; }

const KEY = 'devisly:v1';
export const uid = (p = 'id') =>
  (crypto?.randomUUID ? crypto.randomUUID()
    : p + '_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36));
const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// ---------- Constantes métier ----------
export const PLANS = {
  starter: { id: 'starter', name: 'Starter', price: 0, priceYear: 0, quota: 5, seats: 1,
    desc: 'Pour démarrer et tester la facturation BTP sans engagement.' },
  pro: { id: 'pro', name: 'Pro', price: 29, priceYear: 290, quota: Infinity, seats: 1,
    desc: 'Devis illimités pour les artisans et indépendants du bâtiment.' },
  entreprise: { id: 'entreprise', name: 'Entreprise', price: 79, priceYear: 790, quota: Infinity, seats: 8,
    desc: 'Multi-utilisateurs et pilotage pour les PME du BTP en croissance.' },
};

export const SECTION_TYPES = {
  maindoeuvre: { label: "Main d'œuvre", icon: 'hammer', defaultUnit: 'h' },
  materiaux: { label: 'Matériaux & fournitures', icon: 'brick', defaultUnit: 'u' },
  soustraitance: { label: 'Sous-traitance', icon: 'handshake', defaultUnit: 'forfait' },
  deplacement: { label: 'Frais de déplacement', icon: 'truck', defaultUnit: 'km' },
  location: { label: 'Location de matériel', icon: 'wrench', defaultUnit: 'jour' },
};

export const TVA_RATES = [
  { rate: 5.5, label: 'Rénovation énergétique (5,5 %)' },
  { rate: 10, label: "Travaux d'entretien & rénovation (10 %)" },
  { rate: 20, label: 'Construction neuve (20 %)' },
];

export const QUOTE_STATUS = {
  draft: { label: 'Brouillon', color: 'gray' },
  sent: { label: 'Envoyé', color: 'blue' },
  accepted: { label: 'Accepté', color: 'green' },
  refused: { label: 'Refusé', color: 'red' },
  expired: { label: 'Expiré', color: 'amber' },
  invoiced: { label: 'Facturé', color: 'green' },
};

const DEFAULT_LIBRARY = () => ([
  { label: 'Pose de carrelage sol — format standard', unit: 'm²', price: 46, section: 'maindoeuvre', cat: 'Carrelage' },
  { label: 'Pose de faïence murale', unit: 'm²', price: 52, section: 'maindoeuvre', cat: 'Carrelage' },
  { label: 'Peinture murs & plafonds — 2 couches', unit: 'm²', price: 27, section: 'maindoeuvre', cat: 'Peinture' },
  { label: 'Maçonnerie — mur en parpaing 20 cm', unit: 'm²', price: 78, section: 'maindoeuvre', cat: 'Gros œuvre' },
  { label: 'Chape béton lissée', unit: 'm²', price: 33, section: 'maindoeuvre', cat: 'Gros œuvre' },
  { label: 'Cloison placo BA13 + isolation', unit: 'm²', price: 48, section: 'maindoeuvre', cat: 'Plâtrerie' },
  { label: 'Enduit de façade monocouche', unit: 'm²', price: 41, section: 'maindoeuvre', cat: 'Façade' },
  { label: 'Pose parquet flottant', unit: 'm²', price: 34, section: 'maindoeuvre', cat: 'Revêtement' },
  { label: "Dépose d'ancien revêtement & évacuation", unit: 'm²', price: 14, section: 'maindoeuvre', cat: 'Préparation' },
  { label: 'Création de point d’eau (alimentation + évacuation)', unit: 'u', price: 190, section: 'maindoeuvre', cat: 'Plomberie' },
  { label: 'Pose de bloc-porte intérieur', unit: 'u', price: 230, section: 'maindoeuvre', cat: 'Menuiserie' },
  { label: 'Sac de mortier-colle 25 kg', unit: 'sac', price: 19, section: 'materiaux', cat: 'Matériaux' },
  { label: 'Location échafaudage de façade', unit: 'jour', price: 65, section: 'location', cat: 'Matériel' },
  { label: 'Forfait déplacement zone locale', unit: 'forfait', price: 45, section: 'deplacement', cat: 'Déplacement' },
]);

function defaultSettings() {
  return {
    quotePrefix: 'DEV', nextSeq: 1, invoicePrefix: 'FAC', nextInvoiceSeq: 1,
    defaultTva: 10, defaultMargin: 1.15, defaultValidity: 30,
    tvaEnabled: true,                  // entreprise assujettie à la TVA ?
    defaultExecDelay: 'À convenir — 4 à 6 semaines après acceptation',
    defaultConditions:
      "Devis gratuit valable 30 jours. Acompte de 30 % à la signature. " +
      "TVA applicable selon la nature des travaux. Travaux conformes aux DTU en vigueur. " +
      "Assurance décennale et responsabilité civile professionnelle souscrites.",
    relanceEnabled: true, relanceDelay: 7,
  };
}
function emptyCompany(name = '', email = '') {
  return { name, legalForm: '', siret: '', rcs: '', ape: '', tvaNumber: '', capital: '',
    address: '', zip: '', city: '', phone: '', emailPro: email, website: '',
    iban: '', insurance: '', logo: '' };
}

// ============================================================
// État en mémoire — partagé par les deux modes
// db = { users:[], session, seeded }  ;  currentUser() = db.users[session]
// ============================================================
let db = { users: [], session: null, seeded: false };
let cloudEntrepriseId = null;   // id de l'entreprise (mode cloud)

export function getDB() { return db; }
export function currentUser() {
  if (!db.session) return null;
  return db.users.find(u => u.id === db.session) || null;
}

// ============================================================
// MODE LOCAL — persistance localStorage + jeu de démonstration
// ============================================================
function localLoad() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return localSeed({ users: [], session: null, seeded: false });
    const parsed = JSON.parse(raw);
    if (!parsed.seeded) return localSeed(parsed);
    return parsed;
  } catch { return localSeed({ users: [], session: null, seeded: false }); }
}
function localPersist() { if (!CLOUD) localStorage.setItem(KEY, JSON.stringify(db)); }

function localSeed(base) {
  base.seeded = true;
  if (base.users.some(u => u.email === 'demo@devisly.fr')) return base;
  const lib = DEFAULT_LIBRARY().map(p => ({ id: uid('prest'), ...p }));
  const demo = {
    id: uid('usr'), email: 'demo@devisly.fr', password: 'demo1234',
    fullName: 'Julien Marchand', role: 'Gérant',
    createdAt: Date.now() - 86400000 * 120, plan: 'pro',
    company: {
      name: 'Marchand Rénovation', legalForm: 'SARL', siret: '812 456 789 00027',
      rcs: 'RCS Lyon 812 456 789', ape: '4391B', tvaNumber: 'FR42812456789',
      address: '14 rue des Charpentiers', zip: '69007', city: 'Lyon',
      phone: '04 78 12 34 56', emailPro: 'contact@marchand-renovation.fr',
      website: 'marchand-renovation.fr', iban: 'FR76 3000 4000 0312 3456 7890 143',
      capital: '15 000 €', insurance: 'Décennale MAAF Pro — police n° 1180 4477', logo: '',
    },
    settings: { ...defaultSettings(), nextSeq: 5, nextInvoiceSeq: 2 },
    library: lib, clients: [], quotes: [], invoices: [],
  };
  const C = (o) => { const c = { id: uid('cli'), createdAt: Date.now(), ...o }; demo.clients.push(c); return c.id; };
  const c1 = C({ name: 'Copropriété Les Tilleuls', contact: 'M. Bernard Faure', email: 'syndic@lestilleuls.fr', phone: '04 72 00 11 22', address: '8 allée des Tilleuls', zip: '69100', city: 'Villeurbanne', kind: 'pro' });
  const c2 = C({ name: 'Sophie Lemoine', contact: 'Sophie Lemoine', email: 's.lemoine@email.fr', phone: '06 11 22 33 44', address: '23 rue Garibaldi', zip: '69006', city: 'Lyon', kind: 'particulier' });
  const c3 = C({ name: 'SCI Horizon', contact: 'M. Antoine Réaux', email: 'gestion@sci-horizon.fr', phone: '04 78 55 66 77', address: '2 quai Claude Bernard', zip: '69007', city: 'Lyon', kind: 'pro' });
  const c4 = C({ name: 'Restaurant Le Comptoir', contact: 'Mme Clara Vidal', email: 'clara@lecomptoir-lyon.fr', phone: '04 78 99 88 77', address: '45 rue Mercière', zip: '69002', city: 'Lyon', kind: 'pro' });
  const findP = (frag) => lib.find(p => p.label.toLowerCase().includes(frag));
  const line = (p, qty, over = {}) => ({ id: uid('ln'), designation: p.label, detail: '', unit: p.unit, qty, unitPrice: p.price, marginCoef: 1.15, tva: 10, ...over });
  const section = (type, lines) => ({ id: uid('sec'), type, label: SECTION_TYPES[type].label, lines });
  function mkQuote(seq, clientId, status, daysAgo, sections, extra = {}) {
    const created = Date.now() - 86400000 * daysAgo;
    return {
      id: uid('q'), number: `DEV-2026-${String(seq).padStart(4, '0')}`, clientId, status,
      createdAt: created, date: new Date(created).toISOString().slice(0, 10),
      validUntil: new Date(created + 86400000 * 30).toISOString().slice(0, 10),
      title: extra.title || 'Travaux de rénovation', sections, globalDiscount: 0,
      payments: [
        { label: 'Acompte à la signature', percent: 30 },
        { label: 'Situation intermédiaire', percent: 40 },
        { label: 'Solde à réception', percent: 30 },
      ],
      execDelay: 'Démarrage sous 3 semaines — durée estimée 4 semaines',
      conditions: defaultSettings().defaultConditions, notes: '',
      shareToken: token(), clientResponse: extra.clientResponse || null,
    };
  }
  demo.quotes = [
    mkQuote(1, c1, 'accepted', 64, [
      section('maindoeuvre', [
        line(findP('façade'), 240, { tva: 10 }),
        line(findP('peinture'), 60, { designation: 'Peinture des halls et cages d’escalier', tva: 10 }),
      ]),
      section('location', [line(findP('échafaudage'), 18, { tva: 10 })]),
      section('deplacement', [line(findP('déplacement'), 1, { tva: 10 })]),
    ], { title: 'Ravalement de façade — copropriété', clientResponse: { status: 'accepted', at: Date.now() - 86400000 * 58, name: 'Bernard Faure' } }),
    mkQuote(2, c2, 'sent', 9, [
      section('maindoeuvre', [
        line(findP('dépose'), 22, { tva: 10 }), line(findP('carrelage sol'), 22, { tva: 10 }),
        line(findP('faïence'), 14, { tva: 10 }), line(findP('point d’eau'), 2, { tva: 10 }),
      ]),
      section('materiaux', [line(findP('mortier'), 14, { tva: 10 })]),
    ], { title: 'Rénovation salle de bain' }),
    mkQuote(3, c3, 'sent', 21, [
      section('maindoeuvre', [
        line(findP('cloison'), 48, { tva: 20 }), line(findP('chape'), 65, { tva: 20 }),
        line(findP('parquet'), 65, { tva: 20 }), line(findP('bloc-porte'), 5, { tva: 20 }),
      ]),
      section('soustraitance', [
        { id: uid('ln'), designation: 'Lot électricité — mise aux normes', detail: 'Sous-traitant agréé Qualifelec', unit: 'forfait', qty: 1, unitPrice: 4200, marginCoef: 1.1, tva: 20 },
      ]),
    ], { title: 'Aménagement de plateau — local neuf' }),
    mkQuote(4, c4, 'refused', 40, [
      section('maindoeuvre', [line(findP('peinture'), 95, { tva: 10 }), line(findP('carrelage sol'), 38, { tva: 10 })]),
    ], { title: 'Rafraîchissement salle de restaurant', clientResponse: { status: 'refused', at: Date.now() - 86400000 * 33, name: 'Clara Vidal' } }),
  ];
  demo.invoices = [{
    id: uid('inv'), number: 'FAC-2026-0001', quoteId: demo.quotes[0].id,
    quoteNumber: demo.quotes[0].number, clientId: c1,
    createdAt: Date.now() - 86400000 * 55,
    date: new Date(Date.now() - 86400000 * 55).toISOString().slice(0, 10),
    dueDate: new Date(Date.now() - 86400000 * 25).toISOString().slice(0, 10),
    status: 'paid', snapshot: JSON.parse(JSON.stringify(demo.quotes[0])),
  }];
  base.users.push(demo);
  return base;
}

// ============================================================
// MODE CLOUD — conversion lignes Supabase <-> objets applicatifs
// ============================================================
export function rowToCompany(e) {
  return {
    name: e.name || '', legalForm: e.legal_form || '', capital: e.capital || '',
    siret: e.siret || '', rcs: e.rcs || '', ape: e.ape || '', tvaNumber: e.tva_number || '',
    address: e.address || '', zip: e.zip || '', city: e.city || '', phone: e.phone || '',
    emailPro: e.email_pro || '', website: e.website || '', iban: e.iban || '',
    insurance: e.insurance || '', logo: e.logo || '',
  };
}
function companyToRow(c) {
  return {
    name: c.name, legal_form: c.legalForm, capital: c.capital, siret: c.siret, rcs: c.rcs,
    ape: c.ape, tva_number: c.tvaNumber, address: c.address, zip: c.zip, city: c.city,
    phone: c.phone, email_pro: c.emailPro, website: c.website, iban: c.iban,
    insurance: c.insurance, logo: c.logo,
  };
}
export function rowToClient(r) {
  return { id: r.id, name: r.name, contact: r.contact || '', email: r.email || '',
    phone: r.phone || '', address: r.address || '', zip: r.zip || '', city: r.city || '',
    siret: r.siret || '', kind: r.kind || 'pro', createdAt: new Date(r.created_at).getTime() };
}
function clientToRow(c) {
  return { id: c.id, entreprise_id: cloudEntrepriseId, name: c.name, contact: c.contact || '',
    email: c.email || '', phone: c.phone || '', address: c.address || '', zip: c.zip || '',
    city: c.city || '', siret: c.siret || '', kind: c.kind || 'pro' };
}
function rowToPresta(r) {
  return { id: r.id, label: r.label, unit: r.unit, price: Number(r.price), section: r.section, cat: r.category };
}
function prestaToRow(p) {
  return { id: p.id, entreprise_id: cloudEntrepriseId, label: p.label, unit: p.unit,
    price: p.price, section: p.section, category: p.cat || 'Autres' };
}
export function rowToQuote(r) {
  const c = r.content || {};
  return {
    id: r.id, number: r.number, clientId: r.client_id || '', status: r.status,
    createdAt: c.createdAt || new Date(r.created_at).getTime(),
    date: r.issued_on, validUntil: r.valid_until, title: r.title || '',
    sections: c.sections || [], globalDiscount: c.globalDiscount || 0,
    payments: c.payments || [], execDelay: c.execDelay || '',
    conditions: c.conditions || '', notes: c.notes || '',
    noTva: !!c.noTva,
    shareToken: r.share_token, clientResponse: r.client_response || null,
  };
}
function quoteToRow(q) {
  const t = computeQuote(q);
  return {
    id: q.id, entreprise_id: cloudEntrepriseId, client_id: q.clientId || null,
    number: q.number, title: q.title || '', status: q.status,
    total_ht: round2(t.ht), total_ttc: round2(t.ttc),
    issued_on: q.date, valid_until: q.validUntil,
    content: {
      sections: q.sections, payments: q.payments, globalDiscount: q.globalDiscount,
      execDelay: q.execDelay, conditions: q.conditions, notes: q.notes,
      noTva: !!q.noTva, createdAt: q.createdAt,
    },
    share_token: q.shareToken, client_response: q.clientResponse,
  };
}
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function buildCloudUser(ws) {
  cloudEntrepriseId = ws.entreprise.id;
  return {
    id: ws.user.id, email: ws.user.email,
    fullName: ws.profile.full_name || '', role: ws.profile.role || 'Gérant',
    createdAt: new Date(ws.entreprise.created_at).getTime(),
    plan: ws.abonnement?.plan || 'starter',
    subscription: ws.abonnement || { plan: 'starter', status: 'active' },
    company: rowToCompany(ws.entreprise),
    settings: { ...defaultSettings(), ...(ws.entreprise.settings || {}) },
    clients: (ws.clients || []).map(rowToClient),
    library: (ws.prestations || []).map(rowToPresta),
    quotes: (ws.devis || []).map(rowToQuote),
    invoices: ws.entreprise.factures || [],
  };
}

// ---------- Synchronisation cloud différée (anti-rafale) ----------
// Les écritures ne partent PAS à chaque frappe : elles sont regroupées
// et envoyées ~1 s après la dernière modification. Une seule requête
// remplace des dizaines d'appels réseau.
const pendingWrites = new Map();   // clé -> { priority, label, run }
let entreprisePatch = null;
let flushTimer = null;
let flushing = false;
let lastSyncError = '';

function syncState(state) {
  window.dispatchEvent(new CustomEvent('cloud-sync', { detail: { state, message: lastSyncError } }));
}
function scheduleFlush() {
  if (!CLOUD) return;
  syncState('pending');
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushWrites(); }, 1100);
}
function scheduleWrite(key, priority, label, run) {
  if (!CLOUD) return;
  pendingWrites.set(key, { priority, label, run });
  scheduleFlush();
}
function pushEntreprise(patch) {
  if (!CLOUD) return;
  entreprisePatch = { ...(entreprisePatch || {}), ...patch };
  pendingWrites.set('entreprise', {
    priority: 0, label: 'entreprise',
    run: async () => { const p = entreprisePatch; entreprisePatch = null; await cloud.updateEntreprise(cloudEntrepriseId, p); },
  });
  scheduleFlush();
}

// Envoie toutes les écritures en attente. Appelée par le minuteur,
// avant chaque changement de page et avant la déconnexion.
export async function flushWrites() {
  clearTimeout(flushTimer);
  if (flushing || !pendingWrites.size) return;
  flushing = true;
  syncState('syncing');
  let failed = false;
  const items = [...pendingWrites.entries()].sort((a, b) => a[1].priority - b[1].priority);
  for (const [key, item] of items) {
    pendingWrites.delete(key);
    try {
      await item.run();
    } catch (e) {
      failed = true;
      lastSyncError = (e && e.message) ? e.message : String(e);
      console.error('Sync cloud (' + item.label + ') :', lastSyncError);
    }
  }
  flushing = false;
  if (!failed) lastSyncError = '';
  syncState(failed ? 'error' : 'saved');
  if (pendingWrites.size) scheduleFlush();
}

// ============================================================
// INITIALISATION
// ============================================================
export async function init() {
  if (!CLOUD) { db = localLoad(); localPersist(); return; }
  db = { users: [], session: null, seeded: true };
  try {
    const session = await cloud.currentSession();
    if (!session) return;
    const ws = await cloud.loadWorkspace();
    if (ws) { const u = buildCloudUser(ws); db.users = [u]; db.session = u.id; }
  } catch (e) { console.error('Init cloud :', e); }
}

// ============================================================
// AUTHENTIFICATION
// ============================================================
export async function signup({ email, password, fullName, companyName }) {
  if (!CLOUD) {
    email = email.trim().toLowerCase();
    if (db.users.some(u => u.email === email)) throw new Error('Un compte existe déjà avec cet e-mail.');
    const u = {
      id: uid('usr'), email, password, fullName: fullName.trim(), role: 'Gérant',
      createdAt: Date.now(), plan: 'starter',
      company: emptyCompany(companyName.trim(), email),
      settings: defaultSettings(),
      library: DEFAULT_LIBRARY().map(p => ({ id: uid('prest'), ...p })),
      clients: [], quotes: [], invoices: [],
    };
    db.users.push(u); db.session = u.id; localPersist();
    return u;
  }
  await cloud.cloudSignUp({ email: email.trim().toLowerCase(), password, fullName, companyName });
  const ws = await cloud.loadWorkspace();
  const u = buildCloudUser(ws);
  // Bibliothèque de prestations par défaut pour le nouveau compte
  if (!u.library.length) {
    u.library = DEFAULT_LIBRARY().map(p => ({ id: uid('prest'), ...p }));
    await cloud.dbUpsert('prestations', u.library.map(prestaToRow));
  }
  db.users = [u]; db.session = u.id;
  return u;
}

export async function login(email, password) {
  if (!CLOUD) {
    email = email.trim().toLowerCase();
    const u = db.users.find(x => x.email === email);
    if (!u) throw new Error('Aucun compte ne correspond à cet e-mail.');
    if (u.password !== password) throw new Error('Mot de passe incorrect.');
    db.session = u.id; localPersist();
    return u;
  }
  await cloud.cloudSignIn(email.trim().toLowerCase(), password);
  const ws = await cloud.loadWorkspace();
  if (!ws) throw new Error('Espace de travail introuvable.');
  const u = buildCloudUser(ws);
  db.users = [u]; db.session = u.id;
  return u;
}

export async function logout() {
  if (CLOUD) { try { await flushWrites(); await cloud.cloudSignOut(); } catch {} }
  db = { users: [], session: null, seeded: true };
  cloudEntrepriseId = null;
  if (!CLOUD) localPersist();
}

// ============================================================
// PERSISTANCE GÉNÉRIQUE
// ============================================================
export function save() {
  localPersist();
  const u = currentUser();
  if (CLOUD && u) pushEntreprise({ factures: u.invoices });
}

// ============================================================
// COMPTE & ENTREPRISE
// ============================================================
export function updateUser(patch) {
  const u = currentUser();
  Object.assign(u, patch);
  localPersist();
  if (CLOUD) {
    const prof = {};
    if ('fullName' in patch) prof.full_name = patch.fullName;
    if ('role' in patch) prof.role = patch.role;
    if (Object.keys(prof).length) scheduleWrite('profil', 0, 'profil', () => cloud.updateProfile(u.id, prof));
    // NB : le mot de passe et l'e-mail de connexion se gèrent via Supabase Auth.
  }
  return u;
}
export function updateCompany(patch) {
  const u = currentUser();
  Object.assign(u.company, patch);
  localPersist();
  if (CLOUD) pushEntreprise(companyToRow(u.company));
  return u;
}
export function updateSettings(patch) {
  const u = currentUser();
  Object.assign(u.settings, patch);
  localPersist();
  if (CLOUD) pushEntreprise({ settings: u.settings });
  return u;
}
export function setPlan(planId) {
  const u = currentUser();
  u.plan = planId;
  localPersist();
  // En mode cloud, le plan fait foi via Stripe + table abonnements.
  return u;
}
export function getSubscription() {
  const u = currentUser();
  return u?.subscription || { plan: u?.plan || 'starter', status: 'active' };
}

// ============================================================
// QUOTAS
// ============================================================
export function quotesThisMonth(u = currentUser()) {
  const now = new Date();
  return u.quotes.filter(q => {
    const d = new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}
export function canCreateQuote(u = currentUser()) {
  return quotesThisMonth(u) < PLANS[u.plan].quota;
}

// ============================================================
// DEVIS
// ============================================================
export function nextQuoteNumber(u = currentUser()) {
  const year = new Date().getFullYear();
  return `${u.settings.quotePrefix}-${year}-${String(u.settings.nextSeq).padStart(4, '0')}`;
}
export function newQuote() {
  const u = currentUser();
  const s = u.settings;
  return {
    id: uid('q'), number: nextQuoteNumber(u), clientId: '', status: 'draft',
    createdAt: Date.now(), date: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 86400000 * s.defaultValidity).toISOString().slice(0, 10),
    title: '', sections: [{ id: uid('sec'), type: 'maindoeuvre', label: SECTION_TYPES.maindoeuvre.label, lines: [] }],
    globalDiscount: 0,
    payments: [
      { label: 'Acompte à la signature', percent: 30 },
      { label: 'Solde à la fin des travaux', percent: 70 },
    ],
    execDelay: s.defaultExecDelay, conditions: s.defaultConditions, notes: '',
    noTva: s.tvaEnabled === false,   // entreprise non assujettie à la TVA
    shareToken: token(), clientResponse: null,
  };
}
export function getQuote(id) { return currentUser()?.quotes.find(q => q.id === id); }

export function saveQuote(q) {
  const u = currentUser();
  const i = u.quotes.findIndex(x => x.id === q.id);
  let seqConsumed = false;
  if (i >= 0) { u.quotes[i] = q; }
  else {
    u.quotes.unshift(q);
    if (q.number === nextQuoteNumber(u)) { u.settings.nextSeq++; seqConsumed = true; }
  }
  localPersist();
  if (CLOUD) {
    scheduleWrite('devis:' + q.id, 2, 'devis', () => cloud.dbUpsert('devis', quoteToRow(q)));
    if (seqConsumed) pushEntreprise({ settings: u.settings });
  }
  return q;
}
export function deleteQuote(id) {
  const u = currentUser();
  u.quotes = u.quotes.filter(q => q.id !== id);
  localPersist();
  if (CLOUD) scheduleWrite('devis:' + id, 2, 'devis', () => cloud.dbDelete('devis', id));
}
export function duplicateQuote(id) {
  const u = currentUser();
  const src = getQuote(id);
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('q'); copy.number = nextQuoteNumber(u); copy.status = 'draft';
  copy.createdAt = Date.now(); copy.date = new Date().toISOString().slice(0, 10);
  copy.validUntil = new Date(Date.now() + 86400000 * u.settings.defaultValidity).toISOString().slice(0, 10);
  copy.shareToken = token(); copy.clientResponse = null;
  copy.sections.forEach(s => { s.id = uid('sec'); s.lines.forEach(l => l.id = uid('ln')); });
  u.quotes.unshift(copy);
  u.settings.nextSeq++;
  localPersist();
  if (CLOUD) {
    scheduleWrite('devis:' + copy.id, 2, 'devis', () => cloud.dbUpsert('devis', quoteToRow(copy)));
    pushEntreprise({ settings: u.settings });
  }
  return copy;
}

// ---------- Partage (mode local uniquement ; le cloud passe par RPC) ----------
export function findByShareToken(tok) {
  for (const u of db.users) {
    const q = u.quotes.find(x => x.shareToken === tok);
    if (q) return { quote: q, owner: u };
  }
  return null;
}
export function recordClientResponse(tok, status, name) {
  const found = findByShareToken(tok);
  if (!found) return null;
  found.quote.clientResponse = { status, at: Date.now(), name };
  found.quote.status = status === 'accepted' ? 'accepted' : 'refused';
  localPersist();
  return found.quote;
}

// ============================================================
// FACTURES (stockées dans entreprises.factures côté cloud)
// ============================================================
// Types de facture supportés
export const INVOICE_KINDS = {
  full:      { label: 'Facture',                title: 'Facture',                defaultPct: 100 },
  acompte:   { label: 'Acompte',                title: "Facture d'acompte",      defaultPct: 30 },
  situation: { label: 'Situation intermédiaire',title: 'Facture de situation',   defaultPct: 40 },
  solde:     { label: 'Solde',                  title: 'Facture de solde',       defaultPct: 30 },
};

// Construit le « snapshot » d'une facture partielle (acompte / situation /
// solde) à partir d'un devis et d'un pourcentage. Le montant est ventilé
// proportionnellement sur chaque taux de TVA présent dans le devis.
function buildPartialSnapshot(q, percent, label) {
  const c = computeQuote(q);
  const lines = [];
  const baseSection = { id: uid('sec'), type: 'facturation', label: 'Facturation' };
  if (q.noTva || !c.tvaLines.length) {
    lines.push({
      id: uid('ln'),
      designation: `${label} (${percent} %) — ${q.title || 'devis ' + q.number}`,
      detail: `Pourcentage appliqué sur le devis ${q.number}.`,
      qty: 1, unit: 'forfait',
      unitPrice: (c.htNet || c.ht) * percent / 100,
      marginCoef: 1, tva: 0,
    });
  } else {
    for (const t of c.tvaLines) {
      lines.push({
        id: uid('ln'),
        designation: `${label} ${percent} % — assiette TVA ${t.rate.toString().replace('.', ',')} %`,
        detail: `Sur devis ${q.number}.`,
        qty: 1, unit: 'forfait',
        unitPrice: t.base * percent / 100,
        marginCoef: 1, tva: t.rate,
      });
    }
  }
  return {
    id: uid('q'), number: q.number, clientId: q.clientId,
    status: 'invoiced', createdAt: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    validUntil: '',
    title: `${label} sur ${q.title || 'devis ' + q.number}`,
    sections: [{ ...baseSection, lines }],
    globalDiscount: 0, payments: [], execDelay: '', conditions: '',
    notes: `Cette facture représente ${percent} % du devis ${q.number}.`,
    noTva: !!q.noTva, shareToken: '', clientResponse: null,
  };
}

// Une même devis peut donner lieu à plusieurs factures (utile pour les
// situations de travaux : acompte, situation intermédiaire, solde).
export function convertToInvoice(quoteId, opts = {}) {
  const u = currentUser();
  const q = getQuote(quoteId);
  if (!q) return null;
  const kind = INVOICE_KINDS[opts.kind] ? opts.kind : 'full';
  const percent = kind === 'full' ? 100 : Math.max(1, Math.min(100, Number(opts.percent) || INVOICE_KINDS[kind].defaultPct));
  const label = INVOICE_KINDS[kind].label;
  const snapshot = (kind === 'full' || percent >= 100)
    ? JSON.parse(JSON.stringify(q))
    : buildPartialSnapshot(q, percent, label);
  const year = new Date().getFullYear();
  const inv = {
    id: uid('inv'),
    number: `${u.settings.invoicePrefix}-${year}-${String(u.settings.nextInvoiceSeq).padStart(4, '0')}`,
    quoteId: q.id, quoteNumber: q.number, clientId: q.clientId,
    createdAt: Date.now(), date: new Date().toISOString().slice(0, 10),
    dueDate: opts.dueDate || new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
    paymentMethod: opts.paymentMethod || 'Virement bancaire',
    kind, percent, label,
    status: 'unpaid', snapshot,
  };
  u.invoices.unshift(inv);
  u.settings.nextInvoiceSeq++;
  if (kind === 'full') q.status = 'invoiced';
  localPersist();
  if (CLOUD) {
    pushEntreprise({ factures: u.invoices, settings: u.settings });
    scheduleWrite('devis:' + q.id, 2, 'devis', () => cloud.dbUpsert('devis', quoteToRow(q)));
  }
  return inv;
}
export function getInvoice(id) { return currentUser()?.invoices.find(i => i.id === id); }

// ============================================================
// CLIENTS
// ============================================================
export function saveClient(c) {
  const u = currentUser();
  const isNew = !c.id;
  if (!isNew) {
    const i = u.clients.findIndex(x => x.id === c.id);
    if (i >= 0) u.clients[i] = c;
  } else {
    c.id = uid('cli'); c.createdAt = Date.now();
    u.clients.unshift(c);
  }
  localPersist();
  if (CLOUD) scheduleWrite('clients:' + c.id, 1, 'clients', () => cloud.dbUpsert('clients', clientToRow(c)));
  return c;
}
export function deleteClient(id) {
  const u = currentUser();
  u.clients = u.clients.filter(c => c.id !== id);
  localPersist();
  if (CLOUD) scheduleWrite('clients:' + id, 1, 'clients', () => cloud.dbDelete('clients', id));
}
export function getClient(id) { return currentUser()?.clients.find(c => c.id === id); }

// ============================================================
// BIBLIOTHÈQUE DE PRESTATIONS
// ============================================================
export function saveLibraryItem(p) {
  const u = currentUser();
  if (!p.id) { p.id = uid('prest'); u.library.unshift(p); }
  else {
    const i = u.library.findIndex(x => x.id === p.id);
    if (i >= 0) u.library[i] = p;
  }
  localPersist();
  if (CLOUD) scheduleWrite('prestations:' + p.id, 1, 'prestations', () => cloud.dbUpsert('prestations', prestaToRow(p)));
  return p;
}
export function deleteLibraryItem(id) {
  const u = currentUser();
  u.library = u.library.filter(p => p.id !== id);
  localPersist();
  if (CLOUD) scheduleWrite('prestations:' + id, 1, 'prestations', () => cloud.dbDelete('prestations', id));
}

// ============================================================
// CALCULS
// ============================================================
export function lineTotalHT(l) {
  return (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
}
export function computeQuote(q) {
  const noTva = !!q.noTva;
  let ht = 0;
  const tvaMap = {}, sectionTotals = {};
  for (const s of q.sections) {
    let st = 0;
    for (const l of s.lines) {
      const t = lineTotalHT(l);
      st += t;
      if (!noTva) {
        const rate = Number(l.tva) || 0;
        tvaMap[rate] = (tvaMap[rate] || 0) + t;
      }
    }
    sectionTotals[s.id] = st;
    ht += st;
  }
  const discount = ht * ((Number(q.globalDiscount) || 0) / 100);
  const htNet = ht - discount;
  // Entreprise non assujettie à la TVA -> TVA = 0, total = HT net
  if (noTva) {
    return { ht, discount, htNet, tvaLines: [], tvaTotal: 0, ttc: htNet, sectionTotals };
  }
  const ratio = ht > 0 ? htNet / ht : 1;
  let tvaTotal = 0;
  const tvaLines = Object.entries(tvaMap)
    .filter(([, base]) => base > 0)
    .map(([rate, base]) => {
      const b = base * ratio;
      const amount = b * (Number(rate) / 100);
      tvaTotal += amount;
      return { rate: Number(rate), base: b, amount };
    })
    .sort((a, b) => a.rate - b.rate);
  return { ht, discount, htNet, tvaLines, tvaTotal, ttc: htNet + tvaTotal, sectionTotals };
}
