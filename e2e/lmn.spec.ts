import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
  await page.waitForTimeout(1800);
});

// L: 按钮文本对比度 (取按钮 fg vs 半透 bg 合成后与页面底色的混合值)
test('L: 主操作按钮文字与背景对比度 >= 3:1', async ({ page }) => {
  const audit = await page.evaluate(() => {
    const btn = document.getElementById('rec-btn')!;
    const cs = getComputedStyle(btn);
    const parseRGB = (str: string) => {
      const m = str.match(/(\d+\.?\d*)/g);
      if (!m) return [0, 0, 0];
      return [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])];
    };
    const lum = (rgb: number[]) => {
      const c = rgb.map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const contrast = (a: number[], b: number[]) => {
      const la = lum(a), lb = lum(b);
      const hi = Math.max(la, lb), lo = Math.min(la, lb);
      return (hi + 0.05) / (lo + 0.05);
    };
    const fg = parseRGB(cs.color);
    const bgOverlay = parseRGB(cs.backgroundColor);
    const alphaMatch = cs.backgroundColor.match(/,\s*([\d.]+)\)$/);
    const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
    const pageBg = [179, 181, 190];
    const mix = bgOverlay.map((v, i) => v * alpha + pageBg[i] * (1 - alpha));
    return { fg, bg: mix, contrast: contrast(fg, mix) };
  });
  expect(
    audit.contrast,
    `contrast=${audit.contrast.toFixed(2)} fg=${audit.fg} bg=${audit.bg.map(x => x.toFixed(0))}`
  ).toBeGreaterThanOrEqual(3.0);
});

// M: 短屏 (landscape 800x480) 下 mini-strip 必须显示, 保留 ECG/meter 关键数值
test('M: 窄高兜底 chip 展示', async ({ page }) => {
  const vp = page.viewportSize()!;
  const isShort = vp.height <= 520;
  const info = await page.evaluate(() => {
    const mini = document.getElementById('mini-strip')!;
    return { display: getComputedStyle(mini).display, visible: mini.offsetHeight > 0 };
  });
  if (isShort) {
    expect(info.display, `landscape mini-strip display=${info.display}`).not.toBe('none');
    expect(info.visible).toBe(true);
  } else {
    expect(info.display, `non-short mini-strip display=${info.display}`).toBe('none');
  }
});

// N: macro hd / ft 行高一致 (仪器条基线对齐)
test('N: macro hd / ft 行高相等', async ({ page }) => {
  const macroVisible = await page.evaluate(() => {
    const el = document.getElementById('macro');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  if (!macroVisible) return;
  const info = await page.evaluate(() => {
    const macro = document.getElementById('macro')!;
    const hd = macro.querySelector('.hd') as HTMLElement;
    const children = Array.from(macro.children) as HTMLElement[];
    const ft = children[children.length - 1];
    return { hdH: hd.getBoundingClientRect().height, ftH: ft.getBoundingClientRect().height };
  });
  expect(Math.abs(info.hdH - info.ftH), `hd=${info.hdH} ft=${info.ftH}`).toBeLessThanOrEqual(2);
});
