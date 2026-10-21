import type { MovementType, TrackingMode } from "@/lib/generated/prisma/enums";

export type StockLevel = "NONE" | "OK" | "LOW" | "OUT";

export const stockLevelLabels: Record<StockLevel, string> = {
  NONE: "-",
  OK: "OK",
  LOW: "Stock bas",
  OUT: "Rupture",
};

export const trackingModeLabels: Record<TrackingMode, string> = {
  SERIALIZED: "Unitaire",
  BULK: "En vrac",
};

type StockQuantities = { quantityOnHand: number; minQuantity: number };

/** Strategy : chaque mode de suivi porte ses propres regles de stock. */
export type TrackingPolicy = {
  mode: TrackingMode;
  allowedMovements: readonly MovementType[];
  canAssign: boolean;
  stockLevel(asset: StockQuantities): StockLevel;
};

const serializedPolicy: TrackingPolicy = {
  mode: "SERIALIZED",
  // Un materiel unitaire change de mains par affectation, pas par entree / sortie.
  allowedMovements: ["TRANSFER"],
  canAssign: true,
  stockLevel: () => "NONE",
};

const bulkPolicy: TrackingPolicy = {
  mode: "BULK",
  allowedMovements: ["IN", "OUT", "RETURN", "ADJUSTMENT", "TRANSFER"],
  canAssign: false,
  stockLevel({ quantityOnHand, minQuantity }) {
    if (quantityOnHand <= 0) return "OUT";
    if (minQuantity > 0 && quantityOnHand <= minQuantity) return "LOW";
    return "OK";
  },
};

const policies: Record<TrackingMode, TrackingPolicy> = {
  SERIALIZED: serializedPolicy,
  BULK: bulkPolicy,
};

export function getTrackingPolicy(mode: TrackingMode): TrackingPolicy {
  const policy = policies[mode];
  if (!policy) {
    throw new Error(`Mode de suivi inconnu : ${String(mode)}`);
  }
  return policy;
}

export function normalizeTrackingMode(mode: unknown): TrackingMode | null {
  return mode === "SERIALIZED" || mode === "BULK" ? mode : null;
}
