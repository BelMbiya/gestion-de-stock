import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { normalizeImageUrl } from "@/lib/asset-image";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { StockRuleError } from "@/lib/stock/errors";
import { movementTypeLabels } from "@/lib/stock/movement-rules";
import { buildStockAlerts, buildStockSummary } from "@/lib/stock/stock-summary";
import { normalizeTrackingMode } from "@/lib/stock/tracking-policy";
import { normalizeAssetCondition } from "@/lib/stock-management";
import { serializableAssetInclude, serializeAsset } from "@/lib/stock-serializer";

export const dynamic = "force-dynamic";

const formatDateTime = (value: Date) =>
  value.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const GET = withAuth(async () => {
  const [assets, assignments, categories, locations, suppliers, holders, movements, sessions] =
    await Promise.all([
      prisma.asset.findMany({ include: serializableAssetInclude, orderBy: { updatedAt: "desc" } }),
      prisma.assetAssignment.findMany({
        where: { status: "ACTIVE" },
        select: { kind: true, status: true, expectedReturnAt: true },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
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

function requiredText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new StockRuleError(`${label} est obligatoire.`);
  }
  return text;
}

const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function nonNegativeInteger(value: unknown, label: string) {
  const number = value === undefined || value === null || value === "" ? 0 : Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new StockRuleError(`${label} : un entier positif ou nul est attendu.`);
  }
  return number;
}

/** Cree un article. Unitaire : quantite 1, disponible. En vrac : stock initial trace par une entree. */
export const POST = withAuth(async (request: Request, _context, user) => {
  try {
    const body = await request.json();
    const trackingMode = normalizeTrackingMode(body.trackingMode);
    if (!trackingMode) {
      throw new StockRuleError("Choisissez le mode de suivi : unitaire ou en vrac.");
    }

    const sku = requiredText(body.sku, "La reference (SKU)");
    const name = requiredText(body.name, "La description");
    const categoryId = requiredText(body.categoryId, "La categorie");
    const isBulk = trackingMode === "BULK";
    const quantityOnHand = isBulk ? nonNegativeInteger(body.quantityOnHand, "Quantite initiale") : 1;
    const minQuantity = isBulk ? nonNegativeInteger(body.minQuantity, "Seuil d'alerte") : 0;

    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          sku,
          name,
          trackingMode,
          categoryId,
          quantityOnHand,
          minQuantity,
          status: "AVAILABLE",
          barcode: optionalText(body.barcode),
          serialNumber: isBulk ? null : optionalText(body.serialNumber),
          description: optionalText(body.description),
          brand: optionalText(body.brand),
          model: optionalText(body.model),
          imageUrl: normalizeImageUrl(body.imageUrl),
          condition: normalizeAssetCondition(body.condition),
          unit: optionalText(body.unit) ?? (isBulk ? "piece" : "unite"),
          purchaseValue: optionalText(body.purchaseValue),
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
          warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
          locationId: optionalText(body.locationId),
          supplierId: optionalText(body.supplierId),
          createdById: user.id,
        },
        include: serializableAssetInclude,
      });

      if (isBulk && quantityOnHand > 0) {
        await tx.stockMovement.create({
          data: {
            assetId: created.id,
            type: "IN",
            quantity: quantityOnHand,
            toLocationId: created.locationId,
            reason: "Stock initial a la creation de l'article",
            performedById: user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entityType: "Asset",
          entityId: created.id,
          assetId: created.id,
          actorId: user.id,
          description: `Article cree (${trackingMode === "BULK" ? "en vrac" : "unitaire"})`,
        },
      });

      return created;
    });

    return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
