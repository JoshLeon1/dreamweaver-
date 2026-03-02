export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.body;
  const key = process.env.REPLICATE_KEY || process.env.VITE_REPLICATE_KEY;
  if (!key) return res.status(500).json({ error: "Missing REPLICATE_KEY" });

  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { "Authorization": `Bearer ${key}` }
    });
    const data = await r.json();
    return res.json({ status: data.status, url: data.output?.[0] || null, error: data.error || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
