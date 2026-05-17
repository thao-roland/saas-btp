// ============================================================
// Devisly — Couche de données (persistance localStorage)
// Application 100 % cliente : les données restent dans le
// navigateur. Aucune donnée n'est envoyée à un serveur.
// ============================================================

const KEY = 'devisly:v1';

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// Plans d'abonnement
export const PLANS = {
  starter: { id: 'starter', name: 'Starter', price: 0, quota: 5, seats: 1,
    desc: 'Pour démarrer et tester la facturation BTP sans engagement.' },
  pro: { id: 'pro', name: 'Pro', price: 29, quota: Infinity, seats: 1,
    desc: 'Devis illimités pour les artisans et indépendants du bâtiment.' },
  entreprise: { id: 'entreprise', name: 'Entreprise', price: 79, quota: Infinity, seats: 8,
    desc: 'Multi-utilisateurs et pilotage pour les PME du BTP en croissance.' },
};

// Types de sections BTP
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

// Bibliothèque de prestations BTP livrée par défaut (prix indicatifs France)
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
    quotePrefix: 'DEV',
    nextSeq: 1,
    invoicePrefix: 'FAC',
    nextInvoiceSeq: 1,
    defaultTva: 10,
    defaultMargin: 1.15,
    defaultValidity: 30,
    defaultExecDelay: 'À convenir — 4 à 6 semaines après acceptation',
    defaultConditions:
      "Devis gratuit valable 30 jours. Acompte de 30 % à la signature. " +
      "TVA applicable selon la nature des travaux. Travaux conformes aux DTU en vigueur. " +
      "Assurance décennale et responsabilité civile professionnelle souscrites.",
    relanceEnabled: true,
    relanceDelay: 7,
  };
}

// ---------- Persistance ----------
function blank() { return { users: [], session: null, seeded: false }; }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed(blank());
    const db = JSON.parse(raw);
    if (!db.seeded) return seed(db);
    return db;
  } catch (e) { return seed(blank()); }
}
function persist() { localStorage.setItem(KEY, JSON.stringify(db)); }

let db = null;

// ---------- Compte de démonstration ----------
function seed(base) {
  base.seeded = true;
  if (base.users.some(u => u.email === 'demo@devisly.fr')) { db = base; persist(); return base; }

  const lib = DEFAULT_LIBRARY().map(p => ({ id: uid('prest'), ...p }));
  const demo = {
    id: uid('usr'),
    email: 'demo@devisly.fr',
    password: 'demo1234',
    fullName: 'Julien Marchand',
    role: 'Gérant',
    createdAt: Date.now() - 86400000 * 120,
    plan: 'pro',
    company: {
      name: 'Marchand Rénovation',
      legalForm: 'SARL',
      siret: '812 456 789 00027',
      rcs: 'RCS Lyon 812 456 789',
      ape: '4391B',
      tvaNumber: 'FR42812456789',
      address: '14 rue des Charpentiers',
      zip: '69007', city: 'Lyon',
      phone: '04 78 12 34 56',
      emailPro: 'contact@marchand-renovation.fr',
      website: 'marchand-renovation.fr',
      iban: 'FR76 3000 4000 0312 3456 7890 143',
      capital: '15 000 €',
      insurance: 'Décennale MAAF Pro — police n° 1180 4477',
      logo: '',
    },
    settings: { ...defaultSettings(), nextSeq: 5, nextInvoiceSeq: 2 },
    library: lib,
    clients: [],
    quotes: [],
    invoices: [],
  };

  const C = (o) => { const c = { id: uid('cli'), createdAt: Date.now(), ...o }; demo.clients.push(c); return c.id; };
  const c1 = C({ name: 'Copropriété Les Tilleuls', contact: 'M. Bernard Faure', email: 'syndic@lestilleuls.fr', phone: '04 72 00 11 22', address: '8 allée des Tilleuls', zip: '69100', city: 'Villeurbanne', kind: 'pro' });
  const c2 = C({ name: 'Sophie Lemoine', contact: 'Sophie Lemoine', email: 's.lemoine@email.fr', phone: '06 11 22 33 44', address: '23 rue Garibaldi', zip: '69006', city: 'Lyon', kind: 'particulier' });
  const c3 = C({ name: 'SCI Horizon', contact: 'M. Antoine Réaux', email: 'gestion@sci-horizon.fr', phone: '04 78 55 66 77', address: '2 quai Claude Bernard', zip: '69007', city: 'Lyon', kind: 'pro' });
  const c4 = C({ name: 'Restaurant Le Comptoir', contact: 'Mme Clara Vidal', email: 'clara@lecomptoir-lyon.fr', phone: '04 78 99 88 77', address: '45 rue Mercière', zip: '69002', city: 'Lyon', kind: 'pro' });

  const findP = (frag) => lib.find(p => p.label.toLowerCase().includes(frag));
  const line = (p, qty, over = {}) => ({
    id: uid('ln'), designation: p.label, detail: '', unit: p.unit,
    qty, unitPrice: p.price, marginCoef: 1.15, tva: 10, ...over,
  });
  const section = (type, lines) => ({ id: uid('sec'), type, label: SECTION_TYPES[type].label, lines });

  function mkQuote(seq, clientId, status, daysAgo, sections, extra = {}) {
    const created = Date.now() - 86400000 * daysAgo;
    return {
      id: uid('q'),
      number: `DEV-2026-${String(seq).padStart(4, '0')}`,
      clientId, status,
      createdAt: created,
      date: new Date(created).toISOString().slice(0, 10),
      validUntil: new Date(created + 86400000 * 30).toISOString().slice(0, 10),
      title: extra.title || 'Travaux de rénovation',
      sections,
      globalDiscount: 0,
      payments: [
        { label: 'Acompte à la signature', percent: 30 },
        { label: 'Situation intermédiaire', percent: 40 },
        { label: 'Solde à réception', percent: 30 },
      ],
      execDelay: 'Démarrage sous 3 semaines — durée estimée 4 semaines',
      conditions: defaultSettings().defaultConditions,
      notes: '',
      shareToken: token(),
      clientResponse: extra.clientResponse || null,
      ...extra,
    };
  }

  demo.quotes = [
    mkQuote(1, c1, 'accepted', 64, [
      section('maindoeuvre', [
        line(findP('façade'), 240, { tva: 10 }),
        line(findP('peinture'), 0).qty ? null : line(findP('peinture'), 60, { designation: 'Peinture des halls et cages d’escalier', tva: 10 }),
      ].filter(Boolean)),
      section('location', [ line(findP('échafaudage'), 18, { tva: 10 }) ]),
      section('deplacement', [ line(findP('déplacement'), 1, { tva: 10 }) ]),
    ], { title: 'Ravalement de façade — copropriété', clientResponse: { status: 'accepted', at: Date.now() - 86400000 * 58, name: 'Bernard Faure' } }),

    mkQuote(2, c2, 'sent', 9, [
      section('maindoeuvre', [
        line(findP('dépose'), 22, { tva: 10 }),
        line(findP('carrelage sol'), 22, { tva: 10 }),
        line(findP('faïence'), 14, { tva: 10 }),
        line(findP('point d’eau'), 2, { tva: 10 }),
      ]),
      section('materiaux', [ line(findP('mortier'), 14, { tva: 10 }) ]),
    ], { title: 'Rénovation salle de bain' }),

    mkQuote(3, c3, 'sent', 21, [
      section('maindoeuvre', [
        line(findP('cloison'), 48, { tva: 20 }),
        line(findP('chape'), 65, { tva: 20 }),
        line(findP('parquet'), 65, { tva: 20 }),
        line(findP('bloc-porte'), 5, { tva: 20 }),
      ]),
      section('soustraitance', [
        { id: uid('ln'), designation: 'Lot électricité — mise aux normes', detail: 'Sous-traitant agréé Qualifelec', unit: 'forfait', qty: 1, unitPrice: 4200, marginCoef: 1.1, tva: 20 },
      ]),
    ], { title: 'Aménagement de plateau — local neuf' }),

    mkQuote(4, c4, 'refused', 40, [
      section('maindoeuvre', [
        line(findP('peinture'), 95, { tva: 10 }),
        line(findP('carrelage sol'), 38, { tva: 10 }),
      ]),
    ], { title: 'Rafraîchissement salle de restaurant', clientResponse: { status: 'refused', at: Date.now() - 86400000 * 33, name: 'Clara Vidal' } }),
  ];

  demo.invoices = [{
    id: uid('inv'),
    number: 'FAC-2026-0001',
    quoteId: demo.quotes[0].id,
    quoteNumber: demo.quotes[0].number,
    clientId: c1,
    createdAt: Date.now() - 86400000 * 55,
    date: new Date(Date.now() - 86400000 * 55).toISOString().slice(0, 10),
    dueDate: new Date(Date.now() - 86400000 * 25).toISOString().slice(0, 10),
    status: 'paid',
    snapshot: JSON.parse(JSON.stringify(demo.quotes[0])),
  }];

  base.users.push(demo);
  db = base;
  persist();
  return base;
}

// ---------- API ----------
export function init() { db = load(); }
export function getDB() { return db; }

export function currentUser() {
  if (!db.session) return null;
  return db.users.find(u => u.id === db.session) || null;
}

export function signup({ email, password, fullName, companyName }) {
  email = email.trim().toLowerCase();
  if (db.users.some(u => u.email === email)) throw new Error('Un compte existe déjà avec cet e-mail.');
  const u = {
    id: uid('usr'), email, password, fullName: fullName.trim(), role: 'Gérant',
    createdAt: Date.now(), plan: 'starter',
    company: {
      name: companyName.trim(), legalForm: '', siret: '', rcs: '', ape: '', tvaNumber: '',
      address: '', zip: '', city: '', phone: '', emailPro: email, website: '',
      iban: '', capital: '', insurance: '', logo: '',
    },
    settings: defaultSettings(),
    library: DEFAULT_LIBRARY().map(p => ({ id: uid('prest'), ...p })),
    clients: [], quotes: [], invoices: [],
  };
  db.users.push(u);
  db.session = u.id;
  persist();
  return u;
}

export function login(email, password) {
  email = email.trim().toLowerCase();
  const u = db.users.find(x => x.email === email);
  if (!u) throw new Error('Aucun compte ne correspond à cet e-mail.');
  if (u.password !== password) throw new Error('Mot de passe incorrect.');
  db.session = u.id;
  persist();
  return u;
}

export function logout() { db.session = null; persist(); }

export function save() { persist(); }

export function updateUser(patch) {
  const u = currentUser();
  Object.assign(u, patch);
  persist();
  return u;
}
export function updateCompany(patch) {
  const u = currentUser();
  Object.assign(u.company, patch);
  persist();
  return u;
}
export function updateSettings(patch) {
  const u = currentUser();
  Object.assign(u.settings, patch);
  persist();
  return u;
}

export function setPlan(planId) {
  const u = currentUser();
  u.plan = planId;
  persist();
  return u;
}

// ---------- Quotes ----------
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

export function nextQuoteNumber(u = currentUser()) {
  const year = new Date().getFullYear();
  return `${u.settings.quotePrefix}-${year}-${String(u.settings.nextSeq).padStart(4, '0')}`;
}

export function newQuote() {
  const u = currentUser();
  const s = u.settings;
  return {
    id: uid('q'),
    number: nextQuoteNumber(u),
    clientId: '',
    status: 'draft',
    createdAt: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 86400000 * s.defaultValidity).toISOString().slice(0, 10),
    title: '',
    sections: [{ id: uid('sec'), type: 'maindoeuvre', label: SECTION_TYPES.maindoeuvre.label, lines: [] }],
    globalDiscount: 0,
    payments: [
      { label: 'Acompte à la signature', percent: 30 },
      { label: 'Solde à la fin des travaux', percent: 70 },
    ],
    execDelay: s.defaultExecDelay,
    conditions: s.defaultConditions,
    notes: '',
    shareToken: token(),
    clientResponse: null,
  };
}

export function getQuote(id) { return currentUser()?.quotes.find(q => q.id === id); }

export function saveQuote(q) {
  const u = currentUser();
  const i = u.quotes.findIndex(x => x.id === q.id);
  if (i >= 0) { u.quotes[i] = q; }
  else {
    u.quotes.unshift(q);
    if (q.number === nextQuoteNumber(u)) u.settings.nextSeq++;
  }
  persist();
  return q;
}

export function deleteQuote(id) {
  const u = currentUser();
  u.quotes = u.quotes.filter(q => q.id !== id);
  persist();
}

export function duplicateQuote(id) {
  const u = currentUser();
  const src = getQuote(id);
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('q');
  copy.number = nextQuoteNumber(u);
  copy.status = 'draft';
  copy.createdAt = Date.now();
  copy.date = new Date().toISOString().slice(0, 10);
  copy.validUntil = new Date(Date.now() + 86400000 * u.settings.defaultValidity).toISOString().slice(0, 10);
  copy.shareToken = token();
  copy.clientResponse = null;
  copy.sections.forEach(s => { s.id = uid('sec'); s.lines.forEach(l => l.id = uid('ln')); });
  u.quotes.unshift(copy);
  u.settings.nextSeq++;
  persist();
  return copy;
}

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
  persist();
  return found.quote;
}

// ---------- Invoices ----------
export function convertToInvoice(quoteId) {
  const u = currentUser();
  const q = getQuote(quoteId);
  if (!q) return null;
  if (u.invoices.some(i => i.quoteId === quoteId)) return u.invoices.find(i => i.quoteId === quoteId);
  const year = new Date().getFullYear();
  const inv = {
    id: uid('inv'),
    number: `${u.settings.invoicePrefix}-${year}-${String(u.settings.nextInvoiceSeq).padStart(4, '0')}`,
    quoteId: q.id,
    quoteNumber: q.number,
    clientId: q.clientId,
    createdAt: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
    status: 'unpaid',
    snapshot: JSON.parse(JSON.stringify(q)),
  };
  u.invoices.unshift(inv);
  u.settings.nextInvoiceSeq++;
  q.status = 'invoiced';
  persist();
  return inv;
}
export function getInvoice(id) { return currentUser()?.invoices.find(i => i.id === id); }

// ---------- Clients ----------
export function saveClient(c) {
  const u = currentUser();
  if (c.id) {
    const i = u.clients.findIndex(x => x.id === c.id);
    if (i >= 0) u.clients[i] = c;
  } else {
    c.id = uid('cli'); c.createdAt = Date.now();
    u.clients.unshift(c);
  }
  persist();
  return c;
}
export function deleteClient(id) {
  const u = currentUser();
  u.clients = u.clients.filter(c => c.id !== id);
  persist();
}
export function getClient(id) { return currentUser()?.clients.find(c => c.id === id); }

// ---------- Library ----------
export function saveLibraryItem(p) {
  const u = currentUser();
  if (p.id) {
    const i = u.library.findIndex(x => x.id === p.id);
    if (i >= 0) u.library[i] = p;
  } else {
    p.id = uid('prest');
    u.library.unshift(p);
  }
  persist();
  return p;
}
export function deleteLibraryItem(id) {
  const u = currentUser();
  u.library = u.library.filter(p => p.id !== id);
  persist();
}

// ---------- Calculs devis ----------
export function lineTotalHT(l) {
  return (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.marginCoef) || 1);
}
export function computeQuote(q) {
  let ht = 0;
  const tvaMap = {};
  const sectionTotals = {};
  for (const s of q.sections) {
    let st = 0;
    for (const l of s.lines) {
      const t = lineTotalHT(l);
      st += t;
      const rate = Number(l.tva) || 0;
      tvaMap[rate] = (tvaMap[rate] || 0) + t;
    }
    sectionTotals[s.id] = st;
    ht += st;
  }
  const discount = ht * ((Number(q.globalDiscount) || 0) / 100);
  const htNet = ht - discount;
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
  const ttc = htNet + tvaTotal;
  return { ht, discount, htNet, tvaLines, tvaTotal, ttc, sectionTotals };
}
