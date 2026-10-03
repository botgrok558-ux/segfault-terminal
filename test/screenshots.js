// Screenshot helper (optional): npm i --no-save puppeteer-core && node test/screenshots.js owner/repo
// Uses the locally installed Google Chrome at /usr/bin/google-chrome.
const puppeteer = require('puppeteer-core');
const OUT = '/workspace/memecoin/app/screenshots';
const BASE = 'http://localhost:8080';
const repo = process.argv[2] || 'torvalds/linux';
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1500, deviceScaleFactor: 1 });
  await p.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await p.type('#input', '/roast ' + repo);
  await p.keyboard.press('Enter');
  await p.waitForSelector('.block .card-prev', { timeout: 30000 });
  await p.waitForFunction(() => { const i = document.querySelector('.card-prev'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1500));
  // scroll terminal so the roast block's top is visible
  await p.evaluate(() => { const o = document.getElementById('out'); const blk = [...o.querySelectorAll('.block')].pop(); o.scrollTop = blk.offsetTop - o.offsetTop - 40; });
  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: `${OUT}/01-hero-terminal-roast.png`, clip: { x: 0, y: 0, width: 1440, height: 1060 } });
  // debug example
  await p.evaluate(() => document.querySelector('[data-cmd="__debug_sample"]').click());
  await p.waitForFunction(() => document.querySelectorAll('.block').length >= 2, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));
  const term = await p.$('#terminal');
  await term.screenshot({ path: `${OUT}/03-terminal-debug.png` });
  // Hall of Shame
  await p.evaluate(() => window.scrollTo(0, 0));
  const sh = await p.$('#shame');
  await new Promise(r => setTimeout(r, 1200));
  await sh.screenshot({ path: `${OUT}/02-hall-of-shame.png` });
  await b.close();
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
