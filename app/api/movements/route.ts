import { NextResponse } from "next/server";

import {
  applyStockMovement,
  StockMovementError,
  type ApplyStockMovementInput,
} from "@/lib/apply-stock-movement";
import { kycAssetListSelect } from "@/lib/kyc-excel/asset-select";
import { prisma } from "@/lib/prisma";
import {
  normalizeMovementType,
} from "@/lib/stock-management";

export const dynamic = "force-dynamic";

const getMovementsData = (
  async () => {
    const [movements, assets, locations] = await Promise.all([
      prisma.stockMovement.findMany({
        include: {
          asset: true,
          fromLocation: true,
          toLocation: true,
          performedBy: true,
        },
        orderBy: {
          movedAt: "desc",
        },
      }),
      prisma.asset.findMany({
        orderBy: { name: "asc" },
        select: kycAssetListSelect,
      }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
    ]);

    return {
      assets,
      locations,
      movements: movements.map((movement) => ({
        id: movement.id,
        asset: movement.asset.name,
        fromLocation: movement.fromLocation?.name ?? "-",
        movedAt: movement.movedAt.toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
        performedBy: movement.performedBy?.name ?? "Systeme",
        quantity: movement.quantity,
        reason: movement.reason ?? "-",
        toLocation: movement.toLocation?.name ?? "-",
        type: movement.type,
      })),
    };
  });

export async function GET() {
  return NextResponse.json(await getMovementsData());
}

export async function POST(request: Request) {
  const body = await request.json();
  const type = normalizeMovementType(body.type);
  const assetId = String(body.assetId);
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 });
  }

  const input: ApplyStockMovementInput = {
    assetId,
    type,
    quantity: Number(body.quantity ?? 1),
    fromLocationId: body.fromLocationId ? String(body.fromLocationId) : null,
    toLocationId: body.toLocationId ? String(body.toLocationId) : null,
    reason: body.reason ? String(body.reason) : null,
    performedById: body.performedById ? String(body.performedById) : null,
  };

  try {
    const result = await prisma.$transaction((tx) =>
      applyStockMovement(tx, asset, input),
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof StockMovementError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
