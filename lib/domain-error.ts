import { NextResponse } from "next/server";

/** Erreur metier portant son code HTTP : les routes la traduisent sans logique propre. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  sku: "cette reference (SKU)",
  serialNumber: "ce numero de serie",
  barcode: "ce code-barres",
  matricule: "ce matricule",
};

function uniqueViolationMessage(error: { meta?: { target?: unknown } }) {
  const target = JSON.stringify(error.meta?.target ?? "");
  const field = Object.keys(UNIQUE_FIELD_LABELS).find((key) => target.includes(key));
  return field
    ? `Un enregistrement utilise deja ${UNIQUE_FIELD_LABELS[field]}.`
    : "Une valeur unique est deja utilisee.";
}

/** Reponse JSON pour une erreur metier (ou une contrainte d'unicite) ; toute autre erreur remonte (500). */
export function domainErrorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002") {
    return NextResponse.json({ error: uniqueViolationMessage(error as never) }, { status: 409 });
  }
  throw error;
}
