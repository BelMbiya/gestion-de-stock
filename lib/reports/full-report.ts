import type { PdfTableSection } from "@/lib/pdf-export";

/** Donnees du rapport complet, deja libellees en francais par /api/reports (cellules texte). */
export type FullReportData = {
  generatedAt: string;
  summary: Array<{ label: string; value: string; hint: string }>;
  assets: Array<{
    code: string;
    name: string;
    type: string;
    category: string;
    location: string;
    quantity: string;
    holders: string;
    status: string;
    value: string;
    updatedAt: string;
  }>;
  incidents: Array<{
    reference: string;
    assetCode: string;
    asset: string;
    title: string;
    severity: string;
    status: string;
    open: boolean;
    assignee: string;
    identifiedAt: string;
    lastUpdate: string;
  }>;
  movements: Array<{
    date: string;
    type: string;
    assetCode: string;
    asset: string;
    quantity: string;
    from: string;
    to: string;
    reason: string;
    performedBy: string;
  }>;
  assignments: Array<{
    assetCode: string;
    asset: string;
    holder: string;
    department: string;
    kind: string;
    status: string;
    active: boolean;
    assignedAt: string;
    returnedAt: string;
    notes: string;
  }>;
};

export type ReportSheet = { name: string; columns: string[]; rows: string[][] };

const summarySheet = (data: FullReportData): ReportSheet => ({
  name: "Synthese",
  columns: ["Indicateur", "Valeur", "Detail"],
  rows: data.summary.map((item) => [item.label, item.value, item.hint]),
});

const stockSheet = (data: FullReportData): ReportSheet => ({
  name: "Stock",
  columns: ["Code", "Designation", "Type", "Categorie", "Localisation", "Quantite", "Detenteur(s)", "Statut", "Valeur", "Mis a jour"],
  rows: data.assets.map((a) => [a.code, a.name, a.type, a.category, a.location, a.quantity, a.holders, a.status, a.value, a.updatedAt]),
});

const incidentColumns = ["Reference", "Code", "Materiel", "Panne", "Criticite", "Statut", "Technicien", "Identifiee le", "Derniere mise a jour"];
const incidentRow = (i: FullReportData["incidents"][number]) => [
  i.reference,
  i.assetCode,
  i.asset,
  i.title,
  i.severity,
  i.status,
  i.assignee,
  i.identifiedAt,
  i.lastUpdate,
];

const assignmentColumns = ["Code", "Materiel", "Detenteur", "Departement / process", "Type", "Statut", "Remis le", "Retour le", "Notes"];
const assignmentRow = (a: FullReportData["assignments"][number]) => [
  a.assetCode,
  a.asset,
  a.holder,
  a.department,
  a.kind,
  a.status,
  a.assignedAt,
  a.returnedAt,
  a.notes,
];

/** Excel : exhaustif, une feuille par domaine, aucune ligne omise. */
export function buildFullReportSheets(data: FullReportData): ReportSheet[] {
  return [
    summarySheet(data),
    stockSheet(data),
    { name: "Pannes", columns: incidentColumns, rows: data.incidents.map(incidentRow) },
    {
      name: "Mouvements",
      columns: ["Date", "Type", "Code", "Materiel", "Quantite", "De", "Vers", "Motif", "Par"],
      rows: data.movements.map((m) => [m.date, m.type, m.assetCode, m.asset, m.quantity, m.from, m.to, m.reason, m.performedBy]),
    },
    { name: "Affectations", columns: assignmentColumns, rows: data.assignments.map(assignmentRow) },
  ];
}

/** PDF : lisible a l'impression, centre sur l'etat du parc et ce qui reste a traiter. */
export function buildFullReportPdfSections(data: FullReportData): Array<PdfTableSection & { title: string }> {
  const [summary, stock] = [summarySheet(data), stockSheet(data)];
  return [
    { title: summary.name, columns: summary.columns, rows: summary.rows },
    { title: stock.name, columns: stock.columns, rows: stock.rows },
    {
      title: "Pannes ouvertes",
      columns: incidentColumns,
      rows: data.incidents.filter((incident) => incident.open).map(incidentRow),
    },
    {
      title: "Affectations en cours",
      columns: assignmentColumns,
      rows: data.assignments.filter((assignment) => assignment.active).map(assignmentRow),
    },
  ];
}
