import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Bell, CalendarDays, LayoutDashboard, Loader2, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dayKey, formatDayKey, formatNumber, formatTime } from "@/lib/format";
import { markNotificationsRead, notificationsQuery, type AppointmentStatus } from "@/lib/halaqi-api";
import type { DebtStatus } from "@/lib/rules";
import { cn } from "@/lib/utils";

export function MobileFrame({ children, withNav = false }: { children: ReactNode; withNav?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <div className={cn("mx-auto min-h-screen w-full max-w-md", withNav && "pb-24")}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  backTo = "/",
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  backTo?: "/" | "/barber" | "/customer";
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          to={backTo}
          aria-label="رجوع"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition active:scale-95"
        >
          <ArrowRight className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function LoadingScreen({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-7 animate-spin text-brass" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const barberNavItems = [
  { to: "/barber", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/appointments", label: "المواعيد", icon: CalendarDays },
  { to: "/debts", label: "الديون", icon: Wallet },
] as const;


export function BarberNav() {
  return <BottomNav items={barberNavItems} />;
}


function BottomNav({ items }: { items: typeof barberNavItems }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur pb-safe">
      <ul className={cn("mx-auto grid max-w-md", "grid-cols-3")}>
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 pt-2.5 pb-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const appointmentStatusMap: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "بانتظار التأكيد", className: "bg-warning/20 text-warning-foreground" },
  confirmed: { label: "مؤكد", className: "bg-primary/10 text-primary" },
  completed: { label: "مكتمل", className: "bg-success/15 text-success" },
  cancelled: { label: "ملغي", className: "bg-destructive/10 text-destructive" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = appointmentStatusMap[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold", s.className)}>
      {s.label}
    </span>
  );
}

const debtStatusMap: Record<DebtStatus, { label: string; className: string }> = {
  unpaid: { label: "غير مدفوع", className: "bg-destructive/10 text-destructive" },
  partial: { label: "مدفوع جزئياً", className: "bg-warning/20 text-warning-foreground" },
  paid: { label: "مدفوع", className: "bg-success/15 text-success" },
};

export function DebtStatusBadge({ status }: { status: DebtStatus }) {
  const s = debtStatusMap[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold", s.className)}>
      {s.label}
    </span>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                value === o.value ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
              )}
            >
              {formatNumber(o.count)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-2 text-sm transition disabled:opacity-40",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string | undefined }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function BottomSheet({
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
  description?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" dir="rtl" className="mx-auto max-h-[92vh] max-w-md overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-right">
          <SheetTitle className="font-display text-xl">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="space-y-4 py-4">{children}</div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "تراجع",
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-w-sm rounded-2xl">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle className="font-display text-xl">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-right">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button variant="destructive" size="lg" className="w-full" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
          <AlertDialogCancel className="mt-0 h-11 w-full">{cancelLabel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** In-app notifications (cancellations). Shown inside the app only, not as phone push alerts. */
export function NotificationsBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery(notificationsQuery());
  const unread = data.filter((n) => !n.read_at);
  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(unread.map((n) => n.id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <>
      <button
        type="button"
        aria-label={unread.length ? `الإشعارات، ${formatNumber(unread.length)} جديدة` : "الإشعارات"}
        onClick={() => {
          setOpen(true);
          if (unread.length) markRead.mutate();
        }}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full",
          tone === "dark" ? "size-9 bg-ink-foreground/10" : "size-10 border bg-card",
        )}
      >
        <Bell className="size-4" />
        {unread.length > 0 && (
          <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {formatNumber(unread.length)}
          </span>
        )}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="الإشعارات" footer={null}>
        {data.length === 0 ? (
          <EmptyState title="لا إشعارات" hint="ستظهر هنا إشعارات إلغاء المواعيد." />
        ) : (
          <ul className="space-y-2">
            {data.map((n) => (
              <li key={n.id} className={cn("rounded-2xl border p-3.5", n.read_at ? "bg-card" : "border-brass/50 bg-accent/40")}>
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                {n.starts_at && n.timezone && (
                  <p className="mt-1 text-sm">
                    موعد {formatDayKey(dayKey(n.starts_at, n.timezone))} · {formatTime(n.starts_at, n.timezone)}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDayKey(dayKey(n.created_at, n.timezone ?? "Asia/Baghdad"), { day: "numeric", month: "short" })} ·{" "}
                  {formatTime(n.created_at, n.timezone ?? "Asia/Baghdad")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
