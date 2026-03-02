export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { prompt, coloring = false } = req.body;
  const key = process.env.REPLICATE_KEY || process.env.VITE_REPLICATE_KEY;
  if (!key) return res.status(500).json({ error: "Missing REPLICATE_KEY" });

  const fullPrompt = coloring
    ? `Children's coloring book page, pure black thick outlines on white background, NO color, NO shading, NO gray fills, simple bold shapes, clean line art, printable: ${prompt}`
    : `Soft watercolor children's book illustration, dreamy pastel colors: ${prompt}. No text, storybook style.`;

  try {
    const startRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "black-forest-labs/flux-schnell",
        input: { prompt: fullPrompt, aspect_ratio: coloring ? "1:1" : "16:9", output_format: "webp", go_fast: true, num_inference_steps: coloring ? 8 : 4 }
      }),
    });

    const prediction = await startRes.json();
    if (prediction.error) return res.status(500).json({ error: prediction.error });
    if (!prediction.urls?.get) return res.status(500).json({ error: "No poll URL" });

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 1200));
      const poll = await fetch(prediction.urls.get, { headers: { "Authorization": `Bearer ${key}` } });
      const data = await poll.json();
      if (data.status === "succeeded" && data.output?.[0]) return res.json({ url: data.output[0] });
      if (data.status === "failed") return res.status(500).json({ error: "Failed" });
    }
    return res.status(500).json({ error: "Timed out" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
