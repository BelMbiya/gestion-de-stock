import type { AssignmentStatus, Prisma } from "@/lib/generated/prisma/client";

import { applyStockMovement, StockMovementError } from "@/lib/apply-stock-movement";
import {
  getAssetStatusForAssignment,
  shouldIssueStockInOnTransition,
  shouldIssueStockOutOnTransition,
} from "@/lib/assignment-management";
import { getStockLevelStatus } from "@/lib/stock-management";

export class AssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentError";
  }
}

export async function assertAssetAssignable(
  tx: Prisma.TransactionClient,
  assetId: string,
  excludeAssignmentId?: string,
) {
  const asset = await tx.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    throw new AssignmentError("Materiel introuvable");
  }

  if (asset.status !== "AVAILABLE" && asset.status !== "ASSIGNED") {
    throw new AssignmentError(
      `Ce materiel n'est pas disponible pour affectation (statut: ${asset.status})`,
    );
  }

  const activeCount = await tx.assetAssignment.count({
    where: {
      assetId,
      status: "ACTIVE",
      ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
    },
  });

  if (activeCount > 0) {
    throw new AssignmentError("Ce materiel a deja une affectation active");
  }

  const stockLevel = getStockLevelStatus(
    asset.quantityOnHand,
    asset.reorderPoint,
    asset.minQuantity,
    asset.maxQuantity,
  );

  if (stockLevel === "OUT" || asset.quantityOnHand <= 0) {
    throw new AssignmentError(
      "Ce materiel est en rupture de stock et ne peut pas etre affecte",
    );
  }

  return asset;
}

/** Quantite retiree ou restituee en stock pour une affectation unitaire. */
export const ASSIGNMENT_STOCK_QUANTITY = 1;

async function loadAssetForMovement(tx: Prisma.TransactionClient, assetId: string) {
  const asset = await tx.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    throw new AssignmentError("Materiel introuvable");
  }

  return asset;
}

export async function syncAssignmentSideEffects(
  tx: Prisma.TransactionClient,
  assetId: string,
  previousStatus: AssignmentStatus | null,
  status: AssignmentStatus,
  reason: string,
) {
  const issuingOut = shouldIssueStockOutOnTransition(previousStatus, status);
  const issuingIn = shouldIssueStockInOnTransition(previousStatus, status);

  if (issuingOut) {
    await tx.asset.update({
      where: { id: assetId },
      data: { status: getAssetStatusForAssignment(status) },
    });

    const asset = await loadAssetForMovement(tx, assetId);
    try {
      await applyStockMovement(tx, asset, {
        assetId,
        type: "OUT",
        quantity: ASSIGNMENT_STOCK_QUANTITY,
        reason,
      });
    } catch (error) {
      if (error instanceof StockMovementError) {
        throw new AssignmentError(error.message);
      }
      throw error;
    }
    return;
  }

  if (issuingIn) {
    const asset = await loadAssetForMovement(tx, assetId);
    await applyStockMovement(tx, asset, {
      assetId,
      type: "IN",
      quantity: ASSIGNMENT_STOCK_QUANTITY,
      reason,
    });
  }

  await tx.asset.update({
    where: { id: assetId },
    data: { status: getAssetStatusForAssignment(status) },
  });
}

export function validateAssignmentPayload(
  body: {
    assetId?: unknown;
    status?: unknown;
    expectedReturnAt?: unknown;
  },
  options?: { requireAsset?: boolean },
) {
  const status = String(body.status ?? "ACTIVE");
  const requireAsset = options?.requireAsset ?? true;

  if (requireAsset && (!body.assetId || !String(body.assetId).trim())) {
    return "Selectionnez un materiel a affecter";
  }

  if (
    (status === "ACTIVE" || status === "TRANSFERRED") &&
    !body.expectedReturnAt
  ) {
    return "Indiquez la date de retour prevu pour une affectation active";
  }

  return null;
}

export async function createAssignmentAudit(
  tx: Prisma.TransactionClient,
  action: "CREATE" | "UPDATE" | "DELETE",
  assignmentId: string,
  assetId: string,
  description: string,
) {
  await tx.auditLog.create({
    data: {
      action: action === "DELETE" ? "DELETE" : "ASSIGN",
      entityType: "AssetAssignment",
      entityId: assignmentId,
      assetId,
      description,
    },
  });
}
