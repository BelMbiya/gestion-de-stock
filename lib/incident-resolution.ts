export const RESOLUTION_STEPS = [
  "Identification",
  "Diagnostic",
  "Intervention",
  "Validation",
  "Resolution",
] as const;

const statusToStepIndex: Record<string, number> = {
  IDENTIFIED: 0,
  DIAGNOSING: 1,
  IN_PROGRESS: 2,
  WAITING_PART: 2,
  RESOLVED: 3,
  CLOSED: 4,
};

const statusSortGroup: Record<string, number> = {
  IDENTIFIED: 0,
  DIAGNOSING: 1,
  IN_PROGRESS: 1,
  WAITING_PART: 1,
  RESOLVED: 2,
  CLOSED: 2,
};

export function getResolutionStepIndex(statusCode: string) {
  return statusToStepIndex[statusCode] ?? 0;
}

export function isResolutionComplete(statusCode: string) {
  return statusCode === "RESOLVED" || statusCode === "CLOSED";
}

export function getResolutionStepState(stepIndex: number, statusCode: string) {
  const activeIndex = getResolutionStepIndex(statusCode);

  if (isResolutionComplete(statusCode)) {
    return "completed";
  }

  if (stepIndex < activeIndex) {
    return "completed";
  }

  if (stepIndex === activeIndex) {
    return "current";
  }

  return "pending";
}

export function sortIncidentsByResolutionPriority<
  T extends { progress: number; statusCode: string },
>(incidents: T[]) {
  return [...incidents].sort((first, second) => {
    const groupDiff =
      (statusSortGroup[first.statusCode] ?? 1) -
      (statusSortGroup[second.statusCode] ?? 1);

    if (groupDiff !== 0) {
      return groupDiff;
    }

    if ((statusSortGroup[first.statusCode] ?? 1) === 2) {
      return second.progress - first.progress;
    }

    return first.progress - second.progress;
  });
}
