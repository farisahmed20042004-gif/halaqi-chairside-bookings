// Checks the customer flow: barber code saved once (customer_barbers), "change barber",
// and "مواعيدي" statuses (confirmed / rejected by barber / cancelled by customer / completed).
// Run: bun scripts/customer-flow-check.ts   (creates throwaway accounts named halaqi.test.*)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../src/integrations/supabase/types";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const stamp = Date.now();
let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra !== undefined ? "  " + JSON.stringify(extra) : ""}`);
};
type C = SupabaseClient<Database>;

async function user(tag: string, fullName: string, type: "barber" | "customer") {
  const c = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `halaqi.test.${tag}.${stamp}@example.com`;
  const password = `Test-${stamp}-Xy9!q`;
  const { data, error } = await c.auth.signUp({ email, password, options: { data: { full_name: fullName, account_type: type } } });
  if (error || !data.session) throw new Error(`signup ${tag}: ${error?.message ?? "no session"}`);
  return { c: c as C, id: data.user!.id, email, password };
}

const barberA = await user("cfa", "حلاق أ", "barber");
const barberB = await user("cfb", "حلاق ب", "barber");
const cust = await user("cfc", "زبون أ", "customer");
const other = await user("cfd", "زبون ب", "customer");

const mkShop = async (b: typeof barberA, name: string) => {
  const { data } = await b.c.from("barbers").insert({ owner_id: b.id, shop_name: name, barber_name: name }).select().single();
  const { data: svc } = await b.c.from("services").insert({ barber_id: data!.id, name: "قص شعر", price: 10000, duration_minutes: 30 }).select().single();
  return { shop: data!, svc: svc! };
};
const A = await mkShop(barberA, "صالون أ");
const B = await mkShop(barberB, "صالون ب");

// 1. Save code once
const none = await cust.c.rpc("get_my_barber");
check("new customer has no saved barber", (none.data ?? []).length === 0, none);
const bad = await cust.c.rpc("save_my_barber", { p_code: "HLQ-NOPE00" });
check("a wrong code is refused", !!bad.error && bad.error.message.includes("BARBER_NOT_FOUND"), bad);
const saved = await cust.c.rpc("save_my_barber", { p_code: ` ${A.shop.code.toLowerCase()} ` });
check("valid code (any case/spaces) is saved", saved.data?.[0]?.id === A.shop.id, saved);
const row = await cust.c.from("customer_barbers").select("*").single();
check("row stored with customer_id, barber_id and barber_code", row.data?.customer_id === cust.id && row.data?.barber_id === A.shop.id && row.data?.barber_code === A.shop.code, row);
const again = await cust.c.rpc("get_my_barber");
check("saved barber comes back on the next visit", again.data?.[0]?.code === A.shop.code, again);

// Re-login on a "new device" still finds it
const fresh = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
await fresh.auth.signInWithPassword({ email: cust.email, password: cust.password });
const fromNewDevice = await fresh.rpc("get_my_barber");
check("saved barber survives sign-out / sign-in", fromNewDevice.data?.[0]?.id === A.shop.id, fromNewDevice);

// Privacy
const peek = await other.c.from("customer_barbers").select("*");
check("another customer cannot see this customer's saved barber", (peek.data ?? []).length === 0, peek);
const barberPeek = await barberA.c.from("customer_barbers").select("*");
check("the barber cannot read customers' saved-barber rows", (barberPeek.data ?? []).length === 0, barberPeek);
const directInsert = await other.c.from("customer_barbers").insert({ customer_id: other.id, barber_id: A.shop.id, barber_code: "FAKE" });
check("rows can't be written directly (only through a real code)", !!directInsert.error);
const barberSave = await barberB.c.rpc("save_my_barber", { p_code: A.shop.code });
check("barber accounts cannot save a barber", !!barberSave.error);
const otherDelete = await other.c.from("customer_barbers").delete().eq("customer_id", cust.id).select();
check("another customer cannot remove it", (otherDelete.data ?? []).length === 0);

// Change barber
const swap = await cust.c.rpc("save_my_barber", { p_code: B.shop.code });
const afterSwap = await cust.c.from("customer_barbers").select("*");
check("changing the code replaces the saved barber (one row)", swap.data?.[0]?.id === B.shop.id && afterSwap.data?.length === 1, afterSwap);
const forget = await cust.c.from("customer_barbers").delete().eq("customer_id", cust.id).select();
const afterForget = await cust.c.rpc("get_my_barber");
check("'تغيير الحلاق' clears the saved barber", (forget.data ?? []).length === 1 && (afterForget.data ?? []).length === 0, forget);

// 2. My bookings
const day = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date(Date.now() + n * 86400000));
const free = async (n: number, i = 0) => {
  const s = await cust.c.rpc("get_available_slots", { p_barber_id: A.shop.id, p_day: day(n), p_service_id: A.svc.id });
  return s.data!.filter((x) => x.available)[i]!.starts_at;
};
const bk = async (t: string) => (await cust.c.rpc("book_appointment", { p_barber_id: A.shop.id, p_service_id: A.svc.id, p_starts_at: t })).data!;
let d = 1;
let t1 = "";
for (; d < 8 && !t1; d++) t1 = await free(d).catch(() => "");
const b1 = await bk(t1);
const b2 = await bk(await free(d - 1, 2));
const b3 = await bk(await free(d - 1, 4));
check("booking is confirmed instantly", b1.status === "confirmed", b1);

await barberA.c.from("appointments").update({ status: "cancelled" }).eq("id", b2.id);
await cust.c.rpc("cancel_my_appointment", { p_id: b3.id });

const list = await cust.c.rpc("get_my_bookings");
const byId = new Map((list.data ?? []).map((x) => [x.id, x]));
check("my bookings lists all 3", byId.size === 3, list);
const first = list.data?.[0];
check("newest booking first", first?.id === b3.id, list.data?.map((x) => x.id));
const c1 = byId.get(b1.id);
check("card has service, price, barber name, status", c1?.service === "قص شعر" && c1?.price === 10000 && c1?.barber_name === "صالون أ" && c1?.status === "confirmed", c1);
check("barber-cancelled booking is marked as rejected", byId.get(b2.id)?.cancelled_by_barber === true, byId.get(b2.id));
check("customer-cancelled booking is not marked rejected", byId.get(b3.id)?.cancelled_by_barber === false, byId.get(b3.id));
const otherList = await other.c.rpc("get_my_bookings");
check("another customer sees none of these bookings", (otherList.data ?? []).length === 0, otherList);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
