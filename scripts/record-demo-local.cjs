// Captioned demo of a LOCAL run (RakeLess server + Ollama on the same machine), recorded with Playwright.
// The model wait is cut from the video; its measured duration is shown on screen and written to the evidence file.
//   BASE=http://127.0.0.1:8787 PHOTO=eval/images/e01-nj-lawn-sidewalk.jpg node scripts/record-demo-local.cjs
// Then: OUT=demo-out/local sh scripts/cut-demo.sh   (uses the timestamps in demo-out/local/segments.json)
const fs = require('fs');
const path = require('path');
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || 'playwright'); } })();

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const PHOTO = path.resolve(process.env.PHOTO || 'eval/images/e01-nj-lawn-sidewalk.jpg');
const OUT = path.resolve(process.env.OUT || 'demo-out/local');
const W = 1280, H = 720;
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY = `(() => {
  if (window.__demo) return;
  window.print = () => {};
  const css = document.createElement('style');
  css.textContent = '#demo-cap{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:1000px;padding:12px 22px;border-radius:14px;background:rgba(9,8,7,.9);border:1px solid rgba(255,179,71,.4);color:#f6ead9;font:500 20px/1.35 system-ui,sans-serif;text-align:center;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity .3s}#demo-cap.on{opacity:1}#demo-cap b{color:#ffb347}#demo-cursor{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:rgba(255,179,71,.35);border:2px solid #ffb347;z-index:2147483647;pointer-events:none}canvas{display:none!important}@media print{#demo-cap,#demo-cursor{display:none!important}}';
  document.head.appendChild(css);
  const cap = document.createElement('div'); cap.id = 'demo-cap';
  const cur = document.createElement('div'); cur.id = 'demo-cursor';
  document.body.append(cap, cur);
  addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  window.__demo = { cap(h) { if (!h) return cap.classList.remove('on'); cap.innerHTML = h; cap.classList.add('on'); } };
})();`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce', recordVideo: { dir: OUT, size: { width: W, height: H } }, acceptDownloads: true });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const at = () => (Date.now() - t0) / 1000;
  const cap = (h) => page.evaluate((x) => window.__demo.cap(x), h);
  const glide = async (sel) => {
    const loc = page.locator(sel).first();
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
    return loc;
  };
  const clickOn = async (sel) => { const l = await glide(sel); await wait(250); await l.click(); };

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(OVERLAY);
  const health = await page.evaluate(() => fetch('/api/health').then((r) => r.json()));
  await cap('RakeLess: one photo, nine patches. The model labels each patch; plain rules decide.');
  await wait(3500);
  await page.locator('#try').scrollIntoViewIfNeeded();
  await page.evaluate(OVERLAY);
  await cap(`Model status: <b>${health.model.name}</b> via ${health.model.providerLabel}. Site context: no known concerns.`);
  await clickOn('button[role=radio]:has-text("None known")');
  await wait(2500);
  await page.locator('input[type=file]').first().setInputFiles(PHOTO);
  await page.waitForSelector('.disclosure');
  await glide('.disclosure');
  await cap('A ground-level photo with lawn, a sidewalk and a tree base (CC BY-SA 4.0, Famartin). Before upload, the page says where it goes.');
  await wait(5000);
  await clickOn('button:has-text("Analyze with Gemma")');
  const waitStart = at();
  await cap('Analyzing on this machine’s CPU… (this wait is cut from the video)');
  await page.waitForSelector('.provenance, .error', { timeout: 20 * 60_000 });
  const waitEnd = at();
  await page.evaluate(OVERLAY);
  const err = await page.locator('.error').count();
  if (err) throw new Error(await page.locator('.error').textContent());
  const prov = (await page.locator('.provenance').textContent()).trim();
  await page.locator('.board').scrollIntoViewIfNeeded();
  await cap(`Wait cut: <b>${(waitEnd - waitStart).toFixed(0)} s</b> measured in the browser. Label: ${prov.split('·').slice(0, 2).join('·')}`);
  await wait(6000);
  await cap('I mark the patches I was going to rake: the leafy ground in the bottom two rows.');
  for (const id of (process.env.DEMO_PLAN || 'B2,C1,C2,C3').split(',')) { await clickOn(`.plan-cell:has-text("${id}")`); await wait(350); }
  await wait(1500);
  await glide('.receipt-sum');
  await cap('The receipt compares my plan with the rules. This scene is lawn and sidewalk, so nothing is marked “leave”: a photo cannot show how thick the leaves on a lawn are.');
  await wait(6000);
  // Show one correction of a real model mistake: a canopy cell (top row) reported as ground with leaves.
  const FIX = process.env.DEMO_FIX || 'A2';
  await page.locator('.board-photo').scrollIntoViewIfNeeded();
  await clickOn(`.board-photo .cell[aria-label^="${FIX}:"]`);
  await page.waitForSelector('.inspector');
  const evidence = (await page.locator('.inspector q').textContent()).trim();
  const ground = (await page.locator('.inspector .facts div:nth-child(2) dd').textContent()).trim();
  await glide('.inspector q');
  await cap(`Patch ${FIX}, model said: “${evidence}” (${ground}). This cell is tree canopy, not ground.`);
  await wait(6000);
  if (/Fallen leaves|Unclear/.test(ground)) {
    await clickOn('.inspector [role=radio]:has-text("No leaves on ground")');
    await cap('I correct “on the ground” to <b>No leaves on ground</b>. The rules re-run without another model call; the model’s label is kept beside mine.');
  } else {
    await cap('Here the model already reported no leaves on the ground, so nothing needs correcting.');
  }
  await wait(6500);
  await clickOn('button[aria-label="Close patch details"]');
  await glide('.receipt');
  await cap('The corrected patch drops out of review. Counts are grid cells, not area or time.');
  await wait(5500);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export JSON/ }).click()]);
  await dl.saveAs(path.join(OUT, 'export.json'));
  await cap('Export keeps the provenance, the original labels, my corrections and the receipt. No cloud model was used.');
  await wait(4500);
  await cap('');
  const video = await page.video().path();
  await ctx.close();
  await browser.close();
  const seg = { video: path.relative(process.cwd(), video), waitStart, waitEnd, measuredWaitSeconds: +(waitEnd - waitStart).toFixed(1), provenance: prov, photo: path.relative(process.cwd(), PHOTO), health: health.model, recordedAtUtc: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'segments.json'), JSON.stringify(seg, null, 2));
  console.log(JSON.stringify(seg, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
