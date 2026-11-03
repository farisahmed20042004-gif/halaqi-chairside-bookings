import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { HandCoins, Receipt, Scissors } from "lucide-react";

import { CustomerNav, EmptyState, MobileFrame, NotificationsBell, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { dayKey, formatDayKey, formatMoney, formatTime } from "@/lib/format";
import { myLedgerQuery, myShopsQuery, requireRole } from "@/lib/halaqi-api";
import { balancesByBarber } from "@/lib/rules";
import { cn } from "@/lib/utils";

const TZ = "Asia/Baghdad";

export const Route = createFileRoute("/_authenticated/my-debts")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, "customer"),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(myLedgerQuery()), context.queryClient.ensureQueryData(myShopsQuery())]),
  head: () => ({
    meta: [
      { title: "ديوني — حلاقي" },
      { name: "description", content: "ديونك وتسديداتك عند كل حلاق مع المجموع والمتبقي عليك." },
      { property: "og:title", content: "ديوني — حلاقي" },
      { property: "og:description", content: "اعرف ما عليك عند كل حلاق وما سدّدته، أولاً بأول." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyDebtsPage,
});

function MyDebtsPage() {
  const { data: ledger } = useSuspenseQuery(myLedgerQuery());
  const { data: shops } = useSuspenseQuery(myShopsQuery());
  const groups = balancesByBarber(ledger);
  const totalRemaining = groups.reduce((s, g) => s + Math.max(g.remaining, 0), 0);
  const when = (iso: string) => `${formatDayKey(dayKey(iso, TZ), { day: "numeric", month: "short", year: "numeric" })} · ${formatTime(iso, TZ)}`;

  return (
    <MobileFrame withNav>
      <PageHeader title="ديوني" subtitle="تتحدّث تلقائياً عند أي تسجيل جديد" backTo={null} action={<NotificationsBell />} />
      <div className="space-y-4 px-4 pb-8 pt-4">
        <div className="rounded-3xl bg-gradient-ink p-5 text-ink-foreground shadow-lift">
          <p className="text-sm text-ink-foreground/75">المتبقي عليك عند كل الحلاقين</p>
          <p className="mt-1 text-3xl font-bold text-brass">{formatMoney(totalRemaining)}</p>
        </div>

        {groups.length === 0 ? (
          <div className="space-y-3">
            <EmptyState title="لا ديون عليك" hint="إذا سجّل حلاقك ديناً عليك سيظهر هنا فوراً مع كل تسديد." />
            <Button asChild variant="outline" size="lg" className="w-full bg-card">
              <Link to="/customer">العودة إلى حلاقي</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => {
              const shop = shops.find((s) => s.id === g.barber_id);
              return (
                <li key={g.barber_id} className="rounded-2xl border bg-card shadow-card">
                  <div className="p-4">
                    <p className="flex items-center gap-1.5 font-display text-lg font-bold">
                      <Scissors className="size-4 text-brass" /> {shop?.shop_name ?? "حلاقك"}
                    </p>
                    {shop && <p className="text-sm text-muted-foreground">{shop.barber_name}</p>}
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
                      <Figure label="المجموع" value={formatMoney(g.total)} />
                      <Figure label="المسدّد" value={formatMoney(g.paid)} className="text-success" />
                      <Figure label="المتبقي" value={formatMoney(g.remaining)} className={g.remaining > 0 ? "text-destructive" : "text-success"} />
                    </div>
                  </div>
                  <ul className="divide-y border-t">
                    {g.entries.map((e) => (
                      <li key={`${e.type}-${e.id}`} className="flex items-center gap-3 px-4 py-3">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full",
                            e.type === "debt" ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success",
                          )}
                        >
                          {e.type === "debt" ? <Receipt className="size-4" /> : <HandCoins className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{e.type === "debt" ? "دين" : "تسديد"}</p>
                          {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
                          <p className="text-[11px] text-muted-foreground">{when(e.created_at)}</p>
                        </div>
                        <span className={cn("shrink-0 font-bold", e.type === "debt" ? "text-destructive" : "text-success")}>
                          {e.type === "debt" ? "+" : "−"}
                          {formatMoney(e.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <CustomerNav />
    </MobileFrame>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold", className)}>{value}</p>
    </div>
  );
}
