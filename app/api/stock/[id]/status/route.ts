import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { type AssetStateTarget, changeAssetState } from "@/lib/stock/asset-state";
import { serializableAssetInclude, serializeAsset } from "@/lib/stock-serializer";

/** « Changer l'etat » : maintenance, panne, reforme, perdu ou remise en service, avec motif. */
export const POST = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  user,
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    await prisma.$transaction((tx) =>
      changeAssetState(tx, {
        assetId: id,
        target: body.target as AssetStateTarget,
        reason: body.reason,
        actorId: user.id,
      }),
    );

    const asset = await prisma.asset.findUniqueOrThrow({ where: { id }, include: serializableAssetInclude });
    return NextResponse.json({ asset: serializeAsset(asset) });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
