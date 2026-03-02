/**
 * Run this ONCE to generate the 4 landing page demo illustrations.
 * They get hardcoded directly into App.jsx so the landing page loads instantly.
 *
 * Usage:
 *   REPLICATE_KEY=r8_xxx node generate-demo-images.mjs
 */

import fs from "fs";
import path from "path";

const KEY = process.env.REPLICATE_KEY || process.env.VITE_REPLICATE_KEY;
if (!KEY) {
  console.error("❌  Set REPLICATE_KEY env var first.\n   REPLICATE_KEY=r8_xxx node generate-demo-images.mjs");
  process.exit(1);
}

const PROMPTS = [
  "soft watercolor children's book illustration, a small girl with brown hair hugging a white stuffed rabbit, discovering a tiny glowing magical golden door set into an old mossy garden wall at night, warm purple and amber light, dreamy pastel storybook art, no text",
  "soft watercolor children's book illustration, a magical moonlit garden beyond a stone wall, glowing silver and gold flowers, fireflies dancing like tiny lanterns, a little girl and white rabbit gazing in wonder, enchanted dreamy night scene, pastel purples and blues, storybook art, no text",
  "soft watercolor children's book illustration, friendly whimsical glowing shadow creatures shaped like animals in an enchanted glowing forest, a brave little girl laughing among them, warm teals and purples, magical night scene, children's storybook art, no text",
  "soft watercolor children's book illustration, a small girl sleeping peacefully curled under a giant glowing starflower, white stuffed rabbit tucked under her chin, soft golden moonlight, cozy magical bedtime scene, warm pastels, children's storybook art, no text",
];

async function generateImage(prompt) {
  console.log(`  → Generating: "${prompt.slice(0, 60)}…"`);

  const startRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
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
      },
    }),
  });

  const prediction = await startRes.json();
  if (prediction.error) throw new Error(prediction.error);
  if (!prediction.urls?.get) throw new Error("No poll URL: " + JSON.stringify(prediction));

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const poll = await pollRes.json();
    if (poll.status === "succeeded" && poll.output?.[0]) {
      console.log(`  ✓ Done: ${poll.output[0]}`);
      return poll.output[0];
    }
    if (poll.status === "failed") throw new Error("Failed: " + poll.logs);
    process.stdout.write(".");
  }
  throw new Error("Timed out");
}

async function main() {
  console.log("🎨  Generating 4 demo illustrations…\n");
  const urls = [];

  for (let i = 0; i < PROMPTS.length; i++) {
    console.log(`\n[${i + 1}/${PROMPTS.length}]`);
    if (i > 0) {
      console.log("  Waiting 12s to avoid rate limit…");
      await new Promise(r => setTimeout(r, 12000));
    }
    const url = await generateImage(PROMPTS[i]);
    urls.push(url);
  }

  console.log("\n\n✅  All done! Patching App.jsx…\n");

  // Patch App.jsx — replace the DEMO_STORY block with hardcoded URLs
  const appPath = path.join("src", "App.jsx");
  let src = fs.readFileSync(appPath, "utf8");

  const TEXTS = [
    "The night Lily found a tiny glowing door in the garden wall, she squeezed Mr. Hops tight.",
    "Beyond the door lay a moonlit garden — silver flowers and fireflies dancing in the dark.",
    "Even the shadows were friendly here. The dark wasn't scary — it was where all the magic hid.",
    "She curled up beneath a starflower, Mr. Hops tucked under her chin, and drifted off to sleep.",
  ];

  const FALLBACKS = [
    "linear-gradient(135deg,#1a0d3e,#3d1d7e,#7c4dcc)",
    "linear-gradient(135deg,#0a1628,#1a3060,#2a50a0)",
    "linear-gradient(135deg,#0f1a30,#1a3050,#2a5080)",
    "linear-gradient(135deg,#0a0a1e,#1a1a40,#3030a0)",
  ];

  const newBlock = `// Demo story — illustrations pre-generated, hardcoded for instant load
const DEMO_STORY = [
${urls
  .map(
    (url, i) => `  {
    text: "${TEXTS[i]}",
    img: "${url}",
    fallback: "${FALLBACKS[i]}",
  }`
  )
  .join(",\n")}
];`;

  // Replace everything from the DEMO_STORY comment to the closing ];
  src = src.replace(
    /\/\/ Demo story[\s\S]*?^];/m,
    newBlock
  );

  // Also remove the generation effect and demoImgs state since images are now static
  src = src.replace(
    /\n\s*const \[demoImgs.*\n\s*const demoGenRef.*\n/,
    "\n"
  );
  src = src.replace(
    /\n\s*\/\/ Generate demo illustrations[\s\S]*?\}, \[screen\]\);\n/m,
    "\n"
  );

  // Update demo rendering to use page.img directly
  src = src.replace(
    /\{demoImgs\[idx\] \? \(\s*<img[\s\S]*?\) : \(\s*<div[\s\S]*?<\/div>\s*\)\}/,
    `<img src={page?.img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />`
  );

  fs.writeFileSync(appPath, src);
  console.log("✅  App.jsx patched with hardcoded image URLs.");
  console.log("\nURLs hardcoded:");
  urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  console.log("\nDeploy now:\n  git add src/App.jsx && git commit -m 'hardcode demo images' && git push");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
