import type { Prisma } from "@/lib/generated/prisma/client";

import { resolveHistoryPeriod } from "@/lib/period-range";

const severityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const statusValues = [
  "IDENTIFIED",
  "DIAGNOSING",
  "IN_PROGRESS",
  "WAITING_PART",
  "RESOLVED",
  "CLOSED",
] as const;

export type IncidentListFilters = {
  assetId?: string;
  assigneeId?: string;
  severity?: (typeof severityValues)[number];
  status?: (typeof statusValues)[number];
  startDate?: Date;
  endDate?: Date;
};

export function parseIncidentSearchParams(searchParams: URLSearchParams) {
  const assetId = searchParams.get("assetId") ?? undefined;
  const assigneeId = searchParams.get("assigneeId") ?? undefined;
  const severityParam = searchParams.get("severity");
  const statusParam = searchParams.get("status");
  const period = searchParams.get("period");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const specificDate = searchParams.get("date");

  const range = resolveHistoryPeriod(period, startDate, endDate, specificDate);

  const severity = severityValues.find((value) => value === severityParam);
  const status = statusValues.find((value) => value === statusParam);

  return {
    assetId,
    assigneeId,
    severity,
    status,
    startDate: range.from ?? undefined,
    endDate: range.to ?? undefined,
  } satisfies IncidentListFilters;
}

export function hasIncidentListFilters(filters: IncidentListFilters) {
  return Boolean(
    filters.assetId ||
      filters.assigneeId ||
      filters.severity ||
      filters.status ||
      filters.startDate ||
      filters.endDate,
  );
}

export function buildIncidentWhere(
  filters: IncidentListFilters,
): Prisma.IncidentWhereInput {
  const identifiedAt =
    filters.startDate || filters.endDate
      ? {
          ...(filters.startDate ? { gte: filters.startDate } : {}),
          ...(filters.endDate ? { lte: filters.endDate } : {}),
        }
      : undefined;

  return {
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(identifiedAt ? { identifiedAt } : {}),
  };
}
