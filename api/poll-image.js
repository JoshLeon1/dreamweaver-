// api/poll-image.js
// Polls a Replicate prediction by ID and returns its status + output URL.
// Called every 2s by the frontend until status is "succeeded" or "failed".
// ENV VARS: REPLICATE_API_TOKEN

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing prediction id" });

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Replicate poll error:", response.status, errText);
      return res.status(response.status).json({ status: "failed", error: errText, url: null });
    }

    const prediction = await response.json();
    const status = prediction.status; // "starting" | "processing" | "succeeded" | "failed" | "canceled"

    // flux-schnell returns output as an array of URLs
    let url = null;
    if (status === "succeeded" && prediction.output) {
      url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    }

    return res.status(200).json({
      status,
      url,
      error: prediction.error || null,
    });

  } catch (err) {
    console.error("poll-image handler error:", err);
    return res.status(500).json({ status: "failed", url: null, error: err.message });
  }
}
