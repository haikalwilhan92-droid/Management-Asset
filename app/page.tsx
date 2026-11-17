import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_LABEL,
  fmtDate,
  fmtIDR,
  fmtPct,
  fmtQty,
  portfolio,
  type Asset,
  type Category,
  type Row,
  type Tx,
} from "@/lib/calc";
import AllocationChart from "@/components/AllocationChart";
import { deleteAsset, refreshPrices, saveAsset, setManualPrice } from "./actions";

export const dynamic = "force-dynamic";

const PRICE_MSG: Record<string, string> = {
  ok: "Crypto prices updated from CoinGecko.",
  none: "No assets have a CoinGecko ID. Use manual prices, or add an ID to a crypto asset.",
  error: "CoinGecko is unavailable right now. Previous prices are kept; you can enter prices manually.",
  missing: "Some CoinGecko IDs were not found. Check the ID on coingecko.com (e.g. bitcoin, ethereum).",
};

function plClass(n: number | null) {
  if (n === null || n === 0) return "";
  return n > 0 ? "pos" : "neg";
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ prices?: string }> }) {
  const { prices } = await searchParams;
  const supabase = await createClient();
  const [{ data: assets, error: e1 }, { data: txs, error: e2 }] = await Promise.all([
    supabase.from("assets").select("*").order("name"),
    supabase.from("transactions").select("*"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);

  const p = portfolio((assets ?? []) as Asset[], (txs ?? []) as Tx[]);
  const byCategory = new Map<string, number>();
  for (const r of p.rows) {
    if (r.value > 0) byCategory.set(CATEGORY_LABEL[r.category], (byCategory.get(CATEGORY_LABEL[r.category]) ?? 0) + r.value);
  }
  const chartData = [...byCategory].map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Invested capital" value={fmtIDR(p.invested)} />
        <Stat label="Market value" value={fmtIDR(p.value)} />
        <Stat label="Unrealized P/L" value={fmtIDR(p.pl)} cls={plClass(p.pl)} />
        <Stat label="ROI" value={fmtPct(p.roi)} cls={plClass(p.roi)} />
      </div>
      {p.unpriced > 0 && (
        <p className="text-xs text-amber-700">
          {p.unpriced} asset(s) have no price yet and are valued at cost.
        </p>
      )}

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Holdings</h2>
          <form action={refreshPrices} className="ml-auto">
            <button className="btn-ghost">↻ Refresh crypto prices</button>
          </form>
        </div>
        {prices && PRICE_MSG[prices] && (
          <p className={`mb-3 text-sm ${prices === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{PRICE_MSG[prices]}</p>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <th className="th">Asset</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Avg buy</th>
                <th className="th text-right">Current price</th>
                <th className="th text-right">Value</th>
                <th className="th text-right">P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.rows.length === 0 && (
                <tr>
                  <td className="td text-slate-500" colSpan={6}>
                    No assets yet. Add one below, then record a buy in Transactions.
                  </td>
                </tr>
              )}
              {p.rows.map((r) => (
                <HoldingRow key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold">Allocation by category</h2>
          <AllocationChart data={chartData} />
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Manage assets</h2>
          <details className="rounded-md border border-slate-200 p-3">
            <summary className="text-sm font-medium">+ Add asset</summary>
            <AssetForm />
          </details>
          {p.rows.map((r) => (
            <details key={r.id} className="rounded-md border border-slate-200 p-3">
              <summary className="text-sm">
                {r.name} <span className="text-slate-400">· {CATEGORY_LABEL[r.category]}</span>
              </summary>
              <div className="mt-3 space-y-4">
                <form action={setManualPrice} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="flex-1">
                    <label className="label">Manual price per unit (IDR){r.category === "gold" && " — use buyback price"}</label>
                    <input className="input" name="price" type="number" step="any" min="0" required defaultValue={r.price_idr ?? ""} />
                  </div>
                  <button className="btn">Save price</button>
                </form>
                <AssetForm asset={r} />
                <form action={deleteAsset}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn-danger">Delete asset and its transactions</button>
                </form>
              </div>
            </details>
          ))}
        </section>
      </div>

      <p className="text-xs text-slate-400">
        Crypto prices: data provided by{" "}
        <a className="underline" href="https://www.coingecko.com" target="_blank" rel="noreferrer">
          CoinGecko
        </a>
        . Gold, stock and fund prices are entered manually. Gold should use local buyback price (e.g. Antam), not international spot.
      </p>
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function HoldingRow({ r }: { r: Row }) {
  return (
    <tr>
      <td className="td">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-slate-400">
          {CATEGORY_LABEL[r.category]}
          {r.symbol && ` · ${r.symbol}`}
        </div>
      </td>
      <td className="td text-right">{fmtQty(r.qty)}</td>
      <td className="td text-right">{r.qty > 0 ? fmtIDR(r.avg) : "—"}</td>
      <td className="td text-right">
        {r.priced ? fmtIDR(Number(r.price_idr)) : <span className="text-slate-400">no price</span>}
        {r.price_updated_at && (
          <div className="text-xs text-slate-400">
            {r.price_source} · {fmtDate(r.price_updated_at)}
          </div>
        )}
      </td>
      <td className="td text-right">{fmtIDR(r.value)}</td>
      <td className={`td text-right ${plClass(r.pl)}`}>
        {r.pl === null ? "—" : fmtIDR(r.pl)}
        {r.pl !== null && r.invested > 0 && <div className="text-xs">{fmtPct(r.pl / r.invested)}</div>}
      </td>
    </tr>
  );
}

function AssetForm({ asset }: { asset?: Asset }) {
  return (
    <form action={saveAsset} className="mt-3 grid grid-cols-2 gap-2">
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <div className="col-span-2">
        <label className="label">Name</label>
        <input className="input" name="name" required defaultValue={asset?.name} placeholder="e.g. Bitcoin, Antam 10g, BBCA" />
      </div>
      <div>
        <label className="label">Category</label>
        <select className="input" name="category" defaultValue={asset?.category ?? "crypto"}>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Symbol (optional)</label>
        <input className="input" name="symbol" defaultValue={asset?.symbol ?? ""} placeholder="BTC" />
      </div>
      <div className="col-span-2">
        <label className="label">CoinGecko ID (crypto only, for auto price)</label>
        <input className="input" name="coingecko_id" defaultValue={asset?.coingecko_id ?? ""} placeholder="bitcoin" />
      </div>
      <div className="col-span-2">
        <button className="btn">{asset ? "Save changes" : "Add asset"}</button>
      </div>
    </form>
  );
}
