// ============================================================
// Devisly — Module Suivi de chantier · couche de données
// ------------------------------------------------------------
// Stockage 100 % localStorage, indépendant du module devis.
// Les données sont rangées par utilisateur :
//   { [userId]: { chantiers: [ ... ] } }
// Photos et documents sont conservés en base64.
// ============================================================
import { currentUser, uid } from './store.js';

const CKEY = 'devisly:chantiers:v1';

// ---------- Constantes métier ----------
export const CHANTIER_STATUS = {
  pending: { label: 'En attente', color: 'gray' },
  ongoing: { label: 'En cours', color: 'blue' },
  paused:  { label: 'En pause', color: 'amber' },
  done:    { label: 'Terminé', color: 'green' },
};

export const PHASE_STATUS = {
  todo:      { label: 'À faire', color: 'gray', cal: '#8a867c' },
  doing:     { label: 'En cours', color: 'amber', cal: '#b45309' },
  done:      { label: 'Terminé', color: 'blue', cal: '#1d4ed8' },
  validated: { label: 'Validé client', color: 'green', cal: '#15803d' },
};

// Phases proposées par défaut à la création d'un chantier BTP
export const DEFAULT_PHASES = [
  'Préparation & installation de chantier',
  'Démolition',
  'Gros œuvre',
  'Plomberie',
  'Électricité',
  'Plâtrerie & cloisons',
  'Revêtements & finitions',
  'Nettoyage & livraison',
];

const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
// Date locale YYYY-MM-DD (cohérente avec les champs <input type="date">)
const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

// ---------- Persistance ----------
let cdb = null;
function load() {
  try { cdb = JSON.parse(localStorage.getItem(CKEY)) || {}; }
  catch { cdb = {}; }
}
function persist() { localStorage.setItem(CKEY, JSON.stringify(cdb)); }

// Renvoie (en le créant au besoin) l'espace de l'utilisateur courant
function bucket() {
  if (!cdb) load();
  const u = currentUser();
  if (!u) return { chantiers: [] };
  if (!cdb[u.id]) cdb[u.id] = { chantiers: [] };
  return cdb[u.id];
}

// ---------- Chantiers ----------
export function getChantiers() {
  return [...bucket().chantiers].sort((a, b) => b.createdAt - a.createdAt);
}
export function getChantier(id) {
  return bucket().chantiers.find(c => c.id === id) || null;
}

export function createChantier(data) {
  const c = {
    id: uid('ch'),
    name: data.name,
    clientId: data.clientId || '',
    address: data.address || '',
    startDate: data.startDate || today(),
    endDate: data.endDate || '',
    budget: Number(data.budget) || 0,
    status: data.status || 'pending',
    createdAt: Date.now(),
    phases: [],
    documents: [],
  };
  bucket().chantiers.push(c);
  persist();
  return c;
}

export function updateChantier(id, patch) {
  const c = getChantier(id);
  if (!c) return null;
  Object.assign(c, patch);
  persist();
  return c;
}

export function deleteChantier(id) {
  const b = bucket();
  b.chantiers = b.chantiers.filter(c => c.id !== id);
  persist();
}

// ---------- Phases ----------
export function addPhase(chantierId, data) {
  const c = getChantier(chantierId);
  if (!c) return null;
  const p = {
    id: uid('ph'),
    name: data.name || 'Nouvelle phase',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    responsable: data.responsable || '',
    description: data.description || '',
    status: data.status || 'todo',
    photos: [],
    shareToken: token(),
    clientValidation: null,
    createdAt: Date.now(),
  };
  c.phases.push(p);
  persist();
  return p;
}

export function updatePhase(chantierId, phaseId, patch) {
  const c = getChantier(chantierId);
  const p = c && c.phases.find(x => x.id === phaseId);
  if (!p) return null;
  Object.assign(p, patch);
  persist();
  return p;
}

export function deletePhase(chantierId, phaseId) {
  const c = getChantier(chantierId);
  if (!c) return;
  c.phases = c.phases.filter(p => p.id !== phaseId);
  persist();
}

export function getPhase(chantierId, phaseId) {
  const c = getChantier(chantierId);
  return c ? c.phases.find(p => p.id === phaseId) || null : null;
}

// ---------- Photos d'une phase ----------
export function addPhoto(chantierId, phaseId, dataUrl, caption) {
  const p = getPhase(chantierId, phaseId);
  if (!p) return null;
  const photo = { id: uid('img'), dataUrl, caption: caption || '', uploadedAt: Date.now() };
  p.photos.push(photo);
  persist();
  return photo;
}
export function updatePhoto(chantierId, phaseId, photoId, patch) {
  const p = getPhase(chantierId, phaseId);
  const ph = p && p.photos.find(x => x.id === photoId);
  if (ph) { Object.assign(ph, patch); persist(); }
  return ph;
}
export function deletePhoto(chantierId, phaseId, photoId) {
  const p = getPhase(chantierId, phaseId);
  if (p) { p.photos = p.photos.filter(x => x.id !== photoId); persist(); }
}

// ---------- Documents du chantier ----------
export function addDocument(chantierId, doc) {
  const c = getChantier(chantierId);
  if (!c) return null;
  const d = { id: uid('doc'), name: doc.name, dataUrl: doc.dataUrl, uploadedAt: Date.now() };
  c.documents.push(d);
  persist();
  return d;
}
export function deleteDocument(chantierId, docId) {
  const c = getChantier(chantierId);
  if (c) { c.documents = c.documents.filter(d => d.id !== docId); persist(); }
}

// ---------- Validation client (page publique) ----------
// Recherche une phase par son jeton de partage, tous utilisateurs confondus.
export function findPhaseByToken(tok) {
  if (!cdb) load();
  for (const userId in cdb) {
    for (const c of cdb[userId].chantiers || []) {
      const ph = (c.phases || []).find(p => p.shareToken === tok);
      if (ph) return { chantier: c, phase: ph, ownerId: userId };
    }
  }
  return null;
}

export function recordPhaseValidation(tok, clientName, signatureDataUrl) {
  const found = findPhaseByToken(tok);
  if (!found) return null;
  found.phase.status = 'validated';
  found.phase.clientValidation = {
    name: clientName,
    signature: signatureDataUrl,
    at: Date.now(),
  };
  persist();
  return found;
}

// ---------- Calculs ----------
// Avancement global = ratio de phases terminées ou validées
export function chantierProgress(c) {
  const phases = c.phases || [];
  if (!phases.length) return 0;
  const done = phases.filter(p => p.status === 'done' || p.status === 'validated').length;
  return Math.round((done / phases.length) * 100);
}

// Une phase est en retard si sa date de fin est dépassée et qu'elle
// n'est ni terminée ni validée.
export function isPhaseOverdue(p) {
  if (!p.endDate) return false;
  if (p.status === 'done' || p.status === 'validated') return false;
  return p.endDate < today();
}

// Renvoie toutes les phases de tous les chantiers, enrichies du chantier
// parent — utilisé par le planning.
export function allPhases() {
  const out = [];
  for (const c of bucket().chantiers) {
    for (const p of c.phases || []) out.push({ phase: p, chantier: c });
  }
  return out;
}
