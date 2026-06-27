# GridCalc — Grid Trading Calculator

Free crypto grid trading calculator for Binance Futures traders.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Arithmetic & Geometric Grid
- Spot & Futures
- Long, Short, Neutral
- Grid table with Buy/Sell, Qty, Profit, ROI, Fee
- Break Even, Total Position, Margin Used

## Project Structure

```
src/
├── app/                    # Home page (Grid Calculator)
├── components/             # Shared UI & layout
├── features/grid-calculator/
├── lib/calculators/grid.ts
└── types/
```
