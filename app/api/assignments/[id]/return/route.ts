import { NextResponse } from "next/server";

import { returnAsset } from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import type { AssetCondition, ReturnOutcome } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** Retour d'un materiel : bon etat, a reparer ou perdu. */
export const POST = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  user,
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const assignment = await prisma.$transaction((tx) =>
      returnAsset(tx, {
        assignmentId: id,
        outcome: body.outcome as ReturnOutcome,
        condition: (body.condition || undefined) as AssetCondition | undefined,
        notes: body.notes,
        actorId: user.id,
      }),
    );

    return NextResponse.json({ assignment });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
