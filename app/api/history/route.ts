import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import {
  buildMaterialHistory,
  resolveHistoryPeriod,
} from "@/lib/material-history";

export const dynamic = "force-dynamic";

const getCachedHistory = unstable_cache(
  async () => buildMaterialHistory(),
  ["material-history-data"],
  {
    revalidate: 60,
    tags: ["history", "movements", "assignments", "incidents", "inventory"],
  },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId") ?? undefined;
  const technicianId = searchParams.get("technicianId") ?? undefined;
  const period = searchParams.get("period");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const specificDate = searchParams.get("date");

  const hasFilters =
    assetId ||
    technicianId ||
    period ||
    startDate ||
    endDate ||
    specificDate;

  if (!hasFilters) {
    return NextResponse.json(await getCachedHistory());
  }

  const range = resolveHistoryPeriod(period, startDate, endDate, specificDate);
  const data = await buildMaterialHistory({
    assetId,
    technicianId,
    startDate: range.from ?? undefined,
    endDate: range.to ?? undefined,
  });

  return NextResponse.json(data);
}
