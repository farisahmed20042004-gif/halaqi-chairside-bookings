import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, Clock, Scissors } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog, CustomerNav, EmptyState, MobileFrame, NotificationsBell, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dayKey, formatDayKey, formatMoney, formatTime } from "@/lib/format";
import { cancelMyAppointment, myBookingsQuery, requireRole, type MyBooking } from "@/lib/halaqi-api";
import { arabicError, canCustomerCancel, customerBookingState, nextConfirmedBooking, type CustomerBookingState } from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-bookings")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, "customer"),
  loader: ({ context }) => context.queryClient.ensureQueryData(myBookingsQuery()),
  head: () => ({
    meta: [
      { title: "مواعيدي — حلاقي" },
      { name: "description", content: "كل حجوزاتك في حلاقي مع حالة كل موعد: بانتظار التأكيد، مؤكد، مرفوض أو مكتمل." },
      { property: "og:title", content: "مواعيدي — حلاقي" },
      { property: "og:description", content: "تابع حالة حجوزاتك عند حلاقك أولاً بأول." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyBookingsPage,
});

const stateStyle: Record<CustomerBookingState, { label: string; className: string }> = {
  pending: { label: "بانتظار التأكيد", className: "bg-warning/25 text-warning-foreground" },
  confirmed: { label: "تم التأكيد", className: "bg-success/15 text-success" },
  rejected: { label: "تم الرفض", className: "bg-destructive/10 text-destructive" },
  completed: { label: "مكتمل", className: "bg-info/15 text-info" },
  cancelled: { label: "ألغيته", className: "bg-muted text-muted-foreground" },
};

function BookingBadge({ state }: { state: CustomerBookingState }) {
  const s = stateStyle[state];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", s.className)}>
      {state === "confirmed" && <Check className="size-3.5" />}
      {s.label}
    </span>
  );
}

function MyBookingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: bookings } = useSuspenseQuery(myBookingsQuery());
  const next = nextConfirmedBooking(bookings);
  const [toCancel, setToCancel] = useState<MyBooking | null>(null);

  // Live updates when the barber confirms, rejects or completes a booking (plus a 30-second refresh).
  useEffect(() => {
    const channel = supabase
      .channel(`my-bookings-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `customer_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-bookings"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, qc]);

  const cancel = useMutation({
    mutationFn: (id: string) => cancelMyAppointment(id),
    onSuccess: () => {
      toast.success("أُلغي الحجز");
      setToCancel(null);
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e) => toast.error(arabicError(e)),
  });

  return (
    <MobileFrame withNav>
      <PageHeader title="مواعيدي" subtitle="تتحدّث الحالة تلقائياً" backTo={null} action={<NotificationsBell />} />
      <div className="space-y-4 px-4 pb-8 pt-4">
        {next && (
          <div className="rounded-3xl bg-success p-5 text-success-foreground shadow-lift">
            <CheckCircle2 className="size-10" />
            <p className="mt-2 text-2xl font-bold leading-snug">
              تم تأكيد موعدك يوم {formatDayKey(dayKey(next.starts_at, next.timezone), { weekday: "long" })} الساعة{" "}
              {formatTime(next.starts_at, next.timezone)}
            </p>
            <p className="mt-1 opacity-90">
              {next.service} · {next.shop_name} · {formatDayKey(dayKey(next.starts_at, next.timezone), { day: "numeric", month: "long" })}
            </p>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="space-y-3">
            <EmptyState title="لا مواعيد بعد" hint="احجز موعدك الأول وسيظهر هنا مع حالته." />
            <Button asChild variant="ink" size="lg" className="w-full">
              <Link to="/customer">احجز موعداً</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {bookings.map((b) => {
              const state = customerBookingState(b);
              return (
                <li key={b.id} className={cn("rounded-2xl border bg-card p-4 shadow-card", (state === "rejected" || state === "cancelled") && "opacity-80")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Scissors className="size-4 text-brass" /> {b.service}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {b.barber_name} — {b.shop_name}
                      </p>
                    </div>
                    <BookingBadge state={state} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>{formatDayKey(dayKey(b.starts_at, b.timezone))}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {formatTime(b.starts_at, b.timezone)}
                    </span>
                    <span className="font-semibold">{formatMoney(Number(b.price ?? 0))}</span>
                  </div>
                  {canCustomerCancel(b) && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setToCancel(b)}>
                      إلغاء الحجز
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title="إلغاء الحجز؟"
        description={
          toCancel
            ? `${toCancel.service} — ${formatDayKey(dayKey(toCancel.starts_at, toCancel.timezone))} الساعة ${formatTime(toCancel.starts_at, toCancel.timezone)}. سيصبح الوقت متاحاً لغيرك وسيُبلَّغ الحلاق.`
            : undefined
        }
        confirmLabel="نعم، ألغِ الحجز"
        pending={cancel.isPending}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id)}
      />
      <CustomerNav />
    </MobileFrame>
  );
}
