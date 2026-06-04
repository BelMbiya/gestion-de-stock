import { describe, expect, it } from "vitest";

import {
  getAssignmentReturnAlert,
  getAssignmentReturnAlertLabel,
  getDaysUntilDate,
} from "@/lib/assignment-alerts";

describe("assignment-alerts", () => {
  const now = new Date("2026-06-03T12:00:00");

  it("calcule les jours restants", () => {
    expect(getDaysUntilDate(new Date("2026-06-08"), now)).toBe(5);
    expect(getDaysUntilDate(new Date("2026-06-02"), now)).toBe(-1);
  });

  it("alerte a J-5 ou moins et en retard", () => {
    expect(
      getAssignmentReturnAlert(new Date("2026-06-08"), "ACTIVE", now),
    ).toBe("DUE_SOON");
    expect(
      getAssignmentReturnAlert(new Date("2026-06-10"), "ACTIVE", now),
    ).toBeNull();
    expect(
      getAssignmentReturnAlert(new Date("2026-06-01"), "ACTIVE", now),
    ).toBe("OVERDUE");
    expect(getAssignmentReturnAlert(new Date("2026-06-08"), "RETURNED", now)).toBeNull();
  });

  it("fournit un libelle lisible", () => {
    expect(getAssignmentReturnAlertLabel("DUE_SOON")).toMatch(/5 jours/);
    expect(getAssignmentReturnAlertLabel("OVERDUE")).toMatch(/retard/);
  });
});
