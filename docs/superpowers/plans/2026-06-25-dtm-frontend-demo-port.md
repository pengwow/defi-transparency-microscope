# DTM Frontend — 逐像素复刻 `DTM_Demo.html` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `asset/design/DTM_Demo.html`（3332 行单文件 demo）的视觉、6 个 tab 结构、13 个 canvas、loading/lens/lens/粒子/扫描线等交互动效、中文文案、Page 枚举全部 1:1 转写到 `frontend/` 现有 React/Vite 工程；保留 MockAPI 接口契约、Vitest 套件、Zustand stores。

**Architecture:** 在现有 `frontend/src/{components,canvas,pages,store,services,styles}` 工程骨架上做"内层重写 + 外层补齐"。不删除任何现有可复用资产（`canvas/ILCurve.ts` 等直接复用）；新增 `components/live|fork|liquidation|lpil|edu|report|panels/` 7 个子目录，1 个 canvas/ 新模块组，1 个 services/demoData.ts 数据工厂。Page 枚举从英文改成 demo 的 6 个中文 key，App.tsx 的 PAGES 映射同步。

**Tech Stack:** Vite 5, React 18, TypeScript 5, Zustand 4, Vitest 1, @testing-library/react 14, ECharts 5 (Report 饼/雷达/瀑布沿用), 自研 canvas 引擎（`useCanvas` 钩子 + DPR-aware）。

**Spec:** [2026-06-25-dtm-frontend-demo-port-design.md](file:///workspace/docs/superpowers/specs/2026-06-25-dtm-frontend-demo-port-design.md)

**Reference 真值:** [asset/design/DTM_Demo.html](file:///workspace/asset/design/DTM_Demo.html) — 视觉、交互、文案的唯一真值源。逐段比对用。

---

## 工作流约定（每个 task 都遵守）

1. 先 `git status` 确认工作区干净。
2. 写失败测试 → 跑测试看到红 → 写最小实现 → 跑测试看到绿 → `git add` + `git commit`。
3. 组件/canvas 用 `data-testid` 暴露稳定 selector，文案可中文、`testId` 必须英文 kebab-case。
4. 文档/注释中文优先；类型/接口英文。
5. 不引入新依赖（ECharts 已装）；不删 `asset/design/DTM_Demo.html`（保留为真值）。
6. 任务结束前跑一次 `cd frontend && pnpm test --run` 确认相关测试不挂。

---

## Phase 1 — 主题 / Chrome / 全局装饰

### Task 1.1：重写设计 token（`variables.css`）

**Files:**
- Modify: `frontend/src/styles/variables.css`

- [ ] **Step 1: 重写文件** — 把 demo 的 `:root` 变量 1:1 搬过来，名字加 `--dtm-` 前缀避免与现有冲突；保留 `1px` 间距栅格、4 档字号；新增 `--font-sans-cn / --font-mono / --font-display` 三套字体栈。**不删** `frontend/src/components/common/common.css` 还在用 `--color-*` 别名（后续 task 1.2 统一）。

```css
:root {
  /* Surfaces */
  --dtm-bg-deep: #020408;
  --dtm-bg-mid: #060a14;
  --dtm-bg-surface: #0c1220;
  --dtm-bg-card: #111a2e;
  --dtm-bg-hover: #1a2540;

  /* Accents */
  --dtm-cyan: #00e5ff;
  --dtm-amber: #ffab40;
  --dtm-coral: #ff5e5e;
  --dtm-lime: #69f0ae;
  --dtm-purple: #b388ff;
  --dtm-blue: #448aff;

  /* Text */
  --dtm-ink: #f0f4f8;
  --dtm-sub: #8b9bb4;
  --dtm-muted: #5a6a82;

  /* Lines / glows */
  --dtm-rule: rgba(139, 155, 180, 0.06);
  --dtm-glow: rgba(0, 229, 255, 0.1);

  /* Fonts */
  --dtm-font-sans: 'Noto Sans SC', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --dtm-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  --dtm-font-display: 'Playfair Display', Georgia, serif;

  /* Compat aliases (consumed by common.css during transition) */
  --color-bg: var(--dtm-bg-deep);
  --color-surface: var(--dtm-bg-surface);
  --color-surface-alt: var(--dtm-bg-card);
  --color-border: var(--dtm-rule);
  --color-border-strong: var(--dtm-bg-hover);
  --color-text: var(--dtm-ink);
  --color-text-muted: var(--dtm-sub);
  --color-text-dim: var(--dtm-muted);
  --color-accent: var(--dtm-cyan);
  --color-accent-soft: var(--dtm-glow);
  --color-success: var(--dtm-lime);
  --color-warn: var(--dtm-amber);
  --color-danger: var(--dtm-coral);
  --color-info: var(--dtm-blue);
  --font-sans: var(--dtm-font-sans);
  --font-mono: var(--dtm-font-mono);

  /* Spacing scale */
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;

  /* Radius */
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px; --radius-pill: 9999px;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.25);
  --shadow-md: 0 2px 6px rgba(0,0,0,0.4);
  --shadow-lg: 0 6px 18px rgba(0,0,0,0.5);

  /* Z-index */
  --z-base: 0; --z-panel: 10; --z-overlay: 100;
  --z-toast: 1000; --z-modal: 1100; --z-lens: 3000;
}
```

- [ ] **Step 2: 跑测试确认不挂**

Run: `cd frontend && pnpm test --run --reporter=basic 2>&1 | tail -30`
Expected: 现有 60+ 测试全绿（变量别名兼容）。

- [ ] **Step 3: 提交**

```bash
cd frontend && pnpm prettier --write src/styles/variables.css
cd /workspace && git add frontend/src/styles/variables.css
git commit -m "feat(frontend): port DTM_Demo design tokens to variables.css"
```

---

### Task 1.2：新增 `global.css`（reset + body 装饰 + 字体 + 扫描线）

**Files:**
- Create: `frontend/src/styles/global.css`
- Modify: `frontend/src/main.tsx`（import 顺序）

- [ ] **Step 1: 新建 `global.css`** — 复刻 demo 的 `body { font-family, background, color, line-height }`、`* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent }`、`.scanline` 伪元素 overlay（用 `body::after` 模拟 demo 的扫描线），以及 `html, body, #root { min-height:100vh }`。

```css
@import './variables.css';
@import './animations.css';
@import './demo.css';

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

html, body, #root { min-height: 100vh; }

body {
  font-family: var(--dtm-font-sans);
  background: var(--dtm-bg-deep);
  color: var(--dtm-ink);
  line-height: 1.6;
  overflow-x: hidden;
}

/* Scanline overlay (demo body::after) */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,255,0.004) 2px, rgba(0,229,255,0.004) 4px);
  pointer-events: none;
  z-index: 9998;
}

#root { position: relative; z-index: 1; }
```

- [ ] **Step 2: 修改 `main.tsx`** — 把 `import './styles/global.css'` 放在最前；删除或保留 `import './styles/variables.css'`（已 `@import` 进来）。

```ts
// frontend/src/main.tsx (顶部 imports)
import './styles/global.css';
```

- [ ] **Step 3: 跑 build 确认编译过**

Run: `cd frontend && pnpm build 2>&1 | tail -10`
Expected: 成功，无 TS 错误。

- [ ] **Step 4: 提交**

```bash
cd /workspace && git add frontend/src/styles/global.css frontend/src/main.tsx
git commit -m "feat(frontend): add global.css with demo body styles and scanline"
```

---

### Task 1.3：新增 `animations.css`（demo 的所有 @keyframes）

**Files:**
- Create: `frontend/src/styles/animations.css`

- [ ] **Step 1: 搬运所有 @keyframes** — 从 demo `<style>` 块里挑出 `.dtm-` 前缀以外的所有 keyframes（`loadingPulse`, `logoPulse`, `demoPulse`, `pdot`, `fadeIn`, `fadeInUp`, `loadProgress`, `redAlertPulse`, `livePulse`, `rtcBlink`, `laneIn`, `flashIn`, `scanMove`, `slideIn`, `stepGlow`），加 `.dtm-` 前缀。

```css
@keyframes dtm-loadingPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 60px rgba(0,229,255,0.3) } 50% { transform: scale(1.05); box-shadow: 0 0 80px rgba(0,229,255,0.5) } }
@keyframes dtm-logoPulse { 0%,100% { box-shadow: 0 0 20px rgba(0,229,255,0.25) } 50% { box-shadow: 0 0 30px rgba(0,229,255,0.4) } }
@keyframes dtm-demoPulse { 0%,100% { box-shadow: 0 0 6px rgba(255,94,94,0.1) } 50% { box-shadow: 0 0 16px rgba(255,94,94,0.25) } }
@keyframes dtm-pdot { 0%,100% { opacity:1 } 50% { opacity: 0.4 } }
@keyframes dtm-fadeIn { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }
@keyframes dtm-fadeInUp { from { opacity:0; transform: translateY(20px) } to { opacity:1; transform: translateY(0) } }
@keyframes dtm-loadProgress { 0% { width: 0% } 50% { width: 60% } 100% { width: 100% } }
@keyframes dtm-redAlertPulse { 0%,100% { border-color: rgba(255,94,94,0.3); box-shadow: 0 0 0 rgba(255,94,94,0) } 50% { border-color: rgba(255,94,94,0.6); box-shadow: 0 0 20px rgba(255,94,94,0.15) } }
@keyframes dtm-livePulse { 0%,100% { opacity:1; transform: scale(1) } 50% { opacity: 0.3; transform: scale(0.7) } }
@keyframes dtm-rtcBlink { 0%,100% { opacity:1 } 50% { opacity: 0.3 } }
@keyframes dtm-laneIn { from { opacity:0; transform: translateX(-20px) } to { opacity:1; transform: translateX(0) } }
@keyframes dtm-flashIn { from { opacity:0; transform: translateX(40px) scale(0.95) } to { opacity:1; transform: translateX(0) scale(1) } }
@keyframes dtm-scanMove { from { transform: translateY(-100vh) } to { transform: translateY(100vh) } }
@keyframes dtm-slideIn { to { opacity:1; transform: translateX(0) } }
@keyframes dtm-stepGlow { 0%,100% { box-shadow: 0 0 25px rgba(0,229,255,0.25) } 50% { box-shadow: 0 0 40px rgba(0,229,255,0.4) } }
```

- [ ] **Step 2: 在 `global.css` 顶部确认 `@import` 已包含**（task 1.2 已加），跑 build。

Run: `cd frontend && pnpm build 2>&1 | tail -5`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
cd /workspace && git add frontend/src/styles/animations.css
git commit -m "feat(frontend): port demo keyframes to animations.css"
```

---

### Task 1.4：新增 `demo.css`（Panel / Grid / Form / Metric / Timeline / Gauge 通用样式）

**Files:**
- Create: `frontend/src/styles/demo.css`

- [ ] **Step 1: 复刻 demo 全部 panel / grid / form / metric / timeline / gauge 样式** — 直接搬运 demo 的 `.panel .panel-header .panel-body .grid-3 .grid-2 .grid-4 .form-group .form-label .form-input .form-select .token-row .btn .btn-primary .explain-box .timeline .timeline-item .risk-gauge .gauge-circle .gauge-svg .gauge-bg .gauge-fill .gauge-value .gauge-label .metric-grid .metric-box .rec-item` 等类，类名加 `.dtm-` 前缀。完整清单见 demo 3332 行文件第 9-326 行（每行就是一段 CSS）。**本任务只搬通用块；tab 内特殊类后续 task 单独搬。**

- [ ] **Step 2: 跑现有测试确认 panel/grid 不影响其他组件**

Run: `cd frontend && pnpm test --run --reporter=basic 2>&1 | tail -10`
Expected: 全绿（demo.css 只新增不覆盖）。

- [ ] **Step 3: 提交**

```bash
cd /workspace && git add frontend/src/styles/demo.css
git commit -m "feat(frontend): port demo panel/grid/form/metric/gauge styles to demo.css"
```

---

### Task 1.5：改写 `Header.tsx`（🔬 显微镜 logo + "一键实验"按钮）

**Files:**
- Modify: `frontend/src/components/common/Header.tsx`
- Modify: `frontend/src/components/common/common.css`（追加 demo 风格）

- [ ] **Step 1: 写失败测试** — 在 `frontend/src/components/common/__tests__/common.test.tsx` 末尾追加：

```tsx
describe('Header (demo)', () => {
  it('renders the microscope logo and Chinese brand', () => {
    render(<Header onStartDemo={() => undefined} />);
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByText('DeFi')).toBeInTheDocument();
    expect(screen.getByText('透明显微镜')).toBeInTheDocument();
  });
  it('renders the 一键实验 button when callback provided', () => {
    const cb = vi.fn();
    render(<Header onStartDemo={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /一键实验/ }));
    expect(cb).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "Header \(demo\)"`
Expected: FAIL（Header 不接受 `onStartDemo`，无 "一键实验" 按钮）。

- [ ] **Step 3: 改写 Header.tsx**

```tsx
import type { ReactNode } from 'react';

export interface HeaderProps {
  /** Optional content rendered in the right slot (clock, mode bar, etc.). */
  right?: ReactNode;
  /** When provided, renders the demo-style "一键实验" button before `right`. */
  onStartDemo?: () => void;
  /** Whether the demo script is currently running (changes button color/label). */
  demoRunning?: boolean;
}

export function Header({ right, onStartDemo, demoRunning }: HeaderProps) {
  return (
    <header className="dtm-header" data-testid="app-header">
      <div className="dtm-header-left">
        <div className="dtm-logo">
          <div className="dtm-logo-icon">🔬</div>
          <div className="dtm-logo-text">DeFi <span>透明显微镜</span></div>
        </div>
      </div>
      <div className="dtm-header-right">
        {onStartDemo && (
          <button
            type="button"
            className={`dtm-demo-btn${demoRunning ? ' is-playing' : ''}`}
            onClick={onStartDemo}
            data-testid="demo-btn"
          >
            <span>{demoRunning ? '⏸' : '▶'}</span>
            {demoRunning ? '实验中…' : '一键实验'}
          </button>
        )}
        {right}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: 在 `common.css` 末尾追加 demo Header / demo-btn / logo 样式**（从 demo `header`/`demo-btn`/`logo*` 段直接复制，加 `.dtm-` 前缀）。`.dtm-header` 现有 flex 布局保留但加 `flex-wrap: wrap; gap: 0.5rem;`；`.dtm-logo-icon` 用渐变背景 + box-shadow 模拟 demo 的脉冲；`.dtm-demo-btn` 用 coral 渐变 + `dtm-demoPulse` 动画。

- [ ] **Step 5: 跑测试看绿**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "Header"`
Expected: 全绿（包括原有 Header 测试用 `right=` slot 也保留）。

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add frontend/src/components/common/Header.tsx frontend/src/components/common/common.css frontend/src/components/common/__tests__/common.test.tsx
git commit -m "feat(frontend): rewrite Header with microscope logo and 一键实验 button"
```

---

### Task 1.6：改写 `NavTabs.tsx`（6 个中文 tab）

**Files:**
- Modify: `frontend/src/components/common/NavTabs.tsx`

- [ ] **Step 1: 修改 `NAV_TABS` 数组** — id 改成新 Page 枚举 key，label 改成中文 + emoji：

```tsx
export const NAV_TABS: ReadonlyArray<NavTab> = [
  { id: 'live', label: '📡 实时采样' },
  { id: 'fork', label: '🔬 实验切片' },
  { id: 'liquidation', label: '⚡ 清算' },
  { id: 'lpil', label: '🌊 LP/IL' },
  { id: 'edu', label: '🎓 教学实验' },
  { id: 'report', label: '📊 报告' },
];
```

- [ ] **Step 2: 更新现有 NavTabs 测试** — 把 `'Dashboard' / 'Mempool' / 'Positions'` 这些查询改成新中文 label（`实时采样` / `实验切片` / `LP/IL`），把 `'dashboard'`/`'mempool'`/`'positions'` 改成 `'live'`/`'fork'`/`'lpil'`。

- [ ] **Step 3: 跑测试看绿**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "NavTabs"`
Expected: 全绿。

- [ ] **Step 4: 在 `common.css` 追加 demo `.dtm-nav-tabs` 样式** — 圆角 9px 容器、`.dtm-nav-tab.active` 用 cyan→purple 渐变 + 黑字白底（demo 原样）。

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add frontend/src/components/common/NavTabs.tsx frontend/src/components/common/__tests__/common.test.tsx frontend/src/components/common/common.css
git commit -m "feat(frontend): rewrite NavTabs with 6 Chinese tabs from demo"
```

---

### Task 1.7：改写 `ModeBar.tsx`（大胶囊 Live / Fork 二选一）

**Files:**
- Modify: `frontend/src/components/common/ModeBar.tsx`

- [ ] **Step 1: 改写** — 接受 `mode: 'live' | 'fork' | 'replay'`，OPTIONS 改成 2 个（demo 模式只有 live + fork，不显示 Replay）；加 `data-testid`、可加可选 `disabled` 状态。

```tsx
import type { Mode } from '@/store/uiStore';

export interface ModeBarProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: Mode; label: string; icon: string }> = [
  { value: 'live', label: 'Live 实时采样', icon: '📡' },
  { value: 'replay', label: 'Fork 实验切片', icon: '🔬' },
];

export function ModeBar({ value, onChange, disabled }: ModeBarProps) {
  return (
    <div className="dtm-mode-bar" role="radiogroup" aria-label="模式" data-testid="mode-bar">
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-selected={selected}
            disabled={disabled}
            className={`dtm-mode-option${selected ? ' is-active' : ''}`}
            onClick={() => onChange(opt.value)}
            data-testid={`mode-${opt.value}`}
          >
            <span className="dtm-mode-indicator" />
            {opt.icon} {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

> Mode 类型仍是 `'live' | 'replay'`，但 demo 文案把 'replay' 渲染为 "Fork"。这个映射在 label 里完成；Mode 枚举不动（保持后端/算法兼容）。

- [ ] **Step 2: 更新现有 ModeBar 测试** — 把 `'Live'`/`'Replay'` 角色名改成新 label `实时采样`/`实验切片`；`'replay'` 值保持不变。

- [ ] **Step 3: 在 `common.css` 追加 demo `.dtm-mode-bar` 样式** — 大胶囊 `padding: 0.5rem 1.2rem; border-radius: 10px`，active 用 cyan 边框 + glow，indicator dot 是 lime 脉冲。

- [ ] **Step 4: 跑测试**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "ModeBar"`
Expected: 全绿。

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add frontend/src/components/common/ModeBar.tsx frontend/src/components/common/__tests__/common.test.tsx frontend/src/components/common/common.css
git commit -m "feat(frontend): rewrite ModeBar with demo's Live/Fork big-pill style"
```

---

### Task 1.8：改写 `LoadingScreen.tsx`（🔬 logo + Playfair 标题 + 进度条 + 2.5s 自动回调）

**Files:**
- Modify: `frontend/src/components/common/LoadingScreen.tsx`
- Modify: `frontend/src/components/common/__tests__/common.test.tsx`

- [ ] **Step 1: 改写组件** — 不再依赖 `progress` prop；改为 `onReady?: () => void` + `minDurationMs?: number = 2500`。mount 后自动启动 2.5s 定时器，结束时调 `onReady`。视觉：🔬 logo（`border-radius: 20px; background: linear-gradient(135deg, var(--dtm-cyan), var(--dtm-purple))`）+ Playfair 标题"DeFi 透明显微镜" + "正在初始化链上机理仿真实验室..." + 进度条（2s 动画 0→100%）。className 改为 demo 的 `.loading-screen`（无前缀），由 `demo.css` 控制。

```tsx
import { useEffect, useState } from 'react';

export interface LoadingScreenProps {
  /** Called once the minimum display duration has elapsed. */
  onReady?: () => void;
  /** Minimum visible duration in ms (default 2500, matching demo). */
  minDurationMs?: number;
  /** Optional override for the subtitle. */
  subtitle?: string;
}

export function LoadingScreen({ onReady, minDurationMs = 2500, subtitle = '正在初始化链上机理仿真实验室…' }: LoadingScreenProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setHidden(true);
      onReady?.();
    }, minDurationMs);
    return () => clearTimeout(t);
  }, [minDurationMs, onReady]);

  return (
    <div
      className={`loading-screen${hidden ? ' is-hidden' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!hidden}
      data-testid="loading-screen"
    >
      <div className="loading-logo">🔬</div>
      <div className="loading-text">DeFi 透明显微镜</div>
      <div className="loading-subtitle">{subtitle}</div>
      <div className="loading-bar">
        <div className="loading-bar-fill" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 `demo.css` 追加 `.loading-screen` 系列样式**（直接从 demo 9-35 行复制）。

- [ ] **Step 3: 更新测试** — 原 `'renders a progressbar with the right value'` 改成 `onReady` 回调测试：

```tsx
describe('LoadingScreen', () => {
  it('invokes onReady after minDurationMs', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    render(<LoadingScreen onReady={cb} minDurationMs={2500} />);
    expect(cb).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(cb).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it('renders the microscope logo and Chinese title', () => {
    render(<LoadingScreen minDurationMs={10_000} />);
    expect(screen.getByText('DeFi 透明显微镜')).toBeInTheDocument();
    expect(screen.getByText(/正在初始化/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 跑测试**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "LoadingScreen"`
Expected: 全绿。

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add frontend/src/components/common/LoadingScreen.tsx frontend/src/styles/demo.css frontend/src/components/common/__tests__/common.test.tsx
git commit -m "feat(frontend): rewrite LoadingScreen with microscope logo + 2.5s auto-callback"
```

---

### Task 1.9：新增 `ParticleBackground` 组件 + canvas 模块

**Files:**
- Create: `frontend/src/canvas/ParticleBackground.ts`
- Create: `frontend/src/components/common/ParticleBackground.tsx`
- Modify: `frontend/src/components/common/index.ts`

- [ ] **Step 1: 写失败测试** — `frontend/src/canvas/__tests__/ParticleBackground.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';
import { drawParticles } from '../ParticleBackground';

function makeCtx() {
  const calls: string[] = [];
  return {
    calls,
    clearRect: vi.fn(() => calls.push('clearRect')),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe('drawParticles', () => {
  it('clears the canvas and paints particles + connection lines', () => {
    const ctx = makeCtx();
    drawParticles(ctx, { width: 400, height: 300 }, { count: 8, connectDistance: 120 });
    expect(ctx.calls).toContain('clearRect');
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/canvas/__tests__/ParticleBackground.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `canvas/ParticleBackground.ts`**

```ts
import type { CanvasSize } from './types';

export interface ParticlesConfig {
  count?: number;
  connectDistance?: number;
  /** Tint for the dots (default cyan rgba). */
  color?: string;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; alpha: number; pulse: number;
}

let particles: Particle[] = [];
let lastSize: CanvasSize | null = null;
let lastConfigKey = '';

function spawn(size: CanvasSize, count: number): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * size.width,
      y: Math.random() * size.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    });
  }
  return arr;
}

/** Re-seed the particle field (call on resize). */
export function resetParticles(): void {
  particles = [];
  lastSize = null;
  lastConfigKey = '';
}

/** Single frame render. Caller drives the rAF loop. */
export function drawParticles(ctx: CanvasRenderingContext2D, size: CanvasSize, config: ParticlesConfig = {}): void {
  const count = config.count ?? 80;
  const dist = config.connectDistance ?? 120;
  const baseColor = config.color ?? '0, 229, 255';
  const key = `${count}|${dist}|${size.width}x${size.height}`;

  if (!lastSize || lastSize.width !== size.width || lastSize.height !== size.height || lastConfigKey !== key) {
    particles = spawn(size, count);
    lastSize = size;
    lastConfigKey = key;
  }

  ctx.clearRect(0, 0, size.width, size.height);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.pulse += 0.02;
    if (p.x < 0 || p.x > size.width || p.y < 0 || p.y > size.height) {
      p.x = Math.random() * size.width;
      p.y = Math.random() * size.height;
    }
    const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor}, ${a})`;
    ctx.fill();
  }
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < dist) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(${baseColor}, ${0.04 * (1 - d / dist)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}
```

- [ ] **Step 4: 实现 `components/common/ParticleBackground.tsx`** — 用 `useCanvas(drawParticles, [size])` 驱动，固定在 viewport。

```tsx
import { useEffect, useState } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawParticles, type ParticlesConfig } from '@/canvas/ParticleBackground';

export interface ParticleBackgroundProps extends ParticlesConfig {
  /** z-index, default 0 (behind everything). */
  zIndex?: number;
}

export function ParticleBackground({ zIndex = 0, ...config }: ParticleBackgroundProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { ref } = useCanvas((ctx, css) => drawParticles(ctx, css, config), [size.width, size.height]);
  return (
    <canvas
      ref={ref}
      className="dtm-particle-canvas"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex }}
      data-testid="particle-background"
    />
  );
}
```

- [ ] **Step 5: 在 `index.ts` 导出**

```ts
export { ParticleBackground } from './ParticleBackground';
```

- [ ] **Step 6: 在 `global.css` 加 `.dtm-particle-canvas { z-index: 0; }`（已被 inline style 覆盖，确认 demo.css 不冲突）。**

- [ ] **Step 7: 跑测试**

Run: `cd frontend && pnpm test --run src/canvas/__tests__/ParticleBackground.test.ts`
Expected: 全绿。

- [ ] **Step 8: 提交**

```bash
cd /workspace && git add frontend/src/canvas/ParticleBackground.ts frontend/src/canvas/__tests__/ParticleBackground.test.ts frontend/src/components/common/ParticleBackground.tsx frontend/src/components/common/index.ts frontend/src/styles/global.css
git commit -m "feat(frontend): add ParticleBackground canvas + React component"
```

---

### Task 1.10：新增 `RealtimeClock` 浮窗小窗（含 Block #）

**Files:**
- Modify: `frontend/src/components/common/RealtimeClock.tsx`
- Modify: `frontend/src/components/common/common.css`

- [ ] **Step 1: 写失败测试** — 验证 `Block #` 数字可见：

```tsx
describe('RealtimeClock (floating)', () => {
  it('shows the live time and a Block # counter', () => {
    render(<RealtimeClock block={22_180_542} />);
    expect(screen.getByTestId('realtime-clock')).toBeInTheDocument();
    expect(screen.getByText('#22180542')).toBeInTheDocument();
  });
  it('auto-increments block every 12s', () => {
    vi.useFakeTimers();
    render(<RealtimeClock block={100} blockIntervalMs={12_000} />);
    expect(screen.getByText('#100')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(screen.getByText('#101')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "RealtimeClock"`
Expected: FAIL（RealtimeClock 不接 `block` / `blockIntervalMs`）。

- [ ] **Step 3: 改写 `RealtimeClock.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/utils/time';

export interface RealtimeClockProps {
  /** Show seconds (default true). */
  showSeconds?: boolean;
  /** Optional aria-label. */
  label?: string;
  /** Block number to display in the right column. */
  block?: number;
  /** ms between simulated block bumps (default 12_000). */
  blockIntervalMs?: number;
}

export function RealtimeClock({
  showSeconds = true,
  label = '当前时间',
  block = 0,
  blockIntervalMs = 12_000,
}: RealtimeClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const [curBlock, setCurBlock] = useState(block);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);
  useEffect(() => { setCurBlock(block); }, [block]);
  useEffect(() => { blockRef.current = setInterval(() => setCurBlock((b) => b + 1), blockIntervalMs);
    return () => { if (blockRef.current) clearInterval(blockRef.current); }; }, [blockIntervalMs]);

  const ts = Math.floor(now / 1000);
  let display = formatTime(ts);
  if (!showSeconds) display = display.slice(0, 5);
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '/');

  return (
    <div className="dtm-rtc-widget" data-testid="realtime-clock" aria-label={label}>
      <span className="dtm-rtc-dot" />
      <div>
        <div className="dtm-rtc-time">{display}</div>
        <div className="dtm-rtc-date">{dateStr}</div>
      </div>
      <div className="dtm-rtc-sep" />
      <div>
        <div className="dtm-rtc-time">#{curBlock}</div>
        <div className="dtm-rtc-label">Block</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 在 `common.css` 追加 demo `.dtm-rtc-widget` 全部样式**（位置 fixed bottom-left、lime 脉冲点、JetBrains Mono 数字、`<= 768px` padding 缩小）。

- [ ] **Step 5: 跑测试**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "RealtimeClock"`
Expected: 全绿（包括原来 `aria-label`/`<time>` 测试 — 把 `<time>` 改成 `<div>` 后，原来 `tagName === 'time'` 断言需更新为 `tagName === 'div'`）。

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add frontend/src/components/common/RealtimeClock.tsx frontend/src/components/common/common.css frontend/src/components/common/__tests__/common.test.tsx
git commit -m "feat(frontend): rewrite RealtimeClock as floating widget with Block #"
```

---

### Task 1.11：UI store — 新增 `flashAlert` / `lensStage` / `demoRunning` 状态

**Files:**
- Modify: `frontend/src/store/uiStore.ts`
- Modify: `frontend/src/components/common/__tests__/common.test.tsx`（resetState）

- [ ] **Step 1: 写失败测试** — `frontend/src/store/__tests__/uiStore.test.ts` 追加：

```ts
describe('UI store — demo state', () => {
  beforeEach(() => useUiStore.setState({
    page: 'live', mode: 'live', alerts: [], loading: false,
    flashAlert: null, lensStage: 'idle', demoRunning: false, demoStep: 0, blockNumber: 22_180_542,
  }));

  it('startDemo sets demoRunning + demoStep=0', () => {
    useUiStore.getState().startDemo();
    expect(useUiStore.getState().demoRunning).toBe(true);
    expect(useUiStore.getState().demoStep).toBe(0);
  });
  it('pushFlashAlert stores payload', () => {
    useUiStore.getState().pushFlashAlert({ type: 'sandwich', title: 't', body: 'b' });
    expect(useUiStore.getState().flashAlert).toEqual({ type: 'sandwich', title: 't', body: 'b' });
  });
  it('dismissFlashAlert clears payload', () => {
    useUiStore.getState().pushFlashAlert({ type: 'jit', title: 't', body: 'b' });
    useUiStore.getState().dismissFlashAlert();
    expect(useUiStore.getState().flashAlert).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/store/__tests__/uiStore.test.ts`
Expected: FAIL（属性不存在）。

- [ ] **Step 3: 扩展 `uiStore.ts`**

```ts
export type Page =
  | 'live' | 'fork' | 'liquidation' | 'lpil' | 'edu' | 'report' | 'settings';

export type LensStage = 'idle' | 'capture' | 'fork' | 'parse' | 'ready' | 'zooming';

export type FlashType = 'sandwich' | 'jit' | 'liquidation';

export interface FlashAlertPayload {
  type: FlashType;
  title: string;
  body: string;
}

export interface UiState {
  page: Page;
  mode: Mode;
  alerts: Alert[];
  loading: boolean;
  // New: demo orchestration
  flashAlert: FlashAlertPayload | null;
  lensStage: LensStage;
  demoRunning: boolean;
  demoStep: number;
  blockNumber: number;

  setPage: (p: Page) => void;
  setMode: (m: Mode) => void;
  pushAlert: (a: Omit<Alert, 'id' | 'ts'>) => void;
  clearAlerts: () => void;
  setLoading: (b: boolean) => void;
  // New actions
  pushFlashAlert: (a: FlashAlertPayload) => void;
  dismissFlashAlert: () => void;
  setLensStage: (s: LensStage) => void;
  startDemo: () => void;
  advanceDemo: () => void;
  stopDemo: () => void;
  setBlockNumber: (n: number) => void;
}
```

实现 actions：

```ts
startDemo: () => set({ demoRunning: true, demoStep: 0 }),
advanceDemo: () => set((s) => ({ demoStep: s.demoStep + 1 })),
stopDemo: () => set({ demoRunning: false, demoStep: 0, flashAlert: null }),
pushFlashAlert: (a) => set({ flashAlert: a }),
dismissFlashAlert: () => set({ flashAlert: null }),
setLensStage: (s) => set({ lensStage: s }),
setBlockNumber: (n) => set({ blockNumber: n }),
```

- [ ] **Step 4: 更新 common test 的 `afterEach` reset 块** — 加入新字段默认值。

- [ ] **Step 5: 跑测试**

Run: `cd frontend && pnpm test --run src/store/__tests__/uiStore.test.ts src/components/common/__tests__/common.test.tsx`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add frontend/src/store/uiStore.ts frontend/src/store/__tests__/uiStore.test.ts frontend/src/components/common/__tests__/common.test.tsx
git commit -m "feat(frontend): extend uiStore with flash/lens/demo/blockNumber state"
```

---

### Task 1.12：改写 `FlashAlert.tsx`（右上角弹窗 + 放入显微镜 / 忽略按钮）

**Files:**
- Modify: `frontend/src/components/common/FlashAlert.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
describe('FlashAlert (demo)', () => {
  it('shows nothing when flashAlert is null', () => {
    render(<FlashAlert onEnterMicroscope={() => undefined} />);
    expect(screen.queryByTestId('flash-alert')).toBeNull();
  });
  it('renders title + body when flashAlert is set', () => {
    useUiStore.getState().pushFlashAlert({ type: 'sandwich', title: '采样到三明治！', body: 'Mempool 中…' });
    render(<FlashAlert onEnterMicroscope={() => undefined} />);
    expect(screen.getByTestId('flash-alert')).toBeInTheDocument();
    expect(screen.getByText('采样到三明治！')).toBeInTheDocument();
  });
  it('点击 放入显微镜 triggers callback', () => {
    const cb = vi.fn();
    useUiStore.getState().pushFlashAlert({ type: 'jit', title: 't', body: 'b' });
    render(<FlashAlert onEnterMicroscope={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /放入显微镜/ }));
    expect(cb).toHaveBeenCalledOnce();
  });
  it('点击 忽略 dismisses the alert', () => {
    useUiStore.getState().pushFlashAlert({ type: 'liquidation', title: 't', body: 'b' });
    render(<FlashAlert onEnterMicroscope={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /忽略/ }));
    expect(useUiStore.getState().flashAlert).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "FlashAlert \(demo\)"`
Expected: FAIL。

- [ ] **Step 3: 改写 `FlashAlert.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';

const AUTO_DISMISS_MS = 8000;

export interface FlashAlertProps {
  /** Called when user clicks 放入显微镜. */
  onEnterMicroscope: () => void;
}

export function FlashAlert({ onEnterMicroscope }: FlashAlertProps) {
  const flash = useUiStore((s) => s.flashAlert);
  const dismiss = useUiStore((s) => s.dismissFlashAlert);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => { if (!hover) dismiss(); }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [flash, hover, dismiss]);

  if (!flash) return null;
  return (
    <div
      className="dtm-flash-alert is-active"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-testid="flash-alert"
    >
      <div className="dtm-flash-title">
        <span style={{ fontSize: '1.1rem' }}>🚨</span> {flash.title}
      </div>
      <div className="dtm-flash-body">{flash.body}</div>
      <div className="dtm-flash-actions">
        <button type="button" className="dtm-flash-btn-primary" onClick={onEnterMicroscope}>
          🔬 放入显微镜
        </button>
        <button type="button" className="dtm-flash-btn-secondary" onClick={dismiss}>
          忽略
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 在 `common.css` 追加 demo `.dtm-flash-alert` 全部样式**（位置 fixed top-80 right-20，coral 边框，`.dtm-flash-btn-primary/secondary` 渐变）。

- [ ] **Step 5: 跑测试**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "FlashAlert"`
Expected: 全绿（注意原来的 `clearAlerts` 测试需要调整 — 旧 FlashAlert 是从 alerts 数组取，新的用 `flashAlert` 单字段；删掉 `pushAlert({...})` 的旧断言）。

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add frontend/src/components/common/FlashAlert.tsx frontend/src/components/common/common.css frontend/src/components/common/__tests__/common.test.tsx
git commit -m "feat(frontend): rewrite FlashAlert with demo title/body/actions"
```

---

### Task 1.13：改写 `LensTransition.tsx`（圆形放大 + 4 步骤 + 状态文字）

**Files:**
- Modify: `frontend/src/components/common/LensTransition.tsx`

- [ ] **Step 1: 写失败测试** — 验证 4 步骤图标可见、stage 切换、zooming 状态：

```tsx
describe('LensTransition (demo)', () => {
  it('renders 4 stage labels', () => {
    render(<LensTransition><span>child</span></LensTransition>);
    expect(screen.getByText('CAPTURE')).toBeInTheDocument();
    expect(screen.getByText('FORK')).toBeInTheDocument();
    expect(screen.getByText('PARSE')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
  });
  it('is idle by default (no active class)', () => {
    render(<LensTransition><span>x</span></LensTransition>);
    expect(screen.getByTestId('lens-transition').className).not.toContain('is-active');
  });
  it('shows active when uiStore.lensStage !== idle', () => {
    useUiStore.getState().setLensStage('capture');
    render(<LensTransition><span>x</span></LensTransition>);
    expect(screen.getByTestId('lens-transition').className).toContain('is-active');
  });
  it('adds zooming class at zooming stage', () => {
    useUiStore.getState().setLensStage('zooming');
    render(<LensTransition><span>x</span></LensTransition>);
    expect(screen.getByTestId('lens-transition').className).toContain('is-zooming');
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "LensTransition"`
Expected: FAIL（数据属性位置 + 4 stage 元素不存在）。

- [ ] **Step 3: 改写 `LensTransition.tsx`**

```tsx
import type { ReactNode } from 'react';
import { useUiStore, type LensStage } from '@/store/uiStore';

const STAGES: Array<{ id: LensStage; icon: string; label: string }> = [
  { id: 'capture', icon: '📡', label: 'CAPTURE' },
  { id: 'fork',    icon: '🍴', label: 'FORK' },
  { id: 'parse',   icon: '🔍', label: 'PARSE' },
  { id: 'ready',   icon: '✨', label: 'READY' },
];

export interface LensTransitionProps {
  children: ReactNode;
  /** Status text shown under the steps. */
  statusText?: string;
}

export function LensTransition({ children, statusText = '正在捕获实时 MEV 事件…' }: LensTransitionProps) {
  const stage = useUiStore((s) => s.lensStage);
  const active = stage !== 'idle';
  const zooming = stage === 'zooming';
  return (
    <>
      <div
        className={`dtm-lens-transition${active ? ' is-active' : ''}${zooming ? ' is-zooming' : ''}`}
        data-testid="lens-transition"
        data-stage={stage}
      >
        <div className="dtm-lens-bg" />
        <div className="dtm-lens-circle" />
        <div className="dtm-lens-scanline" />
        <div className="dtm-lens-content">
          <div className="dtm-lens-title">🔬 正在放入显微镜</div>
          <div className="dtm-lens-subtitle">将实时事件转换为可交互的高保真实验切片</div>
          <div className="dtm-lens-steps">
            {STAGES.map((s) => (
              <div
                key={s.id}
                className={`dtm-lens-step${stage === s.id ? ' is-active' : ''}`}
                data-testid={`lens-step-${s.id}`}
              >
                <div className="dtm-lens-step-icon">{s.icon}</div>
                <div className="dtm-lens-step-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="dtm-lens-status">{statusText}</div>
        </div>
      </div>
      {children}
    </>
  );
}
```

- [ ] **Step 4: 在 `common.css` 追加 demo `.dtm-lens-transition` 全部样式**（位置 fixed inset-0、z-index 3000、4 step 圆形 + 脉冲、zooming 时 lens 圆形扩到 300vmax）。

- [ ] **Step 5: 跑测试**

Run: `cd frontend && pnpm test --run src/components/common/__tests__/common.test.tsx -t "LensTransition"`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add frontend/src/components/common/LensTransition.tsx frontend/src/components/common/common.css frontend/src/components/common/__tests__/common.test.tsx
git commit -m "feat(frontend): rewrite LensTransition with 4 stages + zoom-in animation"
```

---

### Task 1.14：改写 `App.tsx`（Header 内嵌 demo 按钮 + RealtimeClock 浮窗 + 主题挂载）

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: 改写 `App.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  ErrorBoundary, FlashAlert, Header, LensTransition, ModeBar, NavTabs, ParticleBackground, RealtimeClock,
} from '@/components/common';
import { useExperimentStore } from '@/store/experimentStore';
import { useLiveStore } from '@/store/liveStore';
import { usePositionStore } from '@/store/positionStore';
import { useUiStore, type Page } from '@/store/uiStore';
import { MockAPI } from '@/services/mockApi';
import { spotPriceE18 } from '@/algorithms/cpmm';
import { EducationPage } from '@/pages/EducationPage';
import { ForkExperimentPage } from '@/pages/ForkExperimentPage';
import { LiquidationPage } from '@/pages/LiquidationPage';
import { LpIlPage } from '@/pages/LpIlPage';
import { LiveSamplingPage } from '@/pages/LiveSamplingPage';
import { ReportPage } from '@/pages/ReportPage';
import { runDemo } from '@/services/demoScript';

const api = new MockAPI();

const PAGES: Record<Page, () => JSX.Element> = {
  live: LiveSamplingPage,
  fork: ForkExperimentPage,
  liquidation: LiquidationPage,
  lpil: LpIlPage,
  edu: EducationPage,
  report: ReportPage,
  settings: ReportPage,
};

export function App() {
  const page = useUiStore((s) => s.page);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const setPage = useUiStore((s) => s.setPage);
  const demoRunning = useUiStore((s) => s.demoRunning);
  const blockNumber = useUiStore((s) => s.blockNumber);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pools, txs, lending, lp, experiments] = await Promise.all([
        api.listPools(), api.listTransactions(), api.listLendingPositions(),
        api.listLpPositions(), api.listExperiments(),
      ]);
      if (cancelled) return;
      const livePool = pools.find((p) => p.token0.symbol === 'ETH' && p.token1.symbol === 'USDC') ?? pools[0];
      useLiveStore.getState().init({
        mempool: txs.map((t) => ({ hash: t.hash, from: t.from, timestamp: t.timestamp, mevType: t.mevType })),
        ammPriceE18: livePool ? spotPriceE18(livePool.reserve0, livePool.reserve1) : 0n,
        cumulativeMevWei: 0n,
      });
      usePositionStore.getState().setLending(lending);
      usePositionStore.getState().setLp(lp);
      useExperimentStore.getState().loadList(experiments);
      setReady(true);
    })().catch((err) => {
      console.error('App: initial data load failed', err);
      useUiStore.getState().pushAlert({ level: 'error', message: `数据加载失败：${(err as Error).message}` });
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready) return <ParticleBackground />; // 加载中时只显示背景，避免覆盖 loading 屏

  const CurrentPage = PAGES[page] ?? ReportPage;
  const enterMicroscope = async () => {
    useUiStore.getState().dismissFlashAlert();
    await runDemo('microscope');
  };

  return (
    <ErrorBoundary>
      <ParticleBackground />
      <LensTransition>
        <div className="dtm-app" data-testid="app-root">
          <Header
            onStartDemo={() => runDemo('auto')}
            demoRunning={demoRunning}
            right={<ModeBar value={mode} onChange={setMode} />}
          />
          <NavTabs active={page} onSelect={setPage} />
          <main className="dtm-app-main" data-testid="app-main">
            <CurrentPage />
          </main>
          <RealtimeClock block={blockNumber} />
          <FlashAlert onEnterMicroscope={enterMicroscope} />
        </div>
      </LensTransition>
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 2: stub `services/demoScript.ts`**（Phase 10 完整实现，本 task 留占位避免 build 挂）

```ts
// frontend/src/services/demoScript.ts
import { useUiStore } from '@/store/uiStore';

export type DemoKind = 'auto' | 'microscope';

export async function runDemo(_kind: DemoKind): Promise<void> {
  // 实现见 Phase 10。
  useUiStore.getState().startDemo();
  // 占位：1.6s 后停止，避免单元测试挂死。
  setTimeout(() => useUiStore.getState().stopDemo(), 1600);
}
```

- [ ] **Step 3: 更新 `App.test.tsx`** — `page: 'dashboard'` → `'report'`；`name: 'Mempool'` → `'实时采样'`；`testId: 'report-summary-panel'` 保持不变；`testId: 'amm-curve-panel'` 保持不变（Phase 4 才用）。

- [ ] **Step 4: 跑全部测试**

Run: `cd frontend && pnpm test --run 2>&1 | tail -30`
Expected: 大部分绿；个别旧 test 引用 `'Dashboard'/'Mempool'/'Lending'` 等失效的 role name 仍会红。逐个改完。

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/services/demoScript.ts
git commit -m "feat(frontend): rewrite App with demo header/clock/flash/lens wiring"
```

---

## Phase 2 — Page 枚举与 Store 重命名 + 跨页通用 panel

### Task 2.1：Page 枚举重命名（已部分在 task 1.11 完成）+ 修复依赖

- 已经在 task 1.6 (NavTabs) / 1.11 (uiStore) 完成枚举定义。剩余是修复 `App.test.tsx` / 各 page index test 里的旧 key。

**Files:**
- Modify: `frontend/src/App.test.tsx`（已改）
- Modify: `frontend/src/pages/**/__tests__/index.test.tsx` 全部（替换 `dashboard → report`、`mempool → live`、`transactions → edu`、`lending → liquidation`、`positions → lpil`、`experiments → fork`）

- [ ] **Step 1: 跑测试看哪些还红**

Run: `cd frontend && pnpm test --run 2>&1 | grep -E "FAIL|✗|×" | head -50`

- [ ] **Step 2: 逐个修复引用旧 Page 字符串的位置** — 主要在 `beforeEach` 重置 store / `fireEvent.click(getByRole('tab', { name: '...' }))` / `setPage('...')`。

- [ ] **Step 3: 跑测试**

Run: `cd frontend && pnpm test --run 2>&1 | tail -5`
Expected: 0 failing（除 Phase 4-9 还没接的 page panel testId 缺失外）。

- [ ] **Step 4: 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "refactor(frontend): migrate all tests to new Page enum keys"
```

---

### Task 2.2：跨页通用 Panel 组件（demo 风格）

**Files:**
- Create: `frontend/src/components/panels/Panel.tsx`
- Create: `frontend/src/components/panels/ExplainBox.tsx`
- Create: `frontend/src/components/panels/ParamSlider.tsx`
- Create: `frontend/src/components/panels/MetricBox.tsx`
- Create: `frontend/src/components/panels/MetricGrid.tsx`
- Create: `frontend/src/components/panels/RiskGauge.tsx`
- Create: `frontend/src/components/panels/ExperimentCard.tsx`
- Create: `frontend/src/components/panels/StepButton.tsx`
- Create: `frontend/src/components/panels/index.ts`

每个组件一个 commit。每个组件结构：

- **Panel**：受控 `collapsed`（默认 false），桌面端 `> 768px` 强制展开；头部 dot + 标题 + `+ / −` 切换；可接受 `liveBadge` 槽。
- **ExplainBox**：demo `.explain-box` 直接对应，cyan 顶边渐变、引用 `<strong>` 着色。
- **ParamSlider**：label + range input + param-value（mono 字体）；受控 `value/onChange`。
- **MetricBox / MetricGrid**：单值 + 标签；接受 `style={{ color }}`。
- **RiskGauge**：cyan/lime 环 + 中央数值；支持 `value` 0-100 + `level` ('low' | 'medium' | 'high')。
- **ExperimentCard**：可点击，左边 icon + 标题 + 描述；`active` 态加 cyan 边框 + glow。
- **StepButton**：3 步骤切换按钮组（demo Fork 页用）。

每个组件各写一个最小测试（render 不挂 + 主要 prop 影响 DOM），再写实现。

```tsx
// 例：frontend/src/components/panels/Panel.tsx
import { useState, type ReactNode } from 'react';

export interface PanelProps {
  title: ReactNode;
  children: ReactNode;
  /** Dot color before the title (any CSS color). */
  dotColor?: string;
  /** Slot on the right of the header (e.g. a LIVE badge). */
  right?: ReactNode;
  /** Force collapsed on mobile only. */
  defaultCollapsed?: boolean;
  testId?: string;
}

export function Panel({ title, children, dotColor = 'var(--dtm-cyan)', right, defaultCollapsed, testId }: PanelProps) {
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed));
  return (
    <div className={`dtm-panel${collapsed ? ' is-collapsed' : ''}`} data-testid={testId}>
      <div className="dtm-panel-header" onClick={() => setCollapsed((c) => !c)}>
        <span className="dtm-panel-dot" style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }} />
        <span>{title}</span>
        {right}
      </div>
      <div className="dtm-panel-body">{children}</div>
    </div>
  );
}
```

（`index.ts` 批量 export，CSS 追加到 `demo.css`）

- [ ] **Step 1: 写最小测试 + 跑看红 + 写实现 + 跑看绿 + 提交**（每个组件一循环，7 次提交）

Run: `cd frontend && pnpm test --run src/components/panels/`
Expected: 7+ 通过。

- [ ] **Step 2: 提交**

```bash
cd /workspace && git add frontend/src/components/panels frontend/src/styles/demo.css
git commit -m "feat(frontend): add cross-page Panel family (Panel/ExplainBox/ParamSlider/MetricBox/MetricGrid/RiskGauge/ExperimentCard/StepButton)"
```

---

## Phase 3 — Live 实时采样 tab

### Task 3.1：`services/demoData.ts`（demo 风格工厂）

**Files:**
- Create: `frontend/src/services/demoData.ts`

- [ ] **Step 1: 写失败测试** — 验证 `makeTransaction` hash 64 hex、type 在 enum 内；`makeLendingPosition` 字段齐全。

```ts
// frontend/src/services/__tests__/demoData.test.ts
import { describe, expect, it } from 'vitest';
import { makeTransaction, makeLendingPosition, TX_TYPE_KEYS } from '../demoData';

describe('makeTransaction', () => {
  it('produces a 64-char hex hash', () => {
    const tx = makeTransaction('sandwich');
    expect(tx.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it('uses the requested type', () => {
    const tx = makeTransaction('liquidation');
    expect(tx.type).toBe('liquidation');
  });
  it('picks a random type when none given', () => {
    const tx = makeTransaction();
    expect(TX_TYPE_KEYS).toContain(tx.type);
  });
});

describe('makeLendingPosition', () => {
  it('produces a position with valid HF', () => {
    const p = makeLendingPosition('AaveV3');
    expect(['safe', 'warning', 'danger', 'liquidated']).toContain(p.status);
    expect(p.healthFactor).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/services/__tests__/demoData.test.ts`

- [ ] **Step 3: 实现 `demoData.ts`**

```ts
import type { Transaction } from '@/types';
import type { LendingPosition } from '@/types';

export const TX_TYPE_META = {
  sandwich:    { label: '三明治', class: 'sandwich', txClass: 'tx-type-sandwich', desc: 'Front-run → Swap → Back-run', gas: '98.2 gwei', icon: '🥪', color: '#ff5e5e' },
  arbitrage:   { label: '套利',   class: 'arbitrage', txClass: 'tx-type-arb',       desc: 'CEX-DEX 价差套利',         gas: '87.5 gwei', icon: '⚡', color: '#ffab40' },
  jit:         { label: 'JIT',    class: 'jit',       txClass: 'tx-type-jit',        desc: '瞬间注入流动性赚取手续费', gas: '125.3 gwei', icon: '🎯', color: '#b388ff' },
  liquidation: { label: '清算',   class: 'liquidation', txClass: 'tx-type-liquidation', desc: 'AAVE 健康因子 < 1.0 清算', gas: '156.8 gwei', icon: '💥', color: '#448aff' },
  normal:      { label: '正常',   class: 'normal',    txClass: 'tx-type-normal',     desc: '普通转账',                 gas: '12.4 gwei', icon: '✅', color: '#69f0ae' },
} as const;
export type TxType = keyof typeof TX_TYPE_META;
export const TX_TYPE_KEYS = Object.keys(TX_TYPE_META) as TxType[];

function hex(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return s;
}

export interface DemoTransaction extends Transaction {
  mevType: TxType;
  displayHash: string;
}

export function makeTransaction(type?: TxType): DemoTransaction {
  const t: TxType = type ?? TX_TYPE_KEYS[Math.floor(Math.random() * TX_TYPE_KEYS.length)];
  const hash = '0x' + hex(64);
  return {
    hash, from: '0x' + hex(40), to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    value: 0n, gasPrice: 25_000_000_000n, gasLimit: 150_000n, input: '0x' + hex(128),
    nonce: Math.floor(Math.random() * 500), blockNumber: undefined,
    type: t === 'normal' ? 'transfer' : 'swap',
    mevType: t,
    mevProfit: t === 'normal' ? 0n : BigInt(Math.floor(Math.random() * 2e18)),
    timestamp: Date.now(),
    displayHash: hash.slice(0, 14) + '...' + hash.slice(-6),
  };
}

export function makeLendingPosition(protocol: 'AaveV3' | 'Compound' | 'MakerDAO' = 'AaveV3'): LendingPosition {
  const colAmt = BigInt(Math.floor((1 + Math.random() * 500) * 1e18));
  const colPrice = 2000 + Math.random() * 800;
  const ltv = protocol === 'AaveV3' ? 0.8 : protocol === 'Compound' ? 0.75 : 0.66;
  const liqTh = ltv * 1.03;
  const debt = BigInt(Math.floor(Math.random() * (Number(colAmt) / 1e18 * colPrice * 0.75)));
  const hf = (Number(colAmt) / 1e18 * colPrice * liqTh) / (Number(debt) || 1);
  const liqPrice = hf > 0 ? Number(debt) / (Number(colAmt) / 1e18 * liqTh) : 0;
  return {
    user: '0x' + hex(40),
    protocol, collateralToken: 'WETH', collateralAmount: colAmt,
    debtToken: 'USDC', debtAmount: debt,
    collateralFactor: ltv, liquidationThreshold: liqTh,
    healthFactor: hf, liquidationPrice: liqPrice,
    status: hf > 1.5 ? 'safe' : hf > 1.05 ? 'warning' : hf > 1 ? 'danger' : 'liquidated',
  };
}
```

- [ ] **Step 4: 跑测试看绿 + 提交**

```bash
cd /workspace && git add frontend/src/services/demoData.ts frontend/src/services/__tests__/demoData.test.ts
git commit -m "feat(frontend): add demoData.ts with TX_TYPE_META + makeTransaction/LendingPosition"
```

---

### Task 3.2：Live page 拆分组件（6 个 panel）

**Files:**
- Create: `frontend/src/components/live/MempoolLanes.tsx`
- Create: `frontend/src/components/live/MevLegend.tsx`
- Create: `frontend/src/components/live/LiveAmmPanel.tsx`
- Create: `frontend/src/components/live/LivePnlPanel.tsx`
- Create: `frontend/src/components/live/NetworkStatus.tsx`
- Create: `frontend/src/components/live/RecentSamples.tsx`
- Create: `frontend/src/components/live/MevAttribution.tsx`
- Create: `frontend/src/components/live/index.ts`
- Create: `frontend/src/canvas/LiveAmm.ts`
- Create: `frontend/src/canvas/PnlBarChart.ts`
- Create: `frontend/src/canvas/MempoolExplosion.ts`
- Modify: `frontend/src/pages/LiveSamplingPage/index.tsx`（替换为新 layout）
- Modify: `frontend/src/pages/LiveSamplingPage/index.test.tsx`

- [ ] **Step 1: 新增 `canvas/MempoolExplosion.ts`** — `addExplosion(x, y, color)` / `drawExplosions(ctx, size)` / `resetExplosions()`，参考 demo `drawExplosions` 函数。配单测。

- [ ] **Step 2: 新增 `canvas/LiveAmm.ts`** — 维护 `priceHistory` (50 长度) + `livePrice` (2456.32 起，每次 ±2 抖动)；用 requestAnimationFrame 驱动，绘制 50 点折线 + 渐变填充。配单测。

- [ ] **Step 3: 新增 `canvas/PnlBarChart.ts`** — 4 根柱子（HODL / LP / 手续费 / 净盈亏），柱顶有数字。配单测。

- [ ] **Step 4: 实现 `live/MempoolLanes.tsx`** — 接 `mempoolContainer` 高度 320px、滚动、lane 颜色 = `txTypeMeta[mevType].class`、左侧色条 3px、hover 出现"🔬 放入显微镜"按钮（点击调 `onEnterMicroscope`）。`useEffect` 每 2500ms push 一笔新交易；80% attack 时随机触发 `triggerExplosion`。

- [ ] **Step 5: 实现 `MevLegend.tsx` / `MevAttribution.tsx` / `NetworkStatus.tsx` / `RecentSamples.tsx`** — 全部从 demo 模板直接抄结构；数据源用 `useLiveStore`。

- [ ] **Step 6: 实现 `LiveAmmPanel.tsx` / `LivePnlPanel.tsx`** — Panel + 上面 canvas + price-ticker 浮窗。

- [ ] **Step 7: 重写 `pages/LiveSamplingPage/index.tsx`**

```tsx
import { MempoolLanes, MevLegend, MevAttribution, LiveAmmPanel, LivePnlPanel, NetworkStatus, RecentSamples } from '@/components/live';
import { Panel, ExplainBox } from '@/components/panels';

export function LiveSamplingPage() {
  return (
    <div className="dtm-page dtm-page-live is-active" data-testid="live-page">
      <div className="dtm-container">
        <ExplainBox>
          <strong>实时采样模式</strong>：DTM 通过 WebSocket 直连以太坊节点，实时订阅 Mempool 中的待处理交易。你看到的就是
          <span style={{ color: 'var(--dtm-coral)' }}>此刻</span>
          区块链上正在发生的事。当采样到 MEV 策略活动时，右上角会弹出标注，你可以一键"放入显微镜"进行深度分析。
        </ExplainBox>
        <div className="dtm-grid-3">
          <div>
            <Panel title="Mempool 泳道" right={<span className="dtm-live-badge"><span className="dtm-pulse" />LIVE</span>} testId="mempool-panel">
              <MevLegend />
              <MempoolLanes onEnterMicroscope={() => useUiStore.getState().setLensStage('capture')} />
            </Panel>
            <Panel title="MEV 策略归因" dotColor="var(--dtm-amber)" testId="mev-attribution-panel" style={{ marginTop: '0.7rem' }}>
              <MevAttribution />
            </Panel>
          </div>
          <div>
            <Panel title="实时 AMM 曲线 — WETH/USDC" right={<span className="dtm-live-badge"><span className="dtm-pulse" />LIVE</span>} testId="live-amm-panel">
              <LiveAmmPanel />
            </Panel>
            <Panel title="实时损益归因" dotColor="var(--dtm-purple)" testId="live-pnl-panel" style={{ marginTop: '0.7rem' }}>
              <LivePnlPanel />
            </Panel>
          </div>
          <div>
            <Panel title="网络状态" dotColor="var(--dtm-lime)" testId="network-status-panel">
              <NetworkStatus />
            </Panel>
            <Panel title="最近采样" dotColor="var(--dtm-coral)" testId="recent-samples-panel" style={{ marginTop: '0.7rem' }}>
              <RecentSamples />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 更新 `LiveSamplingPage/index.test.tsx`** — 验证 6 个 panel testId 可见 + `amm-curve-panel` 仍可达（来自 `LiveAmmPanel` 子节点）。

- [ ] **Step 9: 跑 + 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "feat(frontend): rewrite Live tab with demo's 6-panel layout"
```

---

## Phase 4 — Fork 实验切片 tab

### Task 4.1：Fork 拆分组件

**Files:**
- Create: `frontend/src/components/fork/ForkParams.tsx`
- Create: `frontend/src/components/fork/StepControls.tsx`
- Create: `frontend/src/components/fork/ForkAmmPanel.tsx`
- Create: `frontend/src/components/fork/ForkSankeyPanel.tsx`
- Create: `frontend/src/components/fork/ForkTimeline.tsx`
- Create: `frontend/src/components/fork/QuantResults.tsx`
- Create: `frontend/src/components/fork/ForkConclusion.tsx`
- Create: `frontend/src/components/fork/index.ts`
- Create: `frontend/src/canvas/ForkAmm.ts`
- Create: `frontend/src/canvas/ForkSankey.ts`
- Modify: `frontend/src/pages/ForkExperimentPage/index.tsx`
- Modify: `frontend/src/pages/ForkExperimentPage/index.test.tsx`

- [ ] **Step 1: 新增 `canvas/ForkAmm.ts`** — 接收 `(reserve0, reserve1, depth)`，画恒积曲线 + 3 个点（前跑/交易发起方/后跑位置），滑块拖动时响应。配单测。

- [ ] **Step 2: 新增 `canvas/ForkSankey.ts`** — 简单资金流（LP 池 → 策略方 / 交易发起方 / LP 手续费 / Validator），宽度按金额比例。配单测。

- [ ] **Step 3: 实现 7 个 fork 组件** — 结构按 demo 1:1；`ForkParams` 内 5 个 ParamSlider + WETH/USDC token-row + "重放仿真"按钮 + 切片 ID 文字；`StepControls` 3 步按钮 + 说明文字；`QuantResults` Gauge + 4 个 metric box；`ForkConclusion` 解释"深池子天然抗 MEV"。

- [ ] **Step 4: 重写 `pages/ForkExperimentPage/index.tsx`** — ExplainBox + grid-3 三列布局。

- [ ] **Step 5: 更新 `index.test.tsx`** — 验证 panel testId、ExplainBox 文案含"实验切片模式"。

- [ ] **Step 6: 跑 + 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "feat(frontend): rewrite Fork tab with demo's 3-column + step controls"
```

---

## Phase 5 — Liquidation 清算 tab（panorama + focus 双视图）

### Task 5.1：清算拆分组件

**Files:**
- Create: `frontend/src/components/liquidation/{PanoramaView,FocusView,HeatmapPanel,PendingMempool,AmmDisturbanceMap,ProtocolStats,AddressInput,SimParams,ExperimentControls,RedAlert,HfGaugePanel,PriceHfCurve,LiquidationTimeline,AttributionPanel,PositionDetails,LiquidationExplanation}.tsx`
- Create: `frontend/src/components/liquidation/index.ts`
- Create: `frontend/src/canvas/{LiquidationHeatmap,AmmDisturbance,HfGauge,PriceHfCurve}.ts`
- Create: `frontend/src/store/liquidationStore.ts`（`liqMode: 'panorama' | 'focus'`、`focusAddress`、5 个滑块值）
- Modify: `frontend/src/store/liquidationStore.ts` test
- Modify: `frontend/src/pages/LiquidationPage/index.tsx`
- Modify: `frontend/src/pages/LiquidationPage/index.test.tsx`

- [ ] **Step 1: 4 个新 canvas 模块** + 各自单测。

- [ ] **Step 2: 16 个组件** 全部按 demo 1:1。

- [ ] **Step 3: liquidationStore** — `liqMode`, `setLiqMode`, `focusAddress`, `setFocusAddress`, `liqSliders: { collateral, debt, price, bonus, ltv }`, `setSlider(key, val)`, `redAlert: { active, title, desc }`, `setRedAlert(...)`。

- [ ] **Step 4: 重写 `pages/LiquidationPage/index.tsx`** — 顶部 mode 二选一按钮 + ExplainBox + 条件渲染 Panorama 或 Focus。

- [ ] **Step 5: 更新 test** — 验证 `liq-mode-panorama` / `liq-mode-focus` 两个按钮 + 各 panel testId。

- [ ] **Step 6: 跑 + 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "feat(frontend): rewrite Liquidation tab with panorama+focus dual views"
```

---

## Phase 6 — LP/IL tab

### Task 6.1：LP/IL 拆分组件

**Files:**
- Create: `frontend/src/components/lpil/{LpParams,LpScenarios,IlCurvePanel,IlPnlPanel,IlMetrics,PoolStatePanel,LpExplanation}.tsx`
- Create: `frontend/src/components/lpil/index.ts`
- Create: `frontend/src/canvas/IlPnlChart.ts`
- Create: `frontend/src/store/lpStore.ts`（5 个滑块 + version: 'v2' | 'v3' + 2 个 tick 值）
- Modify: `frontend/src/pages/LpIlPage/index.tsx`
- Modify: `frontend/src/pages/LpIlPage/index.test.tsx`

- [ ] **Step 1: `canvas/IlPnlChart.ts`** — 4 根柱（HODL / LP 价值 / 手续费 / 净盈亏），参考 demo `drawLPPnlChart`。配单测。

- [ ] **Step 2: 7 个 lpil 组件** + `lpStore`。

- [ ] **Step 3: 重写 page** + 更新 test。

- [ ] **Step 4: 跑 + 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "feat(frontend): rewrite LP/IL tab with V2/V3 toggle + 4 scenario buttons"
```

---

## Phase 7 — Education 教学实验 tab

### Task 7.1：Edu 拆分组件

**Files:**
- Create: `frontend/src/components/edu/{ScenarioList,EduParams,EduAmmPanel,EduExplain,EduLiveData,DefenseTips}.tsx`
- Create: `frontend/src/components/edu/index.ts`
- Create: `frontend/src/canvas/EduAmm.ts`
- Create: `frontend/src/store/eduStore.ts`（activeScenario + 3 slider 值）
- Modify: `frontend/src/pages/EducationPage/index.tsx`
- Modify: `frontend/src/pages/EducationPage/index.test.tsx`

- [ ] **Step 1: 6 个 edu 组件 + canvas + store**。

- [ ] **Step 2: 重写 page** + 更新 test（保留 CheatSheet/Timeline/Glossary 旧组件的挂载位置）。

- [ ] **Step 3: 跑 + 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "feat(frontend): rewrite Education tab with scenario cards + parameter sliders"
```

---

## Phase 8 — Report 合规报告 tab

### Task 8.1：Report 拆分组件

**Files:**
- Create: `frontend/src/components/report/{StrategyPie,RiskRadar,ProfitWaterfall,ReportOverview,AttackerAttribution,EvmTrace,RiskAssessment,VulnerabilityPanel,ComplianceAdvice,ExportPdfButton}.tsx`
- Create: `frontend/src/components/report/index.ts`
- Create: `frontend/src/canvas/{ReportPie,ReportRadar,ReportWaterfall}.ts`
- Create: `frontend/src/store/reportStore.ts`（attackerProfit / victimLoss / lpFee / validatorTip / protocolFee + reportId + blockNumber）
- Modify: `frontend/src/pages/ReportPage/index.tsx`
- Modify: `frontend/src/pages/ReportPage/index.test.tsx`

- [ ] **Step 1: 3 个 canvas 模块** + 各自单测（饼图 / 5 维雷达 / 利润瀑布）。

- [ ] **Step 2: 10 个 report 组件** + store + EVM trace 表格（demo 那一段硬编码即可）。

- [ ] **Step 3: 重写 page** + 更新 test，保留 `report-summary-panel` testId。

- [ ] **Step 4: 跑 + 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "feat(frontend): rewrite Report tab with 3 charts + 6 report sections"
```

---

## Phase 9 — Demo 一键实验脚本（编排 5 步）

### Task 9.1：完整 `runDemo(kind)`

**Files:**
- Modify: `frontend/src/services/demoScript.ts`
- Create: `frontend/src/services/__tests__/demoScript.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, vi } from 'vitest';
import { runDemo } from '../demoScript';
import { useUiStore } from '@/store/uiStore';

describe('runDemo (auto)', () => {
  beforeEach(() => useUiStore.setState({
    page: 'live', mode: 'live', flashAlert: null, lensStage: 'idle',
    demoRunning: false, demoStep: 0, blockNumber: 22_180_542,
  }));

  it('steps through 5 phases and stops', () => {
    vi.useFakeTimers();
    runDemo('auto');
    expect(useUiStore.getState().demoRunning).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(useUiStore.getState().demoStep).toBeGreaterThan(0);
    vi.advanceTimersByTime(20_000);
    expect(useUiStore.getState().demoRunning).toBe(false);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 跑测试看红**

Run: `cd frontend && pnpm test --run src/services/__tests__/demoScript.test.ts`

- [ ] **Step 3: 实现 `demoScript.ts`**

```ts
import { useUiStore } from '@/store/uiStore';

export type DemoKind = 'auto' | 'microscope';

const AUTO_STEPS: Array<{ t: number; run: () => void }> = [
  { t: 0,     run: () => { useUiStore.getState().setMode('live'); useUiStore.getState().setPage('live'); } },
  { t: 2000,  run: () => { useUiStore.getState().pushFlashAlert({ type: 'sandwich', title: '🚨 采样到三明治策略！', body: 'Mempool 中 WETH/USDC 出现疑似三明治：前跑买入 → 大额 Swap → 后跑卖出。交易发起方多付 ~0.8% 滑点。' }); } },
  { t: 4000,  run: () => { useUiStore.getState().dismissFlashAlert(); useUiStore.getState().setLensStage('capture'); } },
  { t: 5000,  run: () => useUiStore.getState().setLensStage('fork') },
  { t: 6000,  run: () => useUiStore.getState().setLensStage('parse') },
  { t: 7000,  run: () => useUiStore.getState().setLensStage('ready') },
  { t: 8500,  run: () => useUiStore.getState().setLensStage('zooming') },
  { t: 10500, run: () => { useUiStore.getState().setLensStage('idle'); useUiStore.getState().setMode('replay'); useUiStore.getState().setPage('fork'); } },
  { t: 16000, run: () => useUiStore.getState().stopDemo() },
];

const MICROSCOPE_STEPS: Array<{ t: number; run: () => void }> = [
  { t: 0,    run: () => useUiStore.getState().dismissFlashAlert() },
  { t: 100,  run: () => useUiStore.getState().setLensStage('capture') },
  { t: 800,  run: () => useUiStore.getState().setLensStage('fork') },
  { t: 1500, run: () => useUiStore.getState().setLensStage('parse') },
  { t: 2200, run: () => useUiStore.getState().setLensStage('ready') },
  { t: 2900, run: () => useUiStore.getState().setLensStage('zooming') },
  { t: 3500, run: () => { useUiStore.getState().setLensStage('idle'); useUiStore.getState().setPage('fork'); } },
];

let demoTimers: ReturnType<typeof setTimeout>[] = [];

export function runDemo(kind: DemoKind): void {
  // 清理之前可能残留的 timers
  stopDemoInternal();
  const steps = kind === 'auto' ? AUTO_STEPS : MICROSCOPE_STEPS;
  useUiStore.getState().startDemo();
  for (const step of steps) {
    demoTimers.push(setTimeout(() => {
      if (useUiStore.getState().demoRunning) {
        useUiStore.getState().advanceDemo();
        step.run();
      }
    }, step.t));
  }
}

function stopDemoInternal() {
  for (const t of demoTimers) clearTimeout(t);
  demoTimers = [];
}
```

- [ ] **Step 4: App.tsx 中 `enterMicroscope` 改用 `runDemo('microscope')`**

- [ ] **Step 5: 跑测试 + 提交**

```bash
cd /workspace && git add frontend/src/services/demoScript.ts frontend/src/services/__tests__/demoScript.test.ts frontend/src/App.tsx
git commit -m "feat(frontend): implement runDemo orchestration (auto + microscope)"
```

---

### Task 9.2：Mempool 触发 FlashAlert（attack 类型概率触发）

**Files:**
- Modify: `frontend/src/components/live/MempoolLanes.tsx`
- Create: `frontend/src/components/live/__tests__/MempoolLanes.test.tsx`

- [ ] **Step 1: 写失败测试** — 模拟连续 50 次 `setInterval` 推进，attack 类型的 tx 应至少触发 1 次 `pushFlashAlert`。

- [ ] **Step 2: 跑测试看红**

- [ ] **Step 3: 实现** — 在 `useEffect` 渲染新 lane 时，若 `tx.type === 'sandwich' || tx.type === 'jit'` 且 `Math.random() > 0.7` 且 `!demoRunning`，调 `pushFlashAlert`。

- [ ] **Step 4: 跑测试看绿 + 提交**

```bash
cd /workspace && git add frontend/src/components/live
git commit -m "feat(frontend): MempoolLanes triggers FlashAlert for attack txs"
```

---

### Task 9.3：`DemoOverlay` 组件

**Files:**
- Create: `frontend/src/components/common/DemoOverlay.tsx`
- Modify: `frontend/src/components/common/index.ts`
- Modify: `frontend/src/components/common/__tests__/common.test.tsx`

- [ ] **Step 1: 写测试 + 实现 + 跑 + 提交** — 显示 demoStep 文字 + 进度条 + "跳过"按钮（调 `runDemo` 的 `stopDemo`）。

```bash
cd /workspace && git add frontend/src/components/common
git commit -m "feat(frontend): add DemoOverlay bottom progress bar"
```

---

## Phase 10 — 最终集成 / QA

### Task 10.1：视觉验收 + 修复

- [ ] **Step 1: 跑 build**

Run: `cd frontend && pnpm build 2>&1 | tail -10`
Expected: 成功。

- [ ] **Step 2: 跑 dev server 手动对照 demo 6 个 tab**

Run: `cd frontend && pnpm dev`
对比 [DTM_Demo.html](file:///workspace/asset/design/DTM_Demo.html)：
- Live：mempool 持续刷新、爆炸特效可见、价格 ticker 抖动、metric 数字正确
- Fork：拖动池子深度滑块，AMM 曲线 + Gauge + Metric 实时更新
- Liquidation：panorama / focus 切换；focus 内拖 ETH 价格滑块，HF 数值变化
- LP/IL：拖当前价格滑块，IL% + 净盈亏更新；点 "📈 ETH 涨 2x" 触发滑块动画
- Edu：5 个场景卡片点击切换
- Report：3 个图表 + 6 个 report-section 全部可见；EVM trace 行齐全

- [ ] **Step 3: 跑全部测试**

Run: `cd frontend && pnpm test --run 2>&1 | tail -10`
Expected: 0 failing。

- [ ] **Step 4: 修剩余视觉/测试偏差，按需提交**

```bash
cd /workspace && git add frontend/src
git commit -m "fix(frontend): visual QA patches (Phase 10 final pass)"
```

---

### Task 10.2：性能 / a11y 收尾

- [ ] **Step 1: 加 `aria-label` 到所有 NavTabs / ModeBar 按钮（已加）。**

- [ ] **Step 2: 检查所有 canvas 模块支持 `prefers-reduced-motion`**（demo 没做，留 TODO）。

- [ ] **Step 3: 跑 Lighthouse（如可用）** — 不强制。

- [ ] **Step 4: 提交**

```bash
cd /workspace && git add frontend/src
git commit -m "chore(frontend): Phase 10 a11y and perf cleanups"
```

---

## 总结

- **Phase 数**：10 个
- **Task 数**：~30 个（部分 task 包含多组件，但每个组件都有独立 TDD cycle）
- **新文件**：~50 个（30+ 组件、13+ canvas、1 store、1 service、3 CSS、1 test util）
- **修改文件**：~15 个（uiStore、App、6 个 page、所有 common 组件、demo CSS）
- **预期总代码量**：~5500 行（4500 React/TS + 800 CSS + 200 测试）
- **TDD 节奏**：每个组件先写失败测试 → 跑红 → 写最小实现 → 跑绿 → 提交
- **commit 粒度**：~30-40 个提交，每个 1 个组件或 1 个小修改
