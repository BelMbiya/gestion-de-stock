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

function calculateIncidentProgress({
  status,
  updateCount,
}: {
  status: string;
  updateCount: number;
}) {
  if (status === "RESOLVED" || status === "CLOSED") {
    return 100;
  }

  const base = incidentProgressBase[status] ?? 0;
  const ceiling = incidentProgressCeiling[status] ?? base;
  const updateBonus = Math.min(updateCount * 5, ceiling - base);

  return base + updateBonus;
}

export const incidentSeverityOptions = [
  { label: "Toutes criticites", value: "" },
  { label: "Basse", value: "LOW" },
  { label: "Moyenne", value: "MEDIUM" },
  { label: "Haute", value: "HIGH" },
  { label: "Critique", value: "CRITICAL" },
] as const;

export const incidentStatusOptions = [
  { label: "Tous statuts", value: "" },
  { label: "Identification", value: "IDENTIFIED" },
  { label: "Diagnostic", value: "DIAGNOSING" },
  { label: "Intervention", value: "IN_PROGRESS" },
  { label: "Piece commandee", value: "WAITING_PART" },
  { label: "Resolution validee", value: "RESOLVED" },
  { label: "Cloture", value: "CLOSED" },
] as const;

type IncidentWithRelations = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  identifiedAt: Date;
  asset: {
    name: string;
    location: { name: string } | null;
  };
  reporter: { name: string | null } | null;
  assignee: { name: string | null } | null;
  updates: {
    id: string;
    comment: string;
    statusTo: string | null;
    createdAt: Date;
    author: { name: string | null } | null;
  }[];
};

export function serializeIncident(incident: IncidentWithRelations) {
  return {
    id: incident.id,
    reference: incident.reference,
    title: incident.title,
    description: incident.description,
    asset: incident.asset.name,
    location: incident.asset.location?.name ?? "Non localise",
    reporter: incident.reporter?.name ?? "Non renseigne",
    assignee: incident.assignee?.name ?? "Non assigne",
    severity: severityLabels[incident.severity] ?? incident.severity,
    status: incidentStatusLabels[incident.status] ?? incident.status,
    progress: calculateIncidentProgress({
      status: incident.status,
      updateCount: incident.updates.length,
    }),
    identifiedAt: incident.identifiedAt.toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    updates: incident.updates.map((update) => ({
      id: update.id,
      author: update.author?.name ?? "Systeme",
      comment: update.comment,
      statusTo: update.statusTo
        ? incidentStatusLabels[update.statusTo] ?? update.statusTo
        : null,
      createdAt: update.createdAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })),
  };
}

export function getSeverityLabel(value: string) {
  return severityLabels[value] ?? value;
}

export function getStatusLabel(value: string) {
  return incidentStatusLabels[value] ?? value;
}
