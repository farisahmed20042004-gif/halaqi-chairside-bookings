import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Info, LayoutDashboard, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { AppointmentStatus, DebtStatus } from "@/lib/demo-data";

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
  subtitle?: string;
  backTo?: "/" | "/barber";
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

export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{children ?? "وضع تجريبي: البيانات للعرض فقط ولا تُحفظ. ستُعاد عند تحديث الصفحة."}</p>
    </div>
  );
}

const navItems = [
  { to: "/barber", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/appointments", label: "المواعيد", icon: CalendarDays },
  { to: "/debts", label: "الديون", icon: Wallet },
] as const;

export function BarberNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur pb-safe">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
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
  confirmed: { label: "مؤكد", className: "bg-primary/10 text-primary" },
  pending: { label: "بانتظار التأكيد", className: "bg-warning/20 text-warning-foreground" },
  completed: { label: "مكتمل", className: "bg-success/15 text-success" },
  cancelled: { label: "ملغي", className: "bg-destructive/10 text-destructive" },
};

export const appointmentStatusLabel = (s: AppointmentStatus) => appointmentStatusMap[s].label;

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

export const debtStatusLabel = (s: DebtStatus) => debtStatusMap[s].label;

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
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
