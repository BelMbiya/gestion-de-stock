import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";
import { recordStockMovement } from "@/lib/stock/movement-service";

/** Enregistre un mouvement ; l'auteur est toujours l'utilisateur connecte. */
export const POST = withAuth(async (request: Request, _context, user) => {
  try {
    const body = await request.json();

    const result = await prisma.$transaction((tx) =>
      recordStockMovement(tx, {
        assetId: String(body.assetId ?? ""),
        input: {
          type: body.type,
          quantity: body.quantity,
          delta: body.delta,
          reason: body.reason,
          toLocationId: body.toLocationId,
          holderId: body.holderId,
        },
        actorId: user.id,
      }),
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
