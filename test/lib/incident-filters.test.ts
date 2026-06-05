import { describe, expect, it } from "vitest";

import {
  buildIncidentWhere,
  hasIncidentListFilters,
  parseIncidentSearchParams,
} from "@/lib/incident-filters";

describe("incident-filters", () => {
  it("detecte la presence de filtres", () => {
    expect(hasIncidentListFilters({})).toBe(false);
    expect(hasIncidentListFilters({ severity: "HIGH" })).toBe(true);
  });

  it("construit un filtre prisma par materiel et statut", () => {
    const params = new URLSearchParams({
      assetId: "asset-1",
      assigneeId: "user-1",
      severity: "CRITICAL",
      status: "IN_PROGRESS",
      period: "week",
    });

    const filters = parseIncidentSearchParams(params);
    const where = buildIncidentWhere(filters);

    expect(where.assetId).toBe("asset-1");
    expect(where.assigneeId).toBe("user-1");
    expect(where.severity).toBe("CRITICAL");
    expect(where.status).toBe("IN_PROGRESS");
    const identifiedAt = where.identifiedAt;
    expect(identifiedAt).toBeDefined();
    if (
      identifiedAt &&
      typeof identifiedAt === "object" &&
      !(identifiedAt instanceof Date)
    ) {
      expect(identifiedAt.gte).toBeInstanceOf(Date);
      expect(identifiedAt.lte).toBeInstanceOf(Date);
    }
  });
});
