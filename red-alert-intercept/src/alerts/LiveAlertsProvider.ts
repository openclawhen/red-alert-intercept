import type { AlertsProvider, AlertCallback, ClearCallback, Unsubscribe } from './AlertsProvider';
import type { AlertEvent } from '../types';
import { AlertDeduper } from './dedupe';

type LivePayload = {
  id?: string;
  timestamp?: number;
  active?: boolean;
  areas?: string[];
  level?: 'red' | 'warning' | 'info';
  sourceTimestamp?: string;
  [k: string]: unknown;
};

export class LiveAlertsProvider implements AlertsProvider {
  private timer: number | null = null;
  private alertListeners = new Set<AlertCallback>();
  private clearListeners = new Set<ClearCallback>();
  private deduper = new AlertDeduper();
  private active = false;

  private pollMs: number;
  private endpoint: string;

  constructor(pollMs = 3000, endpoint = '/api/alerts') {
    this.pollMs = pollMs;
    this.endpoint = endpoint;
  }

  start(): void {
    if (this.timer !== null) return;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), this.pollMs);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  onAlert(callback: AlertCallback): Unsubscribe {
    this.alertListeners.add(callback);
    return () => this.alertListeners.delete(callback);
  }

  onClear(callback: ClearCallback): Unsubscribe {
    this.clearListeners.add(callback);
    return () => this.clearListeners.delete(callback);
  }

  private async tick(): Promise<void> {
    try {
      const response = await fetch(this.endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Live alerts HTTP ${response.status}`);
      const payload = (await response.json()) as LivePayload;

      if (!payload.active) {
        if (this.active) {
          this.active = false;
          this.deduper.reset();
          this.clearListeners.forEach((cb) => cb());
        }
        return;
      }

      const event: AlertEvent = {
        id: payload.id ?? `live-${Date.now()}`,
        timestamp: payload.timestamp ?? Date.now(),
        areas: payload.areas ?? [],
        level: payload.level ?? 'red',
        raw: payload,
      };

      if (this.deduper.shouldEmit(event)) {
        this.active = true;
        this.alertListeners.forEach((cb) => cb(event));
      }
    } catch {
      // Silent here; fallback is managed by app-level health timeout.
    }
  }
}
