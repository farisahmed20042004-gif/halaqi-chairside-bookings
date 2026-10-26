import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Chip } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, formatNumber } from "@/lib/format";
import type { Shop } from "@/lib/halaqi-api";
import { arabicError } from "@/lib/rules";

const SLOT_OPTIONS = [15, 20, 30, 45, 60] as const;

export function ShopForm({
  shop,
  defaultBarberName = "",
  onSaved,
  submitLabel,
}: {
  shop?: Shop | null;
  defaultBarberName?: string;
  onSaved?: (s: Shop) => void;
  submitLabel: string;
}) {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState(shop?.shop_name ?? "");
  const [barberName, setBarberName] = useState(shop?.barber_name ?? defaultBarberName);
  const [area, setArea] = useState(shop?.area ?? "");
  const [openTime, setOpenTime] = useState(shop?.open_time.slice(0, 5) ?? "10:00");
  const [closeTime, setCloseTime] = useState(shop?.close_time.slice(0, 5) ?? "21:00");
  const [slot, setSlot] = useState<number>(shop?.slot_minutes ?? 30);
  const [daysOff, setDaysOff] = useState<number[]>(shop?.days_off ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (shopName.trim().length < 2) return setError("اكتب اسم الصالون.");
    if (barberName.trim().length < 2) return setError("اكتب اسم الحلاق.");
    if (closeTime <= openTime) return setError("وقت الإغلاق يجب أن يكون بعد وقت الفتح.");
    if (daysOff.length === 7) return setError("اختر يوم عمل واحداً على الأقل.");
    setBusy(true);
    try {
      const fields = {
        shop_name: shopName.trim(),
        barber_name: barberName.trim(),
        area: area.trim() || null,
        open_time: openTime,
        close_time: closeTime,
        slot_minutes: slot,
        days_off: daysOff,
      };
      let saved: Shop;
      if (shop) {
        const { data, error } = await supabase.from("barbers").update(fields).eq("id", shop.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("NOT_AUTHENTICATED");
        const { data, error } = await supabase
          .from("barbers")
          .insert({ ...fields, owner_id: u.user.id })
          .select()
          .single();
        if (error) throw error;
        saved = data;
      }
      qc.setQueryData(["my-shop"], saved);
      await qc.invalidateQueries({ queryKey: ["slots"] });
      onSaved?.(saved);
    } catch (err) {
      setError(arabicError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="shop-name">اسم الصالون</Label>
        <Input id="shop-name" className="h-12 text-base" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={80} placeholder="مثال: صالون النخبة" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="barber-name">اسم الحلاق</Label>
        <Input id="barber-name" className="h-12 text-base" value={barberName} onChange={(e) => setBarberName(e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area">المنطقة (اختياري)</Label>
        <Input id="area" className="h-12 text-base" value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} placeholder="مثال: بغداد — الكرادة" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="open">يفتح</Label>
          <Input id="open" type="time" dir="ltr" className="h-12 text-base" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="close">يغلق</Label>
          <Input id="close" type="time" dir="ltr" className="h-12 text-base" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>مدة الموعد</Label>
        <div className="flex flex-wrap gap-2">
          {SLOT_OPTIONS.map((m) => (
            <Chip key={m} active={slot === m} onClick={() => setSlot(m)}>
              {formatNumber(m)} دقيقة
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>أيام العطلة</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((name, i) => (
            <Chip
              key={name}
              active={daysOff.includes(i)}
              onClick={() => setDaysOff((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
            >
              {name}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">الأيام المختارة لن تظهر للزبائن للحجز.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" size="xl" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
