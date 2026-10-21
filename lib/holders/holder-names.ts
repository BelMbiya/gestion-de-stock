import type { HolderType } from "@/lib/generated/prisma/enums";

/** Detenteur collectif provisoire pour les lignes Excel sans nom exploitable (« - »). */
export const UNKNOWN_HOLDER_NAME = "À identifier";

export const holderTypeLabels: Record<HolderType, string> = {
  PERSON: "Personne",
  COLLECTIVE: "Collectif",
};

/** Nom affiche (espaces normalises) et cle de comparaison (insensible a la casse). */
export function normalizeHolderName(raw: string) {
  const display = raw.trim().replace(/\s+/g, " ");
  return { display, key: display.toLocaleUpperCase("fr-FR") };
}

/** « - », « ? », « . » : nom de detenteur non renseigne dans l'Excel. */
export function isUnknownHolderName(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  return value === "" || /^[-–—.?]+$/.test(value);
}

/** « AGENTS », « Agents Backoffice » : postes partages, pas une personne. */
export function classifyHolderType(displayName: string): HolderType {
  if (displayName === UNKNOWN_HOLDER_NAME || /^agents?\b/i.test(displayName)) {
    return "COLLECTIVE";
  }
  return "PERSON";
}
