import { describe, expect, it } from "vitest";

import { assignmentStatusLabels } from "@/lib/assignment-management";

describe("assignment-management", () => {
  it("expose les libelles francais des statuts d'affectation", () => {
    expect(assignmentStatusLabels.ACTIVE).toBe("En cours");
    expect(assignmentStatusLabels.RETURNED).toBe("Retourne");
    expect(assignmentStatusLabels.TRANSFERRED).toBe("Transfere");
  });
});
