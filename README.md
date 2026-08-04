# FIRE Calculator

A small, all-client-side web app to estimate **when you can retire early**
(FIRE = Financial Independence, Retire Early). You enter your current savings,
expected investment return, and a target amount, plus a timeline of monthly
income/expense "blocks" and an optional rental property. The app compounds your
money year by year and shows the age at which you hit your goal, with live
sliders and two charts.

**Live at [fire.maple-it.be](https://fire.maple-it.be).**

> Everything is an input, nothing is hardcoded server-side. The committed
> defaults are generic placeholders — enter your own numbers and save them as a
> scenario (stored only in your browser).

## What it does

- **Income/expense blocks** — a timeline of periods, each with its own duration
  and monthly income & expenses (e.g. full-time now, part-time later). The last
  block runs on until the goal is reached.
- **Compounding** — savings grow at your expected annual return; the classic
  FIRE curve rather than a straight line.
- **Rental property** (optional, toggleable) — a property that appreciates,
  earns net rent (indexed 2%/yr), carries a loan, and is **sold after N years** —
  at which point the equity (value − loan) becomes a cash lump sum in your
  invested pot. Counted at equity throughout, so net worth doesn't jump.
- **Two charts** — a line chart of invested balance vs. total net worth
  (incl. property) against the goal, and a stacked bar chart decomposing each
  year into saved capital, property-sale proceeds, and investment growth.
- **4% rule readout** — annual + monthly safe withdrawal for the goal amount,
  flagged against your final expenses.
- **Scenarios** — save the current inputs to the browser (localStorage) under a
  name, reload/delete them, and auto-restore the most recent on open.

## The model

The whole engine is one loop (`src/fire.js`), all nominal euros, no inflation:

```
balance = startingSavings
each year:
    income, expenses = whichever block covers this year (monthly × 12)
    balance = balance * (1 + returnRate) + (income − expenses + rent)
    property appreciates; at the sale year its equity is added to balance
stop when balance ≥ goal   → that's your FIRE year
```

## Tech

**React + Vite** single-page app, no backend. Charts via **Recharts**.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
```

## Build

```bash
npm run build        # static site in dist/
npm run preview      # preview the production build locally
```

The `dist/` output is plain static files — host it on any static file server.

## Files

| File | Purpose |
|---|---|
| `src/fire.js` | Projection engine (the year-by-year loop) |
| `src/App.jsx` | UI: inputs, blocks, property, charts, scenarios |
| `src/storage.js` | Save/load scenarios in localStorage |
