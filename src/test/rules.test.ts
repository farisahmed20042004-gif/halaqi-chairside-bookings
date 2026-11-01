import { describe, expect, it } from "vitest";

import {
  arabicError,
  canCustomerCancel,
  customerBookingState,
  debtStatus,
  nextConfirmedBooking,
  normalizeCode,
  safeRedirect,
  savedBarberStorageKey,
  serviceFormError,
} from "@/lib/rules";

describe("debt payment status", () => {
  it("is unpaid when nothing has been paid", () => expect(debtStatus(15000, 0)).toBe("unpaid"));
  it("is partial when some is paid", () => expect(debtStatus(20000, 10000)).toBe("partial"));
  it("is paid when fully paid", () => expect(debtStatus(20000, 20000)).toBe("paid"));
});

describe("barber code entry", () => {
  it("ignores case and spaces", () => expect(normalizeCode(" hlq-ab 12cd ")).toBe("HLQ-AB12CD"));
});

describe("booking errors", () => {
  it("explains a slot taken by someone else", () => expect(arabicError({ message: "SLOT_TAKEN" })).toContain("حُجز"));
});

describe("post-login redirect", () => {
  it("allows same-site paths", () => expect(safeRedirect("/customer?code=HLQ-AAAAAA")).toBe("/customer?code=HLQ-AAAAAA"));
  it("blocks other sites", () => expect(safeRedirect("//evil.example")).toBeNull());
});

describe("service form", () => {
  it("accepts a normal service", () => expect(serviceFormError({ name: "قص شعر", price: 10000, duration: 30 })).toBeNull());
  it("requires a name of at least 2 letters", () => expect(serviceFormError({ name: " ق ", price: 10000, duration: 30 })).not.toBeNull());
  it("rejects a negative price", () => expect(serviceFormError({ name: "قص", price: -1, duration: 30 })).not.toBeNull());
  it("rejects a duration under 5 minutes", () => expect(serviceFormError({ name: "قص", price: 0, duration: 4 })).not.toBeNull());
  it("rejects a duration over 480 minutes", () => expect(serviceFormError({ name: "قص", price: 0, duration: 481 })).not.toBeNull());
});

describe("customer booking status", () => {
  it("shows a barber-cancelled booking as rejected", () =>
    expect(customerBookingState({ status: "cancelled", cancelled_by_barber: true })).toBe("rejected"));
  it("shows a booking the customer cancelled as cancelled, not rejected", () =>
    expect(customerBookingState({ status: "cancelled", cancelled_by_barber: false })).toBe("cancelled"));
  it("keeps confirmed bookings confirmed", () =>
    expect(customerBookingState({ status: "confirmed", cancelled_by_barber: false })).toBe("confirmed"));

  const now = new Date("2026-11-01T10:00:00Z");
  const list = [
    { id: "past", status: "confirmed", starts_at: "2026-10-31T10:00:00Z" },
    { id: "later", status: "confirmed", starts_at: "2026-11-05T10:00:00Z" },
    { id: "soon", status: "confirmed", starts_at: "2026-11-02T10:00:00Z" },
    { id: "pending", status: "pending", starts_at: "2026-11-01T12:00:00Z" },
  ];
  it("highlights the soonest upcoming confirmed booking", () => expect(nextConfirmedBooking(list, now)?.id).toBe("soon"));
  it("highlights nothing when no confirmed booking is upcoming", () =>
    expect(nextConfirmedBooking([list[0]!, list[3]!], now)).toBeNull());
  it("lets customers cancel only future pending or confirmed bookings", () => {
    expect(canCustomerCancel({ status: "confirmed", starts_at: "2026-11-02T10:00:00Z" }, now)).toBe(true);
    expect(canCustomerCancel({ status: "confirmed", starts_at: "2026-10-31T10:00:00Z" }, now)).toBe(false);
    expect(canCustomerCancel({ status: "completed", starts_at: "2026-11-02T10:00:00Z" }, now)).toBe(false);
  });
});

describe("saved barber on this phone", () => {
  it("is stored separately for each account", () => expect(savedBarberStorageKey("a")).not.toBe(savedBarberStorageKey("b")));
});
