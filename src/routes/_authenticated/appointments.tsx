import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarPlus, Check, Clock, Phone, X } from "lucide-react";

import { AppointmentStatusBadge, BarberNav, EmptyState, FilterChips, MobileFrame, PageHeader } from "@/components/app-ui";
import { NewAppointmentSheet, useSetAppointmentStatus } from "@/components/barber-sheets";
import { NoShop } from "@/components/no-shop";
import { Button } from "@/components/ui/button";
import { dayKey, formatDayKey, formatNumber, formatTime, relativeDayLabel, todayKey } from "@/lib/format";
import { myShopQuery, shopAppointmentsQuery, type AppointmentStatus, type Shop } from "@/lib/halaqi-api";

export const Route = createFileRoute("/_authenticated/appointments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopQuery()),
  head: () => ({
    meta: [
      { title: "قائمة المواعيد — حلاقي" },
      { name: "description", content: "كل مواعيد الصالون مع التاريخ والوقت واسم الزبون وحالة الحجز." },
      { property: "og:title", content: "قائمة المواعيد — حلاقي" },
      { property: "og:description", content: "تابع المواعيد المؤكدة والمكتملة والملغاة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { data: shop } = useSuspenseQuery(myShopQuery());
  if (!shop) return <NoShop title="المواعيد" />;
  return <AppointmentsList shop={shop} />;
}

type Filter = "upcoming" | "all" | AppointmentStatus;

function AppointmentsList({ shop }: { shop: Shop }) {
  const { data: list } = useSuspenseQuery(shopAppointmentsQuery(shop.id));
  const setStatus = useSetAppointmentStatus(shop.id);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [adding, setAdding] = useState(false);
  const tz = shop.timezone;
  const today = todayKey(tz);

  const isUpcoming = (a: (typeof list)[number]) => a.status === "confirmed" && dayKey(a.starts_at, tz) >= today;
  const count = (s: AppointmentStatus) => list.filter((a) => a.status === s).length;

  const groups = useMemo(() => {
    const filtered = list.filter((a) =>
      filter === "all" ? true : filter === "upcoming" ? isUpcoming(a) : a.status === filter,
    );
    if (filter !== "upcoming") filtered.reverse();
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const k = dayKey(a.starts_at, tz);
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, list, tz, today]);

  return (
    <MobileFrame withNav>
      <PageHeader
        title="المواعيد"
        subtitle={`${formatNumber(list.filter(isUpcoming).length)} موعد قادم`}
        backTo="/barber"
        action={
          <Button variant="ink" size="sm" onClick={() => setAdding(true)}>
            <CalendarPlus /> جديد
          </Button>
        }
      />
      <div className="space-y-4 px-4 pt-4">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "upcoming", label: "القادمة", count: list.filter(isUpcoming).length },
            { value: "all", label: "الكل", count: list.length },
            { value: "confirmed", label: "مؤكد", count: count("confirmed") },
            { value: "completed", label: "مكتمل", count: count("completed") },
            { value: "cancelled", label: "ملغي", count: count("cancelled") },
          ]}
        />

        {groups.length === 0 && <EmptyState title="لا توجد مواعيد" hint={filter === "upcoming" ? "ستظهر هنا حجوزات زبائنك فور حجزها." : "جرّب تصنيفاً آخر."} />}

        {groups.map(([day, items]) => (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-bold">{relativeDayLabel(day, tz)}</h2>
              <span className="text-xs text-muted-foreground">{formatDayKey(day, { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <ul className="space-y-2.5">
              {items.map((a) => (
                <li key={a.id} className="rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{a.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{a.service}</p>
                    </div>
                    <AppointmentStatusBadge status={a.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="size-4 text-brass" />
                      {formatTime(a.starts_at, tz)}
                    </span>
                    {a.customer_phone && (
                      <a href={`tel:${a.customer_phone}`} dir="ltr" className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-4" />
                        {a.customer_phone}
                      </a>
                    )}
                    {a.status === "confirmed" && (
                      <span className="ms-auto flex gap-2">
                        <Button size="sm" variant="success" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: "completed" })}>
                          <Check /> تم
                        </Button>
                        <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: a.id, status: "cancelled" })}>
                          <X /> إلغاء
                        </Button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="h-2" />
      </div>
      <NewAppointmentSheet shop={shop} open={adding} onClose={() => setAdding(false)} />
      <BarberNav />
    </MobileFrame>
  );
}
