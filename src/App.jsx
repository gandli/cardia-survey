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
        {/* 底层光晕(浅色)扩边: 让暗色引导线在深色心脏上仍可读 */}
        <path id="scanline-halo" fill="none" stroke="rgba(246,244,239,0.9)" strokeWidth="2.6"
          strokeDasharray="1.5 5.5" style={{ mixBlendMode: 'screen' }} />
        <path id="scanline" fill="none" stroke="rgba(46,42,36,0.92)" strokeWidth="1.1"
          strokeDasharray="1.5 5.5" filter="url(#halo)" />
        <g id="reticle" opacity="0" filter="url(#halo)">
          <circle r="8.6" fill="none" stroke="rgba(246,244,239,0.9)" strokeWidth="2.4" />
          <circle id="ret-outer" r="8" fill="none" stroke="rgba(46,42,36,0.95)" strokeWidth="1.1" />
          <circle id="ret-inner" r="1.6" fill="rgba(46,42,36,0.95)" />
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
          <div id="spec-count">切面 01 / 06</div>
          <div id="spec-name"><span id="spec-name-txt"></span><span className="cursor"></span></div>
          <div id="spec-desc"></div>
          <svg id="ecg" viewBox="0 0 214 30" preserveAspectRatio="none">
            <polyline id="ecg-line" points="" />
            <circle id="ecg-dot" cx="214" cy="15" r="2" />
          </svg>
          <div className="meters">
            <div className="meter">
              <span>灌注</span>
              <span className="track"><span className="fill" id="bar-vit"></span></span>
              <span className="val" id="val-vit">0.00</span>
            </div>
            <div className="meter">
              <span>显影</span>
              <span className="track"><span className="fill" id="bar-lum"></span></span>
              <span className="val" id="val-lum">0.00</span>
            </div>
            <div className="meter" id="meter-tox">
              <span>钙化</span>
              <span className="track"><span className="fill" id="bar-tox"></span></span>
              <span className="val" id="val-tox">0.00</span>
            </div>
          </div>
          <div className="ft"><span id="pos-txt">位置 0000 · 0000</span><span id="alt-txt">Ø 0000</span></div>
        </div>
      </div>

      <div className="panel" id="macro">
        <div className="hd">
          <span className="lft"><span className="dot"></span> 显微观测</span>
          <span id="macro-mode">跟踪中</span>
        </div>
        <div className="strip"></div>
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
