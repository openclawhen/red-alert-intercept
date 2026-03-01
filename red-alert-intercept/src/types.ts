export type AlertEvent = {
  id: string;
  timestamp: number;
  areas: string[];
  level: 'red' | 'warning' | 'info';
  raw: unknown;
};

export type GameState = 'IDLE' | 'READY' | 'ACTIVE' | 'SUMMARY';

export type Missile = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  createdAt: number;
  health: 1;
};

export type Explosion = {
  id: string;
  x: number;
  y: number;
  createdAt: number;
};

export type GameStats = {
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  startedAt: number;
  endsAt: number;
};
