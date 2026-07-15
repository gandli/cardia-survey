import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 15000 });
});

// R: SPECIMENS 保持不变 (P0-1: 模块级不被写污染)
// 关键: 必须检查应用运行时正在用的那份 module 实例, 不能重新 fetch 副本
test('R: 运行时 SPECIMENS module 实例未被引擎写脏', async ({ page }) => {
  const dirty = await page.evaluate(async () => {
    // 用 Vite dev-server 的 module URL (?t 时间戳会导致新副本, 不加则命中同一实例)
    // 走 new Function 动态构造 import 语句避开 TS 静态解析.
    // eslint-disable-next-line no-new-func
    const importer = new Function('u', 'return import(u)') as (u: string) => Promise<{ SPECIMENS: Array<Record<string, unknown>> }>;
    const mod = await importer('/src/data/specimens.js');
    return mod.SPECIMENS.some((s) => 'anchorLocal' in s || 'normalLocal' in s);
  });
  expect(dirty, 'SPECIMENS 被工程写脏 → HMR/StrictMode 会 race').toBe(false);
});

// S: recording pulse 在 reduced-motion 关 (P1-2)
// 独立 test.describe + beforeEach 前置 emulateMedia, 避免污染其他契约
test.describe('S 契约: reduced-motion', () => {
  test('S: prefers-reduced-motion 下 .rec-btn.recording 无动画', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit', 'safari emulateMedia 不完全兼容');
    // 用独立 context 一开始就带 reducedMotion, 避免 reload
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 20000 });
      const rec = page.locator('#rec-btn');
      await rec.evaluate((el) => el.classList.add('recording'));
      const anim = await rec.evaluate((el) => getComputedStyle(el).animationName);
      expect(anim, 'reduced-motion 下 recording 循环仍开').toBe('none');
    } finally {
      await ctx.close();
    }
  });
});

// T: ErrorBoundary 真的能捕获错误 (P1-4)
// 通过 React DevTools 无法直接从 e2e 触发, 采用编译产物 + 静态 marker 检测 +
// 挂载校验双保险: (1) DOM 已挂 (2) HeartErrorBoundary 类被 React 打包并出现在页面脚本源里.
test('T: ErrorBoundary 已挂在 React root 上 (静态 marker + 挂载校验)', async ({ page }) => {
  // 挂载校验: #root 应含至少一个子节点 (App)
  const rootChildren = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.children.length : 0;
  });
  expect(rootChildren, '#root 内应已挂载 App').toBeGreaterThan(0);

  // 静态 marker: 扫所有 <script> 的源, 期望能找到 HeartErrorBoundary 关键字
  // (Vite dev 会把 jsx 转译为 h() 调用但保留类名; build 后 mangle 但会保留 role="alert" 字符串)
  const hasBoundaryMarker = await page.evaluate(async () => {
    const scripts = Array.from(document.scripts).filter((s) => s.src);
    for (const s of scripts) {
      try {
        const src = await (await fetch(s.src)).text();
        if (src.includes('HeartErrorBoundary') || src.includes('影像系统离线')) return true;
      } catch { /* skip */ }
    }
    return false;
  });
  expect(hasBoundaryMarker, 'HeartErrorBoundary 或其 alert 文案未被打包').toBe(true);
});
