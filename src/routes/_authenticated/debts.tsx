import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, HandCoins, Phone, Plus, Search, UserCheck } from "lucide-react";

import { BarberNav, DebtStatusBadge, EmptyState, FilterChips, MobileFrame, PageHeader } from "@/components/app-ui";
import { NewDebtSheet, PaymentSheet } from "@/components/barber-sheets";
import { NoShop } from "@/components/no-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { dayKey, formatDayKey, formatMoney, formatTime } from "@/lib/format";
import { myShopQuery, shopCustomersQuery, shopDebtsQuery, type Debt, type Shop, type ShopCustomer } from "@/lib/halaqi-api";
import { accountsByCustomer, debtStatus, sumPaid, type CustomerAccount } from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/debts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myShopQuery()),
  head: () => ({
    meta: [
      { title: "الديون — حلاقي" },
      { name: "description", content: "ديون الزبائن عند الحلاق: رصيد كل زبون والمتبقي عليه وسجل التسديدات." },
      { property: "og:title", content: "الديون — حلاقي" },
      { property: "og:description", content: "سجّل الديون والتسديدات وتابع المتبقي على كل زبون." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DebtsPage,
});

function DebtsPage() {
  const { data: shop } = useSuspenseQuery(myShopQuery());
  if (!shop) return <NoShop title="الديون" />;
  return <DebtsList shop={shop} />;
}

type Filter = "owing" | "settled" | "all";
type Target = { key: string; customer?: ShopCustomer | undefined; prefill?: { name: string; phone: string | null } | undefined };

function DebtsList({ shop }: { shop: Shop }) {
  const qc = useQueryClient();
  const { data: debts } = useSuspenseQuery(shopDebtsQuery(shop.id));
  const { data: shopCustomers } = useSuspenseQuery(shopCustomersQuery(shop.id));
  const [filter, setFilter] = useState<Filter>("owing");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Keep the list current when a debt or payment is saved on another device.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ["shop-debts", shop.id] });
    const channel = supabase
      .channel(`shop-money-${shop.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts", filter: `barber_id=eq.${shop.id}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments", filter: `barber_id=eq.${shop.id}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop.id, qc]);

  const accounts = accountsByCustomer(debts);
  const outstanding = accounts.reduce((s, a) => s + Math.max(a.remaining, 0), 0);
  const collected = accounts.reduce((s, a) => s + a.paid, 0);
  const owing = accounts.filter((a) => a.remaining > 0);
  const q = search.trim();
  const visible = accounts
    .filter((a) => filter === "all" || (filter === "owing" ? a.remaining > 0 : a.remaining <= 0))
    .filter((a) => !q || a.name.includes(q) || (a.phone ?? "").includes(q));

  const addFor = (a: CustomerAccount<Debt>) => {
    const linked = a.customer_id ? shopCustomers.find((c) => c.customer_id === a.customer_id) : undefined;
    setTarget(linked ? { key: a.key, customer: linked } : { key: a.key, prefill: { name: a.name, phone: a.phone } });
  };

  return (
    <MobileFrame withNav>
      <PageHeader
        title="الديون"
        subtitle="المبالغ بالدينار العراقي"
        backTo="/barber"
        action={
          <Button variant="ink" size="sm" onClick={() => setTarget({ key: "new" })}>
            <Plus /> دين
          </Button>
        }
      />
      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-ink p-4 text-ink-foreground shadow-lift">
            <p className="text-xs text-ink-foreground/70">المتبقي على الزبائن</p>
            <p className="mt-1 text-xl font-bold text-brass">{formatMoney(outstanding)}</p>
            <p className="mt-0.5 text-[11px] text-ink-foreground/70">{owing.length} زبون عليه دين</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">المُحصّل من الديون</p>
            <p className="mt-1 text-xl font-bold text-success">{formatMoney(collected)}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="ابحث عن زبون"
            placeholder="ابحث بالاسم أو الهاتف"
            className="h-11 bg-card ps-9 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "owing", label: "عليهم دين", count: owing.length },
            { value: "settled", label: "مسدّد", count: accounts.length - owing.length },
            { value: "all", label: "الكل", count: accounts.length },
          ]}
        />

        {visible.length === 0 && (
          <EmptyState title="لا يوجد زبائن هنا" hint={debts.length === 0 ? "سجّل أول دين من زر «دين» في الأعلى." : undefined} />
        )}

        <ul className="space-y-2.5 pb-2">
          {visible.map((a) => {
            const open = openKey === a.key;
            return (
              <li key={a.key} className="rounded-2xl border bg-card shadow-card">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : a.key)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-start"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-base font-semibold">
                      {a.name}
                      {a.customer_id && <UserCheck className="size-4 shrink-0 text-success" aria-label="له حساب في التطبيق" />}
                    </p>
                    {a.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        <span dir="ltr">{a.phone}</span>
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.debts.length} دين · دفع {formatMoney(a.paid)} من {formatMoney(a.total)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted-foreground">المتبقي</span>
                    <span className={cn("text-lg font-bold", a.remaining > 0 ? "text-destructive" : "text-success")}>
                      {formatMoney(a.remaining)}
                    </span>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
                  </div>
                </button>

                {open && (
                  <div className="space-y-3 border-t px-4 pb-4 pt-3">
                    <Button variant="outline" size="sm" className="w-full bg-card" onClick={() => addFor(a)}>
                      <Plus /> دين جديد على {a.name}
                    </Button>
                    <ul className="space-y-2.5">
                      {a.debts.map((d) => (
                        <DebtRow key={d.id} debt={d} tz={shop.timezone} onPay={() => setPaying(d)} />
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {target && (
        <NewDebtSheet key={target.key} shop={shop} customer={target.customer} prefill={target.prefill} open onClose={() => setTarget(null)} />
      )}
      <PaymentSheet shop={shop} debt={paying} onClose={() => setPaying(null)} />
      <BarberNav />
    </MobileFrame>
  );
}

function DebtRow({ debt: d, tz, onPay }: { debt: Debt; tz: string; onPay: () => void }) {
  const paid = sumPaid(d.payments);
  const remaining = d.amount - paid;
  const status = debtStatus(d.amount, paid);
  const when = (iso: string) => `${formatDayKey(dayKey(iso, tz), { day: "numeric", month: "short", year: "numeric" })} · ${formatTime(iso, tz)}`;
  const history = [...d.payments].sort((x, y) => y.paid_at.localeCompare(x.paid_at));
  return (
    <li className="rounded-xl bg-muted p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{formatMoney(d.amount)}</p>
          {d.note && <p className="text-sm text-muted-foreground">{d.note}</p>}
          <p className="text-xs text-muted-foreground">{when(d.incurred_at)}</p>
        </div>
        <DebtStatusBadge status={status} />
      </div>
      {history.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2 text-sm">
          {history.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span className="text-muted-foreground">تسديد · {when(p.paid_at)}</span>
              <span className="font-semibold text-success">{formatMoney(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm">
            المتبقي <span className="font-bold text-destructive">{formatMoney(remaining)}</span>
          </span>
          <Button variant="success" size="sm" onClick={onPay}>
            <HandCoins /> تسديد
          </Button>
        </div>
      )}
    </li>
  );
}
