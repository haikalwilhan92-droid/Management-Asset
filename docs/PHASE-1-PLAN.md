# Phase 1 — Project Audit & Planning

Personal Investment Dashboard · Date: 2026-11-15 · Status: **Awaiting approval before Phase 2**

---

## 1. Project audit

| Item | Finding |
|---|---|
| Existing files | Only `Prompt.txt` (requirements). No code, no `package.json`, no git repo. |
| Overwrite risk | None. New project will be created in this folder; `Prompt.txt` is kept. |
| Node.js | v22.21.0 ✅ |
| npm | 10.9.4 ✅ |
| git | 2.56 ✅ (repo not initialised yet) |
| Supabase CLI | Available via `npx supabase` ✅ |
| Docker | Not checked — only needed if you choose a **local** Supabase instead of cloud. |

---

## 2. Market data API findings (verified against official pages, 2026-11-15)

### A. Cryptocurrency — CoinGecko Demo API ✅ USE
| Property | Value |
|---|---|
| Base URL | `https://api.coingecko.com/api/v3/` |
| Auth | Header `x-cg-demo-api-key` (or query `x_cg_demo_api_key`) |
| Limits | **100 calls/min, 10,000 calls/month** |
| History | Daily & hourly: 1 year; 5-minute: 1 day |
| Endpoints | `/simple/price`, `/coins/{id}/market_chart`, `/coins/{id}/market_chart/range`, `/coins/{id}/history` |
| IDR | `vs_currencies=idr` supported by `/simple/price` (to be confirmed with a live call in Phase 4) |
| License | **Attribution required**: "Data provided by CoinGecko" with link |

Budget check: one batched `/simple/price` call for *all* coins every 15 min = 96/day ≈ **2,900/month** → well within 10,000. History back-fill uses the remaining budget.

### B. Gold — goldapi.dev ⚠️ USE WITH LIMITS
| Property | Value |
|---|---|
| Endpoint | `GET https://goldapi.dev/api/v1/price/{METAL}/{CURRENCY}` (e.g. `/price/XAU/USD`) |
| Auth | Header `X-API-Key` |
| Free tier | **100 requests/hour**, live spot price only, response includes `gram` price |
| NOT free | Daily history (Basic $8/mo), OHLC candles (Pro $15/mo) |
| License | Free commercial use requires visible link to goldapi.dev |
| IDR | Not explicitly confirmed in docs → will test `/price/XAU/IDR`; fallback = `XAU/USD × USD/IDR` |

Consequences:
- Gold **history is built by us**: every scheduled fetch stores a snapshot in `price_history`. History starts from the day the app goes live.
- **Spot ≠ Antam / Pegadaian / digital gold.** Spot price is shown as "Harga Spot Internasional". Local products (Antam, UBS, Pluang, Tring, etc.) use **manual price override** per asset, with separate *harga jual* and *harga buyback*. Portfolio valuation for local gold uses **buyback price** (what you could actually get), configurable.

### C. Indonesian stocks — ❌ no reliable *free & official* API found
| Option | Result |
|---|---|
| Twelve Data | Free Basic plan = **US markets only**; IDX requires Pro plan (paid). |
| Sectors.app (Indonesian) | Free plan has **no API access**; API starts at $59/month. |
| EODHD | Free sandbox: **20 calls/day**, EOD only, 1-year history; `.JK` coverage not confirmed on free tier. |
| `idx` open-source CLI, Apify actors | Scrape Yahoo Finance / MSN unofficially → **violates the "no unauthorized scraping" rule**. Rejected. |
| IDX official data services | Paid licensed product. |

**Recommendation:** Manual price input (default) + pluggable `StockPriceProvider` interface with an **optional EODHD adapter** (disabled until you add a key and we confirm `.JK` works). With ≤ 20 tickers, 20 calls/day = one end-of-day update per ticker per day.

### D. Mutual funds, bonds, deposits, custom
- **Mutual funds (reksa dana):** no free official NAV API (Bibit/Bareksa/Pasardana have no public API) → **manual NAV input**.
- **Government bonds (SBN retail: ORI, SR, SBR, ST):** valued at nominal (they are non-tradable / redeemed at par) + coupon recorded as `INTEREST` transactions → **automatic, no API needed**.
- **Deposits:** valuation **computed automatically** from principal, rate, tenor, start date and tax (20%) → accrued value without any API.
- **Custom assets:** manual valuation.

### E. FX (USD→IDR) for fallback conversion
- Candidate: **Frankfurter** (ECB reference rates, free, no key, includes IDR). Daily rate only. Will verify endpoint in Phase 4.
- Secondary: CoinGecko `/exchange_rates` (derived from BTC, less suitable) — only as a last resort.

### F. Scheduling — Supabase Cron + Edge Functions ✅
- `pg_cron` schedules → `pg_net.http_post` → Edge Function `update-prices`; secrets stored in **Supabase Vault**.
- Free plan: **500,000 Edge Function invocations/month** (we will use ≈ 4,000).
- ⚠️ **Free projects are paused after 7 days of inactivity.** It's unclear whether internal pg_cron activity counts. Mitigation: a free **Vercel Cron** or GitHub Actions ping to an API route once per day (both free). Supabase Pro ($25/mo) removes pausing — *not* used without your approval.

---

## 3. Proposed architecture

```
Browser (Next.js App Router, React, TanStack Query, Recharts, shadcn/ui)
   │  (only anon key + user session; never provider keys)
   ▼
Next.js server (Vercel)
   ├─ Server Actions / Route Handlers  (Zod validation, auth check)
   ├─ lib/finance/*        ← calculation engine (decimal.js, pure functions, unit tested)
   └─ lib/market-data/*    ← provider layer (manual refresh)
   ▼
Supabase
   ├─ Postgres (NUMERIC, RLS on every table)
   ├─ Auth (email + password / magic link)
   ├─ Edge Function: update-prices    ← same provider logic, Deno
   ├─ Edge Function: snapshot-portfolio (daily valuation snapshot)
   └─ pg_cron jobs → call Edge Functions on schedule
   ▼
External: CoinGecko · goldapi.dev · Frankfurter · (optional) EODHD
```

### Folder structure (planned)
```
/app
  /(auth)/login
  /(app)/dashboard  /portfolio  /transactions  /analytics  /market  /settings
  /api/cron/keepalive  /api/prices/refresh
/components  (ui/ = shadcn, charts/, forms/, tables/, layout/)
/lib
  /finance        decimal.ts, holdings.ts, realized.ts, returns.ts, allocation.ts
  /market-data
    /providers    coingecko.ts, gold.ts, stocks.ts, fx.ts, manual.ts
    provider-interface.ts, market-data-service.ts, price-normalizer.ts,
    cache-service.ts, retry.ts (timeout + exponential backoff), freshness.ts
  /supabase       client.ts, server.ts, middleware.ts
  /validation     zod schemas
/supabase
  /migrations     SQL schema + RLS + cron
  /functions      update-prices/, snapshot-portfolio/
/tests            unit (vitest) + integration
```

### Provider interface (core contract)
```ts
interface PriceProvider {
  id: 'coingecko' | 'goldapi' | 'eodhd' | 'frankfurter' | 'manual';
  supports(asset: AssetRef): boolean;
  fetchPrices(assets: AssetRef[], quote: 'IDR'): Promise<PriceQuote[]>;
}
type PriceQuote = {
  assetId: string; price: string /* decimal string */; currency: 'IDR';
  unit: 'unit' | 'gram' | 'troy_oz' | 'lot' | 'share';
  source: string; sourceTimestamp: Date; fetchedAt: Date;
};
```
Rules enforced in `market-data-service`: validate (> 0, finite, sane deviation from last price) → never overwrite a valid price with null/invalid → mark freshness (`live` / `delayed` / `stale` / `manual`) → log every attempt to `api_update_logs`.

---

## 4. Database design (draft)

All money/quantity columns: `NUMERIC(38,18)` for quantity, `NUMERIC(24,4)` for IDR amounts. All tables have `created_at`, `updated_at`. RLS: `user_id = auth.uid()` on every user-owned table.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id (= auth.users.id)`, `display_name` | Supabase Auth owns users |
| `asset_classes` | `code` (`crypto`,`gold`,`stock_id`,`mutual_fund`,`bond`,`deposit`,`custom`), `label_id`, `default_provider`, `default_unit` | Reference table → new classes = new row, no restructuring |
| `assets` | `id`, `user_id`, `asset_class`, `name`, `symbol`, `provider`, `provider_ref` (e.g. `bitcoin`, `BBCA.JK`), `unit`, `valuation_mode` (`market`/`buyback`/`manual`/`accrual`), `meta jsonb` (deposit rate, tenor…), `is_active` | |
| `transactions` | `id`, `user_id`, `asset_id` (nullable for cash), `type` ENUM(`BUY`,`SELL`,`DEPOSIT`,`WITHDRAWAL`,`FEE`,`DIVIDEND`,`INTEREST`), `quantity`, `price`, `amount`, `fee`, `tax`, `executed_at`, `note` | CHECK constraints per type; trigger prevents negative holdings |
| `price_history` | `asset_id` or `(provider, provider_ref)`, `price`, `currency`, `unit`, `source`, `source_ts`, `fetched_at`, `is_manual` | Shared market prices + per-user manual overrides |
| `latest_prices` | view / table of latest valid price per asset with freshness | Fast dashboard reads |
| `portfolio_snapshots` | `user_id`, `snapshot_date`, `market_value`, `cost_basis`, `net_cash_flow`, `realized_pl`, `unrealized_pl` | Daily; used for time-weighted return |
| `market_data_providers` | `id`, `name`, `enabled`, `schedule_cron`, `rate_limit`, `last_success_at`, `last_error` | Configurable schedules |
| `api_update_logs` | `provider`, `started_at`, `finished_at`, `status`, `http_status`, `assets_updated`, `error` | |
| `user_settings` | `user_id`, `base_currency` (IDR), `gold_valuation` (buyback/spot), `refresh_preferences jsonb` | |

API secrets live only in **Supabase Edge Function secrets / Vercel env vars**, never in tables readable by the client.

---

## 5. Calculation rules (to be implemented in Phase 3 with tests)

- **Weighted average cost.** BUY: `cost += qty×price + fee`; `qty += q`. SELL: `costRemoved = avgCost × q`; `realized += (q×price − fee − tax) − costRemoved`.
- **Average cost** = remaining cost basis ÷ remaining quantity.
- **Market value** = quantity × latest price (unit-normalised).
- **Unrealized P/L** = market value − remaining cost basis.
- **ROI**: unrealized ROI = unrealized P/L ÷ remaining cost basis; realized ROI = realized P/L ÷ cost of sold units; total return = (realized + unrealized + dividends + interest) ÷ total gross invested.
- **Portfolio performance**: **Time-Weighted Return** from daily snapshots, adjusted for `DEPOSIT`/`WITHDRAWAL` and net buy/sell flows, so new money is never counted as profit. Money-weighted (XIRR) as a secondary metric.
- `decimal.js` everywhere in TS; `NUMERIC` in Postgres; no JS `number` for money.
- Test cases: multiple buys, partial sell, full sell then re-buy, fees on both sides, sell more than held (rejected), dividends, deposits/withdrawals, zero-quantity edge cases.

---

## 6. Implementation roadmap

| Phase | Deliverable | Exit criteria |
|---|---|---|
| 2 Foundation | Next.js + TS + Tailwind + shadcn, Supabase client, migrations, Auth, layout & navigation (ID labels) | Login works; empty pages render; RLS migration applied |
| 3 Engine | Assets & transactions CRUD, calculation engine, holdings, snapshots | Vitest suite green; partial-sale tests pass |
| 4 Market data | Provider layer, CoinGecko, goldapi, FX, manual, optional EODHD, Edge Function + pg_cron | Live prices stored with source & timestamp; failure doesn't erase prices |
| 5 UI | Dashboard, Portfolio, Transactions (filter/search/CSV export), Analytics, Market, Settings | All figures from DB; no hardcoded numbers |
| 6 Testing | Integration tests, RLS tests (user A can't read B), API failure simulations, mobile check | All tests pass; build passes |
| 7 Deploy | Vercel + Supabase guide, env checklist, cron setup, README, final report | Verified deploy only if you provide accounts |

---

## 7. Credentials you will need

| Credential | Where | Cost | Needed by |
|---|---|---|---|
| Supabase project (URL, anon/publishable key, secret/service key) | supabase.com → New project | Free | Phase 2 |
| CoinGecko Demo API key | coingecko.com → Developer Dashboard → "+ Add New Key" | Free | Phase 4 |
| goldapi.dev API key | goldapi.dev → sign up | Free (100 req/h) | Phase 4 |
| EODHD key (optional) | eodhd.com → register | Free sandbox (20 calls/day) | Phase 4, optional |
| Vercel account | vercel.com | Free Hobby | Phase 7 |

---

## 8. Decisions needed from you before Phase 2

1. **Supabase**: cloud project (recommended, free) or local Docker?
2. **Indonesian stocks**: manual price input only (recommended), or also try the EODHD free sandbox (20 calls/day, `.JK` coverage unconfirmed)?
3. **Gold valuation for local products (Antam, digital gold)**: value at **buyback price** (recommended, conservative) or sell price?
4. **Inactivity pausing**: OK to add a free daily keep-alive ping (Vercel Cron) to prevent the Supabase free project from pausing?

## Sources
- CoinGecko: https://docs.coingecko.com/demo/reference/authentication.md, https://docs.coingecko.com/demo/reference/endpoint-overview.md, https://www.coingecko.com/en/api/pricing
- goldapi.dev: https://goldapi.dev/docs, https://goldapi.dev/pricing
- Twelve Data IDX coverage: https://support.twelvedata.com/en/articles/5749757-indonesia-stock-exchange-idx
- Sectors.app: https://docs.sectors.app/
- EODHD: https://eodhd.com/pricing
- idx CLI (rejected, scrapes Yahoo/MSN): https://github.com/fzn0x/idx/wiki
- Supabase scheduling: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase pricing/pausing: https://supabase.com/docs/pricing
