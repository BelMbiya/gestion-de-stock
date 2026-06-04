import type { AssignmentStatus, AssetStatus } from "@/lib/generated/prisma/client";

export const assignmentStatuses = ["ACTIVE", "RETURNED", "TRANSFERRED"] as const;

export const assignmentStatusLabels: Record<string, string> = {
  ACTIVE: "Alloue",
  RETURNED: "Retourne",
  TRANSFERRED: "Transfere",
};

export function normalizeAssignmentStatus(status: unknown) {
  return assignmentStatuses.find((value) => value === status) ?? "ACTIVE";
}

export function getAssetStatusForAssignment(
  status: AssignmentStatus,
): AssetStatus {
  if (status === "RETURNED") {
    return "AVAILABLE";
  }
  return "ASSIGNED";
}

export function shouldIssueStockOut(status: AssignmentStatus) {
  return status === "ACTIVE" || status === "TRANSFERRED";
}

export function shouldIssueStockIn(status: AssignmentStatus) {
  return status === "RETURNED";
}

function isStockConsumingStatus(status: AssignmentStatus) {
  return status === "ACTIVE" || status === "TRANSFERRED";
}

/**
 * Sortie stock (-1) a la creation ou reactivation d'une affectation active.
 * Pas de seconde sortie si l'on passe seulement ACTIVE -> TRANSFERRED.
 */
export function shouldIssueStockOutOnTransition(
  previous: AssignmentStatus | null,
  next: AssignmentStatus,
) {
  if (previous === null) {
    return shouldIssueStockOut(next);
  }

  return !isStockConsumingStatus(previous) && isStockConsumingStatus(next);
}

/** Reception stock uniquement au passage vers Retourne. */
export function shouldIssueStockInOnTransition(
  previous: AssignmentStatus | null,
  next: AssignmentStatus,
) {
  return isStockConsumingStatus(previous ?? "RETURNED") && next === "RETURNED";
}

/** Mouvements stock generes automatiquement par une affectation (deja visibles comme « Affectation »). */
export function isAssignmentStockMovementReason(reason: string | null | undefined) {
  if (!reason) {
    return false;
  }

  const normalized = reason.toLowerCase();
  return (
    normalized.includes("affectation materiel") ||
    normalized.includes("mise a jour affectation") ||
    normalized.includes("changement de materiel") ||
    normalized.includes("suppression affectation")
  );
}

export function revalidateAssignmentTags() {
  return [
    "assignments",
    "dashboard",
    "history",
    "inventory",
    "stock",
    "reports",
    "notifications",
  ] as const;
}
