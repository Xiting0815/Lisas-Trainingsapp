// Celebration: a short, soft confetti burst in rosé tones (after a finished training).
// No-op under prefers-reduced-motion and outside the browser.

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

const COLORS = ['#F4B6C8', '#E9779F', '#A61E4D', '#F7D6A8', '#D9467A', '#FBE3EA'];

/**
 * Lightweight canvas confetti burst (~1.6 s).
 * @param {{particles?: number, duration?: number, origin?: {x: number, y: number}, colors?: string[]}} [opts]
 *   origin in viewport fractions (default {x: 0.5, y: 0.35}).
 * @returns {Promise<void>}
 */
export function confetti(opts = {}) {
  if (reducedMotion() || typeof document === 'undefined') return Promise.resolve();
  const n = opts.particles ?? 110;
  const duration = opts.duration ?? 1600;
  const colors = opts.colors ?? COLORS;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return Promise.resolve(); }
  ctx.scale(dpr, dpr);
  const ox = (opts.origin?.x ?? 0.5) * W, oy = (opts.origin?.y ?? 0.35) * H;
  const parts = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 8;
    return {
      x: ox, y: oy,
      vx: Math.cos(a) * v * 0.9, vy: Math.sin(a) * v - 5,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI, vt: 0.08 + Math.random() * 0.12,
      color: colors[(Math.random() * colors.length) | 0],
      heart: Math.random() < 0.25,
    };
  });
  const heart = (r) => {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.6, -r * 0.1, -r * 0.7, -r * 1.3, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.7, -r * 1.3, r * 1.6, -r * 0.1, 0, r * 0.9);
    ctx.fill();
  };
  return new Promise((resolve) => {
    const t0 = performance.now();
    const frame = (t) => {
      const el = t - t0;
      const fade = Math.max(0, Math.min(1, (duration - el) / 400));
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tilt += p.vt;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * 0.4);
        ctx.fillStyle = p.color;
        if (p.heart) heart(p.h + 3);
        else { ctx.scale(1, Math.cos(p.tilt)); ctx.rotate(p.rot); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      }
      if (el < duration) requestAnimationFrame(frame);
      else { canvas.remove(); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}
