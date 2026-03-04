// api/stripe-webhook.js
// Stripe sends events here → we update Supabase subscriptions table
//
// In Stripe Dashboard → Developers → Webhooks → Add endpoint:
//   URL: https://dreamweaverstory.com/api/stripe-webhook
//   Events to select:
//     checkout.session.completed
//     invoice.paid
//     invoice.payment_failed
//     customer.subscription.updated
//     customer.subscription.deleted

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Must disable body parser so we can verify Stripe's signature
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    const raw = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook sig failed:", err.message);
    return res.status(400).json({ error: err.message });
  }

  try {
    switch (event.type) {

      // New subscriber completes checkout
      case "checkout.session.completed": {
        const sess    = event.data.object;
        const user_id = sess.metadata?.user_id;
        if (!user_id) break;

        const sub = await stripe.subscriptions.retrieve(sess.subscription);
        await upsertSub(user_id, {
          status:                 "active",
          stripe_customer_id:     sess.customer,
          stripe_subscription_id: sess.subscription,
          current_period_end:     toISO(sub.current_period_end),
          child_count:            Number(sess.metadata?.child_count || 1),
          cancel_at_period_end:   sub.cancel_at_period_end,
        });
        break;
      }

      // Monthly renewal paid
      case "invoice.paid": {
        const inv = event.data.object;
        if (!inv.subscription) break;
        const sub     = await stripe.subscriptions.retrieve(inv.subscription);
        const user_id = sub.metadata?.user_id;
        if (!user_id) break;
        await upsertSub(user_id, {
          status:                 "active",
          stripe_customer_id:     inv.customer,
          stripe_subscription_id: inv.subscription,
          current_period_end:     toISO(sub.current_period_end),
          cancel_at_period_end:   sub.cancel_at_period_end,
        });
        break;
      }

      // Payment failed (card declined, expired, etc.)
      case "invoice.payment_failed": {
        const inv = event.data.object;
        if (!inv.subscription) break;
        const sub     = await stripe.subscriptions.retrieve(inv.subscription);
        const user_id = sub.metadata?.user_id;
        if (!user_id) break;
        await upsertSub(user_id, {
          status:                 "past_due",
          stripe_customer_id:     inv.customer,
          stripe_subscription_id: inv.subscription,
        });
        break;
      }

      // Plan changed, cancel scheduled / unscheduled
      case "customer.subscription.updated": {
        const sub     = event.data.object;
        const user_id = sub.metadata?.user_id;
        if (!user_id) break;
        await upsertSub(user_id, {
          status:                 normalizeStatus(sub.status),
          stripe_customer_id:     sub.customer,
          stripe_subscription_id: sub.id,
          current_period_end:     toISO(sub.current_period_end),
          cancel_at_period_end:   sub.cancel_at_period_end,
        });
        break;
      }

      // Subscription fully canceled (after period ends)
      case "customer.subscription.deleted": {
        const sub     = event.data.object;
        const user_id = sub.metadata?.user_id;
        if (!user_id) break;
        await upsertSub(user_id, {
          status:                 "canceled",
          stripe_customer_id:     sub.customer,
          stripe_subscription_id: sub.id,
          cancel_at_period_end:   false,
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Internal error" });
  }

  return res.status(200).json({ received: true });
}

function toISO(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString();
}

function normalizeStatus(stripeStatus) {
  if (stripeStatus === "active")    return "active";
  if (stripeStatus === "past_due")  return "past_due";
  if (stripeStatus === "canceled")  return "canceled";
  return stripeStatus;
}

async function upsertSub(user_id, fields) {
  const { error } = await supabase
    .from("subscriptions")
    .upsert({ user_id, ...fields }, { onConflict: "user_id" });
  if (error) console.error("Supabase upsert error:", error.message);
}
