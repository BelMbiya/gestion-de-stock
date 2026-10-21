import type { Prisma, TrackingMode } from "@/lib/generated/prisma/client";
import { normalizeImageUrl } from "@/lib/asset-image";
import { AssetNotFoundError, StockRuleError } from "@/lib/stock/errors";
import { normalizeTrackingMode } from "@/lib/stock/tracking-policy";
import { normalizeAssetCondition } from "@/lib/stock-management";

import { allocateAssetCode } from "./asset-code";

type Tx = Prisma.TransactionClient;

/** Saisie de creation : le code et la categorie ne sont jamais fournis par le client. */
export type CreateAssetInput = {
  typeId: unknown;
  trackingMode?: unknown;
  name: unknown;
  serialNumber?: unknown;
  quantityOnHand?: unknown;
  minQuantity?: unknown;
  barcode?: unknown;
  brand?: unknown;
  model?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  condition?: unknown;
  unit?: unknown;
  purchaseValue?: unknown;
  purchaseDate?: unknown;
  warrantyUntil?: unknown;
  locationId?: unknown;
  supplierId?: unknown;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const date = (value: unknown) => (value ? new Date(String(value)) : null);

function nonNegativeInteger(value: unknown, label: string) {
  const number = value === undefined || value === null || value === "" ? 0 : Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new StockRuleError(`${label} : un entier positif ou nul est attendu.`);
  }
  return number;
}

async function activeType(tx: Tx, typeId: unknown) {
  const type = typeof typeId === "string" && typeId ? await tx.assetType.findUnique({ where: { id: typeId } }) : null;
  if (!type || !type.active) {
    throw new StockRuleError("Type de materiel inconnu ou desactive.");
  }
  return type;
}

/** Cree un article : code genere selon le type, categorie = famille du type, stock initial trace. */
export async function createAsset(tx: Tx, input: CreateAssetInput, actorId: string) {
  // Toutes les verifications avant de reserver un numero (un refus ne consomme rien).
  const type = await activeType(tx, input.typeId);
  const name = text(input.name);
  if (!name) {
    throw new StockRuleError("La description est obligatoire.");
  }
  const trackingMode: TrackingMode = normalizeTrackingMode(input.trackingMode) ?? type.defaultTrackingMode;
  const isBulk = trackingMode === "BULK";
  const quantityOnHand = isBulk ? nonNegativeInteger(input.quantityOnHand, "Quantite initiale") : 1;
  const minQuantity = isBulk ? nonNegativeInteger(input.minQuantity, "Seuil d'alerte") : 0;

  const sku = await allocateAssetCode(tx, type.id);

  const asset = await tx.asset.create({
    data: {
      sku,
      importRef: null,
      typeId: type.id,
      categoryId: type.categoryId,
      name,
      trackingMode,
      status: "AVAILABLE",
      quantityOnHand,
      minQuantity,
      serialNumber: isBulk ? null : text(input.serialNumber),
      barcode: text(input.barcode),
      brand: text(input.brand),
      model: text(input.model),
      description: text(input.description),
      imageUrl: normalizeImageUrl(input.imageUrl),
      condition: normalizeAssetCondition(input.condition),
      unit: text(input.unit) ?? (isBulk ? "piece" : "unite"),
      purchaseValue: text(input.purchaseValue),
      purchaseDate: date(input.purchaseDate),
      warrantyUntil: date(input.warrantyUntil),
      locationId: text(input.locationId),
      supplierId: text(input.supplierId),
      createdById: actorId,
    },
  });

  if (isBulk && quantityOnHand > 0) {
    await tx.stockMovement.create({
      data: {
        assetId: asset.id,
        type: "IN",
        quantity: quantityOnHand,
        toLocationId: asset.locationId,
        reason: "Stock initial a la creation de l'article",
        performedById: actorId,
      },
    });
  }

  await tx.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "Asset",
      entityId: asset.id,
      assetId: asset.id,
      actorId,
      description: `Article cree : ${sku} (${type.name})`,
    },
  });

  return asset;
}

type ChangeTypeCommand = { assetId: string; typeId: string; reason: unknown; actorId: string };

/** Corrige un type mal saisi : nouveau code du bon type, l'ancien reste dans l'historique. */
export async function changeAssetType(tx: Tx, { assetId, typeId, reason, actorId }: ChangeTypeCommand) {
  const motive = text(reason);
  if (!motive) {
    throw new StockRuleError("Le motif est obligatoire pour corriger le type.");
  }

  const asset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new AssetNotFoundError();
  }
  if (asset.typeId === typeId) {
    throw new StockRuleError("L'article est deja de ce type.");
  }

  const type = await activeType(tx, typeId);
  const sku = await allocateAssetCode(tx, type.id);

  const updated = await tx.asset.update({
    where: { id: assetId },
    data: { sku, typeId: type.id, categoryId: type.categoryId },
  });

  await tx.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "Asset",
      entityId: assetId,
      assetId,
      actorId,
      description: `Type corrige : ${asset.sku} -> ${sku} (${type.name}) — ${motive}`,
      metadata: { previousCode: asset.sku, nextCode: sku, previousTypeId: asset.typeId, nextTypeId: type.id, reason: motive },
    },
  });

  return updated;
}
