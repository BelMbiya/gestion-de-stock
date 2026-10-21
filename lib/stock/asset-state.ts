import type { AssetStatus, Prisma } from "@/lib/generated/prisma/client";

import { AssetHasHistoryError, AssetNotFoundError, StockRuleError } from "./errors";

export const assetStatusLabels: Record<AssetStatus, string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Affecte",
  MAINTENANCE: "Maintenance",
  BROKEN: "En panne",
  RETIRED: "Reforme",
  LOST: "Perdu",
};

/** Cibles de « Changer l'etat ». Disponible / Affecte passent par affectation, retour ou remise en service. */
export const assetStateTargets = ["MAINTENANCE", "BROKEN", "RETIRED", "LOST", "IN_SERVICE"] as const;
export type AssetStateTarget = (typeof assetStateTargets)[number];

const BULK_TARGETS: readonly AssetStateTarget[] = ["RETIRED", "IN_SERVICE"];

type ChangeStateCommand = {
  assetId: string;
  target: AssetStateTarget;
  reason: unknown;
  actorId: string;
};

export async function changeAssetState(
  tx: Prisma.TransactionClient,
  { assetId, target, reason, actorId }: ChangeStateCommand,
) {
  if (!assetStateTargets.includes(target)) {
    throw new StockRuleError(
      "Etat cible invalide : Disponible et Affecte passent par une affectation, un retour ou une remise en service.",
    );
  }

  const motive = typeof reason === "string" ? reason.trim() : "";
  if (!motive) {
    throw new StockRuleError("Le motif est obligatoire pour changer l'etat.");
  }

  const asset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new AssetNotFoundError();
  }

  if (asset.trackingMode === "BULK" && !BULK_TARGETS.includes(target)) {
    throw new StockRuleError("Article en vrac : seuls « Reformer » et « Remettre en service » s'appliquent.");
  }

  const activeAssignments = await tx.assetAssignment.count({ where: { assetId, status: "ACTIVE" } });

  if ((target === "RETIRED" || target === "LOST") && activeAssignments > 0) {
    throw new StockRuleError(
      "Recuperez d'abord le materiel (retour de l'affectation en cours) avant de le declarer reforme ou perdu.",
    );
  }

  const nextStatus: AssetStatus =
    target === "IN_SERVICE" ? (activeAssignments > 0 ? "ASSIGNED" : "AVAILABLE") : target;

  if (nextStatus === asset.status) {
    throw new StockRuleError(`L'article est deja « ${assetStatusLabels[nextStatus]} ».`);
  }

  const updated = await tx.asset.update({ where: { id: assetId }, data: { status: nextStatus } });

  await tx.auditLog.create({
    data: {
      action: "STATUS_CHANGE",
      entityType: "Asset",
      entityId: assetId,
      assetId,
      actorId,
      description: `Etat : ${assetStatusLabels[asset.status]} -> ${assetStatusLabels[nextStatus]} (${motive})`,
      metadata: { from: asset.status, to: nextStatus, reason: motive },
    },
  });

  return updated;
}

const LOCKED_FIELDS: Record<string, string> = {
  status:
    "Le statut ne se modifie pas depuis la fiche : utilisez une affectation, un retour ou « Changer l'etat ».",
  locationId: "Le site ne se modifie pas depuis la fiche : enregistrez un transfert.",
  quantityOnHand:
    "La quantite ne se modifie pas depuis la fiche : enregistrez un mouvement (entree, sortie ou ajustement).",
  trackingMode: "Le mode de suivi est fixe a la creation de l'article.",
  sku: "Le code materiel est definitif : il est genere a la creation et ne se modifie pas.",
  typeId: "Le type se corrige par « Corriger le type » (nouveau code, ancien conserve dans l'historique).",
  categoryId: "La categorie decoule du type de materiel.",
};

/** Refuse les champs qui ne peuvent changer qu'a travers une action tracee. */
export function assertEditableFields(body: Record<string, unknown>) {
  for (const [field, message] of Object.entries(LOCKED_FIELDS)) {
    if (body[field] !== undefined) {
      throw new StockRuleError(message);
    }
  }
}

/** Un article avec historique ne se supprime pas (on le reforme) ; sinon l'historique serait perdu. */
export async function assertAssetDeletable(tx: Prisma.TransactionClient, assetId: string) {
  const counts = await Promise.all([
    tx.stockMovement.count({ where: { assetId } }),
    tx.assetAssignment.count({ where: { assetId } }),
    tx.incident.count({ where: { assetId } }),
    tx.inventoryCheck.count({ where: { assetId } }),
    tx.supportTicket.count({ where: { assetId } }),
    // La trace de creation seule n'est pas un historique d'utilisation.
    tx.auditLog.count({ where: { assetId, action: { not: "CREATE" } } }),
  ]);

  if (counts.some((count) => count > 0)) {
    throw new AssetHasHistoryError();
  }
}
