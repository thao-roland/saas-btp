// ============================================================
// Devisly — Adaptateur Supabase (mode cloud)
// Charge le SDK Supabase, gère l'authentification, les requêtes
// de données et l'appel des Edge Functions Stripe.
// ============================================================
import { CONFIG } from './config.js';

let _client = null;

// Initialisation paresseuse : le SDK n'est chargé qu'en mode cloud.
export async function getClient() {
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
  _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

// ---------- Authentification ----------
export async function cloudSignUp({ email, password, fullName, companyName }) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, company_name: companyName } },
  });
  if (error) throw new Error(traduireErreur(error.message));
  if (!data.session) {
    throw new Error('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.');
  }
  return data.user;
}

export async function cloudSignIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(traduireErreur(error.message));
  return data.user;
}

export async function cloudSignOut() {
  const sb = await getClient();
  await sb.auth.signOut();
}

export async function currentSession() {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ---------- Chargement de l'espace de travail ----------
// Récupère en une fois toutes les données de l'entreprise connectée.
export async function loadWorkspace() {
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb.from('users').select('*').eq('id', user.id).maybeSingle();
  const { data: entreprise } = await sb.from('entreprises').select('*').eq('owner_id', user.id).maybeSingle();
  if (!entreprise) return null;

  const [clients, prestations, devis, abonnement] = await Promise.all([
    sb.from('clients').select('*').eq('entreprise_id', entreprise.id).order('created_at', { ascending: false }),
    sb.from('prestations').select('*').eq('entreprise_id', entreprise.id).order('created_at', { ascending: false }),
    sb.from('devis').select('*').eq('entreprise_id', entreprise.id).order('created_at', { ascending: false }),
    sb.from('abonnements').select('*').eq('entreprise_id', entreprise.id).maybeSingle(),
  ]);

  return {
    user,
    profile: profile || { id: user.id, email: user.email, full_name: '', role: 'Gérant' },
    entreprise,
    clients: clients.data || [],
    prestations: prestations.data || [],
    devis: devis.data || [],
    abonnement: abonnement.data || { plan: 'starter', status: 'active' },
  };
}

// ---------- Écritures (RLS : limitées à l'entreprise courante) ----------
export async function dbUpsert(table, row) {
  const sb = await getClient();
  const { error } = await sb.from(table).upsert(row);
  if (error) throw new Error(error.message);
}

export async function dbDelete(table, id) {
  const sb = await getClient();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateEntreprise(id, patch) {
  const sb = await getClient();
  const { error } = await sb.from('entreprises').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateProfile(id, patch) {
  const sb = await getClient();
  const { error } = await sb.from('users').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Edge Functions Stripe ----------
export async function invokeFunction(name, body) {
  const sb = await getClient();
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ---------- Partage public (sans authentification) ----------
export async function fetchSharedQuote(token) {
  const sb = await getClient();
  const { data, error } = await sb.rpc('get_shared_quote', { p_token: token });
  if (error) throw new Error(error.message);
  return data;
}

export async function submitQuoteResponse(token, status, name) {
  const sb = await getClient();
  const { data, error } = await sb.rpc('respond_to_quote', {
    p_token: token, p_status: status, p_name: name,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Messages d'erreur en français ----------
function traduireErreur(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already exists'))
    return 'Un compte existe déjà avec cet e-mail.';
  if (m.includes('invalid login credentials'))
    return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed'))
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
  if (m.includes('password') && m.includes('6'))
    return 'Le mot de passe doit comporter au moins 6 caractères.';
  return msg;
}
