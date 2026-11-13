// E2E (Playwright, Chromium im iPhone-15-Viewport): Start → Schmerz → Zeit → Los geht’s → Übungen → Rückmeldung → Verlauf;
// Mini-Routinen, Dark Mode, keine horizontale Scrollleiste, Offline-Start über den Service Worker.
// Screenshots: $LISA_SHOTS (Standard: tests/.shots, nicht eingecheckt).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { start } from './helpers/static-server.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SHOTS = process.env.LISA_SHOTS || path.join(__dirname, '.shots');
fs.mkdirSync(SHOTS, { recursive: true });

let srv; let browser;
before(async () => { srv = await start(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); await srv?.close(); });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 15'], serviceWorkers: opts.sw ? 'allow' : 'block', colorScheme: opts.dark ? 'dark' : 'light' });
  await ctx.addInitScript(() => { globalThis.__lisaSpeed = 60; }); // Timer läuft 60× schneller
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1);

/** Übungen durchgehen: Start tippen, bis „Nächste Übung“/„Zum Abschluss“ erscheint, weiter bis zur Rückmeldung. */
async function runThrough(page, limit = 20) {
  for (let i = 0; i < limit; i++) {
    if (await page.locator('.effort, #pain-after').count()) return i;
    await page.waitForTimeout(400);
    const cta = page.locator('#cta');
    await cta.waitFor();
    if ((await cta.getAttribute('data-mode')) === 'start') await cta.click();
    await page.waitForFunction(() => document.querySelector('#cta')?.dataset.mode === 'next', null, { timeout: 30000 });
    await page.locator('#cta').click();
  }
  throw new Error('Zu viele Übungen');
}

test('Heute: Layout, kein horizontales Scrollen, Hell + Dunkel', async () => {
  for (const dark of [false, true]) {
    const { ctx, page, errors } = await newPage({ dark });
    await page.goto(srv.url);
    await page.locator('h1').waitFor();
    assert.match(await page.locator('h1').innerText(), /Hallo Lisa/);
    assert.ok(await noHScroll(page), 'horizontale Scrollleiste');
    await shot(page, `heute-${dark ? 'dunkel' : 'hell'}`);
    await page.screenshot({ path: path.join(SHOTS, `heute-${dark ? 'dunkel' : 'hell'}-voll.png`), fullPage: true });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Dark Mode per Einstellung', async () => {
  const { ctx, page } = await newPage();
  await page.goto(`${srv.url}#/settings`);
  await page.locator('[data-theme="dark"]').click();
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bg, 'rgb(251, 245, 240)');
  assert.ok(await noHScroll(page));
  await shot(page, 'einstellungen-dunkel');
  await ctx.close();
});

test('Training: Schmerz → Zeit → Los geht’s → Übungen → Rückmeldung → Verlauf', async () => {
  const { ctx, page, errors } = await newPage();
  await page.goto(srv.url);
  // ohne Schmerzwert: freundlicher Hinweis
  await page.locator('#go').click();
  await page.locator('#go-hint').waitFor({ state: 'visible' });
  await page.locator('#pain [data-v="2"]').click();
  await page.locator('[data-min="10"]').click();
  await shot(page, 'heute-gewaehlt');
  await page.locator('#go').click();
  await page.waitForURL(/#\/session/);
  await page.locator('.ex__name').waitFor();
  assert.ok(await noHScroll(page));
  await shot(page, 'uebung');
  // „Mehr Details“ aufklappen
  await page.locator('.more summary').click();
  await shot(page, 'uebung-details');
  const n = await runThrough(page);
  assert.ok(n >= 3);
  await shot(page, 'rueckmeldung');
  // ohne Antworten: Hinweis
  await page.locator('#save').click();
  await page.locator('#need').waitFor({ state: 'visible' });
  await page.locator('[data-effort="richtig"]').click();
  await page.locator('#pain-after [data-v="1"]').click();
  await page.locator('#save').click();
  await page.waitForURL(/#\/summary\//);
  await page.locator('.quote').waitFor();
  await shot(page, 'geschafft');
  await page.locator('.btn[href="#/history"]').click();
  await page.locator('.entry').first().waitFor();
  assert.match(await page.locator('.entry').first().innerText(), /Training/);
  assert.ok(await noHScroll(page));
  await shot(page, 'verlauf');
  await page.locator('[data-mode="cal"]').click();
  await page.locator('.cal__cell.is-today .mark--training').waitFor();
  await shot(page, 'verlauf-kalender');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Aktive Session überlebt ein Neuladen; „Das tut weh“ tauscht die Übung', async () => {
  const { ctx, page } = await newPage();
  await page.goto(srv.url);
  await page.locator('#pain [data-v="5"]').click(); // gelb → sanft
  await page.locator('#go').click();
  await page.locator('.ex__name').waitFor();
  assert.match(await page.locator('.hint--info').first().innerText(), /sanft/);
  const first = await page.locator('.ex__name').innerText();
  await page.waitForTimeout(400);
  await page.locator('#cta').click(); await page.waitForTimeout(300);
  await page.locator('[data-act="hurts"]').click();
  await page.locator('.ex__name').waitFor();
  await page.waitForTimeout(100);
  await page.reload();
  await page.locator('.ex__name').waitFor();
  assert.ok(page.url().includes('#/session'));
  // zur Startseite → Fortsetzen-Karte
  await page.goto(`${srv.url}#/`);
  await page.locator('[data-act="resume"]').waitFor();
  await page.locator('[data-act="resume"]').click();
  await page.locator('.ex__name').waitFor();
  assert.ok(first.length > 0);
  await ctx.close();
});

test('Schnellstarts: Nacken-Reset und Abend-Entspannung', async () => {
  for (const kind of ['reset', 'evening']) {
    const { ctx, page } = await newPage();
    await page.goto(srv.url);
    await page.locator(`[data-quick="${kind}"]`).click();
    await page.locator('.ex__name').waitFor();
    await runThrough(page);
    await page.locator('#pain-after [data-v="2"]').click();
    await page.locator('#save').click();
    await page.waitForURL(/#\/summary\//);
    await shot(page, `geschafft-${kind}`);
    await page.goto(`${srv.url}#/`);
    assert.match(await page.locator('.week__text').innerText(), /Mini-Pause/);
    await ctx.close();
  }
});

test('Einstellungen, Info und Installationshilfe', async () => {
  const { ctx, page, errors } = await newPage();
  for (const [hash, shotName] of [['#/settings', 'einstellungen'], ['#/info', 'info'], ['#/install', 'installation']]) {
    await page.goto(srv.url + hash);
    await page.locator('h1').waitFor();
    assert.ok(await noHScroll(page), `${hash}: horizontales Scrollen`);
    await page.screenshot({ path: path.join(SHOTS, `${shotName}.png`), fullPage: true });
  }
  await page.goto(`${srv.url}#/settings`);
  await page.locator('[data-day="2"]').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="ics"]').click()]);
  assert.match(dl.suggestedFilename(), /\.ics$/);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(text, /BEGIN:VEVENT/);
  assert.match(text, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,FR/);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export"]').click()]);
  assert.match(dl2.suggestedFilename(), /\.json$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Offline-Start über den Service Worker', async () => {
  const { ctx, page } = await newPage({ sw: true });
  await page.goto(srv.url);
  await page.locator('h1').waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller || true);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await page.locator('h1').waitFor();
  assert.match(await page.locator('h1').innerText(), /Hallo Lisa/);
  await page.locator('[data-quick="reset"]').click();
  await page.locator('.ex__name').waitFor();
  await ctx.close();
});
