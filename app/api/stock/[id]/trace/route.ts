import { NextResponse } from "next/server";

import type { IncidentStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { movementTypeLabels } from "@/lib/stock-management";
import { serializeAsset } from "@/lib/stock-serializer";

const assetInclude = {
  category: true,
  location: true,
  supplier: true,
  assignments: {
    include: { assignedTo: true, department: true },
    orderBy: { assignedAt: "desc" as const },
    take: 1,
  },
  incidents: {
    where: {
      status: { notIn: ["RESOLVED", "CLOSED"] satisfies IncidentStatus[] },
    },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: assetInclude,
  });

  if (!asset) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 });
  }

  const [movements, auditLogs] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { assetId: id },
      include: {
        fromLocation: true,
        toLocation: true,
        performedBy: true,
      },
      orderBy: { movedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { assetId: id },
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
      performedBy: movement.performedBy?.name ?? "Systeme",
      reason: movement.reason ?? "-",
      movedAt: movement.movedAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
    auditTrail: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description ?? "-",
      createdAt: log.createdAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
  });
}
