import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Clock, HandCoins } from "lucide-react";
import { toast } from "sonner";

import {
  BarberNav,
  DebtStatusBadge,
  DemoNotice,
  EmptyState,
  FilterChips,
  MobileFrame,
  PageHeader,
} from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { debtStatus, demoDebts, formatDate, formatMoney, formatTime, type Debt, type DebtStatus } from "@/lib/demo-data";

export const Route = createFileRoute("/debts")({
  head: () => ({
    meta: [
      { title: "سجل الديون — حلاقي" },
      { name: "description", content: "سجل ديون الزبائن: المبلغ وحالة الدفع والتاريخ والوقت." },
      { property: "og:title", content: "سجل الديون — حلاقي" },
      { property: "og:description", content: "تابع ما لك عند زبائنك وما دفعوه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DebtsPage,
});

type Filter = "all" | DebtStatus;

function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>(demoDebts);
  const [filter, setFilter] = useState<Filter>("all");

  const outstanding = debts.reduce((s, d) => s + Math.max(d.amount - d.paid, 0), 0);
  const collected = debts.reduce((s, d) => s + d.paid, 0);
  const count = (s: DebtStatus) => debts.filter((d) => debtStatus(d) === s).length;
  const visible = debts.filter((d) => filter === "all" || debtStatus(d) === filter);

  const settle = (id: string) => {
    setDebts((l) => l.map((d) => (d.id === id ? { ...d, paid: d.amount } : d)));
    toast.success("سُجّلت الدفعة (تجريبي — غير محفوظ)");
  };

  return (
    <MobileFrame withNav>
      <PageHeader title="سجل الديون" subtitle="المبالغ بالدينار العراقي" backTo="/barber" />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-ink p-4 text-ink-foreground shadow-lift">
            <p className="text-xs text-ink-foreground/70">المتبقي على الزبائن</p>
            <p className="mt-1 text-xl font-bold text-brass">{formatMoney(outstanding)}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">المُحصّل</p>
            <p className="mt-1 text-xl font-bold text-success">{formatMoney(collected)}</p>
          </div>
        </div>

        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "الكل", count: debts.length },
            { value: "unpaid", label: "غير مدفوع", count: count("unpaid") },
            { value: "partial", label: "جزئي", count: count("partial") },
            { value: "paid", label: "مدفوع", count: count("paid") },
          ]}
        />
        <DemoNotice />

        {visible.length === 0 && <EmptyState title="لا توجد سجلات" />}

        <ul className="space-y-2.5 pb-2">
          {visible.map((d) => {
            const status = debtStatus(d);
            const remaining = d.amount - d.paid;
            return (
              <li key={d.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{d.customer}</p>
                    {d.note && <p className="text-sm text-muted-foreground">{d.note}</p>}
                  </div>
                  <DebtStatusBadge status={status} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
                  <Figure label="المبلغ" value={formatMoney(d.amount)} />
                  <Figure label="المدفوع" value={formatMoney(d.paid)} tone="success" />
                  <Figure label="المتبقي" value={formatMoney(remaining)} tone={remaining > 0 ? "danger" : undefined} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(d.date, { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {formatTime(d.time)}
                    </span>
                  </div>
                  {status !== "paid" && (
                    <Button variant="success" size="sm" onClick={() => settle(d.id)}>
                      <HandCoins /> تسديد
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <BarberNav />
    </MobileFrame>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={
          tone === "success" ? "text-sm font-bold text-success" : tone === "danger" ? "text-sm font-bold text-destructive" : "text-sm font-bold"
        }
      >
        {value}
      </p>
    </div>
  );
}
