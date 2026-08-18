/**
 * Lightweight interactive line field for the CMS workspace.
 * It adds depth without competing with content or creating decorative blobs.
 */

import { useEffect, useRef } from 'react';

export function AmbientCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const pointer = { x: 0.72, y: 0.18, tx: 0.72, ty: 0.18 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (event: PointerEvent) => {
      pointer.tx = event.clientX / Math.max(width, 1);
      pointer.ty = event.clientY / Math.max(height, 1);
    };

    const draw = () => {
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      ctx.clearRect(0, 0, width, height);

      // A quiet drafting grid keeps the canvas alive while leaving the UI readable.
      ctx.save();
      ctx.strokeStyle = 'rgba(46, 58, 51, 0.075)';
      ctx.lineWidth = 1;
      const grid = 56;
      for (let x = 0; x <= width; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      // The pointer leaves a restrained tracking crosshair, not a decorative glow.
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#d95543';
      ctx.setLineDash([3, 8]);
      ctx.beginPath();
      ctx.moveTo(pointer.x * width, 0);
      ctx.lineTo(pointer.x * width, height);
      ctx.moveTo(0, pointer.y * height);
      ctx.lineTo(width, pointer.y * height);
      ctx.stroke();
      ctx.restore();

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    if (reduce) {
      draw();
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="cms-ambient-canvas" aria-hidden="true" />;
}
