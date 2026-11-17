"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { holding, type Tx } from "@/lib/calc";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const raw = str(f, k);
  return raw === "" ? NaN : Number(raw);
};

function done() {
  revalidatePath("/");
  revalidatePath("/transactions");
}

export async function signIn(f: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(f, "email"),
    password: str(f, "password"),
  });
  if (error) redirect(`/login?error=${error.code === "email_not_confirmed" ? "unconfirmed" : "1"}`);
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function saveAsset(f: FormData) {
  const id = str(f, "id");
  const data = {
    name: str(f, "name"),
    category: str(f, "category"),
    symbol: str(f, "symbol") || null,
    coingecko_id: str(f, "coingecko_id").toLowerCase() || null,
  };
  if (!data.name) return;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("assets").update(data).eq("id", id)
    : await supabase.from("assets").insert(data);
  if (error) throw new Error(error.message);
  done();
}

export async function deleteAsset(f: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("assets").delete().eq("id", str(f, "id"));
  if (error) throw new Error(error.message);
  done();
}

export async function setManualPrice(f: FormData) {
  const price = num(f, "price");
  if (!Number.isFinite(price) || price < 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("assets")
    .update({ price_idr: price, price_source: "manual", price_updated_at: new Date().toISOString() })
    .eq("id", str(f, "id"));
  if (error) throw new Error(error.message);
  done();
}

/** Fetches crypto prices from CoinGecko on demand. Prices are cached in the DB until the next click. */
export async function refreshPrices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("id, coingecko_id")
    .not("coingecko_id", "is", null);
  if (error) throw new Error(error.message);
  const assets = (data ?? []) as { id: string; coingecko_id: string }[];
  const ids = [...new Set(assets.map((a) => a.coingecko_id))];
  if (ids.length === 0) redirect("/?prices=none");

  const key = process.env.COINGECKO_API_KEY;
  let prices: Record<string, { idr?: number }> | null = null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=idr`,
      { cache: "no-store", headers: key ? { "x-cg-demo-api-key": key } : {} }
    );
    if (res.ok) prices = await res.json();
  } catch {
    prices = null;
  }
  if (!prices) redirect("/?prices=error");

  const now = new Date().toISOString();
  let missing = 0;
  for (const a of assets) {
    const p = prices[a.coingecko_id]?.idr;
    if (typeof p !== "number") {
      missing++;
      continue;
    }
    await supabase
      .from("assets")
      .update({ price_idr: p, price_source: "coingecko", price_updated_at: now })
      .eq("id", a.id);
  }
  done();
  redirect(missing ? `/?prices=missing&n=${missing}` : "/?prices=ok");
}

export async function addTransaction(f: FormData) {
  const asset_id = str(f, "asset_id");
  const type = str(f, "type") === "sell" ? "sell" : "buy";
  const date = str(f, "date");
  const quantity = num(f, "quantity");
  const price = num(f, "price");
  const fee = str(f, "fee") === "" ? 0 : num(f, "fee");
  if (!asset_id || !date || !(quantity > 0) || !(price >= 0) || !(fee >= 0)) {
    redirect("/transactions?error=invalid");
  }

  const supabase = await createClient();
  if (type === "sell") {
    const { data } = await supabase.from("transactions").select("*").eq("asset_id", asset_id);
    const held = holding((data ?? []) as Tx[]).qty;
    if (quantity > held + 1e-12) redirect("/transactions?error=sell");
  }
  const { error } = await supabase.from("transactions").insert({ asset_id, type, date, quantity, price, fee });
  if (error) throw new Error(error.message);
  done();
  redirect("/transactions?saved=1");
}

export async function deleteTransaction(f: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", str(f, "id"));
  if (error) throw new Error(error.message);
  done();
}
