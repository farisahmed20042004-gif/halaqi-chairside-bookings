import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus, Check, ChevronLeft, Copy, HandCoins, LogOut, Settings, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { AppointmentStatusBadge, BarberNav, BottomSheet, DebtStatusBadge, EmptyState, MobileFrame } from "@/components/app-ui";
import { NewAppointmentSheet, NewDebtSheet, useSetAppointmentStatus } from "@/components/barber-sheets";
import { ServicesManager } from "@/components/services-manager";
import { ShopForm } from "@/components/shop-form";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-session";
import { dayKey, formatDayKey, formatMoney, formatNumber, formatTime, todayKey } from "@/lib/format";
import { myShopQuery, profileQuery, shopAppointmentsQuery, shopDebtsQuery, type Shop } from "@/lib/halaqi-api";
import { debtStatus, sumPaid } from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/barber")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(myShopQuery()), context.queryClient.ensureQueryData(profileQuery())]),
  head: () => ({
    meta: [
      { title: "لوحة الحلاق — حلاقي" },
      { name: "description", content: "لوحة الحلاق في حلاقي: مواعيد اليوم والزبائن والديون والدفعات." },
      { property: "og:title", content: "لوحة الحلاق — حلاقي" },
      { property: "og:description", content: "تابع مواعيد اليوم وديون الزبائن والدفعات من هاتفك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BarberPage,
});

function BarberPage() {
  const { data: shop } = useSuspenseQuery(myShopQuery());
  const { data: profile } = useSuspenseQuery(profileQuery());
  const signOut = useSignOut();

  if (!shop) {
    return (
      <MobileFrame>
        <section className="bg-gradient-ink px-5 pb-10 pt-8 text-ink-foreground">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-display text-2xl font-bold text-brass">
              حلاقي
            </Link>
            <button type="button" onClick={signOut} className="flex items-center gap-1 text-sm text-ink-foreground/70">
              <LogOut className="size-4" /> خروج
            </button>
          </div>
          <h1 className="mt-6 text-3xl font-bold">جهّز صالونك</h1>
          <p className="mt-2 text-ink-foreground/75">بعد الحفظ ستحصل على رمز خاص تشاركه مع زبائنك ليحجزوا عندك.</p>
        </section>
        <div className="-mt-5 rounded-t-3xl bg-background px-4 pb-10 pt-6">
          <ShopForm defaultBarberName={profile?.full_name ?? ""} submitLabel="حفظ وإنشاء الرمز" onSaved={() => toast.success("تم إنشاء صالونك")} />
        </div>
      </MobileFrame>
    );
  }
  return <Dashboard shop={shop} />;
}

function Dashboard({ shop }: { shop: Shop }) {
  const { data: appointments } = useSuspenseQuery(shopAppointmentsQuery(shop.id));
  const { data: debts } = useSuspenseQuery(shopDebtsQuery(shop.id));
  const setStatus = useSetAppointmentStatus(shop.id);
  const signOut = useSignOut();
  const [sheet, setSheet] = useState<null | "appointment" | "debt" | "settings">(null);

  const tz = shop.timezone;
  const today = todayKey(tz);
  const todays = appointments.filter((a) => dayKey(a.starts_at, tz) === today);
  const remainingToday = todays.filter((a) => a.status === "confirmed").length;
  const outstanding = debts.reduce((s, d) => s + Math.max(d.amount - sumPaid(d.payments), 0), 0);
  const paidToday = debts.flatMap((d) => d.payments).filter((p) => dayKey(p.paid_at, tz) === today).reduce((s, p) => s + p.amount, 0);
  const openDebts = debts.filter((d) => sumPaid(d.payments) < d.amount).slice(0, 3);

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/customer?code=${shop.code}` : "";
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("تعذّر النسخ. انسخ الرمز يدوياً.");
    }
  };

  return (
    <MobileFrame withNav>
      <section className="bg-gradient-ink px-5 pb-8 pt-6 text-ink-foreground">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-brass">
            حلاقي
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="إعدادات الصالون" onClick={() => setSheet("settings")} className="flex size-9 items-center justify-center rounded-full bg-ink-foreground/10">
              <Settings className="size-4" />
            </button>
            <button type="button" aria-label="تسجيل الخروج" onClick={signOut} className="flex size-9 items-center justify-center rounded-full bg-ink-foreground/10">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <p className="mt-5 text-xs text-ink-foreground/70">{formatDayKey(today)}</p>
        <h1 className="text-2xl font-bold">{shop.barber_name}</h1>
        <p className="text-sm text-ink-foreground/70">{shop.shop_name}</p>

        <div className="mt-5 rounded-2xl border border-brass/40 bg-ink-foreground/5 px-4 py-3">
          <p className="text-xs text-ink-foreground/70">رمز الحلاق — شاركه مع زبائنك</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p dir="ltr" className="font-mono text-xl font-bold tracking-widest text-brass">
              {shop.code}
            </p>
            <div className="flex gap-2">
              <Button variant="brass" size="sm" onClick={() => copy(shop.code, "تم نسخ الرمز")}>
                <Copy /> نسخ
              </Button>
              <Button variant="brass" size="sm" onClick={() => copy(shareLink, "تم نسخ رابط الحجز")}>
                <Share2 /> رابط
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="-mt-4 space-y-6 rounded-t-3xl bg-background px-4 pt-5">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="مواعيد اليوم" value={formatNumber(todays.length)} hint={`${formatNumber(remainingToday)} متبقية`} />
          <Stat label="ديون مستحقة" value={formatMoney(outstanding)} tone="danger" />
          <Stat label="مدفوع اليوم" value={formatMoney(paidToday)} tone="success" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="ink" size="lg" onClick={() => setSheet("appointment")}>
            <CalendarPlus /> موعد جديد
          </Button>
          <Button variant="outline" size="lg" className="bg-card" onClick={() => setSheet("debt")}>
            <HandCoins /> تسجيل دين
          </Button>
        </div>

        <section>
          <SectionHead title="خدماتي" to="/services" linkLabel="فتح الصفحة" />
          <ServicesManager shop={shop} />
        </section>

        <section>
          <SectionHead title="مواعيد اليوم" to="/appointments" />
          {todays.length === 0 ? (
            <EmptyState title="لا مواعيد اليوم" hint="شارك رمزك مع زبائنك ليحجزوا." />
          ) : (
            <ul className="space-y-2.5">
              {todays.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
                  <div className="flex w-20 shrink-0 items-center justify-center rounded-xl bg-muted py-3 text-sm font-bold">
                    {formatTime(a.starts_at, tz)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.service}
                      {a.customer_id ? " · حجز من التطبيق" : ""}
                    </p>
                    <div className="mt-1.5">
                      <AppointmentStatusBadge status={a.status} />
                    </div>
                  </div>
                  {a.status === "confirmed" && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        aria-label="تم"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: a.id, status: "completed" })}
                        className="flex size-9 items-center justify-center rounded-full bg-success/15 text-success active:scale-95"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="إلغاء"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: a.id, status: "cancelled" })}
                        className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-95"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pb-4">
          <SectionHead title="ديون مفتوحة" to="/debts" />
          {openDebts.length === 0 ? (
            <EmptyState title="لا ديون مفتوحة" />
          ) : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
              {openDebts.map((d) => {
                const paid = sumPaid(d.payments);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{d.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDayKey(dayKey(d.created_at, tz), { day: "numeric", month: "short" })} · {formatTime(d.created_at, tz)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-destructive">{formatMoney(d.amount - paid)}</span>
                      <DebtStatusBadge status={debtStatus(d.amount, paid)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <NewAppointmentSheet shop={shop} open={sheet === "appointment"} onClose={() => setSheet(null)} />
      <NewDebtSheet shop={shop} open={sheet === "debt"} onClose={() => setSheet(null)} />
      <BottomSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="إعدادات الصالون" footer={null}>
        <ShopForm
          shop={shop}
          submitLabel="حفظ التغييرات"
          onSaved={() => {
            toast.success("حُفظت الإعدادات");
            setSheet(null);
          }}
        />
      </BottomSheet>
      <BarberNav />
    </MobileFrame>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-card">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-base font-bold leading-tight", tone === "danger" && "text-destructive", tone === "success" && "text-success")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionHead({
  title,
  to,
  linkLabel = "عرض الكل",
}: {
  title: string;
  to: "/appointments" | "/debts" | "/services";
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold">{title}</h2>
      <Link to={to} className="flex items-center text-sm font-medium text-accent-foreground">
        {linkLabel} <ChevronLeft className="size-4" />
      </Link>
    </div>
  );
}
