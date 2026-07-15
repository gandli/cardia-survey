import { test, expect, Page } from '@playwright/test';

/**
 * 心脏检查响应式布局验证:
 *  A) 面板不遮挡屏幕中心心脏区 (几何置信区: 中心 56% 宽 x 50% 高的矩形, 上沿即面板底线的红线)
 *  B) 所有 HUD 元素都在视口内 (无水平/垂直溢出)
 *  C) 引导线 <path id="scanline"> 具有可见描边 (stroke != none && width > 0)
 *  D) reticle 的 3 个 circle 齐全 (外光晕/描边/内点)
 */

const zoneOf = (vw: number, vh: number) => ({
  // 心脏投影几何置信区 (略偏下, 因为相机 y=0.35 上移)
  l: vw * 0.32,
  r: vw * 0.68,
  t: vh * 0.20,
  b: vh * 0.88,
});

// 面板与心脏几何置信区的交叠面积必须为 0
async function assertNoHeartOcclusion(page: Page, panelIds: string[]) {
  const vp = page.viewportSize()!;
  const zone = zoneOf(vp.width, vp.height);
  for (const id of panelIds) {
    const box = await page.locator('#' + id).boundingBox();
    if (!box) throw new Error(`panel #${id} missing`);
    const ix = Math.max(0, Math.min(box.x + box.width, zone.r) - Math.max(box.x, zone.l));
    const iy = Math.max(0, Math.min(box.y + box.height, zone.b) - Math.max(box.y, zone.t));
    const area = ix * iy;
    expect(
      area,
      `#${id} 与心脏区交叠 ${area.toFixed(0)}px² box=${box.x.toFixed(0)},${box.y.toFixed(0)},${box.width.toFixed(0)}x${box.height.toFixed(0)} zone=${zone.l.toFixed(0)}..${zone.r.toFixed(0)}×${zone.t.toFixed(0)}..${zone.b.toFixed(0)} vp=${vp.width}x${vp.height}`
    ).toBe(0);
  }
}

async function assertInsideViewport(page: Page, ids: string[]) {
  const vp = page.viewportSize()!;
  for (const id of ids) {
    const box = await page.locator('#' + id).boundingBox();
    if (!box) continue;
    expect(box.x, `#${id} x`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `#${id} y`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `#${id} right (vp=${vp.width})`).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height, `#${id} bottom (vp=${vp.height})`).toBeLessThanOrEqual(vp.height + 1);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
  // 等入场动画结束 (最长 translate 1s + delay 0.3s)
  await page.waitForTimeout(1800);
});

test('A: 面板不遮挡心脏中心区', async ({ page }) => {
  await assertNoHeartOcclusion(page, ['survey', 'macro']);
});

test('B: 所有 HUD 元素在视口内', async ({ page }) => {
  await assertInsideViewport(page, ['survey', 'macro', 'brand', 'rec-btn', 'replay-btn', 'audio-btn']);
});

test('C: 引导线有可见描边', async ({ page }) => {
  // 等一个扫描周期让 d 有内容
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const p = document.querySelector('#scanline') as SVGPathElement | null;
    if (!p) return null;
    const cs = getComputedStyle(p);
    return {
      d: p.getAttribute('d'),
      stroke: cs.stroke,
      width: parseFloat(cs.strokeWidth),
    };
  });
  expect(info, 'scanline element').not.toBeNull();
  expect(info!.stroke).not.toBe('none');
  expect(info!.stroke).not.toBe('rgb(0, 0, 0)'); // 默认 fill 黑不算
  expect(info!.width).toBeGreaterThan(0);
});

test('D: reticle 3 层结构齐全', async ({ page }) => {
  const n = await page.locator('#reticle > circle').count();
  expect(n).toBe(3);
});

test('E: 心脏 canvas 占满视口且渲染', async ({ page }) => {
  const vp = page.viewportSize()!;
  const box = await page.locator('#gl').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
  expect(box!.height).toBeGreaterThanOrEqual(vp.height - 2);
});

// F: macro wrapper 必须透明 (原版契约: 只有 hd/ft/strip/side 有底色, wrapper 透明才能透出 canvas 心脏特写)
test('F: macro 面板外层透明, 内部条带有底色', async ({ page }) => {
  const info = await page.evaluate(() => {
    const macro = document.querySelector('#macro') as HTMLElement;
    const win = document.querySelector('#macro-window') as HTMLElement;
    const strip = document.querySelector('#macro > div:nth-of-type(2)') as HTMLElement;
    const s = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
    return {
      macroBg: s(macro),
      winBg: s(win),
      stripBg: strip ? s(strip) : null,
    };
  });
  // 完全透明 (rgba 第四位 =0) — 允许 rgb(0,0,0,0) / rgba(0,0,0,0) / transparent
  expect(info.macroBg, `macroBg=${info.macroBg}`).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/);
  expect(info.winBg, `winBg=${info.winBg}`).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/);
});

// G: macro 面板底边 ≤ viewport (已被 B 覆盖, 但 F 修复后可能引出新溢出)
test('G: macro corner brackets 4 个齐全且未被裁切', async ({ page }) => {
  const boxes = await page.$$eval('#macro-window .corner', els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    })
  );
  expect(boxes.length, 'macro window 需 4 个 .corner').toBe(4);
  // 4 个角必须都在视口内 (>=-2, <= vp+2 兜底浮点)
  const vp = page.viewportSize()!;
  for (const b of boxes) {
    expect(b.t, `corner top ${b.t}`).toBeGreaterThanOrEqual(-2);
    expect(b.b, `corner bottom ${b.b} > vp ${vp.height}`).toBeLessThanOrEqual(vp.height + 2);
  }
});
