import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Fns = Database["public"]["Functions"];

export type Shop = Tables["barbers"]["Row"];
export type Appointment = Tables["appointments"]["Row"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type Payment = Pick<Tables["payments"]["Row"], "id" | "amount" | "paid_at">;
export type Debt = Tables["debts"]["Row"] & { payments: Payment[] };
export type PublicBarber = Fns["find_barber_by_code"]["Returns"][number];
export type Slot = Fns["get_available_slots"]["Returns"][number];
export type MyAppointment = Fns["get_my_appointments"]["Returns"][number];

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("NOT_AUTHENTICATED");
  return data.user.id;
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
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Debt[];
    },
  });

export const barberByCodeQuery = (code: string) =>
  queryOptions({
    queryKey: ["barber-by-code", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_barber_by_code", { p_code: code });
      if (error) throw error;
      return data[0] ?? null;
    },
  });

export const slotsQuery = (barberId: string, day: string) =>
  queryOptions({
    queryKey: ["slots", barberId, day],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_slots", { p_barber_id: barberId, p_day: day });
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

export async function bookAppointment(args: {
  barberId: string;
  startsAt: string;
  service: string;
  name: string;
  phone?: string | undefined;
}) {
  const { data, error } = await supabase.rpc("book_appointment", {
    p_barber_id: args.barberId,
    p_starts_at: args.startsAt,
    p_service: args.service,
    p_customer_name: args.name,
    ...(args.phone ? { p_customer_phone: args.phone } : {}),
  });
  if (error) throw error;
  return data;
}
