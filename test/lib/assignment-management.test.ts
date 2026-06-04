import { describe, expect, it } from "vitest";

import {
  assignmentStatusLabels,
  getAssetStatusForAssignment,
  isAssignmentStockMovementReason,
  normalizeAssignmentStatus,
  shouldIssueStockIn,
  shouldIssueStockInOnTransition,
  shouldIssueStockOut,
  shouldIssueStockOutOnTransition,
} from "@/lib/assignment-management";

describe("assignment-management", () => {
  it("normalise les statuts d'affectation", () => {
    expect(normalizeAssignmentStatus("RETURNED")).toBe("RETURNED");
    expect(normalizeAssignmentStatus("invalid")).toBe("ACTIVE");
  });

  it("mappe le statut materiel selon l'affectation", () => {
    expect(getAssetStatusForAssignment("ACTIVE")).toBe("ASSIGNED");
    expect(getAssetStatusForAssignment("TRANSFERRED")).toBe("ASSIGNED");
    expect(getAssetStatusForAssignment("RETURNED")).toBe("AVAILABLE");
  });

  it("decide quand emettre un mouvement stock", () => {
    expect(shouldIssueStockOut("ACTIVE")).toBe(true);
    expect(shouldIssueStockOut("TRANSFERRED")).toBe(true);
    expect(shouldIssueStockOut("RETURNED")).toBe(false);
    expect(shouldIssueStockIn("RETURNED")).toBe(true);
    expect(shouldIssueStockIn("ACTIVE")).toBe(false);
  });

  it("n'emet une sortie stock qu'a l'entree en affectation active", () => {
    expect(shouldIssueStockOutOnTransition(null, "ACTIVE")).toBe(true);
    expect(shouldIssueStockOutOnTransition("ACTIVE", "TRANSFERRED")).toBe(false);
    expect(shouldIssueStockOutOnTransition("RETURNED", "ACTIVE")).toBe(true);
    expect(shouldIssueStockInOnTransition("ACTIVE", "RETURNED")).toBe(true);
    expect(shouldIssueStockInOnTransition("ACTIVE", "TRANSFERRED")).toBe(false);
  });

  it("expose les libelles francais", () => {
    expect(assignmentStatusLabels.ACTIVE).toBe("Alloue");
    expect(assignmentStatusLabels.RETURNED).toBe("Retourne");
  });

  it("detecte les mouvements stock issus d'une affectation", () => {
    expect(isAssignmentStockMovementReason("Affectation materiel (ACTIVE)")).toBe(
      true,
    );
    expect(isAssignmentStockMovementReason("Transfert manuel vers depot")).toBe(
      false,
    );
  });
});
