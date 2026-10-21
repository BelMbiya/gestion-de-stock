import type { TrackingMode } from "@/lib/generated/prisma/enums";

import { getTrackingPolicy, type StockLevel } from "./tracking-policy";

type SummaryAsset = {
  id: string;
  name: string;
  trackingMode: TrackingMode;
  status: string;
  quantityOnHand: number;
  minQuantity: number;
};

type SummaryAssignment = {
  kind: string;
  status: string;
  expectedReturnAt: Date | null;
};

export type StockAlert = {
  id: string;
  name: string;
  level: Extract<StockLevel, "LOW" | "OUT">;
  quantityOnHand: number;
  minQuantity: number;
};

/** Alertes de stock : uniquement les articles en vrac en rupture ou sous leur seuil. */
export function buildStockAlerts(assets: readonly SummaryAsset[]): StockAlert[] {
  return assets.flatMap((asset) => {
    const level = getTrackingPolicy(asset.trackingMode).stockLevel(asset);
    return level === "LOW" || level === "OUT"
      ? [{ id: asset.id, name: asset.name, level, quantityOnHand: asset.quantityOnHand, minQuantity: asset.minQuantity }]
      : [];
  });
}

/** Prets en cours dont l'echeance est passee (avant aujourd'hui). Une dotation n'est jamais en retard. */
export function isOverdueLoan(assignment: SummaryAssignment, now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return (
    assignment.kind === "LOAN" &&
    assignment.status === "ACTIVE" &&
    assignment.expectedReturnAt !== null &&
    assignment.expectedReturnAt < today
  );
}

export function countOverdueLoans(assignments: readonly SummaryAssignment[], now: Date) {
  return assignments.filter((assignment) => isOverdueLoan(assignment, now)).length;
}

export function buildStockSummary({
  assets,
  assignments,
  now,
}: {
  assets: readonly SummaryAsset[];
  assignments: readonly SummaryAssignment[];
  now: Date;
}) {
  const serialized = assets.filter((asset) => asset.trackingMode === "SERIALIZED");
  const bulk = assets.filter((asset) => asset.trackingMode === "BULK");

  return {
    serialized: {
      total: serialized.length,
      assigned: serialized.filter((asset) => asset.status === "ASSIGNED").length,
    },
    bulk: {
      references: bulk.length,
      pieces: bulk.reduce((sum, asset) => sum + asset.quantityOnHand, 0),
    },
    stockAlerts: buildStockAlerts(assets).length,
    overdueLoans: countOverdueLoans(assignments, now),
  };
}
