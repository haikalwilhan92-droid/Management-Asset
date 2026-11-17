import { createClient } from "@/lib/supabase/server";
import { fmtIDR, fmtQty } from "@/lib/calc";
import { addTransaction, deleteTransaction } from "../actions";

export const dynamic = "force-dynamic";

const MSG: Record<string, string> = {
  invalid: "Please fill in asset, date, a quantity above 0 and a price.",
  sell: "You cannot sell more than you currently hold.",
};

type TxRow = {
  id: string;
  type: "buy" | "sell";
  date: string;
  quantity: number;
  price: number;
  fee: number;
  assets: { name: string } | null;
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const [{ data: assets }, { data: txs, error: e }] = await Promise.all([
    supabase.from("assets").select("id, name").order("name"),
    supabase
      .from("transactions")
      .select("id, type, date, quantity, price, fee, assets(name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (e) throw new Error(e.message);
  const rows = (txs ?? []) as unknown as TxRow[];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-3 font-semibold">Record transaction</h2>
        {error && MSG[error] && <p className="mb-3 text-sm text-red-600">{MSG[error]}</p>}
        {saved && <p className="mb-3 text-sm text-emerald-700">Transaction saved.</p>}
        {(assets ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Add an asset on the Dashboard first.</p>
        ) : (
          <form action={addTransaction} className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="col-span-2">
              <label className="label">Asset</label>
              <select className="input" name="asset_id" required>
                {(assets ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" name="type">
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" name="date" type="date" required defaultValue={today} />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className="input" name="quantity" type="number" step="any" min="0" required />
            </div>
            <div>
              <label className="label">Price per unit (IDR)</label>
              <input className="input" name="price" type="number" step="any" min="0" required />
            </div>
            <div>
              <label className="label">Fee (IDR, optional)</label>
              <input className="input" name="fee" type="number" step="any" min="0" />
            </div>
            <div className="col-span-2 flex items-end md:col-span-5">
              <button className="btn">Save transaction</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Asset</th>
                <th className="th">Type</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Fee</th>
                <th className="th text-right">Total</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td className="td text-slate-500" colSpan={8}>
                    No transactions yet.
                  </td>
                </tr>
              )}
              {rows.map((t) => {
                const gross = Number(t.quantity) * Number(t.price);
                const total = t.type === "buy" ? gross + Number(t.fee) : gross - Number(t.fee);
                return (
                  <tr key={t.id}>
                    <td className="td">{t.date}</td>
                    <td className="td">{t.assets?.name ?? "—"}</td>
                    <td className={`td ${t.type === "buy" ? "pos" : "neg"}`}>{t.type === "buy" ? "Buy" : "Sell"}</td>
                    <td className="td text-right">{fmtQty(Number(t.quantity))}</td>
                    <td className="td text-right">{fmtIDR(Number(t.price))}</td>
                    <td className="td text-right">{fmtIDR(Number(t.fee))}</td>
                    <td className="td text-right">{fmtIDR(total)}</td>
                    <td className="td text-right">
                      <form action={deleteTransaction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="text-xs text-red-600 hover:underline">Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
