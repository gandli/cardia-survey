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
    if (!box) continue; // display:none 时跳过
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

// F: macro wrapper 必须透明 + macro-window 到 macro 之间每一层父容器透明 (否则遮挡 canvas 心脏特写)
test('F: macro 面板外层透明, 内部条带有底色', async ({ page }) => {
  const info = await page.evaluate(() => {
    const macro = document.querySelector('#macro') as HTMLElement;
    const win = document.querySelector('#macro-window') as HTMLElement;
    const s = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
    const chain: { tag: string; id: string; bg: string }[] = [];
    let el: HTMLElement | null = win;
    while (el && el !== macro) {
      chain.push({ tag: el.tagName, id: el.id || '', bg: s(el) });
      el = el.parentElement;
    }
    return { macroBg: s(macro), winBg: s(win), chain };
  });
  const transparent = /rgba?\(0,\s*0,\s*0,\s*0\)|transparent/;
  expect(info.macroBg, `macroBg=${info.macroBg}`).toMatch(transparent);
  expect(info.winBg, `winBg=${info.winBg}`).toMatch(transparent);
  for (const c of info.chain) {
    expect(c.bg, `${c.tag}#${c.id} bg=${c.bg} 遮挡显微图像`).toMatch(transparent);
  }
});

// H: 面板标题/元信息不折行 (证明面板宽度合理)
test('H: 面板核心文本不折行', async ({ page }) => {
  const info = await page.evaluate(() => {
    const check = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight);
      const height = el.getBoundingClientRect().height;
      return { sel, height, lineHeight, ratio: height / lineHeight };
    };
    return [
      check('#survey .hd-title'),
      check('#macro .hd-title'),
      check('#spec-count'),
      check('#macro-mode'),
      check('#scan-state'),
    ];
  });
  for (const r of info) {
    if (!r) continue;
    expect(r.ratio, `${r.sel} h=${r.height} lh=${r.lineHeight} ratio=${r.ratio.toFixed(2)} (>1.6 说明折行)`).toBeLessThan(1.6);
  }
});

// I: 4 个 HUD 按钮之间不重叠, 且与其它面板不重叠
test('I: HUD 按钮互不重叠, 也不叠加 macro/survey 面板', async ({ page }) => {
  const rects = await page.evaluate(() => {
    const ids = ['rec-btn', 'replay-btn', 'audio-btn', 'audio-hint', 'macro', 'survey'];
    return ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // 排除入场未完成的
      if (getComputedStyle(el).opacity === '0') return null;
      return { id, l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
  });
  const boxes = rects.filter(Boolean) as { id: string; l: number; t: number; r: number; b: number }[];
  const overlap = (a: typeof boxes[0], b: typeof boxes[0]) => {
    const ix = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
    const iy = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    return ix * iy;
  };
  const btns = boxes.filter(b => ['rec-btn', 'replay-btn', 'audio-btn'].includes(b.id));
  // 按钮两两之间
  for (let i = 0; i < btns.length; i++)
    for (let j = i + 1; j < btns.length; j++)
      expect(overlap(btns[i], btns[j]), `${btns[i].id} × ${btns[j].id}`).toBe(0);
  // hint 不能和其它按钮重叠
  const hint = boxes.find(b => b.id === 'audio-hint');
  if (hint) for (const b of btns) expect(overlap(hint, b), `audio-hint × ${b.id}`).toBe(0);
  // 按钮不能压在 macro/survey 面板上
  const panels = boxes.filter(b => ['macro', 'survey'].includes(b.id));
  for (const btn of btns)
    for (const p of panels)
      expect(overlap(btn, p), `${btn.id} × ${p.id}`).toBe(0);
});

// G: macro corner brackets 4 个齐全且未被裁切 (只在 macro 可见时校验)
test('G: macro corner brackets 4 个齐全且未被裁切', async ({ page }) => {
  const macroVisible = await page.evaluate(() => {
    const el = document.getElementById('macro');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  if (!macroVisible) return; // 手机端 macro 隐藏, 跳过
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

    // J: a11y — 3 个按钮都有 accessible name + type=button; canvas 有 aria-label
    test('J: 按钮有 accessible name, canvas 有 aria-label', async ({ page }) => {
    const audit = await page.evaluate(() => {
    const ids = ['rec-btn', 'replay-btn', 'audio-btn'];
    const btns = ids.map(id => {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (!el) return { id, missing: true };
    return {
      id,
      type: el.type,
      ariaLabel: el.getAttribute('aria-label'),
      hasVisibleText: (el.textContent || '').trim().length > 0,
    };
    });
    const canvas = document.getElementById('gl');
    return {
    btns,
    canvasAriaLabel: canvas?.getAttribute('aria-label'),
    };
    });
    for (const b of audit.btns) {
    expect(b, `btn ${b.id}`).not.toHaveProperty('missing', true);
    expect(b.type, `${b.id}.type`).toBe('button');
    // accessible name = aria-label (若无则回退到 textContent, 但按规范必须有 aria-label)
    expect(b.ariaLabel, `${b.id} 缺 aria-label`).toBeTruthy();
    }
    expect(audit.canvasAriaLabel, 'canvas #gl 缺 aria-label').toBeTruthy();
    });

    // K: 按钮触摸目标最小尺寸 (WCAG 2.5.5 建议 44×44 CSS px)
    test('K: 按钮触摸目标 ≥44×44', async ({ page }) => {
    for (const id of ['rec-btn', 'replay-btn', 'audio-btn']) {
    const box = await page.locator('#' + id).boundingBox();
    if (!box) continue;
    expect(box.width, `${id}.w`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${id}.h`).toBeGreaterThanOrEqual(44);
    }
    });
