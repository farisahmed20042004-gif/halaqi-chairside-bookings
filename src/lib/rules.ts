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
  NOT_A_CUSTOMER: "هذا الحساب حساب حلاق. سجّل بحساب زبون لتحجز.",
  SERVICE_UNAVAILABLE: "هذه الخدمة لم تعد متاحة. اختر خدمة أخرى.",
  services_name_check: "اسم الخدمة يجب أن يكون بين حرفين و٦٠ حرفاً.",
  services_price_check: "السعر غير صالح.",
  services_duration_minutes_check: "المدة يجب أن تكون بين ٥ و٤٨٠ دقيقة.",
  OVERPAYMENT: "المبلغ أكبر من المتبقي على الزبون.",
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

/** Device copy of the saved barber code, kept per account so a shared phone never mixes customers. */
export const savedBarberStorageKey = (userId: string) => `halaqi:barber-code:${userId}`;
