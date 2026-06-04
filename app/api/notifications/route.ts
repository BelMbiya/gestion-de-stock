import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import {
  getAssignmentReturnAlert,
  getDaysUntilDate,
} from "@/lib/assignment-alerts";
import { prisma } from "@/lib/prisma";
import { getStockLevelStatus } from "@/lib/stock-management";

export const dynamic = "force-dynamic";

const getNotifications = unstable_cache(
  async () => {
    const [openIncidents, assets, activeAssignments] = await Promise.all([
      prisma.incident.count({
        where: {
          status: {
            notIn: ["RESOLVED", "CLOSED"],
          },
        },
      }),
      prisma.asset.findMany({
        select: {
          id: true,
          sku: true,
          name: true,
          quantityOnHand: true,
          reorderPoint: true,
          minQuantity: true,
          maxQuantity: true,
          unit: true,
        },
      }),
      prisma.assetAssignment.findMany({
        where: {
          status: { in: ["ACTIVE", "TRANSFERRED"] },
          expectedReturnAt: { not: null },
        },
        include: {
          asset: true,
          assignedTo: true,
        },
      }),
    ]);

    const stockAlerts = assets
      .map((asset) => {
        const level = getStockLevelStatus(
          asset.quantityOnHand,
          asset.reorderPoint,
          asset.minQuantity,
          asset.maxQuantity,
        );
        return { asset, level };
      })
      .filter(({ level }) => level === "LOW" || level === "OUT" || level === "OVER")
      .map(({ asset, level }) => ({
        id: asset.id,
        sku: asset.sku,
        name: asset.name,
        quantityOnHand: asset.quantityOnHand,
        unit: asset.unit,
        level,
      }));

    const assignmentReturnAlerts = activeAssignments
      .map((assignment) => {
        const alert = getAssignmentReturnAlert(
          assignment.expectedReturnAt,
          assignment.status,
        );
        return { assignment, alert };
      })
      .filter(
        ({ alert }) => alert === "DUE_SOON" || alert === "OVERDUE",
      )
      .map(({ assignment, alert }) => ({
        id: assignment.id,
        asset: assignment.asset.name,
        agent:
          assignment.assignedTo?.name ??
          assignment.assignedTo?.email ??
          "Non assigne",
        expectedReturnAt: assignment.expectedReturnAt!.toLocaleDateString(
          "fr-FR",
          { dateStyle: "medium" },
        ),
        daysUntilReturn: getDaysUntilDate(assignment.expectedReturnAt!),
        level: alert,
      }));

    return {
      openIncidents,
      stockAlerts: {
        count: stockAlerts.length,
        items: stockAlerts,
      },
      assignmentReturnAlerts: {
        count: assignmentReturnAlerts.length,
        items: assignmentReturnAlerts,
      },
    };
  },
  ["notifications-data"],
  {
    revalidate: 60,
    tags: ["notifications", "incidents", "stock", "inventory", "assignments"],
  },
);

export async function GET() {
  return NextResponse.json(await getNotifications());
}
