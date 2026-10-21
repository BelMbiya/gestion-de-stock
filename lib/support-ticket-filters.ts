import type { Prisma } from "@/lib/generated/prisma/client";

import { resolveHistoryPeriod } from "@/lib/period-range";

const categoryValues = ["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "OTHER"] as const;
const priorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const statusValues = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
] as const;

export type SupportTicketListFilters = {
  assetId?: string;
  assigneeId?: string;
  requesterId?: string;
  category?: (typeof categoryValues)[number];
  priority?: (typeof priorityValues)[number];
  status?: (typeof statusValues)[number];
  startDate?: Date;
  endDate?: Date;
};

export function parseSupportTicketSearchParams(searchParams: URLSearchParams) {
  const assetId = searchParams.get("assetId") ?? undefined;
  const assigneeId = searchParams.get("assigneeId") ?? undefined;
  const requesterId = searchParams.get("requesterId") ?? undefined;
  const categoryParam = searchParams.get("category");
  const priorityParam = searchParams.get("priority");
  const statusParam = searchParams.get("status");
  const period = searchParams.get("period");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const specificDate = searchParams.get("date");

  const range = resolveHistoryPeriod(period, startDate, endDate, specificDate);

  return {
    assetId,
    assigneeId,
    requesterId,
    category: categoryValues.find((value) => value === categoryParam),
    priority: priorityValues.find((value) => value === priorityParam),
    status: statusValues.find((value) => value === statusParam),
    startDate: range.from ?? undefined,
    endDate: range.to ?? undefined,
  } satisfies SupportTicketListFilters;
}

export function hasSupportTicketListFilters(filters: SupportTicketListFilters) {
  return Boolean(
    filters.assetId ||
      filters.assigneeId ||
      filters.requesterId ||
      filters.category ||
      filters.priority ||
      filters.status ||
      filters.startDate ||
      filters.endDate,
  );
}

export function buildSupportTicketWhere(
  filters: SupportTicketListFilters,
): Prisma.SupportTicketWhereInput {
  const openedAt =
    filters.startDate || filters.endDate
      ? {
          ...(filters.startDate ? { gte: filters.startDate } : {}),
          ...(filters.endDate ? { lte: filters.endDate } : {}),
        }
      : undefined;

  return {
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.requesterId ? { requesterId: filters.requesterId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(openedAt ? { openedAt } : {}),
  };
}
