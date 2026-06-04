import { describe, expect, it } from "vitest";

import {
  getResolutionStepState,
  sortIncidentsByResolutionPriority,
} from "@/lib/incident-resolution";

describe("incident-resolution", () => {
  it("trie les pannes: nouvelles, en cours, puis resolues", () => {
    const sorted = sortIncidentsByResolutionPriority([
      { id: "a", progress: 100, statusCode: "CLOSED" },
      { id: "b", progress: 15, statusCode: "IDENTIFIED" },
      { id: "c", progress: 55, statusCode: "IN_PROGRESS" },
    ]);

    expect(sorted.map((item) => item.statusCode)).toEqual([
      "IDENTIFIED",
      "IN_PROGRESS",
      "CLOSED",
    ]);
  });

  it("adapte la legende selon le statut de la panne selectionnee", () => {
    expect(getResolutionStepState(0, "IDENTIFIED")).toBe("current");
    expect(getResolutionStepState(1, "IDENTIFIED")).toBe("pending");
    expect(getResolutionStepState(0, "DIAGNOSING")).toBe("completed");
    expect(getResolutionStepState(1, "DIAGNOSING")).toBe("current");
    expect(getResolutionStepState(2, "IN_PROGRESS")).toBe("current");
    expect(getResolutionStepState(4, "CLOSED")).toBe("completed");
  });
});
