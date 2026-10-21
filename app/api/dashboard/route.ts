import { NextResponse } from "next/server";

import { sortIncidentsByResolutionPriority } from "@/lib/incident-resolution";
import { KYC_UI } from "@/lib/kyc-excel/terminology";
import { prisma } from "@/lib/prisma";
import { assetStatusLabels } from "@/lib/stock/asset-state";
import { buildStockSummary } from "@/lib/stock/stock-summary";
import { withAuth } from "@/lib/auth/with-auth";

export const dynamic = "force-dynamic";

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

const getDashboardData = (
  async () => {
  const now = new Date();
  const [stockAssets, activeAssignments, openIncidentCount, assets, incidents] = await Promise.all([
    prisma.asset.findMany({
      select: { id: true, name: true, trackingMode: true, status: true, quantityOnHand: true, minQuantity: true },
    }),
    prisma.assetAssignment.findMany({
      where: { status: "ACTIVE" },
      select: { kind: true, status: true, expectedReturnAt: true },
    }),
    prisma.incident.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.asset.findMany({
      include: { category: true, location: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.incident.findMany({
      include: { asset: true, assignee: true, updates: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const summary = buildStockSummary({ assets: stockAssets, assignments: activeAssignments, now });
  const format = (value: number) => value.toLocaleString("fr-FR");

  return {
    stats: [
      {
        label: "Materiel unitaire",
        value: format(summary.serialized.total),
        hint: `${format(summary.serialized.assigned)} affectes`,
        icon: "HardDrive",
      },
      {
        label: "Articles en vrac",
        value: format(summary.bulk.references),
        hint: `${format(summary.bulk.pieces)} pieces en stock`,
        icon: "Package",
      },
      {
        label: KYC_UI.OPEN_INCIDENTS,
        value: format(openIncidentCount),
        hint: KYC_UI.OPEN_EXCLUDING_CLOSED,
        icon: "AlertTriangle",
      },
      {
        label: "Alertes stock",
        value: format(summary.stockAlerts),
        hint: "Vrac en rupture ou sous le seuil",
        icon: "ShieldCheck",
      },
      {
        label: "Prets en retard",
        value: format(summary.overdueLoans),
        hint: "Echeance de retour depassee",
        icon: "Clock",
      },
    ],
    inventoryItems: assets.map((asset) => ({
      sku: asset.sku,
      title: asset.name,
      category: asset.category.name,
      qty: asset.trackingMode === "BULK" ? `${asset.quantityOnHand} ${asset.unit}` : "Unitaire",
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
  });

export const GET = withAuth(async () => {
  return NextResponse.json(await getDashboardData());
});
