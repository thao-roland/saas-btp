// ============================================================
// Edge Function : stripe-webhook
// Reçoit les événements Stripe et met à jour la table `abonnements`
// en temps réel. Utilise la clé service_role (contourne la RLS).
//
// IMPORTANT : déployer cette fonction avec --no-verify-jwt
//   supabase functions deploy stripe-webhook --no-verify-jwt
// ============================================================
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Identifiant de prix Stripe -> plan applicatif
const PRICE_TO_PLAN: Record<string, string> = {};
for (const [env, plan] of [
  ["STRIPE_PRICE_PRO_MONTHLY", "pro"],
  ["STRIPE_PRICE_PRO_YEARLY", "pro"],
  ["STRIPE_PRICE_ENTREPRISE_MONTHLY", "entreprise"],
  ["STRIPE_PRICE_ENTREPRISE_YEARLY", "entreprise"],
]) {
  const id = Deno.env.get(env);
  if (id) PRICE_TO_PLAN[id] = plan;
}

// Met à jour l'abonnement d'une entreprise à partir d'un objet Subscription
async function syncSubscription(sub: Stripe.Subscription) {
  const entrepriseId = sub.metadata?.entreprise_id;
  const priceId = sub.items.data[0]?.price.id;
  const plan = (priceId && PRICE_TO_PLAN[priceId]) || "pro";
  const interval = sub.items.data[0]?.price.recurring?.interval ?? "month";

  const patch = {
    plan: sub.status === "canceled" ? "starter" : plan,
    status: sub.status,
    billing_interval: interval,
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  // Cible l'entreprise via les métadonnées, sinon via le customer Stripe
  const query = supabase.from("abonnements").update(patch);
  if (entrepriseId) await query.eq("entreprise_id", entrepriseId);
  else await query.eq("stripe_customer_id", sub.customer as string);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, WEBHOOK_SECRET);
  } catch (e) {
    console.error("Signature webhook invalide :", (e as Error).message);
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    switch (event.type) {
      // Paiement initial réussi -> récupère et synchronise l'abonnement
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          if (!sub.metadata?.entreprise_id && session.metadata?.entreprise_id) {
            sub.metadata = { ...sub.metadata, entreprise_id: session.metadata.entreprise_id };
          }
          await syncSubscription(sub);
        }
        break;
      }

      // Changement de plan, renouvellement, reprise...
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      // Résiliation -> retour au plan Starter
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from("abonnements").update({
          plan: "starter", status: "canceled",
          stripe_subscription_id: null, cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq("stripe_customer_id", sub.customer as string);
        break;
      }

      // Échec de paiement -> abonnement en souffrance
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await supabase.from("abonnements").update({
          status: "past_due", updated_at: new Date().toISOString(),
        }).eq("stripe_customer_id", inv.customer as string);
        break;
      }

      // Paiement régularisé
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
          await syncSubscription(sub);
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Traitement webhook :", e);
    return new Response("Erreur de traitement", { status: 500 });
  }
});
