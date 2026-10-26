import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";

import {
  AppointmentStatusBadge,
  BarberNav,
  DemoNotice,
  EmptyState,
  FilterChips,
  MobileFrame,
  PageHeader,
} from "@/components/app-ui";
import {
  demoAppointments,
  formatDate,
  formatNumber,
  formatTime,
  relativeDayLabel,
  type AppointmentStatus,
} from "@/lib/demo-data";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "قائمة المواعيد — حلاقي" },
      { name: "description", content: "كل مواعيد الصالون مع التاريخ والوقت واسم الزبون وحالة الحجز." },
      { property: "og:title", content: "قائمة المواعيد — حلاقي" },
      { property: "og:description", content: "تابع المواعيد المؤكدة والمنتظرة والمكتملة والملغاة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsPage,
});

type Filter = "all" | AppointmentStatus;

function AppointmentsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const list = demoAppointments;

  const count = (s: AppointmentStatus) => list.filter((a) => a.status === s).length;
  const groups = useMemo(() => {
    const filtered = list
      .filter((a) => filter === "all" || a.status === filter)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) map.set(a.date, [...(map.get(a.date) ?? []), a]);
    return [...map.entries()];
  }, [filter, list]);

  return (
    <MobileFrame withNav>
      <PageHeader title="المواعيد" subtitle={`${formatNumber(list.length)} موعد`} backTo="/barber" />
      <div className="space-y-4 px-4 pt-4">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "الكل", count: list.length },
            { value: "confirmed", label: "مؤكد", count: count("confirmed") },
            { value: "pending", label: "بانتظار", count: count("pending") },
            { value: "completed", label: "مكتمل", count: count("completed") },
            { value: "cancelled", label: "ملغي", count: count("cancelled") },
          ]}
        />
        <DemoNotice>بيانات تجريبية للعرض. الحجوزات الحقيقية تحتاج تفعيل الحفظ لاحقاً.</DemoNotice>

        {groups.length === 0 && <EmptyState title="لا توجد مواعيد" hint="جرّب تصنيفاً آخر." />}

        {groups.map(([date, items]) => (
          <section key={date}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-bold">{relativeDayLabel(date)}</h2>
              <span className="text-xs text-muted-foreground">
                {formatDate(date, { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <ul className="space-y-2.5">
              {items.map((a) => (
                <li key={a.id} className="rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{a.customer}</p>
                      <p className="text-sm text-muted-foreground">{a.service}</p>
                    </div>
                    <AppointmentStatusBadge status={a.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-4 border-t pt-3 text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="size-4 text-brass" />
                      {formatTime(a.time)}
                    </span>
                    <span className="text-muted-foreground">{formatDate(a.date, { weekday: "long" })}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="h-2" />
      </div>
      <BarberNav />
    </MobileFrame>
  );
}
