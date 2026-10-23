import { assignmentStatusLabels } from "@/lib/assignment-management";
import { assignmentKindLabels } from "@/lib/assignments/assignment-service";
import { prisma } from "@/lib/prisma";
import { movementTypeLabels } from "@/lib/stock/movement-rules";

export { resolveHistoryPeriod } from "@/lib/period-range";

export const eventLabels = {
  assignment: "Affectation",
  incident: "Panne",
  incidentUpdate: "Suivi panne",
  movement: "Mouvement",
} as const;

/** Les notes generees par l'import KYC (« Import KYC — … ») n'apportent rien a l'historique. */
function meaningfulNote(notes: string | null) {
  return notes && !notes.startsWith("Import KYC") ? notes : null;
}

function movementRoute(from?: string | null, to?: string | null, quantity = 1) {
  const route = from || to ? `${from ?? "-"} -> ${to ?? "-"}` : "";
  const qty = quantity !== 1 ? `Qte ${quantity}` : "";
  return [route, qty].filter(Boolean).join(" · ");
}

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
        ...(technicianId ? { issuedById: technicianId } : {}),
        ...(assignedAt ? { assignedAt } : {}),
      },
      include: {
        asset: true,
        holder: true,
        issuedBy: true,
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
    ...movements.map((movement) => ({
      asset: movement.asset.name,
      assetCode: movement.asset.sku,
      assetId: movement.assetId,
      date: formatDate(movement.movedAt),
      detail: movement.reason ?? "Aucun motif renseigne",
      id: `movement-${movement.id}`,
      metadata: movementRoute(movement.fromLocation?.name, movement.toLocation?.name, movement.quantity),
      owner: movement.performedBy?.name ?? "Systeme",
      rawDate: movement.movedAt.toISOString(),
      title: movementTypeLabels[movement.type] ?? movement.type,
      type: eventLabels.movement,
    })),
    ...assignments.map((assignment) => ({
      asset: assignment.asset.name,
      assetCode: assignment.asset.sku,
      assetId: assignment.assetId,
      date: formatDate(assignment.assignedAt),
      detail: [`Detenteur : ${assignment.holder.fullName}`, meaningfulNote(assignment.notes)].filter(Boolean).join(" · "),
      id: `assignment-${assignment.id}`,
      metadata: assignment.returnedAt ? `Retour le ${formatDate(assignment.returnedAt)}` : "",
      owner: assignment.issuedBy?.name ?? assignment.issuedBy?.email ?? "Import",
      rawDate: assignment.assignedAt.toISOString(),
      title: `${assignmentKindLabels[assignment.kind]} · ${assignmentStatusLabels[assignment.status]}`,
      type: eventLabels.assignment,
    })),
    ...incidents.flatMap((incident) => [
      {
        asset: incident.asset.name,
        assetCode: incident.asset.sku,
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
        assetCode: incident.asset.sku,
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
      model: asset.model,
      name: asset.name,
      serialNumber: asset.serialNumber,
      sku: asset.sku,
    })),
    events,
  };
}
