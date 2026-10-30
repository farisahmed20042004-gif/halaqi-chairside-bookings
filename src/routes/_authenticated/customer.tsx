import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck, KeyRound, Loader2, LogOut, MapPin, Scissors } from "lucide-react";
import { toast } from "sonner";

import { AppointmentStatusBadge, Chip, EmptyState, MobileFrame, PageHeader } from "@/components/app-ui";
import { DayPicker, ServicePicker, SlotGrid } from "@/components/barber-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignOut } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { dayKey, formatDayKey, formatTime, relativeDayLabel, todayKey } from "@/lib/format";
import {
  barberByCodeQuery,
  bookAppointment,
  myAppointmentsQuery,
  profileQuery,
  publicServicesQuery,
  type PublicBarber,
} from "@/lib/halaqi-api";
import { arabicError, normalizeCode } from "@/lib/rules";

export const Route = createFileRoute("/_authenticated/customer")({
  validateSearch: (s: Record<string, unknown>): { code?: string } =>
    typeof s["code"] === "string" ? { code: normalizeCode(s["code"]) } : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
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

function CustomerPage() {
  const { code } = Route.useSearch();
  return code ? <BarberBooking code={code} /> : <CodeEntry />;
}

function CodeEntry() {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [code, setCode] = useState("");
  return (
    <MobileFrame>
      <PageHeader
        title="أنا زبون"
        action={
          <button type="button" aria-label="تسجيل الخروج" onClick={signOut} className="flex size-10 items-center justify-center rounded-full border bg-card">
            <LogOut className="size-4" />
          </button>
        }
      />
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
            if (code.trim()) navigate({ to: "/customer", search: { code: normalizeCode(code) } });
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
          <Button type="submit" variant="ink" size="xl" className="w-full" disabled={!code.trim()}>
            متابعة
          </Button>
        </form>
        <MyAppointments />
      </div>
    </MobileFrame>
  );
}

function MyAppointments() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery(myAppointmentsQuery());
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_my_appointment", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("أُلغي الموعد");
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e) => toast.error(arabicError(e)),
  });
  return (
    <section className="pb-10">
      <h2 className="mb-3 text-lg font-bold">مواعيدي</h2>
      {isPending ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : !data || data.length === 0 ? (
        <EmptyState title="لا مواعيد بعد" />
      ) : (
        <ul className="space-y-2.5">
          {data.map((a) => (
            <li key={a.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{a.shop_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.service} · {formatDayKey(dayKey(a.starts_at, a.timezone))} · {formatTime(a.starts_at, a.timezone)}
                  </p>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </div>
              {a.status === "confirmed" && new Date(a.starts_at) > new Date() && (
                <Button variant="outline" size="sm" className="mt-3" disabled={cancel.isPending} onClick={() => cancel.mutate(a.id)}>
                  إلغاء الموعد
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BarberBooking({ code }: { code: string }) {
  const { data: barber, isPending } = useQuery(barberByCodeQuery(code));
  if (isPending) {
    return (
      <MobileFrame>
        <PageHeader title="احجز موعدك" backTo="/customer" />
        <p className="py-16 text-center text-muted-foreground">جارٍ البحث عن الحلاق…</p>
      </MobileFrame>
    );
  }
  if (!barber) {
    return (
      <MobileFrame>
        <PageHeader title="احجز موعدك" backTo="/customer" />
        <div className="px-5 pt-10">
          <EmptyState title="الرمز غير صحيح" hint="تأكد من الرمز مع حلاقك وحاول مرة أخرى." />
        </div>
      </MobileFrame>
    );
  }
  return <BookingForm barber={barber} />;
}

function BookingForm({ barber }: { barber: PublicBarber }) {
  const qc = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery());
  const tz = barber.timezone;
  const [day, setDay] = useState(() => todayKey(tz));
  const [startsAt, setStartsAt] = useState("");
  const { data: services = [] } = useQuery(publicServicesQuery(barber.id));
  const [serviceId, setServiceId] = useState("");
  const service = services.find((s) => s.id === serviceId)?.name ?? "";
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [done, setDone] = useState<{ startsAt: string; service: string } | null>(null);

  const book = useMutation({
    mutationFn: () => bookAppointment({ barberId: barber.id, startsAt, serviceId, name: name.trim(), phone: phone.trim() || undefined }),
    onSuccess: () => {
      setDone({ startsAt, service });
      setStartsAt("");
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
    return (
      <MobileFrame>
        <PageHeader title="تم الحجز" backTo="/customer" />
        <div className="space-y-6 px-5 pt-10 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
            <CalendarCheck className="size-10" />
          </div>
          <h2 className="text-3xl font-bold">موعدك مثبّت</h2>
          <div className="space-y-2 rounded-2xl border bg-card p-5 text-right shadow-card">
            <p>{barber.shop_name}</p>
            <p className="text-muted-foreground">{done.service}</p>
            <p className="font-semibold">
              {formatDayKey(dayKey(done.startsAt, tz))} · {formatTime(done.startsAt, tz)}
            </p>
          </div>
          <Button variant="outline" size="lg" className="w-full bg-card" onClick={() => setDone(null)}>
            حجز موعد آخر
          </Button>
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <PageHeader title="احجز موعدك" backTo="/customer" />
      <div className="space-y-6 px-4 pb-32 pt-4">
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-ink p-4 text-ink-foreground shadow-lift">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brass text-brass-foreground">
            <Scissors className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{barber.shop_name}</p>
            <p className="text-xs text-ink-foreground/70">{barber.barber_name}</p>
            {barber.area && (
              <p className="flex items-center gap-1 text-xs text-ink-foreground/70">
                <MapPin className="size-3.5" /> {barber.area}
              </p>
            )}
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-base font-bold">الخدمة</h2>
          <ServicePicker
            services={services}
            value={serviceId}
            onChange={(id) => {
              setServiceId(id);
              setStartsAt("");
            }}
          />
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">اليوم</h2>
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
          <h2 className="mb-2 text-base font-bold">الأوقات المتاحة — {relativeDayLabel(day, tz)}</h2>
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
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pt-3 backdrop-blur pb-safe">
        <div className="mx-auto max-w-md">
          <Button
            variant="brass"
            size="xl"
            className="w-full"
            disabled={!startsAt || !serviceId || name.trim().length < 2 || book.isPending}
            onClick={() => book.mutate()}
          >
            {book.isPending && <Loader2 className="animate-spin" />}
            {startsAt ? `احجز ${formatTime(startsAt, tz)} — ${relativeDayLabel(day, tz)}` : "اختر وقتاً للحجز"}
          </Button>
        </div>
      </div>
    </MobileFrame>
  );
}
