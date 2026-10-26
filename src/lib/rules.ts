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
  BARBER_NOT_FOUND: "لم نجد هذا الحلاق.",
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
