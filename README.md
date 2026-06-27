# GridCalc — Grid Trading Calculator

Free crypto grid trading calculator for Binance Futures traders.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS 4
- Vercel Analytics

## Getting Started

```bash
npm install
cp .env.example .env.local   # optional — for SEO locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Arithmetic & Geometric Grid
- Long, Short, Neutral strategies
- Profit per grid, margin, liquidation simulation
- Coin holdings simulation at Start / Upper / Lower / Current
- Visitor analytics via Vercel Analytics dashboard

## Environment Variables

Copy [`.env.example`](.env.example) to `.env.local` for local dev.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Optional | Fallback for local builds only — production SEO uses the live request domain |

The calculator works without env vars. On Vercel, SEO metadata, `sitemap.xml`, and `robots.txt` automatically use whichever domain the visitor requests (including custom domains after you add them).

## Deploy (Vercel)

Repo: [github.com/borbaibank/Gridcalculator](https://github.com/borbaibank/Gridcalculator)

### One-time setup

1. Go to [vercel.com](https://vercel.com) and sign in with **GitHub**
2. Click **Add New… → Project**
3. Import **borbaibank/Gridcalculator**
4. Keep default settings:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** (auto)
   - **Install Command:** `npm install`
5. Click **Deploy**
6. Wait ~2 minutes — you get a URL like `https://gridcalculator.vercel.app`

### Auto-deploy on push

Once the repo is linked and **Production Branch = `main`**, every push to `main` deploys automatically:

```bash
git add .
git commit -m "Your message"
git push origin main
```

Check progress at **Vercel Dashboard → Deployments**.

### Vercel environment variables

In **Project → Settings → Environment Variables**, add:

| Name | Example | Environments |
|------|---------|--------------|
| `NEXT_PUBLIC_SITE_URL` | `https://gridcalculator.vercel.app` | Production |

### Vercel Analytics (page views)

1. Vercel → your project → **Analytics** tab
2. Click **Enable** (free Hobby plan)
3. After deploy, open **Analytics** to see visitors, page views, countries, and devices
4. Data may take 30 minutes to 24 hours to appear after the first visits

No extra env vars or third-party accounts required.

### Google Search (SEO)

Google does not index new sites automatically. After deploy:

1. **Google Search Console** — [search.google.com/search-console](https://search.google.com/search-console)
   - Add property → URL prefix → your Vercel URL
   - Verify ownership (HTML tag, DNS, or Vercel integration)
2. **Submit sitemap** — `https://your-domain.com/sitemap.xml`
3. **Request indexing** — URL Inspection → enter homepage → Request indexing
4. **Wait** — first indexing usually takes 3–14 days for new sites

The app ships with `sitemap.xml`, `robots.txt`, and OpenGraph metadata when `NEXT_PUBLIC_SITE_URL` is set.

### Local production test

```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/                    # Pages, sitemap, robots
├── components/             # Shared UI & layout
├── features/grid-calculator/
├── lib/calculators/grid.ts
└── types/
```
