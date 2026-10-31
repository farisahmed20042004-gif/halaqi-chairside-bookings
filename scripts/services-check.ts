// Checks "خدماتي": barbers add / edit / hide / delete services; customers must pick
// a service to book; bookings store service_id; other barbers cannot touch them.
// Run: bun scripts/services-check.ts   (creates throwaway accounts named halaqi.test.*)
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
  const { data, error } = await c.auth.signUp({
    email: `halaqi.test.${tag}.${stamp}@example.com`,
    password: `Test-${stamp}-Xy9!q`,
    options: { data: { full_name: fullName, account_type: type } },
  });
  if (error || !data.session) throw new Error(`signup ${tag}: ${error?.message ?? "no session"}`);
  return { c: c as C, id: data.user!.id };
}

const barberA = await user("sa", "حلاق خدمات", "barber");
const barberB = await user("sb", "حلاق آخر", "barber");
const cust = await user("sc", "زبون خدمات", "customer");

const { data: shop } = await barberA.c
  .from("barbers")
  .insert({ owner_id: barberA.id, shop_name: "صالون الخدمات", barber_name: "حلاق خدمات" })
  .select()
  .single();

const empty = await cust.c.rpc("get_shop_services", { p_barber_id: shop!.id });
check("new shop shows no services to customers", (empty.data ?? []).length === 0, empty);

// Add
const add = await barberA.c
  .from("services")
  .insert({ barber_id: shop!.id, name: "قص شعر", price: 10000, duration_minutes: 30, description: "قص + تصفيف" })
  .select()
  .single();
check("barber adds a service saved with his shop id", add.data?.barber_id === shop!.id && add.data?.price === 10000, add.error);
const beard = await barberA.c.from("services").insert({ barber_id: shop!.id, name: "ذقن", price: 5000, duration_minutes: 15 }).select().single();
check("barber adds a second service", !!beard.data, beard.error);

// Other barber cannot add to, edit, or see this shop's services
const intrude = await barberB.c.from("services").insert({ barber_id: shop!.id, name: "دخيل", price: 1, duration_minutes: 30 });
check("another barber cannot add services to this shop", !!intrude.error);
const editOther = await barberB.c.from("services").update({ price: 1 }).eq("id", add.data!.id).select();
check("another barber cannot edit this shop's services", (editOther.data ?? []).length === 0);
const seeOther = await barberB.c.from("services").select("id").eq("barber_id", shop!.id);
check("another barber cannot list this shop's services", (seeOther.data ?? []).length === 0);
const custInsert = await cust.c.from("services").insert({ barber_id: shop!.id, name: "زبون", price: 1, duration_minutes: 30 });
check("customers cannot add services", !!custInsert.error);

// Limits
const tooShort = await barberA.c.from("services").insert({ barber_id: shop!.id, name: "ق", price: 1000, duration_minutes: 30 });
check("name shorter than 2 letters is refused", !!tooShort.error);
const badDur = await barberA.c.from("services").insert({ barber_id: shop!.id, name: "طويل", price: 1000, duration_minutes: 500 });
check("duration over 480 minutes is refused", !!badDur.error);

// Customer sees services (name, price, duration, description)
const list = await cust.c.rpc("get_shop_services", { p_barber_id: shop!.id });
const cut = list.data?.find((s) => s.id === add.data!.id);
check("customer sees both services with prices", list.data?.length === 2 && cut?.price === 10000 && cut?.description === "قص + تصفيف", list);

// Booking must name a service and stores service_id + price snapshot
const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date(Date.now() + 86400000));
const slots = await cust.c.rpc("get_available_slots", { p_barber_id: shop!.id, p_day: tomorrow, p_service_id: add.data!.id });
const T = slots.data!.find((s) => s.available)!.starts_at;
const noService = await cust.c.rpc("book_appointment", { p_barber_id: shop!.id, p_service_id: null as never, p_starts_at: T });
check("booking without a service is refused", !!noService.error);
const booked = await cust.c.rpc("book_appointment", { p_barber_id: shop!.id, p_service_id: add.data!.id, p_starts_at: T });
check(
  "booking saves service_id, name, price and duration",
  booked.data?.service_id === add.data!.id && booked.data?.service === "قص شعر" && booked.data?.price === 10000 && booked.data?.duration_minutes === 30,
  booked.error ?? booked.data,
);

// Edit price: old booking keeps the agreed price
const edit = await barberA.c.from("services").update({ price: 12000, name: "قص شعر VIP" }).eq("id", add.data!.id).select().single();
check("barber edits name and price", edit.data?.price === 12000 && edit.data?.name === "قص شعر VIP", edit.error);
const old = await barberA.c.from("appointments").select("price, service").eq("id", booked.data!.id).single();
check("existing booking keeps its original name and price", old.data?.price === 10000 && old.data?.service === "قص شعر", old.data);
const moveShop = await barberA.c.from("services").update({ barber_id: crypto.randomUUID() } as never).eq("id", add.data!.id).select().single();
check("a service cannot be moved to another shop", moveShop.data?.barber_id === shop!.id || !!moveShop.error, moveShop.data);

// Hide (pause)
await barberA.c.from("services").update({ is_active: false }).eq("id", beard.data!.id);
const afterHide = await cust.c.rpc("get_shop_services", { p_barber_id: shop!.id });
check("hidden service disappears for customers", !afterHide.data?.some((s) => s.id === beard.data!.id));
const bookHidden = await cust.c.rpc("book_appointment", { p_barber_id: shop!.id, p_service_id: beard.data!.id, p_starts_at: T });
check("hidden service cannot be booked", bookHidden.error?.message.includes("SERVICE_UNAVAILABLE") === true, bookHidden.error);

// Delete (removed from menu, history kept)
const del = await barberA.c.from("services").update({ deleted_at: new Date().toISOString() }).eq("id", add.data!.id).select().single();
check("barber deletes a service", !!del.data?.deleted_at && del.data?.is_active === false, del.error);
const revive = await barberA.c.from("services").update({ deleted_at: null, is_active: true }).eq("id", add.data!.id).select().single();
check("a deleted service stays deleted", !!revive.data?.deleted_at && revive.data?.is_active === false, revive.data);
const barberList = await barberA.c.from("services").select("id").eq("barber_id", shop!.id).is("deleted_at", null);
check("deleted service is gone from the barber's list", !barberList.data?.some((s) => s.id === add.data!.id));
const custList = await cust.c.rpc("get_shop_services", { p_barber_id: shop!.id });
check("deleted service is gone for customers", !custList.data?.some((s) => s.id === add.data!.id));
const hist = await cust.c.rpc("get_my_appointments");
const mine = hist.data?.find((a) => a.id === booked.data!.id);
check("customer's booking is still there after the service was deleted", mine?.service_id === add.data!.id && mine?.service === "قص شعر", mine);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
