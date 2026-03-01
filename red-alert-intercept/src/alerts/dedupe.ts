import type { AlertEvent } from '../types';

export class AlertDeduper {
  private readonly seen = new Set<string>();

  shouldEmit(event: AlertEvent): boolean {
    const key = `${event.id}:${event.timestamp}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 5000) {
      const first = this.seen.values().next().value;
      if (first) this.seen.delete(first);
    }
    return true;
  }

  reset(): void {
    this.seen.clear();
  }
}
