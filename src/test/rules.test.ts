import { describe, expect, it } from "vitest";

import { arabicError, debtStatus, normalizeCode, safeRedirect, serviceFormError } from "@/lib/rules";

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
