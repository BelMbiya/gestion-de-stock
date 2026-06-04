import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const assetStatusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Assigne",
  MAINTENANCE: "Maintenance",
  BROKEN: "Critique",
  RETIRED: "Reforme",
  LOST: "Perdu",
};

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

const getReportsData = unstable_cache(
  async () => {
    const [assets, incidents, movements, assignments, inventoryChecks] = await Promise.all([
      prisma.asset.findMany({
        include: {
          assignments: {
            include: {
              assignedTo: true,
              department: true,
            },
            orderBy: {
              assignedAt: "desc",
            },
            take: 1,
          },
          category: true,
          location: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 250,
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
          assignedTo: true,
          department: true,
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
          label: "Actifs IT",
          value: assets.length,
          hint: "Materiels suivis",
        },
        {
          label: "Valeur estimee",
          value: totalValue.toLocaleString("fr-FR", {
            maximumFractionDigits: 0,
            style: "currency",
            currency: "USD",
          }),
          hint: "Base inventaire",
        },
        {
          label: "Pannes ouvertes",
          value: activeIncidents.length,
          hint: "Hors resolues/cloturees",
        },
        {
          label: "Controles inventaire",
          value: inventoryChecks,
          hint: "Checks historises",
        },
      ],
      assets: assets.map((asset) => {
        const assignment = asset.assignments[0];

        return {
          sku: asset.sku,
          name: asset.name,
          category: asset.category.name,
          location: asset.location?.name ?? "Non localise",
          assignedTo:
            assignment?.assignedTo?.name ??
            assignment?.department?.name ??
            "Non assigne",
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
        agent:
          assignment.assignedTo?.name ??
          assignment.assignedTo?.email ??
          "Non assigne",
        asset: assignment.asset.name,
        department: assignment.department?.name ?? "Non renseigne",
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
  },
  ["reports-data"],
  {
    revalidate: 60,
    tags: ["reports", "dashboard", "inventory", "incidents", "movements", "assignments"],
  },
);

export async function GET() {
  return NextResponse.json(await getReportsData());
}
