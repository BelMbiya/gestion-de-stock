import type {
  AssetCondition,
  AssetStatus,
  AssignmentKind,
  Prisma,
  ReturnOutcome,
} from "@/lib/generated/prisma/client";
import { assetStatusLabels } from "@/lib/stock/asset-state";
import { AssetNotFoundError } from "@/lib/stock/errors";
import { getTrackingPolicy } from "@/lib/stock/tracking-policy";

import { AssignmentNotFoundError, AssignmentRuleError } from "./errors";

export const assignmentKinds = ["DOTATION", "LOAN"] as const;
export const returnOutcomes = ["GOOD", "TO_REPAIR", "LOST"] as const;
const assetConditions = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

export const assignmentKindLabels: Record<AssignmentKind, string> = {
  DOTATION: "Dotation",
  LOAN: "Pret",
};

export const returnOutcomeLabels: Record<ReturnOutcome, string> = {
  GOOD: "Bon etat",
  TO_REPAIR: "A reparer",
  LOST: "Perdu",
};

const statusAfterReturn: Record<ReturnOutcome, AssetStatus> = {
  GOOD: "AVAILABLE",
  TO_REPAIR: "MAINTENANCE",
  LOST: "LOST",
};

type Tx = Prisma.TransactionClient;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function cleanNotes(notes: unknown) {
  return typeof notes === "string" && notes.trim() ? notes.trim() : null;
}

/** Valide type, detenteur et date de retour ; renvoie la date a enregistrer. */
async function validateTarget(
  tx: Tx,
  { holderId, kind, expectedReturnAt }: { holderId: string; kind: AssignmentKind; expectedReturnAt?: Date | null },
) {
  if (!assignmentKinds.includes(kind)) {
    throw new AssignmentRuleError("Type d'affectation inconnu : dotation ou pret.");
  }

  const holder = await tx.holder.findUnique({ where: { id: holderId } });
  if (!holder) {
    throw new AssignmentRuleError("Detenteur introuvable.");
  }
  if (!holder.active) {
    throw new AssignmentRuleError("Ce detenteur est inactif : il ne peut plus recevoir de materiel.");
  }

  if (kind === "DOTATION") {
    return null;
  }

  const returnDate = expectedReturnAt ? new Date(expectedReturnAt) : null;
  if (!returnDate || Number.isNaN(returnDate.getTime()) || returnDate < startOfToday()) {
    throw new AssignmentRuleError("Un pret exige une date de retour, aujourd'hui ou plus tard.");
  }
  return returnDate;
}

async function audit(tx: Tx, action: "ASSIGN" | "TRANSFER" | "UPDATE", assignmentId: string, assetId: string, actorId: string, description: string) {
  await tx.auditLog.create({
    data: { action, entityType: "AssetAssignment", entityId: assignmentId, assetId, actorId, description },
  });
}

type AssignCommand = {
  assetId: string;
  holderId: string;
  kind: AssignmentKind;
  expectedReturnAt?: Date | null;
  notes?: unknown;
  actorId: string;
};

/** Remet un materiel unitaire disponible a un detenteur actif (dotation ou pret). */
export async function assignAsset(tx: Tx, command: AssignCommand) {
  if (!assignmentKinds.includes(command.kind)) {
    throw new AssignmentRuleError("Type d'affectation inconnu : dotation ou pret.");
  }

  const asset = await tx.asset.findUnique({ where: { id: command.assetId } });
  if (!asset) {
    throw new AssetNotFoundError();
  }

  if (!getTrackingPolicy(asset.trackingMode).canAssign) {
    throw new AssignmentRuleError(
      "Article en vrac : il ne s'affecte pas, enregistrez une sortie de stock avec le beneficiaire.",
    );
  }

  const active = await tx.assetAssignment.count({ where: { assetId: asset.id, status: "ACTIVE" } });
  if (active > 0) {
    throw new AssignmentRuleError("Ce materiel est deja affecte : rendez-le ou reaffectez-le.");
  }

  if (asset.status !== "AVAILABLE") {
    throw new AssignmentRuleError(
      `Ce materiel n'est pas disponible (statut : ${assetStatusLabels[asset.status]}).`,
    );
  }

  const expectedReturnAt = await validateTarget(tx, command);

  const assignment = await tx.assetAssignment.create({
    data: {
      assetId: asset.id,
      holderId: command.holderId,
      kind: command.kind,
      status: "ACTIVE",
      assignedAt: new Date(),
      expectedReturnAt,
      issuedById: command.actorId,
      notes: cleanNotes(command.notes),
    },
  });

  await tx.asset.update({ where: { id: asset.id }, data: { status: "ASSIGNED" } });
  await audit(tx, "ASSIGN", assignment.id, asset.id, command.actorId, `${assignmentKindLabels[command.kind]} remise`);

  return assignment;
}

type ReturnCommand = {
  assignmentId: string;
  outcome: ReturnOutcome;
  condition?: AssetCondition;
  notes?: unknown;
  actorId: string;
};

/** Recupere un materiel : son statut suit l'etat constate au retour. */
export async function returnAsset(tx: Tx, command: ReturnCommand) {
  if (!returnOutcomes.includes(command.outcome)) {
    throw new AssignmentRuleError("Etat de retour inconnu : bon etat, a reparer ou perdu.");
  }
  if (command.condition !== undefined && !assetConditions.includes(command.condition)) {
    throw new AssignmentRuleError("Condition du materiel inconnue.");
  }

  const assignment = await tx.assetAssignment.findUnique({ where: { id: command.assignmentId } });
  if (!assignment) {
    throw new AssignmentNotFoundError();
  }
  if (assignment.status !== "ACTIVE") {
    throw new AssignmentRuleError("Cette affectation est deja cloturee.");
  }

  const notes = cleanNotes(command.notes);
  const updated = await tx.assetAssignment.update({
    where: { id: assignment.id },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
      returnedById: command.actorId,
      returnOutcome: command.outcome,
      ...(notes ? { notes } : {}),
    },
  });

  await tx.asset.update({
    where: { id: assignment.assetId },
    data: {
      status: statusAfterReturn[command.outcome],
      ...(command.condition ? { condition: command.condition } : {}),
    },
  });
  await audit(
    tx,
    "UPDATE",
    assignment.id,
    assignment.assetId,
    command.actorId,
    `Retour : ${returnOutcomeLabels[command.outcome]}`,
  );

  return updated;
}

type ReassignCommand = {
  assignmentId: string;
  holderId: string;
  kind: AssignmentKind;
  expectedReturnAt?: Date | null;
  notes?: unknown;
  actorId: string;
};

/** Passe directement le materiel a un autre detenteur : l'ancienne affectation est « Transferee ». */
export async function reassignAsset(tx: Tx, command: ReassignCommand) {
  const current = await tx.assetAssignment.findUnique({ where: { id: command.assignmentId } });
  if (!current) {
    throw new AssignmentNotFoundError();
  }
  if (current.status !== "ACTIVE") {
    throw new AssignmentRuleError("Cette affectation est deja cloturee.");
  }
  if (current.holderId === command.holderId) {
    throw new AssignmentRuleError("Le materiel est deja chez ce meme detenteur.");
  }

  // Toutes les verifications avant la premiere ecriture.
  const expectedReturnAt = await validateTarget(tx, command);

  await tx.assetAssignment.update({
    where: { id: current.id },
    data: { status: "TRANSFERRED", returnedAt: new Date(), returnedById: command.actorId },
  });

  const next = await tx.assetAssignment.create({
    data: {
      assetId: current.assetId,
      holderId: command.holderId,
      kind: command.kind,
      status: "ACTIVE",
      assignedAt: new Date(),
      expectedReturnAt,
      issuedById: command.actorId,
      notes: cleanNotes(command.notes),
    },
  });

  await tx.asset.update({ where: { id: current.assetId }, data: { status: "ASSIGNED" } });
  await audit(tx, "TRANSFER", next.id, current.assetId, command.actorId, "Reaffectation a un autre detenteur");

  return next;
}

type UpdateCommand = {
  assignmentId: string;
  expectedReturnAt?: Date | null;
  notes?: unknown;
  actorId: string;
};

/** Modifie les notes ou la date de retour d'un pret en cours (sans changer detenteur ni materiel). */
export async function updateAssignment(tx: Tx, command: UpdateCommand) {
  const assignment = await tx.assetAssignment.findUnique({ where: { id: command.assignmentId } });
  if (!assignment) {
    throw new AssignmentNotFoundError();
  }

  const data: Prisma.AssetAssignmentUncheckedUpdateInput = {};
  if (command.notes !== undefined) {
    data.notes = cleanNotes(command.notes);
  }
  if (command.expectedReturnAt !== undefined) {
    if (assignment.kind !== "LOAN" || assignment.status !== "ACTIVE") {
      throw new AssignmentRuleError("Seul un pret en cours a une date de retour modifiable.");
    }
    const date = command.expectedReturnAt ? new Date(command.expectedReturnAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date < startOfToday()) {
      throw new AssignmentRuleError("Un pret exige une date de retour, aujourd'hui ou plus tard.");
    }
    data.expectedReturnAt = date;
  }

  const updated = await tx.assetAssignment.update({ where: { id: assignment.id }, data });
  await audit(tx, "UPDATE", assignment.id, assignment.assetId, command.actorId, "Affectation modifiee");
  return updated;
}
