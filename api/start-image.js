// api/start-image.js
// Starts a Replicate image generation prediction and returns the prediction ID immediately.
// Uses the official models endpoint — no version hash needed for flux-schnell.
// ENV VARS: REPLICATE_API_TOKEN

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, coloring = false } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const imagePrompt = coloring
    ? `${prompt} Children's coloring book page. Pure black outlines only on white background. No color fills, no shading, no grey tones. Simple clean line art suitable for coloring in. NO text, NO words, NO letters anywhere.`
    : prompt;

  try {
    // Use the /models/{owner}/{name}/predictions endpoint for official models
    // This is the correct endpoint for flux-schnell — no version hash required
    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Prefer": "respond-async", // return immediately with prediction ID
        },
        body: JSON.stringify({
          input: {
            prompt: imagePrompt,
            num_inference_steps: coloring ? 4 : 4,
            guidance: 0,
            output_format: "webp",
            output_quality: 85,
            aspect_ratio: coloring ? "1:1" : "3:4",
            go_fast: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Replicate start error:", response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const prediction = await response.json();
    return res.status(200).json({ id: prediction.id });

  } catch (err) {
    console.error("start-image handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
