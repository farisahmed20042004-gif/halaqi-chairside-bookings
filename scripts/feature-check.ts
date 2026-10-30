// Checks for: customer profiles + debts, customer cancellation, public shop search.
// Run: bun scripts/feature-check.ts   (creates throwaway accounts named halaqi.test.*)
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

async function user(tag: string, fullName: string, type: "barber" | "customer") {
  const c = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `halaqi.test.${tag}.${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({
    email,
    password: `Test-${stamp}-Xy9!q`,
    options: { data: { full_name: fullName, account_type: type } },
  });
  if (error || !data.session) throw new Error(`signup ${tag}: ${error?.message ?? "no session"}`);
  return { c: c as C, id: data.user!.id };
}

const tag = String(stamp).slice(-5);
const barberA = await user("fa", "حلاق أ", "barber");
const barberB = await user("fb", "حلاق ب", "barber");
const cust1 = await user("fc1", "زبون واحد", "customer");
const cust2 = await user("fc2", "زبون اثنان", "customer");

const { data: shopA } = await barberA.c
  .from("barbers")
  .insert({ owner_id: barberA.id, shop_name: `صالون الأمير ${tag}`, barber_name: `مصطفى ${tag}`, area: "بغداد" })
  .select()
  .single();
const { data: shopB } = await barberB.c
  .from("barbers")
  .insert({ owner_id: barberB.id, shop_name: `صالون سري ${tag}`, barber_name: `سرّي ${tag}` })
  .select()
  .single();
const { data: cut } = await barberA.c
  .from("services")
  .insert({ barber_id: shopA!.id, name: "قص شعر", price: 10000, duration_minutes: 30 })
  .select()
  .single();
check("shops start hidden from public search", shopA!.is_public === false);

// ---------- 3. Public search ----------
const s0 = await cust1.c.rpc("search_public_shops", { p_query: tag });
check("hidden shop does not appear in search", (s0.data ?? []).length === 0, s0.data);
const pub = await barberA.c.from("barbers").update({ is_public: true }).eq("id", shopA!.id).select().single();
check("barber turns public visibility on", pub.data?.is_public === true, msg(pub));
const byShop = await cust1.c.rpc("search_public_shops", { p_query: `الامير ${tag}` });
check("search by shop name finds it (ignores أ/ا difference)", byShop.data?.[0]?.id === shopA!.id, msg(byShop) || byShop.data);
const byBarber = await cust1.c.rpc("search_public_shops", { p_query: `مصطفى ${tag}` });
check("search by barber name finds it", byBarber.data?.[0]?.id === shopA!.id, byBarber.data);
const row = byShop.data?.[0] as Record<string, unknown> | undefined;
const leaked = ["owner_id", "code", "customer_phone", "phone", "debts", "appointments"].filter((k) => row && k in row);
check("search result has no owner id, code or private fields", !!row && leaked.length === 0, leaked);
const svcs = (row?.["services"] ?? []) as { name: string; price: number }[];
check("search result lists services with prices", svcs.length === 1 && svcs[0]!.price === 10000, svcs);
check("search hides private shop of barber B", !(await cust1.c.rpc("search_public_shops", { p_query: `سري ${tag}` })).data?.length);
check("wildcard text does not list every shop", ((await cust1.c.rpc("search_public_shops", { p_query: "%" })).data ?? []).length === 0);
check("private shop page is not visible by id", ((await cust1.c.rpc("get_public_shop", { p_barber_id: shopB!.id })).data ?? []).length === 0);
check("public shop page is visible by id", (await cust1.c.rpc("get_public_shop", { p_barber_id: shopA!.id })).data?.[0]?.id === shopA!.id);
const anon = createClient<Database>(url, key, { auth: { persistSession: false } });
check("signed-out visitors cannot search", !!(await anon.rpc("search_public_shops", { p_query: "" })).error);

// Book directly from the search result (no code)
const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date(Date.now() + 86400000));
const slots = await cust1.c.rpc("get_available_slots", { p_barber_id: shopA!.id, p_day: tomorrow, p_service_id: cut!.id });
const T = slots.data![6]!.starts_at;
const T2 = slots.data![8]!.starts_at;
const book = (u: { c: C }, at: string) => u.c.rpc("book_appointment", { p_barber_id: shopA!.id, p_service_id: cut!.id, p_starts_at: at });
const b1 = await book(cust1, T);
check("customer books from search without a code", !b1.error && b1.data?.status === "confirmed", msg(b1));
const b1b = await book(cust1, T2);

// ---------- 1. Customer profiles & debts ----------
const custList = await barberA.c.from("shop_customers").select("*").eq("barber_id", shopA!.id);
check("barber sees the customer linked to the shop", custList.data?.some((r) => r.customer_id === cust1.id) === true, msg(custList));
check("other barber cannot see that customer", ((await barberB.c.from("shop_customers").select("*").eq("customer_id", cust1.id)).data ?? []).length === 0);
const hist = await barberA.c.from("appointments").select("id").eq("barber_id", shopA!.id).eq("customer_id", cust1.id);
check("barber sees the customer's appointments in the profile", (hist.data ?? []).length === 2, hist.data);

const when = new Date(Date.now() - 26 * 3600e3).toISOString();
const debt = await barberA.c
  .from("debts")
  .insert({ barber_id: shopA!.id, customer_id: cust1.id, customer_name: "اسم آخر", amount: 25000, note: "قص + ذقن", incurred_at: when })
  .select()
  .single();
check("barber adds a debt from the customer profile", !debt.error && debt.data?.customer_id === cust1.id, msg(debt));
check("debt keeps the chosen date and time", new Date(debt.data!.incurred_at).getTime() === new Date(when).getTime());
check("debt uses the customer's shop name, not typed text", debt.data?.customer_name === "زبون واحد", debt.data?.customer_name);
const future = await barberA.c
  .from("debts")
  .insert({ barber_id: shopA!.id, customer_id: cust1.id, customer_name: "x", amount: 1000, incurred_at: new Date(Date.now() + 86400e3).toISOString() });
check("debt dated in the future is rejected", msg(future).includes("DEBT_IN_FUTURE"), msg(future));
const bOnA = await barberB.c.from("debts").insert({ barber_id: shopA!.id, customer_id: cust1.id, customer_name: "x", amount: 1000 });
check("other barber cannot add a debt in this shop", !!bOnA.error);
const bOwn = await barberB.c.from("debts").insert({ barber_id: shopB!.id, customer_id: cust1.id, customer_name: "x", amount: 1000 });
check("other barber cannot attach a debt to a customer who is not theirs", msg(bOwn).includes("CUSTOMER_NOT_IN_SHOP"), msg(bOwn));

const seen = await cust1.c.from("debts").select("*, payments(id, amount, paid_at)").eq("id", debt.data!.id).maybeSingle();
check("customer sees the new debt with amount, description and date", seen.data?.amount === 25000 && seen.data.note === "قص + ذقن" && !!seen.data.incurred_at, msg(seen));
check("another customer cannot see it", !(await cust2.c.from("debts").select("id").eq("id", debt.data!.id).maybeSingle()).data);
check("other barber cannot see it", !(await barberB.c.from("debts").select("id").eq("id", debt.data!.id).maybeSingle()).data);

const pay = (amount: number) => barberA.c.from("payments").insert({ debt_id: debt.data!.id, barber_id: shopA!.id, amount });
check("partial payment saved", !(await pay(10000)).error);
const afterPartial = await cust1.c.from("debts").select("amount, payments(amount)").eq("id", debt.data!.id).single();
const paid1 = (afterPartial.data?.payments ?? []).reduce((s, p) => s + p.amount, 0);
check("customer sees remaining 15,000 after partial payment", afterPartial.data!.amount - paid1 === 15000, paid1);
check("overpayment rejected", msg(await pay(15001)).includes("OVERPAYMENT"));
check("customer cannot record a payment", !!(await cust1.c.from("payments").insert({ debt_id: debt.data!.id, barber_id: shopA!.id, amount: 1 })).error);
check("full payment of the rest saved", !(await pay(15000)).error);
const afterFull = await cust1.c.from("debts").select("amount, payments(amount)").eq("id", debt.data!.id).single();
check("customer sees remaining 0 and two payments", (afterFull.data?.payments ?? []).length === 2 && afterFull.data!.amount === (afterFull.data?.payments ?? []).reduce((s, p) => s + p.amount, 0));

// ---------- 2. Customer cancellation ----------
const cancel = await cust1.c.rpc("cancel_my_appointment", { p_id: b1.data!.id });
check("customer cancels an upcoming booking", !cancel.error, msg(cancel));
const kept = await barberA.c.from("appointments").select("status, cancelled_at, cancelled_by").eq("id", b1.data!.id).single();
check("appointment kept with status cancelled and who/when", kept.data?.status === "cancelled" && !!kept.data.cancelled_at && kept.data.cancelled_by === cust1.id);
const slots2 = await cust2.c.rpc("get_available_slots", { p_barber_id: shopA!.id, p_day: tomorrow, p_service_id: cut!.id });
check("cancelled time is available again", slots2.data?.find((s) => s.starts_at === T)?.available === true);
const b2 = await book(cust2, T);
check("another customer books the released time", !b2.error, msg(b2));
check("cancelling twice is refused", msg(await cust1.c.rpc("cancel_my_appointment", { p_id: b1.data!.id })).includes("CANNOT_CANCEL"));
check("customer cannot cancel someone else's booking", msg(await cust1.c.rpc("cancel_my_appointment", { p_id: b2.data!.id })).includes("CANNOT_CANCEL"));
await barberA.c.from("appointments").update({ status: "completed" }).eq("id", b1b.data!.id);
check("customer cannot cancel a completed appointment", msg(await cust1.c.rpc("cancel_my_appointment", { p_id: b1b.data!.id })).includes("CANNOT_CANCEL"));

const notesA = await barberA.c.from("notifications").select("*").eq("appointment_id", b1.data!.id);
check("barber is notified of the customer's cancellation", notesA.data?.[0]?.kind === "appointment_cancelled_by_customer", msg(notesA));
check("other barber does not get it", ((await barberB.c.from("notifications").select("id").eq("appointment_id", b1.data!.id)).data ?? []).length === 0);
const read = await barberA.c.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notesA.data![0]!.id).select();
check("barber marks the notification as read", read.data?.[0]?.read_at != null, msg(read));
const tamper = await barberA.c.from("notifications").update({ title: "x" } as never).eq("id", notesA.data![0]!.id);
check("notification text cannot be edited", !!tamper.error);
check("users cannot create notifications", !!(await cust1.c.from("notifications").insert({ user_id: barberA.id, kind: "appointment_cancelled_by_customer", title: "x" } as never)).error);

const barberCancel = await barberA.c.from("appointments").update({ status: "cancelled" }).eq("id", b2.data!.id).select().single();
check("barber can still cancel from the dashboard", barberCancel.data?.status === "cancelled", msg(barberCancel));
const notes2 = await cust2.c.from("notifications").select("kind").eq("appointment_id", b2.data!.id);
check("customer is told when the barber cancels", notes2.data?.[0]?.kind === "appointment_cancelled_by_barber", msg(notes2));
check("appointments are never deleted", !!(await barberA.c.from("appointments").delete().eq("id", b2.data!.id).select()).data?.length === false);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
