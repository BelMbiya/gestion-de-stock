import type { AssetCondition } from "@/lib/generated/prisma/enums";

export const conditionValues = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

export const conditionLabels: Record<AssetCondition, string> = {
  NEW: "Neuf",
  GOOD: "Bon etat",
  FAIR: "Etat moyen",
  POOR: "Mauvais etat",
  DAMAGED: "Endommage",
};

export function normalizeAssetCondition(condition: unknown): AssetCondition {
  return conditionValues.find((value) => value === condition) ?? "GOOD";
}
