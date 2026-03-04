import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY;
const APP_URL = "https://dreamweaverstory.com";
const TRIAL_DAYS = 7;
const PRICE_BASE = 5.99;       // first child per month
const PRICE_PER_EXTRA = 2.99;  // each additional child per month
const STORY_PAGES = 14;

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
const tomorrowStr = () => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); };
const prettyTomorrow = () => { const h=new Date().getHours(); return h<17?"tomorrow morning":"tomorrow night"; };
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

:root{
  --night:#07050d;
  --surface-1:rgba(255,255,255,.055);
  --surface-2:rgba(255,255,255,.09);
  --surface-3:rgba(255,255,255,.13);
  --border-1:rgba(255,255,255,.07);
  --border-2:rgba(255,255,255,.12);
  --border-3:rgba(255,255,255,.2);
  --gold:#c9a84c;
  --gold-light:#e8c96a;
  --gold-dim:rgba(201,168,76,.15);
  --gold-border:rgba(201,168,76,.3);
  --text-1:rgba(255,255,255,.92);
  --text-2:rgba(255,255,255,.55);
  --text-3:rgba(255,255,255,.3);
  --text-4:rgba(255,255,255,.18);
  --purple:#6b35c8;
  --purple-light:#b08fff;
  --spine-dark:#1a0802;--spine-mid:#5c2e0e;--spine-light:#8b4a14;
  --cream:#fdf8ef;
  --ink:#1a0f2e;
  --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-2xl:24px;
}

html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  background:radial-gradient(ellipse at 20% 0%,#1a0f2e 0%,#0d0618 40%,#07050d 100%);
  min-height:100vh;
  font-family:'Nunito',sans-serif;color:var(--text-1);
  overflow-x:hidden;-webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent;
}

/* ── Animations ── */
@keyframes twinkle{0%,100%{opacity:.04;transform:scale(.5)}50%{opacity:.85;transform:scale(1.3)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
@keyframes orb{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(20px,-15px) scale(1.05)}66%{transform:translate(-10px,20px) scale(.97)}}
@keyframes slideUp{from{transform:translateY(28px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes popIn{0%{transform:scale(.88);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes goldPulse{0%,100%{box-shadow:0 6px 28px rgba(180,130,30,.38)}50%{box-shadow:0 6px 36px rgba(180,130,30,.6)}}
@keyframes starFloat{0%{opacity:.3;transform:translateY(0) scale(1)}100%{opacity:.9;transform:translateY(-8px) scale(1.3)}}
/* page-turn */
@keyframes mobileExitForward{from{transform:translateX(0);opacity:1}to{transform:translateX(-100%);opacity:.4}}
@keyframes mobileEnterForward{from{transform:translateX(100%);opacity:.4}to{transform:translateX(0);opacity:1}}
@keyframes mobileExitBack{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:.4}}
@keyframes mobileEnterBack{from{transform:translateX(-100%);opacity:.4}to{transform:translateX(0);opacity:1}}
@keyframes pageExitForward{0%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}40%{transform:perspective(1200px) translateX(-8%) rotateY(-25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(-100%) rotateY(-35deg) scaleX(0.85);opacity:0}}
@keyframes pageEnterForward{0%{transform:perspective(1200px) translateX(100%) rotateY(35deg) scaleX(0.85);opacity:0}60%{transform:perspective(1200px) translateX(8%) rotateY(25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}}
@keyframes pageExitBack{0%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}40%{transform:perspective(1200px) translateX(8%) rotateY(25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(100%) rotateY(35deg) scaleX(0.85);opacity:0}}
@keyframes pageEnterBack{0%{transform:perspective(1200px) translateX(-100%) rotateY(-35deg) scaleX(0.85);opacity:0}60%{transform:perspective(1200px) translateX(-8%) rotateY(-25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}}
@keyframes coverOpen{0%{transform:perspective(1200px) rotateY(0deg) scaleX(1);opacity:1}50%{transform:perspective(1200px) rotateY(-20deg) scaleX(.9);opacity:.8}100%{transform:perspective(1200px) rotateY(-40deg) scaleX(.75);opacity:0}}

.fade{animation:fadeUp .45s ease both}
.fadein{animation:fadeIn .3s ease both}
.float{animation:float 4s ease-in-out infinite}
.page-flip-forward{animation:pageExitForward .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}
.page-flip-back{animation:pageExitBack .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}
.page-enter-forward{animation:pageEnterForward .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}
.page-enter-back{animation:pageEnterBack .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}
.cover-opening{animation:coverOpen .6s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}

/* ── Layout ── */
.wrap{
  min-height:100svh;position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;
  padding-top:max(24px,env(safe-area-inset-top));
  padding-bottom:max(88px,calc(68px + env(safe-area-inset-bottom)));
  padding-left:max(20px,env(safe-area-inset-left));
  padding-right:max(20px,env(safe-area-inset-right));
  box-sizing:border-box;
}
.wrap.landing-active{padding:0 !important;align-items:stretch}
.wrap.landing-active > .fade{max-width:100% !important;width:100% !important}
.wrap.home-active{
  padding-left:0 !important;padding-right:0 !important;
  padding-top:max(0px,env(safe-area-inset-top)) !important;
  align-items:stretch;
}
.wrap.home-active > .hw-shell{width:100% !important;max-width:100% !important}
.hw-shell ::-webkit-scrollbar{width:3px}
.hw-shell ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:99px}
@media(max-width:699px){
  .wrap > .fade{width:100% !important;max-width:100% !important}
  .has-bottom-nav{width:100% !important;max-width:100% !important}
}

/* ── Buttons ── */
/* PRIMARY — gold, always */
.btn-cta{
  background:linear-gradient(135deg,#d4a842,#b88a20);
  color:#130c00;border:none;border-radius:var(--r-lg);
  padding:15px 40px;font-size:16px;font-weight:800;
  font-family:'Nunito',sans-serif;cursor:pointer;
  transition:transform .16s,box-shadow .16s;
  box-shadow:0 4px 24px rgba(180,130,30,.38),0 1px 3px rgba(0,0,0,.25);
  letter-spacing:.01em;min-height:50px;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;display:inline-block
}
.btn-cta:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(180,130,30,.55)}
.btn-cta:active{transform:scale(.98);box-shadow:0 2px 12px rgba(180,130,30,.3)}
.btn-cta.full{width:100%;display:block;text-align:center}
.btn-cta.pulse{animation:goldPulse 2.5s ease-in-out infinite}

/* SOLID — purple, wizard/forms */
.btn-solid{
  background:linear-gradient(135deg,#3d2080,#6b35c8);
  color:white;border:none;border-radius:var(--r-lg);
  padding:14px 24px;font-size:16px;font-weight:700;
  font-family:'Nunito',sans-serif;cursor:pointer;width:100%;
  transition:all .16s;box-shadow:0 4px 20px rgba(80,40,160,.3);
  min-height:50px;-webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.btn-solid:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(80,40,160,.5)}
.btn-solid:active{transform:scale(.98)}

/* SOFT — ghost */
.btn-soft{
  background:var(--surface-1);color:var(--text-2);
  border:1px solid var(--border-1);border-radius:var(--r-md);
  padding:12px 20px;font-size:14px;font-family:'Nunito',sans-serif;
  font-weight:600;cursor:pointer;transition:all .15s;
  min-height:44px;-webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.btn-soft:hover{background:var(--surface-2);color:var(--text-1);border-color:var(--border-2)}
.btn-soft:active{background:var(--surface-3);transform:scale(.98)}

/* BOOK — inside story reader */
.btn-book{
  background:var(--surface-1);color:var(--text-2);
  border:1px solid var(--border-1);border-radius:var(--r-md);
  padding:13px 20px;font-size:14px;font-weight:700;
  font-family:'Nunito',sans-serif;cursor:pointer;transition:all .16s;
  min-height:46px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  width:100%;display:flex;align-items:center;justify-content:center;gap:8px
}
.btn-book:hover{background:var(--surface-2);border-color:var(--border-2);color:var(--text-1)}
.btn-book:active{transform:scale(.97)}
.btn-book:disabled{opacity:.25;cursor:default;transform:none}
.btn-book.gold{border-color:var(--gold-border);color:var(--gold-light)}
.btn-book.gold:hover{background:rgba(201,168,76,.1)}

/* ── Input ── */
input{
  width:100%;padding:14px 16px;border-radius:var(--r-md);
  border:1.5px solid var(--border-1);
  background:rgba(255,255,255,.04);
  color:var(--text-1);font-size:16px;font-family:'Nunito',sans-serif;
  outline:none;transition:border-color .18s,background .18s,box-shadow .18s;
  -webkit-appearance:none;appearance:none
}
input:focus{
  border-color:rgba(201,168,76,.5);
  background:rgba(255,255,255,.06);
  box-shadow:0 0 0 3px rgba(201,168,76,.09)
}
input::placeholder{color:var(--text-4)}
label{display:block;font-size:11px;font-weight:700;color:var(--text-3);
  letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px;
  font-family:'Nunito',sans-serif}

/* ── Form card ── */
.form-card{
  background:rgba(255,255,255,.035);
  border:1px solid var(--border-1);border-radius:var(--r-2xl);
  padding:28px 24px;backdrop-filter:blur(12px)
}

/* ── Selection pills (mood/lesson) ── */
.sel-pill{
  display:inline-flex;align-items:center;gap:6px;
  padding:10px 18px;border-radius:999px;
  border:1.5px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.06);
  color:rgba(255,255,255,.7);cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;
  transition:all .15s;white-space:nowrap;
  min-height:40px;-webkit-tap-highlight-color:transparent;touch-action:manipulation
}
.sel-pill:hover{border-color:rgba(201,168,76,.4);color:var(--text-1);background:rgba(255,255,255,.09)}
.sel-pill.on{
  background:rgba(201,168,76,.15);
  border-color:rgba(201,168,76,.55);
  color:var(--gold-light);
  box-shadow:0 0 12px rgba(201,168,76,.15)
}

/* ── Library / Story type tile ── */
.type-tile{
  padding:18px 16px;border-radius:var(--r-lg);cursor:pointer;
  text-align:left;transition:all .18s;border:1.5px solid rgba(255,255,255,.07);
  background:rgba(255,255,255,.04);-webkit-tap-highlight-color:transparent
}
.type-tile:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)}
.type-tile.on{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.5);box-shadow:0 0 0 1px rgba(201,168,76,.15) inset}

/* ── Section card ── */
.s-card{
  border-radius:var(--r-lg);border:1px solid rgba(255,255,255,.06);
  background:rgba(255,255,255,.055);overflow:hidden;
  box-shadow:0 2px 16px rgba(0,0,0,.25)
}
.s-card-head{
  padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.05);
  display:flex;align-items:center;gap:9px;
  background:rgba(255,255,255,.02)
}
.step-num{
  width:20px;height:20px;border-radius:50%;flex-shrink:0;
  background:rgba(255,255,255,.07);border:1px solid var(--border-2);
  display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:800;font-family:'Nunito',sans-serif;
  color:var(--text-3)
}

/* ── Skeleton ── */
.skeleton{
  background:linear-gradient(90deg,#181228 25%,#261e3e 50%,#181228 75%);
  background-size:200% 100%;animation:shimmer 1.5s infinite
}

/* ── Typography ── */
.hero-title{
  font-family:'Playfair Display',serif;
  font-size:clamp(38px,8vw,72px);line-height:1.03;
  letter-spacing:-.025em;margin-bottom:20px
}
.eyebrow{
  font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--text-3);font-family:'Nunito',sans-serif;font-weight:700
}
.hero-sub{color:var(--text-3);font-size:clamp(15px,2.6vw,18px);line-height:1.8;font-family:'Crimson Pro',serif;font-style:italic}

/* ── Misc ── */
.err{color:#ff8080;font-size:13px;margin-top:4px}
.lnk{color:var(--gold-light);cursor:pointer;transition:opacity .14s}
.lnk:hover{opacity:.75;text-decoration:underline}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
.orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);animation:orb 12s ease-in-out infinite}

/* ── Features strip ── */
.features-strip{display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0 16px}
.features-strip::-webkit-scrollbar{display:none}
.feat-card{flex:0 0 auto;display:flex;flex-direction:column;gap:8px;padding:20px 18px;border-radius:18px;background:var(--surface-1);border:1px solid var(--border-1);width:140px;text-align:center;transition:all .2s}
.feat-card:hover{background:var(--surface-2);transform:translateY(-3px)}
@media(min-width:641px){.features-strip{flex-wrap:wrap;overflow-x:visible;justify-content:center}.feat-card{width:152px}}

/* ── Badge ── */
.badge-toast{
  position:fixed;bottom:calc(76px + env(safe-area-inset-bottom));
  left:16px;right:16px;max-width:360px;margin:0 auto;z-index:10000;
  background:linear-gradient(135deg,#1a0a38,#2d1060);
  border:1px solid var(--gold-border);border-radius:var(--r-lg);
  padding:14px 18px;display:flex;gap:12px;align-items:center;
  box-shadow:0 8px 32px rgba(0,0,0,.6);animation:fadeUp .4s ease both
}
.badge-grid{display:flex;gap:10px;flex-wrap:wrap}
.badge-item{
  display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:14px 8px;border-radius:var(--r-md);width:80px;text-align:center;
  background:var(--surface-1);border:1px solid var(--border-1);transition:all .18s
}
.badge-item.earned{background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.28)}
.badge-item.earned:hover{background:rgba(201,168,76,.14);transform:translateY(-2px)}

/* ── Coloring modal ── */
.coloring-modal{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}
.coloring-modal-inner{background:#fff;border-radius:var(--r-xl);max-width:520px;width:100%;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.8)}

/* ── Bottom nav ── */
.bottom-nav{
  position:fixed;bottom:0;left:0;right:0;z-index:9999;
  display:flex;height:60px;
  background:rgba(7,5,13,.96);border-top:1px solid var(--border-1);
  padding-bottom:env(safe-area-inset-bottom,0px);backdrop-filter:blur(20px)
}
.bottom-nav button{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;background:none;border:none;cursor:pointer;padding:0;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;opacity:.4;transition:opacity .15s
}
.bottom-nav button.active{opacity:1}
.bottom-nav button .nav-label{font-family:'Nunito',sans-serif;font-size:10px;font-weight:700;color:white;letter-spacing:.03em}
.has-bottom-nav{padding-bottom:calc(68px + env(safe-area-inset-bottom,0px)) !important}

/* ── Tablet ── */
@media(min-width:700px) and (max-width:1023px){
  .sel-pill,.btn-soft{font-size:14px !important;padding:11px 18px !important}
  .btn-solid,.btn-cta{font-size:16px !important;padding:16px 28px !important}
  input,select{font-size:16px !important}
}
/* ── Mobile ── */
@media(max-width:640px){
  .wrap{padding-top:14px}
  .btn-cta{font-size:15px;padding:15px 24px;min-height:50px}
  .btn-solid{font-size:15px;padding:14px 18px}
  .form-card{padding:22px 18px;border-radius:var(--r-xl)}
  .feat-card{width:128px;padding:16px 12px}
  .sel-pill{font-size:13px;padding:9px 14px}
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




// ── SharedBook — standalone readable book for share links ────────────────────
function SharedBook({ pages, imgs, title, coverImg, mobile }) {
  const [spread, setSpread] = useState(coverImg ? -1 : 0);
  const handleFlip = (dir) => {
    const min = coverImg ? -1 : 0;
    const max = mobile ? pages.length - 1 : Math.ceil(pages.length / 2) - 1;
    if (dir === "forward" && spread < max) setSpread(s => s + 1);
    else if (dir === "back" && spread > min) setSpread(s => s - 1);
    else if (typeof dir === "number") setSpread(dir);
  };
  // Keyboard arrow navigation
  useEffect(() => {
    if (mobile) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") handleFlip("forward");
      if (e.key === "ArrowLeft")  handleFlip("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spread, pages.length, coverImg, mobile]);
  return <OpenBook pages={pages} imgs={imgs} spread={spread} onFlip={handleFlip} title={title} mobile={mobile} coverImg={coverImg} />;
}

// ── Bottom Nav (mobile only) ──────────────────────────────────────────────────
function BottomNav({ screen, setScreen, loadLibrary }) {
  const C_ON  = "#c084fc";
  const C_OFF = "rgba(255,255,255,.55)";
  const tabs = [
    {
      id: "home", label: "Home",
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 12L12 4l9 8" stroke={on?C_ON:C_OFF} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9" stroke={on?C_ON:C_OFF} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: "library", label: "Library",
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="4" height="16" rx="1" stroke={on?C_ON:C_OFF} strokeWidth="1.8"/>
          <rect x="10" y="4" width="4" height="16" rx="1" stroke={on?C_ON:C_OFF} strokeWidth="1.8"/>
          <path d="M17 4l3 15.5" stroke={on?C_ON:C_OFF} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: "badges", label: "Badges",
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="9" r="5" stroke={on?C_ON:C_OFF} strokeWidth="1.8"/>
          <path d="M7.5 14.5L6 20l6-2 6 2-1.5-5.5" stroke={on?C_ON:C_OFF} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ];
  return (
    <nav className="bottom-nav">
      {tabs.map(t => {
        const on = screen === t.id;
        return (
          <button key={t.id} className={on ? "active" : ""}
            onClick={() => { if (t.id==="library") loadLibrary(); setScreen(t.id); }}>
            {t.icon(on)}
            <span className="nav-label" style={{ color: on ? C_ON : "rgba(255,255,255,.45)" }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── DreamWeaver Logo ──────────────────────────────────────────────────────────
function DreamweaverLogo({ size = 32, showText = true }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="dwMoonGlow" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#f6e27a" stopOpacity="1"/>
            <stop offset="60%" stopColor="#c9a030" stopOpacity="1"/>
            <stop offset="100%" stopColor="#7c4dcc" stopOpacity="1"/>
          </radialGradient>
          <radialGradient id="dwStarGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8"/>
          </radialGradient>
        </defs>
        {/* Moon crescent */}
        <path d="M26 8C18.268 8 12 14.268 12 22C12 29.732 18.268 36 26 36C28.2 36 30.28 35.46 32.1 34.5C28.5 33.1 26 29.34 26 25C26 18.924 30.04 13.78 35.6 11.9C33.16 9.48 29.76 8 26 8Z" fill="url(#dwMoonGlow)" opacity="0.95"/>
        {/* Stars */}
        <circle cx="10" cy="12" r="1.5" fill="url(#dwStarGrad)" opacity="0.9"/>
        <circle cx="6" cy="22" r="1" fill="url(#dwStarGrad)" opacity="0.7"/>
        <circle cx="14" cy="6" r="1" fill="url(#dwStarGrad)" opacity="0.6"/>
        <circle cx="34" cy="20" r="1.2" fill="url(#dwStarGrad)" opacity="0.5"/>
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
  const touchStart = useRef(null); // must be here, not inside conditional

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
        setTimeout(() => { setEnterClass(""); setAnimating(false); }, 580);
      }, 560);
      return;
    }

    setAnimating(true);
    setFlipClass(forward ? "page-flip-forward" : "page-flip-back");
    setEnterClass("");
    setTimeout(() => {
      setDisplaySpread(spread);
      setFlipClass("");
      setEnterClass(forward ? "page-enter-forward" : "page-enter-back");
      setTimeout(() => { setEnterClass(""); setAnimating(false); }, 580);
    }, 560);
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
  // (useEffect for auto-skip must be above any conditional return)
  // No auto-skip — always show cover (placeholder if image not ready yet)

  if (isCover) {
    const W = mobile ? "min(92vw,380px)" : "min(52vw,480px)";
    const aspect = "2/3"; // portrait closed book
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
        {title && <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,2.4vw,24px)", fontStyle:"italic", color:"var(--gold-light)", textAlign:"center", marginBottom:16, textShadow:"0 2px 20px rgba(200,170,80,.3)" }}>{title}</h2>}
        {/* Closed book */}
        <div
          onClick={()=>!animating&&onFlip("forward")}
          onTouchEnd={(e)=>{ e.preventDefault(); if(!animating) onFlip("forward"); }}
          className={openingCover ? "cover-opening" : ""}
          style={{ width:W, aspectRatio:aspect, position:"relative", cursor:openingCover?"default":"pointer",
            boxShadow:"8px 8px 0 rgba(0,0,0,.15), 0 60px 120px rgba(0,0,0,.85), 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)",
            borderRadius:"4px 12px 12px 4px",
            transition: openingCover ? "none" : "transform .2s ease, box-shadow .2s ease",
          }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px) scale(1.01)"; e.currentTarget.style.boxShadow="8px 12px 0 rgba(0,0,0,.15), 0 70px 140px rgba(0,0,0,.9), 0 24px 70px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="8px 8px 0 rgba(0,0,0,.15), 0 60px 120px rgba(0,0,0,.85), 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)";}}
        >
          {/* Cover image */}
          <div style={{ position:"absolute", inset:0, borderRadius:"4px 12px 12px 4px", overflow:"hidden" }}>
            {coverImg
              ? <img src={coverImg} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              : <div style={{ width:"100%", height:"100%", background:"linear-gradient(160deg,#1e0a4e,#0d0520)", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ fontSize:48, opacity:.5, animation:"float 3s ease-in-out infinite" }}>🌙</div></div>
            }
            {/* Dark gradient for text — tall enough to cover any AI-generated text at bottom */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.05) 0%,transparent 25%,rgba(0,0,0,.45) 55%,rgba(0,0,0,.88) 100%)" }} />
            {/* Title — overlaid as HTML, never baked into the image */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"clamp(16px,3vw,28px)", textAlign:"center", background:"linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 100%)" }}>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(17px,3vw,28px)", fontStyle:"italic", color:"white", lineHeight:1.25, marginBottom:6, textShadow:"0 2px 20px rgba(0,0,0,.9), 0 0 40px rgba(0,0,0,.8)" }}>{title}</h2>
              <p style={{ color:"rgba(255,255,255,.55)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(11px,1.5vw,14px)", textShadow:"0 1px 8px rgba(0,0,0,.8)" }}>A DreamWeaver Story ✦</p>
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
          onTouchEnd={(e)=>{ e.preventDefault(); if(!animating) onFlip("forward"); }}
          style={{ marginTop:20, background:"linear-gradient(135deg,#4c2d99,#7c4dcc)", border:"none", borderRadius:999, padding:"clamp(14px,3vw,16px) clamp(36px,6vw,52px)", color:"white", fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:"clamp(15px,3vw,17px)", cursor:"pointer", boxShadow:"0 4px 24px rgba(124,77,204,.45)", letterSpacing:".02em", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}
        >
          Open Book →
        </button>
      </div>
    );
  }

  const li = displaySpread * 2;
  const ri = displaySpread * 2 + 1;

  // ── MOBILE: single page view with proper layered slide animation ─────────────
  if (mobile) {
    const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
      if (touchStart.current === null || animating) return;
      const dx = e.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0 && spread < pages.length - 1) onFlip("forward");
      if (dx > 0 && spread > (coverImg ? -1 : 0)) onFlip("back");
    };

    const MobilePage = ({ pageIdx }) => (
      <div style={{ display:"flex", flexDirection:"column", background:"linear-gradient(175deg,#fefcf7,#fdf9f0)", borderRadius:16, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)" }}>
        <div style={{ width:"100%", aspectRatio:"3/2", position:"relative", overflow:"hidden" }}>
          {imgs[pageIdx]
            ? <img src={imgs[pageIdx]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            : <div className="skeleton" style={{ width:"100%", height:"100%" }} />}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:40, background:"linear-gradient(to bottom,transparent,rgba(253,249,240,.9))" }} />
          <div style={{ position:"absolute", bottom:10, right:14, background:"rgba(255,255,255,.88)", backdropFilter:"blur(4px)", borderRadius:99, padding:"3px 11px", color:"var(--ink)", fontSize:12, fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>{pageIdx+1}</div>
        </div>
        <div style={{ padding:"clamp(16px,4vw,20px) clamp(18px,5vw,26px)", minHeight:80 }}>
          <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(16px,4.5vw,20px)", lineHeight:1.9, color:"var(--ink)", textAlign:"center" }}>{pages[pageIdx]}</p>
        </div>
      </div>
    );

    // Determine animation styles for current (exiting) and incoming (entering) page
    const isForward = flipClass === "page-flip-forward" || enterClass === "page-enter-forward";
    const isBack    = flipClass === "page-flip-back"    || enterClass === "page-enter-back";
    const exitAnim  = flipClass  === "page-flip-forward" ? "mobileExitForward .45s ease forwards"
                    : flipClass  === "page-flip-back"    ? "mobileExitBack .45s ease forwards"
                    : "none";
    const enterAnim = enterClass === "page-enter-forward" ? "mobileEnterForward .45s ease forwards"
                    : enterClass === "page-enter-back"    ? "mobileEnterBack .45s ease forwards"
                    : "none";

    return (
      <div style={{ width:"100%", maxWidth:"min(92vw,480px)", margin:"0 auto" }}>
        {title && <div style={{ textAlign:"center", marginBottom:10 }}><h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,4vw,20px)", fontStyle:"italic", color:"var(--gold-light)" }}>{title}</h2></div>}

        {/* Page container — position:relative so layers stack, overflow:hidden clips the slide */}
        <div
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          style={{ position:"relative", touchAction:"pan-y", borderRadius:16, overflow:"hidden" }}>

          {/* Exiting page — only visible during flip */}
          {(flipClass === "page-flip-forward" || flipClass === "page-flip-back") && (
            <div style={{ position:"absolute", inset:0, zIndex:1, animation:exitAnim }}>
              <MobilePage pageIdx={displaySpread} />
            </div>
          )}

          {/* Current/entering page */}
          <div style={{ position:"relative", zIndex:2, animation:enterAnim }}>
            <MobilePage pageIdx={displaySpread} />
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12, gap:10 }}>
          <button className="btn-book" disabled={(coverImg?spread===-1:spread===0)||animating} onClick={()=>onFlip("back")} style={{ flex:1 }}>← Prev</button>
          <div style={{ display:"flex", gap:5, alignItems:"center", flexShrink:0 }}>
            {Array.from({length:pages.length}).map((_,i) => (
              <div key={i} onClick={()=>!animating&&onFlip(i)}
                style={{ width:i===displaySpread?18:5, height:5, borderRadius:99,
                  background:i===displaySpread?"var(--gold)":"rgba(255,255,255,.2)",
                  transition:"all .3s", cursor:"pointer" }} />
            ))}
          </div>
          <button className="btn-book" disabled={spread>=pages.length-1||animating} onClick={()=>onFlip("forward")} style={{ flex:1 }}>Next →</button>
        </div>
      </div>
    );
  }

  // ── DESKTOP: two-page spread ───────────────────────────────────────────────
  return (
    <div style={{ width:"100%", maxWidth:"min(88vw,820px)", margin:"0 auto", padding:"0 64px", boxSizing:"border-box" }}>
      {title && <div style={{ textAlign:"center", marginBottom:16 }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(16px,2.2vw,26px)", fontStyle:"italic", color:"var(--gold-light)", textShadow:"0 2px 20px rgba(200,170,80,.3)" }}>{title}</h2>
      </div>}

      <div style={{ perspective:"2800px", perspectiveOrigin:"50% 42%" }}>
        <div style={{ display:"flex", position:"relative", borderRadius:16,
          boxShadow:"0 80px 160px rgba(0,0,0,.85), 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)",
        }}>
          {/* LEFT PAGE — click anywhere to go back */}
          <div
            className={flipClass==="page-flip-back" ? "page-flip-back" : (enterClass==="page-enter-back" ? "page-enter-back" : "")}
            onClick={()=>{ if(!animating && !(coverImg?spread===-1:spread===0)) onFlip("back"); }}
            style={{ flex:1, display:"flex", position:"relative", overflow:"hidden",
              transformOrigin:"right center", transformStyle:"preserve-3d",
              borderRadius:"14px 0 0 14px",
              boxShadow:"inset -8px 0 20px rgba(0,0,0,.2)",
              cursor:(coverImg?spread===-1:spread===0)||animating?"default":"w-resize",
            }}>
            <PageContent idx={li} side="left" />
            {/* Click hint arrow — left page */}
            {!((coverImg?spread===-1:spread===0)) && !animating && (
              <div style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", opacity:0, transition:"opacity .2s", pointerEvents:"none" }} className="page-click-hint">‹</div>
            )}
          </div>

          {/* SPINE */}
          <div style={{ width:32, flexShrink:0, zIndex:10, position:"relative",
            background:"linear-gradient(90deg,#0a0300,#4a1e08 25%,#8b4513 45%,#c8782a 50%,#8b4513 55%,#4a1e08 75%,#0a0300)",
            boxShadow:"0 0 30px rgba(0,0,0,.9), inset 0 0 12px rgba(0,0,0,.5)",
          }}>
            <div style={{ position:"absolute", top:0, bottom:0, left:"50%", width:1.5, background:"linear-gradient(180deg,transparent 3%,rgba(201,168,76,.4) 30%,rgba(240,210,100,.6) 50%,rgba(201,168,76,.4) 70%,transparent 97%)" }} />
            <div style={{ position:"absolute", top:0, bottom:0, left:"30%", width:1, background:"linear-gradient(180deg,transparent 5%,rgba(255,255,255,.08) 50%,transparent 95%)" }} />
          </div>

          {/* RIGHT PAGE — click anywhere to go forward */}
          <div
            className={flipClass==="page-flip-forward" ? "page-flip-forward" : (enterClass==="page-enter-forward" ? "page-enter-forward" : "")}
            onClick={()=>{ if(!animating && spread<totalSpreads-1) onFlip("forward"); }}
            style={{ flex:1, display:"flex", position:"relative", overflow:"hidden",
              transformOrigin:"left center", transformStyle:"preserve-3d",
              borderRadius:"0 14px 14px 0",
              boxShadow:"inset 8px 0 20px rgba(0,0,0,.16)",
              cursor:spread>=totalSpreads-1||animating?"default":"e-resize",
            }}>
            <PageContent idx={ri} side="right" />
            {/* Click hint arrow — right page */}
            {spread<totalSpreads-1 && !animating && (
              <div style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", opacity:0, transition:"opacity .2s", pointerEvents:"none" }} className="page-click-hint">›</div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation — floating arrows + dots */}
      <div style={{ position:"relative", marginTop:0 }}>
        {/* Floating left arrow */}
        <button
          disabled={(coverImg?spread===-1:spread===0)||animating}
          onClick={()=>onFlip("back")}
          style={{ position:"absolute", left:-56, top:"50%", transform:"translateY(-50%)",
            width:44, height:44, borderRadius:"50%", border:"1px solid rgba(255,255,255,.12)",
            background:"rgba(255,255,255,.06)", backdropFilter:"blur(8px)",
            color:"rgba(255,255,255,.6)", fontSize:20, cursor:(coverImg?spread===-1:spread===0)||animating?"not-allowed":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            opacity:(coverImg?spread===-1:spread===0)||animating?0.25:1,
            transition:"all .15s", WebkitTapHighlightColor:"transparent" }}
          onMouseEnter={e=>{ if(!e.currentTarget.disabled) { e.currentTarget.style.background="rgba(255,255,255,.12)"; e.currentTarget.style.borderColor="rgba(255,255,255,.25)"; }}}
          onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,.06)"; e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; }}>
          ‹
        </button>
        {/* Floating right arrow */}
        <button
          disabled={spread>=totalSpreads-1||animating}
          onClick={()=>onFlip("forward")}
          style={{ position:"absolute", right:-56, top:"50%", transform:"translateY(-50%)",
            width:44, height:44, borderRadius:"50%", border:"1px solid rgba(255,255,255,.12)",
            background:"rgba(255,255,255,.06)", backdropFilter:"blur(8px)",
            color:"rgba(255,255,255,.6)", fontSize:20, cursor:spread>=totalSpreads-1||animating?"not-allowed":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
            opacity:spread>=totalSpreads-1||animating?0.25:1,
            transition:"all .15s", WebkitTapHighlightColor:"transparent" }}
          onMouseEnter={e=>{ if(!e.currentTarget.disabled) { e.currentTarget.style.background="rgba(255,255,255,.12)"; e.currentTarget.style.borderColor="rgba(255,255,255,.25)"; }}}
          onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,.06)"; e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; }}>
          ›
        </button>
      </div>
      {/* Spread dots — below book */}
      <div style={{ display:"flex", gap:7, alignItems:"center", justifyContent:"center", marginTop:18 }}>
        {Array.from({ length: totalSpreads }).map((_,i) => (
          <div key={i} onClick={()=>!animating&&onFlip(i)}
            style={{ width:i===spread?24:7, height:7, borderRadius:99, cursor:animating?"default":"pointer",
              background:i===spread?"var(--gold)":"rgba(255,255,255,.18)",
              transition:"all .3s", boxShadow:i===spread?"0 0 12px rgba(201,168,76,.6)":"none" }} />
        ))}
      </div>
      {/* Keyboard hint */}
      <p style={{ textAlign:"center", marginTop:10, fontSize:11, color:"rgba(255,255,255,.15)", fontFamily:"'Nunito',sans-serif" }}>
        Click a page · or use ← → arrow keys
      </p>
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
  const [libFilter, setLibFilter] = useState("all"); // "all" | "favorites"
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
  useEffect(() => { if (screen!=="landing") return; const t = setInterval(() => setDemoSpread(p => (p+1)%2), 3000); return () => clearInterval(t); }, [screen]);

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
    if (profs?.length) { const { data:b } = await supabase.from("badges").select("badge_id").eq("user_id",u.id); if (b) setBadges(b.map(x=>x.badge_id)); }
    if (!profs?.length) { setScreen("welcome"); return; }
    // Try to restore last reading session
    try {
      const lastStoryId = localStorage.getItem("dw_last_story");
      if (lastStoryId) {
        const { data: ls } = await supabase.from("stories").select("*").eq("id", lastStoryId).single();
        if (ls && ls.user_id === u.id) {
          const ps = ls.text.split("\n\n✦\n\n");
          const savedSpread = parseInt(localStorage.getItem("dw_spread_" + lastStoryId) ?? "-1");
          setPages(ps); setTitle(ls.title || ""); setImgs(ls.page_images || []);
          setCoverImg(ls.cover_image || null);
          setSpread(ls.cover_image ? -1 : 0);
          setStory(ls); setStoryPhase("ready"); setScreen("story");
          return;
        }
      }
    } catch {}
    setScreen("home");
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
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  useEffect(()=>{
    if(window.location.search.includes("payment=success")){
      setPaymentSuccess(true);
      window.history.replaceState({},"",window.location.pathname);
      setTimeout(()=>setPaymentSuccess(false), 5000);
    }
  },[]);

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
    // Strip proper nouns from scene text — Flux tries to render names as literal text in images
    const rawScene = pt.slice(0, 120);
    const scene = rawScene.replace(/\b[A-Z][a-z]{2,}\b/g, (w) => {
      const keep = ["The","She","He","They","Her","His","Then","When","And","But","So","Its"];
      return keep.includes(w) ? w : "the child";
    });
    const charDesc = charCard
      ? charCard.replace(/\b[A-Z][a-z]{2,}\b/g, (w) => ["The","She","He","They"].includes(w) ? w : "a child")
      : `a child age ${active.age||5} with a ${active.stuffed_animal||"stuffed bear"}`;
    // No-text instruction goes FIRST — models weight early prompt tokens most heavily
    return `No text, no letters, no words, no numbers, no writing, no signs, no labels anywhere in this image. Pure children's watercolor storybook illustration. ${charDesc}. ${scene}. Style: ${m.prompt}, soft pastel watercolor, dreamy glowing light, storybook art. No typography of any kind.`;
  };

  // Persist page position
  useEffect(() => {
    if (story?.id) {
      try {
        localStorage.setItem("dw_spread_" + story.id, spread);
        if (story?.id) localStorage.setItem("dw_last_story", story.id);
        localStorage.setItem("dw_last_screen", screen);
      } catch {}
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
    // One story per child per day
    const { data: todayStory } = await supabase.from("stories")
      .select("id").eq("user_id", user.id).eq("child_profile_id", active.id).eq("story_date", todayStr()).maybeSingle();
    if (todayStory) {
      // Already have one today — show friendly "come back tomorrow" modal
      setShowTomorrowModal("story");
      return;
    }
    setStoryPhase("text"); setScreen("story"); try { localStorage.setItem("dw_last_screen","story"); } catch {}
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
      ?`Write a warm personalized bedtime picture book for a child.\nChild details (use what feels natural — don't force every detail into every story):\n${profileText(active)}\nTone: ${m.prompt}.\nLesson to weave in naturally: ${lessonData?.prompt||"being kind to others"}.\n\nWrite EXACTLY 14 pages, separated by [PAGE].\nEach page = 1-2 SHORT sentences. Pure picture book style — lyrical, beautiful, surprising.\nChoose whichever details from the child's profile serve THIS particular story best. Not every detail needs to appear — pick the ones that make the story feel magical and personal.\nPage 1: ground the child in a specific cozy moment that sets up what comes next.\nPages 2-5: adventure unfolds naturally, building curiosity and wonder.\nPages 6-9: the heart — the challenge, the feeling, the discovery.\nPages 10-12: things come together, warmth, a moment of pride or joy.\nPages 13-14: a gentle landing into sleep. Complete, satisfying, hopeful.\nThe lesson should feel discovered, never stated. NO title. Start on page 1.`
      :`Write a warm personalized bedtime picture book.\nChild details (use what feels natural — weave in only what serves the story):\n${profileText(active)}\nTone: ${m.prompt}.\n\nWrite EXACTLY 14 pages, separated by [PAGE].\nEach page = 1-2 SHORT sentences. Pure picture book style — lyrical, vivid, surprising.\nDon't try to mention every detail — choose whichever elements from the child's profile make this particular story feel personal and alive. Let the story lead.\nPage 1: open on a specific, vivid moment. Immediate and grounding.\nPages 2-5: the adventure takes shape — curiosity, wonder, something unexpected.\nPages 6-9: the heart of the story — a challenge, a feeling, a choice.\nPages 10-12: resolution — things click into place, warmth, a small triumph.\nPages 13-14: a gentle drift toward sleep. Complete, happy, peaceful.\nNO title. Start on page 1.`;

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

      const coverPrompt=`No text, no letters, no words, no numbers, no writing, no labels anywhere in this image. A child with a stuffed animal in a ${m.prompt} dreamland scene. Soft watercolor pastel art, dreamy storybook illustration, magical glowing light, beautiful night sky. Pure illustration only. No typography of any kind.`;

      setStoryPhase("illustrating");
      const generated=new Array(ps.length).fill(null); let loaded=0;
      // Fire cover + all page images in parallel — cover gets a head start (no stagger)
      const coverPromise = (async () => {
        const url = await generateImage(coverPrompt);
        if (!url) return;
        const cached = saved?.id ? await cacheImage(url, saved.id, "cover") : url;
        setCoverImg(cached);
        if (saved?.id) await supabase.from("stories").update({ cover_image: cached }).eq("id", saved.id);
      })();

      await Promise.all([
        coverPromise,
        ...ps.map(async (pageText, i) => {
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
      })
      ]);
      setStoryPhase("ready");
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

  const toggleFavorite = async () => {
    if (!story) return;
    const newVal = !story.is_favorite;
    setStory(s => ({ ...s, is_favorite: newVal }));
    await supabase.from("stories").update({ is_favorite: newVal }).eq("id", story.id);
  };

  const generateSequel = async () => {
    if (extending || !story) return;
    setExtending(true);
    const m = MOODS.find(x => x.id === mood) || MOODS[0];
    const charCard = await getCharacterCard(active);
    const summary = pages.slice(0, 3).join(" ").slice(0, 300);
    const sequelPrompt = `Write a brand new 14-page bedtime picture book sequel to this story for ${profileText(active)}.
The previous story was called "${title}" and began: ${summary}...
Tone: ${m.prompt}.
This is a NEW standalone story — same characters, new adventure, new lesson.
Write EXACTLY 14 pages, separated by [PAGE].
Each page = 1-2 SHORT sentences. Pure picture book style.
Pages 1-2: re-introduce the characters in a new cozy situation.
Pages 3-6: new adventure begins, new challenge appears.
Pages 7-10: heart of story, face the challenge.
Pages 11-13: resolution, magic, joy.
Page 14: child drifts peacefully to sleep. Complete happy ending.
NO title. Start immediately.`;
    try {
      const [rawText, rawTitle] = await Promise.all([
        callClaude([{ role:"user", content:sequelPrompt }], 1800),
        callClaude([{ role:"user", content:`Magical 4-6 word sequel title for a bedtime story about ${active.child_name} and ${active.stuffed_animal||"a stuffed bear"}. Make it feel like a sequel to "${title}". Only the title.` }], 30),
      ]);
      const ps = rawText.split("[PAGE]").map(p => p.trim()).filter(p => p.length > 5).slice(0, 14);
      const fullText = ps.join("\n\n✦\n\n");
      const sequelTitle = rawTitle.trim();
      // Save as tomorrow's story (queue it)
      const sequelDate = library.some(s=>s.story_date===tomorrowStr()&&s.child_profile_id===active.id) ? todayStr() : tomorrowStr();
      const payload = { user_id:user.id, story_date:sequelDate, text:fullText, title:sequelTitle, child_profile_id:active.id, page_images:[], cover_image:null, is_sequel_of:story.id };
      const { data:saved } = await supabase.from("stories").insert(payload).select().single();
      // Show queued confirmation — don't navigate, just let images generate in background
      setShowTomorrowModal("sequel");
      setTitle(sequelTitle); setPages(ps); setImgs([]); setImgsLoaded(0); setCoverImg(null); setSpread(-1); setStory(saved); setStoryPhase("ready");
      // Generate cover + images
      const coverPrompt = `No text, no letters, no words, no numbers, no writing, no labels anywhere in this image. A child with a stuffed animal on a ${m.prompt} adventure. Soft watercolor pastel art, dreamy storybook illustration, magical glowing light, beautiful night sky. Pure illustration only. No typography of any kind.`;
      const generated = new Array(ps.length).fill(null);
      const coverP = (async () => {
        const url = await generateImage(coverPrompt); if (!url) return;
        const cached = saved?.id ? await cacheImage(url, saved.id, "cover") : url;
        setCoverImg(cached); if (saved?.id) supabase.from("stories").update({ cover_image:cached }).eq("id",saved.id);
      })();
      await Promise.all([coverP, ...ps.map(async (pageText, i) => {
        await new Promise(r => setTimeout(r, i * 1200));
        const url = await generateImage(imgPromptFor(pageText, m, charCard)); if (!url) return;
        const cached = saved?.id ? await cacheImage(url, saved.id, i) : url;
        generated[i] = cached; setImgsLoaded(l => l+1);
        setImgs(prev => { const n=[...prev]; n[i]=cached; return n; });
        if (saved?.id) supabase.from("stories").update({ page_images:[...generated] }).eq("id",saved.id);
        if (i===1) setStoryPhase("ready");
      })]);
      if (saved?.id) await supabase.from("stories").update({ page_images:generated }).eq("id",saved.id);
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
  const [showSequelPrompt, setShowSequelPrompt] = useState(false);
  const [showTomorrowModal, setShowTomorrowModal] = useState(null); // null | "story" | "sequel"

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
    const prompt = `No text, no letters, no words, no numbers anywhere in this image. Children's coloring book page. Pure black outlines on a completely white background. No color, no gray, no shading, no fills — only clean black lines on white. Large simple bold shapes with thick outlines, lots of open white space for a child to color in. A child with a stuffed animal. No typography of any kind.`;
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
      <div className={`wrap${screen==="landing" ? " landing-active" : ""}${screen==="home" ? " home-active" : ""}`}>

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
          <div className="fade" style={{ width:"100%", maxWidth:"100%", paddingBottom:0 }}>

            {/* ════════════════════════════════════════════════════════
                NAV
            ════════════════════════════════════════════════════════ */}
            <nav style={{
              position:"fixed", top:0, left:0, right:0, zIndex:100,
              padding:"0 clamp(20px,5vw,64px)",
              height:64,
              display:"flex", alignItems:"center", justifyContent:"space-between",
              background:"rgba(7,5,14,0.8)",
              backdropFilter:"blur(20px)",
              borderBottom:"1px solid rgba(255,255,255,.05)",
            }}>
              <DreamweaverLogo size={28} showText={true} />
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={()=>setScreen("login")}
                  style={{ padding:"9px 20px", borderRadius:8, background:"transparent", border:"1px solid rgba(255,255,255,.1)", color:"rgba(255,255,255,.5)", fontFamily:"'Nunito',sans-serif", fontWeight:600, fontSize:13, cursor:"pointer", transition:"all .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.25)";e.currentTarget.style.color="rgba(255,255,255,.85)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,.1)";e.currentTarget.style.color="rgba(255,255,255,.5)";}}>
                  Sign in
                </button>
                <button onClick={()=>setScreen("signup")}
                  style={{ padding:"9px 20px", borderRadius:8, background:"rgba(255,255,255,.95)", border:"none", color:"#0a0812", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:13, cursor:"pointer", transition:"all .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="white";e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.95)";e.currentTarget.style.transform="";}}>
                  Start free
                </button>
              </div>
            </nav>

            {/* ════════════════════════════════════════════════════════
                HERO
            ════════════════════════════════════════════════════════ */}
            <section style={{
              minHeight:"100svh",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              padding:"120px clamp(20px,5vw,64px) 80px",
              position:"relative", overflow:"hidden",
              textAlign:"center",
            }}>
              {/* Ambient mesh */}
              <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
                <div style={{ position:"absolute", top:"-10%", left:"50%", transform:"translateX(-50%)", width:"70vw", maxWidth:900, height:"70vw", maxHeight:900, borderRadius:"50%", background:"radial-gradient(ellipse,rgba(180,130,60,.06) 0%,transparent 60%)", filter:"blur(40px)" }} />
                <div style={{ position:"absolute", top:"20%", left:"-5%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(ellipse,rgba(120,60,220,.05) 0%,transparent 65%)", filter:"blur(60px)" }} />
                <div style={{ position:"absolute", bottom:"15%", right:"-5%", width:350, height:350, borderRadius:"50%", background:"radial-gradient(ellipse,rgba(60,140,220,.04) 0%,transparent 65%)", filter:"blur(60px)" }} />
              </div>

              {/* Noise grain overlay */}
              <div style={{ position:"absolute", inset:0, opacity:.025, backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize:"200px 200px", pointerEvents:"none" }} />

              {/* Badge */}
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:999, padding:"6px 16px", marginBottom:40, position:"relative" }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:"#c9a030", boxShadow:"0 0 8px #c9a030", flexShrink:0 }} />
                <span style={{ color:"rgba(255,255,255,.4)", fontSize:12, fontFamily:"'Nunito',sans-serif", fontWeight:600, letterSpacing:".06em" }}>AI-powered personalized bedtime stories</span>
              </div>

              {/* Headline — editorial, massive, tight */}
              <h1 style={{
                fontFamily:"'Playfair Display',serif",
                fontSize:"clamp(48px,9vw,110px)",
                lineHeight:1.02,
                letterSpacing:"-.03em",
                fontWeight:800,
                marginBottom:28,
                maxWidth:900,
                position:"relative",
              }}>
                <span style={{ color:"rgba(255,255,255,.92)" }}>Your child</span>
                <br />
                <em style={{
                  fontStyle:"italic",
                  background:"linear-gradient(105deg,#e8c96a 0%,#c9a030 40%,#a07820 100%)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                }}>is the hero.</em>
              </h1>

              {/* Subhead — single clean line */}
              <p style={{
                color:"rgba(255,255,255,.38)",
                fontSize:"clamp(16px,2.2vw,21px)",
                fontFamily:"'Nunito',sans-serif",
                fontWeight:400,
                letterSpacing:".01em",
                lineHeight:1.6,
                maxWidth:480,
                marginBottom:48,
                position:"relative",
              }}>
                A new illustrated story every night — starring your child, in 40 seconds.
              </p>

              {/* CTA cluster */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, position:"relative" }}>
                <button onClick={()=>setScreen("signup")}
                  style={{
                    padding:"clamp(16px,3vw,18px) clamp(36px,6vw,56px)",
                    borderRadius:12,
                    background:"rgba(255,255,255,.97)",
                    border:"none",
                    color:"#0a0812",
                    fontFamily:"'Nunito',sans-serif",
                    fontWeight:800,
                    fontSize:"clamp(15px,2vw,17px)",
                    cursor:"pointer",
                    letterSpacing:".01em",
                    transition:"all .18s",
                    boxShadow:"0 0 0 1px rgba(255,255,255,.15), 0 20px 60px rgba(0,0,0,.4)",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 0 0 1px rgba(255,255,255,.2), 0 28px 70px rgba(0,0,0,.5)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 0 0 1px rgba(255,255,255,.15), 0 20px 60px rgba(0,0,0,.4)";}}>
                  Start free tonight
                </button>
                <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                  {["No card required","7 nights free","Cancel anytime"].map((t,i)=>(
                    <span key={i} style={{ color:"rgba(255,255,255,.2)", fontSize:12, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ color:"rgba(201,168,76,.5)", fontSize:10 }}>✓</span>{t}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                PRODUCT SHOT — full-bleed cinematic book preview
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"0 clamp(20px,5vw,64px) 120px", position:"relative" }}>
              {/* Section label */}
              <div style={{ textAlign:"center", marginBottom:32 }}>
                <span style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,255,255,.18)", fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>Generated in under 40 seconds</span>
              </div>

              {/* Book spread */}
              <div style={{ maxWidth:860, margin:"0 auto", position:"relative" }}>
                {/* Glow behind book */}
                <div style={{ position:"absolute", inset:"-30px", borderRadius:40, background:"radial-gradient(ellipse at 50% 60%,rgba(180,130,60,.08) 0%,transparent 65%)", filter:"blur(20px)", pointerEvents:"none" }} />

                {(mobile||tablet) ? (
                  /* Mobile: single card */
                  <div style={{ borderRadius:20, overflow:"hidden", boxShadow:"0 40px 100px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.06)", position:"relative" }}>
                    <div style={{ background:"linear-gradient(175deg,#fefcf7,#fdf0dc)" }}>
                      <div style={{ width:"100%", aspectRatio:"16/9", position:"relative", overflow:"hidden", background:DEMO_STORY[demoSpread]?.fallback }}>
                        <img src={DEMO_STORY[demoSpread]?.img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{e.target.style.display="none";}} />
                        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:48, background:"linear-gradient(to bottom,transparent,rgba(254,240,220,.95))" }} />
                      </div>
                      <div style={{ padding:"22px 24px 26px", textAlign:"center" }}>
                        <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(16px,4vw,19px)", lineHeight:1.85, color:"#1a0f2e", fontStyle:"italic" }}>{DEMO_STORY[demoSpread]?.text}</p>
                      </div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"center", gap:8, padding:"12px 0 16px", background:"linear-gradient(175deg,#fdf0dc,#f8e4c0)" }}>
                      {DEMO_STORY.map((_,i)=><div key={i} onClick={()=>setDemoSpread(i)} style={{ width:i===demoSpread?20:6, height:6, borderRadius:99, background:i===demoSpread?"#c9a030":"rgba(0,0,0,.15)", cursor:"pointer", transition:"all .3s" }} />)}
                    </div>
                  </div>
                ) : (
                  /* Desktop: two-page spread */
                  <div style={{ display:"flex", borderRadius:20, overflow:"hidden", boxShadow:"0 60px 140px rgba(0,0,0,.9), 0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05)", cursor:"pointer" }} onClick={()=>setDemoSpread(p=>(p+1)%2)}>
                    <div style={{ width:20, flexShrink:0, background:"linear-gradient(90deg,#0a0200,#3a1600 40%,#6b3010 50%,#3a1600 60%,#0a0200)" }}>
                      <div style={{ width:"100%", height:"100%", background:"linear-gradient(180deg,transparent 10%,rgba(201,168,76,.2) 50%,transparent 90%)", marginLeft:"50%" }} />
                    </div>
                    {[0,1].map(side=>{
                      const idx=demoSpread*2+side, page=DEMO_STORY[idx];
                      return (
                        <div key={side} style={{ flex:1, background:side===0?"linear-gradient(175deg,#fefcf7,#fdf5e4)":"linear-gradient(175deg,#fdf8ee,#f9f0d8)", borderLeft:side===1?"1px solid rgba(0,0,0,.06)":"none" }}>
                          <div style={{ width:"100%", aspectRatio:"4/3", position:"relative", overflow:"hidden", background:page?.fallback||"#1a0a2e" }}>
                            <img src={page?.img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={e=>{e.target.style.display="none";e.target.parentElement.style.background=page?.fallback;}} />
                            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:40, background:`linear-gradient(to bottom,transparent,${side===0?"rgba(253,245,228,.95)":"rgba(249,240,216,.95)"})` }} />
                            <div style={{ position:"absolute", bottom:10, [side===0?"right":"left"]:10, background:"rgba(255,255,255,.75)", backdropFilter:"blur(4px)", borderRadius:99, padding:"2px 9px", fontSize:10, color:"#1a0f2e", fontWeight:700 }}>{idx+1}</div>
                          </div>
                          <div style={{ padding:"18px 22px 22px", minHeight:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(13px,1.3vw,15px)", lineHeight:1.9, color:"#1a0f2e", textAlign:"center", fontStyle:"italic" }}>{page?.text||""}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Click hint */}
                {!mobile && <p style={{ textAlign:"center", marginTop:14, fontSize:11, color:"rgba(255,255,255,.14)", fontFamily:"'Nunito',sans-serif", letterSpacing:".06em" }}>CLICK TO TURN PAGE</p>}
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                STATS BAR
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"48px clamp(20px,5vw,64px)", borderTop:"1px solid rgba(255,255,255,.1)", borderBottom:"1px solid rgba(255,255,255,.05)", marginBottom:120 }}>
              <div style={{ maxWidth:860, margin:"0 auto", display:"grid", gridTemplateColumns:mobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:mobile?"32px 16px":"0" }}>
                {[
                  { n:"40s", label:"Story generation" },
                  { n:"14", label:"Illustrated pages" },
                  { n:"2,000+", label:"Families" },
                  { n:"4.9★", label:"Parent rating" },
                ].map(({n,label},i)=>(
                  <div key={i} style={{ textAlign:"center", padding:mobile?"0":"0 24px", borderLeft:(!mobile&&i>0)?"1px solid rgba(255,255,255,.06)":"none" }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:800, letterSpacing:"-.02em", color:"rgba(255,255,255,.9)", marginBottom:4 }}>{n}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif", letterSpacing:".06em", textTransform:"uppercase" }}>{label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                HOW IT WORKS — minimal numbered list
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"0 clamp(20px,5vw,64px) 120px", maxWidth:860, margin:"0 auto" }}>
              <div style={{ marginBottom:64 }}>
                <p style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,255,255,.2)", fontFamily:"'Nunito',sans-serif", fontWeight:700, marginBottom:16 }}>How it works</p>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:800, letterSpacing:"-.025em", lineHeight:1.1, color:"rgba(255,255,255,.9)" }}>
                  Three steps to<br/><em style={{ fontStyle:"italic", color:"rgba(255,255,255,.45)" }}>bedtime magic.</em>
                </h2>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {[
                  { n:"01", title:"Tell us about your child", body:"Name, age, stuffed animal, best friend. Done in 30 seconds.", accent:"rgba(201,168,76,.6)" },
                  { n:"02", title:"Add a photo", body:"Optional — we match hair, eyes, skin tone. The hero looks just like them.", accent:"rgba(130,180,255,.5)" },
                  { n:"03", title:"Open tonight's book", body:"Fully illustrated. 14 pages. Ready in 40 seconds.", accent:"rgba(160,220,140,.5)" },
                ].map(({n,title,body,accent},i)=>(
                  <div key={i} style={{
                    display:"flex", gap:mobile?"20px":"40px", alignItems:"flex-start",
                    padding:"40px 0",
                    borderBottom: i<2 ? "1px solid rgba(255,255,255,.05)" : "none",
                  }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(36px,6vw,72px)", fontWeight:800, letterSpacing:"-.04em", color:"rgba(255,255,255,.06)", lineHeight:1, flexShrink:0, minWidth:mobile?60:100, userSelect:"none" }}>{n}</div>
                    <div style={{ paddingTop:mobile?4:8 }}>
                      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(18px,2.5vw,26px)", fontWeight:700, marginBottom:10, color:"rgba(255,255,255,.88)", letterSpacing:"-.01em" }}>{title}</h3>
                      <p style={{ color:"rgba(255,255,255,.32)", fontSize:"clamp(14px,1.6vw,16px)", lineHeight:1.7, fontFamily:"'Nunito',sans-serif", fontWeight:400, maxWidth:480 }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                FEATURES — sparse grid
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"0 clamp(20px,5vw,64px) 120px" }}>
              <div style={{ maxWidth:860, margin:"0 auto" }}>
                <div style={{ marginBottom:56 }}>
                  <p style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,255,255,.2)", fontFamily:"'Nunito',sans-serif", fontWeight:700, marginBottom:16 }}>Everything included</p>
                  <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:800, letterSpacing:"-.025em", lineHeight:1.1, color:"rgba(255,255,255,.9)" }}>
                    One subscription.<br/><em style={{ fontStyle:"italic", color:"rgba(255,255,255,.45)" }}>A lifetime of stories.</em>
                  </h2>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)", gap:"1px", background:"rgba(255,255,255,.05)", borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,.05)" }}>
                  {[
                    { icon:"🎨", title:"Watercolor illustrations", desc:"Every page painted in soft pastel watercolor" },
                    { icon:"📸", title:"Photo-matched hero", desc:"Upload a photo — the character looks like your child" },
                    { icon:"🧸", title:"Deeply personal", desc:"Name, stuffed animal, best friend in every story" },
                    { icon:"✨", title:"Life lessons", desc:"Kindness, bravery, patience — woven in naturally" },
                    { icon:"📚", title:"Library saved forever", desc:"Every story archived and re-readable anytime" },
                    { icon:"🔊", title:"Read aloud", desc:"Calm narration reads the story at bedtime" },
                    { icon:"🖍️", title:"Coloring pages", desc:"Turn any story into a printable coloring page" },
                    { icon:"🏅", title:"Milestone badges", desc:"Kids earn rewards for reading streaks" },
                    { icon:"✍️", title:"Sequels", desc:"Loved a story? Continue the adventure tomorrow" },
                  ].map(({icon,title,desc},i)=>(
                    <div key={i}
                      style={{ padding:"clamp(20px,2.5vw,28px)", background:"rgba(255,255,255,.015)", transition:"background .15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.015)";}}>
                      <div style={{ fontSize:22, marginBottom:12 }}>{icon}</div>
                      <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:14, color:"rgba(255,255,255,.82)", marginBottom:6 }}>{title}</div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,.28)", lineHeight:1.6, fontFamily:"'Nunito',sans-serif" }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                EMOTIONAL SECTION — large type, lots of space
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"80px clamp(20px,5vw,64px) 120px", textAlign:"center", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 50%,rgba(180,130,60,.04) 0%,transparent 60%)", pointerEvents:"none" }} />
              <div style={{ maxWidth:680, margin:"0 auto", position:"relative" }}>
                <div style={{ fontSize:"clamp(48px,8vw,80px)", marginBottom:32, filter:"drop-shadow(0 0 40px rgba(200,170,80,.3))", animation:"float 6s ease-in-out infinite" }}>🌙</div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(32px,5.5vw,60px)", fontWeight:800, letterSpacing:"-.025em", lineHeight:1.1, marginBottom:24, color:"rgba(255,255,255,.9)" }}>
                  Bedtime isn't just a story.<br/>
                  <em style={{ fontStyle:"italic", background:"linear-gradient(105deg,#e8c96a 0%,#c9a030 60%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>It's a memory.</em>
                </h2>
                <p style={{ color:"rgba(255,255,255,.32)", fontSize:"clamp(16px,2vw,19px)", lineHeight:1.8, fontFamily:"'Nunito',sans-serif", fontWeight:400, marginBottom:48 }}>
                  Five minutes. No screens. No stress.<br/>Just you and them, in a world made only for tonight.
                </p>
                <button onClick={()=>setScreen("signup")}
                  style={{
                    padding:"clamp(16px,3vw,18px) clamp(36px,6vw,56px)",
                    borderRadius:12, background:"rgba(255,255,255,.97)", border:"none",
                    color:"#0a0812", fontFamily:"'Nunito',sans-serif", fontWeight:800,
                    fontSize:"clamp(15px,2vw,17px)", cursor:"pointer", letterSpacing:".01em",
                    transition:"all .18s", boxShadow:"0 0 0 1px rgba(255,255,255,.15), 0 20px 60px rgba(0,0,0,.4)",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";}}>
                  Start your first story
                </button>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                TESTIMONIALS
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"0 clamp(20px,5vw,64px) 120px", maxWidth:860, margin:"0 auto" }}>
              <div style={{ marginBottom:56 }}>
                <p style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,255,255,.2)", fontFamily:"'Nunito',sans-serif", fontWeight:700, marginBottom:8 }}>From parents</p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ display:"flex", gap:2 }}>{"★★★★★".split("").map((s,i)=><span key={i} style={{ color:"#c9a030", fontSize:18 }}>{s}</span>)}</div>
                  <span style={{ color:"rgba(255,255,255,.3)", fontSize:13, fontFamily:"'Nunito',sans-serif" }}>4.9 · 487 reviews · used in 32 states</span>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)", gap:1, background:"rgba(255,255,255,.05)", borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,.05)" }}>
                {[
                  { q:"My daughter asks for her story every single night. She loves that Mr. Hops is always the hero.", name:"Sarah M.", role:"Mom of a 5-year-old", init:"SM" },
                  { q:"The illustrations look like a real children's picture book. I'm genuinely blown away every time.", name:"James T.", role:"Dad of twins", init:"JT" },
                  { q:"We used the bravery story when my son was scared of the dark. He asked to read it three nights in a row.", name:"Priya K.", role:"Mom of a 6-year-old", init:"PK" },
                ].map(({q,name,role,init},i)=>(
                  <div key={i} style={{ padding:"clamp(24px,3vw,32px)", background:"rgba(255,255,255,.015)" }}>
                    <div style={{ color:"#c9a030", fontSize:13, letterSpacing:2, marginBottom:16 }}>★★★★★</div>
                    <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", color:"rgba(255,255,255,.55)", fontSize:"clamp(14px,1.4vw,16px)", lineHeight:1.8, marginBottom:20 }}>"{q}"</p>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"rgba(255,255,255,.5)", fontFamily:"'Nunito',sans-serif", flexShrink:0 }}>{init}</div>
                      <div>
                        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:13, color:"rgba(255,255,255,.7)" }}>{name}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif" }}>{role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                PRICING
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding:"0 clamp(20px,5vw,64px) 120px", maxWidth:520, margin:"0 auto" }}>
              <div style={{ borderRadius:20, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.02)", overflow:"hidden" }}>
                {/* Top accent line */}
                <div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(201,168,76,.5),transparent)" }} />
                <div style={{ padding:"clamp(32px,5vw,48px)" }}>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(201,168,76,.08)", border:"1px solid rgba(201,168,76,.15)", borderRadius:999, padding:"4px 14px", marginBottom:28 }}>
                    <span style={{ color:"rgba(201,168,76,.8)", fontSize:11, fontWeight:700, fontFamily:"'Nunito',sans-serif", letterSpacing:".06em" }}>7 NIGHTS FREE</span>
                  </div>

                  <div style={{ marginBottom:8 }}>
                    <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(52px,9vw,72px)", fontWeight:800, letterSpacing:"-.03em", color:"rgba(255,255,255,.9)" }}>$5.99</span>
                    <span style={{ color:"rgba(255,255,255,.2)", fontSize:16, marginLeft:6, fontFamily:"'Nunito',sans-serif" }}>/month</span>
                  </div>
                  <p style={{ color:"rgba(255,255,255,.25)", fontSize:13, fontFamily:"'Nunito',sans-serif", marginBottom:36 }}>
                    First child · +$2.99/mo per additional child
                  </p>

                  <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:36 }}>
                    {[
                      "14-page illustrated story every night",
                      "AI watercolor art on every page",
                      "Photo-matched character illustrations",
                      "Story library saved forever",
                      "Life lesson story mode",
                      "Coloring page generator",
                      "Read aloud narrator",
                      "Cancel anytime",
                    ].map(f=>(
                      <div key={f} style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ color:"rgba(225,195,95,.9)", fontSize:12, flexShrink:0 }}>—</span>
                        <span style={{ color:"rgba(255,255,255,.45)", fontSize:13, fontFamily:"'Nunito',sans-serif" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={()=>setScreen("signup")}
                    style={{ width:"100%", padding:"clamp(16px,3vw,18px)", borderRadius:12, background:"rgba(255,255,255,.97)", border:"none", color:"#0a0812", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15, cursor:"pointer", transition:"all .18s", letterSpacing:".01em" }}
                    onMouseEnter={e=>{e.currentTarget.style.background="white";e.currentTarget.style.transform="translateY(-1px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.97)";e.currentTarget.style.transform="";}}>
                    Start free tonight
                  </button>
                  <p style={{ textAlign:"center", color:"rgba(255,255,255,.15)", fontSize:11, marginTop:12, fontFamily:"'Nunito',sans-serif" }}>No credit card required</p>
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                FOOTER
            ════════════════════════════════════════════════════════ */}
            <footer style={{ padding:"40px clamp(20px,5vw,64px) 60px", borderTop:"1px solid rgba(255,255,255,.1)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
              <DreamweaverLogo size={22} showText={true} />
              <p style={{ color:"rgba(255,255,255,.14)", fontSize:12, fontFamily:"'Nunito',sans-serif" }}>© 2025 DreamWeaver · Made for bedtime</p>
            </footer>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LOGIN
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="login" && (
          <div className="fade" style={{ maxWidth:400, width:"100%", display:"flex", flexDirection:"column", justifyContent:"center", minHeight:"82vh", gap:0 }}>
            <div style={{ textAlign:"center", marginBottom:36 }}>
              <div style={{ fontSize:54, marginBottom:14, animation:"float 5s ease-in-out infinite", filter:"drop-shadow(0 0 28px rgba(200,165,55,.5))", display:"inline-block" }}>🌙</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:800, letterSpacing:"-.025em", color:"var(--text-1)", marginBottom:6 }}>DreamWeaver</div>
              <div style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", color:"var(--text-3)", fontSize:16 }}>Bedtime stories, reimagined</div>
            </div>
            <div className="form-card" style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ marginBottom:4 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, color:"var(--text-1)", marginBottom:6 }}>Welcome back</div>
                <div style={{ fontSize:13, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif" }}>Sign in to your child's story world</div>
              </div>
              {err && <div className="err">{err}</div>}
              <div>
                <label>Email address</label>
                <input type="email" placeholder="you@example.com" value={af.email} onChange={e=>setAf({...af,email:e.target.value})} onKeyDown={e=>e.key==="Enter"&&login()} autoFocus />
              </div>
              <div>
                <label>Password</label>
                <input type="password" placeholder="Your password" value={af.password} onChange={e=>setAf({...af,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&login()} />
              </div>
              <button className="btn-solid" style={{ marginTop:4 }} onClick={login}>Sign in →</button>
              <div style={{ borderTop:"1px solid var(--border-1)", paddingTop:16, textAlign:"center", fontSize:14, color:"var(--text-3)" }}>
                No account? <span className="lnk" onClick={()=>{setErr("");setScreen("signup");}}>Start 7-night free trial</span>
              </div>
            </div>
          </div>
        )}

        {screen==="signup" && (
          <div className="fade" style={{ maxWidth:400, width:"100%", display:"flex", flexDirection:"column", justifyContent:"center", minHeight:"82vh" }}>
            <div style={{ textAlign:"center", marginBottom:32 }}>
              <div style={{ fontSize:54, marginBottom:14, animation:"float 5s ease-in-out infinite", filter:"drop-shadow(0 0 28px rgba(200,165,55,.5))", display:"inline-block" }}>🌙</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:800, letterSpacing:"-.025em", color:"var(--text-1)" }}>DreamWeaver</div>
            </div>
            <div className="form-card" style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ marginBottom:4 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, color:"var(--text-1)", marginBottom:6 }}>Start your free trial</div>
                <div style={{ fontSize:13, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif" }}>7 nights free · $5.99/mo after · no credit card</div>
              </div>
              {err && <div className="err">{err}</div>}
              <div>
                <label>Your name</label>
                <input type="text" placeholder="Parent's name" value={af.name} onChange={e=>setAf({...af,name:e.target.value})} onKeyDown={e=>e.key==="Enter"&&signup()} autoFocus />
              </div>
              <div>
                <label>Email address</label>
                <input type="email" placeholder="you@example.com" value={af.email} onChange={e=>setAf({...af,email:e.target.value})} onKeyDown={e=>e.key==="Enter"&&signup()} />
              </div>
              <div>
                <label>Password</label>
                <input type="password" placeholder="Create a password" value={af.password} onChange={e=>setAf({...af,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&signup()} />
              </div>
              <button className="btn-cta full" style={{ marginTop:4 }} onClick={signup}>Create free account ✨</button>
              <div style={{ borderTop:"1px solid var(--border-1)", paddingTop:16, textAlign:"center", fontSize:14, color:"var(--text-3)" }}>
                Have an account? <span className="lnk" onClick={()=>{setErr("");setScreen("login");}}>Sign in</span>
              </div>
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
              <em style={{ background:"linear-gradient(120deg,#e8c96a 0%,#d4a842 50%,#c49030 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
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
                { n:"2", icon:"🌙", title:"Open tonight's story", desc:"A 14-page illustrated book generates in ~40 seconds." },
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
        {screen==="home" && active && (() => {
          const todayStory   = library.find(s => s.story_date===todayStr() && s.child_profile_id===active.id);
          const lastStory    = library.find(s => s.child_profile_id===active.id && s.story_date!==todayStr());
          const childStories = library.filter(s => s.child_profile_id===active.id).length;
          const hour         = new Date().getHours();
          const greeting     = hour < 5 ? "Still up?" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Bedtime";
          const moonPhase    = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"][new Date().getDate() % 8];
          const nightsLeft   = sub?.status==="trial" ? daysLeft() : null;
          const selLesson    = LESSONS.find(l => l.id===lesson);
          const selMood      = MOODS.find(m => m.id===mood);

          return (
            <div className="fade has-bottom-nav hw-shell" style={{ width:"100%", maxWidth: mobile ? "100%" : 980 }}>
              <div style={{
                display:"flex", flexDirection: mobile ? "column" : "row",
                minHeight: mobile ? "auto" : "100vh",
                borderRadius: 0,
                overflow:"hidden",
                border: "none",
              }}>

                {/* ── SIDEBAR ── */}
                {!mobile && (
                  <div style={{ width:220, flexShrink:0, borderRight:"1px solid rgba(255,255,255,.05)", display:"flex", flexDirection:"column", background:"rgba(255,255,255,.025)" }}>
                    <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
                      <DreamweaverLogo size={22} showText={true} />
                    </div>
                    <div style={{ padding:"16px 12px", flex:1 }}>
                      <div style={{ fontSize:10, letterSpacing:".12em", textTransform:"uppercase", color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif", fontWeight:700, padding:"0 8px", marginBottom:8 }}>Children</div>
                      {profiles.map((p) => {
                        const on = active?.id===p.id;
                        return (
                          <button key={p.id} onClick={()=>{setActive(p);setPf(p);}}
                            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 8px", borderRadius:8, marginBottom:1, background: on ? "rgba(255,255,255,.09)" : "transparent", border:"none", cursor:"pointer", transition:"background .12s", textAlign:"left" }}
                            onMouseEnter={e=>{ if(!on) e.currentTarget.style.background="rgba(255,255,255,.04)"; }}
                            onMouseLeave={e=>{ if(!on) e.currentTarget.style.background="transparent"; }}>
                            <div style={{ width:26, height:26, borderRadius:7, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, fontFamily:"'Nunito',sans-serif", background: on ? "rgba(201,168,76,.25)" : "rgba(255,255,255,.07)", border: on ? "1px solid rgba(201,168,76,.4)" : "1px solid rgba(255,255,255,.1)", color: on ? "#e8c96a" : "rgba(255,255,255,.45)" }}>
                              {p.child_name[0].toUpperCase()}
                            </div>
                            <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight: on ? 700 : 500, color: on ? "white" : "rgba(255,255,255,.45)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.child_name}</span>
                          </button>
                        );
                      })}
                      {canAddProfile()
                        ? <button onClick={()=>{setEditId(null);setPf({child_name:"",age:"",stuffed_animal:"",best_friend:"",favorite_animal:"",scared_of:"",favorite_thing:""});setWizStep(0);setScreen("wizard");}}
                            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 8px", borderRadius:8, marginTop:4, background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}
                            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";}}
                            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                            <div style={{ width:26, height:26, borderRadius:7, border:"1px dashed rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <span style={{ fontSize:14, color:"rgba(255,255,255,.25)", lineHeight:1 }}>+</span>
                            </div>
                            <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"rgba(255,255,255,.3)", fontWeight:500 }}>Add child</span>
                          </button>
                        : <button onClick={()=>setScreen("paywall")}
                            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 8px", borderRadius:8, marginTop:4, background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}>
                            <div style={{ width:26, height:26, borderRadius:7, border:"1px dashed rgba(201,168,76,.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <span style={{ fontSize:11, color:"rgba(201,168,76,.4)" }}>+</span>
                            </div>
                            <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"rgba(201,168,76,.45)", fontWeight:500 }}>Add child</span>
                          </button>
                      }
                    </div>
                    <div style={{ padding:"12px 12px 20px", borderTop:"1px solid rgba(255,255,255,.07)" }}>
                      {[
                        { label:"Library", path:"M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z", fn:()=>{loadLibrary();setScreen("library");} },
                        { label:"Badges", path:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", fn:()=>setScreen("badges") },
                        { label:"Settings", path:"M12 15a3 3 0 100-6 3 3 0 000 6zm7.07-1.07a7 7 0 000-3.86l2.28-.37a9 9 0 000-4.02l-2.28-.37a7 7 0 00-2.72-2.72l-.37-2.28a9 9 0 00-4.02 0l-.37 2.28a7 7 0 00-2.72 2.72l-2.28.37a9 9 0 000 4.02l2.28.37a7 7 0 002.72 2.72l.37 2.28a9 9 0 004.02 0l.37-2.28a7 7 0 002.72-2.72z", fn:()=>setScreen("settings") },
                      ].map(({label,path,fn})=>(
                        <button key={label} onClick={fn}
                          style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 8px", borderRadius:8, background:"transparent", border:"none", cursor:"pointer", marginBottom:1, textAlign:"left" }}
                          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
                          <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"rgba(255,255,255,.5)", fontWeight:500 }}>{label}</span>
                        </button>
                      ))}
                      {nightsLeft !== null && (
                        <div style={{ marginTop:12, padding:"10px 12px", borderRadius:8, background:"rgba(201,168,76,.07)", border:"1px solid rgba(201,168,76,.15)" }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"rgba(225,195,95,.95)", fontFamily:"'Nunito',sans-serif", marginBottom:1 }}>{nightsLeft} nights free</div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", fontFamily:"'Nunito',sans-serif" }}>Free trial · then $5.99/mo</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── MAIN PANEL ── */}
                <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflowY:"auto", background:"transparent" }}>

                  {/* Mobile header */}
                  {mobile && (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
                      <DreamweaverLogo size={20} showText={true} />
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        {streak > 0 && <div style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:6, background:"rgba(255,120,30,.1)", border:"1px solid rgba(255,120,30,.2)" }}><span style={{ fontSize:11 }}>🔥</span><span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:700, color:"rgba(255,160,60,.9)" }}>{streak}</span></div>}
                        <button onClick={()=>setScreen("settings")} style={{ width:30, height:30, borderRadius:6, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mobile child tabs */}
                  {mobile && (
                    <div style={{ display:"flex", overflowX:"auto", scrollbarWidth:"none", borderBottom:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
                      {profiles.map(p => {
                        const on = active?.id===p.id;
                        return <button key={p.id} onClick={()=>{setActive(p);setPf(p);}} style={{ flexShrink:0, padding:"11px 18px", background:"transparent", border:"none", borderBottom: on?"2px solid rgba(201,168,76,.75)":"2px solid transparent", cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight: on?700:500, color: on?"rgba(255,255,255,.9)":"rgba(255,255,255,.35)", marginBottom:"-1px", transition:"all .15s", WebkitTapHighlightColor:"transparent" }}>{p.child_name}</button>;
                      })}
                      {canAddProfile() && <button onClick={()=>{setEditId(null);setPf({child_name:"",age:"",stuffed_animal:"",best_friend:"",favorite_animal:"",scared_of:"",favorite_thing:""});setWizStep(0);setScreen("wizard");}} style={{ flexShrink:0, padding:"11px 14px", background:"transparent", border:"none", borderBottom:"2px solid transparent", cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:13, color:"rgba(255,255,255,.2)", marginBottom:"-1px" }}>+ Add</button>}
                    </div>
                  )}

                  {/* SCROLLABLE CONTENT */}
                  <div style={{ flex:1, padding:mobile?"20px 18px 110px":"32px 40px 40px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto" }}>

                    {/* ── Greeting ── */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                        <div style={{ fontSize:mobile?46:54, lineHeight:1, filter:"drop-shadow(0 0 22px rgba(200,170,80,.5))", animation:"float 5s ease-in-out infinite", flexShrink:0 }}>{moonPhase}</div>
                        <div>
                          <div style={{ fontSize:11, letterSpacing:".1em", textTransform:"uppercase", color:"var(--text-3)", fontFamily:"'Nunito',sans-serif", fontWeight:700, marginBottom:4 }}>{greeting}</div>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:mobile?"clamp(26px,7vw,34px)":36, fontWeight:800, letterSpacing:"-.025em", color:"var(--text-1)", lineHeight:1 }}>
                            {active.child_name}
                          </div>
                        </div>
                      </div>
                      {!mobile && (
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:0, borderRadius:10, border:"1px solid var(--border-1)", overflow:"hidden" }}>
                            {[{v:streak||0,l:"streak",i:"🔥"},{v:childStories,l:"stories",i:"📖"},{v:badges.length,l:"badges",i:"🏅"}].map(({v,l,i},idx)=>(
                              <div key={l} style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", borderRight:idx<2?"1px solid var(--border-1)":"none", background:"var(--surface-1)" }}>
                                <span style={{ fontSize:13 }}>{i}</span>
                                <div>
                                  <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:15, fontWeight:800, color:"var(--text-1)", lineHeight:1 }}>{v}</div>
                                  <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:10, color:"var(--text-3)", marginTop:1 }}>{l}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button onClick={()=>setScreen("settings")} style={{ width:38, height:38, borderRadius:10, background:"var(--surface-1)", border:"1px solid var(--border-1)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Story type ── */}
                    <div className="s-card">
                      <div className="s-card-head">
                        <div className="step-num">1</div>
                        <span style={{ fontSize:11, letterSpacing:".12em", textTransform:"uppercase", color:"var(--text-3)", fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>Story type</span>
                      </div>
                      <div style={{ padding:"12px 12px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {[
                          {id:"adventure", label:"Adventure", sub:"Pure imagination and fun", icon:"🌙"},
                          {id:"lesson",    label:"Life lesson", sub:"Woven with a gentle moral", icon:"✨"},
                        ].map(t=>(
                          <button key={t.id} onClick={()=>setStoryMode(t.id)}
                            className={"type-tile"+(storyMode===t.id?" on":"")}>
                            <div style={{ fontSize:22, marginBottom:10 }}>{t.icon}</div>
                            <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15, color:storyMode===t.id?"var(--gold-light)":"var(--text-2)", marginBottom:4 }}>{t.label}</div>
                            <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:storyMode===t.id?"var(--text-2)":"var(--text-4)", lineHeight:1.4 }}>{t.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Lesson ── */}
                    {storyMode==="lesson" && (
                      <div className="s-card">
                        <div className="s-card-head">
                          <div className="step-num">2</div>
                          <span style={{ fontSize:11, letterSpacing:".12em", textTransform:"uppercase", color:"var(--text-3)", fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>Lesson</span>
                        </div>
                        <div style={{ padding:"12px 12px", display:"flex", flexWrap:"wrap", gap:7 }}>
                          {LESSONS.map(l=>(
                            <button key={l.id} onClick={()=>setLesson(l.id)} className={"sel-pill"+(lesson===l.id?" on":"")}>
                              {l.emoji} {l.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Mood ── */}
                    <div className="s-card">
                      <div className="s-card-head">
                        <div className="step-num">{storyMode==="lesson"?"3":"2"}</div>
                        <span style={{ fontSize:11, letterSpacing:".12em", textTransform:"uppercase", color:"var(--text-3)", fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>Mood</span>
                      </div>
                      <div style={{ padding:"12px 12px", display:"flex", flexWrap:"wrap", gap:7 }}>
                        {MOODS.map(m=>(
                          <button key={m.id} onClick={()=>setMood(m.id)} className={"sel-pill"+(mood===m.id?" on":"")} style={{ fontSize:14, padding:"10px 18px" }}>
                            {m.emoji} {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Last story ── */}
                    {lastStory && !todayStory && (
                      <div onClick={()=>{const ps=lastStory.text.split("\n\n✦\n\n");setPages(ps);setTitle(lastStory.title||"");setImgs(lastStory.page_images||[]);setCoverImg(lastStory.cover_image||null);setSpread(lastStory.cover_image?-1:0);setStory(lastStory);setStoryPhase("ready");setScreen("story");try{localStorage.setItem("dw_last_story",lastStory.id);}catch{}}}
                        style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:14, border:"1px solid var(--border-1)", background:"var(--surface-1)", cursor:"pointer", transition:"all .15s" }}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--surface-2)";e.currentTarget.style.borderColor="var(--border-2)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="var(--surface-1)";e.currentTarget.style.borderColor="var(--border-1)";}}>
                        <div style={{ width:42, height:54, borderRadius:7, overflow:"hidden", flexShrink:0, background:"var(--surface-2)", border:"1px solid var(--border-1)" }}>
                          {lastStory.cover_image && <img src={lastStory.cover_image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:10, letterSpacing:".1em", textTransform:"uppercase", color:"var(--text-3)", fontFamily:"'Nunito',sans-serif", fontWeight:700, marginBottom:3 }}>Last night</div>
                          <div style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:15, color:"var(--text-1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{lastStory.title||"Your last story"}</div>
                        </div>
                        <span style={{ fontSize:12, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif", flexShrink:0 }}>Re-read →</span>
                      </div>
                    )}

                    {/* ── Photo nudge ── */}
                    {!active.character_card && (
                      <div onClick={()=>{setEditId(active.id);setPf(active);setScreen("profile");}}
                        style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:14, border:"1px solid var(--border-1)", background:"var(--surface-1)", cursor:"pointer", transition:"all .15s" }}
                        onMouseEnter={e=>{e.currentTarget.style.background="var(--surface-2)";e.currentTarget.style.borderColor="var(--border-2)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="var(--surface-1)";e.currentTarget.style.borderColor="var(--border-1)";}}>
                        <div style={{ width:42, height:42, borderRadius:10, border:"1.5px dashed rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:700, color:"var(--text-2)", marginBottom:2 }}>Add {active.child_name}'s photo</div>
                          <div style={{ fontSize:12, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif" }}>The hero will look just like them</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    )}

                    {/* ── Generate ── */}
                    <div>
                      <button onClick={generateStory}
                        style={{
                          width:"100%", padding:mobile?"19px":"18px", borderRadius:14, cursor:"pointer",
                          background:todayStory?"var(--surface-2)":"linear-gradient(135deg,#d4a842,#b88a20)",
                          color:todayStory?"var(--text-2)":"#130c00",
                          fontFamily:"'Nunito',sans-serif", fontWeight:800,
                          fontSize:mobile?17:16, letterSpacing:".01em",
                          border:todayStory?"1px solid var(--border-1)":"none",
                          boxShadow:todayStory?"none":"0 6px 28px rgba(180,130,30,.4)",
                          transition:"all .16s", WebkitTapHighlightColor:"transparent",
                        }}
                        onMouseEnter={e=>{if(!todayStory){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 10px 36px rgba(180,130,30,.55)";}}}
                        onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=todayStory?"none":"0 6px 28px rgba(180,130,30,.4)";}}>
                        {todayStory
                          ? "📖  Read tonight's story"
                          : storyMode==="lesson"
                            ? `✨  Generate — ${selLesson?.label||"Kindness"} · ${selMood?.label||"Magical"}`
                            : `✨  Generate — ${selMood?.label||"Magical"} adventure`}
                      </button>
                      {!todayStory && (
                        <div style={{ textAlign:"center", marginTop:10, fontSize:12, color:"var(--text-4)", fontFamily:"'Nunito',sans-serif" }}>
                          14 illustrated pages · ready in ~40 seconds
                        </div>
                      )}
                    </div>

                    {/* ── Footer ── */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:4 }}>
                      <button onClick={()=>{setEditId(active.id);setPf(active);setScreen("profile");}} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:12, color:"var(--text-4)", padding:0, transition:"color .14s" }} onMouseEnter={e=>{e.currentTarget.style.color="var(--text-2)";}} onMouseLeave={e=>{e.currentTarget.style.color="var(--text-4)";}}>
                        Edit {active.child_name}'s profile →
                      </button>
                      {!mobile && (
                        <div style={{ display:"flex", gap:16 }}>
                          {[{l:"Library",fn:()=>{loadLibrary();setScreen("library");}},{l:"Badges",fn:()=>setScreen("badges")}].map(({l,fn})=>(
                            <button key={l} onClick={fn} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:12, color:"var(--text-4)", padding:0, transition:"color .14s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--text-2)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text-4)"}>{l}</button>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>{/* /scroll */}

                </div>{/* /main */}
              </div>{/* /shell */}

              {/* Milestone overlay */}
              {streakCelebrate && streakMilestone && (
                <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, background:"rgba(0,0,0,.7)", backdropFilter:"blur(16px)" }}>
                  <div style={{ textAlign:"center", animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)", background:"rgba(12,10,22,.98)", border:"1px solid rgba(255,255,255,.08)", borderRadius:16, padding:"48px 40px", maxWidth:300, margin:"0 20px", boxShadow:"0 40px 80px rgba(0,0,0,.9)" }}>
                    <div style={{ fontSize:52, marginBottom:16, animation:"float 2s ease-in-out infinite" }}>🔥</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:800, color:"rgba(255,255,255,.9)", marginBottom:8, letterSpacing:"-.02em" }}>{streakMilestone} nights</div>
                    <p style={{ color:"rgba(255,255,255,.3)", fontFamily:"'Nunito',sans-serif", fontSize:14, lineHeight:1.6, marginBottom:28 }}>
                      {streakMilestone===3?"Three nights in a row.":streakMilestone===7?"A full week of stories.":"Thirty nights. Legendary."}
                    </p>
                    <button onClick={()=>setStreakCelebrate(false)} style={{ padding:"11px 28px", borderRadius:8, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", color:"rgba(255,255,255,.6)", fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight:700, cursor:"pointer" }}>Continue</button>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

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
          <div className="fade has-bottom-nav" style={{ maxWidth:"min(96vw,960px)", width:"100%", paddingBottom:20 }}>
            {(storyPhase==="text" || storyPhase==="idle") && <MoonLoader text="Writing your story…" childName={active?.child_name||""} />}
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
                  {/* Actions */}
                  <button className="btn-book" onClick={toggleFavorite}
                    style={{ background:story?.is_favorite?"rgba(201,168,76,.1)":"", borderColor:story?.is_favorite?"rgba(201,168,76,.4)":"", color:story?.is_favorite?"var(--gold-light)":"rgba(255,255,255,.6)" }}>
                    <span>{story?.is_favorite ? "★" : "☆"}</span>
                    {story?.is_favorite ? "Saved to Favorites" : "Save to Favorites"}
                  </button>
                  <button className="btn-book" onClick={generateColoringPage} disabled={coloringLoading}
                    style={{ borderColor:"rgba(192,132,252,.25)", color:"#c4a0ff" }}>
                    <span>{coloringLoading?"🎨":"🖍️"}</span>
                    {coloringLoading?"Generating coloring page…":"Make a Coloring Page"}
                  </button>
                  {story && !story.is_sequel_of && (
                    <button onClick={()=>setShowSequelPrompt(true)} className="btn-book"
                      style={{ borderColor:"rgba(192,132,252,.25)", color:"#c4a0ff" }}>
                      <span>✨</span>
                      Write a Sequel
                    </button>
                  )}
                  {/* Row 4: nav + utilities */}
                  {mobile ? (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      <button className="btn-soft" style={{ fontSize:13 }} onClick={shareStory}>{copied?"✅ Copied!":"🔗 Share"}</button>
                      <button className="btn-soft" style={{ fontSize:13 }} onClick={readAloud}>{speaking?"⏹️ Stop":"🔊 Read"}</button>
                    </div>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                      <button className="btn-soft" style={{ fontSize:13 }} onClick={()=>{ try{localStorage.removeItem("dw_last_story");}catch{}setScreen("home"); }}>← Home</button>
                      <button className="btn-soft" style={{ fontSize:13 }} onClick={shareStory}>{copied?"✅ Copied!":"🔗 Share"}</button>
                      <button className="btn-soft" style={{ fontSize:13 }} onClick={readAloud}>{speaking?"⏹️ Stop":"🔊 Read"}</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sequel prompt modal */}
        {/* ── Already-have-story-today modal ── */}
        {/* Payment success toast */}
        {paymentSuccess && (
          <div style={{ position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", zIndex:10001,
            background:"linear-gradient(135deg,#14532d,#166534)", border:"1px solid rgba(74,222,128,.3)",
            borderRadius:14, padding:"14px 22px", display:"flex", alignItems:"center", gap:12,
            boxShadow:"0 8px 32px rgba(0,0,0,.5)", animation:"fadeUp .4s ease", whiteSpace:"nowrap" }}>
            <span style={{ fontSize:22 }}>🎉</span>
            <div>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:14, color:"#bbf7d0" }}>You're subscribed!</div>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"rgba(187,247,208,.65)", marginTop:2 }}>Stories are now unlocked for your family.</div>
            </div>
          </div>
        )}

        {showTomorrowModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(14px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 env(safe-area-inset-bottom,0px)" }}
            onClick={()=>setShowTomorrowModal(null)}>
            <div style={{ background:"linear-gradient(175deg,#120828,#0d0618)", border:"1px solid rgba(255,255,255,.09)", borderRadius:"24px 24px 0 0", padding:"clamp(20px,4vw,32px)", width:"100%", maxWidth:480, animation:"slideUp .3s ease" }}
              onClick={e=>e.stopPropagation()}>
              {/* Handle */}
              <div style={{ width:40, height:4, borderRadius:99, background:"rgba(255,255,255,.12)", margin:"0 auto 28px" }} />

              {showTomorrowModal === "story" ? (
                <>
                  <div style={{ textAlign:"center", marginBottom:28 }}>
                    <div style={{ fontSize:52, marginBottom:16, filter:"drop-shadow(0 0 24px rgba(200,165,55,.5))", animation:"float 4s ease-in-out infinite", display:"inline-block" }}>🌙</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:800, letterSpacing:"-.02em", marginBottom:10, lineHeight:1.2 }}>
                      Tonight's story is ready
                    </div>
                    <div style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:16, color:"rgba(255,255,255,.45)", lineHeight:1.7 }}>
                      {active?.child_name} already has a story for tonight.<br/>
                      A brand new one will be waiting {prettyTomorrow()}.
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <button className="btn-cta full" style={{ fontSize:15 }}
                      onClick={()=>{ setShowTomorrowModal(null);
                        const s=library.find(x=>x.story_date===todayStr()&&x.child_profile_id===active?.id);
                        if(s){const ps=s.text.split("\n\n✦\n\n");setPages(ps);setTitle(s.title||"");setImgs(s.page_images||[]);setCoverImg(s.cover_image||null);setSpread(s.cover_image?-1:0);setStory(s);setStoryPhase("ready");setScreen("story");try{localStorage.setItem("dw_last_story",s.id);}catch{}} }}>
                      📖  Read tonight's story
                    </button>
                    <button className="btn-soft" onClick={()=>setShowTomorrowModal(null)}>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign:"center", marginBottom:28 }}>
                    <div style={{ fontSize:52, marginBottom:16, filter:"drop-shadow(0 0 24px rgba(120,80,220,.5))", display:"inline-block" }}>✨</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:800, letterSpacing:"-.02em", marginBottom:10, lineHeight:1.2 }}>
                      Sequel queued!
                    </div>
                    <div style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:16, color:"rgba(255,255,255,.45)", lineHeight:1.7 }}>
                      The next adventure is being written and will be waiting for {active?.child_name} {prettyTomorrow()}.
                    </div>
                  </div>
                  <div style={{ background:"rgba(201,168,76,.06)", border:"1px solid rgba(201,168,76,.18)", borderRadius:14, padding:"16px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ fontSize:28, flexShrink:0 }}>🌅</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"rgba(255,255,255,.5)", lineHeight:1.6 }}>
                      Come back {prettyTomorrow()} to read the next chapter of <em style={{ color:"var(--gold-light)", fontStyle:"italic" }}>{title}</em>.
                    </div>
                  </div>
                  <button className="btn-cta full" style={{ fontSize:15 }} onClick={()=>setShowTomorrowModal(null)}>
                    Can't wait! 🌙
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {showSequelPrompt && story && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(14px)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 env(safe-area-inset-bottom,0px)" }}
            onClick={()=>setShowSequelPrompt(false)}>
            <div style={{ background:"linear-gradient(175deg,#1a0a3e,#0d0620)", border:"1px solid rgba(192,132,252,.15)", borderRadius:"24px 24px 0 0", padding:"clamp(20px,4vw,32px)", width:"100%", maxWidth:480, animation:"slideUp .3s ease" }}
              onClick={e=>e.stopPropagation()}>
              {/* Handle */}
              <div style={{ width:40, height:4, borderRadius:99, background:"rgba(255,255,255,.15)", margin:"0 auto 24px" }} />

              {/* Cover preview */}
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:22 }}>
                <div style={{ width:56, height:72, borderRadius:10, overflow:"hidden", flexShrink:0, background:"linear-gradient(160deg,#1a0a3e,#0d0520)", boxShadow:"0 4px 20px rgba(0,0,0,.5)" }}>
                  {(coverImg||imgs[0]) && <img src={coverImg||imgs[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif", letterSpacing:".1em", textTransform:"uppercase", marginBottom:5 }}>Continue the adventure</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:16, color:"rgba(255,255,255,.85)", lineHeight:1.3, marginBottom:3 }}>{title}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.3)", fontFamily:"'Nunito',sans-serif" }}>A brand new 14-page sequel</div>
                </div>
              </div>

              {/* What to expect */}
              <div style={{ background:"rgba(192,132,252,.07)", border:"1px solid rgba(192,132,252,.12)", borderRadius:16, padding:"14px 16px", marginBottom:22 }}>
                <div style={{ fontSize:12, color:"rgba(192,132,252,.7)", fontFamily:"'Nunito',sans-serif", fontWeight:700, marginBottom:8 }}>What you'll get</div>
                {[
                  "Same characters and world from this story",
                  "A brand new adventure — different from tonight's",
                  "14 pages, fully illustrated, in ~40 seconds",
                ].map((item,i) => (
                  <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:i<2?6:0 }}>
                    <span style={{ color:"rgba(192,132,252,.6)", fontSize:12, marginTop:1, flexShrink:0 }}>✦</span>
                    <span style={{ fontSize:13, color:"rgba(255,255,255,.5)", fontFamily:"'Nunito',sans-serif", lineHeight:1.5 }}>{item}</span>
                  </div>
                ))}
              </div>

              <button onClick={()=>{ setShowSequelPrompt(false); generateSequel(); }}
                style={{ width:"100%", padding:"17px", borderRadius:18, border:"none", cursor:"pointer",
                  background:"linear-gradient(135deg, #d4a842 0%, #c49030 50%, #a87820 100%)",
                  color:"#1a0d00", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15,
                  boxShadow:"0 6px 28px rgba(180,130,30,.4)", marginBottom:10 }}>
                ✨ Write the Sequel
              </button>
              <button onClick={()=>setShowSequelPrompt(false)}
                style={{ width:"100%", padding:"13px", borderRadius:14, border:"none", background:"transparent", color:"rgba(255,255,255,.28)", fontFamily:"'Nunito',sans-serif", fontSize:14, cursor:"pointer" }}>
                Maybe later
              </button>
            </div>
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
          <div className="fade has-bottom-nav" style={{ maxWidth:520, width:"100%" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
              <button onClick={()=>setScreen("home")} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.09)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="rgba(255,255,255,.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, fontStyle:"italic" }}>{active?.child_name}'s Badges</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", fontFamily:"'Nunito',sans-serif", marginTop:2 }}>{badges.length} of {BADGE_DEFS.length} earned</div>
              </div>
            </div>

            {badges.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", background:"rgba(255,255,255,.03)", borderRadius:16, border:"1px solid rgba(255,255,255,.07)", marginBottom:20 }}>
                <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>🏅</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontStyle:"italic", color:"rgba(255,255,255,.5)", marginBottom:6 }}>No badges yet</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif" }}>Read tonight's story to earn your first one</div>
              </div>
            )}

            <div className="badge-grid">
              {BADGE_DEFS.map(b => {
                const earned = badges.includes(b.id);
                return (
                  <div key={b.id} className={`badge-item ${earned?"earned":""}`} title={b.desc}>
                    <span style={{ fontSize:28, filter:earned?"none":"grayscale(1) opacity(.2)" }}>{b.emoji}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:earned?"rgba(255,255,255,.85)":"rgba(255,255,255,.2)", lineHeight:1.3, fontFamily:"'Nunito',sans-serif" }}>{b.label}</span>
                    {earned && <span style={{ fontSize:9, color:"var(--gold)", fontFamily:"'Nunito',sans-serif", letterSpacing:".06em" }}>✦ earned</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LIBRARY
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="library" && (
          <div className="fade has-bottom-nav" style={{ maxWidth:600, width:"100%" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
              <button onClick={()=>setScreen("home")} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.09)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="rgba(255,255,255,.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{active?.child_name}'s Library</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", fontFamily:"'Nunito',sans-serif", marginTop:2 }}>{library.length} {library.length===1?"story":"stories"} saved</div>
              </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[{id:"all",label:"All Stories"},{id:"favorites",label:"★ Favorites"}].map(f => (
                <button key={f.id} onClick={()=>setLibFilter(f.id)}
                  style={{ padding:"8px 18px", borderRadius:999, border:"1px solid", fontSize:13, fontFamily:"'Nunito',sans-serif", fontWeight:700, cursor:"pointer", transition:"all .18s",
                    background: libFilter===f.id ? "rgba(201,168,76,.12)" : "var(--surface-1)",
                    borderColor: libFilter===f.id ? "rgba(201,168,76,.4)" : "var(--border-1)",
                    color: libFilter===f.id ? "var(--gold-light)" : "var(--text-3)" }}>
                  {f.label}
                </button>
              ))}
            </div>

            {library.length===0 ? (
              <div style={{ textAlign:"center", padding:"clamp(48px,10vw,72px) 20px" }}>
                <div style={{ fontSize:"clamp(52px,12vw,68px)", animation:"float 4s ease-in-out infinite", filter:"drop-shadow(0 0 24px rgba(200,170,80,.3))", marginBottom:24, display:"block" }}>🌙</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(20px,5vw,26px)", fontStyle:"italic", marginBottom:10, lineHeight:1.3 }}>
                  {active?.child_name}'s first story<br/>is waiting to be written
                </div>
                <div style={{ color:"rgba(255,255,255,.32)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:15, lineHeight:1.8, maxWidth:300, margin:"0 auto 28px" }}>
                  Every night, a brand new 14-page illustrated picture book — starring {active?.child_name} as the hero.
                </div>
                <button className="btn-cta" style={{ margin:"0 auto", display:"block", width:"auto", padding:"15px 32px" }} onClick={()=>setScreen("home")}>
                  ✨ Open Tonight's Story
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {library.filter(s => libFilter==="all" || s.is_favorite).map(s => {
                  const isToday=s.story_date===todayStr();
                  const d=new Date(s.story_date+"T00:00:00");
                  const label=isToday?"Tonight":d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
                  return (
                    <div key={s.id}
                      onClick={()=>{const ps=s.text.split("\n\n✦\n\n");setPages(ps);setTitle(s.title||"");setImgs(s.page_images||[]);setCoverImg(s.cover_image||null);setSpread(s.cover_image?-1:0);setStory(s);setStoryPhase("ready");setScreen("story");try{localStorage.setItem("dw_last_story",s.id);localStorage.setItem("dw_last_screen","story");}catch{}}}
                      style={{ display:"flex", gap:14, alignItems:"center", padding:"14px 16px", cursor:"pointer", borderRadius:14, background:"rgba(255,255,255,.04)", border:`1px solid ${isToday?"rgba(201,168,76,.22)":"rgba(255,255,255,.08)"}`, transition:"all .18s", WebkitTapHighlightColor:"transparent" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.08)";e.currentTarget.style.borderColor=isToday?"rgba(201,168,76,.4)":"rgba(255,255,255,.14)";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor=isToday?"rgba(201,168,76,.22)":"rgba(255,255,255,.08)";}}>
                      {s.cover_image||s.page_images?.[0]
                        ? <img src={s.cover_image||s.page_images[0]} alt="" style={{ width:52, height:68, objectFit:"cover", borderRadius:8, flexShrink:0, border:"1px solid rgba(255,255,255,.1)" }} />
                        : <div style={{ width:52, height:68, borderRadius:8, background:"linear-gradient(135deg,#2d1860,#5b21b6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🌙</div>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                          <span style={{ color:isToday?"var(--gold)":"rgba(255,255,255,.3)", fontSize:11, letterSpacing:".08em", textTransform:"uppercase", fontWeight:700, fontFamily:"'Nunito',sans-serif" }}>{label}</span>
                          {s.lesson_type && <span style={{ background:"rgba(74,222,128,.1)", border:"1px solid rgba(74,222,128,.2)", borderRadius:999, padding:"1px 8px", fontSize:10, color:"#6ee7a0", flexShrink:0 }}>{LESSONS.find(l=>l.id===s.lesson_type)?.emoji} {LESSONS.find(l=>l.id===s.lesson_type)?.label}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          {s.is_favorite && <span style={{ color:"var(--gold)", fontSize:13, flexShrink:0 }}>★</span>}
                          <div style={{ color:"rgba(255,255,255,.85)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title||s.text?.slice(0,60)+"…"}</div>
                        </div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,.25)", fontFamily:"'Nunito',sans-serif", marginTop:3 }}>{s.page_images?.length||0} illustrations</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
                        <svg width="6" height="12" viewBox="0 0 6 12" fill="none"><path d="M1 1l4 5-4 5" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        {s.is_favorite && (
                          <button
                            onClick={(e)=>{ e.stopPropagation(); const ps=s.text.split("\n\n✦\n\n"); setPages(ps); setTitle(s.title||""); setImgs(s.page_images||[]); setCoverImg(s.cover_image||null); setSpread(s.cover_image?-1:0); setStory(s); setStoryPhase("ready"); setScreen("story"); setTimeout(()=>generateSequel(),150); }}
                            style={{ background:"rgba(201,168,76,.08)", border:"1px solid rgba(201,168,76,.25)", borderRadius:99, padding:"4px 10px", fontSize:11, color:"var(--gold-light)", fontFamily:"'Nunito',sans-serif", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                            📖 Sequel
                          </button>
                        )}
                      </div>
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
          <div className="fade" style={{ maxWidth:440, width:"100%", paddingTop:"clamp(16px,4vw,32px)" }}>
            {/* Moon header */}
            <div style={{ textAlign:"center", marginBottom:32 }}>
              <div style={{ fontSize:56, marginBottom:16, animation:"float 5s ease-in-out infinite", filter:"drop-shadow(0 0 28px rgba(200,160,50,.55))" }}>🌙</div>
              {isTrialEnd ? (
                <>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:800, letterSpacing:"-.02em", marginBottom:8, lineHeight:1.2 }}>Your trial has ended</div>
                  <div style={{ color:"rgba(255,255,255,.4)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:16, lineHeight:1.7 }}>
                    Keep the magic going — subscribe to continue<br/>generating stories for your family.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:800, letterSpacing:"-.02em", marginBottom:8 }}>Add another child</div>
                  <div style={{ color:"rgba(255,255,255,.4)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:16, lineHeight:1.7 }}>
                    Your plan updates to <strong style={{ color:"var(--gold-light)" }}>${newPrice.toFixed(2)}/month</strong> for {currentKids + 1} children.
                  </div>
                </>
              )}
            </div>

            {/* 3 big value props */}
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
              {[
                { icon:"📖", title:"A new story every night", desc:"14 illustrated pages, unique every time" },
                { icon:"🎨", title:"Illustrated just for them", desc:"Watercolor art tailored to your child" },
                { icon:"✨", title:"Life lessons woven in", desc:"Adventure, bravery, kindness, and more" },
              ].map(({icon,title,desc}) => (
                <div key={title} style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 18px", borderRadius:14, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ fontSize:26, flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:15, fontWeight:700, color:"rgba(255,255,255,.9)", marginBottom:2 }}>{title}</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"rgba(255,255,255,.38)" }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div style={{ background:"rgba(201,168,76,.06)", border:"1px solid rgba(201,168,76,.2)", borderRadius:16, padding:"20px 22px", marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"rgba(255,255,255,.6)" }}>Monthly plan</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:800, color:"var(--gold-light)" }}>
                  ${isTrialEnd ? PRICE_BASE.toFixed(2) : newPrice.toFixed(2)}<span style={{ fontSize:14, fontFamily:"'Nunito',sans-serif", fontWeight:600, color:"rgba(255,255,255,.4)" }}>/mo</span>
                </div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {["Unlimited stories","Cancel anytime","All children included","Story library forever"].map(f => (
                  <div key={f} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:999, background:"rgba(201,168,76,.08)", border:"1px solid rgba(201,168,76,.15)" }}>
                    <span style={{ color:"var(--gold)", fontSize:10 }}>✦</span>
                    <span style={{ fontSize:11, fontFamily:"'Nunito',sans-serif", fontWeight:600, color:"rgba(255,255,255,.6)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button className="btn-cta full" style={{ fontSize:16, padding:"17px" }}>
                {isTrialEnd ? `Subscribe — $${PRICE_BASE.toFixed(2)}/Month` : `Update Plan — $${newPrice.toFixed(2)}/Month`}
              </button>
              <button className="btn-soft" onClick={()=>setScreen("home")}>Maybe later</button>
            </div>
            <p style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,.18)", fontFamily:"'Nunito',sans-serif", marginTop:12 }}>No commitment · Cancel anytime</p>
          </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            SETTINGS / ACCOUNT
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="settings" && (() => {
          const isActive = sub?.status==="active";
          const isTrial  = sub?.status==="trial";
          const openPortal = async () => {
            try {
              const r = await fetch("/api/stripe-portal", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:user.email,user_id:user.id,return_url:window.location.href}) });
              const d = await r.json();
              if (d.url) window.location.href = d.url;
              else alert("Could not open billing portal.");
            } catch { alert("Could not open billing portal. Please try again."); }
          };
          const startCheckout = async () => {
            try {
              const r = await fetch("/api/stripe-checkout", { method:"POST", headers:{"Content-Type":"application/json"},
                body:JSON.stringify({ email:user.email, user_id:user.id, child_count:profiles.length, success_url:window.location.href+"?payment=success", cancel_url:window.location.href }) });
              const d = await r.json();
              if (d.url) window.location.href = d.url;
              else alert("Could not start checkout.");
            } catch { alert("Could not start checkout. Please try again."); }
          };

          const SGroup = ({children}) => <div style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, overflow:"hidden", marginBottom:12 }}>{children}</div>;
          const SRow = ({icon, label, value, onPress, danger, last=false, badge, right}) => (
            <div onClick={onPress} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
              borderBottom:last?"none":"1px solid rgba(255,255,255,.05)",
              cursor:onPress?"pointer":"default", transition:"background .12s" }}
              onMouseEnter={e=>{if(onPress)e.currentTarget.style.background="rgba(255,255,255,.04)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
              {icon && <div className="settings-icon">{icon}</div>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, fontFamily:"'Nunito',sans-serif", color:danger?"rgba(255,80,80,.8)":"rgba(255,255,255,.88)" }}>{label}</div>
                {value && <div style={{ fontSize:12, color:"rgba(255,255,255,.3)", fontFamily:"'Nunito',sans-serif", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{value}</div>}
              </div>
              {right}
              {badge && <div style={{ fontSize:11, fontWeight:700, fontFamily:"'Nunito',sans-serif", background:badge.bg||"rgba(201,168,76,.12)", color:badge.color||"var(--gold-light)", padding:"3px 10px", borderRadius:999, flexShrink:0, border:`1px solid ${badge.border||"rgba(201,168,76,.25)"}` }}>{badge.text}</div>}
              {onPress && !danger && <svg width="6" height="11" viewBox="0 0 6 11" fill="none"><path d="M1 1l4 4.5L1 10" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          );

          return (
          <div className="fade has-bottom-nav" style={{ width:"100%", maxWidth:500 }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
              <button onClick={()=>setScreen("home")} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.09)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="rgba(255,255,255,.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:800, fontStyle:"italic" }}>Account</div>
            </div>

            {/* Profile card */}
            <div style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 20px", background:"rgba(255,255,255,.04)", borderRadius:16, marginBottom:12, border:"1px solid rgba(255,255,255,.08)" }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#3d2080,#7c4dcc)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🌙</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,.88)", fontFamily:"'Nunito',sans-serif", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.32)", fontFamily:"'Nunito',sans-serif" }}>
                  Member since {new Date(user?.created_at||Date.now()).toLocaleDateString("en-US",{month:"long",year:"numeric"})}
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
              {[{label:"Stories",val:library.length,icon:"📖"},{label:"Streak",val:streak,icon:"🔥"},{label:"Badges",val:`${badges.length}/${BADGE_DEFS.length}`,icon:"🏅"}].map(s => (
                <div key={s.label} style={{ background:"rgba(255,255,255,.04)", borderRadius:12, padding:"14px 10px", textAlign:"center", border:"1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:800, color:"var(--gold-light)", marginBottom:2 }}>{s.val}</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", fontFamily:"'Nunito',sans-serif", letterSpacing:".06em", textTransform:"uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Subscription card */}
            <div style={{ borderRadius:14, border:"1px solid rgba(255,255,255,.08)", overflow:"hidden", marginBottom:12 }}>
              {/* Status bar */}
              <div style={{ padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:isActive?"#4ade80":isTrial?"#fbbf24":"#f87171", boxShadow:`0 0 8px ${isActive?"rgba(74,222,128,.6)":isTrial?"rgba(251,191,36,.5)":"rgba(248,113,113,.5)"}` }} />
                  <div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:700, color:"var(--text-1)" }}>
                      {isActive ? "Pro Plan" : isTrial ? "Free Trial" : "No active plan"}
                    </div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"var(--text-3)", marginTop:2 }}>
                      {isActive
                        ? `$${monthlyPrice().toFixed(2)}/month · ${sub?.cancel_at_period_end ? "cancels" : "renews"} ${sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}`
                        : isTrial
                          ? `${daysLeft()} nights remaining · then $${PRICE_BASE.toFixed(2)}/mo`
                          : "Subscribe to generate stories"}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:11, fontWeight:700, fontFamily:"'Nunito',sans-serif", padding:"3px 10px", borderRadius:999,
                  background:isActive?"rgba(74,222,128,.1)":isTrial?"rgba(251,191,36,.1)":"rgba(255,255,255,.06)",
                  color:isActive?"#86efac":isTrial?"#fde68a":"var(--text-3)",
                  border:`1px solid ${isActive?"rgba(74,222,128,.25)":isTrial?"rgba(251,191,36,.2)":"rgba(255,255,255,.1)"}` }}>
                  {isActive ? "Active" : isTrial ? "Trial" : "Inactive"}
                </div>
              </div>

              {/* Details rows */}
              {isActive && (
                <>
                  <div style={{ padding:"12px 18px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                    <span style={{ fontSize:13, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif" }}>Plan price</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", fontFamily:"'Nunito',sans-serif" }}>${monthlyPrice().toFixed(2)}/month</span>
                  </div>
                  <div style={{ padding:"12px 18px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                    <span style={{ fontSize:13, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif" }}>
                      {sub?.cancel_at_period_end ? "Access until" : "Next billing date"}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:sub?.cancel_at_period_end?"#f87171":"var(--text-2)", fontFamily:"'Nunito',sans-serif" }}>
                      {sub?.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"})
                        : "—"}
                    </span>
                  </div>
                  <div style={{ padding:"12px 18px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                    <span style={{ fontSize:13, color:"var(--text-3)", fontFamily:"'Nunito',sans-serif" }}>Children</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"var(--text-2)", fontFamily:"'Nunito',sans-serif" }}>{profiles.length}</span>
                  </div>
                  {sub?.cancel_at_period_end && (
                    <div style={{ padding:"12px 18px", background:"rgba(248,113,113,.05)", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                      <div style={{ fontSize:12, color:"rgba(248,113,113,.8)", fontFamily:"'Nunito',sans-serif", lineHeight:1.5 }}>
                        ⚠️ Your plan is set to cancel. Stories will stop generating after {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("en-US",{month:"long",day:"numeric"}) : "the end of the period"}. You can reactivate anytime via Manage Billing.
                      </div>
                    </div>
                  )}
                  <div style={{ padding:"12px 18px", display:"flex", gap:8 }}>
                    <button onClick={openPortal} style={{ flex:1, padding:"10px", borderRadius:10, background:"var(--surface-1)", border:"1px solid var(--border-1)", color:"var(--text-2)", fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface-1)"}>
                      💳 Manage Billing
                    </button>
                    <button onClick={openPortal} style={{ flex:1, padding:"10px", borderRadius:10, background:"var(--surface-1)", border:"1px solid var(--border-1)", color:"var(--text-2)", fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--surface-2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface-1)"}>
                      📋 Invoices
                    </button>
                  </div>
                </>
              )}
            </div>

            {isTrial && (
              <button onClick={startCheckout}
                style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", cursor:"pointer", marginBottom:12,
                  background:"linear-gradient(135deg,#d4a842,#b88a20)",
                  color:"#130c00", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15,
                  boxShadow:"0 4px 24px rgba(180,130,30,.4)" }}>
                ✨ Upgrade to Pro — ${PRICE_BASE.toFixed(2)}/month
              </button>
            )}
            {!sub || sub.status==="canceled" ? (
              <button onClick={startCheckout}
                style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", cursor:"pointer", marginBottom:12,
                  background:"linear-gradient(135deg,#d4a842,#b88a20)",
                  color:"#130c00", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15,
                  boxShadow:"0 4px 24px rgba(180,130,30,.4)" }}>
                ✨ Subscribe — ${PRICE_BASE.toFixed(2)}/month
              </button>
            ) : null}

            {/* Children */}
            <div style={{ fontSize:11, color:"rgba(255,255,255,.28)", fontFamily:"'Nunito',sans-serif", letterSpacing:".1em", textTransform:"uppercase", marginBottom:8, paddingLeft:2, fontWeight:700 }}>Children</div>
            <SGroup>
              {profiles.map((p,i) => (
                <SRow key={p.id}
                  icon={p.photo_url?<img src={p.photo_url} alt="" style={{width:22,height:22,borderRadius:"50%",objectFit:"cover"}}/>:"👶"}
                  label={p.child_name} value={`Age ${p.age||"?"} · ${library.filter(s=>s.child_profile_id===p.id).length} stories`}
                  onPress={()=>{setEditId(p.id);setPf(p);setScreen("profile");}}
                  last={i===profiles.length-1&&!canAddProfile()} />
              ))}
              {canAddProfile() && (
                <SRow icon="➕" label="Add Child" value="Create a new story profile"
                  onPress={()=>{setEditId(null);setPf({child_name:"",age:"",stuffed_animal:"",best_friend:"",favorite_animal:"",scared_of:"",favorite_thing:""});setWizStep(0);setScreen("wizard");}}
                  last />
              )}
            </SGroup>

            {/* Misc */}
            <SGroup>
              <SRow icon="🏅" label="Badges & Achievements" value={`${badges.length} of ${BADGE_DEFS.length} earned`} onPress={()=>setScreen("badges")} />
              <SRow icon="📚" label="Story Library" value={`${library.length} stories saved`} onPress={()=>{loadLibrary();setScreen("library");}} last />
            </SGroup>

            {/* Sign out */}
            <SGroup>
              <SRow icon="🚪" label="Sign Out" onPress={logout} danger last />
            </SGroup>

            <p style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,.12)", fontFamily:"'Nunito',sans-serif", marginTop:8, marginBottom:4 }}>
              DreamWeaver · dreamweaverstory.com
            </p>

          </div>
          );
        })()}

                {/* ═══════════════════════════════════════════════════════════════════
            SHARED
        ══════════════════════════════════════════════════════════════════════ */}
        {screen==="shared" && (() => {
          const sp = shared?.text?.split("\n\n✦\n\n") || [];
          const si = shared?.page_images || [];
          return (
          <div className="fade" style={{ maxWidth:980, width:"100%" }}>
            {!shared ? <MoonLoader /> : (
              <>
                <SharedBook pages={sp} imgs={si} title={shared.title} coverImg={shared.cover_image||null} mobile={mobile||tablet} />
                <div style={{ textAlign:"center", marginTop:24, padding:"28px 20px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:20 }}>
                  <p style={{ color:"rgba(255,255,255,.38)", marginBottom:16, fontFamily:"'Crimson Pro',serif", fontSize:16, fontStyle:"italic" }}>Make personalized 14-page picture books for your child every night</p>
                  <button className="btn-cta" onClick={()=>setScreen("signup")}>Try DreamWeaver free ✨</button>
                </div>
              </>
            )}
          </div>
          );
        })()}

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

      {/* ── Mobile bottom nav — fixed to bottom of screen ── */}
      {mobile && ["home","library","badges","story","settings"].includes(screen) && user && (
        <BottomNav screen={screen} setScreen={setScreen} loadLibrary={loadLibrary} />
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
