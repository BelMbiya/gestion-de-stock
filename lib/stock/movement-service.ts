import type { Prisma } from "@/lib/generated/prisma/client";

import { AssetNotFoundError, StockConflictError, StockRuleError } from "./errors";
import { type MovementInput, planMovement } from "./movement-rules";

type RecordMovementCommand = {
  assetId: string;
  input: MovementInput;
  /** Utilisateur connecte : seul auteur possible d'un mouvement. */
  actorId: string;
};

/**
 * Enregistre un mouvement de stock dans une transaction.
 * La quantite est modifiee par une mise a jour conditionnelle (atomique) : deux sorties
 * simultanees ne peuvent pas faire passer le stock sous 0, la seconde recoit un 409.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  { assetId, input, actorId }: RecordMovementCommand,
) {
  const asset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new AssetNotFoundError();
  }

  const plan = planMovement(asset, input);

  if (plan.holderId) {
    const holder = await tx.holder.findUnique({ where: { id: plan.holderId } });
    if (!holder) {
      throw new StockRuleError("Beneficiaire introuvable.");
    }
    if (!holder.active) {
      throw new StockRuleError("Ce beneficiaire est inactif : il ne peut plus recevoir de materiel.");
    }
  }

  if (plan.change !== 0) {
    const { count } = await tx.asset.updateMany({
      where:
        plan.change < 0
          ? { id: assetId, quantityOnHand: { gte: -plan.change } }
          : { id: assetId },
      data: { quantityOnHand: { increment: plan.change } },
    });
    if (count === 0) {
      throw new StockConflictError();
    }
  }

  if (plan.type === "TRANSFER") {
    await tx.asset.update({ where: { id: assetId }, data: { locationId: plan.toLocationId } });
  }

  const movement = await tx.stockMovement.create({
    data: {
      assetId,
      type: plan.type,
      quantity:
        plan.type === "ADJUSTMENT"
          ? plan.change
          : plan.type === "TRANSFER"
            ? asset.quantityOnHand
            : Math.abs(plan.change),
      fromLocationId: plan.type === "TRANSFER" ? asset.locationId : null,
      toLocationId: plan.toLocationId,
      holderId: plan.holderId,
      reason: plan.reason,
      performedById: actorId,
    },
  });

  const updated = await tx.asset.findUnique({ where: { id: assetId } });
  const quantityOnHand = updated?.quantityOnHand ?? plan.nextQuantity;

  await tx.auditLog.create({
    data: {
      action: plan.type === "TRANSFER" ? "TRANSFER" : "UPDATE",
      entityType: "StockMovement",
      entityId: movement.id,
      assetId,
      actorId,
      description: `Mouvement ${plan.type} : ${asset.quantityOnHand} -> ${quantityOnHand}`,
      metadata: {
        type: plan.type,
        change: plan.change,
        previousQty: asset.quantityOnHand,
        nextQty: quantityOnHand,
        reason: plan.reason,
        holderId: plan.holderId,
      },
    },
  });

  return { movement, quantityOnHand };
}
