import { useEffect, useRef } from 'react';
import { HeartEngine } from './engine/heartEngine.js';

/**
 * 布局契约 (E2E 验证):
 *   心脏投影区 = 视口 x∈[32%, 68%] y∈[20%, 88%], 面板与其零交叠
 *   4 按钮 + 面板之间零重叠, HUD 文本不折行
 *
 * 断点策略:
 *   base (<640) 手机: survey/macro 顶部各占半屏, max-h 15vh, 内容极简
 *   sm   (≥640) 平板/横屏: 顶部两角, 中等尺寸
 *   md   (≥768) 笔记本: 侧栏中位
 *   lg   (≥1024) 桌面: 侧栏中位加边距
 *   xl   (≥1280) 宽屏: clamp() 放大字号+边距
 */
export default function App() {
  const rootRef = useRef(null);
  useEffect(() => {
    const engine = new HeartEngine(rootRef.current);
    return () => engine.destroy();
  }, []);

  const hdCls =
    'hd grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 leading-none border border-[var(--color-panel-line)] bg-[var(--color-panel-bg)] ' +
    'text-[9px] xl:text-[10px] tracking-[0.22em] text-[var(--color-ink-dim)] whitespace-nowrap min-h-[32px] xl:min-h-[36px]';

  const buttonBase =
    // 高对比 (WCAG AA >4.5:1): 文字 #22262e, 边框 rgba(34,38,46,0.55)
    'fixed z-40 font-mono text-[10px] xl:text-[11px] tracking-[0.24em] text-[#22262e] font-medium ' +
    'bg-[rgba(240,244,238,0.55)] backdrop-blur-sm border border-[rgba(34,38,46,0.55)] px-3 xl:px-4 py-1.5 cursor-pointer ' +
    'hover:bg-[rgba(240,244,238,0.85)] hover:border-[#22262e] active:scale-[0.98] transition-colors ' +
    'min-h-[44px] xl:min-h-[52px] min-w-[92px] xl:min-w-[112px] flex items-center justify-center whitespace-nowrap ' +
    // 键盘可访问性: 焦点可见环
    'outline-none focus-visible:ring-2 focus-visible:ring-[#22262e] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(240,244,238,0.6)]';

  return (
    <div id="stage" ref={rootRef} className="fixed inset-0">
      <div
        id="rockshadow"
        className="absolute left-1/2 top-[74%] w-[34vmin] h-[7vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[6px]"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(46,49,60,0.32), rgba(46,49,60,0) 70%)' }}
      />

      {/* 心脏 3D 主视图 (装饰性 canvas, 语义在下方面板) */}
      <canvas id="gl" className="absolute inset-0 w-full h-full block" role="img" aria-label="心脏 3D 交互模型" />

      <svg id="overlay-svg" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="halo" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.4" flood-color="#f6f4ef" flood-opacity="0.95" />
          </filter>
        </defs>
        <path id="scanline-halo" fill="none" stroke="rgba(246,244,239,0.95)" strokeWidth="3.2" strokeDasharray="1.5 5.5" style={{ mixBlendMode: 'screen' }} />
        <path id="scanline" fill="none" stroke="rgba(34,38,46,0.98)" strokeWidth="1.4" strokeDasharray="1.5 5.5" filter="url(#halo)" />
        <g id="reticle" opacity="0" filter="url(#halo)">
          <circle r="8.6" fill="none" stroke="rgba(246,244,239,0.9)" strokeWidth="2.4" />
          <circle id="ret-outer" r="8" fill="none" stroke="rgba(46,42,36,0.95)" strokeWidth="1.1" />
          <circle id="ret-inner" r="1.6" fill="rgba(46,42,36,0.95)" />
        </g>
      </svg>

      {/* ============ 左面板 #survey ============ */}
      <div
        id="survey"
        className={
          'panel fixed z-30 bg-[var(--color-panel-bg)] border border-[var(--color-panel-line)] ' +
          'text-[var(--color-ink)] font-mono text-[10px] xl:text-[11px] tracking-[0.08em] ' +
          'shadow-[0_18px_50px_rgba(40,36,30,0.25)] overflow-hidden ' +
          // 位置: 手机撑左半屏顶栏, 平板顶角, md+ 侧栏中位
          'left-2 top-2 right-[calc(50%+4px)] ' +
          'sm:right-auto sm:left-4 sm:top-10 ' +
          'md:left-6 md:top-1/2 md:-translate-y-1/2 md:right-auto ' +
          'lg:left-[clamp(12px,5vw,90px)] ' +
          // 宽度 (max-w 只在 sm, md+ 用 w 直接控制)
          'sm:w-[24vw] sm:max-w-[220px] ' +
          'md:w-[210px] md:max-w-none lg:w-[280px] xl:w-[clamp(340px,22vw,560px)] ' +
          // 高度上限 (base 手机 y 至多 15vh, zone.t=20vh; md+ 上限 90vh 防超屏; overflow 可滚动)
          'max-h-[15vh] sm:max-h-[32vh] md:max-h-[90vh] md:overflow-y-auto'
        }
      >
        <div className={hdCls}>
          <span className="hd-title flex items-center gap-1.5"><span className="dot" id="survey-dot" aria-hidden="true"></span> 心脏检查</span>
          <span id="scan-state">扫描中</span>
        </div>
        <div className="px-3 pt-2 pb-2 sm:pt-2.5 sm:pb-3">
          <div id="progress" className="flex gap-[3px] mb-1.5 sm:mb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <i key={i} className="flex-1 h-[2px] bg-white/10"></i>
            ))}
          </div>
          <div id="spec-count" className="text-[8.5px] xl:text-[9.5px] tracking-[0.26em] text-[var(--color-ink-dim)] mb-1 whitespace-nowrap">
            切面 01 / 06
          </div>
          <div
            id="spec-name"
            className="text-[13px] sm:text-[15px] xl:text-[clamp(18px,1.3vw,28px)] tracking-[0.03em] font-medium text-[#f0f3ee] min-h-[20px] whitespace-nowrap overflow-hidden text-balance"
          >
            <span id="spec-name-txt"></span>
            <span className="cursor" aria-hidden="true"></span>
          </div>
          {/* 以下模块 <sm 不显示 (手机避免面板过高进入心脏区) */}
          <div id="spec-desc" className="hidden sm:block text-[8.5px] tracking-[0.14em] text-[var(--color-ink-dim)] my-1 min-h-[11px] text-pretty"></div>

          <svg id="ecg" viewBox="0 0 214 26" preserveAspectRatio="none" className="hidden sm:block w-full h-[26px] my-1.5 overflow-visible" aria-hidden="true">
            <polyline id="ecg-line" fill="none" stroke="#a8e6c9" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
            <circle id="ecg-dot" r="1.7" fill="#a8e6c9" />
          </svg>

          {/* 短屏兜底 chip: ECG/meter 无法展开时保留关键数值 (临床可信度) */}
          <div id="mini-strip" className="hidden text-[9px] tracking-[0.14em] text-[#f0f3ee] tabular-nums my-1.5 flex-wrap gap-x-3 gap-y-0.5">
            <span>♥ <span id="mini-hr">72</span></span>
            <span>灌 <span id="mini-vit">0.00</span></span>
            <span>显 <span id="mini-lum">0.00</span></span>
            <span>钙 <span id="mini-tox">0.00</span></span>
          </div>

          <div className="hidden sm:block">
            <div className="meter"><span>灌注</span><span className="track"><span className="fill" id="bar-vit"></span></span><span className="val" id="val-vit">0.00</span></div>
            <div className="meter"><span>显影</span><span className="track"><span className="fill" id="bar-lum"></span></span><span className="val" id="val-lum">0.00</span></div>
            <div className="meter" id="meter-tox"><span>钙化</span><span className="track"><span className="fill" id="bar-tox"></span></span><span className="val" id="val-tox">0.00</span></div>
          </div>

          <div className="hidden sm:flex justify-between mt-3 pt-2 border-t border-[var(--color-panel-line)] text-[8.5px] text-[var(--color-ink-dim)] tracking-[0.2em] tabular-nums">
            <span id="pos-txt">位置 0000 · 0000</span>
            <span id="alt-txt">Ø 0000</span>
          </div>
        </div>
      </div>

      {/* ============ 右面板 #macro (外层透明,让 canvas 心脏特写透出) ============ */}
      <div
        id="macro"
        className={
          'fixed z-30 text-[var(--color-ink)] font-mono text-[10px] xl:text-[11px] tracking-[0.08em] ' +
          'shadow-[0_18px_50px_rgba(40,36,30,0.25)] ' +
          // 手机(<sm)完全隐藏, 主视图心脏已够看; 从 sm 起才出面板
          'hidden sm:block ' +
          'sm:right-4 sm:top-10 ' +
          'md:right-6 md:top-1/2 md:-translate-y-1/2 ' +
          'lg:right-[clamp(12px,4vw,80px)] ' +
          'sm:w-[22vw] sm:max-w-[210px] ' +
          'md:w-[200px] md:max-w-none lg:w-[260px] xl:w-[clamp(320px,20vw,520px)] ' +
          'sm:max-h-[32vh] md:max-h-[90vh]'
        }
      >
        <div className={hdCls}>
          <span className="hd-title flex items-center gap-1.5"><span className="dot" aria-hidden="true"></span> 显微观测</span>
          <span id="macro-mode">跟踪中</span>
        </div>
        <div className="h-[10px] bg-[var(--color-panel-bg)] border-x border-[var(--color-panel-line)]" />
        {/* 显微图像层: 父容器必须透明, canvas scissor 渲染的心脏特写才能透出;
            左右内边距由 border 两侧的伪填充块承担, 不给父层加背景 */}
        <div className="relative flex">
          <div className="w-2 sm:w-2.5 bg-[var(--color-panel-bg)] border-l border-[var(--color-panel-line)]" aria-hidden="true" />
          <div id="macro-window" className="relative outline outline-1 outline-white/5 flex-1" style={{ aspectRatio: '212/224' }}>
            <span className="corner tl"></span><span className="corner tr"></span>
            <span className="corner bl"></span><span className="corner br"></span>
            <div id="macro-cross"></div>
            <div id="macro-flash"></div>
          </div>
          <div className="w-2 sm:w-2.5 bg-[var(--color-panel-bg)] border-r border-[var(--color-panel-line)]" aria-hidden="true" />
        </div>
        <div className="h-[8px] bg-[var(--color-panel-bg)] border-x border-[var(--color-panel-line)]" />
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 leading-none min-h-[32px] xl:min-h-[36px] text-[8.5px] xl:text-[9.5px] text-[var(--color-ink-dim)] tracking-[0.2em] tabular-nums bg-[var(--color-panel-bg)] border border-t-0 border-[var(--color-panel-line)]">
          <span id="mag-txt">放大 2.24×</span>
          <span id="sp-txt">SP-01</span>
        </div>
      </div>

      {/* 品牌 (装饰文字, 与页面 title 同义) */}
      <div
        id="brand"
        aria-hidden="true"
        className="fixed z-30 top-[22vh] left-4 sm:top-5 sm:left-6 xl:top-8 xl:left-10 text-[9px] sm:text-[10px] xl:text-[clamp(11px,0.75vw,15px)] tracking-[0.24em] sm:tracking-[0.3em] text-[rgba(62,66,76,0.85)] whitespace-nowrap"
      >
        ◦ 心脏检查 · 心研-01
      </div>

      {/* 按钮组 (触摸目标 ≥44px, 手机端加 safe-area 让开 iOS home indicator) */}
      <button
        id="rec-btn"
        type="button"
        aria-label="切换录制"
        aria-pressed="false"
        className={buttonBase + ' rec-btn bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] right-3 sm:bottom-auto sm:top-[76px] sm:right-4 md:top-4 md:right-[248px] lg:right-[276px]'}
      >
        <span aria-hidden="true">● </span>录制
      </button>
      <button
        id="replay-btn"
        type="button"
        aria-label="重播扫描"
        className={buttonBase + ' replay-btn bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] right-[108px] sm:bottom-auto sm:top-[76px] sm:right-[112px] md:top-4 md:right-[132px] lg:right-[152px]'}
      >
        <span aria-hidden="true">↻ </span>重播
      </button>
      <button
        id="audio-btn"
        type="button"
        aria-label="切换声音开关"
        aria-pressed="false"
        aria-describedby="audio-hint"
        className={buttonBase + ' audio-btn bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] right-[212px] sm:bottom-auto sm:top-[76px] sm:right-[216px] md:top-4 md:right-6'}
      >
        声音 <span id="audio-state">关</span>
      </button>
      {/* 提示 (由 audio-btn aria-describedby 关联, role=note 让屏幕阅读器不当独立控件) */}
      <div id="audio-hint" role="note" className="fixed z-40 text-[9px] xl:text-[10px] tracking-[0.2em] font-medium text-[#22262e] whitespace-nowrap bottom-[calc(env(safe-area-inset-bottom,0px)+64px)] right-[212px] sm:bottom-auto sm:top-[136px] sm:right-[216px] md:top-[84px] md:right-6">↑ 点击启用声音</div>

      <div
        id="complete"
        className="fixed left-1/2 -translate-x-1/2 text-center tracking-[0.32em] text-[10px] sm:text-[11px] xl:text-[13px] text-[#34363e] z-40"
        style={{ bottom: '9%', opacity: 0, transition: 'opacity 0.8s' }}
      >
        检查完成
        <div className="sub text-[8px] sm:text-[8.5px] xl:text-[10px] tracking-[0.28em] text-[rgba(52,54,64,0.6)] mt-2">
          06 切面已采集 · 标本存活
        </div>
      </div>

      <div id="loading" className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] tracking-[0.4em] text-[rgba(62,66,76,0.6)] transition-opacity duration-700">
        影像校准中…
      </div>

      <div id="vignette" className="fixed inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 22vmin rgba(44,47,58,0.20)' }} />
      <div id="grain" />
    </div>
  );
}
