export type Category = "crypto" | "gold" | "stock" | "fund" | "custom";

export const CATEGORY_LABEL: Record<Category, string> = {
  crypto: "Crypto",
  gold: "Gold",
  stock: "Stock",
  fund: "Mutual fund",
  custom: "Custom",
};

export type Asset = {
  id: string;
  name: string;
  category: Category;
  symbol: string | null;
  coingecko_id: string | null;
  price_idr: number | null;
  price_source: "coingecko" | "manual" | null;
  price_updated_at: string | null;
};

export type Tx = {
  id: string;
  asset_id: string;
  type: "buy" | "sell";
  date: string;
  quantity: number;
  price: number;
  fee: number;
  created_at: string;
};

const EPS = 1e-12;

/** Average-cost method. Buy fees add to cost; sells remove cost at the current average. */
export function holding(txs: Tx[]) {
  const sorted = [...txs].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
  );
  let qty = 0;
  let cost = 0;
  for (const t of sorted) {
    const q = Number(t.quantity);
    if (t.type === "buy") {
      qty += q;
      cost += q * Number(t.price) + Number(t.fee || 0);
    } else {
      const avg = qty > EPS ? cost / qty : 0;
      const sold = Math.min(q, qty);
      qty -= sold;
      cost -= avg * sold;
    }
    if (qty < EPS) {
      qty = 0;
      cost = 0;
    }
  }
  return { qty, cost, avg: qty > 0 ? cost / qty : 0 };
}

export type Row = Asset & {
  qty: number;
  invested: number;
  avg: number;
  value: number;
  pl: number | null;
  priced: boolean;
};

export function portfolio(assets: Asset[], txs: Tx[]) {
  const rows: Row[] = assets.map((a) => {
    const h = holding(txs.filter((t) => t.asset_id === a.id));
    const priced = a.price_idr !== null && a.price_idr !== undefined;
    // Assets without a price are valued at cost so they do not distort P/L.
    const value = priced ? h.qty * Number(a.price_idr) : h.cost;
    return { ...a, qty: h.qty, invested: h.cost, avg: h.avg, value, pl: priced ? value - h.cost : null, priced };
  });
  const invested = rows.reduce((s, r) => s + r.invested, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const pl = value - invested;
  return {
    rows,
    invested,
    value,
    pl,
    roi: invested > 0 ? pl / invested : 0,
    unpriced: rows.filter((r) => !r.priced && r.qty > 0).length,
  };
}

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const idrSmall = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });
export const fmtIDR = (n: number) => (Math.abs(n) < 1000 && n !== 0 ? idrSmall : idr).format(n);
export const fmtQty = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 8 }).format(n);
export const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;
export const fmtDate = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
