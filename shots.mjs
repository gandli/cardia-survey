import { chromium } from 'playwright';
const sizes = [
  ['phone-390x844', 390, 844],
  ['tablet-768x1024', 768, 1024],
  ['laptop-1280x800', 1280, 800],
  ['desktop-1440x900', 1440, 900],
  ['wide-2560x1440', 2560, 1440],
  ['landscape-800x480', 800, 480],
];
const b = await chromium.launch();
for (const [name, w, h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/?t=' + Date.now());
  await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
  await p.waitForTimeout(3500); // 等一个扫描周期让引导线显现
  await p.screenshot({ path: `/tmp/shot-${name}.png` });
  await ctx.close();
  console.log('shot', name);
}
await b.close();
