import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY;
const APP_URL = "https://dreamweaver-kohl.vercel.app";
const TRIAL_DAYS = 7;
const STORY_PAGES = 10;

const MOODS = [
  { id: "magical",  emoji: "✨", label: "Magical",  prompt: "magical and full of wonder" },
  { id: "silly",    emoji: "😂", label: "Silly",    prompt: "funny and giggly" },
  { id: "brave",    emoji: "🦁", label: "Brave",    prompt: "adventurous and heroic" },
  { id: "dreamy",   emoji: "🌈", label: "Dreamy",   prompt: "soft and dreamy like a lullaby" },
  { id: "cozy",     emoji: "🍵", label: "Cozy",     prompt: "warm and cozy like a rainy day inside" },
];

const LESSONS = [
  { id: "sharing",      emoji: "🤝", label: "Sharing",         prompt: "the importance of sharing and generosity with others" },
  { id: "kindness",     emoji: "💛", label: "Kindness",        prompt: "being kind and compassionate to everyone around you" },
  { id: "bravery",      emoji: "🦁", label: "Being Brave",     prompt: "finding courage when things feel scary or hard" },
  { id: "honesty",      emoji: "🌟", label: "Honesty",         prompt: "always telling the truth even when it's difficult" },
  { id: "patience",     emoji: "🌱", label: "Patience",        prompt: "waiting calmly and trusting that good things take time" },
  { id: "trying",       emoji: "💪", label: "Keep Trying",     prompt: "never giving up and learning from mistakes" },
  { id: "feelings",     emoji: "🌈", label: "Big Feelings",    prompt: "understanding and expressing big emotions in healthy ways" },
  { id: "environment",  emoji: "🌍", label: "Nature & Earth",  prompt: "loving and protecting our natural world" },
  { id: "friendship",   emoji: "👫", label: "Friendship",      prompt: "what makes a true friendship and how to be a good friend" },
  { id: "gratitude",    emoji: "🙏", label: "Gratitude",       prompt: "noticing and appreciating the good things in life" },
];

const WIZARD_STEPS = [
  { key: "child_name",      emoji: "👧", label: "What's your child's name?",          placeholder: "Emma",                  hint: "Their name lives in every story" },
  { key: "age",             emoji: "🎂", label: "How old are they?",                   placeholder: "5",                     hint: "Stories are perfectly tailored to their age", type: "number" },
  { key: "stuffed_animal",  emoji: "🧸", label: "Their favorite stuffed animal?",      placeholder: "Mr. Snuggles the bear", hint: "Their best friend stars in every adventure" },
  { key: "best_friend",     emoji: "👫", label: "Who is their best friend?",           placeholder: "Lily next door",        hint: "Friends join the journey" },
  { key: "favorite_animal", emoji: "🦄", label: "Favorite animal?",                    placeholder: "Horses",                hint: "This creature makes a magical appearance" },
  { key: "scared_of",       emoji: "💭", label: "What are they a little scared of?",   placeholder: "Thunderstorms",         hint: "Stories gently help them be brave" },
  { key: "favorite_thing",  emoji: "🎨", label: "What do they love doing most?",       placeholder: "Painting rainbows",     hint: "Their passion weaves through every page" },
];

// Demo story — text + prompts. Images generated via Replicate on landing mount.
const DEMO_STORY = [
  {
    text: "The night Lily found a tiny glowing door in the garden wall, she squeezed Mr. Hops tight.",
    prompt: "soft watercolor children's book illustration, a small girl with brown hair hugging a white stuffed rabbit, discovering a tiny glowing magical golden door set into an old mossy garden wall at night, warm purple and amber light, dreamy pastel storybook art, no text",
    fallback: "linear-gradient(135deg,#1a0d3e,#3d1d7e,#7c4dcc)",
  },
  {
    text: "Beyond the door lay a moonlit garden — silver flowers and fireflies dancing in the dark.",
    prompt: "soft watercolor children's book illustration, a magical moonlit garden beyond a stone wall, glowing silver and gold flowers, fireflies dancing like tiny lanterns, a little girl and white rabbit gazing in wonder, enchanted dreamy night scene, pastel purples and blues, storybook art, no text",
    fallback: "linear-gradient(135deg,#0a1628,#1a3060,#2a50a0)",
  },
  {
    text: "Even the shadows were friendly here. The dark wasn't scary — it was where all the magic hid.",
    prompt: "soft watercolor children's book illustration, friendly whimsical glowing shadow creatures shaped like animals in an enchanted glowing forest, a brave little girl laughing among them, warm teals and purples, magical night scene, children's storybook art, no text",
    fallback: "linear-gradient(135deg,#0f1a30,#1a3050,#2a5080)",
  },
  {
    text: "She curled up beneath a starflower, Mr. Hops tucked under her chin, and drifted off to sleep.",
    prompt: "soft watercolor children's book illustration, a small girl sleeping peacefully curled under a giant glowing starflower, white stuffed rabbit tucked under her chin, soft golden moonlight, cozy magical bedtime scene, warm pastels, children's storybook art, no text",
    fallback: "linear-gradient(135deg,#0a0a1e,#1a1a40,#3030a0)",
  },
];

const STARS = Array.from({ length: 90 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  size: Math.random() * 2.5 + 0.4, delay: Math.random() * 8, dur: Math.random() * 5 + 2,
}));

const MOON_FRAMES = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const getSharedId = () => new URLSearchParams(window.location.search).get("story");

// ── API ──────────────────────────────────────────────────────────────────────
async function callClaude(messages, maxTokens = 1200) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function generateImage(prompt) {
  try {
    const res = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return data.url || null;
  } catch { return null; }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const isMobile = () => typeof window !== "undefined" && window.innerWidth < 700;

// Upload a Replicate image URL to Supabase Storage and return the permanent URL
async function cacheImage(replicateUrl, storyId, pageIndex) {
  try {
    const resp = await fetch(replicateUrl);
    const blob = await resp.blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const path = `stories/${storyId}/page_${pageIndex}.${ext}`;
    const { error } = await supabase.storage
      .from("story-images")
      .upload(path, blob, { contentType: blob.type, upsert: true });
    if (error) return replicateUrl; // fallback to original
    const { data } = supabase.storage.from("story-images").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return replicateUrl; // fallback
  }
}

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Nunito:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --night: #060412;
  --deep: #0d0720;
  --cream: #fdf8ef;
  --parchment: #f5edd8;
  --ink: #1a0f2e;
  --gold: #c9a84c;
  --gold-light: #e8c96a;
  --spine-dark: #1a0802;
  --spine-mid: #5c2e0e;
  --spine-light: #8b4a14;
  --purple: #7c4dcc;
  --purple-light: #b08fff;
}

body {
  background: var(--night);
  min-height: 100vh;
  font-family: 'Nunito', sans-serif;
  color: white;
  overflow-x: hidden;
}

@keyframes twinkle  { 0%,100%{opacity:0.06;transform:scale(0.6)} 50%{opacity:1;transform:scale(1.4)} }
@keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes fadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn   { from{opacity:0} to{opacity:1} }
@keyframes gradFlow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

/* ── Page flip ── */
@keyframes flipRight {
  0%   { transform: rotateY(0deg); }
  100% { transform: rotateY(-180deg); }
}
@keyframes flipLeft {
  0%   { transform: rotateY(0deg); }
  100% { transform: rotateY(180deg); }
}
@keyframes unflipRight {
  0%   { transform: rotateY(-180deg); opacity: 0; }
  1%   { opacity: 1; }
  100% { transform: rotateY(0deg); opacity: 1; }
}
@keyframes unflipLeft {
  0%   { transform: rotateY(180deg); opacity: 0; }
  1%   { opacity: 1; }
  100% { transform: rotateY(0deg); opacity: 1; }
}

.page-flip-forward { animation: flipRight 0.55s cubic-bezier(0.4,0,0.2,1) forwards; }
.page-flip-back    { animation: flipLeft  0.55s cubic-bezier(0.4,0,0.2,1) forwards; }
.page-enter-forward { animation: unflipRight 0.55s cubic-bezier(0.4,0,0.2,1) forwards; }
.page-enter-back    { animation: unflipLeft  0.55s cubic-bezier(0.4,0,0.2,1) forwards; }

.fade  { animation: fadeUp 0.5s ease both; }
.fadein { animation: fadeIn 0.3s ease both; }
.float { animation: float 4s ease-in-out infinite; }

/* ── Buttons ── */
.btn-p {
  background: linear-gradient(135deg, #5a3a9e, #8b5cf6);
  color: white; border: none; border-radius: 14px;
  padding: 14px 26px; font-size: 16px; font-weight: 600;
  font-family: 'Nunito', sans-serif; cursor: pointer;
  width: 100%; transition: all 0.2s;
  box-shadow: 0 4px 20px rgba(90,58,158,0.35);
}
.btn-p:hover { transform: translateY(-2px); filter: brightness(1.12); box-shadow: 0 8px 28px rgba(90,58,158,0.5); }

.btn-g {
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
  border: 1.5px solid rgba(255,255,255,0.1); border-radius: 14px;
  padding: 12px 20px; font-size: 15px; font-family: 'Nunito', sans-serif;
  cursor: pointer; transition: all 0.18s;
}
.btn-g:hover { background: rgba(255,255,255,0.12); color: white; border-color: rgba(255,255,255,0.2); }

.btn-glow {
  background: linear-gradient(270deg, #c084fc, #818cf8, #67e8f9, #c084fc);
  background-size: 300% 300%; animation: gradFlow 5s ease infinite;
  color: white; border: none; border-radius: 16px;
  padding: 16px 36px; font-size: 17px; font-weight: 700;
  font-family: 'Nunito', sans-serif; cursor: pointer; width: 100%;
  transition: transform 0.2s, filter 0.2s;
  box-shadow: 0 6px 30px rgba(168,85,247,0.4);
}
.btn-glow:hover { transform: translateY(-2px); filter: brightness(1.1); }

.btn-book {
  background: linear-gradient(135deg, var(--spine-dark), var(--spine-mid));
  color: var(--gold-light); border: 1px solid rgba(201,168,76,0.3);
  border-radius: 11px; padding: 11px 22px; font-size: 14px; font-weight: 700;
  font-family: 'Nunito', sans-serif; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 3px 14px rgba(0,0,0,0.4);
}
.btn-book:hover { filter: brightness(1.2); transform: translateY(-1px); }
.btn-book:disabled { opacity: 0.3; cursor: default; transform: none; filter: none; }

/* ── Inputs ── */
input {
  width: 100%; padding: 14px 18px; border-radius: 13px;
  border: 1.5px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: white; font-size: 16px; font-family: 'Nunito', sans-serif;
  outline: none; transition: border-color 0.2s;
}
input:focus { border-color: rgba(139,92,246,0.65); }
input::placeholder { color: rgba(255,255,255,0.2); }

.glass {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 22px; padding: 28px 24px;
  backdrop-filter: blur(12px);
}

.mood-btn {
  padding: 9px 17px; border-radius: 99px;
  border: 1.5px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.55); cursor: pointer;
  font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 500;
  transition: all 0.18s; white-space: nowrap;
}
.mood-btn:hover  { border-color: rgba(180,145,255,0.4); color: white; }
.mood-btn.active { background: rgba(124,77,204,0.25); border-color: rgba(180,145,255,0.65); color: white; }

.prof-tab {
  padding: 7px 16px; border-radius: 99px;
  border: 1.5px solid rgba(255,255,255,0.09);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.5); cursor: pointer;
  font-family: 'Nunito', sans-serif; font-size: 14px;
  transition: all 0.18s;
}
.prof-tab.active { background: rgba(124,77,204,0.22); border-color: rgba(180,145,255,0.55); color: white; }

.skeleton {
  background: linear-gradient(90deg, #e0d5f0 25%, #cbbde8 50%, #e0d5f0 75%);
  background-size: 200% 100%; animation: shimmer 1.6s infinite;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

.err { color: #ff8585; font-size: 13px; margin-top: 4px; }
.lnk { color: var(--purple-light); cursor: pointer; }
.lnk:hover { text-decoration: underline; }
`;

const LBL = { display:"block", color:"rgba(255,255,255,0.35)", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:7 };

// ── Components ───────────────────────────────────────────────────────────────
function StarField() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {STARS.map(s => (
        <div key={s.id} style={{ position:"absolute", left:`${s.x}%`, top:`${s.y}%`, width:s.size, height:s.size, borderRadius:"50%", background:"white", animation:`twinkle ${s.dur}s ${s.delay}s infinite ease-in-out` }} />
      ))}
      <div style={{ position:"absolute", top:"-15%", left:"-10%", width:"60vw", height:"60vh", background:"radial-gradient(ellipse, rgba(80,40,160,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"-15%", right:"-10%", width:"50vw", height:"50vh", background:"radial-gradient(ellipse, rgba(40,60,160,0.1) 0%, transparent 70%)", pointerEvents:"none" }} />
    </div>
  );
}

function MoonLoader({ text = "Weaving your story…" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % MOON_FRAMES.length), 260);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign:"center", padding:"80px 20px" }}>
      <div style={{ fontSize:64, marginBottom:20, animation:"float 3s ease-in-out infinite" }}>{MOON_FRAMES[i]}</div>
      <p style={{ color:"rgba(255,255,255,0.4)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:19 }}>{text}</p>
    </div>
  );
}

// Pre-render loader — shows all images generating with progress
function IllustrationLoader({ total, loaded, title }) {
  const pct = Math.round((loaded / total) * 100);
  return (
    <div style={{ textAlign:"center", padding:"60px 20px", maxWidth:480, margin:"0 auto" }}>
      <div style={{ fontSize:56, marginBottom:24, animation:"float 3s ease-in-out infinite", filter:"drop-shadow(0 0 24px rgba(200,170,80,0.4))" }}>🎨</div>
      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontStyle:"italic", marginBottom:8, color:"var(--gold-light)" }}>
        {title ? `Illustrating "${title}"` : "Painting your story…"}
      </h3>
      <p style={{ color:"rgba(255,255,255,0.4)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:16, marginBottom:32 }}>
        {loaded < total ? `Painting illustration ${loaded + 1} of ${total}…` : "Almost ready…"}
      </p>

      {/* Progress bar */}
      <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:99, height:8, marginBottom:20, overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:99,
          background:"linear-gradient(90deg, #7c4dcc, #c084fc)",
          width:`${pct}%`, transition:"width 0.5s ease",
          boxShadow:"0 0 12px rgba(192,132,252,0.5)",
        }} />
      </div>

      {/* Illustration thumbnails preview */}
      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width:52, height:52, borderRadius:10, overflow:"hidden",
            border:`2px solid ${i < loaded ? "rgba(201,168,76,0.6)" : "rgba(255,255,255,0.1)"}`,
            transition:"all 0.4s",
            background:"rgba(255,255,255,0.04)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {i < loaded
              ? <span style={{ fontSize:20 }}>✦</span>
              : i === loaded
                ? <div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(192,132,252,0.6)", borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }} />
                : <span style={{ color:"rgba(255,255,255,0.15)", fontSize:18 }}>○</span>
            }
          </div>
        ))}
      </div>

      <p style={{ color:"rgba(255,255,255,0.2)", fontSize:13, marginTop:28, fontFamily:"'Nunito',sans-serif" }}>
        This takes about 30–60 seconds ☕
      </p>
    </div>
  );
}

// ── Open Book ─────────────────────────────────────────────────────────────────
function OpenBook({ pages, imgs, spread, onFlip, title, mobile = false, coverImg = null }) {
  const totalSpreads = Math.ceil(pages.length / 2);
  const [animating, setAnimating] = useState(false);
  const [displaySpread, setDisplaySpread] = useState(spread);
  const [flipClass, setFlipClass] = useState("");
  const [enterClass, setEnterClass] = useState("");
  const prevSpread = useRef(spread);

  useEffect(() => {
    if (spread === displaySpread) return;
    const forward = spread > prevSpread.current;
    prevSpread.current = spread;

    setAnimating(true);
    setFlipClass(forward ? "page-flip-forward" : "page-flip-back");
    setEnterClass("");

    setTimeout(() => {
      setDisplaySpread(spread);
      setFlipClass("");
      setEnterClass(forward ? "page-enter-forward" : "page-enter-back");
      setAnimating(false);
    }, 560);
  }, [spread]);

  const li = displaySpread * 2;
  const ri = displaySpread * 2 + 1;

  const Page = ({ idx, side }) => {
    const text = pages[idx];
    const img  = imgs[idx];
    if (!text) return (
      <div style={{
        flex:1, position:"relative", overflow:"hidden",
        background:"linear-gradient(160deg, #180a38, #0e0520)",
      }}>
        {/* If we have a coverImg, show it; otherwise show the dark decorated cover */}
        {coverImg ? (
          <>
            <img src={coverImg} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", position:"absolute", inset:0 }} />
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(10,5,30,0.25) 0%, rgba(10,5,30,0.55) 100%)" }} />
            {side === "left" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", padding:"0 20px 28px" }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(13px,2vw,22px)", color:"white", textAlign:"center", lineHeight:1.4, fontStyle:"italic", textShadow:"0 2px 12px rgba(0,0,0,0.8)" }}>
                  {title || "A Bedtime Story"}
                </h3>
                <div style={{ width:50, height:1.5, background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)", margin:"10px auto 0" }} />
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 40% 30%, rgba(160,120,255,0.08) 0%, transparent 60%)" }} />
            {side === "left" && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <div style={{ fontSize:48, marginBottom:16, filter:"drop-shadow(0 0 20px rgba(200,170,80,0.4))" }}>🌙</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(13px,2vw,20px)", color:"var(--gold-light)", textAlign:"center", padding:"0 20px", lineHeight:1.4, fontStyle:"italic" }}>
                  {title || "A Bedtime Story"}
                </h3>
                <div style={{ width:50, height:1.5, background:"linear-gradient(90deg,transparent,var(--gold),transparent)", margin:"14px auto 0" }} />
              </div>
            )}
          </>
        )}
      </div>
    );

    return (
      <div style={{
        flex:1, display:"flex", flexDirection:"column",
        background:"linear-gradient(175deg, #fefcf7 0%, #fdf9f0 60%, #f9f1e0 100%)",
        position:"relative", overflow:"hidden",
      }}>
        {/* Illustration — taller, more dominant */}
        <div style={{ width:"100%", flex:"0 0 62%", position:"relative", overflow:"hidden" }}>
          {img ? (
            <img src={img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          ) : (
            <div className="skeleton" style={{ width:"100%", height:"100%" }} />
          )}
          {/* Soft gradient blending illustration into text */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:40, background:"linear-gradient(to bottom, transparent, rgba(253,249,240,0.9))" }} />
          {/* Page number */}
          <div style={{
            position:"absolute", bottom:10,
            [side==="left"?"right":"left"]: 12,
            background:"rgba(255,255,255,0.88)", backdropFilter:"blur(4px)",
            borderRadius:99, padding:"2px 10px",
            color:"var(--ink)", fontSize:11, fontFamily:"'Nunito',sans-serif", fontWeight:700,
          }}>{idx + 1}</div>
        </div>

        {/* Story text */}
        <div style={{ flex:1, padding:"14px 20px 16px", display:"flex", alignItems:"center" }}>
          <p style={{
            fontFamily:"'Crimson Pro', serif",
            fontSize:"clamp(14px, 1.6vw, 19px)",
            lineHeight:1.95, color:"var(--ink)",
            textAlign:"center",
            width:"100%",
          }}>{text}</p>
        </div>

        {/* Decorative elements */}
        <div style={{ position:"absolute", bottom:8, [side==="left"?"right":"left"]:14, color:"var(--gold)", fontSize:13, opacity:0.45 }}>✦</div>
        {side === "right" && (
          <div style={{ position:"absolute", bottom:0, right:0, width:30, height:30, background:"linear-gradient(225deg, #e8d8b0 45%, transparent 50%)" }} />
        )}
        {/* Spine shadow */}
        {side === "left"  && <div style={{ position:"absolute", top:0, right:0, bottom:0, width:18, background:"linear-gradient(to right, transparent, rgba(0,0,0,0.06))", pointerEvents:"none" }} />}
        {side === "right" && <div style={{ position:"absolute", top:0, left:0, bottom:0, width:18, background:"linear-gradient(to left, transparent, rgba(0,0,0,0.05))", pointerEvents:"none" }} />}
      </div>
    );
  };

  // Mobile: single page view
  const mobilePage = spread; // on mobile spread = page index directly
  const totalMobilePages = pages.length;

  if (mobile) {
    return (
      <div style={{ width:"100%", maxWidth:500, margin:"0 auto" }}>
        {title && (
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontStyle:"italic", color:"var(--gold-light)" }}>{title}</h2>
          </div>
        )}
        {/* Single page */}
        <div style={{
          borderRadius:16, overflow:"hidden",
          boxShadow:"0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          <div style={{ display:"flex", minHeight:0 }}>
            <Page idx={mobilePage} side="right" />
          </div>
        </div>
        {/* Mobile nav */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16, gap:12 }}>
          <button className="btn-book" disabled={mobilePage===0||animating} onClick={() => onFlip("back")} style={{ flex:1 }}>← Prev</button>
          <span style={{ color:"rgba(255,255,255,0.3)", fontSize:13, fontFamily:"'Nunito',sans-serif", whiteSpace:"nowrap" }}>
            {mobilePage+1} / {totalMobilePages}
          </span>
          <button className="btn-book" disabled={mobilePage>=totalMobilePages-1||animating} onClick={() => onFlip("forward")} style={{ flex:1 }}>Next →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width:"100%", maxWidth:1160, margin:"0 auto" }}>
      {/* Title */}
      {title && (
        <div style={{ textAlign:"center", marginBottom:14 }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(15px,2.4vw,24px)", fontStyle:"italic", color:"var(--gold-light)", textShadow:"0 2px 20px rgba(200,170,80,0.3)" }}>
            {title}
          </h2>
        </div>
      )}

      {/* The book */}
      <div style={{ perspective:"2400px", perspectiveOrigin:"50% 44%" }}>
        <div style={{
          display:"flex", position:"relative",
          borderRadius:16, overflow:"hidden",
          boxShadow:"0 80px 160px rgba(0,0,0,0.85), 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          {/* Left page */}
          <div className={flipClass && "page-flip-back" === flipClass ? flipClass : (!flipClass && enterClass === "page-enter-back" ? enterClass : "")}
            style={{
              flex:1, display:"flex", position:"relative", overflow:"hidden",
              transformOrigin:"right center", transformStyle:"preserve-3d",
              borderRadius:"14px 0 0 14px", minHeight:0,
              boxShadow:"inset -6px 0 16px rgba(0,0,0,0.18)",
            }}>
            <Page idx={li} side="left" />
          </div>

          {/* Spine */}
          <div style={{
            width:28, flexShrink:0, zIndex:10,
            background:"linear-gradient(90deg, #100500, var(--spine-mid) 30%, var(--spine-light) 50%, var(--spine-mid) 70%, #100500)",
            boxShadow:"0 0 24px rgba(0,0,0,0.9)", position:"relative",
          }}>
            <div style={{ position:"absolute", top:0, bottom:0, left:"50%", width:1, background:"linear-gradient(180deg, transparent 5%, rgba(201,168,76,0.3) 50%, transparent 95%)" }} />
          </div>

          {/* Right page */}
          <div className={flipClass === "page-flip-forward" ? flipClass : (enterClass === "page-enter-forward" ? enterClass : "")}
            style={{
              flex:1, display:"flex", position:"relative", overflow:"hidden",
              transformOrigin:"left center", transformStyle:"preserve-3d",
              borderRadius:"0 14px 14px 0",
              boxShadow:"inset 6px 0 16px rgba(0,0,0,0.14)",
            }}>
            <Page idx={ri} side="right" />
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginTop:20 }}>
        <button className="btn-book" disabled={spread===0||animating} onClick={() => onFlip("back")}>← Prev</button>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {Array.from({ length: totalSpreads }).map((_, i) => (
            <div key={i} onClick={() => !animating && onFlip(i)} style={{
              width: i===spread ? 22 : 7, height:7, borderRadius:99,
              cursor: animating ? "default" : "pointer",
              background: i===spread ? "var(--gold)" : "rgba(255,255,255,0.18)",
              transition:"all 0.3s",
              boxShadow: i===spread ? "0 0 10px rgba(201,168,76,0.6)" : "none",
            }} />
          ))}
        </div>
        <button className="btn-book" disabled={spread>=totalSpreads-1||animating} onClick={() => onFlip("forward")}>Next →</button>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [user, setUser]     = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [active, setActive] = useState(null);
  const [sub, setSub]       = useState(null);
  const [streak, setStreak] = useState(0);

  // Story state
  const [story, setStory]   = useState(null);
  const [title, setTitle]   = useState("");
  const [pages, setPages]   = useState([]);
  const [imgs, setImgs]     = useState([]);
  const [spread, setSpread] = useState(0);
  const [imgsLoaded, setImgsLoaded] = useState(0);
  const [storyPhase, setStoryPhase] = useState("idle"); // idle | text | reading | ready
  const [extending, setExtending] = useState(false); // continue/happy ending in progress
  const [mobile, setMobile] = useState(isMobile());
  const [coverImg, setCoverImg] = useState(null); // AI-generated cover illustration

  // UI
  const [mood, setMood]     = useState("magical");
  const [storyMode, setStoryMode] = useState("adventure"); // "adventure" | "lesson"
  const [lesson, setLesson] = useState("kindness");
  const [wizStep, setWizStep] = useState(0);
  const [library, setLibrary] = useState([]);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [err, setErr]       = useState("");

  // Demo book
  const [demoSpread, setDemoSpread] = useState(0);
  const [demoImgs, setDemoImgs] = useState([null,null,null,null]);
  const demoGenRef = useRef(false);

  // Shared story
  const [shared, setShared] = useState(null);

  // Forms
  const [af, setAf] = useState({ email:"", password:"", name:"" });
  const [pf, setPf] = useState({ child_name:"", age:"", stuffed_animal:"", best_friend:"", favorite_animal:"", scared_of:"", favorite_thing:"" });
  const [editId, setEditId] = useState(null);

  // ── Boot ──
  useEffect(() => {
    const sharedId = getSharedId();
    if (sharedId) { loadShared(sharedId); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadData(session.user); }
      else setTimeout(() => setScreen("landing"), 700);
    });
    const { data: { subscription: as } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) { setUser(session.user); loadData(session.user); }
    });
    return () => as.unsubscribe();
  }, []);

  // Mobile resize
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 700);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Demo auto-advance
  useEffect(() => {
    if (screen !== "landing") return;
    const t = setInterval(() => setDemoSpread(p => (p + 1) % 2), 5000);
    return () => clearInterval(t);
  }, [screen]);

  // Generate demo illustrations once (same Replicate API = same style as real stories)
  useEffect(() => {
    if (screen !== "landing" || demoGenRef.current) return;
    demoGenRef.current = true;
    // Generate in order so they appear sequentially
    (async () => {
      for (let i = 0; i < DEMO_STORY.length; i++) {
        const url = await generateImage(DEMO_STORY[i].prompt);
        if (url) setDemoImgs(prev => { const n=[...prev]; n[i]=url; return n; });
      }
    })();
  }, [screen]);



  const loadShared = async (id) => {
    setScreen("shared");
    const { data } = await supabase.from("stories").select("*").eq("id", id).single();
    if (data) setShared(data); else setScreen("landing");
  };

  const loadData = async (u) => {
    const [{ data: profs }, { data: s }] = await Promise.all([
      supabase.from("child_profiles").select("*").eq("user_id", u.id).order("created_at"),
      supabase.from("subscriptions").select("*").eq("user_id", u.id).maybeSingle(),
    ]);
    if (profs?.length) { setProfiles(profs); setActive(profs[0]); }
    if (s) { setSub(s); }
    else {
      const { data: ns } = await supabase.from("subscriptions")
        .insert({ user_id: u.id, status: "trial", trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString() })
        .select().single();
      if (ns) setSub(ns);
    }
    await calcStreak(u.id);
    setScreen(profs?.length ? "home" : "wizard");
  };

  const calcStreak = async (uid) => {
    const { data } = await supabase.from("stories").select("story_date").eq("user_id", uid).order("story_date", { ascending: false });
    if (!data?.length) return;
    let n = 0, check = new Date(); check.setHours(0,0,0,0);
    for (const s of data) {
      const d = new Date(s.story_date + "T00:00:00"); d.setHours(0,0,0,0);
      if ((check - d) / 86400000 <= 1) { n++; check = d; } else break;
    }
    setStreak(n);
  };

  const hasAccess = () => {
    if (!sub) return false;
    if (sub.status === "active") return true;
    if (sub.status === "trial" && new Date(sub.trial_ends_at) > new Date()) return true;
    return false;
  };
  const daysLeft = () => sub ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / 86400000)) : 0;

  // ── Auth ──
  const signup = async () => {
    setErr("");
    if (!af.email || !af.password || !af.name) return setErr("All fields required.");
    const { error: e } = await supabase.auth.signUp({ email: af.email, password: af.password, options: { data: { name: af.name } } });
    if (e) setErr(e.message);
  };
  const login = async () => {
    setErr("");
    if (!af.email || !af.password) return setErr("Email and password required.");
    const { error: e } = await supabase.auth.signInWithPassword({ email: af.email, password: af.password });
    if (e) setErr(e.message);
  };
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfiles([]); setActive(null); setStory(null); setSub(null);
    setScreen("landing");
  };

  // ── Wizard ──
  const wizNext = () => {
    if (wizStep < WIZARD_STEPS.length - 1) setWizStep(wizStep + 1);
    else saveProfile();
  };
  const saveProfile = async () => {
    setErr("");
    if (!pf.child_name) return setErr("Child's name is required.");
    const payload = { ...pf, user_id: user.id, age: parseInt(pf.age) || 5 };
    if (editId) {
      const { data: u } = await supabase.from("child_profiles").update(payload).eq("id", editId).select().single();
      if (u) { setProfiles(profiles.map(p => p.id === editId ? u : p)); if (active?.id === editId) setActive(u); }
    } else {
      const { data: c, error: e } = await supabase.from("child_profiles").insert(payload).select().single();
      if (e) { setErr(e.message); return; }
      if (c) { setProfiles([...profiles, c]); setActive(c); }
    }
    setEditId(null); setWizStep(0); setScreen("home");
  };

  const profileText = (p) =>
    `Child: ${p.child_name}, Age: ${p.age || 5}, Stuffed animal: ${p.stuffed_animal || "a stuffed bear"}, Best friend: ${p.best_friend || "a friend"}, Favorite animal: ${p.favorite_animal || "dogs"}, Scared of: ${p.scared_of || "the dark"}, Favorite thing: ${p.favorite_thing || "playing"}.`;

  // ── Story generation ──
  const handleFlip = (dir) => {
    if (mobile) {
      // Mobile: spread = page index
      if (dir === "forward" && spread < pages.length - 1) setSpread(s => s + 1);
      else if (dir === "back" && spread > 0) setSpread(s => s - 1);
      else if (typeof dir === "number") setSpread(dir);
    } else {
      const totalSpreads = Math.ceil(pages.length / 2);
      if (dir === "forward" && spread < totalSpreads - 1) setSpread(s => s + 1);
      else if (dir === "back" && spread > 0) setSpread(s => s - 1);
      else if (typeof dir === "number") setSpread(dir);
    }
  };

  const imgPromptFor = (pt, m) =>
    `${active.child_name} age ${active.age||5} with ${active.stuffed_animal||"stuffed bear"}, ${m.prompt} bedtime children's book watercolor illustration, soft pastel colors, dreamy storybook art, consistent character design: ${pt.slice(0,110)}. No text.`;

  const generateStory = async () => {
    if (!hasAccess()) return setScreen("paywall");
    if (!active) return;

    setScreen("story");
    setStoryPhase("text");
    setStory(null); setTitle(""); setPages([]); setImgs([]); setSpread(0); setImgsLoaded(0); setCoverImg(null);

    // Existing today's story
    const { data: ex } = await supabase.from("stories").select("*")
      .eq("user_id", user.id).eq("story_date", todayStr()).eq("child_profile_id", active.id).maybeSingle();

    if (ex) {
      const ps = ex.text.split("\n\n✦\n\n");
      const existingImgs = ex.page_images || [];
      setTitle(ex.title||""); setStory(ex); setPages(ps);
      setCoverImg(ex.cover_image || null);
      if (existingImgs.length === ps.length && existingImgs.every(Boolean)) {
        setImgs(existingImgs); setImgsLoaded(ps.length); setStoryPhase("ready");
      } else {
        const filled = [...existingImgs];
        let loaded = existingImgs.filter(Boolean).length;
        setImgsLoaded(loaded);
        // Show book once first 2 pages have images
        const m = MOODS.find(x => x.id === mood) || MOODS[0];
        // Generate missing images in order
        for (let i = 0; i < ps.length; i++) {
          if (filled[i]) { if (i === 1) setStoryPhase("ready"); continue; }
          const url = await generateImage(imgPromptFor(ps[i], m));
          if (url) {
            const cached = ex.id ? await cacheImage(url, ex.id, i) : url;
            filled[i] = cached; loaded++;
            setImgsLoaded(loaded);
            setImgs(prev => { const n=[...prev]; n[i]=cached; return n; });
          }
          if (i === 1) setStoryPhase("ready");
        }
        if (loaded <= 1) setStoryPhase("ready");
        await supabase.from("stories").update({ page_images: filled }).eq("id", ex.id);
      }
      return;
    }

    const m = MOODS.find(x => x.id === mood) || MOODS[0];
    const lessonData = LESSONS.find(l => l.id === lesson);
    const isLesson = storyMode === "lesson";

    const storyPrompt = isLesson
      ? `Write a warm personalized bedtime picture book that gently teaches a lesson for:
${profileText(active)}
Tone: ${m.prompt}.
Lesson to teach: ${lessonData?.prompt || "being kind to others"}.

Write EXACTLY ${STORY_PAGES} pages, separated by [PAGE].
Each page = 1-2 SHORT sentences. Pure picture book style — brief, lyrical, beautiful.
Page 1: introduce child and stuffed animal in a cozy relatable situation that sets up the lesson.
Pages 2-4: adventure begins, a challenge appears that relates to the lesson. Weave in best friend and favorite animal.
Pages 5-7: the heart of the story — child faces the lesson challenge. Show the struggle gently. Let it feel real.
Pages 8-9: child discovers the lesson naturally through the story, feels proud and changed.
Page 10: child drifts peacefully to sleep, carrying the lesson in their heart.
The lesson should feel discovered, never lectured. NO title. Start immediately.`
      : `Write a warm personalized bedtime picture book for:
${profileText(active)}
Tone: ${m.prompt}.
Write EXACTLY ${STORY_PAGES} pages, separated by [PAGE].
Each page = 1-2 SHORT sentences. Pure picture book style — brief, lyrical, beautiful.
Page 1: introduce child and stuffed animal in a cozy setting.
Pages 2-4: adventure begins, weave in best friend and favorite animal.
Pages 5-7: heart of story, gently face their fear.
Pages 8-9: resolution, magic and wonder.
Page 10: child drifts peacefully to sleep.
NO title. Start immediately.`;

    try {
      const [rawText, rawTitle] = await Promise.all([
        callClaude([{ role:"user", content:storyPrompt }], 900),
        callClaude([{ role:"user", content: isLesson
          ? `Magical 4-6 word bedtime story title for ${active.child_name} about ${lessonData?.label||"kindness"}. Only the title, nothing else.`
          : `Magical 4-6 word bedtime story title for ${active.child_name} and ${active.stuffed_animal||"a stuffed bear"}. Only the title, nothing else.`
        }], 30),
      ]);

      const ps = rawText.split("[PAGE]").map(p => p.trim()).filter(p => p.length > 5).slice(0, STORY_PAGES);
      const fullText = ps.join("\n\n✦\n\n");
      const storyTitle = rawTitle.trim();
      setTitle(storyTitle); setPages(ps);

      const { data: saved } = await supabase.from("stories").insert({
        user_id: user.id, story_date: todayStr(), text: fullText, title: storyTitle,
        child_profile_id: active.id, page_images: [], cover_image: null,
        lesson_type: isLesson ? lesson : null,
        history: [{ role:"user", content:storyPrompt }, { role:"assistant", content:rawText }],
      }).select().single();
      setStory(saved);

      // Generate cover illustration in background (same style as pages)
      const coverPrompt = `${active.child_name} age ${active.age||5} with ${active.stuffed_animal||"stuffed bear"}, ${m.prompt} bedtime children's book COVER illustration, dramatic and beautiful, soft watercolor pastel art, dreamy storybook style, bold composition, the title scene. No text.`;
      generateImage(coverPrompt).then(async url => {
        if (!url) return;
        const cached = saved?.id ? await cacheImage(url, saved.id, "cover") : url;
        setCoverImg(cached);
        if (saved?.id) supabase.from("stories").update({ cover_image: cached }).eq("id", saved.id);
      });

      // Illustrate pages in order — show book after first 2, continue in background
      const generated = new Array(ps.length).fill(null);
      let loaded = 0;

      // Sequential generation so pages always appear in order 1→2→3…
      const genAllInOrder = async () => {
        for (let i = 0; i < ps.length; i++) {
          const url = await generateImage(imgPromptFor(ps[i], m));
          if (url) {
            const cached = saved?.id ? await cacheImage(url, saved.id, i) : url;
            generated[i] = cached;
            loaded++;
            setImgsLoaded(loaded);
            setImgs(prev => { const n=[...prev]; n[i]=cached; return n; });
          }
          // Reveal book once first spread (pages 0+1) is ready
          if (i === 1) setStoryPhase("ready");
        }
        if (loaded <= 1) setStoryPhase("ready"); // fallback if page 1 failed
      };

      await genAllInOrder();
      if (saved?.id) await supabase.from("stories").update({ page_images: generated }).eq("id", saved.id);
      await calcStreak(user.id);

    } catch(e) {
      console.error(e);
      setPages(["The story stars are cloudy tonight. Please try again!"]);
      setStoryPhase("ready");
    }
  };

  // Continue story — add 4 more pages
  const continueStory = async () => {
    if (extending) return;
    setExtending(true);
    const m = MOODS.find(x => x.id === mood) || MOODS[0];
    const hist = story?.history || [
      { role:"user", content:`Write bedtime story for: ${profileText(active)}` },
      { role:"assistant", content:pages.join("\n\n") },
    ];
    try {
      const raw = await callClaude([
        ...hist,
        { role:"user", content:`Continue this bedtime story with 4 more short picture book pages, separated by [PAGE]. Each page = 1-2 sentences. Same warm tone and characters. Don't end the story yet — build more adventure.` }
      ], 500);
      const newPages = raw.split("[PAGE]").map(p => p.trim()).filter(p => p.length > 5).slice(0, 4);
      const allPages = [...pages, ...newPages];
      const fullText = allPages.join("\n\n✦\n\n");
      setPages(allPages);
      setSpread(Math.floor((pages.length) / 2)); // jump to first new spread

      // Save updated text
      if (story?.id) await supabase.from("stories").update({ text: fullText }).eq("id", story.id);

      // Illustrate new pages in background
      const startIdx = pages.length;
      await Promise.all(newPages.map(async (pt, j) => {
        const i = startIdx + j;
        const url = await generateImage(imgPromptFor(pt, m));
        if (!url) return;
        const cached = story?.id ? await cacheImage(url, story.id, i) : url;
        setImgs(prev => { const n=[...prev]; n[i]=cached; return n; });
        // Save updated images
        setImgs(prev => {
          supabase.from("stories").update({ page_images: prev }).eq("id", story.id);
          return prev;
        });
      }));
    } catch(e) { console.error(e); }
    setExtending(false);
  };

  // Happy ending — wrap the story up in 2 warm final pages
  const happyEnding = async () => {
    if (extending) return;
    setExtending(true);
    const m = MOODS.find(x => x.id === mood) || MOODS[0];
    const hist = story?.history || [
      { role:"user", content:`Write bedtime story for: ${profileText(active)}` },
      { role:"assistant", content:pages.join("\n\n") },
    ];
    try {
      const raw = await callClaude([
        ...hist,
        { role:"user", content:`Write a beautiful, warm happy ending for this story in exactly 2 short pages, separated by [PAGE]. Each page = 1-2 sentences. Make it feel magical, safe, and complete. End with the child drifting happily to sleep.` }
      ], 250);
      const endPages = raw.split("[PAGE]").map(p => p.trim()).filter(p => p.length > 5).slice(0, 2);
      const allPages = [...pages, ...endPages];
      const fullText = allPages.join("\n\n✦\n\n");
      setPages(allPages);
      setSpread(Math.floor((pages.length) / 2));

      if (story?.id) await supabase.from("stories").update({ text: fullText }).eq("id", story.id);

      const startIdx = pages.length;
      await Promise.all(endPages.map(async (pt, j) => {
        const i = startIdx + j;
        const url = await generateImage(imgPromptFor(pt, m));
        if (!url) return;
        const cached = story?.id ? await cacheImage(url, story.id, i) : url;
        setImgs(prev => { const n=[...prev]; n[i]=cached; return n; });
        setImgs(prev => {
          supabase.from("stories").update({ page_images: prev }).eq("id", story.id);
          return prev;
        });
      }));
    } catch(e) { console.error(e); }
    setExtending(false);
  };

  const readAloud = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const li = spread * 2, ri = spread * 2 + 1;
    const text = [pages[li], pages[ri]].filter(Boolean).join(". ");
    if (!text) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.8; utt.pitch = 1.05;
    const v = window.speechSynthesis.getVoices().find(v => v.name.includes("Samantha") || v.lang?.startsWith("en"));
    if (v) utt.voice = v;
    utt.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  };

  const shareStory = async () => {
    try { await navigator.clipboard.writeText(`${APP_URL}?story=${story?.id}`); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const loadLibrary = async () => {
    if (!active) return;
    const { data } = await supabase.from("stories").select("*")
      .eq("user_id", user.id).eq("child_profile_id", active.id)
      .order("story_date", { ascending: false });
    setLibrary(data || []);
  };

  // ── Layout helpers ──
  const W = { maxWidth:500, width:"100%", padding:"0 4px" };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <StarField />
      <div style={{ minHeight:"100vh", position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 12px 60px" }}>

        {/* SPLASH */}
        {screen === "splash" && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"80vh" }}>
            <div style={{ fontSize:72, animation:"float 3s ease-in-out infinite", filter:"drop-shadow(0 0 30px rgba(200,170,80,0.4))" }}>🌙</div>
          </div>
        )}

        {/* LANDING */}
        {screen === "landing" && (
          <div className="fade" style={{ maxWidth:740, width:"100%" }}>

            {/* Hero */}
            <div style={{ textAlign:"center", paddingTop:16, marginBottom:52 }}>
              <div style={{ fontSize:70, marginBottom:22, animation:"float 4s ease-in-out infinite", filter:"drop-shadow(0 0 32px rgba(200,170,80,0.45))" }}>🌙</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(36px,7vw,58px)", lineHeight:1.08, marginBottom:20 }}>
                Bedtime stories<br />
                <em style={{ background:"linear-gradient(90deg,#c084fc,#818cf8,#67e8f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                  written for your child
                </em>
              </h1>
              <p style={{ color:"rgba(255,255,255,0.42)", fontSize:19, lineHeight:1.8, fontFamily:"'Crimson Pro',serif", fontStyle:"italic", maxWidth:440, margin:"0 auto 38px" }}>
                Every night, a 10-page personalized picture book — with beautiful AI watercolor illustrations and a story starring your child.
              </p>
              <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
                <button className="btn-glow" style={{ width:"auto", padding:"16px 38px", fontSize:17 }} onClick={() => setScreen("signup")}>
                  Start free — 7 nights free ✨
                </button>
                <button className="btn-g" onClick={() => setScreen("login")}>Sign in</button>
              </div>
            </div>

            {/* Demo book */}
            <div style={{ marginBottom:52 }}>
              <p style={{ textAlign:"center", color:"rgba(255,255,255,0.22)", fontSize:11, letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:18 }}>
  "Sample story — Lily's Moonlit Adventure"
              </p>

              {/* Book wrapper */}
              <div style={{ perspective:"1800px" }}>
                <div style={{
                  display:"flex", maxWidth:900, margin:"0 auto",
                  borderRadius:14, overflow:"hidden",
                  boxShadow:"0 60px 120px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.5)",
                }}>
                  {/* Spine */}
                  <div style={{ width:22, flexShrink:0, background:"linear-gradient(90deg,#100500,#5c2e0e 40%,#8b4513 50%,#5c2e0e 60%,#100500)" }} />

                  {/* Demo pages - preset images, no loading needed */}
                  {[0,1].map(side => {
                    const idx = demoSpread * 2 + side;
                    const page = DEMO_STORY[idx];
                    return (
                      <div key={side} style={{
                        flex:1,
                        background:"linear-gradient(175deg, #fefcf7, #fdf8ef)",
                        borderLeft: side===1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                        display:"flex", flexDirection:"column",
                        position:"relative",
                      }}>
                        <div style={{ width:"100%", aspectRatio:"4/3", position:"relative", overflow:"hidden", background:page?.fallback||"linear-gradient(135deg,#1a0d3e,#3d1d7e)" }}>
                          {demoImgs[idx] ? (
                            <img
                              src={demoImgs[idx]} alt=""
                              style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                            />
                          ) : (
                            <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                              <div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"transparent", animation:"spin 0.9s linear infinite" }} />
                              <span style={{ color:"rgba(255,255,255,0.35)", fontSize:11, fontFamily:"'Nunito',sans-serif" }}>Painting…</span>
                            </div>
                          )}
                          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:32, background:`linear-gradient(to bottom,transparent,${side===0?"rgba(253,252,247,0.9)":"rgba(253,248,239,0.9)"})` }} />
                          <div style={{
                            position:"absolute", bottom:8, [side===0?"right":"left"]:10,
                            background:"rgba(255,255,255,0.88)", borderRadius:99, padding:"2px 9px",
                            fontSize:11, color:"var(--ink)", fontWeight:700, fontFamily:"'Nunito',sans-serif",
                          }}>{idx+1}</div>
                        </div>
                        <div style={{ flex:1, padding:"14px 18px 18px", display:"flex", alignItems:"center" }}>
                          <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(13px,1.6vw,16px)", lineHeight:1.9, color:"var(--ink)", textAlign:"center", width:"100%" }}>
                            {page?.text}
                          </p>
                        </div>
                        {side===1 && <div style={{ position:"absolute", bottom:0, right:0, width:26, height:26, background:"linear-gradient(225deg,#e8d8b0 45%,transparent 50%)" }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Spread dots */}
              <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:14 }}>
                {[0,1].map(i => (
                  <div key={i} onClick={() => setDemoSpread(i)} style={{
                    width: i===demoSpread ? 20 : 8, height:8, borderRadius:99,
                    background: i===demoSpread ? "var(--gold)" : "rgba(255,255,255,0.2)",
                    cursor:"pointer", transition:"all 0.3s",
                    boxShadow: i===demoSpread ? "0 0 8px rgba(201,168,76,0.5)" : "none",
                  }} />
                ))}
              </div>
            </div>

            {/* ── Life Lessons Feature Highlight ── */}
            <div style={{ marginBottom:52 }}>
              <div className="glass" style={{
                padding:"36px 32px",
                background:"linear-gradient(135deg, rgba(30,80,50,0.25), rgba(20,60,40,0.15))",
                border:"1px solid rgba(80,200,120,0.2)",
                borderRadius:22,
              }}>
                <div style={{ display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ flex:"1 1 280px" }}>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(80,200,120,0.12)", border:"1px solid rgba(80,200,120,0.25)", borderRadius:99, padding:"5px 14px", marginBottom:16 }}>
                      <span style={{ fontSize:13 }}>✨</span>
                      <span style={{ color:"#6ee7a0", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>New Feature</span>
                    </div>
                    <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(20px,3vw,28px)", fontStyle:"italic", marginBottom:12, lineHeight:1.3 }}>
                      Stories that teach life lessons
                    </h3>
                    <p style={{ color:"rgba(255,255,255,0.5)", fontSize:16, lineHeight:1.75, fontFamily:"'Crimson Pro',serif", marginBottom:20 }}>
                      Choose a value — kindness, bravery, honesty, patience — and DreamWeaver weaves it naturally into a beautiful bedtime story. Your child discovers the lesson through adventure, never through lectures.
                    </p>
                    <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                      {["🤝 Sharing","💛 Kindness","🦁 Bravery","🌟 Honesty","💪 Keep Trying","🌈 Big Feelings","👫 Friendship","🙏 Gratitude"].map(l => (
                        <span key={l} style={{ background:"rgba(80,200,120,0.1)", border:"1px solid rgba(80,200,120,0.2)", borderRadius:99, padding:"4px 11px", fontSize:12, color:"rgba(255,255,255,0.6)" }}>{l}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex:"0 0 auto", textAlign:"center" }}>
                    <div style={{ fontSize:72, filter:"drop-shadow(0 0 24px rgba(100,220,150,0.4))", animation:"float 4s ease-in-out infinite" }}>📖</div>
                    <p style={{ color:"rgba(100,220,150,0.7)", fontSize:13, marginTop:12, fontWeight:600 }}>10 illustrated pages</p>
                    <p style={{ color:"rgba(255,255,255,0.3)", fontSize:12, marginTop:4 }}>personalized to your child</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:12, marginBottom:52 }}>
              {[
                { e:"🎨", t:"AI Illustrations",   d:"Watercolor art on every page" },
                { e:"📖", t:"10 Pages Long",       d:"A real picture book every night" },
                { e:"🧸", t:"Fully Personalized",  d:"Their stuffed animal, friends & fears" },
                { e:"✨", t:"Life Lessons",        d:"Teaches values through adventure" },
                { e:"🔊", t:"Read Aloud",          d:"Beautiful bedtime voice narrator" },
                { e:"📚", t:"Story Library",       d:"Every story saved forever" },
              ].map(f => (
                <div key={f.t} className="glass" style={{ padding:"18px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:26, marginBottom:9 }}>{f.e}</div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:5 }}>{f.t}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.38)", lineHeight:1.55 }}>{f.d}</div>
                </div>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="glass" style={{ textAlign:"center", padding:"38px 28px" }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontStyle:"italic", marginBottom:10 }}>Start your story tonight</h3>
              <p style={{ color:"rgba(255,255,255,0.38)", marginBottom:24, fontFamily:"'Crimson Pro',serif", fontSize:17 }}>7 nights free · $4.99/month · cancel anytime</p>
              <button className="btn-glow" style={{ maxWidth:320, margin:"0 auto", display:"block" }} onClick={() => setScreen("signup")}>Create Free Account ✨</button>
            </div>
          </div>
        )}

        {/* LOGIN */}
        {screen === "login" && (
          <div className="fade" style={W}>
            <div style={{ textAlign:"center", marginBottom:30 }}>
              <div style={{ fontSize:52, marginBottom:14, animation:"float 4s ease-in-out infinite" }}>🌙</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:34 }}>DreamWeaver</h1>
              <p style={{ color:"rgba(255,255,255,0.3)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", marginTop:6, fontSize:17 }}>Bedtime stories, reimagined</p>
            </div>
            <div className="glass" style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22 }}>Welcome back</h2>
              {err && <p className="err">{err}</p>}
              {[{k:"email",l:"Email",t:"email",ph:"you@example.com"},{k:"password",l:"Password",t:"password",ph:"••••••••"}].map(f => (
                <div key={f.k}><label style={LBL}>{f.l}</label><input type={f.t} placeholder={f.ph} value={af[f.k]} onChange={e => setAf({...af,[f.k]:e.target.value})} onKeyDown={e => e.key==="Enter"&&login()} /></div>
              ))}
              <button className="btn-p" onClick={login}>Sign In</button>
              <p style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:14 }}>No account? <span className="lnk" onClick={() => {setErr("");setScreen("signup");}}>Start free trial</span></p>
            </div>
          </div>
        )}

        {/* SIGNUP */}
        {screen === "signup" && (
          <div className="fade" style={W}>
            <div style={{ textAlign:"center", marginBottom:30 }}>
              <div style={{ fontSize:52, marginBottom:14, animation:"float 4s ease-in-out infinite" }}>🌙</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:34 }}>DreamWeaver</h1>
            </div>
            <div className="glass" style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22 }}>Start your free trial</h2>
                <p style={{ color:"rgba(255,255,255,0.3)", fontSize:13, marginTop:5 }}>7 nights free · $4.99/mo · cancel anytime</p>
              </div>
              {err && <p className="err">{err}</p>}
              {[{k:"name",l:"Your Name",t:"text",ph:"Parent's name"},{k:"email",l:"Email",t:"email",ph:"you@example.com"},{k:"password",l:"Password",t:"password",ph:"Create a password"}].map(f => (
                <div key={f.k}><label style={LBL}>{f.l}</label><input type={f.t} placeholder={f.ph} value={af[f.k]} onChange={e => setAf({...af,[f.k]:e.target.value})} onKeyDown={e => e.key==="Enter"&&signup()} /></div>
              ))}
              <button className="btn-p" onClick={signup}>Create Free Account</button>
              <p style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:14 }}>Have an account? <span className="lnk" onClick={() => {setErr("");setScreen("login");}}>Sign in</span></p>
            </div>
          </div>
        )}

        {/* WIZARD */}
        {screen === "wizard" && (
          <div className="fade" style={W}>
            <div style={{ marginBottom:30 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ color:"rgba(255,255,255,0.35)", fontSize:13 }}>Step {wizStep+1} of {WIZARD_STEPS.length}</span>
                <span style={{ color:"rgba(255,255,255,0.25)", fontSize:13 }}>{Math.round(((wizStep+1)/WIZARD_STEPS.length)*100)}%</span>
              </div>
              <div style={{ height:3, background:"rgba(255,255,255,0.07)", borderRadius:99 }}>
                <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#5a3a9e,#a07ff0)", width:`${((wizStep+1)/WIZARD_STEPS.length)*100}%`, transition:"width 0.4s ease" }} />
              </div>
            </div>
            <div className="glass">
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontSize:46, marginBottom:13 }}>{WIZARD_STEPS[wizStep].emoji}</div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, lineHeight:1.4, marginBottom:7 }}>{WIZARD_STEPS[wizStep].label}</h2>
                <p style={{ color:"rgba(255,255,255,0.3)", fontSize:14 }}>{WIZARD_STEPS[wizStep].hint}</p>
              </div>
              {err && <p className="err" style={{ marginBottom:12 }}>{err}</p>}
              <input style={{ marginBottom:20, fontSize:17 }} type={WIZARD_STEPS[wizStep].type||"text"} placeholder={WIZARD_STEPS[wizStep].placeholder} value={pf[WIZARD_STEPS[wizStep].key]||""} onChange={e => setPf({...pf,[WIZARD_STEPS[wizStep].key]:e.target.value})} onKeyDown={e => e.key==="Enter"&&wizNext()} autoFocus />
              <div style={{ display:"flex", gap:10 }}>
                {wizStep > 0 && <button className="btn-g" onClick={() => setWizStep(wizStep-1)}>← Back</button>}
                <button className="btn-p" onClick={wizNext}>{wizStep===WIZARD_STEPS.length-1 ? "Start telling stories ✨" : "Next →"}</button>
              </div>
            </div>
          </div>
        )}

        {/* HOME */}
        {screen === "home" && active && (
          <div className="fade" style={{ maxWidth:500, width:"100%" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                {streak > 0 && (
                  <div style={{ background:"rgba(255,155,40,0.1)", border:"1px solid rgba(255,155,40,0.22)", borderRadius:99, padding:"5px 13px", display:"flex", gap:6, alignItems:"center" }}>
                    <span>🔥</span><span style={{ color:"#ffb347", fontSize:13, fontWeight:600 }}>{streak} night{streak!==1?"s":""}</span>
                  </div>
                )}
                {sub?.status==="trial" && <span style={{ color:"var(--purple-light)", fontSize:13 }}>{daysLeft()}d trial</span>}
              </div>
              <button onClick={logout} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.2)", cursor:"pointer", fontSize:13 }}>Sign out</button>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:26, flexWrap:"wrap" }}>
              {profiles.map(p => (
                <button key={p.id} className={`prof-tab ${active?.id===p.id?"active":""}`} onClick={() => { setActive(p); setPf(p); }}>🌙 {p.child_name}</button>
              ))}
              <button className="prof-tab" onClick={() => { setEditId(null); setPf({child_name:"",age:"",stuffed_animal:"",best_friend:"",favorite_animal:"",scared_of:"",favorite_thing:""}); setWizStep(0); setScreen("wizard"); }}>+ Add child</button>
            </div>

            <div style={{ textAlign:"center", marginBottom:28 }}>
              <div style={{ fontSize:58, marginBottom:14, animation:"float 4s ease-in-out infinite", filter:"drop-shadow(0 0 28px rgba(200,170,80,0.4))" }}>🌙</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, lineHeight:1.25, marginBottom:6 }}>
                Tonight's story for <em style={{ color:"var(--gold-light)" }}>{active.child_name}</em>
              </h1>
              <p style={{ color:"rgba(255,255,255,0.3)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:15 }}>10 pages · personalized · fully illustrated</p>
            </div>

            {/* Story Mode Toggle */}
            <div style={{ marginBottom:22 }}>
              <p style={{ color:"rgba(255,255,255,0.3)", fontSize:11, letterSpacing:"0.13em", textTransform:"uppercase", marginBottom:10 }}>Story type</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <button onClick={() => setStoryMode("adventure")} style={{
                  padding:"14px 12px", borderRadius:14, cursor:"pointer", transition:"all 0.2s", textAlign:"left",
                  background: storyMode==="adventure" ? "rgba(124,77,204,0.22)" : "rgba(255,255,255,0.04)",
                  border: storyMode==="adventure" ? "1.5px solid rgba(180,145,255,0.65)" : "1.5px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ fontSize:22, marginBottom:5 }}>🌙</div>
                  <div style={{ fontWeight:700, fontSize:14, color:"white", marginBottom:3 }}>Adventure</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.4 }}>A magical personalized bedtime story</div>
                </button>
                <button onClick={() => setStoryMode("lesson")} style={{
                  padding:"14px 12px", borderRadius:14, cursor:"pointer", transition:"all 0.2s", textAlign:"left",
                  background: storyMode==="lesson" ? "rgba(40,160,100,0.18)" : "rgba(255,255,255,0.04)",
                  border: storyMode==="lesson" ? "1.5px solid rgba(100,220,150,0.55)" : "1.5px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ fontSize:22, marginBottom:5 }}>✨</div>
                  <div style={{ fontWeight:700, fontSize:14, color:"white", marginBottom:3 }}>Life Lesson</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.4 }}>Teaches a value through the story</div>
                </button>
              </div>
            </div>

            {/* Lesson picker — only shown in lesson mode */}
            {storyMode === "lesson" && (
              <div style={{ marginBottom:22 }}>
                <p style={{ color:"rgba(255,255,255,0.3)", fontSize:11, letterSpacing:"0.13em", textTransform:"uppercase", marginBottom:10 }}>Choose the lesson</p>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {LESSONS.map(l => (
                    <button key={l.id} className={`mood-btn ${lesson===l.id?"active":""}`}
                      style={{ borderColor: lesson===l.id ? "rgba(100,220,150,0.65)" : undefined, background: lesson===l.id ? "rgba(40,160,100,0.2)" : undefined }}
                      onClick={() => setLesson(l.id)}
                    >{l.emoji} {l.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Mood picker */}
            <div style={{ marginBottom:24 }}>
              <p style={{ color:"rgba(255,255,255,0.3)", fontSize:11, letterSpacing:"0.13em", textTransform:"uppercase", marginBottom:10 }}>Tonight's mood</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {MOODS.map(m => (
                  <button key={m.id} className={`mood-btn ${mood===m.id?"active":""}`} onClick={() => setMood(m.id)}>{m.emoji} {m.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button className="btn-glow" onClick={generateStory}>
                {storyMode === "lesson"
                  ? `✨ Story about ${LESSONS.find(l=>l.id===lesson)?.label || "Kindness"}`
                  : "✨ Open Tonight's Story"}
              </button>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <button className="btn-g" onClick={() => { setEditId(active.id); setPf(active); setScreen("profile"); }}>✏️ Edit Profile</button>
                <button className="btn-g" onClick={() => { loadLibrary(); setScreen("library"); }}>📚 Library</button>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE EDIT */}
        {screen === "profile" && (
          <div className="fade" style={W}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
              <button className="btn-g" onClick={() => setScreen("home")}>← Back</button>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20 }}>Edit Profile</h2>
            </div>
            <div className="glass" style={{ display:"flex", flexDirection:"column", gap:18 }}>
              {err && <p className="err">{err}</p>}
              {WIZARD_STEPS.map(f => (
                <div key={f.key}><label style={LBL}>{f.label}</label><input type={f.type||"text"} placeholder={f.placeholder} value={pf[f.key]||""} onChange={e => setPf({...pf,[f.key]:e.target.value})} /></div>
              ))}
              <button className="btn-p" onClick={saveProfile}>Save Changes</button>
            </div>
          </div>
        )}

        {/* STORY */}
        {screen === "story" && (
          <div className="fade" style={{ maxWidth:1200, width:"100%", paddingBottom:20 }}>
            {storyPhase === "text" && <MoonLoader text="Writing your story…" />}

            {storyPhase === "illustrating" && (
              <IllustrationLoader total={pages.length} loaded={imgsLoaded} title={title} />
            )}

            {storyPhase === "ready" && pages.length > 0 && (
              <>
                <OpenBook pages={pages} imgs={imgs} spread={spread} onFlip={handleFlip} title={title} mobile={mobile} coverImg={coverImg} />

                {/* Images still generating indicator */}
                {imgsLoaded < pages.length && (
                  <div style={{ textAlign:"center", marginTop:10 }}>
                    <p style={{ color:"rgba(255,255,255,0.25)", fontSize:12, fontFamily:"'Nunito',sans-serif" }}>
                      🎨 Painting illustrations… {imgsLoaded}/{pages.length}
                    </p>
                    <div style={{ width:160, height:3, background:"rgba(255,255,255,0.07)", borderRadius:99, margin:"6px auto 0", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#7c4dcc,#c084fc)", width:`${(imgsLoaded/pages.length)*100}%`, transition:"width 0.4s ease" }} />
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display:"flex", gap:10, marginTop:16, justifyContent:"center", flexWrap:"wrap" }}>
                  <button className="btn-g" onClick={() => setScreen("home")}>← Home</button>
                  <button
                    className="btn-book"
                    onClick={continueStory}
                    disabled={extending}
                    style={{ opacity: extending ? 0.6 : 1 }}
                  >
                    {extending ? "✨ Writing…" : "✨ Continue Story"}
                  </button>
                  <button
                    className="btn-book"
                    onClick={happyEnding}
                    disabled={extending}
                    style={{ opacity: extending ? 0.6 : 1, background:"linear-gradient(135deg,#1a3020,#2d5040)", borderColor:"rgba(100,200,120,0.3)", color:"#90e0a0" }}
                  >
                    {extending ? "✨ Writing…" : "🌟 Happy Ending"}
                  </button>
                  <button className="btn-g" onClick={shareStory}>{copied ? "✅ Copied!" : "🔗 Share"}</button>
                  <button className="btn-g" style={{ padding:"12px 16px" }} onClick={readAloud}>{speaking ? "⏹️" : "🔊"}</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* LIBRARY */}
        {screen === "library" && (
          <div className="fade" style={{ maxWidth:640, width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
              <button className="btn-g" onClick={() => setScreen("home")}>← Home</button>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontStyle:"italic" }}>📚 {active?.child_name}'s Library</h2>
            </div>
            {library.length === 0 ? (
              <div className="glass" style={{ textAlign:"center", padding:52 }}>
                <div style={{ fontSize:44, marginBottom:14 }}>🌙</div>
                <p style={{ color:"rgba(255,255,255,0.35)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:17 }}>No stories yet — generate tonight's first!</p>
              </div>
            ) : (
              <div style={{ display:"grid", gap:12 }}>
                {library.map(s => {
                  const isToday = s.story_date === todayStr();
                  const d = new Date(s.story_date + "T00:00:00");
                  const label = isToday ? "Tonight" : d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
                  return (
                    <div key={s.id} onClick={() => {
                      const ps = s.text.split("\n\n✦\n\n");
                      setPages(ps); setTitle(s.title||""); setImgs(s.page_images||[]);
                      setSpread(0); setStory(s); setStoryPhase("ready"); setScreen("story");
                    }} className="glass" style={{
                      display:"flex", gap:16, alignItems:"center", cursor:"pointer",
                      borderColor: isToday ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.07)",
                      transition:"all 0.2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                    >
                      {s.page_images?.[0] ? (
                        <img src={s.page_images[0]} alt="" style={{ width:68, height:48, objectFit:"cover", borderRadius:10, flexShrink:0 }} />
                      ) : (
                        <div style={{ width:68, height:48, borderRadius:10, background:"linear-gradient(135deg,#c9b8f8,#818cf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🌙</div>
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                          <span style={{ color:isToday?"var(--gold)":"rgba(255,255,255,0.3)", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>{label}</span>
                          {s.lesson_type && <span style={{ background:"rgba(80,200,120,0.15)", border:"1px solid rgba(80,200,120,0.25)", borderRadius:99, padding:"1px 8px", fontSize:10, color:"#6ee7a0" }}>
                            {LESSONS.find(l=>l.id===s.lesson_type)?.emoji} {LESSONS.find(l=>l.id===s.lesson_type)?.label}
                          </span>}
                        </div>
                        <div style={{ color:"white", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:16, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {s.title||s.text?.slice(0,60)+"…"}
                        </div>
                      </div>
                      <span style={{ color:"rgba(201,168,76,0.5)", fontSize:18 }}>→</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PAYWALL */}
        {screen === "paywall" && (
          <div className="fade" style={{ maxWidth:420, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:56, marginBottom:20, animation:"float 4s ease-in-out infinite" }}>🌙</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:30, marginBottom:12 }}>Your free trial has ended</h2>
            <p style={{ color:"rgba(255,255,255,0.35)", marginBottom:32, lineHeight:1.8, fontFamily:"'Crimson Pro',serif", fontSize:17 }}>
              Keep the magic going for just <strong style={{ color:"white" }}>$4.99/month</strong>.<br />Cancel anytime.
            </p>
            <div className="glass" style={{ marginBottom:22, textAlign:"left" }}>
              {["10-page personalized story every night","Beautiful AI watercolor illustrations","Real picture book experience","Story library saved forever","Read aloud narrator","Multiple child profiles"].map(f => (
                <div key={f} style={{ display:"flex", gap:12, alignItems:"center", padding:"11px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color:"var(--gold)" }}>✦</span>
                  <span style={{ color:"rgba(255,255,255,0.65)", fontSize:15 }}>{f}</span>
                </div>
              ))}
            </div>
            <button className="btn-glow" style={{ marginBottom:12 }}>Subscribe — $4.99/month</button>
            <button className="btn-g" style={{ width:"100%" }} onClick={() => setScreen("home")}>Maybe later</button>
          </div>
        )}

        {/* SHARED */}
        {screen === "shared" && (
          <div className="fade" style={{ maxWidth:980, width:"100%" }}>
            {!shared ? <MoonLoader /> : (() => {
              const sp = shared.text?.split("\n\n✦\n\n") || [shared.text];
              const si = shared.page_images || [];
              return (
                <>
                  <OpenBook pages={sp} imgs={si} spread={0} onFlip={() => {}} title={shared.title} coverImg={shared.cover_image||null} />
                  <div className="glass" style={{ textAlign:"center", marginTop:24 }}>
                    <p style={{ color:"rgba(255,255,255,0.4)", marginBottom:16, fontFamily:"'Crimson Pro',serif", fontSize:17, fontStyle:"italic" }}>
                      Make personalized 10-page picture books for your child every night
                    </p>
                    <button className="btn-glow" style={{ width:"auto", padding:"15px 30px" }} onClick={() => setScreen("signup")}>Try DreamWeaver free ✨</button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>
    </>
  );
}
