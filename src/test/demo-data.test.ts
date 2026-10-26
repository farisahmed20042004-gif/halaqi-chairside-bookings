import { describe, expect, it } from "vitest";

import { debtStatus, isDemoBarberCode } from "@/lib/demo-data";

describe("debt payment status", () => {
  it("is unpaid when nothing has been paid", () => {
    expect(debtStatus({ amount: 15000, paid: 0 })).toBe("unpaid");
  });
  it("is partial when some but not all is paid", () => {
    expect(debtStatus({ amount: 20000, paid: 10000 })).toBe("partial");
  });
  it("is paid when the full amount is paid", () => {
    expect(debtStatus({ amount: 20000, paid: 20000 })).toBe("paid");
  });
});

describe("barber code entry", () => {
  it("accepts the demo code regardless of case and spaces", () => {
    expect(isDemoBarberCode(" hlq-2048 ")).toBe(true);
  });
  it("rejects a wrong code", () => {
    expect(isDemoBarberCode("HLQ-1111")).toBe(false);
  });
});
