import { isAssignmentStockMovementReason } from "@/lib/assignment-management";
import { resolveHistoryPeriod } from "@/lib/period-range";
import { prisma } from "@/lib/prisma";

export { resolveHistoryPeriod } from "@/lib/period-range";

export const eventLabels = {
  assignment: "Affectation",
  incident: "Panne",
  incidentUpdate: "Suivi panne",
  movement: "Deplacement",
} as const;

const movementTypeLabels: Record<string, string> = {
  ADJUSTMENT: "Ajustement",
  IN: "Entree",
  OUT: "Sortie",
  RETURN: "Retour",
  TRANSFER: "Transport / Transfert",
};

const assignmentStatusLabels: Record<string, string> = {
  ACTIVE: "Alloue",
  RETURNED: "Retourne",
  TRANSFERRED: "Transfere",
};

const incidentStatusLabels: Record<string, string> = {
  CLOSED: "Cloture",
  DIAGNOSING: "Diagnostic",
  IDENTIFIED: "Identification",
  IN_PROGRESS: "Intervention",
  RESOLVED: "Resolution validee",
  WAITING_PART: "Piece commandee",
};

function formatDate(value: Date) {
  return value.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export type HistoryFilters = {
  assetId?: string;
  technicianId?: string;
  startDate?: Date;
  endDate?: Date;
};

function dateRangeWhere(startDate?: Date, endDate?: Date) {
  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
}

export async function buildMaterialHistory(filters: HistoryFilters = {}) {
  const { assetId, technicianId, startDate, endDate } = filters;
  const movedAt = dateRangeWhere(startDate, endDate);
  const assignedAt = dateRangeWhere(startDate, endDate);
  const identifiedAt = dateRangeWhere(startDate, endDate);

  const [assets, movements, assignments, incidents] = await Promise.all([
    prisma.asset.findMany({
      include: {
        category: true,
        location: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: {
        ...(assetId ? { assetId } : {}),
        ...(technicianId ? { performedById: technicianId } : {}),
        ...(movedAt ? { movedAt } : {}),
      },
      include: {
        asset: true,
        fromLocation: true,
        performedBy: true,
        toLocation: true,
      },
      orderBy: { movedAt: "desc" },
    }),
    prisma.assetAssignment.findMany({
      where: {
        ...(assetId ? { assetId } : {}),
        ...(technicianId ? { assignedToId: technicianId } : {}),
        ...(assignedAt ? { assignedAt } : {}),
      },
      include: {
        asset: true,
        assignedTo: true,
        department: true,
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.incident.findMany({
      where: {
        ...(assetId ? { assetId } : {}),
        ...(technicianId ? { assigneeId: technicianId } : {}),
        ...(identifiedAt ? { identifiedAt } : {}),
      },
      include: {
        asset: true,
        assignee: true,
        updates: {
          include: { author: true },
          orderBy: { createdAt: "desc" },
          ...(startDate || endDate
            ? {
                where: {
                  createdAt: dateRangeWhere(startDate, endDate),
                },
              }
            : {}),
        },
      },
      orderBy: { identifiedAt: "desc" },
    }),
  ]);

  const events = [
    ...movements
      .filter((movement) => !isAssignmentStockMovementReason(movement.reason))
      .map((movement) => ({
      asset: movement.asset.name,
      assetId: movement.assetId,
      date: formatDate(movement.movedAt),
      detail: movement.reason ?? "Aucun motif renseigne",
      id: `movement-${movement.id}`,
      metadata: `${movement.fromLocation?.name ?? "-"} -> ${movement.toLocation?.name ?? "-"}`,
      owner: movement.performedBy?.name ?? "Systeme",
      rawDate: movement.movedAt.toISOString(),
      title: movementTypeLabels[movement.type] ?? movement.type,
      type: eventLabels.movement,
    })),
    ...assignments.map((assignment) => ({
      asset: assignment.asset.name,
      assetId: assignment.assetId,
      date: formatDate(assignment.assignedAt),
      detail: assignment.notes ?? "Aucune note",
      id: `assignment-${assignment.id}`,
      metadata: assignment.returnedAt
        ? `Retour le ${formatDate(assignment.returnedAt)}`
        : assignment.department?.name ?? "Departement non renseigne",
      owner:
        assignment.assignedTo?.name ??
        assignment.assignedTo?.email ??
        "Agent non renseigne",
      rawDate: assignment.assignedAt.toISOString(),
      title: assignmentStatusLabels[assignment.status] ?? assignment.status,
      type: eventLabels.assignment,
    })),
    ...incidents.flatMap((incident) => [
      {
        asset: incident.asset.name,
        assetId: incident.assetId,
        date: formatDate(incident.identifiedAt),
        detail: incident.description ?? "Aucune description",
        id: `incident-${incident.id}`,
        metadata: incidentStatusLabels[incident.status] ?? incident.status,
        owner: incident.assignee?.name ?? "Non assigne",
        rawDate: incident.identifiedAt.toISOString(),
        title: `${incident.reference} - ${incident.title}`,
        type: eventLabels.incident,
      },
      ...incident.updates.map((update) => ({
        asset: incident.asset.name,
        assetId: incident.assetId,
        date: formatDate(update.createdAt),
        detail: update.comment,
        id: `incident-update-${update.id}`,
        metadata: update.statusTo
          ? incidentStatusLabels[update.statusTo] ?? update.statusTo
          : "Sans changement de statut",
        owner: update.author?.name ?? "Systeme",
        rawDate: update.createdAt.toISOString(),
        title: incident.reference,
        type: eventLabels.incidentUpdate,
      })),
    ]),
  ].sort((first, second) => second.rawDate.localeCompare(first.rawDate));

  return {
    assets: assets.map((asset) => ({
      category: asset.category.name,
      id: asset.id,
      location: asset.location?.name ?? "Non localise",
      name: asset.name,
      sku: asset.sku,
    })),
    events,
  };
}
