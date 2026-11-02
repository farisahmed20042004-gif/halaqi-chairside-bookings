import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, KeyRound, Loader2, MapPin, Plus, Scissors } from "lucide-react";
import { toast } from "sonner";

import { CustomerNav, EmptyState, LoadingScreen, MobileFrame, NotificationsBell, PageHeader } from "@/components/app-ui";
import { DayPicker, ServicePicker, SlotGrid } from "@/components/barber-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayKey, formatDayKey, formatMoney, formatTime, relativeDayLabel, todayKey } from "@/lib/format";
import {
  bookAppointment,
  myBarbersQuery,
  profileQuery,
  publicServicesQuery,
  requireRole,
  saveMyBarber,
  type BookableShop,
  type SavedBarber,
} from "@/lib/halaqi-api";
import { arabicError, normalizeCode } from "@/lib/rules";
import { addSavedCode, readSavedCode, readSavedCodes, removeSavedCode } from "@/lib/saved-barber";

type CustomerSearch = { code?: string; shop?: string; add?: boolean };

export const Route = createFileRoute("/_authenticated/customer")({
  validateSearch: (s: Record<string, unknown>): CustomerSearch => {
    const out: CustomerSearch = {};
    if (typeof s["code"] === "string" && s["code"].trim()) out.code = normalizeCode(s["code"]);
    if (typeof s["shop"] === "string" && s["shop"]) out.shop = s["shop"];
    if (s["add"] === true || s["add"] === "true" || s["add"] === "1") out.add = true;
    return out;
  },
  beforeLoad: ({ context }) => requireRole(context.queryClient, "customer"),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(profileQuery()), context.queryClient.ensureQueryData(myBarbersQuery())]),
  head: () => ({
    meta: [
      { title: "احجز موعدك — حلاقي" },
      { name: "description", content: "حلاقوك المحفوظون في حلاقي: اختر الحلاق والخدمة والوقت المتاح واحجز موعدك." },
      { property: "og:title", content: "احجز موعدك — حلاقي" },
      { property: "og:description", content: "اختر حلاقك والخدمة والوقت المتاح واحجز مباشرة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerPage,
});

/** Adds a barber to the cached list without touching the others. */
function appendBarber(qc: QueryClient, b: SavedBarber) {
  qc.setQueryData(myBarbersQuery().queryKey, (old: SavedBarber[] | undefined = []) =>
    old.some((x) => x.id === b.id) ? old : [...old, b],
  );
}

function CustomerPage() {
  const { code, shop, add } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: barbers } = useSuspenseQuery(myBarbersQuery());
  const [restoring, setRestoring] = useState(true);
  const deviceRestored = useRef(false);
  const handledCode = useRef<string | null>(null);

  // Keep the phone's list in step with the database (append only).
  useEffect(() => {
    for (const b of barbers) addSavedCode(user.id, b.code, b.shop_name);
  }, [barbers, user.id]);

  // Once per visit: put back codes saved on this phone that the database is missing.
  useEffect(() => {
    if (deviceRestored.current) return;
    deviceRestored.current = true;
    const known = new Set(barbers.map((b) => b.code));
    const missing = readSavedCodes(user.id).filter((c) => !known.has(c));
    (async () => {
      for (const c of missing) {
        try {
          appendBarber(qc, await saveMyBarber(c));
        } catch {
          removeSavedCode(user.id, c);
        }
      }
      setRestoring(false);
    })();
  }, [barbers, user.id, qc]);

  // A shared link (?code=…) adds that barber to the list and opens it.
  useEffect(() => {
    if (!code || handledCode.current === code) return;
    handledCode.current = code;
    const existing = barbers.find((b) => b.code === code);
    if (existing) {
      navigate({ to: "/customer", search: { shop: existing.id }, replace: true });
      return;
    }
    saveMyBarber(code)
      .then((b) => {
        appendBarber(qc, b);
        addSavedCode(user.id, b.code, b.shop_name);
        toast.success(`أُضيف إلى حلاقيك: ${b.shop_name}`);
        navigate({ to: "/customer", search: { shop: b.id }, replace: true });
      })
      .catch((e) => {
        toast.error(arabicError(e));
        navigate({ to: "/customer", search: {}, replace: true });
      });
  }, [code, barbers, user.id, qc, navigate]);

  if (code || (restoring && barbers.length === 0)) {
    return (
      <MobileFrame>
        <LoadingScreen label="جارٍ فتح صفحة حلاقك…" />
      </MobileFrame>
    );
  }
  if (add || barbers.length === 0) return <CodeEntry canCancel={barbers.length > 0} />;
  const selected = barbers.find((b) => b.id === shop) ?? (barbers.length === 1 ? barbers[0] : undefined);
  if (selected) return <BookingForm barber={selected} savedCount={barbers.length} />;
  return <BarberList barbers={barbers} />;
}

function CustomerHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <PageHeader title={title} subtitle={subtitle} backTo={null} action={<NotificationsBell />} />;
}

function CodeEntry({ canCancel }: { canCancel: boolean }) {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const save = useMutation({
    mutationFn: () => saveMyBarber(normalizeCode(code)),
    onSuccess: (b) => {
      const already = (qc.getQueryData(myBarbersQuery().queryKey) ?? []).some((x) => x.id === b.id);
      addSavedCode(user.id, b.code, b.shop_name);
      appendBarber(qc, b);
      toast.success(already ? `${b.shop_name} محفوظ لديك مسبقاً` : `أُضيف إلى حلاقيك: ${b.shop_name}`);
      navigate({ to: "/customer", search: { shop: b.id } });
    },
    onError: (e) => toast.error(arabicError(e)),
  });
  return (
    <MobileFrame withNav>
      <CustomerHeader title={canCancel ? "إضافة حلاق جديد" : "حلاقي"} />
      <div className="space-y-6 px-5 pt-8">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-ink text-brass shadow-lift">
          <KeyRound className="size-8" />
        </div>
        <div>
          <h2 className="text-3xl font-bold">أدخل رمز الحلاق</h2>
          <p className="mt-2 text-muted-foreground">
            {canCancel
              ? "سيُضاف إلى قائمة حلاقيك، ويبقى حلاقوك السابقون محفوظين."
              : "تدخله مرة واحدة فقط. بعدها تفتح صفحة حلاقك مباشرة كلما فتحت التطبيق."}
          </p>
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
            {canCancel ? "إضافة" : "متابعة"}
          </Button>
          {canCancel && (
            <Button asChild variant="outline" size="lg" className="w-full bg-card">
              <Link to="/customer" search={{}}>
                رجوع إلى حلاقيني
              </Link>
            </Button>
          )}
        </form>
      </div>
      <CustomerNav />
    </MobileFrame>
  );
}

/** The customer's saved barbers; tap one to book. */
function BarberList({ barbers }: { barbers: SavedBarber[] }) {
  return (
    <MobileFrame withNav>
      <CustomerHeader title="حلاقيني" subtitle={`${barbers.length.toLocaleString("ar-IQ")} حلاقين محفوظين`} />
      <div className="space-y-3 px-4 pb-8 pt-4">
        <p className="text-sm text-muted-foreground">اختر الحلاق الذي تريد الحجز عنده.</p>
        <ul className="space-y-3">
          {barbers.map((b) => (
            <li key={b.id}>
              <Link
                to="/customer"
                search={{ shop: b.id }}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card transition-colors active:bg-accent/40"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-ink text-brass">
                  <Scissors className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{b.shop_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{b.barber_name}</p>
                  {(b.area || b.address) && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" /> {[b.area, b.address].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <ChevronLeft className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild variant="brass" size="xl" className="w-full">
          <Link to="/customer" search={{ add: true }}>
            إضافة حلاق جديد <Plus />
          </Link>
        </Button>
      </div>
      <CustomerNav />
    </MobileFrame>
  );
}

function BookingForm({ barber, savedCount }: { barber: BookableShop; savedCount: number }) {
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
