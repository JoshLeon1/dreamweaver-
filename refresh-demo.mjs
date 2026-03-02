import fs from "fs";

const REPLICATE_KEY = process.env.REPLICATE_KEY;
if (!REPLICATE_KEY) { console.error("Set REPLICATE_KEY"); process.exit(1); }

const SUPABASE_URL = "https://nhkwocgbxxwarkjqenkj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oa3dvY2dieHh3YXJranFlbmtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE3MjY0MSwiZXhwIjoyMDg3NzQ4NjQxfQ.iNeygioT5_OqqhWSPElbrZUktZJBNHMflx89BJxvO1Q";

const PROMPTS = [
  "Soft watercolor childrens book illustration, a small girl with curly red hair hugging a white stuffed rabbit, discovering a tiny glowing door in a mossy garden wall at dusk, dreamy pastel colors, storybook art. No text.",
  "Soft watercolor childrens book illustration, a magical moonlit garden beyond a small door, silver flowers glowing, fireflies dancing, a small girl and stuffed rabbit stepping through in wonder, dreamy pastel blues and purples. No text.",
  "Soft watercolor childrens book illustration, friendly whimsical shadows shaped like animals dancing on a glowing wall, a small girl laughing realizing the dark is filled with magic, warm golden light, pastel storybook art. No text.",
  "Soft watercolor childrens book illustration, a small girl curled up asleep beneath a giant glowing starflower, stuffed white rabbit tucked under her chin, peaceful moonlit garden, soft pastel lavender and cream. No text.",
];

async function generate(prompt) {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${REPLICATE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ version: "black-forest-labs/flux-schnell", input: { prompt, aspect_ratio: "16:9", output_format: "webp", go_fast: true, num_inference_steps: 4 } })
  });
  const pred = await res.json();
  if (!pred.urls?.get) { console.error("No poll URL:", JSON.stringify(pred)); return null; }
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(pred.urls.get, { headers: { "Authorization": `Bearer ${REPLICATE_KEY}` } });
    const data = await poll.json();
    if (data.status === "succeeded") return data.output[0];
    if (data.status === "failed") return null;
    process.stdout.write(".");
  }
  return null;
}

async function upload(replicateUrl, filename) {
  const imgRes = await fetch(replicateUrl);
  const buffer = await imgRes.arrayBuffer();
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/story-images/demo/${filename}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "image/webp", "x-upsert": "true" },
    body: buffer,
  });
  if (!uploadRes.ok) { console.error("Upload failed:", await uploadRes.text()); return replicateUrl; }
  return `${SUPABASE_URL}/storage/v1/object/public/story-images/demo/${filename}`;
}

const urls = [];
for (let i = 0; i < PROMPTS.length; i++) {
  console.log(`\n[${i+1}/4] Generating...`);
  const repUrl = await generate(PROMPTS[i]);
  if (!repUrl) { urls.push(null); continue; }
  console.log(`\n  ✓ Generated, uploading to Supabase...`);
  const url = await upload(repUrl, `demo_${i+1}.webp`);
  urls.push(url);
  console.log(`  ✓ Saved permanently: ${url}`);
  if (i < 3) { console.log("  ⏳ Waiting 15s..."); await new Promise(r => setTimeout(r, 15000)); }
}

let src = fs.readFileSync("src/App.jsx", "utf8");
src = src.replace(/const DEMO_STORY = \[[\s\S]*?\];/, `const DEMO_STORY = [
  { text: "The night Lily found a tiny glowing door in the garden wall, she squeezed Mr. Hops tight.", img: "${urls[0]}", fallback: "linear-gradient(135deg,#1a0d3e,#3d1d7e,#7c4dcc)" },
  { text: "Beyond the door lay a moonlit garden — silver flowers and fireflies dancing in the dark.", img: "${urls[1]}", fallback: "linear-gradient(135deg,#0a1628,#1a3060,#2a50a0)" },
  { text: "Even the shadows were friendly here. The dark wasn't scary — it was where all the magic hid.", img: "${urls[2]}", fallback: "linear-gradient(135deg,#0f1a30,#1a3050,#2a5080)" },
  { text: "She curled up beneath a starflower, Mr. Hops tucked under her chin, and drifted off to sleep.", img: "${urls[3]}", fallback: "linear-gradient(135deg,#0a0a1e,#1a1a40,#3030a0)" },
];`);
fs.writeFileSync("src/App.jsx", src);
console.log("\n✅ Done! Now run:");
console.log("  git add src/App.jsx && git commit -m \"permanent demo images\" && git push");
