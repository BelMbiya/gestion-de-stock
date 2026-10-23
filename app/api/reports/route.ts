import { NextResponse } from "next/server";

import { assignmentStatusLabels } from "@/lib/assignment-management";
import { assignmentKindLabels } from "@/lib/assignments/assignment-service";
import { withAuth } from "@/lib/auth/with-auth";
import { getSeverityLabel, getStatusLabel } from "@/lib/incident-serializer";
import { KYC_UI } from "@/lib/kyc-excel/terminology";
import { prisma } from "@/lib/prisma";
import type { FullReportData } from "@/lib/reports/full-report";
import { assetStatusLabels } from "@/lib/stock/asset-state";
import { movementTypeLabels } from "@/lib/stock/movement-rules";

export const dynamic = "force-dynamic";

const CLOSED_INCIDENT = ["RESOLVED", "CLOSED"];

const shortDate = (value: Date) => value.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const day = (value: Date | null) => (value ? value.toLocaleDateString("fr-FR") : "");

/** Note generee par l'import KYC : sans valeur dans un rapport. */
const meaningfulNote = (notes: string | null) => (notes && !notes.startsWith("Import KYC") ? notes : "");

/** Rapport complet (Excel / PDF du Tableau de bord) : aucune ligne tronquee. */
async function buildFullReport(): Promise<FullReportData> {
  const [assets, incidents, movements, assignments, inventoryChecks] = await Promise.all([
    prisma.asset.findMany({
      include: {
        assignments: { where: { status: "ACTIVE" }, include: { holder: true } },
        category: true,
        location: true,
        type: true,
      },
      orderBy: { sku: "asc" },
    }),
    prisma.incident.findMany({
      include: { asset: true, assignee: true, updates: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { identifiedAt: "desc" },
    }),
    prisma.stockMovement.findMany({
      include: { asset: true, fromLocation: true, performedBy: true, toLocation: true },
      orderBy: { movedAt: "desc" },
    }),
    prisma.assetAssignment.findMany({
      include: { asset: true, holder: { include: { department: true } } },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.inventoryCheck.count(),
  ]);

  const openIncidents = incidents.filter((incident) => !CLOSED_INCIDENT.includes(incident.status));
  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.purchaseValue ?? 0), 0);
  const byStatus = new Map<string, number>();
  for (const asset of assets) {
    const label = assetStatusLabels[asset.status];
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }),
    summary: [
      { label: KYC_UI.IT_ASSETS, value: String(assets.length), hint: KYC_UI.TRACKED_ITEMS },
      {
        label: KYC_UI.ESTIMATED_VALUE,
        value: totalValue.toLocaleString("fr-FR", { maximumFractionDigits: 0, style: "currency", currency: "USD" }),
        hint: KYC_UI.INVENTORY_BASE,
      },
      { label: KYC_UI.OPEN_INCIDENTS, value: String(openIncidents.length), hint: KYC_UI.OPEN_EXCLUDING_CLOSED },
      {
        label: "Affectations en cours",
        value: String(assignments.filter((assignment) => assignment.status === "ACTIVE").length),
        hint: "Materiel chez un detenteur",
      },
      { label: KYC_UI.INVENTORY_CHECKS, value: String(inventoryChecks), hint: KYC_UI.LOGGED_CHECKS },
      ...[...byStatus].map(([label, count]) => ({ label: `Statut — ${label}`, value: String(count), hint: "" })),
    ],
    assets: assets.map((asset) => ({
      code: asset.sku,
      name: asset.name,
      type: asset.type.name,
      category: asset.category.name,
      location: asset.location?.name ?? "Non localise",
      quantity: `${asset.quantityOnHand} ${asset.unit}`,
      holders: asset.assignments.map((assignment) => assignment.holder.fullName).join(", "),
      status: assetStatusLabels[asset.status],
      value: asset.purchaseValue ? asset.purchaseValue.toString() : "",
      updatedAt: shortDate(asset.updatedAt),
    })),
    incidents: incidents.map((incident) => ({
      reference: incident.reference,
      assetCode: incident.asset.sku,
      asset: incident.asset.name,
      title: incident.title,
      severity: getSeverityLabel(incident.severity),
      status: getStatusLabel(incident.status),
      open: !CLOSED_INCIDENT.includes(incident.status),
      assignee: incident.assignee?.name ?? "Non assigne",
      identifiedAt: shortDate(incident.identifiedAt),
      lastUpdate: incident.updates[0]?.comment ?? "",
    })),
    movements: movements.map((movement) => ({
      date: shortDate(movement.movedAt),
      type: movementTypeLabels[movement.type],
      assetCode: movement.asset.sku,
      asset: movement.asset.name,
      quantity: String(movement.quantity),
      from: movement.fromLocation?.name ?? "",
      to: movement.toLocation?.name ?? "",
      reason: movement.reason ?? "",
      performedBy: movement.performedBy?.name ?? "Systeme",
    })),
    assignments: assignments.map((assignment) => ({
      assetCode: assignment.asset.sku,
      asset: assignment.asset.name,
      holder: assignment.holder.fullName,
      department: assignment.holder.department?.name ?? assignment.holder.process ?? "",
      kind: assignmentKindLabels[assignment.kind],
      status: assignmentStatusLabels[assignment.status],
      active: assignment.status === "ACTIVE",
      assignedAt: day(assignment.assignedAt),
      returnedAt: day(assignment.returnedAt),
      notes: meaningfulNote(assignment.notes),
    })),
  };
}

export const GET = withAuth(async () => {
  return NextResponse.json(await buildFullReport());
});
