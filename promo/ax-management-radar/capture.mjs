import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'public', 'textures', 'live');
const layoutPath = path.join(here, 'src', 'live-layout.json');
const BASE = 'http://localhost:3000';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewport = { width: 1920, height: 1080, deviceScaleFactor: 2 };

const PAGES = [
  { name: 'wps-2023', path: '/?view=ax&year=2023&private_size=300_999', boxes: [
    ['header', '.ai-dashboard-header'], ['controls', '.wps-explorer-controls'], ['comparison', '.wps-size-comparison'],
    ['foundation', '.ax-foundation-card', true, 6], ['perception', '.ai-perception-panel', true, 4], ['actions', '.ax-management-actions'],
  ], cutouts: [['wps-header', '.ai-dashboard-header'], ['wps-controls', '.wps-explorer-controls'], ['wps-comparison', '.wps-size-comparison'], ['wps-foundation', '.ax-foundation-card', true, 4], ['wps-model', '.ai-model-card'], ['wps-caution', '.ai-model-caution']], hide: '.ax-foundation-card' },
  { name: 'wps-2021', path: '/?view=ax&year=2021&private_size=300_999', boxes: [['header', '.ai-dashboard-header'], ['controls', '.wps-explorer-controls']], cutouts: [['wps-2021-controls', '.wps-explorer-controls'], ['wps-2021-header', '.ai-dashboard-header']] },
  { name: 'kipa-2023', path: '/?view=public-data&year=2023', openDetails: true, boxes: [['header', '.ai-dashboard-header'], ['filters', '.supplemental-filters'], ['dataset', '.supplemental-dataset'], ['questions', '.supplemental-question', true, 21]], cutouts: [['kipa-header', '.ai-dashboard-header'], ['kipa-filters', '.supplemental-filters'], ['kipa-dataset', '.supplemental-dataset'], ['kipa-q3', 'details.supplemental-question:nth-of-type(1)'], ['kipa-q16-support', 'details.supplemental-question:nth-of-type(8)'], ['kipa-q19-resources', 'details.supplemental-question:nth-of-type(21)'], ['kipa-notice', '.kipa-usage-notice']] },
  { name: 'research', path: '/?view=research', boxes: [['header', '.ai-dashboard-header'], ['studies', '.research-study', true, 10], ['proposal', '.research-proposal']], cutouts: [['research-header', '.ai-dashboard-header'], ['research-study', '.research-study', true, 8], ['research-proposal', '.research-proposal']] },
  { name: 'wps-models', path: '/?view=ax&section=adoption&year=2023&private_size=300_999', openDetails: true, boxes: [['header', '.ai-dashboard-header'], ['models', '.ax-model-card', true, 3], ['contrast', '.ax-direct-contrast'], ['cautions', '.ax-reading-callout, .wps-fixed-period', true, 3]], cutouts: [['wps-model', '.ax-model-card', true, 3], ['wps-contrast', '.ax-direct-contrast'], ['wps-caution', '.ax-reading-callout, .wps-fixed-period', true, 3]] },
];

const bbox = async (handle) => handle.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; });
const safe = (s) => s.replace(/[^a-z0-9_-]/gi, '-');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(layoutPath), { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport(viewport);
const layout = { pageW: viewport.width, capture: { base: BASE, deviceScaleFactor: 2, capturedAt: '2026-09-06', publicAggregateOnly: true } };

for (const spec of PAGES) {
  await page.goto(`${BASE}${spec.path}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (spec.openDetails) await page.evaluate(() => document.querySelectorAll('details.ax-model-details, details.supplemental-question').forEach((el) => { el.open = true; }));
  const entry = { pageH: await page.evaluate(() => document.documentElement.scrollHeight), boxes: {}, cutouts: [] };
  layout[spec.name] = entry;
  await page.screenshot({ path: path.join(outDir, `${spec.name}-full.png`), fullPage: true });
  for (const [key, selector, all = false, max = Number.MAX_SAFE_INTEGER] of spec.boxes) {
    const handles = await page.$$(selector);
    const selected = (all ? handles : handles.slice(0, 1)).slice(0, max);
    const values = await Promise.all(selected.map(bbox));
    entry.boxes[key] = all ? values : values[0] ?? null;
  }
  for (const [name, selector, all = false, max = Number.MAX_SAFE_INTEGER] of spec.cutouts) {
    const handles = (all ? await page.$$(selector) : (await page.$$(selector)).slice(0, 1)).slice(0, max);
    for (let index = 0; index < handles.length; index++) {
      const file = `${safe(name)}${all ? `-${index + 1}` : ''}.png`;
      const box = await bbox(handles[index]);
      await handles[index].screenshot({ path: path.join(outDir, file), omitBackground: true });
      entry.cutouts.push({ file, ...box });
    }
  }
  if (spec.hide) {
    await page.evaluate((selector) => document.querySelectorAll(selector).forEach((el) => { el.style.visibility = 'hidden'; }), spec.hide);
    await page.screenshot({ path: path.join(outDir, `${spec.name}-empty.png`), fullPage: true });
    await page.evaluate((selector) => document.querySelectorAll(selector).forEach((el) => { el.style.visibility = ''; }), spec.hide);
  }
}

// Dedicated hero detail: 4x for an actual foundation card under a 2.5D push-in.
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 4 });
await page.goto(`${BASE}/?view=ax&year=2023&private_size=300_999`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await new Promise((resolve) => setTimeout(resolve, 600));
const hero = await page.$('.ax-foundation-card');
if (!hero) throw new Error('Expected WPS foundation card was not found.');
await hero.screenshot({ path: path.join(outDir, 'wps-foundation-hires.png'), omitBackground: true });
layout['wps-2023'].heroHires = { file: 'wps-foundation-hires.png', ...(await bbox(hero)), deviceScaleFactor: 4 };

fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2));
await browser.close();
console.log(`Captured ${PAGES.length} real public aggregate routes to ${outDir}`);
