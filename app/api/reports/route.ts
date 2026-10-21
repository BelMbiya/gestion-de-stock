import { NextResponse } from "next/server";

import { KYC_UI } from "@/lib/kyc-excel/terminology";
import { assetStatusLabels } from "@/lib/stock/asset-state";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/with-auth";

export const dynamic = "force-dynamic";

const incidentStatusLabels: Record<string, string> = {
  IDENTIFIED: "Identification",
  DIAGNOSING: "Diagnostic",
  IN_PROGRESS: "Intervention",
  WAITING_PART: "Piece commandee",
  RESOLVED: "Resolution validee",
  CLOSED: "Cloture",
};

const severityLabels: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
};

const movementTypeLabels: Record<string, string> = {
  IN: "Entree",
  OUT: "Sortie",
  TRANSFER: "Transfert",
  ADJUSTMENT: "Ajustement",
  RETURN: "Retour",
};

const assignmentStatusLabels: Record<string, string> = {
  ACTIVE: "Alloue",
  RETURNED: "Retourne",
  TRANSFERRED: "Transfere",
};

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return Object.entries(
    items.reduce<Record<string, number>>((accumulator, item) => {
      const key = getKey(item);
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([label, value]) => ({ label, value }));
}

const getReportsData = (
  async () => {
    const [assets, incidents, movements, assignments, inventoryChecks] = await Promise.all([
      prisma.asset.findMany({
        include: {
          assignments: {
            where: { status: "ACTIVE" },
            include: { holder: true },
            take: 1,
          },
          category: true,
          location: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      prisma.incident.findMany({
        include: {
          asset: true,
          assignee: true,
          updates: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 250,
      }),
      prisma.stockMovement.findMany({
        include: {
          asset: true,
          fromLocation: true,
          performedBy: true,
          toLocation: true,
        },
        orderBy: {
          movedAt: "desc",
        },
        take: 250,
      }),
      prisma.assetAssignment.findMany({
        include: {
          asset: true,
          holder: { include: { department: true } },
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 250,
      }),
      prisma.inventoryCheck.count(),
    ]);

    const activeIncidents = incidents.filter(
      (incident) => !["RESOLVED", "CLOSED"].includes(incident.status),
    );
    const criticalAssets = assets.filter((asset) =>
      ["BROKEN", "MAINTENANCE", "LOST"].includes(asset.status),
    );
    const totalValue = assets.reduce(
      (sum, asset) => sum + Number(asset.purchaseValue ?? 0),
      0,
    );

    return {
      generatedAt: new Date().toLocaleString("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
      }),
      summary: [
        {
          label: KYC_UI.IT_ASSETS,
          value: assets.length,
          hint: KYC_UI.TRACKED_ITEMS,
        },
        {
          label: KYC_UI.ESTIMATED_VALUE,
          value: totalValue.toLocaleString("fr-FR", {
            maximumFractionDigits: 0,
            style: "currency",
            currency: "USD",
          }),
          hint: KYC_UI.INVENTORY_BASE,
        },
        {
          label: KYC_UI.OPEN_INCIDENTS,
          value: activeIncidents.length,
          hint: KYC_UI.OPEN_EXCLUDING_CLOSED,
        },
        {
          label: KYC_UI.INVENTORY_CHECKS,
          value: inventoryChecks,
          hint: KYC_UI.LOGGED_CHECKS,
        },
      ],
      assets: assets.map((asset) => {
        const assignment = asset.assignments[0];

        return {
          sku: asset.sku,
          name: asset.name,
          category: asset.category.name,
          location: asset.location?.name ?? "Non localise",
          assignedTo: assignment?.holder.fullName ?? "En stock",
          status: assetStatusLabels[asset.status] ?? asset.status,
          value: asset.purchaseValue ? asset.purchaseValue.toString() : "0",
          updatedAt: asset.updatedAt.toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          }),
        };
      }),
      incidents: incidents.map((incident) => ({
        reference: incident.reference,
        asset: incident.asset.name,
        title: incident.title,
        severity: severityLabels[incident.severity] ?? incident.severity,
        status: incidentStatusLabels[incident.status] ?? incident.status,
        assignee: incident.assignee?.name ?? "Non assigne",
        lastUpdate: incident.updates[0]?.comment ?? "Aucune mise a jour",
        identifiedAt: incident.identifiedAt.toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      })),
      movements: movements.map((movement) => ({
        asset: movement.asset.name,
        type: movementTypeLabels[movement.type] ?? movement.type,
        from: movement.fromLocation?.name ?? "-",
        to: movement.toLocation?.name ?? "-",
        reason: movement.reason ?? "-",
        performedBy: movement.performedBy?.name ?? "System",
        movedAt: movement.movedAt.toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      })),
      assignments: assignments.map((assignment) => ({
        agent: assignment.holder.fullName,
        asset: assignment.asset.name,
        department: assignment.holder.department?.name ?? assignment.holder.process ?? "Non renseigne",
        notes: assignment.notes ?? "-",
        remiseAt: assignment.assignedAt.toLocaleDateString("fr-FR", {
          dateStyle: "medium",
        }),
        returnedAt: assignment.returnedAt
          ? assignment.returnedAt.toLocaleDateString("fr-FR", {
              dateStyle: "medium",
            })
          : "-",
        status: assignmentStatusLabels[assignment.status] ?? assignment.status,
      })),
      breakdowns: {
        byCategory: countBy(assets, (asset) => asset.category.name),
        byLocation: countBy(
          assets,
          (asset) => asset.location?.name ?? "Non localise",
        ),
        byStatus: countBy(
          assets,
          (asset) => assetStatusLabels[asset.status] ?? asset.status,
        ),
        bySeverity: countBy(
          incidents,
          (incident) => severityLabels[incident.severity] ?? incident.severity,
        ),
      },
      risks: criticalAssets.slice(0, 6).map((asset) => ({
        asset: asset.name,
        status: assetStatusLabels[asset.status] ?? asset.status,
        location: asset.location?.name ?? "Non localise",
      })),
    };
  });

export const GET = withAuth(async () => {
  return NextResponse.json(await getReportsData());
});
