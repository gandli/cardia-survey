import { Component } from 'react';

/**
 * P1-4: 心脏引擎异常兜底
 *
 * 触发场景:
 *   - assets/heart.glb 404 或损坏 → GLTFLoader 抛错
 *   - WebGL 上下文丢失 (老设备/驱动崩溃)
 *   - AudioContext 被浏览器策略拒绝
 *
 * 不做 stack trace 展示 (泄漏内部实现),
 * 只给用户一句话 + 刷新按钮.
 */
export class HeartErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err) {
    // 生产环境不上报,只 console.warn 供开发者排查
    console.warn('[cardia-survey] fatal:', err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        className="fixed inset-0 flex items-center justify-center bg-[var(--color-bg,#e8ebe6)] text-[#22262e] font-mono z-50"
      >
        <div className="text-center px-6 max-w-md">
          <div className="text-[13px] tracking-[0.32em] mb-4">◦ 影像系统离线</div>
          <div className="text-[10px] tracking-[0.18em] text-[#4a4e58] mb-6">
            3D 引擎初始化失败。请检查浏览器 WebGL 支持,或刷新重试。
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 min-h-[44px] min-w-[92px] text-[10px] tracking-[0.24em] border border-[#22262e] bg-[rgba(240,244,238,0.6)] hover:bg-[rgba(240,244,238,0.9)] focus-visible:ring-2 focus-visible:ring-[#22262e] focus-visible:ring-offset-2 outline-none"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
