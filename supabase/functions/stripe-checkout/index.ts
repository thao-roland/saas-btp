// ============================================================
// Edge Function : stripe-checkout
// Crée une session Stripe Checkout sécurisée pour un abonnement.
// Appelée par le client authentifié ; renvoie l'URL de paiement.
// ============================================================
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

// Correspondance plan + périodicité -> identifiant de prix Stripe
const PRICES: Record<string, string | undefined> = {
  "pro:month": Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"),
  "pro:year": Deno.env.get("STRIPE_PRICE_PRO_YEARLY"),
  "entreprise:month": Deno.env.get("STRIPE_PRICE_ENTREPRISE_MONTHLY"),
  "entreprise:year": Deno.env.get("STRIPE_PRICE_ENTREPRISE_YEARLY"),
};

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:4173/index.html";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Authentifier l'utilisateur via son JWT Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !user) return json({ error: "Session invalide" }, 401);

    // 2. Récupérer l'entreprise et l'abonnement existant
    const { data: entreprise } = await supabase
      .from("entreprises").select("id, name, email_pro").eq("owner_id", user.id).single();
    if (!entreprise) return json({ error: "Entreprise introuvable" }, 404);

    const { data: abo } = await supabase
      .from("abonnements").select("*").eq("entreprise_id", entreprise.id).single();

    // 3. Choisir le prix Stripe demandé
    const { plan, interval } = await req.json();
    const priceId = PRICES[`${plan}:${interval}`];
    if (!priceId) return json({ error: "Plan ou périodicité inconnu" }, 400);

    // 4. Réutiliser ou créer le client Stripe
    let customerId = abo?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: entreprise.name,
        metadata: { entreprise_id: entreprise.id, user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("abonnements")
        .update({ stripe_customer_id: customerId })
        .eq("entreprise_id", entreprise.id);
    }

    // 5. Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: entreprise.id,
      subscription_data: {
        metadata: { entreprise_id: entreprise.id, plan },
      },
      metadata: { entreprise_id: entreprise.id, plan },
      allow_promotion_codes: true,
      success_url: `${APP_URL}#/app/account?checkout=success`,
      cancel_url: `${APP_URL}#/app/account?checkout=cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("stripe-checkout:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
