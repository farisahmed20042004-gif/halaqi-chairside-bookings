import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, HandCoins, Plus } from "lucide-react";

import { BarberNav, DebtStatusBadge, EmptyState, FilterChips, MobileFrame, PageHeader } from "@/components/app-ui";
import { NewDebtSheet, PaymentSheet } from "@/components/barber-sheets";
import { NoShop } from "@/components/no-shop";
import { Button } from "@/components/ui/button";
import { dayKey, formatDayKey, formatMoney, formatTime } from "@/lib/format";
import { myShopQuery, shopDebtsQuery, type Debt, type Shop } from "@/lib/halaqi-api";
import { debtStatus, sumPaid, type DebtStatus } from "@/lib/rules";

export const Route = createFileRoute("/_authenticated/debts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopQuery()),
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

function DebtsPage() {
  const { data: shop } = useSuspenseQuery(myShopQuery());
  if (!shop) return <NoShop title="سجل الديون" />;
  return <DebtsList shop={shop} />;
}

type Filter = "all" | DebtStatus;

function DebtsList({ shop }: { shop: Shop }) {
  const { data: debts } = useSuspenseQuery(shopDebtsQuery(shop.id));
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Debt | null>(null);
  const tz = shop.timezone;

  const statusOf = (d: Debt) => debtStatus(d.amount, sumPaid(d.payments));
  const outstanding = debts.reduce((s, d) => s + Math.max(d.amount - sumPaid(d.payments), 0), 0);
  const collected = debts.reduce((s, d) => s + sumPaid(d.payments), 0);
  const count = (s: DebtStatus) => debts.filter((d) => statusOf(d) === s).length;
  const visible = debts.filter((d) => filter === "all" || statusOf(d) === filter);
  const when = (iso: string) => `${formatDayKey(dayKey(iso, tz), { day: "numeric", month: "long", year: "numeric" })} · ${formatTime(iso, tz)}`;

  return (
    <MobileFrame withNav>
      <PageHeader
        title="سجل الديون"
        subtitle="المبالغ بالدينار العراقي"
        backTo="/barber"
        action={
          <Button variant="ink" size="sm" onClick={() => setAdding(true)}>
            <Plus /> دين
          </Button>
        }
      />
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

        {visible.length === 0 && <EmptyState title="لا توجد سجلات" hint={debts.length === 0 ? "سجّل أول دين من زر «دين» في الأعلى." : undefined} />}

        <ul className="space-y-2.5 pb-2">
          {visible.map((d) => {
            const paid = sumPaid(d.payments);
            const remaining = d.amount - paid;
            const status = statusOf(d);
            const history = [...d.payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
            return (
              <li key={d.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{d.customer_name}</p>
                    {d.note && <p className="text-sm text-muted-foreground">{d.note}</p>}
                  </div>
                  <DebtStatusBadge status={status} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
                  <Figure label="المبلغ" value={formatMoney(d.amount)} />
                  <Figure label="المدفوع" value={formatMoney(paid)} tone="success" />
                  <Figure label="المتبقي" value={formatMoney(remaining)} tone={remaining > 0 ? "danger" : undefined} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDayKey(dayKey(d.created_at, tz), { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {formatTime(d.created_at, tz)}
                    </span>
                  </div>
                  {status !== "paid" && (
                    <Button variant="success" size="sm" onClick={() => setPaying(d)}>
                      <HandCoins /> دفعة
                    </Button>
                  )}
                </div>

                {history.length > 0 && (
                  <details className="mt-3 border-t pt-2 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">الدفعات ({history.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {history.map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span className="text-muted-foreground">{when(p.paid_at)}</span>
                          <span className="font-semibold text-success">{formatMoney(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <NewDebtSheet shop={shop} open={adding} onClose={() => setAdding(false)} />
      <PaymentSheet shop={shop} debt={paying} onClose={() => setPaying(null)} />
      <BarberNav />
    </MobileFrame>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={tone === "success" ? "text-sm font-bold text-success" : tone === "danger" ? "text-sm font-bold text-destructive" : "text-sm font-bold"}>
        {value}
      </p>
    </div>
  );
}
