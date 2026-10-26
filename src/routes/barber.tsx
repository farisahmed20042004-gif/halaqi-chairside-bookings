import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus, Check, ChevronLeft, Copy, HandCoins, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AppointmentStatusBadge, BarberNav, DebtStatusBadge, DemoNotice, MobileFrame } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DEMO_BARBER,
  DEMO_TODAY,
  SERVICES,
  WORKING_SLOTS,
  debtStatus,
  demoAppointments,
  demoDebts,
  formatDate,
  formatMoney,
  formatNumber,
  formatTime,
  type Appointment,
  type Debt,
} from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/barber")({
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
  component: BarberDashboard,
});

function BarberDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>(demoAppointments);
  const [debts, setDebts] = useState<Debt[]>(demoDebts);
  const [sheet, setSheet] = useState<null | "appointment" | "debt">(null);

  const today = appointments
    .filter((a) => a.date === DEMO_TODAY)
    .sort((a, b) => a.time.localeCompare(b.time));
  const remainingToday = today.filter((a) => a.status === "confirmed" || a.status === "pending").length;
  const outstanding = debts.reduce((s, d) => s + Math.max(d.amount - d.paid, 0), 0);
  const paidToday = debts.filter((d) => d.date === DEMO_TODAY).reduce((s, d) => s + d.paid, 0);
  const openDebts = debts.filter((d) => debtStatus(d) !== "paid").slice(0, 3);

  const setStatus = (id: string, status: Appointment["status"]) =>
    setAppointments((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));

  return (
    <MobileFrame withNav>
      <section className="bg-gradient-ink px-5 pb-8 pt-6 text-ink-foreground">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-brass">
            حلاقي
          </Link>
          <span className="rounded-full bg-ink-foreground/10 px-3 py-1 text-xs">{formatDate(DEMO_TODAY)}</span>
        </div>
        <p className="mt-6 text-sm text-ink-foreground/70">مرحباً،</p>
        <h1 className="text-2xl font-bold">{DEMO_BARBER.barber}</h1>
        <p className="text-sm text-ink-foreground/70">{DEMO_BARBER.name}</p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-brass/40 bg-ink-foreground/5 px-4 py-3">
          <div>
            <p className="text-xs text-ink-foreground/70">رمز الحلاق — شاركه مع زبائنك</p>
            <p dir="ltr" className="mt-0.5 text-right font-mono text-xl font-bold tracking-widest text-brass">
              {DEMO_BARBER.code}
            </p>
          </div>
          <Button
            variant="brass"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(DEMO_BARBER.code).catch(() => {});
              toast.success("تم نسخ الرمز");
            }}
          >
            <Copy /> نسخ
          </Button>
        </div>
      </section>

      <div className="-mt-4 space-y-6 rounded-t-3xl bg-background px-4 pt-5">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="مواعيد اليوم" value={formatNumber(today.length)} hint={`${formatNumber(remainingToday)} متبقية`} />
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

        <DemoNotice />

        <section>
          <SectionHead title="مواعيد اليوم" to="/appointments" />
          <ul className="space-y-2.5">
            {today.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card">
                <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-muted py-2">
                  <span className="text-sm font-bold">{formatTime(a.time).split(" ")[0]}</span>
                  <span className="text-[11px] text-muted-foreground">{formatTime(a.time).split(" ")[1]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.customer}</p>
                  <p className="text-xs text-muted-foreground">{a.service}</p>
                  <div className="mt-1.5">
                    <AppointmentStatusBadge status={a.status} />
                  </div>
                </div>
                {(a.status === "confirmed" || a.status === "pending") && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      aria-label="تم"
                      onClick={() => setStatus(a.id, "completed")}
                      className="flex size-9 items-center justify-center rounded-full bg-success/15 text-success active:scale-95"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="إلغاء"
                      onClick={() => setStatus(a.id, "cancelled")}
                      className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-95"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-4">
          <SectionHead title="ديون مفتوحة" to="/debts" />
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
            {openDebts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.customer}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(d.date, { day: "numeric", month: "short" })} · {formatTime(d.time)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-destructive">{formatMoney(d.amount - d.paid)}</span>
                  <DebtStatusBadge status={debtStatus(d)} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <NewAppointmentSheet
        open={sheet === "appointment"}
        onClose={() => setSheet(null)}
        onSave={(a) => {
          setAppointments((l) => [...l, a]);
          toast.success("أُضيف الموعد (تجريبي — غير محفوظ)");
        }}
      />
      <NewDebtSheet
        open={sheet === "debt"}
        onClose={() => setSheet(null)}
        onSave={(d) => {
          setDebts((l) => [d, ...l]);
          toast.success("سُجّل الدين (تجريبي — غير محفوظ)");
        }}
      />
      <BarberNav />
    </MobileFrame>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-card">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-base font-bold leading-tight",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionHead({ title, to }: { title: string; to: "/appointments" | "/debts" }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold">{title}</h2>
      <Link to={to} className="flex items-center text-sm font-medium text-accent-foreground">
        عرض الكل <ChevronLeft className="size-4" />
      </Link>
    </div>
  );
}

function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" dir="rtl" className="mx-auto max-w-md rounded-t-3xl">
        <SheetHeader className="text-right">
          <SheetTitle className="font-display text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">{children}</div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function NewAppointmentSheet({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (a: Appointment) => void;
}) {
  const [customer, setCustomer] = useState("");
  const [service, setService] = useState<string>(SERVICES[0]);
  const [time, setTime] = useState("");

  const valid = customer.trim().length > 1 && time;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="موعد جديد"
      description="أضف موعداً لزبون حضر أو اتصل هاتفياً."
      footer={
        <Button
          variant="ink"
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            onSave({ id: crypto.randomUUID(), customer: customer.trim(), service, date: DEMO_TODAY, time, status: "confirmed" });
            setCustomer("");
            setTime("");
            onClose();
          }}
        >
          <Plus /> إضافة الموعد
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="appt-name">اسم الزبون</Label>
        <Input id="appt-name" className="h-12 text-base" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="مثال: حسين علي" />
      </div>
      <div className="space-y-2">
        <Label>الخدمة</Label>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setService(s)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm",
                service === s ? "border-primary bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>الوقت (اليوم)</Label>
        <div className="grid grid-cols-4 gap-2">
          {WORKING_SLOTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={cn(
                "rounded-xl border py-2 text-sm",
                time === t ? "border-brass bg-accent font-semibold text-accent-foreground" : "bg-card",
              )}
            >
              {formatTime(t)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">منع تعارض المواعيد غير مفعّل بعد.</p>
      </div>
    </BottomSheet>
  );
}

function NewDebtSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (d: Debt) => void }) {
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");

  const amountNum = Number(amount);
  const paidNum = Number(paid || 0);
  const valid = customer.trim().length > 1 && amountNum > 0 && paidNum >= 0 && paidNum <= amountNum;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="تسجيل دين"
      description="سجّل المبلغ المستحق وما دفعه الزبون الآن."
      footer={
        <Button
          variant="ink"
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            const now = new Date();
            const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            onSave({ id: crypto.randomUUID(), customer: customer.trim(), amount: amountNum, paid: paidNum, date: DEMO_TODAY, time, note: note.trim() || undefined });
            setCustomer("");
            setAmount("");
            setPaid("");
            setNote("");
            onClose();
          }}
        >
          <HandCoins /> حفظ
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="debt-name">اسم الزبون</Label>
        <Input id="debt-name" className="h-12 text-base" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="debt-amount">المبلغ الكلي (د.ع)</Label>
          <Input id="debt-amount" inputMode="numeric" className="h-12 text-base" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="15000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-paid">المدفوع الآن</Label>
          <Input id="debt-paid" inputMode="numeric" className="h-12 text-base" value={paid} onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))} placeholder="0" />
        </div>
      </div>
      {paidNum > amountNum && amountNum > 0 && (
        <p className="text-xs text-destructive">المدفوع لا يمكن أن يتجاوز المبلغ الكلي.</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="debt-note">ملاحظة (اختياري)</Label>
        <Input id="debt-note" className="h-12 text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: قص + ذقن" />
      </div>
    </BottomSheet>
  );
}
