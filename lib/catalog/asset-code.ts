import type { Prisma } from "@/lib/generated/prisma/client";
import { StockRuleError } from "@/lib/stock/errors";

const PREFIX = /^[A-Z]{2,4}$/;
const CODE = /^([A-Z]{2,4})-(\d{4,})$/;

/** « MS » + 1 -> « MS-0001 » ; au-dela de 9999, le numero s'allonge (« DSK-10000 »). */
export function formatAssetCode(prefix: string, number: number) {
  if (!PREFIX.test(prefix)) {
    throw new Error(`Prefixe de type invalide : ${prefix}`);
  }
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Numero de materiel invalide : ${number}`);
  }
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

export function parseAssetCode(code: string) {
  const match = CODE.exec(code);
  return match ? { prefix: match[1], number: Number(match[2]) } : null;
}

/**
 * Reserve le prochain code d'un type. L'increment du compteur verrouille la ligne du type
 * jusqu'a la fin de la transaction : deux creations simultanees ne recoivent jamais le meme code,
 * et un numero n'est jamais reutilise.
 */
export async function allocateAssetCode(tx: Prisma.TransactionClient, typeId: string) {
  const type = await tx.assetType.findUnique({ where: { id: typeId } });
  if (!type || !type.active) {
    throw new StockRuleError("Type de materiel inconnu ou desactive.");
  }

  const updated = await tx.assetType.update({
    where: { id: typeId },
    data: { nextNumber: { increment: 1 } },
  });

  return formatAssetCode(type.prefix, updated.nextNumber - 1);
}
