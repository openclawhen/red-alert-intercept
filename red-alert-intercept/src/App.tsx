import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import type { AlertsProvider } from './alerts/AlertsProvider';
import { LiveAlertsProvider } from './alerts/LiveAlertsProvider';
import { MockAlertsProvider } from './alerts/MockAlertsProvider';
import { GameEngine } from './game/GameEngine';
import { drawScene } from './game/render';
import type { GameState } from './types';

const ROUND_MS = 60_000;

type Mode = 'LIVE' | 'MOCK';

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>((import.meta.env.VITE_ALERTS_MODE as Mode) || 'MOCK');
  const [gameState, setGameState] = useState<GameState>('READY');
  const [lastError, setLastError] = useState<string>('');
  const [tick, setTick] = useState(0);
  const [summary, setSummary] = useState<{ score: number; hits: number; misses: number; maxCombo: number } | null>(null);

  const mockProvider = useMemo(() => new MockAlertsProvider(), []);
  const providerRef = useRef<AlertsProvider>(mode === 'LIVE' ? new LiveAlertsProvider(3000) : mockProvider);
  const engineRef = useRef(new GameEngine({ width: 960, height: 540, roundDurationMs: ROUND_MS }));

  useEffect(() => {
    providerRef.current.stop();
    providerRef.current = mode === 'LIVE' ? new LiveAlertsProvider(3000) : mockProvider;

    const provider = providerRef.current;
    const unsubAlert = provider.onAlert(() => {
      engineRef.current.start(performance.now());
      setGameState('ACTIVE');
    });

    const unsubClear = provider.onClear(() => {
      finishRound();
    });

    provider.start();

    if (mode === 'LIVE') {
      const healthTimer = window.setTimeout(async () => {
        try {
          const r = await fetch('/api/alerts', { cache: 'no-store' });
          if (!r.ok) throw new Error('live endpoint failed');
        } catch {
          setLastError('LIVE נכשל, עוברים ל-MOCK');
          setMode('MOCK');
        }
      }, 3500);
      return () => {
        window.clearTimeout(healthTimer);
        unsubAlert();
        unsubClear();
        provider.stop();
      };
    }

    return () => {
      unsubAlert();
      unsubClear();
      provider.stop();
    };
  }, [mode, mockProvider]);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();

    const loop = (now: number) => {
      const dt = now - prev;
      prev = now;

      if (gameState === 'ACTIVE') {
        engineRef.current.update(now, dt);
        if (!engineRef.current.isRunning()) {
          finishRound();
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawScene(ctx, canvas.width, canvas.height, engineRef.current.missiles, engineRef.current.explosions);
        }
      }

      setTick((v) => (v + 1) % 100000);
      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [gameState]);

  const stats = engineRef.current.stats;
  const secondsLeft = stats ? Math.max(0, Math.ceil((stats.endsAt - performance.now()) / 1000)) : 0;

  const onCanvasClick: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (gameState !== 'ACTIVE') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * e.currentTarget.width;
    const y = ((e.clientY - rect.top) / rect.height) * e.currentTarget.height;
    engineRef.current.tryHit(x, y, performance.now());
  };

  const finishRound = () => {
    engineRef.current.stop();
    const s = engineRef.current.stats;
    if (s) {
      setSummary({ score: s.score, hits: s.hits, misses: s.misses, maxCombo: s.maxCombo });
    }
    setGameState('SUMMARY');
  };

  const simulateAlert = () => {
    mockProvider.simulateAlert(ROUND_MS);
    setGameState('ACTIVE');
  };

  const backToWaiting = () => {
    engineRef.current.stop();
    setSummary(null);
    setGameState('READY');
  };

  return (
    <main className="app">
      <header className="topbar">
        <h1>Red Alert Intercept</h1>
        <div className="mode-row">
          <label>מצב:</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="MOCK">MOCK</option>
            <option value="LIVE">LIVE</option>
          </select>
        </div>
      </header>

      {lastError && <div className="error">{lastError}</div>}

      <section className="hud">
        <div>מצב: {gameState === 'READY' ? 'ממתין' : gameState === 'ACTIVE' ? 'פעיל' : gameState === 'SUMMARY' ? 'סיכום' : 'IDLE'}</div>
        <div>ניקוד: {stats?.score ?? summary?.score ?? 0}</div>
        <div>קומבו: {stats?.combo ?? 0}</div>
        <div>טיימר: {secondsLeft}</div>
      </section>

      <canvas ref={canvasRef} width={960} height={540} onClick={onCanvasClick} className="game-canvas" />

      <section className="controls">
        {gameState === 'READY' && (
          <>
            <p>ממתין להתראה…</p>
            <button onClick={simulateAlert}>Simulate Alert</button>
          </>
        )}

        {gameState === 'SUMMARY' && summary && (
          <div className="summary">
            <h2>סיכום סיבוב</h2>
            <p>ניקוד: {summary.score}</p>
            <p>יירוטים: {summary.hits}</p>
            <p>פספוסים: {summary.misses}</p>
            <p>קומבו מקסימלי: {summary.maxCombo}</p>
            <button onClick={backToWaiting}>Back to waiting</button>
          </div>
        )}
      </section>

      <small style={{ opacity: 0.6 }}>tick:{tick}</small>
    </main>
  );
}

export default App;
