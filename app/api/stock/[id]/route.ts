import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import type { IncidentStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeAssetCondition,
  normalizeAssetStatus,
  revalidateStockTags,
} from "@/lib/stock-management";
import { normalizeImageUrl } from "@/lib/asset-image";
import { serializeAsset } from "@/lib/stock-serializer";

function revalidateAll() {
  for (const tag of revalidateStockTags()) {
    revalidateTag(tag, "max");
  }
}

const assetInclude = {
  category: true,
  location: true,
  supplier: true,
  assignments: {
    include: { assignedTo: true, department: true },
    orderBy: { assignedAt: "desc" as const },
    take: 1,
  },
  incidents: {
    where: {
      status: { notIn: ["RESOLVED", "CLOSED"] satisfies IncidentStatus[] },
    },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status ? normalizeAssetStatus(body.status) : undefined;

  const existing = await prisma.asset.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 });
  }

  const nextQuantity =
    body.quantityOnHand === undefined
      ? undefined
      : Math.max(0, Number(body.quantityOnHand));

  const asset = await prisma.$transaction(async (tx) => {
    if (
      nextQuantity !== undefined &&
      nextQuantity !== existing.quantityOnHand
    ) {
      await tx.stockMovement.create({
        data: {
          assetId: id,
          type: "ADJUSTMENT",
          quantity: nextQuantity,
          reason: `Ajustement fiche article (${existing.quantityOnHand} -> ${nextQuantity})`,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Asset",
          entityId: id,
          assetId: id,
          description: `Quantite ajustee: ${existing.quantityOnHand} -> ${nextQuantity}`,
        },
      });
    }

    return tx.asset.update({
    where: { id },
    data: {
      sku: body.sku ? String(body.sku) : undefined,
      barcode: body.barcode === undefined ? undefined : body.barcode || null,
      serialNumber:
        body.serialNumber === undefined ? undefined : body.serialNumber || null,
      name: body.name ? String(body.name) : undefined,
      description:
        body.description === undefined ? undefined : body.description || null,
      brand: body.brand === undefined ? undefined : body.brand || null,
      model: body.model === undefined ? undefined : body.model || null,
      imageUrl:
        body.imageUrl === undefined
          ? undefined
          : normalizeImageUrl(body.imageUrl),
      status,
      condition: body.condition
        ? normalizeAssetCondition(body.condition)
        : undefined,
      unit: body.unit ? String(body.unit) : undefined,
      quantityOnHand:
        body.quantityOnHand === undefined
          ? undefined
          : Math.max(0, Number(body.quantityOnHand)),
      minQuantity:
        body.minQuantity === undefined ? undefined : Number(body.minQuantity),
      reorderPoint:
        body.reorderPoint === undefined ? undefined : Number(body.reorderPoint),
      maxQuantity:
        body.maxQuantity === undefined
          ? undefined
          : body.maxQuantity
            ? Number(body.maxQuantity)
            : null,
      purchaseValue:
        body.purchaseValue === undefined
          ? undefined
          : body.purchaseValue
            ? String(body.purchaseValue)
            : null,
      purchaseDate:
        body.purchaseDate === undefined
          ? undefined
          : body.purchaseDate
            ? new Date(body.purchaseDate)
            : null,
      warrantyUntil:
        body.warrantyUntil === undefined
          ? undefined
          : body.warrantyUntil
            ? new Date(body.warrantyUntil)
            : null,
      categoryId: body.categoryId ? String(body.categoryId) : undefined,
      locationId:
        body.locationId === undefined ? undefined : body.locationId || null,
      supplierId:
        body.supplierId === undefined ? undefined : body.supplierId || null,
    },
    include: assetInclude,
    });
  });

  revalidateAll();

  return NextResponse.json({ asset: serializeAsset(asset) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.asset.delete({ where: { id } });
  revalidateAll();

  return NextResponse.json({ ok: true });
}
