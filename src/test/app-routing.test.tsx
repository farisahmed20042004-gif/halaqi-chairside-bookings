import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering.
describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    expect(router.matchRoutes("/").at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("has a public sign-in page", () => {
    expect(router.matchRoutes("/auth").at(-1)?.routeId).toBe("/auth");
  });

  it.each(["/barber", "/customer", "/appointments", "/debts", "/my-bookings", "/settings"])("keeps %s behind sign-in", (path) => {
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(`/_authenticated${path}`);
  });
});
