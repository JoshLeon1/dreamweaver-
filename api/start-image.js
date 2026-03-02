export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { prompt, coloring = false } = req.body || {};
  const key = process.env.REPLICATE_KEY || process.env.VITE_REPLICATE_KEY || process.env.REPLICATE_API_TOKEN;
  if (!key) return res.status(500).json({ error: "Missing API key" });
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const fullPrompt = coloring
    ? `Children's coloring book, black outlines on white, no color, simple line art: ${prompt}`
    : `Soft watercolor children's book illustration, pastel colors, storybook style, no text: ${prompt}`;

  try {
    const r = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "respond-async",
      },
      body: JSON.stringify({
        input: {
          prompt: fullPrompt,
          aspect_ratio: coloring ? "1:1" : "16:9",
          output_format: "webp",
          go_fast: true,
          num_inference_steps: 4,
        }
      }),
    });
    const text = await r.text();
    let prediction;
    try { prediction = JSON.parse(text); } catch(e) { return res.status(500).json({ error: "Bad JSON", raw: text.slice(0,300) }); }
    if (!r.ok) return res.status(500).json({ error: `Replicate ${r.status}`, detail: prediction });
    if (!prediction.id) return res.status(500).json({ error: "No id", detail: prediction });
    return res.json({ id: prediction.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
