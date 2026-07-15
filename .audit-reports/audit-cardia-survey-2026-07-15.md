# 审计白皮书 · cardia-survey

**审计日期**: 2026-07-15  
**审计模式**: full (deep scan)  
**Commit**: c9cb9bc (main)  
**审计者**: Hermes Agent + fuck-my-shit-mountain skill  

---

## TL;DR 综合评分

| 维度 | 分数 | 等级 | 一句话 |
|:---|---:|:---:|:---|
| 架构 (Architecture) | 7.5 | B+ | 单页 + React 挂载 + 引擎类分离清晰；模块级 SPECIMENS 状态污染是唯一硬伤 |
| 安全 (Security) | 8.5 | A- | 无网络请求、无用户输入，仅本地静态资源；Google Fonts 是唯一外部 |
| 稳定 (Stability) | 6.5 | B- | 引擎 destroy 已修，但 recAutoStop / _animNum 仍有边界；无错误边界 |
| 性能 (Performance) | 6.0 | C+ | 725KB / gzip 197KB 单 chunk，three.js 全量打包无按需 |
| 可维护 (Maintainability) | 7.0 | B | App.jsx 237 行 OK，engine 610 行偏大（Audio/HUD/Render 未分层） |
| 测试 (Testing) | 8.0 | A- | 102/102 e2e 全绿，17 契约覆盖全响应式；缺单测但对纯视觉项目可接受 |
| 无障碍 (A11y/Motion) | 7.5 | B+ | ARIA 齐备、触摸目标 44+、对比度 AA；但 recpulse 未在 reduced-motion 关 |
| 文档 (Documentation) | 5.0 | C | README 是上游英文原文，未更新 Vite/React 工程；无 CHANGELOG/CONTRIBUTING |
| 发布 (Release) | 4.0 | D+ | 无 CI/CD、无 lint、无 dependabot、无 SECURITY.md；bun.lock 已锁 |
| 配置 (Configuration) | 8.0 | A- | vite/playwright config 简洁合理；无环境变量 |

**综合评分: 68 / 100 · C+**

**技术债估算**: 约 12-16 工时（P0 3h + P1 6h + P2 5h）。

**统计**: P0 × 3 · P1 × 6 · P2 × 8 · 共 17 findings

---

## Findings 汇总表

### 🔴 P0 (阻断) × 3

| # | 维度 | 文件:行 | 问题 | 修复 | 工时 |
|:---:|:---|:---|:---|:---|---:|
| P0-1 | 稳定 | src/data/specimens.js + engine:128-141 | SPECIMENS 是模块级 singleton，engine 每次挂载都写回 `s.anchorLocal/normalLocal`。React StrictMode 双挂载 / HMR / Fast Refresh 时前一实例的 destroy 与新实例的 loader 回调 race，写乱同一对象 | 引擎内维护 `this.anchors = new Map<name, {anchorLocal, normalLocal}>()`，不污染源数据 | 40m |
| P0-2 | 发布 | 无 .github/ | 项目零 CI：无 build check、无 test gate、无 lint、无 secret scan、无 dependabot。任何 PR 合并都靠人肉本地跑测 | 加 `.github/workflows/ci.yml` 跑 `bun install / build / playwright test`；加 `.github/dependabot.yml` 每周 minor+patch | 60m |
| P0-3 | 稳定 | engine.js:286 | `recAutoStop = setTimeout(stopRecording, 33000)` 未被 destroy 清理。用户开录后立即关标签或 SPA 卸载 → 33s 后仍触发 stopRecording，但此时 mediaRec 已断，抛错 | destroy 里 `clearTimeout(this._recAutoStop)`；把 recAutoStop 提到 this.* | 15m |

### 🟡 P1 (严重) × 6

| # | 维度 | 文件:行 | 问题 | 修复 | 工时 |
|:---:|:---|:---|:---|:---|---:|
| P1-1 | 性能 | vite.config.js | 无 manualChunks / 无 code split，three.js 与 App 全量打成 725KB 单 chunk（gzip 197KB），首屏拉满 | `build.rollupOptions.output.manualChunks: { three: ['three', 'three/addons/loaders/GLTFLoader.js'] }`，让 three 单独出 chunk（可长期缓存） | 30m |
| P1-2 | 无障碍 | styles.css:151, 220-227 | `.rec-btn.recording { animation: recpulse infinite }` 未在 `prefers-reduced-motion` 中关闭。启用录制后前庭反应用户仍暴露于每 1.1s 闪烁 | reduced-motion 块加 `.rec-btn.recording { animation: none !important }` | 5m |
| P1-3 | 稳定 | engine.js:262 | `getDisplayMedia({ audio: false })` 硬编码，audio 由 Audio.captureStream 单独合流。但若用户先按录制后按 Escape，`recDisplay` 未 stop，屏幕录制指示灯持续亮着直到关标签 | startRecording 的 catch / stopRecording 兜底都 `recDisplay?.getTracks().forEach(t=>t.stop())` | 20m |
| P1-4 | 稳定 | src/App.jsx:16-21 | 无 ErrorBoundary。GLTF 404、WebGL 上下文丢失、AudioContext 被浏览器策略拒绝时页面白屏，无兜底文案 | 加 `<ErrorBoundary>` 包裹 App，fallback "影像系统离线，请刷新" | 40m |
| P1-5 | 可维护 | engine.js 全文 610 行 | Audio/HUD/Render/Recording/GLTF 全塞一个类。修一处需读全文；未来加多标本、切换镜头等功能会指数级恶化 | 拆 `audio.js` / `recording.js` / `hud.js` / 保留 `heartEngine.js` 主渲染。零逻辑变更的 file split | 3h |
| P1-6 | 文档 | README.md | README 仍是上游 carolinacherry 英文原文（demo link 指旧地址 / 装作是单 HTML 文件）。实际已是 Vite + React 工程 | 重写 README：中文、Vite 工作流、bun 指令、e2e 契约、部署 CF | 45m |

### 🟢 P2 (优化) × 8

| # | 维度 | 文件:行 | 问题 | 修复 | 工时 |
|:---:|:---|:---|:---|:---|---:|
| P2-1 | 发布 | package.json | 无 scripts.test / scripts.lint / scripts.typecheck；build 无 preflight | 加 `test: "playwright test"` / `lint: "eslint src e2e"` / `check: "bun run lint && bun run build && bun run test"` | 20m |
| P2-2 | 可维护 | 无 eslint 配置 | 无 lint 门禁，未来贡献者可提任意风格 | 加 `eslint.config.js`（flat config）+ eslint-plugin-react-hooks | 30m |
| P2-3 | 稳定 | engine.js:276 | `URL.revokeObjectURL(url)` 用 setTimeout 4s，但 `document.createElement('a').click()` 后无引用防 GC | 用 hidden anchor + 保留 refs 到 blob 下载完成事件（`revokeObjectURL` on `visibilitychange`） | 20m |
| P2-4 | 安全 | index.html:9-13 | Google Fonts 无 CSP，也无 SRI；`preconnect` 走 http（浏览器会自动升级但仍打印告警） | 加 `<meta http-equiv="Content-Security-Policy">` 白名单 fonts.gstatic + self；可选本地化字体子集 | 30m |
| P2-5 | 可维护 | App.jsx:23-34 | buttonBase / hdCls 是长字符串拼接的 tailwind class，无 IDE 补全，也重复出现 3 次 | 抽 `<HudButton>` 组件；hdCls 抽 `<PanelHeader>` | 40m |
| P2-6 | 无障碍 | App.jsx:82, 96, 100 | `.dot` / `.cursor` 是纯装饰但用了 `.hd-title` 分组容器无 role；HUD 数字变化未 aria-live | `#spec-name` 加 `aria-live="polite"`；scan-state 加同类 | 15m |
| P2-7 | 测试 | e2e/*.spec.ts | 无 unit test；engine 的 `_animNum` / `_scrambleTo` / `updateHr` 逻辑无契约锁死 | 加 vitest + 补 3-5 个纯函数单测（ecgValue / beatContract / updateHr） | 1h |
| P2-8 | 发布 | 无 CHANGELOG.md / SECURITY.md / CONTRIBUTING.md | 治理三件套缺失 | 加最简三件套（10 行版） | 25m |

---


