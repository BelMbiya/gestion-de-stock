import { NextResponse } from "next/server";

import { assignmentStatusLabels } from "@/lib/assignment-management";
import { assignmentKindLabels, returnOutcomeLabels } from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import type { HolderType } from "@/lib/generated/prisma/enums";
import { HolderNotFoundError } from "@/lib/holders/errors";
import { holderTypeLabels } from "@/lib/holders/holder-names";
import { deleteHolder, holderFlags, setHolderActive, updateHolder } from "@/lib/holders/holder-service";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const formatDate = (value: Date | null) =>
  value ? value.toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "-";

/** Fiche detenteur : materiel detenu, historique des affectations et des sorties de stock recues. */
export const GET = withAuth(async (_request: Request, { params }: Context) => {
  try {
    const { id } = await params;
    const holder = await prisma.holder.findUnique({
      where: { id },
      include: {
        department: true,
        assignments: { include: { asset: true }, orderBy: { assignedAt: "desc" } },
        stockMovements: { include: { asset: true }, orderBy: { movedAt: "desc" }, take: 50 },
      },
    });
    if (!holder) {
      throw new HolderNotFoundError();
    }

    const current = holder.assignments.filter((assignment) => assignment.status === "ACTIVE");

    return NextResponse.json({
      holder: {
        id: holder.id,
        type: holder.type,
        typeLabel: holderTypeLabels[holder.type],
        fullName: holder.fullName,
        matricule: holder.matricule,
        process: holder.process,
        department: holder.department?.name ?? null,
        active: holder.active,
        ...holderFlags(holder, current.length),
      },
      assignments: holder.assignments.map((assignment) => ({
        id: assignment.id,
        assetId: assignment.assetId,
        asset: assignment.asset.name,
        sku: assignment.asset.sku,
        serialNumber: assignment.asset.serialNumber,
        kind: assignmentKindLabels[assignment.kind],
        status: assignmentStatusLabels[assignment.status] ?? assignment.status,
        statusCode: assignment.status,
        assignedAt: formatDate(assignment.assignedAt),
        expectedReturnAt: formatDate(assignment.expectedReturnAt),
        returnedAt: formatDate(assignment.returnedAt),
        returnOutcome: assignment.returnOutcome ? returnOutcomeLabels[assignment.returnOutcome] : null,
      })),
      stockOuts: holder.stockMovements.map((movement) => ({
        id: movement.id,
        asset: movement.asset.name,
        quantity: movement.quantity,
        unit: movement.asset.unit,
        movedAt: formatDate(movement.movedAt),
        reason: movement.reason ?? "-",
      })),
    });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

/** Modifie la fiche, ou seulement l'etat actif / inactif si `active` est envoye seul. */
export const PATCH = withAuth(async (request: Request, { params }: Context) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const holder = await prisma.$transaction((tx) =>
      typeof body.active === "boolean" && body.fullName === undefined
        ? setHolderActive(tx, id, body.active)
        : updateHolder(tx, id, {
            type: body.type as HolderType,
            fullName: body.fullName,
            matricule: body.matricule,
            process: body.process,
            departmentId: body.departmentId,
          }),
    );

    return NextResponse.json({ holder });
  } catch (error) {
    return domainErrorResponse(error);
  }
});

export const DELETE = withAuth(async (_request: Request, { params }: Context) => {
  try {
    const { id } = await params;
    await prisma.$transaction((tx) => deleteHolder(tx, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
