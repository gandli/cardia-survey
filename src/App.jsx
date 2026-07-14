import { useEffect, useRef } from 'react';
import { HeartEngine } from './engine/heartEngine.js';

export default function App() {
  const rootRef = useRef(null);

  useEffect(() => {
    const engine = new HeartEngine(rootRef.current);
    return () => engine.destroy();
  }, []);

  return (
    <div id="stage" ref={rootRef}>
      <div id="rockshadow"></div>
      <canvas id="gl"></canvas>
      <svg id="overlay-svg">
        <defs>
          <filter id="halo" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.4" flood-color="#f6f4ef" flood-opacity="0.95" />
          </filter>
        </defs>
        <g id="scanline-grp">
          <path id="scanline" />
          <path id="scanline-halo" />
        </g>
        <g id="reticle">
          <circle id="ret-outer" r="14" />
          <circle id="ret-ring" r="6" />
          <line x1="-10" y1="0" x2="-4" y2="0" />
          <line x1="10" y1="0" x2="4" y2="0" />
          <line x1="0" y1="-10" x2="0" y2="-4" />
          <line x1="0" y1="10" x2="0" y2="4" />
        </g>
      </svg>

      <div className="panel" id="survey">
        <div className="hd">
          <span className="lft"><span className="dot" id="survey-dot"></span> 心脏检查</span>
          <span id="scan-state">扫描中</span>
        </div>
        <div className="bd">
          <div id="progress">
            <i></i><i></i><i></i><i></i><i></i><i></i>
          </div>
          <div className="row">
            <span className="lbl">切面</span>
            <span id="spec-count">切面 01 / 06</span>
          </div>
          <div className="row big">
            <span id="spec-name-txt">—</span>
          </div>
          <div id="spec-desc" className="desc">—</div>
          <svg id="ecg" viewBox="0 0 214 30" preserveAspectRatio="none">
            <polyline id="ecg-line" points="" />
            <circle id="ecg-dot" cx="214" cy="15" r="2" />
          </svg>
          <div className="meters">
            <div className="meter">
              <span className="ml">灌注</span>
              <div className="bar"><div id="bar-vit" className="fill vit"></div></div>
              <span id="val-vit" className="mv">0.00</span>
            </div>
            <div className="meter">
              <span className="ml">显影</span>
              <div className="bar"><div id="bar-lum" className="fill lum"></div></div>
              <span id="val-lum" className="mv">0.00</span>
            </div>
            <div id="meter-tox" className="meter">
              <span className="ml">钙化</span>
              <div className="bar"><div id="bar-tox" className="fill tox"></div></div>
              <span id="val-tox" className="mv">0.00</span>
            </div>
          </div>
          <div className="ft"><span id="pos-txt">位置 0000 · 0000</span><span id="alt-txt">Ø 0000</span></div>
        </div>
      </div>

      <div className="panel" id="macro">
        <div className="hd"><span className="lft">显微观测</span><span id="macro-mode">跟踪中</span></div>
        <div className="bd">
          <div className="win-row">
            <div className="side"></div>
            <div id="macro-window">
              <span className="corner tl"></span><span className="corner tr"></span>
              <span className="corner bl"></span><span className="corner br"></span>
              <div id="macro-cross"></div>
              <div id="macro-flash"></div>
            </div>
            <div className="side"></div>
          </div>
          <div className="strip btm"></div>
          <div className="ft"><span id="mag-txt">放大 2.24×</span><span id="sp-txt">SP-01</span></div>
        </div>
      </div>

      <div id="brand">◦ 心脏检查 · 心研-01</div>
      <button id="rec-btn">● 录制</button>
      <button id="replay-btn">↻ 重播</button>
      <button id="audio-btn">声音 关</button>
      <div id="audio-hint">点击启用声音</div>

      <div id="complete">检查完成<div className="sub">06 切面已采集 · 标本存活</div></div>
      <div id="loading">影像校准中…</div>
      <div id="vignette"></div>
      <div id="grain"></div>
    </div>
  );
}
