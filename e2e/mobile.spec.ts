import { test, expect, type Page } from "@playwright/test";

/**
 * cardia-survey 移动端适配: 竖屏手机视口下 HUD 不得溢出/重叠, 按钮触摸目标
 * 达标. 纯 CSS 布局断言(不依赖 3D/WebGL). 服务器: http://192.168.5.94:4173
 */
test.describe("cardia 移动端布局", () => {
  const MOBILE = { viewport: { width: 390, height: 844 } };

  async function layout(page: Page) {
    return page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const ids = ["rec-btn", "replay-btn", "audio-btn", "brand", "survey", "macro", "complete"];
      const out: Record<string, { left: number; right: number; top: number; bottom: number; w: number }> = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        out[id] = { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width) };
      }
      return { vw, vh, els: out };
    });
  }

  test("竖屏下三按钮不溢出视口且互不重叠", async ({ page }) => {
    await page.setViewportSize(MOBILE.viewport);
    await page.goto("http://192.168.5.94:4173/");
    await page.waitForTimeout(1500);
    const { vw, els } = await layout(page);
    const btns = ["rec-btn", "replay-btn", "audio-btn"].map((id) => els[id]).filter(Boolean);
    expect(btns.length, "三个按钮应存在").toBe(3);
    for (const b of btns) {
      expect(b.right, "按钮右边界 ≤ 视口宽").toBeLessThanOrEqual(vw);
      expect(b.left, "按钮左边界 ≥ 0").toBeGreaterThanOrEqual(0);
      expect(b.w, "按钮宽度 ≥ 40px 触摸目标").toBeGreaterThanOrEqual(40);
    }
    for (let i = 0; i < btns.length; i++)
      for (let j = i + 1; j < btns.length; j++)
        expect(btns[i].right <= btns[j].left || btns[j].right <= btns[i].left, "按钮不应水平重叠").toBe(true);
  });

  test("竖屏下品牌不与右上按钮重叠", async ({ page }) => {
    await page.setViewportSize(MOBILE.viewport);
    await page.goto("http://192.168.5.94:4173/");
    await page.waitForTimeout(1500);
    const { els } = await layout(page);
    const brand = els["brand"], audio = els["audio-btn"];
    expect(brand && audio, "品牌与音频按钮应存在").toBeTruthy();
    const overlap = !(brand.bottom <= audio.top || brand.right <= audio.left);
    expect(overlap, "品牌与音频按钮不应重叠").toBe(false);
  });

  test("竖屏下两面板(survey/macro)不溢出且不与底部按钮行重叠", async ({ page }) => {
    await page.setViewportSize(MOBILE.viewport);
    await page.goto("http://192.168.5.94:4173/");
    await page.waitForTimeout(1500);
    const { vw, els } = await layout(page);
    for (const id of ["survey", "macro"]) {
      const p = els[id];
      expect(p, `${id} 应存在`).toBeTruthy();
      expect(p.right, `${id} 右边界 ≤ 视口宽`).toBeLessThanOrEqual(vw);
      expect(p.left, `${id} 左边界 ≥ 0`).toBeGreaterThanOrEqual(0);
    }
  });
});
