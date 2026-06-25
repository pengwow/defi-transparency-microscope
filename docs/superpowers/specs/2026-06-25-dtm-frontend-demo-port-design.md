# DTM Frontend — 逐像素复刻 `DTM_Demo.html` 设计 Spec

> 目标：把 `asset/design/DTM_Demo.html`（3332 行单文件 demo）作为前端"成品长这样"的真值，全部转写为 React/Vite 工程内运行；保留 `frontend/` 现有的工程化骨架（Vite + TS + Zustand + Vitest + MockAPI 数据层），仅把"视觉 + 文案 + 交互"统一到 demo 的形态。

## 1. 范围与非范围

### 1.1 In-Scope

1. **视觉系统 1:1 复刻**：`asset/design/DTM_Demo.html` 里的所有 CSS 变量、字体、动画、配色、布局结构都搬进 `frontend/src/styles/`。
2. **页面结构 1:1 复刻**：6 个 tab 的 panel 树、grid 布局、Explain 框、滑块、表单、Metric box 与 demo 一致。
3. **交互 1:1 复刻**：
   - Loading 屏（🔬 脉冲 logo + 进度条，2.5s 后淡出）
   - 实时时钟浮动小窗（底部左，含 Block #）
   - Header（含"一键实验"按钮 + 6 个 tab）
   - Mode Bar（Live / Fork 二选一胶囊）
   - Lens 转场（点击"放入显微镜"→ 圆形放大 → 4 步骤 → 切到 Fork 页）
   - Flash Alert（采样到三明治/JIT/清算时弹出）
   - Mempool 爆炸特效（attack 类型交易在泳道中爆开）
   - 粒子背景 + 扫描线 overlay
   - 移动端 panel 折叠
4. **canvas 1:1 复刻**：live AMM 实时价格、fork AMM 拖动滑块联动、IL 曲线（V2 + V3 集中）、PnL 柱图、HF Gauge、价格 vs HF 曲线、清算热力图、报告饼图 / 雷达 / 瀑布、EVM trace 行。
5. **数据生成 1:1 复刻**：demo 的 `makeTransaction / makeLendingPosition / generateTx` 行为通过 `services/demoData.ts` 暴露，但保留 `MockAPI` 抽象层（仅把生成函数内部换成 demo 风格）。
6. **Page enum 重命名**：`uiStore.Page` 从 `dashboard / mempool / transactions / lending / positions / experiments / settings` 改为 `live / fork / liquidation / lpil / edu / report`，App.tsx PAGES 映射同步。
7. **中文化**：所有用户可见文案、说明文字、按钮、提示、错误信息、日志全部中文；`data-testid` 保留英文（自动化测试需要稳定 selector）。
8. **保留工程基线**：`MockAPI` 接口契约、Vite/TS 编译、Vitest 测试套（60+ 用例）必须全部通过；新增 canvas 工具（`canvas/MempoolExplosion.ts`、`canvas/ForkAmm.ts` 等）必须可单测。

### 1.2 Out-of-Scope

- 不改后端 `backend/`、不动 `services/api.ts` 接口契约、不动 `algorithms/`。
- 不动 `asset/design/DTM_Demo.html` 本体（保留作为视觉真值参考，不删除）。
- 不做 IPFS / PDF 报告导出（demo 里的 "导出 PDF" 按钮显示 `alert('PDF 已导出')` 即可，标 TODO）。
- 不做真实 anvil fork（demo 里的 anvil RPC 调用全部走 `MockAPI` 模拟）。
- 不做主题切换 / 国际化（仅中文）。

## 2. 目录结构变化

```
frontend/
├── index.html                       ← 加 <html lang="zh-CN">、Google Fonts 预加载
├── src/
│   ├── styles/
│   │   ├── variables.css            ← 重写为 demo 的色板 + 字体栈
│   │   ├── global.css               ← 重写为 demo 的 reset + body 装饰
│   │   ├── animations.css           ← demo 的所有 @keyframes
│   │   └── demo.css                 ← 整页布局、panel、grid、form、timeline、gauge、…
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx           ← 改为 demo 的 logo + 一键实验 + 实时时钟
│   │   │   ├── ModeBar.tsx          ← 改为 demo 的 Live/Fork 大胶囊
│   │   │   ├── NavTabs.tsx          ← 改为 demo 的 6 个中文 tab
│   │   │   ├── LoadingScreen.tsx    ← 🔬 logo + Playfair 标题 + 进度条
│   │   │   ├── RealtimeClock.tsx    ← 浮动小窗，含 Block #
│   │   │   ├── ParticleBackground.tsx   ← 新：调用 canvas/ParticleBackground
│   │   │   ├── ScanlineOverlay.tsx      ← 新：扫描线 + 整体
│   │   │   ├── LensTransition.tsx       ← 重写：圆形放大 + 4 步骤 + 状态文字
│   │   │   ├── FlashAlert.tsx           ← 重写：右上角 + 放入显微镜/忽略按钮
│   │   │   ├── DemoOverlay.tsx          ← 新：底部居中进度条 + 跳过
│   │   │   ├── ExplainBox.tsx           ← 文案调整，颜色用 cyan
│   │   │   ├── Panel.tsx                ← 重写：折叠/展开 + 移动端 +
│   │   │   └── index.ts                 ← 导出更新
│   │   ├── live/                    ← 新目录：Live 页拆分组件
│   │   │   ├── MempoolLanes.tsx
│   │   │   ├── MevLegend.tsx
│   │   │   ├── LiveAmmPanel.tsx
│   │   │   ├── LivePnlPanel.tsx
│   │   │   ├── NetworkStatus.tsx
│   │   │   ├── RecentSamples.tsx
│   │   │   ├── MevAttribution.tsx
│   │   │   └── index.ts
│   │   ├── fork/                    ← 新目录：Fork 页
│   │   │   ├── ForkParams.tsx
│   │   │   ├── StepControls.tsx
│   │   │   ├── ForkAmmPanel.tsx
│   │   │   ├── ForkSankeyPanel.tsx
│   │   │   ├── ForkTimeline.tsx
│   │   │   ├── QuantResults.tsx
│   │   │   ├── ForkConclusion.tsx
│   │   │   └── index.ts
│   │   ├── liquidation/             ← 新目录
│   │   │   ├── PanoramaView.tsx
│   │   │   ├── FocusView.tsx
│   │   │   ├── HeatmapPanel.tsx
│   │   │   ├── PendingMempool.tsx
│   │   │   ├── AmmDisturbanceMap.tsx
│   │   │   ├── ProtocolStats.tsx
│   │   │   ├── AddressInput.tsx
│   │   │   ├── SimParams.tsx
│   │   │   ├── ExperimentControls.tsx
│   │   │   ├── RedAlert.tsx
│   │   │   ├── HfGaugePanel.tsx
│   │   │   ├── PriceHfCurve.tsx
│   │   │   ├── LiquidationTimeline.tsx
│   │   │   ├── AttributionPanel.tsx
│   │   │   ├── PositionDetails.tsx
│   │   │   ├── LiquidationExplanation.tsx
│   │   │   └── index.ts
│   │   ├── lpil/                    ← 新目录
│   │   │   ├── LpParams.tsx
│   │   │   ├── LpScenarios.tsx
│   │   │   ├── IlCurvePanel.tsx
│   │   │   ├── IlPnlPanel.tsx
│   │   │   ├── IlMetrics.tsx
│   │   │   ├── PoolStatePanel.tsx
│   │   │   ├── LpExplanation.tsx
│   │   │   └── index.ts
│   │   ├── edu/                     ← 新目录
│   │   │   ├── ScenarioList.tsx
│   │   │   ├── EduParams.tsx
│   │   │   ├── EduAmmPanel.tsx
│   │   │   ├── EduExplain.tsx
│   │   │   ├── EduLiveData.tsx
│   │   │   ├── DefenseTips.tsx
│   │   │   └── index.ts
│   │   ├── report/                  ← 新目录
│   │   │   ├── StrategyPie.tsx
│   │   │   ├── RiskRadar.tsx
│   │   │   ├── ProfitWaterfall.tsx
│   │   │   ├── ReportOverview.tsx
│   │   │   ├── AttackerAttribution.tsx
│   │   │   ├── EvmTrace.tsx
│   │   │   ├── RiskAssessment.tsx
│   │   │   ├── VulnerabilityPanel.tsx
│   │   │   ├── ComplianceAdvice.tsx
│   │   │   └── index.ts
│   │   └── panels/                  ← 新目录：跨页通用 panel
│   │       ├── ExplainBox.tsx       ← 与 common 区分
│   │       ├── ParamSlider.tsx
│   │       ├── MetricBox.tsx
│   │       ├── MetricGrid.tsx
│   │       ├── ExperimentCard.tsx
│   │       ├── StepButton.tsx
│   │       ├── RiskGauge.tsx
│   │       └── index.ts
│   ├── canvas/
│   │   ├── ParticleBackground.ts    ← 新：从 demo 移植
│   │   ├── MempoolExplosion.ts      ← 新
│   │   ├── LiveAmm.ts               ← 新：实时价格曲线 + ticker
│   │   ├── PnlBarChart.ts           ← 新
│   │   ├── ForkAmm.ts               ← 新：可拖动深度滑块联动
│   │   ├── ForkSankey.ts            ← 新（已有 SankeyDiagram 但语义不同）
│   │   ├── LiquidationHeatmap.ts    ← 新
│   │   ├── AmmDisturbance.ts        ← 新：x·y=k 扰动 + 红圈脉冲
│   │   ├── HfGauge.ts               ← 新（已有 Gauge 但 demo 风格不同）
│   │   ├── PriceHfCurve.ts          ← 新
│   │   ├── IlCurve.ts               ← 已有，复用
│   │   ├── IlPnlChart.ts            ← 新
│   │   ├── ReportPie.ts             ← 新
│   │   ├── ReportRadar.ts           ← 新
│   │   ├── ReportWaterfall.ts       ← 新
│   │   └── useCanvas.ts             ← 已有，复用
│   ├── pages/
│   │   ├── LiveSamplingPage/        ← 保留目录名，文件全改写为调用 live/ 组件
│   │   ├── ForkExperimentPage/      ← 同上，调用 fork/ 组件
│   │   ├── LiquidationPage/         ← 同上
│   │   ├── LpIlPage/                ← 同上
│   │   ├── EducationPage/           ← 同上
│   │   ├── ReportPage/              ← 同上
│   │   └── index.ts                 ← 重新导出
│   ├── services/
│   │   ├── mockApi.ts               ← 保留接口契约
│   │   ├── demoData.ts              ← 新：makeTransaction / makeLendingPosition 风格
│   │   └── api.ts                   ← 不动
│   ├── store/
│   │   ├── uiStore.ts               ← Page enum 重命名
│   │   ├── liveStore.ts             ← 字段微调（加 mevType 颜色映射等）
│   │   ├── positionStore.ts         ← 不动
│   │   └── experimentStore.ts       ← 不动
│   ├── App.tsx                      ← Header 重组（去掉 RealtimeClock 注入，改 Header 内置）
│   └── main.tsx                     ← 不动
├── tests/setup.ts                   ← 适配新 Page 枚举的工厂
```

## 3. 设计 Token 映射

把 demo 的 `:root` 1:1 搬到 `variables.css`：

| demo 变量 | 新名 | 用途 |
|---|---|---|
| `--bg-deep` | `--bg` | body 背景 |
| `--bg-mid` | `--bg-elevated` | mode bar 背景 |
| `--bg-surface` | `--surface` | panel 背景 |
| `--bg-card` | `--surface-2` | metric box 背景 |
| `--bg-hover` | `--surface-hover` | 行 hover |
| `--cyan` | `--accent` | 主色 |
| `--amber` | `--warn` | 套利 |
| `--coral` | `--danger` | 三明治 / 攻击 |
| `--lime` | `--success` | 正常 / 盈利 |
| `--purple` | `--accent-2` | JIT |
| `--blue` | `--info` | 清算 |
| `--ink` | `--text` | 主文字 |
| `--sub` | `--text-muted` | 次文字 |
| `--muted` | `--text-dim` | 三级文字 |
| `--rule` | `--border` | 边框 |
| `--glow` | `--accent-soft` | 强调背景 |

字体：

- 正文：`'Noto Sans SC', system-ui, -apple-system, 'Segoe UI', sans-serif`
- 数字/代码：`'JetBrains Mono', ui-monospace, monospace`
- 标题（logo、loading title）：`'Playfair Display', Georgia, serif`

## 4. Page 枚举重命名

`uiStore.ts`:

```ts
export type Page =
  | 'live'        // 实时采样（原 mempool）
  | 'fork'        // 实验切片（原 experiments）
  | 'liquidation' // 清算（原 lending）
  | 'lpil'        // LP/IL（原 positions）
  | 'edu'         // 教学实验（原 transactions）
  | 'report'      // 报告（原 dashboard）
  | 'settings';   // 保留但未使用
```

`App.tsx` 映射：

```ts
const PAGES: Record<Page, () => JSX.Element> = {
  live: LiveSamplingPage,
  fork: ForkExperimentPage,
  liquidation: LiquidationPage,
  lpil: LpIlPage,
  edu: EducationPage,
  report: ReportPage,
  settings: ReportPage,
};
```

## 5. 关键交互的实现

### 5.1 加载屏

- `LoadingScreen` 组件挂载后启动 2.5s 定时器，结束后调用 `onReady`。
- Logo 用 `🔬` 字符 + `loadingPulse` 动画（缩放 1→1.05，box-shadow 增大）。
- 进度条 2s 动画 0→100%。
- 标题用 Playfair Display，色 cyan。

### 5.2 实时时钟

- 浮动到 `position: fixed; bottom: 1rem; left: 1rem;`。
- 数字 + 日期 + Block #（从 `useLiveStore` 拿 `blockNumber`，每 12s 模拟加 1）。
- 移动端 padding 缩小。

### 5.3 Header

- logo：🔬 + "DeFi" + cyan "透明显微镜"。
- 右侧："一键实验"按钮（点击触发 `startDemo()` 编排 5 步脚本） + NavTabs。
- "一键实验"中按钮文案在"▶ 一键实验" ↔ "⏸ 实验中…"之间切换，颜色 coral ↔ lime。

### 5.4 Lens 转场

- `LensTransition` 包在 `App` 顶层。
- 触发流程：
  1. `enterMicroscope()` 异步调用 `api.createSection(blockNumber)`。
  2. 显示 `LensTransition`（z-index 3000）。
  3. 4 步骤图标（📡 CAPTURE / 🍴 FORK / 🔍 PARSE / ✨ READY）依次激活。
  4. 1.4s 时 lens 圆形放大到 300vmax。
  5. 3.2s 时关闭转场，`uiStore.setMode('fork')`、`uiStore.setPage('fork')`。

### 5.5 Flash Alert

- `useUiStore` 维护 `flashAlert: { type, body } | null`。
- 触发：mempool 渲染时随机（30% 概率）触发三明治/JIT/清算；Mempool lane 插入时同步调 `triggerExplosion`。
- 关闭：用户点击"忽略"或 8s 后（hover 时不关）。

### 5.6 粒子背景

- 80 颗粒子（cyan），半透明，连线距离 < 120px。
- 暴露为 `<ParticleBackground />` 组件，挂在 App 根。

### 5.7 扫描线 Overlay

- `body::after` 实现，2px 重复横向 cyan 渐变，z-index 9998，pointer-events none。

### 5.8 一键实验

- 5 步脚本：进 Live → 注入三明治 → 弹 Flash → 进 Fork → 拉深度滑块 1000→5000。
- 用 `setTimeout` 链驱动；`DemoOverlay` 显示当前步骤 + 进度条 + 跳过按钮。
- `stopDemo()` 清理所有 timer，重置 UI。

### 5.9 Mempool 爆炸

- 在 `MempoolLanes` 上方覆盖一个 absolute canvas。
- 每次新泳道是 attack 类型时，在泳道中心生成 12 颗粒子，向外飞散 + 渐隐。

## 6. canvas 移植策略

每个 demo 的 canvas 函数改写为 `canvas/Xxx.ts` 模块，遵循 `useCanvas` 抽象（rAF loop + DPR-aware + resize 监听）。

| demo 函数 | 新模块 | 复用已有 |
|---|---|---|
| `drawParticles` | `ParticleBackground.ts` | `useCanvas` |
| `drawExplosions` | `MempoolExplosion.ts` | `useCanvas` |
| `initLiveAmm / drawLiveAmm` | `LiveAmm.ts` | `useCanvas` |
| `initPnlCanvas` | `PnlBarChart.ts` | `useCanvas` |
| `initForkAmm` | `ForkAmm.ts` | `useCanvas` + `cpmm.ts` |
| `initForkSankey` | `ForkSankey.ts` | `useCanvas` |
| `drawHeatmap` | `LiquidationHeatmap.ts` | `useCanvas`（已存在 Heatmap 但语义不同） |
| `drawAmmMap` | `AmmDisturbance.ts` | `useCanvas` |
| `initLiqGauge / drawLiqGauge` | `HfGauge.ts` | `useCanvas`（已有 Gauge 但用 demo 风格） |
| `initLiqCurve` | `PriceHfCurve.ts` | `useCanvas` + `hf.ts` |
| `drawLPILCurve` | 复用 `ILCurve.ts` | ✅ 已有 |
| `drawLPPnlChart` | `IlPnlChart.ts` | `useCanvas`（与 PnLBarChart 区分） |
| `initReportCharts / drawReportPie` | `ReportPie.ts` | `useCanvas` |
| `initReportRadar` | `ReportRadar.ts` | `useCanvas` |
| `initReportWaterfall` | `ReportWaterfall.ts` | `useCanvas` |

每个新模块都补一个 `*.test.ts`，验证：
- 不抛错（构造时不依赖 DOM 异常）
- 给定最小输入能产出非空 canvas 操作序列（用 mock 2d context 计数 fillRect / arc / fillText 调用）

## 7. 数据层

`MockAPI` 签名保持不变；内部用 `demoData.ts` 的工厂函数：

```ts
// services/demoData.ts
export const TX_TYPE_META = {
  sandwich:    { label: '三明治', class: 'sandwich', txClass: 'tx-type-sandwich', desc: 'Front-run → Swap → Back-run', gas: '98.2 gwei', icon: '🥪', color: '#ff5e5e' },
  arbitrage:   { label: '套利',   class: 'arbitrage', txClass: 'tx-type-arb',       desc: 'CEX-DEX 价差套利',         gas: '87.5 gwei', icon: '⚡', color: '#ffab40' },
  jit:         { label: 'JIT',    class: 'jit',       txClass: 'tx-type-jit',        desc: '瞬间注入流动性赚取手续费', gas: '125.3 gwei', icon: '🎯', color: '#b388ff' },
  liquidation: { label: '清算',   class: 'liquidation', txClass: 'tx-type-liquidation', desc: 'AAVE 健康因子 < 1.0 清算', gas: '156.8 gwei', icon: '💥', color: '#448aff' },
  normal:      { label: '正常',   class: 'normal',    txClass: 'tx-type-normal',     desc: '普通转账',                 gas: '12.4 gwei', icon: '✅', color: '#69f0ae' },
} as const;

export function makeTransaction(type?: keyof typeof TX_TYPE_META): Transaction { /* … */ }
export function makeLendingPosition(protocol?: 'AaveV3' | 'Compound' | 'MakerDAO'): LendingPosition { /* … */ }
```

## 8. 测试

- 保留所有 60+ 现有 Vitest 用例；凡是引用 `Page` 枚举的（`App.test.tsx`、各 page index test）改为用新字符串 `'live' | 'fork' | …`。
- 新增组件 / canvas 模块的单测：
  - `LoadingScreen` 测：2.5s 后调用 `onReady`。
  - `LensTransition` 测：4 步骤依次激活；动画完成时调 `onComplete`。
  - `FlashAlert` 测：8s 后自动消失（hover 时不消失）。
  - `MempoolExplosion` 测：触发 1 次后粒子数 > 0。
  - `ForkAmm` 测：传入 `depth=5000` 时画布被多次 fill。
  - `ReportPie/Radar/Waterfall` 测：mock 2d context 验证绘制。
- `MockAPI` 行为测试：继续 8 个 `listPools / listTransactions / …`，加 1 个 `makeTransaction` 的属性测试（hash 64 hex、type ∈ TX_TYPE_META）。

## 9. 验收清单

- [ ] `pnpm --filter frontend test` 全绿，60+ 现存 + 12+ 新增测试通过。
- [ ] `pnpm --filter frontend build` 产物可 `pnpm --filter frontend preview` 打开。
- [ ] 打开 `http://localhost:5173/`，顺序核对 demo 6 个 tab：
  - [ ] Live：mempool 持续刷新，爆炸特效可见，价格 ticker 抖动，metric box 数量正确。
  - [ ] Fork：拖动"池子深度"滑块，AMM 曲线 + Gauge + Metric 实时更新。
  - [ ] Liquidation：panorama / focus 切换；focus 内拖"ETH 价格"滑块，HF 数值变化。
  - [ ] LP/IL：拖"当前价格"滑块，IL% + 净盈亏更新；点 "📈 ETH 涨 2x" 触发滑块动画。
  - [ ] Edu：5 个场景卡片点击切换；3 个滑块联动 AMM 曲线 + 实时数据。
  - [ ] Report：3 个图表（饼/雷达/瀑布）+ 6 个 report-section 全部可见；EVM trace 行齐全。
- [ ] 顶部 "🔬 DeFi 透明显微镜" logo + "▶ 一键实验" 按钮可见；点击启动 5 步脚本并自动切到 Fork。
- [ ] 浮窗实时时钟显示 Block #，每秒刷新。
- [ ] loading 屏 2.5s 后淡出，logo 有脉冲动画。
- [ ] 扫描线 overlay 可见（不挡交互）。
- [ ] 粒子背景动起来。
- [ ] 控制台 0 error 0 warn。
- [ ] 移动端（≤ 768px）panel 可折叠、字号自动缩小。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 3332 行 demo 全量转写工作量大、易遗漏 | 按 tab 6 个分组，每组 1 个 PR；先用 fixture 视频/录屏比对 |
| 现有 React 单测会因 Page 重命名全部失败 | 一次性全局替换 `dashboard → report`、`mempool → live` 等，CI 校验 |
| canvas 移植视觉差异（抗锯齿/字体度量） | 用 `getBoundingClientRect()` + DPR，与 demo 同源 |
| 浮窗实时时钟影响布局 | `position: fixed`，不占主文档流 |
| Mempool 爆炸在 React 18 严格模式下会双重挂载 | 用 `useRef` 缓存 canvas 句柄；rAF 在 `useEffect` cleanup 中 cancel |
| 大量新组件导致 `App.tsx` 文件超大 | 抽出 `AppShell.tsx` 仅负责布局 + 路由；具体页面在 pages/ |
