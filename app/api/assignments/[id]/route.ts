import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  AssignmentError,
  assertAssetAssignable,
  createAssignmentAudit,
  syncAssignmentSideEffects,
  validateAssignmentPayload,
} from "@/lib/apply-assignment";
import {
  normalizeAssignmentStatus,
  revalidateAssignmentTags,
} from "@/lib/assignment-management";
import { prisma } from "@/lib/prisma";

function parseDate(value: unknown) {
  return value ? new Date(String(value)) : null;
}

function revalidateAll() {
  for (const tag of revalidateAssignmentTags()) {
    revalidateTag(tag, "max");
  }
}

function assignmentErrorResponse(error: unknown) {
  if (error instanceof AssignmentError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error("[assignments]", error);
  const message =
    error instanceof Error ? error.message : "Erreur serveur lors de l'affectation";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status
    ? normalizeAssignmentStatus(body.status)
    : undefined;

  if (status === "ACTIVE" || status === "TRANSFERRED") {
    const validationError = validateAssignmentPayload(
      {
        status,
        expectedReturnAt: body.expectedReturnAt,
      },
      { requireAsset: false },
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const existing = await tx.assetAssignment.findUnique({ where: { id } });

      if (!existing) {
        throw new AssignmentError("Affectation introuvable");
      }

      const nextAssetId = body.assetId ? String(body.assetId) : existing.assetId;
      const nextStatus = status ?? existing.status;

      const reactivating =
        existing.status === "RETURNED" &&
        (nextStatus === "ACTIVE" || nextStatus === "TRANSFERRED");
      const assetChanged = nextAssetId !== existing.assetId;

      if (
        (nextStatus === "ACTIVE" || nextStatus === "TRANSFERRED") &&
        (reactivating || assetChanged)
      ) {
        await assertAssetAssignable(tx, nextAssetId, id);
      }

      const nextReturnedAt =
        body.returnedAt === undefined
          ? undefined
          : parseDate(body.returnedAt) ??
            (nextStatus === "RETURNED" ? new Date() : null);

      const updated = await tx.assetAssignment.update({
        where: { id },
        data: {
          assetId: body.assetId ? String(body.assetId) : undefined,
          assignedAt:
            body.assignedAt === undefined
              ? undefined
              : (parseDate(body.assignedAt) ?? undefined),
          expectedReturnAt:
            body.expectedReturnAt === undefined
              ? undefined
              : parseDate(body.expectedReturnAt),
          assignedToId:
            body.assignedToId === undefined
              ? undefined
              : body.assignedToId || null,
          departmentId:
            body.departmentId === undefined
              ? undefined
              : body.departmentId || null,
          notes: body.notes === undefined ? undefined : body.notes || null,
          returnedAt: nextReturnedAt,
          status,
        },
      });

      if (nextStatus !== existing.status) {
        await syncAssignmentSideEffects(
          tx,
          updated.assetId,
          existing.status,
          nextStatus,
          `Mise a jour affectation (${existing.status} -> ${nextStatus})`,
        );
      } else if (assetChanged) {
        await syncAssignmentSideEffects(
          tx,
          existing.assetId,
          existing.status,
          "RETURNED",
          "Changement de materiel — retour stock ancien article",
        );
        await syncAssignmentSideEffects(
          tx,
          updated.assetId,
          null,
          nextStatus,
          "Changement de materiel — sortie nouveau article",
        );
      }

      await createAssignmentAudit(
        tx,
        "UPDATE",
        updated.id,
        updated.assetId,
        `Affectation modifiee (${updated.status})`,
      );

      return updated;
    });

    revalidateAll();

    return NextResponse.json({ assignment });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const assignment = await tx.assetAssignment.findUnique({ where: { id } });

      if (!assignment) {
        throw new AssignmentError("Affectation introuvable");
      }

      await tx.assetAssignment.delete({ where: { id } });

      if (assignment.status === "ACTIVE" || assignment.status === "TRANSFERRED") {
        await syncAssignmentSideEffects(
          tx,
          assignment.assetId,
          assignment.status,
          "RETURNED",
          "Suppression affectation active — retour stock",
        );
      } else {
        await tx.asset.update({
          where: { id: assignment.assetId },
          data: { status: "AVAILABLE" },
        });
      }

      await createAssignmentAudit(
        tx,
        "DELETE",
        id,
        assignment.assetId,
        "Affectation supprimee",
      );
    });

    revalidateAll();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
