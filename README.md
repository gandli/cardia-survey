# cardia-survey · 心脏检查 · 心研-01

> Vite + React 19 + Tailwind v4 + Three.js。浏览器里跑的仿科幻医学"心脏检查"演示 —— 3D 心脏 + HUD + ECG + 显微特写 + 音频合成，全部在客户端渲染。

**上游**: [carolinacherry/cardia-survey](https://github.com/carolinacherry/cardia-survey)。本 fork 完成 Vite + React 移植、中文医学化、响应式契约测试（102 e2e），以及三次 UI/UX 审计。

## 快速开始

```bash
bun install
bun run dev            # 5173, --host 0.0.0.0
bun run build          # 输出 dist/
bun run preview        # 4173 本地预览 build 产物

bunx playwright test   # e2e 响应式契约 (14 + 3 + 3 契约 × 6 视口)
```

依赖：`bun ≥ 1.0`（或 `pnpm/npm` 也行，但 CI 用 bun）。

## 目录

```
src/
  App.jsx                  # HUD 布局 + Tailwind class 契约
  main.jsx                 # 挂载点 + ErrorBoundary
  engine/heartEngine.js    # Three.js 主渲染 + Audio + Recording
  data/specimens.js        # 6 个心脏切面数据 (不可变)
  components/              # ErrorBoundary 等
  styles.css               # 全局 + reduced-motion + 短屏兜底
e2e/
  responsive.spec.ts       # 14 契约 A-K (面板/按钮/文本/触摸目标 …)
  lmn.spec.ts              # 3 契约 (对比度 / mini-strip / 行高)
  opq.spec.ts              # 3 契约 (ECG HR 数值 / 品牌字号 / macro 刻度尺)
```

## 响应式契约（e2e 保底 102/102）

6 视口：`phone-390 · tablet-768 · laptop-1280 · desktop-1440 · wide-2560 · landscape-800×480`。

契约覆盖：布局零遮挡、面板/按钮/文本不折行、macro corner brackets 齐全、a11y accessible name、触摸目标 ≥44、按钮对比度 ≥3:1、landscape mini-strip 保留 HR/vit/lum/tox、macro hd/ft 行高统一、macro-window 上/右刻度尺 …

## 无障碍

- `prefers-reduced-motion`: 停 grain / dot / cursor / rec::before / `.rec-btn.recording` 循环动画
- `prefers-color-scheme`: 暖色调米黄底，深灰前景，AA 对比度
- ARIA: canvas `role="img"` + aria-label，按钮 `aria-label` + `aria-pressed`，audio-hint `role="note"` + `aria-describedby`
- 触摸目标: 全按钮 ≥44×92px（xl ≥52×112）
- Focus ring: `focus-visible:ring-2` 键盘可见

## 部署

CF Workers 临时预览（无凭证）：

```bash
bun run build && bunx wrangler deploy --temporary
```

## 审计报告

`.audit-reports/` 目录保存历次审计白皮书（fuck-my-shit-mountain skill）。

## License

MIT（继承上游）
