import type { MovementType } from "@/lib/generated/prisma/client";

export const assetStatusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Assigne",
  MAINTENANCE: "Maintenance",
  BROKEN: "Critique",
  RETIRED: "Reforme",
  LOST: "Perdu",
};

export const assetStatusValues = [
  "AVAILABLE",
  "ASSIGNED",
  "MAINTENANCE",
  "BROKEN",
  "RETIRED",
  "LOST",
] as const;

export const conditionValues = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

export const conditionLabels: Record<string, string> = {
  NEW: "Neuf",
  GOOD: "Bon etat",
  FAIR: "Etat moyen",
  POOR: "Mauvais etat",
  DAMAGED: "Endommage",
};

export function normalizeAssetCondition(condition: unknown) {
  return conditionValues.find((value) => value === condition) ?? "GOOD";
}

export const movementTypeLabels: Record<string, string> = {
  IN: "Entree stock",
  OUT: "Sortie stock",
  TRANSFER: "Transfert",
  ADJUSTMENT: "Ajustement",
  RETURN: "Retour stock",
};

export const movementTypes = ["IN", "OUT", "TRANSFER", "ADJUSTMENT", "RETURN"] as const;

export type StockLevelStatus = "OK" | "LOW" | "OUT" | "OVER";

export function normalizeAssetStatus(status: unknown) {
  return assetStatusValues.find((value) => value === status) ?? "AVAILABLE";
}

export function normalizeMovementType(type: unknown) {
  return movementTypes.find((value) => value === type) ?? "ADJUSTMENT";
}

export function getStockLevelStatus(
  quantityOnHand: number,
  reorderPoint: number,
  minQuantity: number,
  maxQuantity: number | null,
): StockLevelStatus {
  if (quantityOnHand <= 0) {
    return "OUT";
  }

  if (maxQuantity !== null && quantityOnHand > maxQuantity) {
    return "OVER";
  }

  if (quantityOnHand <= minQuantity || quantityOnHand <= reorderPoint) {
    return "LOW";
  }

  return "OK";
}

export function getStockLevelLabel(status: StockLevelStatus) {
  switch (status) {
    case "OUT":
      return "Rupture";
    case "LOW":
      return "Stock bas";
    case "OVER":
      return "Surstock";
    default:
      return "OK";
  }
}

export function computeQuantityAfterMovement(
  currentQuantity: number,
  type: MovementType,
  quantity: number,
) {
  switch (type) {
    case "IN":
    case "RETURN":
      return currentQuantity + quantity;
    case "OUT":
      return Math.max(0, currentQuantity - quantity);
    case "ADJUSTMENT":
      return Math.max(0, quantity);
    case "TRANSFER":
    default:
      return currentQuantity;
  }
}

export function revalidateStockTags() {
  return [
    "dashboard",
    "history",
    "inventory",
    "movements",
    "reports",
    "notifications",
    "stock",
  ] as const;
}
