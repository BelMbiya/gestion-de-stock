import { DomainError } from "@/lib/domain-error";

/** Regle de stock non respectee (400). */
export class StockRuleError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

/** Le stock a change entre la lecture et l'ecriture (409). */
export class StockConflictError extends DomainError {
  constructor(message = "Le stock a change pendant l'operation : rechargez puis reessayez.") {
    super(message, 409);
  }
}

export class AssetNotFoundError extends DomainError {
  constructor() {
    super("Article introuvable.", 404);
  }
}

export class AssetHasHistoryError extends DomainError {
  constructor() {
    super(
      "Cet article a un historique (mouvements, affectations, pannes, inventaires ou journal) : " +
        "il ne peut pas etre supprime. Reformez-le plutot via « Changer l'etat ».",
      409,
    );
  }
}
