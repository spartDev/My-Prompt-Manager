<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Presentation Engine Boilerplate

Copy the HTML in the code fence below verbatim as the starting file. It contains:
- All Sanofi design tokens
- The slide engine (show/hide, transitions)
- Keyboard navigation (Arrow keys, Space, PageUp/Down, Home, End)
- Mouse navigation bar (bottom center)
- Progress bar (top)
- Watermark

The two starter slides (hero + one content skeleton) are there to confirm the mechanics work. Replace them entirely with the real deck content drawn from `slide-patterns.md`.

**Important after copying**: update the `<title>` and the nav bar's initial counter value (`1 / N`) to match the actual total slide count.

---

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>[DECK TITLE] - Sanofi M&S</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
/* ── SANOFI DESIGN TOKENS ── */
:root {
  --violet:        #7a00e6;
  --violet-light:  #9b33ff;
  --violet-dark:   #5200a8;
  --violet-hero:   #14002d;
  --violet-bg:     #f7f2ff;
  --violet-border: #ddc5ff;
  --violet-mid:    #b066ff;
  --blue:          #0047bb;
  --blue-light:    #3b7cff;
  --blue-bg:       #eef4ff;
  --blue-border:   #bccfff;
  --black:         #0a0014;
  --text:          #1c1240;
  --text-2:        #3d3058;
  --muted:         #756f8a;
  --border:        #e8deff;
  --surface:       #fafafa;
  --tint:          #f7f2ff;
  --white:         #ffffff;
  --stage:         1300px;  /* centered-stage max content width (full-screen fix) */
  --success:       #00875a;  --success-bg: #e6f6f0;
  --warning:       #b35c00;  --warning-bg: #fff3e0;
  --danger:        #cc0035;  --danger-bg:  #ffebf0;
  --font:   "DM Sans",  "Helvetica Neue", Arial, sans-serif;
  --mono:   "DM Mono",  "Fira Code", monospace;
}

/* ── RESET & BASE ── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font); background: var(--surface); color: var(--text); overflow: hidden; height: 100vh; -webkit-font-smoothing: antialiased; }
code, .mono { font-family: var(--mono); }
a { color: inherit; text-decoration: none; }

/* ── SLIDE ENGINE ──
   Full-screen fix: each slide is a centered stage that uses the full viewport
   width, with content capped at --stage and equal side gutters.
   Auto-fit (see <script>) then scales the content up to fill any leftover space. */
.slide { display: none; flex-direction: column; justify-content: center; align-items: center; width: 100vw; height: 100vh; padding: clamp(40px,5.2vh,64px) max(56px, calc((100vw - var(--stage)) / 2)); animation: reveal .4s ease; position: relative; }
.slide.active { display: flex; }
@keyframes reveal { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

/* Auto-fit wrapper: the engine moves each slide's flow content into .fitbox,
   then scales it (1x to 1.5x) to fill the viewport. transform-origin keeps it centered. */
.fitbox { width: 100%; transform-origin: center center; }

/* Full-bleed slides: add class "fullbleed" for edge-to-edge background images.
   These are skipped by the auto-fit engine and lose the stage gutters. */
.slide.fullbleed { padding: 0; align-items: stretch; }

/* ── SHARED TYPOGRAPHY ── */
.eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--violet); margin-bottom: 14px; }
.eyebrow::before { content: ""; width: 16px; height: 2px; background: var(--violet); border-radius: 2px; }
.slide-h2 { font-size: clamp(30px, 3.4vw, 46px); font-weight: 800; color: var(--black); letter-spacing: -1px; line-height: 1.15; margin-bottom: 10px; }
.slide-h2 span { color: var(--violet); }
.slide-lead { font-size: 16px; color: var(--muted); line-height: 1.65; max-width: 700px; margin-bottom: 40px; }

/* ── NAVIGATION ── */
.nav { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; background: var(--white); padding: 9px 18px; border-radius: 40px; box-shadow: 0 6px 24px rgba(26,18,64,.12); border: 1px solid var(--border); z-index: 200; }
.nav button { width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--violet); color: #fff; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s; }
.nav button:hover { background: var(--violet-dark); }
.nav button:disabled { background: var(--border); color: var(--muted); cursor: default; }
.nav .ctr { font-family: var(--mono); font-size: 12px; color: var(--muted); min-width: 52px; text-align: center; }

/* ── PROGRESS BAR ── */
.progress { position: fixed; top: 0; left: 0; height: 3px; background: linear-gradient(90deg, var(--violet), var(--violet-light), var(--blue)); transition: width .4s ease; z-index: 200; }

/* ── WATERMARK ── */
.watermark { position: fixed; bottom: 76px; right: 28px; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(28,18,64,.15); z-index: 100; }
</style>
</head>
<body>

<div class="progress" id="prog"></div>

<!-- ── STARTER SLIDE 1 - HERO ── -->
<!-- Replace this with the real hero slide from slide-patterns.md -->
<div class="slide" data-slide="1" style="background:var(--violet-hero);background-image:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(122,0,230,.5) 0%,transparent 60%);color:var(--white);text-align:center;">
  <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet-mid);margin-bottom:24px;">[PROJECT LABEL]</div>
  <h1 style="font-size:clamp(44px,6vw,80px);font-weight:800;color:var(--white);letter-spacing:-2px;line-height:1.05;margin-bottom:20px;">[Main <em style="font-style:normal;color:var(--violet-light);">Title</em>]</h1>
  <p style="font-size:18px;color:rgba(255,255,255,.65);max-width:600px;margin:0 auto 12px;line-height:1.5;">[Subtitle - the promise of this deck]</p>
  <div style="font-size:12px;color:rgba(255,255,255,.38);margin-top:32px;letter-spacing:1px;">Sanofi M&amp;S &middot; [Team] &middot; [Date]</div>
</div>

<!-- ── STARTER SLIDE 2 - CONTENT (replace with real pattern) ── -->
<div class="slide" data-slide="2" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow]</div>
  <h2 class="slide-h2">Your slide <span>title here</span></h2>
  <p class="slide-lead">[Replace with content from slide-patterns.md]</p>
</div>

<!-- ── NAV ── -->
<div class="nav">
  <button id="prev" onclick="go(-1)" aria-label="prev">&larr;</button>
  <span class="ctr" id="ctr">1 / 2</span>
  <button id="next" onclick="go(1)" aria-label="next">&rarr;</button>
</div>

<div class="watermark">SANOFI M&amp;S</div>

<script>
let cur = 1;
const slides = document.querySelectorAll(".slide");
const total = slides.length;

// ── AUTO-FIT ENGINE ──
// Wrap each slide's flow content into a .fitbox so it can be scaled to fill the
// screen. Slides with class "fullbleed" (edge-to-edge background image) are left
// untouched. Absolutely/fixed positioned elements (logos, pageno, foot, watermark)
// stay outside the box so the scale transform never displaces them.
function wrap(sl) {
  if (sl.classList.contains("fullbleed")) return;
  const cs = getComputedStyle(sl);
  const dir = cs.flexDirection || "column";
  const ai  = cs.alignItems || "center";
  const jc  = cs.justifyContent || "center";
  const gap = cs.gap;
  const box = document.createElement("div");
  box.className = "fitbox";
  box.style.display = "flex";
  box.style.flexDirection = dir;
  box.style.alignItems = ai;
  box.style.justifyContent = dir.startsWith("row") ? jc : "flex-start";
  if (gap && gap !== "normal") box.style.gap = gap;
  const skip = [];
  Array.from(sl.childNodes).forEach(n => {
    if (n.nodeType === 1) {
      const pos = getComputedStyle(n).position;
      if (n.classList.contains("pageno") || n.classList.contains("foot") || n.classList.contains("watermark") || pos === "absolute" || pos === "fixed") { skip.push(n); return; }
    }
    box.appendChild(n);
  });
  sl.appendChild(box);
  skip.forEach(k => sl.appendChild(k));
  sl.style.flexDirection = "column";
  sl.style.justifyContent = "center";
  sl.style.alignItems = (ai === "center" && !dir.startsWith("row")) ? "center" : "stretch";
}

// Scale the active slide's content to fill the viewport (enlarge only, capped at 1.5x).
function fit(sl) {
  if (!sl || sl.classList.contains("fullbleed")) return;
  const box = sl.querySelector(":scope > .fitbox");
  if (!box) return;
  box.style.transform = "none";
  const w = box.offsetWidth, h = box.offsetHeight;
  if (!w || !h) return;
  const availW = sl.clientWidth * 0.96;
  const availH = sl.clientHeight * 0.90;
  let s = Math.min(availW / w, availH / h);
  s = Math.max(1, Math.min(s, 1.5));
  box.style.transform = "scale(" + s + ")";
}

slides.forEach(wrap);

function go(d) {
  const n = cur + d;
  if (n < 1 || n > total) return;
  document.querySelector(`.slide[data-slide="${cur}"]`).classList.remove("active");
  cur = n;
  const s = document.querySelector(`.slide[data-slide="${cur}"]`);
  void s.offsetWidth;
  s.classList.add("active");
  fit(s);
  document.getElementById("ctr").textContent = `${cur} / ${total}`;
  document.getElementById("prev").disabled = cur === 1;
  document.getElementById("next").disabled = cur === total;
  document.getElementById("prog").style.width = `${cur / total * 100}%`;
}

document.addEventListener("keydown", e => {
  if (["ArrowRight"," ","PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
  if (["ArrowLeft","PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
  if (e.key === "Home") { e.preventDefault(); go(1 - cur); }
  if (e.key === "End")  { e.preventDefault(); go(total - cur); }
});

window.addEventListener("resize", () => fit(document.querySelector(`.slide[data-slide="${cur}"]`)));

document.getElementById("prev").disabled = true;
document.getElementById("prog").style.width = `${1 / total * 100}%`;
const first = document.querySelector('.slide[data-slide="1"]');
first.classList.add("active");
fit(first);
setTimeout(() => fit(first), 300);
</script>
</body>
</html>
```
