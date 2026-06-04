import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  applyStockMovement,
  StockMovementError,
  type ApplyStockMovementInput,
} from "@/lib/apply-stock-movement";
import { prisma } from "@/lib/prisma";
import {
  normalizeMovementType,
  revalidateStockTags,
} from "@/lib/stock-management";

function revalidateAll() {
  for (const tag of revalidateStockTags()) {
    revalidateTag(tag, "max");
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const type = normalizeMovementType(body.type);
  const assetId = String(body.assetId);
  const quantity = Number(body.quantity ?? 1);

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 });
  }

  const input: ApplyStockMovementInput = {
    assetId,
    type,
    quantity,
    fromLocationId: body.fromLocationId ? String(body.fromLocationId) : null,
    toLocationId: body.toLocationId ? String(body.toLocationId) : null,
    reason: body.reason ? String(body.reason) : null,
    performedById: body.performedById ? String(body.performedById) : null,
  };

  try {
    const result = await prisma.$transaction((tx) =>
      applyStockMovement(tx, asset, input),
    );

    revalidateAll();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof StockMovementError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
