# Personal Investment Tracker

Next.js 15 + Supabase + Tailwind + Recharts. Single user, login required.

## 1. Supabase setup (once, ~5 min)
1. Create a free project at https://supabase.com.
2. **SQL Editor** → paste the contents of `supabase/schema.sql` → Run.
3. **Authentication → Users → Add user → Create new user**: enter your email + password, tick *Auto Confirm User*.
4. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" (so only you can log in).
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

## 2. Run locally
```bash
cp .env.example .env.local   # then fill in the two Supabase values
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Required | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase → Project Settings → API (anon public) |
| `COINGECKO_API_KEY` | no | Free Demo key at coingecko.com/en/api — only needed if you hit rate limits |

## 3. Deploy to Vercel
1. Push this folder to a GitHub repo (`.env.local` is git-ignored).
2. https://vercel.com → **Add New Project** → import the repo (framework: Next.js, defaults are fine).
3. Add the same environment variables under **Settings → Environment Variables**.
4. Deploy. Your data is protected by login + Supabase Row Level Security.

## How to use
1. **Dashboard → Manage assets → + Add asset.** For crypto, fill the CoinGecko ID (e.g. `bitcoin`, `ethereum`, `solana` — the ID shown in the coin's coingecko.com URL).
2. **Transactions** → record buys/sells (price per unit in IDR, optional fee).
3. **Refresh crypto prices** on the Dashboard fetches CoinGecko prices in IDR and stores them (no auto-refresh = no wasted API calls).
4. Gold, stocks, mutual funds, custom: open the asset under *Manage assets* and enter a **manual price**. For physical gold use the local **buyback** price per gram (e.g. Antam buyback), not the international spot price.

## Calculations (`lib/calc.ts`)
- Average-cost method. Buy fees are added to cost. A sell removes cost at the current average price.
- **Invested** = remaining cost of what you still hold. **Value** = qty × current price.
- **P/L** = Value − Invested. **ROI** = P/L ÷ Invested.
- Assets with no price yet are valued at cost (0 P/L) and flagged on the dashboard.
- Selling more than you hold is blocked.
