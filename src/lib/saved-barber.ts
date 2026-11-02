// Device copy of the customer's saved barbers, stored as one array under
// "halaqi_barbers_list". The database copy (customer_barbers) is the source of
// truth; this only restores codes the database is missing (e.g. saved offline).
// Call only from effects or event handlers (browser storage).
import {
  addSavedBarber,
  legacySavedBarberKey,
  parseSavedBarbers,
  removeSavedBarber,
  SAVED_BARBERS_KEY,
  savedCodesFor,
  type SavedBarberEntry,
} from "@/lib/rules";

function load(): SavedBarberEntry[] {
  try {
    return parseSavedBarbers(window.localStorage.getItem(SAVED_BARBERS_KEY));
  } catch {
    return [];
  }
}

function store(list: SavedBarberEntry[]) {
  try {
    window.localStorage.setItem(SAVED_BARBERS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode) — the database copy still works */
  }
}

export function readSavedCodes(userId: string): string[] {
  let list = load();
  try {
    const legacy = window.localStorage.getItem(legacySavedBarberKey(userId));
    if (legacy) {
      list = addSavedBarber(list, { user_id: userId, code: legacy });
      store(list);
      window.localStorage.removeItem(legacySavedBarberKey(userId));
    }
  } catch {
    /* ignore */
  }
  return savedCodesFor(list, userId);
}

export function addSavedCode(userId: string, code: string, shopName?: string) {
  const list = load();
  const next = addSavedBarber(list, { user_id: userId, code, shop_name: shopName });
  if (next !== list) store(next);
}

export function removeSavedCode(userId: string, code: string) {
  store(removeSavedBarber(load(), userId, code));
}
