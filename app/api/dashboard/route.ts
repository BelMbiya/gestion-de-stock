import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { sortIncidentsByResolutionPriority } from "@/lib/incident-resolution";
import { prisma } from "@/lib/prisma";
import { getStockLevelStatus } from "@/lib/stock-management";

export const dynamic = "force-dynamic";

const assetStatusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Assigne",
  MAINTENANCE: "Maintenance",
  BROKEN: "Critique",
  RETIRED: "Reforme",
  LOST: "Perdu",
};

const severityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
};

const incidentStatusLabels: Record<string, string> = {
  IDENTIFIED: "Identification",
  DIAGNOSING: "Diagnostic",
  IN_PROGRESS: "Intervention",
  WAITING_PART: "Piece commandee",
  RESOLVED: "Resolution validee",
  CLOSED: "Cloture",
};

const incidentProgressBase: Record<string, number> = {
  IDENTIFIED: 15,
  DIAGNOSING: 35,
  IN_PROGRESS: 55,
  WAITING_PART: 72,
  RESOLVED: 100,
  CLOSED: 100,
};

const incidentProgressCeiling: Record<string, number> = {
  IDENTIFIED: 25,
  DIAGNOSING: 45,
  IN_PROGRESS: 70,
  WAITING_PART: 85,
  RESOLVED: 100,
  CLOSED: 100,
};

function calculateIncidentProgress(status: string, updateCount: number) {
  if (status === "RESOLVED" || status === "CLOSED") {
    return 100;
  }

  const base = incidentProgressBase[status] ?? 0;
  const ceiling = incidentProgressCeiling[status] ?? base;
  const updateBonus = Math.min(updateCount * 5, ceiling - base);

  return base + updateBonus;
}

const getDashboardData = unstable_cache(
  async () => {
  const [
    assetCount,
    maintenanceCount,
    openIncidentCount,
    allAssetsForAlerts,
    assets,
    incidents,
  ] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { status: "MAINTENANCE" } }),
      prisma.incident.count({
        where: {
          status: {
            notIn: ["RESOLVED", "CLOSED"],
          },
        },
      }),
      prisma.asset.findMany({
        select: {
          quantityOnHand: true,
          reorderPoint: true,
          minQuantity: true,
          maxQuantity: true,
        },
      }),
      prisma.asset.findMany({
        include: {
          category: true,
          location: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 8,
      }),
      prisma.incident.findMany({
        include: {
          asset: true,
          assignee: true,
          updates: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 12,
      }),
    ]);

  const lowStockCount = allAssetsForAlerts.filter((asset) => {
    const level = getStockLevelStatus(
      asset.quantityOnHand,
      asset.reorderPoint,
      asset.minQuantity,
      asset.maxQuantity,
    );
    return level === "LOW" || level === "OUT";
  }).length;

  return {
    stats: [
      {
        label: "Actifs IT",
        value: assetCount.toLocaleString("fr-FR"),
        hint: "Articles en catalogue",
        icon: "HardDrive",
      },
      {
        label: "En maintenance",
        value: maintenanceCount.toLocaleString("fr-FR"),
        hint: "Materiels suivis",
        icon: "Wrench",
      },
      {
        label: "Pannes ouvertes",
        value: openIncidentCount.toLocaleString("fr-FR"),
        hint: "A traiter",
        icon: "AlertTriangle",
      },
      {
        label: "Alertes stock",
        value: lowStockCount.toLocaleString("fr-FR"),
        hint: "Rupture ou stock bas",
        icon: "ShieldCheck",
      },
    ],
    inventoryItems: assets.map((asset) => ({
      sku: asset.sku,
      title: asset.name,
      category: asset.category.name,
      qty: asset.quantityOnHand,
      location: asset.location?.name ?? "Non localise",
      value: asset.purchaseValue ? `$${asset.purchaseValue.toString()}` : "-",
      updated: asset.updatedAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      status: assetStatusLabels[asset.status] ?? asset.status,
    })),
    incidents: sortIncidentsByResolutionPriority(
      incidents.map((incident) => ({
        id: incident.reference,
        asset: incident.asset.name,
        issue: incident.title,
        owner: incident.assignee?.name ?? "Non assigne",
        severity: severityLabels[incident.severity] ?? incident.severity,
        status: incidentStatusLabels[incident.status] ?? incident.status,
        statusCode: incident.status,
        progress: calculateIncidentProgress(
          incident.status,
          incident.updates.length,
        ),
      })),
    ),
  };
  },
  ["dashboard-data"],
  {
    revalidate: 60,
    tags: ["dashboard", "inventory", "incidents"],
  },
);

export async function GET() {
  return NextResponse.json(await getDashboardData());
}
