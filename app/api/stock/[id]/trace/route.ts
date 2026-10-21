import { NextResponse } from "next/server";

import { assignmentKindLabels, returnOutcomeLabels } from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { movementTypeLabels } from "@/lib/stock/movement-rules";
import { serializableAssetInclude, serializeAsset } from "@/lib/stock-serializer";

const formatDateTime = (value: Date) =>
  value.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const GET = withAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({ where: { id }, include: serializableAssetInclude });
  if (!asset) {
    return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  }

  const [movements, assignments, auditLogs] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { assetId: id },
      include: { fromLocation: true, toLocation: true, performedBy: true, holder: true },
      orderBy: { movedAt: "desc" },
    }),
    prisma.assetAssignment.findMany({
      where: { assetId: id },
      include: { holder: true, issuedBy: true, returnedBy: true },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { assetId: id },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    asset: serializeAsset(asset),
    movements: movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      typeLabel: movementTypeLabels[movement.type] ?? movement.type,
      quantity: movement.quantity,
      fromLocation: movement.fromLocation?.name ?? "-",
      toLocation: movement.toLocation?.name ?? "-",
      beneficiary: movement.holder?.fullName ?? null,
      performedBy: movement.performedBy?.name ?? movement.performedBy?.email ?? "Systeme",
      reason: movement.reason ?? "-",
      movedAt: formatDateTime(movement.movedAt),
    })),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      holder: assignment.holder.fullName,
      kind: assignmentKindLabels[assignment.kind],
      status: assignment.status,
      assignedAt: formatDateTime(assignment.assignedAt),
      returnedAt: assignment.returnedAt ? formatDateTime(assignment.returnedAt) : null,
      returnOutcome: assignment.returnOutcome ? returnOutcomeLabels[assignment.returnOutcome] : null,
      issuedBy: assignment.issuedBy?.name ?? assignment.issuedBy?.email ?? "Import",
      returnedBy: assignment.returnedBy?.name ?? assignment.returnedBy?.email ?? null,
    })),
    auditTrail: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description ?? "-",
      actor: log.actor?.name ?? log.actor?.email ?? "Systeme",
      createdAt: formatDateTime(log.createdAt),
    })),
  });
});
