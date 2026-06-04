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

export const dynamic = "force-dynamic";

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

function revalidateAll() {
  for (const tag of revalidateStockTags()) {
    revalidateTag(tag, "max");
  }
}

export async function GET() {
  try {
  const [assets, categories, locations, suppliers, movements, sessions] =
    await Promise.all([
      prisma.asset.findMany({
        include: assetInclude,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      prisma.supplier.findMany({
        include: { _count: { select: { assets: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.stockMovement.findMany({
        include: {
          asset: true,
          fromLocation: true,
          toLocation: true,
          performedBy: true,
        },
        orderBy: { movedAt: "desc" },
        take: 30,
      }),
      prisma.inventorySession.findMany({
        include: {
          _count: { select: { checks: true } },
          checks: { select: { status: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ]);

  const serialized = assets.map(serializeAsset);
  const alerts = serialized.filter(
    (asset) => asset.stockStatus === "LOW" || asset.stockStatus === "OUT",
  );

  const totalValue = assets.reduce(
    (sum, asset) => sum + Number(asset.purchaseValue ?? 0) * asset.quantityOnHand,
    0,
  );

  return NextResponse.json({
    summary: {
      totalArticles: assets.length,
      totalQuantity: assets.reduce((sum, asset) => sum + asset.quantityOnHand, 0),
      totalValue: totalValue.toLocaleString("fr-FR", {
        style: "currency",
        currency: "USD",
      }),
      lowStock: alerts.length,
      available: serialized.filter((asset) => asset.statusCode === "AVAILABLE")
        .length,
    },
    alerts,
    assets: serialized,
    categories,
    locations,
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      assetsCount: supplier._count.assets,
    })),
    movements: movements.map((movement) => ({
      id: movement.id,
      assetId: movement.assetId,
      asset: movement.asset.name,
      type: movement.type,
      quantity: movement.quantity,
      fromLocation: movement.fromLocation?.name ?? "-",
      toLocation: movement.toLocation?.name ?? "-",
      performedBy: movement.performedBy?.name ?? "Systeme",
      reason: movement.reason ?? "-",
      movedAt: movement.movedAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      description: session.description,
      startedAt: session.startedAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      endedAt: session.endedAt
        ? session.endedAt.toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : null,
      checksCount: session._count.checks,
      isOpen: !session.endedAt,
      variance: {
        found: session.checks.filter((c) => c.status === "FOUND").length,
        missing: session.checks.filter((c) => c.status === "MISSING").length,
        damaged: session.checks.filter((c) => c.status === "DAMAGED").length,
        moved: session.checks.filter((c) => c.status === "MOVED").length,
      },
    })),
  });
  } catch (error) {
    console.error("[GET /api/stock]", error);
    const message =
      error instanceof Error ? error.message : "Erreur chargement du stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const quantityOnHand = Math.max(0, Number(body.quantityOnHand ?? 1));

  const asset = await prisma.asset.create({
    data: {
      sku: String(body.sku),
      barcode: body.barcode ? String(body.barcode) : null,
      serialNumber: body.serialNumber ? String(body.serialNumber) : null,
      name: String(body.name),
      description: body.description ? String(body.description) : null,
      brand: body.brand ? String(body.brand) : null,
      model: body.model ? String(body.model) : null,
      imageUrl: normalizeImageUrl(body.imageUrl),
      status: normalizeAssetStatus(body.status),
      condition: normalizeAssetCondition(body.condition),
      unit: body.unit ? String(body.unit) : "unite",
      quantityOnHand,
      minQuantity: Number(body.minQuantity ?? 0),
      reorderPoint: Number(body.reorderPoint ?? 1),
      maxQuantity: body.maxQuantity ? Number(body.maxQuantity) : null,
      purchaseValue: body.purchaseValue ? String(body.purchaseValue) : null,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
      categoryId: String(body.categoryId),
      locationId: body.locationId ? String(body.locationId) : null,
      supplierId: body.supplierId ? String(body.supplierId) : null,
    },
    include: assetInclude,
  });

  if (quantityOnHand > 0) {
    await prisma.stockMovement.create({
      data: {
        assetId: asset.id,
        type: "IN",
        quantity: quantityOnHand,
        toLocationId: asset.locationId,
        reason: "Stock initial a la creation de l'article",
      },
    });
  }

  revalidateAll();

  return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 });
}
