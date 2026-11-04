// Checks for the live debt system: customer_debts ledger, privacy, overpayment,
// permanent history, money notifications and realtime delivery.
// Run: bun scripts/money-check.ts   (creates throwaway accounts named halaqi.test.*)
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
const msg = (r: { error: { message: string } | null }) => r.error?.message ?? "";
type C = SupabaseClient<Database>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function user(tag: string, fullName: string, type: "barber" | "customer") {
  const c = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signUp({
    email: `halaqi.test.${tag}.${stamp}@example.com`,
    password: `Test-${stamp}-Xy9!q`,
    options: { data: { full_name: fullName, account_type: type } },
  });
  if (error || !data.session) throw new Error(`signup ${tag}: ${error?.message ?? "no session"}`);
  c.realtime.setAuth(data.session.access_token);
  return { c: c as C, id: data.user!.id };
}

const barberA = await user("ma", "حلاق المال أ", "barber");
const barberB = await user("mb", "حلاق المال ب", "barber");
const cust1 = await user("mc1", "زبون المال ١", "customer");
const cust2 = await user("mc2", "زبون المال ٢", "customer");

const { data: shopA } = await barberA.c.from("barbers").insert({ owner_id: barberA.id, shop_name: "صالون المال", barber_name: "أبو علي" }).select().single();
const { data: shopB } = await barberB.c.from("barbers").insert({ owner_id: barberB.id, shop_name: "صالون آخر", barber_name: "أبو حسن" }).select().single();
const { data: cut } = await barberA.c.from("services").insert({ barber_id: shopA!.id, name: "قص", price: 10000, duration_minutes: 30 }).select().single();

// Link cust1 to shop A through a booking (that's how a customer joins a shop's customer list).
const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date(Date.now() + 86400000));
const slots = await cust1.c.rpc("get_available_slots", { p_barber_id: shopA!.id, p_day: tomorrow, p_service_id: cut!.id });
const booked = await cust1.c.rpc("book_appointment", { p_barber_id: shopA!.id, p_service_id: cut!.id, p_starts_at: slots.data![4]!.starts_at });
check("setup: customer linked to shop by booking", !booked.error, msg(booked));

// ---------- Realtime listeners ----------
const got1: { kind: string; amount: number | null; balance: number | null }[] = [];
const got2Debts: unknown[] = [];
const ch1 = cust1.c
  .channel(`t1-${stamp}`)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${cust1.id}` }, (p) =>
    got1.push(p.new as (typeof got1)[number]),
  );
const ch2 = cust2.c
  .channel(`t2-${stamp}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, (p) => got2Debts.push(p.new));
const subscribed = (ch: ReturnType<C["channel"]>) =>
  new Promise<string>((res) => {
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") res(s);
    });
  });
const [s1, s2] = await Promise.all([subscribed(ch1), subscribed(ch2)]);
check("customer subscribes to live updates", s1 === "SUBSCRIBED" && s2 === "SUBSCRIBED", [s1, s2]);
await sleep(1500);

// ---------- Debt for an existing customer ----------
const debt = await barberA.c
  .from("debts")
  .insert({ barber_id: shopA!.id, customer_id: cust1.id, customer_name: "x", amount: 30000, note: "قص + ذقن" })
  .select()
  .single();
check("barber adds a debt for an existing customer", !debt.error, msg(debt));
const pay = (amount: number, c: C = barberA.c) => c.from("payments").insert({ debt_id: debt.data!.id, barber_id: shopA!.id, amount });
check("partial payment saved", !(await pay(10000)).error);
check("payment larger than the remaining 20,000 is rejected", msg(await pay(20001)).includes("OVERPAYMENT"));

for (let i = 0; i < 20 && got1.length < 2; i++) await sleep(500);
const live = got1.find((n) => n.kind === "debt_added");
const livePay = got1.find((n) => n.kind === "payment_recorded");
check("customer gets the new debt live", live?.amount === 30000 && live.balance === 30000, got1);
check("customer gets the payment live with remaining 20,000", livePay?.amount === 10000 && livePay.balance === 20000, got1);
check("another customer's live feed receives none of it", got2Debts.length === 0, got2Debts.length);

const notes = await cust1.c.from("notifications").select("kind, title, amount, balance").in("kind", ["debt_added", "payment_recorded"]);
check("notification text for a new debt", notes.data?.some((n) => n.title === "تم إضافة دين جديد من حلاقك") === true, notes.data);
check("notification text for a payment", notes.data?.some((n) => n.title === "تم تسجيل تسديد جديد") === true, notes.data);

// ---------- customer_debts ledger ----------
const ledger = await cust1.c.from("customer_debts").select("*").eq("customer_id", cust1.id);
const rows = ledger.data ?? [];
const owed = rows.filter((r) => r.type === "debt").reduce((s, r) => s + Number(r.amount), 0);
const paidSum = rows.filter((r) => r.type === "payment").reduce((s, r) => s + Number(r.amount), 0);
check("customer ledger has the debt and the payment", rows.length === 2, msg(ledger) || rows);
check("customer remaining = 30,000 − 10,000 = 20,000", owed - paidSum === 20000, [owed, paidSum]);
check("ledger rows carry barber, customer, amount, note, type and time", !!rows[0]?.barber_id && !!rows[0]?.created_at && rows.some((r) => r.note === "قص + ذقن"));
check("other customer sees nothing in the ledger", ((await cust2.c.from("customer_debts").select("id")).data ?? []).length === 0);
check("other barber sees nothing of shop A's ledger", ((await barberB.c.from("customer_debts").select("id").eq("barber_id", shopA!.id)).data ?? []).length === 0);
check("barber A sees their own ledger", ((await barberA.c.from("customer_debts").select("id").eq("barber_id", shopA!.id)).data ?? []).length === 2);
const anon = createClient<Database>(url, key, { auth: { persistSession: false } });
const anonRead = await anon.from("customer_debts").select("id");
check("signed-out visitors cannot read the ledger", !!anonRead.error || (anonRead.data ?? []).length === 0, anonRead.data?.length);
check("nobody can write into the ledger", !!(await barberA.c.from("customer_debts").insert({ amount: 1 } as never)).error);

// ---------- Customer typed by name + phone ----------
const walk = await barberA.c
  .from("debts")
  .insert({ barber_id: shopA!.id, customer_name: "زبون بلا حساب", customer_phone: "07701234567", amount: 5000 })
  .select()
  .single();
check("barber adds a debt for a typed name and phone", !walk.error && walk.data?.customer_id === null, msg(walk));
check("that debt is visible to no customer", !(await cust1.c.from("debts").select("id").eq("id", walk.data!.id).maybeSingle()).data);

// ---------- Permissions & permanent history ----------
check("barber B cannot add a debt to shop A", !!(await barberB.c.from("debts").insert({ barber_id: shopA!.id, customer_name: "x", amount: 1 })).error);
check("barber B cannot pay shop A's debt", !!(await pay(1, barberB.c)).error);
check("barber B cannot attach a debt to shop A's customer", msg(await barberB.c.from("debts").insert({ barber_id: shopB!.id, customer_id: cust1.id, customer_name: "x", amount: 1 })).includes("CUSTOMER_NOT_IN_SHOP"));
check("customer cannot add a debt", !!(await cust1.c.from("debts").insert({ barber_id: shopA!.id, customer_name: "x", amount: 1 })).error);
check("customer cannot record a payment", !!(await pay(1, cust1.c)).error);
await barberA.c.from("debts").delete().eq("id", debt.data!.id);
await barberA.c.from("payments").delete().eq("debt_id", debt.data!.id);
await cust1.c.from("payments").delete().eq("debt_id", debt.data!.id);
const still = await barberA.c.from("debts").select("amount, payments(amount)").eq("id", debt.data!.id).single();
check("debt and payment cannot be deleted", still.data?.amount === 30000 && still.data.payments.length === 1, still.data);
const changeAmt = await barberA.c.from("debts").update({ amount: 1 } as never).eq("id", debt.data!.id);
check("original debt amount cannot be changed", !!changeAmt.error, msg(changeAmt));
const changePay = await barberA.c.from("payments").update({ amount: 1 } as never).eq("debt_id", debt.data!.id);
check("recorded payment cannot be changed", !!changePay.error, msg(changePay));
check("full payment of the remaining 20,000 saved", !(await pay(20000)).error);
check("nothing more can be paid on a settled debt", msg(await pay(1)).includes("OVERPAYMENT"));

await cust1.c.removeChannel(ch1);
await cust2.c.removeChannel(ch2);
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
