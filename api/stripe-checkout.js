// api/stripe-checkout.js
// POST { email, user_id, child_count, success_url, cancel_url }
// Returns { url } — redirect user to this URL for checkout

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_BASE      = 5.99;
const PRICE_PER_EXTRA = 2.99;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, user_id, child_count = 1, success_url, cancel_url } = req.body;
  if (!email || !user_id) return res.status(400).json({ error: "Missing email or user_id" });

  const kids   = Math.max(1, Number(child_count));
  const amount = Math.round((PRICE_BASE + Math.max(0, kids - 1) * PRICE_PER_EXTRA) * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product: process.env.STRIPE_PRODUCT_ID,
          recurring: { interval: "month" },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      metadata:          { user_id, child_count: String(kids) },
      subscription_data: { metadata: { user_id, child_count: String(kids) } },
      success_url: success_url || "https://dreamweaverstory.com?payment=success",
      cancel_url:  cancel_url  || "https://dreamweaverstory.com",
      allow_promotion_codes: true,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("stripe-checkout:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
