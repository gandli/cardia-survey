import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:800,height:480},deviceScaleFactor:1});
const p = await ctx.newPage();
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
await p.waitForTimeout(1800);
const info = await p.evaluate(() => {
  const s = document.getElementById('survey');
  const cs = getComputedStyle(s);
  const r = s.getBoundingClientRect();
  return { top:r.top, height:r.height, bottom:r.bottom, cssTop:cs.top, cssMaxH:cs.maxHeight, cssTransform:cs.transform, translate:cs.translate };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
