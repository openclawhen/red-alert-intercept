import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

let lastEventId = '';
let lastActiveAt = 0;

const OREF_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';

app.get('/api/alerts', async (_req, res) => {
  try {
    const r = await fetch(OREF_URL, {
      headers: {
        Referer: 'https://www.oref.org.il/',
        'User-Agent': 'Mozilla/5.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const text = await r.text();
    const parsed = safeParseJson(text);

    if (parsed && Array.isArray((parsed as any).data) && (parsed as any).data.length > 0) {
      const areas = (parsed as any).data as string[];
      const ts = Date.now();
      const id = `oref-${areas.join('|')}-${Math.floor(ts / 3000)}`;
      if (id !== lastEventId) {
        lastEventId = id;
        lastActiveAt = ts;
      }

      return res.json({
        active: true,
        id,
        timestamp: ts,
        areas,
        level: 'red',
        raw: parsed,
      });
    }

    // Clear after quiet period.
    if (Date.now() - lastActiveAt > 5000) {
      return res.json({ active: false, timestamp: Date.now() });
    }

    return res.json({ active: true, id: lastEventId, timestamp: lastActiveAt, areas: [], level: 'red' });
  } catch (error) {
    return res.status(200).json({ active: false, error: String(error), timestamp: Date.now() });
  }
});

const port = Number(process.env.ALERTS_PROXY_PORT || 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`alerts proxy listening on :${port}`);
});

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
