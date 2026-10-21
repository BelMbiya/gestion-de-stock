import type { AssignmentStatus } from "@/lib/generated/prisma/enums";

/** « Transfere » : affectation cloturee parce que le materiel est passe a un autre detenteur. */
export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ACTIVE: "En cours",
  RETURNED: "Retourne",
  TRANSFERRED: "Transfere",
};
