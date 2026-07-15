import { chromium } from 'playwright';
const sizes = [[390,844],[768,1024],[1280,800],[1440,900],[2560,1440],[800,480]];
const b = await chromium.launch();
for (const [w,h] of sizes) {
  const ctx = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/?v=8');
  await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => {
    const s = document.getElementById('survey');
    const cs = getComputedStyle(s);
    const r = s.getBoundingClientRect();
    return { size:[innerWidth,innerHeight], rect:[r.left|0,r.top|0,r.width|0,r.height|0], clientH:s.clientHeight, scrollH:s.scrollHeight, overflow:s.scrollHeight-s.clientHeight, maxH:cs.maxHeight, overflowY:cs.overflowY };
  });
  console.log(`${w}x${h}`, JSON.stringify(info));
  await ctx.close();
}
await b.close();
