import { NextResponse } from "next/server";

import { reassignAsset } from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import type { AssignmentKind } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** Passe le materiel directement a un autre detenteur. */
export const POST = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  user,
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const assignment = await prisma.$transaction((tx) =>
      reassignAsset(tx, {
        assignmentId: id,
        holderId: String(body.holderId ?? ""),
        kind: body.kind as AssignmentKind,
        expectedReturnAt: body.expectedReturnAt ? new Date(String(body.expectedReturnAt)) : null,
        notes: body.notes,
        actorId: user.id,
      }),
    );

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
