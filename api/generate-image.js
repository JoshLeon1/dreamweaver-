export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { prompt } = req.body;
  const key = process.env.REPLICATE_KEY || process.env.VITE_REPLICATE_KEY;
  if (!key) return res.status(500).json({ error: "Missing REPLICATE_KEY env var" });

  try {
    const startRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-schnell",
        input: {
          prompt: `Soft watercolor children's book illustration, dreamy pastel colors: ${prompt}. No text, storybook style.`,
          aspect_ratio: "16:9",
          output_format: "webp",
          go_fast: true,
          num_inference_steps: 4,
        }
      }),
    });

    const prediction = await startRes.json();
    console.log("Replicate response:", JSON.stringify(prediction));
    
    if (prediction.error) return res.status(500).json({ error: prediction.error });
    if (!prediction.urls?.get) return res.status(500).json({ error: "No poll URL", prediction });

    // Poll until done
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { "Authorization": `Bearer ${key}` }
      });
      const pollData = await pollRes.json();
      
      if (pollData.status === "succeeded" && pollData.output?.[0]) {
        return res.json({ url: pollData.output[0] });
      }
      if (pollData.status === "failed") {
        return res.status(500).json({ error: "Prediction failed", logs: pollData.logs });
      }
    }
    return res.status(500).json({ error: "Timed out" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
