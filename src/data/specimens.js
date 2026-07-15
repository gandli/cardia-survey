// 心脏检查标本序列（医学化 · 档位B）
// 字段与原引擎一致: a=锚点局部方向, macroDist=宏镜头距离
// vit=灌注度 lum=显影 tox=钙化（0..1）
export const SPECIMENS = [
  { name: '升主动脉', desc: '大血管 · 流出道',
    vit: 0.88, lum: 0.20, tox: 0.06, a: [0.10, 0.92, 0.05], macroDist: 1.15 },
  { name: '右心房', desc: '右心房 · 静脉回流',
    vit: 0.81, lum: 0.14, tox: 0.10, a: [0.62, 0.34, 0.20], macroDist: 1.05 },
  { name: '左心室', desc: '左心室 · 心肌',
    vit: 0.94, lum: 0.22, tox: 0.04, a: [-0.55, -0.10, 0.30], macroDist: 1.0 },
  { name: '冠状动脉', desc: '冠脉沟 · 灌注',
    vit: 0.76, lum: 0.31, tox: 0.18, a: [0.15, 0.05, 0.72], macroDist: 0.9 },
  { name: '左心耳', desc: '左心耳 · 小梁',
    vit: 0.72, lum: 0.17, tox: 0.22, a: [-0.48, 0.44, 0.35], macroDist: 0.95 },
  { name: '心尖', desc: '心尖 · 收缩',
    vit: 0.90, lum: 0.26, tox: 0.05, a: [-0.05, -0.86, 0.10], macroDist: 1.05 },
];
