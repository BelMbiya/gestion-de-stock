import { DomainError } from "@/lib/domain-error";

export class UserRuleError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super("Compte introuvable.", 404);
  }
}

/** Action refusee pour garder l'application administrable ou l'historique intact. */
export class UserConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
  }
}
