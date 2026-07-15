import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
const p = await ctx.newPage();
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
await p.waitForTimeout(1800);
const info = await p.evaluate(() => {
  const m = document.getElementById('macro');
  const cs = getComputedStyle(m);
  const r = m.getBoundingClientRect();
  const children = Array.from(m.children).map(c => ({tag:c.tagName, id:c.id, cls:(c.className||'').slice(0,50), h:c.getBoundingClientRect().height|0}));
  const win = document.getElementById('macro-window').getBoundingClientRect();
  return { top:r.top, height:r.height, bottom:r.bottom, maxHeight:cs.maxHeight, overflow:cs.overflowY, translate:cs.translate, winH:win.height, children };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
