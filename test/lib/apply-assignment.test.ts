import { describe, expect, it } from "vitest";

import { ASSIGNMENT_STOCK_QUANTITY } from "@/lib/apply-assignment";
import {
  shouldIssueStockInOnTransition,
  shouldIssueStockOut,
  shouldIssueStockOutOnTransition,
} from "@/lib/assignment-management";

describe("apply-assignment stock", () => {
  it("retire une unite en stock a chaque nouvelle affectation active", () => {
    expect(ASSIGNMENT_STOCK_QUANTITY).toBe(1);
    expect(shouldIssueStockOutOnTransition(null, "ACTIVE")).toBe(true);
    expect(shouldIssueStockOutOnTransition(null, "TRANSFERRED")).toBe(true);
    expect(shouldIssueStockOut("ACTIVE")).toBe(true);
  });

  it("ne retire pas deux fois entre Alloue et Transfere", () => {
    expect(shouldIssueStockOutOnTransition("ACTIVE", "TRANSFERRED")).toBe(false);
  });

  it("restitue le stock au retour", () => {
    expect(shouldIssueStockInOnTransition("ACTIVE", "RETURNED")).toBe(true);
    expect(shouldIssueStockInOnTransition("TRANSFERRED", "RETURNED")).toBe(true);
  });
});
