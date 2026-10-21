import type { HolderType, Prisma } from "@/lib/generated/prisma/client";

import { HolderHasHistoryError, HolderNotFoundError, HolderRuleError } from "./errors";
import { normalizeHolderName } from "./holder-names";

const holderTypes = ["PERSON", "COLLECTIVE"] as const;

type Tx = Prisma.TransactionClient;

export type HolderInput = {
  type: HolderType;
  fullName: unknown;
  matricule?: unknown;
  process?: unknown;
  departmentId?: unknown;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function validateHolderInput(tx: Tx, input: HolderInput, excludeId?: string) {
  if (!holderTypes.includes(input.type)) {
    throw new HolderRuleError("Type de detenteur inconnu : personne ou collectif.");
  }

  const fullName = typeof input.fullName === "string" ? normalizeHolderName(input.fullName).display : "";
  if (!fullName) {
    throw new HolderRuleError("Le nom du detenteur est obligatoire.");
  }

  const matricule = optionalText(input.matricule);
  if (matricule) {
    const taken = await tx.holder.findFirst({
      where: { matricule, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (taken) {
      throw new HolderRuleError(`Le matricule ${matricule} est deja utilise par ${taken.fullName}.`);
    }
  }

  return {
    type: input.type,
    fullName,
    matricule,
    process: optionalText(input.process),
    departmentId: optionalText(input.departmentId),
  };
}

export async function createHolder(tx: Tx, input: HolderInput) {
  const data = await validateHolderInput(tx, input);
  return tx.holder.create({ data: { ...data, active: true } });
}

export async function updateHolder(tx: Tx, id: string, input: HolderInput) {
  const existing = await tx.holder.findUnique({ where: { id } });
  if (!existing) {
    throw new HolderNotFoundError();
  }
  const data = await validateHolderInput(tx, input, id);
  return tx.holder.update({ where: { id }, data });
}

export async function setHolderActive(tx: Tx, id: string, active: boolean) {
  const existing = await tx.holder.findUnique({ where: { id } });
  if (!existing) {
    throw new HolderNotFoundError();
  }
  return tx.holder.update({ where: { id }, data: { active } });
}

/** Un detenteur avec historique se desactive ; seule une fiche creee par erreur se supprime. */
export async function deleteHolder(tx: Tx, id: string) {
  const existing = await tx.holder.findUnique({ where: { id } });
  if (!existing) {
    throw new HolderNotFoundError();
  }

  const [assignments, movements] = await Promise.all([
    tx.assetAssignment.count({ where: { holderId: id } }),
    tx.stockMovement.count({ where: { holderId: id } }),
  ]);
  if (assignments > 0 || movements > 0) {
    throw new HolderHasHistoryError();
  }

  await tx.holder.delete({ where: { id } });
}

/** Un detenteur parti (inactif) qui detient encore du materiel : a recuperer. */
export function holderFlags(holder: { active: boolean }, activeAssignments: number) {
  return { toRecover: !holder.active && activeAssignments > 0 };
}
