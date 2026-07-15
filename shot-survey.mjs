import { chromium } from 'playwright';
const sizes = [['phone-390x844',390,844],['tablet-768x1024',768,1024],['laptop-1280x800',1280,800],['desktop-1440x900',1440,900],['wide-2560x1440',2560,1440],['landscape-800x480',800,480]];
const b = await chromium.launch();
for (const [name,w,h] of sizes) {
  const ctx = await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2});
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/?v=survey');
  await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  // 只截 survey 面板 +40px 边距
  const box = await p.evaluate(() => { const r = document.getElementById('survey').getBoundingClientRect(); return {x:Math.max(0,r.left-20)|0,y:Math.max(0,r.top-20)|0,width:(r.width+40)|0,height:(r.height+40)|0}; });
  await p.screenshot({ path: `/tmp/survey-${name}.png`, clip: box });
  console.log('shot survey', name, JSON.stringify(box));
  await ctx.close();
}
await b.close();
