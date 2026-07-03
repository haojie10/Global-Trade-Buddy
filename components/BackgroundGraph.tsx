import React, { useEffect, useRef } from 'react';
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

    // Custom deterministic pseudorandom number generator
    let seed = 88;
    const random = () => {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Instantiate 14 regular vertical tracks and distribute 15 scrolling spheres
    const lineSpacing = 100;
    const yDotSpacing = 80;
    const ballCount = 15;
    const balls: FloatingBall[] = [];

    // Calculate maximum grid track count based on typical wide display sizes
    const maxTrackCount = Math.ceil(3000 / lineSpacing);

    for (let i = 0; i < ballCount; i++) {
      // Pick a random grid vertical line index
      const xIndex = Math.floor(random() * maxTrackCount);
      // Random initial Y position with safety margins
      const initialY = random() * (height > 0 ? height : 800);
      // Random vertical speed between [-1.0, 1.0] excluding stationary speeds [-0.2, 0.2]
      let speed = -1.0 + random() * 2.0;
      if (Math.abs(speed) < 0.2) {
        speed = speed > 0 ? 0.3 : -0.3;
      }
      // Speed multiplier for subtle scrolling dynamics
      speed *= 0.8;

      // Ball radius between 3px and 5.5px
      const radius = 3.0 + random() * 2.5;

      // Color scheme: 20% Accent Orange, 80% Soft Slate Grey
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

    // 手动在特定垂直轨道上追加小球（分别在第二条、第四条、倒数第二条竖线上）
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

    // 1. 第二条竖线 (索引 1) 增加各一个 (一个橘色，一个灰色)
    addCustomBall(1, true);
    addCustomBall(1, false);

    // 2. 第四条竖线 (索引 3) 增加一个灰色
    addCustomBall(3, false);

    // 3. 倒数第二条竖线 (索引 numTracks - 2) 增加各一个 (一个橘色，一个灰色)
    const penIndex = Math.max(2, numTracks - 2);
    addCustomBall(penIndex, true);
    addCustomBall(penIndex, false);

    let animId = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Regular Vertical Track Lines (100px intervals)
      ctx.save();
      ctx.strokeStyle = 'rgba(18, 18, 18, 0.02)';
      ctx.lineWidth = 1.0;
      for (let x = 0; x < width + lineSpacing; x += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Draw Regular Intersection Grid Dots (100px X, 80px Y)
      ctx.save();
      ctx.fillStyle = 'rgba(18, 18, 18, 0.06)';
      for (let x = 0; x < width + lineSpacing; x += lineSpacing) {
        for (let y = 0; y < height + yDotSpacing; y += yDotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 3. Update & Draw Floating Sphere Particles
      balls.forEach(ball => {
        ball.y += ball.speed;

        // Loop recycle logic
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
        
        // Add delicate glowing effect to accent orange spheres
        if (ball.color.includes('255, 100, 30')) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(255, 100, 30, 0.6)';
        }
        ctx.fill();
        ctx.restore();
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
