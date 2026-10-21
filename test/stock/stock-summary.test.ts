// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildStockAlerts, buildStockSummary, countOverdueLoans } from "@/lib/stock/stock-summary";

const NOW = new Date("2026-10-21T10:00:00");

const assets = [
  { id: "l1", name: "HP LAPTOP", trackingMode: "SERIALIZED", status: "ASSIGNED", quantityOnHand: 1, minQuantity: 1 },
  { id: "l2", name: "DESKTOP", trackingMode: "SERIALIZED", status: "AVAILABLE", quantityOnHand: 1, minQuantity: 0 },
  { id: "m1", name: "Mouse vodacom", trackingMode: "BULK", status: "AVAILABLE", quantityOnHand: 8, minQuantity: 10 },
  { id: "c1", name: "CHAIR", trackingMode: "BULK", status: "AVAILABLE", quantityOnHand: 0, minQuantity: 0 },
  { id: "k1", name: "Keyboard vodacom", trackingMode: "BULK", status: "AVAILABLE", quantityOnHand: 129, minQuantity: 0 },
] as const;

const assignments = [
  { kind: "LOAN", status: "ACTIVE", expectedReturnAt: new Date("2026-10-20") },
  { kind: "LOAN", status: "ACTIVE", expectedReturnAt: new Date("2026-10-21T18:00:00") },
  { kind: "LOAN", status: "RETURNED", expectedReturnAt: new Date("2026-01-01") },
  { kind: "DOTATION", status: "ACTIVE", expectedReturnAt: null },
] as const;

describe("S6 — alertes de stock", () => {
  it("REGRESSION : aucun materiel unitaire ne declenche d'alerte (avant : 397 fausses alertes)", () => {
    const alerts = buildStockAlerts([...assets]);

    expect(alerts.map((alert) => alert.id).sort()).toEqual(["c1", "m1"]);
    expect(alerts.find((alert) => alert.id === "m1")?.level).toBe("LOW");
    expect(alerts.find((alert) => alert.id === "c1")?.level).toBe("OUT");
  });
});

describe("S6 — prets en retard", () => {
  it("compte les prets actifs dont l'echeance est passee (pas ceux du jour, ni les dotations)", () => {
    expect(countOverdueLoans([...assignments], NOW)).toBe(1);
  });
});

describe("S6 — synthese du tableau de bord", () => {
  it("separe unitaire et vrac", () => {
    expect(buildStockSummary({ assets: [...assets], assignments: [...assignments], now: NOW })).toEqual({
      serialized: { total: 2, assigned: 1 },
      bulk: { references: 3, pieces: 137 },
      stockAlerts: 2,
      overdueLoans: 1,
    });
  });

  it("le tableau de bord n'affiche plus la carte mal nommee « Status »", () => {
    const source = readFileSync(path.resolve(__dirname, "../../app/api/dashboard/route.ts"), "utf8");

    expect(source).not.toMatch(/label:\s*"Status"/);
  });
});
