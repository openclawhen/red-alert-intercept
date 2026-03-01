import type { AlertEvent } from '../types';

export type Unsubscribe = () => void;
export type AlertCallback = (event: AlertEvent) => void;
export type ClearCallback = () => void;

export interface AlertsProvider {
  start(): void;
  stop(): void;
  onAlert(callback: AlertCallback): Unsubscribe;
  onClear(callback: ClearCallback): Unsubscribe;
}
