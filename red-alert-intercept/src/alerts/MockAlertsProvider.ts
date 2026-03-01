import type { AlertsProvider, AlertCallback, ClearCallback, Unsubscribe } from './AlertsProvider';
import type { AlertEvent } from '../types';

export class MockAlertsProvider implements AlertsProvider {
  private alertListeners = new Set<AlertCallback>();
  private clearListeners = new Set<ClearCallback>();

  start(): void {
    // noop
  }

  stop(): void {
    // noop
  }

  onAlert(callback: AlertCallback): Unsubscribe {
    this.alertListeners.add(callback);
    return () => this.alertListeners.delete(callback);
  }

  onClear(callback: ClearCallback): Unsubscribe {
    this.clearListeners.add(callback);
    return () => this.clearListeners.delete(callback);
  }

  simulateAlert(durationMs = 60_000): void {
    const event: AlertEvent = {
      id: `mock-${Date.now()}`,
      timestamp: Date.now(),
      areas: ['מרכז'],
      level: 'red',
      raw: { source: 'mock' },
    };
    this.alertListeners.forEach((cb) => cb(event));
    window.setTimeout(() => this.clearListeners.forEach((cb) => cb()), durationMs);
  }

  clearNow(): void {
    this.clearListeners.forEach((cb) => cb());
  }
}
