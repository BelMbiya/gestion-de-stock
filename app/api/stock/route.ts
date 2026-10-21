import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { createAsset } from "@/lib/catalog/asset-service";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { movementTypeLabels } from "@/lib/stock/movement-rules";
import { buildStockAlerts, buildStockSummary } from "@/lib/stock/stock-summary";
import { serializableAssetInclude, serializeAsset } from "@/lib/stock-serializer";

export const dynamic = "force-dynamic";

const formatDateTime = (value: Date) =>
  value.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const GET = withAuth(async () => {
  const [assets, assignments, categories, types, locations, suppliers, holders, movements, sessions] =
    await Promise.all([
      prisma.asset.findMany({ include: serializableAssetInclude, orderBy: { updatedAt: "desc" } }),
      prisma.assetAssignment.findMany({
        where: { status: "ACTIVE" },
        select: { kind: true, status: true, expectedReturnAt: true },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.assetType.findMany({
        where: { active: true },
        include: { category: true },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      prisma.supplier.findMany({
        include: { _count: { select: { assets: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.holder.findMany({
        where: { active: true },
        select: { id: true, fullName: true, type: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.stockMovement.findMany({
        include: { asset: true, fromLocation: true, toLocation: true, performedBy: true, holder: true },
        orderBy: { movedAt: "desc" },
        take: 30,
      }),
      prisma.inventorySession.findMany({
        include: { _count: { select: { checks: true } }, checks: { select: { status: true } } },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ]);

  const serialized = assets.map(serializeAsset);
  const alertIds = new Set(buildStockAlerts(assets).map((alert) => alert.id));
  const totalValue = assets.reduce(
    (sum, asset) => sum + Number(asset.purchaseValue ?? 0) * asset.quantityOnHand,
    0,
  );

  return NextResponse.json({
    summary: {
      ...buildStockSummary({ assets, assignments, now: new Date() }),
      available: assets.filter((asset) => asset.trackingMode === "SERIALIZED" && asset.status === "AVAILABLE").length,
      valuedAssets: assets.filter((asset) => asset.purchaseValue !== null).length,
      totalValue: totalValue.toLocaleString("fr-FR", { style: "currency", currency: "USD" }),
    },
    alerts: serialized.filter((asset) => alertIds.has(asset.id)),
    assets: serialized,
    categories,
    types: types.map((type) => ({
      id: type.id,
      prefix: type.prefix,
      name: type.name,
      family: type.category.name,
      defaultTrackingMode: type.defaultTrackingMode,
    })),
    locations,
    holders,
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
      typeLabel: movementTypeLabels[movement.type] ?? movement.type,
      quantity: movement.quantity,
      fromLocation: movement.fromLocation?.name ?? "-",
      toLocation: movement.toLocation?.name ?? "-",
      beneficiary: movement.holder?.fullName ?? null,
      performedBy: movement.performedBy?.name ?? movement.performedBy?.email ?? "Systeme",
      reason: movement.reason ?? "-",
      movedAt: formatDateTime(movement.movedAt),
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      description: session.description,
      startedAt: formatDateTime(session.startedAt),
      endedAt: session.endedAt ? formatDateTime(session.endedAt) : null,
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
});

/** Cree un article : le code est genere selon le type, jamais fourni par le client. */
export const POST = withAuth(async (request: Request, _context, user) => {
  try {
    const body = await request.json();
    const asset = await prisma.$transaction(async (tx) => {
      const created = await createAsset(
        tx,
        {
          typeId: body.typeId,
          trackingMode: body.trackingMode,
          name: body.name,
          serialNumber: body.serialNumber,
          quantityOnHand: body.quantityOnHand,
          minQuantity: body.minQuantity,
          barcode: body.barcode,
          brand: body.brand,
          model: body.model,
          description: body.description,
          imageUrl: body.imageUrl,
          condition: body.condition,
          unit: body.unit,
          purchaseValue: body.purchaseValue,
          purchaseDate: body.purchaseDate,
          warrantyUntil: body.warrantyUntil,
          locationId: body.locationId,
          supplierId: body.supplierId,
        },
        user.id,
      );
      return tx.asset.findUniqueOrThrow({ where: { id: created.id }, include: serializableAssetInclude });
    });

    return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
