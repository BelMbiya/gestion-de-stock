import type {
  AssetStatus,
  MovementType,
  Prisma,
} from "@/lib/generated/prisma/client";

import { computeQuantityAfterMovement } from "@/lib/stock-management";

export class StockMovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockMovementError";
  }
}

export type ApplyStockMovementInput = {
  assetId: string;
  type: MovementType;
  quantity: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  reason?: string | null;
  performedById?: string | null;
};

export function validateStockMovement(
  type: MovementType,
  quantityOnHand: number,
  quantity: number,
  toLocationId?: string | null,
): string | null {
  if (!Number.isFinite(quantity)) {
    return "Quantite invalide";
  }

  if (type === "ADJUSTMENT") {
    if (quantity < 0) {
      return "La quantite ajustee ne peut pas etre negative";
    }
    return null;
  }

  if (quantity < 1) {
    return "La quantite doit etre au moins 1";
  }

  if (type === "OUT" && quantity > quantityOnHand) {
    return `Stock insuffisant (${quantityOnHand} disponible(s))`;
  }

  if (type === "TRANSFER" && !toLocationId) {
    return "Le transfert requiert un emplacement de destination";
  }

  return null;
}

export function resolveAssetStatusAfterMovement(
  currentStatus: AssetStatus,
  type: MovementType,
  nextQuantity: number,
): AssetStatus | undefined {
  if (type === "OUT" && nextQuantity === 0) {
    return "RETIRED";
  }

  if (
    (type === "IN" || type === "RETURN") &&
    currentStatus === "RETIRED" &&
    nextQuantity > 0
  ) {
    return "AVAILABLE";
  }

  return undefined;
}

export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  asset: {
    id: string;
    quantityOnHand: number;
    status: AssetStatus;
    locationId: string | null;
  },
  input: ApplyStockMovementInput,
) {
  const quantity =
    input.type === "ADJUSTMENT"
      ? Math.max(0, Math.floor(input.quantity))
      : Math.max(1, Math.floor(input.quantity));

  const validationError = validateStockMovement(
    input.type,
    asset.quantityOnHand,
    quantity,
    input.toLocationId,
  );

  if (validationError) {
    throw new StockMovementError(validationError);
  }

  const nextQuantity = computeQuantityAfterMovement(
    asset.quantityOnHand,
    input.type,
    quantity,
  );
  const nextStatus = resolveAssetStatusAfterMovement(
    asset.status,
    input.type,
    nextQuantity,
  );

  const movement = await tx.stockMovement.create({
    data: {
      assetId: asset.id,
      type: input.type,
      quantity,
      fromLocationId:
        input.fromLocationId ??
        (input.type === "TRANSFER" ? asset.locationId : null),
      toLocationId: input.toLocationId ?? null,
      reason: input.reason ?? null,
      performedById: input.performedById ?? null,
    },
  });

  await tx.asset.update({
    where: { id: asset.id },
    data: {
      quantityOnHand: nextQuantity,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(input.toLocationId ? { locationId: input.toLocationId } : {}),
    },
  });

  await tx.auditLog.create({
    data: {
      action: input.type === "TRANSFER" ? "TRANSFER" : "UPDATE",
      entityType: "StockMovement",
      entityId: movement.id,
      assetId: asset.id,
      description: `Mouvement ${input.type}: ${asset.quantityOnHand} -> ${nextQuantity}`,
      metadata: {
        type: input.type,
        quantity,
        previousQty: asset.quantityOnHand,
        nextQty: nextQuantity,
        reason: input.reason ?? null,
      },
    },
  });

  return { movement, quantityOnHand: nextQuantity };
}
