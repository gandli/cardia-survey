import { useEffect, useRef } from 'react';
import { HeartEngine } from './engine/heartEngine.js';

/**
 * 布局契约 (E2E 验证):
 *   心脏投影区 = 视口 x∈[32%, 68%] y∈[20%, 88%], 面板与其零交叠
 *   → 面板固定在左右角上部, 用 max-w + max-h 保证不侵入
 *
 * 断点策略 (Tailwind 默认):
 *   base   (<640) 手机竖屏: 面板顶部左右各一, 宽 min(38vw, 168px), 高 30vh 封顶
 *   sm    (≥640) 平板/横屏: 宽 clamp(160, 22vw, 220), 高 34vh
 *   md    (≥768) 笔记本    : 宽 clamp(200, 20vw, 250), 高 40vh
 *   lg    (≥1024)         : 宽 240, 高 44vh, 位置更靠近安全区
 *   xl    (≥1280)         : 宽 250, 高 auto (原设计尺寸)
 */
export default function App() {
  const rootRef = useRef(null);
  useEffect(() => {
    const engine = new HeartEngine(rootRef.current);
    return () => engine.destroy();
  }, []);

  // 面板通用类: 半透明底 / 深色边 / 等宽字 / 层级高于 canvas
  const panelBase =
    'panel fixed z-30 bg-[var(--color-panel-bg)] border border-[var(--color-panel-line)] ' +
    'text-[var(--color-ink)] font-mono text-[10px] tracking-[0.08em] ' +
    'shadow-[0_18px_50px_rgba(40,36,30,0.25)] overflow-hidden';

  const hdCls =
    'flex justify-between items-center px-2.5 py-2 border-b border-[var(--color-panel-line)] ' +
    'text-[9px] tracking-[0.22em] text-[var(--color-ink-dim)]';

  const buttonBase =
    'fixed z-40 font-mono text-[9px] tracking-[0.24em] text-[rgba(62,66,76,0.85)] ' +
    'bg-transparent border border-[rgba(62,66,76,0.35)] px-3 py-1.5 cursor-pointer ' +
    'hover:bg-[rgba(62,66,76,0.08)] hover:text-[#22262e] active:scale-[0.98] transition-colors ' +
    'min-h-[36px] flex items-center justify-center';

  return (
    <div id="stage" ref={rootRef} className="fixed inset-0">
      {/* 心脏投影阴影 */}
      <div
        id="rockshadow"
        className="absolute left-1/2 top-[74%] w-[34vmin] h-[7vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[6px]"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(46,49,60,0.32), rgba(46,49,60,0) 70%)' }}
      />

      {/* WebGL canvas */}
      <canvas id="gl" className="absolute inset-0 w-full h-full block" />

      {/* Overlay SVG: 引导线 + reticle */}
      <svg id="overlay-svg" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <filter id="halo" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.4" flood-color="#f6f4ef" flood-opacity="0.95" />
          </filter>
        </defs>
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

      {/* 左面板: 心脏检查 */}
      <div
        id="survey"
        className={
          panelBase +
          // 位置: 顶部小屏, 侧栏中位大屏
          ' left-3 top-9 ' +
          'sm:left-4 sm:top-10 ' +
          'md:left-6 md:top-1/2 md:-translate-y-1/2 ' +
          'lg:left-[clamp(12px,5vw,90px)] ' +
          // 宽度 (手机严守 <113px 以留出 zone.l 12+113=125)
          'w-[26vw] max-w-[108px] ' +
          'sm:w-[24vw] sm:max-w-[220px] ' +
          'md:w-[240px] lg:w-[250px] ' +
          // 高度 (硬约束: 底边不进心脏区 y<20%vh)
          'max-h-[14vh] sm:max-h-[32vh] md:max-h-none'
        }
      >
        <div className={hdCls}>
          <span className="flex items-center gap-1.5"><span className="dot" id="survey-dot"></span> 心脏检查</span>
          <span id="scan-state">扫描中</span>
        </div>
        <div className="px-3 pt-2.5 pb-3">
          <div id="progress" className="flex gap-[3px] mb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <i key={i} className="flex-1 h-[2px] bg-white/10"></i>
            ))}
          </div>
          <div id="spec-count" className="text-[8.5px] tracking-[0.26em] text-[var(--color-ink-dim)] mb-1.5">
            切面 01 / 06
          </div>
          <div
            id="spec-name"
            className="text-[15px] tracking-[0.03em] font-medium text-[#f0f3ee] min-h-[22px] whitespace-nowrap"
          >
            <span id="spec-name-txt"></span>
            <span className="cursor"></span>
          </div>
          <div id="spec-desc" className="text-[8.5px] tracking-[0.14em] text-[var(--color-ink-dim)] my-1 min-h-[11px] hidden sm:block"></div>

          <svg id="ecg" viewBox="0 0 214 26" preserveAspectRatio="none" className="w-full h-[22px] my-1.5 overflow-visible sm:h-[26px]">
            <polyline id="ecg-line" fill="none" stroke="#a8e6c9" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
            <circle id="ecg-dot" r="1.7" fill="#a8e6c9" />
          </svg>

          <div className="meter"><span>灌注</span><span className="track"><span className="fill" id="bar-vit"></span></span><span className="val" id="val-vit">0.00</span></div>
          <div className="meter"><span>显影</span><span className="track"><span className="fill" id="bar-lum"></span></span><span className="val" id="val-lum">0.00</span></div>
          <div className="meter" id="meter-tox"><span>钙化</span><span className="track"><span className="fill" id="bar-tox"></span></span><span className="val" id="val-tox">0.00</span></div>

          <div className="hidden sm:flex justify-between mt-3 pt-2 border-t border-[var(--color-panel-line)] text-[8.5px] text-[var(--color-ink-dim)] tracking-[0.2em] tabular-nums">
            <span id="pos-txt">位置 0000 · 0000</span>
            <span id="alt-txt">Ø 0000</span>
          </div>
        </div>
      </div>

      {/* 右面板: 显微观测 */}
      <div
        id="macro"
        className={
          panelBase +
          ' right-3 top-9 ' +
          'sm:right-4 sm:top-10 ' +
          'md:right-6 md:top-1/2 md:-translate-y-1/2 ' +
          'lg:right-[clamp(12px,4vw,80px)] ' +
          'w-[26vw] max-w-[108px] ' +
          'sm:w-[22vw] sm:max-w-[210px] ' +
          'md:w-[220px] lg:w-[236px] ' +
          'max-h-[14vh] sm:max-h-[32vh] md:max-h-none'
        }
      >
        <div className={hdCls}>
          <span className="flex items-center gap-1.5"><span className="dot"></span> 显微观测</span>
          <span id="macro-mode">跟踪中</span>
        </div>
        <div className="h-[10px] bg-[var(--color-panel-bg)]" />
        <div className="flex">
          <div className="flex-1 bg-[var(--color-panel-bg)]" />
          <div
            id="macro-window"
            className="relative outline outline-1 outline-white/5"
            style={{ width: 'min(100%, 212px)', aspectRatio: '212/224' }}
          >
            <span className="corner tl"></span><span className="corner tr"></span>
            <span className="corner bl"></span><span className="corner br"></span>
            <div id="macro-cross"></div>
            <div id="macro-flash"></div>
          </div>
          <div className="flex-1 bg-[var(--color-panel-bg)]" />
        </div>
        <div className="h-[8px] bg-[var(--color-panel-bg)]" />
        <div className="hidden sm:flex justify-between px-3 pb-2.5 pt-0.5 text-[8.5px] text-[var(--color-ink-dim)] tracking-[0.2em] tabular-nums">
          <span id="mag-txt">放大 2.24×</span>
          <span id="sp-txt">SP-01</span>
        </div>
      </div>

      {/* 品牌 */}
      <div
        id="brand"
        className="absolute top-4 left-4 sm:top-5 sm:left-6 text-[8px] sm:text-[9px] tracking-[0.18em] sm:tracking-[0.3em] text-[rgba(62,66,76,0.75)] z-30"
      >
        ◦ 心脏检查 · 心研-01
      </div>

      {/* 按钮组 (小屏在底部, 大屏在右上) */}
      <button id="rec-btn" className={buttonBase + ' rec-btn bottom-3 right-3 md:bottom-auto md:top-4 md:right-[212px]'}>● 录制</button>
      <button id="replay-btn" className={buttonBase + ' replay-btn bottom-3 right-[84px] md:bottom-auto md:top-4 md:right-[118px]'}>↻ 重播</button>
      <button id="audio-btn" className={buttonBase + ' audio-btn bottom-3 right-[168px] md:bottom-auto md:top-4 md:right-6'}>声音 关</button>
      <div id="audio-hint" className="fixed z-40 text-[7px] sm:text-[8px] tracking-[0.2em] text-[rgba(62,66,76,0.55)] bottom-[60px] right-[168px] md:top-[46px] md:right-6 md:bottom-auto">点击启用声音</div>

      {/* 完成态提示 */}
      <div
        id="complete"
        className="absolute left-1/2 -translate-x-1/2 text-center tracking-[0.32em] text-[10px] sm:text-[11px] text-[#34363e] z-40"
        style={{ bottom: '9%', opacity: 0, transition: 'opacity 0.8s' }}
      >
        检查完成
        <div className="sub text-[8px] sm:text-[8.5px] tracking-[0.28em] text-[rgba(52,54,64,0.6)] mt-2">
          06 切面已采集 · 标本存活
        </div>
      </div>

      <div id="loading" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] tracking-[0.4em] text-[rgba(62,66,76,0.6)] transition-opacity duration-700">
        影像校准中…
      </div>

      <div id="vignette" className="fixed inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 22vmin rgba(44,47,58,0.20)' }} />
      <div id="grain" />
    </div>
  );
}
