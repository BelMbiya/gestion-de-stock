export type AssignmentReturnAlert = "DUE_SOON" | "OVERDUE" | null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDaysUntilDate(target: Date, now = new Date()) {
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  return Math.round((end - start) / MS_PER_DAY);
}

export function getAssignmentReturnAlert(
  expectedReturnAt: Date | null | undefined,
  status: string,
  now = new Date(),
): AssignmentReturnAlert {
  if (status !== "ACTIVE" && status !== "TRANSFERRED") {
    return null;
  }

  if (!expectedReturnAt) {
    return null;
  }

  const days = getDaysUntilDate(expectedReturnAt, now);

  if (days < 0) {
    return "OVERDUE";
  }

  if (days <= 5) {
    return "DUE_SOON";
  }

  return null;
}

export function getAssignmentReturnAlertLabel(alert: AssignmentReturnAlert) {
  switch (alert) {
    case "OVERDUE":
      return "Retour en retard";
    case "DUE_SOON":
      return "Retour dans 5 jours ou moins";
    default:
      return null;
  }
}
