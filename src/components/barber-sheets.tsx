import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HandCoins, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { BottomSheet, Chip } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  SERVICES,
  addDaysKey,
  formatDayKey,
  formatMoney,
  formatTime,
  relativeDayLabel,
  todayKey,
  weekdayOfKey,
} from "@/lib/format";
import { bookAppointment, slotsQuery, type AppointmentStatus, type Debt, type Shop } from "@/lib/halaqi-api";
import { arabicError, sumPaid } from "@/lib/rules";
import { cn } from "@/lib/utils";

const digitsOnly = (v: string) => v.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function useSetAppointmentStatus(shopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "completed" ? "تم تسجيل الموعد كمكتمل" : "أُلغي الموعد وأصبح الوقت متاحاً");
      qc.invalidateQueries({ queryKey: ["shop-appointments", shopId] });
      qc.invalidateQueries({ queryKey: ["slots", shopId] });
    },
    onError: (e) => toast.error(arabicError(e)),
  });
}

export function DayPicker({ shop, value, onChange, days = 7 }: { shop: Shop; value: string; onChange: (k: string) => void; days?: number }) {
  const today = todayKey(shop.timezone);
  const keys = Array.from({ length: days }, (_, i) => addDaysKey(today, i));
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {keys.map((k) => {
        const off = shop.days_off.includes(weekdayOfKey(k));
        return (
          <button
            key={k}
            type="button"
            disabled={off}
            onClick={() => onChange(k)}
            className={cn(
              "flex w-20 shrink-0 flex-col items-center rounded-2xl border px-2 py-3 transition disabled:opacity-40",
              value === k ? "border-primary bg-primary text-primary-foreground shadow-lift" : "bg-card",
            )}
          >
            <span className="text-xs opacity-80">{k === today ? "اليوم" : formatDayKey(k, { weekday: "short" })}</span>
            <span className="mt-1 text-2xl font-bold">{formatDayKey(k, { day: "numeric" })}</span>
            <span className="text-[11px] opacity-80">{off ? "عطلة" : formatDayKey(k, { month: "short" })}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SlotGrid({
  barberId,
  timezone,
  day,
  value,
  onChange,
}: {
  barberId: string;
  timezone: string;
  day: string;
  value: string;
  onChange: (startsAt: string) => void;
}) {
  const { data, isPending, isError } = useQuery(slotsQuery(barberId, day));
  if (isPending) return <p className="py-6 text-center text-sm text-muted-foreground">جارٍ تحميل الأوقات…</p>;
  if (isError) return <p className="py-6 text-center text-sm text-destructive">تعذّر تحميل الأوقات.</p>;
  if (data.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">لا توجد أوقات عمل في هذا اليوم.</p>;
  const anyFree = data.some((s) => s.available);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {data.map((s) => (
          <button
            key={s.starts_at}
            type="button"
            disabled={!s.available}
            onClick={() => onChange(s.starts_at)}
            aria-label={`${formatTime(s.starts_at, timezone)}${s.available ? "" : " محجوز"}`}
            className={cn(
              "rounded-xl border py-3 text-sm font-medium transition",
              !s.available && "cursor-not-allowed border-dashed bg-muted text-muted-foreground line-through",
              s.available && value === s.starts_at && "border-brass bg-accent text-accent-foreground ring-2 ring-brass",
              s.available && value !== s.starts_at && "bg-card",
            )}
          >
            {formatTime(s.starts_at, timezone)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {anyFree ? "الأوقات المشطوبة محجوزة أو مضت." : "كل الأوقات محجوزة أو مضت في هذا اليوم."}
      </p>
    </>
  );
}

export function NewAppointmentSheet({ shop, open, onClose }: { shop: Shop; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [day, setDay] = useState(() => todayKey(shop.timezone));
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState<string>(SERVICES[0]);

  const book = useMutation({
    mutationFn: () => bookAppointment({ barberId: shop.id, startsAt, service, name: name.trim(), phone: phone.trim() || undefined }),
    onSuccess: () => {
      toast.success("حُفظ الموعد");
      qc.invalidateQueries({ queryKey: ["shop-appointments", shop.id] });
      qc.invalidateQueries({ queryKey: ["slots", shop.id] });
      setName("");
      setPhone("");
      setStartsAt("");
      onClose();
    },
    onError: (e) => {
      toast.error(arabicError(e));
      setStartsAt("");
      qc.invalidateQueries({ queryKey: ["slots", shop.id] });
    },
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="موعد جديد"
      description="لزبون حضر أو اتصل هاتفياً."
      footer={
        <Button variant="ink" size="lg" className="w-full" disabled={!startsAt || name.trim().length < 2 || book.isPending} onClick={() => book.mutate()}>
          {book.isPending ? <Loader2 className="animate-spin" /> : <Plus />} حفظ الموعد
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="appt-name">اسم الزبون</Label>
        <Input id="appt-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="appt-phone">الهاتف (اختياري)</Label>
        <Input id="appt-phone" dir="ltr" inputMode="tel" className="h-12 text-right text-base" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      </div>
      <div className="space-y-2">
        <Label>الخدمة</Label>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <Chip key={s} active={service === s} onClick={() => setService(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>اليوم</Label>
        <DayPicker
          shop={shop}
          value={day}
          onChange={(k) => {
            setDay(k);
            setStartsAt("");
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>الوقت — {relativeDayLabel(day, shop.timezone)}</Label>
        <SlotGrid barberId={shop.id} timezone={shop.timezone} day={day} value={startsAt} onChange={setStartsAt} />
      </div>
    </BottomSheet>
  );
}

export function NewDebtSheet({ shop, open, onClose }: { shop: Shop; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const amountNum = Number(amount || 0);
  const paidNum = Number(paid || 0);
  const valid = name.trim().length >= 2 && amountNum > 0 && paidNum <= amountNum;

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .insert({
          barber_id: shop.id,
          customer_name: name.trim(),
          customer_phone: phone.trim() || null,
          amount: amountNum,
          note: note.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (paidNum > 0) {
        const { error: pErr } = await supabase.from("payments").insert({ debt_id: data.id, barber_id: shop.id, amount: paidNum });
        if (pErr) throw new Error("PAYMENT_FAILED");
      }
    },
    onSuccess: () => {
      toast.success("حُفظ الدين");
      setName("");
      setPhone("");
      setAmount("");
      setPaid("");
      setNote("");
      onClose();
    },
    onError: (e) =>
      toast.error(e instanceof Error && e.message === "PAYMENT_FAILED" ? "حُفظ الدين لكن لم تُحفظ الدفعة. سجّلها من صفحة الديون." : arabicError(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shop-debts", shop.id] }),
  });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="تسجيل دين"
      description="المبلغ المستحق وما دفعه الزبون الآن."
      footer={
        <Button variant="ink" size="lg" className="w-full" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <HandCoins />} حفظ
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="debt-name">اسم الزبون</Label>
        <Input id="debt-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="debt-phone">الهاتف (اختياري)</Label>
        <Input id="debt-phone" dir="ltr" inputMode="tel" className="h-12 text-right text-base" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="debt-amount">المبلغ الكلي (د.ع)</Label>
          <Input id="debt-amount" inputMode="numeric" dir="ltr" className="h-12 text-right text-base" value={amount} onChange={(e) => setAmount(digitsOnly(e.target.value).slice(0, 9))} placeholder="15000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-paid">المدفوع الآن</Label>
          <Input id="debt-paid" inputMode="numeric" dir="ltr" className="h-12 text-right text-base" value={paid} onChange={(e) => setPaid(digitsOnly(e.target.value).slice(0, 9))} placeholder="0" />
        </div>
      </div>
      {paidNum > amountNum && amountNum > 0 && <p className="text-xs text-destructive">المدفوع لا يمكن أن يتجاوز المبلغ الكلي.</p>}
      <div className="space-y-2">
        <Label htmlFor="debt-note">ملاحظة (اختياري)</Label>
        <Input id="debt-note" className="h-12 text-base" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="مثال: قص + ذقن" />
      </div>
    </BottomSheet>
  );
}

export function PaymentSheet({ shop, debt, onClose }: { shop: Shop; debt: Debt | null; onClose: () => void }) {
  const qc = useQueryClient();
  const remaining = debt ? debt.amount - sumPaid(debt.payments) : 0;
  const [amount, setAmount] = useState("");
  const value = Number(amount || 0);

  const pay = useMutation({
    mutationFn: async () => {
      if (!debt) return;
      const { error } = await supabase.from("payments").insert({ debt_id: debt.id, barber_id: shop.id, amount: value });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("حُفظت الدفعة");
      setAmount("");
      onClose();
    },
    onError: (e) => toast.error(arabicError(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shop-debts", shop.id] }),
  });

  return (
    <BottomSheet
      open={!!debt}
      onClose={() => {
        setAmount("");
        onClose();
      }}
      title="تسجيل دفعة"
      description={debt ? `${debt.customer_name} — المتبقي ${formatMoney(remaining)}` : ""}
      footer={
        <Button variant="success" size="lg" className="w-full" disabled={value <= 0 || value > remaining || pay.isPending} onClick={() => pay.mutate()}>
          {pay.isPending ? <Loader2 className="animate-spin" /> : <HandCoins />} حفظ الدفعة
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="pay-amount">المبلغ المدفوع (د.ع)</Label>
        <Input id="pay-amount" inputMode="numeric" dir="ltr" className="h-12 text-right text-base" value={amount} onChange={(e) => setAmount(digitsOnly(e.target.value).slice(0, 9))} />
        <div className="flex gap-2">
          <Chip active={value === remaining} onClick={() => setAmount(String(remaining))}>
            المبلغ كاملاً
          </Chip>
          {remaining >= 2000 && (
            <Chip active={value === Math.round(remaining / 2)} onClick={() => setAmount(String(Math.round(remaining / 2)))}>
              النصف
            </Chip>
          )}
        </div>
        {value > remaining && <p className="text-xs text-destructive">المبلغ أكبر من المتبقي.</p>}
      </div>
    </BottomSheet>
  );
}
