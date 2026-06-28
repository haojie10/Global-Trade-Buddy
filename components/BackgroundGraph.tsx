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

    // Predefined 4 visible selection nodes (Top, Right, Bottom, Left)
    const positions = [
      { bx: 0.5, by: 0.25 }, // Top
      { bx: 0.76, by: 0.5 }, // Right
      { bx: 0.5, by: 0.75 }, // Bottom
      { bx: 0.24, by: 0.5 }  // Left
    ];
    
    for (let i = 0; i < 4; i++) {
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

    // Other 36 nodes distributed inside infinite canvas bounds [-0.15, 1.15]
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

    // Assign drift parameters (Synchronized speeds increased by 50%)
    nodes.forEach(node => {
      // Speed up by 50% using frequency multiples starting at 2 instead of 1
      node.fx1 = (Math.floor(random() * 2) + 2) * 0.05; // 0.10 or 0.15 Hz
      node.fx2 = (Math.floor(random() * 2) + 3) * 0.05; // 0.15 or 0.20 Hz
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
        
        // Cyclic local drift calculation
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

        // Subtle background line opacity between 0.08 and 0.28
        let opacity = 0.08 + Math.max(0, 1 - dist / maxDistance) * 0.20;
        opacity = Math.min(0.25, opacity);

        const maxSel = Math.max(n1.selFactor, n2.selFactor);
        if (maxSel > 0) {
          // Highlight connection lines slightly when nodes are selected
          opacity = Math.min(0.50, opacity + maxSel * 0.18);
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);

        switch (link.relationType) {
          case 'competitor': // #d32f2f Solid Red
            ctx.strokeStyle = `rgba(211, 47, 47, ${opacity * 0.5})`;
            ctx.lineWidth = 1.8;
            break;
          case 'supplier': // #ff641e Flowing Orange Dash
            ctx.strokeStyle = `rgba(255, 100, 30, ${opacity * 0.7})`;
            ctx.lineWidth = 2.0;
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -t * 36; // 50% faster flow
            break;
          case 'operation': // #1565c0 Solid Blue
            ctx.strokeStyle = `rgba(21, 101, 192, ${opacity * 0.5})`;
            ctx.lineWidth = 1.8;
            break;
          case 'mention': // #a09b95 Static Gray Dotted
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
          // Core glow effect
          ctx.save();
          ctx.shadowBlur = 6 * sel;
          ctx.shadowColor = 'rgba(255, 100, 30, 0.6)';
          ctx.fillStyle = `rgba(255, 100, 30, ${0.3 + 0.45 * sel})`;
          ctx.fill();
          ctx.restore();

          // L-shaped four-corner breathing box
          ctx.save();
          const pulse = 1 + Math.sin(t * Math.PI * 2 * 1.5) * 0.15; // 1.5 Hz breathing rate
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
          // Faint background node opacities
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
