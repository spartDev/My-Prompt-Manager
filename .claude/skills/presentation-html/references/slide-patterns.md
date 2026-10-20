<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Slide Pattern Catalog

**This is an inspiration library, not a constraint.** The agent is free to invent entirely new layouts. These patterns exist as proven starting points - use them, adapt them, combine them, or ignore them entirely. The only constraint is the Sanofi color token set.

Inspired by **Démonstration Complète - Tous les Types de Slides Concierge.pptx** + original innovative patterns.

Each pattern has:
- **When to use** - narrative trigger
- **Visual rhythm** - density/mood indicator
- **HTML** - copy-paste starting point (all CSS inline, all colors via CSS variables)

Colors always reference the CSS variables from `template.md`. Never hardcode hex directly.

---

## 01 - HERO TITLE

**Use**: Opening slide, closing variant. Sets the visual identity of the deck.
**Rhythm**: Spacious · Emotional · Dark

```html
<div class="slide" data-slide="N" style="background:var(--violet-hero);background-image:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(122,0,230,.5) 0%,transparent 60%);color:var(--white);text-align:center;">
  <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet-mid);margin-bottom:24px;">[CONTEXT LABEL - e.g. Sanofi M&S Accelerator]</div>
  <h1 style="font-size:clamp(44px,6vw,80px);font-weight:800;letter-spacing:-2px;line-height:1.05;margin-bottom:20px;">[Main <em style="font-style:normal;color:var(--violet-light);">Keyword</em>]</h1>
  <p style="font-size:18px;color:rgba(255,255,255,.65);max-width:580px;margin:0 auto 12px;line-height:1.5;">[One-sentence subtitle that sets up the deck's promise]</p>
  <div style="font-size:12px;color:rgba(255,255,255,.38);margin-top:32px;letter-spacing:1px;">Sanofi M&amp;S &middot; [Team] &middot; [Date]</div>
</div>
```

---

## 02 - SECTION DIVIDER

**Use**: Chapter markers. Resets audience attention. "01 / N" mono label names the section.
**Rhythm**: Minimal · Spacious · Light

```html
<div class="slide" data-slide="N" style="background:var(--tint);text-align:center;">
  <div style="font-family:var(--mono);font-size:13px;letter-spacing:4px;color:var(--violet);font-weight:500;margin-bottom:20px;">0N / [TOTAL]</div>
  <h2 style="font-size:clamp(38px,5vw,68px);font-weight:800;color:var(--black);letter-spacing:-2px;line-height:1.1;max-width:880px;">[Section title with one <span style="color:var(--violet);">word</span> in violet]</h2>
</div>
```

---

## 03 - TEXT + VISUAL SPLIT (60/40)

**Use**: A key concept paired with a strong visual (circular image, SVG, screenshot). Good for product intros.
**Rhythm**: Balanced · Medium density

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;flex-direction:row;gap:60px;">
  <div style="flex:1.2;display:flex;flex-direction:column;justify-content:center;">
    <div class="eyebrow">[Eyebrow]</div>
    <h2 class="slide-h2">[Title with <span>violet word</span>]</h2>
    <p style="font-size:15px;color:var(--text-2);line-height:1.65;max-width:560px;">[Body text. 2-4 sentences. Specific and concrete.]</p>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;">
    <div style="width:340px;height:340px;border-radius:50%;background:var(--tint);border:1px solid var(--violet-border);display:flex;align-items:center;justify-content:center;overflow:hidden;">
      <!-- Replace with <img src="..." style="width:100%;height:100%;object-fit:cover;"> or inline SVG -->
      <span style="font-size:80px;">🔮</span>
    </div>
  </div>
</div>
```

---

## 04 - TWO-COLUMN COMPARISON

**Use**: Before / After, A vs B, Current vs Target, Problem vs Solution.
**Rhythm**: Structured · Dense · Analytical

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow]</div>
  <h2 class="slide-h2">[Before and <span>after</span>]</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;width:100%;max-width:1000px;">
    <div style="background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--muted);border-radius:12px;padding:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:14px;">[Column A label]</div>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:10px;">
        <li style="font-size:14px;color:var(--text-2);display:flex;gap:10px;align-items:baseline;"><span style="color:var(--danger);font-weight:700;flex-shrink:0;">✗</span>[Point one]</li>
        <li style="font-size:14px;color:var(--text-2);display:flex;gap:10px;align-items:baseline;"><span style="color:var(--danger);font-weight:700;flex-shrink:0;">✗</span>[Point two]</li>
        <li style="font-size:14px;color:var(--text-2);display:flex;gap:10px;align-items:baseline;"><span style="color:var(--danger);font-weight:700;flex-shrink:0;">✗</span>[Point three]</li>
      </ul>
    </div>
    <div style="background:var(--violet-bg);border:1px solid var(--violet-border);border-top:3px solid var(--violet);border-radius:12px;padding:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--violet);margin-bottom:14px;">[Column B label]</div>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:10px;">
        <li style="font-size:14px;color:var(--text-2);display:flex;gap:10px;align-items:baseline;"><span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>[Point one]</li>
        <li style="font-size:14px;color:var(--text-2);display:flex;gap:10px;align-items:baseline;"><span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>[Point two]</li>
        <li style="font-size:14px;color:var(--text-2);display:flex;gap:10px;align-items:baseline;"><span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>[Point three]</li>
      </ul>
    </div>
  </div>
</div>
```

---

## 05 - FEATURE LIST WITH SIDE ACCENT

**Use**: 3 features/benefits on the right side with icon + title + body, full-width text panel on the left. Good for product feature slides.
**Rhythm**: Dense · Asymmetric · Detailed

```html
<div class="slide" data-slide="N" style="background:var(--white);flex-direction:row;align-items:stretch;padding:0;gap:0;">
  <div style="flex:1;background:var(--violet-hero);padding:60px 48px;display:flex;flex-direction:column;justify-content:center;background-image:radial-gradient(ellipse 60% 80% at 0% 0%,rgba(122,0,230,.35) 0%,transparent 60%);">
    <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet-mid);margin-bottom:16px;">[Eyebrow]</div>
    <h2 style="font-size:clamp(28px,3vw,42px);font-weight:800;color:var(--white);letter-spacing:-1px;line-height:1.15;margin-bottom:20px;">[Left panel <em style="font-style:normal;color:var(--violet-light);">headline</em>]</h2>
    <p style="font-size:15px;color:rgba(255,255,255,.65);line-height:1.65;">[Supporting paragraph. 2-3 sentences.]</p>
  </div>
  <div style="flex:1;padding:60px 48px;display:flex;flex-direction:column;justify-content:center;gap:28px;border-left:1px solid var(--border);">
    <div style="display:flex;align-items:flex-start;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">&#x1F3AF;</div>
      <div><div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:4px;">[Feature 1 title]</div><div style="font-size:13px;color:var(--text-2);line-height:1.55;">[Short description, 1-2 lines max.]</div></div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">&#x26A1;</div>
      <div><div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:4px;">[Feature 2 title]</div><div style="font-size:13px;color:var(--text-2);line-height:1.55;">[Short description.]</div></div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">&#x1F4A1;</div>
      <div><div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:4px;">[Feature 3 title]</div><div style="font-size:13px;color:var(--text-2);line-height:1.55;">[Short description.]</div></div>
    </div>
  </div>
</div>
```

---

## 06 - 3-CARD GRID (equal columns)

**Use**: Three parallel concepts, pillars, or modules. Symmetric, clean.
**Rhythm**: Balanced · Medium · Structured

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow]</div>
  <h2 class="slide-h2">[Three <span>pillars</span>]</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;width:100%;max-width:1040px;">
    <div style="background:var(--white);border:1px solid var(--border);border-top:3px solid var(--violet);border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(26,18,64,.05);">
      <div style="font-size:28px;margin-bottom:14px;">&#x1F4C4;</div>
      <div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:8px;">[Card 1 title]</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.6;">[Card 1 body. 1-2 sentences.]</div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-top:3px solid var(--violet);border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(26,18,64,.05);">
      <div style="font-size:28px;margin-bottom:14px;">&#x26A1;</div>
      <div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:8px;">[Card 2 title]</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.6;">[Card 2 body.]</div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-top:3px solid var(--violet);border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(26,18,64,.05);">
      <div style="font-size:28px;margin-bottom:14px;">&#x1F4A1;</div>
      <div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:8px;">[Card 3 title]</div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.6;">[Card 3 body.]</div>
    </div>
  </div>
</div>
```

---

## 07 - HUB & WHEEL (4 nodes)

**Use**: A central concept connected to 4 surrounding areas. Good for ecosystems, platforms, frameworks.
**Rhythm**: Visual · Structural · Impactful

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;flex-direction:row;gap:56px;">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
    <div class="eyebrow">[Eyebrow]</div>
    <h2 class="slide-h2">[One <span>central</span> concept]</h2>
    <p style="font-size:15px;color:var(--text-2);line-height:1.65;max-width:460px;">[Context paragraph explaining the ecosystem or framework.]</p>
  </div>
  <div style="flex:1.1;display:flex;align-items:center;justify-content:center;">
    <!-- CSS Hub & Wheel -->
    <div style="position:relative;width:420px;height:420px;">
      <!-- Center -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:110px;height:110px;border-radius:50%;background:var(--violet);display:flex;align-items:center;justify-content:center;z-index:2;box-shadow:0 0 0 8px rgba(122,0,230,.15);">
        <div style="text-align:center;color:white;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">[Center<br>label]</div>
      </div>
      <!-- Connecting lines -->
      <svg style="position:absolute;inset:0;width:100%;height:100%;z-index:1;" viewBox="0 0 420 420">
        <line x1="210" y1="210" x2="210" y2="70"  stroke="var(--violet-border)" stroke-width="1.5" stroke-dasharray="4 4"/>
        <line x1="210" y1="210" x2="350" y2="210" stroke="var(--violet-border)" stroke-width="1.5" stroke-dasharray="4 4"/>
        <line x1="210" y1="210" x2="210" y2="350" stroke="var(--violet-border)" stroke-width="1.5" stroke-dasharray="4 4"/>
        <line x1="210" y1="210" x2="70"  y2="210" stroke="var(--violet-border)" stroke-width="1.5" stroke-dasharray="4 4"/>
      </svg>
      <!-- Node top -->
      <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:var(--violet-bg);border:1px solid var(--violet-border);border-radius:12px;padding:12px 16px;text-align:center;min-width:120px;z-index:3;">
        <div style="font-size:13px;font-weight:700;color:var(--violet);">[Node 1]</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">[Sub-label]</div>
      </div>
      <!-- Node right -->
      <div style="position:absolute;top:50%;right:10px;transform:translateY(-50%);background:var(--violet-bg);border:1px solid var(--violet-border);border-radius:12px;padding:12px 16px;text-align:center;min-width:120px;z-index:3;">
        <div style="font-size:13px;font-weight:700;color:var(--violet);">[Node 2]</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">[Sub-label]</div>
      </div>
      <!-- Node bottom -->
      <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:var(--violet-bg);border:1px solid var(--violet-border);border-radius:12px;padding:12px 16px;text-align:center;min-width:120px;z-index:3;">
        <div style="font-size:13px;font-weight:700;color:var(--violet);">[Node 3]</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">[Sub-label]</div>
      </div>
      <!-- Node left -->
      <div style="position:absolute;top:50%;left:10px;transform:translateY(-50%);background:var(--violet-bg);border:1px solid var(--violet-border);border-radius:12px;padding:12px 16px;text-align:center;min-width:120px;z-index:3;">
        <div style="font-size:13px;font-weight:700;color:var(--violet);">[Node 4]</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">[Sub-label]</div>
      </div>
    </div>
  </div>
</div>
```

---

## 08 - KPI DASHBOARD (6 cells, 2×3 grid)

**Use**: Multiple KPIs on a single slide. Icon + number + label per cell.
**Rhythm**: Dense · Data-forward · Impactful

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow - e.g. Key Results 2026]</div>
  <h2 class="slide-h2">[The metrics that <span>matter</span>]</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:100%;max-width:1000px;">
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px 20px;display:flex;align-items:center;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F4C8;</div>
      <div><div style="font-family:var(--mono);font-size:28px;font-weight:800;color:var(--violet);letter-spacing:-1px;line-height:1;">[+42%]</div><div style="font-size:12px;color:var(--muted);margin-top:3px;">[Metric label]</div></div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px 20px;display:flex;align-items:center;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F30D;</div>
      <div><div style="font-family:var(--mono);font-size:28px;font-weight:800;color:var(--violet);letter-spacing:-1px;line-height:1;">[120+]</div><div style="font-size:12px;color:var(--muted);margin-top:3px;">[Metric label]</div></div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px 20px;display:flex;align-items:center;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x2B50;</div>
      <div><div style="font-family:var(--mono);font-size:28px;font-weight:800;color:var(--violet);letter-spacing:-1px;line-height:1;">[95%]</div><div style="font-size:12px;color:var(--muted);margin-top:3px;">[Metric label]</div></div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px 20px;display:flex;align-items:center;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F4B0;</div>
      <div><div style="font-family:var(--mono);font-size:28px;font-weight:800;color:var(--violet);letter-spacing:-1px;line-height:1;">[€4.2B]</div><div style="font-size:12px;color:var(--muted);margin-top:3px;">[Metric label]</div></div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px 20px;display:flex;align-items:center;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F465;</div>
      <div><div style="font-family:var(--mono);font-size:28px;font-weight:800;color:var(--violet);letter-spacing:-1px;line-height:1;">[18.5K]</div><div style="font-size:12px;color:var(--muted);margin-top:3px;">[Metric label]</div></div>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px 20px;display:flex;align-items:center;gap:16px;">
      <div style="width:44px;height:44px;border-radius:10px;background:var(--violet-bg);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F504;</div>
      <div><div style="font-family:var(--mono);font-size:28px;font-weight:800;color:var(--violet);letter-spacing:-1px;line-height:1;">[3.8x]</div><div style="font-size:12px;color:var(--muted);margin-top:3px;">[Metric label]</div></div>
    </div>
  </div>
</div>
```

---

## 09 - BIG STAT (single number, full impact)

**Use**: One decisive number that needs to land. Don't waste it in a grid - isolate it.
**Rhythm**: Punchy · Spacious · Dramatic

```html
<div class="slide" data-slide="N" style="background:var(--violet-hero);color:var(--white);text-align:center;background-image:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(122,0,230,.4) 0%,transparent 70%);">
  <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet-mid);margin-bottom:20px;">[Context label]</div>
  <div style="font-family:var(--mono);font-size:clamp(80px,12vw,150px);font-weight:800;color:var(--white);letter-spacing:-4px;line-height:1;">[VALUE]</div>
  <div style="font-size:22px;color:rgba(255,255,255,.75);margin-top:16px;font-weight:500;">[What this number means]</div>
  <div style="font-size:13px;color:rgba(255,255,255,.35);margin-top:12px;">[Source · Period · Scope]</div>
</div>
```

---

## 10 - HORIZONTAL TIMELINE / ROADMAP

**Use**: Phases over time. Quarter-by-quarter plans, project phases, historical milestones.
**Rhythm**: Sequential · Structured · Temporal

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow - e.g. Strategic Roadmap 2025-2026]</div>
  <h2 class="slide-h2">[Roadmap <span>title</span>]</h2>
  <div style="width:100%;max-width:1040px;position:relative;padding-top:20px;">
    <!-- Connecting line -->
    <div style="position:absolute;top:44px;left:0;right:0;height:2px;background:var(--border);"></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;position:relative;z-index:1;">
      <div>
        <div style="width:28px;height:28px;border-radius:50%;background:var(--violet);margin:0 auto 16px;border:3px solid var(--white);box-shadow:0 0 0 2px var(--violet);"></div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--violet);letter-spacing:1px;margin-bottom:6px;">[Q1 2025]</div>
          <div style="font-size:14px;font-weight:700;color:var(--black);margin-bottom:6px;">[Phase name]</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.5;">[Short description of deliverables in this phase.]</div>
        </div>
      </div>
      <div>
        <div style="width:28px;height:28px;border-radius:50%;background:var(--violet);margin:0 auto 16px;border:3px solid var(--white);box-shadow:0 0 0 2px var(--violet);"></div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--violet);letter-spacing:1px;margin-bottom:6px;">[Q2 2025]</div>
          <div style="font-size:14px;font-weight:700;color:var(--black);margin-bottom:6px;">[Phase name]</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.5;">[Short description.]</div>
        </div>
      </div>
      <div>
        <div style="width:28px;height:28px;border-radius:50%;background:var(--violet-border);margin:0 auto 16px;border:3px solid var(--white);box-shadow:0 0 0 2px var(--violet-border);"></div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:6px;">[Q3 2025]</div>
          <div style="font-size:14px;font-weight:700;color:var(--black);margin-bottom:6px;">[Phase name]</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.5;">[Short description.]</div>
        </div>
      </div>
      <div>
        <div style="width:28px;height:28px;border-radius:50%;background:var(--border);margin:0 auto 16px;border:3px solid var(--white);box-shadow:0 0 0 2px var(--border);"></div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:6px;">[Q4 2025]</div>
          <div style="font-size:14px;font-weight:700;color:var(--muted);margin-bottom:6px;">[Phase name]</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5;">[Short description.]</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 11 - PROCESS FLOW (horizontal chevrons)

**Use**: A linear process with 3-5 steps, especially when the sequence matters. Analysis → Design → Build → Test pattern.
**Rhythm**: Sequential · Action-oriented · Energetic

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow]</div>
  <h2 class="slide-h2">[Process <span>flow</span> title]</h2>
  <div style="display:flex;align-items:stretch;gap:0;width:100%;max-width:1040px;">
    <div style="flex:1;background:var(--violet);clip-path:polygon(0 0,calc(100% - 20px) 0,100% 50%,calc(100% - 20px) 100%,0 100%);padding:24px 40px 24px 28px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.6);margin-bottom:6px;">01</div>
      <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px;">[Step 1]</div>
      <div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.4;">[Short action]</div>
    </div>
    <div style="flex:1;background:var(--violet-dark);clip-path:polygon(0 0,calc(100% - 20px) 0,100% 50%,calc(100% - 20px) 100%,0 100%,20px 50%);padding:24px 40px 24px 40px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.6);margin-bottom:6px;">02</div>
      <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px;">[Step 2]</div>
      <div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.4;">[Short action]</div>
    </div>
    <div style="flex:1;background:var(--blue);clip-path:polygon(0 0,calc(100% - 20px) 0,100% 50%,calc(100% - 20px) 100%,0 100%,20px 50%);padding:24px 40px 24px 40px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.6);margin-bottom:6px;">03</div>
      <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px;">[Step 3]</div>
      <div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.4;">[Short action]</div>
    </div>
    <div style="flex:1;background:var(--blue-light);clip-path:polygon(0 0,100% 0,100% 100%,0 100%,20px 50%);padding:24px 28px 24px 40px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.6);margin-bottom:6px;">04</div>
      <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px;">[Step 4]</div>
      <div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.4;">[Short action]</div>
    </div>
  </div>
</div>
```

---

## 12 - NARRATIVE FLOW (scenario + labeled steps)

**Use**: "Here's what it looks like in practice." The most persuasive pattern. Dark header sets up a scenario, then labeled items walk through the interaction.
**Rhythm**: Cinematic · Narrative · Concrete

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[In practice]</div>
  <h2 class="slide-h2">[Scenario: <span>specific example</span>]</h2>
  <div style="width:100%;max-width:920px;">
    <div style="background:var(--violet-hero);background-image:radial-gradient(ellipse 50% 80% at 0% 0%,rgba(122,0,230,.4) 0%,transparent 60%);border-radius:14px 14px 0 0;padding:22px 32px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet-mid);margin-bottom:8px;">Scenario</div>
      <p style="font-size:15px;color:rgba(255,255,255,.9);line-height:1.55;">[One-paragraph setup. Who, what, context?]</p>
    </div>
    <div style="background:var(--white);border:1px solid var(--border);border-top:none;border-radius:0 0 14px 14px;padding:4px 32px 8px;">
      <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;border-radius:6px;background:var(--violet-bg);color:var(--violet);border:1px solid var(--violet-border);white-space:nowrap;margin-top:1px;flex-shrink:0;">ACTION 1</span>
        <p style="font-size:14px;color:var(--text-2);line-height:1.55;">[What happens first. Quote user input in <em>italics</em> if relevant.]</p>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;border-radius:6px;background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue-border);white-space:nowrap;margin-top:1px;flex-shrink:0;">ACTION 2</span>
        <p style="font-size:14px;color:var(--text-2);line-height:1.55;">[What happens next. System response or processing step.]</p>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 0;">
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;border-radius:6px;background:var(--success-bg);color:var(--success);white-space:nowrap;margin-top:1px;flex-shrink:0;">OUTCOME</span>
        <p style="font-size:14px;color:var(--text-2);line-height:1.55;">[The concrete deliverable produced. What did the user walk away with?]</p>
      </div>
    </div>
  </div>
</div>
```

---

## 13 - QUOTE / PUNCHLINE

**Use**: A single sharp sentence that earns its own slide. Placed mid-deck to reset attention, or before the closing.
**Rhythm**: Minimal · Emotional · Spacious

```html
<div class="slide" data-slide="N" style="background:var(--tint);text-align:center;">
  <div style="width:48px;height:3px;background:var(--violet);border-radius:2px;margin:0 auto 32px;"></div>
  <blockquote style="max-width:860px;font-size:clamp(26px,3.2vw,38px);font-weight:700;color:var(--black);letter-spacing:-0.5px;line-height:1.35;padding:0 20px;">&ldquo;[A single <span style="color:var(--violet);">sharp sentence</span> that captures the essential point of the deck.]&rdquo;</blockquote>
  <div style="margin-top:32px;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:var(--muted);">[Attribution or context]</div>
</div>
```

---

## 14 - DATA TABLE

**Use**: Structured comparative data. Use sparingly - max 5 rows before it becomes unreadable on screen.
**Rhythm**: Dense · Analytical · Informational

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow]</div>
  <h2 class="slide-h2">[Data <span>table</span> title]</h2>
  <div style="width:100%;max-width:1000px;overflow:hidden;border-radius:12px;border:1px solid var(--border);">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:var(--violet-bg);">
          <th style="padding:14px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--violet);border-bottom:2px solid var(--violet-border);">[Column A]</th>
          <th style="padding:14px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--violet);border-bottom:2px solid var(--violet-border);">[Column B]</th>
          <th style="padding:14px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--violet);border-bottom:2px solid var(--violet-border);">[Column C]</th>
          <th style="padding:14px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--violet);border-bottom:2px solid var(--violet-border);">[Column D]</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:13px 18px;font-size:13px;color:var(--text);font-weight:600;">[Row 1A]</td>
          <td style="padding:13px 18px;font-size:13px;color:var(--text-2);">[Row 1B]</td>
          <td style="padding:13px 18px;font-size:13px;color:var(--text-2);">[Row 1C]</td>
          <td style="padding:13px 18px;"><span style="background:var(--success-bg);color:var(--success);font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;">[Status]</span></td>
        </tr>
        <tr style="border-bottom:1px solid var(--border);background:var(--surface);">
          <td style="padding:13px 18px;font-size:13px;color:var(--text);font-weight:600;">[Row 2A]</td>
          <td style="padding:13px 18px;font-size:13px;color:var(--text-2);">[Row 2B]</td>
          <td style="padding:13px 18px;font-size:13px;color:var(--text-2);">[Row 2C]</td>
          <td style="padding:13px 18px;"><span style="background:var(--warning-bg);color:var(--warning);font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;">[Status]</span></td>
        </tr>
        <tr>
          <td style="padding:13px 18px;font-size:13px;color:var(--text);font-weight:600;">[Row 3A]</td>
          <td style="padding:13px 18px;font-size:13px;color:var(--text-2);">[Row 3B]</td>
          <td style="padding:13px 18px;font-size:13px;color:var(--text-2);">[Row 3C]</td>
          <td style="padding:13px 18px;"><span style="background:var(--violet-bg);color:var(--violet);font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;border:1px solid var(--violet-border);">[Status]</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 15 - 2×2 QUADRANT / MATRIX

**Use**: Positioning, prioritization, decision frameworks. Label the 4 quadrants with strategic meaning.
**Rhythm**: Strategic · Visual · Analytical

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;flex-direction:row;gap:60px;">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
    <div class="eyebrow">[Eyebrow]</div>
    <h2 class="slide-h2">[Positioning <span>matrix</span>]</h2>
    <p style="font-size:14px;color:var(--text-2);line-height:1.65;max-width:380px;">[Context explaining what the axes mean and how to read the matrix.]</p>
  </div>
  <div style="flex:1.1;display:flex;align-items:center;justify-content:center;">
    <div style="position:relative;width:440px;height:400px;">
      <!-- Axes -->
      <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--border);"></div>
      <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border);"></div>
      <!-- Axis labels -->
      <div style="position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;">[X-axis label]</div>
      <div style="position:absolute;left:-60px;top:50%;transform:translateY(-50%) rotate(-90deg);font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;">[Y-axis label]</div>
      <!-- Quadrants -->
      <div style="position:absolute;top:0;left:0;width:50%;height:50%;display:flex;align-items:center;justify-content:center;padding:12px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;width:100%;">
          <div style="font-size:13px;font-weight:700;color:var(--muted);">[Q top-left]</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">[sub-label]</div>
        </div>
      </div>
      <div style="position:absolute;top:0;right:0;width:50%;height:50%;display:flex;align-items:center;justify-content:center;padding:12px;">
        <div style="background:var(--violet-bg);border:1px solid var(--violet-border);border-radius:10px;padding:12px;text-align:center;width:100%;">
          <div style="font-size:13px;font-weight:700;color:var(--violet);">[Q top-right ★]</div>
          <div style="font-size:11px;color:var(--violet-dark);margin-top:3px;">[sub-label]</div>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;width:50%;height:50%;display:flex;align-items:center;justify-content:center;padding:12px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;width:100%;">
          <div style="font-size:13px;font-weight:700;color:var(--muted);">[Q bottom-left]</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">[sub-label]</div>
        </div>
      </div>
      <div style="position:absolute;bottom:0;right:0;width:50%;height:50%;display:flex;align-items:center;justify-content:center;padding:12px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;width:100%;">
          <div style="font-size:13px;font-weight:700;color:var(--muted);">[Q bottom-right]</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">[sub-label]</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 16 - TEAM GRID

**Use**: Presenting team members, contributors, or stakeholders.
**Rhythm**: Human · Warm · Relational

```html
<div class="slide" data-slide="N" style="background:var(--white);align-items:flex-start;">
  <div class="eyebrow">[Eyebrow - e.g. The Team]</div>
  <h2 class="slide-h2">[The people <span>behind it</span>]</h2>
  <div style="display:flex;gap:28px;flex-wrap:wrap;max-width:1000px;">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px 28px;display:flex;align-items:center;gap:18px;min-width:280px;">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--violet-bg);border:2px solid var(--violet-border);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F464;</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--black);">[Name]</div>
        <div style="font-size:13px;color:var(--violet);font-weight:600;margin-top:2px;">[Role]</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">[Team / Scope]</div>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px 28px;display:flex;align-items:center;gap:18px;min-width:280px;">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--violet-bg);border:2px solid var(--violet-border);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F464;</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--black);">[Name]</div>
        <div style="font-size:13px;color:var(--violet);font-weight:600;margin-top:2px;">[Role]</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">[Team / Scope]</div>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px 28px;display:flex;align-items:center;gap:18px;min-width:280px;">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--violet-bg);border:2px solid var(--violet-border);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">&#x1F464;</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--black);">[Name]</div>
        <div style="font-size:13px;color:var(--violet);font-weight:600;margin-top:2px;">[Role]</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">[Team / Scope]</div>
      </div>
    </div>
  </div>
</div>
```

---

## 17 - CLOSING / THANK YOU

**Use**: Last slide. Mirror the hero's visual language. End with a clear call to action.
**Rhythm**: Spacious · Hopeful · Dark

```html
<div class="slide" data-slide="N" style="background:var(--violet-hero);background-image:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(122,0,230,.45) 0%,transparent 60%);color:var(--white);text-align:center;">
  <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet-mid);margin-bottom:24px;">Thank you</div>
  <h1 style="font-size:clamp(44px,6vw,80px);font-weight:800;letter-spacing:-2px;line-height:1.05;margin-bottom:20px;">Let&rsquo;s <em style="font-style:normal;color:var(--violet-light);">make it happen</em></h1>
  <p style="font-size:17px;color:rgba(255,255,255,.65);max-width:560px;margin:0 auto 12px;line-height:1.55;">[Call to action - next step, decision needed, or contact]</p>
  <div style="font-size:12px;color:rgba(255,255,255,.35);margin-top:32px;letter-spacing:1px;">[Contact info or follow-up context]</div>
</div>
```

---

## Quick decision guide

| Situation | Pattern |
|---|---|
| Opening the deck | 01 Hero |
| Chapter transition | 02 Section Divider |
| Introducing a product/concept with visual | 03 Text + Visual Split |
| Problem vs solution | 04 Two-column Comparison |
| Feature list with explanation | 05 Feature List with Side Accent |
| Three equal pillars or modules | 06 3-Card Grid |
| Platform / ecosystem with a center | 07 Hub & Wheel |
| Multiple KPIs in one slide | 08 KPI Dashboard |
| One decisive number | 09 Big Stat |
| Phases over time | 10 Horizontal Timeline |
| Step-by-step process | 11 Process Flow (chevrons) |
| Concrete "in practice" walkthrough | 12 Narrative Flow |
| Emotional reset or thesis | 13 Quote / Punchline |
| Structured comparison data | 14 Data Table |
| Strategic positioning | 15 2×2 Quadrant |
| Presenting contributors | 16 Team Grid |
| Last slide | 17 Closing |
