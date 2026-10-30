import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Fns = Database["public"]["Functions"];

export type Role = Database["public"]["Enums"]["app_role"];
export type Shop = Tables["barbers"]["Row"];
export type Service = Tables["services"]["Row"];
export type Appointment = Tables["appointments"]["Row"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type Payment = Pick<Tables["payments"]["Row"], "id" | "amount" | "paid_at">;
export type Debt = Tables["debts"]["Row"] & { payments: Payment[] };
export type ShopCustomer = Tables["shop_customers"]["Row"];
export type PublicBarber = Fns["find_barber_by_code"]["Returns"][number];
export type PublicService = Fns["get_shop_services"]["Returns"][number];
export type Slot = Fns["get_available_slots"]["Returns"][number];
export type MyAppointment = Fns["get_my_appointments"]["Returns"][number];
export type MyShop = Fns["get_my_shops"]["Returns"][number];
export type PublicShop = Fns["get_public_shop"]["Returns"][number];
export type ShopService = { id: string; name: string; price: number; duration_minutes: number };
export type SearchShop = Omit<Fns["search_public_shops"]["Returns"][number], "services"> & { services: ShopService[] };
/** The public scheduling details any booking screen needs. */
export type BookableShop = Pick<
  PublicShop,
  "id" | "shop_name" | "barber_name" | "area" | "address" | "timezone" | "open_time" | "close_time" | "slot_minutes" | "days_off"
>;
export type Notification = Tables["notifications"]["Row"];

/** Statuses that still hold a time slot. */
export const isActiveStatus = (s: AppointmentStatus) => s === "pending" || s === "confirmed";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("NOT_AUTHENTICATED");
  return data.user.id;
}

export const myRoleQuery = () =>
  queryOptions({
    queryKey: ["my-role"],
    queryFn: async (): Promise<Role> => {
      const id = await currentUserId();
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle();
      if (error) throw error;
      return data?.role ?? "customer";
    },
    staleTime: Infinity,
  });

/** Route guard: send the account to its own area when it opens the other role's page. */
export async function requireRole(queryClient: QueryClient, role: Role) {
  const actual = await queryClient.ensureQueryData(myRoleQuery());
  if (actual !== role) throw redirect({ to: actual === "barber" ? "/barber" : "/customer", replace: true });
}

export const profileQuery = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => {
      const id = await currentUserId();
      const { data, error } = await supabase.from("profiles").select("full_name, phone").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const myShopQuery = () =>
  queryOptions({
    queryKey: ["my-shop"],
    queryFn: async () => {
      const id = await currentUserId();
      const { data, error } = await supabase.from("barbers").select("*").eq("owner_id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const shopServicesQuery = (shopId: string) =>
  queryOptions({
    queryKey: ["shop-services", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", shopId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const shopAppointmentsQuery = (shopId: string) =>
  queryOptions({
    queryKey: ["shop-appointments", shopId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barber_id", shopId)
        .gte("starts_at", since)
        .order("starts_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

export const shopDebtsQuery = (shopId: string) =>
  queryOptions({
    queryKey: ["shop-debts", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*, payments(id, amount, paid_at)")
        .eq("barber_id", shopId)
        .order("incurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Debt[];
    },
  });

export const shopCustomersQuery = (shopId: string) =>
  queryOptions({
    queryKey: ["shop-customers", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_customers")
        .select("*")
        .eq("barber_id", shopId)
        .order("display_name")
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

export const clientProfileQuery = (shopId: string, customerId: string) =>
  queryOptions({
    queryKey: ["client-profile", shopId, customerId],
    queryFn: async () => {
      const [c, a, d] = await Promise.all([
        supabase.from("shop_customers").select("*").eq("barber_id", shopId).eq("customer_id", customerId).maybeSingle(),
        supabase
          .from("appointments")
          .select("*")
          .eq("barber_id", shopId)
          .eq("customer_id", customerId)
          .order("starts_at", { ascending: false })
          .limit(100),
        supabase
          .from("debts")
          .select("*, payments(id, amount, paid_at)")
          .eq("barber_id", shopId)
          .eq("customer_id", customerId)
          .order("incurred_at", { ascending: false })
          .limit(200),
      ]);
      if (c.error) throw c.error;
      if (a.error) throw a.error;
      if (d.error) throw d.error;
      return { customer: c.data, appointments: a.data, debts: d.data as Debt[] };
    },
  });

export const searchShopsQuery = (q: string) =>
  queryOptions({
    queryKey: ["search-shops", q],
    queryFn: async (): Promise<SearchShop[]> => {
      const { data, error } = await supabase.rpc("search_public_shops", { p_query: q });
      if (error) throw error;
      return data.map((r) => ({ ...r, services: (r.services as unknown as ShopService[]) ?? [] }));
    },
    staleTime: 30_000,
  });

export const publicShopQuery = (shopId: string) =>
  queryOptions({
    queryKey: ["public-shop", shopId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_shop", { p_barber_id: shopId });
      if (error) throw error;
      return data[0] ?? null;
    },
  });

export const notificationsQuery = () =>
  queryOptions({
    queryKey: ["notifications"],
    queryFn: async () => {
      const id = await currentUserId();
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

export async function cancelMyAppointment(id: string) {
  const { error } = await supabase.rpc("cancel_my_appointment", { p_id: id });
  if (error) throw error;
}

export const barberByCodeQuery = (code: string) =>
  queryOptions({
    queryKey: ["barber-by-code", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_barber_by_code", { p_code: code });
      if (error) throw error;
      return data[0] ?? null;
    },
  });

export const publicServicesQuery = (barberId: string) =>
  queryOptions({
    queryKey: ["public-services", barberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shop_services", { p_barber_id: barberId });
      if (error) throw error;
      return data;
    },
  });

export const slotsQuery = (barberId: string, day: string, serviceId: string, ignoreAppointment?: string) =>
  queryOptions({
    queryKey: ["slots", barberId, day, serviceId, ignoreAppointment ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_barber_id: barberId,
        p_day: day,
        p_service_id: serviceId,
        ...(ignoreAppointment ? { p_ignore_appointment: ignoreAppointment } : {}),
      });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchInterval: 20_000,
  });

export const myAppointmentsQuery = () =>
  queryOptions({
    queryKey: ["my-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_appointments");
      if (error) throw error;
      return data;
    },
  });

export const myShopsQuery = () =>
  queryOptions({
    queryKey: ["my-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_shops");
      if (error) throw error;
      return data;
    },
  });

export const myDebtsQuery = () =>
  queryOptions({
    queryKey: ["my-debts"],
    queryFn: async () => {
      const id = await currentUserId();
      const { data, error } = await supabase
        .from("debts")
        .select("*, payments(id, amount, paid_at)")
        .eq("customer_id", id)
        .order("incurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Debt[];
    },
    refetchInterval: 30_000,
  });

export async function bookAppointment(args: {
  barberId: string;
  serviceId: string;
  startsAt: string;
  name?: string | undefined;
  phone?: string | undefined;
}) {
  const { data, error } = await supabase.rpc("book_appointment", {
    p_barber_id: args.barberId,
    p_service_id: args.serviceId,
    p_starts_at: args.startsAt,
    ...(args.name ? { p_customer_name: args.name } : {}),
    ...(args.phone ? { p_customer_phone: args.phone } : {}),
  });
  if (error) throw error;
  return data;
}

export async function rescheduleAppointment(id: string, startsAt: string) {
  const { data, error } = await supabase.rpc("reschedule_appointment", { p_id: id, p_new_starts_at: startsAt });
  if (error) throw error;
  return data;
}

export async function claimDebt(code: string) {
  const { data, error } = await supabase.rpc("claim_debt", { p_code: code });
  if (error) throw error;
  return data;
}

export async function linkDebtToCustomer(debtId: string, customerId: string) {
  const { error } = await supabase.rpc("link_debt_to_customer", { p_debt_id: debtId, p_customer_id: customerId });
  if (error) throw error;
}
