import React, { useEffect, useRef, useState } from 'react';
import styles from './BackgroundGraph.module.css';

interface FloatingBall {
  xIndex: number; // X grid line index (X coordinate = xIndex * 100)
  y: number;      // Current Y position
  speed: number;  // Directional vertical speed
  radius: number; // Sphere radius
  color: string;  // Particle fill color
}

export default function BackgroundGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0, height = 0;
    let staticCanvas: HTMLCanvasElement | null = null;

    const lineSpacing = 100;
    const yDotSpacing = 80;

    const renderStaticGrid = (w: number, h: number, dpr: number) => {
      staticCanvas = document.createElement('canvas');
      staticCanvas.width = w * dpr;
      staticCanvas.height = h * dpr;
      const sCtx = staticCanvas.getContext('2d');
      if (!sCtx) return;
      sCtx.scale(dpr, dpr);

      // 1. 预绘制垂直轨道线
      sCtx.save();
      sCtx.strokeStyle = 'rgba(18, 18, 18, 0.02)';
      sCtx.lineWidth = 1.0;
      for (let x = 0; x < w + lineSpacing; x += lineSpacing) {
        sCtx.beginPath();
        sCtx.moveTo(x, 0);
        sCtx.lineTo(x, h);
        sCtx.stroke();
      }
      sCtx.restore();

      // 2. 预绘制网格点阵
      sCtx.save();
      sCtx.fillStyle = 'rgba(18, 18, 18, 0.06)';
      for (let x = 0; x < w + lineSpacing; x += lineSpacing) {
        for (let y = 0; y < h + yDotSpacing; y += yDotSpacing) {
          sCtx.beginPath();
          sCtx.arc(x, y, 1.5, 0, Math.PI * 2);
          sCtx.fill();
        }
      }
      sCtx.restore();
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      renderStaticGrid(width, height, dpr);
    };
    window.addEventListener('resize', resize);
    resize();

    // Custom deterministic pseudorandom number generator
    let seed = 88;
    const random = () => {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const ballCount = 15;
    const balls: FloatingBall[] = [];
    const maxTrackCount = Math.ceil(3000 / lineSpacing);

    for (let i = 0; i < ballCount; i++) {
      const xIndex = Math.floor(random() * maxTrackCount);
      const initialY = random() * (height > 0 ? height : 800);
      let speed = -1.0 + random() * 2.0;
      if (Math.abs(speed) < 0.2) {
        speed = speed > 0 ? 0.3 : -0.3;
      }
      speed *= 0.8;
      const radius = 3.0 + random() * 2.5;
      const isOrange = random() < 0.2;
      const color = isOrange ? 'rgba(255, 100, 30, 0.3)' : 'rgba(122, 117, 111, 0.18)';

      balls.push({
        xIndex,
        y: initialY,
        speed,
        radius,
        color
      });
    }

    const numTracks = Math.floor(width / lineSpacing) || 14;
    const addCustomBall = (xIndex: number, isOrange: boolean) => {
      const radius = 3.0 + random() * 2.5;
      const color = isOrange ? 'rgba(255, 100, 30, 0.3)' : 'rgba(122, 117, 111, 0.18)';
      let speed = -1.0 + random() * 2.0;
      if (Math.abs(speed) < 0.2) speed = speed > 0 ? 0.3 : -0.3;
      speed *= 0.8;
      balls.push({
        xIndex,
        y: random() * (height > 0 ? height : 800),
        speed,
        radius,
        color
      });
    };

    addCustomBall(1, true);
    addCustomBall(1, false);
    addCustomBall(3, false);
    const penIndex = Math.max(2, numTracks - 2);
    addCustomBall(penIndex, true);
    addCustomBall(penIndex, false);

    let animId = 0;
    let isVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && !animId) {
        animId = requestAnimationFrame(draw);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    const draw = () => {
      if (!isVisible) {
        animId = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. 高性能单次贴图预渲染的静态背景网格
      if (staticCanvas) {
        ctx.drawImage(staticCanvas, 0, 0, width, height);
      }

      // 2. 更新并绘制动态小球粒子
      balls.forEach(ball => {
        ball.y += ball.speed;

        if (ball.speed > 0 && ball.y > height + 20) {
          ball.y = -20;
        } else if (ball.speed < 0 && ball.y < -20) {
          ball.y = height + 20;
        }

        const realX = ball.xIndex * lineSpacing;

        ctx.save();
        ctx.beginPath();
        ctx.arc(realX, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        
        if (ball.color.includes('255, 100, 30')) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(255, 100, 30, 0.6)';
        }
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(draw);
    };

    if (isVisible) {
      animId = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animId);
    };
  }, [reduceMotion]);


  if (reduceMotion) {
    return <div className={styles.container} style={{ background: '#f5f5f7' }}></div>;
  }

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
