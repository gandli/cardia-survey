import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
  await page.waitForTimeout(1800);
});

// O: survey ECG 旁注 HR 元素存在且展示数值 (仪表可信度)
test('O: ECG HR 数值旁注', async ({ page }) => {
  const vp = page.viewportSize()!;
  // phone 隐藏 survey 内 ECG 旁注 (< sm), 跳过
  if (vp.width < 640) return;
  const hr = await page.evaluate(() => {
    const el = document.getElementById('ecg-hr');
    if (!el) return null;
    return { text: el.textContent, visible: el.offsetHeight > 0 };
  });
  expect(hr, 'ecg-hr 元素必须存在').not.toBeNull();
  expect(hr!.visible, 'ecg-hr 必须可见').toBe(true);
  const n = parseInt(hr!.text || '0', 10);
  expect(n, `HR=${hr!.text} 应在 40..200 之间`).toBeGreaterThan(40);
  expect(n).toBeLessThan(200);
});

// P: 品牌字号 >= 11px (baseline-ui 层级要求, 不能被压到 caption)
test('P: 品牌字号 ≥ 11px', async ({ page }) => {
  const size = await page.evaluate(() => {
    const el = document.getElementById('brand')!;
    return parseFloat(getComputedStyle(el).fontSize);
  });
  expect(size, `brand fontSize=${size}px`).toBeGreaterThanOrEqual(11);
});

// Q: macro-window 加刻度尺 (强化"显微目镜"仪表感)
test('Q: macro-window 有刻度尺', async ({ page }) => {
  const macroVisible = await page.evaluate(() => {
    const el = document.getElementById('macro');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  if (!macroVisible) return;
  const ticks = await page.$$('#macro-window .tick-top, #macro-window .tick-right');
  expect(ticks.length, 'macro-window 至少 2 条刻度尺 (top + right)').toBeGreaterThanOrEqual(2);
});
