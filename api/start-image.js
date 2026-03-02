export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { prompt, coloring = false, aspect_ratio } = req.body || {};
    if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "Missing prompt" });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });

    // Prefer model name for flux-schnell; allow version override if you want it
    const model = process.env.REPLICATE_MODEL || "black-forest-labs/flux-schnell";
    const version = process.env.REPLICATE_MODEL_VERSION; // optional

    // Flux Schnell inputs (common ones): prompt, aspect_ratio, num_outputs, num_inference_steps, output_format, output_quality
    // See Replicate model schema/examples for details. Defaults are fine if omitted. :contentReference[oaicite:1]{index=1}
    const input = {
      prompt,
      aspect_ratio: aspect_ratio || "1:1",
      output_format: "webp",
      output_quality: 80,
      // num_inference_steps: 4, // max is 4 for this model version :contentReference[oaicite:2]{index=2}
      // num_outputs: 1,
    };

    // If you want "coloring" to slightly affect style, you can alter the prompt:
    if (coloring) input.prompt = `${prompt}. clean line art, coloring book style, simple outlines`;

    const body = version
      ? { version, input }
      : { model, input };

    const resp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data?.detail || data?.error || "Failed to start prediction" });

    return res.status(200).json({ id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
