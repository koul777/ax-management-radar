// Genuine element crops for the final readability pass. No synthetic UI/data.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(project, 'public/textures/live');
const base = process.env.PROMO_BASE_URL || 'http://localhost:3000';
const browser = await puppeteer.launch({
  executablePath: process.env.PROMO_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 });
const evidence = { captureDate: '2026-09-07', publicAggregateOnly: true, crops: {} };

async function go(route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
}
async function crop(name, selector, index = 0) {
  const element = (await page.$$(selector))[index];
  if (!element) throw new Error(`Required public UI element missing: ${selector} [${index}]`);
  const box = await element.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, text: el.innerText };
  });
  await element.screenshot({ path: path.join(output, `${name}.png`) });
  evidence.crops[name] = box;
  return box;
}

try {
  await go('/?view=ax&year=2021&private_size=300_999');
  await crop('year-select-2021', '.wps-explorer-controls .year-selector');
  await page.select('#wps-year', '2023');
  await page.waitForFunction(() => document.querySelector('#wps-year')?.value === '2023' && document.querySelector('.wps-size-comparison')?.innerText.includes('26.3%'));
  await crop('year-select-2023', '.wps-explorer-controls .year-selector');
  await crop('size-select-2023', '.wps-explorer-controls > label', 1);
  const panel = await crop('size-table-complete', '.wps-size-comparison');
  evidence.sizeRows = [];
  for (let index = 2; index < 5; index++) {
    const name = `size-row-${index - 1}`;
    const row = await crop(name, '.wps-size-comparison tbody tr', index);
    evidence.sizeRows.push({ file: `${name}.png`, x: row.x - panel.x, y: row.y - panel.y, w: row.w, h: row.h, text: row.text });
  }
  // Preserve native row slots in the captured table; separate native rows land there.
  await page.evaluate(() => [...document.querySelectorAll('.wps-size-comparison tbody tr')].slice(2).forEach(el => { el.style.visibility = 'hidden'; }));
  await crop('size-table-slots', '.wps-size-comparison');
  await page.evaluate(() => [...document.querySelectorAll('.wps-size-comparison tbody tr')].slice(2).forEach(el => { el.style.visibility = ''; }));

  await go('/?view=research');
  await page.evaluate(() => { document.querySelector('.research-study').open = true; });
  await crop('research-study-open', '.research-study');
  await crop('research-study-title', '.research-study h3');
  evidence.study = await page.$eval('.research-study', el => ({
    title: el.querySelector('h3').innerText,
    citation: el.querySelector('summary p').innerText,
    dataset: el.querySelector('summary strong').innerText,
    evidenceLevel: el.querySelector('.research-tier').innerText,
    method: [...el.querySelectorAll('dl > div')].find(d => d.querySelector('dt').innerText === '방법').querySelector('dd').innerText,
  }));

  await go('/?view=ax&section=adoption&year=2023&private_size=300_999');
  await page.evaluate(() => { document.querySelector('.ax-model-details').open = true; });
  await crop('model-heading-focus', '.ax-model-heading');
  await crop('model-controls-focus', '.ax-model-details > p');
  await crop('model-period-focus', '.wps-fixed-period');
  evidence.model = await page.$eval('.ax-model-card', el => ({
    id: el.id, title: el.querySelector('h3').innerText,
    n: el.querySelector('.ax-model-n strong').innerText,
    method: el.querySelector('.ax-model-method').innerText,
    groups: el.querySelector('.ax-model-groups').innerText,
    controls: el.querySelector('.ax-model-details > p').innerText,
  }));
  fs.writeFileSync(path.join(project, 'src/focus-layout.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ crops: Object.keys(evidence.crops).length, study: evidence.study, model: evidence.model }, null, 2));
} finally {
  await browser.close();
}
