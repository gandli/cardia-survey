import { test, expect, type Page } from "@playwright/test";

/**
 * cardia-survey 移动端: 面板(卡片)与心脏的关系, 分两档目标:
 *  - 高屏(高度≥560, 如手机竖屏/桌面): 面板不得侵入心脏置信区(屏幕中心 28%-82%)
 *  - 矮屏(高度<560, 如横屏手机/极小竖屏): 垂直空间不足以两全, 优先"显示全"(不裁切)
 * 心脏置信区基于相机居中不变量(模型在场景原点), 纯 DOM 包围盒断言, CI 可跑。
 * 服务器: http://192.168.5.94:4173
 */
test.describe("cardia 面板与心脏", () => {
  const SIZES: [string, number, number, "tall" | "short"][] = [
    ["iPhone SE", 375, 667, "tall"],
    ["iPhone 12", 390, 844, "tall"],
    ["小屏", 360, 740, "tall"],
    ["大屏手机", 414, 896, "tall"],
    ["平板竖", 700, 900, "tall"],
    ["320", 320, 568, "short"],
    ["横屏手机", 844, 390, "short"],
  ];
  async function measure(page: Page) {
    return page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const heart = {
        l: Math.round(vw * 0.22), r: Math.round(vw * 0.78),
        t: Math.round(vh * 0.28), b: Math.round(vh * 0.82),
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

  for (const [name, w, h, tier] of SIZES) {
    test(`${name} (${w}x${h}) [${tier}]`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("http://192.168.5.94:4173/");
      await page.waitForTimeout(1500);
      if (tier === "tall") {
        const { hits } = await measure(page);
        expect(hits, `面板不应遮挡心脏, 实际重叠: ${hits.join(", ")}`).toEqual([]);
      } else {
        const r = await page.evaluate(() => {
          const panel = document.getElementById("survey")!;
          const pb = panel.getBoundingClientRect();
          const ids = ["progress", "spec-name-txt", "ecg", "val-vit", "val-lum", "val-tox"];
          let clip = 0;
          for (const id of ids) {
            const e = document.getElementById(id);
            if (!e) continue;
            const b = e.getBoundingClientRect();
            if (b.width === 0 && b.height === 0) continue; // 被祖先 display:none 隐藏的指标行
            if (b.bottom > pb.bottom + 0.5 || b.top < pb.top - 0.5) clip++;
          }
          return { clip };
        });
        expect(r.clip, `面板内容不应被裁切, 裁切元素数: ${r.clip}`).toBe(0);
      }
    });
  }
});
