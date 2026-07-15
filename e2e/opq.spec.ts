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

// P: 品牌铭文=角落作者签名 (impeccable 评审后语义调整)
// - 字号 ≥ 10px (作者签名可比品牌 header 更小, 但仍在可读范围)
// - 文本不与左面板 .hd-title '心脏检查' 撞词 (avoid duplicate binding perception)
test('P: 品牌铭文字号 ≥ 10px 且不与 .hd-title 撞词', async ({ page }) => {
  const info = await page.evaluate(() => {
    const brand = document.getElementById('brand')!;
    const hdTitle = document.querySelector('#survey .hd-title')?.textContent?.trim() || '';
    return {
      size: parseFloat(getComputedStyle(brand).fontSize),
      brandText: brand.textContent!.trim(),
      hdTitle,
    };
  });
  expect(info.size, `brand fontSize=${info.size}px`).toBeGreaterThanOrEqual(10);
  // 品牌不再直接含 '心脏检查' 全词, 避免与左面板 header 语汇重复
  // CodeRabbit/Gemini Minor: 去掉尾空格避免"末尾撞词"漏检 (brand='CARDIA · 心脏检查' 会被漏)
  const hdWord = info.hdTitle.replace(/^[·\s]+/, '').split(/[\s·]+/).pop() || '';
  expect(info.brandText, `brand='${info.brandText}' hdTitle='${info.hdTitle}' word='${hdWord}'`).not.toContain(hdWord);
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
