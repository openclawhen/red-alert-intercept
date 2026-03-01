import type { Explosion, GameStats, Missile } from '../types';
import { isPointInsideRadius } from './hit';

type EngineOptions = {
  width: number;
  height: number;
  roundDurationMs: number;
};

export class GameEngine {
  missiles: Missile[] = [];
  explosions: Explosion[] = [];
  stats: GameStats | null = null;

  private lastSpawnAt = 0;
  private nextSpawnDelay = 650;
  private running = false;

  private options: EngineOptions;

  constructor(options: EngineOptions) {
    this.options = options;
  }

  start(now = performance.now()): void {
    this.missiles = [];
    this.explosions = [];
    this.running = true;
    this.lastSpawnAt = now;
    this.nextSpawnDelay = this.randomSpawnDelay();
    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      startedAt: now,
      endsAt: now + this.options.roundDurationMs,
    };
  }

  stop(): void {
    this.running = false;
  }

  update(now: number, dtMs: number): void {
    if (!this.running || !this.stats) return;

    if (now - this.lastSpawnAt >= this.nextSpawnDelay) {
      this.spawnMissile(now);
      this.lastSpawnAt = now;
      this.nextSpawnDelay = this.randomSpawnDelay();
    }

    const dt = dtMs / 1000;
    for (const m of this.missiles) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }

    const targetX = this.options.width * 0.5;
    const targetY = this.options.height * 0.52;

    this.missiles = this.missiles.filter((m) => {
      const arrived = Math.hypot(m.x - targetX, m.y - targetY) < 16 || m.x < targetX - 20;
      if (arrived && this.stats) {
        this.stats.combo = 0;
        this.stats.misses += 1;
      }
      return !arrived;
    });

    this.explosions = this.explosions.filter((e) => now - e.createdAt < 250);

    if (now >= this.stats.endsAt) {
      this.running = false;
    }
  }

  tryHit(x: number, y: number, now: number): boolean {
    if (!this.running || !this.stats) return false;
    const index = this.missiles.findIndex((m) => isPointInsideRadius(x, y, m.x, m.y, m.radius + 6));
    if (index === -1) {
      this.stats.combo = 0;
      return false;
    }

    const [hit] = this.missiles.splice(index, 1);
    this.explosions.push({ id: `ex-${now}-${Math.random()}`, x: hit.x, y: hit.y, createdAt: now });

    this.stats.hits += 1;
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

    const multiplier = Math.min(3, 1 + Math.floor(this.stats.combo / 3));
    this.stats.score += 10 * multiplier;

    return true;
  }

  isRunning(): boolean {
    return this.running;
  }

  private spawnMissile(now: number): void {
    const startX = this.options.width + 14;
    const startY = this.options.height * (0.22 + Math.random() * 0.48);
    const targetX = this.options.width * 0.5;
    const targetY = this.options.height * 0.52;
    const speed = 85 + Math.random() * 35;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const len = Math.hypot(dx, dy) || 1;

    this.missiles.push({
      id: `m-${now}-${Math.random()}`,
      x: startX,
      y: startY,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      radius: 11,
      createdAt: now,
      health: 1,
    });
  }

  private randomSpawnDelay(): number {
    return 500 + Math.random() * 400;
  }
}
