import { NextResponse } from "next/server";

import {
  getAssignmentReturnAlert,
  getAssignmentReturnAlertLabel,
  getDaysUntilDate,
} from "@/lib/assignment-alerts";
import { assignmentStatusLabels } from "@/lib/assignment-management";
import {
  assignAsset,
  assignmentKindLabels,
  returnOutcomeLabels,
} from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { domainErrorResponse } from "@/lib/domain-error";
import type { AssignmentKind } from "@/lib/generated/prisma/enums";
import { holderTypeLabels } from "@/lib/holders/holder-names";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const formatDate = (value: Date | null) =>
  value ? value.toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "-";
const formatDateInput = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");

export const GET = withAuth(async () => {
  const [assignments, assets, holders] = await Promise.all([
    prisma.assetAssignment.findMany({
      include: {
        asset: { include: { category: true, location: true } },
        holder: { include: { department: true } },
        issuedBy: true,
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { trackingMode: "SERIALIZED" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        model: true,
        serialNumber: true,
        status: true,
        _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.holder.findMany({
      where: { active: true },
      include: { department: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return NextResponse.json({
    assets: assets.map((asset) => ({
      id: asset.id,
      sku: asset.sku,
      name: asset.name,
      model: asset.model,
      serialNumber: asset.serialNumber,
      assignable: asset.status === "AVAILABLE" && asset._count.assignments === 0,
    })),
    holders: holders.map((holder) => ({
      id: holder.id,
      fullName: holder.fullName,
      type: holder.type,
      typeLabel: holderTypeLabels[holder.type],
      process: holder.process,
      department: holder.department?.name ?? null,
    })),
    assignments: assignments.map((assignment) => {
      const returnAlert = getAssignmentReturnAlert(assignment.expectedReturnAt, assignment.status);
      return {
        id: assignment.id,
        assetId: assignment.assetId,
        asset: assignment.asset.name,
        sku: assignment.asset.sku,
        serialNumber: assignment.asset.serialNumber,
        category: assignment.asset.category.name,
        location: assignment.asset.location?.name ?? "Non localise",
        holderId: assignment.holderId,
        holder: assignment.holder.fullName,
        holderType: assignment.holder.type,
        holderDetail:
          [assignment.holder.department?.name, assignment.holder.process].filter(Boolean).join(" · ") ||
          holderTypeLabels[assignment.holder.type],
        kind: assignment.kind,
        kindLabel: assignmentKindLabels[assignment.kind],
        notes: assignment.notes ?? "-",
        remiseAt: formatDate(assignment.assignedAt),
        remiseAtInput: formatDateInput(assignment.assignedAt),
        expectedReturnAt: formatDate(assignment.expectedReturnAt),
        expectedReturnAtInput: formatDateInput(assignment.expectedReturnAt),
        returnedAt: formatDate(assignment.returnedAt),
        daysUntilReturn: assignment.expectedReturnAt ? getDaysUntilDate(assignment.expectedReturnAt) : null,
        returnAlert,
        returnAlertLabel: getAssignmentReturnAlertLabel(returnAlert),
        returnOutcome: assignment.returnOutcome ? returnOutcomeLabels[assignment.returnOutcome] : null,
        issuedBy: assignment.issuedBy?.name ?? assignment.issuedBy?.email ?? "Import",
        status: assignmentStatusLabels[assignment.status] ?? assignment.status,
        statusCode: assignment.status,
      };
    }),
  });
});

const parseDate = (value: unknown) => (value ? new Date(String(value)) : null);

/** Remet un materiel unitaire a un detenteur (dotation ou pret). */
export const POST = withAuth(async (request: Request, _context, user) => {
  try {
    const body = await request.json();

    const assignment = await prisma.$transaction((tx) =>
      assignAsset(tx, {
        assetId: String(body.assetId ?? ""),
        holderId: String(body.holderId ?? ""),
        kind: body.kind as AssignmentKind,
        expectedReturnAt: parseDate(body.expectedReturnAt),
        notes: body.notes,
        actorId: user.id,
      }),
    );

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
});
