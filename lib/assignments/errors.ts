import { DomainError } from "@/lib/domain-error";

export class AssignmentRuleError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AssignmentNotFoundError extends DomainError {
  constructor() {
    super("Affectation introuvable.", 404);
  }
}
