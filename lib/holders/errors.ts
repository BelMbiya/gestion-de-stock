import { DomainError } from "@/lib/domain-error";

export class HolderRuleError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class HolderNotFoundError extends DomainError {
  constructor() {
    super("Detenteur introuvable.", 404);
  }
}

export class HolderHasHistoryError extends DomainError {
  constructor() {
    super(
      "Ce detenteur a un historique (affectations ou sorties de stock) : desactivez-le plutot que de le supprimer.",
      409,
    );
  }
}
