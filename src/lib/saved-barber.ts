// Device copy of the customer's saved barber code. The database copy
// (customer_barbers) is the source of truth; this only makes the next
// app open instant and restores the link if the database copy is missing.
// Call only from effects or event handlers (browser storage).
import { savedBarberStorageKey } from "@/lib/rules";

export function readSavedCode(userId: string): string | null {
  try {
    return window.localStorage.getItem(savedBarberStorageKey(userId));
  } catch {
    return null;
  }
}

export function writeSavedCode(userId: string, code: string) {
  try {
    window.localStorage.setItem(savedBarberStorageKey(userId), code);
  } catch {
    /* storage unavailable (private mode) — the database copy still works */
  }
}

export function clearSavedCode(userId: string) {
  try {
    window.localStorage.removeItem(savedBarberStorageKey(userId));
  } catch {
    /* ignore */
  }
}
