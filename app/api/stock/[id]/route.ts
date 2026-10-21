import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { normalizeImageUrl } from "@/lib/asset-image";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { assertAssetDeletable, assertEditableFields } from "@/lib/stock/asset-state";
import { AssetNotFoundError, StockRuleError } from "@/lib/stock/errors";
import { normalizeAssetCondition } from "@/lib/stock-management";
import { serializableAssetInclude, serializeAsset } from "@/lib/stock-serializer";

type Context = { params: Promise<{ id: string }> };

/** undefined = champ non envoye (inchange) ; chaine vide = effacer. */
const optional = (value: unknown) =>
  value === undefined ? undefined : typeof value === "string" && value.trim() ? value.trim() : null;

const optionalDate = (value: unknown) => (value === undefined ? undefined : value ? new Date(String(value)) : null);

/** Modifie les informations descriptives. Statut, site, quantite et mode passent par des actions tracees. */
export const PATCH = withAuth(async (request: Request, { params }: Context, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    assertEditableFields(body);

    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new AssetNotFoundError();
    }

    let minQuantity: number | undefined;
    if (body.minQuantity !== undefined) {
      minQuantity = Number(body.minQuantity);
      if (existing.trackingMode !== "BULK") {
        throw new StockRuleError("Le seuil d'alerte ne concerne que les articles en vrac.");
      }
      if (!Number.isInteger(minQuantity) || minQuantity < 0) {
        throw new StockRuleError("Seuil d'alerte : un entier positif ou nul est attendu.");
      }
    }

    const name = optional(body.name);
    if (name === null) {
      throw new StockRuleError("La description ne peut pas etre vide.");
    }

    const asset = await prisma.$transaction(async (tx) => {
      const updated = await tx.asset.update({
        where: { id },
        data: {
          name,
          minQuantity,
          barcode: optional(body.barcode),
          serialNumber: existing.trackingMode === "BULK" ? undefined : optional(body.serialNumber),
          description: optional(body.description),
          brand: optional(body.brand),
          model: optional(body.model),
          imageUrl: body.imageUrl === undefined ? undefined : normalizeImageUrl(body.imageUrl),
          condition: body.condition ? normalizeAssetCondition(body.condition) : undefined,
          unit: optional(body.unit) ?? undefined,
          purchaseValue: optional(body.purchaseValue),
          purchaseDate: optionalDate(body.purchaseDate),
          warrantyUntil: optionalDate(body.warrantyUntil),
          supplierId: optional(body.supplierId),
          systemOs: optional(body.systemOs),
          storageRam: optional(body.storageRam),
          workstationCode: optional(body.workstationCode),
        },
        include: serializableAssetInclude,
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Asset",
          entityId: id,
          assetId: id,
          actorId: user.id,
          description: "Fiche article modifiee",
        },
      });

      return updated;
    });

    return NextResponse.json({ asset: serializeAsset(asset) });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

/** Supprime une saisie erronee. Un article avec historique se reforme (409). */
export const DELETE = withAuth(async (_request: Request, { params }: Context, user) => {
  try {
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.asset.findUnique({ where: { id } });
      if (!existing) {
        throw new AssetNotFoundError();
      }
      await assertAssetDeletable(tx, id);
      // La trace de creation est conservee (assetId mis a NULL par la base).
      await tx.asset.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entityType: "Asset",
          entityId: id,
          actorId: user.id,
          description: `Article supprime (saisie erronee) : ${existing.sku} — ${existing.name}`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
