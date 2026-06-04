import { describe, expect, it } from "vitest";

import { isAssignmentStockMovementReason } from "@/lib/assignment-management";

describe("material-history assignment movements", () => {
  it("exclut les sorties stock automatiques liees aux affectations", () => {
    const movements = [
      { id: "1", reason: "Affectation materiel (ACTIVE)" },
      { id: "2", reason: "Transfert vers entrepot central" },
      { id: "3", reason: "Suppression affectation active — retour stock" },
    ];

    const visible = movements.filter(
      (movement) => !isAssignmentStockMovementReason(movement.reason),
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe("2");
  });
});
