import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { changeAssetType } from "@/lib/catalog/asset-service";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { serializableAssetInclude, serializeAsset } from "@/lib/stock-serializer";

/** Corrige un type mal saisi : nouveau code du bon type, l'ancien reste dans l'historique (motif obligatoire). */
export const POST = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  user,
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    await prisma.$transaction((tx) =>
      changeAssetType(tx, { assetId: id, typeId: String(body.typeId ?? ""), reason: body.reason, actorId: user.id }),
    );

    const asset = await prisma.asset.findUniqueOrThrow({ where: { id }, include: serializableAssetInclude });
    return NextResponse.json({ asset: serializeAsset(asset) });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
