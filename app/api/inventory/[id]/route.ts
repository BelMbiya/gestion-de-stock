import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { normalizeImageUrl } from "@/lib/asset-image";
import { prisma } from "@/lib/prisma";

const assetStatusValues = [
  "AVAILABLE",
  "ASSIGNED",
  "MAINTENANCE",
  "BROKEN",
  "RETIRED",
  "LOST",
] as const;

function normalizeAssetStatus(status: unknown) {
  return assetStatusValues.find((value) => value === status);
}

function revalidateInventoryViews() {
  revalidateTag("dashboard", "max");
  revalidateTag("history", "max");
  revalidateTag("inventory", "max");
  revalidateTag("reports", "max");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = normalizeAssetStatus(body.status);

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      sku: body.sku ? String(body.sku) : undefined,
      serialNumber:
        body.serialNumber === undefined ? undefined : body.serialNumber || null,
      name: body.name ? String(body.name) : undefined,
      imageUrl:
        body.imageUrl === undefined
          ? undefined
          : normalizeImageUrl(body.imageUrl),
      description:
        body.description === undefined ? undefined : body.description || null,
      status,
      purchaseValue:
        body.purchaseValue === undefined
          ? undefined
          : body.purchaseValue
            ? String(body.purchaseValue)
            : null,
      categoryId: body.categoryId ? String(body.categoryId) : undefined,
      locationId:
        body.locationId === undefined ? undefined : body.locationId || null,
    },
  });

  revalidateInventoryViews();

  return NextResponse.json({ asset });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.asset.delete({
    where: { id },
  });

  revalidateInventoryViews();

  return NextResponse.json({ ok: true });
}
