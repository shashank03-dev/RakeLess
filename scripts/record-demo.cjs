// End-to-end demo recording of https://rakeless.vercel.app, following DEMO-SCRIPT.md.
// Drives the live site with Playwright, overlays captions and a visible cursor, makes one real
// Gemma call on a fresh photo, and shows the real print output (needs pdftoppm and ffmpeg).
//   node scripts/record-demo.cjs        → demo-out/*.webm, then encode with ffmpeg (see README)
const path = require('path');
const fs = require('fs');
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || 'playwright'); } })();

const ROOT = path.join(__dirname, '..');
const DIR = path.resolve(process.env.OUT || path.join(ROOT, 'demo-out'));
fs.mkdirSync(DIR, { recursive: true });
const URL = process.env.DEMO_URL || 'https://rakeless.vercel.app';
const W = 1600, H = 900;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY = `
(() => {
  if (window.__demo) return;
  window.print = () => {};
  const css = document.createElement('style');
  css.textContent = \`
    #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(255,179,71,.35);border:2px solid #ffb347;box-shadow:0 0 18px rgba(255,122,47,.7);
      z-index:2147483647;pointer-events:none;transition:transform .12s ease, background .12s;}
    #demo-cursor.down{transform:scale(.7);background:rgba(255,179,71,.8)}
    #demo-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(10px);max-width:960px;
      padding:14px 26px;border-radius:16px;background:rgba(9,8,7,.86);border:1px solid rgba(255,179,71,.35);
      color:#f6ead9;font:500 21px/1.35 'Instrument Sans',system-ui,sans-serif;text-align:center;
      box-shadow:0 18px 50px rgba(0,0,0,.55);backdrop-filter:blur(8px);z-index:2147483646;pointer-events:none;
      opacity:0;transition:opacity .35s ease, transform .35s ease;}
    #demo-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
    #demo-cap b{color:#ffb347;font-weight:600}
    #demo-card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
      background:radial-gradient(ellipse at 50% 40%,#2a1408 0%,#090807 65%);color:#f6ead9;z-index:2147483645;
      font-family:'Instrument Sans',system-ui,sans-serif;opacity:0;transition:opacity .5s ease;pointer-events:none;text-align:center}
    #demo-card.on{opacity:1}
    #demo-card h1{margin:0;font-size:84px;letter-spacing:-.03em;font-weight:600}
    #demo-card h1 em{font-family:'Fraunces Variable',Georgia,serif;font-weight:400;color:#ffb347}
    #demo-card p{margin:0;font-size:30px;color:#cdbca6}
    #demo-card code{font-family:'IBM Plex Mono',monospace;font-size:24px;color:#a6d86a}
    #demo-print{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;gap:48px;
      background:radial-gradient(ellipse at 50% 30%,#2a1a10 0%,#0b0907 70%);z-index:2147483644;opacity:0;transition:opacity .5s;pointer-events:none}
    #demo-print.on{opacity:1}
    #demo-print img{height:auto;max-height:720px;max-width:42vw;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(30px) rotate(-2deg);transition:transform 1.2s cubic-bezier(.16,1,.3,1)}
    #demo-print img+img{transform:translateY(30px) rotate(2deg)}
    #demo-print.on img{transform:translateY(-20px) rotate(-1.2deg)} #demo-print.on img+img{transform:translateY(-20px) rotate(1.2deg)}
    @media print{#demo-cap,#demo-cursor,#demo-card,#demo-print{display:none!important}}
  \`;
  document.head.appendChild(css);
  const cur = document.createElement('div'); cur.id = 'demo-cursor';
  const cap = document.createElement('div'); cap.id = 'demo-cap';
  const card = document.createElement('div'); card.id = 'demo-card';
  document.body.append(card, cap, cur);
  addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => cur.classList.add('down'), true);
  addEventListener('mouseup', () => cur.classList.remove('down'), true);
  window.__demo = {
    cap(html) { if (!html) { cap.classList.remove('on'); return; } cap.innerHTML = html; cap.classList.add('on'); },
    print(srcs) { let el = document.getElementById('demo-print'); if (!srcs) { el && el.classList.remove('on'); return; }
      if (!el) { el = document.createElement('div'); el.id = 'demo-print'; document.body.appendChild(el); }
      el.innerHTML = srcs.map((s) => '<img src="' + s + '">').join(''); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on'))); },
    card(html) { if (!html) { card.classList.remove('on'); return; } card.innerHTML = html; card.classList.add('on'); },
  };
})();
`;

let mx = W / 2, my = H / 2;
async function moveTo(page, x, y, ms = 700) {
  const sx = mx, sy = my, start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
    if (t >= 1) break;
    await wait(12);
  }
  mx = x; my = y;
}
async function click(page, locator, ms = 700) {
  const loc = page.locator(locator).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('No box for ' + locator);
  await moveTo(page, b.x + b.width / 2, b.y + b.height / 2, ms);
  await page.mouse.down(); await wait(90); await page.mouse.up();
  await wait(250);
}
async function smoothScrollTo(page, selector, offset = 0, ms = 1400) {
  await page.evaluate(async ([sel, off, dur]) => {
    const el = document.querySelector(sel);
    const target = el.getBoundingClientRect().top + scrollY - off;
    const start = scrollY, t0 = performance.now();
    await new Promise((res) => {
      const f = (now) => {
        const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        scrollTo(0, start + (target - start) * e);
        t < 1 ? requestAnimationFrame(f) : res();
      };
      requestAnimationFrame(f);
    });
  }, [selector, offset, ms]);
}
const cap = (page, html) => page.evaluate((h) => window.__demo.cap(h), html);
const card = (page, html) => page.evaluate((h) => window.__demo.card(h), html);

(async () => {
  // A fresh, never-seen photo each run (mirrored + slightly different crop) so the live step is a real model call, not a cache hit.
  const sharp = require('sharp');
  const src = path.join(ROOT, 'public/examples/fallen-leaves.jpg');
  const dx = 60 + Math.floor(Math.random() * 80), dy = 80 + Math.floor(Math.random() * 60);
  await sharp(src).flop().extract({ left: dx, top: dy, width: 1536 - dx - 40, height: 1152 - dy - 30 }).jpeg({ quality: 88 }).toFile(path.join(DIR, 'my-yard.jpg'));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: DIR, size: { width: W, height: H } },
    colorScheme: 'dark',
  });
  await ctx.addInitScript(`addEventListener('DOMContentLoaded', () => { ${OVERLAY} })`);
  const page = await ctx.newPage();
  const marks = [];
  const t0 = Date.now();
  const mark = (name) => { marks.push([name, (Date.now() - t0) / 1000]); console.log(name, ((Date.now() - t0) / 1000).toFixed(1)); };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  mark('loaded');

  // Title card
  await card(page, `<h1>Rake<em>Less</em></h1><p>Leave the leaves. Clear the paths. One photo, nine patches.</p><code>Gemma 4 open weights · 8 readable rules</code>`);
  await wait(3200);
  await card(page, '');
  await wait(1800); // let the hero animate in under the card fade
  mark('hero');

  // 0–7 s: landing page
  await moveTo(page, W * 0.55, H * 0.45, 900);
  await cap(page, 'I was about to rake <b>everything</b>. Some of that work may be unnecessary.');
  await moveTo(page, W * 0.72, H * 0.38, 1400);
  await wait(1600);

  // 7–18 s: hero map, recorded run label
  await smoothScrollTo(page, '.hero-stage', 90, 1300);
  await cap(page, 'This is a saved, <b>real</b> Gemma 4 run. The colors are suggestions and review flags, not surveyed boundaries.');
  const recBox = await page.locator('.hero .window-url').boundingBox();
  if (recBox) await moveTo(page, recBox.x + 60, recBox.y + recBox.height / 2, 900);
  await wait(2600);
  mark('hero-cells');

  // 18–30 s: click C2, then C3
  await cap(page, '<b>Leave this patch for now</b>: here is what the model saw…');
  await click(page, '.hero .cell[aria-label^="C2:"]', 800);
  await wait(3000);
  await cap(page, '…but <b>still clear this lane</b>. Every call cites its reason.');
  await click(page, '.hero .cell[aria-label^="C3:"]', 700);
  await wait(3000);
  mark('workbench');

  // 30–40 s: workbench, recorded example, correct C1 to Lawn
  await cap(page, '');
  await smoothScrollTo(page, '#try', 20, 1500);
  await wait(500);
  await cap(page, 'In the workbench, set the site context and load the <b>recorded example</b>. No model call.');
  await click(page, '[role="radiogroup"][aria-labelledby="concerns-l"] [role="radio"]:has-text("None known")', 900);
  await wait(700);
  await click(page, 'button.link-btn.strong', 900);
  await page.locator('.board .cell').first().waitFor();
  await wait(800);
  await smoothScrollTo(page, '.board', 30, 1200);
  await wait(1600);
  await cap(page, 'The model called C1 a bed, but there is <b>lawn</b> by the shed. I correct it…');
  await click(page, '.board-photo .cell[aria-label^="C1:"]', 800);
  await wait(1400);
  await smoothScrollTo(page, '.board', -250, 900);
  await wait(300);
  await click(page, '.board-side [role="radiogroup"][aria-label="Surface"] [role="radio"]:has-text("Lawn")', 800);
  await wait(500);
  await cap(page, '…and the suggestion updates instantly. <b>No photo is sent again.</b>');
  const c1 = await page.locator('.board-photo .cell[aria-label^="C1:"]').boundingBox();
  if (c1) await moveTo(page, c1.x + c1.width / 2, c1.y + c1.height / 2, 900);
  await wait(3000);
  mark('live');

  // 40–50 s: a new photo, live stages + elapsed timer (not cut)
  await cap(page, 'Now a <b>live</b> run on a new photo. The real wait is shown with its timer, not cut.');
  await click(page, '.toolbar button:has-text("Start over")', 900);
  await page.evaluate(() => scrollTo(0, document.querySelector('#try').getBoundingClientRect().top + scrollY - 20));
  await wait(600);
  await click(page, '[role="radiogroup"][aria-labelledby="concerns-l"] [role="radio"]:has-text("None known")', 800);
  await wait(400);
  const choose = page.locator('.dropzone button:has-text("Choose photo")');
  const cb = await choose.boundingBox();
  await moveTo(page, cb.x + cb.width / 2, cb.y + cb.height / 2, 800);
  await page.locator('.dropzone input[type=file]:not([capture])').setInputFiles(path.join(DIR, 'my-yard.jpg'));
  await wait(1200);
  await click(page, 'button:has-text("Analyze with Gemma")', 800);
  mark('analyze-start');
  await page.locator('.stages').waitFor();
  await smoothScrollTo(page, '.steps', 150, 700);
  const st = await page.locator('.stages').boundingBox();
  if (st) await moveTo(page, st.x + st.width * 0.6, st.y + st.height + 30, 800);
  await page.locator('.board .provenance, .workbench .error').first().waitFor({ timeout: 90_000 });
  if (await page.locator('.workbench .error').count()) { console.log('ERROR:', await page.locator('.workbench .error').innerText()); process.exit(2); }
  mark('analyze-done');
  await wait(600);
  await smoothScrollTo(page, '.board', 30, 1100);
  const prov = await page.locator('.board .provenance').innerText();
  console.log('provenance:', prov);
  const live = /LIVE RUN/.test(prov) && !/CACHED/.test(prov);
  await cap(page, live ? 'A fresh <b>LIVE</b> Gemma 4 answer: nine patches, each with a reason.' : 'Gemma 4 answer: nine patches, each with a reason.');
  const prb = await page.locator('.board .provenance').boundingBox();
  await moveTo(page, prb.x + 120, prb.y + prb.height / 2, 900);
  await wait(3500);
  await click(page, '.board-photo .cell[aria-label^="A1:"]', 900).catch(() => {});
  await wait(2400);
  mark('print');

  // 50–60 s: print plan + yard sign
  const close = page.locator('button[aria-label="Close patch details"]');
  if (await close.count()) await click(page, 'button[aria-label="Close patch details"]', 600);
  await cap(page, 'Print the plan, with the optional <b>yard sign</b> page: less leaf clearing, a reason for every skipped patch.');
  await click(page, '.toolbar button:has-text("Print plan")', 800).catch(() => {});
  // The real print output of this exact run, rendered by Chromium's print engine.
  const pdf = path.join(DIR, 'plan.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true });
  require('child_process').execFileSync('pdftoppm', ['-r', '110', '-png', pdf, path.join(DIR, 'plan')]);
  const pngs = require('fs').readdirSync(DIR).filter((f) => /^plan-\d+\.png$/.test(f)).sort()
    .map((f) => 'data:image/png;base64,' + require('fs').readFileSync(path.join(DIR, f)).toString('base64'));
  console.log('print pages', pngs.length);
  await page.evaluate((s) => window.__demo.print(s), pngs);
  await wait(5500);
  await cap(page, '');
  // End card
  await card(page, `<h1>Rake<em>Less</em></h1><p>Less raking, with a reason for every patch you skip.</p><code>rakeless.vercel.app · github.com/shashank03-dev/RakeLess</code>`);
  await wait(4200);
  mark('end');

  const video = page.video();
  await ctx.close();
  await browser.close();
  const raw = await video.path();
  require('fs').writeFileSync(path.join(DIR, 'marks.json'), JSON.stringify({ raw, marks }, null, 2));
  console.log('raw video', raw);
})().catch((e) => { console.error(e); process.exit(1); });
