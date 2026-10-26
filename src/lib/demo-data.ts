// Sample data for the interface preview only. Nothing here is saved anywhere;
// every page copies it into local state, so changes reset on reload.

export type AppointmentStatus = "confirmed" | "pending" | "completed" | "cancelled";
export type DebtStatus = "unpaid" | "partial" | "paid";

export interface Appointment {
  id: string;
  customer: string;
  service: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  status: AppointmentStatus;
}

export interface Debt {
  id: string;
  customer: string;
  amount: number;
  paid: number;
  date: string;
  time: string;
  note?: string | undefined;
}

export const DEMO_TODAY = "2026-10-27";
export const DEMO_BARBER = {
  name: "صالون أبو علي",
  barber: "علي الكاظمي",
  code: "HLQ-2048",
  area: "بغداد — الكرادة",
};

export const SERVICES = ["قص شعر", "حلاقة ذقن", "قص + ذقن", "تنظيف بشرة"] as const;

export const demoAppointments: Appointment[] = [
  { id: "a1", customer: "حسين جاسم", service: "قص + ذقن", date: "2026-10-27", time: "10:00", status: "completed" },
  { id: "a2", customer: "مصطفى كريم", service: "قص شعر", date: "2026-10-27", time: "11:30", status: "confirmed" },
  { id: "a3", customer: "يوسف عادل", service: "حلاقة ذقن", date: "2026-10-27", time: "13:00", status: "pending" },
  { id: "a4", customer: "أحمد سلمان", service: "قص شعر", date: "2026-10-27", time: "16:30", status: "confirmed" },
  { id: "a5", customer: "علي حيدر", service: "تنظيف بشرة", date: "2026-10-27", time: "18:00", status: "cancelled" },
  { id: "a6", customer: "محمد رضا", service: "قص + ذقن", date: "2026-10-28", time: "12:00", status: "pending" },
  { id: "a7", customer: "عمر فاضل", service: "قص شعر", date: "2026-10-28", time: "17:00", status: "confirmed" },
  { id: "a8", customer: "كرار نعمة", service: "حلاقة ذقن", date: "2026-10-26", time: "19:30", status: "completed" },
];

export const demoDebts: Debt[] = [
  { id: "d1", customer: "مصطفى كريم", amount: 15000, paid: 0, date: "2026-10-27", time: "11:45", note: "قص شعر" },
  { id: "d2", customer: "كرار نعمة", amount: 20000, paid: 10000, date: "2026-10-26", time: "19:50", note: "قص + ذقن" },
  { id: "d3", customer: "حسين جاسم", amount: 20000, paid: 20000, date: "2026-10-25", time: "14:10" },
  { id: "d4", customer: "سجاد عباس", amount: 30000, paid: 0, date: "2026-10-22", time: "20:15", note: "تنظيف بشرة + قص" },
  { id: "d5", customer: "علي حيدر", amount: 10000, paid: 5000, date: "2026-10-20", time: "17:30" },
];

// Times already taken for the demo barber, keyed by date.
export const demoTakenSlots: Record<string, string[]> = {
  "2026-10-27": ["10:00", "11:30", "13:00", "16:30"],
  "2026-10-28": ["12:00", "17:00"],
  "2026-10-29": ["10:30", "15:00", "15:30"],
};

export const WORKING_SLOTS = [
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00",
];

export function debtStatus(d: Pick<Debt, "amount" | "paid">): DebtStatus {
  if (d.paid >= d.amount) return "paid";
  if (d.paid > 0) return "partial";
  return "unpaid";
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isDemoBarberCode(code: string) {
  return normalizeCode(code) === DEMO_BARBER.code;
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const numberFmt = new Intl.NumberFormat("ar-IQ");
export const formatNumber = (n: number) => numberFmt.format(n);
export const formatMoney = (n: number) => `${numberFmt.format(n)} د.ع`;

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("ar-IQ", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatTime(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const period = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${numberFmt.format(h12)}:${numberFmt.format(m).padStart(2, numberFmt.format(0))} ${period}`;
}

export function relativeDayLabel(iso: string) {
  if (iso === DEMO_TODAY) return "اليوم";
  if (iso === addDays(DEMO_TODAY, 1)) return "غداً";
  if (iso === addDays(DEMO_TODAY, -1)) return "أمس";
  return formatDate(iso);
}
