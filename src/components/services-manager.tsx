import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Loader2, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BottomSheet, Chip, ConfirmDialog } from "@/components/app-ui";
import { digitsOnly } from "@/components/barber-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatMoney, formatNumber } from "@/lib/format";
import { removeService, saveService, setServiceActive, shopServicesQuery, type Service, type Shop } from "@/lib/halaqi-api";
import { arabicError, serviceFormError } from "@/lib/rules";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

function useInvalidateServices(shopId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["shop-services", shopId] });
    qc.invalidateQueries({ queryKey: ["public-services", shopId] });
    qc.invalidateQueries({ queryKey: ["slots", shopId] });
  };
}

/** "خدماتي": the barber adds, edits, pauses and removes the services customers book. */
export function ServicesManager({ shop }: { shop: Shop }) {
  const { data: services } = useSuspenseQuery(shopServicesQuery(shop.id));
  const invalidate = useInvalidateServices(shop.id);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [removing, setRemoving] = useState<Service | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setServiceActive(id, active),
    onSuccess: (_d, v) => toast.success(v.active ? "الخدمة ظاهرة للزبائن" : "أُخفيت الخدمة عن الزبائن"),
    onError: (e) => toast.error(arabicError(e)),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeService(id),
    onSuccess: () => {
      toast.success("حُذفت الخدمة");
      setRemoving(null);
    },
    onError: (e) => toast.error(arabicError(e)),
    onSettled: invalidate,
  });

  const activeCount = services.filter((s) => s.is_active).length;

  return (
    <div className="space-y-3">
      {activeCount === 0 && (
        <div role="status" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">الزبائن لا يستطيعون الحجز بعد</p>
          <p className="mt-1 text-muted-foreground">أضف خدمة واحدة على الأقل مع سعرها ومدتها ليظهر لزبائنك ما يحجزونه.</p>
        </div>
      )}

      {services.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {services.map((s) => (
            <li key={s.id} className={cn("flex items-start gap-3 p-3.5", !s.is_active && "bg-muted/50")}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Scissors className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-semibold", !s.is_active && "text-muted-foreground")}>{s.name}</p>
                {s.description && <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                  <span className="font-bold">{formatMoney(s.price)}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" /> {formatNumber(s.duration_minutes)} دقيقة
                  </span>
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={s.is_active}
                    disabled={toggle.isPending}
                    onCheckedChange={(active) => toggle.mutate({ id: s.id, active })}
                    aria-label={`إظهار ${s.name} للزبائن`}
                  />
                  {s.is_active ? "ظاهرة للزبائن" : "مخفية عن الزبائن"}
                </label>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  aria-label={`تعديل ${s.name}`}
                  onClick={() => setEditing(s)}
                  className="flex size-9 items-center justify-center rounded-full border bg-background active:scale-95"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`حذف ${s.name}`}
                  onClick={() => setRemoving(s)}
                  className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-95"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" size="lg" className="w-full border-dashed bg-card" onClick={() => setEditing("new")}>
        <Plus /> إضافة خدمة
      </Button>

      <ServiceSheet
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        shopId={shop.id}
        service={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="حذف الخدمة؟"
        description={
          removing ? `لن تظهر «${removing.name}» للزبائن بعد الآن. المواعيد السابقة تبقى محفوظة باسمها وسعرها.` : undefined
        }
        confirmLabel="نعم، احذف الخدمة"
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

function ServiceSheet({
  shopId,
  service,
  open,
  onClose,
}: {
  shopId: string;
  service: Service | null;
  open: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateServices(shopId);
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [duration, setDuration] = useState(service ? String(service.duration_minutes) : "30");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveService(shopId, { name, description, price: Number(price), duration_minutes: Number(duration) }, service?.id),
    onSuccess: () => {
      toast.success(service ? "حُفظت التعديلات" : "أُضيفت الخدمة");
      onClose();
    },
    onError: (e) => setError(arabicError(e)),
    onSettled: invalidate,
  });

  const submit = () => {
    setError("");
    const problem = serviceFormError({ name, price: price === "" ? NaN : Number(price), duration: Number(duration) });
    if (problem) return setError(problem);
    save.mutate();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={service ? "تعديل الخدمة" : "إضافة خدمة"}
      description="الاسم والسعر بالدينار العراقي والمدة بالدقائق."
      footer={
        <Button variant="ink" size="lg" className="w-full" disabled={save.isPending} onClick={submit}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {service ? "حفظ التعديلات" : "إضافة الخدمة"}
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="svc-name">اسم الخدمة</Label>
        <Input
          id="svc-name"
          className="h-12 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="مثال: قص شعر"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="svc-price">السعر (د.ع)</Label>
        <Input
          id="svc-price"
          inputMode="numeric"
          dir="ltr"
          className="h-12 text-right text-base"
          value={price}
          onChange={(e) => setPrice(digitsOnly(e.target.value).slice(0, 9))}
          placeholder="10000"
        />
        {price !== "" && <p className="text-xs text-muted-foreground">{formatMoney(Number(price))}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="svc-duration">المدة (بالدقائق)</Label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <Chip key={m} active={duration === String(m)} onClick={() => setDuration(String(m))}>
              {formatNumber(m)}
            </Chip>
          ))}
        </div>
        <Input
          id="svc-duration"
          inputMode="numeric"
          dir="ltr"
          className="h-12 text-right text-base"
          value={duration}
          onChange={(e) => setDuration(digitsOnly(e.target.value).slice(0, 3))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="svc-desc">الوصف (اختياري)</Label>
        <Input
          id="svc-desc"
          className="h-12 text-base"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="مثال: قص + غسل + تصفيف"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}
