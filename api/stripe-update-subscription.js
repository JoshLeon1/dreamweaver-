// api/stripe-update-subscription.js
// Updates an existing Stripe subscription when a child is added.
// POST body: { user_id, child_count }
// Prorates automatically — Stripe charges the difference immediately.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRICE_BASE      = 5.99;
const PRICE_PER_EXTRA = 2.99;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { user_id, child_count } = req.body;
  if (!user_id || !child_count) {
    return res.status(400).json({ error: "Missing user_id or child_count" });
  }

  try {
    // Get their current subscription from Supabase
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      return res.status(404).json({ error: "No active subscription found." });
    }

    // Calculate new price
    const kids   = Math.max(1, Number(child_count));
    const amount = Math.round(
      (PRICE_BASE + Math.max(0, kids - 1) * PRICE_PER_EXTRA) * 100
    );

    // Get the current subscription to find the price item
    const subscription = await stripe.subscriptions.retrieve(
      sub.stripe_subscription_id
    );

    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return res.status(500).json({ error: "Could not find subscription item." });
    }

    // Update the subscription with new price — Stripe prorates automatically
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{
        id: itemId,
        price_data: {
          currency:    "usd",
          product:     process.env.STRIPE_PRODUCT_ID,
          recurring:   { interval: "month" },
          unit_amount: amount,
        },
      }],
      metadata:         { user_id, child_count: String(kids) },
      proration_behavior: "always_invoice", // charge difference immediately
    });

    // Update Supabase
    await supabase
      .from("subscriptions")
      .update({ child_count: kids })
      .eq("user_id", user_id);

    return res.status(200).json({ ok: true, new_amount: amount });
  } catch (err) {
    console.error("stripe-update-subscription:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
