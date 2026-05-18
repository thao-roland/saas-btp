// ============================================================
// Edge Function : stripe-portal
// Ouvre le portail de facturation Stripe (changement de plan,
// mise à jour du moyen de paiement, résiliation).
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

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:4173/index.html";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (!user) return json({ error: "Session invalide" }, 401);

    const { data: entreprise } = await supabase
      .from("entreprises").select("id").eq("owner_id", user.id).single();
    const { data: abo } = await supabase
      .from("abonnements").select("stripe_customer_id")
      .eq("entreprise_id", entreprise?.id).single();

    if (!abo?.stripe_customer_id) {
      return json({ error: "Aucun abonnement Stripe actif" }, 400);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: abo.stripe_customer_id,
      return_url: `${APP_URL}#/app/account`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("stripe-portal:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
