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
    const path = "stories/" + (storyId) + "/page_" + (pageIndex) + "." + (ext);
    const { error } = await supabase.storage.from("story-images").upload(path, blob, { contentType: blob.type, upsert: true });
    if (error) return replicateUrl;
    const { data } = supabase.storage.from("story-images").getPublicUrl(path);
    return data.publicUrl;
  } catch { return replicateUrl; }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = "\n@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Nunito:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&display=swap');\n\n*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n\n:root{\n  --night:#07050d;\n  --surface-1:rgba(255,255,255,.055);\n  --surface-2:rgba(255,255,255,.09);\n  --surface-3:rgba(255,255,255,.13);\n  --border-1:rgba(255,255,255,.07);\n  --border-2:rgba(255,255,255,.12);\n  --border-3:rgba(255,255,255,.2);\n  --gold:#c9a84c;\n  --gold-light:#e8c96a;\n  --gold-dim:rgba(201,168,76,.15);\n  --gold-border:rgba(201,168,76,.3);\n  --text-1:rgba(255,255,255,.92);\n  --text-2:rgba(255,255,255,.55);\n  --text-3:rgba(255,255,255,.3);\n  --text-4:rgba(255,255,255,.18);\n  --purple:#6b35c8;\n  --purple-light:#b08fff;\n  --spine-dark:#1a0802;--spine-mid:#5c2e0e;--spine-light:#8b4a14;\n  --cream:#fdf8ef;\n  --ink:#1a0f2e;\n  --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-2xl:24px;\n}\n\nhtml{scroll-behavior:smooth;-webkit-text-size-adjust:100%}\nbody{\n  background:radial-gradient(ellipse at 20% 0%,#1a0f2e 0%,#0d0618 40%,#07050d 100%);\n  min-height:100vh;\n  font-family:'Nunito',sans-serif;color:var(--text-1);\n  overflow-x:hidden;-webkit-font-smoothing:antialiased;\n  -moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent;\n}\n\n/* \u2500\u2500 Animations \u2500\u2500 */\n@keyframes twinkle{0%,100%{opacity:.04;transform:scale(.5)}50%{opacity:.85;transform:scale(1.3)}}\n@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}\n@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}\n@keyframes fadeIn{from{opacity:0}to{opacity:1}}\n@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}\n@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}\n@keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}\n@keyframes orb{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(20px,-15px) scale(1.05)}66%{transform:translate(-10px,20px) scale(.97)}}\n@keyframes slideUp{from{transform:translateY(28px);opacity:0}to{transform:translateY(0);opacity:1}}\n@keyframes popIn{0%{transform:scale(.88);opacity:0}100%{transform:scale(1);opacity:1}}\n@keyframes goldPulse{0%,100%{box-shadow:0 6px 28px rgba(180,130,30,.38)}50%{box-shadow:0 6px 36px rgba(180,130,30,.6)}}\n@keyframes starFloat{0%{opacity:.3;transform:translateY(0) scale(1)}100%{opacity:.9;transform:translateY(-8px) scale(1.3)}}\n/* page-turn */\n@keyframes mobileExitForward{from{transform:translateX(0);opacity:1}to{transform:translateX(-100%);opacity:.4}}\n@keyframes mobileEnterForward{from{transform:translateX(100%);opacity:.4}to{transform:translateX(0);opacity:1}}\n@keyframes mobileExitBack{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:.4}}\n@keyframes mobileEnterBack{from{transform:translateX(-100%);opacity:.4}to{transform:translateX(0);opacity:1}}\n@keyframes pageExitForward{0%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}40%{transform:perspective(1200px) translateX(-8%) rotateY(-25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(-100%) rotateY(-35deg) scaleX(0.85);opacity:0}}\n@keyframes pageEnterForward{0%{transform:perspective(1200px) translateX(100%) rotateY(35deg) scaleX(0.85);opacity:0}60%{transform:perspective(1200px) translateX(8%) rotateY(25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}}\n@keyframes pageExitBack{0%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}40%{transform:perspective(1200px) translateX(8%) rotateY(25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(100%) rotateY(35deg) scaleX(0.85);opacity:0}}\n@keyframes pageEnterBack{0%{transform:perspective(1200px) translateX(-100%) rotateY(-35deg) scaleX(0.85);opacity:0}60%{transform:perspective(1200px) translateX(-8%) rotateY(-25deg) scaleX(0.92);opacity:1}100%{transform:perspective(1200px) translateX(0%) rotateY(0deg) scaleX(1);opacity:1}}\n@keyframes coverOpen{0%{transform:perspective(1200px) rotateY(0deg) scaleX(1);opacity:1}50%{transform:perspective(1200px) rotateY(-20deg) scaleX(.9);opacity:.8}100%{transform:perspective(1200px) rotateY(-40deg) scaleX(.75);opacity:0}}\n\n.fade{animation:fadeUp .45s ease both}\n.fadein{animation:fadeIn .3s ease both}\n.float{animation:float 4s ease-in-out infinite}\n.page-flip-forward{animation:pageExitForward .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}\n.page-flip-back{animation:pageExitBack .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}\n.page-enter-forward{animation:pageEnterForward .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}\n.page-enter-back{animation:pageEnterBack .55s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}\n.cover-opening{animation:coverOpen .6s cubic-bezier(.4,0,.2,1) forwards;will-change:transform}\n\n/* \u2500\u2500 Layout \u2500\u2500 */\n.wrap{\n  min-height:100svh;position:relative;z-index:1;\n  display:flex;flex-direction:column;align-items:center;\n  padding-top:max(24px,env(safe-area-inset-top));\n  padding-bottom:max(88px,calc(68px + env(safe-area-inset-bottom)));\n  padding-left:max(20px,env(safe-area-inset-left));\n  padding-right:max(20px,env(safe-area-inset-right));\n  box-sizing:border-box;\n}\n.wrap.landing-active{padding:0 !important;align-items:stretch}\n.wrap.landing-active > .fade{max-width:100% !important;width:100% !important}\n.wrap.home-active{\n  padding-left:0 !important;padding-right:0 !important;\n  padding-top:max(0px,env(safe-area-inset-top)) !important;\n  align-items:stretch;\n}\n.wrap.home-active > .hw-shell{width:100% !important;max-width:100% !important}\n.hw-shell ::-webkit-scrollbar{width:3px}\n.hw-shell ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:99px}\n@media(max-width:699px){\n  .wrap > .fade{width:100% !important;max-width:100% !important}\n  .has-bottom-nav{width:100% !important;max-width:100% !important}\n}\n\n/* \u2500\u2500 Buttons \u2500\u2500 */\n/* PRIMARY \u2014 gold, always */\n.btn-cta{\n  background:linear-gradient(135deg,#d4a842,#b88a20);\n  color:#130c00;border:none;border-radius:var(--r-lg);\n  padding:15px 40px;font-size:16px;font-weight:800;\n  font-family:'Nunito',sans-serif;cursor:pointer;\n  transition:transform .16s,box-shadow .16s;\n  box-shadow:0 4px 24px rgba(180,130,30,.38),0 1px 3px rgba(0,0,0,.25);\n  letter-spacing:.01em;min-height:50px;\n  -webkit-tap-highlight-color:transparent;touch-action:manipulation;display:inline-block\n}\n.btn-cta:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(180,130,30,.55)}\n.btn-cta:active{transform:scale(.98);box-shadow:0 2px 12px rgba(180,130,30,.3)}\n.btn-cta.full{width:100%;display:block;text-align:center}\n.btn-cta.pulse{animation:goldPulse 2.5s ease-in-out infinite}\n\n/* SOLID \u2014 purple, wizard/forms */\n.btn-solid{\n  background:linear-gradient(135deg,#3d2080,#6b35c8);\n  color:white;border:none;border-radius:var(--r-lg);\n  padding:14px 24px;font-size:16px;font-weight:700;\n  font-family:'Nunito',sans-serif;cursor:pointer;width:100%;\n  transition:all .16s;box-shadow:0 4px 20px rgba(80,40,160,.3);\n  min-height:50px;-webkit-tap-highlight-color:transparent;touch-action:manipulation\n}\n.btn-solid:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(80,40,160,.5)}\n.btn-solid:active{transform:scale(.98)}\n\n/* SOFT \u2014 ghost */\n.btn-soft{\n  background:var(--surface-1);color:var(--text-2);\n  border:1px solid var(--border-1);border-radius:var(--r-md);\n  padding:12px 20px;font-size:14px;font-family:'Nunito',sans-serif;\n  font-weight:600;cursor:pointer;transition:all .15s;\n  min-height:44px;-webkit-tap-highlight-color:transparent;touch-action:manipulation\n}\n.btn-soft:hover{background:var(--surface-2);color:var(--text-1);border-color:var(--border-2)}\n.btn-soft:active{background:var(--surface-3);transform:scale(.98)}\n\n/* BOOK \u2014 inside story reader */\n.btn-book{\n  background:var(--surface-1);color:var(--text-2);\n  border:1px solid var(--border-1);border-radius:var(--r-md);\n  padding:13px 20px;font-size:14px;font-weight:700;\n  font-family:'Nunito',sans-serif;cursor:pointer;transition:all .16s;\n  min-height:46px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;\n  width:100%;display:flex;align-items:center;justify-content:center;gap:8px\n}\n.btn-book:hover{background:var(--surface-2);border-color:var(--border-2);color:var(--text-1)}\n.btn-book:active{transform:scale(.97)}\n.btn-book:disabled{opacity:.25;cursor:default;transform:none}\n.btn-book.gold{border-color:var(--gold-border);color:var(--gold-light)}\n.btn-book.gold:hover{background:rgba(201,168,76,.1)}\n\n/* \u2500\u2500 Input \u2500\u2500 */\ninput{\n  width:100%;padding:14px 16px;border-radius:var(--r-md);\n  border:1.5px solid var(--border-1);\n  background:rgba(255,255,255,.04);\n  color:var(--text-1);font-size:16px;font-family:'Nunito',sans-serif;\n  outline:none;transition:border-color .18s,background .18s,box-shadow .18s;\n  -webkit-appearance:none;appearance:none\n}\ninput:focus{\n  border-color:rgba(201,168,76,.5);\n  background:rgba(255,255,255,.06);\n  box-shadow:0 0 0 3px rgba(201,168,76,.09)\n}\ninput::placeholder{color:var(--text-4)}\nlabel{display:block;font-size:11px;font-weight:700;color:var(--text-3);\n  letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px;\n  font-family:'Nunito',sans-serif}\n\n/* \u2500\u2500 Form card \u2500\u2500 */\n.form-card{\n  background:rgba(255,255,255,.035);\n  border:1px solid var(--border-1);border-radius:var(--r-2xl);\n  padding:28px 24px;backdrop-filter:blur(12px)\n}\n\n/* \u2500\u2500 Selection pills (mood/lesson) \u2500\u2500 */\n.sel-pill{\n  display:inline-flex;align-items:center;gap:6px;\n  padding:10px 18px;border-radius:999px;\n  border:1.5px solid rgba(255,255,255,.1);\n  background:rgba(255,255,255,.06);\n  color:rgba(255,255,255,.7);cursor:pointer;\n  font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;\n  transition:all .15s;white-space:nowrap;\n  min-height:40px;-webkit-tap-highlight-color:transparent;touch-action:manipulation\n}\n.sel-pill:hover{border-color:rgba(201,168,76,.4);color:var(--text-1);background:rgba(255,255,255,.09)}\n.sel-pill.on{\n  background:rgba(201,168,76,.15);\n  border-color:rgba(201,168,76,.55);\n  color:var(--gold-light);\n  box-shadow:0 0 12px rgba(201,168,76,.15)\n}\n\n/* \u2500\u2500 Library / Story type tile \u2500\u2500 */\n.type-tile{\n  padding:18px 16px;border-radius:var(--r-lg);cursor:pointer;\n  text-align:left;transition:all .18s;border:1.5px solid rgba(255,255,255,.07);\n  background:rgba(255,255,255,.04);-webkit-tap-highlight-color:transparent\n}\n.type-tile:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)}\n.type-tile.on{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.5);box-shadow:0 0 0 1px rgba(201,168,76,.15) inset}\n\n/* \u2500\u2500 Section card \u2500\u2500 */\n.s-card{\n  border-radius:var(--r-lg);border:1px solid rgba(255,255,255,.06);\n  background:rgba(255,255,255,.055);overflow:hidden;\n  box-shadow:0 2px 16px rgba(0,0,0,.25)\n}\n.s-card-head{\n  padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.05);\n  display:flex;align-items:center;gap:9px;\n  background:rgba(255,255,255,.02)\n}\n.step-num{\n  width:20px;height:20px;border-radius:50%;flex-shrink:0;\n  background:rgba(255,255,255,.07);border:1px solid var(--border-2);\n  display:flex;align-items:center;justify-content:center;\n  font-size:10px;font-weight:800;font-family:'Nunito',sans-serif;\n  color:var(--text-3)\n}\n\n/* \u2500\u2500 Skeleton \u2500\u2500 */\n.skeleton{\n  background:linear-gradient(90deg,#181228 25%,#261e3e 50%,#181228 75%);\n  background-size:200% 100%;animation:shimmer 1.5s infinite\n}\n\n/* \u2500\u2500 Typography \u2500\u2500 */\n.hero-title{\n  font-family:'Playfair Display',serif;\n  font-size:clamp(38px,8vw,72px);line-height:1.03;\n  letter-spacing:-.025em;margin-bottom:20px\n}\n.eyebrow{\n  font-size:11px;letter-spacing:.16em;text-transform:uppercase;\n  color:var(--text-3);font-family:'Nunito',sans-serif;font-weight:700\n}\n.hero-sub{color:var(--text-3);font-size:clamp(15px,2.6vw,18px);line-height:1.8;font-family:'Crimson Pro',serif;font-style:italic}\n\n/* \u2500\u2500 Misc \u2500\u2500 */\n.err{color:#ff8080;font-size:13px;margin-top:4px}\n.lnk{color:var(--gold-light);cursor:pointer;transition:opacity .14s}\n.lnk:hover{opacity:.75;text-decoration:underline}\n::-webkit-scrollbar{width:4px}\n::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}\n.orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px);animation:orb 12s ease-in-out infinite}\n\n/* \u2500\u2500 Features strip \u2500\u2500 */\n.features-strip{display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0 16px}\n.features-strip::-webkit-scrollbar{display:none}\n.feat-card{flex:0 0 auto;display:flex;flex-direction:column;gap:8px;padding:20px 18px;border-radius:18px;background:var(--surface-1);border:1px solid var(--border-1);width:140px;text-align:center;transition:all .2s}\n.feat-card:hover{background:var(--surface-2);transform:translateY(-3px)}\n@media(min-width:641px){.features-strip{flex-wrap:wrap;overflow-x:visible;justify-content:center}.feat-card{width:152px}}\n\n/* \u2500\u2500 Badge \u2500\u2500 */\n.badge-toast{\n  position:fixed;bottom:calc(76px + env(safe-area-inset-bottom));\n  left:16px;right:16px;max-width:360px;margin:0 auto;z-index:10000;\n  background:linear-gradient(135deg,#1a0a38,#2d1060);\n  border:1px solid var(--gold-border);border-radius:var(--r-lg);\n  padding:14px 18px;display:flex;gap:12px;align-items:center;\n  box-shadow:0 8px 32px rgba(0,0,0,.6);animation:fadeUp .4s ease both\n}\n.badge-grid{display:flex;gap:10px;flex-wrap:wrap}\n.badge-item{\n  display:flex;flex-direction:column;align-items:center;gap:5px;\n  padding:14px 8px;border-radius:var(--r-md);width:80px;text-align:center;\n  background:var(--surface-1);border:1px solid var(--border-1);transition:all .18s\n}\n.badge-item.earned{background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.28)}\n.badge-item.earned:hover{background:rgba(201,168,76,.14);transform:translateY(-2px)}\n\n/* \u2500\u2500 Coloring modal \u2500\u2500 */\n.coloring-modal{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}\n.coloring-modal-inner{background:#fff;border-radius:var(--r-xl);max-width:520px;width:100%;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.8)}\n\n/* \u2500\u2500 Bottom nav \u2500\u2500 */\n.bottom-nav{\n  position:fixed;bottom:0;left:0;right:0;z-index:9999;\n  display:flex;height:60px;\n  background:rgba(7,5,13,.96);border-top:1px solid var(--border-1);\n  padding-bottom:env(safe-area-inset-bottom,0px);backdrop-filter:blur(20px)\n}\n.bottom-nav button{\n  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;\n  gap:3px;background:none;border:none;cursor:pointer;padding:0;\n  -webkit-tap-highlight-color:transparent;touch-action:manipulation;opacity:.4;transition:opacity .15s\n}\n.bottom-nav button.active{opacity:1}\n.bottom-nav button .nav-label{font-family:'Nunito',sans-serif;font-size:10px;font-weight:700;color:white;letter-spacing:.03em}\n.has-bottom-nav{padding-bottom:calc(68px + env(safe-area-inset-bottom,0px)) !important}\n\n/* \u2500\u2500 Tablet \u2500\u2500 */\n@media(min-width:700px) and (max-width:1023px){\n  .sel-pill,.btn-soft{font-size:14px !important;padding:11px 18px !important}\n  .btn-solid,.btn-cta{font-size:16px !important;padding:16px 28px !important}\n  input,select{font-size:16px !important}\n}\n/* \u2500\u2500 Mobile \u2500\u2500 */\n@media(max-width:640px){\n  .wrap{padding-top:14px}\n  .btn-cta{font-size:15px;padding:15px 24px;min-height:50px}\n  .btn-solid{font-size:15px;padding:14px 18px}\n  .form-card{padding:22px 18px;border-radius:var(--r-xl)}\n  .feat-card{width:128px;padding:16px 12px}\n  .sel-pill{font-size:13px;padding:9px 14px}\n}\n";




const LBL = { display:"block", color:"rgba(255,255,255,.32)", fontSize:11, letterSpacing:".12em", textTransform:"uppercase", marginBottom:7 };

// ── StarField ─────────────────────────────────────────────────────────────────
function StarField() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {STARS.map(s => (
        <div key={s.id} style={{ position:"absolute", left:(s.x) + "%", top:(s.y) + "%", width:s.size, height:s.size, borderRadius:"50%", background:"white", animation:"twinkle " + (s.dur) + "s " + (s.delay) + "s infinite ease-in-out" }} />
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
    "Writing " + (childName) + "'s story\u2026",
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
        {title ? "\"" + (title) + "\"" : "Painting your story…"}
      </h3>
      <p style={{ color:"rgba(255,255,255,.38)", fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"clamp(14px,3vw,16px)", marginBottom:22, height:24 }}>
        {loaded < total ? paintMessages[paintMsg] : "✨ Ready to read!"}
      </p>

      {/* Progress bar */}
      <div style={{ background:"rgba(255,255,255,.07)", borderRadius:99, height:5, marginBottom:20, overflow:"hidden", maxWidth:320, margin:"0 auto 20px" }}>
        <div style={{ height:"100%", borderRadius:99, background:"linear-gradient(90deg,#7c4dcc,#c084fc,#67e8f9)", width:(pct) + "%", transition:"width .6s ease", boxShadow:"0 0 10px rgba(192,132,252,.5)" }} />
      </div>

      {/* Page thumbnails — show actual image previews as they come in */}
      <div style={{ display:"flex", gap:"clamp(5px,1.5vw,8px)", justifyContent:"center", flexWrap:"wrap", marginBottom:18 }}>
        {Array.from({ length: total }).map((_,i) => (
          <div key={i} style={{ width:"clamp(38px,9vw,52px)", height:"clamp(38px,9vw,52px)", borderRadius:10, overflow:"hidden", border:"2px solid " + (i<loaded?"rgba(201,168,76,.5)":"rgba(255,255,255,.08)"), transition:"all .5s", background:"rgba(255,255,255,.04)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, position:"relative" }}>
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

  const confirmAddChild = async () => {
    setAddChildLoading(true);
    setAddChildErr("");
    try {
      const newCount = profiles.length + 1;
      const r = await fetch("/api/stripe-update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, child_count: newCount }),
      });
      const d = await r.json();
      if (d.error) { setAddChildErr(d.error); setAddChildLoading(false); return; }
      // Update local sub state with new child count
      setSub(prev => ({ ...prev, child_count: newCount }));
      setShowAddChildUpsell(false);
      // Open the wizard
      setEditId(null);
      setPf({ child_name:"", age:"", stuffed_animal:"", best_friend:"", favorite_animal:"", scared_of:"", favorite_thing:"" });
      setWizStep(0);
      setScreen("wizard");
    } catch(e) {
      setAddChildErr("Something went wrong. Please try again.");
    }
    setAddChildLoading(false);
  };
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
              { type: "text", text: "Describe this child's appearance for a children's book illustrator in 2 short sentences. Cover: hair color and style, eye color, skin tone, and any distinctive features. Be specific and warm so an illustrator can draw the same child consistently. Example: \"A cheerful girl with long curly red hair, bright green eyes, and fair freckled skin. She has a big smile and rosy cheeks.\" Just the description, nothing else." }
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
          const path = "avatars/" + (Date.now()) + "_" + (Math.random().toString(36).slice(2)) + "." + (ext);
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

  const profileText = (p) => "Child: " + (p.child_name) + ", Age: " + (p.age||5) + ", Stuffed animal: " + (p.stuffed_animal||"a stuffed bear") + ", Best friend: " + (p.best_friend||"a friend") + ", Favorite animal: " + (p.favorite_animal||"dogs") + ", Scared of: " + (p.scared_of||"the dark") + ", Favorite thing: " + (p.favorite_thing||"playing") + ".";

  // Build a consistent character description — stored once per profile
  const getCharacterCard = async (p) => {
    // Already has a character card (from photo or previous generation) - reuse it
    if (p.character_card) return p.character_card;
    // Generate from profile text as fallback
    const card = await callClaude([{role:"user",content:"Describe the appearance of a " + (p.age||5) + "-year-old child named " + (p.child_name) + " for a children's book illustrator. Keep it to 2 short sentences covering hair, eyes, skin tone, and typical outfit. Be specific and consistent so an illustrator can draw the same child every time. Also describe their stuffed animal \"" + (p.stuffed_animal||"a stuffed bear") + "\" in one sentence."}], 120);
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
      : "a child age " + (active.age||5) + " with a " + (active.stuffed_animal||"stuffed bear");
    // No-text instruction goes FIRST — models weight early prompt tokens most heavily
    return "No text, no letters, no words, no numbers, no writing, no signs, no labels anywhere in this image. Pure children's watercolor storybook illustration. " + (charDesc) + ". " + (scene) + ". Style: " + (m.prompt) + ", soft pastel watercolor, dreamy glowing light, storybook art. No typography of any kind.";
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
      ?"Write a warm personalized bedtime picture book for a child.\\nChild details (use what feels natural \u2014 don't force every detail into every story):\\n" + (profileText(active)) + "\\nTone: " + (m.prompt) + ".\\nLesson to weave in naturally: " + (lessonData?.prompt||"being kind to others") + ".\\n\\nWrite EXACTLY 14 pages, separated by [PAGE].\\nEach page = 1-2 SHORT sentences. Pure picture book style \u2014 lyrical, beautiful, surprising.\\nChoose whichever details from the child's profile serve THIS particular story best. Not every detail needs to appear \u2014 pick the ones that make the story feel magical and personal.\\nPage 1: ground the child in a specific cozy moment that sets up what comes next.\\nPages 2-5: adventure unfolds naturally, building curiosity and wonder.\\nPages 6-9: the heart \u2014 the challenge, the feeling, the discovery.\\nPages 10-12: things come together, warmth, a moment of pride or joy.\\nPages 13-14: a gentle landing into sleep. Complete, satisfying, hopeful.\\nThe lesson should feel discovered, never stated. NO title. Start on page 1."
      :"Write a warm personalized bedtime picture book.\\nChild details (use what feels natural \u2014 weave in only what serves the story):\\n" + (profileText(active)) + "\\nTone: " + (m.prompt) + ".\\n\\nWrite EXACTLY 14 pages, separated by [PAGE].\\nEach page = 1-2 SHORT sentences. Pure picture book style \u2014 lyrical, vivid, surprising.\\nDon't try to mention every detail \u2014 choose whichever elements from the child's profile make this particular story feel personal and alive. Let the story lead.\\nPage 1: open on a specific, vivid moment. Immediate and grounding.\\nPages 2-5: the adventure takes shape \u2014 curiosity, wonder, something unexpected.\\nPages 6-9: the heart of the story \u2014 a challenge, a feeling, a choice.\\nPages 10-12: resolution \u2014 things click into place, warmth, a small triumph.\\nPages 13-14: a gentle drift toward sleep. Complete, happy, peaceful.\\nNO title. Start on page 1.";

    try {
      const [rawText,rawTitle] = await Promise.all([
        callClaude([{role:"user",content:storyPrompt}],1800),
        callClaude([{role:"user",content:isLesson?"Magical 4-6 word bedtime story title for " + (active.child_name) + " about " + (lessonData?.label||"kindness") + ". Only the title, nothing else.":"Magical 4-6 word bedtime story title for " + (active.child_name) + " and " + (active.stuffed_animal||"a stuffed bear") + ". Only the title, nothing else."}],30),
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

      const coverPrompt="No text, no letters, no words, no numbers, no writing, no labels anywhere in this image. A child with a stuffed animal in a " + (m.prompt) + " dreamland scene. Soft watercolor pastel art, dreamy storybook illustration, magical glowing light, beautiful night sky. Pure illustration only. No typography of any kind.";

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
    const hist=story?.history||[{role:"user",content:"Write bedtime story for: " + (profileText(active))},{role:"assistant",content:pages.join("\n\n")}];
    try {
      const raw=await callClaude([...hist,{role:"user",content:"Continue this bedtime story with 4 more short picture book pages, separated by [PAGE]. Each page = 1-2 sentences. Same warm tone and characters. Don't end the story yet."}],500);
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
    const hist=story?.history||[{role:"user",content:"Write bedtime story for: " + (profileText(active))},{role:"assistant",content:pages.join("\n\n")}];
    try {
      const raw=await callClaude([...hist,{role:"user",content:"Write a beautiful, warm happy ending for this story in exactly 2 short pages, separated by [PAGE]. Each page = 1-2 sentences. Make it magical, safe, and complete. End with the child drifting happily to sleep."}],250);
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
    const sequelPrompt = "Write a brand new 14-page bedtime picture book sequel to this story for " + (profileText(active)) + ".\nThe previous story was called \"" + (title) + "\" and began: " + (summary) + "...\nTone: " + (m.prompt) + ".\nThis is a NEW standalone story \u2014 same characters, new adventure, new lesson.\nWrite EXACTLY 14 pages, separated by [PAGE].\nEach page = 1-2 SHORT sentences. Pure picture book style.\nPages 1-2: re-introduce the characters in a new cozy situation.\nPages 3-6: new adventure begins, new challenge appears.\nPages 7-10: heart of story, face the challenge.\nPages 11-13: resolution, magic, joy.\nPage 14: child drifts peacefully to sleep. Complete happy ending.\nNO title. Start immediately.";
    try {
      const [rawText, rawTitle] = await Promise.all([
        callClaude([{ role:"user", content:sequelPrompt }], 1800),
        callClaude([{ role:"user", content:"Magical 4-6 word sequel title for a bedtime story about " + (active.child_name) + " and " + (active.stuffed_animal||"a stuffed bear") + ". Make it feel like a sequel to \"" + (title) + "\". Only the title." }], 30),
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
      const coverPrompt = "No text, no letters, no words, no numbers, no writing, no labels anywhere in this image. A child with a stuffed animal on a " + (m.prompt) + " adventure. Soft watercolor pastel art, dreamy storybook illustration, magical glowing light, beautiful night sky. Pure illustration only. No typography of any kind.";
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
  const [showAddChildUpsell, setShowAddChildUpsell] = useState(false);
  const [addChildLoading, setAddChildLoading] = useState(false);
  const [addChildErr, setAddChildErr] = useState("");

  const shareStory = async () => {
    setShowShareCard(true);
  };

  const copyShareLink = async () => {
    try { await navigator.clipboard.writeText((APP_URL) + "?story=" + (story?.id)); } catch {}
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
    ctx.fillText("A story for " + (active?.child_name||"a very special child") + " \u2726", 540, 790);

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
    link.download = (title||"dreamweaver-story") + ".png";
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
    const charCard = active?.character_card || (active.child_name) + " age " + (active.age||5) + " with " + (active.stuffed_animal||"stuffed bear");
    const prompt = "No text, no letters, no words, no numbers anywhere in this image. Children's coloring book page. Pure black outlines on a completely white background. No color, no gray, no shading, no fills \u2014 only clean black lines on white. Large simple bold shapes with thick outlines, lots of open white space for a child to color in. A child with a stuffed animal. No typography of any kind.";
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
      <div className={"wrap" + (screen==="landing" ? " landing-active" : "") + "$\n        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            HOME\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"home\" && active && (() => {\n          const todayStory   = library.find(s => s.story_date===todayStr() && s.child_profile_id===active.id);\n          const lastStory    = library.find(s => s.child_profile_id===active.id && s.story_date!==todayStr());\n          const childStories = library.filter(s => s.child_profile_id===active.id).length;\n          const hour         = new Date().getHours();\n          const greeting     = hour < 5 ? \"Still up\" : hour < 12 ? \"Good morning\" : hour < 17 ? \"Good afternoon\" : hour < 21 ? \"Good evening\" : \"Bedtime\";\n          const moonPhase    = [\"\ud83c\udf11\",\"\ud83c\udf12\",\"\ud83c\udf13\",\"\ud83c\udf14\",\"\ud83c\udf15\",\"\ud83c\udf16\",\"\ud83c\udf17\",\"\ud83c\udf18\"][new Date().getDate() % 8];\n          const nightsLeft   = sub?.status===\"trial\" ? daysLeft() : null;\n          const selLesson    = LESSONS.find(l => l.id===lesson);\n          const selMood      = MOODS.find(m => m.id===mood);\n\n          const ShellCard = ({ children, style }) => (\n            <div style={{\n              background:\"var(--surface-1)\",\n              border:\"1px solid var(--border-1)\",\n              borderRadius:16,\n              overflow:\"hidden\",\n              boxShadow:\"0 12px 40px rgba(0,0,0,.35)\",\n              ...style\n            }}>{children}</div>\n          );\n\n          const Chip = ({ on, children, onClick }) => (\n            <button onClick={onClick}\n              style={{\n                padding:\"9px 12px\",\n                borderRadius:999,\n                border:on ? \"1px solid rgba(201,168,76,.55)\" : \"1px solid var(--border-1)\",\n                background:on ? \"rgba(201,168,76,.12)\" : \"rgba(255,255,255,.03)\",\n                color:on ? \"var(--gold-light)\" : \"rgba(255,255,255,.55)\",\n                fontFamily:\"'Nunito',sans-serif\",\n                fontSize:12,\n                fontWeight:on ? 800 : 600,\n                cursor:\"pointer\",\n                transition:\"all .14s\",\n                whiteSpace:\"nowrap\",\n              }}\n              onMouseEnter={e=>{e.currentTarget.style.transform=\"translateY(-1px)\";}}\n              onMouseLeave={e=>{e.currentTarget.style.transform=\"\";}}>\n              {children}\n            </button>\n          );\n\n          const ModeCard = ({ id, title, sub, icon }) => {\n            const on = storyMode===id;\n            return (\n              <button onClick={()=>setStoryMode(id)}\n                style={{\n                  display:\"flex\",\n                  gap:12,\n                  alignItems:\"flex-start\",\n                  padding:\"14px 14px\",\n                  borderRadius:14,\n                  border:on ? \"1px solid rgba(201,168,76,.45)\" : \"1px solid var(--border-1)\",\n                  background:on ? \"linear-gradient(135deg, rgba(201,168,76,.18), rgba(255,255,255,.03))\" : \"rgba(255,255,255,.02)\",\n                  cursor:\"pointer\",\n                  textAlign:\"left\",\n                  transition:\"all .14s\",\n                }}\n                onMouseEnter={e=>{e.currentTarget.style.borderColor= on ? \"rgba(201,168,76,.55)\" : \"var(--border-2)\";}}\n                onMouseLeave={e=>{e.currentTarget.style.borderColor= on ? \"rgba(201,168,76,.45)\" : \"var(--border-1)\";}}>\n                <div style={{ width:34, height:34, borderRadius:12, display:\"flex\", alignItems:\"center\", justifyContent:\"center\",\n                  background:on ? \"rgba(201,168,76,.18)\" : \"rgba(255,255,255,.04)\", border:\"1px solid rgba(255,255,255,.06)\", flexShrink:0 }}>\n                  <span style={{ fontSize:18 }}>{icon}</span>\n                </div>\n                <div style={{ minWidth:0 }}>\n                  <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:14, fontWeight:900, color:on ? \"rgba(255,255,255,.92)\" : \"rgba(255,255,255,.7)\", marginBottom:3 }}>\n                    {title}\n                  </div>\n                  <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:on ? \"rgba(255,255,255,.55)\" : \"rgba(255,255,255,.35)\", lineHeight:1.4 }}>\n                    {sub}\n                  </div>\n                </div>\n              </button>\n            );\n          };\n\n          return (\n            <div className=\"fade has-bottom-nav\" style={{ width:\"100%\", maxWidth: 1060 }}>\n              <div style={{ padding: mobile ? \"16px 16px 110px\" : \"26px 32px 40px\", minHeight: mobile ? \"auto\" : \"100vh\" }}>\n\n                {/* Top bar */}\n                <div style={{ display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:12, marginBottom:14 }}>\n                  <div style={{ display:\"flex\", alignItems:\"center\", gap:12, minWidth:0 }}>\n                    <div style={{ fontSize: mobile ? 36 : 42, lineHeight:1, filter:\"drop-shadow(0 0 18px rgba(200,170,80,.45))\" }}>{moonPhase}</div>\n                    <div style={{ minWidth:0 }}>\n                      <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:11, letterSpacing:\".12em\", textTransform:\"uppercase\", color:\"var(--text-3)\", fontWeight:800 }}>\n                        {greeting}\n                      </div>\n                      <div style={{ display:\"flex\", alignItems:\"baseline\", gap:10, flexWrap:\"wrap\" }}>\n                        <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize: mobile ? \"clamp(22px,7vw,30px)\" : 34, fontWeight:800, letterSpacing:\"-.02em\", color:\"var(--text-1)\", lineHeight:1.1 }}>\n                          {active.child_name}\n                        </div>\n                        {!mobile && (\n                          <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:13, color:\"rgba(255,255,255,.35)\" }}>\n                            {childStories} stories \u00b7 {badges.length} badges{streak > 0 ? (<> \u00b7 \ud83d\udd25 {streak} streak</>) : null}\n                          </div>\n                        )}\n                      </div>\n                    </div>\n                  </div>\n\n                  <div style={{ display:\"flex\", alignItems:\"center\", gap:8, flexShrink:0 }}>\n                    {!mobile && (\n                      <>\n                        <button onClick={()=>{loadLibrary();setScreen(\"library\");}} className=\"btn-soft\" style={{ width:\"auto\", padding:\"10px 14px\" }}>Library</button>\n                        <button onClick={()=>setScreen(\"badges\")} className=\"btn-soft\" style={{ width:\"auto\", padding:\"10px 14px\" }}>Badges</button>\n                      </>\n                    )}\n                    <button onClick={()=>setScreen(\"settings\")} className=\"btn-soft\" style={{ width:\"auto\", padding:\"10px 12px\" }}>\n                      <span style={{ opacity:.8 }}>\u2699\ufe0f</span>\n                    </button>\n                  </div>\n                </div>\n\n                {/* Trial banner */}\n                {nightsLeft !== null && (\n                  <div style={{ marginBottom:14, padding:\"12px 14px\", borderRadius:14, background:\"rgba(201,168,76,.08)\", border:\"1px solid rgba(201,168,76,.18)\" }}>\n                    <div style={{ display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:10, flexWrap:\"wrap\" }}>\n                      <div style={{ fontFamily:\"'Nunito',sans-serif\", fontWeight:900, color:\"rgba(225,195,95,.95)\", fontSize:13 }}>\n                        {nightsLeft} nights free\n                      </div>\n                      <div style={{ fontFamily:\"'Nunito',sans-serif\", color:\"rgba(255,255,255,.35)\", fontSize:12 }}>\n                        Free trial \u00b7 then " + (PRICE_BASE.toFixed(2)) + "/mo\n                      </div>\n                    </div>\n                  </div>\n                )}\n\n                {/* Child selector */}\n                <div style={{ display:\"flex\", gap:8, overflowX:\"auto\", padding:\"4px 0 12px\", scrollbarWidth:\"none\" }}>\n                  {profiles.map(p => (\n                    <Chip key={p.id} on={active?.id===p.id} onClick={()=>{setActive(p);setPf(p);}}>\n                      {p.child_name}\n                    </Chip>\n                  ))}\n                  {canAddProfile() ? (\n                    <Chip on={false} onClick={()=>{setEditId(null);if(sub?.status===\"active\"&&profiles.length>=1){setShowAddChildUpsell(true);}else{setPf({child_name:\"\",age:\"\",stuffed_animal:\"\",best_friend:\"\",favorite_animal:\"\",scared_of:\"\",favorite_thing:\"\"});setWizStep(0);setScreen(\"wizard\");}}}>\n                      + Add child\n                    </Chip>\n                  ) : (\n                    <Chip on={false} onClick={()=>setScreen(\"paywall\")}>+ Add child</Chip>\n                  )}\n                </div>\n\n                {/* Main grid */}\n                <div style={{ display:\"grid\", gridTemplateColumns: mobile ? \"1fr\" : \"1.35fr 1fr\", gap:14, alignItems:\"start\" }}>\n\n                  {/* LEFT: Tonight / Story */}\n                  <ShellCard>\n                    <div style={{ padding: mobile ? \"16px 16px 14px\" : \"18px 18px 16px\", borderBottom:\"1px solid var(--border-1)\", display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:12 }}>\n                      <div>\n                        <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:11, letterSpacing:\".12em\", textTransform:\"uppercase\", color:\"var(--text-3)\", fontWeight:900, marginBottom:6 }}>\n                          Tonight\n                        </div>\n                        <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize: mobile ? 22 : 24, fontWeight:800, letterSpacing:\"-.02em\", color:\"var(--text-1)\", lineHeight:1.2 }}>\n                          {todayStory ? (todayStory.title || \"Your story is ready\") : \"Create a new story\"}\n                        </div>\n                        {!todayStory && (\n                          <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.35)\", marginTop:6 }}>\n                            14 illustrated pages \u00b7 ready in ~40 seconds\n                          </div>\n                        )}\n                      </div>\n\n                      {!mobile && (\n                        <div style={{ display:\"flex\", gap:8, alignItems:\"center\" }}>\n                          <div style={{ padding:\"9px 12px\", borderRadius:12, border:\"1px solid var(--border-1)\", background:\"rgba(255,255,255,.02)\", fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.45)\" }}>\n                            {storyMode===\"lesson\" ? \"Life lesson\" : \"Adventure\"}\n                          </div>\n                          <div style={{ padding:\"9px 12px\", borderRadius:12, border:\"1px solid var(--border-1)\", background:\"rgba(255,255,255,.02)\", fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.45)\" }}>\n                            {selMood?.label || \"Magical\"}\n                          </div>\n                        </div>\n                      )}\n                    </div>\n\n                    {/* Cover / empty state */}\n                    <div style={{ padding: mobile ? 16 : 18 }}>\n                      {todayStory && (todayStory.cover_image || todayStory.page_images?.[0]) ? (\n                        <div style={{ borderRadius:16, overflow:\"hidden\", border:\"1px solid rgba(255,255,255,.08)\", background:\"rgba(255,255,255,.02)\", boxShadow:\"0 16px 50px rgba(0,0,0,.55)\" }}>\n                          <div style={{ aspectRatio: mobile ? \"16/10\" : \"16/9\", background:\"linear-gradient(160deg,#1a0a3e,#0d0620)\" }}>\n                            <img src={todayStory.cover_image || todayStory.page_images?.[0]} alt=\"\" style={{ width:\"100%\", height:\"100%\", objectFit:\"cover\", display:\"block\" }} />\n                          </div>\n                          <div style={{ padding:\"14px 14px\" }}>\n                            <div style={{ display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:12 }}>\n                              <div style={{ minWidth:0 }}>\n                                <div style={{ fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:15, color:\"rgba(255,255,255,.72)\", whiteSpace:\"nowrap\", overflow:\"hidden\", textOverflow:\"ellipsis\" }}>\n                                  {todayStory.title || \"Tonight's story\"}\n                                </div>\n                                <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.32)\", marginTop:2 }}>\n                                  Tap to open the book\n                                </div>\n                              </div>\n                              <button onClick={generateStory}\n                                style={{\n                                  padding:\"10px 14px\",\n                                  borderRadius:12,\n                                  border:\"1px solid rgba(255,255,255,.10)\",\n                                  background:\"rgba(255,255,255,.06)\",\n                                  color:\"rgba(255,255,255,.75)\",\n                                  fontFamily:\"'Nunito',sans-serif\",\n                                  fontWeight:900,\n                                  cursor:\"pointer\",\n                                  flexShrink:0\n                                }}>\n                                Read \u2192\n                              </button>\n                            </div>\n                          </div>\n                        </div>\n                      ) : (\n                        <div style={{ borderRadius:16, border:\"1px solid rgba(255,255,255,.08)\", background:\"radial-gradient(1200px 500px at 20% 0%, rgba(201,168,76,.12), transparent 60%), rgba(255,255,255,.02)\", padding: mobile ? \"18px\" : \"20px\" }}>\n                          <div style={{ display:\"flex\", gap:14, alignItems:\"flex-start\" }}>\n                            <div style={{ width:44, height:44, borderRadius:14, background:\"rgba(201,168,76,.14)\", border:\"1px solid rgba(201,168,76,.22)\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", flexShrink:0 }}>\n                              <span style={{ fontSize:20 }}>\u2728</span>\n                            </div>\n                            <div style={{ flex:1 }}>\n                              <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:14, fontWeight:900, color:\"rgba(255,255,255,.85)\", marginBottom:6 }}>\n                                {storyMode===\"lesson\"\n                                  ? (<>\n                                      {\"Lesson: \"}{selLesson?.label || \"Kindness\"}{\" \u00b7 Mood: \"}{selMood?.label || \"Magical\"}\n                                    </>)\n                                  : (<>\n                                      {\"Mood: \"}{selMood?.label || \"Magical\"}{\" adventure\"}\n                                    </>)}\n                              </div>\n                              <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.35)\", lineHeight:1.55 }}>\n                                We'll write and illustrate a full bedtime book starring {active.child_name}.\n                              </div>\n                            </div>\n                          </div>\n\n                          <button onClick={generateStory}\n                            style={{\n                              width:\"100%\",\n                              marginTop:14,\n                              padding: mobile ? \"18px\" : \"16px\",\n                              borderRadius:14,\n                              cursor:\"pointer\",\n                              background:\"linear-gradient(135deg,#d4a842,#b88a20)\",\n                              color:\"#130c00\",\n                              fontFamily:\"'Nunito',sans-serif\",\n                              fontWeight:900,\n                              fontSize: mobile ? 16 : 15,\n                              border:\"none\",\n                              boxShadow:\"0 10px 36px rgba(180,130,30,.45)\",\n                              transition:\"transform .14s\",\n                              WebkitTapHighlightColor:\"transparent\",\n                            }}\n                            onMouseEnter={e=>{e.currentTarget.style.transform=\"translateY(-2px)\";}}\n                            onMouseLeave={e=>{e.currentTarget.style.transform=\"\";}}>\n                            Generate tonight\u2019s story\n                          </button>\n                        </div>\n                      )}\n\n                      {/* Quick links */}\n                      <div style={{ display:\"grid\", gridTemplateColumns: mobile ? \"1fr\" : \"1fr 1fr\", gap:10, marginTop:12 }}>\n                        {lastStory && (\n                          <button onClick={()=>{ const ps=lastStory.text.split(\"\\n\\n\u2726\\n\\n\");setPages(ps);setTitle(lastStory.title||\"\");setImgs(lastStory.page_images||[]);setCoverImg(lastStory.cover_image||null);setSpread(lastStory.cover_image?-1:0);setStory(lastStory);setStoryPhase(\"ready\");setScreen(\"story\"); try{localStorage.setItem(\"dw_last_story\",lastStory.id);}catch{} }}\n                            style={{ display:\"flex\", alignItems:\"center\", gap:12, padding:\"12px 12px\", borderRadius:14, border:\"1px solid var(--border-1)\", background:\"rgba(255,255,255,.02)\", cursor:\"pointer\", textAlign:\"left\" }}>\n                            <div style={{ width:34, height:34, borderRadius:12, background:\"rgba(255,255,255,.04)\", border:\"1px solid rgba(255,255,255,.06)\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", flexShrink:0 }}>\ud83d\udcd6</div>\n                            <div style={{ flex:1, minWidth:0 }}>\n                              <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, fontWeight:900, color:\"rgba(255,255,255,.7)\" }}>Re-read last story</div>\n                              <div style={{ fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:13, color:\"rgba(255,255,255,.45)\", whiteSpace:\"nowrap\", overflow:\"hidden\", textOverflow:\"ellipsis\" }}>\n                                {lastStory.title || \"Last night\"}\n                              </div>\n                            </div>\n                            <span style={{ color:\"rgba(255,255,255,.25)\", fontFamily:\"'Nunito',sans-serif\", fontSize:12 }}>\u2192</span>\n                          </button>\n                        )}\n\n                        <button onClick={()=>{setEditId(active.id);setPf(active);setScreen(\"profile\");}}\n                          style={{ display:\"flex\", alignItems:\"center\", gap:12, padding:\"12px 12px\", borderRadius:14, border:\"1px solid var(--border-1)\", background:\"rgba(255,255,255,.02)\", cursor:\"pointer\", textAlign:\"left\" }}>\n                          <div style={{ width:34, height:34, borderRadius:12, background: active.character_card ? \"rgba(187,247,208,.10)\" : \"rgba(255,255,255,.04)\", border:\"1px solid rgba(255,255,255,.06)\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", flexShrink:0 }}>\n                            {active.character_card ? \"\u2705\" : \"\ud83d\udcf8\"}\n                          </div>\n                          <div style={{ flex:1, minWidth:0 }}>\n                            <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, fontWeight:900, color:\"rgba(255,255,255,.7)\" }}>\n                              {active.character_card ? \"Profile ready\" : \"Add a photo\"}\n                            </div>\n                            <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.35)\" }}>\n                              {active.character_card ? \"Change details anytime\" : \"Match the hero to your child\"}\n                            </div>\n                          </div>\n                          <span style={{ color:\"rgba(255,255,255,.25)\", fontFamily:\"'Nunito',sans-serif\", fontSize:12 }}>\u2192</span>\n                        </button>\n                      </div>\n                    </div>\n                  </ShellCard>\n\n                  {/* RIGHT: Controls */}\n                  <ShellCard>\n                    <div style={{ padding:\"16px 16px 14px\", borderBottom:\"1px solid var(--border-1)\" }}>\n                      <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:11, letterSpacing:\".12em\", textTransform:\"uppercase\", color:\"var(--text-3)\", fontWeight:900, marginBottom:8 }}>\n                        Story settings\n                      </div>\n                      <div style={{ display:\"grid\", gridTemplateColumns:\"1fr 1fr\", gap:10 }}>\n                        <ModeCard id=\"adventure\" title=\"Adventure\" sub=\"Pure imagination and fun\" icon=\"\ud83c\udf19\" />\n                        <ModeCard id=\"lesson\" title=\"Life lesson\" sub=\"A gentle moral woven in\" icon=\"\u2728\" />\n                      </div>\n                    </div>\n\n                    {storyMode===\"lesson\" && (\n                      <div style={{ padding:\"14px 16px 10px\", borderBottom:\"1px solid var(--border-1)\" }}>\n                        <div style={{ display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:10, marginBottom:10 }}>\n                          <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, fontWeight:900, color:\"rgba(255,255,255,.7)\" }}>\n                            Choose a lesson\n                          </div>\n                          <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.28)\" }}>\n                            {selLesson?.emoji} {selLesson?.label}\n                          </div>\n                        </div>\n                        <div style={{ display:\"flex\", flexWrap:\"wrap\", gap:8 }}>\n                          {LESSONS.map(l => (\n                            <Chip key={l.id} on={lesson===l.id} onClick={()=>setLesson(l.id)}>\n                              {l.emoji} {l.label}\n                            </Chip>\n                          ))}\n                        </div>\n                      </div>\n                    )}\n\n                    <div style={{ padding:\"14px 16px 16px\" }}>\n                      <div style={{ display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:10, marginBottom:10 }}>\n                        <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, fontWeight:900, color:\"rgba(255,255,255,.7)\" }}>\n                          Choose a mood\n                        </div>\n                        <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(255,255,255,.28)\" }}>\n                          {selMood?.emoji} {selMood?.label}\n                        </div>\n                      </div>\n\n                      <div style={{ display:\"grid\", gridTemplateColumns: mobile ? \"1fr 1fr\" : \"1fr 1fr\", gap:10 }}>\n                        {MOODS.map(m => {\n                          const on = mood===m.id;\n                          return (\n                            <button key={m.id} onClick={()=>setMood(m.id)}\n                              style={{\n                                padding:\"12px 12px\",\n                                borderRadius:14,\n                                border:on ? \"1px solid rgba(201,168,76,.50)\" : \"1px solid var(--border-1)\",\n                                background:on ? \"rgba(201,168,76,.10)\" : \"rgba(255,255,255,.02)\",\n                                cursor:\"pointer\",\n                                textAlign:\"left\",\n                                transition:\"all .14s\",\n                              }}>\n                              <div style={{ display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", gap:10 }}>\n                                <div style={{ display:\"flex\", alignItems:\"center\", gap:10 }}>\n                                  <div style={{ width:30, height:30, borderRadius:12, display:\"flex\", alignItems:\"center\", justifyContent:\"center\",\n                                    background:\"rgba(255,255,255,.04)\", border:\"1px solid rgba(255,255,255,.06)\" }}>\n                                    <span style={{ fontSize:16 }}>{m.emoji}</span>\n                                  </div>\n                                  <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:13, fontWeight:900, color:on ? \"rgba(255,255,255,.85)\" : \"rgba(255,255,255,.65)\" }}>\n                                    {m.label}\n                                  </div>\n                                </div>\n                                <span style={{ color:on ? \"rgba(201,168,76,.85)\" : \"rgba(255,255,255,.18)\" }}>{on ? \"\u2713\" : \"\"}</span>\n                              </div>\n                            </button>\n                          );\n                        })}\n                      </div>\n                    </div>\n                  </ShellCard>\n\n                </div>\n              </div>\n\n/* Milestone overlay */}\n              {streakCelebrate && streakMilestone && (\n                <div style={{ position:\"fixed\", inset:0, display:\"flex\", alignItems:\"center\", justifyContent:\"center\", zIndex:9999, background:\"rgba(0,0,0,.7)\", backdropFilter:\"blur(16px)\" }}>\n                  <div style={{ textAlign:\"center\", animation:\"popIn .4s cubic-bezier(.34,1.56,.64,1)\", background:\"rgba(12,10,22,.98)\", border:\"1px solid rgba(255,255,255,.08)\", borderRadius:16, padding:\"48px 40px\", maxWidth:300, margin:\"0 20px\", boxShadow:\"0 40px 80px rgba(0,0,0,.9)\" }}>\n                    <div style={{ fontSize:52, marginBottom:16, animation:\"float 2s ease-in-out infinite\" }}>\ud83d\udd25</div>\n                    <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:32, fontWeight:800, color:\"rgba(255,255,255,.9)\", marginBottom:8, letterSpacing:\"-.02em\" }}>{streakMilestone} nights</div>\n                    <p style={{ color:\"rgba(255,255,255,.3)\", fontFamily:\"'Nunito',sans-serif\", fontSize:14, lineHeight:1.6, marginBottom:28 }}>\n                      {streakMilestone===3?\"Three nights in a row.\":streakMilestone===7?\"A full week of stories.\":\"Thirty nights. Legendary.\"}\n                    </p>\n                    <button onClick={()=>setStreakCelebrate(false)} style={{ padding:\"11px 28px\", borderRadius:8, background:\"rgba(255,255,255,.07)\", border:\"1px solid rgba(255,255,255,.1)\", color:\"rgba(255,255,255,.6)\", fontFamily:\"'Nunito',sans-serif\", fontSize:13, fontWeight:700, cursor:\"pointer\" }}>Continue</button>\n                  </div>\n                </div>\n              )}\n\n            </div>\n          );\n        \n        })()}\n/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            PROFILE EDIT\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"profile\" && (\n          <div className=\"fade\" style={{ maxWidth:420, width:\"100%\" }}>\n            <div style={{ display:\"flex\", alignItems:\"center\", gap:12, marginBottom:20 }}>\n              <button className=\"btn-soft\" style={{ flexShrink:0, width:\"auto\", padding:\"12px 16px\" }} onClick={()=>setScreen(\"home\")}>\u2190 Back</button>\n              <h2 style={{ fontFamily:\"'Playfair Display',serif\", fontSize:\"clamp(17px,4vw,20px)\" }}>Edit Profile</h2>\n            </div>\n            <div className=\"form-card\" style={{ display:\"flex\", flexDirection:\"column\", gap:16 }}>\n              {err && <p className=\"err\">{err}</p>}\n              {WIZARD_STEPS.map(f => (\n                <div key={f.key}><label style={LBL}>{f.label}</label><input type={f.type||\"text\"} placeholder={f.placeholder} value={pf[f.key]||\"\"} onChange={e=>setPf({...pf,[f.key]:e.target.value})} /></div>\n              ))}\n              <div style={{ marginTop:8 }}>\n                <label style={LBL}>\ud83d\udcf8 Child's photo (for illustration style)</label>\n                <div style={{ display:\"flex\", alignItems:\"center\", gap:14 }}>\n                  {photoPreview || pf.photo_url ? (\n                    <img src={photoPreview||pf.photo_url} alt=\"\" style={{ width:56, height:56, borderRadius:\"50%\", objectFit:\"cover\", border:\"2px solid rgba(201,168,76,.4)\" }} />\n                  ) : (\n                    <div style={{ width:56, height:56, borderRadius:\"50%\", background:\"rgba(255,255,255,.06)\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", fontSize:24 }}>\ud83d\udc67</div>\n                  )}\n                  <label style={{ cursor:\"pointer\" }}>\n                    <div style={{ color:\"rgba(180,143,255,.8)\", fontSize:13, textDecoration:\"underline\" }}>\n                      {photoAnalyzing ? \"Analyzing\u2026\" : (photoPreview || pf.photo_url) ? \"Change photo\" : \"Upload photo\"}\n                    </div>\n                    <input type=\"file\" accept=\"image/*\" capture=\"user\" style={{ display:\"none\" }} onChange={e=>{const f=e.target.files?.[0];if(f)handlePhotoUpload(f);}} />\n                  </label>\n                  {pf.character_card && <span style={{ color:\"rgba(255,255,255,.25)\", fontSize:11 }}>\u2713 Character captured</span>}\n                </div>\n              </div>\n              <button className=\"btn-solid\" style={{ marginTop:4 }} onClick={saveProfile}>Save Changes</button>\n            </div>\n          </div>\n        )}\n\n        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            STORY\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"story\" && (\n          <div className=\"fade has-bottom-nav\" style={{ maxWidth:\"min(96vw,960px)\", width:\"100%\", paddingBottom:20 }}>\n            {(storyPhase===\"text\" || storyPhase===\"idle\") && <MoonLoader text=\"Writing your story\u2026\" childName={active?.child_name||\"\"} />}\n            {storyPhase===\"illustrating\" && <IllustrationLoader total={pages.length} loaded={imgsLoaded} title={title} imgs={imgs} />}\n            {storyPhase===\"ready\" && pages.length>0 && (\n              <>\n                <OpenBook pages={pages} imgs={imgs} spread={spread} onFlip={handleFlip} title={title} mobile={mobile} coverImg={coverImg} />\n\n                {/* Progress indicator */}\n                {imgsLoaded<pages.length && (\n                  <div style={{ textAlign:\"center\", marginTop:12 }}>\n                    <p style={{ color:\"rgba(255,255,255,.22)\", fontSize:12 }}>\ud83c\udfa8 Painting illustrations\u2026 {imgsLoaded}/{pages.length}</p>\n                    <div style={{ width:140, height:3, background:\"rgba(255,255,255,.07)\", borderRadius:99, margin:\"6px auto 0\", overflow:\"hidden\" }}>\n                      <div style={{ height:\"100%\", borderRadius:99, background:\"linear-gradient(90deg,#7c4dcc,#c084fc)\", width:"${(imgsLoaded/pages.length)*100}%", transition:\"width .4s ease\" }} />\n                    </div>\n                  </div>\n                )}\n\n                {/* Actions \u2014 stacked rows on mobile */}\n                <div style={{ marginTop:18, display:\"flex\", flexDirection:\"column\", gap:10, maxWidth: tablet ? 680 : 520, margin:\"18px auto 0\" }}>\n                  {/* Actions */}\n                  <button className=\"btn-book\" onClick={toggleFavorite}\n                    style={{ background:story?.is_favorite?\"rgba(201,168,76,.1)\":\"\", borderColor:story?.is_favorite?\"rgba(201,168,76,.4)\":\"\", color:story?.is_favorite?\"var(--gold-light)\":\"rgba(255,255,255,.6)\" }}>\n                    <span>{story?.is_favorite ? \"\u2605\" : \"\u2606\"}</span>\n                    {story?.is_favorite ? \"Saved to Favorites\" : \"Save to Favorites\"}\n                  </button>\n                  <button className=\"btn-book\" onClick={generateColoringPage} disabled={coloringLoading}\n                    style={{ borderColor:\"rgba(192,132,252,.25)\", color:\"#c4a0ff\" }}>\n                    <span>{coloringLoading?\"\ud83c\udfa8\":\"\ud83d\udd8d\ufe0f\"}</span>\n                    {coloringLoading?\"Generating coloring page\u2026\":\"Make a Coloring Page\"}\n                  </button>\n                  {story && !story.is_sequel_of && (\n                    <button onClick={()=>setShowSequelPrompt(true)} className=\"btn-book\"\n                      style={{ borderColor:\"rgba(192,132,252,.25)\", color:\"#c4a0ff\" }}>\n                      <span>\u2728</span>\n                      Write a Sequel\n                    </button>\n                  )}\n                  {/* Row 4: nav + utilities */}\n                  {mobile ? (\n                    <div style={{ display:\"grid\", gridTemplateColumns:\"1fr 1fr\", gap:8 }}>\n                      <button className=\"btn-soft\" style={{ fontSize:13 }} onClick={shareStory}>{copied?\"\u2705 Copied!\":\"\ud83d\udd17 Share\"}</button>\n                      <button className=\"btn-soft\" style={{ fontSize:13 }} onClick={readAloud}>{speaking?\"\u23f9\ufe0f Stop\":\"\ud83d\udd0a Read\"}</button>\n                    </div>\n                  ) : (\n                    <div style={{ display:\"grid\", gridTemplateColumns:\"1fr 1fr 1fr\", gap:8 }}>\n                      <button className=\"btn-soft\" style={{ fontSize:13 }} onClick={()=>{ try{localStorage.removeItem(\"dw_last_story\");}catch{}setScreen(\"home\"); }}>\u2190 Home</button>\n                      <button className=\"btn-soft\" style={{ fontSize:13 }} onClick={shareStory}>{copied?\"\u2705 Copied!\":\"\ud83d\udd17 Share\"}</button>\n                      <button className=\"btn-soft\" style={{ fontSize:13 }} onClick={readAloud}>{speaking?\"\u23f9\ufe0f Stop\":\"\ud83d\udd0a Read\"}</button>\n                    </div>\n                  )}\n                </div>\n              </>\n            )}\n          </div>\n        )}\n\n        {/* Sequel prompt modal */}\n        {/* \u2500\u2500 Already-have-story-today modal \u2500\u2500 */}\n        {/* \u2500\u2500 Add child upsell modal \u2500\u2500 */}\n        {showAddChildUpsell && (\n          <div style={{ position:\"fixed\", inset:0, background:\"rgba(0,0,0,.75)\", backdropFilter:\"blur(14px)\", zIndex:2000,\n            display:\"flex\", alignItems:\"flex-end\", justifyContent:\"center\" }}\n            onClick={()=>{setShowAddChildUpsell(false);setAddChildErr(\"\");}}>\n            <div style={{ background:\"linear-gradient(175deg,#120828,#0d0618)\", border:\"1px solid rgba(255,255,255,.09)\",\n              borderRadius:\"24px 24px 0 0\", padding:\"clamp(20px,4vw,32px)\", width:\"100%\", maxWidth:480,\n              animation:\"slideUp .3s ease\", paddingBottom:\"max(28px,env(safe-area-inset-bottom,28px))\" }}\n              onClick={e=>e.stopPropagation()}>\n              <div style={{ width:40, height:4, borderRadius:99, background:\"rgba(255,255,255,.12)\", margin:\"0 auto 28px\" }} />\n\n              <div style={{ textAlign:\"center\", marginBottom:28 }}>\n                <div style={{ fontSize:48, marginBottom:14, display:\"inline-block\" }}>\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d\udc66</div>\n                <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:24, fontWeight:800,\n                  letterSpacing:\"-.02em\", color:\"var(--text-1)\", marginBottom:10, lineHeight:1.2 }}>\n                  Add another child\n                </div>\n                <div style={{ fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:16,\n                  color:\"rgba(255,255,255,.45)\", lineHeight:1.7 }}>\n                  Each additional child is <strong style={{ color:\"var(--gold-light)\", fontStyle:\"normal\" }}>$2.99/month</strong> \u2014 they get their own personalized stories every night.\n                </div>\n              </div>\n\n              {/* Price breakdown */}\n              <div style={{ background:\"rgba(201,168,76,.06)\", border:\"1px solid rgba(201,168,76,.15)\",\n                borderRadius:14, padding:\"16px 20px\", marginBottom:20 }}>\n                <div style={{ display:\"flex\", justifyContent:\"space-between\", marginBottom:8 }}>\n                  <span style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:13, color:\"rgba(255,255,255,.45)\" }}>Current plan ({profiles.length} {profiles.length===1?\"child\":\"children\"})</span>\n                  <span style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:13, fontWeight:700, color:\"rgba(255,255,255,.6)\" }}>" + ((5.99+(profiles.length-1)*2.99).toFixed(2)) + "/mo</span>\n                </div>\n                <div style={{ display:\"flex\", justifyContent:\"space-between\", paddingTop:8, borderTop:\"1px solid rgba(255,255,255,.06)\" }}>\n                  <span style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:14, fontWeight:800, color:\"var(--text-1)\" }}>New plan ({profiles.length+1} children)</span>\n                  <span style={{ fontFamily:\"'Playfair Display',serif\", fontSize:18, fontWeight:800, color:\"var(--gold-light)\" }}>" + ((5.99+profiles.length*2.99).toFixed(2)) + "/mo</span>\n                </div>\n              </div>\n\n              {addChildErr && <div className=\"err\" style={{ marginBottom:12, textAlign:\"center\" }}>{addChildErr}</div>}\n\n              <div style={{ display:\"flex\", flexDirection:\"column\", gap:10 }}>\n                <button className=\"btn-cta full\" style={{ fontSize:15, opacity:addChildLoading?.8:1 }}\n                  onClick={confirmAddChild} disabled={addChildLoading}>\n                  {addChildLoading ? \"Updating plan\u2026\" : "Add child — $${(5.99+profiles.length*2.99).toFixed(2)}/mo"}\n                </button>\n                <button className=\"btn-soft\" onClick={()=>{setShowAddChildUpsell(false);setAddChildErr(\"\");}}>\n                  Maybe later\n                </button>\n              </div>\n            </div>\n          </div>\n        )}\n\n        {/* Payment success toast */}\n        {paymentSuccess && (\n          <div style={{ position:\"fixed\", top:24, left:\"50%\", transform:\"translateX(-50%)\", zIndex:10001,\n            background:\"linear-gradient(135deg,#14532d,#166534)\", border:\"1px solid rgba(74,222,128,.3)\",\n            borderRadius:14, padding:\"14px 22px\", display:\"flex\", alignItems:\"center\", gap:12,\n            boxShadow:\"0 8px 32px rgba(0,0,0,.5)\", animation:\"fadeUp .4s ease\", whiteSpace:\"nowrap\" }}>\n            <span style={{ fontSize:22 }}>\ud83c\udf89</span>\n            <div>\n              <div style={{ fontFamily:\"'Nunito',sans-serif\", fontWeight:800, fontSize:14, color:\"#bbf7d0\" }}>You're subscribed!</div>\n              <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"rgba(187,247,208,.65)\", marginTop:2 }}>Stories are now unlocked for your family.</div>\n            </div>\n          </div>\n        )}\n\n        {showTomorrowModal && (\n          <div style={{ position:\"fixed\", inset:0, background:\"rgba(0,0,0,.75)\", backdropFilter:\"blur(14px)\", zIndex:2000, display:\"flex\", alignItems:\"flex-end\", justifyContent:\"center\", padding:\"0 0 env(safe-area-inset-bottom,0px)\" }}\n            onClick={()=>setShowTomorrowModal(null)}>\n            <div style={{ background:\"linear-gradient(175deg,#120828,#0d0618)\", border:\"1px solid rgba(255,255,255,.09)\", borderRadius:\"24px 24px 0 0\", padding:\"clamp(20px,4vw,32px)\", width:\"100%\", maxWidth:480, animation:\"slideUp .3s ease\" }}\n              onClick={e=>e.stopPropagation()}>\n              {/* Handle */}\n              <div style={{ width:40, height:4, borderRadius:99, background:\"rgba(255,255,255,.12)\", margin:\"0 auto 28px\" }} />\n\n              {showTomorrowModal === \"story\" ? (\n                <>\n                  <div style={{ textAlign:\"center\", marginBottom:28 }}>\n                    <div style={{ fontSize:52, marginBottom:16, filter:\"drop-shadow(0 0 24px rgba(200,165,55,.5))\", animation:\"float 4s ease-in-out infinite\", display:\"inline-block\" }}>\ud83c\udf19</div>\n                    <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:24, fontWeight:800, letterSpacing:\"-.02em\", marginBottom:10, lineHeight:1.2 }}>\n                      Tonight's story is ready\n                    </div>\n                    <div style={{ fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:16, color:\"rgba(255,255,255,.45)\", lineHeight:1.7 }}>\n                      {active?.child_name} already has a story for tonight.<br/>\n                      A brand new one will be waiting {prettyTomorrow()}.\n                    </div>\n                  </div>\n                  <div style={{ display:\"flex\", flexDirection:\"column\", gap:10 }}>\n                    <button className=\"btn-cta full\" style={{ fontSize:15 }}\n                      onClick={()=>{ setShowTomorrowModal(null);\n                        const s=library.find(x=>x.story_date===todayStr()&&x.child_profile_id===active?.id);\n                        if(s){const ps=s.text.split(\"\\n\\n\u2726\\n\\n\");setPages(ps);setTitle(s.title||\"\");setImgs(s.page_images||[]);setCoverImg(s.cover_image||null);setSpread(s.cover_image?-1:0);setStory(s);setStoryPhase(\"ready\");setScreen(\"story\");try{localStorage.setItem(\"dw_last_story\",s.id);}catch{}} }}>\n                      \ud83d\udcd6  Read tonight's story\n                    </button>\n                    <button className=\"btn-soft\" onClick={()=>setShowTomorrowModal(null)}>\n                      Back\n                    </button>\n                  </div>\n                </>\n              ) : (\n                <>\n                  <div style={{ textAlign:\"center\", marginBottom:28 }}>\n                    <div style={{ fontSize:52, marginBottom:16, filter:\"drop-shadow(0 0 24px rgba(120,80,220,.5))\", display:\"inline-block\" }}>\u2728</div>\n                    <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:24, fontWeight:800, letterSpacing:\"-.02em\", marginBottom:10, lineHeight:1.2 }}>\n                      Sequel queued!\n                    </div>\n                    <div style={{ fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:16, color:\"rgba(255,255,255,.45)\", lineHeight:1.7 }}>\n                      The next adventure is being written and will be waiting for {active?.child_name} {prettyTomorrow()}.\n                    </div>\n                  </div>\n                  <div style={{ background:\"rgba(201,168,76,.06)\", border:\"1px solid rgba(201,168,76,.18)\", borderRadius:14, padding:\"16px 18px\", marginBottom:20, display:\"flex\", alignItems:\"center\", gap:14 }}>\n                    <div style={{ fontSize:28, flexShrink:0 }}>\ud83c\udf05</div>\n                    <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:13, color:\"rgba(255,255,255,.5)\", lineHeight:1.6 }}>\n                      Come back {prettyTomorrow()} to read the next chapter of <em style={{ color:\"var(--gold-light)\", fontStyle:\"italic\" }}>{title}</em>.\n                    </div>\n                  </div>\n                  <button className=\"btn-cta full\" style={{ fontSize:15 }} onClick={()=>setShowTomorrowModal(null)}>\n                    Can't wait! \ud83c\udf19\n                  </button>\n                </>\n              )}\n            </div>\n          </div>\n        )}\n\n        {showSequelPrompt && story && (\n          <div style={{ position:\"fixed\", inset:0, background:\"rgba(0,0,0,.75)\", backdropFilter:\"blur(14px)\", zIndex:2000, display:\"flex\", alignItems:\"flex-end\", justifyContent:\"center\", padding:\"0 0 env(safe-area-inset-bottom,0px)\" }}\n            onClick={()=>setShowSequelPrompt(false)}>\n            <div style={{ background:\"linear-gradient(175deg,#1a0a3e,#0d0620)\", border:\"1px solid rgba(192,132,252,.15)\", borderRadius:\"24px 24px 0 0\", padding:\"clamp(20px,4vw,32px)\", width:\"100%\", maxWidth:480, animation:\"slideUp .3s ease\" }}\n              onClick={e=>e.stopPropagation()}>\n              {/* Handle */}\n              <div style={{ width:40, height:4, borderRadius:99, background:\"rgba(255,255,255,.15)\", margin:\"0 auto 24px\" }} />\n\n              {/* Cover preview */}\n              <div style={{ display:\"flex\", alignItems:\"center\", gap:16, marginBottom:22 }}>\n                <div style={{ width:56, height:72, borderRadius:10, overflow:\"hidden\", flexShrink:0, background:\"linear-gradient(160deg,#1a0a3e,#0d0520)\", boxShadow:\"0 4px 20px rgba(0,0,0,.5)\" }}>\n                  {(coverImg||imgs[0]) && <img src={coverImg||imgs[0]} alt=\"\" style={{ width:\"100%\", height:\"100%\", objectFit:\"cover\" }} />}\n                </div>\n                <div style={{ flex:1, minWidth:0 }}>\n                  <div style={{ fontSize:11, color:\"rgba(255,255,255,.25)\", fontFamily:\"'Nunito',sans-serif\", letterSpacing:\".1em\", textTransform:\"uppercase\", marginBottom:5 }}>Continue the adventure</div>\n                  <div style={{ fontFamily:\"'Playfair Display',serif\", fontStyle:\"italic\", fontSize:16, color:\"rgba(255,255,255,.85)\", lineHeight:1.3, marginBottom:3 }}>{title}</div>\n                  <div style={{ fontSize:12, color:\"rgba(255,255,255,.3)\", fontFamily:\"'Nunito',sans-serif\" }}>A brand new 14-page sequel</div>\n                </div>\n              </div>\n\n              {/* What to expect */}\n              <div style={{ background:\"rgba(192,132,252,.07)\", border:\"1px solid rgba(192,132,252,.12)\", borderRadius:16, padding:\"14px 16px\", marginBottom:22 }}>\n                <div style={{ fontSize:12, color:\"rgba(192,132,252,.7)\", fontFamily:\"'Nunito',sans-serif\", fontWeight:700, marginBottom:8 }}>What you'll get</div>\n                {[\n                  \"Same characters and world from this story\",\n                  \"A brand new adventure \u2014 different from tonight's\",\n                  \"14 pages, fully illustrated, in ~40 seconds\",\n                ].map((item,i) => (\n                  <div key={i} style={{ display:\"flex\", gap:8, alignItems:\"flex-start\", marginBottom:i<2?6:0 }}>\n                    <span style={{ color:\"rgba(192,132,252,.6)\", fontSize:12, marginTop:1, flexShrink:0 }}>\u2726</span>\n                    <span style={{ fontSize:13, color:\"rgba(255,255,255,.5)\", fontFamily:\"'Nunito',sans-serif\", lineHeight:1.5 }}>{item}</span>\n                  </div>\n                ))}\n              </div>\n\n              <button onClick={()=>{ setShowSequelPrompt(false); generateSequel(); }}\n                style={{ width:\"100%\", padding:\"17px\", borderRadius:18, border:\"none\", cursor:\"pointer\",\n                  background:\"linear-gradient(135deg, #d4a842 0%, #c49030 50%, #a87820 100%)\",\n                  color:\"#1a0d00\", fontFamily:\"'Nunito',sans-serif\", fontWeight:800, fontSize:15,\n                  boxShadow:\"0 6px 28px rgba(180,130,30,.4)\", marginBottom:10 }}>\n                \u2728 Write the Sequel\n              </button>\n              <button onClick={()=>setShowSequelPrompt(false)}\n                style={{ width:\"100%\", padding:\"13px\", borderRadius:14, border:\"none\", background:\"transparent\", color:\"rgba(255,255,255,.28)\", fontFamily:\"'Nunito',sans-serif\", fontSize:14, cursor:\"pointer\" }}>\n                Maybe later\n              </button>\n            </div>\n          </div>\n        )}\n\n        {/* Share card modal */}\n        {showShareCard && (\n          <div style={{ position:\"fixed\", inset:0, background:\"rgba(0,0,0,.7)\", backdropFilter:\"blur(12px)\", zIndex:2000, display:\"flex\", alignItems:\"flex-end\", justifyContent:\"center\", padding:\"0 0 env(safe-area-inset-bottom,0px)\" }}\n            onClick={()=>setShowShareCard(false)}>\n            <div style={{ background:\"linear-gradient(175deg,#1a0a3e,#0d0620)\", border:\"1px solid rgba(255,255,255,.1)\", borderRadius:\"24px 24px 0 0\", padding:\"clamp(20px,4vw,32px)\", width:\"100%\", maxWidth:480, animation:\"slideUp .3s ease\" }}\n              onClick={e=>e.stopPropagation()}>\n              {/* Handle */}\n              <div style={{ width:40, height:4, borderRadius:99, background:\"rgba(255,255,255,.15)\", margin:\"0 auto 20px\" }} />\n\n              {/* Preview */}\n              <div style={{ borderRadius:16, overflow:\"hidden\", aspectRatio:\"1/1\", marginBottom:20, position:\"relative\", background:\"linear-gradient(135deg,#1a0a3e,#0d0620)\", border:\"1px solid rgba(255,255,255,.08)\" }}>\n                {(coverImg||imgs[0]) && <img src={coverImg||imgs[0]} alt=\"\" style={{ width:\"100%\", height:\"70%\", objectFit:\"cover\", display:\"block\" }} />}\n                <div style={{ padding:\"clamp(12px,3vw,18px)\", textAlign:\"center\" }}>\n                  <p style={{ fontFamily:\"'Playfair Display',serif\", fontStyle:\"italic\", fontSize:\"clamp(15px,4vw,19px)\", color:\"white\", marginBottom:4, lineHeight:1.3 }}>{title}</p>\n                  <p style={{ color:\"rgba(255,255,255,.35)\", fontFamily:\"'Crimson Pro',serif\", fontSize:13 }}>A story for {active?.child_name} \u2726 DreamWeaver</p>\n                </div>\n              </div>\n\n              {/* Actions */}\n              <div style={{ display:\"flex\", flexDirection:\"column\", gap:10 }}>\n                <button className=\"btn-cta full\" onClick={downloadShareCard}>\n                  \u2b07\ufe0f Save As Image\n                </button>\n                <button className=\"btn-soft\" onClick={copyShareLink}>\n                  {copied ? \"\u2705 Link Copied!\" : \"\ud83d\udd17 Copy Share Link\"}\n                </button>\n                <button className=\"btn-soft\" onClick={()=>setShowShareCard(false)} style={{ opacity:.6 }}>\n                  Cancel\n                </button>\n              </div>\n            </div>\n          </div>\n        )}\n\n        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            BADGES SCREEN\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"badges\" && (\n          <div className=\"fade has-bottom-nav\" style={{ maxWidth:520, width:\"100%\" }}>\n            {/* Header */}\n            <div style={{ display:\"flex\", alignItems:\"center\", gap:14, marginBottom:28 }}>\n              <button onClick={()=>setScreen(\"home\")} style={{ width:36, height:36, borderRadius:\"50%\", background:\"rgba(255,255,255,.06)\", border:\"1px solid rgba(255,255,255,.09)\", cursor:\"pointer\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", flexShrink:0 }}>\n                <svg width=\"8\" height=\"14\" viewBox=\"0 0 8 14\" fill=\"none\"><path d=\"M7 1L1 7l6 6\" stroke=\"rgba(255,255,255,.6)\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/></svg>\n              </button>\n              <div>\n                <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:22, fontWeight:800, fontStyle:\"italic\" }}>{active?.child_name}'s Badges</div>\n                <div style={{ fontSize:12, color:\"rgba(255,255,255,.35)\", fontFamily:\"'Nunito',sans-serif\", marginTop:2 }}>{badges.length} of {BADGE_DEFS.length} earned</div>\n              </div>\n            </div>\n\n            {badges.length === 0 && (\n              <div style={{ textAlign:\"center\", padding:\"40px 20px\", background:\"rgba(255,255,255,.03)\", borderRadius:16, border:\"1px solid rgba(255,255,255,.07)\", marginBottom:20 }}>\n                <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>\ud83c\udfc5</div>\n                <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:17, fontStyle:\"italic\", color:\"rgba(255,255,255,.5)\", marginBottom:6 }}>No badges yet</div>\n                <div style={{ fontSize:13, color:\"rgba(255,255,255,.25)\", fontFamily:\"'Nunito',sans-serif\" }}>Read tonight's story to earn your first one</div>\n              </div>\n            )}\n\n            <div className=\"badge-grid\">\n              {BADGE_DEFS.map(b => {\n                const earned = badges.includes(b.id);\n                return (\n                  <div key={b.id} className={"badge-item ${earned?"earned":""}"} title={b.desc}>\n                    <span style={{ fontSize:28, filter:earned?\"none\":\"grayscale(1) opacity(.2)\" }}>{b.emoji}</span>\n                    <span style={{ fontSize:10, fontWeight:700, color:earned?\"rgba(255,255,255,.85)\":\"rgba(255,255,255,.2)\", lineHeight:1.3, fontFamily:\"'Nunito',sans-serif\" }}>{b.label}</span>\n                    {earned && <span style={{ fontSize:9, color:\"var(--gold)\", fontFamily:\"'Nunito',sans-serif\", letterSpacing:\".06em\" }}>\u2726 earned</span>}\n                  </div>\n                );\n              })}\n            </div>\n          </div>\n        )}\n\n        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            LIBRARY\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"library\" && (\n          <div className=\"fade has-bottom-nav\" style={{ maxWidth:600, width:\"100%\" }}>\n            {/* Header */}\n            <div style={{ display:\"flex\", alignItems:\"center\", gap:14, marginBottom:24 }}>\n              <button onClick={()=>setScreen(\"home\")} style={{ width:36, height:36, borderRadius:\"50%\", background:\"rgba(255,255,255,.06)\", border:\"1px solid rgba(255,255,255,.09)\", cursor:\"pointer\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", flexShrink:0 }}>\n                <svg width=\"8\" height=\"14\" viewBox=\"0 0 8 14\" fill=\"none\"><path d=\"M7 1L1 7l6 6\" stroke=\"rgba(255,255,255,.6)\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/></svg>\n              </button>\n              <div style={{ flex:1, minWidth:0 }}>\n                <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:22, fontWeight:800, fontStyle:\"italic\", overflow:\"hidden\", textOverflow:\"ellipsis\", whiteSpace:\"nowrap\" }}>{active?.child_name}'s Library</div>\n                <div style={{ fontSize:12, color:\"rgba(255,255,255,.35)\", fontFamily:\"'Nunito',sans-serif\", marginTop:2 }}>{library.length} {library.length===1?\"story\":\"stories\"} saved</div>\n              </div>\n            </div>\n\n            {/* Filter tabs */}\n            <div style={{ display:\"flex\", gap:8, marginBottom:20 }}>\n              {[{id:\"all\",label:\"All Stories\"},{id:\"favorites\",label:\"\u2605 Favorites\"}].map(f => (\n                <button key={f.id} onClick={()=>setLibFilter(f.id)}\n                  style={{ padding:\"8px 18px\", borderRadius:999, border:\"1px solid\", fontSize:13, fontFamily:\"'Nunito',sans-serif\", fontWeight:700, cursor:\"pointer\", transition:\"all .18s\",\n                    background: libFilter===f.id ? \"rgba(201,168,76,.12)\" : \"var(--surface-1)\",\n                    borderColor: libFilter===f.id ? \"rgba(201,168,76,.4)\" : \"var(--border-1)\",\n                    color: libFilter===f.id ? \"var(--gold-light)\" : \"var(--text-3)\" }}>\n                  {f.label}\n                </button>\n              ))}\n            </div>\n\n            {library.length===0 ? (\n              <div style={{ textAlign:\"center\", padding:\"clamp(48px,10vw,72px) 20px\" }}>\n                <div style={{ fontSize:\"clamp(52px,12vw,68px)\", animation:\"float 4s ease-in-out infinite\", filter:\"drop-shadow(0 0 24px rgba(200,170,80,.3))\", marginBottom:24, display:\"block\" }}>\ud83c\udf19</div>\n                <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:\"clamp(20px,5vw,26px)\", fontStyle:\"italic\", marginBottom:10, lineHeight:1.3 }}>\n                  {active?.child_name}'s first story<br/>is waiting to be written\n                </div>\n                <div style={{ color:\"rgba(255,255,255,.32)\", fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:15, lineHeight:1.8, maxWidth:300, margin:\"0 auto 28px\" }}>\n                  Every night, a brand new 14-page illustrated picture book \u2014 starring {active?.child_name} as the hero.\n                </div>\n                <button className=\"btn-cta\" style={{ margin:\"0 auto\", display:\"block\", width:\"auto\", padding:\"15px 32px\" }} onClick={()=>setScreen(\"home\")}>\n                  \u2728 Open Tonight's Story\n                </button>\n              </div>\n            ) : (\n              <div style={{ display:\"flex\", flexDirection:\"column\", gap:10 }}>\n                {library.filter(s => libFilter===\"all\" || s.is_favorite).map(s => {\n                  const isToday=s.story_date===todayStr();\n                  const d=new Date(s.story_date+\"T00:00:00\");\n                  const label=isToday?\"Tonight\":d.toLocaleDateString(\"en-US\",{weekday:\"short\",month:\"short\",day:\"numeric\"});\n                  return (\n                    <div key={s.id}\n                      onClick={()=>{const ps=s.text.split(\"\\n\\n\u2726\\n\\n\");setPages(ps);setTitle(s.title||\"\");setImgs(s.page_images||[]);setCoverImg(s.cover_image||null);setSpread(s.cover_image?-1:0);setStory(s);setStoryPhase(\"ready\");setScreen(\"story\");try{localStorage.setItem(\"dw_last_story\",s.id);localStorage.setItem(\"dw_last_screen\",\"story\");}catch{}}}\n                      style={{ display:\"flex\", gap:14, alignItems:\"center\", padding:\"14px 16px\", cursor:\"pointer\", borderRadius:14, background:\"rgba(255,255,255,.04)\", border:"1px solid ${isToday?"rgba(201,168,76,.22)":"rgba(255,255,255,.08)"}", transition:\"all .18s\", WebkitTapHighlightColor:\"transparent\" }}\n                      onMouseEnter={e=>{e.currentTarget.style.background=\"rgba(255,255,255,.08)\";e.currentTarget.style.borderColor=isToday?\"rgba(201,168,76,.4)\":\"rgba(255,255,255,.14)\";}}\n                      onMouseLeave={e=>{e.currentTarget.style.background=\"rgba(255,255,255,.04)\";e.currentTarget.style.borderColor=isToday?\"rgba(201,168,76,.22)\":\"rgba(255,255,255,.08)\";}}>\n                      {s.cover_image||s.page_images?.[0]\n                        ? <img src={s.cover_image||s.page_images[0]} alt=\"\" style={{ width:52, height:68, objectFit:\"cover\", borderRadius:8, flexShrink:0, border:\"1px solid rgba(255,255,255,.1)\" }} />\n                        : <div style={{ width:52, height:68, borderRadius:8, background:\"linear-gradient(135deg,#2d1860,#5b21b6)\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", fontSize:20, flexShrink:0 }}>\ud83c\udf19</div>}\n                      <div style={{ flex:1, minWidth:0 }}>\n                        <div style={{ display:\"flex\", gap:7, alignItems:\"center\", marginBottom:4, flexWrap:\"wrap\" }}>\n                          <span style={{ color:isToday?\"var(--gold)\":\"rgba(255,255,255,.3)\", fontSize:11, letterSpacing:\".08em\", textTransform:\"uppercase\", fontWeight:700, fontFamily:\"'Nunito',sans-serif\" }}>{label}</span>\n                          {s.lesson_type && <span style={{ background:\"rgba(74,222,128,.1)\", border:\"1px solid rgba(74,222,128,.2)\", borderRadius:999, padding:\"1px 8px\", fontSize:10, color:\"#6ee7a0\", flexShrink:0 }}>{LESSONS.find(l=>l.id===s.lesson_type)?.emoji} {LESSONS.find(l=>l.id===s.lesson_type)?.label}</span>}\n                        </div>\n                        <div style={{ display:\"flex\", alignItems:\"center\", gap:6 }}>\n                          {s.is_favorite && <span style={{ color:\"var(--gold)\", fontSize:13, flexShrink:0 }}>\u2605</span>}\n                          <div style={{ color:\"rgba(255,255,255,.85)\", fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:15, overflow:\"hidden\", textOverflow:\"ellipsis\", whiteSpace:\"nowrap\" }}>{s.title||s.text?.slice(0,60)+\"\u2026\"}</div>\n                        </div>\n                        <div style={{ fontSize:11, color:\"rgba(255,255,255,.25)\", fontFamily:\"'Nunito',sans-serif\", marginTop:3 }}>{s.page_images?.length||0} illustrations</div>\n                      </div>\n                      <div style={{ display:\"flex\", flexDirection:\"column\", alignItems:\"flex-end\", gap:8, flexShrink:0 }}>\n                        <svg width=\"6\" height=\"12\" viewBox=\"0 0 6 12\" fill=\"none\"><path d=\"M1 1l4 5-4 5\" stroke=\"rgba(255,255,255,.25)\" strokeWidth=\"1.5\" strokeLinecap=\"round\"/></svg>\n                        {s.is_favorite && (\n                          <button\n                            onClick={(e)=>{ e.stopPropagation(); const ps=s.text.split(\"\\n\\n\u2726\\n\\n\"); setPages(ps); setTitle(s.title||\"\"); setImgs(s.page_images||[]); setCoverImg(s.cover_image||null); setSpread(s.cover_image?-1:0); setStory(s); setStoryPhase(\"ready\"); setScreen(\"story\"); setTimeout(()=>generateSequel(),150); }}\n                            style={{ background:\"rgba(201,168,76,.08)\", border:\"1px solid rgba(201,168,76,.25)\", borderRadius:99, padding:\"4px 10px\", fontSize:11, color:\"var(--gold-light)\", fontFamily:\"'Nunito',sans-serif\", fontWeight:700, cursor:\"pointer\", whiteSpace:\"nowrap\" }}>\n                            \ud83d\udcd6 Sequel\n                          </button>\n                        )}\n                      </div>\n                    </div>\n                  );\n                })}\n              </div>\n            )}\n          </div>\n        )}\n\n        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            PAYWALL\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"paywall\" && (() => {\n          const isTrialEnd = !sub || (sub.status===\"trial\" && new Date(sub.trial_ends_at)<=new Date());\n          const isAddingChild = sub?.status===\"active\" || sub?.status===\"trial\";\n          const currentKids = profiles.length;\n          const newPrice = PRICE_BASE + currentKids * PRICE_PER_EXTRA;\n          return (\n          <div className=\"fade\" style={{ maxWidth:440, width:\"100%\", paddingTop:\"clamp(16px,4vw,32px)\" }}>\n            {/* Moon header */}\n            <div style={{ textAlign:\"center\", marginBottom:32 }}>\n              <div style={{ fontSize:56, marginBottom:16, animation:\"float 5s ease-in-out infinite\", filter:\"drop-shadow(0 0 28px rgba(200,160,50,.55))\" }}>\ud83c\udf19</div>\n              {isTrialEnd ? (\n                <>\n                  <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:26, fontWeight:800, letterSpacing:\"-.02em\", marginBottom:8, lineHeight:1.2 }}>Your trial has ended</div>\n                  <div style={{ color:\"rgba(255,255,255,.4)\", fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:16, lineHeight:1.7 }}>\n                    Keep the magic going \u2014 subscribe to continue<br/>generating stories for your family.\n                  </div>\n                </>\n              ) : (\n                <>\n                  <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:26, fontWeight:800, letterSpacing:\"-.02em\", marginBottom:8 }}>Add another child</div>\n                  <div style={{ color:\"rgba(255,255,255,.4)\", fontFamily:\"'Crimson Pro',serif\", fontStyle:\"italic\", fontSize:16, lineHeight:1.7 }}>\n                    Your plan updates to <strong style={{ color:\"var(--gold-light)\" }}>" + (newPrice.toFixed(2)) + "/month</strong> for {currentKids + 1} children.\n                  </div>\n                </>\n              )}\n            </div>\n\n            {/* 3 big value props */}\n            <div style={{ display:\"flex\", flexDirection:\"column\", gap:10, marginBottom:24 }}>\n              {[\n                { icon:\"\ud83d\udcd6\", title:\"A new story every night\", desc:\"14 illustrated pages, unique every time\" },\n                { icon:\"\ud83c\udfa8\", title:\"Illustrated just for them\", desc:\"Watercolor art tailored to your child\" },\n                { icon:\"\u2728\", title:\"Life lessons woven in\", desc:\"Adventure, bravery, kindness, and more\" },\n              ].map(({icon,title,desc}) => (\n                <div key={title} style={{ display:\"flex\", alignItems:\"center\", gap:16, padding:\"16px 18px\", borderRadius:14, background:\"rgba(255,255,255,.04)\", border:\"1px solid rgba(255,255,255,.08)\" }}>\n                  <div style={{ fontSize:26, flexShrink:0 }}>{icon}</div>\n                  <div>\n                    <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:15, fontWeight:700, color:\"rgba(255,255,255,.9)\", marginBottom:2 }}>{title}</div>\n                    <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:13, color:\"rgba(255,255,255,.38)\" }}>{desc}</div>\n                  </div>\n                </div>\n              ))}\n            </div>\n\n            {/* Pricing */}\n            <div style={{ background:\"rgba(201,168,76,.06)\", border:\"1px solid rgba(201,168,76,.2)\", borderRadius:16, padding:\"20px 22px\", marginBottom:20 }}>\n              <div style={{ display:\"flex\", justifyContent:\"space-between\", alignItems:\"center\", marginBottom:12 }}>\n                <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:14, color:\"rgba(255,255,255,.6)\" }}>Monthly plan</div>\n                <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:24, fontWeight:800, color:\"var(--gold-light)\" }}>\n                  " + (isTrialEnd ? PRICE_BASE.toFixed(2) : newPrice.toFixed(2)) + "<span style={{ fontSize:14, fontFamily:\"'Nunito',sans-serif\", fontWeight:600, color:\"rgba(255,255,255,.4)\" }}>/mo</span>\n                </div>\n              </div>\n              <div style={{ display:\"flex\", flexWrap:\"wrap\", gap:6 }}>\n                {[\"Unlimited stories\",\"Cancel anytime\",\"All children included\",\"Story library forever\"].map(f => (\n                  <div key={f} style={{ display:\"flex\", alignItems:\"center\", gap:5, padding:\"4px 10px\", borderRadius:999, background:\"rgba(201,168,76,.08)\", border:\"1px solid rgba(201,168,76,.15)\" }}>\n                    <span style={{ color:\"var(--gold)\", fontSize:10 }}>\u2726</span>\n                    <span style={{ fontSize:11, fontFamily:\"'Nunito',sans-serif\", fontWeight:600, color:\"rgba(255,255,255,.6)\" }}>{f}</span>\n                  </div>\n                ))}\n              </div>\n            </div>\n\n            <div style={{ display:\"flex\", flexDirection:\"column\", gap:10 }}>\n              <button className=\"btn-cta full\" style={{ fontSize:16, padding:\"17px\" }}>\n                {isTrialEnd ? "Subscribe — $${PRICE_BASE.toFixed(2)}/Month" : "Update Plan — $${newPrice.toFixed(2)}/Month"}\n              </button>\n              <button className=\"btn-soft\" onClick={()=>setScreen(\"home\")}>Maybe later</button>\n            </div>\n            <p style={{ textAlign:\"center\", fontSize:12, color:\"rgba(255,255,255,.18)\", fontFamily:\"'Nunito',sans-serif\", marginTop:12 }}>No commitment \u00b7 Cancel anytime</p>\n          </div>\n          );\n        })()}\n\n        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n            SETTINGS / ACCOUNT\n        \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}\n        {screen===\"settings\" && (() => {\n          const isActive = sub?.status===\"active\";\n          const isTrial  = sub?.status===\"trial\";\n          const openPortal = async () => {\n            try {\n              const r = await fetch(\"/api/stripe-portal\", { method:\"POST\", headers:{\"Content-Type\":\"application/json\"}, body:JSON.stringify({email:user.email,user_id:user.id,return_url:window.location.href}) });\n              const d = await r.json();\n              if (d.url) window.location.href = d.url;\n              else alert(\"Could not open billing portal.\");\n            } catch { alert(\"Could not open billing portal. Please try again.\"); }\n          };\n          const startCheckout = async () => {\n            try {\n              const r = await fetch(\"/api/stripe-checkout\", { method:\"POST\", headers:{\"Content-Type\":\"application/json\"},\n                body:JSON.stringify({ email:user.email, user_id:user.id, child_count:profiles.length, success_url:window.location.href+\"?payment=success\", cancel_url:window.location.href }) });\n              const d = await r.json();\n              if (d.url) window.location.href = d.url;\n              else alert(\"Could not start checkout.\");\n            } catch { alert(\"Could not start checkout. Please try again.\"); }\n          };\n\n          const SGroup = ({children}) => <div style={{ background:\"rgba(255,255,255,.04)\", border:\"1px solid rgba(255,255,255,.08)\", borderRadius:14, overflow:\"hidden\", marginBottom:12 }}>{children}</div>;\n          const SRow = ({icon, label, value, onPress, danger, last=false, badge, right}) => (\n            <div onClick={onPress} style={{ display:\"flex\", alignItems:\"center\", gap:14, padding:\"14px 18px\",\n              borderBottom:last?\"none\":\"1px solid rgba(255,255,255,.05)\",\n              cursor:onPress?\"pointer\":\"default\", transition:\"background .12s\" }}\n              onMouseEnter={e=>{if(onPress)e.currentTarget.style.background=\"rgba(255,255,255,.04)\";}}\n              onMouseLeave={e=>{e.currentTarget.style.background=\"transparent\";}}>\n              {icon && <div className=\"settings-icon\">{icon}</div>}\n              <div style={{ flex:1, minWidth:0 }}>\n                <div style={{ fontSize:14, fontWeight:600, fontFamily:\"'Nunito',sans-serif\", color:danger?\"rgba(255,80,80,.8)\":\"rgba(255,255,255,.88)\" }}>{label}</div>\n                {value && <div style={{ fontSize:12, color:\"rgba(255,255,255,.3)\", fontFamily:\"'Nunito',sans-serif\", marginTop:2, overflow:\"hidden\", textOverflow:\"ellipsis\", whiteSpace:\"nowrap\" }}>{value}</div>}\n              </div>\n              {right}\n              {badge && <div style={{ fontSize:11, fontWeight:700, fontFamily:\"'Nunito',sans-serif\", background:badge.bg||\"rgba(201,168,76,.12)\", color:badge.color||\"var(--gold-light)\", padding:\"3px 10px\", borderRadius:999, flexShrink:0, border:"1px solid ${badge.border||"rgba(201,168,76,.25)"}" }}>{badge.text}</div>}\n              {onPress && !danger && <svg width=\"6\" height=\"11\" viewBox=\"0 0 6 11\" fill=\"none\"><path d=\"M1 1l4 4.5L1 10\" stroke=\"rgba(255,255,255,.22)\" strokeWidth=\"1.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/></svg>}\n            </div>\n          );\n\n          return (\n          <div className=\"fade has-bottom-nav\" style={{ width:\"100%\", maxWidth:500 }}>\n\n            {/* Header */}\n            <div style={{ display:\"flex\", alignItems:\"center\", gap:14, marginBottom:28 }}>\n              <button onClick={()=>setScreen(\"home\")} style={{ width:36, height:36, borderRadius:\"50%\", background:\"rgba(255,255,255,.06)\", border:\"1px solid rgba(255,255,255,.09)\", cursor:\"pointer\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", flexShrink:0 }}>\n                <svg width=\"8\" height=\"14\" viewBox=\"0 0 8 14\" fill=\"none\"><path d=\"M7 1L1 7l6 6\" stroke=\"rgba(255,255,255,.6)\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/></svg>\n              </button>\n              <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:24, fontWeight:800, fontStyle:\"italic\" }}>Account</div>\n            </div>\n\n            {/* Profile card */}\n            <div style={{ display:\"flex\", alignItems:\"center\", gap:16, padding:\"18px 20px\", background:\"rgba(255,255,255,.04)\", borderRadius:16, marginBottom:12, border:\"1px solid rgba(255,255,255,.08)\" }}>\n              <div style={{ width:48, height:48, borderRadius:\"50%\", background:\"linear-gradient(135deg,#3d2080,#7c4dcc)\", display:\"flex\", alignItems:\"center\", justifyContent:\"center\", fontSize:22, flexShrink:0 }}>\ud83c\udf19</div>\n              <div style={{ flex:1, minWidth:0 }}>\n                <div style={{ fontSize:15, fontWeight:700, color:\"rgba(255,255,255,.88)\", fontFamily:\"'Nunito',sans-serif\", marginBottom:2, overflow:\"hidden\", textOverflow:\"ellipsis\", whiteSpace:\"nowrap\" }}>{user?.email}</div>\n                <div style={{ fontSize:12, color:\"rgba(255,255,255,.32)\", fontFamily:\"'Nunito',sans-serif\" }}>\n                  Member since {new Date(user?.created_at||Date.now()).toLocaleDateString(\"en-US\",{month:\"long\",year:\"numeric\"})}\n                </div>\n              </div>\n            </div>\n\n            {/* Stats strip */}\n            <div style={{ display:\"grid\", gridTemplateColumns:\"1fr 1fr 1fr\", gap:8, marginBottom:12 }}>\n              {[{label:\"Stories\",val:library.length,icon:\"\ud83d\udcd6\"},{label:\"Streak\",val:streak,icon:\"\ud83d\udd25\"},{label:\"Badges\",val:"${badges.length}/${BADGE_DEFS.length}",icon:\"\ud83c\udfc5\"}].map(s => (\n                <div key={s.label} style={{ background:\"rgba(255,255,255,.04)\", borderRadius:12, padding:\"14px 10px\", textAlign:\"center\", border:\"1px solid rgba(255,255,255,.07)\" }}>\n                  <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>\n                  <div style={{ fontFamily:\"'Playfair Display',serif\", fontSize:20, fontWeight:800, color:\"var(--gold-light)\", marginBottom:2 }}>{s.val}</div>\n                  <div style={{ fontSize:10, color:\"rgba(255,255,255,.3)\", fontFamily:\"'Nunito',sans-serif\", letterSpacing:\".06em\", textTransform:\"uppercase\" }}>{s.label}</div>\n                </div>\n              ))}\n            </div>\n\n            {/* Subscription card */}\n            <div style={{ borderRadius:14, border:\"1px solid rgba(255,255,255,.08)\", overflow:\"hidden\", marginBottom:12 }}>\n              {/* Status bar */}\n              <div style={{ padding:\"16px 18px\", display:\"flex\", alignItems:\"center\", justifyContent:\"space-between\", borderBottom:\"1px solid rgba(255,255,255,.05)\" }}>\n                <div style={{ display:\"flex\", alignItems:\"center\", gap:12 }}>\n                  <div style={{ width:8, height:8, borderRadius:\"50%\", background:isActive?\"#4ade80\":isTrial?\"#fbbf24\":\"#f87171\", boxShadow:"0 0 8px ${isActive?"rgba(74,222,128,.6)":isTrial?"rgba(251,191,36,.5)":"rgba(248,113,113,.5)"}" }} />\n                  <div>\n                    <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:14, fontWeight:700, color:\"var(--text-1)\" }}>\n                      {isActive ? \"Pro Plan\" : isTrial ? \"Free Trial\" : \"No active plan\"}\n                    </div>\n                    <div style={{ fontFamily:\"'Nunito',sans-serif\", fontSize:12, color:\"var(--text-3)\", marginTop:2 }}>\n                      {isActive\n                        ? "$${monthlyPrice().toFixed(2)}/month · ${sub?.cancel_at_period_end ? "cancels" : "renews"} ${sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : ""}"\n                        : isTrial\n                          ? "${daysLeft()} nights remaining · then $${PRICE_BASE.toFixed(2)}/mo"\n                          : \"Subscribe to generate stories\"}\n                    </div>\n                  </div>\n                </div>\n                <div style={{ fontSize:11, fontWeight:700, fontFamily:\"'Nunito',sans-serif\", padding:\"3px 10px\", borderRadius:999,\n                  background:isActive?\"rgba(74,222,128,.1)\":isTrial?\"rgba(251,191,36,.1)\":\"rgba(255,255,255,.06)\",\n                  color:isActive?\"#86efac\":isTrial?\"#fde68a\":\"var(--text-3)\",\n                  border:"1px solid ${isActive?"rgba(74,222,128,.25)":isTrial?"rgba(251,191,36,.2)":"rgba(255,255,255,.1)"}" }}>\n                  {isActive ? \"Active\" : isTrial ? \"Trial\" : \"Inactive\"}\n                </div>\n              </div>\n\n              {/* Details rows */}\n              {isActive && (\n                <>\n                  <div style={{ padding:\"12px 18px\", display:\"flex\", justifyContent:\"space-between\", borderBottom:\"1px solid rgba(255,255,255,.04)\" }}>\n                    <span style={{ fontSize:13, color:\"var(--text-3)\", fontFamily:\"'Nunito',sans-serif\" }}>Plan price</span>\n                    <span style={{ fontSize:13, fontWeight:700, color:\"var(--text-2)\", fontFamily:\"'Nunito',sans-serif\" }}>" + (monthlyPrice().toFixed(2)) + "/month</span>\n                  </div>\n                  <div style={{ padding:\"12px 18px\", display:\"flex\", justifyContent:\"space-between\", borderBottom:\"1px solid rgba(255,255,255,.04)\" }}>\n                    <span style={{ fontSize:13, color:\"var(--text-3)\", fontFamily:\"'Nunito',sans-serif\" }}>\n                      {sub?.cancel_at_period_end ? \"Access until\" : \"Next billing date\"}\n                    </span>\n                    <span style={{ fontSize:13, fontWeight:700, color:sub?.cancel_at_period_end?\"#f87171\":\"var(--text-2)\", fontFamily:\"'Nunito',sans-serif\" }}>\n                      {sub?.current_period_end\n                        ? new Date(sub.current_period_end).toLocaleDateString(\"en-US\",{weekday:\"short\",month:\"long\",day:\"numeric\",year:\"numeric\"})\n                        : \"\u2014\"}\n                    </span>\n                  </div>\n                  <div style={{ padding:\"12px 18px\", display:\"flex\", justifyContent:\"space-between\", borderBottom:\"1px solid rgba(255,255,255,.04)\" }}>\n                    <span style={{ fontSize:13, color:\"var(--text-3)\", fontFamily:\"'Nunito',sans-serif\" }}>Children</span>\n                    <span style={{ fontSize:13, fontWeight:700, color:\"var(--text-2)\", fontFamily:\"'Nunito',sans-serif\" }}>{profiles.length}</span>\n                  </div>\n                  {sub?.cancel_at_period_end && (\n                    <div style={{ padding:\"12px 18px\", background:\"rgba(248,113,113,.05)\", borderBottom:\"1px solid rgba(255,255,255,.04)\" }}>\n                      <div style={{ fontSize:12, color:\"rgba(248,113,113,.8)\", fontFamily:\"'Nunito',sans-serif\", lineHeight:1.5 }}>\n                        \u26a0\ufe0f Your plan is set to cancel. Stories will stop generating after {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(\"en-US\",{month:\"long\",day:\"numeric\"}) : \"the end of the period\"}. You can reactivate anytime via Manage Billing.\n                      </div>\n                    </div>\n                  )}\n                  <div style={{ padding:\"12px 18px\", display:\"flex\", gap:8 }}>\n                    <button onClick={openPortal} style={{ flex:1, padding:\"10px\", borderRadius:10, background:\"var(--surface-1)\", border:\"1px solid var(--border-1)\", color:\"var(--text-2)\", fontFamily:\"'Nunito',sans-serif\", fontWeight:700, fontSize:13, cursor:\"pointer\", transition:\"all .15s\" }}\n                      onMouseEnter={e=>e.currentTarget.style.background=\"var(--surface-2)\"} onMouseLeave={e=>e.currentTarget.style.background=\"var(--surface-1)\"}>\n                      \ud83d\udcb3 Manage Billing\n                    </button>\n                    <button onClick={openPortal} style={{ flex:1, padding:\"10px\", borderRadius:10, background:\"var(--surface-1)\", border:\"1px solid var(--border-1)\", color:\"var(--text-2)\", fontFamily:\"'Nunito',sans-serif\", fontWeight:700, fontSize:13, cursor:\"pointer\", transition:\"all .15s\" }}\n                      onMouseEnter={e=>e.currentTarget.style.background=\"var(--surface-2)\"} onMouseLeave={e=>e.currentTarget.style.background=\"var(--surface-1)\"}>\n                      \ud83d\udccb Invoices\n                    </button>\n                  </div>\n                </>\n              )}\n            </div>\n\n            {isTrial && (\n              <button onClick={startCheckout}\n                style={{ width:\"100%\", padding:\"16px\", borderRadius:14, border:\"none\", cursor:\"pointer\", marginBottom:12,\n                  background:\"linear-gradient(135deg,#d4a842,#b88a20)\",\n                  color:\"#130c00\", fontFamily:\"'Nunito',sans-serif\", fontWeight:800, fontSize:15,\n                  boxShadow:\"0 4px 24px rgba(180,130,30,.4)\" }}>\n                \u2728 Upgrade to Pro \u2014 " + (PRICE_BASE.toFixed(2)) + "/month\n              </button>\n            )}\n            {!sub || sub.status===\"canceled\" ? (\n              <button onClick={startCheckout}\n                style={{ width:\"100%\", padding:\"16px\", borderRadius:14, border:\"none\", cursor:\"pointer\", marginBottom:12,\n                  background:\"linear-gradient(135deg,#d4a842,#b88a20)\",\n                  color:\"#130c00\", fontFamily:\"'Nunito',sans-serif\", fontWeight:800, fontSize:15,\n                  boxShadow:\"0 4px 24px rgba(180,130,30,.4)\" }}>\n                \u2728 Subscribe \u2014 " + (PRICE_BASE.toFixed(2)) + "/month\n              </button>\n            ) : null}\n\n            {/* Children */}\n            <div style={{ fontSize:11, color:\"rgba(255,255,255,.28)\", fontFamily:\"'Nunito',sans-serif\", letterSpacing:\".1em\", textTransform:\"uppercase\", marginBottom:8, paddingLeft:2, fontWeight:700 }}>Children</div>\n            <SGroup>\n              {profiles.map((p,i) => (\n                <SRow key={p.id}\n                  icon={p.photo_url?<img src={p.photo_url} alt=\"\" style={{width:22,height:22,borderRadius:\"50%\",objectFit:\"cover\"}}/>:\"\ud83d\udc76\"}\n                  label={p.child_name} value={"Age ${p.age||"?"} · ${library.filter(s=>s.child_profile_id===p.id).length} stories"}\n                  onPress={()=>{setEditId(p.id);setPf(p);setScreen(\"profile\");}}\n                  last={i===profiles.length-1&&!canAddProfile()} />\n              ))}\n              {canAddProfile() && (\n                <SRow icon=\"\u2795\" label=\"Add Child\" value=\"Create a new story profile\"\n                  onPress={()=>{setEditId(null);if(sub?.status===\"active\"&&profiles.length>=1){setShowAddChildUpsell(true);}else{setPf({child_name:\"\",age:\"\",stuffed_animal:\"\",best_friend:\"\",favorite_animal:\"\",scared_of:\"\",favorite_thing:\"\"});setWizStep(0);setScreen(\"wizard\");}}}\n                  last />\n              )}\n            </SGroup>\n\n            {/* Misc */}\n            <SGroup>\n              <SRow icon=\"\ud83c\udfc5\" label=\"Badges & Achievements\" value={"${badges.length} of ${BADGE_DEFS.length} earned"} onPress={()=>setScreen(\"badges\")} />\n              <SRow icon=\"\ud83d\udcda\" label=\"Story Library\" value={"${library.length} stories saved""