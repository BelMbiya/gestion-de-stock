import { describe, expect, it } from "vitest";

import {
  buildSupportTicketWhere,
  hasSupportTicketListFilters,
  parseSupportTicketSearchParams,
} from "@/lib/support-ticket-filters";

describe("support-ticket-filters", () => {
  it("parse les parametres de recherche", () => {
    const params = parseSupportTicketSearchParams(
      new URLSearchParams("status=OPEN&priority=HIGH&category=NETWORK"),
    );

    expect(params.status).toBe("OPEN");
    expect(params.priority).toBe("HIGH");
    expect(params.category).toBe("NETWORK");
  });

  it("detecte les filtres actifs", () => {
    expect(hasSupportTicketListFilters({ status: "OPEN" })).toBe(true);
    expect(hasSupportTicketListFilters({})).toBe(false);
  });

  it("construit le where Prisma", () => {
    const where = buildSupportTicketWhere({
      status: "IN_PROGRESS",
      assigneeId: "user-1",
    });

    expect(where).toEqual({
      status: "IN_PROGRESS",
      assigneeId: "user-1",
    });
  });
});
