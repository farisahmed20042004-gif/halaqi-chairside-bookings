// Formatting helpers. All times are shown in the barber's own timezone so a
// booking reads the same for the barber and the customer.

const numberFmt = new Intl.NumberFormat("ar-IQ");
export const formatNumber = (n: number) => numberFmt.format(n);
export const formatMoney = (n: number) => `${numberFmt.format(n)} د.ع`;

/** YYYY-MM-DD of an instant, as seen in `tz`. */
export function dayKey(instant: Date | string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

export function todayKey(tz: string) {
  return dayKey(new Date(), tz);
}

export function addDaysKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday (matches the database's day numbering). */
export function weekdayOfKey(key: string) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

export function formatDayKey(
  key: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("ar-IQ", { ...opts, timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
}

export function formatTime(instant: Date | string, tz: string) {
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
    new Date(instant),
  );
}

export function relativeDayLabel(key: string, tz: string) {
  const today = todayKey(tz);
  if (key === today) return "اليوم";
  if (key === addDaysKey(today, 1)) return "غداً";
  if (key === addDaysKey(today, -1)) return "أمس";
  return formatDayKey(key);
}

export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

/** "HH:MM" (24h) of an instant, as seen in `tz`. */
export function timeKey(instant: Date | string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
}

/** The instant (ISO, UTC) of a wall-clock date + time in `tz`. */
export function zonedToUtcIso(key: string, time: string, tz: string) {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(t));
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - t;
  };
  let t = wall - offsetAt(wall);
  t = wall - offsetAt(t);
  return new Date(t).toISOString();
}

/** "10:00" → "١٠:٠٠ ص" style label for a wall-clock time. */
export function formatClock(time: string) {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return new Intl.DateTimeFormat("ar-IQ", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}
