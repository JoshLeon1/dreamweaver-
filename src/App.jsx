import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY;
const APP_URL = "https://dreamweaverstory.com";
const TRIAL_DAYS = 7;
const PRICE_BASE = 5.99;       // first child per month
const PRICE_PER_EXTRA = 2.99;  // each additional child per month
const STORY_PAGES = 10;

const MOODS = [
  { id: "magical",  emoji: "✨", label: "Magical",  prompt: "magical and full of wonder" },
  { id: "silly",    emoji: "😂", label: "Silly",    prompt: "funny and giggly" },
  { id: "brave",    emoji: "🦁", label: "Brave",    prompt: "adventurous and heroic" },
  { id: "dreamy",   emoji: "🌈", label: "Dreamy",   prompt: "soft and dreamy like a lullaby" },
  { id: "cozy",     emoji: "🍵", label: "Cozy",     prompt: "warm and cozy like a rainy day inside" },
];

const LESSONS = [
  { id: "sharing",     emoji: "🤝", label: "Sharing",      prompt: "the importance of sharing and generosity with others" },
  { id: "kindness",    emoji: "💛", label: "Kindness",      prompt: "being kind and compassionate to everyone around you" },
  { id: "bravery",     emoji: "🦁", label: "Bravery",       prompt: "finding courage when things feel scary or hard" },
  { id: "honesty",     emoji: "🌟", label: "Honesty",       prompt: "always telling the truth even when it's difficult" },
  { id: "patience",    emoji: "🌱", label: "Patience",      prompt: "waiting calmly and trusting that good things take time" },
  { id: "trying",      emoji: "💪", label: "Keep Trying",   prompt: "never giving up and learning from mistakes" },
  { id: "feelings",    emoji: "🌈", label: "Big Feelings",  prompt: "understanding and expressing big emotions in healthy ways" },
  { id: "environment", emoji: "🌍", label: "Nature",        prompt: "loving and protecting our natural world" },
  { id: "friendship",  emoji: "👫", label: "Friendship",    prompt: "what makes a true friendship and how to be a good friend" },
  { id: "gratitude",   emoji: "🙏", label: "Gratitude",     prompt: "noticing and appreciating the good things in life" },
];

const WIZARD_STEPS = [
  { key: "child_name",      emoji: "👧", label: "What's your child's name?",         placeholder: "Emma",                  hint: "Their name lives in every story" },
  { key: "age",             emoji: "🎂", label: "How old are they?",                  placeholder: "5",                     hint: "Stories are perfectly tailored to their age", type: "number" },
  { key: "stuffed_animal",  emoji: "🧸", label: "Their favorite stuffed animal?",     placeholder: "Mr. Snuggles the bear", hint: "Their best friend stars in every adventure" },
  { key: "best_friend",     emoji: "👫", label: "Who is their best friend?",          placeholder: "Lily next door",        hint: "Friends join the journey" },
  { key: "favorite_animal", emoji: "🦄", label: "Favorite animal?",                   placeholder: "Horses",                hint: "This creature makes a magical appearance" },
  { key: "scared_of",       emoji: "💭", label: "What are they a little scared of?",  placeholder: "Thunderstorms",         hint: "Stories gently help them be brave" },
  { key: "favorite_thing",  emoji: "🎨", label: "What do they love doing most?",      placeholder: "Painting rainbows",     hint: "Their passion weaves through every page" },
];

// Demo story — hardcoded pre-generated images for instant load
const DEMO_STORY = [
  { text: "The night Lily found a tiny glowing door in the garden wall, she squeezed Mr. Hops tight.", img: "https://nhkwocgbxxwarkjqenkj.supabase.co/storage/v1/object/public/story-images/demo/demo_1.webp", fallback: "linear-gradient(135deg,#1a0d3e,#3d1d7e,#7c4dcc)" },
  { text: "Beyond the door lay a moonlit garden — silver flowers and fireflies dancing in the dark.", img: "https://nhkwocgbxxwarkjqenkj.supabase.co/storage/v1/object/public/story-images/demo/demo_2.webp", fallback: "linear-gradient(135deg,#0a1628,#1a3060,#2a50a0)" },
  { text: "Even the shadows were friendly here. The dark wasn't scary — it was where all the magic hid.", img: "https://nhkwocgbxxwarkjqenkj.supabase.co/storage/v1/object/public/story-images/demo/demo_3.webp", fallback: "linear-gradient(135deg,#0f1a30,#1a3050,#2a5080)" },
  { text: "She curled up beneath a starflower, Mr. Hops tucked under her chin, and drifted off to sleep.", img: "https://nhkwocgbxxwarkjqenkj.supabase.co/storage/v1/object/public/story-images/demo/demo_4.webp", fallback: "linear-gradient(135deg,#0a0a1e,#1a1a40,#3030a0)" },
];

const STARS = Array.from({ length: 70 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  size: Math.random() * 2.2 + 0.3, delay: Math.random() * 8, dur: Math.random() * 5 + 2,
}));

const MOON_FRAMES = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const getSharedId = () => new URLSearchParams(window.location.search).get("story");
const isMobile = () => typeof window !== "undefined" && window.innerWidth < 700;
const isTablet = () => typeof window !== "undefined" && window.innerWidth >= 700 && window.innerWidth < 1024;

// ── API ──────────────────────────────────────────────────────────────────────
async function callClaude(messages, maxTokens = 1200) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function generateImage(prompt, coloring = false) {
  try {
    // Step 1: start — returns prediction id instantly (<1s, no timeout risk)
    const startRes = await fetch("/api/start-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, coloring }),
    });
    const { id, error: startErr } = await startRes.json();
    if (startErr || !id) { console.error("start-image error:", startErr); return null; }

    // Step 2: poll via our own API route every 2s (<1s per call, no timeout risk)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch("/api/poll-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await pollRes.json();
      if (data.status === "succeeded" && data.url) return data.url;
      if (data.status === "failed") { console.error("Image failed:", data.error); return null; }
    }
    return null;
  } catch (e) { console.error("generateImage error:", e); return null; }
}

async function cacheImage(replicateUrl, storyId, pageIndex) {
  try {
    const resp = await fetch(replicateUrl);
    const blob = await resp.blob();
    const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const path = `stories/${storyId}/page_${pageIndex}.${ext}`;
    const { error } = await supabase.storage.from("story-images").upload(path, blob, { contentType: blob.type, upsert: true });
    if (error) return replicateUrl;
    const { data } = supabase.storage.from("story-images").getPublicUrl(path);
    return data.publicUrl;
  } catch { return replicateUrl; }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Nunito:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --night: #07050e;
  --cream: #fdf8ef;
  --ink: #1a0f2e;
  --gold: #c9a84c;
  --gold-light: #e8c96a;
  --spine-dark: #1a0802;
  --spine-mid: #5c2e0e;
  --spine-light: #8b4a14;
  --purple: #7c4dcc;
  --purple-light: #b08fff;
}

html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--night);min-height:100vh;font-family:'Nunito',sans-serif;color:white;overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent}

@keyframes twinkle{0%,100%{opacity:.04;transform:scale(.5)}50%{opacity:.85;transform:scale(1.3)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-11px)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes gradFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes flipRight{0%{transform:rotateY(0deg)}100%{transform:rotateY(-180deg)}}
@keyframes flipLeft{0%{transform:rotateY(0deg)}100%{transform:rotateY(180deg)}}
@keyframes unflipRight{0%{transform:rotateY(-180deg);opacity:0}1%{opacity:1}100%{transform:rotateY(0deg);opacity:1}}
@keyframes unflipLeft{0%{transform:rotateY(180deg);opacity:0}1%{opacity:1}100%{transform:rotateY(0deg);opacity:1}}
@keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
@keyframes orb{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(20px,-15px) scale(1.05)}66%{transform:translate(-10px,20px) scale(.97)}}

.fade{animation:fadeUp .5s ease both}
.fadein{animation:fadeIn .3s ease both}
.float{animation:float 4s ease-in-out infinite}

.page-flip-forward{animation:flipRight .55s cubic-bezier(.4,0,.2,1) forwards}
.page-flip-back{animation:flipLeft .55s cubic-bezier(.4,0,.2,1) forwards}
.page-enter-forward{animation:unflipRight .55s cubic-bezier(.4,0,.2,1) forwards}
.page-enter-back{animation:unflipLeft .55s cubic-bezier(.4,0,.2,1) forwards}

/* ── Wrap ── */
.wrap{
  min-height:100vh;position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;
  padding-top:20px;
  padding-bottom:max(80px,calc(60px + env(safe-area-inset-bottom)));
  padding-left:max(16px,env(safe-area-inset-left));
  padding-right:max(16px,env(safe-area-inset-right));
}

/* ── Buttons ── */
.btn-cta{
  background:linear-gradient(270deg,#c084fc,#818cf8,#38bdf8,#c084fc);
  background-size:280% 100%;animation:gradFlow 4s ease infinite;
  color:white;border:none;border-radius:999px;
  padding:17px 44px;font-size:17px;font-weight:800;
  font-family:'Nunito',sans-serif;cursor:pointer;
  transition:transform .2s,box-shadow .2s;
  box-shadow:0 6px 32px rgba(130,80,240,.45);
  letter-spacing:.01em;min-height:52px;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  display:inline-block
}
.btn-cta:hover{transform:translateY(-2px) scale(1.01);box-shadow:0 10px 40px rgba(130,80,240,.6)}
.btn-cta:active{transform:scale(.97);box-shadow:0 3px 16px rgba(130,80,240,.4)}
.btn-cta.full{width:100%;display:block}

.btn-solid{
  background:linear-gradient(135deg,#4c2d99,#7c4dcc);
  color:white;border:none;border-radius:16px;
  padding:15px 24px;font-size:16px;font-weight:700;
  font-family:'Nunito',sans-serif;cursor:pointer;width:100%;
  transition:all .2s;box-shadow:0 4px 20px rgba(90,58,158,.35);
  min-height:52px;-webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.btn-solid:hover{transform:translateY(-2px);filter:brightness(1.1);box-shadow:0 8px 28px rgba(90,58,158,.5)}
.btn-solid:active{transform:scale(.98);filter:brightness(.95)}

.btn-soft{
  background:rgba(255,255,255,.06);color:rgba(255,255,255,.65);
  border:1px solid rgba(255,255,255,.12);border-radius:14px;
  padding:13px 20px;font-size:14px;font-family:'Nunito',sans-serif;
  font-weight:600;cursor:pointer;transition:all .18s;
  min-height:44px;-webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.btn-soft:hover{background:rgba(255,255,255,.11);color:white;border-color:rgba(255,255,255,.22)}
.btn-soft:active{background:rgba(255,255,255,.15);transform:scale(.98)}

.btn-book{
  background:linear-gradient(135deg,#150800,#3a1800);
  color:var(--gold-light);border:1px solid rgba(201,168,76,.25);
  border-radius:12px;padding:12px 20px;font-size:13px;font-weight:700;
  font-family:'Nunito',sans-serif;cursor:pointer;transition:all .2s;
  box-shadow:0 2px 10px rgba(0,0,0,.4);min-height:44px;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.btn-book:hover{filter:brightness(1.2);transform:translateY(-1px)}
.btn-book:active{transform:scale(.97)}
.btn-book:disabled{opacity:.25;cursor:default;transform:none;filter:none}

/* ── Inputs ── */
input{
  width:100%;padding:15px 18px;border-radius:16px;
  border:1.5px solid rgba(255,255,255,.09);
  background:rgba(255,255,255,.05);
  color:white;font-size:16px;font-family:'Nunito',sans-serif;
  outline:none;transition:border-color .2s,background .2s;
  -webkit-appearance:none;appearance:none
}
input:focus{border-color:rgba(139,92,246,.6);background:rgba(255,255,255,.07)}
input::placeholder{color:rgba(255,255,255,.18)}

/* ── Pill toggles ── */
.pill{
  display:inline-flex;align-items:center;gap:5px;
  padding:10px 14px;border-radius:999px;
  border:1.5px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.55);cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;
  transition:all .18s;white-space:nowrap;line-height:1;
  min-height:40px;-webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.pill:hover{border-color:rgba(180,145,255,.4);color:white}
.pill:active{transform:scale(.95)}
.pill.on{background:rgba(124,77,204,.22);border-color:rgba(180,145,255,.6);color:white}
.pill.on-green{background:rgba(74,222,128,.15);border-color:rgba(74,222,128,.5);color:#a7f3d0}

.tab{
  padding:10px 16px;border-radius:999px;
  border:1.5px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.45);cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;
  transition:all .18s;min-height:40px;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.tab:active{transform:scale(.95)}
.tab.on{background:rgba(124,77,204,.22);border-color:rgba(180,145,255,.55);color:white}

/* ── Form card ── */
.form-card{
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);
  border-radius:24px;padding:28px 24px;
  backdrop-filter:blur(12px)
}

/* ── Skeleton ── */
.skeleton{
  background:linear-gradient(90deg,#241b3e 25%,#342b52 50%,#241b3e 75%);
  background-size:200% 100%;animation:shimmer 1.6s infinite
}

/* ── Misc ── */
.err{color:#ff8080;font-size:13px;margin-top:6px}
.lnk{color:var(--purple-light);cursor:pointer}
.lnk:hover{text-decoration:underline}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}

/* ── Typography ── */
.hero-title{
  font-family:'Playfair Display',serif;
  font-size:clamp(38px,8vw,72px);
  line-height:1.04;letter-spacing:-.025em;
  margin-bottom:20px
}
.hero-sub{
  color:rgba(255,255,255,.44);
  font-size:clamp(15px,2.8vw,18px);line-height:1.8;
  font-family:'Crimson Pro',serif;font-style:italic
}
.eyebrow{
  font-size:11px;letter-spacing:.18em;text-transform:uppercase;
  color:rgba(255,255,255,.25);font-family:'Nunito',sans-serif
}
.section-label{
  display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:rgba(255,255,255,.28);font-family:'Nunito',sans-serif;margin-bottom:10px
}

/* ── Orb blobs ── */
.orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);animation:orb 12s ease-in-out infinite}

/* ── Tablet (iPad) optimizations ── */
@media (min-width: 700px) and (max-width: 1023px) {
  .pill { padding: 11px 18px !important; font-size: 14px !important; }
  .btn-soft { font-size: 15px !important; padding: 15px 20px !important; }
  .btn-solid { font-size: 16px !important; padding: 16px 22px !important; }
  .btn-cta { font-size: 17px !important; padding: 20px 32px !important; }
  .tab { font-size: 14px !important; padding: 10px 18px !important; }
  input, select { font-size: 16px !important; padding: 16px 18px !important; }
  label { font-size: 14px !important; }
  .section-label { font-size: 12px !important; }
}
/* ── Feature strip (horizontal scroll on mobile) ── */
.features-strip{
  display:flex;gap:12px;
  overflow-x:auto;-webkit-overflow-scrolling:touch;
  scrollbar-width:none;padding:4px 0 16px
}
.features-strip::-webkit-scrollbar{display:none}
.feat-card{
  flex:0 0 auto;
  display:flex;flex-direction:column;gap:8px;
  padding:20px 18px;border-radius:20px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
  width:140px;text-align:center;
  transition:all .25s
}
.feat-card:hover{background:rgba(255,255,255,.06);transform:translateY(-3px)}
@media(min-width:641px){
  .features-strip{flex-wrap:wrap;overflow-x:visible;justify-content:center}
  .feat-card{width:152px}
}

/* ── Lesson pills ── */
.l-pill{
  display:inline-flex;align-items:center;gap:5px;
  padding:6px 13px;border-radius:999px;font-size:12px;font-weight:600;
  background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.16);
  color:rgba(255,255,255,.62);white-space:nowrap;font-family:'Nunito',sans-serif;
  transition:all .15s
}
.l-pill:hover{background:rgba(74,222,128,.14);color:#bbf7d0}

/* ── Snippet cards ── */
.snip{padding:13px 15px;border-radius:14px;backdrop-filter:blur(8px)}

/* ── Coloring book modal ── */
.coloring-modal{
  position:fixed;inset:0;z-index:100;
  background:rgba(0,0,0,.85);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;
  padding:20px;animation:fadeIn .2s ease
}
.coloring-modal-inner{
  background:#fff;border-radius:20px;padding:0;
  max-width:520px;width:100%;overflow:hidden;
  box-shadow:0 40px 80px rgba(0,0,0,.8)
}

/* ── Badge toast ── */
.badge-toast{
  position:fixed;bottom:calc(24px + env(safe-area-inset-bottom));left:50%;
  transform:translateX(-50%);z-index:200;
  background:linear-gradient(135deg,#1a0a38,#2d1060);
  border:1px solid rgba(201,168,76,.4);border-radius:16px;
  padding:14px 20px;display:flex;gap:12px;align-items:center;
  box-shadow:0 8px 32px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06);
  animation:fadeUp .4s ease both;white-space:nowrap
}

/* ── Badge grid ── */
.badge-grid{display:flex;gap:10px;flex-wrap:wrap}
.badge-item{
  display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:14px 10px;border-radius:16px;width:80px;text-align:center;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  transition:all .2s
}
.badge-item.earned{
  background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.3);
}
.badge-item.earned:hover{background:rgba(201,168,76,.18);transform:translateY(-2px)}

/* ── Mobile-first layout ── */
@media(max-width:640px){
  .wrap{padding-top:14px;padding-bottom:max(72px,calc(56px + env(safe-area-inset-bottom)))}
  .hero-title{font-size:clamp(34px,9.5vw,52px);letter-spacing:-.02em}
  .hero-sub{font-size:15px;line-height:1.7}
  .btn-cta{font-size:15px;padding:15px 20px;min-height:52px}
  .btn-solid{font-size:15px;padding:14px 18px}
  .form-card{padding:22px 18px;border-radius:20px}
  input{font-size:16px}
  .feat-card{width:128px;padding:16px 12px}
  .pill{font-size:12px;padding:9px 12px}
  .tab{font-size:13px;padding:9px 14px}
}
`;

const LBL = { display:"block", color:"rgba(255,255,255,.32)", fontSize:11, letterSpacing:".12em", textTransform:"uppercase", marginBottom:7 };

// ── StarField ─────────────────────────────────────────────────────────────────
function StarField() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {STARS.map(s => (
        <div key={s.id} style={{ position:"absolute", left:`${s.x}%`, top:`${s.y}%`, width:s.size, height:s.size, borderRadius:"50%", background:"white", animation:`twinkle ${s.dur}s ${s.delay}s infinite ease-in-out` }} />
      ))}
      {/* Big ambient blobs */}
      <div className="orb" style={{ width:"55vw", height:"55vw", top:"-10%", left:"-15%", background:"rgba(80,30,160,.1)", animationDelay:"0s" }} />
      <div className="orb" style={{ width:"45vw", height:"45vw", bottom:"-5%", right:"-10%", background:"rgba(20,60,150,.09)", animationDelay:"-5s" }} />
      <div className="orb" style={{ width:"30vw", height:"30vw", top:"40%", right:"20%", background:"rgba(100,30,180,.06)", animationDelay:"-3s" }} />
    </div>
  );
}

// ── Loaders ──────────────────────────────────────────────────────────────────
function MoonLoader({ text = "Weaving your story…", childName = "" }) {
  const [i, setI] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const messages = childName ? [
    `Writing ${childName}'s story…`,
    "Choosing the perfect words…",
    "Crafting each magical page…",
    "Almost there…",
  ] : [
    "Weaving your story…",
    "Choosing the perfect words…",
    "Adding a sprinkle of magic…",
    "Almost there…",
  ];
  useEffect(() => { const t = setInterval(() => setI(x => (x+1) % MOON_FRAMES.length), 260); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setMsgIdx(x => (x+1) % messages.length), 2800); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign:"center", padding:"clamp(60px,12vw,100px) 20px" }}>
      <div style={{ marginBottom:24 }}><DreamweaverLogo size={36} showText={true} /></div>
      <div style={{ fontSize:64, marginBottom:24, animation:"float 3s ease-in-out infinite", filter:"drop-shadow(0 0 28px rgba(200,170,80,.4))" }}>{MOON_FRAMES[i]}</div>
      <p style={{ color:"rgba(255,255,255,.55)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(17px,4vw,21px)", marginBottom:10, transition:"opacity .4s" }}>{messages[msgIdx]}</p>
      <p style={{ color:"rgba(255,255,255,.2)", fontSize:12, fontFamily:"'Nunito',sans-serif" }}>This takes about 10 seconds ☕</p>
    </div>
  );
}

function IllustrationLoader({ total, loaded, title, imgs=[] }) {
  const pct = Math.round((loaded / total) * 100);
  const [paintMsg, setPaintMsg] = useState(0);
  const paintMessages = [
    "Mixing the watercolors…",
    "Painting each scene by hand…",
    "Adding magic to every page…",
    "Bringing the story to life…",
    "Almost ready to read…",
  ];
  useEffect(() => { const t = setInterval(() => setPaintMsg(x => (x+1) % paintMessages.length), 3000); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign:"center", padding:"clamp(32px,6vw,52px) 20px", maxWidth:500, margin:"0 auto" }}>
      <div style={{ marginBottom:22 }}><DreamweaverLogo size={32} showText={true} /></div>
      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(18px,4vw,24px)", fontStyle:"italic", marginBottom:8, color:"var(--gold-light)", lineHeight:1.3 }}>
        {title ? `"${title}"` : "Painting your story…"}
      </h3>
      <p style={{ color:"rgba(255,255,255,.38)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(14px,3vw,16px)", marginBottom:22, height:24 }}>
        {loaded < total ? paintMessages[paintMsg] : "✨ Ready to read!"}
      </p>

      {/* Progress bar */}
      <div style={{ background:"rgba(255,255,255,.07)", borderRadius:99, height:5, marginBottom:20, overflow:"hidden", maxWidth:320, margin:"0 auto 20px" }}>
        <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#7c4dcc,#c084fc,#67e8f9)", width:`${pct}%`, transition:"width .6s ease", boxShadow:"0 0 10px rgba(192,132,252,.5)" }} />
      </div>

      {/* Page thumbnails — show actual image previews as they come in */}
      <div style={{ display:"flex", gap:"clamp(5px,1.5vw,8px)", justifyContent:"center", flexWrap:"wrap", marginBottom:18 }}>
        {Array.from({ length: total }).map((_,i) => (
          <div key={i} style={{ width:"clamp(38px,9vw,52px)", height:"clamp(38px,9vw,52px)", borderRadius:10, overflow:"hidden", border:`2px solid ${i<loaded?"rgba(201,168,76,.5)":"rgba(255,255,255,.08)"}`, transition:"all .5s", background:"rgba(255,255,255,.04)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, position:"relative" }}>
            {imgs[i]
              ? <img src={imgs[i]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              : i===loaded
                ? <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid rgba(192,132,252,.7)", borderTopColor:"transparent", animation:"spin .8s linear infinite" }} />
                : i < loaded
                  ? <span style={{ fontSize:16, color:"var(--gold)" }}>✦</span>
                  : <span style={{ color:"rgba(255,255,255,.1)", fontSize:14 }}>○</span>
            }
            {i < loaded && imgs[i] && (
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,transparent 50%,rgba(0,0,0,.3))", pointerEvents:"none" }} />
            )}
          </div>
        ))}
      </div>

      <p style={{ color:"rgba(255,255,255,.2)", fontSize:12, fontFamily:"'Nunito',sans-serif" }}>
        {loaded}/{total} illustrations complete · about 30–45 seconds total
      </p>
    </div>
  );
}



// ── Bottom Nav (mobile only) ──────────────────────────────────────────────────
function BottomNav({ screen, setScreen, loadLibrary, badgeCount, totalBadges }) {
  const tabs = [
    { id:"home",    icon:"🏠", label:"Home"    },
    { id:"library", icon:"📚", label:"Library" },
    { id:"badges",  icon:"🏅", label:"Badges",  badge: badgeCount > 0 ? `${badgeCount}` : null },
  ];
  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id}
          className={screen===t.id ? "active" : ""}
          onClick={() => {
            if (t.id==="library") { loadLibrary(); }
            setScreen(t.id);
          }}>
          <span className="nav-icon" style={{ position:"relative" }}>
            {t.icon}
            {t.badge && (
              <span style={{ position:"absolute", top:-4, right:-6, background:"#c084fc", borderRadius:99, fontSize:9, fontWeight:800, color:"white", padding:"1px 4px", fontFamily:"'Nunito',sans-serif", lineHeight:1.4 }}>{t.badge}</span>
            )}
          </span>
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── DreamWeaver Logo ──────────────────────────────────────────────────────────
function DreamweaverLogo({ size = 32, showText = true }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="moonGlow" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f6e27a" stopOpacity="1"/>
            <stop offset="60%" stopColor="#c9a030" stopOpacity="1"/>
            <stop offset="100%" stopColor="#7c4dcc" stopOpacity="1"/>
          </radialGradient>
          <radialGradient id="starGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8"/>
          </radialGradient>
        </defs>
        {/* Moon crescent */}
        <path d="M26 8C18.268 8 12 14.268 12 22C12 29.732 18.268 36 26 36C28.2 36 30.28 35.46 32.1 34.5C28.5 33.1 26 29.34 26 25C26 18.924 30.04 13.78 35.6 11.9C33.16 9.48 29.76 8 26 8Z" fill="url(#moonGlow)" opacity="0.95"/>
        {/* Stars */}
        <circle cx="10" cy="12" r="1.5" fill="url(#starGrad)" opacity="0.9"/>
        <circle cx="6" cy="22" r="1" fill="url(#starGrad)" opacity="0.7"/>
        <circle cx="14" cy="6" r="1" fill="url(#starGrad)" opacity="0.6"/>
        <circle cx="34" cy="20" r="1.2" fill="url(#starGrad)" opacity="0.5"/>
        <circle cx="30" cy="6" r="0.8" fill="#c084fc" opacity="0.7"/>
      </svg>
      {showText && (
        <span style={{
          fontFamily:"'Playfair Display',serif",
          fontSize: size * 0.72,
          fontWeight:700,
          fontStyle:"italic",
          background:"linear-gradient(120deg,#f6d98a 0%,#e8b84b 45%,#c9a030 100%)",
          WebkitBackgroundClip:"text",
          WebkitTextFillColor:"transparent",
          backgroundClip:"text",
          letterSpacing:"-.01em",
          lineHeight:1,
        }}>DreamWeaver</span>
      )}
    </div>
  );
}

// ── Open Book ─────────────────────────────────────────────────────────────────
function OpenBook({ pages, imgs, spread, onFlip, title, mobile=false, coverImg=null }) {
  const totalSpreads = Math.ceil(pages.length / 2);
  const isCover = spread === -1;
  const [animating, setAnimating] = useState(false);
  const [openingCover, setOpeningCover] = useState(false);
  const [displaySpread, setDisplaySpread] = useState(spread);
  const [flipClass, setFlipClass] = useState("");
  const [enterClass, setEnterClass] = useState("");
  const prevSpread = useRef(spread);

  useEffect(() => {
    if (spread === displaySpread) return;
    const forward = spread > prevSpread.current;
    prevSpread.current = spread;

    // Cover → page 1: play cover-open animation
    if (displaySpread === -1 && forward) {
      setOpeningCover(true);
      setAnimating(true);
      setTimeout(() => {
        setOpeningCover(false);
        setDisplaySpread(0);
        setEnterClass("page-enter-forward");
        setTimeout(() => { setEnterClass(""); setAnimating(false); }, 650);
      }, 750);
      return;
    }

    setAnimating(true);
    setFlipClass(forward ? "page-flip-forward" : "page-flip-back");
    setEnterClass("");
    setTimeout(() => {
      setDisplaySpread(spread);
      setFlipClass("");
      setEnterClass(forward ? "page-enter-forward" : "page-enter-back");
      setTimeout(() => { setEnterClass(""); setAnimating(false); }, 650);
    }, 650);
  }, [spread]);

  // ── Page content component ─────────────────────────────────────────────────
  const PageContent = ({ idx, side }) => {
    const text = pages[idx], img = imgs[idx];
    if (!text) return (
      <div style={{ flex:1, position:"relative", overflow:"hidden", background:"linear-gradient(160deg,#180a38,#0e0520)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        {coverImg
          ? <><img src={coverImg} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", position:"absolute", inset:0 }} /><div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.45)" }} /></>
          : <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 40% 30%,rgba(160,120,255,.1) 0%,transparent 60%)" }} />
        }
        <div style={{ position:"relative", textAlign:"center", padding:"0 20px" }}>
          <div style={{ fontSize:32, marginBottom:10, opacity:.6 }}>🌙</div>
          <p style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(11px,1.5vw,16px)", color:"rgba(255,255,255,.4)", fontStyle:"italic" }}>The End</p>
        </div>
      </div>
    );
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:"linear-gradient(175deg,#fefcf7 0%,#fdf9f0 60%,#f9f1e0 100%)", position:"relative", overflow:"hidden" }}>
        {/* Image area — 62% of height */}
        <div style={{ width:"100%", flex:"0 0 62%", position:"relative", overflow:"hidden" }}>
          {img
            ? <img src={img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            : <div className="skeleton" style={{ width:"100%", height:"100%" }} />
          }
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:48, background:"linear-gradient(to bottom,transparent,rgba(253,249,240,.95))" }} />
          <div style={{ position:"absolute", bottom:10, [side==="left"?"right":"left"]:12, background:"rgba(255,255,255,.88)", backdropFilter:"blur(4px)", borderRadius:99, padding:"2px 10px", color:"var(--ink)", fontSize:11, fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>{idx+1}</div>
        </div>
        {/* Text area */}
        <div style={{ flex:1, padding:"14px 20px 18px", display:"flex", alignItems:"center" }}>
          <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(13px,1.5vw,17px)", lineHeight:1.95, color:"var(--ink)", textAlign:"center", width:"100%" }}>{text}</p>
        </div>
        {/* Page corner fold */}
        {side==="right" && <div style={{ position:"absolute", bottom:0, right:0, width:22, height:22, background:"linear-gradient(225deg,#e8d8b0 45%,transparent 50%)" }} />}
        {/* Spine shadow */}
        {side==="left"  && <div style={{ position:"absolute", top:0, right:0, bottom:0, width:18, background:"linear-gradient(to right,transparent,rgba(0,0,0,.08))", pointerEvents:"none" }} />}
        {side==="right" && <div style={{ position:"absolute", top:0, left:0,  bottom:0, width:18, background:"linear-gradient(to left,transparent,rgba(0,0,0,.06))",  pointerEvents:"none" }} />}
        <div style={{ position:"absolute", bottom:8, [side==="left"?"right":"left"]:14, color:"var(--gold)", fontSize:12, opacity:.4 }}>✦</div>
      </div>
    );
  };

  // ── COVER — closed book, single page ──────────────────────────────────────
  if (isCover) {
    if (!coverImg) {
      // No cover yet, skip to page 1 automatically
      useEffect(() => { onFlip("forward"); }, []);
      return null;
    }
    const W = mobile ? "min(92vw,380px)" : "min(52vw,480px)";
    const aspect = "2/3"; // portrait closed book
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
        {title && <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,2.4vw,24px)", fontStyle:"italic", color:"var(--gold-light)", textAlign:"center", marginBottom:16, textShadow:"0 2px 20px rgba(200,170,80,.3)" }}>{title}</h2>}
        {/* Closed book */}
        <div
          onClick={()=>!animating&&onFlip("forward")}
          style={{ width:W, aspectRatio:aspect, position:"relative", cursor:"pointer",
            boxShadow:"8px 8px 0 rgba(0,0,0,.15), 0 60px 120px rgba(0,0,0,.85), 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)",
            borderRadius:"4px 12px 12px 4px",
            transition:"transform .2s ease, box-shadow .2s ease",
          }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px) scale(1.01)"; e.currentTarget.style.boxShadow="8px 12px 0 rgba(0,0,0,.15), 0 70px 140px rgba(0,0,0,.9), 0 24px 70px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="8px 8px 0 rgba(0,0,0,.15), 0 60px 120px rgba(0,0,0,.85), 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)";}}
        >
          {/* Cover image */}
          <div style={{ position:"absolute", inset:0, borderRadius:"4px 12px 12px 4px", overflow:"hidden" }}>
            <img src={coverImg} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            {/* Dark gradient for text */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.05) 0%,transparent 30%,rgba(0,0,0,.65) 100%)" }} />
            {/* Title */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"clamp(16px,3vw,28px)", textAlign:"center" }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(17px,3vw,28px)", fontStyle:"italic", color:"white", lineHeight:1.25, marginBottom:6, textShadow:"0 2px 20px rgba(0,0,0,.9)" }}>{title}</h2>
              <p style={{ color:"rgba(255,255,255,.5)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(11px,1.5vw,14px)", textShadow:"0 1px 8px rgba(0,0,0,.8)" }}>A DreamWeaver Story ✦</p>
            </div>
            {/* Shine / gloss */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(125deg,rgba(255,255,255,.12) 0%,transparent 40%)", pointerEvents:"none" }} />
          </div>
          {/* Spine */}
          <div style={{ position:"absolute", top:0, left:0, bottom:0, width:18, borderRadius:"4px 0 0 4px",
            background:"linear-gradient(90deg,#1a0800,#5c2e0e 40%,#8b4513 50%,#5c2e0e 60%,#2a0a00)",
            boxShadow:"inset -4px 0 8px rgba(0,0,0,.4)" }} />
          {/* Pages stacked on right edge */}
          <div style={{ position:"absolute", top:4, right:-4, bottom:4, width:8, borderRadius:"0 3px 3px 0",
            background:"linear-gradient(90deg,#f5f0e8,#ede5d0)",
            boxShadow:"2px 0 4px rgba(0,0,0,.3)" }} />
          <div style={{ position:"absolute", top:6, right:-7, bottom:6, width:6, borderRadius:"0 3px 3px 0",
            background:"linear-gradient(90deg,#ede5d0,#e8dfc8)",
            boxShadow:"2px 0 4px rgba(0,0,0,.2)" }} />
          {/* Tap hint */}
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", opacity:.0, transition:"opacity .2s" }} className="cover-hint">
          </div>
        </div>
        <button
          onClick={()=>!animating&&onFlip("forward")}
          style={{ marginTop:20, background:"linear-gradient(135deg,#4c2d99,#7c4dcc)", border:"none", borderRadius:999, padding:"clamp(12px,2vw,15px) clamp(28px,5vw,44px)", color:"white", fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:"clamp(14px,2vw,16px)", cursor:"pointer", boxShadow:"0 4px 24px rgba(124,77,204,.45)", letterSpacing:".02em" }}
        >
          Open Book →
        </button>
        <p style={{ color:"rgba(255,255,255,.2)", fontSize:12, marginTop:10, fontFamily:"'Nunito',sans-serif" }}>or tap the cover</p>
      </div>
    );
  }

  const li = displaySpread * 2;
  const ri = displaySpread * 2 + 1;

  // ── MOBILE: single page view ───────────────────────────────────────────────
  if (mobile) {
    const touchStart = useRef(null);
    const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
      if (touchStart.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0 && spread < pages.length - 1) onFlip("forward");
      if (dx > 0 && spread > (coverImg ? -1 : 0)) onFlip("back");
    };
    return (
      <div style={{ width:"100%", maxWidth:"min(92vw,520px)", margin:"0 auto" }}>
        {title && <div style={{ textAlign:"center", marginBottom:12 }}><h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(17px,4vw,22px)", fontStyle:"italic", color:"var(--gold-light)" }}>{title}</h2></div>}
        <div
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          className={flipClass || enterClass}
          style={{ borderRadius:16, overflow:"hidden", touchAction:"pan-y",
            boxShadow:"0 40px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.06)",
            transformOrigin: flipClass==="page-flip-back"||enterClass==="page-enter-back" ? "right center" : "left center",
          }}>
          <div style={{ display:"flex", flexDirection:"column", background:"linear-gradient(175deg,#fefcf7,#fdf9f0)", position:"relative" }}>
            <div style={{ width:"100%", aspectRatio:"4/3", position:"relative", overflow:"hidden" }}>
              {imgs[spread]
                ? <img src={imgs[spread]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                : <div className="skeleton" style={{ width:"100%", height:"100%" }} />}
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:40, background:"linear-gradient(to bottom,transparent,rgba(253,249,240,.9))" }} />
              <div style={{ position:"absolute", bottom:10, right:14, background:"rgba(255,255,255,.88)", backdropFilter:"blur(4px)", borderRadius:99, padding:"3px 11px", color:"var(--ink)", fontSize:12, fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>{spread+1}</div>
            </div>
            <div style={{ padding:"clamp(16px,4vw,22px) clamp(18px,5vw,28px) clamp(18px,4vw,24px)", minHeight:90 }}>
              <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(16px,4.5vw,20px)", lineHeight:1.9, color:"var(--ink)", textAlign:"center" }}>{pages[spread]}</p>
            </div>
          </div>
        </div>
        {/* Navigation */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14, gap:10 }}>
          <button className="btn-book" disabled={(coverImg?spread===-1:spread===0)||animating} onClick={()=>onFlip("back")} style={{ flex:1 }}>← Prev</button>
          <div style={{ display:"flex", gap:5, alignItems:"center", flexShrink:0 }}>
            {pages.length <= 14
              ? Array.from({length:pages.length}).map((_,i) => <div key={i} onClick={()=>!animating&&onFlip(i)} style={{ width:i===spread?20:6, height:6, borderRadius:99, background:i===spread?"var(--gold)":"rgba(255,255,255,.2)", transition:"all .3s", cursor:"pointer" }} />)
              : <span style={{ color:"rgba(255,255,255,.35)", fontSize:13, fontFamily:"'Nunito',sans-serif" }}>{spread+1}/{pages.length}</span>}
          </div>
          <button className="btn-book" disabled={spread>=pages.length-1||animating} onClick={()=>onFlip("forward")} style={{ flex:1 }}>Next →</button>
        </div>
      </div>
    );
  }

  // ── DESKTOP: two-page spread ───────────────────────────────────────────────
  return (
    <div style={{ width:"100%", maxWidth:"min(96vw,1240px)", margin:"0 auto" }}>
      {title && <div style={{ textAlign:"center", marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,2.2vw,26px)", fontStyle:"italic", color:"var(--gold-light)", textShadow:"0 2px 20px rgba(200,170,80,.3)" }}>{title}</h2>
      </div>}

      <div style={{ perspective:"2800px", perspectiveOrigin:"50% 42%" }}>
        <div style={{ display:"flex", position:"relative", borderRadius:16,
          boxShadow:"0 80px 160px rgba(0,0,0,.85), 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)",
          overflow:"hidden",
        }}>
          {/* LEFT PAGE */}
          <div
            className={flipClass==="page-flip-back" ? "page-flip-back" : (enterClass==="page-enter-back" ? "page-enter-back" : "")}
            style={{ flex:1, display:"flex", position:"relative", overflow:"hidden",
              transformOrigin:"right center", transformStyle:"preserve-3d",
              borderRadius:"14px 0 0 14px",
              boxShadow:"inset -8px 0 20px rgba(0,0,0,.2)",
            }}>
            <PageContent idx={li} side="left" />
          </div>

          {/* SPINE */}
          <div style={{ width:32, flexShrink:0, zIndex:10, position:"relative",
            background:"linear-gradient(90deg,#0a0300,#4a1e08 25%,#8b4513 45%,#c8782a 50%,#8b4513 55%,#4a1e08 75%,#0a0300)",
            boxShadow:"0 0 30px rgba(0,0,0,.9), inset 0 0 12px rgba(0,0,0,.5)",
          }}>
            <div style={{ position:"absolute", top:0, bottom:0, left:"50%", width:1.5, background:"linear-gradient(180deg,transparent 3%,rgba(201,168,76,.4) 30%,rgba(240,210,100,.6) 50%,rgba(201,168,76,.4) 70%,transparent 97%)" }} />
            <div style={{ position:"absolute", top:0, bottom:0, left:"30%", width:1, background:"linear-gradient(180deg,transparent 5%,rgba(255,255,255,.08) 50%,transparent 95%)" }} />
          </div>

          {/* RIGHT PAGE */}
          <div
            className={flipClass==="page-flip-forward" ? "page-flip-forward" : (enterClass==="page-enter-forward" ? "page-enter-forward" : "")}
            style={{ flex:1, display:"flex", position:"relative", overflow:"hidden",
              transformOrigin:"left center", transformStyle:"preserve-3d",
              borderRadius:"0 14px 14px 0",
              boxShadow:"inset 8px 0 20px rgba(0,0,0,.16)",
            }}>
            <PageContent idx={ri} side="right" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginTop:22 }}>
        <button className="btn-book" disabled={(coverImg?spread===-1:spread===0)||animating} onClick={()=>onFlip("back")}>← Prev</button>
        <div style={{ display:"flex", gap:7, alignItems:"center" }}>
          {Array.from({ length: totalSpreads }).map((_,i) => (
            <div key={i} onClick={()=>!animating&&onFlip(i)}
              style={{ width:i===spread?24:7, height:7, borderRadius:99, cursor:animating?"default":"pointer",
                background:i===spread?"var(--gold)":"rgba(255,255,255,.18)",
                transition:"all .3s", boxShadow:i===spread?"0 0 12px rgba(201,168,76,.6)":"none" }} />
          ))}
        </div>
        <button className="btn-book" disabled={spread>=totalSpreads-1||animating} onClick={()=>onFlip("forward")}>Next →</button>
      </div>
    </div>
  );
}


// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]       = useState("splash");
  const [user, setUser]           = useState(null);
  const [profiles, setProfiles]   = useState([]);
  const [active, setActive]       = useState(null);
  const [sub, setSub]             = useState(null);
  const [streak, setStreak]       = useState(0);
  const [streakCelebrate, setStreakCelebrate] = useState(false);
  const [streakMilestone, setStreakMilestone] = useState(null); // null | 3 | 7 | 30

  const [story, setStory]         = useState(null);
  const [title, setTitle]         = useState("");
  const [pages, setPages]         = useState([]);
  const [imgs, setImgs]           = useState([]);
  const [spread, setSpread]       = useState(0);
  const [imgsLoaded, setImgsLoaded] = useState(0);
  const [storyPhase, setStoryPhase] = useState("idle");
  const [extending, setExtending] = useState(false);
  const [mobile, setMobile]       = useState(isMobile());
  const [tablet, setTablet]       = useState(isTablet());
  const [coverImg, setCoverImg]   = useState(null);

  const [mood, setMood]           = useState("magical");
  const [storyMode, setStoryMode] = useState("adventure");
  const [lesson, setLesson]       = useState("kindness");
  const [wizStep, setWizStep]     = useState(0);
  const [library, setLibrary]     = useState([]);
  const [copied, setCopied]       = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [err, setErr]             = useState("");
  const [demoSpread, setDemoSpread] = useState(0);
  const [shared, setShared]       = useState(null);

  const [af, setAf] = useState({ email:"", password:"", name:"" });
  const [pf, setPf] = useState({ child_name:"", age:"", stuffed_animal:"", best_friend:"", favorite_animal:"", scared_of:"", favorite_thing:"", photo_url:"" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [coloringUrl, setColoringUrl]     = useState(null);
  const [coloringLoading, setColoringLoading] = useState(false);
  const [badges, setBadges]               = useState([]);
  const [newBadge, setNewBadge]           = useState(null);

  useEffect(() => {
    const sharedId = getSharedId();
    if (sharedId) { loadShared(sharedId); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); loadData(session.user); }
      else setTimeout(() => setScreen("landing"), 700);
    });
    const { data: { subscription: as } } = supabase.auth.onAuthStateChange((_,session) => {
      if (session?.user) { setUser(session.user); loadData(session.user); }
    });
    return () => as.unsubscribe();
  }, []);

  useEffect(() => { const h = () => { setMobile(window.innerWidth < 700); setTablet(window.innerWidth >= 700 && window.innerWidth < 1024); }; window.addEventListener("resize",h); return () => window.removeEventListener("resize",h); }, []);
  useEffect(() => { if (screen!=="landing") return; const t = setInterval(() => setDemoSpread(p => (p+1)%2), 5000); return () => clearInterval(t); }, [screen]);

  const loadShared = async (id) => { setScreen("shared"); const { data } = await supabase.from("stories").select("*").eq("id",id).single(); if (data) setShared(data); else setScreen("landing"); };
  const loadData = async (u) => {
    const [{ data: profs },{ data: s }] = await Promise.all([
      supabase.from("child_profiles").select("*").eq("user_id",u.id).order("created_at"),
      supabase.from("subscriptions").select("*").eq("user_id",u.id).maybeSingle(),
    ]);
    if (profs?.length) { setProfiles(profs); setActive(profs[0]); }
    if (s) setSub(s);
    else {
      // New user - create trial subscription with upsert to avoid race conditions
      const { data: ns, error: se } = await supabase.from("subscriptions").upsert(
        { user_id:u.id, status:"trial", trial_ends_at:new Date(Date.now()+TRIAL_DAYS*86400000).toISOString() },
        { onConflict:"user_id", ignoreDuplicates:true }
      ).select().single();
      if (ns) setSub(ns);
      else if (se) {
        // Upsert failed - try a plain select in case it already exists
        console.error("Sub create error:", se);
        const { data: existing } = await supabase.from("subscriptions").select("*").eq("user_id",u.id).maybeSingle();
        if (existing) setSub(existing);
        else setSub({ status:"trial", trial_ends_at:new Date(Date.now()+TRIAL_DAYS*86400000).toISOString() });
      }
    }
    await calcStreak(u.id);
    setScreen(profs?.length ? "home" : "welcome");
    if (profs?.length) { const { data:b } = await supabase.from("badges").select("badge_id").eq("user_id",u.id); if (b) setBadges(b.map(x=>x.badge_id)); }
  };
  const calcStreak = async (uid, prevStreak=0) => {
    const { data } = await supabase.from("stories").select("story_date").eq("user_id",uid).order("story_date",{ ascending:false });
    if (!data?.length) return;
    let n=0, check=new Date(); check.setHours(0,0,0,0);
    for (const s of data) { const d=new Date(s.story_date+"T00:00:00"); d.setHours(0,0,0,0); if ((check-d)/86400000<=1) { n++; check=d; } else break; }
    setStreak(n);
    // Trigger milestone celebration if we just hit 3, 7, or 30
    const milestones = [3, 7, 30];
    const hit = milestones.find(m => n === m && prevStreak < m);
    if (hit) { setStreakMilestone(hit); setStreakCelebrate(true); setTimeout(() => setStreakCelebrate(false), 4000); }
  };

  const hasAccess = () => { if (!sub) return true; // allow while loading - server will catch expired
    if (sub.status==="active") return true; if (sub.status==="trial"&&new Date(sub.trial_ends_at)>new Date()) return true; return false; };
  const daysLeft = () => sub ? Math.max(0,Math.ceil((new Date(sub.trial_ends_at)-new Date())/86400000)) : 0;

  // Pricing: $5.99 first child, $2.99 each additional
  const monthlyPrice = () => profiles.length <= 1 ? PRICE_BASE : PRICE_BASE + (profiles.length - 1) * PRICE_PER_EXTRA;
  const priceForAdding = () => profiles.length === 0 ? PRICE_BASE : PRICE_BASE + profiles.length * PRICE_PER_EXTRA;

  // During trial: allow up to 1 child profile. Active sub: unlimited.
  const canAddProfile = () => {
    if (sub?.status === "active") return true;
    if (sub?.status === "trial" && new Date(sub.trial_ends_at) > new Date()) return profiles.length < 1;
    return false;
  };

  const signup = async () => { setErr(""); if (!af.email||!af.password||!af.name) return setErr("All fields required."); const { error:e } = await supabase.auth.signUp({ email:af.email, password:af.password, options:{ data:{ name:af.name } } }); if (e) setErr(e.message); };
  const login  = async () => { setErr(""); if (!af.email||!af.password) return setErr("Email and password required."); const { error:e } = await supabase.auth.signInWithPassword({ email:af.email, password:af.password }); if (e) setErr(e.message); };
  const logout = async () => { await supabase.auth.signOut(); setUser(null); setProfiles([]); setActive(null); setStory(null); setSub(null); setScreen("landing"); };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);

    // Analyze photo with Claude Vision to generate character card
    setPhotoAnalyzing(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const mediaType = file.type || "image/jpeg";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: `Describe this child's appearance for a children's book illustrator in 2 short sentences. Cover: hair color and style, eye color, skin tone, and any distinctive features. Be specific and warm so an illustrator can draw the same child consistently. Example: "A cheerful girl with long curly red hair, bright green eyes, and fair freckled skin. She has a big smile and rosy cheeks." Just the description, nothing else.` }
            ]
          }]
        })
      });
      const data = await response.json();
      const description = data.content?.[0]?.text?.trim();
      if (description) {
        // Upload photo to Supabase storage for permanent URL
        try {
          const ext = file.type.includes("png") ? "png" : "jpg";
          const path = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from("story-images").upload(path, file, { contentType: file.type, upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("story-images").getPublicUrl(path);
            setPf(prev => ({ ...prev, character_card: description, photo_url: urlData.publicUrl }));
          } else {
            setPf(prev => ({ ...prev, character_card: description }));
          }
        } catch {
          setPf(prev => ({ ...prev, character_card: description }));
        }
        console.log("Character card from photo:", description);
      }
    } catch(e) {
      console.error("Photo analysis failed:", e);
    }
    setPhotoAnalyzing(false);
  };

  const wizNext = () => { if (wizStep<WIZARD_STEPS.length-1) setWizStep(wizStep+1); else saveProfile(); };
  const saveProfile = async () => {
    setErr("");
    if (!pf.child_name) return setErr("Child's name is required.");
    // Block adding new profiles beyond what plan allows (editing existing is always fine)
    if (!editId && !canAddProfile()) { setScreen("paywall"); return; }
    // Explicitly include photo_url and character_card so they always save
    const payload = {
      child_name: pf.child_name,
      age: parseInt(pf.age)||5,
      stuffed_animal: pf.stuffed_animal||"",
      best_friend: pf.best_friend||"",
      favorite_animal: pf.favorite_animal||"",
      scared_of: pf.scared_of||"",
      favorite_thing: pf.favorite_thing||"",
      user_id: user.id,
      ...(pf.character_card ? { character_card: pf.character_card } : {}),
      ...(pf.photo_url      ? { photo_url: pf.photo_url }           : {}),
    };
    if (editId) {
      const { data:u, error:ue } = await supabase.from("child_profiles").update(payload).eq("id",editId).select().single();
      if (ue) { console.error("Profile update error:", ue); setErr(ue.message); return; }
      if (u) { setProfiles(profiles.map(p => p.id===editId?u:p)); setActive(u); }
    } else {
      const { data:c, error:e } = await supabase.from("child_profiles").insert(payload).select().single();
      if (e) { setErr(e.message); return; }
      if (c) { setProfiles([...profiles,c]); setActive(c); }
    }
    setEditId(null); setWizStep(0); setScreen("home");
  };

  const profileText = (p) => `Child: ${p.child_name}, Age: ${p.age||5}, Stuffed animal: ${p.stuffed_animal||"a stuffed bear"}, Best friend: ${p.best_friend||"a friend"}, Favorite animal: ${p.favorite_animal||"dogs"}, Scared of: ${p.scared_of||"the dark"}, Favorite thing: ${p.favorite_thing||"playing"}.`;

  // Build a consistent character description — stored once per profile
  const getCharacterCard = async (p) => {
    // Already has a character card (from photo or previous generation) - reuse it
    if (p.character_card) return p.character_card;
    // Generate from profile text as fallback
    const card = await callClaude([{role:"user",content:`Describe the appearance of a ${p.age||5}-year-old child named ${p.child_name} for a children's book illustrator. Keep it to 2 short sentences covering hair, eyes, skin tone, and typical outfit. Be specific and consistent so an illustrator can draw the same child every time. Also describe their stuffed animal "${p.stuffed_animal||"a stuffed bear"}" in one sentence.`}], 120);
    const trimmed = card.trim();
    // Save so we don't regenerate every time
    await supabase.from("child_profiles").update({ character_card: trimmed }).eq("id", p.id);
    setProfiles(prev => prev.map(pr => pr.id===p.id ? {...pr, character_card:trimmed} : pr));
    setActive(prev => prev?.id===p.id ? {...prev, character_card:trimmed} : prev);
    return trimmed;
  };

  const imgPromptFor = (pt, m, charCard) => {
    const base = charCard
      ? `Children's book watercolor illustration. Character: ${charCard} Scene: ${pt.slice(0,130)}.`
      : `${active.child_name} age ${active.age||5} with ${active.stuffed_animal||"stuffed bear"}, scene: ${pt.slice(0,130)}.`;
    return `${base} Style: ${m.prompt}, soft pastel watercolor, dreamy storybook art. No text.`;
  };

  // Persist page position
  useEffect(() => {
    if (story?.id) {
      try { localStorage.setItem("dw_spread_" + story.id, spread); } catch {}
    }
  }, [spread, story]);

  const handleFlip = (dir) => {
    const minSpread = coverImg ? -1 : 0;
    if (mobile) { if (dir==="forward"&&spread<pages.length-1) setSpread(s=>s+1); else if (dir==="back"&&spread>minSpread) setSpread(s=>s-1); else if (typeof dir==="number") setSpread(dir); }
    else { const ts=Math.ceil(pages.length/2); if (dir==="forward"&&spread<ts-1) setSpread(s=>s+1); else if (dir==="back"&&spread>minSpread) setSpread(s=>s-1); else if (typeof dir==="number") setSpread(dir); }
  };

  const generateStory = async () => {
    if (!hasAccess()) return setScreen("paywall");
    if (!active) return;
    setScreen("story"); setStoryPhase("text");
    setStory(null); setTitle(""); setPages([]); setImgs([]); setSpread(-1); setImgsLoaded(0); setCoverImg(null);

    const { data:ex } = await supabase.from("stories").select("*").eq("user_id",user.id).eq("story_date",todayStr()).eq("child_profile_id",active.id).maybeSingle();
    if (ex) {
      const ps = ex.text.split("\n\n✦\n\n");
      const existingImgs = ex.page_images||[];
      setTitle(ex.title||""); setStory(ex); setPages(ps); setCoverImg(ex.cover_image||null);
      if (existingImgs.length===ps.length&&existingImgs.every(Boolean)) { setImgs(existingImgs); setImgsLoaded(ps.length); setStoryPhase("ready"); }
      else {
        const filled=[...existingImgs]; let loaded=existingImgs.filter(Boolean).length; setImgsLoaded(loaded);
        const m=MOODS.find(x=>x.id===mood)||MOODS[0];
        for (let i=0;i<ps.length;i++) {
          if (filled[i]) { if (i===1) setStoryPhase("ready"); continue; }
          const url=await generateImage(imgPromptFor(ps[i],m));
          if (url) { const cached=ex.id?await cacheImage(url,ex.id,i):url; filled[i]=cached; loaded++; setImgsLoaded(loaded); setImgs(prev=>{const n=[...prev];n[i]=cached;return n;}); }
          if (i===1) setStoryPhase("ready");
        }
        if (loaded<=1) setStoryPhase("ready");
        await supabase.from("stories").update({ page_images:filled }).eq("id",ex.id);
      }
      return;
    }

    const m=MOODS.find(x=>x.id===mood)||MOODS[0];
    const lessonData=LESSONS.find(l=>l.id===lesson);
    const isLesson=storyMode==="lesson";
    const charCard = await getCharacterCard(active);

    const storyPrompt=isLesson
      ?`Write a warm personalized bedtime picture book that gently teaches a lesson for:\n${profileText(active)}\nTone: ${m.prompt}.\nLesson to teach: ${lessonData?.prompt||"being kind to others"}.\n\nWrite EXACTLY ${STORY_PAGES} pages, separated by [PAGE].\nEach page = 1-2 SHORT sentences. Pure picture book style — brief, lyrical, beautiful.\nPage 1: introduce child and stuffed animal in a cozy relatable situation that sets up the lesson.\nPages 2-4: adventure begins, a challenge appears that relates to the lesson. Weave in best friend and favorite animal.\nPages 5-7: the heart of the story — child faces the lesson challenge. Show the struggle gently. Let it feel real.\nPages 8-9: child discovers the lesson naturally through the story, feels proud and changed.\nPage 10: child drifts peacefully to sleep, carrying the lesson in their heart.\nThe lesson should feel discovered, never lectured. NO title. Start immediately.`
      :`Write a warm personalized bedtime picture book for:\n${profileText(active)}\nTone: ${m.prompt}.\nWrite EXACTLY ${STORY_PAGES} pages, separated by [PAGE].\nEach page = 1-2 SHORT sentences. Pure picture book style — brief, lyrical, beautiful.\nPage 1: introduce child and stuffed animal in a cozy setting.\nPages 2-4: adventure begins, weave in best friend and favorite animal.\nPages 5-7: heart of story, gently face their fear.\nPages 8-9: resolution, magic and wonder.\nPage 10: child drifts peacefully to sleep.\nNO title. Start immediately.`;

    try {
      const [rawText,rawTitle] = await Promise.all([
        callClaude([{role:"user",content:storyPrompt}],1800),
        callClaude([{role:"user",content:isLesson?`Magical 4-6 word bedtime story title for ${active.child_name} about ${lessonData?.label||"kindness"}. Only the title, nothing else.`:`Magical 4-6 word bedtime story title for ${active.child_name} and ${active.stuffed_animal||"a stuffed bear"}. Only the title, nothing else.`}],30),
      ]);
      const ps=rawText.split("[PAGE]").map(p=>p.trim()).filter(p=>p.length>5).slice(0,STORY_PAGES);
      const fullText=ps.join("\n\n✦\n\n");
      const storyTitle=rawTitle.trim();
      setTitle(storyTitle); setPages(ps);
      // Try insert first; if duplicate exists (same day/child), update it instead
      let saved = null;
      const storyPayload = { user_id:user.id, story_date:todayStr(), text:fullText, title:storyTitle, child_profile_id:active.id, page_images:[], cover_image:null, lesson_type:isLesson?lesson:null, history:[{role:"user",content:storyPrompt},{role:"assistant",content:rawText}] };
      const { data:inserted, error:insertErr } = await supabase.from("stories").insert(storyPayload).select().single();
      if (insertErr) {
        // Likely duplicate - fetch existing and update it
        console.warn("Insert failed, trying update:", insertErr.message);
        const { data:existing } = await supabase.from("stories").select("*").eq("user_id",user.id).eq("story_date",todayStr()).eq("child_profile_id",active.id).maybeSingle();
        if (existing) {
          await supabase.from("stories").update({ text:fullText, title:storyTitle, page_images:[], cover_image:null, history:storyPayload.history }).eq("id",existing.id);
          saved = { ...existing, text:fullText, title:storyTitle };
        }
      } else {
        saved = inserted;
      }
      setStory(saved);

      const coverPrompt=`${active.child_name} age ${active.age||5} with ${active.stuffed_animal||"stuffed bear"}, ${m.prompt} bedtime children's book COVER illustration, dramatic and beautiful, soft watercolor pastel art, dreamy storybook style, bold composition, the title scene. No text.`;
      generateImage(coverPrompt).then(async url => { if (!url) return; const cached=saved?.id?await cacheImage(url,saved.id,"cover"):url; setCoverImg(cached); if (saved?.id) supabase.from("stories").update({ cover_image:cached }).eq("id",saved.id); });

      const generated=new Array(ps.length).fill(null); let loaded=0;
      // Fire ALL images in parallel with stagger - each polls independently
      await Promise.all(ps.map(async (pageText, i) => {
        await new Promise(r => setTimeout(r, i * 1200)); // 1.2s stagger to avoid rate limit
        const url = await generateImage(imgPromptFor(pageText, m, charCard));
        if (url) {
          const cached = saved?.id ? await cacheImage(url, saved.id, i) : url;
          generated[i]=cached; loaded++;
          setImgsLoaded(l => l + 1);
          setImgs(prev=>{const n=[...prev];n[i]=cached;return n;});
          // Save incrementally so partial progress is preserved
          if (saved?.id) supabase.from("stories").update({ page_images:[...generated] }).eq("id",saved.id);
        } else {
          console.warn("Image failed for page", i, "- using gradient fallback");
        }
        if (i===1) setStoryPhase("ready");
      }));
      if (loaded<=1) setStoryPhase("ready");
      // Final save with complete array
      if (saved?.id) await supabase.from("stories").update({ page_images:generated }).eq("id",saved.id);
    await calcStreak(user.id, streak);
    await calcBadges(user.id, streak);
    } catch(e) { console.error(e); setPages(["The story stars are cloudy tonight. Please try again!"]); setStoryPhase("ready"); }
  };

  const continueStory = async () => {
    if (extending) return; setExtending(true);
    const m=MOODS.find(x=>x.id===mood)||MOODS[0];
    const charCard=active?.character_card||null;
    const hist=story?.history||[{role:"user",content:`Write bedtime story for: ${profileText(active)}`},{role:"assistant",content:pages.join("\n\n")}];
    try {
      const raw=await callClaude([...hist,{role:"user",content:`Continue this bedtime story with 4 more short picture book pages, separated by [PAGE]. Each page = 1-2 sentences. Same warm tone and characters. Don't end the story yet.`}],500);
      const newPages=raw.split("[PAGE]").map(p=>p.trim()).filter(p=>p.length>5).slice(0,4);
      const allPages=[...pages,...newPages];
      setPages(allPages); setSpread(Math.floor(pages.length/2));
      if (story?.id) await supabase.from("stories").update({ text:allPages.join("\n\n✦\n\n") }).eq("id",story.id);
      const startIdx=pages.length;
      await Promise.all(newPages.map(async (pt,j) => {
        await new Promise(r => setTimeout(r, j * 1200)); // stagger to avoid 429
        const i=startIdx+j; const url=await generateImage(imgPromptFor(pt,m,charCard)); if (!url) return;
        const cached=story?.id?await cacheImage(url,story.id,i):url;
        setImgs(prev=>{const n=[...prev];n[i]=cached; supabase.from("stories").update({page_images:n}).eq("id",story.id); return n;});
      }));
    } catch(e) { console.error(e); }
    setExtending(false);
  };

  const happyEnding = async () => {
    if (extending) return; setExtending(true);
    const m=MOODS.find(x=>x.id===mood)||MOODS[0];
    const charCard=active?.character_card||null;
    const hist=story?.history||[{role:"user",content:`Write bedtime story for: ${profileText(active)}`},{role:"assistant",content:pages.join("\n\n")}];
    try {
      const raw=await callClaude([...hist,{role:"user",content:`Write a beautiful, warm happy ending for this story in exactly 2 short pages, separated by [PAGE]. Each page = 1-2 sentences. Make it magical, safe, and complete. End with the child drifting happily to sleep.`}],250);
      const endPages=raw.split("[PAGE]").map(p=>p.trim()).filter(p=>p.length>5).slice(0,2);
      const allPages=[...pages,...endPages];
      setPages(allPages); setSpread(Math.floor(pages.length/2));
      if (story?.id) await supabase.from("stories").update({ text:allPages.join("\n\n✦\n\n") }).eq("id",story.id);
      const startIdx=pages.length;
      await Promise.all(endPages.map(async (pt,j) => {
        await new Promise(r => setTimeout(r, j * 1200)); // stagger to avoid 429
        const i=startIdx+j; const url=await generateImage(imgPromptFor(pt,m,charCard)); if (!url) return;
        const cached=story?.id?await cacheImage(url,story.id,i):url;
        setImgs(prev=>{const n=[...prev];n[i]=cached; supabase.from("stories").update({page_images:n}).eq("id",story.id); return n;});
      }));
    } catch(e) { console.error(e); }
    setExtending(false);
  };

  const readAloud = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const li=spread*2, ri=spread*2+1;
    const text=[pages[li],pages[ri]].filter(Boolean).join("...  ");
    if (!text) return;
    const utt = new SpeechSynthesisUtterance(text);

    // Calm, soothing bedtime narration settings
    utt.rate  = 0.72;   // slow and unhurried
    utt.pitch = 0.92;   // slightly lower = warmer, less sharp
    utt.volume = 0.95;

    // Voice priority: prefer warm female voices known to sound soothing
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      "Samantha",        // macOS/iOS - soft, clear American
      "Karen",           // macOS Australian - very warm
      "Moira",           // macOS Irish - gentle lilt
      "Tessa",           // macOS South African - smooth
      "Martha",          // macOS - soft
      "Fiona",           // macOS Scottish - gentle
      "Daniel",          // macOS British male - calm
      "Rishi",           // macOS Indian - warm
    ];
    let chosen = null;
    for (const name of preferred) {
      chosen = voices.find(v => v.name.includes(name));
      if (chosen) break;
    }
    // Fallback: any English female voice
    if (!chosen) chosen = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"));
    // Last resort: any English voice
    if (!chosen) chosen = voices.find(v => v.lang.startsWith("en"));
    if (chosen) utt.voice = chosen;

    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  };

  const [showShareCard, setShowShareCard] = useState(false);

  const shareStory = async () => {
    setShowShareCard(true);
  };

  const copyShareLink = async () => {
    try { await navigator.clipboard.writeText(`${APP_URL}?story=${story?.id}`); } catch {}
    setCopied(true); setTimeout(()=>setCopied(false),2500);
  };

  const downloadShareCard = async () => {
    // Build a canvas share card
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d");

    // Background gradient
    const bg = ctx.createLinearGradient(0,0,1080,1080);
    bg.addColorStop(0,"#0d0620"); bg.addColorStop(1,"#1a0a3e");
    ctx.fillStyle = bg; ctx.fillRect(0,0,1080,1080);

    // Cover image
    if (coverImg || imgs[0]) {
      try {
        const img = new Image(); img.crossOrigin="anonymous";
        await new Promise((res,rej) => { img.onload=res; img.onerror=rej; img.src=coverImg||imgs[0]; });
        ctx.save();
        const r=40, x=80, y=80, w=920, h=680;
        ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); ctx.clip();
        ctx.drawImage(img,80,80,920,680);
        ctx.restore();
        // Gradient overlay on image
        const ov = ctx.createLinearGradient(0,500,0,760);
        ov.addColorStop(0,"transparent"); ov.addColorStop(1,"rgba(13,6,32,.9)");
        ctx.fillStyle=ov; ctx.fillRect(80,80,920,680);
      } catch(e) { console.log("img load failed",e); }
    }

    // Title text
    ctx.fillStyle="white";
    ctx.font="bold italic 54px Georgia, serif";
    ctx.textAlign="center";
    const titleText = title || "A DreamWeaver Story";
    ctx.fillText(titleText.length>36 ? titleText.slice(0,34)+"…" : titleText, 540, 700);

    // Divider
    ctx.strokeStyle="rgba(201,168,76,.5)"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(200,740); ctx.lineTo(880,740); ctx.stroke();

    // Child name
    ctx.font="500 36px Georgia, serif";
    ctx.fillStyle="rgba(255,255,255,.6)";
    ctx.fillText(`A story for ${active?.child_name||"a very special child"} ✦`, 540, 790);

    // DreamWeaver branding
    ctx.font="bold italic 40px Georgia, serif";
    ctx.fillStyle="rgba(201,168,76,.9)";
    ctx.fillText("DreamWeaver", 540, 920);
    ctx.font="26px Georgia, serif";
    ctx.fillStyle="rgba(255,255,255,.3)";
    ctx.fillText("dreamweaverstory.com", 540, 965);

    // Stars decoration
    ["✦","✦","✦"].forEach((s,i) => {
      ctx.font="28px serif"; ctx.fillStyle="rgba(201,168,76,.4)";
      ctx.fillText(s, 310 + i*115, 860);
    });

    // Download
    const link = document.createElement("a");
    link.download = `${title||"dreamweaver-story"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const loadLibrary = async () => { if (!user) return; const { data, error } = await supabase.from("stories").select("*").eq("user_id",user.id).order("story_date",{ ascending:false }); if (error) console.error("Library load error:", error); setLibrary(data||[]); };

  // ── Coloring book ──────────────────────────────────────────────────────────
  const generateColoringPage = async () => {
    if (coloringLoading || !pages.length) return;
    setColoringLoading(true); setColoringUrl(null);
    // Pick the most vivid page (middle of story)
    const bestPage = pages[Math.floor(pages.length / 2)] || pages[0];
    const charCard = active?.character_card || `${active.child_name} age ${active.age||5} with ${active.stuffed_animal||"stuffed bear"}`;
    const prompt = `Black and white children's coloring book page. Clean thick outlines only, no shading, no gray fills, pure white background. Character: ${charCard.slice(0,120)} Scene: ${bestPage.slice(0,120)}. Simple, bold shapes perfect for a child to color in. No text.`;
    const url = await generateImage(prompt, true);
    setColoringUrl(url);
    setColoringLoading(false);
  };

  // ── Badges ─────────────────────────────────────────────────────────────────
  const BADGE_DEFS = [
    { id:"first_story",   emoji:"🌟", label:"First Story",      desc:"Read your very first story",        check:(count,_lib)=>count>=1 },
    { id:"streak_3",      emoji:"🔥", label:"3-Night Streak",   desc:"Read 3 nights in a row",            check:(_,__,s)=>s>=3 },
    { id:"streak_7",      emoji:"🌙", label:"Week of Dreams",   desc:"Read 7 nights in a row",            check:(_,__,s)=>s>=7 },
    { id:"stories_5",     emoji:"📚", label:"Bookworm",         desc:"Completed 5 stories",               check:(count)=>count>=5 },
    { id:"stories_10",    emoji:"🦉", label:"Night Owl",        desc:"Completed 10 stories",              check:(count)=>count>=10 },
    { id:"stories_30",    emoji:"🌠", label:"Stargazer",        desc:"Completed 30 stories",              check:(count)=>count>=30 },
    { id:"first_lesson",  emoji:"✨", label:"Life Learner",     desc:"Read your first Life Lesson story", check:(_,lib)=>lib.some(s=>s.lesson_type) },
    { id:"all_lessons",   emoji:"🎓", label:"Wise One",         desc:"Read all 10 different lessons",     check:(_,lib)=>new Set(lib.filter(s=>s.lesson_type).map(s=>s.lesson_type)).size>=10 },
    { id:"all_moods",     emoji:"🌈", label:"Mood Master",      desc:"Tried all 5 story moods",           check:(_,lib)=>new Set(lib.map(s=>s.mood).filter(Boolean)).size>=5 },
    { id:"sharer",        emoji:"🔗", label:"Storyteller",      desc:"Shared a story with someone",       check:(_,lib)=>lib.some(s=>s.shared) },
  ];

  const calcBadges = async (uid, currentStreak) => {
    const { data: lib } = await supabase.from("stories").select("*").eq("user_id", uid);
    if (!lib) return;
    const count = lib.length;
    const earned = BADGE_DEFS.filter(b => b.check(count, lib, currentStreak)).map(b => b.id);
    const { data: existing } = await supabase.from("badges").select("badge_id").eq("user_id", uid);
    const existingIds = new Set((existing||[]).map(b => b.badge_id));
    const brandNew = earned.filter(id => !existingIds.has(id));
    if (brandNew.length) {
      await supabase.from("badges").insert(brandNew.map(badge_id => ({ user_id:uid, badge_id })));
      const def = BADGE_DEFS.find(b => b.id === brandNew[0]);
      if (def) { setNewBadge(def); setTimeout(() => setNewBadge(null), 4000); }
    }
    setBadges(earned);
  };

  const W = { maxWidth:460, width:"100%", padding:"0 2px" };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <StarField />
      <div className="wrap">

        {/* SPLASH */}
        {screen==="splash" && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"80vh" }}>
            <div style={{ animation:"float 3s ease-in-out infinite" }}><DreamweaverLogo size={52} showText={true} /></div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LANDING
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="landing" && (
          <div className="fade" style={{ maxWidth:900, width:"100%", paddingBottom:80 }}>

            {/* ── HERO ── */}
            <div style={{ textAlign:"center", paddingTop:"clamp(32px,7vw,72px)", paddingBottom:"clamp(48px,8vw,80px)", position:"relative" }}>
              {/* Deep halo */}
              <div style={{ position:"absolute", top:"-10%", left:"50%", transform:"translateX(-50%)", width:"100vw", maxWidth:700, height:"60vw", maxHeight:420, background:"radial-gradient(ellipse at 50% 0%,rgba(130,70,255,.13) 0%,rgba(80,40,180,.07) 40%,transparent 70%)", pointerEvents:"none" }} />

              {/* Logo */}
              <div style={{ marginBottom:24 }}>
                <DreamweaverLogo size={36} showText={true} />
              </div>

              {/* Pill badge */}
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)", borderRadius:999, padding:"7px 18px", marginBottom:28 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#c084fc", display:"inline-block", boxShadow:"0 0 8px #c084fc", flexShrink:0, animation:"pulse 2.5s ease-in-out infinite" }} />
                <span style={{ color:"rgba(255,255,255,.55)", fontSize:12, fontWeight:600, letterSpacing:".08em", fontFamily:"'Nunito',sans-serif" }}>7 Nights Free · No Credit Card</span>
              </div>

              {/* Headline */}
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(36px,8vw,78px)", lineHeight:1.1, marginBottom:22, letterSpacing:"-.02em" }}>
                Your Child Is
                <em style={{ background:"linear-gradient(120deg,#f6d98a 0%,#e8b84b 45%,#c9a030 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", fontStyle:"italic" }}>
                  The Hero. Every Night.
                </em>
              </h1>

              <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(17px,2.8vw,22px)", color:"rgba(255,255,255,.45)", lineHeight:1.75, maxWidth:520, margin:"0 auto 38px", fontStyle:"italic" }}>
                Every night, a brand new 10-page illustrated picture book — starring your child's name, stuffed animal, best friend, and the things they love most.
              </p>

              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                <button className="btn-cta" style={{ fontSize:"clamp(15px,2.5vw,17px)", padding:"clamp(16px,3vw,20px) clamp(32px,6vw,52px)", borderRadius:999 }} onClick={()=>setScreen("signup")}>
                  Start Free Tonight ✨
                </button>
                <button onClick={()=>setScreen("login")} style={{ background:"none", border:"none", color:"rgba(255,255,255,.28)", fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif", padding:"8px 16px" }}>
                  Already Have An Account →
                </button>
              </div>
            </div>

            {/* ── DEMO BOOK ── */}
            <div style={{ marginBottom:"clamp(64px,10vw,100px)" }}>
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,255,255,.2)" }}>Live Preview</span>
                <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", color:"rgba(255,255,255,.4)", fontSize:15, marginTop:4 }}>Lily's Moonlit Adventure — A Sample Story</p>
              </div>

              {(mobile||tablet) ? (
                <div style={{ maxWidth:380, margin:"0 auto" }}>
                  <div style={{ borderRadius:20, overflow:"hidden", boxShadow:"0 40px 80px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.06)" }}>
                    <div style={{ background:"linear-gradient(175deg,#fefcf7,#fdf9f0)" }}>
                      <div style={{ width:"100%", aspectRatio:"16/9", position:"relative", overflow:"hidden", background:DEMO_STORY[demoSpread]?.fallback }}>
                        <img src={DEMO_STORY[demoSpread]?.img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{e.target.style.display="none";}} />
                        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:32, background:"linear-gradient(to bottom,transparent,rgba(254,252,247,.95))" }} />
                      </div>
                      <div style={{ padding:"18px 22px 22px" }}>
                        <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:16, lineHeight:1.85, color:"#1a0f2e", textAlign:"center", fontStyle:"italic" }}>{DEMO_STORY[demoSpread]?.text}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:14 }}>
                    {DEMO_STORY.map((_,i) => <div key={i} onClick={()=>setDemoSpread(i)} style={{ width:i===demoSpread?20:6, height:6, borderRadius:99, background:i===demoSpread?"var(--gold)":"rgba(255,255,255,.15)", cursor:"pointer", transition:"all .3s" }} />)}
                  </div>
                </div>
              ) : (
                <div style={{ perspective:"2000px" }}>
                  <div style={{ display:"flex", maxWidth:820, margin:"0 auto", borderRadius:20, overflow:"hidden", boxShadow:"0 60px 120px rgba(0,0,0,.85),0 20px 40px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05)" }}>
                    {/* Spine */}
                    <div style={{ width:22, flexShrink:0, background:"linear-gradient(90deg,#0a0300,#4a2008 40%,#7a3510 50%,#4a2008 60%,#0a0300)", position:"relative" }}>
                      <div style={{ position:"absolute", top:0, bottom:0, left:"50%", width:1, background:"linear-gradient(180deg,transparent 5%,rgba(201,168,76,.3) 50%,transparent 95%)" }} />
                    </div>
                    {[0,1].map(side => {
                      const idx=demoSpread*2+side, page=DEMO_STORY[idx];
                      return (
                        <div key={side} style={{ flex:1, display:"flex", flexDirection:"column", background:side===0?"linear-gradient(175deg,#fefcf7,#fdf9f0)":"linear-gradient(175deg,#fdfaf2,#faf5e8)", borderLeft:side===1?"1px solid rgba(0,0,0,.06)":"none" }}>
                          <div style={{ width:"100%", aspectRatio:"4/3", position:"relative", overflow:"hidden", background:page?.fallback||"#1a0a2e" }}>
                            <img src={page?.img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={e=>{e.target.style.display="none";e.target.parentElement.style.background=page?.fallback;}} />
                            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:40, background:`linear-gradient(to bottom,transparent,${side===0?"rgba(254,252,247,.95)":"rgba(253,250,242,.95)"})` }} />
                            <div style={{ position:"absolute", bottom:10, [side===0?"right":"left"]:10, background:"rgba(255,255,255,.85)", backdropFilter:"blur(4px)", borderRadius:99, padding:"2px 9px", fontSize:10, color:"#1a0f2e", fontWeight:700 }}>{idx+1}</div>
                          </div>
                          <div style={{ flex:1, padding:"14px 20px 18px", display:"flex", alignItems:"center", minHeight:70 }}>
                            <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(12px,1.4vw,15px)", lineHeight:1.9, color:"#1a0f2e", textAlign:"center", width:"100%", fontStyle:"italic" }}>{page?.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:9, marginTop:16 }}>
                    {[0,1].map(i => <div key={i} onClick={()=>setDemoSpread(i)} style={{ width:i===demoSpread?26:7, height:7, borderRadius:99, background:i===demoSpread?"var(--gold)":"rgba(255,255,255,.15)", cursor:"pointer", transition:"all .3s", boxShadow:i===demoSpread?"0 0 12px rgba(201,168,76,.5)":"none" }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* ── HOW IT WORKS ── */}
            <div style={{ marginBottom:"clamp(64px,10vw,100px)" }}>
              <div style={{ textAlign:"center", marginBottom:36 }}>
                <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,255,255,.2)" }}>How it works</span>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,5vw,42px)", fontStyle:"italic", marginTop:10, lineHeight:1.2 }}>Three Steps To Bedtime Magic</h2>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":tablet?"repeat(2,1fr)":"repeat(3,1fr)", gap:16 }}>
                {[
                  { n:"01", icon:"👧", title:"Tell Us About Your Child", desc:"Name, age, stuffed animal, best friend, favorite things — every detail gets woven into the story.", color:"rgba(192,132,252,.12)", border:"rgba(192,132,252,.2)" },
                  { n:"02", icon:"✨", title:"Add A Photo (Optional)", desc:"Upload a photo and our AI captures their look — hair color, eye color, skin tone — so the characters look just like your child.", color:"rgba(251,191,36,.08)", border:"rgba(251,191,36,.18)" },
                  { n:"03", icon:"🌙", title:"Open Tonight's Book", desc:"In about 40 seconds, a fully illustrated 10-page picture book is ready. Read it together and drift off to sleep.", color:"rgba(103,232,249,.08)", border:"rgba(103,232,249,.18)" },
                ].map(({n,icon,title,desc,color,border}) => (
                  <div key={n} style={{ padding:"clamp(20px,3vw,28px)", borderRadius:20, background:color, border:`1px solid ${border}`, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:16, right:18, fontFamily:"'Playfair Display',serif", fontSize:48, fontStyle:"italic", color:"rgba(255,255,255,.04)", lineHeight:1, fontWeight:800 }}>{n}</div>
                    <div style={{ fontSize:32, marginBottom:14 }}>{icon}</div>
                    <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,2.2vw,19px)", marginBottom:10, lineHeight:1.3 }}>{title}</h3>
                    <p style={{ color:"rgba(255,255,255,.38)", fontSize:"clamp(13px,1.5vw,14px)", lineHeight:1.75, fontFamily:"'Crimson Pro',serif" }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── FEATURES GRID ── */}
            <div style={{ marginBottom:"clamp(64px,10vw,100px)" }}>
              <div style={{ textAlign:"center", marginBottom:36 }}>
                <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,255,255,.2)" }}>Everything included</span>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,5vw,42px)", fontStyle:"italic", marginTop:10, lineHeight:1.2 }}>One Subscription. A Lifetime Of Stories.</h2>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr 1fr":tablet?"repeat(2,1fr)":"repeat(3,1fr)", gap:12 }}>
                {[
                  { icon:"🎨", title:"AI Watercolor Art",      desc:"Every page gets a unique hand-painted watercolor illustration", big:false },
                  { icon:"📸", title:"Illustrated Like Them",  desc:"Upload a photo and the hero looks just like your child", big:false },
                  { icon:"🧸", title:"Deeply Personalized",    desc:"Name, stuffed animal, best friend, fears — woven into every page naturally", big:true },
                  { icon:"✨", title:"Life Lesson Stories",    desc:"Pick a value — kindness, bravery, patience — your child discovers it through adventure, never a lecture", big:true },
                  { icon:"📖", title:"10 Pages Every Night",   desc:"A complete illustrated picture book every single night", big:false },
                  { icon:"🔊", title:"Read Aloud Voice",       desc:"Calm, soothing narration reads the story aloud at bedtime", big:false },
                  { icon:"🎨", title:"Coloring Book Mode",     desc:"Turn any story into a printable coloring page your child can color in", big:false },
                  { icon:"📚", title:"Story Library",          desc:"Every story saved forever — revisit old favorites anytime", big:false },
                  { icon:"🏅", title:"Milestone Badges",       desc:"Kids earn badges for reading streaks, adventures, and milestones", big:false },
                ].map(({icon,title,desc,big}) => (
                  <div key={title} style={{ padding:"clamp(16px,2.5vw,24px)", borderRadius:18, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", gridColumn:big&&!mobile?"span 1":"span 1", transition:"border-color .2s" }}>
                    <div style={{ fontSize:"clamp(22px,3vw,28px)", marginBottom:10 }}>{icon}</div>
                    <div style={{ fontWeight:700, fontSize:"clamp(13px,1.5vw,14px)", color:"rgba(255,255,255,.88)", marginBottom:6, fontFamily:"'Nunito',sans-serif" }}>{title}</div>
                    <div style={{ fontSize:"clamp(12px,1.3vw,13px)", color:"rgba(255,255,255,.32)", lineHeight:1.65, fontFamily:"'Crimson Pro',serif" }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── LIFE LESSONS SECTION ── */}
            <div style={{ marginBottom:"clamp(64px,10vw,100px)", position:"relative" }}>
              <div style={{ position:"absolute", inset:"-60px", background:"radial-gradient(ellipse at 50% 50%,rgba(34,197,94,.05) 0%,transparent 70%)", pointerEvents:"none" }} />
              <div style={{ position:"relative", borderRadius:"clamp(22px,3.5vw,32px)", overflow:"hidden", background:"linear-gradient(150deg,rgba(6,20,13,.98),rgba(4,16,10,.99))", border:"1px solid rgba(74,222,128,.15)" }}>
                <div style={{ height:2, background:"linear-gradient(90deg,#14532d,#22c55e,#4ade80,#86efac,#4ade80,#22c55e,#14532d)", backgroundSize:"220% 100%", animation:"gradFlow 3s linear infinite" }} />
                <div style={{ padding:"clamp(28px,5vw,52px) clamp(24px,4vw,48px)" }}>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(74,222,128,.1)", border:"1px solid rgba(74,222,128,.22)", borderRadius:999, padding:"4px 14px", marginBottom:22 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:"#4ade80", boxShadow:"0 0 6px #4ade80", flexShrink:0 }} />
                    <span style={{ color:"#4ade80", fontSize:10, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase" }}>Life Lesson Stories</span>
                  </div>
                  <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(24px,4.5vw,38px)", fontStyle:"italic", marginBottom:14, lineHeight:1.2, color:"white" }}>
                    Stories That Teach,<br/>Not Preach
                  </h3>
                  <p style={{ color:"rgba(255,255,255,.4)", fontSize:"clamp(14px,1.7vw,16px)", lineHeight:1.85, fontFamily:"'Crimson Pro',serif", marginBottom:28, maxWidth:480 }}>
                    Choose a value and DreamWeaver weaves it naturally into your child's adventure. No moralizing — they discover the lesson themselves through the magic of the story.
                  </p>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:28 }}>
                    {[{e:"🤝",l:"Sharing"},{e:"💛",l:"Kindness"},{e:"🦁",l:"Bravery"},{e:"🌟",l:"Honesty"},{e:"🌱",l:"Patience"},{e:"💪",l:"Keep Trying"},{e:"🌈",l:"Big Feelings"},{e:"👫",l:"Friendship"},{e:"🙏",l:"Gratitude"},{e:"🌍",l:"Nature"}].map(({e,l})=>(
                      <span key={l} className="l-pill"><span>{e}</span><span>{l}</span></span>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:10, overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", paddingBottom:4 }}>
                    {[
                      {lesson:"💛 Kindness", text:"Emma saw the lonely bunny sitting alone, and felt something warm bloom in her chest…", bg:"rgba(251,191,36,.08)", bd:"rgba(251,191,36,.2)", lc:"#fde68a"},
                      {lesson:"🦁 Bravery",  text:"The dark cave looked scary. But Max squeezed his bear and took one brave step inside…", bg:"rgba(251,146,60,.08)", bd:"rgba(251,146,60,.2)", lc:"#fed7aa"},
                      {lesson:"🌱 Patience", text:"The tiny seed didn't sprout overnight. Lily watered it every single morning and waited…", bg:"rgba(74,222,128,.07)", bd:"rgba(74,222,128,.2)", lc:"#bbf7d0"},
                    ].map(({lesson,text,bg,bd,lc})=>(
                      <div key={lesson} className="snip" style={{ flex:"0 0 auto", width:"clamp(180px,48vw,220px)", background:bg, border:`1px solid ${bd}` }}>
                        <div style={{ color:lc, fontSize:10.5, fontWeight:700, letterSpacing:".05em", marginBottom:7 }}>{lesson}</div>
                        <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", color:"rgba(255,255,255,.48)", fontSize:12.5, lineHeight:1.65, margin:0 }}>{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SOCIAL PROOF ── */}
            <div style={{ marginBottom:"clamp(64px,10vw,100px)" }}>
              <div style={{ textAlign:"center", marginBottom:32 }}>
                <div style={{ display:"flex", justifyContent:"center", gap:2, marginBottom:10 }}>
                  {"★★★★★".split("").map((s,i) => <span key={i} style={{ color:"#fbbf24", fontSize:20 }}>{s}</span>)}
                </div>
                <p style={{ color:"rgba(255,255,255,.3)", fontSize:13, fontFamily:"'Nunito',sans-serif" }}>Loved By Families Everywhere</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":tablet?"repeat(2,1fr)":"repeat(3,1fr)", gap:14 }}>
                {[
                  { quote:"My daughter asks for her story every single night now. She loves that her stuffed bunny Mr. Hops is always the hero.", name:"Sarah M.", role:"Mom of a 5-year-old" },
                  { quote:"The illustrations are gorgeous. It genuinely looks like a real children's picture book — I'm blown away every time.", name:"James T.", role:"Dad of twins" },
                  { quote:"We used the 'bravery' lesson when my son was scared of the dark. He asked to read it three nights in a row.", name:"Priya K.", role:"Mom of a 6-year-old" },
                ].map(({quote,name,role}) => (
                  <div key={name} style={{ padding:"clamp(18px,2.5vw,24px)", borderRadius:18, background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)" }}>
                    <div style={{ color:"#fbbf24", fontSize:14, marginBottom:10, letterSpacing:2 }}>★★★★★</div>
                    <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", color:"rgba(255,255,255,.55)", fontSize:"clamp(13px,1.5vw,15px)", lineHeight:1.75, marginBottom:14 }}>"{quote}"</p>
                    <div style={{ fontWeight:700, fontSize:13, color:"rgba(255,255,255,.7)", fontFamily:"'Nunito',sans-serif" }}>{name}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif" }}>{role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── PRICING ── */}
            <div style={{ marginBottom:"clamp(64px,10vw,100px)" }}>
              <div style={{ textAlign:"center", marginBottom:32 }}>
                <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,255,255,.2)" }}>Pricing</span>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,5vw,42px)", fontStyle:"italic", marginTop:10, lineHeight:1.2 }}>Less Than A Coffee A Month</h2>
              </div>
              <div style={{ maxWidth:360, margin:"0 auto", borderRadius:24, overflow:"hidden", background:"linear-gradient(150deg,rgba(60,20,120,.4),rgba(30,10,80,.5))", border:"1px solid rgba(160,100,255,.2)", position:"relative" }}>
                <div style={{ height:2, background:"linear-gradient(90deg,#7c3aed,#a78bfa,#c084fc,#a78bfa,#7c3aed)", backgroundSize:"220% 100%", animation:"gradFlow 3s linear infinite" }} />
                <div style={{ padding:"clamp(28px,4vw,40px)" }}>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(192,132,252,.12)", border:"1px solid rgba(192,132,252,.22)", borderRadius:999, padding:"4px 14px", marginBottom:20 }}>
                    <span style={{ color:"#c084fc", fontSize:10, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase" }}>✨ 7 nights free</span>
                  </div>
                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(44px,8vw,60px)", fontWeight:800, lineHeight:1 }}>$5.99</span>
                      <span style={{ color:"rgba(255,255,255,.35)", fontSize:16 }}>/month</span>
                    </div>
                    <p style={{ color:"rgba(255,255,255,.3)", fontSize:13, marginTop:8, fontFamily:"'Nunito',sans-serif" }}>
                      For 1 child · <span style={{ color:"rgba(192,132,252,.7)" }}>+$2.99/month per additional child</span>
                    </p>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:11, marginBottom:28 }}>
                    {["10-Page Illustrated Story Every Night","AI Watercolor Art On Every Page","Photo-Matched Character Illustrations","Life Lesson Story Mode","Read Aloud Narrator","Story Library Saved Forever","Coloring Book Generator","Milestone Badges For Kids","Add More Kids For +$2.99/mo Per Additional Child","Cancel Anytime"].map(f => (
                      <div key={f} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ color:"#a78bfa", fontSize:14, flexShrink:0 }}>✦</span>
                        <span style={{ color:"rgba(255,255,255,.6)", fontSize:"clamp(13px,1.5vw,14px)", fontFamily:"'Nunito',sans-serif" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn-cta full" style={{ borderRadius:14 }} onClick={()=>setScreen("signup")}>Start Free — 7 Nights Free ✨</button>
                  <p style={{ color:"rgba(255,255,255,.2)", fontSize:11, textAlign:"center", marginTop:12 }}>No Credit Card Required · Cancel Anytime</p>
                </div>
              </div>
            </div>

            {/* ── BOTTOM CTA ── */}
            <div style={{ textAlign:"center", padding:"clamp(52px,7vw,80px) clamp(24px,5vw,60px)", position:"relative", overflow:"hidden", borderRadius:"clamp(24px,4vw,36px)", background:"linear-gradient(155deg,rgba(40,15,100,.35),rgba(15,5,50,.45))", border:"1px solid rgba(150,100,255,.12)" }}>
              <div style={{ position:"absolute", top:"-20%", left:"50%", transform:"translateX(-50%)", width:"80%", height:"140%", background:"radial-gradient(ellipse,rgba(110,60,200,.1) 0%,transparent 65%)", pointerEvents:"none" }} />
              <div style={{ fontSize:"clamp(44px,8vw,64px)", marginBottom:16, filter:"drop-shadow(0 0 28px rgba(200,170,80,.45))", animation:"float 5s ease-in-out infinite", position:"relative" }}>🌙</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,5vw,44px)", fontStyle:"italic", marginBottom:12, position:"relative", lineHeight:1.2 }}>
                Tonight's Story<br/>Is Waiting
              </h3>
              <p style={{ color:"rgba(255,255,255,.32)", marginBottom:32, fontFamily:"'Crimson Pro',serif", fontSize:"clamp(15px,2vw,18px)", lineHeight:1.8, position:"relative" }}>
                Join families everywhere who've made bedtime<br/>the most magical part of their child's day.
              </p>
              <div style={{ maxWidth:320, margin:"0 auto", position:"relative", display:"flex", flexDirection:"column", gap:12 }}>
                <button className="btn-cta full" style={{ fontSize:"clamp(15px,2.5vw,17px)", padding:"clamp(17px,3vw,22px)" }} onClick={()=>setScreen("signup")}>Create Free Account ✨</button>
                <button onClick={()=>setScreen("login")} style={{ background:"none", border:"none", color:"rgba(255,255,255,.25)", fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Already Have An Account →</button>
              </div>
            </div>

          </div>
        )}


                {/* ═══════════════════════════════════════════════════════════════════
            LOGIN
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="login" && (
          <div className="fade" style={{ maxWidth:420, width:"100%", display:"flex", flexDirection:"column", justifyContent:"center", minHeight:"75vh", gap:0 }}>
            <div style={{ textAlign:"center", marginBottom:28 }}>
              <DreamweaverLogo size={42} showText={true} />
              <p style={{ color:"rgba(255,255,255,.3)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", marginTop:12, fontSize:15 }}>Bedtime stories, reimagined</p>
            </div>
            <div className="form-card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20 }}>Welcome back</h2>
              {err && <p className="err">{err}</p>}
              {[{k:"email",l:"Email",t:"email",ph:"you@example.com"},{k:"password",l:"Password",t:"password",ph:"••••••••"}].map(f => (
                <div key={f.k}><label style={LBL}>{f.l}</label><input type={f.t} placeholder={f.ph} value={af[f.k]} onChange={e=>setAf({...af,[f.k]:e.target.value})} onKeyDown={e=>e.key==="Enter"&&login()} /></div>
              ))}
              <button className="btn-solid" style={{ marginTop:4 }} onClick={login}>Sign In</button>
              <p style={{ textAlign:"center", color:"rgba(255,255,255,.3)", fontSize:14 }}>No account? <span className="lnk" onClick={()=>{setErr("");setScreen("signup");}}>Start free trial</span></p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SIGNUP
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="signup" && (
          <div className="fade" style={{ maxWidth:420, width:"100%", display:"flex", flexDirection:"column", justifyContent:"center", minHeight:"80vh" }}>
            <div style={{ textAlign:"center", marginBottom:22 }}>
              <div style={{ fontSize:"clamp(44px,10vw,56px)", marginBottom:10, animation:"float 4s ease-in-out infinite" }}>🌙</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,6vw,32px)" }}>DreamWeaver</h1>
            </div>
            <div className="form-card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20 }}>Start your free trial</h2>
                <p style={{ color:"rgba(255,255,255,.3)", fontSize:13, marginTop:5 }}>7 Nights Free · $5.99/mo · +$2.99 per additional child</p>
              </div>
              {err && <p className="err">{err}</p>}
              {[{k:"name",l:"Your Name",t:"text",ph:"Parent's name"},{k:"email",l:"Email",t:"email",ph:"you@example.com"},{k:"password",l:"Password",t:"password",ph:"Create a password"}].map(f => (
                <div key={f.k}><label style={LBL}>{f.l}</label><input type={f.t} placeholder={f.ph} value={af[f.k]} onChange={e=>setAf({...af,[f.k]:e.target.value})} onKeyDown={e=>e.key==="Enter"&&signup()} /></div>
              ))}
              <button className="btn-solid" style={{ marginTop:4 }} onClick={signup}>Create Free Account</button>
              <p style={{ textAlign:"center", color:"rgba(255,255,255,.3)", fontSize:14 }}>Have an account? <span className="lnk" onClick={()=>{setErr("");setScreen("login");}}>Sign in</span></p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            WIZARD
        ══════════════════════════════════════════════════════════════════════ */}
        {/* ═══════════════════════════════════════════════════════════════════
            WELCOME — shown to new users before wizard
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="welcome" && (
          <div className="fade" style={{ maxWidth:440, width:"100%", textAlign:"center", paddingTop:"clamp(32px,8vw,60px)", paddingBottom:40 }}>
            {/* Logo */}
            <div style={{ marginBottom:28 }}>
              <DreamweaverLogo size={44} showText={true} />
            </div>

            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,6vw,36px)", lineHeight:1.2, marginBottom:14 }}>
              Welcome to<br/>
              <em style={{ background:"linear-gradient(120deg,#c084fc 0%,#a78bfa 40%,#67e8f9 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                your child's story world
              </em>
            </h1>
            <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", color:"rgba(255,255,255,.4)", fontSize:"clamp(15px,3.5vw,18px)", lineHeight:1.8, marginBottom:36, maxWidth:360, margin:"0 auto 36px" }}>
              Every night, a brand new illustrated picture book — starring your child as the hero.
            </p>

            {/* Steps preview */}
            <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:36, textAlign:"left" }}>
              {[
                { n:"1", icon:"👧", title:"Tell us about your child", desc:"Name, stuffed animal, best friend — takes 2 minutes." },
                { n:"2", icon:"🌙", title:"Open tonight's story", desc:"A 10-page illustrated book generates in ~40 seconds." },
                { n:"3", icon:"📸", title:"Add a photo (optional)", desc:"We'll make the illustrations look just like them." },
              ].map(({n,icon,title,desc}) => (
                <div key={n} style={{ display:"flex", gap:14, alignItems:"flex-start", padding:"14px 16px", borderRadius:16, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(192,132,252,.15)", border:"1px solid rgba(192,132,252,.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:16 }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:"rgba(255,255,255,.85)", fontFamily:"'Nunito',sans-serif", marginBottom:3 }}>{title}</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,.35)", fontFamily:"'Crimson Pro',serif" }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-cta full" style={{ marginBottom:10 }}
              onClick={()=>{setWizStep(0);setPf({child_name:"",age:"",stuffed_animal:"",best_friend:"",favorite_animal:"",scared_of:"",favorite_thing:""});setScreen("wizard");}}>
              Let's Create Their First Story ✨
            </button>
            <p style={{ color:"rgba(255,255,255,.18)", fontSize:12, marginTop:8 }}>7 Nights Free · No Credit Card Required</p>
          </div>
        )}

        {screen==="wizard" && (
          <div className="fade" style={{ maxWidth:420, width:"100%", display:"flex", flexDirection:"column", justifyContent:"center", minHeight:"80vh" }}>
            {/* Progress */}
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ color:"rgba(255,255,255,.35)", fontSize:13 }}>Step {wizStep+1} of {WIZARD_STEPS.length}</span>
                <span style={{ color:"rgba(255,255,255,.25)", fontSize:13 }}>{Math.round(((wizStep+1)/WIZARD_STEPS.length)*100)}%</span>
              </div>
              <div style={{ height:3, background:"rgba(255,255,255,.07)", borderRadius:99 }}>
                <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#5a3a9e,#a07ff0)", width:`${((wizStep+1)/WIZARD_STEPS.length)*100}%`, transition:"width .4s ease" }} />
              </div>
            </div>
            <div className="form-card">
              <div style={{ textAlign:"center", marginBottom:22 }}>
                <div style={{ fontSize:"clamp(36px,9vw,46px)", marginBottom:12 }}>{WIZARD_STEPS[wizStep].emoji}</div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(18px,4.5vw,22px)", lineHeight:1.35, marginBottom:6 }}>{WIZARD_STEPS[wizStep].label}</h2>
                <p style={{ color:"rgba(255,255,255,.28)", fontSize:13 }}>{WIZARD_STEPS[wizStep].hint}</p>
              </div>
              {err && <p className="err" style={{ marginBottom:12 }}>{err}</p>}
              {wizStep < WIZARD_STEPS.length ? (
                <>
                  <input style={{ marginBottom:18 }} type={WIZARD_STEPS[wizStep].type||"text"} placeholder={WIZARD_STEPS[wizStep].placeholder} value={pf[WIZARD_STEPS[wizStep].key]||""} onChange={e=>setPf({...pf,[WIZARD_STEPS[wizStep].key]:e.target.value})} onKeyDown={e=>e.key==="Enter"&&wizNext()} autoFocus />
                  <div style={{ display:"flex", gap:10 }}>
                    {wizStep>0 && <button className="btn-soft" style={{ flexShrink:0, width:"auto", padding:"14px 18px" }} onClick={()=>setWizStep(wizStep-1)}>← Back</button>}
                    <button className="btn-solid" style={{ flex:1 }} onClick={wizNext}>Next →</button>
                  </div>
                </>
              ) : (
                /* Photo step - final step */
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
                  <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(18px,4.5vw,22px)", marginBottom:6 }}>Add a photo of {pf.child_name||"your child"}</h2>
                  <p style={{ color:"rgba(255,255,255,.35)", fontSize:13, marginBottom:20 }}>We'll use it to make the illustrations look like them ✨</p>

                  {photoPreview ? (
                    <div style={{ marginBottom:20 }}>
                      <img src={photoPreview} alt="child" style={{ width:120, height:120, borderRadius:"50%", objectFit:"cover", border:"3px solid rgba(201,168,76,.5)", boxShadow:"0 0 24px rgba(201,168,76,.2)" }} />
                      {photoAnalyzing && <p style={{ color:"rgba(180,143,255,.8)", fontSize:13, marginTop:10 }}>✨ Capturing their look…</p>}
                      {!photoAnalyzing && pf.character_card && <p style={{ color:"rgba(255,255,255,.4)", fontSize:12, marginTop:10, fontStyle:"italic" }}>"{pf.character_card.slice(0,80)}…"</p>}
                      <button className="btn-soft" style={{ marginTop:12, fontSize:12 }} onClick={()=>{setPhotoPreview(null);setPhotoFile(null);setPf(p=>({...p,character_card:""}));}}>Remove photo</button>
                    </div>
                  ) : (
                    <label style={{ display:"block", marginBottom:16, cursor:"pointer" }}>
                      <div style={{ border:"2px dashed rgba(255,255,255,.15)", borderRadius:16, padding:"28px 20px", background:"rgba(255,255,255,.03)", transition:"all .2s" }}
                        onDragOver={e=>e.preventDefault()}
                        onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("image/"))handlePhotoUpload(f);}}>
                        <div style={{ fontSize:32, marginBottom:8 }}>🖼️</div>
                        <p style={{ color:"rgba(255,255,255,.4)", fontSize:14 }}>Tap to upload or drag a photo</p>
                        <p style={{ color:"rgba(255,255,255,.2)", fontSize:12, marginTop:4 }}>Works best with a clear face photo</p>
                      </div>
                      <input type="file" accept="image/*" capture="user" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)handlePhotoUpload(f);}} />
                    </label>
                  )}

                  <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                    <button className="btn-soft" style={{ flexShrink:0, width:"auto", padding:"14px 18px" }} onClick={()=>setWizStep(WIZARD_STEPS.length-1)}>← Back</button>
                    <button className="btn-solid" style={{ flex:1 }} onClick={saveProfile} disabled={photoAnalyzing || !photoPreview}>
                      {photoAnalyzing ? "✨ Analyzing…" : "Start telling stories ✨"}
                    </button>
                  </div>
                  <button className="btn-soft" style={{ width:"100%", opacity:.7 }} onClick={saveProfile}>
                    Skip for now — add photo later
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            HOME
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="home" && active && (
          <div className="fade has-bottom-nav" style={{ maxWidth:tablet?640:480, width:"100%", padding: tablet ? "0 8px" : undefined }}>
            {/* Top bar */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {streak>0 && (
                  <div style={{ background:streakCelebrate?"rgba(255,155,40,.2)":"rgba(255,155,40,.1)", border:`1px solid ${streakCelebrate?"rgba(255,155,40,.6)":"rgba(255,155,40,.22)"}`, borderRadius:999, padding:"5px 12px", display:"flex", gap:6, alignItems:"center", transition:"all .4s", transform:streakCelebrate?"scale(1.12)":"scale(1)", boxShadow:streakCelebrate?"0 0 20px rgba(255,155,40,.4)":"none" }}>
                    <span style={{ animation:streakCelebrate?"wiggle .4s ease-in-out 3":"none", display:"inline-block" }}>🔥</span>
                    <span style={{ color:"#ffb347", fontSize:13, fontWeight:700 }}>{streak} night{streak!==1?"s":""}</span>
                    {streakCelebrate && <span style={{ color:"#ffd700", fontSize:11, fontWeight:800 }}>🎉</span>}
                  </div>
                )}
                {/* Milestone celebration overlay */}
                {streakCelebrate && streakMilestone && (
                  <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, pointerEvents:"none" }}>
                    <div style={{ textAlign:"center", animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)", background:"linear-gradient(155deg,rgba(30,10,80,.96),rgba(20,5,50,.98))", border:"1px solid rgba(255,155,40,.4)", borderRadius:28, padding:"clamp(28px,5vw,44px) clamp(24px,5vw,52px)", boxShadow:"0 0 80px rgba(255,155,40,.3),0 30px 80px rgba(0,0,0,.8)", pointerEvents:"auto" }}>
                      <div style={{ fontSize:"clamp(52px,12vw,72px)", marginBottom:14, animation:"float 2s ease-in-out infinite" }}>🔥</div>
                      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(24px,6vw,34px)", marginBottom:8, lineHeight:1.2, background:"linear-gradient(120deg,#ffd700,#ffb347)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                        {streakMilestone}-Night Streak!
                      </h2>
                      <p style={{ color:"rgba(255,255,255,.5)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(14px,3vw,17px)", lineHeight:1.7 }}>
                        {streakMilestone===3 && "Three nights of magic in a row ✨"}
                        {streakMilestone===7 && "A whole week of bedtime stories 🌙"}
                        {streakMilestone===30 && "Thirty nights — you're a DreamWeaver legend ⭐"}
                      </p>
                      <div style={{ marginTop:16, display:"flex", gap:4, justifyContent:"center" }}>
                        {Array.from({length:Math.min(streakMilestone,7)}).map((_,i)=>(
                          <span key={i} style={{ fontSize:18, animation:`popIn .3s ${i*0.08}s both` }}>🔥</span>
                        ))}
                        {streakMilestone>7 && <span style={{ color:"rgba(255,215,0,.6)", fontSize:13, marginLeft:4 }}>+{streakMilestone-7} more</span>}
                      </div>
                    </div>
                  </div>
                )}
                {sub?.status==="trial" && <span style={{ color:"var(--purple-light)", fontSize:12, background:"rgba(180,143,255,.1)", padding:"4px 10px", borderRadius:999, border:"1px solid rgba(180,143,255,.2)" }}>{daysLeft()}d Trial Left</span>}
              </div>
              <button onClick={logout} style={{ background:"none", border:"none", color:"rgba(255,255,255,.2)", cursor:"pointer", fontSize:13, fontFamily:"'Nunito',sans-serif", padding:"8px 0", minHeight:44 }}>Sign out</button>
            </div>

            {/* Profile tabs */}
            <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
              {profiles.map(p => <button key={p.id} className={`tab ${active?.id===p.id?"on":""}`} onClick={()=>{setActive(p);setPf(p);}}>🌙 {p.child_name}</button>)}
              {canAddProfile() ? (
                <button className="tab" onClick={()=>{setEditId(null);setPf({child_name:"",age:"",stuffed_animal:"",best_friend:"",favorite_animal:"",scared_of:"",favorite_thing:""});setWizStep(0);setScreen("wizard");}}>+ Add Child</button>
              ) : (
                <button className="tab" style={{ color:"var(--gold)", borderColor:"rgba(201,168,76,.3)" }} onClick={()=>setScreen("paywall")}>+ Add Child 🔒</button>
              )}
            </div>

            {/* Hero */}
            <div style={{ textAlign:"center", marginBottom:22 }}>
              <div style={{ fontSize:"clamp(44px,11vw,58px)", marginBottom:10, animation:"float 4s ease-in-out infinite", filter:"drop-shadow(0 0 28px rgba(200,170,80,.4))" }}>🌙</div>
              <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(20px,5.5vw,28px)", lineHeight:1.25, marginBottom:6 }}>
                Tonight's story for <em style={{ color:"var(--gold-light)" }}>{active.child_name}</em>
              </h1>
              <p style={{ color:"rgba(255,255,255,.28)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(13px,3vw,15px)" }}>10 pages · personalized · fully illustrated</p>
            </div>

            {/* Photo prompt - show if no photo-based character card yet */}
            {!active.character_card && (
              <div onClick={()=>{setEditId(active.id);setPf(active);setScreen("profile");}}
                style={{ marginBottom:16, padding:"14px 16px", borderRadius:16, cursor:"pointer",
                  background:"rgba(201,168,76,.07)", border:"1.5px dashed rgba(201,168,76,.25)",
                  display:"flex", alignItems:"center", gap:12, transition:"all .2s" }}>
                <div style={{ fontSize:28, flexShrink:0 }}>📸</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--gold-light)", marginBottom:2 }}>
                    Add {active.child_name}'s photo
                  </div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", lineHeight:1.4 }}>
                    We'll make the illustrations look just like them ✨
                  </div>
                </div>
                <div style={{ marginLeft:"auto", color:"rgba(255,255,255,.2)", fontSize:18 }}>→</div>
              </div>
            )}

            {/* Show photo avatar if they have one */}
            {active.photo_url && (
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16,
                padding:"10px 14px", borderRadius:14, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)" }}>
                <img src={active.photo_url} alt="" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(201,168,76,.4)", flexShrink:0 }} />
                <div style={{ fontSize:13, color:"rgba(255,255,255,.5)" }}>
                  Illustrations styled like <strong style={{ color:"rgba(255,255,255,.75)" }}>{active.child_name}</strong> ✨
                </div>
                <button onClick={(e)=>{e.stopPropagation();setEditId(active.id);setPf(active);setScreen("profile");}}
                  style={{ marginLeft:"auto", background:"none", border:"none", color:"rgba(255,255,255,.2)", fontSize:12, cursor:"pointer", padding:"4px 8px" }}>Edit</button>
              </div>
            )}

            {/* Story type toggle */}
            <div style={{ marginBottom:16 }}>
              <span className="section-label">Story type</span>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { id:"adventure", icon:"🌙", title:"Adventure",   desc:"Magical personalized bedtime story", activeColor:"rgba(124,77,204,.22)", activeBorder:"rgba(180,145,255,.65)" },
                  { id:"lesson",    icon:"✨", title:"Life Lesson", desc:"Teaches a value through the story",  activeColor:"rgba(34,160,100,.18)", activeBorder:"rgba(74,222,128,.5)" },
                ].map(t => (
                  <button key={t.id} onClick={()=>setStoryMode(t.id)} style={{
                    padding:"clamp(12px,3vw,16px) clamp(10px,2.5vw,14px)",
                    borderRadius:16, cursor:"pointer", transition:"all .2s", textAlign:"left",
                    minHeight:82, WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
                    background:storyMode===t.id?t.activeColor:"rgba(255,255,255,.04)",
                    border:`1.5px solid ${storyMode===t.id?t.activeBorder:"rgba(255,255,255,.08)"}`,
                  }}>
                    <div style={{ fontSize:"clamp(18px,4vw,22px)", marginBottom:5 }}>{t.icon}</div>
                    <div style={{ fontWeight:700, fontSize:"clamp(13px,3.2vw,14px)", color:"white", marginBottom:3 }}>{t.title}</div>
                    <div style={{ fontSize:"clamp(11px,2.5vw,12px)", color:"rgba(255,255,255,.38)", lineHeight:1.4 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Lesson picker */}
            {storyMode==="lesson" && (
              <div style={{ marginBottom:16 }}>
                <span className="section-label">Choose the lesson</span>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {LESSONS.map(l => (
                    <button key={l.id} className={`pill ${lesson===l.id?"on-green":""}`} onClick={()=>setLesson(l.id)}>{l.emoji} {l.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Mood */}
            <div style={{ marginBottom:20 }}>
              <span className="section-label">Tonight's mood</span>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                {MOODS.map(m => <button key={m.id} className={`pill ${mood===m.id?"on":""}`} onClick={()=>setMood(m.id)}>{m.emoji} {m.label}</button>)}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="btn-cta full" style={{ padding: tablet ? "20px 24px" : undefined, fontSize: tablet ? 17 : undefined }} onClick={generateStory}>
                {storyMode==="lesson" ? `✨ Story about ${LESSONS.find(l=>l.id===lesson)?.label||"Kindness"}` : "✨ Open Tonight's Story"}
              </button>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <button className="btn-soft" onClick={()=>{setEditId(active.id);setPf(active);setScreen("profile");}}>✏️ Edit Profile</button>
                {!mobile && <button className="btn-soft" onClick={()=>{loadLibrary();setScreen("library");}}>📚 Library</button>}
              </div>
              {!mobile && <button className="btn-soft" onClick={()=>setScreen("badges")} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                🏅 Badges <span style={{ color:"var(--gold)", fontSize:12 }}>{badges.length}/{BADGE_DEFS.length}</span>
              </button>}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PROFILE EDIT
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="profile" && (
          <div className="fade" style={{ maxWidth:420, width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <button className="btn-soft" style={{ flexShrink:0, width:"auto", padding:"12px 16px" }} onClick={()=>setScreen("home")}>← Back</button>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(17px,4vw,20px)" }}>Edit Profile</h2>
            </div>
            <div className="form-card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {err && <p className="err">{err}</p>}
              {WIZARD_STEPS.map(f => (
                <div key={f.key}><label style={LBL}>{f.label}</label><input type={f.type||"text"} placeholder={f.placeholder} value={pf[f.key]||""} onChange={e=>setPf({...pf,[f.key]:e.target.value})} /></div>
              ))}
              <div style={{ marginTop:8 }}>
                <label style={LBL}>📸 Child's photo (for illustration style)</label>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  {photoPreview || pf.photo_url ? (
                    <img src={photoPreview||pf.photo_url} alt="" style={{ width:56, height:56, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(201,168,76,.4)" }} />
                  ) : (
                    <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>👧</div>
                  )}
                  <label style={{ cursor:"pointer" }}>
                    <div style={{ color:"rgba(180,143,255,.8)", fontSize:13, textDecoration:"underline" }}>
                      {photoAnalyzing ? "Analyzing…" : (photoPreview || pf.photo_url) ? "Change photo" : "Upload photo"}
                    </div>
                    <input type="file" accept="image/*" capture="user" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)handlePhotoUpload(f);}} />
                  </label>
                  {pf.character_card && <span style={{ color:"rgba(255,255,255,.25)", fontSize:11 }}>✓ Character captured</span>}
                </div>
              </div>
              <button className="btn-solid" style={{ marginTop:4 }} onClick={saveProfile}>Save Changes</button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STORY
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="story" && (
          <div className="fade" style={{ maxWidth:"min(98vw,1320px)", width:"100%", paddingBottom:20 }}>
            {storyPhase==="text" && <MoonLoader text="Writing your story…" childName={active?.child_name||""} />}
            {storyPhase==="illustrating" && <IllustrationLoader total={pages.length} loaded={imgsLoaded} title={title} imgs={imgs} />}
            {storyPhase==="ready" && pages.length>0 && (
              <>
                <OpenBook pages={pages} imgs={imgs} spread={spread} onFlip={handleFlip} title={title} mobile={mobile} coverImg={coverImg} />

                {/* Progress indicator */}
                {imgsLoaded<pages.length && (
                  <div style={{ textAlign:"center", marginTop:12 }}>
                    <p style={{ color:"rgba(255,255,255,.22)", fontSize:12 }}>🎨 Painting illustrations… {imgsLoaded}/{pages.length}</p>
                    <div style={{ width:140, height:3, background:"rgba(255,255,255,.07)", borderRadius:99, margin:"6px auto 0", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#7c4dcc,#c084fc)", width:`${(imgsLoaded/pages.length)*100}%`, transition:"width .4s ease" }} />
                    </div>
                  </div>
                )}

                {/* Actions — stacked rows on mobile */}
                <div style={{ marginTop:18, display:"flex", flexDirection:"column", gap:10, maxWidth: tablet ? 680 : 520, margin:"18px auto 0" }}>
                  {/* Row 1: main story actions */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <button className="btn-book" onClick={continueStory} disabled={extending} style={{ opacity:extending?0.6:1 }}>{extending?"✨ Writing…":"✨ Continue"}</button>
                    <button className="btn-book" onClick={happyEnding} disabled={extending} style={{ opacity:extending?0.6:1, background:"linear-gradient(135deg,#132018,#1f3828)", borderColor:"rgba(80,200,120,.3)", color:"#7de8a0" }}>{extending?"✨ Writing…":"🌟 Happy Ending"}</button>
                  </div>
                  {/* Row 2: coloring book */}
                  <button className="btn-book" onClick={generateColoringPage} disabled={coloringLoading} style={{ background:"linear-gradient(135deg,#0d0a1e,#1a1040)", borderColor:"rgba(192,132,252,.3)", color:"#d8b4fe", opacity:coloringLoading?0.6:1 }}>
                    {coloringLoading?"🎨 Generating…":"🖍️ Make a Coloring Page"}
                  </button>
                  {/* Row 3: nav + utilities */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                    <button className="btn-soft" style={{ fontSize:13 }} onClick={()=>setScreen("home")}>← Home</button>
                    <button className="btn-soft" style={{ fontSize:13 }} onClick={shareStory}>{copied?"✅ Copied!":"🔗 Share"}</button>
                    <button className="btn-soft" style={{ fontSize:13 }} onClick={readAloud}>{speaking?"⏹️ Stop":"🔊 Read"}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Share card modal */}
        {showShareCard && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", backdropFilter:"blur(12px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 env(safe-area-inset-bottom,0px)" }}
            onClick={()=>setShowShareCard(false)}>
            <div style={{ background:"linear-gradient(175deg,#1a0a3e,#0d0620)", border:"1px solid rgba(255,255,255,.1)", borderRadius:"24px 24px 0 0", padding:"clamp(20px,4vw,32px)", width:"100%", maxWidth:480, animation:"slideUp .3s ease" }}
              onClick={e=>e.stopPropagation()}>
              {/* Handle */}
              <div style={{ width:40, height:4, borderRadius:99, background:"rgba(255,255,255,.15)", margin:"0 auto 20px" }} />

              {/* Preview */}
              <div style={{ borderRadius:16, overflow:"hidden", aspectRatio:"1/1", marginBottom:20, position:"relative", background:"linear-gradient(135deg,#1a0a3e,#0d0620)", border:"1px solid rgba(255,255,255,.08)" }}>
                {(coverImg||imgs[0]) && <img src={coverImg||imgs[0]} alt="" style={{ width:"100%", height:"70%", objectFit:"cover", display:"block" }} />}
                <div style={{ padding:"clamp(12px,3vw,18px)", textAlign:"center" }}>
                  <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:"clamp(15px,4vw,19px)", color:"white", marginBottom:4, lineHeight:1.3 }}>{title}</p>
                  <p style={{ color:"rgba(255,255,255,.35)", fontFamily:"'Crimson Pro',serif", fontSize:13 }}>A story for {active?.child_name} ✦ DreamWeaver</p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button className="btn-cta full" onClick={downloadShareCard}>
                  ⬇️ Save As Image
                </button>
                <button className="btn-soft" onClick={copyShareLink}>
                  {copied ? "✅ Link Copied!" : "🔗 Copy Share Link"}
                </button>
                <button className="btn-soft" onClick={()=>setShowShareCard(false)} style={{ opacity:.6 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            BADGES SCREEN
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="badges" && (
          <div className="fade has-bottom-nav" style={{ maxWidth:480, width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:22 }}>
              <button className="btn-soft" style={{ flexShrink:0, width:"auto", padding:"12px 16px" }} onClick={()=>setScreen("home")}>← Home</button>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(17px,4vw,21px)", fontStyle:"italic" }}>🏅 {active?.child_name}'s Badges</h2>
            </div>
            <p style={{ color:"rgba(255,255,255,.3)", fontSize:13, marginBottom:20, fontFamily:"'Crimson Pro',serif", fontStyle:"italic" }}>{badges.length} of {BADGE_DEFS.length} earned</p>
            <div className="badge-grid">
              {BADGE_DEFS.map(b => {
                const earned = badges.includes(b.id);
                return (
                  <div key={b.id} className={`badge-item ${earned?"earned":""}`} title={b.desc}>
                    <span style={{ fontSize:28, filter:earned?"none":"grayscale(1) opacity(.25)" }}>{b.emoji}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:earned?"rgba(255,255,255,.85)":"rgba(255,255,255,.2)", lineHeight:1.3, fontFamily:"'Nunito',sans-serif" }}>{b.label}</span>
                    {earned && <span style={{ fontSize:9, color:"var(--gold)", fontFamily:"'Nunito',sans-serif" }}>✦ earned</span>}
                  </div>
                );
              })}
            </div>
            {badges.length===0 && (
              <div style={{ textAlign:"center", padding:"32px 20px", color:"rgba(255,255,255,.25)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:15 }}>
                Read your first story tonight to start earning badges ✨
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LIBRARY
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="library" && (
          <div className="fade has-bottom-nav" style={{ maxWidth:560, width:"100%" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <button className="btn-soft" style={{ flexShrink:0, width:"auto", padding:"12px 16px" }} onClick={()=>setScreen("home")}>← Home</button>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,4vw,20px)", fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📚 {active?.child_name}'s Library</h2>
            </div>
            {library.length===0 ? (
              <div style={{ textAlign:"center", padding:"clamp(48px,10vw,72px) 20px" }}>
                {/* Soft glow behind moon */}
                <div style={{ position:"relative", display:"inline-block", marginBottom:24 }}>
                  <div style={{ position:"absolute", inset:"-20px", borderRadius:"50%", background:"radial-gradient(circle,rgba(200,170,80,.12) 0%,transparent 70%)", pointerEvents:"none" }} />
                  <div style={{ fontSize:"clamp(52px,12vw,68px)", animation:"float 4s ease-in-out infinite", filter:"drop-shadow(0 0 24px rgba(200,170,80,.3))", position:"relative" }}>🌙</div>
                </div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(20px,5vw,26px)", fontStyle:"italic", marginBottom:10, lineHeight:1.3 }}>
                  {active?.child_name}'s first story<br/>is waiting to be written
                </h3>
                <p style={{ color:"rgba(255,255,255,.32)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(14px,3.5vw,16px)", lineHeight:1.8, maxWidth:300, margin:"0 auto 28px" }}>
                  Every night, a brand new 10-page illustrated picture book — starring {active?.child_name} as the hero.
                </p>
                <button className="btn-cta" style={{ margin:"0 auto", display:"block", width:"auto", padding:"16px 32px" }} onClick={()=>setScreen("home")}>
                  ✨ Open Tonight's Story
                </button>
                <p style={{ color:"rgba(255,255,255,.15)", fontSize:12, marginTop:14 }}>Stories you generate will appear here</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {library.map(s => {
                  const isToday=s.story_date===todayStr();
                  const d=new Date(s.story_date+"T00:00:00");
                  const label=isToday?"Tonight":d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
                  return (
                    <div key={s.id}
                      onClick={()=>{const ps=s.text.split("\n\n✦\n\n");setPages(ps);setTitle(s.title||"");setImgs(s.page_images||[]);const saved=parseInt(localStorage.getItem("dw_spread_"+s.id)||"-1");setSpread(Math.min(saved,ps.length-1));setStory(s);setStoryPhase("ready");setScreen("story");}}
                      style={{ display:"flex", gap:12, alignItems:"center", padding:"14px", cursor:"pointer", borderRadius:18, background:"rgba(255,255,255,.04)", border:`1px solid ${isToday?"rgba(201,168,76,.2)":"rgba(255,255,255,.07)"}`, transition:"all .2s", WebkitTapHighlightColor:"transparent" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.08)"}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)"}}>
                      {s.page_images?.[0]
                        ? <img src={s.page_images[0]} alt="" style={{ width:"clamp(48px,12vw,64px)", height:"clamp(36px,9vw,48px)", objectFit:"cover", borderRadius:10, flexShrink:0 }} />
                        : <div style={{ width:"clamp(48px,12vw,64px)", height:"clamp(36px,9vw,48px)", borderRadius:10, background:"linear-gradient(135deg,#c9b8f8,#818cf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🌙</div>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:3, flexWrap:"wrap" }}>
                          <span style={{ color:isToday?"var(--gold)":"rgba(255,255,255,.28)", fontSize:11, letterSpacing:".08em", textTransform:"uppercase", fontWeight:700 }}>{label}</span>
                          {s.lesson_type && <span style={{ background:"rgba(74,222,128,.12)", border:"1px solid rgba(74,222,128,.22)", borderRadius:999, padding:"1px 8px", fontSize:10, color:"#6ee7a0", flexShrink:0 }}>{LESSONS.find(l=>l.id===s.lesson_type)?.emoji} {LESSONS.find(l=>l.id===s.lesson_type)?.label}</span>}
                        </div>
                        <div style={{ color:"rgba(255,255,255,.85)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(13px,3.5vw,15px)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title||s.text?.slice(0,60)+"…"}</div>
                      </div>
                      <span style={{ color:"rgba(201,168,76,.4)", fontSize:16, flexShrink:0 }}>›</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PAYWALL
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="paywall" && (() => {
          const isTrialEnd = !sub || (sub.status==="trial" && new Date(sub.trial_ends_at)<=new Date());
          const isAddingChild = sub?.status==="active" || sub?.status==="trial";
          const currentKids = profiles.length;
          const newPrice = PRICE_BASE + currentKids * PRICE_PER_EXTRA;
          return (
          <div className="fade" style={{ maxWidth:400, width:"100%", textAlign:"center", paddingTop:"clamp(20px,6vw,40px)" }}>
            <div style={{ fontSize:"clamp(44px,12vw,60px)", marginBottom:16, animation:"float 4s ease-in-out infinite" }}>🌙</div>

            {isTrialEnd ? (
              <>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(22px,6vw,28px)", marginBottom:8, lineHeight:1.2 }}>Your Free Trial Has Ended</h2>
                <p style={{ color:"rgba(255,255,255,.35)", marginBottom:28, lineHeight:1.8, fontFamily:"'Crimson Pro',serif", fontSize:"clamp(14px,3.5vw,16px)" }}>
                  Keep the magic going — subscribe to continue<br/>generating stories for your family.
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(22px,6vw,28px)", marginBottom:8, lineHeight:1.2 }}>Add Another Child</h2>
                <p style={{ color:"rgba(255,255,255,.35)", marginBottom:28, lineHeight:1.8, fontFamily:"'Crimson Pro',serif", fontSize:"clamp(14px,3.5vw,16px)" }}>
                  Your plan would update to <strong style={{ color:"white" }}>${newPrice.toFixed(2)}/month</strong><br/>
                  to cover {currentKids + 1} children.
                </p>
              </>
            )}

            {/* Pricing breakdown */}
            <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)", borderRadius:18, padding:"clamp(18px,3vw,24px)", marginBottom:24, textAlign:"left" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12, marginBottom:12, borderBottom:"1px solid rgba(255,255,255,.06)" }}>
                <span style={{ color:"rgba(255,255,255,.6)", fontSize:14, fontFamily:"'Nunito',sans-serif" }}>First Child</span>
                <span style={{ color:"white", fontWeight:700, fontSize:14 }}>${PRICE_BASE.toFixed(2)}/mo</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12, marginBottom:12, borderBottom:"1px solid rgba(255,255,255,.06)" }}>
                <span style={{ color:"rgba(255,255,255,.6)", fontSize:14, fontFamily:"'Nunito',sans-serif" }}>Each Additional Child</span>
                <span style={{ color:"white", fontWeight:700, fontSize:14 }}>+${PRICE_PER_EXTRA.toFixed(2)}/mo</span>
              </div>
              {[
                "10-Page Illustrated Story Every Night",
                "AI Watercolor Art On Every Page",
                "Photo-Matched Character Illustrations",
                "Life Lesson Story Mode",
                "Read Aloud Narrator",
                "Story Library Saved Forever",
                "Coloring Book Generator",
                "Milestone Badges",
                "Cancel Anytime",
              ].map(f => (
                <div key={f} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", minHeight:36 }}>
                  <span style={{ color:"var(--gold)", flexShrink:0, fontSize:12 }}>✦</span>
                  <span style={{ color:"rgba(255,255,255,.55)", fontSize:"clamp(12px,3vw,13px)", fontFamily:"'Nunito',sans-serif" }}>{f}</span>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="btn-cta full">
                {isTrialEnd ? `Subscribe — $${PRICE_BASE.toFixed(2)}/Month` : `Update Plan — $${newPrice.toFixed(2)}/Month`}
              </button>
              <button className="btn-soft" onClick={()=>setScreen("home")}>Maybe Later</button>
            </div>
            <p style={{ color:"rgba(255,255,255,.18)", fontSize:11, marginTop:12 }}>No Commitment · Cancel Anytime</p>
          </div>
          );
        })()}

        {/* ── Mobile bottom nav — shown on main app screens ── */}
        {mobile && ["home","library","badges","story"].includes(screen) && user && (
          <BottomNav screen={screen} setScreen={setScreen} loadLibrary={loadLibrary} badgeCount={badges.length} totalBadges={BADGE_DEFS.length} />
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SHARED
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="shared" && (
          <div className="fade" style={{ maxWidth:980, width:"100%" }}>
            {!shared ? <MoonLoader /> : (() => {
              const sp=shared.text?.split("\n\n✦\n\n")||[shared.text];
              const si=shared.page_images||[];
              return (
                <>
                  <OpenBook pages={sp} imgs={si} spread={0} onFlip={()=>{}} title={shared.title} mobile={mobile||tablet} coverImg={shared.cover_image||null} />
                  <div style={{ textAlign:"center", marginTop:24, padding:"28px 20px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:20 }}>
                    <p style={{ color:"rgba(255,255,255,.38)", marginBottom:16, fontFamily:"'Crimson Pro',serif", fontSize:16, fontStyle:"italic" }}>Make personalized 10-page picture books for your child every night</p>
                    <button className="btn-cta" onClick={()=>setScreen("signup")}>Try DreamWeaver free ✨</button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>

      {/* ── Coloring Book Modal ── */}
      {coloringUrl && (
        <div className="coloring-modal" onClick={()=>setColoringUrl(null)}>
          <div className="coloring-modal-inner" onClick={e=>e.stopPropagation()}>
            <div style={{ background:"linear-gradient(135deg,#1a0a38,#2d1060)", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"var(--gold-light)", fontStyle:"italic" }}>🖍️ {active?.child_name}'s Coloring Page</h3>
                <p style={{ color:"rgba(255,255,255,.35)", fontSize:12, marginTop:3 }}>Print it out and color it in!</p>
              </div>
              <button onClick={()=>setColoringUrl(null)} style={{ background:"none", border:"none", color:"rgba(255,255,255,.4)", fontSize:22, cursor:"pointer", lineHeight:1, padding:4 }}>×</button>
            </div>
            <img src={coloringUrl} alt="Coloring page" style={{ width:"100%", display:"block" }} />
            <div style={{ padding:"14px 16px", display:"flex", gap:10 }}>
              <a href={coloringUrl} download="coloring-page.png" target="_blank" rel="noreferrer" style={{ flex:1, display:"block", textDecoration:"none" }}>
                <button className="btn-solid" style={{ width:"100%" }}>⬇️ Download & Print</button>
              </a>
              <button className="btn-soft" style={{ flexShrink:0, width:"auto", padding:"14px 18px" }} onClick={()=>setColoringUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Badge Toast ── */}
      {newBadge && (
        <div className="badge-toast">
          <span style={{ fontSize:28 }}>{newBadge.emoji}</span>
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:"var(--gold-light)", fontFamily:"'Nunito',sans-serif" }}>Badge Unlocked!</div>
            <div style={{ fontWeight:700, fontSize:14, color:"white", fontFamily:"'Nunito',sans-serif" }}>{newBadge.label}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.45)", fontFamily:"'Nunito',sans-serif" }}>{newBadge.desc}</div>
          </div>
        </div>
      )}
    </>
  );
}
// v24
// v25
