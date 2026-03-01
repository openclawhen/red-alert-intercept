import type { Explosion, Missile } from '../types';

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  missiles: Missile[],
  explosions: Explosion[],
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, width, height);

  // Simple neutral schematic map silhouette (center-left).
  ctx.fillStyle = '#14324c';
  ctx.beginPath();
  ctx.moveTo(width * 0.48, height * 0.18);
  ctx.lineTo(width * 0.43, height * 0.30);
  ctx.lineTo(width * 0.46, height * 0.45);
  ctx.lineTo(width * 0.44, height * 0.62);
  ctx.lineTo(width * 0.49, height * 0.82);
  ctx.lineTo(width * 0.57, height * 0.70);
  ctx.lineTo(width * 0.54, height * 0.52);
  ctx.lineTo(width * 0.58, height * 0.37);
  ctx.lineTo(width * 0.53, height * 0.18);
  ctx.closePath();
  ctx.fill();

  missiles.forEach((m) => {
    ctx.strokeStyle = '#f9a82588';
    ctx.beginPath();
    ctx.moveTo(m.x + 10, m.y - 8);
    ctx.lineTo(m.x + 28, m.y - 16);
    ctx.stroke();

    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', m.x, m.y);
  });

  explosions.forEach((e) => {
    ctx.strokeStyle = '#5cf2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6 + ((Date.now() - e.createdAt) / 250) * 20, 0, Math.PI * 2);
    ctx.stroke();
  });
}
