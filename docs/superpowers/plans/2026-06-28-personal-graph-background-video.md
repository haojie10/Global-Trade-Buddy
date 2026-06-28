# 个人图谱网页背景视频及动效组件实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 App 网页底层部署无缝循环的 Canvas 个人图谱背景动画，并提供 HyperFrames 视频导出源。

**架构：**
1. 将数学算法（周期漂移、连接拓扑、生成树算法、5s 轮替交叉渐变）抽离至可测试的数学库 `lib/background-graph-math.ts`。
2. 采用 TDD 编写数学及拓扑库的单元测试 `tests/background-graph.test.ts`。
3. 实现 Next.js 独立 Canvas 组件 `components/BackgroundGraph.tsx` 并挂载于 `pages/_app.tsx` 展现全屏背景。
4. 提供 `public/hyperframes/background.html` 供 HyperFrames 录制生成 20s 循环 MP4 视频。

**技术栈：** Next.js, React, TypeScript, HTML5 Canvas, Vitest

---

## 文件结构与职责

* `lib/background-graph-math.ts` [NEW]: 负责图谱拓扑连接、随机种子发生器、正弦漂移波形与 5s 轮换交叉渐变逻辑。
* `tests/background-graph.test.ts` [NEW]: TDD 单元测试，验证图谱的连通性（确保无孤立断点）与 20s 无缝循环首尾一致性。
* `components/BackgroundGraph.tsx` [NEW]: 全屏网页背景 Canvas 组件，周期绘制点、线、流动虚线与四角呼吸选中标识。
* `components/BackgroundGraph.module.css` [NEW]: CSS 样式，控制 Canvas fixed 绝对定位并置于所有页面的底层。
* `pages/_app.tsx` [MODIFY]: 挂载 `BackgroundGraph`，实现应用全路径共享的图谱动效背景。
* `public/hyperframes/background.html` [NEW]: 静态网页，完美对齐 Canvas 代码，用于 HyperFrames headless 录制 20s MP4 背景视频。

---

## 详细任务列表

### 任务 1：创建数学库与 TDD 单元测试

**文件：**
* 创建：`lib/background-graph-math.ts`
* 创建：`tests/background-graph.test.ts`

- [ ] **步骤 1：编写数学库的基础定义与 TDD 测试用例**
  编写测试以验证：
  1. 生成的图谱具有完全连通性（利用 DFS 确保所有 40 个节点均可相互到达，无孤立断点）。
  2. 轮替函数 `getSelectionFactor` 的 20 秒循环首尾一致（$t=0$ 与 $t=20$ 时的值相同，过渡平滑）。

  在 `tests/background-graph.test.ts` 写入：
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { generateTopology, getSelectionFactor } from '../lib/background-graph-math';

  describe('Background Graph Math & Topology Tests', () => {
    it('should generate a fully connected graph topology with no isolated components', () => {
      const nodeCount = 40;
      const links = generateTopology(nodeCount);
      
      // DFS to verify all nodes are reachable from node 0
      const adj: Record<number, number[]> = {};
      for (let i = 0; i < nodeCount; i++) adj[i] = [];
      links.forEach(l => {
        adj[l.source].push(l.target);
        adj[l.target].push(l.source);
      });
      
      const visited = new Set<number>();
      function dfs(node: number) {
        visited.add(node);
        adj[node].forEach(neighbor => {
          if (!visited.has(neighbor)) dfs(neighbor);
        });
      }
      dfs(0);
      
      expect(visited.size).toBe(nodeCount);
    });

    it('should calculate selection factors correctly and loop seamlessly at 20 seconds', () => {
      // Test selection factor interpolation and boundary values
      const factorStart = getSelectionFactor(0, 0.0);
      const factorEnd = getSelectionFactor(0, 20.0);
      expect(factorStart).toBeCloseTo(factorEnd, 5);

      // Verify node 0 is active around 2.5s
      expect(getSelectionFactor(0, 2.5)).toBe(1.0);
      expect(getSelectionFactor(0, 7.5)).toBe(0.0);
      
      // Verify cross-fade at transition point 5.0s (both node 0 and 1 are 0.5)
      expect(getSelectionFactor(0, 5.0)).toBeCloseTo(0.5, 2);
      expect(getSelectionFactor(1, 5.0)).toBeCloseTo(0.5, 2);
    });
  });
  ```

- [ ] **步骤 2：运行单元测试，确认报错失败**
  运行：`npx vitest run tests/background-graph.test.ts`
  预期：FAIL（报错提示无法导入模块 `lib/background-graph-math`）

- [ ] **步骤 3：编写 `lib/background-graph-math.ts` 实现最简通过代码**
  在 `lib/background-graph-math.ts` 写入：
  ```typescript
  export interface Link {
    source: number;
    target: number;
    relationType: 'competitor' | 'supplier' | 'operation' | 'mention';
  }

  // Seeded random number generator
  let seed = 450;
  function random(): number {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  // Generate connected topology using Spanning Tree + Extra links
  export function generateTopology(nodeCount: number): Link[] {
    const links: Link[] = [];
    const relationTypes: Link['relationType'][] = ['competitor', 'supplier', 'operation', 'mention'];

    // 1. Spanning Tree to guarantee connectedness
    for (let i = 1; i < nodeCount; i++) {
      const target = Math.floor(random() * i);
      links.push({
        source: i,
        target,
        relationType: relationTypes[Math.floor(random() * 4)]
      });
    }

    // 2. Extra links
    for (let k = 0; k < 30; k++) {
      const source = Math.floor(random() * nodeCount);
      let target = Math.floor(random() * nodeCount);
      while (source === target) {
        target = Math.floor(random() * nodeCount);
      }
      const exists = links.some(l => (l.source === source && l.target === target) || (l.source === target && l.target === source));
      if (!exists) {
        links.push({
          source,
          target,
          relationType: relationTypes[Math.floor(random() * 4)]
        });
      }
    }
    return links;
  }

  // Modulo 20s selection factor selector (0s-5s: Node 0, 5s-10s: Node 1, 10s-15s: Node 2, 15s-20s: Node 3)
  export function getSelectionFactor(selIndex: number, t: number): number {
    if (selIndex < 0) return 0;
    const center = selIndex * 5 + 2.5;
    
    let diff = Math.abs(t - center);
    if (diff > 10) {
      diff = 20 - diff;
    }
    
    if (diff <= 2.0) return 1.0;
    if (diff >= 3.0) return 0.0;
    return 1.0 - (diff - 2.0);
  }
  ```

- [ ] **步骤 4：运行测试确认通过**
  运行：`npx vitest run tests/background-graph.test.ts`
  预期：PASS

- [ ] **步骤 5：Commit**
  命令：
  ```bash
  git add lib/background-graph-math.ts tests/background-graph.test.ts
  git commit -m "test: implement math and topology helper with TDD tests"
  ```

---

### 任务 2：创建 `BackgroundGraph` 全屏背景组件

**文件：**
* 创建：`components/BackgroundGraph.module.css`
* 创建：`components/BackgroundGraph.tsx`

- [ ] **步骤 1：编写全屏 Canvas 样式类**
  在 `components/BackgroundGraph.module.css` 写入：
  ```css
  .container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1; /* Layer behind all Next.js contents */
    background: radial-gradient(circle at 10% 10%, rgba(255, 100, 30, 0.012) 0%, transparent 45%),
                radial-gradient(circle at 90% 90%, rgba(255, 100, 30, 0.008) 0%, transparent 45%),
                linear-gradient(135deg, #fdfbf7 0%, #f5f0eb 100%);
    overflow: hidden;
    pointer-events: none; /* Let clicks pass through to page elements */
  }

  .canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  ```

- [ ] **步骤 2：编写 React Canvas 逻辑，实现双色圆点、加粗连线与四角呼吸标识**
  在 `components/BackgroundGraph.tsx` 写入：
  ```typescript
  import React, { useEffect, useRef } from 'react';
  import styles from './BackgroundGraph.module.css';
  import { generateTopology, getSelectionFactor } from '../lib/background-graph-math';

  interface NodeData {
    id: number;
    bx: number;
    by: number;
    color: string;
    radius: number;
    selectionIndex: number;
    fx1: number; fx2: number; fy1: number; fy2: number;
    ax1: number; ax2: number; ay1: number; ay2: number;
    px1: number; px2: number; py1: number; py2: number;
  }

  export default function BackgroundGraph() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = 0, height = 0;
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      };
      window.addEventListener('resize', resize);
      resize();

      // Seeded random number generator
      let seed = 450;
      const random = () => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      const nodeCount = 40;
      const uniformRadius = 11.0;
      const nodes: NodeData[] = [];

      // Predefined 4 visible selection nodes
      for (let i = 0; i < 4; i++) {
        const positions = [
          { bx: 0.5, by: 0.25 }, // Top
          { bx: 0.76, by: 0.5 }, // Right
          { bx: 0.5, by: 0.75 }, // Bottom
          { bx: 0.24, by: 0.5 }  // Left
        ];
        nodes.push({
          id: i,
          bx: positions[i].bx,
          by: positions[i].by,
          color: '#ff641e',
          radius: uniformRadius,
          selectionIndex: i,
          fx1: 0, fx2: 0, fy1: 0, fy2: 0,
          ax1: 0, ax2: 0, ay1: 0, ay2: 0,
          px1: 0, px2: 0, py1: 0, py2: 0
        });
      }

      // Rest 36 nodes distributed inside infinite bounds [-0.15, 1.15]
      for (let i = 4; i < nodeCount; i++) {
        nodes.push({
          id: i,
          bx: -0.15 + random() * 1.30,
          by: -0.15 + random() * 1.30,
          color: random() > 0.55 ? '#ff641e' : '#7a756f',
          radius: uniformRadius,
          selectionIndex: -1,
          fx1: 0, fx2: 0, fy1: 0, fy2: 0,
          ax1: 0, ax2: 0, ay1: 0, ay2: 0,
          px1: 0, px2: 0, py1: 0, py2: 0
        });
      }

      // Assign drift properties (Synchronized speeds upping by 50%)
      nodes.forEach(node => {
        node.fx1 = (Math.floor(random() * 2) + 2) * 0.05; 
        node.fx2 = (Math.floor(random() * 2) + 3) * 0.05; 
        node.fy1 = (Math.floor(random() * 2) + 2) * 0.05;
        node.fy2 = (Math.floor(random() * 2) + 3) * 0.05;

        node.ax1 = random() * 8 + 7;
        node.ax2 = random() * 4 + 2;
        node.ay1 = random() * 8 + 7;
        node.ay2 = random() * 4 + 2;

        node.px1 = random() * Math.PI * 2;
        node.px2 = random() * Math.PI * 2;
        node.py1 = random() * Math.PI * 2;
        node.py2 = random() * Math.PI * 2;
      });

      const links = generateTopology(nodeCount);

      let animId = 0;
      const draw = (timestamp: number) => {
        const t = (timestamp % 20000) / 1000;

        ctx.clearRect(0, 0, width, height);

        // Precompute coordinates and factors
        const computed = nodes.map(node => {
          const baseX = node.bx * width;
          const baseY = node.by * height;
          const dx = node.ax1 * Math.sin(2 * Math.PI * node.fx1 * t + node.px1) + 
                     node.ax2 * Math.sin(2 * Math.PI * node.fx2 * t + node.px2);
          const dy = node.ay1 * Math.cos(2 * Math.PI * node.fy1 * t + node.py1) + 
                     node.ay2 * Math.cos(2 * Math.PI * node.fy2 * t + node.py2);
          return {
            id: node.id,
            x: baseX + dx,
            y: baseY + dy,
            radius: node.radius,
            color: node.color,
            selFactor: getSelectionFactor(node.selectionIndex, t)
          };
        });

        const nodeMap: Record<number, typeof computed[0]> = {};
        computed.forEach(n => { nodeMap[n.id] = n; });

        // 1. Draw Lines (Subtle contrast background)
        links.forEach(link => {
          const n1 = nodeMap[link.source];
          const n2 = nodeMap[link.target];
          if (!n1 || !n2) return;

          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = Math.min(width, height) * 0.5;

          let opacity = 0.08 + Math.max(0, 1 - dist / maxDistance) * 0.20;
          opacity = Math.min(0.25, opacity);

          const maxSel = Math.max(n1.selFactor, n2.selFactor);
          if (maxSel > 0) {
            opacity = Math.min(0.50, opacity + maxSel * 0.18);
          }

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);

          switch (link.relationType) {
            case 'competitor':
              ctx.strokeStyle = `rgba(211, 47, 47, ${opacity * 0.5})`;
              ctx.lineWidth = 1.8;
              break;
            case 'supplier':
              ctx.strokeStyle = `rgba(255, 100, 30, ${opacity * 0.7})`;
              ctx.lineWidth = 2.0;
              ctx.setLineDash([6, 6]);
              ctx.lineDashOffset = -t * 36;
              break;
            case 'operation':
              ctx.strokeStyle = `rgba(21, 101, 192, ${opacity * 0.5})`;
              ctx.lineWidth = 1.8;
              break;
            case 'mention':
            default:
              ctx.strokeStyle = `rgba(160, 155, 149, ${opacity * 0.4})`;
              ctx.lineWidth = 1.4;
              ctx.setLineDash([3, 4]);
              break;
          }
          ctx.stroke();
          ctx.restore();
        });

        // 2. Draw Nodes
        computed.forEach(node => {
          const sel = node.selFactor;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

          if (sel > 0) {
            ctx.save();
            ctx.shadowBlur = 6 * sel;
            ctx.shadowColor = 'rgba(255, 100, 30, 0.6)';
            ctx.fillStyle = `rgba(255, 100, 30, ${0.3 + 0.45 * sel})`;
            ctx.fill();
            ctx.restore();

            // Draw L-shaped corner box
            ctx.save();
            const pulse = 1 + Math.sin(t * Math.PI * 2 * 1.5) * 0.15;
            const boxSize = node.radius * 2.5 * pulse;
            ctx.strokeStyle = `rgba(255, 100, 30, ${sel * 0.65})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            const half = boxSize / 2;
            const len = boxSize / 4;

            // Top-Left L
            ctx.moveTo(node.x - half, node.y - half + len);
            ctx.lineTo(node.x - half, node.y - half);
            ctx.lineTo(node.x - half + len, node.y - half);
            
            // Top-Right L
            ctx.moveTo(node.x + half - len, node.y - half);
            ctx.lineTo(node.x + half, node.y - half);
            ctx.lineTo(node.x + half, node.y - half + len);
            
            // Bottom-Left L
            ctx.moveTo(node.x - half, node.y + half - len);
            ctx.lineTo(node.x - half, node.y + half);
            ctx.lineTo(node.x - half + len, node.y + half);
            
            // Bottom-Right L
            ctx.moveTo(node.x + half - len, node.y + half);
            ctx.lineTo(node.x + half, node.y + half);
            ctx.lineTo(node.x + half, node.y + half - len);

            ctx.stroke();
            ctx.restore();
          } else {
            if (node.color === '#ff641e') {
              ctx.fillStyle = 'rgba(255, 100, 30, 0.22)';
            } else {
              ctx.fillStyle = 'rgba(122, 117, 111, 0.18)';
            }
            ctx.fill();
          }
        });

        animId = requestAnimationFrame(draw);
      };

      animId = requestAnimationFrame(draw);
      return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animId);
      };
    }, []);

    return (
      <div className={styles.container}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    );
  }
  ```

- [ ] **步骤 3：Commit**
  命令：
  ```bash
  git add components/BackgroundGraph.module.css components/BackgroundGraph.tsx
  git commit -m "feat: implement fullscreen BackgroundGraph canvas component"
  ```

---

### 任务 3：挂载背景组件到 `pages/_app.tsx`

**文件：**
* 修改：`pages/_app.tsx`

- [ ] **步骤 1：更新 `App` 页壳，挂载全屏背景组件**
  将 `pages/_app.tsx` 变更为：
  ```typescript
  import '../styles/globals.css';
  import type { AppProps } from 'next/app';
  import { Outfit, Playfair_Display } from 'next/font/google';
  import BackgroundGraph from '../components/BackgroundGraph';

  const outfit = Outfit({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600'],
    variable: '--font-outfit',
    display: 'swap',
  });

  const playfair = Playfair_Display({
    subsets: ['latin'],
    weight: ['400', '600'],
    style: ['normal', 'italic'],
    variable: '--font-playfair',
    display: 'swap',
  });

  export default function App({ Component, pageProps }: AppProps) {
    return (
      <div className={`${outfit.variable} ${playfair.variable}`}>
        <BackgroundGraph />
        <Component {...pageProps} />
      </div>
    );
  }
  ```

- [ ] **步骤 2：运行 TypeScript 检查和 Vitest，验证整体编译成功**
  运行：`npx tsc --noEmit && npx vitest run --fileParallelism=false`
  预期：TypeScript 零报错，全部 83 个测试通过（新增了任务 1 的 2 个 TDD 测试）。

- [ ] **步骤 3：Commit**
  命令：
  ```bash
  git add pages/_app.tsx
  git commit -m "feat: mount BackgroundGraph globally in _app.tsx"
  ```

---

### 任务 4：创建 HyperFrames MP4 视频导出静态源

**文件：**
* 创建：`public/hyperframes/background.html`

- [ ] **步骤 1：在 `public/` 下创建静态页作为 HyperFrames 的录制源**
  静态源需要将 `Canvas` 逻辑复制为独立运行的纯 HTML5 版本，以便 `npx hyperframes` headless 浏览器加载录制。
  在 `public/hyperframes/background.html` 写入：
  ```html
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Personal Graph Background Video Source</title>
    <style>
      body, html {
        margin: 0; padding: 0;
        width: 100vw; height: 100vh;
        overflow: hidden;
        background: radial-gradient(circle at 10% 10%, rgba(255, 100, 30, 0.012) 0%, transparent 45%),
                    radial-gradient(circle at 90% 90%, rgba(255, 100, 30, 0.008) 0%, transparent 45%),
                    linear-gradient(135deg, #fdfbf7 0%, #f5f0eb 100%);
      }
      canvas {
        display: block;
        width: 100%; height: 100%;
      }
    </style>
  </head>
  <body>
    <canvas id="graphCanvas"></canvas>
    <script>
      (function() {
        const canvas = document.getElementById('graphCanvas');
        const ctx = canvas.getContext('2d');
        let width = 0, height = 0;
        function resize() {
          width = window.innerWidth;
          height = window.innerHeight;
          canvas.width = width;
          canvas.height = height;
        }
        window.addEventListener('resize', resize);
        resize();

        let seed = 450;
        const random = () => {
          let x = Math.sin(seed++) * 10000;
          return x - Math.floor(x);
        };

        const nodeCount = 40;
        const nodes = [];
        const uniformRadius = 11.0;

        // Visible key nodes
        const positions = [
          { bx: 0.5, by: 0.25 },
          { bx: 0.76, by: 0.5 },
          { bx: 0.5, by: 0.75 },
          { bx: 0.24, by: 0.5 }
        ];
        for (let i = 0; i < 4; i++) {
          nodes.push({
            id: i, bx: positions[i].bx, by: positions[i].by,
            color: '#ff641e', radius: uniformRadius, selectionIndex: i
          });
        }
        // Others
        for (let i = 4; i < nodeCount; i++) {
          nodes.push({
            id: i,
            bx: -0.15 + random() * 1.30,
            by: -0.15 + random() * 1.30,
            color: random() > 0.55 ? '#ff641e' : '#7a756f',
            radius: uniformRadius, selectionIndex: -1
          });
        }

        nodes.forEach(node => {
          node.fx1 = (Math.floor(random() * 2) + 2) * 0.05;
          node.fx2 = (Math.floor(random() * 2) + 3) * 0.05;
          node.fy1 = (Math.floor(random() * 2) + 2) * 0.05;
          node.fy2 = (Math.floor(random() * 2) + 3) * 0.05;
          node.ax1 = random() * 8 + 7;
          node.ax2 = random() * 4 + 2;
          node.ay1 = random() * 8 + 7;
          node.ay2 = random() * 4 + 2;
          node.px1 = random() * Math.PI * 2;
          node.px2 = random() * Math.PI * 2;
          node.py1 = random() * Math.PI * 2;
          node.py2 = random() * Math.PI * 2;
        });

        // Connected tree links
        const links = [];
        for (let i = 1; i < nodeCount; i++) {
          links.push({
            source: i, target: Math.floor(random() * i),
            relationType: ['competitor', 'supplier', 'operation', 'mention'][Math.floor(random() * 4)]
          });
        }
        for (let k = 0; k < 30; k++) {
          const source = Math.floor(random() * nodeCount);
          let target = Math.floor(random() * nodeCount);
          while (source === target) target = Math.floor(random() * nodeCount);
          const exists = links.some(l => (l.source === source && l.target === target) || (l.source === target && l.target === source));
          if (!exists) {
            links.push({
              source, target,
              relationType: ['competitor', 'supplier', 'operation', 'mention'][Math.floor(random() * 4)]
            });
          }
        }

        function getSelectionFactor(selIndex, t) {
          if (selIndex < 0) return 0;
          const center = selIndex * 5 + 2.5;
          let diff = Math.abs(t - center);
          if (diff > 10) diff = 20 - diff;
          if (diff <= 2.0) return 1.0;
          if (diff >= 3.0) return 0.0;
          return 1.0 - (diff - 2.0);
        }

        function draw(timestamp) {
          const t = (timestamp % 20000) / 1000;
          ctx.clearRect(0, 0, width, height);

          const computed = nodes.map(node => {
            const dx = node.ax1 * Math.sin(2 * Math.PI * node.fx1 * t + node.px1) + 
                       node.ax2 * Math.sin(2 * Math.PI * node.fx2 * t + node.px2);
            const dy = node.ay1 * Math.cos(2 * Math.PI * node.fy1 * t + node.py1) + 
                       node.ay2 * Math.cos(2 * Math.PI * node.fy2 * t + node.py2);
            return {
              id: node.id, x: node.bx * width + dx, y: node.by * height + dy,
              radius: node.radius, color: node.color, selFactor: getSelectionFactor(node.selectionIndex, t)
            };
          });

          const nodeMap = {};
          computed.forEach(n => { nodeMap[n.id] = n; });

          links.forEach(link => {
            const n1 = nodeMap[link.source];
            const n2 = nodeMap[link.target];
            if (!n1 || !n2) return;

            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = Math.min(width, height) * 0.5;

            let opacity = 0.08 + Math.max(0, 1 - dist / maxDistance) * 0.20;
            opacity = Math.min(0.25, opacity);

            const maxSel = Math.max(n1.selFactor, n2.selFactor);
            if (maxSel > 0) opacity = Math.min(0.50, opacity + maxSel * 0.18);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);

            switch (link.relationType) {
              case 'competitor':
                ctx.strokeStyle = `rgba(211, 47, 47, ${opacity * 0.5})`;
                ctx.lineWidth = 1.8;
                break;
              case 'supplier':
                ctx.strokeStyle = `rgba(255, 100, 30, ${opacity * 0.7})`;
                ctx.lineWidth = 2.0;
                ctx.setLineDash([6, 6]);
                ctx.lineDashOffset = -t * 36;
                break;
              case 'operation':
                ctx.strokeStyle = `rgba(21, 101, 192, ${opacity * 0.5})`;
                ctx.lineWidth = 1.8;
                break;
              case 'mention':
              default:
                ctx.strokeStyle = `rgba(160, 155, 149, ${opacity * 0.4})`;
                ctx.lineWidth = 1.4;
                ctx.setLineDash([3, 4]);
                break;
            }
            ctx.stroke();
            ctx.restore();
          });

          computed.forEach(node => {
            const sel = node.selFactor;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            if (sel > 0) {
              ctx.save();
              ctx.shadowBlur = 6 * sel;
              ctx.shadowColor = 'rgba(255, 100, 30, 0.6)';
              ctx.fillStyle = `rgba(255, 100, 30, ${0.3 + 0.45 * sel})`;
              ctx.fill();
              ctx.restore();

              ctx.save();
              const pulse = 1 + Math.sin(t * Math.PI * 2 * 1.5) * 0.15;
              const boxSize = node.radius * 2.5 * pulse;
              ctx.strokeStyle = `rgba(255, 100, 30, ${sel * 0.65})`;
              ctx.lineWidth = 1.5;
              ctx.beginPath();

              const half = boxSize / 2;
              const len = boxSize / 4;

              ctx.moveTo(node.x - half, node.y - half + len);
              ctx.lineTo(node.x - half, node.y - half);
              ctx.lineTo(node.x - half + len, node.y - half);

              ctx.moveTo(node.x + half - len, node.y - half);
              ctx.lineTo(node.x + half, node.y - half);
              ctx.lineTo(node.x + half, node.y - half + len);

              ctx.moveTo(node.x - half, node.y + half - len);
              ctx.lineTo(node.x - half, node.y + half);
              ctx.lineTo(node.x - half + len, node.y + half);

              ctx.moveTo(node.x + half - len, node.y + half);
              ctx.lineTo(node.x + half, node.y + half);
              ctx.lineTo(node.x + half, node.y + half - len);

              ctx.stroke();
              ctx.restore();
            } else {
              ctx.fillStyle = node.color === '#ff641e' ? 'rgba(255, 100, 30, 0.22)' : 'rgba(122, 117, 111, 0.18)';
              ctx.fill();
            }
          });

          requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      })();
    </script>
  </body>
  </html>
  ```

- [ ] **步骤 2：Commit**
  命令：
  ```bash
  git add public/hyperframes/background.html
  git commit -m "feat: add static HTML page for HyperFrames video capture"
  ```
