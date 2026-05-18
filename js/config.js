// ============================================================
// Devisly — Configuration côté client
// ------------------------------------------------------------
// Renseignez ces deux valeurs pour activer le mode CLOUD
// (Supabase + Stripe). Tant qu'elles contiennent la valeur
// d'exemple, l'application fonctionne en mode LOCAL de secours
// (données dans le navigateur), ce qui permet de la tester
// immédiatement sans backend.
//
// Ces deux clés sont PUBLIQUES par conception : la clé « anon »
// n'autorise que ce que la Row Level Security permet.
// Ne placez JAMAIS ici la clé service_role ni les clés Stripe.
// ============================================================

export const CONFIG = {
  SUPABASE_URL: 'https://zkyffkbbmbvqkkeyvzkv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_I-rhzmLacFXhazledaDL1A_l3CPOZsL',
};

// Le mode cloud est actif dès que les clés ont été remplacées.
export function isCloud() {
  return (
    /^https:\/\/[a-z0-9]+\.supabase\.co/.test(CONFIG.SUPABASE_URL) &&
    CONFIG.SUPABASE_ANON_KEY.length > 40
  );
}
