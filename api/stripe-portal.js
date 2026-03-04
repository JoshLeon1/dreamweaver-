// api/stripe-portal.js
// POST { email, user_id, return_url }
// Returns { url } — redirect user to Stripe billing portal

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, user_id, return_url } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    // 1. Try to get customer ID from our subscriptions table
    let customerId = null;

    if (user_id) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .maybeSingle();
      customerId = sub?.stripe_customer_id || null;
    }

    // 2. Fallback: search Stripe by email
    if (!customerId) {
      const list = await stripe.customers.list({ email, limit: 1 });
      customerId = list.data[0]?.id || null;
    }

    if (!customerId) {
      return res.status(404).json({ error: "No billing account found. Subscribe first." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: return_url || "https://dreamweaverstory.com",
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("stripe-portal:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
