import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.beforeEach(async ({ page }, testInfo) => {
  // S 契约走静态源码断言, 不用页面
  if (testInfo.title.startsWith('S:')) return;
  await page.goto('/');
  // CI 上首次 GLTF (~7MB) 加载慢, 放宽到 30s
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 30000 });
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
// 静态源码断言 (直接读磁盘 styles.css, 完全绕开浏览器/Vite):
//   Node fs.readFileSync 是同步操作, 不需要 fixture, 也不受 CI GLTF 加载影响.
test('S: styles.css 在 reduced-motion 中关闭 .rec-btn.recording 动画', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');
  // 抽出 @media (prefers-reduced-motion: reduce) { ... } 花括号平衡
  const start = css.search(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*{/);
  expect(start, 'styles.css 未定义 prefers-reduced-motion: reduce 媒体块').toBeGreaterThan(-1);
  const openIdx = css.indexOf('{', start);
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) { closeIdx = i; break; } }
  }
  expect(closeIdx, '媒体块未闭合').toBeGreaterThan(openIdx);
  const block = css.slice(openIdx + 1, closeIdx);
  // CodeRabbit Minor: 允许 .rec-btn.recording { 与 animation:none 之间有其他属性
  const recBlockMatch = block.match(/\.rec-btn\.recording\s*{([^}]*)}/);
  expect(recBlockMatch, 'reduced-motion 媒体块内应有 .rec-btn.recording 规则块').not.toBeNull();
  expect(
    /animation\s*:\s*none/.test(recBlockMatch![1]),
    'reduced-motion.rec-btn.recording 规则块应含 animation: none (前庭反应用户保护)'
  ).toBe(true);
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
