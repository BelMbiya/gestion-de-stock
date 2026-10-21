import { NextResponse } from "next/server";

import { getAssignmentReturnAlert, getDaysUntilDate } from "@/lib/assignment-alerts";
import { withAuth } from "@/lib/auth/with-auth";
import { prisma } from "@/lib/prisma";
import { buildStockAlerts } from "@/lib/stock/stock-summary";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  const [openIncidents, assets, loans, openSupportTickets] = await Promise.all([
    prisma.incident.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.asset.findMany({
      where: { trackingMode: "BULK" },
      select: { id: true, sku: true, name: true, trackingMode: true, status: true, quantityOnHand: true, minQuantity: true, unit: true },
    }),
    prisma.assetAssignment.findMany({
      where: { status: "ACTIVE", kind: "LOAN", expectedReturnAt: { not: null } },
      include: { asset: true, holder: true },
    }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ]);

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const stockAlerts = buildStockAlerts(assets).map((alert) => ({
    ...alert,
    sku: assetsById.get(alert.id)?.sku ?? "",
    unit: assetsById.get(alert.id)?.unit ?? "",
  }));

  const assignmentReturnAlerts = loans.flatMap((loan) => {
    const level = getAssignmentReturnAlert(loan.expectedReturnAt, loan.status);
    if (level !== "DUE_SOON" && level !== "OVERDUE") return [];
    return [
      {
        id: loan.id,
        asset: loan.asset.name,
        agent: loan.holder.fullName,
        expectedReturnAt: loan.expectedReturnAt!.toLocaleDateString("fr-FR", { dateStyle: "medium" }),
        daysUntilReturn: getDaysUntilDate(loan.expectedReturnAt!),
        level,
      },
    ];
  });

  return NextResponse.json({
    openIncidents,
    openSupportTickets,
    stockAlerts: { count: stockAlerts.length, items: stockAlerts },
    assignmentReturnAlerts: { count: assignmentReturnAlerts.length, items: assignmentReturnAlerts },
  });
});
