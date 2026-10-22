// Browser journey check (Playwright): desktop and mobile, recorded example, plan marking,
// correction, receipt, export, print media, keyboard, readiness note, and console errors.
//   BASE=http://127.0.0.1:8787 node scripts/check-ui.cjs [--upload photo.jpg] [--out dir]
// Exits non-zero on the first failed check. It does not judge model quality.
const fs = require('fs');
const path = require('path');
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || 'playwright'); } })();

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = path.resolve(opt('out') || 'demo-out/check-ui');
const UPLOAD = opt('upload');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const must = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; throw new Error(msg); } log('ok  ', msg); };

async function journey(browser, name, viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  log(`\n== ${name} ${viewport.width}x${viewport.height}`);

  const status = page.locator('.status').first();
  await page.waitForFunction(() => !document.querySelector('.status')?.textContent?.includes('Checking'), null, { timeout: 15000 });
  const statusText = (await status.textContent()).trim();
  log('     model status:', statusText);

  await page.locator('#try').scrollIntoViewIfNeeded();
  const ready = /local|hosted/.test(statusText);
  if (!ready) {
    must(await page.getByRole('button', { name: 'Check again' }).first().isVisible(), 'readiness note offers “Check again” when the model is not ready');
  }
  must(await page.locator('.dz-sub').textContent().then((t) => /Gemini API|Ollama|Checking/.test(t)), 'upload area discloses where the photo goes');

  await page.getByRole('button', { name: /Load the recorded example/ }).click();
  await page.waitForSelector('.provenance');
  const prov = await page.locator('.provenance').textContent();
  must(/RECORDED REPLAY/.test(prov) && !/LIVE MODEL CALL/.test(prov), `recorded run labelled as replay: “${prov.trim().slice(0, 80)}”`);

  // Plan marking with the keyboard: focus C1, press Space; click C2 and C3.
  await page.locator('.plan-cell', { hasText: 'C1' }).focus();
  await page.keyboard.press('Space');
  await page.locator('.plan-cell', { hasText: 'C2' }).click();
  await page.locator('.plan-cell', { hasText: 'C3' }).click();
  must(await page.locator('.plan-cell[aria-pressed="true"]').count() === 3, 'three patches marked as planned (one by keyboard)');
  let sum = await page.locator('.receipt-sum').textContent();
  log('     receipt (concerns not answered):', sum.trim());
  must(/Worth reconsidering: 0/.test(sum), 'with site concerns unresolved, nothing is suggested for leaving');

  await page.getByRole('button', { name: 'None known' }).first().click();
  sum = await page.locator('.receipt-sum').textContent();
  log('     receipt (no concerns):', sum.trim());
  must(/You planned 3/.test(sum) && /Worth reconsidering: 2/.test(sum), 'receipt: 2 of 3 planned patches worth reconsidering');
  must(await page.locator('.rc-group.tone-brick .rc-line').count() >= 1, 'access work stays on the receipt');
  await page.locator('.receipt').screenshot({ path: path.join(OUT, `${name}-receipt-before.png`) });

  // Correct C1 (model said bed; there is lawn by the shed) and watch it move to inspection.
  await page.locator('.rc-id', { hasText: 'C1' }).first().click();
  await page.waitForSelector('.inspector');
  await page.locator('.inspector').getByRole('radio', { name: 'Lawn' }).click();
  must(/Review the lawn/.test(await page.locator('#inspector-title').textContent()), 'correcting C1 to lawn changes it to review');
  must(await page.locator('.compare-vals').isVisible(), 'inspector shows corrected values next to the model’s');
  await page.locator('.inspector').screenshot({ path: path.join(OUT, `${name}-inspector.png`) });
  await page.getByRole('button', { name: 'Close patch details' }).click();
  sum = await page.locator('.receipt-sum').textContent();
  must(/Worth reconsidering: 1/.test(sum) && /Inspect first: 1/.test(sum), 'receipt updated after correction');
  must(/your correction/.test(await page.locator('.receipt').textContent()), 'receipt shows the correction');
  await page.locator('.receipt').screenshot({ path: path.join(OUT, `${name}-receipt-after.png`) });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export JSON/ }).click()]);
  const file = path.join(OUT, `${name}-export.json`);
  await dl.saveAs(file);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  must(doc.runKind.startsWith('RECORDED REPLAY') && doc.provenance.mode === 'recorded', 'export keeps recorded provenance');
  must(doc.originalObservations.find((o) => o.id === 'C1').surface === 'bed_or_tree_base' && doc.userCorrections[0].surface === 'lawn', 'export keeps original and corrected values');
  must(doc.intendedToClear.length === 3 && doc.choreReceipt.reconsider.length === 1, 'export includes the plan and the receipt');

  await page.emulateMedia({ media: 'print' });
  const printText = await page.locator('.print-only').first().innerText();
  must(/Chore receipt/.test(printText) && /RECORDED REPLAY/.test(printText), 'print view includes the receipt and run label');
  if (name === 'desktop') await page.pdf({ path: path.join(OUT, 'print.pdf'), format: 'Letter' });
  await page.emulateMedia({ media: 'screen' });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  must(overflow <= 1, `no horizontal page scroll (overflow ${overflow}px)`);
  await page.locator('.board').screenshot({ path: path.join(OUT, `${name}-board.png`) });

  if (UPLOAD && name === 'desktop') {
    await page.getByRole('button', { name: /Start over/ }).click();
    await page.getByRole('button', { name: 'None known' }).first().click();
    await page.locator('input[type=file]').first().setInputFiles(UPLOAD);
    must(await page.locator('.disclosure').isVisible(), 'disclosure shown before upload');
    log('     disclosure:', (await page.locator('.disclosure').textContent()).trim());
    const t = Date.now();
    await page.getByRole('button', { name: /Analyze with Gemma/ }).click();
    await page.waitForSelector('.provenance, .error', { timeout: 15 * 60_000 });
    const err = await page.locator('.error').count();
    if (err) log('     upload error:', await page.locator('.error').textContent());
    else {
      const p2 = (await page.locator('.provenance').textContent()).trim();
      log(`     live result after ${((Date.now() - t) / 1000).toFixed(1)} s:`, p2);
      must(/LIVE MODEL CALL|CACHED/.test(p2), 'live result labelled as a model call or cache hit');
      await page.locator('.board').screenshot({ path: path.join(OUT, 'live-board.png') });
    }
  }
  must(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  try {
    await journey(browser, 'desktop', { width: 1440, height: 900 });
    await journey(browser, 'mobile', { width: 390, height: 844 });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
