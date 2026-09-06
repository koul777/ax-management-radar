// Real local browser smoke checks; aggregate-only pages, isolated temporary profile.
// Uses the promo workspace's existing Puppeteer dependency (no global install).
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requirePromo = createRequire(path.join(root, 'promo/ax-management-radar/package.json'));
const puppeteer = requirePromo('puppeteer');
const base = process.env.AX_QA_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw new Error('This QA script is scoped to the local dashboard.');
const out = path.join(root, '.tmp/overnight_browser');
await mkdir(out, { recursive: true });
const checks = [];
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.AX_QA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  // A per-run profile prevents a crashed/parallel QA session from holding the
  // shared Chrome profile lock and turning the next run into a launch timeout.
  userDataDir: path.join(out, `chrome-profile-${process.pid}`),
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function go(route, width = 1280) {
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  // The development server maintains a live-reload connection, so networkidle0
  // can wait for a connection that intentionally never goes idle. The rendered
  // dashboard marker plus settled fonts is the page-readiness condition we need.
  await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dashboard-content');
  await page.evaluate(() => document.fonts.ready);
  // Server-rendered controls exist before React has attached its delegated
  // handlers. Prove hydration with the same native key event used below, then
  // restore focus to the selected tab before each check begins.
  await page.waitForFunction(() => {
    const tabs = [...document.querySelectorAll('.ax-main-menu [role="tab"]')];
    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    if (!(selected instanceof HTMLButtonElement) || tabs.length < 2) return false;
    const next = tabs[(tabs.indexOf(selected) + 1) % tabs.length];
    selected.focus();
    selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    if (document.activeElement !== next) return false;
    selected.focus();
    return true;
  }, { timeout: 10_000 });
}
async function evidence(name, condition, details) {
  checks.push({ name, passed: Boolean(condition), details });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(details)}`);
}
try {
  await go('/?view=ax&year=2023&private_size=300_999');
  await page.select('#wps-year', '2021');
  await page.waitForFunction(() => document.querySelector('#wps-year').value === '2021');
  await evidence('year change updates live state and URL', new URL(page.url()).searchParams.get('year') === '2021', await page.$eval('#wps-year', el => el.value));
  await page.select('#wps-private-size', '1000_plus');
  await evidence('private size change updates URL', new URL(page.url()).searchParams.get('private_size') === '1000_plus', page.url());
  await page.click('#wps-tab-adoption');
  const period = await page.$eval('.wps-fixed-period', el => el.innerText);
  await evidence('model retains fixed analysis period', period.includes('2021') && period.includes('2023') && !(await page.$('#wps-year')), period);

  await page.click('#menu-public-data');
  await page.waitForSelector('#supplemental-year');
  await evidence('menu navigation clears stale WPS filters', !new URL(page.url()).searchParams.has('private_size') && !new URL(page.url()).searchParams.has('year'), page.url());
  await page.select('#supplemental-year', '2020');
  const afterYear = await page.$eval('#dashboard-content', el => el.innerText);
  await evidence('supplemental live year selects 2020 only', afterYear.includes('305') && !afterYear.includes('1,608'), '2020 digital transition, not 2023 chatbot dataset');

  await go('/');
  await page.focus('#menu-ax');
  await page.keyboard.press('ArrowRight');
  const mainTabState = () => page.evaluate(() => ({
    focus: document.activeElement?.id,
    selected: document.querySelector('.ax-main-menu [role="tab"][aria-selected="true"]')?.id,
  }));
  const menuArrow = await mainTabState();
  await evidence('main manual ArrowRight moves focus without selection', menuArrow.focus === 'menu-public-private' && menuArrow.selected === 'menu-ax', menuArrow);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const menuWrap = await mainTabState();
  await evidence('main ArrowLeft wraps without selection', menuWrap.focus === 'menu-research' && menuWrap.selected === 'menu-ax', menuWrap);
  await page.keyboard.press('Home');
  const menuHome = await mainTabState();
  await page.keyboard.press('End');
  const menuEnd = await mainTabState();
  await evidence('main Home and End move focus only', menuHome.focus === 'menu-ax' && menuHome.selected === 'menu-ax' && menuEnd.focus === 'menu-research' && menuEnd.selected === 'menu-ax', { menuHome, menuEnd });

  await go('/');
  const wpsTabState = () => page.evaluate(() => ({
    focus: document.activeElement?.id,
    selected: document.querySelector('.ai-view-tabs [role="tab"][aria-selected="true"]')?.id,
  }));
  await page.focus('#wps-tab-overview');
  await page.keyboard.press('ArrowRight');
  const wpsArrow = await wpsTabState();
  await evidence('WPS manual ArrowRight moves focus without selection', wpsArrow.focus === 'wps-tab-catalog' && wpsArrow.selected === 'wps-tab-overview', wpsArrow);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const wpsWrap = await wpsTabState();
  await evidence('WPS ArrowLeft wraps without selection', wpsWrap.focus === 'wps-tab-framework' && wpsWrap.selected === 'wps-tab-overview', wpsWrap);
  await page.keyboard.press('Home');
  const wpsHome = await wpsTabState();
  await page.keyboard.press('End');
  const wpsEnd = await wpsTabState();
  await evidence('WPS Home and End move focus only', wpsHome.focus === 'wps-tab-overview' && wpsHome.selected === 'wps-tab-overview' && wpsEnd.focus === 'wps-tab-framework' && wpsEnd.selected === 'wps-tab-overview', { wpsHome, wpsEnd });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#wps-tab-framework')?.getAttribute('aria-selected') === 'true');
  const enterActivation = await wpsTabState();
  await evidence('Enter activates the focused WPS tab', enterActivation.selected === 'wps-tab-framework', enterActivation);

  await go('/?view=ax&section=overview');
  await page.focus('#wps-tab-catalog');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#wps-tab-catalog')?.getAttribute('aria-selected') === 'true');
  const spaceActivation = await wpsTabState();
  await evidence('Space activates the focused WPS tab', spaceActivation.selected === 'wps-tab-catalog', spaceActivation);

  await go('/?view=ax&section=overview');
  await page.focus('#wps-tab-overview');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.querySelector('#wps-tab-overview')?.tabIndex === 0);
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  const wpsReentry = await wpsTabState();
  await evidence('Tab re-entry returns to the selected WPS tab', wpsReentry.focus === 'wps-tab-overview' && wpsReentry.selected === 'wps-tab-overview', wpsReentry);

  for (const width of [320, 375, 768, 1280]) {
    for (const view of ['ax', 'public-private', 'central-local', 'public-data', 'klips', 'personal-ai', 'citizen', 'research']) {
      await go(`/?view=${view}`, width);
      const overflow = await page.evaluate(() => {
        const viewport = innerWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const offenders = [...document.body.querySelectorAll('*')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { element, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
          })
          .filter(({ left, right, width }) => width > 0 && (left < -1 || right > viewport + 1))
          .slice(0, 12)
          .map(({ element, left, right, width }) => ({ tag: element.tagName.toLowerCase(), id: element.id || undefined, className: typeof element.className === 'string' ? element.className : undefined, left, right, width }));
        return { viewport, document: documentWidth, body: bodyWidth, offenders };
      });
      await evidence(`no viewport overflow ${view}/${width}`, overflow.document <= width + 1 && overflow.body <= width + 1, overflow);
      if (overflow.document > width + 1 || overflow.body > width + 1 || width === 320 && ['ax', 'public-data', 'research'].includes(view)) {
        await page.screenshot({ path: path.join(out, `${view}-${width}.png`), fullPage: false });
      }
    }
  }
  await evidence('no client-side uncaught errors', errors.length === 0, errors);
} finally {
  await browser.close();
  await writeFile(path.join(out, 'browser-smoke.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
}
process.exitCode = checks.some(check => !check.passed) ? 1 : 0;
