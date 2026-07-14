import { test, expect, type Page } from "@playwright/test";

/**
 * cardia-survey 移动端: 面板(卡片)不得遮挡屏幕中部的 3D 心脏。
 * 心脏位于视口中心(相机恒定居中, 模型在场景原点), 心脏置信区取视口中心 56% 矩形。
 * 面板底边不得侵入该区上界 —— 纯 DOM 包围盒断言, 不依赖 WebGL 渲染, CI 可跑。
 * 服务器: http://192.168.5.94:4173
 */
test.describe("cardia 面板不遮挡心脏", () => {
  const SIZES: [string, number, number][] = [
    ["iPhone SE", 375, 667],
    ["iPhone 12", 390, 844],
    ["小屏", 360, 740],
    ["大屏手机", 414, 896],
    ["320", 320, 568],
    ["横屏矮屏", 844, 390],
  ];
  async function measure(page: Page) {
    return page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      // 心脏置信区: 视口中心偏下(相机居中, 模型在场景原点), 上界 30% 下界 82%
      const heart = {
        l: Math.round(vw * 0.22), r: Math.round(vw * 0.78),
        t: Math.round(vh * 0.30), b: Math.round(vh * 0.82),
      };
      const box = (id: string) => {
        const e = document.getElementById(id);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
      };
      const ov = (a: any, b: any) => !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
      const panels = { survey: box("survey"), macro: box("macro") };
      const hits: string[] = [];
      for (const k of Object.keys(panels)) {
        const p = panels[k as keyof typeof panels];
        if (p && ov(p, heart)) {
          const area = (Math.min(p.r, heart.r) - Math.max(p.l, heart.l)) *
                       (Math.min(p.b, heart.b) - Math.max(p.t, heart.t));
          hits.push(`${k}:${area}px²`);
        }
      }
      return { vw, vh, heart, panels, hits };
    });
  }

  for (const [name, w, h] of SIZES) {
    test(`${name} (${w}x${h}) 面板不侵入心脏区`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("http://192.168.5.94:4173/");
      await page.waitForTimeout(1500);
      const { hits } = await measure(page);
      expect(hits, `面板不应遮挡心脏, 实际重叠: ${hits.join(", ")}`).toEqual([]);
    });
  }

  test("面板底边严格在心脏区上界之上(留缓冲)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://192.168.5.94:4173/");
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const vh = innerHeight;
      const heartTop = Math.round(vh * 0.30);
      const box = (id: string) => {
        const e = document.getElementById(id)!;
        return Math.round(e.getBoundingClientRect().bottom);
      };
      return { heartTop, surveyB: box("survey"), macroB: box("macro") };
    });
    // 面板底边应 ≤ 心脏区上界, 且留 ≥12px 缓冲
    expect(r.surveyB, "survey 底边应在心脏区上界之上并留缓冲").toBeLessThanOrEqual(r.heartTop - 12);
    expect(r.macroB, "macro 底边应在心脏区上界之上并留缓冲").toBeLessThanOrEqual(r.heartTop - 12);
  });
});
