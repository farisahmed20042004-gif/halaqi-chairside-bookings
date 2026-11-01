import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, KeyRound, Loader2, MapPin, Scissors } from "lucide-react";
import { toast } from "sonner";

import { CustomerNav, EmptyState, LoadingScreen, MobileFrame, NotificationsBell, PageHeader } from "@/components/app-ui";
import { DayPicker, ServicePicker, SlotGrid } from "@/components/barber-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayKey, formatDayKey, formatMoney, formatTime, relativeDayLabel, todayKey } from "@/lib/format";
import {
  barberByCodeQuery,
  bookAppointment,
  myBarberQuery,
  profileQuery,
  publicServicesQuery,
  requireRole,
  saveMyBarber,
  type PublicBarber,
} from "@/lib/halaqi-api";
import { arabicError, normalizeCode } from "@/lib/rules";
import { clearSavedCode, readSavedCode, writeSavedCode } from "@/lib/saved-barber";

export const Route = createFileRoute("/_authenticated/customer")({
  validateSearch: (s: Record<string, unknown>): { code?: string } =>
    typeof s["code"] === "string" ? { code: normalizeCode(s["code"]) } : {},
  beforeLoad: ({ context }) => requireRole(context.queryClient, "customer"),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(profileQuery()), context.queryClient.ensureQueryData(myBarberQuery())]),
  head: () => ({
    meta: [
      { title: "احجز موعدك — حلاقي" },
      { name: "description", content: "صفحة حلاقك في حلاقي: اختر الخدمة والوقت المتاح واحجز موعدك." },
      { property: "og:title", content: "احجز موعدك — حلاقي" },
      { property: "og:description", content: "اختر الخدمة والوقت المتاح عند حلاقك واحجز مباشرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerPage,
});

function CustomerPage() {
  const { code } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: saved } = useSuspenseQuery(myBarberQuery());
  const [restoring, setRestoring] = useState(true);
  const started = useRef(false);

  // Keep the device copy in sync with the database; restore from the device if the database has none.
  useEffect(() => {
    if (saved) {
      writeSavedCode(user.id, saved.code);
      setRestoring(false);
      return;
    }
    if (started.current) return;
    started.current = true;
    const pending = code ?? readSavedCode(user.id);
    if (!pending) {
      setRestoring(false);
      return;
    }
    saveMyBarber(pending)
      .then((b) => {
        qc.setQueryData(myBarberQuery().queryKey, b);
        writeSavedCode(user.id, b.code);
        if (code) toast.success(`حُفظ حلاقك: ${b.shop_name}`);
      })
      .catch((e) => {
        if (code) toast.error(arabicError(e));
        else clearSavedCode(user.id);
      })
      .finally(() => {
        setRestoring(false);
        if (code) navigate({ to: "/customer", search: {}, replace: true });
      });
  }, [saved, code, user.id, qc, navigate]);

  if (restoring && !saved) {
    return (
      <MobileFrame>
        <LoadingScreen label="جارٍ فتح صفحة حلاقك…" />
      </MobileFrame>
    );
  }
  if (code && saved && code !== saved.code) return <OtherBarber code={code} />;
  if (saved) return <BookingForm barber={saved} />;
  return <CodeEntry />;
}

function CustomerHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <PageHeader title={title} subtitle={subtitle} backTo={null} action={<NotificationsBell />} />;
}

function CodeEntry() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const save = useMutation({
    mutationFn: () => saveMyBarber(normalizeCode(code)),
    onSuccess: (b) => {
      writeSavedCode(user.id, b.code);
      qc.setQueryData(myBarberQuery().queryKey, b);
      toast.success(`حُفظ حلاقك: ${b.shop_name}`);
    },
    onError: (e) => toast.error(arabicError(e)),
  });
  return (
    <MobileFrame withNav>
      <CustomerHeader title="حلاقي" />
      <div className="space-y-6 px-5 pt-8">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-ink text-brass shadow-lift">
          <KeyRound className="size-8" />
        </div>
        <div>
          <h2 className="text-3xl font-bold">أدخل رمز حلاقك</h2>
          <p className="mt-2 text-muted-foreground">تدخله مرة واحدة فقط. بعدها تفتح صفحة حلاقك مباشرة كلما فتحت التطبيق.</p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) save.mutate();
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
            placeholder="HLQ-XXXXXX"
            className="h-16 text-center font-mono text-2xl tracking-[0.2em]"
          />
          <Button type="submit" variant="ink" size="xl" className="w-full" disabled={!code.trim() || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            متابعة
          </Button>
        </form>
      </div>
      <CustomerNav />
    </MobileFrame>
  );
}

/** A shared link to a different barber than the saved one. */
function OtherBarber({ code }: { code: string }) {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: barber, isPending } = useQuery(barberByCodeQuery(code));
  const save = useMutation({
    mutationFn: () => saveMyBarber(code),
    onSuccess: (b) => {
      writeSavedCode(user.id, b.code);
      qc.setQueryData(myBarberQuery().queryKey, b);
      toast.success(`أصبح ${b.shop_name} حلاقك`);
      navigate({ to: "/customer", search: {}, replace: true });
    },
    onError: (e) => toast.error(arabicError(e)),
  });
  if (isPending) {
    return (
      <MobileFrame>
        <LoadingScreen label="جارٍ البحث عن الحلاق…" />
      </MobileFrame>
    );
  }
  if (!barber) {
    return (
      <MobileFrame withNav>
        <CustomerHeader title="حلاقي" />
        <div className="space-y-4 px-5 pt-10">
          <EmptyState title="الرمز غير صحيح" hint="تأكد من الرمز مع حلاقك." />
          <Button asChild variant="outline" size="lg" className="w-full bg-card">
            <Link to="/customer" search={{}} replace>
              العودة إلى حلاقي
            </Link>
          </Button>
        </div>
        <CustomerNav />
      </MobileFrame>
    );
  }
  return (
    <BookingForm
      barber={barber}
      banner={
        <div className="rounded-2xl border border-brass/50 bg-accent/40 p-3 text-sm">
          <p>هذا ليس حلاقك المحفوظ.</p>
          <Button variant="ink" size="sm" className="mt-2" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="animate-spin" />}
            اجعله حلاقي
          </Button>
        </div>
      }
    />
  );
}

function BookingForm({ barber, banner }: { barber: PublicBarber; banner?: React.ReactNode }) {
  const qc = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery());
  const tz = barber.timezone;
  const [day, setDay] = useState(() => todayKey(tz));
  const [startsAt, setStartsAt] = useState("");
  const { data: services = [], isPending: servicesLoading } = useQuery(publicServicesQuery(barber.id));
  const [serviceId, setServiceId] = useState("");
  const selected = services.find((s) => s.id === serviceId);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [done, setDone] = useState<{ startsAt: string; service: string; price: number; status: string } | null>(null);

  const book = useMutation({
    mutationFn: () => bookAppointment({ barberId: barber.id, startsAt, serviceId, name: name.trim(), phone: phone.trim() || undefined }),
    onSuccess: (a) => {
      setDone({ startsAt: a.starts_at, service: a.service, price: Number(a.price ?? 0), status: a.status });
      setStartsAt("");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (e) => {
      toast.error(arabicError(e));
      setStartsAt("");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["slots", barber.id] }),
  });

  const shopLike = { timezone: tz, days_off: barber.days_off };

  if (done) {
    const weekday = formatDayKey(dayKey(done.startsAt, tz), { weekday: "long" });
    const confirmed = done.status === "confirmed";
    return (
      <MobileFrame withNav>
        <CustomerHeader title="تم الحجز" />
        <div className="space-y-5 px-5 pt-8">
          <div className={confirmed ? "rounded-3xl bg-success p-6 text-success-foreground shadow-lift" : "rounded-3xl bg-warning p-6 text-warning-foreground shadow-lift"}>
            {confirmed ? <CheckCircle2 className="size-12" /> : <CalendarCheck className="size-12" />}
            <h2 className="mt-3 text-2xl font-bold leading-snug">
              {confirmed
                ? `تم تأكيد موعدك يوم ${weekday} الساعة ${formatTime(done.startsAt, tz)}`
                : `حجزك بانتظار التأكيد — ${weekday} الساعة ${formatTime(done.startsAt, tz)}`}
            </h2>
            <p className="mt-2 opacity-90">
              {done.service} · {formatMoney(done.price)}
            </p>
            <p className="opacity-90">
              {barber.shop_name} · {formatDayKey(dayKey(done.startsAt, tz))}
            </p>
          </div>
          <Button asChild variant="ink" size="xl" className="w-full">
            <Link to="/my-bookings">عرض مواعيدي</Link>
          </Button>
          <Button variant="outline" size="lg" className="w-full bg-card" onClick={() => setDone(null)}>
            حجز موعد آخر
          </Button>
        </div>
        <CustomerNav />
      </MobileFrame>
    );
  }

  return (
    <MobileFrame withNav>
      <CustomerHeader title="احجز موعدك" />
      <div className="space-y-6 px-4 pb-44 pt-4">
        {banner}
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-ink p-4 text-ink-foreground shadow-lift">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brass text-brass-foreground">
            <Scissors className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{barber.shop_name}</p>
            <p className="text-xs text-ink-foreground/70">{barber.barber_name}</p>
            {(barber.area || barber.address) && (
              <p className="flex items-center gap-1 text-xs text-ink-foreground/70">
                <MapPin className="size-3.5" /> {[barber.area, barber.address].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <section>
          <h2 className="mb-1 text-base font-bold">١. اختر الخدمة</h2>
          <p className="mb-2 text-xs text-muted-foreground">الأسعار بالدينار العراقي، والأوقات تُحسب حسب مدة الخدمة.</p>
          {servicesLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">جارٍ تحميل الخدمات…</p>
          ) : services.length === 0 ? (
            <EmptyState title="لا توجد خدمات للحجز بعد" hint="هذا الحلاق لم يضف خدماته وأسعاره بعد. تواصل معه أو حاول لاحقاً." />
          ) : (
            <ServicePicker
              services={services}
              value={serviceId}
              onChange={(id) => {
                setServiceId(id);
                setStartsAt("");
              }}
            />
          )}
        </section>

        {serviceId && (
          <>
            <section>
              <h2 className="mb-2 text-base font-bold">٢. اختر اليوم</h2>
              <DayPicker
                shop={shopLike}
                days={14}
                value={day}
                onChange={(k) => {
                  setDay(k);
                  setStartsAt("");
                }}
              />
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">٣. الأوقات المتاحة — {relativeDayLabel(day, tz)}</h2>
              <SlotGrid barberId={barber.id} serviceId={serviceId} timezone={tz} day={day} value={startsAt} onChange={setStartsAt} />
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold">بياناتك</h2>
              <div className="space-y-2">
                <Label htmlFor="c-name">الاسم</Label>
                <Input id="c-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-phone">رقم الهاتف (اختياري)</Label>
                <Input id="c-phone" dir="ltr" inputMode="tel" className="h-12 text-right text-base" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
              </div>
            </section>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur" style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-md">
          <Button
            variant="brass"
            size="xl"
            className="w-full"
            disabled={!startsAt || !serviceId || name.trim().length < 2 || book.isPending}
            onClick={() => book.mutate()}
          >
            {book.isPending && <Loader2 className="animate-spin" />}
            {!serviceId
              ? "اختر الخدمة أولاً"
              : startsAt
                ? `احجز ${formatTime(startsAt, tz)} — ${relativeDayLabel(day, tz)}${selected ? ` · ${formatMoney(selected.price)}` : ""}`
                : "اختر وقتاً للحجز"}
          </Button>
        </div>
      </div>
      <CustomerNav />
    </MobileFrame>
  );
}
