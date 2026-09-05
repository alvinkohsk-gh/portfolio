# Portfolio Tracker

A personal stock portfolio tracker, inspired by [stocks.cafe](https://stocks.cafe/portfolio):
holdings with unrealized gain/loss, an allocation chart, an invested-vs-value chart,
transaction history, dividend tracking, and a watchlist.

Everything is stored locally in your browser (`localStorage`) — there's no account,
login, or backend database. Export/import JSON from Settings to back up or move
your data.

## Features

- **Dashboard** — total value, gain/loss, today's change, dividends received,
  allocation donut chart, invested-vs-current-value chart, sortable holdings table.
- **Transactions** — log buys, sells, and dividends; holdings and cost basis
  (average cost method) are computed from the full history.
- **Watchlist** — track symbols you don't yet own.
- **Live prices** — "Refresh prices" calls a server route (`/api/quote`) that
  proxies Yahoo Finance's public quote endpoint. If that's unreachable (e.g. a
  sandboxed/offline environment), prices simply stay at their last known value —
  set them manually from Settings instead.
- **Settings** — display currency label, manual price overrides, JSON
  export/import, reset to sample data, clear all data.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app ships with sample
holdings so the dashboard isn't empty on first load — replace them by adding
your own transactions, or clear everything from Settings.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS + Recharts. No database, no
auth — a single Next.js API route proxies live quotes; all portfolio data lives
in the browser.

## Deploying

Works out of the box on [Vercel](https://vercel.com/new) or any Next.js host.
No environment variables are required.
