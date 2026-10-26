import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarCheck, KeyRound, MapPin, Scissors } from "lucide-react";

import { DemoNotice, MobileFrame, PageHeader } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEMO_BARBER,
  DEMO_TODAY,
  SERVICES,
  WORKING_SLOTS,
  addDays,
  demoTakenSlots,
  formatDate,
  formatTime,
  isDemoBarberCode,
  relativeDayLabel,
} from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer")({
  head: () => ({
    meta: [
      { title: "احجز موعدك — حلاقي" },
      { name: "description", content: "أدخل رمز حلاقك، اختر الوقت المتاح، واحجز موعدك في حلاقي." },
      { property: "og:title", content: "احجز موعدك — حلاقي" },
      { property: "og:description", content: "أدخل رمز الحلاق واختر وقتاً متاحاً للحجز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerPage,
});

type Step = "code" | "book" | "done";

function CustomerPage() {
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [date, setDate] = useState(DEMO_TODAY);
  const [time, setTime] = useState("");
  const [service, setService] = useState<string>(SERVICES[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const days = Array.from({ length: 7 }, (_, i) => addDays(DEMO_TODAY, i));
  const taken = demoTakenSlots[date] ?? [];
  const canBook = time && name.trim().length > 1 && phone.replace(/\D/g, "").length >= 10;

  if (step === "code") {
    return (
      <MobileFrame>
        <PageHeader title="أنا زبون" subtitle="الخطوة ١ من ٢" />
        <div className="space-y-6 px-5 pt-8">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-ink text-brass shadow-lift">
            <KeyRound className="size-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">أدخل رمز حلاقك</h2>
            <p className="mt-2 text-muted-foreground">اطلب الرمز من حلاقك لترى أوقاته المتاحة وتحجز.</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (isDemoBarberCode(code)) {
                setCodeError("");
                setStep("book");
              } else {
                setCodeError("الرمز غير صحيح. تأكد منه وحاول مرة أخرى.");
              }
            }}
          >
            <Label htmlFor="code">رمز الحلاق</Label>
            <Input
              id="code"
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="HLQ-0000"
              className="h-16 text-center font-mono text-2xl tracking-[0.3em]"
              aria-invalid={!!codeError}
            />
            {codeError && <p className="text-sm text-destructive">{codeError}</p>}
            <Button type="submit" variant="ink" size="xl" className="w-full" disabled={!code.trim()}>
              متابعة
            </Button>
          </form>
          <DemoNotice>
            للتجربة استخدم الرمز <span dir="ltr" className="font-mono font-bold">{DEMO_BARBER.code}</span>
          </DemoNotice>
        </div>
      </MobileFrame>
    );
  }

  if (step === "done") {
    return (
      <MobileFrame>
        <PageHeader title="ملخص الحجز" />
        <div className="space-y-6 px-5 pt-10 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
            <CalendarCheck className="size-10" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">طلب الحجز جاهز</h2>
            <p className="mt-2 text-muted-foreground">بانتظار تأكيد الحلاق</p>
          </div>
          <div className="space-y-3 rounded-2xl border bg-card p-5 text-right shadow-card">
            <Row label="الحلاق" value={DEMO_BARBER.name} />
            <Row label="الخدمة" value={service} />
            <Row label="اليوم" value={formatDate(date)} />
            <Row label="الوقت" value={formatTime(time)} />
            <Row label="الاسم" value={name} />
          </div>
          <DemoNotice>
            وضع تجريبي: هذا الطلب لم يُرسل إلى الحلاق ولم يُحفظ. الإرسال والإشعارات غير مفعّلة بعد.
          </DemoNotice>
          <Button
            variant="outline"
            size="lg"
            className="w-full bg-card"
            onClick={() => {
              setTime("");
              setStep("book");
            }}
          >
            حجز موعد آخر
          </Button>
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <PageHeader title="احجز موعدك" subtitle="الخطوة ٢ من ٢" />
      <div className="space-y-6 px-4 pb-32 pt-4">
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-ink p-4 text-ink-foreground shadow-lift">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brass text-brass-foreground">
            <Scissors className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{DEMO_BARBER.name}</p>
            <p className="flex items-center gap-1 text-xs text-ink-foreground/70">
              <MapPin className="size-3.5" /> {DEMO_BARBER.area}
            </p>
          </div>
          <button type="button" onClick={() => setStep("code")} className="text-xs text-brass underline underline-offset-4">
            تغيير
          </button>
        </div>

        <section>
          <h2 className="mb-2 text-base font-bold">الخدمة</h2>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setService(s)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm",
                  service === s ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">اليوم</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDate(d);
                  setTime("");
                }}
                className={cn(
                  "flex w-20 shrink-0 flex-col items-center rounded-2xl border px-2 py-3 transition",
                  date === d ? "border-primary bg-primary text-primary-foreground shadow-lift" : "bg-card",
                )}
              >
                <span className="text-xs opacity-80">{d === DEMO_TODAY ? "اليوم" : formatDate(d, { weekday: "short" })}</span>
                <span className="mt-1 text-2xl font-bold">{formatDate(d, { day: "numeric" })}</span>
                <span className="text-[11px] opacity-80">{formatDate(d, { month: "short" })}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-bold">الأوقات المتاحة</h2>
            <span className="text-xs text-muted-foreground">{relativeDayLabel(date)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {WORKING_SLOTS.map((t) => {
              const isTaken = taken.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isTaken}
                  onClick={() => setTime(t)}
                  className={cn(
                    "rounded-xl border py-3 text-sm font-medium transition",
                    isTaken && "cursor-not-allowed border-dashed bg-muted text-muted-foreground line-through",
                    !isTaken && time === t && "border-brass bg-accent text-accent-foreground ring-2 ring-brass",
                    !isTaken && time !== t && "bg-card",
                  )}
                >
                  {formatTime(t)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">الأوقات المشطوبة محجوزة (بيانات تجريبية).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">بياناتك</h2>
          <div className="space-y-2">
            <Label htmlFor="c-name">الاسم</Label>
            <Input id="c-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-phone">رقم الهاتف</Label>
            <Input
              id="c-phone"
              dir="ltr"
              inputMode="tel"
              className="h-12 text-right text-base"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXXX"
            />
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pt-3 backdrop-blur pb-safe">
        <div className="mx-auto max-w-md">
          <Button variant="brass" size="xl" className="w-full" disabled={!canBook} onClick={() => setStep("done")}>
            {time ? `احجز ${formatTime(time)} — ${relativeDayLabel(date)}` : "اختر وقتاً للحجز"}
          </Button>
        </div>
      </div>
    </MobileFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
