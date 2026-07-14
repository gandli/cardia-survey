# 心脏检查 · 心研-01 (cardia-survey)

基于 [carolinacherry/cardia-survey](https://github.com/carolinacherry/cardia-survey) 的本地化重构版本：
Vite + React 工程，中文界面、医学化语境（心脏检查）、移动端自适应。

## 技术栈
- Vite 5 + React 18
- three 0.160（3D 心脏渲染、扫描高亮着色器）
- Web Audio API（全部音效合成，无外部音频文件）

## 本地运行
```bash
bun install        # 或 npm install
bun run dev        # 开发服务器 http://localhost:5173
bun run build      # 生产构建到 dist/
bun run preview    # 预览构建产物（--host 可局域网访问）
```

## 目录结构
```
src/
  main.jsx                  React 入口
  App.jsx                   HUD DOM 骨架 + 挂载引擎
  engine/heartEngine.js     Three.js + WebAudio + 状态机 + 渲染循环（原逻辑封装为类）
  data/specimens.js         心脏标本序列（中文医学化）
  styles.css                样式 + 移动端媒体查询
public/assets/heart.glb     3D 心脏模型
```

## 适配说明
- 宽屏（>700 且高>480）：走作者原尺寸布局
- 高屏手机：面板置于顶部两角，不侵入心脏区
- 矮屏/横屏：面板显示完整内容（不裁切）

## 说明
- 原始项目为第三方开源 demo，本仓库在其基础上做中文化、医学语境替换与工程化重构，
  产品交互逻辑与原作一致。
- 声音需在页面内点击「声音 关」按钮启用（浏览器自动播放策略）。
