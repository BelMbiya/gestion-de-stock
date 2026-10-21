import { NextResponse } from "next/server";

import { updateAssignment } from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";

/**
 * Modifie les notes ou la date de retour d'un pret en cours.
 * Une affectation ne se supprime pas : on la cloture par un retour (historique conserve).
 */
export const PATCH = withAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  user,
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const assignment = await prisma.$transaction((tx) =>
      updateAssignment(tx, {
        assignmentId: id,
        notes: body.notes,
        expectedReturnAt:
          body.expectedReturnAt === undefined ? undefined : body.expectedReturnAt ? new Date(String(body.expectedReturnAt)) : null,
        actorId: user.id,
      }),
    );

    return NextResponse.json({ assignment });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
