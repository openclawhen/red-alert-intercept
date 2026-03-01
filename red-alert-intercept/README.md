# Red Alert Intercept (MVP)

MVP משחק ארקייד ניטרלי מבוסס web:
- ממתין להתראה
- מתחיל סיבוב בזמן התראה
- השחקן מיירט אייקוני 🚀 בלחיצה
- ניקוד + קומבו + סיכום סיבוב

> ללא תוכן אלים/גרפי. זו ויזואליזציה משחקית בלבד.

---

## Tech Stack
- Vite + React + TypeScript
- HTML5 Canvas
- Node/Express proxy קטן עבור LIVE alerts
- Vitest לבדיקות יחידה

---

## הרצה (פקודה אחת)
```bash
npm install
npm run dev
```

- Web: `http://localhost:5173`
- Alerts Proxy: `http://localhost:8787`

---

## מצבי עבודה (LIVE/MOCK)
אפשר לעבור ב-UI בין:
- `MOCK` – סימולציה מקומית עם כפתור **Simulate Alert**
- `LIVE` – Polling מ-`/api/alerts`

ברירת מחדל דרך env:
```bash
VITE_ALERTS_MODE=MOCK
```

---

## מבנה תיקיות
```text
src/
  alerts/
    AlertsProvider.ts
    LiveAlertsProvider.ts
    MockAlertsProvider.ts
    dedupe.ts
    dedupe.test.ts
  game/
    GameEngine.ts
    hit.ts
    hit.test.ts
    render.ts
  App.tsx
  App.css
  main.tsx
  types.ts
server/
  proxy.ts
```

---

## API Alerts (LIVE)
הפרוקסי מנסה למשוך התרעות ממקור ציבורי (`oref.org.il`) ומחזיר פורמט מאוחד:
```ts
{ active, id, timestamp, areas, level, raw }
```

### הערות
- ייתכנו שינויים/חסימות מהמקור הציבורי (CORS/headers/rate-limit).
- במקרה של תקלה ב-LIVE, האפליקציה נופלת חזרה ל-MOCK עם הודעה למשתמש.

---

## בדיקות
```bash
npm test
```

בדיקות קיימות:
1. `AlertDeduper` – מניעת כפילויות לפי `id+timestamp`
2. `isPointInsideRadius` – hit detection בסיסי

---

## לוגיקת מצב משחק (State Machine)
- `IDLE` → `READY` → `ACTIVE` → `SUMMARY` → `READY`

ב-`ACTIVE`:
- Spawn טילים כל 500–900ms
- טיל נע ממזרח (ימין המסך) לכיוון מרכז המפה
- פגיעה בלחיצה: `+10` עם multiplier לפי combo (עד x3)
- פספוס: combo יורד
- סוף סיבוב: אחרי 60 שניות או Clear מה-provider
