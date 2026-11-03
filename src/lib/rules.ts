// Small business rules shared by the screens. The database enforces the real
// limits (no double booking, no overpayment); these only shape what is shown.

export type DebtStatus = "unpaid" | "partial" | "paid";

export function debtStatus(amount: number, paid: number): DebtStatus {
  if (paid >= amount) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export function sumPaid(payments: { amount: number }[]) {
  return payments.reduce((s, p) => s + p.amount, 0);
}

/** One line of a money history: a debt the barber recorded, or a payment against one. */
export type LedgerEntry = {
  id: string;
  debt_id: string;
  barber_id: string;
  type: "debt" | "payment";
  amount: number;
  note: string | null;
  created_at: string;
};

export type BarberBalance = { barber_id: string; total: number; paid: number; remaining: number; entries: LedgerEntry[] };

/** Customer view: debts and payments grouped by barber. Remaining = debts − payments. Owing barbers first. */
export function balancesByBarber(entries: LedgerEntry[]): BarberBalance[] {
  const map = new Map<string, BarberBalance>();
  for (const e of entries) {
    const g = map.get(e.barber_id) ?? { barber_id: e.barber_id, total: 0, paid: 0, remaining: 0, entries: [] };
    if (e.type === "debt") g.total += e.amount;
    else g.paid += e.amount;
    g.entries.push(e);
    map.set(e.barber_id, g);
  }
  const list = [...map.values()].map((g) => ({
    ...g,
    remaining: g.total - g.paid,
    entries: [...g.entries].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }));
  return list.sort((a, b) => b.remaining - a.remaining || (b.entries[0]?.created_at ?? "").localeCompare(a.entries[0]?.created_at ?? ""));
}

type DebtLike = {
  amount: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  payments: { amount: number }[];
};

/** Linked customers group by account; customers without an account group by name + phone. */
export function customerKey(d: Pick<DebtLike, "customer_id" | "customer_name" | "customer_phone">) {
  if (d.customer_id) return `c:${d.customer_id}`;
  return `n:${d.customer_name.trim().replace(/\s+/g, " ")}|${(d.customer_phone ?? "").replace(/\D/g, "")}`;
}

export type CustomerAccount<T extends DebtLike> = {
  key: string;
  customer_id: string | null;
  name: string;
  phone: string | null;
  debts: T[];
  total: number;
  paid: number;
  remaining: number;
};

/** Barber view: each customer's debts with total, paid and remaining. Customers who still owe come first. */
export function accountsByCustomer<T extends DebtLike>(debts: T[]): CustomerAccount<T>[] {
  const map = new Map<string, CustomerAccount<T>>();
  for (const d of debts) {
    const key = customerKey(d);
    const a = map.get(key) ?? { key, customer_id: d.customer_id, name: d.customer_name, phone: d.customer_phone, debts: [], total: 0, paid: 0, remaining: 0 };
    a.debts.push(d);
    a.total += d.amount;
    a.paid += sumPaid(d.payments);
    if (!a.phone && d.customer_phone) a.phone = d.customer_phone;
    map.set(key, a);
  }
  return [...map.values()]
    .map((a) => ({ ...a, remaining: a.total - a.paid }))
    .sort((a, b) => Number(b.remaining > 0) - Number(a.remaining > 0) || a.name.localeCompare(b.name, "ar"));
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Only allow same-site paths as post-login destinations. */
export function safeRedirect(path: unknown): string | null {
  if (typeof path !== "string") return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  if (path.startsWith("/auth")) return null;
  return path;
}

const messages: Record<string, string> = {
  SLOT_TAKEN: "هذا الوقت حُجز للتو. اختر وقتاً آخر.",
  SLOT_IN_PAST: "هذا الوقت مضى. اختر وقتاً قادماً.",
  SLOT_TOO_FAR: "يمكن الحجز لمدة أقصاها شهر من اليوم.",
  OUTSIDE_HOURS: "هذا الوقت خارج ساعات عمل الحلاق.",
  DAY_OFF: "الحلاق لا يعمل في هذا اليوم.",
  TOO_MANY_BOOKINGS: "لديك ٣ مواعيد قادمة عند هذا الحلاق. ألغِ أحدها لتحجز جديداً.",
  CANNOT_CANCEL: "لا يمكن إلغاء هذا الموعد.",
  BARBER_NOT_FOUND: "الرمز غير صحيح. تأكد منه مع حلاقك.",
  TOO_MANY_BARBERS: "وصلت للحد الأقصى (٣٠ حلاقاً). احذف حلاقاً من الإعدادات لتضيف غيره.",
  NOT_A_CUSTOMER: "هذا الحساب حساب حلاق. سجّل بحساب زبون لتحجز.",
  SERVICE_UNAVAILABLE: "هذه الخدمة لم تعد متاحة. اختر خدمة أخرى.",
  services_name_check: "اسم الخدمة يجب أن يكون بين حرفين و٦٠ حرفاً.",
  services_price_check: "السعر غير صالح.",
  services_duration_minutes_check: "المدة يجب أن تكون بين ٥ و٤٨٠ دقيقة.",
  OVERPAYMENT: "المبلغ أكبر من المتبقي على الزبون.",
  CUSTOMER_NOT_IN_SHOP: "هذا الزبون غير مرتبط بمحلك.",
  DEBT_IN_FUTURE: "لا يمكن تسجيل دين بتاريخ لم يأتِ بعد.",
  DEBT_TOO_OLD: "تاريخ الدين قديم جداً.",
  NOT_AUTHENTICATED: "يجب تسجيل الدخول أولاً.",
  "Invalid login credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "User already registered": "هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.",
  "Password should be at least": "كلمة المرور قصيرة. استخدم ٨ أحرف على الأقل.",
  "Password is known to be weak": "كلمة المرور هذه مسرّبة أو سهلة التخمين. اختر كلمة أخرى.",
  pwned: "كلمة المرور هذه مسرّبة أو سهلة التخمين. اختر كلمة أخرى.",
  "Unable to validate email address": "البريد الإلكتروني غير صالح.",
  "rate limit": "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.",
  "Failed to fetch": "تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.",
};

export function arabicError(err: unknown): string {
  const text =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "";
  for (const [needle, msg] of Object.entries(messages)) {
    if (text.toLowerCase().includes(needle.toLowerCase())) return msg;
  }
  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

/** Limits the database enforces on a service; checked here first to show a clear message. */
export const SERVICE_LIMITS = { nameMin: 2, nameMax: 60, priceMax: 100_000_000, durationMin: 5, durationMax: 480 } as const;

export function serviceFormError(f: { name: string; price: number; duration: number }): string | null {
  const name = f.name.trim();
  if (name.length < SERVICE_LIMITS.nameMin || name.length > SERVICE_LIMITS.nameMax) return "اكتب اسم الخدمة (حرفان على الأقل).";
  if (!Number.isFinite(f.price) || f.price < 0 || f.price > SERVICE_LIMITS.priceMax) return "اكتب سعراً صحيحاً بالدينار.";
  if (!Number.isInteger(f.duration) || f.duration < SERVICE_LIMITS.durationMin || f.duration > SERVICE_LIMITS.durationMax)
    return "المدة يجب أن تكون بين ٥ و٤٨٠ دقيقة.";
  return null;
}

/** How a booking reads for the customer. A booking the barber cancelled reads as "rejected". */
export type CustomerBookingState = "pending" | "confirmed" | "rejected" | "cancelled" | "completed";

export function customerBookingState(b: { status: string; cancelled_by_barber: boolean | null }): CustomerBookingState {
  if (b.status === "cancelled") return b.cancelled_by_barber ? "rejected" : "cancelled";
  if (b.status === "pending" || b.status === "confirmed" || b.status === "completed") return b.status;
  return "pending";
}

/** The soonest confirmed booking that hasn't started yet (shown as the big green card). */
export function nextConfirmedBooking<T extends { status: string; starts_at: string }>(list: T[], now: Date = new Date()): T | null {
  return (
    list
      .filter((b) => b.status === "confirmed" && new Date(b.starts_at) > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null
  );
}

/** Customers may cancel only their own future bookings that are still pending or confirmed. */
export function canCustomerCancel(b: { status: string; starts_at: string }, now: Date = new Date()) {
  return (b.status === "pending" || b.status === "confirmed") && new Date(b.starts_at) > now;
}

/** Device copy of the customer's saved barbers: one array for the phone, each entry tagged with its account. */
export const SAVED_BARBERS_KEY = "halaqi_barbers_list";
/** Older single-code key, read once and moved into the list. */
export const legacySavedBarberKey = (userId: string) => `halaqi:barber-code:${userId}`;

export type SavedBarberEntry = { user_id: string; code: string; shop_name?: string | undefined };

export function parseSavedBarbers(raw: string | null): SavedBarberEntry[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (e): e is SavedBarberEntry =>
        !!e && typeof e === "object" && typeof (e as SavedBarberEntry).user_id === "string" && typeof (e as SavedBarberEntry).code === "string",
    );
  } catch {
    return [];
  }
}

/** Appends a barber for this account; never removes the others. Re-adding a code only refreshes its name. */
export function addSavedBarber(list: SavedBarberEntry[], entry: SavedBarberEntry): SavedBarberEntry[] {
  const code = normalizeCode(entry.code);
  if (!code) return list;
  const i = list.findIndex((e) => e.user_id === entry.user_id && e.code === code);
  if (i === -1) return [...list, { ...entry, code }];
  if (!entry.shop_name || list[i]!.shop_name === entry.shop_name) return list;
  return list.map((e, j) => (j === i ? { ...e, shop_name: entry.shop_name } : e));
}

export function removeSavedBarber(list: SavedBarberEntry[], userId: string, code: string): SavedBarberEntry[] {
  const c = normalizeCode(code);
  return list.filter((e) => !(e.user_id === userId && e.code === c));
}

/** Codes this account saved on this phone, in the order they were added. */
export function savedCodesFor(list: SavedBarberEntry[], userId: string): string[] {
  return list.filter((e) => e.user_id === userId).map((e) => e.code);
}
